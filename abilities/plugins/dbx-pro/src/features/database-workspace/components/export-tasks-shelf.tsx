/**
 * ExportTasksShelf —— 底部「下载后台」货架（对标设计稿 frames/downloads.tsx 的 DownloadQueue）。
 *
 * - 停靠在整块工作台底部、通栏展示（与 SplitLayout 同级），由顶栏下载入口开关；
 * - 列固定：任务 / 进度 / 大小 / 时间 / 状态 / 操作（列宽与字号见 panels.css .dbx-download-*）；
 * - 未结束的任务排在最前，其余按开始时间倒序；
 * - 运行中的任务可以取消，未保存的可以重新选择保存位置，完成的可以在文件夹中显示，
 *   终态记录可以逐条移除，表头一键清空只清理终态（未保存的内容不会被一起删掉）。
 */

import { useLayoutEffect, useState, type JSX } from "react";
import {
	clearFinishedExportTasks,
	hasExportPayload,
	isExportTaskActive,
	isExportTaskPending,
	MAX_UNSAVED_EXPORTS,
	removeExportTask,
	requestCancelExportTask,
	useExportTasks,
	type ExportTask,
} from "../state/export-tasks-store";
import { saveStagedExport } from "../services/export-save";
import { formatBytes } from "../services/format-bytes";
import { engineRevealInFolder } from "../../../shared/services/engine-client";
import { getUi } from "../../../runtime-contract";
import { formatElapsed } from "./export-progress-dialog";

export interface ExportTasksShelfProps {
	/** 收起货架（顶栏按钮不受影响，仍可再展开）。 */
	onCollapse: () => void;
}

/** 任务来源：目前只有结果网格导出这一条链路。 */
function sourceLine(task: ExportTask): string {
	if (task.database && task.tableName) return `结果网格 · ${task.database}.${task.tableName}`;
	if (task.tableName) return `结果网格 · ${task.tableName}`;
	return "结果网格导出";
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

export function ExportTasksShelf({ onCollapse }: ExportTasksShelfProps): JSX.Element {
	const tasks = useExportTasks();
	const [now, setNow] = useState(() => Date.now());

	const activeCount = tasks.filter(isExportTaskActive).length;
	const finishedCount = tasks.filter((task) => !isExportTaskPending(task)).length;
	const doneTasks = tasks.filter((task) => task.status === "done");
	const doneBytes = doneTasks.reduce((sum, task) => sum + (task.bytesTotal ?? 0), 0);

	/** 未结束的排在最前，其余按开始时间倒序（货架是队列：在跑的永远在最上面）。 */
	const ordered = [...tasks].sort((a, b) => {
		const rank = Number(isExportTaskPending(b)) - Number(isExportTaskPending(a));
		return rank !== 0 ? rank : b.startedAt - a.startedAt;
	});

	// 活动任务期间每 0.5s 刷新耗时显示。
	useLayoutEffect(() => {
		if (activeCount === 0) return;
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [activeCount]);

	return (
		<div className="dbx-download-shelf">
			<div className="dbx-download-head">
				<span className="dbx-download-head__title">下载后台</span>
				{activeCount > 0 ? (
					<span className="dbx-download-state is-accent">
						<span className="dbx-download-dot is-accent" aria-hidden="true" />
						<span>{activeCount} 个进行中</span>
					</span>
				) : (
					<span className="dbx-download-head__meta">
						{tasks.length > 0 ? `共 ${tasks.length} 项记录` : "暂无任务"}
					</span>
				)}
				<div className="dbx-download-head__actions">
					<button
						type="button"
						className="dbx-btn xs quiet"
						disabled={finishedCount === 0}
						onClick={() => clearFinishedExportTasks()}
					>
						清空已完成
					</button>
					<button type="button" className="dbx-iconbtn" title="收起任务面板" onClick={onCollapse}>
						<span className="icon-[lucide--chevron-down] h-3.5 w-3.5" />
					</button>
				</div>
			</div>

			{tasks.length === 0 ? (
				<div className="dbx-download-empty">
					<span className="icon-[lucide--inbox] h-5 w-5" aria-hidden="true" />
					<span className="dbx-download-empty__title">暂无后台导出任务</span>
					<span className="dbx-download-empty__hint">在结果网格导出数据后，任务会显示在这里</span>
				</div>
			) : (
				<>
					<div className="dbx-download-cols">
						<span>任务</span>
						<span>进度</span>
						<span className="is-right">大小</span>
						<span>时间</span>
						<span>状态</span>
						<span className="is-right">操作</span>
					</div>

					<div className="dbx-download-rows">
						{ordered.map((task) => {
							const active = isExportTaskActive(task);
							/** 取数结果还在暂存里：可以直接重选保存位置，不必重跑一遍查询。 */
							const canRetrySave = hasExportPayload(task.id);
							const known = task.totalRows !== null && task.totalRows > 0;
							const percent = known
								? Math.min(100, Math.round((task.rowsExported / (task.totalRows as number)) * 100))
								: 0;
							const elapsedMs = (task.finishedAt ?? now) - task.startedAt;

							return (
								<div key={task.id} className="dbx-download-row">
									<div className="dbx-download-task">
										<div className="dbx-download-name" title={task.fileName}>
											{task.fileName}
										</div>
										<div className="dbx-download-source" title={sourceLine(task)}>
											{sourceLine(task)}
										</div>
									</div>

									<div className="dbx-download-progress">
										<div className="dbx-download-bar">
											{task.status === "done" ? (
												<div className="dbx-download-bar__fill is-done" style={{ width: "100%" }} />
											) : task.status === "error" ? (
												<div
													className="dbx-download-bar__fill is-error"
													style={{ width: `${known ? percent : 100}%` }}
												/>
											) : task.status === "awaiting-save" ? (
												<div className="dbx-download-bar__fill is-warning" style={{ width: "100%", opacity: 0.6 }} />
											) : task.status === "unsaved" || task.status === "cancelled" ? (
												<div
													className="dbx-download-bar__fill is-warning"
													style={{ width: `${known ? percent : 100}%` }}
												/>
											) : active ? (
												known ? (
													<div className="dbx-download-bar__fill" style={{ width: `${percent}%` }} />
												) : (
													<div className="dbx-download-bar__fill dbx-export-indeterminate" />
												)
											) : (
												<div className="dbx-download-bar__fill is-done" style={{ width: `${percent}%`, opacity: 0.5 }} />
											)}
										</div>
										<span className="dbx-download-pct">{known ? `${percent}%` : "—"}</span>
									</div>

									<span className="dbx-download-cell is-right">{formatBytes(task.bytesTotal ?? task.bytesExported)}</span>

									<span className="dbx-download-cell is-faint">
										{isExportTaskPending(task)
											? `已用 ${formatElapsed(elapsedMs)}`
											: formatElapsed(elapsedMs)}
									</span>

									<span className={`dbx-download-state ${STATE_TONE[task.status]}`}>
										<span className={`dbx-download-dot ${STATE_TONE[task.status]}`} aria-hidden="true" />
										<span className="dbx-download-state__text" title={STATE_TITLE(task)}>
											{STATE_TITLE(task)}
										</span>
									</span>

									<div className="dbx-download-actions">
										{active ? (
											<button
												type="button"
												title={task.status === "cancelling" ? "正在取消…" : "取消任务"}
												disabled={task.status === "cancelling"}
												onClick={() => requestCancelExportTask(task.id)}
												className="dbx-iconbtn dbx-download-action--danger"
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
														className="dbx-btn xs ghost"
													>
														<span className="icon-[lucide--rotate-cw] h-3 w-3" />
														重新保存
													</button>
												)}
												{task.status === "done" && task.filePath && (
													<button
														type="button"
														title="打开所在文件夹"
														onClick={() => void revealTaskFile(task)}
														className="dbx-iconbtn"
													>
														<span className="icon-[lucide--folder-open] h-3 w-3" />
													</button>
												)}
												<button
													type="button"
													title={task.status === "unsaved" ? "放弃并释放导出内容" : "移除记录"}
													onClick={() => removeExportTask(task.id)}
													className="dbx-iconbtn dbx-download-action--danger"
												>
													<span className="icon-[lucide--trash-2] h-3 w-3" />
												</button>
											</>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</>
			)}

			<div className="dbx-download-foot">
				<span className="dbx-download-foot__note">
					导出内容由系统保存对话框落盘 · 未保存的导出最多保留 {MAX_UNSAVED_EXPORTS} 份
				</span>
				{doneTasks.length > 0 && (
					<span className="dbx-download-foot__summary">
						已完成 {doneTasks.length} 个 · 合计 {formatBytes(doneBytes)}
					</span>
				)}
			</div>
		</div>
	);
}

/** 状态点的色调：取数 / 写入是主色，等待用户动作是琥珀，完成是绿，失败是红。 */
const STATE_TONE: Record<ExportTask["status"], string> = {
	running: "is-accent",
	writing: "is-accent",
	cancelling: "is-warning",
	"awaiting-save": "is-warning",
	unsaved: "is-warning",
	cancelled: "is-warning",
	done: "is-success",
	error: "is-danger",
};

/** 状态文案：颜色不单独承载含义，每个点都有文字。 */
function STATE_TITLE(task: ExportTask): string {
	switch (task.status) {
		case "running":
			return "取数中";
		case "writing":
			return "写入中";
		case "cancelling":
			return "正在取消";
		case "awaiting-save":
			return "等待保存";
		case "unsaved":
			return "未保存";
		case "cancelled":
			return "已取消";
		case "done":
			return "已完成";
		case "error":
			return task.errorMessage || "导出失败";
	}
}
