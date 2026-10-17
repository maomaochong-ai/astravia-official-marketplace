/**
 * REA 实时会话状态：把宿主推来的 ConversationEvent 收敛成一份可直接渲染的快照。
 *
 * 设计约束：
 * - 快照对象必须"内容不变则引用不变"，因为 UI 用 useSyncExternalStore 订阅。
 * - 只保留最近的调用（MAX_CALLS）与错误（MAX_ERRORS），长期会话不涨内存。
 * - 不做任何写入宿主状态的动作，纯派生。
 */

import type { ConversationEvent, PluginCliProviderPhase } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import { classifyTool, detectTargetFromText, type ReaStageId, STAGE_ORDER } from "./tool-taxonomy";
import { inferTargetHint } from "./target-inference";

export const MAX_CALLS = 80;
export const MAX_ERRORS = 20;

/**
 * 目标类型是被哪类证据认出来的。权重递增：工具名族（最弱）< 调用参数里的路径 < 入口工具。
 * 弱证据不得覆盖强证据 —— 否则一次 `inspect_plist` 就能把已经打开的 macOS 应用
 * 从 native 改成 mobile，chip 上的高亮会来回跳。
 */
export type TargetSource = "tool" | "args" | "entry";

const TARGET_SOURCE_RANK: Readonly<Record<TargetSource, number>> = { tool: 1, args: 2, entry: 3 };

/** 一上手就直指单一目标类型的入口工具：它们给出的结论比后续零散工具可信。 */
const ENTRY_TOOLS: ReadonlySet<string> = new Set([
	"open_binary",
	"binary_session",
	"inspect_artifact",
	"inspect_binary_layout",
	"inspect_managed_artifact",
	"analyze_javascript_application",
	"inspect_android_package",
	"inspect_firmware_regions",
	"extract_firmware",
	"list_browser_targets",
	"list_electron_targets",
	"list_javascript_runtime_targets",
	"open_jeb_project",
	"start_gdb_session",
	"start_frida_session",
]);

export interface ReaLiveCall {
	readonly id: string;
	/** REA 自己的工具名（已从 mcp_<server>_<tool> 还原）。 */
	readonly toolName: string;
	/** 宿主给出的原始工具名，便于排查。 */
	readonly rawToolName: string;
	readonly stage: ReaStageId | null;
	readonly targets: readonly TargetKind[];
	readonly argsPreview: string;
	readonly targetPath: string | null;
	readonly startedAt: number;
	readonly endedAt: number | null;
	readonly isError: boolean | null;
	readonly cwd: string | null;
}

export interface ReaLiveError {
	readonly toolName: string;
	readonly message: string;
	readonly at: number;
}

export interface ReaLiveState {
	readonly calls: readonly ReaLiveCall[];
	readonly errors: readonly ReaLiveError[];
	readonly activeStage: ReaStageId | null;
	readonly visitedStages: readonly ReaStageId[];
	readonly stageCallCounts: Readonly<Record<ReaStageId, number>>;
	readonly detectedTarget: TargetKind | null;
	/** 这个类型是哪类证据认出来的：入口工具 / 调用参数 / 工具名族（见 targetSignal）。 */
	readonly detectedSource: TargetSource | null;
	/** 用户消息里提到的目标类型（比工具调用更早出现，用于自动选中类型）。 */
	readonly hintedTarget: TargetKind | null;
	/** 用户消息里提到的路径/URL。 */
	readonly hintedPath: string | null;
	/** 会话里最近一次带路径的调用参数；工作台可据此一键回填目标。 */
	readonly lastTargetPath: string | null;
	readonly runningToolNames: readonly string[];
	readonly callCount: number;
	readonly errorCount: number;
	readonly lastActivityAt: number | null;
	readonly turns: number;
	readonly sessionId: string | null;
	readonly cwd: string | null;
	readonly providerPhase: PluginCliProviderPhase | null;
	readonly providerMessage: string | null;
}

const EMPTY_STAGE_COUNTS: Readonly<Record<ReaStageId, number>> = {
	connect: 0,
	route: 0,
	summary: 0,
	plan: 0,
	read: 0,
	finish: 0,
};

export const EMPTY_LIVE_STATE: ReaLiveState = {
	calls: [],
	errors: [],
	activeStage: null,
	visitedStages: [],
	stageCallCounts: EMPTY_STAGE_COUNTS,
	detectedTarget: null,
	detectedSource: null,
	lastTargetPath: null,
	hintedTarget: null,
	hintedPath: null,
	runningToolNames: [],
	callCount: 0,
	errorCount: 0,
	lastActivityAt: null,
	turns: 0,
	sessionId: null,
	cwd: null,
	providerPhase: null,
	providerMessage: null,
};

const PATH_KEYS: readonly string[] = [
	"targetPath",
	"target",
	"path",
	"file",
	"filePath",
	"binary",
	"artifact",
	"package",
	"apk",
	"assembly",
	"image",
	"url",
	"query",
	"spec",
];

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickTargetPath(args: unknown): string | null {
	const record = asRecord(args);
	if (!record) return null;
	for (const key of PATH_KEYS) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return null;
}

/**
 * 一次调用里能读出目标类型的所有证据，按可信度挑一条。
 * 返回值 null 表示这次调用没有提供任何目标类型信息（不编造）。
 */
function targetSignal(
	toolName: string,
	argsText: string | null,
	targetPath: string | null,
	toolTargets: readonly TargetKind[],
): { readonly kind: TargetKind; readonly source: TargetSource } | null {
	const byPath = detectTargetFromText(targetPath ?? argsText);
	if (byPath !== null) {
		return { kind: byPath, source: ENTRY_TOOLS.has(toolName) ? "entry" : "args" };
	}
	const byName = toolTargets[0] ?? null;
	if (byName !== null) return { kind: byName, source: ENTRY_TOOLS.has(toolName) ? "entry" : "tool" };
	return null;
}

/**
 * 参数预览：路径优先，否则 JSON。
 *
 * 上限 600 字符——折叠时只显示一行，展开要能看到整段参数；120 字符会造成
 * 「展开了还是不全」。80 条 × 600 字符的内存开销可以忽略。
 */
function previewArgs(args: unknown): string {
	const path = pickTargetPath(args);
	if (path) return truncate(path, 600);
	if (args === undefined || args === null) return "";
	try {
		return truncate(JSON.stringify(args), 600);
	} catch {
		return "";
	}
}

function errorMessage(value: unknown): string {
	if (typeof value === "string") return value;
	const record = asRecord(value);
	if (record) {
		for (const key of ["message", "error", "text", "reason"]) {
			const nested = record[key];
			if (typeof nested === "string" && nested.trim() !== "") return nested;
		}
		try {
			return truncate(JSON.stringify(record), 240);
		} catch {
			return "工具调用失败";
		}
	}
	return "工具调用失败";
}

/** args 直接是字符串时（例如只传一个路径），拿它当路径候选。 */
function textArg(args: unknown): string | null {
	return typeof args === "string" && args.trim() !== "" ? args : null;
}

export class ReaLiveStore {
	private state: ReaLiveState = EMPTY_LIVE_STATE;
	private readonly listeners = new Set<() => void>();
	private callIndex = new Map<string, ReaLiveCall>();
	private pendingRecoveryNotice: number | null = null;
	/** 置位时所在的会话；切到别的会话就作废——旧会话的中断不应该打断新会话。 */
	private pendingRecoverySession: string | null = null;
	/** 本会话内的 REA 调用数（跨会话不累加）。 */
	private sessionCalls = 0;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = (): ReaLiveState => this.state;

	/** 引擎从异常恢复时置位一次，由 Agent 侧的 continuation provider 取走。 */
	consumeRecoveryNotice(): number | null {
		const value = this.pendingRecoveryNotice;
		this.pendingRecoveryNotice = null;
		this.pendingRecoverySession = null;
		return value;
	}

	peekRecoveryNotice(): number | null {
		return this.pendingRecoveryNotice;
	}

	/** 这条恢复提示是不是当前会话产生的。 */
	recoveryAppliesTo(sessionId: string | null): boolean {
		return this.pendingRecoveryNotice !== null && sessionId !== null && this.pendingRecoverySession === sessionId;
	}

	/** 当前会话内的 REA 调用数（跨会话不累加，用来判断本会话到底做过逆向没有）。 */
	sessionCallCount(): number {
		return this.sessionCalls;
	}

	reset(): void {
		this.callIndex = new Map();
		this.pendingRecoveryNotice = null;
		this.pendingRecoverySession = null;
		this.sessionCalls = 0;
		this.commit((state) => ({
			...state,
			calls: [],
			errors: [],
			activeStage: null,
			visitedStages: [],
			stageCallCounts: EMPTY_STAGE_COUNTS,
			detectedTarget: null,
			detectedSource: null,
			runningToolNames: [],
			callCount: 0,
			errorCount: 0,
			turns: 0,
			lastTargetPath: null,
			hintedTarget: null,
			hintedPath: null,
		}));
	}

	/**
	 * 目标类型的证据合并：强证据可以覆盖弱证据，弱证据不能反过来改写强证据。
	 * 同一强度内后到的算数（用户先打开 .app 再钻到 app.asar，就是类型切换）。
	 */
	private mergeTarget(
		state: ReaLiveState,
		signal: { readonly kind: TargetKind; readonly source: TargetSource } | null,
	): Partial<Pick<ReaLiveState, "detectedTarget" | "detectedSource">> {
		if (signal === null) return {};
		const previousRank = state.detectedSource === null ? 0 : TARGET_SOURCE_RANK[state.detectedSource];
		if (TARGET_SOURCE_RANK[signal.source] < previousRank) return {};
		if (state.detectedTarget === signal.kind && state.detectedSource === signal.source) return {};
		return { detectedTarget: signal.kind, detectedSource: signal.source };
	}

	setProvider(phase: PluginCliProviderPhase, message?: string): void {
		const previous = this.state.providerPhase;
		const message_ = message ?? null;
		if (previous === phase && this.state.providerMessage === message_) return;
		// 只有「真的坏过又好了」才算恢复。checking / installing / verifying → ready 是
		// 正常启动握手，把它当恢复会每次新会话都往对话里塞一条续跑指令。
		if (previous === "failed" && phase === "ready" && this.state.sessionId !== null) {
			this.pendingRecoveryNotice = Date.now();
			this.pendingRecoverySession = this.state.sessionId;
		}
		this.commit((state) => ({ ...state, providerPhase: phase, providerMessage: message_ }));
	}

	/** 追加一条错误记录；不改变 errorCount（计数由 tool-call-end 维护）。 */
	noteError(toolName: string, message: string): void {
		const entry: ReaLiveError = { toolName, message, at: Date.now() };
		this.commit((state) => ({
			...state,
			errors: [entry, ...state.errors].slice(0, MAX_ERRORS),
		}));
	}

	ingest(event: ConversationEvent): void {
		switch (event.type) {
			case "turn-start":
				this.commit((state) => ({ ...state, turns: state.turns + 1, lastActivityAt: Date.now() }));
				return;
			case "turn-end":
				this.commit((state) => ({ ...state, lastActivityAt: Date.now() }));
				return;
			case "conversation-changed": {
				// 换会话：本会话计数归零，属于上个会话的恢复提示直接作废。
				this.sessionCalls = 0;
				if (this.pendingRecoverySession !== event.conversation.id) {
					this.pendingRecoveryNotice = null;
					this.pendingRecoverySession = null;
				}
				// 目标识别属于具体会话：不带上一个会话的结论，否则 chip 会亮错类型。
				const switched = this.state.sessionId !== event.conversation.id;
				this.commit((state) => ({
					...state,
					sessionId: event.conversation.id,
					cwd: event.conversation.cwd,
					...(switched
						? { detectedTarget: null, detectedSource: null, hintedTarget: null, hintedPath: null, lastTargetPath: null }
						: {}),
				}));
				return;
			}
			case "message-added": {
				// 用户消息里通常已经写清目标（路径/URL/产品类型）。只采信 role=user，
				// 模型自己说的话不能当作用户意图。
				if (event.message.role !== "user") return;
				const hint = inferTargetHint(event.message.text);
				if (hint.kind === null && hint.path === null) return;
				this.commit((state) => ({
					...state,
					hintedTarget: hint.kind ?? state.hintedTarget,
					hintedPath: hint.path ?? state.hintedPath,
				}));
				return;
			}
			case "tool-call-args":
				this.upsertCall(event.toolCallId, event.toolName, event.args, { authoritative: false });
				return;
			case "tool-call-start":
				this.upsertCall(event.toolCallId, event.toolName, event.args, { authoritative: true });
				return;
			case "tool-call-end":
				this.finishCall(event.toolCallId, event.toolName, event.isError);
				return;
			default:
				return;
		}
	}

	private upsertCall(
		id: string,
		rawToolName: string,
		args: unknown,
		options: { authoritative: boolean },
	): void {
		const existing = this.callIndex.get(id);
		const now = Date.now();
		if (existing) {
			const nextArgsPreview = previewArgs(args);
			const nextTargetPath = pickTargetPath(args);
			const signal = targetSignal(existing.toolName, textArg(args), nextTargetPath, existing.targets);
			const argsPreview = nextArgsPreview || existing.argsPreview;
			const targetPath = nextTargetPath ?? existing.targetPath;
			const startedAt = options.authoritative ? now : existing.startedAt;
			const unchanged =
				argsPreview === existing.argsPreview &&
				targetPath === existing.targetPath &&
				startedAt === existing.startedAt &&
				(signal === null || signal.kind === this.state.detectedTarget);
			if (unchanged) return;
			// 参数后到也可能带来新的目标类型：把参数证据并回这条调用，绑定到目标类型的图节点才亮得稳。
			const targets =
				signal !== null && !existing.targets.includes(signal.kind) ? [...existing.targets, signal.kind] : existing.targets;
			const updated: ReaLiveCall = {
				...existing,
				argsPreview,
				targetPath,
				targets,
				startedAt,
			};
			this.callIndex.set(id, updated);
			this.commit((state) => ({
				...state,
				calls: state.calls.map((call) => (call.id === id ? updated : call)),
				...this.mergeTarget(state, signal),
				lastTargetPath: targetPath ?? state.lastTargetPath,
				lastActivityAt: now,
			}));
			return;
		}

		const classification = classifyTool(rawToolName);
		const targetPath = pickTargetPath(args);
		const signal = targetSignal(classification.name, textArg(args), targetPath, classification.targets);
		// 参数证据也写进这条调用：图节点按目标类型绑定，只靠工具名会漏掉「路径说了算」的情况。
		const targets =
			signal !== null && !classification.targets.includes(signal.kind)
				? [...classification.targets, signal.kind]
				: classification.targets;
		const call: ReaLiveCall = {
			id,
			toolName: classification.name,
			rawToolName,
			stage: classification.stage,
			targets,
			argsPreview: previewArgs(args),
			targetPath,
			startedAt: now,
			endedAt: null,
			isError: null,
			cwd: this.state.cwd,
		};
		this.callIndex.set(id, call);
		this.sessionCalls += 1;
		this.commit((state) => {
			const calls = [...state.calls, call].slice(-MAX_CALLS);
			return {
				...state,
				calls,
				callCount: state.callCount + 1,
				...this.mergeTarget(state, signal),
				lastTargetPath: targetPath ?? state.lastTargetPath,
				...this.deriveStages(calls),
				runningToolNames: deriveRunning(calls),
				lastActivityAt: now,
			};
		});
	}

	private finishCall(id: string, rawToolName: string, isError: boolean): void {
		const existing = this.callIndex.get(id);
		const now = Date.now();
		if (!existing) {
			const classification = classifyTool(rawToolName);
			const call: ReaLiveCall = {
				id,
				toolName: classification.name,
				rawToolName,
				stage: classification.stage,
				targets: classification.targets,
				argsPreview: "",
				targetPath: null,
				startedAt: now,
				endedAt: now,
				isError,
				cwd: this.state.cwd,
			};
			this.callIndex.set(id, call);
			this.sessionCalls += 1;
			this.commit((state) => {
				const calls = [...state.calls, call].slice(-MAX_CALLS);
				return {
					...state,
					calls,
					callCount: state.callCount + 1,
					...errorDelta(state, call, isError),
					...this.deriveStages(calls),
					runningToolNames: deriveRunning(calls),
					lastActivityAt: now,
				};
			});
			return;
		}
		const updated: ReaLiveCall = { ...existing, endedAt: now, isError };
		this.callIndex.set(id, updated);
		const calls = this.state.calls.map((call) => (call.id === id ? updated : call));
		this.commit((state) => ({
			...state,
			calls,
			...errorDelta(state, updated, isError),
			runningToolNames: deriveRunning(calls),
			lastActivityAt: now,
		}));
	}


	private deriveStages(calls: readonly ReaLiveCall[]): Pick<
		ReaLiveState,
		"activeStage" | "visitedStages" | "stageCallCounts"
	> {
		const counts: Record<ReaStageId, number> = { ...EMPTY_STAGE_COUNTS };
		const visited = new Set<ReaStageId>();
		let activeStage: ReaStageId | null = null;
		for (const call of calls) {
			if (!call.stage) continue;
			counts[call.stage] += 1;
			visited.add(call.stage);
			activeStage = call.stage;
		}
		return {
			activeStage,
			visitedStages: STAGE_ORDER.filter((stage) => visited.has(stage)),
			stageCallCounts: counts,
		};
	}

	private commit(project: (state: ReaLiveState) => ReaLiveState): void {
		const next = project(this.state);
		if (next === this.state) return;
		this.state = next;
		for (const listener of this.listeners) listener();
	}
}

function deriveRunning(calls: readonly ReaLiveCall[]): readonly string[] {
	const running: string[] = [];
	for (const call of calls) {
		if (call.endedAt === null) running.push(call.toolName);
	}
	return running.slice(0, 5);
}

/** 一次失败的调用同时增加计数并留下一条错误记录，供 UI 与 Agent 回看。 */
function errorDelta(
	state: ReaLiveState,
	call: ReaLiveCall,
	isError: boolean,
): { errorCount: number; errors?: readonly ReaLiveError[] } {
	if (!isError) return { errorCount: state.errorCount };
	const entry: ReaLiveError = {
		toolName: call.toolName,
		message: call.argsPreview ? `调用 ${call.toolName} 失败：${call.argsPreview}` : `调用 ${call.toolName} 失败`,
		at: call.endedAt ?? Date.now(),
	};
	return { errorCount: state.errorCount + 1, errors: [entry, ...state.errors].slice(0, MAX_ERRORS) };
}

/** 供 UI 使用：只保留当前会话目录下的调用。 */
export function scopeLiveCalls(state: ReaLiveState, cwd: string | null): readonly ReaLiveCall[] {
	if (!cwd) return state.calls;
	const scoped = state.calls.filter((call) => !call.cwd || call.cwd === cwd);
	return scoped.length > 0 ? scoped : state.calls;
}

export { errorMessage as describeToolError };
