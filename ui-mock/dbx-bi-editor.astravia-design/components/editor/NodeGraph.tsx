import Chip from "../Chip";
import Icon from "../Icon";
import IconButton from "../IconButton";
import { AreaChart, Donut, seriesColor } from "../Charts";
import NodeCard, { NodeRow, NodeSeg, NodeSelect, NodeValue, TONE, rowDy } from "./NodeCard";
import AiNodePanel from "./AiNodePanel";

/**
 * 节点画布。组件不再是网格里的盒子，而是数据流上的节点：数据集 →（AI 写的）SQL → 图表 → 看板产物。
 * 节点坐标集中在 LAYOUT 里，连线的端点由它 + rowDy() 算出来，所以端点一定落在插槽上，
 * 挪动节点时不会出现「线还在原地」的脱节。
 */

const LAYOUT = {
	ds1: { x: 16, y: 56, w: 180, h: 118, tone: TONE.table },
	sql: { x: 220, y: 56, w: 192, h: 164, tone: TONE.result },
	line: { x: 436, y: 40, w: 216, h: 222, tone: TONE.chart },
	ds2: { x: 16, y: 490, w: 180, h: 118, tone: TONE.table },
	donut: { x: 436, y: 470, w: 216, h: 206, tone: TONE.chart },
	out: { x: 700, y: 300, w: 164, h: 194, tone: "var(--color-primary)" },
};

type NodeId = keyof typeof LAYOUT;

type Link = { from: NodeId; fromRow: number; to: NodeId; toRow: number; tone: string };

const LINKS: Link[] = [
	{ from: "ds1", fromRow: 0, to: "sql", toRow: 0, tone: TONE.table },
	{ from: "sql", fromRow: 1, to: "line", toRow: 0, tone: TONE.result },
	{ from: "ds2", fromRow: 0, to: "donut", toRow: 0, tone: TONE.table },
	{ from: "line", fromRow: 4, to: "out", toRow: 0, tone: TONE.chart },
	{ from: "donut", fromRow: 3, to: "out", toRow: 1, tone: TONE.chart },
];

/** 分组的画布区域：界定了「这块画布在干什么」，也让大片留白变成有意为之。 */
const GROUPS = [
	{ x: 4, y: 40, w: 204, h: 592, icon: "icon-[lucide--database]", label: "数据源", count: "2" },
	{ x: 212, y: 40, w: 208, h: 190, icon: "icon-[lucide--scroll-text]", label: "SQL 查询", count: "1" },
	{ x: 428, y: 24, w: 440, h: 668, icon: "icon-[lucide--chart-line]", label: "图表与产物", count: "3" },
];

const GMV = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];

function linkPath(l: Link) {
	const a = LAYOUT[l.from];
	const b = LAYOUT[l.to];
	const x1 = a.x + a.w;
	const y1 = a.y + rowDy(l.fromRow);
	const x2 = b.x;
	const y2 = b.y + rowDy(l.toRow);
	const bend = Math.max(36, (x2 - x1) * 0.5);
	return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

const TOOLBOX = [
	{ icon: "icon-[lucide--copy]", title: "复制节点" },
	{ icon: "icon-[lucide--zap]", title: "停用（旁路）" },
	{ icon: "icon-[lucide--play]", title: "只运行这个节点" },
	{ icon: "icon-[lucide--ellipsis]", title: "更多" },
];

export default function NodeGraph() {
	return (
		<div
			className="relative min-h-0 flex-1 overflow-hidden bg-background"
			style={{
				backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
				backgroundSize: "16px 16px",
			}}
		>
			{GROUPS.map((g) => (
				<div
					key={g.label}
					className="absolute rounded-[8px] border border-border bg-surface/25"
					style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
				>
					<span className="absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-chip border border-border bg-background px-2">
						<Icon name={g.icon} className="size-3 text-faint" />
						<span className="text-[10px] text-muted">{g.label}</span>
						<span className="font-mono text-[10px] text-faint">{g.count}</span>
					</span>
				</div>
			))}

			<svg className="pointer-events-none absolute inset-0 h-full w-full">
				{LINKS.map((l, i) => {
					const hot = l.from === "line" || l.to === "line";
					return (
						<path
							key={i}
							d={linkPath(l)}
							fill="none"
							stroke={l.tone}
							strokeWidth={hot ? 2 : 1.5}
							opacity={hot ? 0.95 : 0.6}
						/>
					);
				})}
			</svg>

			<NodeCard
				{...LAYOUT.ds1}
				title="orders_daily"
				type="dataset"
				icon="icon-[lucide--database]"
				outputs={[{ row: 0, tone: TONE.table }]}
			>
				<NodeRow label="表">
					<NodeValue mono>public.orders</NodeValue>
				</NodeRow>
				<NodeRow label="连接">
					<NodeValue mono>插件工作台 · MySQL</NodeValue>
				</NodeRow>
				<NodeRow label="规模">
					<NodeValue mono>1,284 行 · 日粒度</NodeValue>
				</NodeRow>
			</NodeCard>

			<NodeCard
				{...LAYOUT.ds2}
				title="channel_share"
				type="dataset"
				icon="icon-[lucide--database]"
				outputs={[{ row: 0, tone: TONE.table }]}
			>
				<NodeRow label="表">
					<NodeValue mono>public.channel_dim</NodeValue>
				</NodeRow>
				<NodeRow label="连接">
					<NodeValue mono>插件工作台 · MySQL</NodeValue>
				</NodeRow>
				<NodeRow label="规模">
					<NodeValue mono>6 行 · 渠道</NodeValue>
				</NodeRow>
			</NodeCard>

			<NodeCard
				{...LAYOUT.sql}
				title="gmv_14d"
				type="sql"
				icon="icon-[lucide--scroll-text]"
				inputs={[{ row: 0, tone: TONE.table }]}
				outputs={[{ row: 1, tone: TONE.result }]}
			>
				<NodeRow label="表">
					<NodeSelect>orders_daily</NodeSelect>
				</NodeRow>
				<NodeRow label="结果集">
					<NodeValue mono>14 × 2</NodeValue>
					<Chip tone="ai">AI 生成</Chip>
				</NodeRow>
				<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-background px-1.5 py-1 font-mono text-[9.5px] leading-[13px] text-muted">
					<div>
						<span className="text-accent">select</span> d, sum(gmv) as gmv
					</div>
					<div>
						<span className="text-accent">from</span> public.orders
					</div>
					<div>
						<span className="text-accent">where</span> d &gt;= current_date - 14
					</div>
					<div>
						<span className="text-accent">group by</span> d order by d
					</div>
				</div>
			</NodeCard>

			<NodeCard
				{...LAYOUT.line}
				title="GMV 趋势"
				type="chartjs · line"
				icon="icon-[lucide--chart-line]"
				selected
				inputs={[{ row: 0, tone: TONE.result }]}
				outputs={[{ row: 4, tone: TONE.chart }]}
			>
				<NodeRow label="结果集">
					<NodeValue mono>gmv_14d</NodeValue>
				</NodeRow>
				<NodeRow label="维度">
					<NodeSelect>d · 日期</NodeSelect>
				</NodeRow>
				<NodeRow label="数值">
					<NodeSelect>gmv · 求和</NodeSelect>
				</NodeRow>
				<NodeRow label="图形">
					<NodeSeg options={["折线", "面积"]} active="面积" />
				</NodeRow>
				<NodeRow label="输出去向">
					<NodeValue>看板 · 概览</NodeValue>
				</NodeRow>
				<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-background">
					<AreaChart values={GMV} className="h-full w-full" gridLines={[]} />
				</div>
			</NodeCard>

			<NodeCard
				{...LAYOUT.donut}
				title="渠道构成"
				type="chartjs · doughnut"
				icon="icon-[lucide--chart-line]"
				inputs={[{ row: 0, tone: TONE.result }]}
				outputs={[{ row: 3, tone: TONE.chart }]}
			>
				<NodeRow label="结果集">
					<NodeSelect>channel_share</NodeSelect>
				</NodeRow>
				<NodeRow label="维度">
					<NodeSelect>channel</NodeSelect>
				</NodeRow>
				<NodeRow label="数值">
					<NodeSelect>share · 占比</NodeSelect>
				</NodeRow>
				<NodeRow label="输出去向">
					<NodeValue>看板 · 概览</NodeValue>
				</NodeRow>
				<div className="mt-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background">
					<Donut
						size={48}
						thickness={9}
						holeFill="var(--color-background)"
						segments={[
							{ value: 46, color: seriesColor(0) },
							{ value: 27, color: seriesColor(1) },
							{ value: 17, color: seriesColor(2) },
							{ value: 10, color: seriesColor(3) },
						]}
					/>
				</div>
			</NodeCard>

			<NodeCard
				{...LAYOUT.out}
				title="看板产物"
				type="output"
				icon="icon-[lucide--layout-dashboard]"
				inputs={[
					{ row: 0, tone: TONE.chart },
					{ row: 1, tone: TONE.chart },
				]}
			>
				<NodeRow label="折线图">
					<NodeValue>GMV 趋势</NodeValue>
				</NodeRow>
				<NodeRow label="环形图">
					<NodeValue>渠道构成</NodeValue>
				</NodeRow>
				<div className="mt-1 grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-1 rounded-[4px] border border-border bg-background p-1">
					<span className="col-span-4 rounded-[2px] bg-neutral-muted" />
					<span className="col-span-2 row-span-2 rounded-[2px] bg-series-1/30" />
					<span className="rounded-[2px] bg-neutral-muted" />
					<span className="rounded-[2px] bg-neutral-muted" />
					<span className="rounded-[2px] bg-neutral-muted" />
					<span className="rounded-[2px] bg-neutral-muted" />
				</div>
				<button className="mt-1.5 flex h-[26px] shrink-0 items-center justify-center gap-1.5 rounded-control bg-primary text-[11px] font-medium text-primary-foreground">
					<Icon name="icon-[lucide--play]" className="size-3" />
					运行画布
				</button>
			</NodeCard>

			{/* 选中节点的浮动工具条：贴着节点下沿，不占用画布上任何一块固定位置 */}
			<div
				className="absolute z-20 flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface-raised px-1 shadow-popover"
				style={{ left: LAYOUT.line.x, top: LAYOUT.line.y + LAYOUT.line.h + 8 }}
			>
				{TOOLBOX.map((t) => (
					<IconButton key={t.title} size="xs" icon={t.icon} title={t.title} />
				))}
				<span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
				<IconButton size="xs" tone="danger" icon="icon-[lucide--trash-2]" title="删除节点" />
			</div>

			<AiNodePanel x={16} y={620} w={284} h={232} />

			{/* 缩略图：一屏放得下整个图，它就只负责指示方位 */}
			<div className="absolute right-4 bottom-3 h-20 w-28 overflow-hidden rounded-control border border-border bg-background/90 p-1">
				<div className="relative h-full w-full">
					{(Object.keys(LAYOUT) as NodeId[]).map((id) => {
						const n = LAYOUT[id];
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
