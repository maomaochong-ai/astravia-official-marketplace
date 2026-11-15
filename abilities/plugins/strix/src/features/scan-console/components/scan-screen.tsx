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

import { useCallback, useEffect, useState } from "react";
import { useComposerHeight } from "../hooks/use-composer-height";
import { useStickToBottom } from "../hooks/use-stick-to-bottom";
import { HackerRain } from "./hacker-rain";
import { manifestLabel } from "../../../domain/manifest-label";
import type { ModelChoice } from "../../../domain/model-label";
import type {
	BridgeBudget,
	BridgeHistoryEntry,
	BridgeTeam,
	BridgeTelemetry,
	CoverageOutcome,
	ShellSessionSummary,
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
import type { McpConnection } from "../../../domain/mcp-roster";
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
	/** Kept shell sessions. */
	sessions?: readonly ShellSessionSummary[];
	mcp: readonly McpConnection[];
	/** Folder name of the conversation workspace. */
	workspace?: string;
	/** The host conversation is generating a turn right now — drives running/idle only. */
	hostStreaming: boolean;
	busy: boolean;
	onSend: (value: string) => void;
	/** 回到首屏看配置（不被自动跟屏锁死）。 */
	onOpenLaunch?: () => void;
	/** 在当前项目下新开会话。 */
	onNewSession?: () => void;
	/**
 * 停止可用：这一轮是本面板发起的。
	 *
	 * 缺省就是不可停（fail-closed）：宁可这颗键是灰的，也不允许它去打穿别的会话。
	 */
	canStop?: boolean;
	/** 停止：只停面板发起的那一轮（见 use-strix-session 的守卫）。 */
	onStop: () => void;
	/** Fetches a note's body on demand (`strix_note_get`) — the panel is the only place it can be read. */
	onOpenNote?: (id: string) => Promise<string>;
	/** Counts by outcome from the service, so the coverage title is the ledger's own numbers. */
	coverageTally?: Record<string, number>;
	/** 会话与状态四个面，全部由服务计算。 */
	budget?: BridgeBudget;
	telemetry?: BridgeTelemetry | null;
	history?: readonly BridgeHistoryEntry[];
	team?: BridgeTeam | null;
}


/**
 * 侧栏分区的标题（1.0.12）。
 *
 * 七个分区在 19rem 宽的栏里排成一列，滚动条比内容还长。标题同时是折叠开关：
 * 字形说明"这块是什么"，计数说明"有没有东西"，点一下收起——收起时只剩这三样。
 */
function SectionTitle({
	glyph,
	label,
	count,
	collapsed,
	onToggle,
	children,
}: {
	glyph: string;
	label: string;
	count?: React.ReactNode;
	collapsed: boolean;
	onToggle: () => void;
	children?: React.ReactNode;
}): React.ReactElement {
	return (
		<h3 className="astra-strix-section-title">
			<button
				type="button"
				className="astra-strix-section-head"
				aria-expanded={collapsed ? "false" : "true"}
				onClick={onToggle}
			>
				<span className="astra-strix-section-ico" aria-hidden="true">
					{glyph}
				</span>
				{label}
				{children}
			</button>
			{count === undefined ? null : count}
		</h3>
	);
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
	canStop,
	sandbox,
	environment,
	findings,
	todos,
	notes,
	coverage,
	sessions,
	mcp,
	trace,
	busy,
	onSend,
	onOpenLaunch,
	onNewSession,
	coverageTally,
	budget,
	telemetry,
	history = [],
	team,
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
	/** 默认展开"这一眼要看的"；连接与历史收起，需要时点开。 */
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
		session: false,
		targets: false,
		findings: false,
		stats: false,
		team: false,
		mcp: true,
		history: true,
	});
	const toggleSection = useCallback(
		(key: string) => setCollapsed((previous) => ({ ...previous, [key]: !previous[key] })),
		[],
	);
	const stick = useStickToBottom(`${trace.length}:${trace[trace.length - 1]?.ok ?? ""}`, trace.length);

	/** Enter 与发送键走同一条路：清空草稿、把话交给宿主。 */
	const send = (): void => {
		// 流式中发送也是合法的（宿主排队）；发送键与 Enter 共用这一条。
		if (!draft.trim()) return;
		setDraft("");
		onSend(draft);
	};
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
		<div className="astra-strix-term astra-strix-phosphor astra-strix-workbench">
			{/* 工作台也铺数据流（用户要求）：更密、更淡，永远压在所有内容之下。 */}
			<HackerRain density="workbench" />
			<header className="astra-strix-band">
				<span className="astra-strix-band-state" data-state={running ? "running" : "idle"}>
					{/* 上游状态行的扫光：6 个方块，一个绿色波来回扫；idle 时静止在暗档。 */}
					<span className="astra-strix-sweep" data-active={running ? "yes" : "no"} aria-hidden="true">
						{Array.from({ length: 6 }, (_, index) => (
							<span key={index} style={{ animationDelay: `${index * 90}ms` }} />
						))}
					</span>
					<span className={running ? "astra-strix-green" : "astra-strix-dim"}>
						{running ? t("scan.running") : t("scan.idle")}
					</span>
				</span>
				{/* 状态带只留**这一眼里就要的**：跑了没、多少目标、什么深度、跑在哪。
				    模型 / 步数 / 发现数在右栏的「统计」里已经有一份，同一件事写两遍是噪声（1.0.7）。 */}
				<Fact label={t("targets.title")} value={String(targets.length)} />
				<Fact label={t("scan.mode")} value={describeMode(mode)} />
				<Fact
					label={t("scan.environment")}
					value={environmentLabel}
					tone={envMode === "docker" ? undefined : "astra-strix-amber"}
				/>
				{critical ? <Fact label={t("severity.critical")} value={String(critical)} tone="astra-strix-red" /> : null}
				<span className="astra-strix-band-gap" />
				{onOpenLaunch ? (
					<button type="button" className="astra-strix-band-button" onClick={onOpenLaunch}>
						{t("nav.launch")}
					</button>
				) : null}
				{onNewSession ? (
					<button type="button" className="astra-strix-band-button" onClick={onNewSession}>
						{t("nav.newSession")}
					</button>
				) : null}
				{hostStreaming ? <span className="astra-strix-blue astra-strix-band-note">{t("scan.hostTurn")}</span> : null}
				<button type="button" className="astra-strix-band-stop" onClick={onStop} disabled={!canStop}>
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
								rows={1}
								spellCheck={false}
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
										event.preventDefault();
										send();
									}
								}}
							/>
						</div>
						{/* 框内底条：与首屏同形——左键位、右发送。说明文字从框下小字收进这条里。 */}
						<div className="astra-strix-composer-bar">
							<span className="astra-strix-dim">{t("launch.hint.send")}</span>
							<button type="button" className="astra-strix-send" onClick={send} disabled={!draft.trim()}>
								{t("composer.send")}
							</button>
						</div>
						{/* 框下不再重复一行说明：键位提示已经在框内的底条里（1.0.8）。 */}
					</div>
				</section>

				<aside className="astra-strix-rail" aria-label={t("rail.title")}>
					<section className="astra-strix-section" data-tone="targets" data-collapsed={collapsed.targets ? "yes" : "no"}>
						<SectionTitle
							glyph="◎"
							label={t("targets.title")}
							collapsed={Boolean(collapsed.targets)}
							onToggle={() => toggleSection("targets")}
							count={
								<span className="astra-strix-count" data-empty={targets.length ? "no" : "yes"}>
									{targets.length}
								</span>
							}
						/>
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


					<section className="astra-strix-section" data-tone="findings" data-collapsed={collapsed.findings ? "yes" : "no"}>
						<SectionTitle
							glyph="◈"
							label={t("findings.title")}
							collapsed={Boolean(collapsed.findings)}
							onToggle={() => toggleSection("findings")}
							count={
								<span className="astra-strix-count" data-empty={findings.length ? "no" : "yes"}>
									{findings.length}
								</span>
							}
						/>
						<FindingList t={t} findings={findings} runStatus={running ? "running" : "completed"} />
					</section>

					{/* 计划 / 覆盖 / 笔记（原型第三节）：这三件是同一类东西——"这一轮打算做什么、
					    做过哪些面、留了什么话"，所以共用一颗分区头。以前它们直接摊在栏里，
					    标题的左沿和字号跟其他分区不在一条线上，看起来像没对齐的列表（1.0.13）。 */}
					<section className="astra-strix-section" data-tone="plan" data-collapsed={collapsed.plan ? "yes" : "no"}>
						<SectionTitle
							glyph="☰"
							label={t("rail.plan")}
							collapsed={Boolean(collapsed.plan)}
							onToggle={() => toggleSection("plan")}
							count={
								<span className="astra-strix-count" data-empty={todos.length + coverage.length + notes.length ? "no" : "yes"}>
									{todos.length + coverage.length + notes.length}
								</span>
							}
						/>
						<ArtefactPanels
							t={t}
							todos={todos}
							notes={notes}
							coverage={coverage}
							{...(sessions ? { sessions } : {})}
							{...coverageTally ? { coverageTally } : {}}
							{...onOpenNote ? { onOpenNote } : {}}
						/>
					</section>

					{/* Upstream docks the run's MCP connections as its own panel: a dead server looks
					    exactly like the model forgetting its tools. */}

					<section className="astra-strix-section" data-tone="mcp" data-collapsed={collapsed.mcp ? "yes" : "no"}>
						<SectionTitle
							glyph="⇄"
							label={t("mcp.title")}
							collapsed={Boolean(collapsed.mcp)}
							onToggle={() => toggleSection("mcp")}
							count={
								<span className="astra-strix-count" data-empty={mcp.length ? "no" : "yes"}>
									{mcp.length}
								</span>
							}
						/>
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

					<section className="astra-strix-section" data-tone="stats" data-collapsed={collapsed.stats ? "yes" : "no"}>
						<SectionTitle
							glyph="▦"
							label={t("stats.title")}
							collapsed={Boolean(collapsed.stats)}
							onToggle={() => toggleSection("stats")}
						/>
						<dl className="astra-strix-kv">
							{/* 会话事实并入统计：没有沙箱时那两行不画，宁缺勿空。 */}
							<div>
								<dt>{t("session.where")}</dt>
								<dd className={envMode === "docker" ? undefined : "astra-strix-amber"}>{environmentLabel}</dd>
							</div>
							{sandbox.sessionId ? (
								<div>
									<dt>{t("session.id")}</dt>
									<dd title={sandbox.sessionId}>{sandbox.sessionId}</dd>
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
							{/* 额度：读服务算出来的用量，面板不自己数。 */}
							{budget ? (
								<div data-exhausted={budget.exhausted.length ? "yes" : "no"}>
									<dt>{t("panel.budget")}</dt>
									<dd>
										{budget.limits.maxToolCalls > 0
											? t("budget.toolCalls", { used: budget.used.toolCalls, limit: budget.limits.maxToolCalls })
											: t("budget.toolCalls", { used: budget.used.toolCalls, limit: t("budget.unlimited") })}
									</dd>
								</div>
							) : null}
							{telemetry ? (
								<div>
									<dt>{t("panel.telemetry")}</dt>
									<dd title={t("telemetry.local")}>{telemetry.assessments}</dd>
								</div>
							) : null}
						</dl>
						{/* 额度用满时说一句，不靠“工具为什么被拒”去猜。 */}
						{budget?.reason ? <p className="astra-strix-section-empty astra-strix-amber">{t("budget.exhausted", { reason: budget.reason })}</p> : null}
					</section>

					{/* 团队成员：名单来自 plugin.json，署名数来自发现台账。 */}
					{team && team.members.length ? (

						<section className="astra-strix-section" data-tone="team" data-collapsed={collapsed.team ? "yes" : "no"}>
							<SectionTitle
								glyph="⚉"
								label={t("panel.team")}
								collapsed={Boolean(collapsed.team)}
								onToggle={() => toggleSection("team")}
								count={
									<span className="astra-strix-count" data-empty={team.totalFiled ? "no" : "yes"}>
										{team.members.length}
									</span>
								}
							/>
							<ul className="astra-strix-team">
								{team.members.map((member) => (
									<li key={member.id} data-lead={member.lead ? "yes" : "no"}>
										<span className="astra-strix-team-name" title={manifestLabel(t, member.responsibility)}>
											{manifestLabel(t, member.name)}
										</span>
										{member.lead ? <span className="astra-strix-chip-live">{t("team.lead")}</span> : null}
										<span className="astra-strix-dim astra-strix-team-filed">
											{team.filed[member.id]
												? t("team.filed", { count: team.filed[member.id] })
												: t("team.filedNone")}
										</span>
									</li>
								))}
							</ul>
						</section>
					) : null}

					{/* 历史评估（上游 viewer 的等价物）：只读清单，点不进旧会话——那是宿主的事。 */}

					<section className="astra-strix-section" data-tone="history" data-collapsed={collapsed.history ? "yes" : "no"}>
						<SectionTitle
							glyph="◷"
							label={t("panel.history")}
							collapsed={Boolean(collapsed.history)}
							onToggle={() => toggleSection("history")}
							count={
								<span className="astra-strix-count" data-empty={history.length ? "no" : "yes"}>
									{history.length}
								</span>
							}
						/>
						{history.length ? (
							<ul className="astra-strix-history">
								{history.map((entry) => (
									<li key={entry.key} data-report={entry.report ? "yes" : "no"}>
										<span className="astra-strix-dim">{entry.at.slice(0, 10)}</span>
										<span className="astra-strix-history-targets" title={entry.targets.join(", ")}>
											{entry.targets.length ? entry.targets.join(", ") : entry.key}
										</span>
										<span className="astra-strix-dim">
											{t("history.entry", { findings: entry.findings })} · {entry.report ? t("history.report") : t("history.noReport")}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="astra-strix-section-empty">{t("history.empty")}</p>
						)}
					</section>

				</aside>
			</div>
		</div>
	);
}
