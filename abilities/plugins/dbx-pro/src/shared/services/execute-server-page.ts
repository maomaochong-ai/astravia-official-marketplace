/**
 * executeServerPage — 引擎服务端分页的分块拼页逻辑（纯函数，无 React 依赖）。
 *
 * 引擎单次结果硬上限为 ENGINE_ROW_CAP，而调用方请求的页大小（pageSize）可以更大，
 * 所以一页通常要分多次请求，分块循环是常规路径。
 * 分块是为了让调用方一次拿到完整的 pageSize 行，而不是静默只回 cap 行；
 * 任一块失败即整体失败，不返回不足的行数。不可分页 SQL（引擎忽略 page）只取一次。
 *
 * 被以下调用方复用：
 *   - 工作台查询网格（use-workbench-execution.ts 的 executeServerPage）
 *   - dbx_query_full Agent 工具（完整数据查询）
 */

import { ENGINE_ROW_CAP } from "../../domain/workbench-settings";
import { engineExecuteByName, type EngineQueryOutcome } from "./engine-client";

export interface ExecuteServerPageParams {
	/** 起始 offset（工作台是 pageIndex * pageSize；dbx_query_full 是 0）。 */
	baseOffset: number;
	/** 目标行数（工作台是 pageSize；dbx_query_full 是 maxRows）。 */
	pageSize: number;
	/** 查询超时（毫秒）。 */
	timeoutMs: number;
	dbType?: string;
}

/**
 * 分块循环拉一页完整数据。
 *
 * @returns EngineQueryOutcome 语义一致的结果（rows 已合并到 pageSize 或到底）。
 */
export async function executeServerPage(
	connectionName: string,
	sql: string,
	params: ExecuteServerPageParams,
): Promise<EngineQueryOutcome> {
	const { baseOffset, pageSize, timeoutMs, dbType } = params;
	const chunkCount = Math.max(1, Math.ceil(pageSize / ENGINE_ROW_CAP));

	let first: EngineQueryOutcome | null = null;
	const mergedRows: Record<string, unknown>[] = [];
	let lastRows = 0;

	for (let chunk = 0; chunk < chunkCount; chunk += 1) {
		const raw = await engineExecuteByName(connectionName, sql, {
			timeoutMs,
			rowLimit: ENGINE_ROW_CAP,
			dbType,
			page: { offset: baseOffset + chunk * ENGINE_ROW_CAP, limit: ENGINE_ROW_CAP },
		});
		if (!first) first = raw;
		mergedRows.push(...raw.rows);
		lastRows = raw.rows.length;
		// 非可分页 SQL：引擎忽略 page，多次请求只会重复同一结果集，取一次即止。
		if (!raw.paged) break;
		// 末页（不足一块）或已凑满本页，无需继续。
		if (raw.rows.length < ENGINE_ROW_CAP) break;
		if (mergedRows.length >= pageSize) break;
	}

	const head = first as EngineQueryOutcome;
	return {
		...head,
		rows: mergedRows.slice(0, pageSize),
		row_count: Math.min(mergedRows.length, pageSize),
		// 非分页 SQL 保留引擎截断标记（toQueryResult 据此提示 1000 行上限）；
		// 分页拼页不标截断：没取满是因为到底了，取满了下一页继续取。
		truncated: head.paged === true ? false : head.truncated,
		paged: head.paged === true ? true : undefined,
		engine_row_count: head.paged === true ? mergedRows.length : lastRows,
	};
}
