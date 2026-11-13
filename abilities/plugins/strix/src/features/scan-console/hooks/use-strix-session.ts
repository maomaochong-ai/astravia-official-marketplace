/**
 * The state machine behind the tab.
 *
 * Two phases of one screen, as upstream has them: a launch column (`setupView`) and
 * the scan (chat trace + sidebar). What differs is where everything comes from - the
 * panel is a *view of the active conversation*, not a private agent:
 *
 *  - the model is the conversation's (`resolveModel`), so switching model in the host
 *    switches it here too;
 *  - the workspace is the conversation's cwd, mounted into the sandbox;
 *  - the trace carries both the loop this panel runs **and** the Strix calls the host
 *    agent makes from the chat, because both drive the same sandbox.
 *
 * Everything the tab needs at boot arrives through `runtime.ensureReady()`: the
 * service URL is not known until the host has started the service, so the first
 * paint is always the launch column with a "connecting" line under it.
 */

import type { ConversationEvent, ConversationState, PluginAiApi, PluginAiModel } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StrixAgent, type AgentEvent } from "../../../agent/strix-agent";
import type { BridgeClient } from "../../../domain/bridge-client";
import {
	normalizeCoverage,
	normalizeFindings,
	normalizeNotes,
	normalizeProbe,
	normalizeSandbox,
	normalizeTodos,
} from "../../../domain/bridge-payloads";
import type { AgentStatus } from "../../../agent/strix-agent";
import { hostToolCall, resolveModel, workspaceLabel } from "../../../domain/host-sync";
import { parseLaunchPrompt } from "../../../domain/launch-request";
import type { ModelChoice } from "../../../domain/model-label";
import { belongsTo, readSnapshot, writeSnapshot } from "../session-store";
import { normalizeRoster, type McpConnection } from "../../../service/mcp-roster";
import type {
	BridgeEvent,
	CoverageOutcome,
	EnvironmentProbe,
	NoteSummary,
	SandboxStatus,
	StrixFinding,
	TodoItem,
	TraceEntry,
} from "../../../runtime-contract";

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
	/** Specialist agents and their status, as reported by the loop. */
	agents: AgentStatus[];
	/** MCP connections as last reported; docked like upstream's Mcp panel. */
	mcp: McpConnection[];
	model?: ModelChoice;
	/** True when the model is the one the active conversation runs on. */
	modelFromConversation: boolean;
	/** Folder name of the conversation's workspace, shown in the status row. */
	workspace?: string;
	hostStreaming: boolean;
	busy: boolean;
	/** A question from `strix_ask_user` that is waiting for the operator. */
	question?: { text: string; options?: string[] };
	/** Set when the agent called `strix_finish`; the report is already written. */
	finished?: { summary: string };
	/** Start an assessment from the launch prompt. */
	start: (prompt: string) => Promise<void>;
	/** Continue the assessment from the scan composer. */
	send: (text: string) => Promise<void>;
	/** Answer a pending question; the composer submits through this while one is open. */
	answer: (text: string) => Promise<void>;
	/** Abort the loop and stop the container. */
	stop: () => Promise<void>;
	/** Re-read state after a failure. */
	refresh: () => Promise<void>;
}

export interface StrixSessionOptions {
	runtime: { ensureReady: () => Promise<string> };
	client: BridgeClient;
	ai: PluginAiApi;
	/** Active conversation, from `useActiveConversation()`; null on a fresh-session page. */
	conversation: ConversationState | null;
	/** `ctx.conversation.on`: the host's turn and tool events, so its Strix calls land in the trace. */
	subscribe: (listener: (event: ConversationEvent) => void) => { dispose(): void };
	/** Host conversation API: a prompt typed in the panel is delivered there (ADR 0003). */
	sendPrompt: (text: string) => Promise<{ status: "sent" | "queued" | "failed" }>;
	t: (key: string) => string;
}

export function useStrixSession({ runtime, client, ai, conversation, subscribe, sendPrompt, t }: StrixSessionOptions): StrixSessionModel {
	// Read once, before the first paint: a remounted tab rehydrates instead of showing
	// the launch column while its scan is still running behind it (session-store.ts).
	const initial = useRef(readSnapshot(conversation?.id)).current;
	const [phase, setPhase] = useState<SessionPhase>(initial?.phase ?? "booting");
	const [log, setLog] = useState<LogLine[]>([]);
	// Boot is a *state*, not a log entry (ADR strix-0004). Pushing "connecting" into
	// the log left that line on screen forever: the reader could not tell whether the
	// bridge was still coming up or the message was simply history.
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
	const [agents, setAgents] = useState<AgentStatus[]>(initial?.agents ?? []);
	const [mcp, setMcp] = useState<McpConnection[]>(initial?.mcp ?? []);
	const [question, setQuestion] = useState<StrixSessionModel["question"]>();
	const [finished, setFinished] = useState<StrixSessionModel["finished"]>();
	const [models, setModels] = useState<PluginAiModel[]>([]);
	const [defaultModel, setDefaultModel] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	// Scope and memory (see session-store.ts). `mountedIn` is the conversation this panel
	// was opened in: events from any other conversation are ignored, so project A's chat
	// cannot start a scan in project B's panel.
	const mountedIn = useRef<string | null>(conversation?.id ?? null);
	const conversationIdRef = useRef<string | undefined>(conversation?.id);
	conversationIdRef.current = conversation?.id;
	/**
	 * Prompts the panel itself just delivered to the conversation. The host echoes them
	 * back as `message-added`, and that echo must not start a second run (ADR strix-0003).
	 */
	const suppressMirror = useRef<Set<string>>(new Set());
	const seq = useRef(0);
	const agentRef = useRef<StrixAgent | null>(null);
	/** Resolver for the question currently on screen; `answer()` calls it. */
	const answerRef = useRef<((text: string) => void) | null>(null);

	// The conversation's model is the authority; recomputed on every conversation
	// change so a model switch in the chat moves this panel with it.
	const resolved = useMemo(
		() => resolveModel({ conversationModel: conversation?.model, models, defaultModel }),
		[conversation?.model, models, defaultModel],
	);
	const modelRef = useRef<ModelChoice | undefined>(resolved.choice);
	const cwdRef = useRef<string | null>(conversation?.cwd ?? null);
	useEffect(() => {
		modelRef.current = resolved.choice;
		cwdRef.current = conversation?.cwd ?? null;
	}, [resolved.choice, conversation?.cwd]);

	const note = useCallback((text: string, tone?: LogLine["tone"]) => {
		setLog((previous) => [...previous, { text, ...(tone ? { tone } : {}) }].slice(-LOG_LIMIT));
	}, []);

	const pushTrace = useCallback((entry: Omit<TraceEntry, "id" | "at">) => {
		setTrace((previous) =>
			[...previous, { ...entry, id: `e${(seq.current += 1)}`, at: Date.now() }].slice(-TRACE_LIMIT),
		);
	}, []);

	/** Service + machine state, plus the model list the conversation model resolves against. */
	const refresh = useCallback(async () => {
		setBoot({ state: "connecting" });
		try {
			await runtime.ensureReady();
			setBoot({ state: "ready" });
			const state = await client.state();
			const probe = normalizeProbe(state?.environment);
			setSandbox(normalizeSandbox(state?.sandbox));
			setFindings(normalizeFindings(state?.findings));
			setTodos(normalizeTodos(state?.todos));
			setNotes(normalizeNotes(state?.notes));
			setCoverage(normalizeCoverage(state?.coverage));
			setFindings(normalizeFindings(state?.findings));
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
			// No "ready" line either: the boot state already says it, and a log that keeps
			// every status turns into the same noise the terminal had.
		} catch (cause) {
			setBoot({ state: "failed", detail: cause instanceof Error ? cause.message : String(cause) });
			// Not also pushed into the log: the boot strip shows the same sentence with the
			// reason, and two copies of one error read as two failures (ADR strix-0004).
		}

		try {
			const list = await ai.listModels();
			setModels(list.models);
			setDefaultModel(list.defaultModel);
			if (!list.models.length && !conversation?.model) note(t("log.noModel"), "error");
		} catch (cause) {
			// A host without `ai.complete` cannot run the loop; say so on the launch
			// screen rather than letting Enter fail later.
			note(`${t("log.noModel")} ${cause instanceof Error ? cause.message : ""}`.trim(), "error");
		}

		setPhase((current) => (current === "scanning" ? current : "setup"));
	}, [ai, client, conversation?.model, note, runtime, t]);

	// Where the model and the mounted folder came from, announced once per conversation
	// in the launch log. Upstream's log is exactly this kind of launch-time status, and
	// it is the only place the provenance can be stated without changing the layout.
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

	// The bridge narrates its sandbox lifecycle; tool rows come from the loop and the
	// host conversation, so subscribing to `tool_*` here would draw commands twice.
	useEffect(
		() =>
			client.events((event: BridgeEvent) => {
				if (event.event === "sandbox_status") {
					pushTrace({ kind: "note", label: String((event as { phase?: string }).phase ?? "sandbox") });
				}
				if (event.event === "sandbox_degraded") {
					// Say it in the trace and in the environment chip: a session that runs on this
					// machine is usable, but the reader has to know the isolation is weaker.
					const reason = String((event as { reason?: string }).reason ?? "");
					pushTrace({ kind: "note", label: `${t("sandbox.degraded")}${reason ? `: ${reason}` : ""}` });
					setEnvironment((current) => (current ? { ...current, mode: "host" } : current));
				}
				if (event.event === "sandbox_ready") {
					setSandbox(normalizeSandbox((event as { status?: unknown }).status ?? { running: true }));
				}
				if (event.event === "sandbox_stopped") setSandbox({ running: false, targets: [] });
			}),
		[client, pushTrace],
	);



	const onAgentEvent = useCallback(
		(event: AgentEvent) => {
			switch (event.type) {
				case "say":
					pushTrace({ kind: "say", label: event.text });
					break;
				case "note":
					pushTrace({ kind: "note", label: event.text });
					break;
				case "tool-start":
					pushTrace({ kind: "tool", label: event.name, detail: event.label });
					break;
				case "tool-end":
					// Close the open row for this call instead of adding one: a command and
					// its result are one block in the trace, as upstream renders them.
					setTrace((previous) => {
						const index = [...previous]
							.reverse()
							.findIndex((item) => item.kind === "tool" && item.ok === undefined);
						if (index < 0) return previous;
						const target = previous.length - 1 - index;
						const next = previous.slice();
						const row = next[target];
						if (!row) return previous;
						next[target] = {
							...row,
							ok: event.ok,
							detail: [row.detail, event.detail].filter(Boolean).join("  ·  "),
							...(event.output ? { output: event.output } : {}),
						};
						return next;
					});
					void client
						.findings()
						.then((list) => setFindings(normalizeFindings(list)))
						.catch(() => undefined);
					void client
						.callTool("strix_mcp")
						.then((result) => setMcp(normalizeRoster(result)))
						.catch(() => undefined);
					break;
				case "agent":
					setAgents((previous) => [...previous.filter((item) => item.name !== event.agent.name), event.agent]);
					break;
				case "question":
					setQuestion({ text: event.question, ...(event.options ? { options: event.options } : {}) });
					pushTrace({ kind: "note", label: event.question });
					break;
				case "finished":
					setFinished({ summary: event.summary });
					pushTrace({ kind: "note", label: event.summary });
					break;
			}
		},
		[client, pushTrace],
	);

	/**
	 * The operator's answer, and the report a `finish` writes.
	 *
	 * `askUser` parks the loop on a promise: the composer submits into `answer()`, which
	 * resolves it. `finish` renders the report through the service so the artefact lands
	 * next to the findings instead of living only in this tab.
	 */
	const local = useMemo(
		() => ({
			askUser: (questionText: string, options?: string[]) =>
				new Promise<string>((resolve) => {
					setQuestion({ text: questionText, ...(options ? { options } : {}) });
					answerRef.current = (value: string) => {
						setQuestion(undefined);
						answerRef.current = null;
						resolve(value);
					};
				}),
			finish: async ({ executiveSummary, targets }: { executiveSummary: string; targets?: string[] }) => {
				await client
					.callTool("strix_report", {
						executiveSummary,
						...(targets?.length ? { targets } : {}),
					})
					.then(() => client.callTool("strix_report", { format: "sarif" }))
					.catch(() => undefined);
				setPhase("done");
			},
		}),
		[client],
	);

	const answer = useCallback(async (text: string) => {
		const resolve = answerRef.current;
		if (!resolve) return;
		pushTrace({ kind: "user", label: text });
		resolve(text);
	}, [pushTrace]);

	const agent = useMemo(
		() => new StrixAgent({ ai, bridge: client, emit: onAgentEvent, local }),
		[ai, client, local, onAgentEvent],
	);

	// Ownership: aborting on unmount stops a loop whose tab has gone away, so a
	// closed panel cannot keep spending model calls in the background.
	useEffect(() => {
		agentRef.current = agent;
		return () => agent.abort();
	}, [agent]);

	/**
	 * The host agent's own Strix calls, mirrored into the trace.
	 *
	 * Without this the panel would be blind to everything the user does from the chat:
	 * `strix_sandbox_start` sets the targets, `strix_exec` runs the commands, and the
	 * findings they file land in the sidebar. One assessment, two windows.
	 */
	useEffect(() => {
		if (!belongsTo(mountedIn.current, conversationIdRef.current)) return;
		const subscription = subscribe((event) => {
			switch (event.type) {
				case "tool-call-start": {
					// Only Strix's own tools: another MCP server in the same conversation
					// must not write rows into this assessment.
					const row = hostToolCall(event.toolName, event.args);
					if (row) pushTrace({ kind: "tool", label: row.label, detail: row.detail });
					break;
				}
				case "tool-call-end": {
					if (!hostToolCall(event.toolName)) break;
					// Close the oldest open row rather than appending: the host emits end
					// without the arguments, so the call is identified by an open row.
					setTrace((previous) => {
						const index = previous.findIndex((item) => item.kind === "tool" && item.ok === undefined);
						if (index < 0) return previous;
						const next = previous.slice();
						const entry = next[index];
						if (!entry) return previous;
						next[index] = { ...entry, ok: !event.isError };
						return next;
					});
					void client
						.findings()
						.then((list) => setFindings(normalizeFindings(list)))
						.catch(() => undefined);
					break;
				}
				default:
					break;
			}
		});
		return () => subscription.dispose();
	}, [client, conversation?.id, pushTrace, subscribe]);
	const start = useCallback(
		async (prompt: string) => {
			if (phase === "scanning") return;
			const request = parseLaunchPrompt(prompt);
			if (!modelRef.current) {
				note(t("log.noModel"), "error");
				return;
			}
			if (!request.targets.length && !request.instruction && !cwdRef.current) {
				note(t("log.noTarget"), "error");
				return;
			}
			if (environment && !environment.docker.ready) {
				note(t("log.dockerDown"), "error");
				return;
			}

			setTrace([]);
			setPhase("scanning");
			setBusy(true);
			const workspace = cwdRef.current;
			note(
				request.targets.length
					? t("log.scanning").replace("{targets}", request.targets.join(", "))
					: t("log.scanningInstruction"),
				"ok",
			);
			try {
				await agent.start({
					...request,
					modelKey: modelRef.current.modelKey,
					...(workspace ? { workspace } : {}),
				});
				setPhase("done");
			} catch (cause) {
				const detail = cause instanceof Error ? cause.message : String(cause);
				note(`${t("log.scanFailed")}: ${detail}`, "error");
				pushTrace({ kind: "note", label: detail });
				setPhase("done");
			} finally {
				setBusy(false);
			}
		},
		[agent, environment, note, phase, pushTrace, t],
	);

	const send = useCallback(
		async (text: string) => {
			const value = text.trim();
			if (!value) return;
			pushTrace({ kind: "user", label: value });
			// Typed here, delivered to the conversation: the host's own turn is the run, so
			// the message also lands in the host transcript instead of existing only here
			// (ADR strix-0003). Suppressed in the mirror so it cannot start a second run.
			if (conversation?.id) {
				suppressMirror.current.add(value);
				const receipt = await sendPrompt(value).catch(() => undefined);
				if (receipt && receipt.status !== "failed") {
					if (phase !== "scanning") setPhase("scanning");
					return;
				}
				suppressMirror.current.delete(value);
			}
			if (phase === "scanning") return;
			setPhase("scanning");
			setBusy(true);
			try {
				await agent.send(value, modelRef.current?.modelKey);
				setPhase("done");
			} catch (cause) {
				const detail = cause instanceof Error ? cause.message : String(cause);
				note(`${t("log.scanFailed")}: ${detail}`, "error");
				pushTrace({ kind: "note", label: detail });
				setPhase("done");
			} finally {
				setBusy(false);
			}
		},
		[agent, note, phase, pushTrace, t],
	);

	const stop = useCallback(async () => {
		agentRef.current?.abort();
		await client.stopSandbox().catch(() => undefined);
		setSandbox({ running: false, targets: [] });
		setBusy(false);
		setPhase((current) => (current === "scanning" ? "done" : current));
	}, [client]);

	// Persist after every change so a remount resumes rather than restarts. Not a
	// `useMemo`: the whole point is the write, and it has to happen while the tab is
	// still alive — React does not run effects on unmount for this.
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
			agents,
			mcp,
		});
	}, [conversation?.id, phase, trace, sandbox, findings, todos, notes, coverage, agents, mcp]);

	// Host conversation → panel (ADR strix-0003). Declared after `start`/`send` so the
	// effect can hold their latest identities without re-subscribing on every render:
	// re-subscribing would drop a message that arrives while the panel re-renders.
	const phaseRef = useRef<SessionPhase>(phase);
	phaseRef.current = phase;
	const startRef = useRef(start);
	startRef.current = start;
	const sendRef = useRef(send);
	sendRef.current = send;
	useEffect(() => {
		const subscription = subscribe((event) => {
			// Only this panel's conversation: the host's event stream is not per-tab, so an
			// unscoped listener would let project A's message start a scan in project B.
			if (!belongsTo(mountedIn.current, conversationIdRef.current)) return;
			if (event.type !== "message-added") return;
			const message = event.message;
			const text = message.text.trim();
			if (!text) return;
			if (message.role === "user") {
				// A prompt the panel just delivered comes back as this echo: show it once, and do
				// not start a second run from it (ADR strix-0003).
				if (suppressMirror.current.delete(text)) {
					pushTrace({ kind: "host", label: text });
					return;
				}
				pushTrace({ kind: "host", label: text });
				if (phaseRef.current !== "scanning") void startRef.current(text);
				else void sendRef.current(text);
				return;
			}
			if (message.role === "assistant") pushTrace({ kind: "host-say", label: text });
		});
		return () => subscription.dispose();
	}, [subscribe, pushTrace]);
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
			agents,
			mcp,
			question,
			finished,
			model: resolved.choice,
			modelFromConversation: resolved.fromConversation,
			workspace: workspaceLabel(conversation?.cwd),
			hostStreaming: Boolean(conversation?.isStreaming),
			busy,
			start,
			send,
			answer,
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
			agents,
			mcp,
			question,
			finished,
			resolved,
			models,
			conversation?.cwd,
			conversation?.isStreaming,
			busy,
			start,
			send,
			answer,
			stop,
			refresh,
		],
	);
}