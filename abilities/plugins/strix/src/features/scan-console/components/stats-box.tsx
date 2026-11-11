/**
 * Sidebar stats box, mirroring upstream's `statsView`.
 *
 * Upstream lists model, usage and version one per line. Here the model is the
 * host's (the scan borrows it), so the box names it directly instead of asking
 * the user to keep two configurations in sync.
 */

import type { EnvironmentProbe, ScanRunSummary } from "../../../runtime-contract";

export interface StatsBoxProps {
	t: (key: string) => string;
	environment?: EnvironmentProbe;
	run?: ScanRunSummary;
	/** The host model the scan runs on, when the relay is live. */
	hostModel?: string | null;
}

export function StatsBox({ t, environment, run, hostModel }: StatsBoxProps): React.ReactElement {
	return (
		<div className="astra-strix-stats">
			<p>{hostModel ?? environment?.llm.model ?? t("stats.modelUnknown")}</p>
			{run?.scanMode ? (
				<p>
					{t("stats.mode")}: {run.scanMode}
				</p>
			) : null}
			{run ? (
				<p>
					{t("stats.findings")}: {run.findingCount}
				</p>
			) : null}
			<p className="astra-strix-dim">{environment?.engine.version ? `strix ${environment.engine.version}` : "strix"}</p>
		</div>
	);
}
