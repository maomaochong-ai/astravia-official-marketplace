/**
 * ExportProgressDialog — 导出表数据进度弹窗（后台任务 store 中单个任务的模态视图）。
 *
 * 对标 dbx 桌面壳：
 * 文件名 + 进度条（已知总数走百分比，未知走滑动动画）+
 * 状态图标与文案（导出中 / 写入中 / 取消中 / 完成 / 失败 / 已取消）+
 * 已导出行数与耗时。
 *
 * 活动态：左「最小化」（任务转顶栏后台任务继续跑），右「取消导出」；
 * 完成态：「打开所在文件夹」（host-node reveal 真实入口，无落盘路径时不渲染，
 * 不展示任何假按钮）+「关闭」。
 */

import { useEffect, useState, type JSX } from "react";
import type { ExportTask } from "../state/export-tasks-store";

/** 107000ms → "1分47秒"；47000ms → "47秒"。 */
export function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	if (mins <= 0) return `${secs}秒`;
	return `${mins}分${secs}秒`;
}

interface Props {
	task: ExportTask;
	/** 活动态最小化（关闭模态，任务在顶栏后台任务中继续）。 */
	onMinimize: () => void;
	/** 终态关闭。 */
	onClose: () => void;
	/** 请求取消任务（块间生效）。 */
	onCancel: () => void;
	/** 在系统文件管理器中定位文件。 */
	onReveal: (filePath: string) => void;
}

export function ExportProgressDialog({ task, onMinimize, onClose, onCancel, onReveal }: Props): JSX.Element {
	const active = task.status === "running" || task.status === "writing" || task.status === "cancelling";
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!active) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [active]);

	// 导出中禁止 Esc 关闭弹窗（最小化有专门按钮）。
	useEffect(() => {
		if (!active) return;
		function block(e: KeyboardEvent): void {
			if (e.key === "Escape") e.stopPropagation();
		}
		document.addEventListener("keydown", block, true);
		return () => document.removeEventListener("keydown", block, true);
	}, [active]);

	const hasKnownTotal = task.totalRows !== null && task.totalRows > 0;
	const percent = hasKnownTotal
		? Math.min(100, Math.round((task.rowsExported / (task.totalRows as number) * 100)))
		: 0;
	const elapsedMs = (task.finishedAt ?? now) - task.startedAt;
	const rowsText = hasKnownTotal
		? `已导出 ${task.rowsExported.toLocaleString()} / ${(task.totalRows as number).toLocaleString()} 行`
		: `已导出 ${task.rowsExported.toLocaleString()} 行`;

	return (
		<div
			className="dbx-modal-backdrop"
			onClick={active ? undefined : onClose}
			role="presentation"
		>
			<div
				className="flex w-[440px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/50"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="导出表数据"
			>
				{/* 头部 */}
				<div className="flex shrink-0 items-center px-5 pt-4">
					<h3 className="flex-1 text-[15px] font-semibold text-foreground">导出表数据</h3>
					<button
						type="button"
						onClick={active ? onMinimize : onClose}
						title={active ? "最小化到后台任务" : "关闭"}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
					>
						<span className="icon-[lucide--x] h-4 w-4" />
					</button>
				</div>

				{/* 主体 */}
				<div className="space-y-4 px-5 py-4">
					<div className="truncate text-[12.5px] text-muted-foreground" title={task.fileName}>
						{task.fileName}
					</div>

					{/* 进度条 */}
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						{task.status === "done" ? (
							<div className="h-full w-full rounded-full bg-green-500" />
						) : active ? (
							hasKnownTotal ? (
								<div
									className="h-full rounded-full bg-green-500 transition-[width] duration-300"
									style={{ width: `${percent}%` }}
								/>
							) : (
								<div className="h-full w-full overflow-hidden rounded-full">
									<div className="dbx-export-indeterminate h-full rounded-full bg-green-500" />
								</div>
							)
						) : hasKnownTotal ? (
							<div className="h-full rounded-full bg-green-500/50" style={{ width: `${percent}%` }} />
						) : null}
					</div>

					{/* 状态行 */}
					<div className="flex items-center gap-2 text-[13px]">
						{task.status === "running" && (
							<>
								<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin text-green-500" />
								<span className="text-foreground">正在导出数据…</span>
							</>
						)}
						{task.status === "writing" && (
							<>
								<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin text-green-500" />
								<span className="text-foreground">正在写入文件…</span>
							</>
						)}
						{task.status === "cancelling" && (
							<>
								<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin text-yellow-500" />
								<span className="text-yellow-600 dark:text-yellow-400">正在取消…</span>
							</>
						)}
						{task.status === "done" && (
							<>
								<span className="icon-[lucide--circle-check] h-4 w-4 text-green-500" />
								<span className="font-medium text-green-600 dark:text-green-400">导出完成</span>
							</>
						)}
						{task.status === "error" && (
							<>
								<span className="icon-[lucide--circle-x] h-4 w-4 text-destructive" />
								<span className="min-w-0 truncate text-destructive" title={task.errorMessage ?? undefined}>
									{task.errorMessage || "导出失败"}
								</span>
							</>
						)}
						{task.status === "cancelled" && (
							<>
								<span className="icon-[lucide--circle-alert] h-4 w-4 text-yellow-500" />
								<span className="text-yellow-600 dark:text-yellow-400">已取消导出</span>
							</>
						)}
					</div>

					{/* 行数 / 耗时 / 落盘位置 */}
					<div className="text-[12px] tabular-nums text-muted-foreground">
						{rowsText}
						{elapsedMs >= 0 && <span className="ml-3">耗时：{formatElapsed(elapsedMs)}</span>}
					</div>
					{task.status === "done" && task.filePath && (
						<div className="truncate text-[11px] text-muted-foreground/70" title={task.filePath}>
							已保存到 {task.filePath}
						</div>
					)}
					{task.note && (
						<div className="flex items-start gap-1.5 rounded-md bg-yellow-500/10 px-2.5 py-1.5 text-[11.5px] text-yellow-700 dark:text-yellow-400">
							<span className="icon-[lucide--triangle-alert] mt-px h-3.5 w-3.5 shrink-0" />
							<span>{task.note}</span>
						</div>
					)}
				</div>

				{/* 底部操作 */}
				<div className="flex shrink-0 justify-end gap-2.5 border-t border-border px-5 py-3.5">
					{active ? (
						<>
							<button
								type="button"
								onClick={onMinimize}
								className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
							>
								<span className="icon-[lucide--minus] h-3.5 w-3.5" />
								最小化
							</button>
							<button
								type="button"
								onClick={onCancel}
								disabled={task.status === "cancelling"}
								className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] text-foreground hover:bg-[var(--dbx-hover)] disabled:opacity-50"
							>
								{task.status === "cancelling" ? (
									<span className="icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin" />
								) : (
									<span className="icon-[lucide--x] h-3.5 w-3.5" />
								)}
								取消导出
							</button>
						</>
					) : (
						<>
							{task.status === "done" && task.filePath && (
								<button
									type="button"
									onClick={() => onReveal(task.filePath as string)}
									className="inline-flex h-8 items-center gap-1.5 rounded-md bg-muted px-3.5 text-[12px] font-medium text-foreground hover:opacity-90"
								>
									<span className="icon-[lucide--folder-open] h-3.5 w-3.5" />
									打开所在文件夹
								</button>
							)}
							<button
								type="button"
								onClick={onClose}
								className="inline-flex h-8 items-center rounded-md border border-border px-4 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
							>
								关闭
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
