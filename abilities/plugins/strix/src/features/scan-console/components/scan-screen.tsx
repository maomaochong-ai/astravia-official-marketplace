/**
 * The scan screen: upstream's main view (view.go:mainView) with the host's work in it.
 *
 * Left column is the bordered trace with the status row and the composer under it;
 * the sidebar is the same set of rounded boxes upstream docks on the right. The one
 * structural difference is that the sidebar collapses by CSS at narrow widths
 * instead of by a terminal-width threshold - a tab can be dragged wide or narrow
 * while it is open.
 */

import { useState } from "react";
import type { ModelChoice } from "../../../domain/model-label";
import type { EnvironmentProbe, SandboxStatus, StrixFinding, TraceEntry } from "../../../runtime-contract";
import { PanelBox } from "../../../shared/components/panel-box";
import { FindingList } from "../../findings/components/finding-list";
import type { SessionPhase } from "../hooks/use-strix-session";
import { TraceBlock } from "./trace-block";

export interface ScanScreenProps {
	t: (key: string) => string;
	phase: SessionPhase;
	model?: ModelChoice;
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: readonly StrixFinding[];
	trace: readonly TraceEntry[];
	busy: boolean;
	onSend: (value: string) => void;
	onStop: () => void;
}

function SessionBox({ t, sandbox, environment }: Pick<ScanScreenProps, "t" | "sandbox" | "environment">): React.ReactElement {
	const rows: { label: string; value: string }[] = [];
	if (sandbox.sessionId) rows.push({ label: t("session.id"), value: sandbox.sessionId });
	if (sandbox.uptimeSec) rows.push({ label: t("session.uptime"), value: `${sandbox.uptimeSec}s` });
	if (sandbox.image) rows.push({ label: t("session.image"), value: sandbox.image });
	if (environment?.docker.imagePresent === false) {
		rows.push({ label: t("session.imageState"), value: t("session.imageMissing") });
	}
	if (!rows.length) return <p className="astra-strix-dim">{t("session.noneYet")}</p>;
	return (
		<dl className="astra-strix-kv">
			{rows.map((row) => (
				<div key={row.label}>
					<dt>{row.label}</dt>
					<dd>{row.value}</dd>
				</div>
			))}
		</dl>
	);
}

export function ScanScreen({
	t,
	phase,
	model,
	sandbox,
	environment,
	findings,
	trace,
	busy,
	onSend,
	onStop,
}: ScanScreenProps): React.ReactElement {
	const targets = sandbox.targets ?? [];
	const scanning = phase === "scanning";
	const critical = findings.filter((item) => item.severity === "critical").length;
	const [draft, setDraft] = useState("");

	return (
		<div className="astra-strix-term astra-strix-scan">
			<div className="astra-strix-scan-grid">
				<section className="astra-strix-chat" data-running={scanning ? "yes" : "no"}>
					<div className="astra-strix-chat-body" role="log" aria-live="polite">
						{trace.length ? (
							trace.map((entry) => <TraceBlock key={entry.id} entry={entry} />)
						) : (
							<p className="astra-strix-dim astra-strix-chat-empty">{t("scan.starting")}</p>
						)}
					</div>

					<div className="astra-strix-statusline">
						{busy ? <span className="astra-strix-spinner" aria-hidden="true" /> : null}
						<span className={scanning ? "astra-strix-green" : "astra-strix-dim"}>
							{scanning ? t("scan.running") : t("scan.done")}
						</span>
						<span className="astra-strix-dim"> · {t("scan.steps")} {trace.filter((entry) => entry.kind === "tool").length}</span>
						{critical ? <span className="astra-strix-red"> · {t("severity.critical")} {critical}</span> : null}
						{model ? <span className="astra-strix-dim"> · {model.name}</span> : null}
						<button type="button" className="astra-strix-statusline-stop" onClick={onStop} disabled={!scanning}>
							{t("scan.stop")}
						</button>
					</div>

					<div className="astra-strix-prompt">
						<label className="astra-strix-prompt-row">
							<span className="astra-strix-prompt-caret" aria-hidden="true">
								&gt;
							</span>
							<textarea
								className="astra-strix-prompt-input"
								aria-label={t("scan.label")}
								placeholder={t("scan.placeholder")}
								rows={1}
								spellCheck={false}
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
										event.preventDefault();
										if (!draft.trim()) return;
										setDraft("");
										onSend(draft);
									}
								}}
							/>
						</label>
					</div>
				</section>

				<aside className="astra-strix-side">
					<PanelBox title={t("session.title")} hint={sandbox.running ? t("session.running") : undefined} focused={sandbox.running}>
						<SessionBox t={t} sandbox={sandbox} environment={environment} />
					</PanelBox>
					<PanelBox title={t("targets.title")} hint={String(targets.length)}>
						{targets.length ? (
							<ul className="astra-strix-targets">
								{targets.map((target) => (
									<li key={target}>
										<span className="astra-strix-dim">▸ </span>
										<span title={target}>{target}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="astra-strix-dim">{t("targets.empty")}</p>
						)}
					</PanelBox>
					<PanelBox title={t("findings.title")} hint={String(findings.length)}>
						<FindingList t={t} findings={findings} runStatus={scanning ? "running" : "completed"} />
					</PanelBox>
				</aside>
			</div>
		</div>
	);
}
