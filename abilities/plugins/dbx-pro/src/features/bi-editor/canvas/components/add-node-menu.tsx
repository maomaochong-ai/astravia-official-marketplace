/**
 * add-node-menu.tsx — 画布右键添加节点菜单（设计稿 menu.tsx + AddNodeMenu.tsx 对齐）。
 *
 * 分组结构：数据 / 图表 / 大屏 / 控件与产物
 * 变体联动：选中带 variants 的项 → 右侧展开变体子菜单（x + 248 + 8, y + offset）
 * - 不再自己渲染遮罩，遮罩由父层 NodeGraph 提供（absolute inset-0 bg-background/55）
 * - 菜单位置从光标处长出，变体在选中项右侧展开
 * - 带坐标显示、搜索提示、底部双击快捷键提示
 */

import { useState, type JSX } from "react";
import { Icon } from "../../shared/components/ui/icon";

/** 变体：同一个图表入口下的预设（映射到不同 kind，或同一 kind 加初始配置）。 */
interface MenuVariant {
	label: string;
	kind: string;
	values?: Record<string, unknown>;
}

interface Props {
	x: number;
	y: number;
	onPick: (kind: string, values?: Record<string, unknown>) => void;
	onClose: () => void;
}

interface MenuItem {
	icon: string;
	label: string;
	hint?: string;
	kind: string;
	variants?: MenuVariant[];
}

interface MenuGroup {
	label: string;
	items: MenuItem[];
}

const GROUPS: MenuGroup[] = [
	{
		label: "数据",
		items: [
			{ icon: "icon-[lucide--scroll-text]", label: "SQL 查询", hint: "写 SQL", kind: "source-sql" },
			{ icon: "icon-[lucide--table-2]", label: "表读取", hint: "选表即取", kind: "source-table" },
			{ icon: "icon-[lucide--database]", label: "直连数据源", hint: "已连接库", kind: "source-connector" },
			{ icon: "icon-[lucide--clipboard-paste]", label: "粘贴 CSV", hint: "本地数据", kind: "source-csv" },
			{ icon: "icon-[lucide--braces]", label: "HTTP 接口", hint: "返回 JSON", kind: "source-api" },
		],
	},
	{
		label: "图表",
		items: [
			{
				icon: "icon-[lucide--chart-line]", label: "折线图", hint: "6 变体", kind: "chart-line",
				variants: [
					{ label: "基础折线", kind: "chart-line" },
					{ label: "面积图", kind: "chart-area" },
					{ label: "堆叠面积", kind: "chart-area", values: { stack: "normal" } },
					{ label: "百分比面积", kind: "chart-area", values: { stack: "percent" } },
					{ label: "平滑曲线", kind: "chart-line", values: { smooth: "yes" } },
					{ label: "双轴组合", kind: "chart-combo" },
				],
			},
			{
				icon: "icon-[lucide--chart-column]", label: "柱状图", hint: "6 变体", kind: "chart-bar",
				variants: [
					{ label: "分组柱", kind: "chart-bar" },
					{ label: "堆叠柱", kind: "chart-bar", values: { stack: "normal" } },
					{ label: "百分比柱", kind: "chart-bar", values: { stack: "percent" } },
					{ label: "横向柱", kind: "chart-bar", values: { orientation: "horizontal" } },
					{ label: "双轴组合", kind: "chart-combo" },
					{ label: "瀑布图", kind: "chart-waterfall" },
				],
			},
			{
				icon: "icon-[lucide--chart-pie]", label: "饼图 / 环图", hint: "2 变体", kind: "chart-pie",
				variants: [
					{ label: "实心饼图", kind: "chart-pie" },
					{ label: "环形图", kind: "chart-donut" },
				],
			},
			{ icon: "icon-[lucide--chart-scatter]", label: "散点图", kind: "chart-scatter" },
			{ icon: "icon-[lucide--radar]", label: "雷达图", kind: "chart-radar" },
			{ icon: "icon-[lucide--filter]", label: "漏斗图", kind: "chart-funnel" },
			{ icon: "icon-[lucide--grid-3x3]", label: "热力图", kind: "chart-heatmap" },
			{ icon: "icon-[lucide--layout-grid]", label: "矩形树图", kind: "chart-treemap" },
			{ icon: "icon-[lucide--git-fork]", label: "桑基图", kind: "chart-sankey" },
			{ icon: "icon-[lucide--waves]", label: "瀑布图", kind: "chart-waterfall" },
			{ icon: "icon-[lucide--gauge]", label: "仪表盘", kind: "chart-gauge" },
			{ icon: "icon-[lucide--chart-no-axes-combined]", label: "箱线图", kind: "chart-boxplot" },
			{ icon: "icon-[lucide--hash]", label: "指标卡", kind: "chart-kpi" },
		],
	},
	{
		label: "大屏",
		items: [
			{ icon: "icon-[lucide--heading]", label: "大屏标题", kind: "screen-title" },
			{ icon: "icon-[lucide--activity]", label: "大屏指标卡", kind: "screen-metric" },
			{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜", kind: "screen-rank" },
		],
	},
	{
		label: "控件与产物",
		items: [
			{ icon: "icon-[lucide--list-filter]", label: "筛选器", kind: "filter-select" },
			{ icon: "icon-[lucide--table]", label: "明细表", kind: "output-table" },
			{ icon: "icon-[lucide--layout-dashboard]", label: "看板页面", kind: "output-page" },
			{ icon: "icon-[lucide--share-2]", label: "发布与分享", kind: "output-publish" },
		],
	},
];

const MENU_W = 248;   // 主菜单宽度（与设计稿一致）
const VARIANT_W = 176; // 变体子菜单宽度
const MENU_HEADER_H = 32; // 标题栏 h-8(32) — 菜单主体从 y+32 起
const ITEM_H = 28;     // 每个菜单项高 h-7 = 28px
const GROUP_HEADER_H = 20; // 分组标题高

export function AddNodeMenu({ x, y, onPick, onClose }: Props): JSX.Element {
	/** 当前展开变体的 item kind（无变体的项选中后立即关闭） */
	const [expanded, setExpanded] = useState<string | null>(null);

	// 计算变体子菜单的 y 偏移 — 找到 expanded 项在菜单中的位置
	let expandedOffset = 0;
	let expandedItem: MenuItem | null = null;
	if (expanded) {
		let offset = 0;
		for (const g of GROUPS) {
			offset += GROUP_HEADER_H;
			for (const it of g.items) {
				if (it.kind === expanded) {
					expandedOffset = offset;
					expandedItem = it;
				}
				offset += ITEM_H;
			}
		}
	}

	const showVariantPanel = expandedItem && expandedItem.variants && expandedItem.variants.length > 0;

	return (
		<>
			{/* 主菜单 — 248px 宽 */}
			<div
				className="absolute z-30 w-[248px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
				style={{ left: x, top: y }}
			>
				{/* 标题栏 */}
				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
					<Icon name="icon-[lucide--square-plus]" className="size-3.5 shrink-0 text-accent" />
					<span className="text-[11px] font-medium text-surface-foreground">添加节点</span>
					<span className="ml-auto font-mono text-[10px] tabular-nums text-faint">X {Math.round(x)} · Y {Math.round(y)}</span>
				</div>

				{/* 菜单主体 */}
				<div className="max-h-[320px] overflow-y-auto py-1">
					{GROUPS.map((g) => (
						<div key={g.label} className="px-1 py-0.5">
							<div className="px-2 py-1 text-[10px] text-faint">{g.label}</div>
							{g.items.map((it) => {
								const isActive = expanded === it.kind;
								const hasVariants = !!it.variants?.length;
								return (
									<button
										key={it.label}
										type="button"
										onMouseEnter={() => {
											if (hasVariants) {
												setExpanded(it.kind);
											} else {
												setExpanded(null);
											}
										}}
										onClick={() => {
											if (hasVariants) {
												setExpanded(isActive ? null : it.kind);
											} else {
												onPick(it.kind);
												onClose();
											}
										}}
										className={`flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-[11px] ${
											isActive ? "bg-accent-soft text-accent" : "text-surface-foreground hover:bg-accent-soft hover:text-accent"
										}`}
									>
										<Icon name={it.icon} className="size-3.5 shrink-0" />
										<span className="min-w-0 flex-1 truncate">{it.label}</span>
										{it.hint ? <span className="shrink-0 font-mono text-[9px] text-faint">{it.hint}</span> : null}
										{hasVariants ? (
											<Icon name="icon-[lucide--chevron-right]" className="size-3 shrink-0 text-faint" />
										) : null}
									</button>
								);
							})}
						</div>
					))}
				</div>

				{/* 底部提示 */}
				<div className="flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-background px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--mouse-pointer-click]" className="size-3 shrink-0" />
					<span>画布空白处双击 = 直接插入上一次的类型</span>
				</div>
			</div>

			{/* 变体子菜单 — 主菜单右侧展开，176px 宽 */}
			{showVariantPanel && expandedItem && (
				<div
					className="absolute z-30 overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
					style={{ left: x + MENU_W + 8, top: y + MENU_HEADER_H + expandedOffset - 4, width: VARIANT_W }}
				>
					<div className="flex h-8 items-center gap-2 border-b border-border bg-background px-2.5">
						<Icon name={expandedItem.icon} className="size-3.5 shrink-0 text-accent" />
						<span className="text-[11px] font-medium text-surface-foreground">{expandedItem.label}</span>
					</div>
					<div className="py-1">
						{expandedItem.variants!.map((v) => (
							<button
								key={v.label}
								type="button"
								onClick={() => {
									onPick(v.kind, v.values);
									onClose();
								}}
								className="flex h-6 w-full items-center px-2.5 text-[11px] text-muted hover:bg-accent-soft hover:text-accent"
							>
								{v.label}
							</button>
						))}
					</div>
					<div className="flex h-7 items-center border-t border-border bg-background px-2.5 text-[10px] text-faint">
						插入后可用 AI 改参数
					</div>
				</div>
			)}
		</>
	);
}
