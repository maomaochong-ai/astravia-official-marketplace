/**
 * The activity-tab surface.
 *
 * Layout follows the upstream TUI's two columns - a bordered trace with the
 * composer under it, and a findings list beside it - but keeps only what a user
 * acts on. An earlier version stacked status, targets, agents and a model panel
 * above the form; every one of those is either config the plugin now derives
 * from the host or detail nobody reads before pressing Start.
 *
 * Model, engine and sandbox are no longer "setup steps" to satisfy: the scan runs
 * on the host's own model through the plugin's relay, so the only thing worth
 * saying up front is that the engine or Docker is missing.
 */

import { FindingList } from "../../findings/components/finding-list";
import { PanelBox } from "../../../shared/components/panel-box";
import { LaunchForm } from "./launch-form";
import { StatsBox } from "./stats-box";
import { TraceBlock } from "./trace-block";
import type { ScanConsoleModel } from "../hooks/use-scan-console";
import type { ServiceStatus } from "../../../runtime-contract";

export interface StrixConsolePanelProps {
	t: (key: string) => string;
	model: ScanConsoleModel;
	/** Managed-service status, so a stuck service explains itself instead of spinning. */
	status?: ServiceStatus;
}

function Blockers({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement | null {
	const probe = model.environment;
	if (!probe) return null;
	const missing = [
		!probe.python.found
			? { key: "setup.python", detail: probe.python.executable, hint: "setup.pythonHint" }
			: undefined,
		!probe.engine.installed
			? { key: "setup.engine", detail: probe.engine.version, hint: "setup.engineHint" }
			: undefined,
		!probe.docker.ready ? { key: "setup.docker", detail: probe.docker.detail, hint: "setup.dockerHint" } : undefined,
	].filter((row): row is { key: string; detail: string; hint: string } => Boolean(row));

	// A model is only a blocker when the host has none either.
	if (!model.relay?.available && !probe.llm.configured) {
		missing.push({ key: "setup.llm", detail: probe.llm.detail ?? "", hint: "setup.llmHint" });
	}
	if (!missing.length) return null;

	return (
		<div className="astra-strix-blockers">
			{missing.map((row) => (
				<p key={row.key} className="astra-strix-setup-row">
					<span className="astra-strix-red">✗</span>
					<span>{t(row.key)}</span>
					{row.detail ? <code className="astra-strix-code">{row.detail}</code> : null}
					<span className="astra-strix-dim">{t(row.hint)}</span>
				</p>
			))}
		</div>
	);
}

export function StrixConsolePanel({ t, model, status }: StrixConsolePanelProps): React.ReactElement {
	const ready = model.phase === "ready";
	const run = model.activeRun;
	const serverUp = status ? status.phase === "starting" || status.phase === "ready" : true;
	const hostModel = model.relay?.model;

	return (
		<div className="astra-strix-panel">
			<header className="astra-strix-titlebar">
				<span className="astra-strix-wordmark">
					<strong>Strix</strong>
					<span className="astra-strix-dim"> · {t("panel.subtitle")}</span>
				</span>
				{/* The model is the host's, so say which one rather than offering a picker. */}
				<span className="astra-strix-chip astra-strix-dim" title={t("panel.modelHint")}>
					{hostModel ?? model.environment?.llm.model ?? t("stats.modelUnknown")}
				</span>
				{model.scanning ? <span className="astra-strix-chip astra-strix-green">{t("panel.live")}</span> : null}
				{!serverUp ? (
					<span className="astra-strix-chip astra-strix-amber">
						{t("panel.service")}: {status?.phase}
					</span>
				) : null}
				{model.phase === "error" ? (
					<button type="button" className="astra-strix-chip astra-strix-red" onClick={() => void model.boot()}>
						{t("boot.retry")}
					</button>
				) : null}
			</header>

			{model.error ? <p className="astra-strix-error">{model.error}</p> : null}

			<div className="astra-strix-body">
				<section className="astra-strix-trace-pane">
					<div className="astra-strix-trace">
						{model.phase === "booting" ? (
							<p className="astra-strix-dim">{t("boot.loading")}</p>
						) : model.timeline.length ? (
							model.timeline.map((event, index) => <TraceBlock key={event.id ?? index} event={event} />)
						) : (
							<p className="astra-strix-dim">{t("timeline.empty")}</p>
						)}
					</div>
					<div className="astra-strix-composer">
						<Blockers t={t} model={model} />
						<LaunchForm
							t={t}
							scanning={model.scanning}
							disabled={!ready}
							onStart={model.start}
							onCancel={model.cancel}
						/>
					</div>
				</section>

				<aside className="astra-strix-sidebar">
					{run ? (
						<PanelBox title={t("stats.title")}>
							<StatsBox t={t} environment={model.environment} run={run} hostModel={hostModel} />
						</PanelBox>
					) : null}
					<PanelBox title={t("findings.title")} hint={String(model.findings.length)} focused>
						<FindingList t={t} findings={model.findings} runStatus={run?.status} />
					</PanelBox>
				</aside>
			</div>
		</div>
	);
}
