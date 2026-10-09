/**
 * export-save —— 「导出全部数据」的落盘阶段。
 *
 * 取数与保存拆成两步：内容先暂存在 export-tasks-store，用户在原生对话框里取消后
 * 内容仍然保留、任务落到 unsaved，可以从顶栏重新选择保存位置或明确放弃。
 * 这样「导出完了但找不到文件」会变成一条能追溯、能重试的记录。
 */

import { getFs } from "../../../runtime-contract";
import { getExportPayload, releaseExportPayload, updateExportTask } from "../state/export-tasks-store";

export type ExportSaveResult =
	/** 已落盘；filePath 为 null 表示旧宿主降级下载，无真实路径可 reveal。 */
	| { outcome: "saved"; filePath: string | null }
	/** 用户在保存框里取消，内容已保留，任务处于 unsaved。 */
	| { outcome: "unsaved" }
	/** 没有暂存内容或宿主没有 fs.saveAs：调用方自行降级。 */
	| { outcome: "unavailable" }
	| { outcome: "error"; message: string };

/** 用户取消保存 / 保存失败时的固定提示：调用方需要和截断提示拼在一起，所以导出。 */
export const CONTENT_KEPT_NOTE = "已保留导出内容，可重新选择保存位置";

/** 宿主运行时已释放（插件 dispose）时 getFs 会抛错，这里统一降级为「无 fs 能力」。 */
function resolveFs(): ReturnType<typeof getFs> {
	try {
		return getFs();
	} catch {
		return null;
	}
}

/**
 * 把暂存内容交给宿主保存框落盘。
 * 只有宿主 fs 与暂存内容都在时才可能成功，其余情况交给调用方降级处理。
 */
export async function saveStagedExport(taskId: string): Promise<ExportSaveResult> {
	const payload = getExportPayload(taskId);
	const fsApi = resolveFs();
	if (!payload || !fsApi) return { outcome: "unavailable" };

	updateExportTask(taskId, { status: "awaiting-save", note: null });
	try {
		const filePath = await fsApi.saveAs(payload.fileName, payload.content, payload.encoding, {
			title: "选择导出文件保存位置",
		});
		if (filePath === null) {
			updateExportTask(taskId, {
				status: "unsaved",
				finishedAt: Date.now(),
				note: CONTENT_KEPT_NOTE,
			});
			return { outcome: "unsaved" };
		}
		// 落盘成功：内容不必再占内存
		releaseExportPayload(taskId);
		updateExportTask(taskId, {
			status: "done",
			filePath,
			finishedAt: Date.now(),
			errorMessage: null,
			note: null,
		});
		return { outcome: "saved", filePath };
	} catch (error) {
		// 失败不释放内容，用户可以直接重试
		const message = error instanceof Error ? error.message : String(error);
		updateExportTask(taskId, {
			status: "error",
			finishedAt: Date.now(),
			errorMessage: message,
			note: CONTENT_KEPT_NOTE,
		});
		return { outcome: "error", message };
	}
}

/** 用户明确放弃保存：释放内容并把任务落成已取消。 */
export function discardStagedExport(taskId: string): void {
	releaseExportPayload(taskId);
	updateExportTask(taskId, {
		status: "cancelled",
		finishedAt: Date.now(),
		note: "已放弃保存，导出内容已释放",
	});
}
