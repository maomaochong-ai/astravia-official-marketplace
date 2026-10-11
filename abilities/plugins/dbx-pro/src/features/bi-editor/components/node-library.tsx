/**
 * node-library.tsx — 左栏节点库（按设计稿 NodeLibrary 简化）。
 *
 * 分组：数据源 / 图表 / 控件 / 输出。
 * 纯展示——Phase C2 接入拖曳。
 */

import { type JSX, type DragEvent } from "react";

type Group = { label: string; items: { key: string; icon: string; label: string }[] };

const GROUPS: Group[] = [
	{
		label: "数据源",
		items: [
			{ key: "source-sql", icon: "▣", label: "SQL 查询" },
			{ key: "source-table", icon: "☰", label: "表数据" },
			{ key: "source-api", icon: "⬡", label: "API" },
		],
	},
	{
		label: "图表",
		items: [
			{ key: "chart-bar", icon: "▤", label: "柱状图" },
			{ key: "chart-line", icon: "〰", label: "折线图" },
			{ key: "chart-pie", icon: "◔", label: "饼图" },
			{ key: "chart-scatter", icon: "✦", label: "散点图" },
			{ key: "chart-map", icon: "🗺", label: "地图" },
			{ key: "chart-radar", icon: "✺", label: "雷达图" },
		],
	},
	{
		label: "指标",
		items: [
			{ key: "metric-big", icon: "1", label: "大数字" },
			{ key: "metric-trend", icon: "↗", label: "趋势卡" },
			{ key: "metric-gauge", icon: "◉", label: "仪表盘" },
		],
	},
	{
		label: "控件",
		items: [
			{ key: "filter-select", icon: "▾", label: "下拉筛选" },
			{ key: "filter-date", icon: "📅", label: "日期范围" },
			{ key: "filter-input", icon: "⌨", label: "输入框" },
		],
	},
	{
		label: "输出",
		items: [
			{ key: "output-table", icon: "⊞", label: "数据表" },
			{ key: "output-text", icon: "T", label: "文本块" },
			{ key: "output-image", icon: "🖼", label: "图片" },
		],
	},
];

export function NodeLibrary(): JSX.Element {
	return (
		<div className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-[12px] font-medium text-muted">
				节点库
			</div>
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-2">
				{GROUPS.map((g) => (
					<div key={g.label} className="mb-3 last:mb-0">
						<div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
							{g.label}
						</div>
						<div className="grid grid-cols-2 gap-1">
							{g.items.map((it) => (
								<button
									key={it.key}
									type="button"
									draggable
									onDragStart={(e: DragEvent<HTMLButtonElement>) => {
										e.dataTransfer.effectAllowed = "copy";
										e.dataTransfer.setData("application/json", JSON.stringify({
											nodeType: it.key, label: it.label, icon: it.icon,
										}));
									}}
									className="group flex h-10 cursor-grab flex-col items-center justify-center gap-0.5 rounded-control border border-transparent bg-surface px-1 text-center transition hover:border-border-strong hover:text-surface-foreground active:cursor-grabbing"
									title={it.label}
								>
									<span className="text-[16px] text-muted group-hover:text-accent">{it.icon}</span>
									<span className="truncate text-[10px] text-muted group-hover:text-surface-foreground">{it.label}</span>
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
