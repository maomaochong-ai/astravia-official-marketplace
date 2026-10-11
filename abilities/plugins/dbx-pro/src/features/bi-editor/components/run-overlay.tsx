/**
 * run-overlay.tsx — 运行时进度浮层（设计稿 run.tsx 对齐）。
 *
 * 两种状态：running（进度条 + 取消按钮）/ done（结果汇总 + 耗时）。
 * 运行完成后显示节点级耗时瀑布图（哪个节点慢一目了然）。
 */

import { type JSX } from "react";
import { Icon } from "./ui/icon";
import { Chip } from "./ui/chip";

interface RunNode {
	id: string; label: string; status: "pending" | "running" | "done" | "error"; duration?: number; note?: string;
}

export function RunOverlay({ running, nodes = [], totalMs = 0, onCancel, onClose }: {
	running: boolean; nodes?: RunNode[]; totalMs?: number;
	onCancel?: () => void; onClose?: () => void;
}): JSX.Element {
	return (
		<div className="absolute right-4 top-16 z-40 w-[320px] overflow-hidden rounded-card border border-border-strong bg-surface-raised shadow-2xl">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				{running ? (
					<div className="size-3 animate-spin rounded-full border-2 border-border border-t-accent" />
				) : (
					<Icon name="icon-[lucide--circle-check]" className="size-3 text-success" />
				)}
				<span className="text-[12px] font-medium text-surface-foreground">
					{running ? "运行中…" : "运行完成"}
				</span>
				<Chip tone={running ? "warning" : "primary"}>
					{running ? `${nodes.filter(n => n.status === "done").length}/${nodes.length}` : `${nodes.length} 节点`}
				</Chip>
				{onClose ? (
					<button type="button" onClick={onClose}
						className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-chit text-muted hover:text-surface-foreground">
						<Icon name="icon-[lucide--x]" className="size-3" />
					</button>
				) : null}
			</div>

			<div className="flex max-h-[240px] flex-col overflow-y-auto px-3 py-2">
				{nodes.length === 0 ? (
					<span className="py-6 text-center text-[11px] text-faint">
						{running ? "正在初始化节点…" : "无运行记录"}
					</span>
				) : (
					nodes.map((n) => {
						const color =
							n.status === "error" ? "text-danger" :
							n.status === "running" ? "text-accent" :
							n.status === "done" ? "text-success" : "text-faint";
						return (
							<div key={n.id} className="flex h-7 items-center gap-2 border-b border-border/50 text-[11px] last:border-0">
								<Icon name={
									n.status === "error" ? "icon-[lucide--circle-x]" :
									n.status === "running" ? "icon-[lucide--loader-2]" :
									n.status === "done" ? "icon-[lucide--circle-check]" : "icon-[lucide--circle]"
								} className={`size-3 shrink-0 ${color} ${n.status === "running" ? "animate-spin" : ""}`} />
								<span className="min-w-0 flex-1 truncate text-surface-foreground">{n.label}</span>
								<span className="shrink-0 font-mono tabular-nums text-faint">
									{n.duration != null ? `${n.duration}ms` : "—"}
								</span>
							</div>
						);
					})
				)}
			</div>

			<div className="flex h-10 shrink-0 items-center gap-2 border-t border-border px-3">
				<span className="font-mono text-[10px] tabular-nums text-faint">
					总耗时 {totalMs ? `${totalMs}ms` : "—"}
				</span>
				<span className="ml-auto flex gap-1">
					{running && onCancel ? (
						<button type="button" onClick={onCancel}
							className="flex h-6 items-center gap-1 rounded-control border border-border bg-surface px-2 text-[10px] text-muted hover:text-surface-foreground">
							<Icon name="icon-[lucide--square]" className="size-3" />取消
						</button>
					) : null}
					{!running && onClose ? (
						<button type="button" onClick={onClose}
							className="flex h-6 items-center rounded-control border border-border bg-surface px-2 text-[10px] text-surface-foreground">
							关闭
						</button>
					) : null}
				</span>
			</div>
		</div>
	);
}
