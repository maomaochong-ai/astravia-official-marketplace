/**
 * node-library.tsx — 左栏节点库（设计稿扁平分组列表风格）。
 *
 * 参考 ui-mock/.../NodeLibrary.tsx 实现：
 *   - 顶栏 Icon(layers) + text("节点库") + total 数量 font-mono
 *   - 搜索框 h-8，带 ⌘K 提示，真实前端过滤
 *   - "从数据集生成" 宽按钮（装饰 + getUi notify）
 *   - 扁平 GROUPS：数据源 / 图表 / 控件 / 输出 / 高级组件
 *   - 图表类用 Thumb SVG 小缩略图（折线/柱状/环形/漏斗/散点/指标卡）
 *   - 每行 h-7：icon 或 Thumb + label + 可选 badge(J) + plus 按钮
 *   - 分组标题行 h-6：label + 分隔线 + count
 *   - 底部 hint h-9
 *   - 保留折叠态、模板库、DnD 行为
 */

import { type JSX, type DragEvent, useMemo, useState } from "react";
import { Icon } from "../../shared/components/ui/icon";
import { getUi } from "../../../../runtime-contract";

interface TemplateItem { id: string; name: string; template: string; createTime: string; }

type ThumbKind = "line" | "column" | "donut" | "funnel" | "scatter" | "metric";

interface GroupItem {
	/** 对应 NODE_TEMPLATES 的 key，用于 DnD kind */
	key: string;
	label: string;
	/** lucide icon 名（数据源/控件/输出/高级组件/大屏部分用） */
	icon?: string;
	/** 图表类用内联 SVG 缩略图 */
	thumbKind?: ThumbKind;
	/** 高级组件标记 */
	badge?: boolean;
}

interface Group { label: string; hint?: string; items: GroupItem[] }

/**
 * 扁平 GROUPS —— 严格对齐设计稿 nodes.tsx BANDS 四组结构。
 * key 必须对齐 node-graph.tsx 的 NODE_TEMPLATES（或本轮新增的 key）。
 */
const GROUPS: Group[] = [
	{
		label: "数据",
		hint: "从哪来 · 输出 table",
		items: [
			{ key: "source-connector", label: "数据源",   icon: "icon-[lucide--database]" },
			{ key: "source-table",     label: "数据集",   icon: "icon-[lucide--scroll-text]" },
			{ key: "source-sql",       label: "手写SQL",  icon: "icon-[lucide--pencil]" },
			{ key: "source-csv",       label: "本地文件", icon: "icon-[lucide--upload]" },
		],
	},
	{
		label: "图表",
		hint: "画什么 · 输出 image",
		items: [
			{ key: "chart-line",     label: "折线图",   thumbKind: "line" },
			{ key: "chart-bar",      label: "柱状图",   thumbKind: "column" },
			{ key: "chart-pie",      label: "饼环图",   thumbKind: "donut" },
			{ key: "chart-kpi",      label: "指标卡",   thumbKind: "metric" },
			{ key: "chart-funnel",   label: "漏斗图",   thumbKind: "funnel" },
			{ key: "chart-boxplot",  label: "箱线图",   icon: "icon-[lucide--box]" },
			{ key: "chart-area",     label: "面积图",   icon: "icon-[lucide--area-chart]" },
			{ key: "chart-scatter",  label: "散点图",   icon: "icon-[lucide--chart-scatter]" },
			{ key: "chart-radar",    label: "雷达图",   icon: "icon-[lucide--radar]" },
			{ key: "chart-heatmap",  label: "热力图",   icon: "icon-[lucide--grid-3x3]" },
			{ key: "chart-treemap",  label: "矩形树图", icon: "icon-[lucide--layout-grid]" },
			{ key: "chart-sankey",   label: "桑基图",   icon: "icon-[lucide--git-fork]" },
			{ key: "chart-waterfall",label: "瀑布图",   icon: "icon-[lucide--waves]" },
			{ key: "chart-gauge",    label: "仪表盘",   icon: "icon-[lucide--gauge]" },
			{ key: "chart-combo",    label: "双轴图",   icon: "icon-[lucide--chart-no-axes-combined]" },
		],
	},
	{
		label: "大屏",
		hint: "1920 × 1080",
		items: [
			{ key: "screen-page",    label: "大屏页面",   icon: "icon-[lucide--presentation]" },
			{ key: "screen-title",   label: "大屏标题",   icon: "icon-[lucide--monitor]" },
			{ key: "screen-metric",  label: "大屏翻牌器", icon: "icon-[lucide--activity]" },
			{ key: "screen-rank",    label: "大屏排行榜", icon: "icon-[lucide--list-ordered]" },
			{ key: "screen-map",     label: "大屏地图",   icon: "icon-[lucide--map]" },
			{ key: "screen-carousel",label: "大屏轮播",   icon: "icon-[lucide--layout-dashboard]" },
		],
	},
	{
		label: "控件与产物",
		hint: "谁来改",
		items: [
			{ key: "filter-select",   label: "筛选器",   icon: "icon-[lucide--list-filter]" },
			{ key: "filter-date",     label: "日期区间", icon: "icon-[lucide--calendar-clock]" },
			{ key: "output-page",     label: "产物页面", icon: "icon-[lucide--grid-2x2]" },
			{ key: "output-publish",  label: "发布",     icon: "icon-[lucide--share-2]" },
		],
	},
	{
		label: "高级组件",
		items: [
			{ key: "adv-summary", label: "统计摘要", icon: "icon-[lucide--zap]",             badge: true },
			{ key: "adv-tabs",    label: "页签容器", icon: "icon-[lucide--layout-grid]",      badge: true },
			{ key: "adv-table",   label: "明细表格", icon: "icon-[lucide--table-2]",          badge: true },
			{ key: "adv-calendar",label: "日期选择", icon: "icon-[lucide--calendar-range]",    badge: true },
		],
	},
	{
		label: "分组容器",
		items: [
			{ key: "group-source",  label: "数据源区", icon: "icon-[lucide--database]" },
			{ key: "group-chart",   label: "图表区",   icon: "icon-[lucide--chart-column]" },
			{ key: "group-custom",  label: "自定义分组", icon: "icon-[lucide--layers]" },
		],
	},
];

const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);

const mark = "var(--color-series-1)";

/** 图表类节点用内联 SVG 形状缩略图，不用「长得像」的图标。 */
function Thumb({ kind }: { kind: ThumbKind }) {
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

export function NodeLibrary({
	collapsed = false,
	onToggleCollapsed,
	templates = [],
	onDeleteTemplate,
}: {
	collapsed?: boolean;
	onToggleCollapsed?: () => void;
	templates?: TemplateItem[];
	onDeleteTemplate?: (id: string) => void;
}): JSX.Element {
	const [search, setSearch] = useState("");

	/** 按搜索词过滤 GROUPS：组内没有匹配项时整组隐藏。 */
	const filteredGroups = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return GROUPS;
		return GROUPS
			.map((g) => ({
				...g,
				items: g.items.filter(
					(n) =>
						n.label.toLowerCase().includes(q) ||
						n.key.toLowerCase().includes(q),
				),
			}))
			.filter((g) => g.items.length > 0);
	}, [search]);

	if (collapsed) {
		return (
			<div className="flex h-full w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-raised py-2">
				<button
					type="button"
					onClick={onToggleCollapsed}
					className="grid size-7 place-items-center rounded-control text-muted hover:bg-accent-soft hover:text-accent transition-colors"
					title="展开节点库"
				>
					<Icon name="icon-[lucide--panel-left-open]" className="size-3.5" />
				</button>
			</div>
		);
	}

	return (
		<aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden bg-surface-raised">
			{/* 顶栏 h-9 */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<Icon name="icon-[lucide--layers]" className="size-3.5 shrink-0 text-muted" />
				<span className="text-[12px] font-medium text-surface-foreground">节点库</span>
				<span className="ml-auto font-mono text-[10px] text-faint">{TOTAL} 个</span>
				<button
					type="button"
					onClick={onToggleCollapsed}
					className="grid size-6 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent"
					title="收起节点库"
				>
					<Icon name="icon-[lucide--panel-left-close]" className="size-3.5" />
				</button>
			</div>

			{/* 搜索框 h-8，带 ⌘K 提示 */}
			<div className="shrink-0 px-3 py-2">
				<div className="flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<input
						id="node-library-search"
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="搜索节点"
						className="min-w-0 flex-1 bg-transparent text-[11px] text-surface-foreground outline-none placeholder:text-faint"
					/>
					{search ? (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="grid size-4 shrink-0 place-items-center rounded-[2px] text-faint hover:bg-border hover:text-surface-foreground"
							title="清空搜索"
						>
							<Icon name="icon-[lucide--x]" className="size-2.5" />
						</button>
					) : (
						<span className="shrink-0 font-mono text-[10px] text-faint">⌘K</span>
					)}
				</div>
			</div>

			{/* "从数据集生成" 宽按钮 */}
			<button
				type="button"
				onClick={() =>
					getUi()?.notify?.({
						message: "从数据集生成待接宿主 AI 端点",
						variant: "info",
					})
				}
				className="mx-3 flex shrink-0 items-center gap-2 rounded-control border border-accent/40 bg-accent-soft px-2 py-1.5 text-left"
				title="从已连数据集自动生成节点"
			>
				<Icon name="icon-[lucide--database]" className="size-4 shrink-0 text-accent" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-[11px] font-medium text-surface-foreground">从数据集生成</span>
					<span className="truncate text-[10px] text-muted">插件工作台已连接的库 · 直接起图</span>
				</span>
				<Icon name="icon-[lucide--plus]" className="size-3.5 shrink-0 text-accent" />
			</button>

			{/* GROUPS 主体 + 我的模板 */}
			<div className="dbx-scroll mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto pb-1">
				{filteredGroups.length === 0 ? (
					<div className="flex h-16 items-center justify-center text-[11px] text-faint">（没有匹配的节点）</div>
				) : (
					filteredGroups.map((g) => (
						<div key={g.label} className="flex flex-col pt-2">
							{/* 分组标题行 h-6 */}
							<div className="flex h-6 shrink-0 items-center gap-1.5 px-3">
								<span className="text-[10px] text-faint">{g.label}</span>
								<span className="h-px flex-1 bg-border" />
								<span className="font-mono text-[10px] text-faint">{g.items.length}</span>
							</div>
							{g.items.map((item) => (
								<div
									key={item.key + "|" + item.label}
									/** 整行可拖 */
									draggable
									onDragStart={(e: DragEvent<HTMLDivElement>) => {
										e.dataTransfer.effectAllowed = "copy";
										e.dataTransfer.setData(
											"application/json",
											JSON.stringify({
												kind: "node",
												nodeType: item.key,
												label: item.label,
											}),
										);
									}}
									className="group flex h-7 shrink-0 cursor-grab items-center gap-2 px-3 active:cursor-grabbing hover:bg-accent-soft/40"
									title={`${item.label}（拖到画布）`}
								>
									{item.thumbKind ? (
										<Thumb kind={item.thumbKind} />
									) : item.icon ? (
										<Icon name={item.icon} className="size-[18px] shrink-0 text-muted" />
									) : null}
									<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">
										{item.label}
									</span>
									{item.badge ? <span className="shrink-0 font-mono text-[9px] text-ai">J</span> : null}
									<Icon name="icon-[lucide--plus]" className="size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
							))}
						</div>
					))
				)}

				{/* 我的模板 */}
				<div className="mt-2 flex flex-col pt-2">
					<div className="flex h-6 shrink-0 items-center gap-1.5 px-3">
						<span className="text-[10px] text-faint">我的模板</span>
						<span className="h-px flex-1 bg-border" />
						<span className="font-mono text-[10px] text-faint">{templates.length}</span>
					</div>
					{templates.length === 0 ? (
						<div className="px-3 text-[10px] text-faint">（空）</div>
					) : (
						templates.map((t) => (
							<div
								key={t.id}
								draggable
								onDragStart={(e: DragEvent<HTMLDivElement>) => {
									e.dataTransfer.effectAllowed = "copy";
									e.dataTransfer.setData(
										"application/json",
										JSON.stringify({ kind: "template", templateId: t.id }),
									);
								}}
								className="group flex h-7 shrink-0 cursor-grab items-center gap-2 px-3 active:cursor-grabbing hover:bg-accent-soft/40"
								title={`${t.name}（拖到画布加载为整个模板）`}
							>
								<Icon name="icon-[lucide--layout-template]" className="size-[18px] shrink-0 text-accent" />
								<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{t.name}</span>
								{onDeleteTemplate ? (
									<span
										role="button"
										onClick={(ev) => { ev.stopPropagation(); onDeleteTemplate(t.id); }}
										className="grid size-4 shrink-0 place-items-center rounded-[2px] text-faint opacity-0 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger transition-opacity"
										title="删除模板"
									>×</span>
								) : null}
							</div>
						))
					)}
				</div>
			</div>

			{/* 底部 hint h-9 */}
			<div className="flex h-9 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[10px] text-faint">
				<Icon name="icon-[lucide--info]" className="size-3 shrink-0" />
				拖到画布添加节点 · 双击插入
			</div>
		</aside>
	);
}
