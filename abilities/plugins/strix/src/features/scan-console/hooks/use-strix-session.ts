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
import { evidenceRow, isServiceNarrated, strixToolName, toolRow, turnDivider } from "../../../domain/conversation-projection";
import { foldTrace, type TraceDraft } from "../../../domain/trace-log";
import type { ConversationEvent, ConversationState } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BridgeClient } from "../../../domain/bridge-client";
import { isStrixEngaged, markPanelSeen } from "../../../domain/engagement";
import { hasOpenAssessment } from "../../../domain/assessment-presence";
import { resolveModel, workspaceLabel } from "../../../domain/host-sync";
import { writeSnapshot, belongsTo, readSnapshot } from "../session-store";
import { normalizeRoster, type McpConnection } from "../../../service/mcp-roster";
import type { ModelChoice } from "../../../domain/model-label";
import type {
	BridgeEvent,
	BridgeState,
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
	/** Bridge boot state: shown as a live line, never as log history (ADR strix-0004). */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	trace: TraceEntry[];
	/** The assessment plan, the notes it keeps and what it has covered. */
	todos: TodoItem[];
	notes: NoteSummary[];
	coverage: CoverageOutcome[];
	/** 保留的 shell 会话：面板上的「工作单元」（ADR 0010）。 */
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
	/** Deliver the launch prompt into the host conversation. */
	start: (prompt: string) => Promise<void>;
	/** Continue the assessment from the scan composer. */
	send: (text: string) => Promise<void>;
	/** Abort the host turn and stop the sandbox. */
	stop: () => Promise<void>;
	/** Re-read state after a failure. */
	refresh: () => Promise<void>;
	/** 面板选的执行环境（ADR 0013）。 */
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
	/** 在当前项目下新开一个会话（面板会跟过去）。 */
	newSession: () => Promise<void>;
	/** 打开一条笔记的正文（`strix_note_get`）。面板是唯一能读到它的地方。 */
	onOpenNote: (id: string) => Promise<string>;
	/** 服务给的分结果计数，不要用面板前 8 行自己算。 */
	coverageTally?: Record<string, number>;
}

export interface StrixSessionOptions {
	runtime: { ensureReady: () => Promise<string> };
	client: BridgeClient;
	/** Active conversation, from `useActiveConversation()`; null on a fresh-session page. */
	conversation: ConversationState | null;
	/** `ctx.conversation.on`: the host's turn, message and tool events. */
	subscribe: (listener: (event: ConversationEvent) => void) => { dispose(): void };
	/** Host conversation API: the only path by which this panel speaks. */
	sendPrompt: (text: string) => Promise<{ status: "sent" | "queued" | "failed" }>;
	/** 把文字放进宿主输入框（拿不到 cwd 时，让宿主自己建会话）。 */
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
	markPanelSeen(conversation?.id);
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
	const [hostStreaming, setHostStreaming] = useState<boolean>(Boolean(conversation?.isStreaming));
	const [submitting, setSubmitting] = useState(false);
	const [environmentMode, setEnvironmentModeState] = useState<"auto" | "host" | "docker">("host");
	/** 用户手动回到首屏：此时不再被"宿主流一转就跳工作台"拽走（ADR 0014）。 */
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
	// was opened in: events from any other conversation are ignored, so project A's chat
	// cannot drive project B's panel.
	const mountedIn = useRef<string | null>(conversation?.id ?? null);
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
			const state = await client.state();
			bridgeState = (state ?? undefined) as (BridgeState & { threatModel?: { content?: string } }) | undefined;
			const probe = normalizeProbe(state?.environment);
			setSandbox(normalizeSandbox(state?.sandbox));
			setFindings(normalizeFindings(state?.findings));
			setTodos(normalizeTodos(state?.todos));
			setNotes(normalizeNotes(state?.notes));
			setCoverage(normalizeCoverage(state?.coverage));
			setLiveSessions(normalizeSessions((state as { sessions?: unknown } | undefined)?.sessions));
			if (probe) {
				setEnvironment(probe);
				// A missing daemon is the working state in `host` mode (ADR strix-0001), not an
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
			// reason, and two copies of one error read as two failures (ADR strix-0004).
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
		if (open && !resumed.current) {
			resumed.current = true;
			note(t("scan.resumed"));
		}
	}, [client, note, runtime, t]);

	// Where the model and the mounted folder came from, announced once per conversation.
	const announced = useRef("");
	useEffect(() => {
		const key = `${resolved.choice?.modelKey ?? ""}|${conversation?.cwd ?? ""}`;
		if (!key || key === announced.current) return;
		announced.current = key;
		if (resolved.fromConversation && resolved.choice) {
			note(t("log.modelFromConversation").replace("{model}", resolved.choice.name));
		}
		const folder = workspaceLabel(conversation?.cwd);
		if (folder) note(t("log.workspaceMounted").replace("{folder}", folder));
	}, [conversation?.cwd, note, resolved, t]);

	const booted = useRef(false);
	useEffect(() => {
		if (booted.current) return;
		booted.current = true;
		void refresh();
	}, [refresh]);

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
	 * 分界（ADR strix-0007）：**对话是说话的地方，面板是看现场的地方**。宿主聊天区已经
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
				// 例外是「返回首屏」那颗按钮（ADR 0014）：pin 立着就不拓。但 pin 只算一次查看，
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

			// 文字属于对话，不属于面板。显式忽略而不是默默不处理：读到这里的人要知道
			// 不渲染是决定，不是遗漏。
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
	 * Deliver one prompt into the host conversation.
	 *
	 * The only write path. On a fresh-session page there is nothing to send into yet, so a
	 * conversation is created in the current folder first — the same two steps the user
	 * would take by hand, and no model of our own.
	 */
	const deliver = useCallback(
		async (text: string): Promise<boolean> => {
			const value = text.trim();
			if (!value) return false;
			setSubmitting(true);
			let sendError: string | undefined;
			try {
				// 顺序很重要：**先直接发**。
				//
				// 宿主自己的输入框在"新会话页"也能发——发出去就按当前目录建会话。面板复用同一条路，
				// 于是插件根本不需要知道目录在哪。之前反过来（先 createSession 再 send），只要拿不到
				// cwd 就报"先在宿主里打开一个工作目录"，而用户明明已经打开了——那是插件的盲区，
				// 不是用户的问题（1.0.4）。
				const receipt = await sendPrompt(value).catch((cause: unknown) => {
					sendError = cause instanceof Error ? cause.message : String(cause);
					return { status: "failed" as const };
				});

				if (receipt.status === "failed") {
					// 宿主没有可用会话，也没有可发的草稿：才需要自己建一个。
					// cwd 依次取：当前会话 → 宿主打开的工作目录 → 宿主最近用过的目录。
					const cwd = cwdRef.current ?? workspaceRoot?.() ?? null;
					if (!cwd) {
						// 连目录都拿不到：把话交给宿主的输入框，让宿主的"新会话页"自己建会话。
						// 这比报错有用——用户按下 Enter 就能继续，插件不再假装"你没有打开目录"。
						insertText(value);
						note(t("log.handedToHost"), "ok");
						return true;
					}
					const created = await createSession(cwd);
					conversationIdRef.current = created.id ?? conversationIdRef.current;
					const retry = await sendPrompt(value);
					if (retry.status === "failed") {
						note(t("log.sendFailed"), "error");
						return false;
					}
				}
				// 不在面板里回显这句：宿主对话已经渲染了它，面板再画一次就是冗余（ADR 0007）。
				// 面板跟着这一句离开首屏：用户按下的是「开始」，不是「继续看首屏」。
				// 没有这一步时，只有宿主回一个 turn-start 才会切屏——而宿主在草稿态下
				// 并不一定马上发事件，于是面板看起来像没反应（1.0.5）。
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
		[createSession, insertText, note, pushTrace, sendPrompt, t, workspaceRoot],
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

	const openLaunch = useCallback(() => {
		launchPinned.current = true;
		setShowLaunch(true);
	}, []);

	/** 新会话：在当前 cwd 建一个，面板跟过去（多开的最小可行形态，ADR 0014）。 */
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

	const start = useCallback(async (prompt: string) => void deliver(prompt), [deliver]);
	const send = useCallback(async (text: string) => void deliver(text), [deliver]);

	/** Stop means "stop the run": abort the host turn, then release the container. */
	const stop = useCallback(async () => {
		await abort().catch(() => undefined);
		await client.stopSandbox().catch(() => undefined);
		setSandbox({ running: false, targets: [] });
		setHostStreaming(false);
		setPhase("done");
	}, [abort, client]);

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
	}, [conversation?.id, phase, trace, sandbox, findings, todos, notes, coverage, mcp]);


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
			model: resolved.choice,
			modelFromConversation: resolved.fromConversation,
			workspace: workspaceLabel(conversation?.cwd),
			hostStreaming,
			busy: submitting || hostStreaming,
			start,
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
			submitting,
			start,
			send,
			stop,
			refresh,
		],
	);
}

/** Re-exported so the projection helpers live in one testable place. */
