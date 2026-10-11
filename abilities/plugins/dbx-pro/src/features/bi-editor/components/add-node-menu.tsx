/**
 * add-node-menu.tsx — 画布空白处右键弹出的节点选择菜单（设计稿 menu.tsx 对齐）。
 *
 * 分类：数据源 / 图表 / 指标 / 筛选 / 输出 / AI。
 * 选完后回调 onPick(kind)。
 */

import { type JSX } from "react";
import { Icon } from "./ui/icon";
import { NODE_SCHEMA } from "./node-schema";

interface Props {
	x: number; y: number;
	onPick: (kind: string) => void;
	onClose: () => void;
}

const ICON_MAP: Record<string, string> = {
	"source-sql": "icon-[lucide--scroll-text]",
	"source-table": "icon-[lucide--table-2]",
	"source-api": "icon-[lucide--cloud]",
	"chart-bar": "icon-[lucide--bar-chart-3]",
	"chart-line": "icon-[lucide--line-chart]",
	"chart-pie": "icon-[lucide--pie-chart]",
	"chart-scatter": "icon-[lucide--activity]",
	"chart-map": "icon-[lucide--map]",
	"chart-radar": "icon-[lucide--radar]",
	"metric-big": "icon-[lucide--tachometer]",
	"metric-trend": "icon-[lucide--trending-up]",
	"metric-gauge": "icon-[lucide--gauge]",
	"filter-select": "icon-[lucide--filter]",
	"filter-date": "icon-[lucide--calendar]",
	"filter-input": "icon-[lucide--type]",
	"output-table": "icon-[lucide--table]",
	"output-text": "icon-[lucide--file-text]",
	"output-image": "icon-[lucide--image]",
	"ai-nl2sql": "icon-[lucide--sparkles]",
	"ai-chart-suggest": "icon-[lucide--wand-sparkles]",
};

const CATEGORIES: { label: string; kinds: string[] }[] = [
	{ label: "数据源", kinds: ["source-sql", "source-table", "source-api"] },
	{ label: "图表", kinds: ["chart-bar", "chart-line", "chart-pie", "chart-scatter", "chart-map", "chart-radar"] },
	{ label: "指标", kinds: ["metric-big", "metric-trend", "metric-gauge"] },
	{ label: "筛选", kinds: ["filter-select", "filter-date", "filter-input"] },
	{ label: "输出", kinds: ["output-table", "output-text", "output-image"] },
	{ label: "AI", kinds: ["ai-nl2sql", "ai-chart-suggest"] },
];

export function AddNodeMenu({ x, y, onPick, onClose }: Props): JSX.Element {
	return (
		<>
			<div className="fixed inset-0 z-40" onClick={onClose} />
			<div
				className="absolute z-50 w-[220px] overflow-hidden rounded-card border border-border-strong bg-surface-raised shadow-xl"
				style={{ left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 360) }}
			>
				<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
					<Icon name="icon-[lucide--plus-circle]" className="size-3.5 shrink-0 text-muted" />
					<span className="text-[12px] font-medium text-surface-foreground">添加节点</span>
					<span className="ml-auto text-[10px] text-faint">拖入节点库更快</span>
				</div>
				<div className="max-h-[320px] overflow-y-auto py-1">
					{CATEGORIES.map((cat) => (
						<div key={cat.label} className="flex flex-col">
							<span className="flex h-6 items-center px-3 text-[10px] font-medium uppercase tracking-wider text-faint">
								{cat.label}
							</span>
							{cat.kinds.map((kind) => {
								const label = NODE_SCHEMA[kind]?.label ?? kind;
								const icon = ICON_MAP[kind] ?? "icon-[lucide--square]";
								return (
									<button key={kind} type="button"
										onClick={() => { onPick(kind); onClose(); }}
										className="flex h-7 w-full items-center gap-2 px-3 text-left hover:bg-accent-soft"
									>
										<Icon name={icon} className="size-3.5 shrink-0 text-muted" />
										<span className="text-[11px] text-surface-foreground">{label}</span>
									</button>
								);
							})}
						</div>
					))}
				</div>
			</div>
		</>
	);
}
