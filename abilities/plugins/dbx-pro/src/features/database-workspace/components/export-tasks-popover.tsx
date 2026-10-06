/**
 * ExportTasksPopover — 顶栏后台任务按钮（对标 dbx 桌面壳 ExportProgressPopover）。
 *
 * - 仅当存在导出任务时渲染 FileDown 图标；
 * - 活动任务数角标 1-9 / 9+；存在失败任务时红点提示；
 * - 点击展开任务列表面板（portal 到 .dbx-root，禁止挂 document.body，
 *   否则 @scope 下的 token 样式失效）；
 * - 每项：状态图标 + 文件名 + 进度条（已知百分比 / 未知滑动动画）+ 行数 / 耗时；
 *   运行中可取消，完成可打开所在文件夹 / 移除，底部一键清除已完成。
 */

import { useLayoutEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import {
	useExportTasks,
	requestCancelExportTask,
	removeExportTask,
	clearFinishedExportTasks,
	type ExportTask,
} from "../export-tasks-store";
import { engineRevealInFolder } from "../../../shared/services/engine-client";
import { getUi } from "../../../runtime-contract";
import { formatElapsed } from "./export-progress-dialog";

const MAX_VISIBLE = 5;
const PANEL_WIDTH = 30; // rem

function isTaskActive(task: ExportTask): boolean {
	return task.status === "running" || task.status === "writing" || task.status === "cancelling";
}

function TaskStatusIcon({ task }: { task: ExportTask }): JSX.Element {
	switch (task.status) {
		case "running":
		case "writing":
			return <span className="icon-[lucide--loader-2] h-4 w-4 shrink-0 animate-spin text-green-500" />;
		case "cancelling":
			return <span className="icon-[lucide--loader-2] h-4 w-4 shrink-0 animate-spin text-yellow-500" />;
		case "done":
			return <span className="icon-[lucide--circle-check] h-4 w-4 shrink-0 text-green-500" />;
		case "error":
			return <span className="icon-[lucide--circle-x] h-4 w-4 shrink-0 text-destructive" />;
		case "cancelled":
			return <span className="icon-[lucide--circle-alert] h-4 w-4 shrink-0 text-yellow-500" />;
	}
}

async function revealTaskFile(task: ExportTask): Promise<void> {
	if (!task.filePath) return;
	try {
		await engineRevealInFolder(task.filePath);
	} catch (error) {
		try {
			getUi()?.notify({
				message: `打开所在文件夹失败：${error instanceof Error ? error.message : String(error)}`,
				variant: "error",
			});
		} catch {
			/* 宿主通知不可用时静默（文件路径仍可在完成弹窗中看到）。 */
		}
	}
}

export function ExportTasksPopover(): JSX.Element | null {
	const tasks = useExportTasks();
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [panelRoot, setPanelRoot] = useState<Element | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
	const [now, setNow] = useState(() => Date.now());

	const activeCount = tasks.filter(isTaskActive).length;
	const hasError = tasks.some((t) => t.status === "error");
	const finishedCount = tasks.filter((t) => !isTaskActive(t)).length;

	// 活动任务期间每 0.5s 刷新耗时显示。
	useLayoutEffect(() => {
		if (activeCount === 0) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [activeCount]);

	useLayoutEffect(() => {
		setPanelRoot(triggerRef.current?.closest(".dbx-root") ?? document.body);
	}, []);

	useLayoutEffect(() => {
		if (!open || !panelRoot) return;
		const rootRect = panelRoot.getBoundingClientRect();
		const triggerRect = triggerRef.current?.getBoundingClientRect();
		if (!triggerRect) return;
		const widthRem = Math.min(PANEL_WIDTH, window.innerWidth * 0.92 / 16);
		const left = Math.max(
			8,
			Math.min(triggerRect.right - widthRem * 16 - rootRect.left, rootRect.width - widthRem * 16 - 8),
		);
		// 顶栏图标：固定向下展开。
		const top = triggerRect.bottom - rootRect.top + 6;
		setPos({ left, top });
	}, [open, panelRoot, tasks.length]);

	useLayoutEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent): void {
			const t = e.target as Node;
			if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
			setOpen(false);
		}
		function onKey(e: KeyboardEvent): void {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	if (tasks.length === 0) return null;

	const visible = expanded ? tasks : tasks.slice(0, MAX_VISIBLE);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen((v) => !v)}
				title="后台导出任务"
				aria-haspopup="dialog"
				aria-expanded={open}
				className="relative flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
			>
				<span className="icon-[lucide--download] h-3.5 w-3.5" />
				{activeCount > 0 && (
					<span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[9px] font-semibold leading-none text-white">
						{activeCount > 9 ? "9+" : activeCount}
					</span>
				)}
				{activeCount === 0 && hasError && (
					<span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
				)}
			</button>

			{open &&
				panelRoot &&
				createPortal(
					<div
						ref={panelRef}
						role="dialog"
						aria-label="后台导出任务"
						className="absolute z-[400] flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl shadow-black/40"
						style={{ left: pos.left, top: pos.top, width: `min(92vw, ${PANEL_WIDTH}rem)` }}
					>
						<div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
							<span className="text-[12px] font-semibold text-foreground">后台任务</span>
							<span className="text-[10.5px] tabular-nums text-muted-foreground">{tasks.length} 项</span>
						</div>

						<div className="max-h-[19rem] overflow-y-auto py-1">
							{visible.map((task) => {
								const active = isTaskActive(task);
								const known = task.totalRows !== null && task.totalRows > 0;
								const percent = known
									? Math.min(100, Math.round((task.rowsExported / (task.totalRows as number)) * 100))
									: 0;
								const elapsedMs = (task.finishedAt ?? now) - task.startedAt;
								return (
									<div key={task.id} className="group px-3 py-2 hover:bg-[var(--dbx-hover)]">
										<div className="flex items-center gap-2">
											<TaskStatusIcon task={task} />
											<span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground" title={task.fileName}>
												{task.fileName}
											</span>
											<div className="flex shrink-0 items-center gap-0.5">
												{active ? (
													<button
														type="button"
														title={task.status === "cancelling" ? "正在取消…" : "取消任务"}
														disabled={task.status === "cancelling"}
														onClick={() => requestCancelExportTask(task.id)}
														className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-destructive disabled:opacity-50"
													>
														{task.status === "cancelling" ? (
															<span className="icon-[lucide--loader-2] h-3 w-3 animate-spin" />
														) : (
															<span className="icon-[lucide--x] h-3 w-3" />
														)}
													</button>
												) : (
													<>
														{task.status === "done" && task.filePath && (
															<button
																type="button"
																title="打开所在文件夹"
																onClick={() => void revealTaskFile(task)}
																className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
															>
																<span className="icon-[lucide--folder-open] h-3 w-3" />
															</button>
														)}
														<button
															type="button"
															title="移除记录"
															onClick={() => removeExportTask(task.id)}
															className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
														>
															<span className="icon-[lucide--x] h-3 w-3" />
														</button>
													</>
												)}
											</div>
										</div>

										<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
											{task.status === "done" ? (
												<div className="h-full w-full rounded-full bg-green-500" />
											) : active ? (
												known ? (
													<div
														className="h-full rounded-full bg-green-500 transition-[width] duration-300"
														style={{ width: `${percent}%` }}
													/>
												) : (
													<div className="h-full w-full overflow-hidden rounded-full">
														<div className="dbx-export-indeterminate h-full rounded-full bg-green-500" />
													</div>
												)
											) : known ? (
												<div className="h-full rounded-full bg-green-500/50" style={{ width: `${percent}%` }} />
											) : null}
										</div>

										<div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] tabular-nums text-muted-foreground">
											<span className="min-w-0 truncate">
												{task.status === "error"
													? task.errorMessage || "导出失败"
													: task.status === "cancelling"
														? "正在取消…"
														: task.note
															? task.note
															: known
																? `${task.rowsExported.toLocaleString()} / ${(task.totalRows as number).toLocaleString()} 行`
																: `${task.rowsExported.toLocaleString()} 行`}
											</span>
											<span className="shrink-0">{formatElapsed(elapsedMs)}</span>
										</div>
									</div>
								);
							})}
						</div>

						{tasks.length > MAX_VISIBLE && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="shrink-0 border-t border-border px-3 py-1.5 text-center text-[11px] text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
							>
								{expanded ? "收起" : `展开其余 ${tasks.length - MAX_VISIBLE} 项`}
							</button>
						)}

						{finishedCount > 0 && (
							<button
								type="button"
								onClick={() => {
									clearFinishedExportTasks();
									setExpanded(false);
								}}
								className="shrink-0 border-t border-border px-3 py-1.5 text-center text-[11px] text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
							>
								清除已完成（{finishedCount}）
							</button>
						)}
					</div>,
					panelRoot,
				)}
		</>
	);
}
