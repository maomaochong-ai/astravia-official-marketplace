/**
 * node-library.tsx — 左栏节点库 + 模板库。
 *
 * 分组：数据源 / 图表 / 指标 / 控件 / 输出 / 我的模板
 * 模板库从 bigscreen-editor 传入（后端 /drag/template/list）。
 */

import { type JSX, type DragEvent } from "react";
import { Icon } from "./ui/icon";

type Group = { label: string; items: { key: string; icon: string; label: string }[] };

interface TemplateItem { id: string; name: string; template: string; createTime: string; }

const GROUPS: Group[] = [
	{ label: "数据源", items: [
		{ key: "source-sql", icon: "▣", label: "SQL 查询" },
		{ key: "source-table", icon: "☰", label: "表数据" },
		{ key: "source-api", icon: "⬡", label: "API" },
	]},
	{ label: "图表", items: [
		{ key: "chart-bar", icon: "▤", label: "柱状图" },
		{ key: "chart-line", icon: "〰", label: "折线图" },
		{ key: "chart-pie", icon: "◔", label: "饼图" },
		{ key: "chart-scatter", icon: "✦", label: "散点图" },
		{ key: "chart-map", icon: "🗺", label: "地图" },
		{ key: "chart-radar", icon: "✺", label: "雷达图" },
	]},
	{ label: "指标", items: [
		{ key: "metric-big", icon: "1", label: "大数字" },
		{ key: "metric-trend", icon: "↗", label: "趋势卡" },
		{ key: "metric-gauge", icon: "◉", label: "仪表盘" },
	]},
	{ label: "控件", items: [
		{ key: "filter-select", icon: "▾", label: "下拉筛选" },
		{ key: "filter-date", icon: "📅", label: "日期范围" },
		{ key: "filter-input", icon: "⌨", label: "输入框" },
	]},
	{ label: "输出", items: [
		{ key: "output-table", icon: "⊞", label: "数据表" },
		{ key: "output-text", icon: "T", label: "文本块" },
		{ key: "output-image", icon: "🖼", label: "图片" },
	]},
];

export function NodeLibrary({
	templates = [],
	onDeleteTemplate,
}: {
	templates?: TemplateItem[];
	onDeleteTemplate?: (id: string) => void;
}): JSX.Element {
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
											kind: "node", nodeType: it.key, label: it.label, icon: it.icon,
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

				{/* 我的模板 */}
				<div className="mt-4 border-t border-border pt-3">
					<div className="mb-1 flex items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
						<Icon name="icon-[lucide--layout-template]" className="size-3" />
						<span>我的模板</span>
					</div>
					{templates.length === 0 ? (
						<div className="px-1 text-center text-[10px] text-faint">（空）</div>
					) : (
						<div className="flex flex-col gap-1">
							{templates.map((t) => (
								<button
									key={t.id}
									type="button"
									draggable
									onDragStart={(e: DragEvent<HTMLButtonElement>) => {
										e.dataTransfer.effectAllowed = "copy";
										e.dataTransfer.setData("application/json", JSON.stringify({
											kind: "template", templateId: t.id,
										}));
									}}
									className="group flex h-8 cursor-grab items-center gap-2 rounded-control border border-transparent bg-surface px-2 text-left transition hover:border-border-strong active:cursor-grabbing"
									title={`${t.name}（拖到画布加载为整个模板）`}
								>
									<Icon name="icon-[lucide--layout-template]" className="size-3.5 shrink-0 text-accent" />
									<span className="min-w-0 flex-1 truncate text-[11px] text-surface-foreground">{t.name}</span>
									{onDeleteTemplate ? (
										<span
											role="button"
											onClick={(ev) => { ev.stopPropagation(); onDeleteTemplate(t.id); }}
											className="grid size-4 shrink-0 place-items-center rounded-[2px] text-faint hover:bg-danger/10 hover:text-danger"
											title="删除模板"
										>×</span>
									) : null}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
