/**
 * node-library.tsx — 左栏节点库 + 模板库。
 *
 * 分组：数据源 / 图表 / 指标 / 控件 / 输出 / 我的模板
 * 模板库从 bigscreen-editor 传入（后端 /drag/template/list）。
 */

import { type JSX, type DragEvent, useState } from "react";
import { Icon } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/ui/icon";

type Group = { label: string; items: { key: string; icon: string; label: string }[] };

interface TemplateItem { id: string; name: string; template: string; createTime: string; }

const GROUPS: Group[] = [
	{ label: "数据源", items: [
		{ key: "source-sql", icon: "icon-[lucide--database]", label: "SQL 查询" },
		{ key: "source-table", icon: "icon-[lucide--table-2]", label: "表数据" },
		{ key: "source-api", icon: "icon-[lucide--globe]", label: "API" },
	]},
	{ label: "图表", items: [
		{ key: "chart-bar", icon: "icon-[lucide--chart-column]", label: "柱状图" },
		{ key: "chart-line", icon: "icon-[lucide--chart-line]", label: "折线图" },
		{ key: "chart-pie", icon: "icon-[lucide--chart-pie]", label: "饼图" },
		{ key: "chart-scatter", icon: "icon-[lucide--gallery-horizontal]", label: "散点图" },
		{ key: "chart-map", icon: "icon-[lucide--map]", label: "地图" },
		{ key: "chart-radar", icon: "icon-[lucide--radar]", label: "雷达图" },
	]},
	{ label: "指标", items: [
		{ key: "metric-big", icon: "icon-[lucide--calculator]", label: "大数字" },
		{ key: "metric-trend", icon: "icon-[lucide--trending-up]", label: "趋势卡" },
		{ key: "metric-gauge", icon: "icon-[lucide--gauge]", label: "仪表盘" },
	]},
	{ label: "控件", items: [
		{ key: "filter-select", icon: "icon-[lucide--list-filter]", label: "下拉筛选" },
		{ key: "filter-date", icon: "icon-[lucide--calendar]", label: "日期范围" },
		{ key: "filter-input", icon: "icon-[lucide--keyboard]", label: "输入框" },
	]},
	{ label: "输出", items: [
		{ key: "output-table", icon: "icon-[lucide--table-properties]", label: "数据表" },
		{ key: "output-text", icon: "icon-[lucide--type]", label: "文本块" },
		{ key: "output-image", icon: "icon-[lucide--image]", label: "图片" },
	]},
];

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
	/** 当前点击选中的节点库项（用于视觉高亮；不做默认预览面板） */
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	if (collapsed) {
		return (
			<div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-raised py-2">
				{GROUPS.map((g) => g.items.slice(0, 1).map((it) => (
					<button
						key={it.key}
						type="button"
						onClick={onToggleCollapsed}
						className="grid size-7 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent"
						title={`展开节点库（${g.label}）`}
					>
						<Icon name={it.icon} className="size-3.5" />
					</button>
				)))}
				<div className="mt-auto flex flex-col gap-1">
					<button type="button" onClick={onToggleCollapsed}
						className="grid size-7 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent" title="展开节点库">
						<Icon name="icon-[lucide--panel-left-open]" className="size-3.5" />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center border-b border-border px-3">
				<span className="flex-1 text-[12px] font-medium text-muted">节点库</span>
				<button type="button" onClick={onToggleCollapsed}
					className="grid size-6 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent" title="收起节点库">
					<Icon name="icon-[lucide--panel-left-close]" className="size-3.5" />
				</button>
			</div>
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-2">
				{GROUPS.map((g) => (
					<div key={g.label} className="mb-3 last:mb-0">
						<div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
							{g.label}
						</div>
						<div className="grid grid-cols-2 gap-1">
							{g.items.map((it) => {
								const active = selectedKey === it.key;
								return (
									<button
										key={it.key}
										type="button"
										draggable
										onDragStart={(e: DragEvent<HTMLButtonElement>) => {
											e.dataTransfer.effectAllowed = "copy";
											e.dataTransfer.setData("application/json", JSON.stringify({
												kind: "node", nodeType: it.key, label: it.label,
											}));
										}}
										onClick={() => setSelectedKey(active ? null : it.key)}
										className={`group flex h-10 cursor-grab flex-col items-center justify-center gap-0.5 rounded-control border px-1 text-center transition active:cursor-grabbing ${
											active
												? "border-accent bg-accent-soft text-accent"
												: "border-transparent bg-surface hover:border-border-strong"
										}`}
										title={`${it.label}（拖到画布或点击预览）`}
									>
										<Icon name={it.icon} className={`size-4 ${active ? "text-accent" : "text-muted group-hover:text-accent"}`} />
										<span className="truncate text-[10px] text-muted group-hover:text-surface-foreground">{it.label}</span>
									</button>
								);
							})}
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
