/**
 * ExportTasksTrigger —— 顶栏「下载后台」入口（对标设计稿 WorkbenchTopBar 的下载按钮）。
 *
 * - 按钮常驻（设计稿的下载入口无条件渲染）；无数据时不画进度环与角标；
 * - 进度环只统计**已知总数**的活动任务：未知总数时下不出百分比，宁可不出环也不假报，
 *   未结束前最高 99%，避免「环满了但还在写文件」；
 * - 角标 1-9 / 9+：还在取数时用中性色，只剩「等待保存 / 未保存」时琥珀色；
 * - 待处理记录全部结束后按钮上留一个红点，提示「有失败记录没看」。
 */

import { type CSSProperties, type JSX } from "react";
import { isExportTaskActive, isExportTaskPending, useExportTasks } from "../state/export-tasks-store";

export interface ExportTasksTriggerProps {
	/** 货架是否展开。 */
	open: boolean;
	/** 展开 / 收起底部货架。 */
	onToggle: () => void;
}

export function ExportTasksTrigger({ open, onToggle }: ExportTasksTriggerProps): JSX.Element {
	const tasks = useExportTasks();

	const activeCount = tasks.filter(isExportTaskActive).length;
	const pendingCount = tasks.filter(isExportTaskPending).length;
	const hasError = tasks.some((task) => task.status === "error");

	const activeTasks = tasks.filter(isExportTaskActive);
	const knownActiveTasks = activeTasks.filter((task) => task.totalRows !== null && task.totalRows > 0);
	const aggregatePercent =
		knownActiveTasks.length > 0
			? Math.min(
					99,
					Math.round(
						(knownActiveTasks.reduce((sum, task) => sum + task.rowsExported / (task.totalRows as number), 0) /
							knownActiveTasks.length) *
							100,
					),
				)
			: null;

	return (
		<button
			type="button"
			onClick={onToggle}
			title={
				pendingCount === 0
					? "下载后台"
					: aggregatePercent !== null
						? `下载后台 · 导出中 ${aggregatePercent}%`
						: `下载后台 · ${pendingCount} 项待处理`
			}
			aria-haspopup="dialog"
			aria-expanded={open}
			className="dbx-nav-item relative"
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
				<span className={"dbx-count-badge" + (activeCount > 0 ? "" : " dbx-export-count--attention")}>
					{pendingCount > 9 ? "9+" : pendingCount}
				</span>
			)}
			{pendingCount === 0 && hasError && (
				<span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
			)}
		</button>
	);
}
