export const frame = { width: 1440, height: 1000, title: "BI · 工作台首屏（工作树与我的看板）" };

import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import NodeCard, { NodeRow, NodeValue, TONE, rowDy } from "../components/editor/NodeCard";
import { linkPath, type NodeLink } from "../components/editor/CanvasGround";

/**
 * 工作台首屏 —— 从数据资产点「BI」之后落到的第一屏（adr-0001 §2）。
 *
 * 这一版按调研文档（quick-bi-docs / quick-bi-reference.md）做个人使用的裁剪：需要组织、
 * 空间、审批、嵌入才能成立的东西全部不画 —— 没有空间切换，没有权限层级，没有企业门户、
 * 开放平台与卡片看板。留下的是一个人真的用得上的四件事：资产在哪、上次运行成不成、
 * 怎么起手、改动发到哪去了。
 *
 * 左栏是工作树的目录树，不是平铺导航。数据源 → 数据集 → 看板/大屏 这三层正是调研里
 * 「数据集是数据源与可视化之间的中间环节」的那条流水线；单用户没有空间概念，目录树
 * 就是它唯一的组织结构（Quick BI 用空间 + 文件夹分资产，这里只剩文件夹）。
 *
 * 右栏把「从哪开始」和「依赖 · 待发布」并排放着 —— 打开工作台的人要么在开新的，
 * 要么在收上一次的尾。原本占位的「产物链接」拿掉了：永久链接与限期分享是单张作品的
 * 属性，已经在发布与分享那张稿子里，工作台首屏放着只会让人以为这里是链接管理页。
 *
 * 缩略图不是示意图，是真的节点图：把画布上那张图按 0.5 缩小塞进卡片，于是工作台上的
 * 每张卡片都自带「它长什么样」的证据，卡片之间也不再只靠文件名区分。
 */

/* ------------------------------------------------------------------ 工作树目录树 */

type TreeRow = {
	label: string;
	count?: string;
	/** 0 级：一级分类；1 级：文件夹或数据源叶子 */
	depth: 0 | 1;
	icon?: string;
	/** 数据源叶子的连接状态点 */
	dot?: string;
	open?: boolean;
	on?: boolean;
	/** 这一支下面有未发布变更 */
	alert?: boolean;
};

/** 计数必须自洽：看板 6 = 3+1+2，数据集 12 = 5+4+3，作品合计 = 看板 6 + 大屏 2。 */
const TREE: TreeRow[] = [
	{ label: "我的看板", count: "6", depth: 0, icon: "icon-[lucide--layout-dashboard]", open: true, on: true },
	{ label: "经营", count: "3", depth: 1, icon: "icon-[lucide--folder]", alert: true },
	{ label: "周会", count: "1", depth: 1, icon: "icon-[lucide--folder]", alert: true },
	{ label: "未分组", count: "2", depth: 1, icon: "icon-[lucide--folder]" },

	{ label: "数据大屏", count: "2", depth: 0, icon: "icon-[lucide--monitor]", open: false },

	{ label: "数据集", count: "12", depth: 0, icon: "icon-[lucide--table-2]", open: true },
	{ label: "交易", count: "5", depth: 1, icon: "icon-[lucide--folder]" },
	{ label: "流量", count: "4", depth: 1, icon: "icon-[lucide--folder]" },
	{ label: "手工 SQL", count: "3", depth: 1, icon: "icon-[lucide--square-code]" },

	{ label: "数据源", count: "2", depth: 0, icon: "icon-[lucide--database]", open: true },
	{ label: "生产库 MySQL", count: "6 表", depth: 1, dot: "bg-success" },
	{ label: "本地文件", count: "3 张", depth: 1, dot: "bg-border-strong" },

	{ label: "回收站", count: "2", depth: 0, icon: "icon-[lucide--trash-2]", open: false },
];

function WorkTree() {
	return (
		<div className="flex flex-col gap-0.5">
			{TREE.map((n) => (
				<div
					key={n.label}
					className={`flex h-7 w-full items-center gap-1.5 rounded-control pr-1.5 ${
						n.depth === 0 ? "pl-1.5" : "pl-[18px]"
					} ${n.on ? "bg-accent-soft" : "text-muted hover:bg-surface hover:text-surface-foreground"}`}
				>
					{n.depth === 0 ? (
						<Icon
							name={n.open ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]"}
							className="size-3 shrink-0 text-faint"
						/>
					) : null}

					{n.dot ? (
						<span className={`size-1.5 shrink-0 rounded-full ${n.dot}`} />
					) : n.icon ? (
						<Icon
							name={n.icon}
							className={`size-3.5 shrink-0 ${n.on ? "text-accent" : n.depth === 1 ? "text-faint" : ""}`}
						/>
					) : null}

					<span
						className={`min-w-0 flex-1 truncate text-[12px] ${n.on ? "font-medium text-accent" : ""}`}
					>
						{n.label}
					</span>

					{n.alert ? <span className="size-1.5 shrink-0 rounded-full bg-warning" /> : null}

					{n.count ? (
						<span
							className={`shrink-0 font-mono text-[10px] tabular-nums ${
								n.on ? "text-accent" : "text-faint"
							}`}
						>
							{n.count}
						</span>
					) : null}
				</div>
			))}
		</div>
	);
}

/* ------------------------------------------------------------------ 缩略图 */

const WORLD = { w: 576, h: 240 };
const SCALE = 0.5;

type MiniNode = {
	x: number;
	y: number;
	w: number;
	h: number;
	title: string;
	type: string;
	icon: string;
	tone: string;
	rows: [string, string][];
	ins?: number[];
	outs?: number[];
};

/** 连线端点落在插槽行心上，和 NodeCard 里 rowDy 的约定是同一套。 */
function wire(from: MiniNode, fromRow: number, to: MiniNode, toRow: number, tone: string): NodeLink {
	return {
		x1: from.x + from.w,
		y1: from.y + rowDy(fromRow),
		x2: to.x,
		y2: to.y + rowDy(toRow),
		tone,
	};
}

/** 两行节点的高度：标题条 30 + 上下内边距 8 + 行高 24 × 2。 */
const NODE_H = 30 + 8 + 24 * 2 + 8;

const ODS: MiniNode = {
	x: 6,
	y: 54,
	w: 168,
	h: NODE_H,
	title: "ods_orders",
	type: "数据源",
	icon: "icon-[lucide--database]",
	tone: TONE.table,
	rows: [
		["连接", "prod-mysql"],
		["模式", "直连"],
	],
	outs: [0],
};

const DS: MiniNode = {
	x: 212,
	y: 54,
	w: 168,
	h: NODE_H,
	title: "ds_channel",
	type: "数据集",
	icon: "icon-[lucide--scroll-text]",
	tone: TONE.table,
	rows: [
		["来源", "一键套用"],
		["字段", "8 列"],
	],
	ins: [0],
	outs: [0],
};

const LINE: MiniNode = {
	x: 418,
	y: 78,
	w: 152,
	h: NODE_H,
	title: "line_gmv_14d",
	type: "折线图",
	icon: "icon-[lucide--chart-line]",
	tone: TONE.chart,
	rows: [
		["X 轴", "date"],
		["Y 轴", "gmv"],
	],
	ins: [1],
};

const BAR: MiniNode = {
	x: 418,
	y: 132,
	w: 152,
	h: NODE_H,
	title: "bar_city",
	type: "柱状图",
	icon: "icon-[lucide--chart-column]",
	tone: TONE.chart,
	rows: [
		["维度", "city"],
		["排序", "降序"],
	],
	ins: [0],
};

/** 两种常见形状：一条直线到底，和一个数据集分叉出两张图。 */
const GRAPHS: Record<string, { nodes: MiniNode[]; links: NodeLink[] }> = {
	pipeline: {
		nodes: [ODS, DS, LINE],
		links: [wire(ODS, 0, DS, 0, TONE.table), wire(DS, 0, LINE, 1, TONE.chart)],
	},
	branch: {
		nodes: [ODS, DS, { ...LINE, y: 18 }, BAR],
		links: [
			wire(ODS, 0, DS, 0, TONE.table),
			wire(DS, 0, { ...LINE, y: 18 }, 1, TONE.chart),
			wire(DS, 0, BAR, 0, TONE.chart),
		],
	},
};

/**
 * 卡片缩略图。地面自带一层 8px 点阵 —— 画布地面是 16px，缩到 0.5 之后点阵会糊成一片，
 * 所以这里单独铺一层更密的地面，其余（节点、连线、插槽）全部复用真实组件。
 */
function MiniGraph({ graph }: { graph: string }) {
	const g = GRAPHS[graph];
	return (
		<div
			className="relative h-[120px] w-full shrink-0 overflow-hidden border-b border-border bg-background"
			style={{
				backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
				backgroundSize: "8px 8px",
			}}
		>
			<div
				className="absolute top-0 left-0 origin-top-left"
				style={{ width: WORLD.w, height: WORLD.h, transform: `scale(${SCALE})` }}
			>
				<svg className="pointer-events-none absolute inset-0" width={WORLD.w} height={WORLD.h}>
					{g.links.map((l, i) => (
						<path
							key={i}
							d={linkPath(l)}
							fill="none"
							stroke={l.tone}
							strokeWidth={1.5}
							strokeDasharray={l.dashed ? "4 3" : undefined}
						/>
					))}
				</svg>
				{g.nodes.map((n) => (
					<NodeCard
						key={`${n.title}-${n.y}`}
						title={n.title}
						type={n.type}
						icon={n.icon}
						tone={n.tone}
						x={n.x}
						y={n.y}
						w={n.w}
						h={n.h}
						inputs={(n.ins ?? []).map((row) => ({ row, tone: n.tone }))}
						outputs={(n.outs ?? []).map((row) => ({ row, tone: n.tone }))}
					>
						{n.rows.map(([k, v]) => (
							<NodeRow key={k} label={k}>
								<NodeValue mono>{v}</NodeValue>
							</NodeRow>
						))}
					</NodeCard>
				))}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ 看板卡片 */

type BoardState = "运行中" | "失败" | "草稿";

type Board = {
	name: string;
	pages: number;
	nodes: number;
	state: BoardState;
	meta: string;
	graph: "pipeline" | "branch";
};

const BOARDS: Board[] = [
	{
		name: "渠道经营看板",
		pages: 3,
		nodes: 6,
		state: "运行中",
		meta: "更新于 22:24 · 运行 12 次",
		graph: "pipeline",
	},
	{
		name: "城市分布看板",
		pages: 2,
		nodes: 4,
		state: "运行中",
		meta: "更新于 21:58 · 运行 31 次",
		graph: "branch",
	},
	{
		name: "投放效果看板",
		pages: 4,
		nodes: 9,
		state: "失败",
		meta: "上次运行 18:40 · 1 个节点失败",
		graph: "pipeline",
	},
	{
		name: "商品结构看板",
		pages: 2,
		nodes: 5,
		state: "草稿",
		meta: "更新于 昨天 16:02 · 从未运行",
		graph: "branch",
	},
	{
		name: "周会驾驶舱",
		pages: 5,
		nodes: 11,
		state: "草稿",
		meta: "更新于 10-09 09:30 · 从未运行",
		graph: "pipeline",
	},
	{
		name: "门店日报看板",
		pages: 1,
		nodes: 4,
		state: "运行中",
		meta: "更新于 10-08 08:15 · 运行 24 次",
		graph: "branch",
	},
];

/** 状态是封闭集合，chip 是它唯一的落点 —— adr-0001 gap ②。 */
const STATE_TONE: Record<BoardState, "primary" | "danger" | "neutral"> = {
	运行中: "primary",
	失败: "danger",
	草稿: "neutral",
};

const STATE_ICON: Record<BoardState, string> = {
	运行中: "icon-[lucide--play]",
	失败: "icon-[lucide--triangle-alert]",
	草稿: "icon-[lucide--pencil-line]",
};

function BoardCard({ board }: { board: Board }) {
	return (
		<div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface-raised hover:border-border-strong">
			<MiniGraph graph={board.graph} />
			<div className="flex flex-col gap-2 px-3 py-2.5">
				<div className="flex items-center gap-2">
					<span className="min-w-0 flex-1 truncate text-[13px] font-medium text-surface-foreground">{board.name}</span>
					<IconButton size="xs" icon="icon-[lucide--ellipsis]" title="重命名 / 删除" />
				</div>
				<div className="flex items-center gap-1.5">
					<Chip mono>{board.pages} 页</Chip>
					<Chip mono>{board.nodes} 节点</Chip>
					<Chip tone={STATE_TONE[board.state]} icon={STATE_ICON[board.state]}>
						{board.state}
					</Chip>
				</div>
				<span className="truncate text-[10px] text-faint">{board.meta}</span>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ 运行账 */

type Run = { time: string; name: string; detail: string; cost: string; state: "成功" | "失败" };

const RUNS: Run[] = [
	{ time: "22:24", name: "渠道经营看板", detail: "6 节点 · 全部成功", cost: "4.2s", state: "成功" },
	{ time: "21:58", name: "城市分布看板", detail: "4 节点 · 全部成功", cost: "2.8s", state: "成功" },
	{ time: "21:12", name: "城市分布看板", detail: "单节点 · bar_city", cost: "0.9s", state: "成功" },
	{ time: "18:40", name: "投放效果看板", detail: "9 节点 · 1 个失败：ods_campaign", cost: "3.1s", state: "失败" },
	{ time: "18:05", name: "渠道经营看板", detail: "6 节点 · 全部成功", cost: "4.4s", state: "成功" },
	{ time: "14:22", name: "门店日报看板", detail: "4 节点 · 全部成功", cost: "2.1s", state: "成功" },
	{ time: "11:07", name: "城市分布看板", detail: "4 节点 · 全部成功", cost: "2.6s", state: "成功" },
	{ time: "10-09 09:31", name: "渠道经营看板", detail: "6 节点 · 全部成功", cost: "4.0s", state: "成功" },
	{ time: "10-09 08:02", name: "门店日报看板", detail: "4 节点 · 全部成功", cost: "2.3s", state: "成功" },
];

function RunRow({ run }: { run: Run }) {
	return (
		<div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-4 text-[11px] last:border-b-0">
			<span className="w-14 shrink-0 font-mono text-[10px] tabular-nums text-faint">{run.time}</span>
			<span className="w-32 shrink-0 truncate text-surface-foreground">{run.name}</span>
			<span className="min-w-0 flex-1 truncate text-muted">{run.detail}</span>
			<span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-faint">{run.cost}</span>
			<Chip tone={run.state === "失败" ? "danger" : "primary"}>{run.state}</Chip>
		</div>
	);
}

/* ------------------------------------------------------------------ 起步三路 */

type StartPath = { icon: string; title: string; note: string; outcome: string };

const START: StartPath[] = [
	{
		icon: "icon-[lucide--table-2]",
		title: "从数据集新建",
		note: "选一张表，勾字段，直接出图",
		outcome: "→ 新画布 + 图表节点",
	},
	{
		icon: "icon-[lucide--wand-sparkles]",
		title: "让 AI 生成",
		note: "说一句要什么，它去拼节点",
		outcome: "→ 完整的节点图",
	},
	{
		icon: "icon-[lucide--pencil]",
		title: "粘一条 SQL",
		note: "已有 SQL 的话，贴进来就是数据集",
		outcome: "→ SQL 数据源节点",
	},
];

/* ------------------------------------------------------------------ 依赖账 */

type Impact = { source: string; detail: string; broken: boolean };

/** 只统计已发布的看板 —— 改动一落盘就参与统计只会天天报警。 */
const IMPACT: Impact[] = [
	{ source: "prod-mysql", detail: "改表 → 影响 5 张看板", broken: true },
	{ source: "本地文件", detail: "被 2 个数据集引用", broken: false },
];

export default function BiWorkbench() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-5">
				<div className="flex shrink-0 items-center gap-2">
					<Icon name="icon-[lucide--database]" className="size-3.5 text-faint" />
					<span className="text-[13px] text-muted">数据资产</span>
					<Icon name="icon-[lucide--chevron-right]" className="size-3 text-faint" />
					<span className="text-[15px] font-semibold text-surface-foreground">BI 工作台</span>
					<Chip tone="accent">本地工作树</Chip>
				</div>

				<div className="relative w-80 shrink-0">
					<Icon
						name="icon-[lucide--search]"
						className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint"
					/>
					<input
						type="text"
						placeholder="搜索看板、大屏、数据集"
						className="h-8 w-full appearance-none rounded-control border border-border bg-surface pr-14 pl-7 text-[12px] text-surface-foreground outline-none placeholder:text-faint focus:border-accent"
					/>
					<span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
						<Chip mono>⌘K</Chip>
					</span>
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-2">
					<IconButton size="sm" icon="icon-[lucide--circle-question-mark]" title="帮助与文档" />
					<span className="h-4 w-px shrink-0 bg-border" />
					<span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-accent-soft text-[11px] font-medium text-accent">
						诸
					</span>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3">
					<WorkTree />

					<div className="mt-auto border-t border-border px-1.5 pt-3">
						<Btn size="xs" variant="ghost" icon="icon-[lucide--settings-2]" className="justify-start">
							管理数据源
						</Btn>
					</div>
				</aside>

				<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
					<div className="flex shrink-0 items-center gap-3">
						<span className="text-[15px] font-semibold text-surface-foreground">我的看板</span>
						<Chip tone="warning" icon="icon-[lucide--triangle-alert]">
							2 张有未发布变更
						</Chip>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<div className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2">
								<span className="text-[10px] text-faint">排序</span>
								<span className="text-[11px] text-surface-foreground">最近更新</span>
								<Icon name="icon-[lucide--chevron-down]" className="size-3 shrink-0 text-faint" />
							</div>
							<div className="flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
								<span className="grid size-[22px] place-items-center rounded-[4px] bg-accent-soft text-accent">
									<Icon name="icon-[lucide--grid-2x2]" className="size-3" />
								</span>
								<span className="grid size-[22px] place-items-center rounded-[4px] text-muted">
									<Icon name="icon-[lucide--list-ordered]" className="size-3" />
								</span>
							</div>
							<Btn size="sm" variant="primary" icon="icon-[lucide--plus]">
								新建看板
							</Btn>
						</div>
					</div>

					<div className="grid shrink-0 grid-cols-3 gap-4">
						{BOARDS.map((b) => (
							<BoardCard key={b.name} board={b} />
						))}
					</div>

					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised">
						<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4">
							<Icon name="icon-[lucide--play]" className="size-3.5 text-accent" />
							<span className="text-[12px] font-medium text-surface-foreground">最近运行</span>
							<span className="text-[10px] text-faint">看板与大屏共用同一本运行账</span>
							<Btn size="xs" variant="quiet" className="ml-auto">
								全部记录
							</Btn>
						</div>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
							{RUNS.map((r) => (
								<RunRow key={r.time + r.name} run={r} />
							))}
						</div>
						<div className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-4 text-[10px] text-faint">
							<Icon name="icon-[lucide--database]" className="size-3" />
							运行记录保留 30 天
						</div>
					</div>
				</main>

				<aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4">
					<div className="flex flex-col gap-2">
						<span className="text-[11px] font-medium text-surface-foreground">从哪开始</span>
						{START.map((s) => (
							<div
								key={s.title}
								className="flex w-full items-start gap-3 rounded-card border border-border bg-surface p-3 text-left hover:border-border-strong"
							>
								<span className="grid size-7 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
									<Icon name={s.icon} className="size-3.5" />
								</span>
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate text-[13px] font-medium text-surface-foreground">{s.title}</span>
									<span className="text-[11px] leading-4 text-muted">{s.note}</span>
									<span className="truncate font-mono text-[10px] text-faint">{s.outcome}</span>
								</div>
								<Icon name="icon-[lucide--chevron-right]" className="mt-1.5 size-3.5 shrink-0 text-faint" />
							</div>
						))}
						<span className="text-[10px] leading-4 text-faint">三条路都落到同一个节点图画布，之后随时改节点。</span>
					</div>

					<div className="flex flex-col gap-2 border-t border-border pt-3">
						<span className="text-[11px] font-medium text-surface-foreground">依赖</span>
						<span className="font-mono text-[10px] tabular-nums text-muted">2 数据源 → 12 数据集 → 8 作品</span>
						{IMPACT.map((i) => (
							<div key={i.source} className="flex items-center gap-1.5 text-[11px]">
								<span
									className={`size-1.5 shrink-0 rounded-full ${i.broken ? "bg-warning" : "bg-border-strong"}`}
								/>
								<span className="shrink-0 font-mono text-[10px] text-surface-foreground">{i.source}</span>
								<span className="min-w-0 flex-1 truncate text-right text-muted">{i.detail}</span>
							</div>
						))}
						<span className="text-[10px] leading-4 text-faint">只统计已发布的作品：改动没发出去前，不惊动下游。</span>
					</div>

					<div className="mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
						<div className="flex items-center gap-2">
							<Icon name="icon-[lucide--folder-tree]" className="size-3.5 shrink-0 text-warning" />
							<span className="text-[12px] font-medium text-surface-foreground">工作树有 2 个变更待发布</span>
						</div>
						<div className="flex items-center gap-1.5 text-[11px] text-muted">
							<span className="size-1.5 shrink-0 rounded-full bg-warning" />
							<span className="truncate">渠道经营看板 · 数据源改了表</span>
						</div>
						<div className="flex items-center gap-1.5 text-[11px] text-muted">
							<span className="size-1.5 shrink-0 rounded-full bg-warning" />
							<span className="truncate">周会驾驶舱 · 新增 2 个节点</span>
						</div>
						<Btn className="mt-3 w-full" size="sm" variant="primary" icon="icon-[lucide--upload]">
							发布并复制链接
						</Btn>
						<span className="text-[10px] leading-4 text-faint">发布后写入本地工作树，永久链接同步更新。</span>
					</div>
				</aside>
			</div>
		</div>
	);
}
