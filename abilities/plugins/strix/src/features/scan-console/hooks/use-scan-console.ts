/**
 * State model for the console.
 *
 * The panel is a window on what the **host agent** is doing with Strix's tools:
 * the sandbox session, the commands that ran, and the findings it filed. It never
 * starts a scan itself - the agent does that - so this hook only reads.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BridgeClient } from "../../../domain/bridge-client";
import type {
	BridgeEvent,
	EnvironmentProbe,
	SandboxStatus,
	StrixFinding,
	TraceEntry,
} from "../../../runtime-contract";

const TRACE_LIMIT = 300;

export type ConsolePhase = "booting" | "ready" | "unready" | "error";

export interface ScanConsoleModel {
	phase: ConsolePhase;
	environment?: EnvironmentProbe;
	error?: string;
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	trace: TraceEntry[];
	/** True while a command is in flight, so the status line can say so. */
	busy: boolean;
	boot: () => Promise<void>;
	stopSandbox: () => Promise<void>;
}

function isProbe(value: unknown): value is EnvironmentProbe {
	return Boolean(value && typeof value === "object" && "ready" in (value as Record<string, unknown>));
}

export function useScanConsole(client: BridgeClient): ScanConsoleModel {
	const [phase, setPhase] = useState<ConsolePhase>("booting");
	const [environment, setEnvironment] = useState<EnvironmentProbe>();
	const [error, setError] = useState<string>();
	const [sandbox, setSandbox] = useState<SandboxStatus>({ running: false });
	const [findings, setFindings] = useState<StrixFinding[]>([]);
	const [trace, setTrace] = useState<TraceEntry[]>([]);
	const [busy, setBusy] = useState(false);
	const seq = useRef(0);

	const boot = useCallback(async () => {
		try {
			const state = await client.state();
			if (isProbe(state.environment)) {
				setEnvironment(state.environment);
				setPhase(state.environment.ready ? "ready" : "unready");
				setError(undefined);
			} else {
				setPhase("error");
				setError(("error" in state.environment && String(state.environment.error)) || "bridge unavailable");
			}
			setSandbox(state.sandbox ?? { running: false });
			setFindings(state.findings ?? []);
		} catch (cause) {
			setPhase("error");
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}, [client]);

	// Boot once per mount: `boot` refreshes state, and following its identity
	// would re-run the service handshake on every render.
	const booted = useRef(false);
	useEffect(() => {
		if (booted.current) return;
		booted.current = true;
		void boot();
	}, [boot]);

	useEffect(
		() =>
			client.events((event: BridgeEvent) => {
				const at = Date.now();
				switch (event.event) {
					case "sandbox_status":
						setTrace((previous) =>
							[
								...previous,
								{ id: `note-${(seq.current += 1)}`, kind: "note" as const, label: String((event as { phase?: string }).phase ?? "sandbox"), at },
							].slice(-TRACE_LIMIT),
						);
						break;
					case "sandbox_ready":
						setSandbox((event as { status?: SandboxStatus }).status ?? { running: true });
						void boot();
						break;
					case "sandbox_stopped":
						setSandbox({ running: false });
						setBusy(false);
						void boot();
						break;
					case "tool_start": {
						const payload = event as { tool?: string; command?: string; workdir?: string | null };
						setBusy(true);
						setTrace((previous) =>
							[
								...previous,
								{
									id: `run-${(seq.current += 1)}`,
									kind: "command" as const,
									label: payload.command ?? payload.tool ?? "command",
									detail: payload.workdir ?? undefined,
									at,
								},
							].slice(-TRACE_LIMIT),
						);
						break;
					}
					case "tool_end": {
						const payload = event as { command?: string; ok?: boolean; exitCode?: number | null };
						setBusy(false);
						// Close the matching row instead of adding one: a command and its result
						// are one line in the trace, exactly as the upstream TUI renders it.
						setTrace((previous) => {
							const index = [...previous].reverse().findIndex((item) => item.kind === "command" && item.ok === undefined);
							if (index < 0) return previous;
							const at2 = previous.length - 1 - index;
							const next = previous.slice();
							next[at2] = { ...next[at2], ok: payload.ok ?? true, detail: payload.exitCode === undefined ? next[at2].detail : `exit ${payload.exitCode}` };
							return next;
						});
						void boot();
						break;
					}
					default:
						break;
				}
			}),
		[boot, client],
	);

	const stopSandbox = useCallback(async () => {
		try {
			await client.stopSandbox();
		} finally {
			setSandbox({ running: false });
			setBusy(false);
			void boot();
		}
	}, [boot, client]);

	return useMemo(
		() => ({ phase, environment, error, sandbox, findings, trace, busy, boot, stopSandbox }),
		[phase, environment, error, sandbox, findings, trace, busy, boot, stopSandbox],
	);
}
