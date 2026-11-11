/**
 * State model for one console session.
 *
 * The panel shows whichever run is most interesting: the live one if a scan is
 * in flight, otherwise the newest run in the workspace. Everything the panel
 * renders is derived here so the components stay presentational.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TuiUiEvent } from "../components/trace-block";
import type {
	BridgeClient,
	StartScanRequest,
} from "../../../domain/bridge-client";
import type {
	BridgeEvent,
	EnvironmentProbe,
	ScanRecord,
	ScanRunSummary,
	StrixFinding,
} from "../../../runtime-contract";

const TIMELINE_LIMIT = 400;

/** The bridge forwards upstream's projected records verbatim; this is that shape. */
type RankedEvent = TuiUiEvent & { id: string };

export type ConsolePhase = "booting" | "ready" | "unready" | "error";

export interface ScanConsoleModel {
	phase: ConsolePhase;
	environment?: EnvironmentProbe;
	error?: string;
	/** The host model the scan will run on, when the plugin can borrow it. */
	relay?: { available: boolean; model: string | null };
	runs: ScanRunSummary[];
	activeRun?: ScanRunSummary;
	findings: StrixFinding[];
	timeline: TuiUiEvent[];
	scanning: boolean;
	boot: () => Promise<void>;
	start: (request: StartScanRequest) => Promise<void>;
	cancel: () => Promise<void>;
	selectRun: (runName: string) => void;
}

function isProbe(value: unknown): value is EnvironmentProbe {
	return Boolean(value && typeof value === "object" && "ready" in (value as Record<string, unknown>));
}

export function useScanConsole(client: BridgeClient, workspace?: string): ScanConsoleModel {
	const [phase, setPhase] = useState<ConsolePhase>("booting");
	const [environment, setEnvironment] = useState<EnvironmentProbe>();
	const [error, setError] = useState<string>();
	const [relay, setRelay] = useState<{ available: boolean; model: string | null }>();
	const [runs, setRuns] = useState<ScanRunSummary[]>([]);
	const [selectedRun, setSelectedRun] = useState<string>();
	const [findingsByRun, setFindingsByRun] = useState<Record<string, StrixFinding[]>>({});
	const [timeline, setTimeline] = useState<TuiUiEvent[]>([]);
	const [scanning, setScanning] = useState(false);
	const liveRun = useRef<string | undefined>(undefined);

	const activeRun = useMemo(() => {
		if (selectedRun) return runs.find((run) => run.runName === selectedRun) ?? runs[0];
		return runs[0];
	}, [runs, selectedRun]);

	const loadFindings = useCallback(
		async (runName: string) => {
			try {
				const items = await client.findings(runName, workspace);
				setFindingsByRun((previous) => ({ ...previous, [runName]: items }));
			} catch {
				/* a run may not have written findings yet */
			}
		},
		[client, workspace],
	);

	const boot = useCallback(async () => {
		try {
			const state = await client.state(workspace);
			const hostRelay = state.relay ?? { available: false, model: null };
			setRelay(hostRelay);
			if (isProbe(state.environment)) {
				setEnvironment(state.environment);
				// A scan needs the engine, the sandbox and a model. The host relay supplies the
				// model, so Strix's own provider config only matters when no relay is available.
				const usable =
					state.environment.engine.installed &&
					state.environment.docker.ready &&
					(hostRelay.available || state.environment.llm.configured);
				setPhase(usable ? "ready" : "unready");
				setError(undefined);
			} else {
				setPhase("error");
				setError(("error" in state.environment && String(state.environment.error)) || "bridge unavailable");
			}
			setRuns(state.runs ?? []);
			const newest = state.runs?.[0];
			if (newest) void loadFindings(newest.runName);
		} catch (cause) {
			setPhase("error");
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}, [client, loadFindings, workspace]);

	// Boot once per mount. `boot` refreshes state; the effect must not follow its identity,
	// or a re-created client would restart the whole service handshake on every render.
	const booted = useRef(false);
	useEffect(() => {
		if (booted.current) return;
		booted.current = true;
		void boot();
	}, [boot]);

	useEffect(
		() =>
			client.events((event: BridgeEvent) => {
				switch (event.event) {
					case "scan_queued": {
						const runName = String((event as { runName?: string }).runName ?? "");
						liveRun.current = runName;
						setScanning(true);
						setTimeline([]);
						break;
					}
					case "scan_event": {
						const record = (event as { record?: RankedEvent }).record;
						if (!record) break;
						// Upstream republishes an event as its content grows (version bumps); keep one
						// row per event id so streaming text replaces itself instead of stacking.
						setTimeline((previous) => {
							const at = previous.findIndex((item) => item.id === record.id);
							if (at < 0) return [...previous, record].slice(-TIMELINE_LIMIT);
							const next = previous.slice();
							next[at] = record;
							return next;
						});
						break;
					}
					case "scan_finished":
					case "scan_failed":
					case "scan_cancelled": {
						setScanning(false);
						void boot();
						break;
					}
					default:
						break;
				}
			}),
		[boot, client],
	);

	useEffect(() => {
		if (!activeRun) return;
		if (findingsByRun[activeRun.runName]) return;
		void loadFindings(activeRun.runName);
	}, [activeRun, findingsByRun, loadFindings]);

	const start = useCallback(
		async (request: StartScanRequest) => {
			setError(undefined);
			try {
				await client.start({ ...request, workspace });
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : String(cause));
				setScanning(false);
			}
		},
		[client, workspace],
	);

	const cancel = useCallback(async () => {
		try {
			await client.cancel();
		} finally {
			setScanning(false);
		}
	}, [client]);

	return {
		phase,
		environment,
		error,
		relay,
		runs,
		activeRun,
		findings: activeRun ? findingsByRun[activeRun.runName] ?? [] : [],
		timeline,
		scanning,
		boot,
		start,
		cancel,
		selectRun: setSelectedRun,
	};
}
