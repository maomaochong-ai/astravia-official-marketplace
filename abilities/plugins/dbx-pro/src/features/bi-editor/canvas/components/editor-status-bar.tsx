/**
 * editor-status-bar.tsx — BI 编辑器底栏状态栏。
 *
 * 保存状态 + 运行状态 + 画布计数 + 版本。
 * `stale` 由编辑器对比「本次运行时的画布指纹」与当前指纹得出，
 * 只表示“运行结果可能过期”，不臆造未运行节点的具体数量。
 */

import { PLUGIN_VERSION } from "../../../../domain/plugin-version";
import { Icon } from "../../shared/components/ui/icon";

export interface RunSummary {
	/** 本地时间，形如 10:24 */
	at: string;
	durationMs: number;
	/** 本次实际执行的节点数 */
	nodeCount: number;
}

interface Props {
	dirty?: boolean;
	nodeCount?: number;
	linkCount?: number;
	run?: RunSummary | null;
	running?: boolean;
	/** 运行之后画布又被改动过 —— 结果可能已过期。 */
	stale?: boolean;
}

function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function EditorStatusBar({
	dirty = false,
	nodeCount = 0,
	linkCount = 0,
	run = null,
	running = false,
	stale = false,
}: Props) {
	return (
		<div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3 text-[11px] text-muted">
			<span className={`grid size-2 place-items-center rounded-full ${dirty ? "bg-warning" : "bg-success"}`}>
				<span className="size-1 rounded-full bg-surface-raised" />
			</span>
			<span>{dirty ? "未保存" : "已同步"}</span>

			<span>·</span>

			{running ? (
				<span className="inline-flex items-center gap-1 text-accent">
					<Icon name="icon-[lucide--loader]" className="size-3 animate-spin" />
					运行中
				</span>
			) : stale ? (
				<span
					className="inline-flex h-[18px] items-center gap-1 rounded-chip bg-warning-soft px-1.5 text-warning"
					title="画布在最近一次运行之后被修改过"
				>
					<Icon name="icon-[lucide--circle-slash]" className="size-2.5" />
					画布已改动 · 未重新运行
				</span>
			) : run ? (
				<span
					className="inline-flex h-[18px] items-center gap-1 rounded-chip bg-success-soft px-1.5 text-success"
					title={`运行了 ${run.nodeCount} 个节点`}
				>
					<Icon name="icon-[lucide--circle-play]" className="size-2.5" />
					已运行 · <span className="font-mono tabular-nums">{run.at}</span> ·{" "}
					<span className="font-mono tabular-nums">{formatDuration(run.durationMs)}</span>
				</span>
			) : (
				<span className="text-faint">未运行</span>
			)}

			<span>·</span>
			<span>节点 <span className="font-mono tabular-nums text-surface-foreground">{nodeCount}</span></span>
			<span>·</span>
			<span>连线 <span className="font-mono tabular-nums text-surface-foreground">{linkCount}</span></span>

			<span className="ml-auto flex items-center gap-3">
				<span className="text-faint">dbx BI · v{PLUGIN_VERSION}</span>
			</span>
		</div>
	);
}
