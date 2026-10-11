import Icon from "../Icon";

/**
 * 节点库。原来这里是「组件面板」——拖一个盒子到网格上；现在拖出来的是节点，
 * 所以每一行右边都有一个「+」：目标是「添加节点」而不是「摆放组件」。
 * 「从数据集生成」被提到最上面，因为从一个已经连上的数据集直接长出节点，
 * 比先想清楚要哪个图再找数据集要快。
 */

type Kind = "line" | "column" | "donut" | "funnel" | "scatter" | "metric";

type Item = { label: string; icon: string; badge?: boolean } | { label: string; kind: Kind };

const GROUPS: { label: string; items: Item[] }[] = [
	{
		label: "数据源",
		items: [
			{ label: "数据集", icon: "icon-[lucide--database]" },
			{ label: "SQL 查询", icon: "icon-[lucide--scroll-text]" },
			{ label: "筛选器", icon: "icon-[lucide--list-filter]" },
		],
	},
	{
		label: "图表",
		items: [
			{ label: "折线图", kind: "line" },
			{ label: "柱状图", kind: "column" },
			{ label: "环形图", kind: "donut" },
			{ label: "漏斗图", kind: "funnel" },
			{ label: "散点图", kind: "scatter" },
			{ label: "指标卡", kind: "metric" },
		],
	},
	{
		label: "控件",
		items: [
			{ label: "查询控件", icon: "icon-[lucide--sliders-horizontal]" },
			{ label: "文本", icon: "icon-[lucide--type]" },
			{ label: "日期范围", icon: "icon-[lucide--calendar-range]" },
		],
	},
	{
		label: "输出",
		items: [
			{ label: "看板产物", icon: "icon-[lucide--layout-dashboard]" },
			{ label: "多页看板", icon: "icon-[lucide--layout-grid]" },
		],
	},
	{
		label: "高级组件",
		items: [
			{ label: "统计摘要", icon: "icon-[lucide--zap]", badge: true },
			{ label: "页签容器", icon: "icon-[lucide--layout-grid]", badge: true },
			{ label: "明细表格", icon: "icon-[lucide--table-2]", badge: true },
			{ label: "日期选择", icon: "icon-[lucide--calendar-range]", badge: true },
		],
	},
];

const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);

const mark = "var(--color-series-1)";

/** 图表类节点用形状缩略图，不用「长得像」的图标：折线就是折线。 */
function Thumb({ kind }: { kind: Kind }) {
	return (
		<svg viewBox="0 0 18 18" className="size-[18px] shrink-0">
			{kind === "line" ? (
				<path
					d="M2 13 L7 9 L11 11 L16 5"
					fill="none"
					stroke={mark}
					strokeWidth="1.6"
					strokeLinecap="round"
				/>
			) : null}
			{kind === "column" ? (
				<path d="M4 13 V9 M9 13 V5 M14 13 V7" stroke={mark} strokeWidth="2.6" strokeLinecap="round" />
			) : null}
			{kind === "donut" ? (
				<circle
					cx="9"
					cy="9"
					r="5.5"
					fill="none"
					stroke={mark}
					strokeWidth="3"
					strokeDasharray="24 12"
				/>
			) : null}
			{kind === "funnel" ? (
				<>
					<rect x="2" y="4" width="14" height="3" rx="1" fill={mark} opacity="0.9" />
					<rect x="4.5" y="9" width="9" height="3" rx="1" fill={mark} opacity="0.6" />
					<rect x="7" y="14" width="4" height="3" rx="1" fill={mark} opacity="0.35" />
				</>
			) : null}
			{kind === "scatter" ? (
				<>
					<circle cx="4" cy="13" r="1.5" fill={mark} />
					<circle cx="8.5" cy="8.5" r="1.5" fill={mark} />
					<circle cx="12.5" cy="11" r="1.5" fill={mark} />
					<circle cx="15" cy="5" r="1.5" fill={mark} />
				</>
			) : null}
			{kind === "metric" ? (
				<>
					<rect x="2" y="4.5" width="14" height="2" rx="1" fill={mark} opacity="0.4" />
					<rect x="2" y="9.5" width="8" height="4.5" rx="1" fill={mark} />
				</>
			) : null}
		</svg>
	);
}

export default function NodeLibrary() {
	return (
		<aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--layers]" className="size-3.5 shrink-0 text-muted" />
				<span className="text-[12px] font-medium text-surface-foreground">节点库</span>
				<span className="ml-auto font-mono text-[10px] text-faint">{TOTAL} 个</span>
			</div>

			<div className="shrink-0 px-3 py-2">
				<div className="flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="min-w-0 flex-1 truncate text-[11px] text-faint">搜索节点</span>
					<span className="shrink-0 font-mono text-[10px] text-faint">⌘K</span>
				</div>
			</div>

			<button className="mx-3 flex shrink-0 items-center gap-2 rounded-control border border-accent/40 bg-accent-soft px-2 py-1.5 text-left">
				<Icon name="icon-[lucide--database]" className="size-4 shrink-0 text-accent" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-[11px] font-medium text-surface-foreground">从数据集生成</span>
					<span className="truncate text-[10px] text-muted">插件工作台已连接的库 · 直接起图</span>
				</span>
				<Icon name="icon-[lucide--plus]" className="size-3.5 shrink-0 text-accent" />
			</button>

			<div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden pb-1">
				{GROUPS.map((g) => (
					<div key={g.label} className="flex flex-col pt-2">
						<div className="flex h-6 shrink-0 items-center gap-1.5 px-3">
							<span className="text-[10px] text-faint">{g.label}</span>
							<span className="h-px flex-1 bg-border" />
							<span className="font-mono text-[10px] text-faint">{g.items.length}</span>
						</div>
						{g.items.map((item) => (
							<div key={item.label} className="flex h-7 shrink-0 items-center gap-2 px-3">
								{"kind" in item ? <Thumb kind={item.kind} /> : <Icon name={item.icon} className="size-[18px] shrink-0 text-muted" />}
								<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">
									{item.label}
								</span>
								{item.badge ? <span className="shrink-0 font-mono text-[9px] text-ai">J</span> : null}
								<Icon name="icon-[lucide--plus]" className="size-3 shrink-0 text-faint" />
							</div>
						))}
					</div>
				))}
			</div>

			<div className="flex h-9 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[10px] text-faint">
				<Icon name="icon-[lucide--info]" className="size-3 shrink-0" />
				拖到画布添加节点 · 双击插入
			</div>
		</aside>
	);
}
