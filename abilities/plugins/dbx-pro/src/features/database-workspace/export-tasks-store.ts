/**
 * export-tasks-store —— 后台导出任务的模块级单例 store。
 *
 * 对标 dbx 桌面壳 useExportTracker：任务状态存活在任何组件之外，
 * 结果网格卸载、进度弹窗「最小化」后任务继续运行；顶栏后台任务按钮、
 * 后台任务 popover、进度弹窗都订阅同一份快照（useSyncExternalStore）。
 */

import { useSyncExternalStore } from "react";

export type ExportTaskStatus = "running" | "writing" | "cancelling" | "done" | "error" | "cancelled";

export interface ExportTask {
	id: string;
	fileName: string;
	/** 导出格式标识（csv / xlsx / json …），用于图标与角标。 */
	format: string;
	database?: string | null;
	tableName?: string | null;
	/** saveAs 返回的用户自选真实落盘路径；null 表示旧宿主降级为浏览器下载（无 reveal）。 */
	filePath?: string | null;
	rowsExported: number;
	/** 总行数；null 未知，进度条走不确定动画。 */
	totalRows: number | null;
	status: ExportTaskStatus;
	errorMessage?: string | null;
	/** 完成但有需要告知的情况（如被上限截断、SQL 不支持分页仅导出前 N 行）。 */
	note?: string | null;
	startedAt: number;
	finishedAt?: number;
}

export type NewExportTask = Pick<ExportTask, "fileName" | "format"> &
	Partial<Pick<ExportTask, "database" | "tableName" | "totalRows">>;

const taskMap = new Map<string, ExportTask>();
const cancelHandlers = new Map<string, () => void>();
const listeners = new Set<() => void>();
let cachedSnapshot: ExportTask[] = [];
let taskSeq = 0;

function emit(): void {
	cachedSnapshot = [...taskMap.values()];
	for (const listener of listeners) listener();
}

export function subscribeExportTasks(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getExportTasks(): ExportTask[] {
	return cachedSnapshot;
}

export function getExportTask(id: string | null | undefined): ExportTask | null {
	return id ? taskMap.get(id) ?? null : null;
}

export function addExportTask(initial: NewExportTask): ExportTask {
	taskSeq += 1;
	const id = `export-${Date.now().toString(36)}-${taskSeq}`;
	const task: ExportTask = {
		id,
		fileName: initial.fileName,
		format: initial.format,
		database: initial.database ?? null,
		tableName: initial.tableName ?? null,
		filePath: null,
		rowsExported: 0,
		totalRows: initial.totalRows ?? null,
		status: "running",
		startedAt: Date.now(),
	};
	taskMap.set(id, task);
	emit();
	return task;
}

export function updateExportTask(id: string, patch: Partial<Omit<ExportTask, "id">>): void {
	const current = taskMap.get(id);
	if (!current) return;
	taskMap.set(id, { ...current, ...patch });
	emit();
}

export function removeExportTask(id: string): void {
	cancelHandlers.delete(id);
	taskMap.delete(id);
	emit();
}

/** 清除全部已结束任务（done / error / cancelled），活动任务保留。 */
export function clearFinishedExportTasks(): void {
	for (const [id, task] of taskMap) {
		if (task.status === "done" || task.status === "error" || task.status === "cancelled") {
			cancelHandlers.delete(id);
			taskMap.delete(id);
		}
	}
	emit();
}

/** 注册任务的实际取消动作（块间取消令牌），返回注销函数。 */
export function registerExportCancelHandler(id: string, handler: () => void): () => void {
	cancelHandlers.set(id, handler);
	return () => {
		if (cancelHandlers.get(id) === handler) cancelHandlers.delete(id);
	};
}

/**
 * 请求取消：活动任务先转 cancelling（UI 立即反馈），再调用注册方的取消令牌；
 * 已结束任务忽略。最终的 cancelled 状态由执行流程落账。
 */
export function requestCancelExportTask(id: string): void {
	const task = taskMap.get(id);
	if (!task) return;
	// 仅活动任务可取消：cancelling 防重入，终态（done/error/cancelled）忽略。
	if (task.status !== "running" && task.status !== "writing") return;
	taskMap.set(id, { ...task, status: "cancelling" });
	emit();
	cancelHandlers.get(id)?.();
}

export function isExportTaskActive(task: Pick<ExportTask, "status">): boolean {
	return task.status === "running" || task.status === "writing" || task.status === "cancelling";
}

/** React 订阅钩子：顶栏按钮 / popover / 进度弹窗共用同一快照。 */
export function useExportTasks(): ExportTask[] {
	return useSyncExternalStore(subscribeExportTasks, getExportTasks, getExportTasks);
}
