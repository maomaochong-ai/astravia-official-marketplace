/**
 * add-node-menu.tsx — 画布右键添加节点菜单（设计稿 menu.tsx + AddNodeMenu.tsx 对齐）。
 *
 * 分组结构（与设计稿一致）：数据 / 图表 / 大屏 / 控件与产物
 * - 不再自己渲染遮罩，遮罩由父层 NodeGraph 提供（absolute inset-0 bg-background/55）
 * - 菜单位置从光标处长出，变体在选中项右侧展开
 * - 带坐标显示、搜索提示、底部双击快捷键提示
 */

import { type JSX } from "react";
import { Icon } from "./ui/icon";

interface Props {
	x: number;
	y: number;
	onPick: (kind: string) => void;
	onClose: () => void;
}

interface MenuItem {
	icon: string;
	label: string;
	hint?: string;
	kind: string;
	variants?: string[];
}

interface MenuGroup {
	label: string;
	items: MenuItem[];
}

const GROUPS: MenuGroup[] = [
	{
		label: "数据",
		items: [
			{ icon: "icon-[lucide--database]", label: "数据源", hint: "MySQL", kind: "source-sql" },
			{ icon: "icon-[lucide--table-2]", label: "SQL 数据集", hint: "一键套用", kind: "source-table" },
			{ icon: "icon-[lucide--scroll-text]", label: "手写 SQL", kind: "source-sql" },
			{ icon: "icon-[lucide--upload]", label: "本地文件", hint: "CSV", kind: "source-api" },
		],
	},
	{
		label: "图表",
		items: [
			{ icon: "icon-[lucide--chart-line]", label: "折线图", hint: "6 变体", kind: "chart-line", variants: ["基础折线", "面积", "堆叠", "双轴", "平滑", "阶梯"] },
			{ icon: "icon-[lucide--chart-column]", label: "柱状图", hint: "5 变体", kind: "chart-bar" },
			{ icon: "icon-[lucide--chart-pie]", label: "饼图 / 环图", kind: "chart-pie" },
			{ icon: "icon-[lucide--gauge]", label: "指标卡", kind: "metric-big" },
		],
	},
	{
		label: "大屏",
		items: [
			{ icon: "icon-[lucide--monitor]", label: "大屏标题", kind: "metric-trend" },
			{ icon: "icon-[lucide--activity]", label: "大屏指标卡", kind: "metric-gauge" },
			{ icon: "icon-[lucide--list-ordered]", label: "大屏排行榜", kind: "chart-bar" },
		],
	},
	{
		label: "控件与产物",
		items: [
			{ icon: "icon-[lucide--list-filter]", label: "筛选器", kind: "filter-select" },
			{ icon: "icon-[lucide--layout-dashboard]", label: "看板产物页面", kind: "output-table" },
			{ icon: "icon-[lucide--share-2]", label: "发布与分享", kind: "output-text" },
		],
	},
];

export function AddNodeMenu({ x, y, onPick, onClose }: Props): JSX.Element {
	return (
		<>
			{/* 主菜单 */}
			<div
				className="absolute z-30 w-[248px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
				style={{ left: x, top: y }}
			>
				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
					<Icon name="icon-[lucide--square-plus]" className="size-3.5 shrink-0 text-accent" />
					<span className="text-[11px] font-medium text-surface-foreground">添加节点</span>
					<span className="ml-auto font-mono text-[10px] tabular-nums text-faint">X {Math.round(x)} · Y {Math.round(y)}</span>
				</div>

				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5">
					<Icon name="icon-[lucide--search]" className="size-3.5 shrink-0 text-faint" />
					<span className="text-[11px] text-faint">搜索节点类型…</span>
					<span className="ml-auto rounded-[3px] border border-border px-1 font-mono text-[9px] text-faint">/</span>
				</div>

				<div className="max-h-[320px] overflow-y-auto py-1">
					{GROUPS.map((g) => (
						<div key={g.label} className="px-1 py-0.5">
							<div className="px-2 py-1 text-[10px] text-faint">{g.label}</div>
							{g.items.map((it) => (
								<button
									key={it.label}
									type="button"
									onClick={() => { onPick(it.kind); onClose(); }}
									className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-surface-foreground hover:bg-accent-soft hover:text-accent"
								>
									<Icon name={it.icon} className="size-3.5 shrink-0" />
									<span className="min-w-0 flex-1 truncate text-[11px]">{it.label}</span>
									{it.hint ? <span className="shrink-0 font-mono text-[9px] text-faint">{it.hint}</span> : null}
								</button>
							))}
						</div>
					))}
				</div>

				<div className="flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-background px-2.5 text-[10px] text-faint">
					<Icon name="icon-[lucide--mouse-pointer-click]" className="size-3 shrink-0" />
					<span>画布空白处双击 = 直接插入上一次的类型</span>
				</div>
			</div>
		</>
	);
}
