/**
 * run-overlay.tsx — 运行时浮层（设计稿 RunOverlay.tsx 对齐）。
 *
 * 两个独立组件：
 * - RunPanel：全部节点运行瀑布图（296px 宽，右下角展开）
 * - NodePreviewCard：单节点运行预览（272px 宽，节点位置弹出）
 * 运行期间画布不调暗，因为用户还要继续改。
 */

import { type JSX } from "react";
import { Icon } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/ui/icon";
import { Chip } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/ui/chip";
import { AreaChart } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/charts";

export interface RunNode {
	id: string; label: string; icon?: string;
	status: "wait" | "running" | "done" | "error";
	duration?: number; note?: string;
}

/** 全部运行面板 — 设计稿 RunPanel 对齐 */
export function RunPanel({ nodes = [], running = true, x, y, onRunAll, onRunSelected }: {
	nodes?: RunNode[]; running?: boolean;
	x: number; y: number;
	onRunAll?: () => void; onRunSelected?: () => void;
}): JSX.Element {
	const doneCount = nodes.filter(n => n.status === "done").length;
	const waitCount = nodes.filter(n => n.status === "wait").length;
	const totalMs = nodes.reduce((sum, n) => sum + (n.duration ?? 0), 0);

	const stateCls = (s: RunNode["status"]) =>
		s === "done" ? "text-success icon-[lucide--circle-check]" :
		s === "running" ? "text-accent icon-[lucide--loader] animate-spin" :
		s === "error" ? "text-danger icon-[lucide--circle-x]" :
		"text-faint icon-[lucide--clock]";

	return (
		<div className="absolute z-30 w-[296px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			{/* header */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
				<Icon name="icon-[lucide--play]" className="size-3.5 shrink-0 text-accent" />
				<span className="text-[11px] font-medium text-surface-foreground">
					{running ? "本次运行" : "运行完成"}
				</span>
				<span className="ml-auto font-mono text-[10px] tabular-nums text-muted">
					{doneCount} / {nodes.length} · {totalMs ? `${(totalMs / 1000).toFixed(1)}s` : "—"}
				</span>
			</div>

			{/* body — 节点列表 */}
			<div className="max-h-[280px] overflow-y-auto px-2 py-1.5">
				{nodes.length === 0 ? (
					<div className="py-6 text-center text-[11px] text-faint">
						{running ? "正在初始化节点…" : "无运行记录"}
					</div>
				) : nodes.map((n) => (
					<div key={n.id} className="flex h-7 items-center gap-2 rounded-[4px] px-1.5 text-[11px]">
						<Icon name={n.icon ?? "icon-[lucide--circle]"} className="size-3.5 shrink-0 text-muted" />
						<span className="min-w-0 flex-1 truncate text-surface-foreground">{n.label}</span>
						<span className="shrink-0 text-[10px] text-faint">{n.note ?? ""}</span>
						<span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">
							{n.duration != null ? `${(n.duration / 1000).toFixed(1)}s` : "—"}
						</span>
						<Icon name={stateCls(n.status)} className="size-3.5 shrink-0" />
					</div>
				))}
			</div>

			{/* footer — 设计稿的「仅运行选中 / ⌘R 全部 / 运行全部」*/}
			<footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<button type="button" onClick={onRunSelected}
					className="flex h-6 items-center gap-1 rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
					仅运行选中
				</button>
				<span className="ml-auto font-mono text-[10px] text-faint">⌘R 全部</span>
				<button type="button" onClick={onRunAll}
					className="flex h-6 items-center gap-1 rounded-control bg-accent px-2 text-[10px] font-medium text-accent-foreground hover:opacity-90">
					<Icon name="icon-[lucide--play]" className="size-2.5" />运行全部
				</button>
			</footer>
		</div>
	);
}

/** 单节点运行预览卡片 — 设计稿 NodePreviewCard 对齐 */
export function NodePreviewCard({ nodeLabel, values, x, y, onCopy, onLocate }: {
	nodeLabel: string; values?: number[];
	x: number; y: number;
	onCopy?: () => void; onLocate?: () => void;
}): JSX.Element {
	const v = values ?? [];
	return (
		<div className="absolute z-30 w-[272px] overflow-hidden rounded-card border border-accent bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]"
			style={{ left: x, top: y }}
		>
			{/* header */}
			<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5">
				<Icon name="icon-[lucide--chart-line]" className="size-3.5 shrink-0 text-accent" />
				<span className="text-[11px] font-medium text-surface-foreground">预览 · {nodeLabel}</span>
				<span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
					{v.length ? `${(Math.max(...v) / 100).toFixed(1)}s` : "—"}
				</span>
			</div>

			{/* body — AreaChart 预览 */}
			<div className="px-2.5 py-2">
				{v.length > 0 ? (
					<AreaChart values={v} className="h-[92px] w-full" stroke="currentColor" />
				) : (
					<div className="flex h-[92px] items-center justify-center text-[10px] text-faint">
						无数据
					</div>
				)}
				<div className="mt-1.5 flex items-center gap-1.5">
					<Chip tone="accent">{v.length} 个点</Chip>
					<Chip>{new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Chip>
					<span className="ml-auto text-[10px] text-faint">不回写数据库</span>
				</div>
			</div>

			{/* footer */}
			<footer className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5">
				<button type="button" onClick={onCopy}
					className="flex h-6 items-center gap-1 rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
					<Icon name="icon-[lucide--copy]" className="size-2.5" />复制为图片
				</button>
				<button type="button" onClick={onLocate}
					className="ml-auto flex h-6 items-center rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
					在产物里定位
				</button>
			</footer>
		</div>
	);
}
