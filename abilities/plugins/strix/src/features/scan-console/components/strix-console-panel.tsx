/**
 * The activity-tab surface: Strix's own screen, framed for the host agent's work.
 *
 * Shape is upstream's (strix/interface/tui/internal/app/view.go:mainView): a
 * bordered trace with the composer under it, and a sidebar of rounded panels -
 * session, targets, findings. What differs is what fills it: the commands the
 * *host* agent ran through Strix's sandbox, and the findings it filed.
 *
 * The panel starts nothing. Its composer hands an assessment to the agent, which
 * is the one component here that owns a model.
 */

import { FindingList } from "../../findings/components/finding-list";
import { PanelBox } from "../../../shared/components/panel-box";
import { TaskComposer } from "./task-composer";
import { TraceBlock } from "./trace-block";
import type { ScanConsoleModel } from "../hooks/use-scan-console";
import type { ServiceStatus } from "../../../runtime-contract";

export interface StrixConsolePanelProps {
	t: (key: string) => string;
	model: ScanConsoleModel;
	/** Managed-service status, so a stuck service explains itself instead of spinning. */
	status?: ServiceStatus;
	send: (prompt: string) => Promise<unknown>;
	/** Host-resolved brand icon; the header uses the same mark as the capability card. */
	iconUrl?: string;
}

function SessionPanel({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement {
	const { sandbox, environment, busy } = model;
	const rows: { label: string; value: string; tone?: string }[] = [];
	if (sandbox.sessionId) rows.push({ label: t("session.id"), value: sandbox.sessionId });
	if (sandbox.uptimeSec) rows.push({ label: t("session.uptime"), value: `${sandbox.uptimeSec}s` });
	if (sandbox.image) rows.push({ label: t("session.image"), value: sandbox.image });
	if (environment?.docker.imagePresent === false) {
		rows.push({ label: t("session.imageState"), value: t("session.imageMissing"), tone: "astra-strix-amber" });
	}
	if (environment?.engine.version) rows.push({ label: t("session.engine"), value: environment.engine.version });

	return (
		<div className="astra-strix-session">
			<div className="astra-strix-session-head">
				<span className="astra-strix-dot" data-on={sandbox.running ? "yes" : "no"} />
				<span className={sandbox.running ? "astra-strix-green" : "astra-strix-dim"}>
					{sandbox.running ? t("session.running") : t("session.idle")}
				</span>
				{busy ? <span className="astra-strix-pulse" aria-hidden="true" /> : null}
			</div>
			{rows.length ? (
				<dl className="astra-strix-kv">
					{rows.map((row) => (
						<div key={row.label} className="astra-strix-kv-row">
							<dt>{row.label}</dt>
							<dd className={row.tone}>{row.value}</dd>
						</div>
					))}
				</dl>
			) : (
				<p className="astra-strix-dim">{t("session.noneYet")}</p>
			)}
		</div>
	);
}

function TargetsPanel({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement {
	const targets = model.sandbox.targets ?? [];
	if (!targets.length) return <p className="astra-strix-dim">{t("targets.empty")}</p>;
	return (
		<ul className="astra-strix-targets">
			{targets.map((target) => (
				<li key={target} className="astra-strix-target">
					<span className="astra-strix-target-mark">▸</span>
					<span className="astra-strix-target-name" title={target}>
						{target}
					</span>
				</li>
			))}
		</ul>
	);
}

function Blockers({ t, model }: { t: (key: string) => string; model: ScanConsoleModel }): React.ReactElement | null {
	const probe = model.environment;
	if (!probe) return null;
	const rows = [
		!probe.python.found ? { key: "setup.python", hint: "setup.pythonHint" } : undefined,
		!probe.engine.installed ? { key: "setup.engine", hint: "setup.engineHint" } : undefined,
		!probe.docker.ready ? { key: "setup.docker", hint: "setup.dockerHint" } : undefined,
	].filter((row): row is { key: string; hint: string } => Boolean(row));
	if (!rows.length) return null;

	return (
		<div className="astra-strix-blockers" role="status">
			{rows.map((row) => (
				<p key={row.key} className="astra-strix-setup-row">
					<span className="astra-strix-blocker-mark">✗</span>
					<span>{t(row.key)}</span>
					<span className="astra-strix-dim">{t(row.hint)}</span>
				</p>
			))}
		</div>
	);
}

export function StrixConsolePanel({ t, model, status, send, iconUrl }: StrixConsolePanelProps): React.ReactElement {
	const ready = model.phase === "ready";
	const serverUp = status ? status.phase === "starting" || status.phase === "ready" : true;
	const critical = model.findings.filter((item) => item.severity === "critical").length;

	return (
		<div className="astra-strix-panel">
			<header className="astra-strix-titlebar">
				<span className="astra-strix-brand">
					{iconUrl ? <img className="astra-strix-logo" src={iconUrl} alt="" /> : <span className="astra-strix-logo-fallback">S</span>}
					<span className="astra-strix-brand-text">
						<strong>Strix</strong>
						<span className="astra-strix-dim">{t("panel.subtitle")}</span>
					</span>
				</span>

				<span className="astra-strix-chips">
					{model.sandbox.running ? (
						<span className="astra-strix-chip astra-strix-green">
							<span className="astra-strix-dot" data-on="yes" /> {t("session.running")}
						</span>
					) : null}
					{model.busy ? <span className="astra-strix-chip astra-strix-amber">{t("panel.working")}</span> : null}
					{critical ? (
						<span className="astra-strix-chip astra-strix-red">
							{t("severity.critical")} {critical}
						</span>
					) : null}
					<span className="astra-strix-chip astra-strix-dim">{t("panel.agentModel")}</span>
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
				</span>
			</header>

			{model.error ? <p className="astra-strix-error">{model.error}</p> : null}

			<div className="astra-strix-body">
				<section className="astra-strix-trace-pane">
					<div className="astra-strix-trace">
						{model.phase === "booting" ? (
							<p className="astra-strix-empty-state">
								<span className="astra-strix-spinner" aria-hidden="true" />
								{t("boot.loading")}
							</p>
						) : model.trace.length ? (
							model.trace.map((entry) => <TraceBlock key={entry.id} entry={entry} />)
						) : (
							<div className="astra-strix-empty-state">
								<span className="astra-strix-empty-icon">▚</span>
								<p>{t("timeline.empty")}</p>
							</div>
						)}
					</div>
					<div className="astra-strix-composer">
						<Blockers t={t} model={model} />
						<TaskComposer t={t} send={send} disabled={!ready} />
					</div>
				</section>

				<aside className="astra-strix-sidebar">
					<PanelBox
						title={t("session.title")}
						hint={model.sandbox.running ? t("session.running") : undefined}
						focused={model.sandbox.running}
					>
						<SessionPanel t={t} model={model} />
					</PanelBox>
					<PanelBox title={t("targets.title")} hint={String(model.sandbox.targets?.length ?? 0)}>
						<TargetsPanel t={t} model={model} />
					</PanelBox>
					<PanelBox title={t("findings.title")} hint={String(model.findings.length)}>
						<FindingList t={t} findings={model.findings} runStatus={model.sandbox.running ? "running" : "completed"} />
					</PanelBox>
				</aside>
			</div>
		</div>
	);
}
