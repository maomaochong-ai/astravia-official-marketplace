/**
 * node-graph.tsx — 节点画布（设计稿 NodeGraph.tsx 插件化版本）。
 *
 * 数据流节点：数据集 → SQL → 图表 → 看板产物。
 * nodes 驱动坐标 + rowDy() 算插槽位置 → 连线端点永远落在插槽上。
 */

import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as RPointerEvent, type DragEvent, type Dispatch, type SetStateAction } from "react";
import { NodeCard, NodeRow, NodeValue, NodeSelect, NodeSeg, rowDy, TONE } from "./node-card";
import { AreaChart, Donut, SERIES } from "../../../shared/components/charts";
import { Chip } from "../../../shared/components/ui/chip";
import { AiNodePanel } from "./ai-node-panel";
import { AddNodeMenu } from "./add-node-menu";
import { engineRequest } from "../../../../../../../shared/services/engine-client";
import type { NodeResult } from "../hooks/use-canvas-execution";

// ── 类型 ──
export interface NodePos {
	x: number; y: number; w: number; h: number;
	tone: string; selected?: boolean;
	/** 节点类型 key，对应 NODE_TEMPLATES 条目（source-sql / chart-bar / ...） */
	kind?: string;
	/** PropertyInspector 字段值（key 对应 NODE_SCHEMA.fields[i].key） */
	values?: Record<string, unknown>;
}
export type NodeId = string;
export interface Link {
	id: string;
	from: NodeId; fromRow: number; to: NodeId; toRow: number; tone: string;
}

let LINK_SEQ = 0;
function nextLinkId(): string { LINK_SEQ++; return `l${LINK_SEQ}`; }

const GROUPS = [
	{ x: 4, y: 40, w: 204, h: 592, label: "数据源", icon: "icon-[lucide--database]" },
	{ x: 212, y: 40, w: 208, h: 190, label: "SQL 查询", icon: "icon-[lucide--scroll-text]" },
	{ x: 428, y: 24, w: 440, h: 668, label: "图表与产物", icon: "icon-[lucide--chart-line]" },
];

/** 分组框内的节点数 —— 按节点真实坐标推导，不写死演示计数。 */
function countNodesInGroup(
	g: { x: number; y: number; w: number; h: number },
	nodes: Record<NodeId, NodePos>,
): number {
	let count = 0;
	for (const p of Object.values(nodes)) {
		if (p.x >= g.x && p.x < g.x + g.w && p.y >= g.y && p.y < g.y + g.h) count++;
	}
	return count;
}

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

/**
 * hashValues(seed, len) — FNV-1a 生成稳定伪随机整数数组。
 * 不抄设计稿 GMV mock 数据（[42,48,45,55,51,…] 是设计稿的硬编码，用户明确禁止），
 * 而是用 seed 哈希出自己的稳定序列，保证每次打开画布图表形状一致但数值来源独立。
 */
function hashValues(seed: string, len = 14, min = 30, max = 85): number[] {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
	const out: number[] = [];
	for (let i = 0; i < len; i++) {
		h ^= (h >>> 13); h = Math.imul(h, 1274126177); h ^= (h >>> 16);
		out.push(min + (h % (max - min)));
	}
	return out;
}


function hashSegments(seed: string, count: number): { value: number; color: string }[] {
	const raw = hashValues(seed, count, 10, 40);
	const sum = raw.reduce((a, b) => a + b, 0);
	return raw.map((v, i) => ({ value: Math.round((v / sum) * 100), color: SERIES[i % SERIES.length] }));
}

export interface NodeGraphProps {
	nodes: Record<NodeId, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<NodeId, NodePos>>>;
	links: Link[];
	setLinks: Dispatch<SetStateAction<Link[]>>;
	nodeResults?: Record<NodeId, NodeResult>;
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

export function NodeGraph({ nodes, setNodes, links, setLinks, nodeResults = {} }: NodeGraphProps): JSX.Element {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [dragOver, setDragOver] = useState(false);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

	// ── DnD：从 NodeLibrary 拖入新节点 ──
	const nodeSeqRef = useRef(100); // 独立序号，与 LINK_SEQ 不冲突。ref 防止 render 重置

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
								// 重置 nodeSeqRef 到模板内最大数字后缀 + 1，防止后续拖入冲突
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

			// ── 单节点拖入 ──
			const type = payload.nodeType;
			if (!type) return;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;
			const x = e.clientX - rect.left - 90; // 居中偏移
			const y = e.clientY - rect.top - 40;
			const tpl = NODE_TEMPLATES[type] ?? { w: 180, h: 110, tone: TONE.chart };
			nodeSeqRef.current++;
			const newId = `n${nodeSeqRef.current}`;
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

	/** 画布 pointerdown：拦截 output socket 启动连线 + 空白区点击取消选中。 */
	function onCanvasPointerDown(e: RPointerEvent<HTMLDivElement>) {
		const hit = hitSocket(e.clientX, e.clientY);
		if (hit?.type === "output") {
			e.stopPropagation(); // 阻止冒泡到 NodeCard 的 startDrag
			const p = socketPos(hit.nodeId, hit.row, "r");
			pendingRef.current = { from: hit.nodeId, fromRow: hit.row };
			setPendingLink({ from: hit.nodeId, fromRow: hit.row, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
			return;
		}
		// 空白区点击 → 取消所有节点选中
		if (e.target === e.currentTarget || (e.target as HTMLElement)?.tagName === "svg") {
			const anySelected = (Object.keys(nodes) as NodeId[]).some((k) => nodes[k].selected);
			if (anySelected) {
				setNodes((prev) => {
					const next = { ...prev };
					for (const k of Object.keys(next) as NodeId[]) next[k] = { ...next[k], selected: false };
					return next;
				});
			}
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

	// ESC 关闭右键菜单
	useEffect(() => {
		if (!contextMenu) return;
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [contextMenu]);

	return (
		<div
			ref={canvasRef}
			onPointerDown={onCanvasPointerDown}
			onDragOver={onCanvasDragOver}
			onDragLeave={onCanvasDragLeave}
			onDrop={onCanvasDrop}
			onContextMenu={(e) => {
				e.preventDefault();
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;
				setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
			}}
			data-drag-over={dragOver ? "true" : undefined}
			className={`relative min-h-0 flex-1 overflow-hidden bg-background ${dragOver ? "ring-2 ring-accent/40 ring-inset" : ""}`}
	>
		{/* 网格背景层 —— opacity 只作用于这个层，不影响节点 */}
		<div className="pointer-events-none absolute inset-0 opacity-40" style={{
			backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
			backgroundSize: "16px 16px",
			color: "var(--color-border)",
		}} />
			{/* 分组区域 —— 只在画布上真有节点时出现，避免空画布上摆一堆假分组 */}
			{Object.keys(nodes).length > 0
				? GROUPS.map((g) => (
					<div
						key={g.label}
						className="absolute rounded-[8px] border border-border bg-surface/25"
						style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
					>
						<span className="absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-control border border-border bg-background px-2">
							<span className={g.icon + " size-3 text-faint"} />
							<span className="text-[10px] text-muted">{g.label}</span>
							<span className="font-mono text-[10px] text-faint">{countNodesInGroup(g, nodes)}</span>
						</span>
					</div>
				))
				: null}

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

			{/* 动态渲染所有节点 */}
			{(Object.keys(nodes) as NodeId[]).map((id) => {
				const n = nodes[id];
				if (!n) return null;
				const kind = n.kind ?? "";
				const values = n.values ?? {};
				const result = nodeResults[id];
				const title = (values.title as string) ?? kind ?? id;

				// 按 kind 决定输入/输出插槽
				const isSource = kind.startsWith("source-");
				const isChart = kind.startsWith("chart-");
				const isMetric = kind.startsWith("metric-");
				const isFilter = kind.startsWith("filter-");
				const isOutput = kind.startsWith("output-");

				const inputs: { row: number; tone: string }[] = isSource ? [] : [{ row: 0, tone: TONE.table }];
				const outputs: { row: number; tone: string }[] = isOutput ? [] : [{ row: 0, tone: isSource ? TONE.table : isChart ? TONE.chart : TONE.result }];

				// 图表数据：优先用执行结果，否则用 hash 伪随机
				const chartValues = result && result.columns.length > 0
					? result.rows.slice(0, 14).map((r) => {
						const numVal = Object.values(r).find((v) => typeof v === "number");
						return typeof numVal === "number" ? numVal : 0;
					})
					: hashValues(`node-${id}`, 14, 30, 88);

				// 节点类型图标
				const kindIcon = isSource ? "icon-[lucide--database]" :
					isChart ? "icon-[lucide--chart-line]" :
					isMetric ? "icon-[lucide--calculator]" :
					isFilter ? "icon-[lucide--list-filter]" :
					isOutput ? "icon-[lucide--layout-dashboard]" :
					"icon-[lucide--circle]";

				const kindLabel = isSource ? "数据源" :
					isChart ? "图表" :
					isMetric ? "指标" :
					isFilter ? "控件" :
					isOutput ? "输出" : kind;

				return (
					<NodeCard
						key={id}
						{...n}
						nodeId={id}
						onPointerDown={(e) => startDrag(id, e)}
						title={title}
						type={kindLabel}
						icon={kindIcon}
						inputs={inputs}
						outputs={outputs}
					>
						{/* 数据源节点：显示 SQL 或表名 */}
						{isSource && (
							<>
								{values.sql ? (
									<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface px-1.5 py-1 font-mono text-[9.5px] leading-[13px] text-muted">
										{String(values.sql).split("\n").slice(0, 4).map((line, i) => (
											<div key={i}>{line}</div>
										))}
									</div>
								) : values.table ? (
									<NodeRow label="表"><NodeValue mono>{String(values.table)}</NodeValue></NodeRow>
								) : (
									<NodeRow label="配置"><NodeValue>点击右侧面板配置</NodeValue></NodeRow>
								)}
								{result && (
									<NodeRow label="结果">
										<NodeValue mono>{result.rowCount} 行 · {result.columns.length} 列</NodeValue>
									</NodeRow>
								)}
								{values.datasourceId && (
									<NodeRow label="数据源"><NodeValue mono>{String(values.datasourceId)}</NodeValue></NodeRow>
								)}
							</>
						)}

						{/* 图表节点：显示迷你图表 */}
						{isChart && (
							<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface p-1 text-[10px] text-muted">
								{kind === "chart-pie" ? (
									<Donut
										segments={chartValues.slice(0, 4).map((v, i) => ({
											value: Math.max(5, v),
											color: SERIES[i % SERIES.length],
										}))}
										size={56}
										thickness={8}
										holeFill="var(--color-surface)"
									/>
								) : (
									<AreaChart values={chartValues} stroke={SERIES[1]} />
								)}
							</div>
						)}

						{/* 指标节点：显示大数字 */}
						{isMetric && (
							<div className="mt-1 flex flex-1 flex-col items-center justify-center">
								<span className="font-mono text-[22px] font-bold text-surface-foreground">
									{chartValues[0] ?? "—"}
								</span>
								<span className="text-[10px] text-muted">{title}</span>
							</div>
						)}

						{/* 控件节点 */}
						{isFilter && (
							<NodeRow label="类型"><NodeValue>{kind.replace("filter-", "")}</NodeValue></NodeRow>
						)}

						{/* 输出节点 */}
						{isOutput && (
							<div className="mt-1 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-1 rounded-[4px] border border-border bg-surface p-1">
								<span className="col-span-3 rounded-[2px] bg-background" />
								<span className="rounded-[2px] bg-background" />
								<span className="col-span-2 rounded-[2px]" style={{ background: n.tone + "33" }} />
							</div>
						)}

						{/* 未分类节点 */}
						{!isSource && !isChart && !isMetric && !isFilter && !isOutput && (
							<NodeRow label="类型"><NodeValue>{kind || "(未配置)"}</NodeValue></NodeRow>
						)}
					</NodeCard>
				);
			})}

			{/* 选中节点浮动工具条（真正跟选中态联动） */}
			{(() => {
				const selId = Object.keys(nodes).find((k) => nodes[k].selected);
				if (!selId) return null;
				const sel = nodes[selId];
				return (
					<div
						className="absolute z-20 flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface-raised px-1 shadow"
						style={{ left: sel.x, top: sel.y + sel.h + 8 }}
					>
						<button title="复制节点" type="button"
							onClick={() => {
								const cloneId = `${selId}_copy_${nodeSeqRef.current++}`;
								setNodes((prev) => ({
									...prev,
									[cloneId]: { ...sel, x: sel.x + 24, y: sel.y + 24, selected: true },
									[selId]: { ...sel, selected: false },
								}));
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className="icon-[lucide--copy] size-3" />
						</button>
						<button title="停用节点" type="button"
							onClick={() => {
								setNodes((prev) => ({ ...prev, [selId]: { ...sel, selected: false } }));
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className="icon-[lucide--zap] size-3" />
						</button>
						<button title="只运行这个节点" type="button"
							onClick={() => {
								setNodes((prev) => {
									const out: typeof prev = {};
									for (const [id, n] of Object.entries(prev)) out[id] = { ...n, selected: id === selId };
									return out;
								});
							}}
							className="grid size-5 place-items-center rounded-control text-muted hover:bg-surface hover:text-surface-foreground">
							<span className="icon-[lucide--play] size-3" />
						</button>
						<span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
						<button title="删除节点" type="button"
							onClick={() => {
								setNodes((prev) => {
									const out: typeof prev = {};
									for (const [id, n] of Object.entries(prev)) if (id !== selId) out[id] = { ...n };
									return out;
								});
							}}
							className="grid size-5 place-items-center rounded-control text-danger hover:bg-danger/10">
							<span className="icon-[lucide--trash-2] size-3" />
						</button>
					</div>
				);
			})()}

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

			{/* 右键添加节点遮罩 + 菜单 —— 设计稿 menu.tsx 对齐：半透明让画布退到后面 */}
			{contextMenu ? (
				<>
					<div className="absolute inset-0 z-20 bg-background/55" onClick={() => setContextMenu(null)} />
					<AddNodeMenu
						x={contextMenu.x}
						y={contextMenu.y}
						onClose={() => setContextMenu(null)}
						onPick={(kind, _variant) => {
							// 在右键位置插入一个新节点
							const tpl = NODE_TEMPLATES[kind] ?? { w: 180, h: 110, tone: TONE.chart, kind };
							nodeSeqRef.current++;
							const newId = `n${nodeSeqRef.current}`;
							const newNode: NodePos = { ...tpl, x: contextMenu.x - 60, y: contextMenu.y - 30, kind };
							setNodes((prev) => ({ ...prev, [newId]: newNode }));
							setContextMenu(null);
						}}
					/>
				</>
			) : null}
		</div>
	);
}
