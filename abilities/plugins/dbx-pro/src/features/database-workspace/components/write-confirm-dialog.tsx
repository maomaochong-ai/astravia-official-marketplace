/**
 * 危险写操作确认弹窗 — 引擎只读、写/DDL 需自研驱动执行。
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
				className="dbx-dialog border-danger/40"
				onClick={(e) => e.stopPropagation()}
				role="alertdialog"
				aria-modal="true"
			>
				<div className="dbx-dialog__head">
					<span className="icon-[lucide--shield-alert] h-4 w-4 text-warning" />
					<h3 className="dbx-dialog__title text-[12px]">确认执行写操作</h3>
					<span className="shrink-0 rounded bg-warning-soft px-1.5 py-0.5 text-[9.5px] font-medium text-warning">
						{pending.connectionName}
					</span>
				</div>

				{isProduction && (
					<div className="border-b border-danger/40 bg-danger-soft px-3 py-2">
						<p className="flex items-center gap-1.5 text-[11px] font-semibold leading-relaxed text-danger">
							<span className="icon-[lucide--alert-octagon] h-3.5 w-3.5" />
							生产环境：该写操作会直接修改生产数据库，请格外谨慎。
						</p>
					</div>
				)}

				<div className="border-b border-border bg-danger-soft px-3 py-2">
					<p className="text-[11px] leading-relaxed text-danger">
						该语句将修改数据库（DDL/DML），请确认 SQL 无误。此操作会直接作用于目标库，执行后不可由本工具撤销。
					</p>
				</div>

				<div className="dbx-dialog__body dbx-dialog__body--flush bg-surface-sunken" style={{ maxHeight: 240 }}>
					<pre className="whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
						{pending.sql}
					</pre>
				</div>

				<div className="dbx-dialog__foot justify-end">
					<button
						type="button"
						onClick={onCancel}
						className="dbx-btn ghost"
					>
						取消
					</button>
					<button
						type="button"
						onClick={onConfirm}
						autoFocus
						className="flex h-8 items-center gap-1.5 rounded-control bg-danger px-3 text-[12px] font-medium text-primary-fg transition-colors hover:bg-danger/90"
					>
						<span className="icon-[lucide--play] h-3 w-3" />
						执行
					</button>
				</div>
			</div>
		</div>
	);
}
