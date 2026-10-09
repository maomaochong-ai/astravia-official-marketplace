/**
 * ExportProgressDialog — 导出表数据进度弹窗（后台任务 store 中单个任务的模态视图）。
 *
 * 对标 dbx 桌面壳：
 * 文件名 + 进度条（已知总数走百分比，未知走滑动动画）+
 * 状态图标与文案（导出中 / 写入中 / 取消中 / 等待选择保存位置 / 未保存 / 完成 / 失败 / 已取消）+
 * 已导出行数与耗时。
 *
 * 活动态：左「最小化」（任务转顶栏后台任务继续跑），右「取消导出」；
 * 等待保存：只剩「最小化」，保存框由系统弹出，这里不提供取消（取消就是保存框的事）；
 * 未保存：内容还在暂存里，「重新保存」重开保存框、「放弃并释放」丢弃内容、再「关闭」；
 * 完成态：「打开所在文件夹」（host-node reveal 真实入口，无落盘路径时不渲染，
 * 不展示任何假按钮）+「关闭」。
 */

import { useEffect, useState, type JSX } from "react";
import { hasExportPayload, isExportTaskActive, type ExportTask } from "../state/export-tasks-store";

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
	onSave: () => void;
	/** 放弃暂存的导出内容并释放内存（unsaved / error 时有意义）。 */
	onDiscard: () => void;
}

export function ExportProgressDialog({
	task,
	onMinimize,
	onClose,
	onCancel,
	onReveal,
	onSave,
	onDiscard,
}: Props): JSX.Element {
	const active = isExportTaskActive(task);
	/** 等待保存也算「还没结束」：不能关窗、耗时继续走，退出只能靠最小化。 */
	const inFlight = active || task.status === "awaiting-save";
	/** 暂存内容还在：可以不开重跑查询就重开保存框。 */
	const canRetrySave = hasExportPayload(task.id);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!inFlight) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [inFlight]);

	// 任务未结束时禁止 Esc 关闭弹窗（最小化有专门按钮）。
	useEffect(() => {
		if (!inFlight) return;
		function block(e: KeyboardEvent): void {
			if (e.key === "Escape") e.stopPropagation();
		}
		document.addEventListener("keydown", block, true);
		return () => document.removeEventListener("keydown", block, true);
	}, [inFlight]);

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
			onClick={inFlight ? undefined : onClose}
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
						onClick={inFlight ? onMinimize : onClose}
						title={inFlight ? "最小化到后台任务" : "关闭"}
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
						) : task.status === "awaiting-save" ? (
							<div className="h-full w-full rounded-full bg-amber-500/60" />
						) : task.status === "unsaved" ? (
							<div
								className="h-full rounded-full bg-amber-500"
								style={{ width: `${hasKnownTotal ? percent : 100}%` }}
							/>
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
						{task.status === "awaiting-save" && (
							<>
								<span className="icon-[lucide--save] h-4 w-4 text-yellow-500" />
								<span className="text-yellow-600 dark:text-yellow-400">等待选择保存位置…</span>
							</>
						)}
						{task.status === "unsaved" && (
							<>
								<span className="icon-[lucide--save-off] h-4 w-4 text-yellow-500" />
								<span className="font-medium text-yellow-600 dark:text-yellow-400">未保存（已取消保存）</span>
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
					{inFlight ? (
						<>
							<button
								type="button"
								onClick={onMinimize}
								className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
							>
								<span className="icon-[lucide--minus] h-3.5 w-3.5" />
								最小化
							</button>
							{active && (
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
							)}
						</>
					) : (
						<>
							{canRetrySave && (task.status === "unsaved" || task.status === "error") && (
								<button
									type="button"
									onClick={onSave}
									className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
								>
									<span className="icon-[lucide--save] h-3.5 w-3.5" />
									重新保存
								</button>
							)}
							{task.status === "unsaved" && (
								<button
									type="button"
									onClick={onDiscard}
									className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] text-foreground hover:bg-[var(--dbx-hover)]"
								>
									<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
									放弃并释放
								</button>
							)}
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
