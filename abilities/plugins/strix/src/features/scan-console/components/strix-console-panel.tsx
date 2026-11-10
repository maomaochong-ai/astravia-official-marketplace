/**
 * The activity-tab surface.
 *
 * Renders nothing until the tab is opened: the tab itself is registered with
 * `initiallyVisible: false`, so installing the plugin adds a menu entry, not a
 * panel competing with the conversation.
 */

import { FindingList } from "../../findings/components/finding-list";
import { LaunchForm } from "./launch-form";
import { ScanTimeline } from "./scan-timeline";
import type { ScanConsoleModel } from "../hooks/use-scan-console";
import type { ServiceStatus } from "../../../runtime-contract";

export interface StrixConsolePanelProps {
	t: (key: string) => string;
	model: ScanConsoleModel;
	/** Managed-service status, so a stuck service explains itself instead of spinning. */
	status?: ServiceStatus;
}

function ReadinessChecklist({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement {
	const probe = model.environment;
	if (!probe) return <p className="astra-strix-empty">{t("boot.loading")}</p>;
	const rows = [
		{ ok: probe.python.found, key: "setup.python", detail: probe.python.executable },
		{ ok: probe.engine.installed, key: "setup.engine", detail: probe.engine.version },
		{ ok: probe.docker.ready, key: "setup.docker", detail: probe.docker.detail },
		{ ok: probe.llm.configured, key: "setup.llm", detail: probe.llm.model },
	];
	return (
		<div className="astra-strix-setup">
			<h3 className="astra-strix-section-title">{t("setup.title")}</h3>
			<ul className="astra-strix-setup-list">
				{rows.map((row) => (
					<li key={row.key} className="astra-strix-setup-row">
						<span className={row.ok ? "astra-strix-ok" : "astra-strix-missing"}>{row.ok ? "✓" : "•"}</span>
						<span className="astra-strix-setup-name">{t(row.key)}</span>
						{!row.ok && row.detail ? <code className="astra-strix-code">{row.detail}</code> : null}
					</li>
				))}
			</ul>
			{!probe.python.found ? <p className="astra-strix-hint">{t("setup.pythonHint")}</p> : null}
			{!probe.engine.installed ? (
				<p className="astra-strix-hint">
					<code className="astra-strix-code">uv tool install strix-agent</code>
				</p>
			) : null}
			{!probe.llm.configured ? <p className="astra-strix-hint">{t("setup.llmHint")}</p> : null}
			{!probe.docker.ready ? <p className="astra-strix-hint">{t("setup.dockerHint")}</p> : null}
		</div>
	);
}

export function StrixConsolePanel({ t, model, status }: StrixConsolePanelProps): React.ReactElement {
	const ready = model.phase === "ready";
	const run = model.activeRun;
	const stuck = model.phase === "error";

	return (
		<div className="astra-strix-panel">
			<header className="astra-strix-header">
				<h2 className="astra-strix-title">{t("panel.title")}</h2>
				{model.scanning ? <span className="astra-strix-live">{t("panel.live")}</span> : null}
				{status && status.phase !== "ready" ? (
					<span className="astra-strix-live">
						{t("panel.service")}: {status.phase}
					</span>
				) : null}
			</header>

			{model.error ? <p className="astra-strix-error">{model.error}</p> : null}
			{stuck ? (
				<button type="button" className="astra-strix-button" onClick={() => void model.boot()}>
					{t("boot.retry")}
				</button>
			) : null}
			{model.phase === "booting" ? <p className="astra-strix-empty">{t("boot.loading")}</p> : null}

			{!ready && model.phase !== "booting" ? <ReadinessChecklist t={t} model={model} /> : null}

			{model.runs.length > 1 ? (
				<nav className="astra-strix-runs" aria-label={t("runs.label")}>
					{model.runs.map((item) => (
						<button
							key={item.runName}
							type="button"
							className={
								item.runName === run?.runName
									? "astra-strix-run astra-strix-run-active"
									: "astra-strix-run"
							}
							onClick={() => model.selectRun(item.runName)}
						>
							{item.runName}
							<span className="astra-strix-run-count">{item.findingCount}</span>
						</button>
					))}
				</nav>
			) : null}

			<LaunchForm
				t={t}
				scanning={model.scanning}
				disabled={!ready}
				onStart={model.start}
				onCancel={model.cancel}
			/>

			{run ? (
				<section className="astra-strix-section">
					<h3 className="astra-strix-section-title">{t("run.status")}</h3>
					<p className="astra-strix-run-status">
						{run.status}
						{run.scanMode ? ` · ${run.scanMode}` : ""}
						{run.endTime ? ` · ${run.endTime}` : ""}
					</p>
				</section>
			) : null}

			<section className="astra-strix-section">
				<h3 className="astra-strix-section-title">{t("timeline.title")}</h3>
				<ScanTimeline t={t} records={model.timeline} />
			</section>

			<section className="astra-strix-section">
				<h3 className="astra-strix-section-title">{t("findings.title")}</h3>
				<FindingList t={t} findings={model.findings} runStatus={run?.status} />
			</section>
		</div>
	);
}
