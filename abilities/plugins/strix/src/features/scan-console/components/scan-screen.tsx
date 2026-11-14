/**
 * The scan workspace: one status band, one transcript, one artefact rail.
 *
 * See `docs/adr/strix/strix-0004-panel-is-a-workbench.md`. The layout keeps the things
 * that carry meaning (monospace tool output, the green/red/amber tool semantics) and drops
 * the things that only made sense in a terminal: the full-bleed black, the box borders,
 * the counts as a row of zeroes.
 *
 * Who runs this: the host conversation. The transcript is that turn rendered from both
 * witnesses — the conversation's events and the bridge's command feed — and "running" means
 * the host is generating right now, not that this component has a loop of its own.
 */

import { useEffect, useState } from "react";
import { useComposerHeight } from "../hooks/use-composer-height";
import { useStickToBottom } from "../hooks/use-stick-to-bottom";
import type { ModelChoice } from "../../../domain/model-label";
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
	t: (key: string, params?: Record<string, string | number>) => string;
	phase: SessionPhase;
	model?: ModelChoice;
	environment?: EnvironmentProbe;
	sandbox: SandboxStatus;
	findings: readonly StrixFinding[];
	trace: readonly TraceEntry[];
	todos: readonly TodoItem[];
	notes: readonly NoteSummary[];
	coverage: readonly CoverageOutcome[];
	mcp: readonly McpConnection[];
	/** Folder name of the conversation workspace. */
	workspace?: string;
	/** The host conversation is generating a turn right now — drives running/idle only. */
	hostStreaming: boolean;
	busy: boolean;
	onSend: (value: string) => void;
	onStop: () => void;
	/** Fetches a note's body on demand (`strix_note_get`) — the panel is the only place it can be read. */
	onOpenNote?: (id: string) => Promise<string>;
	/** Counts by outcome from the service, so the coverage title is the ledger's own numbers. */
	coverageTally?: Record<string, number>;
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
	mcp,
	trace,
	busy,
	onSend,
	coverageTally,
	onOpenNote,
	onStop,
}: ScanScreenProps): React.ReactElement {
	const targets = sandbox.targets ?? [];
	// A live run is the host generating; an open assessment whose turn already ended is
	// idle, not "running" and not "done" — the distinction the band used to blur.
	const running = phase === "scanning" && hostStreaming;
	const critical = findings.filter((item) => item.severity === "critical").length;
	const steps = trace.filter((entry) => entry.kind === "tool").length;
	const [draft, setDraft] = useState("");
	// 高度与拖拽方向：两个屏共用一份状态（composer-height.ts），否则一边对一边错。
	const composer = useComposerHeight();
	// 运行记录永远停在最新一行；读者自己往上滚时不抢回（use-stick-to-bottom.ts）。
	const stick = useStickToBottom(`${trace.length}:${trace[trace.length - 1]?.ok ?? ""}`, trace.length);

	const mode: ScanMode = (sandbox.scanMode as ScanMode | undefined) ?? "standard";
	const envMode = sandbox.mode ?? environment?.mode;
	const environmentLabel = envMode === "docker" ? t("env.docker") : t("env.host");
	// Seconds since the turn started, ticking only while the host is generating.
	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		if (!running) return;
		const started = Date.now();
		const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1_000);
		return () => clearInterval(timer);
	}, [running]);

	// The one thing a new assessment should say: what to do, not what is missing.
	const emptyHint = targets.length ? t("scan.emptyWithTargets") : t("scan.emptyNoTargets");

	return (
		<div className="astra-strix-term astra-strix-workbench">
			<header className="astra-strix-band">
				<span className="astra-strix-band-state" data-state={running ? "running" : "idle"}>
					{busy ? <span className="astra-strix-spinner" aria-hidden="true" /> : null}
					<span className={running ? "astra-strix-green" : "astra-strix-dim"}>
						{running ? t("scan.running") : t("scan.idle")}
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
				<button type="button" className="astra-strix-band-stop" onClick={onStop} disabled={!hostStreaming}>
					{t("scan.stop")}
				</button>
			</header>

			<div className="astra-strix-workbench-grid">
				<section className="astra-strix-transcript">
					{/* 标题说清这一栏是什么：运行记录，不是第二份对话。 */}
					<h2 className="astra-strix-transcript-title">{t("scan.traceTitle")}</h2>
					<div
						className="astra-strix-transcript-body"
						role="log"
						aria-live="polite"
						data-running={running ? "yes" : "no"}
						ref={stick.ref}
						onScroll={stick.onScroll}
						{...stick.wheelProps}
						{...stick.touchProps}
						{...stick.keyProps}
						tabIndex={-1}
					>
						{trace.length ? (
							trace.map((entry) => <TraceBlock key={entry.id} entry={entry} />)
						) : (
							<p className="astra-strix-empty">{emptyHint}</p>
						)}
						{/* 读者自己往上滚了：不抢回来，只告诉他有多少新行。 */}
						{stick.pending > 0 ? (
							<button type="button" className="astra-strix-new-rows" onClick={stick.jumpToBottom}>
								{t("scan.newRows", { count: stick.pending })} ↓
							</button>
						) : null}
						{/* A live caret: without it a quiet stretch reads as "the run died". The timer
						    says the same thing in words for anyone who misses the blink. */}
						{running ? (
							<p className="astra-strix-running" role="status">
								<span className="astra-strix-caret" aria-hidden="true" />
								<span className="astra-strix-dim">
									{t("scan.live")} · {elapsed}s
								</span>
							</p>
						) : null}
					</div>

					{/* 拖拽手柄在盒子顶边：向上拖 = 变高（方向定义在 composer-height.ts，
					    不在 CSS 里猜）。用 separator 而不是 button，因为它是尺寸控件。 */}
					<div
						className="astra-strix-composer"
						data-busy={busy ? "yes" : "no"}
						{...(composer.height ? { style: { "--sx-composer-h": `${composer.height}px` } as React.CSSProperties } : {})}
					>
						<div
							className="astra-strix-resize-handle"
							role="separator"
							aria-orientation="horizontal"
							aria-label={t("composer.resize")}
							tabIndex={0}
							{...composer.handleProps}
						/>
						<div className="astra-strix-prompt-row">
							<span className="astra-strix-prompt-caret" aria-hidden="true">
								&gt;
							</span>
							<textarea
								className="astra-strix-prompt-input"
								aria-label={t("scan.label")}
								placeholder={t("scan.placeholder")}
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

					<ArtefactPanels
						t={t}
						todos={todos}
						notes={notes}
						coverage={coverage}
						{...coverageTally ? { coverageTally } : {}}
						{...onOpenNote ? { onOpenNote } : {}}
					/>

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
						<FindingList t={t} findings={findings} runStatus={running ? "running" : "completed"} />
					</section>
				</aside>
			</div>
		</div>
	);
}
