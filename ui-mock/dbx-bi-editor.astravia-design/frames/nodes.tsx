export const frame = { width: 1440, height: 1000, title: "BI · 节点总览（全部节点类型）" };

import { Fragment } from "react";

import Chip from "../components/Chip";
import Icon from "../components/Icon";
import IconButton from "../components/IconButton";
import CanvasGround from "../components/editor/CanvasGround";
import NodeCard, { NodeRow, NodeValue, TONE } from "../components/editor/NodeCard";

type Spec = { title: string; type: string; icon: string; tone: string; rows: [string, string][]; note: string };
type Band = { label: string; hint: string; items: Spec[] };

const T = TONE.table;
const C = TONE.chart;
const R = TONE.result;

const BANDS: Band[] = [
	{
		label: "数据",
		hint: "从哪来 —— 输出 table 插座",
		items: [
			{
				title: "ods_orders",
				type: "数据源",
				icon: "icon-[lucide--database]",
				tone: T,
				rows: [["连接", "prod-mysql"], ["模式", "直连"]],
				note: "从插件工作台已连接的数据源取表，不落库",
			},
			{
				title: "ds_orders",
				type: "数据集",
				icon: "icon-[lucide--scroll-text]",
				tone: T,
				rows: [["来源", "一键套用"], ["字段", "8 列"]],
				note: "一键套用或手写，可被多个图表节点复用",
			},
			{
				title: "sql_gmv_14d",
				type: "手写 SQL",
				icon: "icon-[lucide--pencil]",
				tone: T,
				rows: [["引擎", "duckdb"], ["缓存", "10 分钟"]],
				note: "与宿主 AI 对话把 SQL 写出来，再存成语数据集",
			},
			{
				title: "2024Q3.csv",
				type: "本地文件",
				icon: "icon-[lucide--upload]",
				tone: T,
				rows: [["行数", "12 486"], ["列", "8 列"]],
				note: "拖进来直接当表用，只在本次会话有效",
			},
		],
	},
	{
		label: "图表",
		hint: "画什么 —— 输出 image，可单独运行出预览",
		items: [
			{
				title: "line_gmv_14d",
				type: "折线图",
				icon: "icon-[lucide--chart-line]",
				tone: C,
				rows: [["X 轴", "date"], ["Y 轴", "gmv"]],
				note: "趋势对比 · 6 种变体，含去年同期虚线",
			},
			{
				title: "bar_city",
				type: "柱状图",
				icon: "icon-[lucide--chart-column]",
				tone: C,
				rows: [["维度", "city"], ["排序", "降序"]],
				note: "分类比较 · 5 种变体，横竖可切",
			},
			{
				title: "donut_channel",
				type: "饼环图",
				icon: "icon-[lucide--chart-pie]",
				tone: C,
				rows: [["维度", "channel"], ["内环", "开"]],
				note: "占比构成 · 环图与扇形可切",
			},
			{
				title: "kpi_row",
				type: "指标卡",
				icon: "icon-[lucide--gauge]",
				tone: C,
				rows: [["度量", "gmv"], ["对比", "环比"]],
				note: "单值 + 同环比，看板顶部的四张卡就是它",
			},
			{
				title: "funnel_flow",
				type: "漏斗图",
				icon: "icon-[lucide--filter]",
				tone: C,
				rows: [["阶段", "4 段"], ["口径", "人数"]],
				note: "转化衰减 · 阶段按值自动收窄",
			},
			{
				title: "box_price",
				type: "箱线图",
				icon: "icon-[lucide--box]",
				tone: C,
				rows: [["分组", "渠道"], ["指标", "客单价"]],
				note: "分布与离群点 · 五数概括",
			},
		],
	},
	{
		label: "大屏",
		hint: "1920 × 1080 基准 —— 字号与间距按 3 倍投屏重新排过",
		items: [
			{
				title: "大屏标题",
				type: "标题条",
				icon: "icon-[lucide--monitor]",
				tone: C,
				rows: [["字号", "64 px"], ["装饰", "分隔线"]],
				note: "一条居中的标题 + 左右装饰线，不是普通文本节点",
			},
			{
				title: "大屏指标卡",
				type: "大屏指标",
				icon: "icon-[lucide--activity]",
				tone: C,
				rows: [["字号", "96 px"], ["动效", "数字滚动"]],
				note: "看板指标卡的大屏版，数字口径一致、只是排列更开",
			},
			{
				title: "大屏排行榜",
				type: "排行榜",
				icon: "icon-[lucide--list-ordered]",
				tone: C,
				rows: [["条数", "前 10"], ["滚动", "8s 一轮"]],
				note: "名次带条形底，超过一屏自动轮播",
			},
			{
				title: "大屏轮播",
				type: "轮播容器",
				icon: "icon-[lucide--layout-dashboard]",
				tone: C,
				rows: [["页数", "3 页"], ["间隔", "15s"]],
				note: "把多个大屏页面串成一轮，节点里只放编排参数",
			},
		],
	},
	{
		label: "控件与产物",
		hint: "谁来改 —— 输出 control，不影响取数",
		items: [
			{
				title: "filter_channel",
				type: "筛选器",
				icon: "icon-[lucide--list-filter]",
				tone: "var(--color-warning)",
				rows: [["字段", "channel"], ["默认", "抖音"]],
				note: "连到图表节点即生效，整页共用一个筛选区",
			},
			{
				title: "date_range",
				type: "日期区间",
				icon: "icon-[lucide--calendar-clock]",
				tone: "var(--color-warning)",
				rows: [["默认", "近 14 天"], ["快捷", "4 项"]],
				note: "快捷区间 + 自定义起止，改动会重跑下游",
			},
			{
				title: "看板产物 · 概览",
				type: "产物页面",
				icon: "icon-[lucide--grid-2x2]",
				tone: R,
				rows: [["组件", "6 个"], ["列数", "12 列"]],
				note: "把上游图表排成一页；产物节点不自己取数",
			},
			{
				title: "发布与分享",
				type: "发布",
				icon: "icon-[lucide--share-2]",
				tone: R,
				rows: [["目标", "BI 工作树"], ["链接", "永久 / 限期"]],
				note: "存进工作树并给出可复制的链接，一次动作",
			},
		],
	},
];

function Specimen({ s }: { s: Spec }) {
	return (
		<div className="flex w-[196px] shrink-0 flex-col gap-1.5">
			<div className="relative h-[104px] w-[196px]">
				<NodeCard
					title={s.title}
					type={s.type}
					icon={s.icon}
					tone={s.tone}
					x={0}
					y={0}
					w={196}
					h={104}
					outputs={[{ row: 0, tone: s.tone }]}
				>
					{s.rows.map(([k, v]) => (
						<NodeRow key={k} label={k}>
							<NodeValue mono>{v}</NodeValue>
						</NodeRow>
					))}
				</NodeCard>
			</div>
			<span className="h-8 text-[10px] leading-4 text-faint">{s.note}</span>
		</div>
	);
}

const LEGEND = [
	{ tone: TONE.table, label: "table · 数据" },
	{ tone: TONE.chart, label: "image · 图表" },
	{ tone: TONE.control, label: "control · 控件" },
	{ tone: TONE.result, label: "product · 产物" },
];

/**
 * 节点总览 —— 一张画布上把「一共有哪些节点」摊开。节点形状先于节点名字：
 * 插座的颜色说明它吃进去什么、吐出来什么，所以看一遍颜色就能拼出一条数。
 * 这一屏也是新用户第一次进工作台时的落点：先看懂积木，再去拼。
 */
export default function NodeCatalog() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-6">
				<Icon name="icon-[lucide--boxes]" className="size-4 shrink-0 text-accent" />
				<span className="text-[15px] font-semibold text-surface-foreground">节点总览</span>
				<Chip tone="accent">18 种 · 看板 14 / 大屏 4</Chip>
				<div className="flex h-7 shrink-0 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
					{["全部", "看板节点", "大屏节点"].map((t) => (
						<span
							key={t}
							className={`flex h-[22px] items-center rounded-[4px] px-2 text-[11px] ${
								t === "全部" ? "bg-accent-soft font-medium text-accent" : "text-muted"
							}`}
						>
							{t}
						</span>
					))}
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<div className="flex h-7 w-56 items-center gap-2 rounded-control border border-border bg-surface px-2">
						<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
						<span className="text-[11px] text-faint">搜索节点类型…</span>
					</div>
					<span className="text-[11px] text-muted">2 个数据源已连接</span>
					<span className="h-4 w-px shrink-0 bg-border" />
					<IconButton size="sm" icon="icon-[lucide--minus]" title="缩小" />
					<span className="w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted">100%</span>
					<IconButton size="sm" icon="icon-[lucide--plus]" title="放大" />
				</div>
			</header>

			<CanvasGround>
				<div className="absolute inset-0 overflow-hidden p-6">
					<div className="grid grid-cols-6 gap-x-4 gap-y-4">
						{BANDS.map((b) => (
								<Fragment key={b.label}>
									<div className="col-span-6 flex items-center gap-3">
									<span className="text-[12px] font-semibold text-surface-foreground">{b.label}</span>
									<span className="text-[10px] text-faint">{b.hint}</span>
									<span className="h-px flex-1 bg-border" />
									<span className="font-mono text-[10px] tabular-nums text-faint">{b.items.length}</span>
								</div>
								{b.items.map((s) => (
									<Specimen key={s.title} s={s} />
								))}
								</Fragment>
						))}
					</div>
				</div>

				<div className="absolute bottom-4 left-6 right-6 flex h-9 items-center gap-3 rounded-card border border-border bg-surface-raised px-3">
					{LEGEND.map((l) => (
						<span key={l.label} className="flex items-center gap-1.5">
							<span className="size-2 rounded-full" style={{ background: l.tone }} />
							<span className="font-mono text-[10px] text-muted">{l.label}</span>
						</span>
					))}
					<span className="ml-auto text-[10px] text-faint">
						每种节点都能单独运行 · 右键画布添加 · 产物统一落进 BI 工作树
					</span>
				</div>
			</CanvasGround>
		</div>
	);
}
