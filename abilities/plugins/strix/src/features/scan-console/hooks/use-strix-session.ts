/**
 * The state behind the tab — read from the host conversation, written back to it.
 *
 * There is exactly one model in play: the one the host conversation runs on. This panel
 * has no loop of its own, no second system prompt and no private transcript of prompts.
 * No model call is made anywhere in this plugin; the host agent already has the
 * `strix_*` tools over MCP, so it *is* the loop.
 *
 * So the panel does the two things a window and a controller can do:
 *
 *  - **input** — whatever the operator types here (launch column or composer) is
 *    delivered into the host conversation with `sendPrompt`, so it renders there and is
 *    answered by the host agent under the host's own permissions and plan;
 *  - **output** — the panel renders what that turn produces, from two witnesses: the
 *    conversation's own events (user text, streamed assistant text, which `strix_*` tool
 *    is being called) and the bridge's event feed (the command that ran, its exit code,
 *    its output tail). Facts about the assessment itself — findings, plan, coverage,
 *    notes, session — are re-read from the service after every tool call.
 *
 * Upstream's loop keeps a transcript because it owns the model. Here the host owns it,
 * and the plugin's job is to show the assessment as it happens and to hand the operator's
 * words to the only agent that can act on them.
 */
import { digestAnswer, digestAsk } from "../../../domain/conversation-digest";
import { extractTargets, newTargets, type DerivedTarget } from "../../../domain/target-extraction";
import { conversationShape, permitSend, permitStop } from "../../../domain/conversation-shape";
import { evidenceRow, isServiceNarrated, strixToolName, toolRow, turnDivider } from "../../../domain/conversation-projection";
import { foldTrace, type TraceDraft } from "../../../domain/trace-log";
import type { ConversationEvent, ConversationState } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BridgeClient } from "../../../domain/bridge-client";
import { isStrixEngaged, markPanelSeen } from "../../../domain/engagement";
import { hasOpenAssessment } from "../../../domain/assessment-presence";
import { resolveModel, workspaceLabel } from "../../../domain/host-sync";
import { writeSnapshot, belongsTo, readSnapshot } from "../session-store";
import { normalizeRoster, type McpConnection } from "../../../domain/mcp-roster";
import type { ModelChoice } from "../../../domain/model-label";
import type {
	BridgeEvent,
	BridgeState,
	BridgeBudget,
	BridgeTelemetry,
	BridgeHistoryEntry,
	BridgeTeam,
	BridgeScope,
	BridgeCapabilities,
	CoverageOutcome,
	ShellSessionSummary,
	EnvironmentProbe,
	NoteSummary,
	SandboxStatus,
	StrixFinding,
	TodoItem,
	TraceEntry,
} from "../../../runtime-contract";
import {
	normalizeCoverage,
	normalizeFindings,
	normalizeNotes,
	normalizeProbe,
	normalizeSandbox,
	normalizeSessions,
	normalizeTodos,
} from "../../../domain/bridge-payloads";

const TRACE_LIMIT = 400;
const LOG_LIMIT = 6;

export type SessionPhase = "booting" | "setup" | "scanning" | "done";

/** One line of the launch feedback log; upstream colours success green and error red. */
export interface LogLine {
	text: string;
	tone?: "ok" | "error";
}

export interface StrixSessionModel {
	phase: SessionPhase;
	log: LogLine[];
	/** Bridge boot state: shown as a live line, never as log history. */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	trace: TraceEntry[];
	/** The assessment plan, the notes it keeps and what it has covered. */
	todos: TodoItem[];
	notes: NoteSummary[];
	coverage: CoverageOutcome[];
	/** 保留的 shell 会话：面板上的「工作单元」。 */
	sessions: ShellSessionSummary[];
	/** MCP connections as last reported; docked like upstream's Mcp panel. */
	mcp: McpConnection[];
	model?: ModelChoice;
	/** True when the model is the one the active conversation runs on. */
	modelFromConversation: boolean;
	/** Folder name of the conversation's workspace, shown in the status row. */
	workspace?: string;
	/** The host conversation is generating right now. */
	hostStreaming: boolean;
	/** An assistant answer arriving token by token; rendered as a live row. */
	streaming?: string;
	busy: boolean;
	/** 把面板输入框里的话交给宿主对话。返回是否真的交出去了。 */
	send: (text: string) => Promise<boolean>;
	/** 停止：只停面板正在显示的那个会话的当前一轮。 */
	stop: () => Promise<void>;
	/** 停止按钮可用：这一轮在跑，且不是团队会话。 */
	canStop: boolean;
	/** 团队会话：面板只读（发送与停止都在团队输入框）。 */
	readOnly: boolean;
	/** 声明的范围（服务给），面板用它去重候选。 */
	scope?: BridgeScope;
	/** 从对话里认出的候选目标（未声明的那部分）。 */
	candidates: readonly DerivedTarget[];
	/** 配置页的能力面：工具面与技能库的数量与来源。 */
	capabilities?: BridgeCapabilities;
	/** Re-read state after a failure. */
	refresh: () => Promise<void>;
	/** 面板选的执行环境。 */
	environmentMode: "auto" | "host" | "docker";
	setEnvironmentMode: (mode: "auto" | "host" | "docker") => Promise<void>;
	/** 让服务代跑 docker 安装命令；装完再 refresh() 就能看到新环境。 */
	installDocker: () => Promise<void>;
	/** 环境检测结果（docker 可用性 / 镜像是否已拉取）；切换环境后自动重探。 */
	docker: { ready: boolean; detail?: string; imagePresent: boolean | null } | null;
	/** 让宿主执行 docker pull（镜像缺失时面板上的「拉取镜像」）。 */
	pullImage: () => Promise<void>;
	/** 首屏 / 工作台：用户可以随时回去看一眼配置，不被"自动跟屏"锁住。 */
	showLaunch: boolean;
	openLaunch: () => void;
	/** 进工作台：不发送、不建会话（1.0.13）。 */
	openWorkbench: () => void;
	/** 在当前项目下新开一个会话（面板会跟过去）。 */
	newSession: () => Promise<void>;
	/** 打开一条笔记的正文（`strix_note_get`）。面板是唯一能读到它的地方。 */
	onOpenNote: (id: string) => Promise<string>;
	/** 服务给的分结果计数，不要用面板前 8 行自己算。 */
	coverageTally?: Record<string, number>;
	/** 会话与状态四个面：预算 / 本机统计 / 历史 / 团队成员。 */
	budget?: BridgeBudget;
	telemetry?: BridgeTelemetry | null;
	history?: readonly BridgeHistoryEntry[];
	team?: BridgeTeam | null;
}

export interface StrixSessionOptions {
	runtime: { ensureReady: () => Promise<string> };
	client: BridgeClient;
	/** Active conversation, from `useActiveConversation()`; null on a fresh-session page. */
	conversation: ConversationState | null;
	/** `ctx.conversation.on`: the host's turn, message and tool events. */
	subscribe: (listener: (event: ConversationEvent) => void) => { dispose(): void };
	/**
	 * 把面板输入框里的话交给宿主对话（`ctx.conversation.sendPrompt`）。
	 *
	 * 这是面板唯一的"说"路径，而它只是宿主那条路的入口：文字由宿主的会话、模型与权限执行——
	 * 插件不持有模型调用，也不存自己的一份 transcript。
	 */
	sendPrompt: (text: string) => Promise<{ status: "sent" | "queued" | "failed" }>;
	/** 连会话都没有时，把话放回宿主输入框（宿主自己会按当前目录建会话）。 */
	insertText: (text: string) => void;
	/**
	 * 宿主当前打开的工作目录（`ctx.fileExplorer.getWorkspaceRoots()`，需要 workspace.read）。
	 *
	 * 为什么需要它：用户在宿主里打开了目录，但当前会话可能还没有 cwd（新会话页、刚切目录、
	 * 或 conversation 上下文还没带过来）。只认 conversation.cwd 就会误报"先打开一个工作目录"，
	 * 而用户明明已经打开了。这里把它作为兜底。
	 */
	workspaceRoot?: () => string | undefined;
	/** Creates a conversation when the user is still on the new-session page. */
	createSession: (cwd: string) => Promise<ConversationState>;
	/** Aborts the host turn; `stop()` calls it before stopping the sandbox. */
	abort: () => Promise<void>;
	t: (key: string, params?: Record<string, string | number>) => string;
}
export function useStrixSession({
	runtime,
	client,
	conversation,
	subscribe,
	sendPrompt,
	insertText,
	createSession,
	abort,
	workspaceRoot,
	t,
}: StrixSessionOptions): StrixSessionModel {
	// Read once, before the first paint: a remounted tab rehydrates instead of showing
	// the launch column while its assessment is still open behind it (session-store.ts).
	const initial = useRef(readSnapshot(conversation?.id)).current;
	// 面板至少在这个会话里出现过一次：activate() 的抢焦点订阅靠它排除
	// “在 A 会话开着的胶囊把 B 会话的面板拽出来”（engagement.ts）。
	markPanelSeen(conversation?.id, conversation?.cwd ?? null);
	// 宿主正在跑这一轮的时候挂载：首屏是给“还没开始”的，不是给“正在跑”的。
	// 快照里第一轮往往还是 `setup`（agent 还没有任何 finding/todo 可查），只信快照会把
	// 正在跑的评估画成首屏——用户把那看成“没跳过去”（1.0.6）。
	const [phase, setPhase] = useState<SessionPhase>(
		conversation?.isStreaming ? "scanning" : initial?.phase ?? "booting",
	);
	const [log, setLog] = useState<LogLine[]>([]);
	const [boot, setBoot] = useState<{ state: "connecting" | "ready" | "failed"; detail?: string }>({
		state: "connecting",
	});
	const [environment, setEnvironment] = useState<EnvironmentProbe>();
	const [sandbox, setSandbox] = useState<SandboxStatus>(initial?.sandbox ?? { running: false, targets: [] });
	const [findings, setFindings] = useState<StrixFinding[]>(initial?.findings ?? []);
	const [trace, setTrace] = useState<TraceEntry[]>(initial?.trace ?? []);
	const [todos, setTodos] = useState<TodoItem[]>(initial?.todos ?? []);
	const [notes, setNotes] = useState<NoteSummary[]>(initial?.notes ?? []);
	const [coverage, setCoverage] = useState<CoverageOutcome[]>(initial?.coverage ?? []);
	const [liveSessions, setLiveSessions] = useState<ShellSessionSummary[]>([]);
	const [mcp, setMcp] = useState<McpConnection[]>(initial?.mcp ?? []);
	/** 覆盖台账的分结果计数，来自服务（`/api/state` 的 coverageTally）。 */
	const [tally, setTally] = useState<Record<string, number> | undefined>(undefined);
	/** 会话与状态四个面：服务算，面板读。 */
	const [budget, setBudget] = useState<BridgeBudget | undefined>(undefined);
	const [telemetry, setTelemetry] = useState<BridgeTelemetry | null>(null);
	const [history, setHistory] = useState<BridgeHistoryEntry[]>([]);
	const [team, setTeam] = useState<BridgeTeam | null>(null);
	/** 声明的范围（服务给）。 */
	const [scope, setScope] = useState<BridgeScope | undefined>(undefined);
	/** 配置页的能力面：工具面 / 技能库的数量与来源。 */
	const [capabilities, setCapabilities] = useState<BridgeCapabilities | undefined>(undefined);
	/**
	 * 从对话里认出的目标（候选）。
	 *
	 * 为什么在面板侧算而不是服务侧：认的是“宿主对话里提到了什么”，而那段文字只存在
	 * 于渲染进程（服务看不到会话）。声明仍然只来自 `strix_scope`，两者分开。
	 */
	const [candidates, setCandidates] = useState<DerivedTarget[]>([]);
	const [hostStreaming, setHostStreaming] = useState<boolean>(Boolean(conversation?.isStreaming));
	const [submitting, setSubmitting] = useState(false);
	const [environmentMode, setEnvironmentModeState] = useState<"auto" | "host" | "docker">("host");
	/** 用户手动回到首屏：此时不再被"宿主流一转就跳工作台"拽走。 */
	const [showLaunch, setShowLaunch] = useState(false);
	const [docker, setDocker] = useState<{ ready: boolean; detail?: string; imagePresent: boolean | null } | null>(null);
	/** 接续已有评估只提示一次：refresh 会被轮次反复叫到。 */
	const resumed = useRef(false);
	/**
	 * The phase as the event handlers see it. The handlers are installed once but have to
	 * know whether an assessment is already open, and a state value would be stale in their
	 * closure — the same reason the shortcut scope reads the session through a ref.
	 */
	const phaseRef = useRef<SessionPhase>(phase);
	phaseRef.current = phase;
	// Scope and memory (see session-store.ts). `mountedIn` is the conversation this panel
	// is bound to right now: events from any other conversation are ignored, so project A's
	// chat cannot drive project B's panel.
	//
	// 1.0.7：它必须**跟着 conversation.id 改**。宿主给活动面板做的 key 是
	// `workspaceId + tabId`（ActivityTabSurface），所以切换会话**不会重挂载**——
	// 只认挂载那一刻的 id，面板就会一直画着上一个会话的沙箱与命令，而新会话的事件
	// 被自己挡掉。用户看到的“数据串会话”就是这个（rebindEffect 见下）。
	const mountedIn = useRef<string | null>(conversation?.id ?? null);
	// 形态每帧重算：`sessionPath` 为空 = 团队会话，宿主那边是写死的。
	const shapeRef = useRef(conversationShape(conversation));
	shapeRef.current = conversationShape(conversation);
	// 停止的判据靠会话级信号：面板显示的会话就是宿主的活动会话，`abort()` 打的也是它。
	// 所以只要“这一轮在跑、且不是团队会话”就能停——没有“谁发起的”这回事了（面板不发消息）。
	const streamingRef = useRef<boolean>(Boolean(conversation?.isStreaming));
	streamingRef.current = Boolean(conversation?.isStreaming);
	// The host replays `conversation-changed` in a microtask, so a tab can mount before
	// any id exists. Adopting the first real id is what stops the panel from ignoring
	// every event for the rest of its life.
	if (mountedIn.current === null && conversation?.id) mountedIn.current = conversation.id;
	const conversationIdRef = useRef<string | undefined>(conversation?.id);
	conversationIdRef.current = conversation?.id;
	/** 轮次计数：面板只用它给分隔行编号，不取正文。 */
	const turnRef = useRef(0);
	/** 用户按了「返回首屏」：不要被下一轮自动拽回工作台。 */
	const launchPinned = useRef(false);
	/**
	 * 事件序号的起点：接续快照时从已有 id 的最大值继续。
	 *
	 * 不接续就会生成重复 key（`e1` 已经在水合的轨迹里，新行又从 `e1` 开始）——React 会警告
	 * 并可能丢行。真机上切标签页回来就走到这条路径。
	 */
	const seq = useRef(
		(initial?.trace ?? []).reduce((max, entry) => {
			const value = Number.parseInt(String(entry.id).replace(/^e/, ""), 10);
			return Number.isFinite(value) && value > max ? value : max;
		}, 0),
	);

	// The conversation's model is the authority; recomputed on every conversation change
	// so a model switch in the chat moves this panel with it.
	const resolved = useMemo(() => resolveModel({ conversationModel: conversation?.model }), [conversation?.model]);
	const cwdRef = useRef<string | null>(conversation?.cwd ?? null);
	useEffect(() => {
		cwdRef.current = conversation?.cwd ?? null;
		setHostStreaming(Boolean(conversation?.isStreaming));
	}, [conversation?.cwd, conversation?.isStreaming]);

	const note = useCallback((text: string, tone?: LogLine["tone"]) => {
		setLog((previous) => [...previous, { text, ...(tone ? { tone } : {}) }].slice(-LOG_LIMIT));
	}, []);

	/**
	 * Append a row, folding a run of identical notes into one with a count.
	 *
	 * 合并规则在 `domain/trace-log.ts`（纯函数、有测试）：真机上容器起不来时服务会反复重试，
	 * 每次两条 note，不合并就是一堵重复的墙，真证据（命令与输出）会被挤出视野。
	 */
	const pushTrace = useCallback((entry: TraceDraft) => {
		setTrace((previous) => foldTrace(previous, entry, { id: `e${(seq.current += 1)}`, at: Date.now() }).entries);
	}, []);

	/**
	 * Close the row that *this* tool opened.
	 *
	 * 之前这里只找「最新的未关闭行」，不看到底是哪个工具——那是真 bug：宿主可以并发发
	 * 多个 tool-call，两个工具交错时，一个的 end 事件会把另一个的行关掉。真机现象是
	 * 一条 strix_scope 被标 Failed，而下一条带着它的参数显示 Done（截图里那两行）。
	 *
	 * 现在按工具名匹配，从新到旧找；同名工具并发时取最新那一行（后开先关的常见顺序）。
	 */
	const closeRow = useCallback(
		(patch: Partial<TraceEntry>, toolName?: string) => {
			const wanted = toolName ? strixToolName(toolName) : undefined;
			setTrace((previous) => {
				for (let index = previous.length - 1; index >= 0; index -= 1) {
					const row = previous[index];
					if (!row || row.kind !== "tool" || row.ok !== undefined) continue;
					// 服务叙述的行（`strix_exec`）用服务侧的命名，也要能对上。
					if (wanted && strixToolName(row.label) !== wanted) continue;
					const next = previous.slice();
					next[index] = { ...row, ...patch };
					return next;
				}
				return previous;
			});
		},
		[],
	);
/** Service + machine state: the assessment's own facts, re-read rather than inferred. */
	const refresh = useCallback(async () => {
		setBoot({ state: "connecting" });
		// 让后面的阶段判定能用上同一份快照：`state` 本来只活在 try 块里。
		let bridgeState: (BridgeState & { threatModel?: { content?: string } }) | undefined;
		try {
			await runtime.ensureReady();
			setBoot({ state: "ready" });
			// 先向服务声明“我现在是哪个会话”：台账键与状态归属都靠它（1.0.7）。
			// 拿不到归属不能阻断刷新：服务会退回沙箱 id，界面照常画。
			await client.setConversation(conversationIdRef.current ?? null).catch(() => undefined);
			const state = await client.state();
			// 服务返回的可能是**另一个会话**的沙箱（一个进程只有一个容器）：那就不采纳。
			//
			// 判据必须是**沙箱的主人**，不是顶层回显的那个字段：顶层字段就是我们刚 POST 进去的
			// 那个 id，拿它比等于自己跟自己比，永远相等（1.0.7 审查发现）。
			const owner = (state?.sandbox as { conversation?: unknown } | undefined)?.conversation;
			const mine = conversationIdRef.current ?? null;
			const foreign = typeof owner === "string" && owner !== mine;
			if (foreign) {
				// 环境探测是全局事实（docker 在不在与哪个会话无关），其余一律不采纳。
				setEnvironment(normalizeProbe(state?.environment));
				return;
			}
			bridgeState = (state ?? undefined) as (BridgeState & { threatModel?: { content?: string } }) | undefined;
			const probe = normalizeProbe(state?.environment);
			setSandbox(normalizeSandbox(state?.sandbox));
			setFindings(normalizeFindings(state?.findings));
			setTodos(normalizeTodos(state?.todos));
			setNotes(normalizeNotes(state?.notes));
			setCoverage(normalizeCoverage(state?.coverage));
			setLiveSessions(normalizeSessions((state as { sessions?: unknown } | undefined)?.sessions));
			setBudget((state as { budget?: BridgeBudget } | undefined)?.budget);
			setTelemetry(((state as { telemetry?: BridgeTelemetry | null } | undefined)?.telemetry) ?? null);
			setHistory(((state as { history?: BridgeHistoryEntry[] } | undefined)?.history) ?? []);
			setTeam(((state as { team?: BridgeTeam | null } | undefined)?.team) ?? null);
			setScope((state as { scope?: BridgeScope } | undefined)?.scope);
			setCapabilities((state as { capabilities?: BridgeCapabilities } | undefined)?.capabilities);
			if (probe) {
				setEnvironment(probe);
				// A missing daemon is the working state in `host` mode, not an
				// error: painting it red taught users the plugin was broken when it was ready.
				const hostMode = probe.mode === "host";
				if (!probe.docker.ready && !hostMode) note(t("log.dockerDown"), "error");
				else if (!probe.docker.ready) note(t("log.hostMode"));
				else if (probe.docker.imagePresent === false) note(t("log.imagePending"));
			} else {
				const detail = (state?.environment as { error?: unknown } | undefined)?.error;
				if (typeof detail === "string" && detail) setBoot({ state: "failed", detail });
			}
			void client
				.callTool("strix_mcp")
				.then((result) => setMcp(normalizeRoster(result)))
				.catch(() => undefined);
		} catch (cause) {
			setBoot({ state: "failed", detail: cause instanceof Error ? cause.message : String(cause) });
			// Not also pushed into the log: the boot strip shows the same sentence with the
			// reason, and two copies of one error read as two failures.
		}

		// 屏幕上该画哪一侧，由服务里的事实决定，不由「这个组件碰巧挂载过」决定：
		// 已经开了沙箱、已经落了 finding / 计划 / 笔记 / 覆盖，说明评估正在进行——
		// 此时停在首屏，就是「面板没反应，还在首屏」。
		const open = hasOpenAssessment(
			bridgeState
				? {
						sandbox: bridgeState.sandbox as { running?: boolean } | undefined,
						findings: (bridgeState.findings as unknown[] | undefined) ?? [],
						todos: (bridgeState.todos as unknown[] | undefined) ?? [],
						notes: (bridgeState.notes as unknown[] | undefined) ?? [],
						coverage: (bridgeState.coverage as unknown[] | undefined) ?? [],
						threatModel: bridgeState.threatModel as { content?: string } | undefined,
					}
				: undefined,
		);
		setPhase((current) => {
			if (current === "scanning" || current === "done") return current;
			return open ? "scanning" : "setup";
		});
		// 接续的是已有评估时明说一句，否则面板看上去就像凭空跳到了另一屏。
		// 接续已有评估不再往日志里补一句（1.0.7）：它是状态，落在事实表与运行记录里。
		// `resumed` 只剩一个用途——重绑时复位，供后续需要区分“首次”的地方使用。
	}, [client, note, runtime, t]);

	// 模型与目录的出处不再写进日志（1.0.7）。它们已经是首屏事实表里的两行（模型 / 目录），
	// 再在日志里“宣告”一遍，用户看到的是同一句话说两遍（截图里那三行）。
	// 日志现在只放**事件**：拉镜像成功/失败、桥接错误、降级……那些事后不再成立的事。

	const booted = useRef(false);
	useEffect(() => {
		if (booted.current) return;
		booted.current = true;
		void refresh();
	}, [refresh]);

	/**
	 * 切换会话就重绑（1.0.7）。
	 *
	 * 宿主的活动面板按 `workspaceId + tabId` 做 key，换会话不重挂载，所以这里必须自己换：
	 *  - `mountedIn` 指向新会话，否则 `belongsTo` 会把新会话的每一帧都挡掉；
	 *  - 显式重水合（而不是等下一次 refresh）——首帧就要画对新会话的快照，
	 *    不能先把上一个会话的沙箱、命令、发现留在屏幕上；
	 *  - 序号、轮次、一次性提示全部归位，否则新会话的轨迹会跟前一个同 id 撞车。
	 *
	 * 快照没有的新会话就从空开始：宁可是“还没记录”，也比画别人的强。
	 */
	const boundTo = useRef<string | null | undefined>(conversation?.id ?? null);
	useEffect(() => {
		const id = conversation?.id ?? null;
		if (!id || id === boundTo.current) return;
		boundTo.current = id;
		mountedIn.current = id;
		const snapshot = readSnapshot(id);
		setTrace(snapshot?.trace ?? []);
		setSandbox(snapshot?.sandbox ?? { running: false, targets: [] });
		setFindings(snapshot?.findings ?? []);
		setTodos(snapshot?.todos ?? []);
		setNotes(snapshot?.notes ?? []);
		setCoverage(snapshot?.coverage ?? []);
		setMcp(snapshot?.mcp ?? []);
		setPhase(snapshot?.phase ?? "setup");
		seq.current = (snapshot?.trace ?? []).reduce((max, entry) => {
			const value = Number.parseInt(String(entry.id).replace(/^e/, ""), 10);
			return Number.isFinite(value) && value > max ? value : max;
		}, 0);
		turnRef.current = 0;
		launchPinned.current = false;
		setShowLaunch(false);
		resumed.current = false;
		void refresh();
	}, [conversation?.id, refresh]);
	/**
	 * The bridge's own feed: what actually ran.
	 *
	 * The host tells us *that* `strix_exec` was called; only the service knows the exit
	 * code and the output, because it is the side holding the container. Commands are
	 * therefore drawn from here, and every other `strix_*` call from the host events —
	 * one row per call, never two (domain/conversation-projection.ts owns the split).
	 */
	useEffect(
		() =>
			client.events((event: BridgeEvent) => {
				if (event.event === "tool_start") {
					// 宽松取值：`BridgeEvent` 的兼容成员把字段写成 unknown，这里只认字符串。
					const start = event as { tool?: unknown; command?: unknown };
					const command = typeof start.command === "string" ? start.command : undefined;
					const row = toolRow({ tool: String(start.tool ?? ""), ...(command ? { command } : {}) });
					if (row) pushTrace(row);
					return;
				}
				if (event.event === "tool_end") {
					const row = evidenceRow(event as unknown as Extract<BridgeEvent, { event: "tool_end" }>);
					if (!row) return;
					// 服务侧事件带 tool 名（`exec_command` → `strix_exec`），按它关对应的行。
					closeRow(row.patch, String((event as { tool?: unknown }).tool ?? ""));
					void client
						.findings()
						.then((list) => setFindings(normalizeFindings(list)))
						.catch(() => undefined);
					return;
				}
				if (event.event === "sandbox_status") {
					pushTrace({ kind: "note", label: String((event as { phase?: string }).phase ?? "sandbox") });
				}
				if (event.event === "sandbox_degraded") {
					const reason = String((event as { reason?: string }).reason ?? "");
					pushTrace({ kind: "note", label: `${t("sandbox.degraded")}${reason ? `: ${reason}` : ""}` });
					setEnvironment((current) => (current ? { ...current, mode: "host" } : current));
				}
				if (event.event === "sandbox_ready") {
					setSandbox(normalizeSandbox((event as { status?: unknown }).status ?? { running: true }));
				}
				if (event.event === "sandbox_stopped") setSandbox({ running: false, targets: [] });
			}),
		[client, closeRow, pushTrace, t],
	);

	/**
	 * The host conversation → this panel, evidence only.
	 *
 * 分界：**对话是说话的地方，面板是看现场的地方**。宿主聊天区已经
	 * 把用户的话与 agent 的回复渲染完了（markdown、可复制、可滚回去），面板再把同一段文字
	 * 画一遍就是第二份同样内容的渲染——用户看到的「冗余」正是这个。
	 *
	 * 所以这里只接两类事件：
	 *  - `tool-call-*`：哪一步在跑、成没成——且只对“服务不负责叙述”的工具画；
	 *  - `turn-start/end`：轮次边界与 running/idle 状态（不取正文）。
	 * `message-*` 里的文字一律不进面板：它属于对话，归属宿主。
	 */
	useEffect(() => {
		const subscription = subscribe((event) => {
			// Only this panel's conversation: the host's event stream is not per-tab.
			if (!belongsTo(mountedIn.current, conversationIdRef.current)) return;

			if (event.type === "turn-start") {
				turnRef.current += 1;
				// 这一轮在本对话里跑：面板跟着离开首屏。
				//
				// 1.0.5：原来这里还要求 `isStrixEngaged()`——胶囊没开时（比如用户直接在宿主输入框
				// 打字）面板就停在首屏，用户看到的就是「发出去了，面板没动」。面板挂在本对话上、
				// 这一轮又是本对话在跑，两个事实合起来就够了，与胶囊无关。
				//
				// 例外是「返回首屏」那颗按钮：pin 立着就不拓。但 pin 只算一次查看，
				// 而胶囊开着意味着用户把这一轮交给了 Strix——那份“先看一眼”的意图到此为止，
				// 否则会出现“面板被带到前面、却还画着首屏”这种自相矛盾的落地。
				if (isStrixEngaged()) launchPinned.current = false;
				if (!launchPinned.current) {
					setShowLaunch(false);
					if (phaseRef.current !== "scanning") setPhase("scanning");
				}
				// 一条分隔行说清“这是第几轮、说明在对话里”，而不是把回复再抄一遍。
				pushTrace(turnDivider(turnRef.current, t("scan.turnDivider", { turn: turnRef.current })));
				setHostStreaming(true);
				return;
			}

			if (event.type === "turn-end") {
				setHostStreaming(false);
				void refresh();
				return;
			}

			// 文字属于对话；面板只留**关键点**。
			//
			// 1.0.7 是“一句不留”（两个可滚正文太冗余），1.0.16 是“只留结论与诉求”：
			// 用户这一轮要什么（一行）、agent 说出的带信息量的几句（每轮 ≤ 6 行），
			// 其余过渡句与寒暄丢掉。判据在 domain/conversation-digest.ts，不在渲染里。
			if (event.type === "message-added" && event.message.role === "compaction") {
				// 压缩是状态，不是对话正文：不记它，用户会以为“说过的证据突然没了”。
				pushTrace({ kind: "note", label: t("scan.compacted") });
				return;
			}
			if (event.type === "message-added" && event.message.role === "user") {
				const ask = digestAsk(event.message.text);
				if (ask) pushTrace({ kind: "say", label: ask, from: "you" });
				// 目标候选就来自人写的句子：这是“我说了域名，面板却显示 0 个目标”的修法。
				collectTargets(event.message.text);
				return;
			}
			if (event.type === "message-added" && event.message.role === "assistant") {
				pushPoints(digestAnswer(event.message.text), "agent");
				collectTargets(event.message.text);
				return;
			}
			// `message-updated` 是流式增量：每一帧都推一行就等于把正文抄进来。
			// 完整文本到 `message-added` 时才摘要一次。
			if (event.type === "message-added" || event.type === "message-updated") return;

			if (event.type === "tool-call-start") {
				// `strix_exec` is narrated by the service, which has the output. Drawing it
				// here too would put the same command on screen twice.
				if (isServiceNarrated(event.toolName)) return;
				const row = toolRow({ tool: event.toolName, ...(event.args ? { args: event.args } : {}) });
				if (row) pushTrace(row);
				return;
			}

			if (event.type === "tool-call-end") {
				if (isServiceNarrated(event.toolName)) return;
				closeRow({ ok: !event.isError }, event.toolName);
				void refresh();
			}
		});
		return () => subscription.dispose();
	}, [closeRow, pushTrace, refresh, subscribe, t]);

/**
	 * 把一段文字里认出的目标并入候选。
	 *
	 * 候选只存在面板里：它是“这轮大概在打什么”的提示，不是授权。声明仍然只有一条路
	 * （agent 调 `strix_scope`），所以这里不写服务、不改范围。
	 */
	const collectTargets = useCallback((text: string) => {
		const found = extractTargets(text);
		if (found.length === 0) return;
		setCandidates((previous) => {
			const seen = new Set(previous.map((target) => target.value));
			const next = found.filter((target) => !seen.has(target.value));
			return next.length === 0 ? previous : [...previous, ...next].slice(-40);
		});
	}, []);

	/** 把一条答复的关键点推成若干 `say` 行（紧跟在 turn 分隔行后面），标上来源。 */
	const pushPoints = useCallback(
		(points: readonly string[], from: "you" | "agent" = "agent") => {
			for (const point of points) pushTrace({ kind: "say", label: point, from });
		},
		[pushTrace],
	);

	/**
	 * 面板自己的一句话：交给宿主对话，与用户直接在聊天框打字是同一条路。
	 *
	 * 三道次序与 1.0.4 一致：**先发**（新会话页也能发，宿主按当前目录建会话）→
	 * 失败才 `createSession`（拿得到 cwd 时）→ 再失败就把话放回宿主输入框。
	 * 三道全部失败才报 `sendFailed`；任何一步成功就不报错，因为那一步确实把话交出去了。
	 */
	const send = useCallback(
		async (text: string): Promise<boolean> => {
			const value = text.trim();
			if (!value) return false;
			if (!permitSend({ shape: shapeRef.current }).ok) {
				// 团队会话：宿主在那边没有给插件写入口，说清楚而不是丢掉这句话。
				note(t("log.teamReadOnly"), "error");
				return false;
			}
			setSubmitting(true);
			try {
				const first = await sendPrompt(value).catch(() => ({ status: "failed" as const }));
				if (first.status === "failed") {
					const cwd = cwdRef.current ?? workspaceRoot?.() ?? null;
					if (!cwd) {
						insertText(value);
						note(t("log.handedToHost"), "ok");
						launchPinned.current = false;
						setShowLaunch(false);
						return true;
					}
					const created = await createSession(cwd);
					conversationIdRef.current = created.id ?? conversationIdRef.current;
					const retry = await sendPrompt(value).catch(() => ({ status: "failed" as const }));
					if (retry.status === "failed") {
						note(t("log.sendFailed"), "error");
						return false;
					}
				}
				// 记下自己刚发的那句：宿主只转发 assistant 的消息（不转发用户发言），
				// 所以“这一轮在干什么”只能由面板自己留一行摘要。截断到 96 字，它不是正文。
				const ask = digestAsk(value);
				if (ask && conversationIdRef.current) pushTrace({ kind: "say", label: ask, from: "you" });
				// 离开首屏：用户按下的是“发出去”，不是“继续看配置”。
				launchPinned.current = false;
				setShowLaunch(false);
				if (phaseRef.current !== "scanning") setPhase("scanning");
				return true;
			} catch (cause) {
				const detail = cause instanceof Error ? cause.message : String(cause);
				note(`${t("log.sendFailed")}: ${detail}`, "error");
				return false;
			} finally {
				setSubmitting(false);
			}
		},
		[createSession, insertText, note, sendPrompt, t, workspaceRoot],
	);

	const setEnvironmentMode = useCallback(
		async (mode: "auto" | "host" | "docker") => {
			setEnvironmentModeState(mode);
			await client.setPreferences({ environmentMode: mode }).catch(() => undefined);
			// 切换即检测：用户选了容器，立刻要知道这台机器有没有 docker、镜像是拉过。
			await client
				.probeEnvironment()
				.then((probe) => setDocker(probe.docker))
				.catch(() => undefined);
		},
		[client],
	);

	const pullImage = useCallback(async () => {
		setSubmitting(true);
		try {
			const result = await client.pullImage();
			note(result.ok ? t("log.imagePulled") : t("log.imagePullFailed"), result.ok ? "ok" : "error");
			const probe = await client.probeEnvironment().catch(() => undefined);
			if (probe) setDocker(probe.docker);
		} catch (cause) {
			note(cause instanceof Error ? cause.message : String(cause), "error");
		} finally {
			setSubmitting(false);
		}
	}, [client, note, t]);

	const installDocker = useCallback(async () => {
		setSubmitting(true);
		try {
			const result = await client.installDocker();
			note(result.installed ? t("log.dockerInstalled") : t("log.dockerInstallFailed"), result.installed ? "ok" : "error");
			await refresh();
		} catch (cause) {
			note(cause instanceof Error ? cause.message : String(cause), "error");
		} finally {
			setSubmitting(false);
		}
	}, [client, note, refresh, t]);

	/**
	 * 进工作台（1.0.13）：不发送、不建会话，只把这一屏换过去。
	 *
	 * 与 `openLaunch` 相反的一步：那边 pin 住不再跟随，这边主动解除 pin ——
	 * 用户按了"看现场"，就不该再被自己的旧选择挡在首屏。
	 */
	const openWorkbench = useCallback(() => {
		launchPinned.current = false;
		setShowLaunch(false);
		if (phaseRef.current !== "scanning") setPhase("scanning");
	}, []);

	const openLaunch = useCallback(() => {
		launchPinned.current = true;
		setShowLaunch(true);
	}, []);

	/** 新会话：在当前 cwd 建一个，面板跟过去（多开的最小可行形态）。 */
	const newSession = useCallback(async () => {
		const cwd = cwdRef.current ?? workspaceRoot?.() ?? null;
		if (!cwd) {
			// 拿不到目录不是错误，也不是用户的问题：宿主自己的“新会话页”不需要预先知道
			// 目录——第一句话发出去它才建会话。所以这里不报错，也不假装建好了：
			// 把面板放回首屏（那里能直接写第一句话），并说清楚接下来会怎样。
			setShowLaunch(true);
			note(t("log.newSessionNoFolder"), "ok");
			return;
		}
		try {
			await createSession(cwd);
			setShowLaunch(false);
		} catch (cause) {
			note(cause instanceof Error ? cause.message : String(cause), "error");
		}
	}, [createSession, note, t, workspaceRoot]);


	/**
	 * 停止 = “停掉面板发起的那一轮”，不是“停掉宿主的活跃会话”。
	 *
	 * 宿主那个 `abort()` 不看面板：它打 `activeSessionAtom`（plugin-host-bridge），
 * 所以在别的项目里按停止会掐掉那个项目正在跑的普通对话（真机 bug）。
	 * 这里先问授权：形态不对话（团队会话）或者这一轮不是本面板发起的，就不动手。
	 */
	const stop = useCallback(async () => {
		const decision = permitStop({ shape: shapeRef.current, streaming: streamingRef.current });
		if (!decision.ok) {
			note(t(decision.reason === "team-surface" ? "log.stopInTeam" : "log.stopNotMine"), "error");
			return;
		}
		await abort().catch(() => undefined);
		await client.stopSandbox().catch(() => undefined);
		setSandbox({ running: false, targets: [] });
		setHostStreaming(false);
		setPhase("done");
	}, [abort, client, note, t]);

	// Persist after every change so a remount resumes rather than restarts.
	useEffect(() => {
		writeSnapshot(conversation?.id, {
			phase,
			trace,
			targets: sandbox.targets ?? [],
			sandbox,
			findings,
			todos,
			notes,
			coverage,
			mcp,
		});
	}, [conversation?.id, phase, trace, sandbox, findings, todos, notes, coverage, mcp, budget, telemetry, history, team]);


	return useMemo(
		() => ({
			phase,
			log,
			boot,
			environment,
			sandbox,
			findings,
			trace,
			todos,
			notes,
			coverage,
			sessions: liveSessions,
			mcp,
			// 会话与状态四个面：服务的计算结果，面板只读。
			budget,
			telemetry,
			history,
			team,
			model: resolved.choice,
			modelFromConversation: resolved.fromConversation,
			workspace: workspaceLabel(conversation?.cwd),
			hostStreaming,
			// 停止只看“这一轮是不是本面板发起的”，不看宿主是不是在流：
			// 宿主在流的可能是另一个会话的普通对话。
			canStop: permitStop({ shape: conversationShape(conversation), streaming: hostStreaming }).ok,
			readOnly: conversationShape(conversation) === "team",
			busy: submitting || hostStreaming,
			scope,
			candidates: scope ? newTargets(candidates, scope.entries.map((entry) => entry.value)) : candidates,
			capabilities,
			send,
			stop,
			refresh,
			environmentMode,
			setEnvironmentMode,
			installDocker,
			docker,
			pullImage,
			showLaunch,
			openLaunch,
			openWorkbench,
			newSession,
			onOpenNote: async (id: string) => {
				const result = (await client.callTool("strix_note_get", { id })) as
					| { note?: { content?: string } }
					| undefined;
				return result?.note?.content ?? "";
			},
			...(tally ? { coverageTally: tally } : {}),
		}),
		[
			phase,
			log,
			boot,
			environment,
			sandbox,
			findings,
			trace,
			todos,
			notes,
			coverage,
			liveSessions,
			mcp,
			resolved,
			conversation?.cwd,
			hostStreaming,
			conversation?.id,
			submitting,
			scope,
			candidates,
			capabilities,
			send,
			stop,
			refresh,
		],
	);
}

/** Re-exported so the projection helpers live in one testable place. */
