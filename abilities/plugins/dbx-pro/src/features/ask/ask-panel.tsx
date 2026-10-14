/**
 * ask-panel.tsx — 问数面板（对齐阿里云 Quick BI Pro「智能问数」的工作流）。
 *
 * 对齐关系（Quick BI 智能问数 → 这里）：
 *   ① 数据集问数配置 → 顶部选数据集（连接 + 该连接的表清单，作为取数边界）
 *   ② 自然语言提问   → 输入框 + 推荐快捷提问（suggestQuestions）
 *   ③ 分析过程可解释 → 每轮可展开的「分析过程」：数据集 / 字段 / 意图 / 真实执行过的 SQL
 *   ④ SQL 自助可见   → 每条 SQL 都列出来并可复制（模型自助取数的那几条也留下）
 *   ⑤ 结果图表 + 换图 → 意图决定默认图型（ask-chart 的 intentToChartKind），面板可改
 *   ⑥ 数据解读       → findings / conclusion / suggestions 三段
 *   ⑦ 多轮追问       → transcript 跨轮保留，上一轮的维度与度量自然延续
 *   ⑧ 结果落库       → 「加入画布」把 SQL + 图型交回工作台，落成 数据源 → 图表 的节点图
 *
 * 三件不许含糊的事：
 *   1. 取数一定是真的。SQL 由插件自己在 dbx-engine 上执行（engineExecuteByName），
 *      结果直接来自数据库；画不出来就说画不出来，不补零、不造数（见 ask-chart.ts）。
 *   2. 失败要看得见。模型没按约定回答、SQL 被只读校验拒掉、最终 SQL 执行失败，
 *      都作为明确提示留在会话里，而不是静默给个空图。
 *   3. 落画布只交 SQL 与图型。面板不认识画布，返回一个 AskDraft，由工作台拼节点图。
 *
 * 与 ADR-0001 §4「不新增 Agent 工具」的关系：这里不注册任何 Agent 工具。
 * run_sql 是随 ctx.ai.chat 一起发给模型的工具声明，只在插件内部 loop 里被执行，
 * 不进宿主工具名册，宿主 Agent 也不会看到它。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { PluginAiChatMessage, PluginAiChatRequest, PluginAiChatResult } from "@astravia-org/plugin-sdk";

import { getAi, getUi } from "../../runtime-contract";
import { engineExecuteByName, engineHealth, engineListConnections } from "../../shared/services/engine-client";
import { useConnectionTables, clearConnectionTablesCache } from "../bi-editor/canvas/hooks/use-connection-tables";
import {
	AreaChart,
	BarChart,
	ChartFrame,
	Donut,
	EmptyChart,
	Funnel,
	HBars,
	LineChart,
	seriesColor,
} from "../bi-editor/shared/components/charts";
import { Btn } from "../bi-editor/shared/components/ui/btn";
import { Chip } from "../bi-editor/shared/components/ui/chip";
import { Icon } from "../bi-editor/shared/components/ui/icon";
import { IconButton } from "../bi-editor/shared/components/ui/icon-button";
import {
	ASK_CHART_KINDS,
	CHART_KIND_LABELS,
	formatCell,
	formatNumber,
	pickChartSeries,
	type AskSeries,
} from "./ask-chart.ts";
import { runAskTurn, type AskChatPort } from "./ask-loop.ts";
import { suggestQuestions } from "./ask-prompt.ts";
import type { AskAnswer, AskChartKind, AskDraft, AskResult, AskTurn } from "./ask-types.ts";

/** 单条 SQL 最多取回多少行：够画图与看明细，又不至于把面板拖死。 */
const ASK_ROW_LIMIT = 200;
/** 明细表最多渲染多少行（超出的滚动看，不截断数据本身）。 */
const TABLE_PREVIEW_ROWS = 50;

export interface AskConnectionOption {
	/** 引擎连接名（engineExecuteByName 的键）。 */
	name: string;
	/** 引擎连接 id：画布节点里存 id，落画布时用它。 */
	id?: string;
	type?: string;
	database?: string;
}

export interface AskPanelProps {
	/** 已确定的初始提问（工作台从输入里带过来时用）。 */
	initialQuestion?: string;
	/** 「加入画布」：由工作台创建页面并预置节点图。 */
	onInsert: (draft: AskDraft) => void;
	onClose?: () => void;
	/** 已缓存的连接清单（宿主/测试注入）；不传则面板自行拉取。 */
	connections?: AskConnectionOption[];
}

// ── 纯工具 ──

function notify(message: string, variant: "info" | "success" | "error" = "info"): void {
	try {
		getUi()?.notify?.({ message, variant });
	} catch {
		// 通知失败不能影响问数主流程
	}
}

function errorText(err: unknown): string {
	if (err instanceof Error && err.message) return err.message;
	return String(err);
}

/** 本地日期（YYYY-MM-DD）。不用 toISOString：那是 UTC，跨零点会把「今天」说错一天。 */
function todayText(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function titleFrom(question: string): string {
	const text = question.trim().replace(/\s+/g, " ");
	if (!text) return "问数结果";
	return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

/** 宿主 AI 端口：未授权 / 宿主过旧时给一句人话，而不是抛权限栈给用户看。 */
function resolveChatPort(): AskChatPort {
	const ai = getAi();
	if (!ai || typeof ai.chat !== "function") {
		throw new Error(
			"宿主未提供 AI 能力（ctx.ai）：插件需要声明 ai.complete 权限，且宿主版本需支持插件 AI。",
		);
	}
	return { chat: (request: PluginAiChatRequest): Promise<PluginAiChatResult> => ai.chat(request) };
}

/** 真实取数：走 plugin.json 里声明的 dbx-engine。只读，绝不传 allowWrite。 */
async function runSqlOnEngine(connectionName: string, sql: string): Promise<AskResult> {
	const outcome = await engineExecuteByName(connectionName, sql, { rowLimit: ASK_ROW_LIMIT });
	return {
		columns: Array.isArray(outcome.columns) ? outcome.columns : [],
		rows: Array.isArray(outcome.rows) ? outcome.rows : [],
	};
}

async function copyText(text: string, what: string): Promise<void> {
	try {
		await navigator.clipboard?.writeText(text);
		notify(`${what}已复制`, "success");
	} catch {
		notify("复制失败，请手动选中后复制", "error");
	}
}

// ── 图表渲染 ──

/**
 * KPI 不画仪表：仪表要有量程，而问数结果里没有可信的上下限，
 * 编一个 0~max 的量程去凑图，等于凭空造一个业务口径。
 */
function KpiBlock({ series }: { series: AskSeries }): JSX.Element {
	const first = series.values[0] ?? 0;
	return (
		<div className="flex flex-col items-center justify-center gap-1 py-6">
			<div className="font-mono text-[26px] font-semibold tabular-nums text-surface-foreground">
				{formatNumber(first)}
			</div>
			<div className="text-[11px] text-muted">
				{series.labelField ? `${series.labelField}：${series.labels[0]}` : "结果首行"}
			</div>
			{series.values.length > 1 ? (
				<div className="text-[10px] text-faint">结果共 {series.values.length} 行，此处为首行，其余见「看数据」</div>
			) : null}
		</div>
	);
}

function Legend({ series, limit = 8 }: { series: AskSeries; limit?: number }): JSX.Element {
	return (
		<div className="flex flex-wrap gap-x-3 gap-y-1">
			{series.labels.slice(0, limit).map((label, i) => (
				<span key={`${label}-${i}`} className="flex items-center gap-1 text-[10px] text-muted">
					<span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(i) }} />
					<span className="max-w-[120px] truncate">{label}</span>
					<span className="font-mono tabular-nums text-faint">{formatNumber(series.values[i] ?? 0)}</span>
				</span>
			))}
			{series.labels.length > limit ? (
				<span className="text-[10px] text-faint">…另有 {series.labels.length - limit} 项</span>
			) : null}
		</div>
	);
}

function AnswerChart({ kind, result }: { kind: AskChartKind; result: AskResult | null }): JSX.Element {
	if (!result || result.rows.length === 0) {
		return <EmptyChart message="这一轮没有取到数据" hint="可以追问：换一个时间范围或换一个口径" className="h-[150px]" />;
	}
	if (kind === "chart-table") return <DataTable result={result} />;

	const series = pickChartSeries(result, kind);
	if (series.values.length === 0) {
		return (
			<EmptyChart
				message="结果里没有可画图的数值列"
				hint="SQL 可能只查了维度；直接看「看数据」或换个问法"
				className="h-[150px]"
			/>
		);
	}

	const footer = (
		<div className="space-y-1">
			<div className="flex items-center gap-2 text-[10px] text-faint">
				{series.labelField ? <span>维度 {series.labelField}</span> : null}
				{series.valueField ? <span>度量 {series.valueField}</span> : null}
				<span>共 {series.values.length} 个点</span>
				{series.skipped > 0 ? (
					<span className="text-warning">丢弃 {series.skipped} 行（数值缺失）</span>
				) : null}
			</div>
			{series.labelField ? <Legend series={series} /> : null}
		</div>
	);

	let chart: JSX.Element;
	if (kind === "chart-donut") {
		chart = (
			<Donut
				segments={series.values.map((value, i) => ({ value, color: seriesColor(i) }))}
				size={132}
				className="mx-auto"
			/>
		);
	} else if (kind === "chart-funnel") {
		// 漏斗画的是「逐级收窄」，宽度必须按数值降序才成立；
		// 原始行序在「看数据」里，不在这里偷改用户的取数顺序。
		const ordered = series.values
			.map((value, i) => ({ label: series.labels[i] ?? `第 ${i + 1} 项`, value }))
			.sort((a, b) => b.value - a.value);
		chart = <Funnel stages={ordered.map((s) => ({ ...s, text: formatNumber(s.value) }))} />;
	} else if (kind === "chart-kpi") {
		chart = <KpiBlock series={series} />;
	} else if (kind === "chart-bar") {
		// 排行榜用横向条（名称长也不挤），超过 12 项退回纵向柱。
		chart =
			series.values.length > 12 ? (
				<BarChart values={series.values} className="h-full w-full" />
			) : (
				<HBars
					rows={series.values.map((value, i) => ({
						label: series.labels[i] ?? `第 ${i + 1} 项`,
						value,
						text: formatNumber(value),
					}))}
				/>
			);
	} else {
		// 趋势：点多用折线，点少用面积。
		chart =
			series.values.length > 3 ? (
				<LineChart values={series.values} className="h-full w-full" />
			) : (
				<AreaChart values={series.values} className="h-full w-full" />
			);
	}

	return (
		<div className="space-y-2">
			<div className="h-[160px]">{chart}</div>
			{footer}
		</div>
	);
}

function DataTable({ result, max = TABLE_PREVIEW_ROWS }: { result: AskResult; max?: number }): JSX.Element {
	const rows = result.rows.slice(0, max);
	return (
		<div className="space-y-1">
			<div className="max-h-[240px] overflow-auto rounded-control border border-border">
				<table className="w-full border-collapse text-[11px]">
					<thead className="sticky top-0 bg-surface">
						<tr>
							{result.columns.map((column) => (
								<th
									key={column}
									className="whitespace-nowrap border-b border-border px-2 py-1 text-left font-medium text-muted"
								>
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={i} className="hover:bg-surface">
								{result.columns.map((column) => (
									<td
										key={column}
										className="whitespace-nowrap border-b border-border px-2 py-1 font-mono tabular-nums text-surface-foreground"
									>
										{formatCell(row[column])}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{result.rows.length > rows.length ? (
				<span className="text-[10px] text-faint">
					只展示前 {rows.length} 行（本次取回 {result.rows.length} 行）
				</span>
			) : null}
		</div>
	);
}

// ── 一轮回答 ──

function AnswerBlock({
	answer,
	kind,
	onKindChange,
	onInsert,
}: {
	answer: AskAnswer;
	kind: AskChartKind;
	onKindChange: (kind: AskChartKind) => void;
	onInsert: () => void;
}): JSX.Element {
	const series = answer.result ? pickChartSeries(answer.result, kind) : null;
	const insertable = Boolean(answer.result) && Boolean(answer.sql.trim());
	return (
		<div className="space-y-2 rounded-card border border-border bg-surface-raised p-3">
			{/* 结论摘要 + 动作 */}
			<div className="flex items-start gap-2">
				<span className="mt-0.5 shrink-0 text-[13px]">{answer.conclusion.trim() ? "🧭" : "📊"}</span>
				<div className="min-w-0 flex-1 text-[12px] leading-relaxed text-surface-foreground">
					{answer.conclusion.trim() || answer.intent.trim() || "（模型没有给出结论，直接看图与明细）"}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<Chip tone="ai" icon="icon-[lucide--sparkles]">{CHART_KIND_LABELS[kind]}</Chip>
				{answer.result ? <Chip mono>{answer.result.rows.length} 行</Chip> : null}
				<Chip mono>{answer.datasetName}</Chip>
				{answer.sqls.length > 1 ? <Chip mono>取数 {answer.sqls.length} 次</Chip> : null}
				<div className="ml-auto flex items-center gap-1.5">
					<select
						value={kind}
						onChange={(e) => onKindChange(e.target.value as AskChartKind)}
						title="换图"
						className="h-6 rounded-control border border-border bg-surface px-1 text-[10px] text-surface-foreground"
					>
						{ASK_CHART_KINDS.map((k) => (
							<option key={k} value={k}>{CHART_KIND_LABELS[k]}</option>
						))}
					</select>
					<Btn
						size="sm"
						variant="ai"
						icon="icon-[lucide--plus-square]"
						disabled={!insertable}
						title={insertable ? "把这条 SQL 与图型落成画布节点图" : "最终 SQL 未成功执行，先修好再落画布"}
						onClick={onInsert}
					>
						加入画布
					</Btn>
				</div>
			</div>

			{/* 分析过程（可展开）—— Quick BI 的「分析过程可解释 + SQL 可见」 */}
			<details className="rounded-control border border-border bg-surface">
				<summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-muted">
					分析过程与 SQL
					<Icon name="icon-[lucide--chevron-right]" className="ml-1 inline-block size-3 align-[-2px]" />
				</summary>
				<div className="space-y-2 border-t border-border px-2 py-2 text-[11px]">
					<div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1">
						<span className="text-faint">数据集</span>
						<span className="text-surface-foreground">{answer.datasetName}</span>
						<span className="text-faint">意图</span>
						<span className="text-surface-foreground">{answer.intent.trim() || "（未说明）"}</span>
						<span className="text-faint">字段</span>
						<span className="text-surface-foreground">
							{answer.fields.length > 0 ? answer.fields.join("、") : "（未列出）"}
						</span>
						<span className="text-faint">取数</span>
						<span className="text-surface-foreground">
							{answer.sqls.length} 次
							{answer.result ? `，末次返回 ${answer.result.rows.length} 行` : ""}
							{series && series.skipped > 0 ? `，画图时丢弃 ${series.skipped} 行（数值缺失）` : ""}
						</span>
					</div>
					<div className="space-y-1">
						{answer.sqls.length === 0 ? (
							<span className="text-faint">本轮没有执行过 SQL。</span>
						) : (
							answer.sqls.map((sql, i) => (
								<div key={i} className="rounded-control border border-border bg-surface-raised">
									<div className="flex items-center gap-2 border-b border-border px-2 py-1">
										<span className="text-[10px] text-faint">
											SQL {i + 1} / {answer.sqls.length}
											{i === answer.sqls.length - 1 ? "（最终取数）" : "（模型自助探索）"}
										</span>
										<button
											type="button"
											className="ml-auto text-[10px] text-accent"
											onClick={() => void copyText(sql, "SQL ")}
										>
											复制
										</button>
									</div>
									<pre className="max-h-[160px] overflow-auto whitespace-pre-wrap break-all px-2 py-1.5 font-mono text-[10px] leading-relaxed text-surface-foreground">
										{sql}
									</pre>
								</div>
							))
						)}
					</div>
				</div>
			</details>

			{answer.result ? (
				<ChartFrame title={answer.question} hint={`${CHART_KIND_LABELS[kind]} · 数据来自 ${answer.datasetName}`}>
					<AnswerChart kind={kind} result={answer.result} />
				</ChartFrame>
			) : null}

			{answer.result && kind !== "chart-table" ? (
				<details className="rounded-control border border-border bg-surface">
					<summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-muted">看数据</summary>
					<div className="border-t border-border px-2 py-2">
						<DataTable result={answer.result} />
					</div>
				</details>
			) : null}

			{/* 数据解读：发现 / 结论 / 建议，缺哪段就不显示哪段（不编造） */}
			{answer.findings.trim() || answer.conclusion.trim() || answer.suggestions.length > 0 ? (
				<div className="space-y-1 rounded-control border border-border bg-surface px-2 py-2 text-[11px]">
					{answer.findings.trim() ? (
						<div className="flex gap-1.5">
							<span className="shrink-0 text-faint">数据发现</span>
							<span className="min-w-0 flex-1 leading-relaxed text-surface-foreground">{answer.findings}</span>
						</div>
					) : null}
					{answer.conclusion.trim() ? (
						<div className="flex gap-1.5">
							<span className="shrink-0 text-faint">结论</span>
							<span className="min-w-0 flex-1 leading-relaxed text-surface-foreground">{answer.conclusion}</span>
						</div>
					) : null}
					{answer.suggestions.length > 0 ? (
						<div className="flex gap-1.5">
							<span className="shrink-0 text-faint">建议</span>
							<ul className="min-w-0 flex-1 list-inside list-disc space-y-0.5 leading-relaxed text-surface-foreground">
								{answer.suggestions.map((s, i) => (
									<li key={i}>{s}</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			) : null}

			{answer.error ? (
				<div className="flex items-start gap-1.5 rounded-control border border-warning bg-warning-soft px-2 py-1.5 text-[11px] text-warning">
					<Icon name="icon-[lucide--alert-triangle]" className="mt-0.5 size-3.5 shrink-0" />
					<span className="min-w-0 flex-1">{answer.error}</span>
				</div>
			) : null}
		</div>
	);
}

// ── 面板 ──

export function AskPanel({ initialQuestion = "", onInsert, onClose, connections }: AskPanelProps): JSX.Element {
	const [options, setOptions] = useState<AskConnectionOption[]>(connections ?? []);
	const [connectionName, setConnectionName] = useState("");
	const [question, setQuestion] = useState(initialQuestion);
	const [turns, setTurns] = useState<AskTurn[]>([]);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState<string | null>(null);
	const [kindOverride, setKindOverride] = useState<Record<string, AskChartKind>>({});
	const [engineReady, setEngineReady] = useState<boolean | null>(null);

	const transcriptRef = useRef<PluginAiChatMessage[]>([]);
	const abortRef = useRef<AbortController | null>(null);
	const seqRef = useRef(0);

	const tablesState = useConnectionTables(connectionName);
	const tables = tablesState.tables;

	// 连接清单：注入优先，否则自己拉（引擎未就绪时静默，面板给出提示）
	useEffect(() => {
		if (connections) {
			setOptions(connections);
			return;
		}
		let alive = true;
		void (async () => {
			try {
				const { connections: list } = await engineListConnections();
				if (!alive) return;
				setOptions((list ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type, database: c.database })));
			} catch {
				if (alive) setOptions([]);
			}
		})();
		return () => {
			alive = false;
		};
	}, [connections]);

	useEffect(() => {
		if (!connectionName && options.length > 0) setConnectionName(options[0].name);
	}, [connectionName, options]);

	useEffect(() => {
		let alive = true;
		void engineHealth()
			.then(() => {
				if (alive) setEngineReady(true);
			})
			.catch(() => {
				if (alive) setEngineReady(false);
			});
		return () => {
			alive = false;
		};
	}, []);

	const suggestions = useMemo(() => suggestQuestions({ tables }), [tables]);
	const selected = options.find((c) => c.name === connectionName);

	const submit = useCallback(
		async (raw?: string) => {
			const text = (raw ?? question).trim();
			if (!text || busy) return;
			if (!connectionName) {
				notify("先选一个数据集（连接）", "error");
				return;
			}
			seqRef.current += 1;
			const seq = seqRef.current;
			setTurns((prev) => [...prev, { id: `u${seq}`, role: "user", text }]);
			setQuestion("");
			setBusy(true);
			setProgress(null);
			const controller = new AbortController();
			abortRef.current = controller;
			try {
				const outcome = await runAskTurn({
					ai: resolveChatPort(),
					runSql: (sql) => runSqlOnEngine(connectionName, sql),
					dataset: { connectionName, ...(tables.length > 0 ? { tables } : {}) },
					today: todayText(),
					transcript: transcriptRef.current,
					question: text,
					signal: controller.signal,
					onToolCall: (info) => setProgress(info.sql),
				});
				transcriptRef.current = outcome.transcript;
				setTurns((prev) => [
					...prev,
					outcome.answer
						? { id: `a${seq}`, role: "assistant", answer: outcome.answer }
						: { id: `e${seq}`, role: "error", text: outcome.error ?? "问数失败" },
				]);
			} catch (err) {
				setTurns((prev) => [...prev, { id: `e${seq}`, role: "error", text: errorText(err) }]);
			} finally {
				setBusy(false);
				setProgress(null);
				abortRef.current = null;
			}
		},
		[busy, connectionName, question, tables],
	);

	const handleInsert = useCallback(
		(answer: AskAnswer, kind: AskChartKind) => {
			onInsert({
				question: answer.question,
				title: titleFrom(answer.question),
				sql: answer.sql,
				chartKind: kind,
				connectionName: answer.datasetName,
				...(selected && selected.name === answer.datasetName && selected.id
					? { connectionId: selected.id }
					: {}),
			});
		},
		[onInsert, selected],
	);

	const canSubmit = !busy && question.trim().length > 0 && Boolean(connectionName);

	return (
		<div className="flex h-full min-h-0 flex-col bg-surface">
			{/* 顶栏 */}
			<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--wand-sparkles]" className="size-4 shrink-0 text-accent" />
				<span className="text-[12px] font-medium text-surface-foreground">问数</span>
				<span className="text-[10px] text-faint">选数据集 → 一句话提问 → 看 SQL 与解读 → 落画布</span>
				{onClose ? (
					<IconButton icon="icon-[lucide--x]" title="关闭" className="ml-auto" onClick={onClose} />
				) : null}
			</div>

			{/* 数据集（Quick BI 的「数据集问数配置」） */}
			<div className="shrink-0 space-y-1.5 border-b border-border px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="w-14 shrink-0 text-[11px] text-faint">数据集</span>
					<select
						value={connectionName}
						onChange={(e) => {
							setConnectionName(e.target.value);
							setProgress(null);
						}}
						className="h-7 min-w-0 flex-1 rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground"
					>
						<option value="">— 选择数据源 —</option>
						{options.map((c) => (
							<option key={c.name} value={c.name}>
								{c.name}
								{c.type ? ` (${c.type})` : ""}
								{c.database ? ` · ${c.database}` : ""}
							</option>
						))}
					</select>
					<IconButton
						icon="icon-[lucide--refresh-cw]"
						title="重新拉取该连接的表清单"
						disabled={!connectionName}
						onClick={() => {
							clearConnectionTablesCache(connectionName);
							setOptions((prev) => [...prev]);
						}}
					/>
				</div>
				<div className="flex flex-wrap items-center gap-1.5 pl-16">
					{tablesState.loading ? <Chip>读取表…</Chip> : null}
					{tablesState.error ? <Chip tone="warning">表清单读取失败</Chip> : null}
					{!tablesState.loading && !tablesState.error && connectionName ? (
						<Chip mono>{tables.length} 张表</Chip>
					) : null}
					{tables.slice(0, 8).map((t) => (
						<Chip key={t} mono>{t}</Chip>
					))}
					{tables.length > 8 ? <span className="text-[10px] text-faint">…另有 {tables.length - 8} 张</span> : null}
				</div>
				{engineReady === false ? (
					<div className="flex items-center gap-1.5 pl-16 text-[10px] text-warning">
						<Icon name="icon-[lucide--alert-triangle]" className="size-3 shrink-0" />
						数据库引擎未就绪：问数会取不到数，请先在工作台里把引擎起来
					</div>
				) : null}
			</div>

			{/* 会话流 */}
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-3">
				{turns.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<Icon name="icon-[lucide--sparkles]" className="size-5 text-faint" />
						<span className="text-[11px] text-muted">选好数据集，用一句话问它</span>
						<span className="text-[10px] text-faint">
							模型会自己写 SQL 取真实数据，过程与 SQL 都留在「分析过程」里
						</span>
					</div>
				) : null}
				{turns.map((turn) => {
					if (turn.role === "user") {
						return (
							<div key={turn.id} className="flex justify-end">
								<div className="max-w-[80%] rounded-card bg-accent-soft px-2.5 py-1.5 text-[12px] leading-relaxed text-surface-foreground">
									{turn.text}
								</div>
							</div>
						);
					}
					if (turn.role === "error") {
						return (
							<div key={turn.id} className="flex items-start gap-1.5 rounded-card border border-warning bg-warning-soft px-2.5 py-2 text-[11px] text-warning">
								<Icon name="icon-[lucide--alert-triangle]" className="mt-0.5 size-3.5 shrink-0" />
								<span className="min-w-0 flex-1">{turn.text}</span>
							</div>
						);
					}
					return (
						<AnswerBlock
							key={turn.id}
							answer={turn.answer}
							kind={kindOverride[turn.id] ?? turn.answer.chartKind}
							onKindChange={(kind) => setKindOverride((prev) => ({ ...prev, [turn.id]: kind }))}
							onInsert={() => handleInsert(turn.answer, kindOverride[turn.id] ?? turn.answer.chartKind)}
						/>
					);
				})}
				{busy ? (
					<div className="flex items-center gap-2 rounded-card border border-border bg-surface-raised px-2.5 py-2 text-[11px] text-muted">
						<Icon name="icon-[lucide--loader-circle]" className="size-3.5 animate-spin" />
						{progress ? (
							<span className="min-w-0 flex-1 truncate font-mono text-[10px]">正在取数：{progress}</span>
						) : (
							<span className="flex-1">模型正在分析…</span>
						)}
						<Btn size="sm" variant="default" onClick={() => abortRef.current?.abort()}>停止</Btn>
					</div>
				) : null}
			</div>

			{/* 推荐快捷提问 + 输入 */}
			<div className="shrink-0 space-y-2 border-t border-border px-3 py-2">
				{turns.length === 0 && suggestions.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{suggestions.map((s) => (
							<button
								key={s}
								type="button"
								disabled={busy || !connectionName}
								onClick={() => void submit(s)}
								className="rounded-chip border border-border bg-surface-raised px-2 py-1 text-[10px] text-muted hover:border-accent hover:text-accent disabled:text-faint"
							>
								{s}
							</button>
						))}
					</div>
				) : null}
				<div className="flex items-end gap-2">
					<textarea
						rows={2}
						value={question}
						placeholder={turns.length > 0 ? "继续追问（上一轮的维度与口径会延续）…" : "例如：近 14 天每天的成交额走势"}
						onChange={(e) => setQuestion(e.target.value)}
						onKeyDown={(e) => {
							if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
								e.preventDefault();
								void submit();
							}
						}}
						className="min-h-[44px] min-w-0 flex-1 resize-none rounded-control border border-border bg-surface px-2 py-1.5 text-[12px] leading-relaxed text-surface-foreground placeholder:text-faint"
					/>
					<Btn size="sm" variant="ai" icon="icon-[lucide--play]" disabled={!canSubmit} onClick={() => void submit()}>
						{turns.length > 0 ? "继续追问" : "开始分析"}
					</Btn>
				</div>
				<span className="text-[10px] text-faint">
					⌘/Ctrl + Enter 提交 · 取数只读（写操作会被 SQL 校验拒绝）· 结果只来自数据库，不补零不造数
				</span>
			</div>
		</div>
	);
}

export default AskPanel;
