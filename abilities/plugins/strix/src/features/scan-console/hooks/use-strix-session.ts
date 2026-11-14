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

import type { ConversationEvent, ConversationState } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BridgeClient } from "../../../domain/bridge-client";
import { hasOpenAssessment } from "../../../domain/assessment-presence";
import { evidenceRow, hostRowFor, isServiceNarrated, toolRow } from "../../../domain/conversation-projection";
import { resolveModel, workspaceLabel } from "../../../domain/host-sync";
import { isStrixEngaged } from "../../../domain/engagement";
import { writeSnapshot, belongsTo, readSnapshot } from "../session-store";
import { normalizeRoster, type McpConnection } from "../../../service/mcp-roster";
import type { ModelChoice } from "../../../domain/model-label";
import type {
	BridgeEvent,
	BridgeState,
	CoverageOutcome,
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
	/** Creates a conversation when the user is still on the new-session page. */
	createSession: (cwd: string) => Promise<ConversationState>;
	/** Aborts the host turn; `stop()` calls it before stopping the sandbox. */
	abort: () => Promise<void>;
	t: (key: string) => string;
}

export function useStrixSession({
	runtime,
	client,
	conversation,
	subscribe,
	sendPrompt,
	createSession,
	abort,
	t,
}: StrixSessionOptions): StrixSessionModel {
	// Read once, before the first paint: a remounted tab rehydrates instead of showing
	// the launch column while its assessment is still open behind it (session-store.ts).
	const initial = useRef(readSnapshot(conversation?.id)).current;
	const [phase, setPhase] = useState<SessionPhase>(initial?.phase ?? "booting");
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
	const [mcp, setMcp] = useState<McpConnection[]>(initial?.mcp ?? []);
	const [streaming, setStreaming] = useState<string>("");
	const [hostStreaming, setHostStreaming] = useState<boolean>(Boolean(conversation?.isStreaming));
	const [submitting, setSubmitting] = useState(false);
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
	const streamingRef = useRef("");
	const seq = useRef(0);

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

	const pushTrace = useCallback((entry: Omit<TraceEntry, "id" | "at">) => {
		setTrace((previous) =>
			[...previous, { ...entry, id: `e${(seq.current += 1)}`, at: Date.now() }].slice(-TRACE_LIMIT),
		);
	}, []);

	/** Close the newest row that is still open; returns the patched list unchanged if none. */
	const closeRow = useCallback(
		(patch: Partial<TraceEntry>, match?: (entry: TraceEntry) => boolean) => {
			setTrace((previous) => {
				for (let index = previous.length - 1; index >= 0; index -= 1) {
					const row = previous[index];
					if (!row || row.kind !== "tool" || row.ok !== undefined) continue;
					if (match && !match(row)) continue;
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
					closeRow(row.patch, (entry) => isServiceNarrated(entry.label));
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
	 * The host conversation → this panel.
	 *
	 * One subscription, four kinds of event, and the rule for each is "show what the
	 * agent is doing, do not react to it": the panel never starts a run of its own, which
	 * is what used to make two agents race for one sandbox (ADR strix-0003).
	 */
	useEffect(() => {
		const subscription = subscribe((event) => {
			// Only this panel's conversation: the host's event stream is not per-tab.
			if (!belongsTo(mountedIn.current, conversationIdRef.current)) return;

			if (event.type === "turn-start") {
				// 胶囊开着说明用户把这一轮交给了 Strix：宿主一开始跑，面板就离开首屏跟上去。
				if (isStrixEngaged() && phaseRef.current !== "scanning") {
					setPhase("scanning");
					pushTrace({ kind: "note", label: t("scan.followingHost") });
				}
				setHostStreaming(true);
				return;
			}

			if (event.type === "turn-end") {
				// A turn that ended with streamed text but no `message-added` still has a
				// conclusion worth keeping; an aborted turn leaves nothing to keep.
				const pending = streamingRef.current.trim();
				if (pending) {
					pushTrace({ kind: "host-say", label: streamingRef.current });
					streamingRef.current = "";
					setStreaming("");
				}
				setHostStreaming(false);
				void refresh();
				return;
			}

			if (event.type === "message-updated") {
				// Token-by-token: this is the panel producing output as the host AI does.
				streamingRef.current += event.delta;
				setStreaming(streamingRef.current);
				return;
			}

			if (event.type === "message-added") {
				const row = hostRowFor(event.message);
				if (!row) return;
				if (row.kind === "host-say") {
					// The final text supersedes whatever streamed; one row, not two.
					streamingRef.current = "";
					setStreaming("");
				}
				pushTrace(row);
				return;
			}

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
				closeRow({ ok: !event.isError });
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
			try {
				if (!conversationIdRef.current) {
					const cwd = cwdRef.current;
					if (!cwd) {
						note(t("log.noWorkspace"), "error");
						return false;
					}
					const created = await createSession(cwd);
					conversationIdRef.current = created.id ?? conversationIdRef.current;
				}
				const receipt = await sendPrompt(value);
				if (receipt.status === "failed") {
					note(t("log.sendFailed"), "error");
					return false;
				}
				pushTrace({ kind: "user", label: value });
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
		[createSession, note, pushTrace, sendPrompt, t],
	);

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
			mcp,
			model: resolved.choice,
			modelFromConversation: resolved.fromConversation,
			workspace: workspaceLabel(conversation?.cwd),
			hostStreaming,
			...(streaming ? { streaming } : {}),
			busy: submitting || hostStreaming,
			start,
			send,
			stop,
			refresh,
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
			mcp,
			resolved,
			conversation?.cwd,
			hostStreaming,
			streaming,
			submitting,
			start,
			send,
			stop,
			refresh,
		],
	);
}

/** Re-exported so the projection helpers live in one testable place. */
