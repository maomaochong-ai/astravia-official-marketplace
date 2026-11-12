/**
 * The state machine behind the tab.
 *
 * Two phases of one screen, as upstream has them: a launch column (`setupView`)
 * and the scan (chat trace + sidebar). The difference is where the work happens -
 * the loop runs here, on the host's model, and this hook is what turns its events
 * plus the bridge's state into the rows the panel draws.
 *
 * Everything the tab needs arrives through `runtime.ensureReady()`: the service URL
 * is not known until the host has started the service, so the first paint is always
 * the launch column with a "connecting" line under it.
 */

import type { PluginAiApi } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StrixAgent, type AgentEvent } from "../../../agent/strix-agent";
import type { BridgeClient } from "../../../domain/bridge-client";
import { normalizeFindings, normalizeProbe, normalizeSandbox } from "../../../domain/bridge-payloads";
import { parseLaunchPrompt } from "../../../domain/launch-request";
import { chooseModel, type ModelChoice } from "../../../domain/model-label";
import type { BridgeEvent, EnvironmentProbe, SandboxStatus, StrixFinding, TraceEntry } from "../../../runtime-contract";

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
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	trace: TraceEntry[];
	model?: ModelChoice;
	models: ModelChoice[];
	busy: boolean;
	/** Start an assessment from the launch prompt. */
	start: (prompt: string) => Promise<void>;
	/** Continue the assessment from the scan composer. */
	send: (text: string) => Promise<void>;
	/** Abort the loop and stop the container. */
	stop: () => Promise<void>;
	/** Re-read state after a failure. */
	refresh: () => Promise<void>;
}

export interface StrixSessionOptions {
	runtime: { ensureReady: () => Promise<string> };
	client: BridgeClient;
	ai: PluginAiApi;
	t: (key: string) => string;
}

export function useStrixSession({ runtime, client, ai, t }: StrixSessionOptions): StrixSessionModel {
	const [phase, setPhase] = useState<SessionPhase>("booting");
	const [log, setLog] = useState<LogLine[]>([]);
	const [environment, setEnvironment] = useState<EnvironmentProbe>();
	const [sandbox, setSandbox] = useState<SandboxStatus>({ running: false, targets: [] });
	const [findings, setFindings] = useState<StrixFinding[]>([]);
	const [trace, setTrace] = useState<TraceEntry[]>([]);
	const [models, setModels] = useState<ModelChoice[]>([]);
	const [model, setModel] = useState<ModelChoice>();
	const [busy, setBusy] = useState(false);

	const seq = useRef(0);
	const agentRef = useRef<StrixAgent | null>(null);
	const modelRef = useRef<ModelChoice | null>(null);

	const note = useCallback((text: string, tone?: LogLine["tone"]) => {
		setLog((previous) => [...previous, { text, ...(tone ? { tone } : {}) }].slice(-LOG_LIMIT));
	}, []);

	const pushTrace = useCallback((entry: Omit<TraceEntry, "id" | "at">) => {
		setTrace((previous) =>
			[...previous, { ...entry, id: `e${(seq.current += 1)}`, at: Date.now() }].slice(-TRACE_LIMIT),
		);
	}, []);

	/** Model + service + machine state, in one pass; every path lands on "setup". */
	const refresh = useCallback(async () => {
		note(t("log.connecting"));
		try {
			await runtime.ensureReady();
			const state = await client.state();
			const probe = normalizeProbe(state?.environment);
			setSandbox(normalizeSandbox(state?.sandbox));
			setFindings(normalizeFindings(state?.findings));
			if (probe) {
				setEnvironment(probe);
				if (!probe.docker.ready) note(t("log.dockerDown"), "error");
				else if (probe.docker.imagePresent === false) note(t("log.imagePending"));
			} else {
				const detail = (state?.environment as { error?: unknown } | undefined)?.error;
				note(`${t("log.bridgeError")}${typeof detail === "string" && detail ? `: ${detail}` : ""}`, "error");
			}
			note(t("log.ready"), "ok");
		} catch (cause) {
			note(`${t("log.bridgeError")}: ${cause instanceof Error ? cause.message : String(cause)}`, "error");
		}

		try {
			const list = await ai.listModels();
			setModels(
				list.models.map((item) => ({ modelKey: item.modelKey, name: item.name, provider: item.provider })),
			);
			const choice = chooseModel(list);
			modelRef.current = choice ?? null;
			setModel(choice);
			if (!choice) note(t("log.noModel"), "error");
		} catch (cause) {
			// A host without `ai.complete` cannot run the loop; say so on the launch
			// screen rather than letting Enter fail later.
			note(`${t("log.noModel")} ${cause instanceof Error ? cause.message : ""}`.trim(), "error");
		}

		setPhase((current) => (current === "scanning" ? current : "setup"));
	}, [ai, client, note, runtime, t]);

	const booted = useRef(false);
	useEffect(() => {
		if (booted.current) return;
		booted.current = true;
		void refresh();
	}, [refresh]);

	// The bridge narrates its own sandbox lifecycle; tool rows come from the loop,
	// so subscribing to `tool_*` here would draw every command twice.
	useEffect(
		() =>
			client.events((event: BridgeEvent) => {
				if (event.event === "sandbox_status") {
					pushTrace({ kind: "note", label: String((event as { phase?: string }).phase ?? "sandbox") });
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
					break;
			}
		},
		[client, pushTrace],
	);

	const agent = useMemo(
		() => new StrixAgent({ ai, bridge: client, emit: onAgentEvent }),
		[ai, client, onAgentEvent],
	);

	// Ownership: aborting on unmount stops a loop whose tab has gone away, so a
	// closed panel cannot keep spending model calls in the background.
	useEffect(() => {
		agentRef.current = agent;
		return () => agent.abort();
	}, [agent]);

	const start = useCallback(
		async (prompt: string) => {
			if (phase === "scanning") return;
			const request = parseLaunchPrompt(prompt);
			if (!modelRef.current) {
				note(t("log.noModel"), "error");
				return;
			}
			if (!request.targets.length && !request.instruction) {
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
			note(
				request.targets.length
					? t("log.scanning").replace("{targets}", request.targets.join(", "))
					: t("log.scanningInstruction"),
				"ok",
			);
			try {
				await agent.start({ ...request, modelKey: modelRef.current.modelKey });
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
			if (!value || phase === "scanning") return;
			pushTrace({ kind: "user", label: value });
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

	return useMemo(
		() => ({ phase, log, environment, sandbox, findings, trace, model, models, busy, start, send, stop, refresh }),
		[phase, log, environment, sandbox, findings, trace, model, models, busy, start, send, stop, refresh],
	);
}
