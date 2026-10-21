/**
 * node-graph.tsx — 节点画布（设计稿 NodeGraph.tsx 插件化版本）。
 *
 * 数据流节点：数据集 → SQL → 图表 → 看板产物。
 * nodes 驱动坐标 + rowDy() 算插槽位置 → 连线端点永远落在插槽上。
 *
 * Viewport 数学：
 *   整个节点/连线/分组区域包在一个 transform 容器里：
 *     transform: translate(tx, ty) scale(scale)
 *     transform-origin: 0 0（左上角）
 *   屏幕坐标 → 画布坐标：canvasX = (screenX - rect.left - tx) / scale
 *   画布坐标 → 屏幕坐标：screenX = rect.left + tx + canvasX * scale
 *   这样所有节点坐标始终是"画布坐标系"下的值，viewport 只影响视觉渲染 + 命中检测。
 */

import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as RPointerEvent, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { NodeCard, NodeRow, NodeValue, NodeSelect, NodeSeg, HEAD_H, rowDy, TONE, type SocketHandlers } from "./node-card";
import { BarChart, Boxplot, ChartFrame, Donut, EmptyChart, Funnel, LineChart, RadarChart, ScatterChart, SERIES } from "../../shared/components/charts";
import {
	applyArrangement,
	computeAlign,
	computeArrangement,
	computeDistribute,
	DEFAULT_ARRANGE_GAP,
	type AlignMode,
	type ArrangeBox,
	type ArrangeLayout,
	type DistributeAxis,
} from "../lib/auto-layout";
import type { GridStep } from "./canvas-strip";
import { Chip } from "../../shared/components/ui/chip";
import { Icon } from "../../shared/components/ui/icon";
import { AddNodeMenu } from "./add-node-menu";
import { engineRequest } from "../../../../shared/services/engine-client";
import type { NodeResult } from "../hooks/use-canvas-execution";
import { fnv1aArray } from "../../../../shared/utils/hash";
import { resolveNodeChartData, type NodeChartData } from "../lib/node-chart-data";
import { buildChartOption, parseChartStyle } from "../lib/chart-option";
import { buildChartTile } from "../lib/chart-tile";
import { formatNumber } from "../lib/chart-spec";
import { EChart, ECHARTS_KINDS } from "../../shared/components/echart";
import { isChartKind, wireTone } from "../lib/link-tone";

// ── 类型 ──
export interface NodePos {
	x: number; y: number; w: number; h: number;
	tone: string; selected?: boolean;
	/** 停用（ComfyUI 的 mute / bypass 语义）：节点仍在画布上，但运行时会跳过。 */
	muted?: boolean;
	/** 节点类型 key，对应 NODE_TEMPLATES 条目（source-sql / chart-bar / ...） */
	kind?: string;
	/** PropertyInspector 字段值（key 对应 NODE_SCHEMA.fields[i].key） */
	values?: Record<string, unknown>;
	/** 折叠：只留标题条（几何高度同步收到 HEAD_H，连线端点按标题栏中线算）。 */
	collapsed?: boolean;
	/** 折叠前的原高度，展开时恢复。 */
	expandedH?: number;
	/** 锁定：禁止拖拽 / 缩放 / 删除，避免误碰关键节点。 */
	locked?: boolean;
	/** 是否为分组节点 */
	isGroup?: boolean;
	/** 分组节点标签 */
	groupLabel?: string;
	/** 分组节点图标 */
	groupIcon?: string;
}
export type NodeId = string;
export interface Link {
	id: string;
	from: NodeId; fromRow: number; to: NodeId; toRow: number; tone: string;
}

// nextLinkId 改为组件内 linkSeqRef（见 NodeGraph 内），避免多实例 HMR 冲突

/** 分组节点类型 - 作为独立节点可拖拽创建 */
export interface GroupNode {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	icon: string;
	collapsed?: boolean;
}

/**
 * 连线 SVG 用超大尺寸避免 viewBox 裁剪：元素左上角被移到 -SVG_ORIGIN，
 * 但内部 path 仍用画布坐标，所以必须包一层 translate(SVG_ORIGIN, SVG_ORIGIN) 抵消，
 * 否则整条线会画到视口外 20000px 处（看不见，也点不到）。
 */
const SVG_ORIGIN = 20000;

function linkPath(l: Link, nodes: Record<NodeId, NodePos>): string {
	const a = nodes[l.from];
	const b = nodes[l.to];
	if (!a || !b) return "";  // 节点被删但 link 残留 → 跳过渲染
	const x1 = a.x + a.w;
	const y1 = a.y + rowDy(l.fromRow);
	const x2 = b.x;
	const y2 = b.y + rowDy(l.toRow);
	const bend = Math.max(36, Math.abs(x2 - x1) * 0.5);
	return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** 贝塞尔曲线 t=0.5 的中点坐标（连线中点，用于 hover 按钮定位）。 */
function linkMid(l: Link, nodes: Record<NodeId, NodePos>): { x: number; y: number } {
	const a = nodes[l.from], b = nodes[l.to];
	if (!a || !b) return { x: 0, y: 0 };
	const x1 = a.x + a.w, y1 = a.y + rowDy(l.fromRow);
	const x2 = b.x, y2 = b.y + rowDy(l.toRow);
	const bend = Math.max(36, (x2 - x1) * 0.5);
	const cx1 = x1 + bend, cy1 = y1;
	const cx2 = x2 - bend, cy2 = y2;
	const t = 0.5;
	const mt = 1 - t;
	const x = mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2;
	const y = mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2;
	return { x, y };
}

/**
 * hashValues(seed, len) — FNV-1a 生成稳定伪随机整数数组。
 * 不抄设计稿 GMV mock 数据（[42,48,45,55,51,…] 是设计稿的硬编码，用户明确禁止），
 * 而是用 seed 哈希出自己的稳定序列，保证每次打开画布图表形状一致但数值来源独立。
 */
function hashValues(seed: string, len = 14, min = 30, max = 85): number[] {
	return fnv1aArray(seed, len, min, max);
}

function hashSegments(seed: string, count: number): { value: number; color: string }[] {
	const raw = hashValues(seed, count, 10, 40);
	const sum = raw.reduce((a, b) => a + b, 0);
	return raw.map((v, i) => ({ value: Math.round((v / sum) * 100), color: SERIES[i % SERIES.length] }));
}

/** 大数字格式化：整数原样、小数两位；非有限值退回「—」。 */
function formatMetric(value: number | undefined): string {
	if (value === undefined || !Number.isFinite(value)) return "—";
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** 按 kind 分派迷你图本体；数据只从 NodeChartData 进来，拿不到数据时由调用方渲染占位卡。 */
function renderChartArea(kind: string, data: NodeChartData): JSX.Element {
	if (kind === "chart-pie" || kind === "chart-donut") {
		return (
			<ChartFrame hint={`${data.values.length} 项`}>
				<Donut
					segments={data.values.slice(0, 4).map((v, i) => ({
						value: Math.max(1, Math.abs(v)),
						color: SERIES[i % SERIES.length],
					}))}
					size={56}
					thickness={8}
					holeFill="var(--color-surface)"
				/>
			</ChartFrame>
		);
	}
	if (kind === "chart-funnel") {
		const stages = data.labels.slice(0, 5).map((label, i) => ({
			label,
			value: Math.abs(data.values[i] ?? 0),
			text: formatMetric(data.values[i]),
		}));
		// Funnel 内部拿 stages[0].value 当分母，全 0 会算出 NaN 宽度，这里提前拦下。
		const maxStage = stages.reduce((max, stage) => Math.max(max, stage.value), 0);
		if (maxStage <= 0) return <EmptyChart message="数值全为 0，无法绘制漏斗" />;
		return (
			<ChartFrame hint={`${stages.length} 阶段`}>
				<div className="flex h-full flex-col justify-center overflow-hidden">
					<Funnel stages={stages} />
				</div>
			</ChartFrame>
		);
	}
	if (kind === "chart-boxplot") {
		return (
			<ChartFrame hint={`${data.boxGroups.length} 组`}>
				<Boxplot groups={data.boxGroups} tone={SERIES[2]} />
			</ChartFrame>
		);
	}
	if (kind === "chart-scatter") {
		return (
			<ChartFrame hint={`${data.values.length} 点`}>
				<ScatterChart values={data.values} tone={SERIES[0]} />
			</ChartFrame>
		);
	}
	if (kind === "chart-radar") {
		return (
			<ChartFrame hint={`${data.values.length} 维`}>
				<RadarChart values={data.values} labels={data.labels} tone={SERIES[3]} />
			</ChartFrame>
		);
	}
	if (kind === "chart-map") {
		// 迷你图里 map 暂时用散点近似（真实地图需要 geoJSON + 投影，工作量大）
		return (
			<ChartFrame hint={`${data.values.length} 点`}>
				<ScatterChart values={data.values} tone={SERIES[0]} />
			</ChartFrame>
		);
	}
	if (kind === "chart-bar") {
		return (
			<ChartFrame hint={`${data.values.length} 点`}>
				<BarChart values={data.values} tone={SERIES[1]} />
			</ChartFrame>
		);
	}
	return (
		<ChartFrame hint={`${data.values.length} 点`}>
			<LineChart values={data.values} stroke={SERIES[1]} />
		</ChartFrame>
	);
}

/**
 * 图表节点卡片内容：图体 + 结果集 / 维度 / 数值 映射行。
 * 没有真实结果时渲染显式「无数据」占位——不得回退哈希序列充数。
 */
/** 只能在语义层下绘制的类型：没有维度/度量配置就没有合理降级画法。 */
const SEMANTIC_ONLY = new Set([
	"chart-area", "chart-heatmap", "chart-treemap", "chart-sankey",
	"chart-waterfall", "chart-combo", "chart-gauge",
]);

/** 单元格文本：数组/对象折叠成一行，空值显式给破折号。 */
function cellText(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") {
		try {
			const json = JSON.stringify(value);
			return json.length > 40 ? `${json.slice(0, 40)}…` : json;
		} catch {
			return "—";
		}
	}
	return String(value);
}

/**
 * 结果集表格（output-table / adv-table 共用）。
 * 只渲染上游真实结果，未运行或报错就给空态，不画占位行。
 */
function renderTableBody(result: NodeResult | undefined, values: Record<string, unknown>): JSX.Element {
	const raw = Number(values.limit);
	const limit = Number.isFinite(raw) && raw > 0 ? Math.min(50, Math.floor(raw)) : 8;
	if (!result) return <EmptyChart message="尚无数据" hint="先运行上游数据源节点" />;
	if (result.error) return <EmptyChart message={result.error} />;
	if (result.columns.length === 0) return <EmptyChart message="上游结果没有列" />;

	const columns = result.columns.slice(0, 4);
	const rows = result.rows.slice(0, limit);
	return (
		<div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] border border-border bg-surface">
			<div className="flex shrink-0 border-b border-border text-[10px] text-faint">
				{columns.map((c) => (
					<span key={c} className="min-w-0 flex-1 truncate px-1.5 py-0.5">{c}</span>
				))}
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				{rows.map((row, i) => (
					<div key={i} className="flex border-b border-border/60 text-[10px] text-surface-foreground">
						{columns.map((c) => (
							<span key={c} className="min-w-0 flex-1 truncate px-1.5 py-0.5">{cellText(row[c])}</span>
						))}
					</div>
				))}
			</div>
			<div className="flex h-4 shrink-0 items-center justify-between px-1.5 text-[9px] text-faint">
				<span>{rows.length} / {result.rowCount} 行</span>
				<span>{result.durationMs} ms</span>
			</div>
		</div>
	);
}

function renderChartBody(kind: string, data: NodeChartData, values: Record<string, unknown> = {}): JSX.Element {
	if (data.status !== "ok") {
		return (
			<EmptyChart
				message={data.note || "无数据"}
				hint={data.status === "field-missing" ? "在右侧属性面板选择字段" : undefined}
			/>
		);
	}
	// 配了度量的节点全部走 ECharts；没配的旧页面继续用迷你图，行为不变。
	if (data.frame && ECHARTS_KINDS.has(kind)) {
		const option = buildChartOption(kind, data.frame, parseChartStyle(values));
		if (option) {
			return (
				<>
					<ChartFrame hint={`${data.frame.categories.length} 项`}>
						<EChart option={option} ariaLabel={`${kind} 图表`} />
					</ChartFrame>
					<NodeRow label="结果集">
						<NodeValue mono>{data.source === "upstream" ? "上游" : "本节点"} · {data.rowCount} 行</NodeValue>
					</NodeRow>
					<NodeRow label="分组"><NodeValue mono>{data.frame.dimensionLabels.join(" / ") || "—"}</NodeValue></NodeRow>
					<NodeRow label="度量"><NodeValue mono>{data.frame.measureLabel || "—"}</NodeValue></NodeRow>
				</>
			);
		}
	}
	if (SEMANTIC_ONLY.has(kind)) {
		return <EmptyChart message="缺少维度与度量配置" hint="在右侧属性面板添加度量" />;
	}
	if (kind === "chart-kpi") {
		return (
			<>
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center">
					<span className="font-mono text-[22px] font-bold text-surface-foreground">
						{data.frame ? formatNumber(data.frame.total, data.frame.series[0]?.format ?? "auto") : formatMetric(data.values[0])}
					</span>
					<span className="text-[10px] text-muted">{data.frame?.measureLabel || data.valueField || "—"}</span>
				</div>
				<NodeRow label="结果集">
					<NodeValue mono>{data.source === "upstream" ? "上游" : "本节点"} · {data.rowCount} 行</NodeValue>
				</NodeRow>
			</>
		);
	}
	return (
		<>
			{renderChartArea(kind, data)}
			<NodeRow label="结果集">
				<NodeValue mono>{data.source === "upstream" ? "上游" : "本节点"} · {data.rowCount} 行</NodeValue>
			</NodeRow>
			<NodeRow label="维度"><NodeValue mono>{data.labelField ?? "—"}</NodeValue></NodeRow>
			<NodeRow label="数值"><NodeValue mono>{data.valueField ?? "—"}</NodeValue></NodeRow>
		</>
	);
}

export interface NodeGraphProps {
	nodes: Record<NodeId, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<NodeId, NodePos>>>;
	links: Link[];
	setLinks: Dispatch<SetStateAction<Link[]>>;
	nodeResults?: Record<NodeId, NodeResult>;
	/** 取某节点的上游结果（canvas-editor 传入）；图表节点拿不到自身结果时用它取数。 */
	getUpstreamResult?: (id: NodeId) => NodeResult | null;
	/** 网格吸附步长（0 = 关闭）。受控时由父级持有，缺省时用组件内部状态。 */
	gridStep?: GridStep;
	onGridStepChange?: (step: GridStep) => void;
	/** 是否显示并对齐辅助线（关闭后只剩网格吸附）。 */
	guidesOn?: boolean;
	/** viewport 变化回调：工具条上的缩放百分比靠它。 */
	onViewportChange?: (viewport: { scale: number; tx: number; ty: number }) => void;
	/** 命令式出口：顶栏按钮与快捷键通过它驱动画布动作。 */
	api?: { current: NodeGraphApi | null };
	/** 「只运行这个节点」——节点右键菜单与悬浮工具条用。 */
	onRunNode?: (id: NodeId) => void;
}

/**
 * 画布上的离散编辑动作。分类对照 ComfyUI：
 *   useSelectionOperations.ts（copy / paste / duplicate / delete）
 *   useArrangeNodes.ts（垂直 / 水平 / 网格排列）
 *   useCoreCommands.ts（ToggleSelectedNodes.Mute / Bypass）
 */
export interface NodeGraphApi {
	/** 适配视图：`all` 框住全部节点，`selection` 聚焦选中节点。 */
	fitView: (mode?: "all" | "selection") => void;
	/** 相对当前倍率缩放：steps 为正放大、为负缩小。 */
	zoomBy: (steps: number) => void;
	/** 缩放到指定倍率（1 = 100%）。 */
	zoomTo: (scale: number) => void;
	/** 自动排列；`selection` 只排选中节点。 */
	arrange: (layout: ArrangeLayout, scope?: "all" | "selection") => void;
	/** 把选中节点按包围盒对齐（少于 2 个选中时无效果）。 */
	alignSelection: (mode: AlignMode) => void;
	/** 选中节点等距分布（少于 3 个时无效果）。 */
	distributeSelection: (axis: DistributeAxis) => void;
	/** 复制选中节点到剪贴板（不产生新节点）。 */
	copySelection: () => void;
	/** 粘贴剪贴板内容（偏移 24px、重新分配 id）。 */
	pasteClipboard: () => void;
	/** 原地复制选中节点。 */
	duplicateSelection: () => void;
	/** 删除选中节点及其连线。 */
	deleteSelection: () => void;
	/** 停用 / 启用选中节点。 */
	toggleMuteSelection: () => void;
	/** NodeLibrary 双击插入：在画布中心按 kind 创建节点并选中。 */
	insertAtCenter: (kind: string, label?: string) => void;
}

/** 缩放上下限与每级步长。比 ComfyUI litegraph 的 0.1~10 收紧到 BI 画布更实用的区间。 */
export const MIN_CANVAS_ZOOM = 0.25;
export const MAX_CANVAS_ZOOM = 2.5;
export const CANVAS_ZOOM_STEP = 1.2;
/** 缩放结果落到该半径内时吸附回 100%，方便回到「所见即所得」比例。 */
const ZOOM_SNAP = 0.02;

/** 缩放钳制 + 100% 吸附。 */
function clampZoom(scale: number): number {
	const clamped = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, scale));
	return Math.abs(clamped - 1) <= ZOOM_SNAP ? 1 : clamped;
}

/**
 * 按新倍率重建 viewport —— 锚点（画布元素内的局部坐标）缩放前后屏幕位置不动。
 * canvasPoint = (anchor - t) / scale，所以新 t = anchor - canvasPoint * nextScale。
 */
function zoomViewport(
	v: { scale: number; tx: number; ty: number },
	nextScale: number,
	anchor: { x: number; y: number },
): { scale: number; tx: number; ty: number } {
	const cx = (anchor.x - v.tx) / v.scale;
	const cy = (anchor.y - v.ty) / v.scale;
	return { scale: nextScale, tx: anchor.x - cx * nextScale, ty: anchor.y - cy * nextScale };
}

/** 剪贴板里的连线快照（不含 id，粘贴时重新分配）。 */
type LinkSnapshot = Omit<Link, "id">;
/** 复制/粘贴载荷：节点保留原 id 用于重映射连线两端。 */
type CanvasClipboard = { nodes: { id: NodeId; node: NodePos }[]; links: LinkSnapshot[] };

/** 节点模板注册表——DnD 创建新节点时按模板生成默认属性。
 *  key 即 kind，kind 存入 NodePos.kind 后 PropertyInspector 按此渲染表单。 */
export const NODE_TEMPLATES: Record<string, Omit<NodePos, "x" | "y">> = {
	// ── 数据源（设计稿 4 种） ──
	"source-sql":      { w: 180, h: 118, tone: TONE.table,  kind: "source-sql" },
	"source-connector":{ w: 180, h: 108, tone: TONE.table,  kind: "source-connector" },
	"source-extract":  { w: 180, h: 96,  tone: TONE.table,  kind: "source-extract" },
	"source-csv":      { w: 180, h: 108, tone: TONE.table,  kind: "source-csv" },
	"source-table":    { w: 180, h: 96,  tone: TONE.table,  kind: "source-table" },
	"source-api":      { w: 180, h: 96,  tone: TONE.table,  kind: "source-api" },

	// ── 图表（设计稿 6 种） ──
	"chart-line":      { w: 216, h: 222, tone: TONE.chart,  kind: "chart-line" },
	"chart-bar":       { w: 216, h: 190, tone: TONE.chart,  kind: "chart-bar" },
	"chart-donut":     { w: 216, h: 206, tone: TONE.chart,  kind: "chart-donut" },
	"chart-kpi":       { w: 180, h: 110, tone: TONE.result, kind: "chart-kpi" },
	"chart-funnel":    { w: 216, h: 210, tone: TONE.chart,  kind: "chart-funnel" },
	"chart-boxplot":   { w: 216, h: 200, tone: TONE.chart,  kind: "chart-boxplot" },
	"chart-pie":       { w: 216, h: 206, tone: TONE.chart,  kind: "chart-pie" },
	"chart-scatter":   { w: 216, h: 190, tone: TONE.chart,  kind: "chart-scatter" },
	"chart-map":       { w: 240, h: 240, tone: TONE.chart,  kind: "chart-map" },
	"chart-radar":     { w: 216, h: 190, tone: TONE.chart,  kind: "chart-radar" },
	"chart-area":      { w: 216, h: 222, tone: TONE.chart,  kind: "chart-area" },
	"chart-combo":     { w: 240, h: 220, tone: TONE.chart,  kind: "chart-combo" },
	"chart-heatmap":   { w: 240, h: 200, tone: TONE.chart,  kind: "chart-heatmap" },
	"chart-treemap":   { w: 240, h: 200, tone: TONE.chart,  kind: "chart-treemap" },
	"chart-sankey":    { w: 260, h: 210, tone: TONE.chart,  kind: "chart-sankey" },
	"chart-waterfall": { w: 240, h: 200, tone: TONE.chart,  kind: "chart-waterfall" },
	"chart-gauge":     { w: 200, h: 190, tone: TONE.chart,  kind: "chart-gauge" },
	"chart-bubble":    { w: 216, h: 190, tone: TONE.chart,  kind: "chart-bubble" },
	"chart-bullet":    { w: 240, h: 200, tone: TONE.chart,  kind: "chart-bullet" },
	"chart-oilgauge":  { w: 210, h: 200, tone: TONE.result, kind: "chart-oilgauge" },
	"chart-wordcloud": { w: 240, h: 200, tone: TONE.chart,  kind: "chart-wordcloud" },
	"chart-liquid":    { w: 200, h: 200, tone: TONE.result, kind: "chart-liquid" },

	// ── 大屏（设计稿 6 种） ──
	"screen-page":     { w: 260, h: 80,  tone: TONE.chart,  kind: "screen-page" },
	"screen-title":    { w: 260, h: 72,  tone: TONE.chart,  kind: "screen-title" },
	"screen-metric":   { w: 200, h: 110, tone: TONE.result, kind: "screen-metric" },
	"screen-rank":     { w: 220, h: 210, tone: TONE.chart,  kind: "screen-rank" },
	"screen-map":      { w: 320, h: 280, tone: TONE.chart,  kind: "screen-map" },
	"screen-carousel": { w: 240, h: 200, tone: TONE.chart,  kind: "screen-carousel" },

	// ── 控件产物（设计稿 3 种 + 补 filter-text） ──
	"filter-select":   { w: 180, h: 88,  tone: TONE.control, kind: "filter-select" },
	"filter-date":     { w: 180, h: 88,  tone: TONE.control, kind: "filter-date" },
	"filter-text":     { w: 180, h: 78,  tone: TONE.control, kind: "filter-text" },
	"output-page":     { w: 220, h: 180, tone: TONE.chart,  kind: "output-page" },
	"output-publish":  { w: 180, h: 88,  tone: TONE.control, kind: "output-publish" },

	// ── 高级组件（设计稿 4 种，badge=true） ──
	"adv-summary":     { w: 200, h: 110, tone: TONE.result, kind: "adv-summary" },
	"adv-tabs":        { w: 220, h: 200, tone: TONE.chart,  kind: "adv-tabs" },
	"adv-table":       { w: 240, h: 220, tone: TONE.chart,  kind: "adv-table" },
	"adv-calendar":    { w: 240, h: 240, tone: TONE.chart,  kind: "adv-calendar" },

	// ── 向后兼容：旧指标类 ──
	"metric-big":      { w: 180, h: 110, tone: TONE.result, kind: "metric-big" },
	"metric-trend":    { w: 180, h: 110, tone: TONE.result, kind: "metric-trend" },
	"metric-gauge":    { w: 180, h: 130, tone: TONE.result, kind: "metric-gauge" },
	"filter-input":    { w: 180, h: 88,  tone: TONE.control, kind: "filter-input" },
	"output-table":    { w: 220, h: 180, tone: TONE.chart,  kind: "output-table" },
	"output-text":     { w: 200, h: 120, tone: TONE.chart,  kind: "output-text" },
	"output-image":    { w: 220, h: 160, tone: TONE.chart,  kind: "output-image" },

	// ── 分组节点（可作为独立节点拖拽创建） ──
	"group-source":    { w: 220, h: 400, tone: "#64748b", kind: "group-source", isGroup: true, groupLabel: "数据源", groupIcon: "icon-[lucide--database]" },
	"group-chart":     { w: 280, h: 450, tone: "#64748b", kind: "group-chart", isGroup: true, groupLabel: "图表", groupIcon: "icon-[lucide--chart-line]" },
	"group-custom":    { w: 240, h: 300, tone: "#64748b", kind: "group-custom", isGroup: true, groupLabel: "自定义分组", groupIcon: "icon-[lucide--layers]" },
};

export function NodeGraph({
	nodes,
	setNodes,
	links,
	setLinks,
	nodeResults = {},
	getUpstreamResult,
	gridStep: controlledGridStep,
	onGridStepChange,
	guidesOn = true,
	onViewportChange,
	api,
	onRunNode,
}: NodeGraphProps): JSX.Element {
	const canvasRef = useRef<HTMLDivElement>(null);
	/** 每实例独立的 link 计数器——避免模块级共享导致 HMR 冲突或多画布 id 撞 */
	const linkSeqRef = useRef(0);
	const nextLinkId = () => { linkSeqRef.current++; return `l${linkSeqRef.current}`; };

	// ── Viewport：缩放 + 平移 ──
	// transform-origin: 0 0；顺序：translate(tx, ty) → scale(scale)
	const [viewport, setViewport] = useState<{ scale: number; tx: number; ty: number }>({ scale: 1, tx: 0, ty: 0 });
	const viewportRef = useRef(viewport);
	viewportRef.current = viewport;

	// 缩放百分比要显示在 CanvasStrip 上 → 每次 viewport 变化回抛一次
	const onViewportChangeRef = useRef(onViewportChange);
	onViewportChangeRef.current = onViewportChange;
	useEffect(() => { onViewportChangeRef.current?.(viewport); }, [viewport]);

	const nodesRef = useRef(nodes);
	nodesRef.current = nodes;

	/**
	 * links / 回调也进 ref：键盘与剪贴板路径在 deps 为空的 effect 里读取，
	 * 否则闭包里会拿到首次渲染时的旧值。
	 */
	const linksRef = useRef(links);
	linksRef.current = links;
	const onGridStepChangeRef = useRef(onGridStepChange);
	onGridStepChangeRef.current = onGridStepChange;
	const onRunNodeRef = useRef(onRunNode);
	onRunNodeRef.current = onRunNode;
	/** 内部剪贴板：跨节点删除也保留内容（对齐 ComfyUI 的序列化剪贴板）。 */
	const clipboardRef = useRef<CanvasClipboard | null>(null);

	/** 屏幕坐标 → 画布坐标（逆变换） */
	const screenToCanvas = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return { x: clientX, y: clientY };
		const v = viewportRef.current;
		return {
			x: (clientX - rect.left - v.tx) / v.scale,
			y: (clientY - rect.top - v.ty) / v.scale,
		};
	}, []);

	/** 画布坐标 → 屏幕坐标（正变换） */
	const canvasToScreen = useCallback((cx: number, cy: number): { x: number; y: number } => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return { x: cx, y: cy };
		const v = viewportRef.current;
		return {
			x: rect.left + v.tx + cx * v.scale,
			y: rect.top + v.ty + cy * v.scale,
		};
	}, []);

	const [dragOver, setDragOver] = useState(false);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
	const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: NodeId; x: number; y: number } | null>(null);
	/** output socket 连线末端弹出的 AddNodeMenu 位置 + 源头 socket */
	const [linkOutContext, setLinkOutContext] = useState<{ from: NodeId; fromRow: number; x: number; y: number } | null>(null);
	/** 图表放大：目标节点（在卡片上的放大按钮触发）。 */
	const [magnify, setMagnify] = useState<{ id: NodeId; kind: string } | null>(null);

	// ── 框选状态 ──
	const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
	const selectionBoxRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

	// ── Resize 状态 ──
	const [resizing, setResizing] = useState<{ id: NodeId; corner: "tl" | "tr" | "bl" | "br"; startX: number; startY: number; startW: number; startH: number; startNodeX: number; startNodeY: number } | null>(null);
	const resizingRef = useRef<typeof resizing>(null);

	// ── DnD：从 NodeLibrary 拖入新节点 ──
	const nodeSeqRef = useRef(100);

	function onCanvasDragOver(e: DragEvent) {
		e.preventDefault();
		if (!dragOver) setDragOver(true);
	}
	function onCanvasDragLeave() { setDragOver(false); }
	function onCanvasDrop(e: DragEvent) {
		e.preventDefault();
		setDragOver(false);
		const data = e.dataTransfer?.getData("application/json");
		if (!data) return;
		try {
			const payload = JSON.parse(data) as { kind?: string; nodeType?: string; templateId?: string };

			if (payload.kind === "template" && payload.templateId) {
				engineRequest<{ id: string; name: string; template: string }[]>(`/drag/template/list`, undefined, { method: "GET" })
					.then((list) => {
						const tpl = list?.find((t) => t.id === payload.templateId);
						if (!tpl) return;
						try {
							const obj = JSON.parse(tpl.template) as { nodes: Record<string, NodePos>; links: Link[] };
							if (obj && typeof obj === "object" && "nodes" in obj) {
								setNodes(obj.nodes);
								setLinks(obj.links ?? []);
								const maxExisting = Object.keys(obj.nodes).reduce((max, id) => {
									const m = id.match(/^n(\d+)$/);
									return m ? Math.max(max, parseInt(m[1], 10)) : max;
								}, 100);
								nodeSeqRef.current = maxExisting;
							}
						} catch { /* ignore bad template JSON */ }
					});
				return;
			}

			const type = payload.nodeType;
			if (!type) return;
			// 屏幕坐标 → 画布坐标（逆 transform）
			const canvasPt = screenToCanvas(e.clientX, e.clientY);
			const x = canvasPt.x - 90;
			const y = canvasPt.y - 40;
			const tpl = NODE_TEMPLATES[type] ?? { w: 180, h: 110, tone: TONE.chart };
			nodeSeqRef.current++;
			const newId = `n${nodeSeqRef.current}`;
			const newNode: NodePos = { ...tpl, x: Math.max(8, x), y: Math.max(8, y), kind: type, selected: true };
			setNodes((prev) => {
				const next: typeof prev = {};
				for (const [id, n] of Object.entries(prev)) next[id] = { ...n, selected: false };
				next[newId] = newNode;
				return next;
			});
		} catch { /* ignore bad data */ }
	}

	// ── 节点拖拽 ──
	// 点击 vs 拖拽 阈值（ComfyUI maxClickDrift=6px）—— pointerdown 只记起点，
	// 移动 ≥6px 才真正进入 drag；<6px + pointerup 就是单击。
	const pendingClickRef = useRef<{
		id: NodeId;
		startCx: number;
		startCy: number;
		nodeAlreadySelected: boolean;
		rafId: number | null;
	} | null>(null);

	/** dragRef 在进入 drag 模式时填充，记录所有被拖节点的初始 offset */
	const dragRef = useRef<{
		// 主拖节点 id（用来判断是否进入了 drag 模式）
		primaryId: NodeId;
		// [id] = { ocx, ocy } — 画布坐标下节点原点相对主拖起点的偏移
		offsets: Record<NodeId, { ocx: number; ocy: number }>;
		rafId: number | null;
	} | null>(null);

	const CLICK_DRIFT = 6; // px — 小于这个漂移算单击，大于算拖拽

	// ── Snap-to-grid + 对齐辅助线 ──
	const GUIDE_TOL = 4;     // 对齐辅助线容差 4px
	// 网格步长受控：父级（CanvasStrip）持有时以父级为准，单独使用组件时退回内部状态
	const [gridStepInner, setGridStepInner] = useState<GridStep>(8);
	const gridStep = controlledGridStep ?? gridStepInner;
	/** 步长 0 即「关闭吸附」。 */
	const snapOn = gridStep > 0;
	// snapRef 由步长派生：拖拽/缩放热路径（deps 为空的 pointer effect）只读 ref，不追 state
	const snapRef = useRef(snapOn);
	snapRef.current = snapOn;
	const gridRef = useRef<number>(gridStep);
	gridRef.current = gridStep;
	const guidesOnRef = useRef(guidesOn);
	guidesOnRef.current = guidesOn;
	const setGridStep = useCallback((step: GridStep) => {
		setGridStepInner(step);
		onGridStepChangeRef.current?.(step);
	}, []);
	const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
	const guidesRef = useRef(guides);
	guidesRef.current = guides;
	// 关掉辅助线时清掉残留的线，避免下次打开闪现旧位置
	useEffect(() => { if (!guidesOn) setGuides(null); }, [guidesOn]);

	function startDrag(id: NodeId, e: RPointerEvent<Element>) {
		e.stopPropagation();
		const canvasPt = screenToCanvas(e.clientX, e.clientY);
		const node = nodes[id];
		if (!node) return;
		// 锁定节点也要走完 pendingClick：单击仍可选中（方便看属性 / 右键解锁），
		// 真正拦住拖拽的是 onMove 里的 locked 判定。
		// Alt + 拖拽 = 拖出一份副本（原件留在原位），ComfyUI 的习惯做法
		let dragId = id;
		let alreadySelected = node.selected ?? false;
		if (e.altKey) {
			const cloneId = instantiate({ nodes: [{ id, node }], links: [] }, 0, 0);
			if (cloneId) {
				dragId = cloneId;
				alreadySelected = true; // 副本已被选中 → 走「已选中」分支，只拖副本
			}
		}
		pendingClickRef.current = {
			id: dragId,
			startCx: canvasPt.x,
			startCy: canvasPt.y,
			nodeAlreadySelected: alreadySelected,
			rafId: null,
		};
	}

	// ── 节点 Resize ──
	function startResize(id: NodeId, corner: "tl" | "tr" | "bl" | "br", e: RPointerEvent<Element>) {
		e.stopPropagation();
		const node = nodes[id];
		if (!node || node.locked) return;
		const canvasPt = screenToCanvas(e.clientX, e.clientY);
		resizingRef.current = {
			id,
			corner,
			startX: canvasPt.x,
			startY: canvasPt.y,
			startW: node.w,
			startH: node.h,
			startNodeX: node.x,
			startNodeY: node.y,
		};
		setResizing(resizingRef.current);
	}

	// ── 端口连线 ──
	const [pendingLink, setPendingLink] = useState<{
		from: NodeId; fromRow: number; x1: number; y1: number; x2: number; y2: number;
		/** out = 从输出插槽向右拉；in = 从输入插槽向左拉（反向建边） */
		dir: "out" | "in";
	} | null>(null);
	const pendingRef = useRef<{ from: NodeId; fromRow: number; dir: "out" | "in" } | null>(null);
	const [hoverLink, setHoverLink] = useState<string | null>(null);

	/** 画布坐标下某节点某行 socket 的绝对位置。 */
	function socketPos(id: NodeId, row: number, side: "l" | "r"): { x: number; y: number } {
		const n = nodesRef.current[id];
		if (!n) return { x: 0, y: 0 };
		return {
			x: n.x + (side === "r" ? n.w : 0),
			// 折叠节点没有 body，插槽全部落到标题栏中线
			y: n.y + (n.collapsed ? HEAD_H / 2 : rowDy(row)),
		};
	}

	// ── 端口连线：拖拽优先 ──
	// 以前 pointerdown 就弹 AddNodeMenu，单击插槽也会误弹菜单；现在只启动待定连线，
	// 指针真正拖过 CLICK_DRIFT（与「单击/拖拽」同一阈值）才确认是「拉一条新链」并弹菜单。
	const linkStartRef = useRef<{ menuOpened: boolean } | null>(null);

	/** 从 output socket 启动一条待定连线，此时不弹菜单。 */
	function beginLink(nodeId: NodeId, row: number, dir: "out" | "in" = "out") {
		// 防重入：如果之前的待定连线没清理（Esc/误操作残留），先 cancel
		if (pendingRef.current) {
			pendingRef.current = null;
			setPendingLink(null);
		}
		// 起点固定在同侧插槽：out 取右缘，in 取左缘
		const p = socketPos(nodeId, row, dir === "out" ? "r" : "l");
		pendingRef.current = { from: nodeId, fromRow: row, dir };
		setPendingLink({ from: nodeId, fromRow: row, x1: p.x, y1: p.y, x2: p.x, y2: p.y, dir });
		linkStartRef.current = { menuOpened: false };
	}

	/** 在指针处打开「连线末端 AddNodeMenu」（入参为视口坐标，内部转画布坐标）。 */
	function openLinkOutMenu(clientX: number, clientY: number) {
		const pl = pendingRef.current;
		if (!pl) return;
		const canvasPt = screenToCanvas(clientX, clientY);
		setLinkOutContext({ from: pl.from, fromRow: pl.fromRow, x: canvasPt.x, y: canvasPt.y });
		if (linkStartRef.current) linkStartRef.current.menuOpened = true;
	}

	// ── NodeCard socket 直接回调（绕过 canvas 的 onCanvasPointerDown 被 stopPropagation 阻断） ──
	const socketHandlers: SocketHandlers = {
		onOutputDown: ({ nodeId, row }) => {
			const n = nodesRef.current[nodeId];
			if (!n) return;
			// 拖拽优先：只启动待定连线，不弹菜单（见 beginLink 注释）
			beginLink(nodeId, row, "out");
		},
		onInputDown: ({ nodeId, row }) => {
			const pl = pendingRef.current;
			// 没有待定连线 → 从输入插槽反向拉一条，落到某个输出插槽即建边
			if (!pl) {
				beginLink(nodeId, row, "in");
				return;
			}
			if (pl.dir === "in" || pl.from === nodeId) return;
			const fromNode = nodesRef.current[pl.from];
			// 图表节点连线跟随输出插槽的系列色，非图表节点沿用数据类型色（唯一推导在 link-tone.ts）
			const tone = wireTone(fromNode?.tone, isChartKind(fromNode?.kind));
			setLinks((prev) => [...prev, {
				id: nextLinkId(), from: pl.from, fromRow: pl.fromRow, to: nodeId, toRow: row, tone,
			}]);
			pendingRef.current = null;
			setPendingLink(null);
			setLinkOutContext(null);
		},
	};

	/** 检测视口坐标下命中的 socket（elementFromPoint + data-socket-type）。 */
	function hitSocket(clientX: number, clientY: number) {
		const el = document.elementFromPoint(clientX, clientY);
		if (!(el instanceof HTMLElement)) return null;
		const type = el.dataset.socketType;
		if (type !== "input" && type !== "output") return null;
		const nodeId = el.dataset.nodeId as NodeId | undefined;
		const row = Number(el.dataset.socketRow);
		if (!nodeId || !nodesRef.current[nodeId]) return null;
		return { type, nodeId, row };
	}

	/** 判断点击是否落在节点卡片 / socket / 分组区域 上。 */
	function isCanvasBlank(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return true;
		if (target.closest("[data-node-id], [data-socket-type], [class*='group-zone'], [data-node-action-bar], [data-context-menu]")) return false;
		return true;
	}

	/** 命中某张节点卡片本体（不要求压在插槽上）。 */
	function hitNodeCard(clientX: number, clientY: number): NodeId | null {
		const el = document.elementFromPoint(clientX, clientY);
		if (!(el instanceof HTMLElement)) return null;
		const card = el.closest("[data-node-id]");
		if (!(card instanceof HTMLElement)) return null;
		const id = card.dataset.nodeId as NodeId | undefined;
		return id && nodesRef.current[id] ? id : null;
	}

	/** 画布 pointerdown：拦截 output socket → 启动待定连线（菜单等拖拽确认后再弹）；空白区点击 → 取消选中。 */
	function onCanvasPointerDown(e: RPointerEvent<HTMLDivElement>) {
		const hit = hitSocket(e.clientX, e.clientY);
		if (hit?.type === "output") {
			e.stopPropagation();
			// 拖拽优先：只启动待定连线，不弹菜单
			beginLink(hit.nodeId, hit.row, "out");
			return;
		}
		if (hit?.type === "input") {
			// 如果是连线中（pendingLink），则完成连线
			e.stopPropagation();
			const pl = pendingRef.current;
			// 没有待定连线 → 从输入插槽反向拉一条，落到某个输出插槽即建边
			if (!pl) {
				beginLink(hit.nodeId, hit.row, "in");
				return;
			}
			if (pl.dir === "in" || hit.nodeId === pl.from) return;
			setLinks((prev) => {
				const srcNode = nodes[pl.from];
				const tone = wireTone(srcNode?.tone, isChartKind(srcNode?.kind));
				return [...prev, { id: nextLinkId(), from: pl.from, fromRow: pl.fromRow, to: hit.nodeId, toRow: hit.row, tone }];
			});
			pendingRef.current = null;
			setPendingLink(null);
			setLinkOutContext(null);
			return;
		}
		// 扩大空白区判定：只要没命中节点卡片、socket、分组区域就取消选中
		if (isCanvasBlank(e.target)) {
			// 清 click-drag 状态机（保险：NodeCard stopPropagation 已阻止冒泡）
			pendingClickRef.current = null;
			if (dragRef.current?.rafId) cancelAnimationFrame(dragRef.current.rafId);
			dragRef.current = null;
			resizingRef.current = null;
			const anySelected = (Object.keys(nodes) as NodeId[]).some((k) => nodes[k].selected);
			if (anySelected) {
				setNodes((prev) => {
					const next = { ...prev };
					for (const k of Object.keys(next) as NodeId[]) next[k] = { ...next[k], selected: false };
					return next;
				});
			}
			// 同时清除右键/linkOut 菜单
			setContextMenu(null);
			setNodeContextMenu(null);
			setLinkOutContext(null);
		}
	}

	// ── 全局 pointermove / pointerup：节点拖拽 + 端口连线 + 画布拖动平移 ──
	const canvasPanRef = useRef<{ startCx: number; startCy: number; tx0: number; ty0: number } | null>(null);

	useEffect(() => {
		function onMove(e: PointerEvent) {
		// click → drag 阈值判断：如果 pendingClickRef 存在，检查漂移
		const cx = e.clientX, cy = e.clientY;
		const canvasPt = screenToCanvas(cx, cy);
		const pc = pendingClickRef.current;
		if (pc && !dragRef.current) {
			// 锁定节点不进入拖拽：pendingClick 留给 onUp 做单击选中
			if (nodesRef.current[pc.id]?.locked) return;
			const dx = canvasPt.x - pc.startCx;
			const dy = canvasPt.y - pc.startCy;
			if (dx * dx + dy * dy >= CLICK_DRIFT * CLICK_DRIFT) {
				// 进入 drag 模式：先设置选中状态（单击时不设置）
				setNodes((prev) => {
					const next = { ...prev };
					const pn = prev[pc.id];
					if (!pn) return prev;
					const wasSel = pn.selected;
					// 如果主拖节点已选中 → 只保留它 + 其他已选中的一起拖
					// 如果没选中 → 只选中它（框选逻辑）
					if (wasSel) {
						for (const k of Object.keys(next) as NodeId[]) {
							if (k !== pc.id && !next[k].selected) next[k] = { ...next[k], selected: false };
						}
					} else {
						for (const k of Object.keys(next) as NodeId[]) next[k] = { ...next[k], selected: k === pc.id };
					}
					return next;
				});
				// 构建 dragRef.offsets：所有 selected 节点都记录偏移
				const cur = nodesRef.current;
				const offsets: Record<NodeId, { ocx: number; ocy: number }> = {};
				const pcNode = cur[pc.id];
				// Alt 克隆出来的副本可能刚写入 state、本轮闭包里还没看到 → 放弃这次拖拽
				if (!pcNode) { pendingClickRef.current = null; return; }
				offsets[pc.id] = { ocx: canvasPt.x - pcNode.x, ocy: canvasPt.y - pcNode.y };
				for (const k of Object.keys(cur) as NodeId[]) {
					if (k === pc.id) continue;
					if (cur[k].selected) {
						offsets[k] = { ocx: canvasPt.x - cur[k].x, ocy: canvasPt.y - cur[k].y };
					}
				}
				dragRef.current = { primaryId: pc.id, offsets, rafId: null };
				pendingClickRef.current = null; // 清 pending，不再处理
			} else {
				// 还在阈值内，什么都不做
			}
		}

		// 节点拖拽 RAF（多节点）
		const d = dragRef.current;
		if (d) {
			if (d.rafId) cancelAnimationFrame(d.rafId);
			d.rafId = requestAnimationFrame(() => {
				const cur = nodesRef.current;
				const canvasPt2 = screenToCanvas(cx, cy);
				const updates: Record<NodeId, { x: number; y: number }> = {};
				for (const id of Object.keys(d.offsets) as NodeId[]) {
					if (!cur[id]) continue;
					let nx = canvasPt2.x - d.offsets[id].ocx;
					let ny = canvasPt2.y - d.offsets[id].ocy;
					// ① snap-to-grid
					if (snapRef.current) {
						nx = Math.round(nx / gridRef.current) * gridRef.current;
						ny = Math.round(ny / gridRef.current) * gridRef.current;
					}
					updates[id] = { x: nx, y: ny };
				}

				// ② 对齐辅助线检测（只对主拖节点）
				const primaryPos = updates[d.primaryId];
				let gx: number | undefined, gy: number | undefined;
				if (primaryPos && guidesOnRef.current) {
					const pn = cur[d.primaryId];
					const pRect = {
						l: primaryPos.x,
						r: primaryPos.x + pn.w,
						t: primaryPos.y,
						b: primaryPos.y + pn.h,
						cx: primaryPos.x + pn.w / 2,
						cy: primaryPos.y + pn.h / 2,
					};
					for (const [id, n] of Object.entries(cur)) {
						if (id === d.primaryId || updates[id]) continue; // 跳过自己和一起拖的
						const r = { l: n.x, r: n.x + n.w, t: n.y, b: n.y + n.h, cx: n.x + n.w / 2, cy: n.y + n.h / 2 };
						if (Math.abs(pRect.l - r.l) <= GUIDE_TOL) { gx = r.l; if (snapRef.current) updates[d.primaryId].x = r.l; }
						else if (Math.abs(pRect.r - r.r) <= GUIDE_TOL) { gx = r.r; if (snapRef.current) updates[d.primaryId].x = r.r - pn.w; }
						else if (Math.abs(pRect.cx - r.cx) <= GUIDE_TOL) { gx = r.cx; if (snapRef.current) updates[d.primaryId].x = r.cx - pn.w / 2; }
						if (Math.abs(pRect.t - r.t) <= GUIDE_TOL) { gy = r.t; if (snapRef.current) updates[d.primaryId].y = r.t; }
						else if (Math.abs(pRect.b - r.b) <= GUIDE_TOL) { gy = r.b; if (snapRef.current) updates[d.primaryId].y = r.b - pn.h; }
						else if (Math.abs(pRect.cy - r.cy) <= GUIDE_TOL) { gy = r.cy; if (snapRef.current) updates[d.primaryId].y = r.cy - pn.h / 2; }
						if (gx !== undefined && gy !== undefined) break;
					}
				}
				const newGuides = (gx !== undefined || gy !== undefined) ? { x: gx, y: gy } : null;
				if ((newGuides?.x ?? 0) !== (guidesRef.current?.x ?? 0) || (newGuides?.y ?? 0) !== (guidesRef.current?.y ?? 0)) {
					setGuides(newGuides);
				}

				setNodes((prev) => {
					const next = { ...prev };
					for (const [id, pos] of Object.entries(updates)) {
						const old = next[id];
						if (old) next[id] = { ...old, x: pos.x, y: pos.y };
					}
					return next;
				});
			});
		} else if (guidesRef.current) {
			setGuides(null);
		}
			// 端口连线 —— 临时贝塞尔跟随光标（画布坐标）
			const pl = pendingRef.current;
			if (pl) {
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				setPendingLink((prev) => prev ? {
					...prev,
					x2: canvasPt.x,
					y2: canvasPt.y,
				} : null);
				// 菜单等 pointerup 落在空白处才弹：拖动途中弹会自动打断拖线，
				// 用户还没到目标插槽就被菜单抢了焦点，看起来像「拖不出线」。
			}
			// 框选模式
			const sb = selectionBoxRef.current;
			if (sb) {
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				sb.endX = canvasPt.x;
				sb.endY = canvasPt.y;
				setSelectionBox({ ...sb });
			}
			// Resize 模式
			const rs = resizingRef.current;
			if (rs) {
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				const dx = canvasPt.x - rs.startX;
				const dy = canvasPt.y - rs.startY;
				const minW = 120;
				const minH = 80;
				let newW = rs.startW;
				let newH = rs.startH;
				let newX = rs.startNodeX;
				let newY = rs.startNodeY;

				if (rs.corner === "br") {
					newW = Math.max(minW, rs.startW + dx);
					newH = Math.max(minH, rs.startH + dy);
				} else if (rs.corner === "bl") {
					newW = Math.max(minW, rs.startW - dx);
					newH = Math.max(minH, rs.startH + dy);
					newX = rs.startNodeX + (rs.startW - newW);
				} else if (rs.corner === "tr") {
					newW = Math.max(minW, rs.startW + dx);
					newH = Math.max(minH, rs.startH - dy);
					newY = rs.startNodeY + (rs.startH - newH);
				} else if (rs.corner === "tl") {
					newW = Math.max(minW, rs.startW - dx);
					newH = Math.max(minH, rs.startH - dy);
					newX = rs.startNodeX + (rs.startW - newW);
					newY = rs.startNodeY + (rs.startH - newH);
				}

				// resize 也 snap-to-grid
				if (snapRef.current) {
					newW = Math.max(minW, Math.round(newW / gridRef.current) * gridRef.current);
					newH = Math.max(minH, Math.round(newH / gridRef.current) * gridRef.current);
					newX = Math.round(newX / gridRef.current) * gridRef.current;
					newY = Math.round(newY / gridRef.current) * gridRef.current;
				}

				setNodes((prev) => ({
					...prev,
					[rs.id]: {
						...prev[rs.id],
						x: newX,
						y: newY,
						w: newW,
						h: newH,
					},
				}));
			}
			// 画布拖动平移（空白处按下拖动）
			const cp = canvasPanRef.current;
			if (cp) {
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				setViewport((v) => ({
					...v,
					tx: cp.tx0 + (canvasPt.x - cp.startCx) * v.scale,
					ty: cp.ty0 + (canvasPt.y - cp.startCy) * v.scale,
				}));
			}
		}
		function onUp(e: PointerEvent) {
			// 1. pendingClickRef 还在 → 用户没进入 drag，这就是一次单击
			const pc = pendingClickRef.current;
			if (pc && !dragRef.current) {
				// 单击选中：和旧逻辑一致（点一下选中，不切换多选状态）
				setNodes((prev) => {
					const next = { ...prev };
					const pn = next[pc.id];
					if (!pn) return prev;
					if (!pn.selected) {
						// 没选中 → 选中它 + 清其他
						for (const k of Object.keys(next) as NodeId[]) next[k] = { ...next[k], selected: k === pc.id };
					}
					// 已选中 → 保持原样（支持框选后单击已选中节点不丢选中）
					return next;
				});
			}
			pendingClickRef.current = null;

			// 2. 清理拖拽 RAF
			const d = dragRef.current;
			if (d?.rafId) cancelAnimationFrame(d.rafId);
			dragRef.current = null;
			setGuides(null); // 清理对齐辅助线
			canvasPanRef.current = null;
			resizingRef.current = null;
			setResizing(null);
			// 结束框选
			const sb = selectionBoxRef.current;
			if (sb) {
				const minX = Math.min(sb.startX, sb.endX);
				const maxX = Math.max(sb.startX, sb.endX);
				const minY = Math.min(sb.startY, sb.endY);
				const maxY = Math.max(sb.startY, sb.endY);
				// 只有框选区域足够大时才执行选择
				if (maxX - minX > 5 || maxY - minY > 5) {
					setNodes((prev) => {
						const next = { ...prev };
						for (const [id, n] of Object.entries(next)) {
							// 检查节点是否在框选区域内
							const inBox = n.x >= minX && n.x + n.w <= maxX && n.y >= minY && n.y + n.h <= maxY;
							next[id] = { ...n, selected: inBox };
						}
						return next;
					});
				}
				selectionBoxRef.current = null;
				setSelectionBox(null);
			}
			// 结束端口连线 —— out 拉向 input、in 反向拉向 output，方向正规化后建边
			const pl = pendingRef.current;
			if (pl) {
				const hit = hitSocket(e.clientX, e.clientY);
				const wantSide = pl.dir === "out" ? "input" : "output";
				// 宽容落点：没精确压在插槽上、但落在目标节点卡片上，也算连到该节点首行插槽。
				// 插槽只有 12px，真实拖拽很难每次都对准；只认精确命中会让用户觉得「怎么也连不上」。
				let target = hit?.type === wantSide ? hit : null;
				if (!target) {
					const cardId = hitNodeCard(e.clientX, e.clientY);
					if (cardId && cardId !== pl.from) target = { type: wantSide, nodeId: cardId, row: 0 };
				}
				if (target && target.nodeId !== pl.from) {
					const src = pl.dir === "out"
						? { node: pl.from, row: pl.fromRow }
						: { node: target.nodeId, row: target.row };
					const dst = pl.dir === "out"
						? { node: target.nodeId, row: target.row }
						: { node: pl.from, row: pl.fromRow };
					setLinks((prev) => {
						const srcNode = nodesRef.current[src.node];
						const tone = wireTone(srcNode?.tone, isChartKind(srcNode?.kind));
						return [...prev, { id: nextLinkId(), from: src.node, fromRow: src.row, to: dst.node, toRow: dst.row, tone }];
					});
				}
				// 只有「从输出插槽向右拉」在空白处松手才视为「起一条新链」；反向拉线落空就丢弃。
				if (pl.dir === "out" && !target && !hit && isCanvasBlank(e.target)) openLinkOutMenu(e.clientX, e.clientY);
				pendingRef.current = null;
				setPendingLink(null);
				// 菜单若是本次拖拽打开的，保留它（用户还要在里面挑节点类型）
				if (!linkStartRef.current?.menuOpened) setLinkOutContext(null);
				linkStartRef.current = null;
			}
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	// 空依赖数组：window pointermove/up listeners 不依赖 nodes 变化。
	// 内部所有状态读取走闭包 ref（dragRef / resizingRef / pendingRef / canvasPanRef / selectionBoxRef），
	// 避免拖拽/resize 过程中 useEffect 反复解绑重绑 listeners 导致抖动和中断。
	}, []);

	// ── 滚轮：Ctrl/⌘+wheel 缩放（以鼠标位置为锚点），纯 wheel 平移画布 ──
	const onWheel = useCallback((e: WheelEvent) => {
		if (!canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const sx = e.clientX - rect.left; // 相对 canvas 左上角的屏幕坐标
		const sy = e.clientY - rect.top;

		if (e.ctrlKey || e.metaKey) {
			// Ctrl/⌘ + wheel → 缩放（以鼠标位置为锚点，clampZoom 统一限量）
			e.preventDefault();
			setViewport((v) => {
				const delta = e.deltaY > 0 ? -0.12 : 0.12;
				const nextScale = clampZoom(v.scale + delta);
				// 缩放后让光标下的画布点保持不动
				return zoomViewport(v, nextScale, { x: sx, y: sy });
			});
		} else {
			// 纯 wheel → pan
			e.preventDefault();
			setViewport((v) => ({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }));
		}
	}, []);

	useEffect(() => {
		const el = canvasRef.current;
		if (!el) return;
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [onWheel]);

	// ── fitView：自动缩放 + 平移，让所有节点可见（或聚焦选中节点） ──
	function fitView(mode: "all" | "selection" = "all") {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const cur = nodesRef.current;
		const entries = Object.values(cur);
		if (entries.length === 0) return;

		const target = mode === "selection" ? entries.filter((n) => n.selected) : entries;
		if (target.length === 0) return;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const n of target) {
			if (n.x < minX) minX = n.x;
			if (n.y < minY) minY = n.y;
			if (n.x + n.w > maxX) maxX = n.x + n.w;
			if (n.y + n.h > maxY) maxY = n.y + n.h;
		}
		const bw = maxX - minX;
		const bh = maxY - minY;
		const pad = 48; // 边距
		const sx = (rect.width - pad * 2) / Math.max(bw, 1);
		const sy = (rect.height - pad * 2) / Math.max(bh, 1);
		const scale = clampZoom(Math.min(sx, sy));
		// 让 bounding box 中心对准画布中心
		const cx = rect.width / 2 - ((minX + maxX) / 2) * scale;
		const cy = rect.height / 2 - ((minY + maxY) / 2) * scale;
		setViewport({ scale, tx: cx, ty: cy });
	}

	// 画布空白拖动：pointerdown 在 canvas 空白区 → 记录起点（支持框选）
	function onCanvasBlankPointerDown(e: RPointerEvent<HTMLDivElement>) {
		if (!isCanvasBlank(e.target)) return;
		if (e.button !== 0) return;
		const canvasPt = screenToCanvas(e.clientX, e.clientY);
		// 常规画布编辑器：普通拖拽 = 框选，Shift / Space = pan（拖动画布）
		if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
			// 按住修饰键 → pan 画布
			canvasPanRef.current = {
				startCx: canvasPt.x,
				startCy: canvasPt.y,
				tx0: viewport.tx,
				ty0: viewport.ty,
			};
		} else {
			// 普通拖拽 = 框选
			selectionBoxRef.current = {
				startX: canvasPt.x,
				startY: canvasPt.y,
				endX: canvasPt.x,
				endY: canvasPt.y,
			};
			setSelectionBox({
				startX: canvasPt.x,
				startY: canvasPt.y,
				endX: canvasPt.x,
				endY: canvasPt.y,
			});
		}
	}

	// ── 全局键盘 handler：全选 / 删除 / Escape ──
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			// 如果正在输入文本，不拦截
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

			const mod = e.ctrlKey || e.metaKey;

			if (mod && e.key.toLowerCase() === "a") {
				e.preventDefault();
				setNodes((prev) => {
					const next = { ...prev };
					for (const k of Object.keys(next) as NodeId[]) next[k] = { ...next[k], selected: true };
					return next;
				});
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				const selectedIds = (Object.keys(nodesRef.current) as NodeId[])
					.filter((k) => nodesRef.current[k].selected && !nodesRef.current[k].locked);
				if (selectedIds.length === 0) return;
				const selSet = new Set(selectedIds);
				setNodes((prev) => {
					const next: typeof prev = {};
					for (const [id, n] of Object.entries(prev)) if (!selSet.has(id)) next[id] = { ...n };
					return next;
				});
				setLinks((prev) => prev.filter((l) => !selSet.has(l.from) && !selSet.has(l.to)));
				return;
			}
			if (mod && e.key.toLowerCase() === "c") {
				e.preventDefault();
				copySelection();
				return;
			}
			if (mod && e.key.toLowerCase() === "v") {
				e.preventDefault();
				pasteClipboard();
				return;
			}
			if (mod && e.key.toLowerCase() === "d") {
				e.preventDefault();
				duplicateSelection();
				return;
			}
			if (mod && e.key.toLowerCase() === "m") {
				// ⌘/Ctrl + M = 停用 / 启用选中节点（ComfyUI 的 mute）
				e.preventDefault();
				toggleMute();
				return;
			}
			if (e.key.toLowerCase() === "g" && !mod && !e.shiftKey && !e.altKey) {
				// G = 关 / 开网格吸附（重新打开回到 8px；不拦截修饰键组合）
				e.preventDefault();
				setGridStep(gridRef.current > 0 ? 0 : 8);
				return;
			}
			if (e.key === "Home") {
				e.preventDefault();
				// ComfyUI 风格的 Home 键 fitView：有选中聚焦选中，没选中看全部
				const hasSel = (Object.keys(nodesRef.current) as NodeId[]).some((k) => nodesRef.current[k].selected);
				fitView(hasSel ? "selection" : "all");
				return;
			}
			if (e.key === "Escape") {
				setNodes((prev) => {
					const next = { ...prev };
					let changed = false;
					for (const k of Object.keys(next) as NodeId[]) {
						if (next[k].selected) { next[k] = { ...next[k], selected: false }; changed = true; }
					}
					return changed ? next : prev;
				});
				setContextMenu(null);
				setNodeContextMenu(null);
				setLinkOutContext(null);
				setPendingLink(null);
				pendingRef.current = null;
				linkStartRef.current = null; // 漏清：否则下次 beginLink 可能残留
				resizingRef.current = null; // 漏清：resize 中 Esc 取消
				setResizing(null);
				pendingClickRef.current = null; // click-drag 状态机也要清
				if (dragRef.current?.rafId) cancelAnimationFrame(dragRef.current.rafId);
				dragRef.current = null;
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setNodes, setLinks, setGridStep]);

	// ESC 关闭画布空白右键菜单
	useEffect(() => {
		if (!contextMenu) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [contextMenu]);
	useEffect(() => {
		if (!nodeContextMenu) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNodeContextMenu(null); };
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [nodeContextMenu]);
	useEffect(() => {
		if (!linkOutContext) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setLinkOutContext(null); setPendingLink(null); pendingRef.current = null; } };
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [linkOutContext]);

	// ── 工具函数：插入新节点（画布坐标），清其他选中，返回新 id ──
	function insertNode(kind: string, canvasX: number, canvasY: number, initial?: Record<string, unknown>): { id: NodeId; node: NodePos } {
		const tpl = NODE_TEMPLATES[kind] ?? { w: 180, h: 110, tone: TONE.chart, kind };
		nodeSeqRef.current++;
		const newId = `n${nodeSeqRef.current}`;
		const newNode: NodePos = {
			...tpl,
			x: Math.max(8, canvasX),
			y: Math.max(8, canvasY),
			kind,
			selected: true,
			...(initial ? { values: initial } : {}),
		};
		setNodes((prev) => {
			const next: typeof prev = {};
			for (const [id, n] of Object.entries(prev)) next[id] = { ...n, selected: false };
			next[newId] = newNode;
			return next;
		});
		return { id: newId, node: newNode };
	}

	// ── 选中集合与编辑动作 ──
	// 参考 ComfyUI：useSelectionOperations（批量删除 / 排列）、useArrangeNodes（三种自动布局）、
	// LGraphEventMode.NEVER（停用节点后运行时不执行）。

	/** 当前选中节点 id（保持 nodes 的插入顺序，排列结果才稳定）。 */
	function selectedIds(): NodeId[] {
		const cur = nodesRef.current;
		return (Object.keys(cur) as NodeId[]).filter((id) => cur[id].selected);
	}

	/** 只选中一个节点（右键「只运行这个节点」前先把选中态挪过去）。 */
	function selectOnly(id: NodeId) {
		setNodes((prev) => {
			const next: Record<NodeId, NodePos> = {};
			for (const [k, n] of Object.entries(prev)) next[k] = { ...n, selected: k === id };
			return next;
		});
	}

	/** 复制单个节点（右键菜单）：走快照 → instantiate，id 统一由 nodeSeq 分配。 */
	function duplicateNode(id: NodeId) {
		const n = nodesRef.current[id];
		if (!n) return;
		instantiate({ nodes: [{ id, node: n }], links: [] }, 24, 24);
	}

	/** 删除节点及其两端连线。 */
	function removeNodes(ids: NodeId[]) {
		// 锁定节点不能被删：否则「锁定」只剩视觉标记，最容易丢数据的路径反而没拦住
		const deletable = ids.filter((id) => !nodesRef.current[id]?.locked);
		if (deletable.length === 0) return;
		const set = new Set(deletable);
		setNodes((prev) => {
			const next: Record<NodeId, NodePos> = {};
			for (const [id, n] of Object.entries(prev)) if (!set.has(id)) next[id] = n;
			return next;
		});
		setLinks((prev) => prev.filter((l) => !set.has(l.from) && !set.has(l.to)));
		setNodeContextMenu(null);
	}

	/** 停用 / 启用节点（不传参 = 当前选中集）。停用后「全部运行」会跳过它。 */
	function toggleMute(target?: NodeId[]) {
		const ids = target ?? selectedIds();
		if (ids.length === 0) return;
		const set = new Set(ids);
		setNodes((prev) => {
			const next = { ...prev };
			for (const id of set) {
				const n = next[id];
				if (n) next[id] = { ...n, muted: !n.muted };
			}
			return next;
		});
	}

	/**
	/** 折叠 / 展开单个节点：几何高度跟着收放，连线端点才能跟着落到标题栏中线。 */
	function toggleCollapse(id: NodeId) {
		setNodes((prev) => {
			const n = prev[id];
			if (!n) return prev;
			if (n.collapsed) {
				return { ...prev, [id]: { ...n, collapsed: false, h: n.expandedH ?? n.h, expandedH: undefined } };
			}
			// 已经比标题栏还矮的节点（异常数据）就不要折叠，否则展开无路可走
			if (n.h <= HEAD_H) return prev;
			return { ...prev, [id]: { ...n, collapsed: true, h: HEAD_H, expandedH: n.h } };
		});
	}

	/** 锁定 / 解锁：锁定后拖拽、缩放、删除全部拦住，运行与参数编辑仍可用。 */
	function toggleLock(target?: NodeId[]) {
		const ids = target ?? selectedIds();
		if (ids.length === 0) return;
		const set = new Set(ids);
		setNodes((prev) => {
			const next = { ...prev };
			for (const id of set) {
				const n = next[id];
				if (n) next[id] = { ...n, locked: !n.locked };
			}
			return next;
		});
	}

	/** 对齐选中节点（<2 个时没参考对象，直接跳过）。 */
	function alignSelection(mode: AlignMode) {
		const updates = computeAlign(collectSelectedBoxes(), mode);
		if (updates.length === 0) return;
		setNodes((prev) => applyArrangement(prev, updates));
	}

	/** 等距分布：首尾不动，中间按相等间隙铺开。 */
	function distributeSelection(axis: DistributeAxis) {
		const updates = computeDistribute(collectSelectedBoxes(), axis);
		if (updates.length === 0) return;
		setNodes((prev) => applyArrangement(prev, updates));
	}

	/** 选中节点的几何盒（分组容器不参与对齐，它是别人的外框）。 */
	function collectSelectedBoxes(): ArrangeBox[] {
		const cur = nodesRef.current;
		const boxes: ArrangeBox[] = [];
		for (const id of selectedIds()) {
			const n = cur[id];
			if (!n || n.isGroup) continue;
			boxes.push({ id, x: n.x, y: n.y, w: n.w, h: n.h });
		}
		return boxes;
	}

	/**
	 * 并把选中状态换到副本上。返回第一个新节点的 id。
	 * 快照而不是活 id —— 所以源节点被删除后剪贴板依旧可用（与 ComfyUI 一致）。
	 */
	function instantiate(spec: CanvasClipboard, dx: number, dy: number): NodeId | null {
		if (spec.nodes.length === 0) return null;
		const idMap = new Map<NodeId, NodeId>();
		const fresh: Record<NodeId, NodePos> = {};
		let primary: NodeId | null = null;
		for (const entry of spec.nodes) {
			nodeSeqRef.current++;
			const newId = `n${nodeSeqRef.current}`;
			idMap.set(entry.id, newId);
			if (!primary) primary = newId;
			fresh[newId] = { ...entry.node, x: entry.node.x + dx, y: entry.node.y + dy, selected: true };
		}
		const freshLinks: Link[] = [];
		for (const l of spec.links) {
			const from = idMap.get(l.from);
			const to = idMap.get(l.to);
			if (from && to) freshLinks.push({ ...l, id: nextLinkId(), from, to });
		}
		setNodes((prev) => {
			const next: Record<NodeId, NodePos> = {};
			for (const [id, n] of Object.entries(prev)) next[id] = n.selected ? { ...n, selected: false } : n;
			return { ...next, ...fresh };
		});
		if (freshLinks.length > 0) setLinks((prev) => [...prev, ...freshLinks]);
		return primary;
	}

	/** 把选中子图截成可重建的快照（只保留组内连线）。 */
	function snapshotSelection(): CanvasClipboard | null {
		const cur = nodesRef.current;
		const ids = selectedIds();
		if (ids.length === 0) return null;
		const set = new Set(ids);
		return {
			nodes: ids.map((id) => ({ id, node: cur[id] })),
			links: linksRef.current
				.filter((l) => set.has(l.from) && set.has(l.to))
				.map((l) => ({ from: l.from, fromRow: l.fromRow, to: l.to, toRow: l.toRow, tone: l.tone })),
		};
	}

	/** ⌘C：快照进内部剪贴板；顺带写一份 JSON 到系统剪贴板，便于跨窗口粘。 */
	function copySelection() {
		const spec = snapshotSelection();
		if (!spec) return;
		clipboardRef.current = spec;
		const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
		if (clip) void clip.writeText(JSON.stringify(spec)).catch(() => undefined);
	}

	/** ⌘V：粘贴到原位置右下偏移 24px。 */
	function pasteClipboard() {
		const spec = clipboardRef.current;
		if (!spec) return;
		instantiate(spec, 24, 24);
	}

	/** ⌘D：就地复制选中节点。 */
	function duplicateSelection() {
		const spec = snapshotSelection();
		if (!spec) return;
		instantiate(spec, 24, 24);
	}

	/** Delete：删除选中节点。 */
	function deleteSelection() {
		removeNodes(selectedIds());
	}

	/** 自动排列；分组容器不参与（它是别人的外框）。 */
	function arrange(layout: ArrangeLayout, scope: "all" | "selection" = "all") {
		const cur = nodesRef.current;
		const ids = scope === "selection" ? selectedIds() : (Object.keys(cur) as NodeId[]);
		const boxes: ArrangeBox[] = [];
		for (const id of ids) {
			const n = cur[id];
			if (!n || n.isGroup) continue;
			boxes.push({ id, x: n.x, y: n.y, w: n.w, h: n.h });
		}
		const updates = computeArrangement(boxes, layout, DEFAULT_ARRANGE_GAP);
		if (updates.length === 0) return;
		setNodes((prev) => applyArrangement(prev, updates));
		// 排完把结果拉回视野（等 React 提交后再量尺寸）
		requestAnimationFrame(() => fitView(scope === "selection" ? "selection" : "all"));
	}

	/** 画布中心（缩放锚点，屏幕坐标）。 */
	function canvasCenter(): { x: number; y: number } {
		const rect = canvasRef.current?.getBoundingClientRect();
		return { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
	}

	/** 缩放到指定倍率（以画布中心为锚点）。 */
	function zoomTo(scale: number) {
		setViewport((v) => zoomViewport(v, clampZoom(scale), canvasCenter()));
	}

	/** 按挡位步进：+1 放大一挡，-1 缩小一挡。 */
	function zoomBy(steps: number) {
		setViewport((v) => zoomViewport(v, clampZoom(v.scale * Math.pow(CANVAS_ZOOM_STEP, steps)), canvasCenter()));
	}

	/** NodeLibrary 双击插入：把新节点放到画布中心（避开用户已经放满的左下角落点）。 */
	function insertAtCenter(kind: string) {
		const rect = canvasRef.current?.getBoundingClientRect();
		const cx = rect ? rect.left + rect.width / 2 : 0;
		const cy = rect ? rect.top + rect.height / 2 : 0;
		const pt = screenToCanvas(cx, cy);
		insertNode(kind, pt.x, pt.y);
	}

	// 命令式出口：顶栏（CanvasStrip / EditorToolbar）通过 ref 调用，避免把整套画布状态提升到父级
	if (api) {
		api.current = {
			fitView,
			zoomBy,
			insertAtCenter,
			zoomTo,
			arrange,
			alignSelection,
			distributeSelection,
			copySelection,
			pasteClipboard,
			duplicateSelection,
			deleteSelection,
			toggleMuteSelection: () => toggleMute(),
		};
	}

	return (
		<div
			ref={canvasRef}
			onPointerDown={(e) => {
				onCanvasPointerDown(e);
				onCanvasBlankPointerDown(e);
			}}
			onDragOver={onCanvasDragOver}
			onDragLeave={onCanvasDragLeave}
			onDrop={onCanvasDrop}
			onContextMenu={(e) => {
				e.preventDefault();
				// 只有空白区弹画布右键菜单，节点自己会弹节点右键
				if (!isCanvasBlank(e.target)) return;
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				setContextMenu({ x: canvasPt.x, y: canvasPt.y });
				setNodeContextMenu(null);
				setLinkOutContext(null);
			}}
			data-drag-over={dragOver ? "true" : undefined}
			onDoubleClick={(e) => {
				// 双击空白 = 在落点处快速添加节点（Superset / Metabase 画布编辑态的通行习惯）
				if (!isCanvasBlank(e.target)) return;
				const canvasPt = screenToCanvas(e.clientX, e.clientY);
				setContextMenu({ x: canvasPt.x, y: canvasPt.y });
				setNodeContextMenu(null);
				setLinkOutContext(null);
			}}
			className={`relative min-h-0 min-w-[800px] flex-1 overflow-hidden bg-background ${dragOver ? "ring-2 ring-accent/40 ring-inset" : ""}`}
		>
			{/* 网格背景层 —— 不随 viewport transform，保持固定；步长 0（关闭）时整层不渲染 */}
			{snapOn && (
				<div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: `${gridStep}px ${gridStep}px`, color: "var(--color-border)" }} />
			)}

			{/* ── viewport transform 容器 ──
			    节点、连线 SVG、分组区域都在这个 transform 之下。
			    平移单位是"屏幕 px"，scale 是"画布单位 → 屏幕 px"的倍率。 */}
			<div
				style={{
					transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
					transformOrigin: "0 0",
				}}
			>
				{/* 分组节点作为普通节点渲染 - 不再默认显示固定分组 */}

				{/* 对齐辅助线（画布坐标，viewport 变换下） */}
				{guidesOn && guides && (guides.x !== undefined || guides.y !== undefined) && (
					<svg className="pointer-events-none absolute overflow-visible" style={{ left: -SVG_ORIGIN, top: -SVG_ORIGIN, width: SVG_ORIGIN * 2, height: SVG_ORIGIN * 2 }}>
						<g transform={`translate(${SVG_ORIGIN} ${SVG_ORIGIN})`} strokeWidth={1 / viewport.scale} opacity={0.75} style={{ stroke: "var(--color-accent)" }}>
							{guides.x !== undefined && <line x1={guides.x} y1={-4000} x2={guides.x} y2={4000} />}
							{guides.y !== undefined && <line x1={-4000} y1={guides.y} x2={4000} y2={guides.y} />}
						</g>
					</svg>
				)}

				{/* SVG 连线（hover 高亮 + 中点 × 删除按钮） —— 用超大 CSS 尺寸避免 viewBox 裁剪 */}
				<svg className="absolute overflow-visible" style={{ left: -SVG_ORIGIN, top: -SVG_ORIGIN, width: SVG_ORIGIN * 2, height: SVG_ORIGIN * 2 }}>
					<g transform={`translate(${SVG_ORIGIN} ${SVG_ORIGIN})`}>
					{links.map((l) => {
						const isHover = hoverLink === l.id;
						const mid = linkMid(l, nodes);
						return (
							<g key={l.id}>
								<path
									d={linkPath(l, nodes)}
									fill="none"
									stroke="transparent"
									strokeWidth={10}
									strokeLinecap="round"
									style={{ pointerEvents: "stroke" }}
									onPointerEnter={() => setHoverLink(l.id)}
									onPointerLeave={() => setHoverLink((prev) => prev === l.id ? null : prev)}
								/>
								<path
									d={linkPath(l, nodes)}
									fill="none"
									strokeWidth={isHover ? 2.5 : 1.5}
									strokeLinecap="round"
									opacity={isHover ? 1 : 0.6}
									// 连线色可能是 CSS 变量（图表节点取系列色），必须走 style —— SVG 属性不接受 var()
									style={{ stroke: l.tone, pointerEvents: "none" }}
								/>
								{isHover && (
									<g
										style={{ pointerEvents: "all" }}
										onPointerDown={(e) => {
											e.stopPropagation();
											setLinks((prev) => prev.filter((p) => p.id !== l.id));
											setHoverLink(null);
										}}
									>
										<circle cx={mid.x} cy={mid.y} r={10} strokeWidth={1.5} style={{ fill: "var(--color-surface-raised)", stroke: "var(--color-border-strong)" }} />
										<path
											d={`M ${mid.x - 3.5} ${mid.y - 3.5} L ${mid.x + 3.5} ${mid.y + 3.5} M ${mid.x + 3.5} ${mid.y - 3.5} L ${mid.x - 3.5} ${mid.y + 3.5}`}
											strokeWidth={1.6}
											strokeLinecap="round"
											style={{ stroke: "var(--color-danger)" }}
										/>
									</g>
								)}
							</g>
						);
					})}
					</g>
				</svg>

				{/* 临时连线（拖拽中） —— 同样用超大尺寸避免裁剪 */}
				{pendingLink && (
					<svg className="pointer-events-none absolute overflow-visible" style={{ left: -SVG_ORIGIN, top: -SVG_ORIGIN, width: SVG_ORIGIN * 2, height: SVG_ORIGIN * 2 }}>
						<g transform={`translate(${SVG_ORIGIN} ${SVG_ORIGIN})`}>
						<path
							d={(() => {
								// 从输入插槽向左拉时控制点镜像，否则线会先往右甩再编回来
								const sign = pendingLink.dir === "out" ? 1 : -1;
								const bend = Math.max(36, Math.abs(pendingLink.x2 - pendingLink.x1) * 0.5) * sign;
								return `M ${pendingLink.x1} ${pendingLink.y1} C ${pendingLink.x1 + bend} ${pendingLink.y1}, ${pendingLink.x2 - bend} ${pendingLink.y2}, ${pendingLink.x2} ${pendingLink.y2}`;
							})()}
							fill="none"
							strokeWidth={1.75}
							strokeDasharray="6 4"
							opacity={0.8}
							// 待定连线与正式连线同色，同样走 wireTone + style
							style={{ stroke: wireTone(nodes[pendingLink.from]?.tone, isChartKind(nodes[pendingLink.from]?.kind)) }}
						/>
						</g>
					</svg>
				)}

				{/* 动态渲染所有节点 */}
				{(Object.keys(nodes) as NodeId[]).map((id) => {
					const n = nodes[id];
					if (!n) return null;
					const kind = n.kind ?? "";
					const values = n.values ?? {};
					const result = nodeResults[id];
					const title = (values.title as string) ?? kind ?? id;

					const isGroup = n.isGroup || kind.startsWith("group-");
					const isSource = kind.startsWith("source-");
					const isChart = isChartKind(kind);
					const isMetric = kind.startsWith("metric-");
					const isFilter = kind.startsWith("filter-");
					const isOutput = kind.startsWith("output-");
					const isAdv = kind.startsWith("adv-");
					const isScreen = kind.startsWith("screen-");

					// screen-page 是容器类，无 outputs；screen-map outputs 正常
					const isScreenContainer = kind === "screen-page";

					const inputs: { row: number; tone: string }[] = (isSource || isGroup) ? [] : [{ row: 0, tone: TONE.table }];
					// 图表类节点的色调跟随画布调色板（系列色 1）：换调色板时画布主体立刻有反馈；
					// 其余节点仍是「数据类型」语义色，不受调色板影响。
					const outputs: { row: number; tone: string }[] = (isOutput || isAdv || isGroup || isScreenContainer) ? [] : [{ row: 0, tone: wireTone(isSource ? TONE.table : (isScreen ? TONE.chart : TONE.result), isChart) }];

					// 非图表节点（指标 / 通用节点）沿用既有兜底值；图表节点不再走哈希序列，见下方 chartData。
					const placeholderValues = result && result.columns.length > 0
						? result.rows.slice(0, 14).map((r) => {
							const numVal = Object.values(r).find((v) => typeof v === "number");
							return typeof numVal === "number" ? numVal : 0;
						})
						: hashValues(`node-${id}`, 14, 30, 88);

					// 图表节点的唯一数据入口：自身结果 → 上游结果 → 显式「无数据」。
					const chartData = isChart
						? resolveNodeChartData(kind, values, result ?? null, getUpstreamResult ? getUpstreamResult(id) : null)
						: null;

					const kindIcon = isGroup ? (n.groupIcon ?? "icon-[lucide--layers]") :
						isSource ? "icon-[lucide--database]" :
						isChart ? "icon-[lucide--chart-line]" :
						isMetric ? "icon-[lucide--calculator]" :
						isFilter ? "icon-[lucide--list-filter]" :
						isOutput ? "icon-[lucide--layout-dashboard]" :
						isAdv ? "icon-[lucide--sparkles]" :
						isScreen ? "icon-[lucide--monitor]" :
						"icon-[lucide--circle]";

					const kindLabel = isGroup ? "分组" :
						isSource ? "数据源" :
						isChart ? "图表" :
						isMetric ? "指标" :
						isFilter ? "控件" :
						isOutput ? "输出" :
						isAdv ? "高级" :
						isScreen ? "大屏" : kind;

					return (
						<NodeCard
							key={id}
							{...n}
							onToggleCollapse={() => toggleCollapse(id)}
							// 覆盖展开的 tone：图表类节点用系列色，使调色板对画布卡片可见；
							// 与输出插槽、连线同源（link-tone.ts），三者不会再出现色差
							tone={wireTone(n.tone, isChart)}
							nodeId={id}
							onPointerDown={(e) => startDrag(id, e)}
							onResizeStart={(corner, e) => startResize(id, corner, e)}
							socketHandlers={socketHandlers}
							onNodeContextMenu={(nodeId, cx, cy) => {
								const canvasPt = screenToCanvas(cx, cy);
								// 先选中（单选右键 → 选中并弹出菜单），方便后续复制/删除
								setNodes((prev) => {
									const next = { ...prev };
									let changed = false;
									for (const k of Object.keys(next) as NodeId[]) {
										if (next[k].selected !== (k === nodeId)) {
											next[k] = { ...next[k], selected: k === nodeId };
											changed = true;
										}
									}
									return changed ? next : prev;
								});
								setNodeContextMenu({ nodeId, x: canvasPt.x, y: canvasPt.y });
							}}
							title={title}
							type={kindLabel}
							icon={kindIcon}
							inputs={inputs}
							outputs={outputs}
						>
							{/* 数据源类节点 — 按 kind 差异化内部 UI */}
							{isSource && (
								<>
									{kind === "source-sql" && (
										<>
											{values.sql ? (
												<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface px-1.5 py-1 font-mono text-[9.5px] leading-[13px] text-muted">
													{String(values.sql).split("\n").slice(0, 4).map((line, i) => (
														<div key={i}>{line}</div>
													))}
												</div>
											) : (
												<NodeRow label="SQL"><NodeValue>PropertyInspector 输入 SQL</NodeValue></NodeRow>
											)}
										</>
									)}
									{kind === "source-table" && (
										<>
											<NodeRow label="表名"><NodeValue mono>{String(values.table ?? "(未指定)")}</NodeValue></NodeRow>
											{values.limit != null && <NodeRow label="Limit"><NodeValue mono>{String(values.limit)}</NodeValue></NodeRow>}
										</>
									)}
									{kind === "source-connector" && (
										<>
											<NodeRow label="连接"><NodeValue mono>{String(values.connectionId ?? values.datasourceId ?? "(未选择)")}</NodeValue></NodeRow>
											<NodeRow label="表名"><NodeValue mono>{String(values.tableName ?? values.table ?? "(未指定)")}</NodeValue></NodeRow>
										</>
									)}
									{kind === "source-csv" && (
										<>
											<div className="mt-1 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[4px] border border-dashed border-border bg-surface p-1.5">
												<span className="icon-[lucide--file-text] size-4 text-faint" />
												<span className="mt-0.5 text-[9px] text-muted">{String(values.fileName ?? "data.csv")}</span>
												<span className="text-[9px] text-faint">{result ? `${result.rowCount} 行 · ${result.columns.length} 列` : "本地文件"}</span>
											</div>
										</>
									)}
									{kind === "source-api" && (
										<>
											<NodeRow label="URL"><NodeValue mono><span className="truncate">{String(values.url ?? "/api/endpoint")}</span></NodeValue></NodeRow>
											<NodeRow label="方法"><NodeSeg options={["GET", "POST"]} active={String(values.method ?? "GET")} /></NodeRow>
										</>
									)}
									{kind === "source-extract" && (
										<>
											<NodeRow label="任务"><NodeValue mono>{String(values.extractId ?? "(未配置)")}</NodeValue></NodeRow>
											<NodeRow label="类型"><NodeValue>{String(values.extractType ?? "抽取")}</NodeValue></NodeRow>
										</>
									)}
									{/* 通用执行结果条（所有数据源节点共享） */}
									{result && (
										<NodeRow label="结果">
											<NodeValue mono>
												{result.error
													? <span className="text-danger">✗ {result.error.slice(0, 24)}</span>
													: <>{result.rowCount} 行 · {result.columns.length} 列 · {result.durationMs}ms</>
												}
											</NodeValue>
										</NodeRow>
									)}
								</>
							)}

							{isChart && chartData && (
								<div className="group relative mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] border border-border bg-surface p-1 text-[10px] text-muted">
							{
									renderChartBody(kind, chartData, values)}
									{chartData.status === "ok" && ECHARTS_KINDS.has(kind) ? (
										<button
											type="button"
											title="放大图表"
											onPointerDown={(e) => e.stopPropagation()}
											onClick={(e) => { e.stopPropagation(); setMagnify({ id, kind }); }}
											className="absolute right-7 top-6 z-10 grid size-5 place-items-center rounded-control bg-surface-raised text-faint opacity-0 shadow hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
										>
											<span className="icon-[lucide--maximize-2] size-3" />
										</button>
									) : null}
								</div>
								)}

							{isMetric && (
								<div className="mt-1 flex flex-1 flex-col items-center justify-center">
									<span className="font-mono text-[22px] font-bold text-surface-foreground">
										{placeholderValues[0] ?? "—"}
									</span>
									<span className="text-[10px] text-muted">{title}</span>
								</div>
							)}

							{isFilter && kind === "filter-text" && (
								<>
									<NodeRow label="文本"><NodeSelect>{String(values.placeholder ?? "输入关键字...")}</NodeSelect></NodeRow>
									{values.field && <NodeRow label="字段"><NodeValue mono>{String(values.field)}</NodeValue></NodeRow>}
								</>
							)}

							{isFilter && kind === "filter-date" && (
								<>
									<NodeRow label="日期"><NodeSelect>{String(values.field ?? "选择日期范围")}</NodeSelect></NodeRow>
									<NodeRow label="模式"><NodeSeg options={["range", "single"]} active={String(values.mode ?? "range")} /></NodeRow>
								</>
							)}

							{isFilter && kind !== "filter-text" && kind !== "filter-date" && (
								<NodeRow label="类型"><NodeValue>{kind.replace("filter-", "")}</NodeValue></NodeRow>
							)}

							{kind === "adv-summary" && (
								<div className="mt-1 flex flex-1 flex-col items-center justify-center">
									<span className="font-mono text-[22px] font-bold text-surface-foreground">
										{result?.columns.length ? String(result.rows[0]?.[result.columns[0]] ?? "—") : (placeholderValues[0] ?? "—")}
									</span>
									<span className="text-[10px] text-muted">{String(values.metric ?? title)}</span>
								</div>
							)}

							{kind === "adv-tabs" && (
								<div className="mt-1 flex min-h-0 flex-1 flex-col rounded-[4px] border border-border bg-surface">
									<div className="flex shrink-0 gap-1 border-b border-border px-1 pt-1">
										{["概览", "明细", "趋势"].map((t, i) => (
											<span key={t} className={`rounded-t-[3px] px-1.5 py-0.5 text-[10px] ${i === 0 ? "bg-background text-surface-foreground" : "text-faint"}`}>{t}</span>
										))}
									</div>
									<div className="flex-1" />
								</div>
							)}

							{(kind === "adv-table" || kind === "output-table") && renderTableBody(result, values)}

							{kind === "adv-calendar" && (
								<div className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-px rounded-[4px] border border-border bg-surface p-1 text-[9px]">
									{["日", "一", "二", "三", "四", "五", "六"].map((d) => (
										<div key={d} className="text-center text-faint">{d}</div>
									))}
									{Array.from({ length: 28 }).map((_, i) => (
										<div key={i} className="aspect-square grid place-items-center rounded-[2px] text-muted">
											{i + 1}
										</div>
									))}
								</div>
							)}

							{isOutput && kind !== "output-table" && (
								<div className="mt-1 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-1 rounded-[4px] border border-border bg-surface p-1">
									<span className="col-span-3 rounded-[2px] bg-background" />
									<span className="rounded-[2px] bg-background" />
									<span className="col-span-2 rounded-[2px]" style={{ background: n.tone + "33" }} />
								</div>
							)}

							{isGroup && (
								<div className="mt-1 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[4px] border border-dashed border-border bg-surface/30 p-2">
									<span className={n.groupIcon ?? "icon-[lucide--layers]"} style={{ width: 24, height: 24, color: "var(--color-muted)" }} />
									<span className="mt-1 text-[10px] text-muted">{n.groupLabel ?? "分组"}</span>
									<span className="mt-0.5 text-[9px] text-faint">拖入节点到此分组</span>
								</div>
							)}

							{kind === "screen-page" && (
								<div className="mt-1 flex min-h-0 flex-1 items-center justify-between rounded-[4px] border border-border bg-surface px-2">
									<span className="text-[10px] text-muted">{title}</span>
									<div className="flex items-center gap-1">
										<span className="size-1.5 rounded-full" style={{ background: "var(--color-series-1)" }} />
										<span className="size-1.5 rounded-full border border-border" />
										<span className="size-1.5 rounded-full border border-border" />
									</div>
								</div>
							)}

							{kind === "screen-map" && (
								<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface p-1">
									<svg viewBox="0 0 280 220" className="h-full w-full">
										<defs>
											<linearGradient id="map-bg" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.12" />
												<stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.04" />
											</linearGradient>
										</defs>
										{/* 世界地图简化轮廓 */}
										<path
											d="M30 140 Q50 80 90 70 Q120 65 150 80 Q170 60 200 55 Q230 50 250 70 Q265 90 260 120 Q250 140 230 145 Q200 155 170 150 Q140 155 110 160 Q80 158 55 155 Q38 152 30 140 Z"
											fill="url(#map-bg)"
											style={{ stroke: SERIES[0] }}
											strokeWidth="1.5"
										/>
										{/* 数据点 */}
										{[
											{ x: 80, y: 100, r: 3 },
											{ x: 130, y: 115, r: 4 },
											{ x: 180, y: 90, r: 2.5 },
											{ x: 210, y: 125, r: 3.5 },
											{ x: 100, y: 135, r: 2 },
										].map((p, i) => (
											<g key={i}>
												<circle cx={p.x} cy={p.y} r={p.r + 3} opacity="0.18" style={{ fill: SERIES[i % SERIES.length] }} />
												<circle cx={p.x} cy={p.y} r={p.r} style={{ fill: SERIES[i % SERIES.length] }} />
											</g>
										))}
									</svg>
								</div>
							)}

							{!isSource && !isChart && !isMetric && !isFilter && !isOutput && !isAdv && !isGroup && !isScreenContainer && kind !== "screen-map" && (
								<NodeRow label="类型"><NodeValue>{kind || "(未配置)"}</NodeValue></NodeRow>
							)}
						</NodeCard>
					);
				})}
			</div>

			{/* ── 选中节点浮动工具条（放在 viewport 外面，但仍在 transform 容器外、canvas 容器内） ──
			    用 canvasToScreen（视口坐标）会多算一次 rect.left/top，而 absolute 定位以 canvas 容器为参照，
			    两者差一个容器偏移，导致工具条明显偏离节点；改用容器坐标（viewport.tx/ty + 画布坐标×scale），
			    与下方案框(selectionBox)、右键菜单(NodeContextMenu)保持一致。 */}
			{(() => {
				const selId = Object.keys(nodes).find((k) => nodes[k].selected);
				if (!selId) return null;
				const sel = nodes[selId];
				const screen = { x: viewport.tx + sel.x * viewport.scale, y: viewport.ty + (sel.y + sel.h + 8) * viewport.scale };
				return (
					<div
						data-node-action-bar
						onPointerDown={(e) => e.stopPropagation()}
						className="absolute z-30 flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface-raised px-1 shadow"
						style={{ left: screen.x, top: screen.y }}
					>
						<button title="复制节点" type="button"
							onClick={() => {
								duplicateSelection();
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className="icon-[lucide--copy] size-3" />
						</button>
						<button title={sel.muted ? "启用节点" : "停用节点"} type="button"
							onClick={() => {
								toggleMute([selId]);
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className={sel.muted ? "icon-[lucide--circle-play] size-3" : "icon-[lucide--ban] size-3"} />
						</button>
						<button title="只运行这个节点" type="button"
							onClick={() => {
								selectOnly(selId);
								onRunNode?.(selId);
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className="icon-[lucide--play] size-3" />
						</button>
						<span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
						<button title="删除节点" type="button"
							onClick={() => removeNodes([selId])}
							className="grid size-5 place-items-center rounded-control text-danger hover:bg-danger/10">
							<span className="icon-[lucide--trash-2] size-3" />
						</button>
					</div>
				);
			})()}

			{/* ── 框选矩形（放在 viewport 外面、canvas 容器内 → 用容器坐标 + 反向 viewport 变换）
                 canvasToScreen 返回视口坐标（含 rect.left/top），但 absolute 定位原点是容器左上角
                 所以直接用 tx + cx * scale 算容器内偏移 */}
			{selectionBox && (() => {
				const v = viewport;
				const x1 = v.tx + selectionBox.startX * v.scale;
				const y1 = v.ty + selectionBox.startY * v.scale;
				const x2 = v.tx + selectionBox.endX * v.scale;
				const y2 = v.ty + selectionBox.endY * v.scale;
				const x = Math.min(x1, x2);
				const y = Math.min(y1, y2);
				const w = Math.abs(x2 - x1);
				const h = Math.abs(y2 - y1);
				return (
					<div
						className="pointer-events-none absolute z-40 border-2 border-accent bg-accent/10"
						style={{ left: x, top: y, width: w, height: h }}
					/>
				);
			})()}

			{/* ── 缩略图导航（放在 viewport 外面，不受 transform 影响） ── */}
			<Minimap
				nodes={nodes}
				links={links}
				viewport={viewport}
				canvasRef={canvasRef}
				onViewportChange={(tx, ty) => setViewport((v) => ({ ...v, tx, ty }))}
			/>

			{/* ── 画布空白区右键 AddNodeMenu（无遮罩，直接浮在画布上） ── */}
			{contextMenu ? (
				<AddNodeMenu
					x={viewport.tx + contextMenu.x * viewport.scale}
					y={viewport.ty + contextMenu.y * viewport.scale}
					onClose={() => setContextMenu(null)}
					onPick={(kind, initial) => {
						insertNode(kind, contextMenu.x - 60, contextMenu.y - 30, initial);
						setContextMenu(null);
					}}
				/>
			) : null}

			{/* ── output socket 连线末端弹出的 AddNodeMenu ── */}
			{linkOutContext ? (
				<AddNodeMenu
					x={viewport.tx + linkOutContext.x * viewport.scale}
					y={viewport.ty + linkOutContext.y * viewport.scale}
					onClose={() => { setLinkOutContext(null); setPendingLink(null); pendingRef.current = null; }}
					onPick={(kind, initial) => {
						const { id: newId } = insertNode(kind, linkOutContext.x + 160, linkOutContext.y - 30, initial);
						// 自动完成连线：pendingLink.from → 新节点 input socket（row 0）
						const tone = wireTone(nodes[linkOutContext.from]?.tone, isChartKind(nodes[linkOutContext.from]?.kind));
						setLinks((prev) => [...prev, {
							id: nextLinkId(),
							from: linkOutContext.from,
							fromRow: linkOutContext.fromRow,
							to: newId,
							toRow: 0,
							tone,
						}]);
						setLinkOutContext(null);
						setPendingLink(null);
						pendingRef.current = null;
					}}
				/>
			) : null}

			{/* ── 节点专属右键菜单（放在 viewport 外面，用屏幕坐标） ── */}
			{nodeContextMenu ? (
				<NodeContextMenu
					x={viewport.tx + nodeContextMenu.x * viewport.scale}
					y={viewport.ty + nodeContextMenu.y * viewport.scale}
					onClose={() => setNodeContextMenu(null)}
					muted={nodes[nodeContextMenu.nodeId]?.muted ?? false}
					locked={nodes[nodeContextMenu.nodeId]?.locked ?? false}
					collapsed={nodes[nodeContextMenu.nodeId]?.collapsed ?? false}
					onToggleLock={() => {
						toggleLock([nodeContextMenu.nodeId]);
						setNodeContextMenu(null);
					}}
					onToggleCollapse={() => {
						toggleCollapse(nodeContextMenu.nodeId);
						setNodeContextMenu(null);
					}}
					onCopy={() => {
						duplicateNode(nodeContextMenu.nodeId);
						setNodeContextMenu(null);
					}}
					onRunThis={() => {
						selectOnly(nodeContextMenu.nodeId);
						onRunNode?.(nodeContextMenu.nodeId);
						setNodeContextMenu(null);
					}}
					onDisable={() => {
						toggleMute([nodeContextMenu.nodeId]);
					}}
					onDelete={() => {
						removeNodes([nodeContextMenu.nodeId]);
					}}
				/>
			) : null}

			{/* 图表放大浮层：生成大图预览，点遮罩或 Esc 关闭 */}
			{magnify && (() => {
				const mn = nodes[magnify.id];
				if (!mn) return null;
				const result = nodeResults[magnify.id] ?? null;
				const { data: chartData, option } = buildChartTile(magnify.kind, mn.values ?? {}, result, getUpstreamResult ? getUpstreamResult(magnify.id) : null);
				return (
					<div
						className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-8"
						onPointerDown={(e) => { if (e.target === e.currentTarget) setMagnify(null); }}
						onKeyDown={(e) => { if (e.key === "Escape") setMagnify(null); }}
						tabIndex={0}
					>
					<div className="relative flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]">
						<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
							<span className="text-[12px] font-medium text-surface-foreground">{(mn.values?.title as string) || magnify.kind || "图表"} — 放大</span>
							<span className="font-mono text-[10px] text-faint">{chartData.status === "ok" ? `${chartData.rowCount} 行` : chartData.note}</span>
							<button type="button" onClick={() => setMagnify(null)}
								className="ml-auto grid size-7 place-items-center rounded-control text-muted hover:bg-neutral-muted hover:text-surface-foreground" title="关闭">
								<span className="icon-[lucide--x] size-4" />
							</button>
						</div>
						<div className="dbx-scroll min-h-0 flex-1 overflow-auto p-4">
							{option ? <EChart option={option} className="h-[78vh] w-full" /> : <div className="grid h-full place-items-center text-[12px] text-muted">该图表无可用数据</div>}
						</div>
					</div>
				</div>
				);
			})()}
		</div>
	);
}

// ── Minimap（缩略图）子组件 ──
/** 缩略图：显示所有节点 + 当前 viewport 可视区矩形框 + 点击跳转 + 拖动平移主画布 */
interface MinimapProps {
	nodes: Record<NodeId, NodePos>;
	links: Link[];
	viewport: { scale: number; tx: number; ty: number };
	canvasRef: React.RefObject<HTMLDivElement | null>;
	onViewportChange: (tx: number, ty: number) => void;
}

/** 画布参考尺寸（和原缩略图用的 880×864 一致） */
const MAP_W = 880;
const MAP_H = 864;

function Minimap({ nodes, viewport, canvasRef, onViewportChange }: MinimapProps): JSX.Element {
	const MINI_W = 112;
	const MINI_H = 80;

	// 计算缩略图中 viewport 矩形的位置/尺寸
	function viewportRectInMap(): { x: number; y: number; w: number; h: number } {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0, w: MINI_W, h: MINI_H };
		// 可视画布区域（画布坐标系）
		const vw = rect.width / viewport.scale;
		const vh = rect.height / viewport.scale;
		// 左上角画布坐标
		const vx = -viewport.tx / viewport.scale;
		const vy = -viewport.ty / viewport.scale;
		// 缩略图用画布坐标系比例
		return {
			x: (vx / MAP_W) * MINI_W,
			y: (vy / MAP_H) * MINI_H,
			w: (vw / MAP_W) * MINI_W,
			h: (vh / MAP_H) * MINI_H,
		};
	}

	// 点击缩略图空白区 → 平移到目标位置
	function onMiniPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const lx = e.clientX - rect.left;
		const ly = e.clientY - rect.top;
		// 缩略图坐标 → 画布坐标 → 算 tx/ty
		const canvasX = (lx / MINI_W) * MAP_W;
		const canvasY = (ly / MINI_H) * MAP_H;
		const cRect = canvasRef.current?.getBoundingClientRect();
		if (!cRect) return;
		// 让缩略图点对准画布中心点
		const ntx = cRect.width / 2 - canvasX * viewport.scale;
		const nty = cRect.height / 2 - canvasY * viewport.scale;
		onViewportChange(ntx, nty);
	}

	// 拖动 viewport 框 → 实时平移
	const dragRef = useRef<{ startX: number; startY: number; vx0: number; vy0: number } | null>(null);
	function onViewportBoxPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		e.stopPropagation();
		e.preventDefault();
		const rect = e.currentTarget.parentElement?.getBoundingClientRect();
		if (!rect) return;
		const vr = viewportRectInMap();
		dragRef.current = {
			startX: e.clientX - rect.left,
			startY: e.clientY - rect.top,
			vx0: vr.x,
			vy0: vr.y,
		};
	}
	useEffect(() => {
		function onMove(e: PointerEvent) {
			if (!dragRef.current) return;
			const rect = (e.target as HTMLElement).closest("[data-minimap-root]")?.getBoundingClientRect();
			if (!rect) return;
			const lx = e.clientX - rect.left;
			const ly = e.clientY - rect.top;
			const dx = lx - dragRef.current.startX;
			const dy = ly - dragRef.current.startY;
			// 缩略图位移 → 画布坐标位移 → 新 tx/ty
			const canvasDx = (dx / MINI_W) * MAP_W;
			const canvasDy = (dy / MINI_H) * MAP_H;
			onViewportChange(
				viewport.tx + canvasDx * viewport.scale,
				viewport.ty + canvasDy * viewport.scale,
			);
		}
		function onUp() { dragRef.current = null; }
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, [viewport, onViewportChange]);

	const vr = viewportRectInMap();

	return (
		<div
			data-minimap-root
			onPointerDown={onMiniPointerDown}
			className="absolute bottom-3 right-4 h-20 w-28 cursor-grab overflow-hidden rounded-control border border-border bg-background/90 p-1"
		>
			<div className="relative h-full w-full">
				{(Object.keys(nodes) as NodeId[]).map((id) => {
					const n = nodes[id];
					return (
						<span
							key={id}
							className="absolute rounded-[1px]"
							style={{
								left: `${(n.x / MAP_W) * 100}%`,
								top: `${(n.y / MAP_H) * 100}%`,
								width: `${(n.w / MAP_W) * 100}%`,
								height: `${(n.h / MAP_H) * 100}%`,
								background: n.tone,
								opacity: 0.65,
							}}
						/>
					);
				})}
				{/* viewport 可视区矩形框 */}
				<div
					onPointerDown={onViewportBoxPointerDown}
					className="absolute cursor-grab rounded-[1px] border border-accent/80 bg-accent/10"
					style={{ left: vr.x, top: vr.y, width: vr.w, height: vr.h }}
				/>
			</div>
		</div>
	);
}

// ── NodeContextMenu（节点专属右键菜单）子组件 ──
interface NodeContextMenuProps {
	x: number;
	y: number;
	onClose: () => void;
	onCopy: () => void;
	onRunThis: () => void;
	/** 节点是否已停用 —— 决定显示「停用节点」还是「启用节点」。 */
	muted: boolean;
	/** 是否已锁定 —— 决定显示「锁定节点」还是「解锁节点」。 */
	locked: boolean;
	/** 是否已折叠 —— 决定显示「折叠节点」还是「展开节点」。 */
	collapsed: boolean;
	onToggleLock: () => void;
	onToggleCollapse: () => void;
	onDisable: () => void;
	onDelete: () => void;
}

function NodeContextMenu({ x, y, muted, locked, collapsed, onClose, onCopy, onRunThis, onDisable, onToggleLock, onToggleCollapse, onDelete }: NodeContextMenuProps): JSX.Element {
	useEffect(() => {
		function onClick() { onClose(); }
		// 用 setTimeout 避免 mousedown 触发立即关闭
		const t = setTimeout(() => {
			window.addEventListener("mousedown", onClick);
		}, 0);
		return () => {
			clearTimeout(t);
			window.removeEventListener("mousedown", onClick);
		};
	}, [onClose]);

	const items: { icon: string; label: string; onClick: () => void; danger?: boolean }[] = [
		{ icon: "icon-[lucide--copy]", label: "复制节点", onClick: onCopy },
		{ icon: "icon-[lucide--play]", label: "只运行这个节点", onClick: onRunThis },
		{ icon: muted ? "icon-[lucide--circle-play]" : "icon-[lucide--ban]", label: muted ? "启用节点" : "停用节点", onClick: onDisable },
		{ icon: collapsed ? "icon-[lucide--chevrons-up-down]" : "icon-[lucide--chevrons-down-up]", label: collapsed ? "展开节点" : "折叠节点", onClick: onToggleCollapse },
		{ icon: locked ? "icon-[lucide--lock-open]" : "icon-[lucide--lock]", label: locked ? "解锁节点" : "锁定节点", onClick: onToggleLock },
	];

	const dangerItems = [
		{ icon: "icon-[lucide--trash-2]", label: "删除节点", onClick: onDelete },
	];

	return (
		<div
			data-context-menu
			onPointerDown={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			className="absolute z-30 max-h-[240px] w-[180px] overflow-y-auto rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			<div className="py-1">
				{items.map((it) => (
					<button
						key={it.label}
						type="button"
						onClick={(e) => { e.stopPropagation(); it.onClick(); }}
						className="flex h-7 w-full items-center gap-2 px-2.5 text-[11px] text-surface-foreground hover:bg-accent-soft hover:text-accent"
					>
						<Icon name={it.icon} className="size-3.5 shrink-0" />
						<span>{it.label}</span>
					</button>
				))}
			</div>
			<div className="mx-2 h-px bg-border" />
			<div className="py-1">
				{dangerItems.map((it) => (
					<button
						key={it.label}
						type="button"
						onClick={(e) => { e.stopPropagation(); it.onClick(); }}
						className="flex h-7 w-full items-center gap-2 px-2.5 text-[11px] text-danger hover:bg-danger/10"
					>
						<Icon name={it.icon} className="size-3.5 shrink-0" />
						<span>{it.label}</span>
					</button>
				))}
			</div>
		</div>
	);
}
