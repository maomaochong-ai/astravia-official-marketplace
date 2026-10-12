/**
 * editor-status-bar.tsx — BI 编辑器底栏状态栏。
 *
 * 运行状态 + 节点计数 + 缩放 + 未保存标记。
 */

interface Props {
	dirty?: boolean;
	nodeCount?: number;
	linkCount?: number;
	lastRun?: string | null;
}

export function EditorStatusBar({ dirty = false, nodeCount = 0, linkCount = 0, lastRun }: Props) {
	return (
		<div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3 text-[11px] text-muted">
			<span className={`grid size-2 place-items-center rounded-full ${dirty ? "bg-warning" : "bg-success"}`}>
				<span className="size-1 rounded-full bg-surface-raised" />
			</span>
			<span>{dirty ? "未保存" : "已同步"}</span>
			<span>·</span>
			<span>节点 <span className="font-mono tabular-nums text-surface-foreground">{nodeCount}</span></span>
			<span>·</span>
			<span>连线 <span className="font-mono tabular-nums text-surface-foreground">{linkCount}</span></span>

			<span className="ml-auto flex items-center gap-3">
				{lastRun && (
					<>
						<span className="icon-[lucide--clock] size-3" />
						<span className="font-mono tabular-nums text-faint">{lastRun}</span>
					</>
				)}
				<span className="text-faint">dbx-pro BI · v0.4.26</span>
			</span>
		</div>
	);
}
