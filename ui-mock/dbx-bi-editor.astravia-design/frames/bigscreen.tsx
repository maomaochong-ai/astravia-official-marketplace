export const frame = { width: 1440, height: 1000, title: "BI · 数据大屏（画布式搭建）" };

import Btn from "../components/Btn";
import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import CanvasGround, { type NodeLink } from "../components/editor/CanvasGround";
import NodeCard, { NodeRow, NodeValue, TONE, rowDy } from "../components/editor/NodeCard";

/* ---------------------------------------------------------------- 节点数据 */

type CanvasNode = {
	key: string;
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

/** 连线端点落在插槽行心上 —— 和 NodeCard 里 rowDy 的约定是同一套。 */
function wire(from: CanvasNode, fromRow: number, to: CanvasNode, toRow: number, tone: string): NodeLink {
	return {
		x1: from.x + from.w,
		y1: from.y + rowDy(fromRow),
		x2: to.x,
		y2: to.y + rowDy(toRow),
		tone,
	};
}

function Node({ node }: { node: CanvasNode }) {
	return (
		<NodeCard
			title={node.title}
			type={node.type}
			icon={node.icon}
			tone={node.tone}
			x={node.x}
			y={node.y}
			w={node.w}
			h={node.h}
			inputs={(node.ins ?? []).map((row) => ({ row, tone: node.tone }))}
			outputs={(node.outs ?? []).map((row) => ({ row, tone: node.tone }))}
		>
			{node.rows.map(([k, v]) => (
				<NodeRow key={k} label={k}>
					<NodeValue mono>{v}</NodeValue>
				</NodeRow>
			))}
		</NodeCard>
	);
}

/* ------------------------------------------------- 取数链：大屏与看板同源 */

const ODS: CanvasNode = {
	key: "ods_orders",
	x: 48,
	y: 44,
	w: 240,
	h: 94,
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

const DS: CanvasNode = {
	key: "ds_channel",
	x: 312,
	y: 44,
	w: 240,
	h: 94,
	title: "ds_channel",
	type: "数据集",
	icon: "icon-[lucide--scroll-text]",
	tone: TONE.table,
	rows: [
		["来源", "看板同一张"],
		["字段", "8 列"],
	],
	ins: [0],
	outs: [0],
};

const SWAP: CanvasNode = {
	key: "swap_dataset",
	x: 576,
	y: 44,
	w: 240,
	h: 94,
	title: "全局数据集替换",
	type: "替换",
	icon: "icon-[lucide--replace]",
	tone: TONE.control,
	rows: [
		["作用域", "屏上 8 块"],
		["动作", "换一次全换"],
	],
	ins: [0],
};

const SOURCE_NODES = [ODS, DS, SWAP];

/* ------------------------------------------------- 大屏页面 1：屏上的组件 */

const TITLE_BAR: CanvasNode = {
	key: "screen_title",
	x: 136,
	y: 192,
	w: 960,
	h: 94,
	title: "screen_title",
	type: "标题条",
	icon: "icon-[lucide--monitor]",
	tone: TONE.chart,
	rows: [
		["文案", "渠道经营大屏"],
		["装饰", "左右分隔线 · 64 px"],
	],
};

const KPI_ROW: CanvasNode = {
	key: "kpi_row",
	x: 136,
	y: 302,
	w: 460,
	h: 118,
	title: "kpi_row",
	type: "指标卡",
	icon: "icon-[lucide--activity]",
	tone: TONE.chart,
	rows: [
		["度量", "gmv · sum"],
		["字号", "96 px"],
		["动效", "数字滚动 600 ms"],
	],
	ins: [0],
};

const LINE: CanvasNode = {
	key: "line_gmv_14d",
	x: 620,
	y: 302,
	w: 476,
	h: 118,
	title: "line_gmv_14d",
	type: "折线图",
	icon: "icon-[lucide--chart-line]",
	tone: TONE.chart,
	rows: [
		["X 轴", "date"],
		["Y 轴", "gmv · 近 14 天"],
		["复用", "看板上同一个节点"],
	],
	ins: [0],
};

const FUNNEL: CanvasNode = {
	key: "funnel_flow",
	x: 136,
	y: 436,
	w: 300,
	h: 118,
	title: "funnel_flow",
	type: "漏斗图",
	icon: "icon-[lucide--filter]",
	tone: TONE.chart,
	rows: [
		["阶段", "曝光 → 下单"],
		["口径", "人数"],
		["复用", "看板上同一个节点"],
	],
	ins: [0],
};

const RANK: CanvasNode = {
	key: "rank_channel",
	x: 460,
	y: 436,
	w: 300,
	h: 118,
	title: "rank_channel",
	type: "排行榜",
	icon: "icon-[lucide--list-ordered]",
	tone: TONE.chart,
	rows: [
		["条数", "前 10"],
		["滚动", "8 s 一轮"],
		["名次条", "带底条"],
	],
	ins: [0],
};

const MAP: CanvasNode = {
	key: "map_region",
	x: 784,
	y: 436,
	w: 312,
	h: 118,
	title: "map_region",
	type: "地图",
	icon: "icon-[lucide--map]",
	tone: TONE.chart,
	rows: [
		["图层", "底图 + 数据层"],
		["钻取", "城市 → 门店"],
		["动效", "Tooltips 轮播"],
	],
	ins: [0],
};

const BG_DECO: CanvasNode = {
	key: "bg_deco",
	x: 136,
	y: 570,
	w: 460,
	h: 118,
	title: "bg_deco",
	type: "背景装饰",
	icon: "icon-[lucide--image]",
	tone: TONE.chart,
	rows: [
		["背景", "深色渐变 · 第 2 套"],
		["装饰", "四角框线"],
		["网格", "40 px"],
	],
};

const LINKAGE: CanvasNode = {
	key: "linkage",
	x: 620,
	y: 570,
	w: 476,
	h: 118,
	title: "linkage",
	type: "交互",
	icon: "icon-[lucide--mouse-pointer-click]",
	tone: TONE.control,
	rows: [
		["联动", "环图 ↔ 折线"],
		["钻取", "地图 → 门店"],
		["跳转", "排行榜 → 看板"],
	],
};

const PAGE_NODES = [TITLE_BAR, KPI_ROW, LINE, FUNNEL, RANK, MAP, BG_DECO, LINKAGE];

/* ------------------------------------------------- 页面编排与产物 */

const LAYER_GROUP: CanvasNode = {
	key: "layer_group",
	x: 48,
	y: 766,
	w: 224,
	h: 118,
	title: "layer_group",
	type: "图层组",
	icon: "icon-[lucide--layers]",
	tone: TONE.control,
	rows: [
		["背景层", "1"],
		["数据层", "5"],
		["控件层", "2"],
	],
};

const CAROUSEL: CanvasNode = {
	key: "carousel",
	x: 296,
	y: 766,
	w: 224,
	h: 118,
	title: "carousel",
	type: "轮播",
	icon: "icon-[lucide--layout-dashboard]",
	tone: TONE.control,
	rows: [
		["对象", "页面 1 → 3"],
		["间隔", "15 s"],
		["动效", "淡入"],
	],
};

const PAGES: CanvasNode = {
	key: "screen_pages",
	x: 544,
	y: 766,
	w: 224,
	h: 118,
	title: "screen_pages",
	type: "页面",
	icon: "icon-[lucide--monitor]",
	tone: TONE.result,
	rows: [
		["基准", "1920 × 1080"],
		["页数", "3 页 · 上限 10"],
		["背景", "共用第 2 套"],
	],
};

const PRODUCT: CanvasNode = {
	key: "screen_product",
	x: 792,
	y: 766,
	w: 408,
	h: 118,
	title: "screen_product",
	type: "产物",
	icon: "icon-[lucide--link-2]",
	tone: TONE.result,
	rows: [
		["链接", "bi.local/screen/chan-ops-8c41"],
		["页面", "3 页 · 1920 × 1080"],
		["权限", "本地工作树"],
	],
};

const TAIL_NODES = [LAYER_GROUP, CAROUSEL, PAGES, PRODUCT];

const TAIL_LINKS = [
	wire(LAYER_GROUP, 1, CAROUSEL, 1, TONE.control),
	wire(CAROUSEL, 1, PAGES, 1, TONE.control),
	wire(PAGES, 1, PRODUCT, 1, TONE.result),
];

const LINKS = [wire(ODS, 0, DS, 0, TONE.table), wire(DS, 0, SWAP, 0, TONE.control), ...TAIL_LINKS];

const GROUPS = [
	{ x: 24, y: 16, w: 1200, h: 142, label: "取数 · 与看板共用同一套数据集", count: 3 },
	{ x: 112, y: 176, w: 1008, h: 567, label: "大屏页面 1 · 1920 × 1080", count: 8 },
	{ x: 24, y: 752, w: 1200, h: 140, label: "页面编排与产物", count: 4 },
];

/* ---------------------------------------------------------------- 节点库 */

const LIB: { icon: string; cls: string; items: string[] }[] = [
	{ icon: "icon-[lucide--layout-dashboard]", cls: "页面与编排", items: ["大屏页面", "图层组", "轮播容器"] },
	{ icon: "icon-[lucide--type]", cls: "标题与装饰", items: ["标题条", "背景与装饰"] },
	{ icon: "icon-[lucide--gauge]", cls: "信息图", items: ["指标卡 · 翻牌器", "排行榜"] },
	{ icon: "icon-[lucide--chart-line]", cls: "图表 · 与看板共用", items: ["折线图", "柱状图", "环图", "漏斗图"] },
	{ icon: "icon-[lucide--map]", cls: "地图", items: ["地图 · 多图层"] },
	{ icon: "icon-[lucide--film]", cls: "媒体", items: ["视频 / 图片", "时间器"] },
	{ icon: "icon-[lucide--list-filter]", cls: "控件", items: ["筛选器", "日期区间"] },
	{ icon: "icon-[lucide--mouse-pointer-click]", cls: "交互", items: ["联动 · 钻取 · 跳转", "全局数据集替换"] },
];

/**
 * 数据大屏 —— 大屏不是「把看板拉大」，但也不该是另一套编辑器：它还是同一张节点画布，
 * 只是积木换了一副。左栏把大屏节点按 8 类摊开（页面与编排、标题装饰、信息图、图表、
 * 地图、媒体、控件、交互），中间这张画布上有三段：
 *   ①  取数链 —— 与看板共用数据集，全局替换只换一次；
 *   ②  大屏页面 1 —— 1920 × 1080 的屏面，8 块组件按 16:9 摆在这个分组框里；
 *   ③  页面编排与产物 —— 图层组、轮播、页面集与带链接的产物。
 * 于是「大屏长什么样」和「它怎么搭出来的」是同一张图上的两件事。
 */
export default function BigScreenCanvas() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
				<Icon name="icon-[lucide--monitor]" className="size-4 shrink-0 text-accent" />
				<span className="text-[13px] font-semibold text-surface-foreground">渠道经营大屏</span>
				<Chip tone="accent">大屏 · 1920 × 1080</Chip>
				<Chip>3 页 · 15 个节点</Chip>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<Btn size="sm" variant="ghost" icon="icon-[lucide--share-2]">
						分享
					</Btn>
					<Btn size="sm" variant="default" icon="icon-[lucide--play]">
						预览
					</Btn>
					<Btn size="sm" variant="primary" icon="icon-[lucide--upload]">
						发布到工作树
					</Btn>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
						<Icon name="icon-[lucide--boxes]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[12px] font-medium text-surface-foreground">大屏节点</span>
						<span className="ml-auto font-mono text-[10px] tabular-nums text-faint">8 类 · 18 种</span>
					</div>

					<div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2 py-2">
						{LIB.map((c) => (
							<div key={c.cls} className="flex shrink-0 flex-col gap-0.5">
								<div className="flex h-6 items-center gap-1.5 px-2">
									<Icon name={c.icon} className="size-3 shrink-0 text-faint" />
									<span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted">{c.cls}</span>
									<span className="shrink-0 font-mono text-[9px] tabular-nums text-faint">{c.items.length}</span>
								</div>
								{c.items.map((it) => (
									<div key={it} className="flex h-6 items-center gap-2 rounded-[4px] pr-2 pl-5">
										<span className="size-1 shrink-0 rounded-[1px] bg-border-strong" />
										<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{it}</span>
									</div>
								))}
							</div>
						))}
					</div>

					<div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border px-2 pt-3 pb-3">
						<div className="flex items-center">
							<span className="text-[10px] text-faint">运行账</span>
							<span className="ml-auto text-[11px] text-surface-foreground">与看板共用</span>
						</div>
						<div className="flex items-center">
							<span className="text-[10px] text-faint">页面上限</span>
							<span className="ml-auto font-mono text-[11px] tabular-nums text-surface-foreground">10 页</span>
						</div>
						<div className="flex items-center">
							<span className="text-[10px] text-faint">自动刷新</span>
							<span className="ml-auto font-mono text-[11px] tabular-nums text-surface-foreground">5 分钟</span>
						</div>
						<p className="text-[10px] leading-4 text-faint">
							大屏节点和看板节点是同一批积木：图表与控件直接复用，编排与信息图另有一套。产物各有独立链接。
						</p>
					</div>
				</aside>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
						<Icon name="icon-[lucide--monitor]" className="size-3.5 shrink-0 text-muted" />
						<span className="text-[11px] text-muted">画布 1920 × 1080</span>
						<Chip mono>缩放 52.5%</Chip>
						<span className="h-4 w-px shrink-0 bg-border" />
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--grid-2x2]" className="size-3 shrink-0" />
							吸附已开
						</span>
						<span className="flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted">
							<Icon name="icon-[lucide--sliders-horizontal]" className="size-3 shrink-0" />
							安全区参考线
						</span>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<Chip icon="icon-[lucide--clock]">自动刷新 5 分钟</Chip>
							<Btn size="sm" variant="primary" icon="icon-[lucide--play]">
								整体运行
							</Btn>
							<span className="h-4 w-px shrink-0 bg-border" />
							<Btn size="xs" variant="ghost">
								适配视图
							</Btn>
							<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
							<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
						</div>
					</div>

					<CanvasGround groups={GROUPS} links={LINKS}>
						{[...SOURCE_NODES, ...PAGE_NODES, ...TAIL_NODES].map((n) => (
							<Node key={n.key} node={n} />
						))}

						<div className="absolute w-80 text-[10px] leading-4 text-faint" style={{ left: 852, top: 56 }}>
							屏上每块组件都在这条链上有出处：想换表只动这里一次，8 块组件跟着换，看板那边不受影响。
						</div>

						<div className="absolute w-[560px] text-[10px] leading-4 text-faint" style={{ left: 136, top: 696 }}>
							屏面按 1920 × 1080 排，缩到 52.5% 摆在这张画布上；拖一下换位置，选中就改参数，单块也能先跑。
						</div>
					</CanvasGround>
				</div>
			</div>
		</div>
	);
}
