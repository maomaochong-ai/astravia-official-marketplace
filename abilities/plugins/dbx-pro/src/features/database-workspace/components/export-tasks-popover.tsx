/**
 * ExportTasksPopover — 顶栏后台任务按钮（对标 dbx 桌面壳 ExportProgressPopover）。
 *
 * - 仅当存在导出任务时渲染 FileDown 图标；
 * - 待处理数角标 1-9 / 9+：还在取数时绿色，只剩「等待保存 / 未保存」时琥珀色；
 * - 点击展开任务列表面板（portal 到 .dbx-root，禁止挂 document.body，
 *   否则 @scope 下的 token 样式失效）；
 * - 每项：状态图标 + 文件名 + 进度条（已知百分比 / 未知滑动动画）+ 行数 / 耗时；
 *   运行中可取消，未保存可重新选择保存位置 / 放弃并释放，完成可打开所在文件夹 / 移除；
 *   底部一键清除只清理终态记录，未保存的导出不会被一起删掉。
 */

import { useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { createPortal } from "react-dom";
import {
	hasExportPayload,
	isExportTaskActive,
	isExportTaskPending,
	useExportTasks,
	requestCancelExportTask,
	removeExportTask,
	clearFinishedExportTasks,
	type ExportTask,
} from "../state/export-tasks-store";
import { discardStagedExport, saveStagedExport } from "../services/export-save";
import { engineRevealInFolder } from "../../../shared/services/engine-client";
import { getUi } from "../../../runtime-contract";
import { formatElapsed } from "./export-progress-dialog";

const MAX_VISIBLE = 5;
const PANEL_WIDTH = 30; // rem


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
		case "awaiting-save":
			return <span className="icon-[lucide--save] h-4 w-4 shrink-0 text-yellow-500" />;
		case "unsaved":
			return <span className="icon-[lucide--circle-alert] h-4 w-4 shrink-0 text-yellow-500" />;
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

	const activeCount = tasks.filter(isExportTaskActive).length;
	const pendingCount = tasks.filter(isExportTaskPending).length;
	/** 等待保存 / 未保存也需要用户再动一下手：角标用琥珀色区分于「在跑」的绿色。 */
	const hasError = tasks.some((t) => t.status === "error");
	const finishedCount = tasks.filter((t) => !isExportTaskPending(t)).length;

	/**
	 * 顶栏按钮的进度环：不打开面板也能看到取数在推进（部分用户报的「顶部导出按钮
	 * 的进度条不跟随进度」就是按钮上只有角标、没有进度）。
	 * 只统计**已知总数**的活动任务：未知总数时下不出百分比，宁可不出环也不假报。
	 * 未结束前最高 99%，避免「环满了但还在写文件」。
	 */
	const activeTasks = tasks.filter(isExportTaskActive);
	const knownActiveTasks = activeTasks.filter((t) => t.totalRows !== null && t.totalRows > 0);
	const aggregatePercent =
		knownActiveTasks.length > 0
			? Math.min(
					99,
					Math.round(
						(knownActiveTasks.reduce((sum, t) => sum + t.rowsExported / (t.totalRows as number), 0) /
							knownActiveTasks.length) *
							100,
					),
				)
			: null;

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
				title={
					pendingCount === 0
						? "后台导出任务"
						: aggregatePercent !== null
							? `后台导出任务 · 导出中 ${aggregatePercent}%`
							: `后台导出任务 · ${pendingCount} 项待处理`
				}
				aria-haspopup="dialog"
				aria-expanded={open}
				className="relative flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
			>
				<span className="icon-[lucide--download] h-3.5 w-3.5" />
				{aggregatePercent !== null && (
					<span
						aria-hidden="true"
						className="dbx-export-ring pointer-events-none absolute inset-0 rounded-full"
						style={{ "--dbx-export-progress": `${aggregatePercent}%` } as CSSProperties}
					/>
				)}
				{pendingCount > 0 && (
					<span
						className={
							"absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none text-white " +
							(activeCount > 0 ? "bg-green-500" : "bg-amber-500")
						}
					>
						{pendingCount > 9 ? "9+" : pendingCount}
					</span>
				)}
				{pendingCount === 0 && hasError && (
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
								const active = isExportTaskActive(task);
								/** 取数结果还在暂存里：可以直接重选保存位置，不必重跑一遍查询。 */
								const canRetrySave = hasExportPayload(task.id);
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
												) : task.status === "awaiting-save" ? null : (
													<>
														{canRetrySave && (
															<button
																type="button"
																title={task.status === "unsaved" ? "重新选择保存位置" : "重试保存"}
																onClick={() => void saveStagedExport(task.id)}
																className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
															>
																<span className="icon-[lucide--save] h-3 w-3" />
															</button>
														)}
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
															title={task.status === "unsaved" ? "放弃并释放导出内容" : "移除记录"}
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
											) : task.status === "awaiting-save" ? (
												<div className="h-full w-full rounded-full bg-amber-500/60" />
											) : task.status === "unsaved" ? (
												<div
													className="h-full rounded-full bg-amber-500"
													style={{ width: `${known ? percent : 100}%` }}
												/>
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
														: task.status === "awaiting-save"
															? "等待选择保存位置…"
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
