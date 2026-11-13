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

import { useEffect, useState } from "react";
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
import type { McpConnection } from "../../../service/mcp-roster";
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
	mcp: readonly McpConnection[];
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
	mcp,
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
	// `sandbox.mode` is only set once a session exists; before that the probe knows. Falling
	// back keeps the band from reading "未确定" while the environment is in fact known.
	const envMode = sandbox.mode ?? environment?.mode;
	const environmentLabel =
		envMode === "docker" ? t("env.docker") : t("env.host");
	// Seconds since the session started, ticking only while a run is live.
	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		if (!scanning) return;
		const started = Date.now();
		const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1_000);
		return () => clearInterval(timer);
	}, [scanning]);


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
					tone={envMode === "docker" ? undefined : "astra-strix-amber"}
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
					<div className="astra-strix-transcript-body" role="log" aria-live="polite" data-running={scanning ? "yes" : "no"}>
						{trace.length ? (
							trace.map((entry) => <TraceBlock key={entry.id} entry={entry} />)
						) : (
							<p className="astra-strix-empty">{emptyHint}</p>
						)}
						{/* A live caret: without it a quiet stretch reads as "the run died". The timer
						    says the same thing in words for anyone who misses the blink. */}
						{scanning ? (
							<p className="astra-strix-running" role="status">
								<span className="astra-strix-caret" aria-hidden="true" />
								<span className="astra-strix-dim">
									{t("scan.live")} · {elapsed}s
								</span>
							</p>
						) : null}
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

					<div className="astra-strix-composer" data-busy={busy ? "yes" : "no"}>
						<div className="astra-strix-prompt-row">
							<span className="astra-strix-prompt-caret" aria-hidden="true">
								&gt;
							</span>
							<textarea
								className="astra-strix-prompt-input"
								aria-label={t(question ? "scan.answer" : "scan.label")}
								placeholder={t(question ? "scan.answer" : "scan.placeholder")}
								rows={2}
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
						</div>
						<p className="astra-strix-prompt-hint">{t("scan.inputHint")}</p>
					</div>
				</section>

				<aside className="astra-strix-rail" aria-label={t("rail.title")}>
					<section className="astra-strix-section" data-tone="session">
						<h3 className="astra-strix-section-title">
							{t("session.title")}
							{sandbox.running ? <span className="astra-strix-chip-live">{t("session.running")}</span> : null}
						</h3>
						{sandbox.sessionId || sandbox.uptimeSec || envMode ? (
							<dl className="astra-strix-kv">
								<div>
									<dt>{t("session.where")}</dt>
									<dd className={envMode === "docker" ? undefined : "astra-strix-amber"}>{environmentLabel}</dd>
								</div>
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
								{envMode === "docker" && sandbox.image ? (
									<div>
										<dt>{t("session.image")}</dt>
										<dd title={sandbox.image}>{sandbox.image}</dd>
									</div>
								) : null}
								{envMode === "docker" && environment?.docker.imagePresent === false ? (
									<div>
										<dt>{t("session.imageState")}</dt>
										<dd className="astra-strix-dim">{t("session.imageNotUsed")}</dd>
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

					{/* Upstream docks the run's MCP connections as its own panel: a dead server looks
					    exactly like the model forgetting its tools. */}
					<section className="astra-strix-section" data-tone="mcp">
						<h3 className="astra-strix-section-title">
							{t("mcp.title")}
							<span className="astra-strix-count" data-empty={mcp.length ? "no" : "yes"}>
								{mcp.length}
							</span>
						</h3>
						{mcp.length ? (
							<ul className="astra-strix-mcp">
								{mcp.map((server) => (
									<li key={server.name} data-dead={server.dead ? "yes" : "no"}>
										<span className={server.dead ? "astra-strix-red" : "astra-strix-green"} aria-hidden="true">
											{server.dead ? "×" : "●"}
										</span>
										<span className="astra-strix-mcp-name" title={server.name}>
											{server.name}
										</span>
										<span className="astra-strix-dim astra-strix-mcp-count">{server.toolCount}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="astra-strix-section-empty">{t("mcp.empty")}</p>
						)}
					</section>
					{/* Upstream's sidebar ends in a Stats panel; without it the panel has no single
					    place that answers "how is this run going". */}
					<section className="astra-strix-section" data-tone="stats">
						<h3 className="astra-strix-section-title">{t("stats.title")}</h3>
						<dl className="astra-strix-kv">
							<div>
								<dt>{t("scan.mode")}</dt>
								<dd>{mode}</dd>
							</div>
							<div>
								<dt>{t("targets.title")}</dt>
								<dd>{targets.length}</dd>
							</div>
							<div>
								<dt>{t("scan.steps")}</dt>
								<dd>{steps}</dd>
							</div>
							<div>
								<dt>{t("findings.title")}</dt>
								<dd>{findings.length}</dd>
							</div>
							<div>
								<dt>{t("coverage.title")}</dt>
								<dd>{coverage.length}</dd>
							</div>
							{model ? (
								<div>
									<dt>{t("scan.model")}</dt>
									<dd title={model.name}>{model.name}</dd>
								</div>
							) : null}
						</dl>
					</section>

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
