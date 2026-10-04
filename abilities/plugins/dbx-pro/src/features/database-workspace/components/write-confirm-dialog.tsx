/**
 * 危险写操作确认弹窗 — dbx-mcp 只读、写/DDL 需自研驱动执行。
 *
 * 展示将执行的完整 SQL，用户明确确认后才执行；Esc / 取消 / 遮罩关闭。
 * 只读连接在上游（弹窗前）即被拦截，不会走到这里。
 * 生产连接会额外显示红色强提示条。
 */

import { useEffect } from "react";

export interface PendingWrite {
	sql: string;
	connectionName: string;
}

export function WriteConfirmDialog({
	pending,
	isProduction = false,
	onConfirm,
	onCancel,
}: {
	pending: PendingWrite;
	isProduction?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onCancel]);

	return (
		<div className="dbx-modal-backdrop" onClick={onCancel}>
			<div
				className="flex w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-red-500/40 bg-popover shadow-2xl shadow-black/50"
				onClick={(e) => e.stopPropagation()}
				role="alertdialog"
				aria-modal="true"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
					<span className="icon-[lucide--shield-alert] h-4 w-4 text-amber-400" />
					<h3 className="flex-1 text-[12.5px] font-semibold text-foreground">
						确认执行写操作
					</h3>
					<span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-300">
						{pending.connectionName}
					</span>
				</div>

				{isProduction && (
					<div className="border-b border-red-500/40 bg-red-500/15 px-3 py-2">
						<p className="flex items-center gap-1.5 text-[11px] font-semibold leading-relaxed text-red-300">
							<span className="icon-[lucide--alert-octagon] h-3.5 w-3.5" />
							生产环境：该写操作会直接修改生产数据库，请格外谨慎。
						</p>
					</div>
				)}

				<div className="border-b border-border bg-red-500/10 px-3 py-2">
					<p className="text-[11px] leading-relaxed text-red-300/90">
						该语句将修改数据库（DDL/DML），请确认 SQL 无误。此操作会直接作用于目标库，执行后不可由本工具撤销。
					</p>
				</div>

				<div className="max-h-[240px] overflow-auto bg-[#0b0d13] p-3">
					<pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-foreground/80">
						{pending.sql}
					</pre>
				</div>

				<div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2.5">
					<button
						type="button"
						onClick={onCancel}
						className="flex h-7 items-center rounded-md border border-border px-3 text-[11.5px] text-foreground/80 transition-colors hover:bg-accent"
					>
						取消
					</button>
					<button
						type="button"
						onClick={onConfirm}
						autoFocus
						className="flex h-7 items-center gap-1.5 rounded-md bg-red-600 px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-red-500"
					>
						<span className="icon-[lucide--play] h-3 w-3" />
						执行
					</button>
				</div>
			</div>
		</div>
	);
}
