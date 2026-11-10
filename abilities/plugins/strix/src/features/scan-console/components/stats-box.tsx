/**
 * Sidebar stats box, mirroring upstream's `statsView`.
 *
 * Upstream lists model, subscription state, token usage and version, one per
 * line. The plugin knows the same things from the environment probe and the run
 * record, so the box reads the same way.
 */

import type { EnvironmentProbe, ScanRunSummary } from "../../../runtime-contract";

export interface StatsBoxProps {
	t: (key: string) => string;
	environment?: EnvironmentProbe;
	run?: ScanRunSummary;
}

export function StatsBox({ t, environment, run }: StatsBoxProps): React.ReactElement {
	return (
		<div className="astra-strix-stats">
			<p>{environment?.llm.model || t("stats.modelUnknown")}</p>
			{environment?.llm.configured === false ? (
				<p className="astra-strix-red">{t("setup.llmMissing")}</p>
			) : null}
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
