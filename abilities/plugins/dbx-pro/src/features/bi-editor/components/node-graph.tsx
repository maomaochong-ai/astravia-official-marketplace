/**
 * node-graph.tsx — 节点画布（设计稿 NodeGraph.tsx 插件化版本）。
 *
 * 数据流节点：数据集 → SQL → 图表 → 看板产物。
 * nodes 驱动坐标 + rowDy() 算插槽位置 → 连线端点永远落在插槽上。
 */

import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as RPointerEvent, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { NodeCard, NodeRow, NodeValue, NodeSelect, NodeSeg, rowDy, TONE } from "./node-card";
import { AreaChart, Donut, SERIES } from "./charts";
import { Chip } from "./ui/chip";
import { AiNodePanel } from "./ai-node-panel";
import { engineRequest } from "../../../shared/services/engine-client";

// ── 类型 ──
export interface NodePos {
	x: number; y: number; w: number; h: number;
	tone: string; selected?: boolean;
	/** 节点类型 key，对应 NODE_TEMPLATES 条目（source-sql / chart-bar / ...） */
	kind?: string;
}
export type NodeId = string;
export interface Link {
	id: string;
	from: NodeId; fromRow: number; to: NodeId; toRow: number; tone: string;
}

let LINK_SEQ = 0;
function nextLinkId(): string { LINK_SEQ++; return `l${LINK_SEQ}`; }

// ── 初始状态（后续 useState 注入） ──
export const INITIAL_NODES: Record<NodeId, NodePos> = {
	ds1:   { x: 16,   y: 56,  w: 180, h: 118, tone: TONE.table },
	sql:   { x: 220,  y: 56,  w: 192, h: 164, tone: TONE.result },
	line:  { x: 436,  y: 40,  w: 216, h: 222, tone: TONE.chart, selected: true },
	ds2:   { x: 16,   y: 490, w: 180, h: 118, tone: TONE.table },
	donut: { x: 436,  y: 470, w: 216, h: 206, tone: TONE.chart },
	out:   { x: 700,  y: 300, w: 164, h: 194, tone: TONE.chart },
};

export const INITIAL_LINKS: Link[] = [
	{ id: nextLinkId(), from: "ds1",   fromRow: 0, to: "sql",   toRow: 0, tone: TONE.table },
	{ id: nextLinkId(), from: "sql",   fromRow: 1, to: "line",  toRow: 0, tone: TONE.result },
	{ id: nextLinkId(), from: "ds2",   fromRow: 0, to: "donut", toRow: 0, tone: TONE.table },
	{ id: nextLinkId(), from: "line",  fromRow: 4, to: "out",  toRow: 0, tone: TONE.chart },
	{ id: nextLinkId(), from: "donut", fromRow: 3, to: "out",  toRow: 1, tone: TONE.chart },
];

const GROUPS = [
	{ x: 4, y: 40, w: 204, h: 592, label: "数据源", count: "2", icon: "icon-[lucide--database]" },
	{ x: 212, y: 40, w: 208, h: 190, label: "SQL 查询", count: "1", icon: "icon-[lucide--scroll-text]" },
	{ x: 428, y: 24, w: 440, h: 668, label: "图表与产物", count: "3", icon: "icon-[lucide--chart-line]" },
];

function linkPath(l: Link, nodes: Record<NodeId, NodePos>): string {
	const a = nodes[l.from];
	const b = nodes[l.to];
	const x1 = a.x + a.w;
	const y1 = a.y + rowDy(l.fromRow);
	const x2 = b.x;
	const y2 = b.y + rowDy(l.toRow);
	const bend = Math.max(36, (x2 - x1) * 0.5);
	return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** 贝塞尔曲线 t=0.5 的中点坐标（连线中点，用于 hover 按钮定位）。 */
function linkMid(l: Link, nodes: Record<NodeId, NodePos>): { x: number; y: number } {
	const a = nodes[l.from], b = nodes[l.to];
	const x1 = a.x + a.w, y1 = a.y + rowDy(l.fromRow);
	const x2 = b.x, y2 = b.y + rowDy(l.toRow);
	const bend = Math.max(36, (x2 - x1) * 0.5);
	const cx1 = x1 + bend, cy1 = y1;
	const cx2 = x2 - bend, cy2 = y2;
	// cubic-bezier t=0.5 闭式
	const t = 0.5;
	const mt = 1 - t;
	const x = mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2;
	const y = mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2;
	return { x, y };
}

const TOOLBOX = [
	{ icon: "icon-[lucide--copy]", title: "复制节点" },
	{ icon: "icon-[lucide--zap]", title: "停用（旁路）" },
	{ icon: "icon-[lucide--play]", title: "只运行这个节点" },
	{ icon: "icon-[lucide--ellipsis]", title: "更多" },
];

/** GMV 14 天数据（模拟）。 */
const GMV = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];

/** 渠道构成占比。 */
const CHANNELS = [
	{ value: 46, color: SERIES[0] },
	{ value: 27, color: SERIES[1] },
	{ value: 17, color: SERIES[2] },
	{ value: 10, color: SERIES[3] },
];

export interface NodeGraphProps {
	nodes: Record<NodeId, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<NodeId, NodePos>>>;
	links: Link[];
	setLinks: Dispatch<SetStateAction<Link[]>>;
}

/** 节点模板注册表——DnD 创建新节点时按模板生成默认属性。
 *  key 即 kind，kind 存入 NodePos.kind 后 PropertyInspector 按此渲染表单。 */
export const NODE_TEMPLATES: Record<string, Omit<NodePos, "x" | "y">> = {
	"source-sql":   { w: 180, h: 118, tone: TONE.table, kind: "source-sql" },
	"source-table": { w: 180, h: 96,  tone: TONE.table, kind: "source-table" },
	"source-api":   { w: 180, h: 96,  tone: TONE.table, kind: "source-api" },
	"chart-bar":    { w: 216, h: 190, tone: TONE.chart, kind: "chart-bar", selected: true },
	"chart-line":   { w: 216, h: 222, tone: TONE.chart, kind: "chart-line", selected: true },
	"chart-pie":    { w: 216, h: 206, tone: TONE.chart, kind: "chart-pie" },
	"chart-scatter":{ w: 216, h: 190, tone: TONE.chart, kind: "chart-scatter" },
	"chart-map":    { w: 240, h: 240, tone: TONE.chart, kind: "chart-map" },
	"chart-radar":  { w: 216, h: 190, tone: TONE.chart, kind: "chart-radar" },
	"metric-big":   { w: 180, h: 110, tone: TONE.result, kind: "metric-big" },
	"metric-trend": { w: 180, h: 110, tone: TONE.result, kind: "metric-trend" },
	"metric-gauge": { w: 180, h: 130, tone: TONE.result, kind: "metric-gauge" },
	"filter-select":{ w: 180, h: 88,  tone: TONE.control, kind: "filter-select" },
	"filter-date":  { w: 180, h: 88,  tone: TONE.control, kind: "filter-date" },
	"filter-input": { w: 180, h: 88,  tone: TONE.control, kind: "filter-input" },
	"output-table": { w: 220, h: 180, tone: TONE.chart, kind: "output-table" },
	"output-text":  { w: 200, h: 120, tone: TONE.chart, kind: "output-text" },
	"output-image": { w: 220, h: 160, tone: TONE.chart, kind: "output-image" },
};

export function NodeGraph({ nodes, setNodes, links, setLinks }: NodeGraphProps): JSX.Element {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [dragOver, setDragOver] = useState(false);

	// ── DnD：从 NodeLibrary 拖入新节点 ──
	let NODE_SEQ = 100; // 独立序号，与 LINK_SEQ 不冲突
	const NODE_SEQ_KEY = "_nodeSeq" as const;

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

			// ── 模板拖入 → 整个画布替换 ──
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
							}
						} catch { /* ignore bad template JSON */ }
					});
				return;
			}

			// ── 单节点拖入 ──
			const type = payload.nodeType;
			if (!type) return;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;
			const x = e.clientX - rect.left - 90; // 居中偏移
			const y = e.clientY - rect.top - 40;
			const tpl = NODE_TEMPLATES[type] ?? { w: 180, h: 110, tone: TONE.chart };
			NODE_SEQ++;
			const newId = `n${NODE_SEQ}`;
			// 找当前选中节点作为自动连线 source（UX：拖入新节点自动串到最近选中的节点后面）
			const selectedId = (Object.keys(nodes) as NodeId[]).find((k) => nodes[k].selected);
			const newNode: NodePos = { ...tpl, x: Math.max(8, x), y: Math.max(8, y) };
			setNodes((prev) => ({ ...prev, [newId]: newNode }));
			if (selectedId && selectedId !== newId) {
				setLinks((prev) => {
					const tone = nodes[selectedId].tone;
					return [...prev, { id: nextLinkId(), from: selectedId, fromRow: 0, to: newId, toRow: 0, tone }];
				});
			}
			void NODE_SEQ_KEY;
		} catch { /* ignore bad data */ }
	}

	// ── 节点拖拽 ──
	const dragRef = useRef<{ id: NodeId; ox: number; oy: number } | null>(null);

	function startDrag(id: NodeId, e: RPointerEvent<Element>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const node = nodes[id];
		dragRef.current = {
			id,
			ox: e.clientX - rect.left - node.x,
			oy: e.clientY - rect.top - node.y,
		};
		setNodes((prev) => {
			const next = { ...prev };
			for (const k of Object.keys(next) as NodeId[]) {
				next[k] = { ...next[k], selected: k === id };
			}
			return next;
		});
	}

	// ── 端口连线 ──
	const [pendingLink, setPendingLink] = useState<{
		from: NodeId; fromRow: number; x1: number; y1: number; x2: number; y2: number;
	} | null>(null);
	const pendingRef = useRef<{ from: NodeId; fromRow: number } | null>(null);
	const [hoverLink, setHoverLink] = useState<string | null>(null);

	/** 画布坐标下某节点某行 socket 的绝对位置。side: "r"=output(右), "l"=input(左) */
	function socketPos(id: NodeId, row: number, side: "l" | "r"): { x: number; y: number } {
		const n = nodes[id];
		return {
			x: n.x + (side === "r" ? n.w : 0),
			y: n.y + rowDy(row),
		};
	}

	/** 检测视口坐标下命中的 socket（elementFromPoint + data-socket-type）。 */
	function hitSocket(clientX: number, clientY: number) {
		const el = document.elementFromPoint(clientX, clientY);
		if (!(el instanceof HTMLElement)) return null;
		const type = el.dataset.socketType;
		if (type !== "input" && type !== "output") return null;
		const nodeId = el.dataset.nodeId as NodeId | undefined;
		const row = Number(el.dataset.socketRow);
		if (!nodeId || !nodes[nodeId]) return null;
		return { type, nodeId, row };
	}

	/** 画布 pointerdown：拦截 output socket 启动连线。 */
	function onCanvasPointerDown(e: RPointerEvent<HTMLDivElement>) {
		const hit = hitSocket(e.clientX, e.clientY);
		if (hit?.type === "output") {
			e.stopPropagation(); // 阻止冒泡到 NodeCard 的 startDrag
			const p = socketPos(hit.nodeId, hit.row, "r");
			pendingRef.current = { from: hit.nodeId, fromRow: hit.row };
			setPendingLink({ from: hit.nodeId, fromRow: hit.row, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
		}
	}

	useEffect(() => {
		function onMove(e: PointerEvent) {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;
			// 节点拖拽
			const d = dragRef.current;
			if (d) {
				setNodes((prev) => ({
					...prev,
					[d.id]: {
						...prev[d.id],
						x: e.clientX - rect.left - d.ox,
						y: e.clientY - rect.top - d.oy,
					},
				}));
			}
			// 端口连线 —— 临时贝塞尔跟随光标
			const pl = pendingRef.current;
			if (pl) {
				setPendingLink((prev) => prev ? {
					...prev,
					x2: e.clientX - rect.left,
					y2: e.clientY - rect.top,
				} : null);
			}
		}
		function onUp(e: PointerEvent) {
			// 结束节点拖拽
			dragRef.current = null;
			// 结束端口连线 —— 检测 input socket
			const pl = pendingRef.current;
			if (pl) {
				const hit = hitSocket(e.clientX, e.clientY);
				if (hit?.type === "input" && hit.nodeId !== pl.from) {
					setLinks((prev) => {
						const tone = nodes[pl.from].tone;
						return [...prev, { id: nextLinkId(), from: pl.from, fromRow: pl.fromRow, to: hit.nodeId, toRow: hit.row, tone }];
					});
				}
				pendingRef.current = null;
				setPendingLink(null);
			}
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, [nodes]);
	return (
		<div
			ref={canvasRef}
			onPointerDown={onCanvasPointerDown}
			onDragOver={onCanvasDragOver}
			onDragLeave={onCanvasDragLeave}
			onDrop={onCanvasDrop}
			data-drag-over={dragOver ? "true" : undefined}
			className={`relative min-h-0 flex-1 overflow-hidden bg-background ${dragOver ? "ring-2 ring-accent/40 ring-inset" : ""}`}
			style={{
				backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
				backgroundSize: "16px 16px",
				color: "var(--color-border)",
				opacity: 0.4,
			}}
		>
			{/* 分组区域 */}
			{GROUPS.map((g) => (
				<div
					key={g.label}
					className="absolute rounded-[8px] border border-border bg-surface/25"
					style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
				>
					<span className="absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-control border border-border bg-background px-2">
						<span className={g.icon + " size-3 text-faint"} />
						<span className="text-[10px] text-muted">{g.label}</span>
						<span className="font-mono text-[10px] text-faint">{g.count}</span>
					</span>
				</div>
			))}

			{/* SVG 连线（hover 高亮 + 中点 × 删除按钮） */}
			<svg className="absolute inset-0 h-full w-full overflow-visible">
				{links.map((l) => {
					const hot = l.from === "line" || l.to === "line";
					const isHover = hoverLink === l.id;
					const mid = linkMid(l, nodes);
					return (
						<g key={l.id}>
							{/* 命中用的粗背景线（看不见，但扩了点击区域） */}
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
							{/* 视觉线 */}
							<path
								d={linkPath(l, nodes)}
								fill="none"
								stroke={l.tone}
								strokeWidth={isHover ? 2.5 : (hot ? 2 : 1.5)}
								strokeLinecap="round"
								opacity={isHover ? 1 : (hot ? 0.95 : 0.6)}
								style={{ pointerEvents: "none" }}
							/>
							{/* hover 时显示 × 删除按钮 */}
							{isHover && (
								<g
									style={{ pointerEvents: "all" }}
									onPointerDown={(e) => {
										e.stopPropagation();
										setLinks((prev) => prev.filter((p) => p.id !== l.id));
										setHoverLink(null);
									}}
								>
									<circle cx={mid.x} cy={mid.y} r={10} fill="var(--color-surface-raised)" stroke="var(--color-border-strong)" strokeWidth={1.5} />
									<circle cx={mid.x} cy={mid.y} r={10} fill="transparent" />
									<path
										d={`M ${mid.x - 3.5} ${mid.y - 3.5} L ${mid.x + 3.5} ${mid.y + 3.5} M ${mid.x + 3.5} ${mid.y - 3.5} L ${mid.x - 3.5} ${mid.y + 3.5}`}
										stroke="var(--color-danger)"
										strokeWidth={1.6}
										strokeLinecap="round"
									/>
								</g>
							)}
						</g>
					);
				})}
			</svg>

			{/* 临时连线（拖拽中） */}
			{pendingLink && (
				<svg className="pointer-events-none absolute inset-0 h-full w-full">
					<path
						d={(() => {
							const bend = Math.max(36, Math.abs(pendingLink.x2 - pendingLink.x1) * 0.5);
							return `M ${pendingLink.x1} ${pendingLink.y1} C ${pendingLink.x1 + bend} ${pendingLink.y1}, ${pendingLink.x2 - bend} ${pendingLink.y2}, ${pendingLink.x2} ${pendingLink.y2}`;
						})()}
						fill="none"
						stroke={nodes[pendingLink.from].tone}
						strokeWidth={1.75}
						strokeDasharray="6 4"
						opacity={0.8}
					/>
				</svg>
			)}

			{/* ds1: orders_daily */}
			<NodeCard {...nodes.ds1} nodeId="ds1" onPointerDown={(e) => startDrag("ds1", e)} title="orders_daily" type="dataset" icon="icon-[lucide--database]"
				outputs={[{ row: 0, tone: TONE.table }]}>
				<NodeRow label="表"><NodeValue mono>public.orders</NodeValue></NodeRow>
				<NodeRow label="连接"><NodeValue mono>MySQL · 插件工作台</NodeValue></NodeRow>
				<NodeRow label="规模"><NodeValue mono>1,284 行 · 日粒度</NodeValue></NodeRow>
			</NodeCard>

			{/* ds2: channel_share */}
			<NodeCard {...nodes.ds2} nodeId="ds2" onPointerDown={(e) => startDrag("ds2", e)} title="channel_dim" type="dataset" icon="icon-[lucide--database]"
				outputs={[{ row: 0, tone: TONE.table }]}>
				<NodeRow label="表"><NodeValue mono>public.channel_dim</NodeValue></NodeRow>
				<NodeRow label="连接"><NodeValue mono>MySQL · 插件工作台</NodeValue></NodeRow>
				<NodeRow label="规模"><NodeValue mono>6 行 · 渠道</NodeValue></NodeRow>
			</NodeCard>

			{/* sql: gmv_14d */}
			<NodeCard {...nodes.sql} nodeId="sql" onPointerDown={(e) => startDrag("sql", e)} title="gmv_14d" type="sql" icon="icon-[lucide--scroll-text]"
				inputs={[{ row: 0, tone: TONE.table }]}
				outputs={[{ row: 1, tone: TONE.result }]}>
				<NodeRow label="表"><NodeSelect>orders_daily</NodeSelect></NodeRow>
				<NodeRow label="结果集">
					<NodeValue mono>14 × 2</NodeValue>
					<Chip tone="ai" className="ml-auto">AI 生成</Chip>
				</NodeRow>
				<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface px-1.5 py-1 font-mono text-[9.5px] leading-[13px] text-muted">
					<div><span className="text-accent">select</span> d, sum(gmv) gmv</div>
					<div><span className="text-accent">from</span> public.orders</div>
					<div><span className="text-accent">where</span> d &gt;= current_date - 14</div>
					<div><span className="text-accent">group by</span> d order by d</div>
				</div>
			</NodeCard>

			{/* line: GMV 趋势（选中态）*/}
			<NodeCard {...nodes.line} nodeId="line" onPointerDown={(e) => startDrag("line", e)} title="GMV 趋势" type="echarts · line" icon="icon-[lucide--chart-line]"
				inputs={[{ row: 0, tone: TONE.result }]}
				outputs={[{ row: 4, tone: TONE.chart }]}>
				<NodeRow label="结果集"><NodeValue mono>gmv_14d</NodeValue></NodeRow>
				<NodeRow label="维度"><NodeSelect>d · 日期</NodeSelect></NodeRow>
				<NodeRow label="数值"><NodeSelect>gmv · 求和</NodeSelect></NodeRow>
				<NodeRow label="图形"><NodeSeg options={["折线", "面积"]} active="面积" /></NodeRow>
				<NodeRow label="输出去向"><NodeValue>看板 · 概览</NodeValue></NodeRow>
				<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface p-1 text-[10px] text-muted">
					<AreaChart values={GMV} stroke={SERIES[1]} />
				</div>
			</NodeCard>

			{/* donut: 渠道构成 */}
			<NodeCard {...nodes.donut} nodeId="donut" onPointerDown={(e) => startDrag("donut", e)} title="渠道构成" type="echarts · doughnut" icon="icon-[lucide--pie-chart]"
				inputs={[{ row: 0, tone: TONE.table }]}
				outputs={[{ row: 3, tone: TONE.chart }]}>
				<NodeRow label="数据集"><NodeSelect>channel_dim</NodeSelect></NodeRow>
				<NodeRow label="维度"><NodeSelect>channel</NodeSelect></NodeRow>
				<NodeRow label="数值"><NodeSelect>share · 占比</NodeSelect></NodeRow>
				<NodeRow label="输出去向"><NodeValue>看板 · 概览</NodeValue></NodeRow>
				<div className="mt-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-surface">
					<Donut segments={CHANNELS} size={64} thickness={10} holeFill="var(--color-surface)" />
				</div>
			</NodeCard>

			{/* out: 看板产物 */}
			<NodeCard {...nodes.out} nodeId="out" onPointerDown={(e) => startDrag("out", e)} title="看板产物" type="output" icon="icon-[lucide--layout-dashboard]"
				inputs={[
					{ row: 0, tone: TONE.chart },
					{ row: 1, tone: TONE.chart },
				]}>
				<NodeRow label="折线图"><NodeValue>GMV 趋势</NodeValue></NodeRow>
				<NodeRow label="环形图"><NodeValue>渠道构成</NodeValue></NodeRow>
				<div className="mt-1 grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-1 rounded-[4px] border border-border bg-surface p-1">
					<span className="col-span-4 rounded-[2px] bg-background" />
					<span className="col-span-2 row-span-2 rounded-[2px]" style={{ background: TONE.chart + "33" }} />
					<span className="rounded-[2px] bg-background" />
					<span className="rounded-[2px] bg-background" />
					<span className="rounded-[2px] bg-background" />
					<span className="rounded-[2px] bg-background" />
				</div>
				<button className="mt-1.5 flex h-[26px] shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent text-[11px] font-medium text-white hover:bg-accent/90">
					<span className="icon-[lucide--play] size-3" />运行画布
				</button>
			</NodeCard>

			{/* 选中节点浮动工具条 */}
			<div
				className="absolute z-20 flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface-raised px-1 shadow"
				style={{ left: nodes.line.x, top: nodes.line.y + nodes.line.h + 8 }}
			>
				{TOOLBOX.map((t) => (
					<button key={t.title} title={t.title} type="button"
						className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
						<span className={t.icon + " size-3"} />
					</button>
				))}
				<span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
				<button title="删除节点" type="button"
					className="grid size-5 place-items-center rounded-control text-danger hover:bg-danger/10">
					<span className="icon-[lucide--trash-2] size-3" />
				</button>
			</div>

			{/* AI 生成节点浮动面板 */}
			<AiNodePanel x={16} y={620} w={284} h={232} />

			{/* 缩略图导航 */}
			<div className="absolute bottom-3 right-4 h-20 w-28 overflow-hidden rounded-control border border-border bg-background/90 p-1">
				<div className="relative h-full w-full">
					{(Object.keys(nodes) as NodeId[]).map((id) => {
						const n = nodes[id];
						return (
							<span
								key={id}
								className="absolute rounded-[1px]"
								style={{
									left: `${(n.x / 880) * 100}%`,
									top: `${(n.y / 864) * 100}%`,
									width: `${(n.w / 880) * 100}%`,
									height: `${(n.h / 864) * 100}%`,
									background: n.tone,
									opacity: 0.65,
								}}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
