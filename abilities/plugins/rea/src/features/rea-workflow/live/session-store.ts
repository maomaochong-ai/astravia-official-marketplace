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
		return value;
	}

	peekRecoveryNotice(): number | null {
		return this.pendingRecoveryNotice;
	}

	reset(): void {
		this.callIndex = new Map();
		this.commit((state) => ({
			...state,
			calls: [],
			errors: [],
			activeStage: null,
			visitedStages: [],
			stageCallCounts: EMPTY_STAGE_COUNTS,
			runningToolNames: [],
			callCount: 0,
			errorCount: 0,
			turns: 0,
			lastTargetPath: null,
			hintedTarget: null,
			hintedPath: null,
		}));
	}

	setProvider(phase: PluginCliProviderPhase, message?: string): void {
		const previous = this.state.providerPhase;
		const message_ = message ?? null;
		if (previous === phase && this.state.providerMessage === message_) return;
		const recovered = previous !== null && previous !== "ready" && phase === "ready";
		if (recovered) this.pendingRecoveryNotice = Date.now();
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
			case "conversation-changed":
				this.commit((state) => ({
					...state,
					sessionId: event.conversation.id,
					cwd: event.conversation.cwd,
				}));
				return;
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
			const nextTarget = detectTargetFromText(nextTargetPath ?? textArg(args));
			const argsPreview = nextArgsPreview || existing.argsPreview;
			const targetPath = nextTargetPath ?? existing.targetPath;
			const startedAt = options.authoritative ? now : existing.startedAt;
			const unchanged =
				argsPreview === existing.argsPreview &&
				targetPath === existing.targetPath &&
				startedAt === existing.startedAt &&
				(nextTarget === null || nextTarget === this.state.detectedTarget);
			if (unchanged) return;
			const updated: ReaLiveCall = {
				...existing,
				argsPreview,
				targetPath,
				startedAt,
			};
			this.callIndex.set(id, updated);
			this.commit((state) => ({
				...state,
				calls: state.calls.map((call) => (call.id === id ? updated : call)),
				detectedTarget: nextTarget ?? state.detectedTarget,
				lastTargetPath: targetPath ?? state.lastTargetPath,
				lastActivityAt: now,
			}));
			return;
		}

		const classification = classifyTool(rawToolName);
		const targetPath = pickTargetPath(args);
		const target =
			detectTargetFromText(targetPath ?? textArg(args)) ?? classification.targets[0] ?? null;
		const call: ReaLiveCall = {
			id,
			toolName: classification.name,
			rawToolName,
			stage: classification.stage,
			targets: classification.targets,
			argsPreview: previewArgs(args),
			targetPath: pickTargetPath(args),
			startedAt: now,
			endedAt: null,
			isError: null,
			cwd: this.state.cwd,
		};
		this.callIndex.set(id, call);
		this.commit((state) => {
			const calls = [...state.calls, call].slice(-MAX_CALLS);
			return {
				...state,
				calls,
				callCount: state.callCount + 1,
				detectedTarget: target ?? state.detectedTarget,
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
