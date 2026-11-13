/**
 * The scan workspace: one status band, one transcript, one artefact rail.
 *
 * See `docs/adr/strix/strix-0004-panel-is-a-workbench.md`. The previous layout copied
 * the terminal frame literally — an unbounded black pane with six bordered boxes of
 * zeroes beside it — which in a tab reads as "nothing happened, and here are six
 * reasons". This one keeps the things that carry meaning (monospace tool output, the
 * green/red/amber tool semantics) and drops the things that only made sense in a
 * terminal: the full-bleed black, the box borders, the counts as a row of zeroes.
 */

import { useState } from "react";
import type { ModelChoice } from "../../../domain/model-label";
import type { AgentStatus } from "../../../agent/strix-agent";
import type {
	CoverageOutcome,
	EnvironmentProbe,
	NoteSummary,
	SandboxStatus,
	StrixFinding,
	TodoItem,
	TraceEntry,
} from "../../../runtime-contract";
import { FindingList } from "../../findings/components/finding-list";
import { describeMode, type ScanMode } from "../../../domain/scan-mode";
import type { SessionPhase } from "../hooks/use-strix-session";
import { ArtefactPanels } from "./artefact-panels";
import { TraceBlock } from "./trace-block";

export interface ScanScreenProps {
	t: (key: string) => string;
	phase: SessionPhase;
	model?: ModelChoice;
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: readonly StrixFinding[];
	trace: readonly TraceEntry[];
	todos: readonly TodoItem[];
	notes: readonly NoteSummary[];
	coverage: readonly CoverageOutcome[];
	agents: readonly AgentStatus[];
	/** Folder name of the conversation workspace that is mounted. */
	workspace?: string;
	/** The host conversation is generating a turn right now. */
	hostStreaming: boolean;
	busy: boolean;
	question?: { text: string; options?: string[] };
	onSend: (value: string) => void;
	onStop: () => void;
}

/** One label/value pair in the status band; omitted entirely when there is no value. */
function Fact({ label, value, tone }: { label: string; value: string; tone?: string }): React.ReactElement {
	return (
		<span className="astra-strix-fact">
			<span className="astra-strix-fact-label">{label}</span>
			<span className={`astra-strix-fact-value ${tone ?? ""}`.trim()} title={value}>
				{value}
			</span>
		</span>
	);
}

export function ScanScreen({
	t,
	phase,
	model,
	workspace,
	hostStreaming,
	sandbox,
	environment,
	findings,
	todos,
	notes,
	coverage,
	agents,
	trace,
	busy,
	question,
	onSend,
	onStop,
}: ScanScreenProps): React.ReactElement {
	const targets = sandbox.targets ?? [];
	const scanning = phase === "scanning";
	const critical = findings.filter((item) => item.severity === "critical").length;
	const steps = trace.filter((entry) => entry.kind === "tool").length;
	const [draft, setDraft] = useState("");

	const mode: ScanMode = (sandbox.scanMode as ScanMode | undefined) ?? "standard";
	const environmentLabel =
		sandbox.mode === "host" ? t("env.host") : sandbox.mode === "docker" ? t("env.docker") : t("env.unknown");

	// The one thing a new assessment should say: what to do, not what is missing.
	const emptyHint = targets.length ? t("scan.emptyWithTargets") : t("scan.emptyNoTargets");

	return (
		<div className="astra-strix-term astra-strix-workbench">
			<header className="astra-strix-band">
				<span className="astra-strix-band-state" data-state={scanning ? "running" : "idle"}>
					{busy ? <span className="astra-strix-spinner" aria-hidden="true" /> : null}
					<span className={scanning ? "astra-strix-green" : "astra-strix-dim"}>
						{scanning ? t("scan.running") : t("scan.done")}
					</span>
				</span>
				<Fact label={t("targets.title")} value={String(targets.length)} />
				<Fact label={t("scan.mode")} value={describeMode(mode)} />
				<Fact
					label={t("scan.environment")}
					value={environmentLabel}
					tone={sandbox.mode === "host" ? "astra-strix-amber" : undefined}
				/>
				{workspace ? <Fact label={t("session.workspace")} value={workspace} /> : null}
				{model ? <Fact label={t("scan.model")} value={model.name} /> : null}
				{steps ? <Fact label={t("scan.steps")} value={String(steps)} /> : null}
				{critical ? <Fact label={t("severity.critical")} value={String(critical)} tone="astra-strix-red" /> : null}
				<span className="astra-strix-band-gap" />
				{hostStreaming ? <span className="astra-strix-blue astra-strix-band-note">{t("scan.hostTurn")}</span> : null}
				<button type="button" className="astra-strix-band-stop" onClick={onStop} disabled={!scanning}>
					{t("scan.stop")}
				</button>
			</header>

			<div className="astra-strix-workbench-grid">
				<section className="astra-strix-transcript">
					<div className="astra-strix-transcript-body" role="log" aria-live="polite">
						{trace.length ? (
							trace.map((entry) => <TraceBlock key={entry.id} entry={entry} />)
						) : (
							<p className="astra-strix-empty">{emptyHint}</p>
						)}
					</div>

					{question ? (
						<div className="astra-strix-question" role="status">
							<p className="astra-strix-question-text">
								<span className="astra-strix-amber" aria-hidden="true">
									?
								</span>{" "}
								{question.text}
							</p>
							{question.options?.length ? (
								<p className="astra-strix-question-options">
									{question.options.map((option) => (
										<button key={option} type="button" className="astra-strix-chip" onClick={() => onSend(option)}>
											{option}
										</button>
									))}
								</p>
							) : null}
						</div>
					) : null}

					<div className="astra-strix-composer">
						<label className="astra-strix-prompt-row">
							<span className="astra-strix-prompt-caret" aria-hidden="true">
								&gt;
							</span>
							<textarea
								className="astra-strix-prompt-input"
								aria-label={t(question ? "scan.answer" : "scan.label")}
								placeholder={t(question ? "scan.answer" : "scan.placeholder")}
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

				<aside className="astra-strix-rail" aria-label={t("rail.title")}>
					<section className="astra-strix-section" data-tone="session">
						<h3 className="astra-strix-section-title">
							{t("session.title")}
							{sandbox.running ? <span className="astra-strix-chip-live">{t("session.running")}</span> : null}
						</h3>
						{sandbox.sessionId || sandbox.image || sandbox.uptimeSec ? (
							<dl className="astra-strix-kv">
								{sandbox.sessionId ? (
									<div>
										<dt>{t("session.id")}</dt>
										<dd>{sandbox.sessionId}</dd>
									</div>
								) : null}
								{sandbox.uptimeSec ? (
									<div>
										<dt>{t("session.uptime")}</dt>
										<dd>{sandbox.uptimeSec}s</dd>
									</div>
								) : null}
								{sandbox.image ? (
									<div>
										<dt>{t("session.image")}</dt>
										<dd title={sandbox.image}>{sandbox.image}</dd>
									</div>
								) : null}
								{environment?.docker.imagePresent === false ? (
									<div>
										<dt>{t("session.imageState")}</dt>
										<dd className="astra-strix-amber">{t("session.imageMissing")}</dd>
									</div>
								) : null}
							</dl>
						) : (
							<p className="astra-strix-section-empty">{t("session.noneYet")}</p>
						)}
					</section>

					<section className="astra-strix-section" data-tone="targets">
						<h3 className="astra-strix-section-title">
							{t("targets.title")}
							<span className="astra-strix-count" data-empty={targets.length ? "no" : "yes"}>
								{targets.length}
							</span>
						</h3>
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
							<p className="astra-strix-section-empty">{t("targets.empty")}</p>
						)}
					</section>

					<ArtefactPanels t={t} agents={agents} todos={todos} notes={notes} coverage={coverage} />

					<section className="astra-strix-section" data-tone="findings">
						<h3 className="astra-strix-section-title">
							{t("findings.title")}
							<span className="astra-strix-count" data-empty={findings.length ? "no" : "yes"}>
								{findings.length}
							</span>
						</h3>
						<FindingList t={t} findings={findings} runStatus={scanning ? "running" : "completed"} />
					</section>
				</aside>
			</div>
		</div>
	);
}
