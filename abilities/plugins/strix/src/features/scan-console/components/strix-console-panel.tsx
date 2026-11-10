/**
 * The activity-tab surface, laid out like the upstream TUI.
 *
 * Upstream's screen has two columns (strix/interface/tui/internal/app/view.go:mainView):
 * a bordered chat trace with the composer under it on the left, and a sidebar of
 * rounded boxes - viewer, stats, targets, agents, findings, MCP - on the right.
 * This panel keeps that arrangement so the plugin looks like the tool it wraps;
 * the only thing added is the launch form, which upstream collects at its setup
 * screen and which therefore sits where its composer sits.
 */

import { FindingList } from "../../findings/components/finding-list";
import { PanelBox } from "../../../shared/components/panel-box";
import { AgentList } from "./agent-list";
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

function Targets({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement {
	const targets = model.activeRun?.targets ?? [];
	if (!targets.length) return <p className="astra-strix-dim">{t("targets.empty")}</p>;
	return (
		<ul className="astra-strix-targets">
			{targets.map((target, index) => (
				<li key={`${target.original ?? index}`} className="astra-strix-target">
					<span className="astra-strix-dim">{target.type}</span>
					<span className="astra-strix-target-name">{target.original ?? String(index)}</span>
				</li>
			))}
		</ul>
	);
}

function Setup({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement | null {
	const probe = model.environment;
	if (!probe) return null;
	const rows = [
		{ ok: probe.python.found, key: "setup.python", detail: probe.python.executable },
		{ ok: probe.engine.installed, key: "setup.engine", detail: probe.engine.version },
		{ ok: probe.docker.ready, key: "setup.docker", detail: probe.docker.detail },
		{ ok: probe.llm.configured, key: "setup.llm", detail: probe.llm.model },
	];
	if (rows.every((row) => row.ok)) return null;
	return (
		<div className="astra-strix-setup">
			{rows.map((row) => (
				<p key={row.key} className="astra-strix-setup-row">
					<span className={row.ok ? "astra-strix-green" : "astra-strix-red"}>{row.ok ? "✓" : "✗"}</span>
					<span>{t(row.key)}</span>
					{!row.ok && row.detail ? <code className="astra-strix-code">{row.detail}</code> : null}
				</p>
			))}
			{!probe.engine.installed ? (
				<p className="astra-strix-hint">
					<code className="astra-strix-code">uv tool install strix-agent</code>
				</p>
			) : null}
			{!probe.python.found ? <p className="astra-strix-hint">{t("setup.pythonHint")}</p> : null}
			{!probe.docker.ready ? <p className="astra-strix-hint">{t("setup.dockerHint")}</p> : null}
			{!probe.llm.configured ? <p className="astra-strix-hint">{t("setup.llmHint")}</p> : null}
		</div>
	);
}

export function StrixConsolePanel({ t, model, status }: StrixConsolePanelProps): React.ReactElement {
	const ready = model.phase === "ready";
	const run = model.activeRun;
	const serverUp = status ? status.phase === "starting" || status.phase === "ready" : true;

	return (
		<div className="astra-strix-panel">
			<header className="astra-strix-titlebar">
				<span className="astra-strix-wordmark">
					<strong>Strix</strong>
					<span className="astra-strix-dim"> · {t("panel.subtitle")}</span>
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
							model.timeline.map((event, index) => (
								<TraceBlock key={event.id ?? index} event={event} />
							))
						) : (
							<p className="astra-strix-dim">{t("timeline.empty")}</p>
						)}
					</div>
					<div className="astra-strix-composer">
						<Setup t={t} model={model} />
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
					<PanelBox title={t("stats.title")}>
						<StatsBox t={t} environment={model.environment} run={run} />
					</PanelBox>
					<PanelBox title={t("targets.title")} hint={String(run?.targets?.length ?? 0)}>
						<Targets t={t} model={model} />
					</PanelBox>
					<PanelBox title={t("agents.title")}>
						<AgentList t={t} events={model.timeline} />
					</PanelBox>
					<PanelBox title={t("findings.title")} hint={String(model.findings.length)} focused>
						<FindingList t={t} findings={model.findings} runStatus={run?.status} />
					</PanelBox>
				</aside>
			</div>
		</div>
	);
}
