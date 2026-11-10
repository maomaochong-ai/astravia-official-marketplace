/**
 * State model for one console session.
 *
 * The panel shows whichever run is most interesting: the live one if a scan is
 * in flight, otherwise the newest run in the workspace. Everything the panel
 * renders is derived here so the components stay presentational.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type ConsolePhase = "booting" | "ready" | "unready" | "error";

export interface ScanConsoleModel {
	phase: ConsolePhase;
	environment?: EnvironmentProbe;
	error?: string;
	runs: ScanRunSummary[];
	activeRun?: ScanRunSummary;
	findings: StrixFinding[];
	timeline: ScanRecord[];
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
	const [runs, setRuns] = useState<ScanRunSummary[]>([]);
	const [selectedRun, setSelectedRun] = useState<string>();
	const [findingsByRun, setFindingsByRun] = useState<Record<string, StrixFinding[]>>({});
	const [timeline, setTimeline] = useState<ScanRecord[]>([]);
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
			if (isProbe(state.environment)) {
				setEnvironment(state.environment);
				setPhase(state.environment.ready ? "ready" : "unready");
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

	useEffect(() => {
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
						const record = (event as { record?: ScanRecord }).record;
						if (!record) break;
						setTimeline((previous) => [...previous, record].slice(-TIMELINE_LIMIT));
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
