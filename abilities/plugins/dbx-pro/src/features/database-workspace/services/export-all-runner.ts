/**
 * 「导出全部数据」的分块取数循环。
 *
 * 从结果网格里抽出来，是因为这里承载了两条必须能回归的不变量，而组件层
 * 无法驱动它们：
 * 1. 取消要在**一次引擎请求内**生效 —— 一块最多一次请求，取消延迟由「整批」
 *    （最多 50 次请求 × 单次 60s 超时）降为「一次请求」。
 * 2. 数据取完要按引擎信号显式判定（本块取不满 chunkLimit），并把「实导出
 *    少于统计总数」的差额报出来，避免只导出前 N 行却被当成完整结果。
 *
 * 取数与落盘分离：本模块只依赖注入的 fetchPage / token，组件层负责任务状态
 * 与写文件。
 */

import { ENGINE_ROW_CAP } from "../../../domain/workbench-settings";
import {
	createChunkedTextExport,
	type ChunkedTextExport,
	type TextExportKind,
} from "./result-export";

/** 一页取数请求。offset 为绝对行号，limit 为本次最多取多少行。 */
export interface ExportPageRequest {
	offset: number;
	limit: number;
}

/** 引擎返回的一页结果（结构上是 EngineQueryOutcome 的子集）。 */
export interface ExportPage {
	columns: string[];
	rows: Record<string, unknown>[];
	/** 引擎已按 LIMIT/OFFSET 分页；false = 不可分页 SQL（引擎忽略 page）。 */
	paged?: boolean;
	/** 不可分页时结果已被引擎单次上限截断。 */
	truncated?: boolean;
}

export interface ExportAllOptions {
	kind: TextExportKind | "xlsx";
	/** 文本导出的 INSERT / 建表语句里用的表名。 */
	tableName: string;
	dialect: "mysql" | "standard";
	/** 用户设置的导出行数上限，Infinity = 不限。 */
	rowLimit: number;
	/** 每批取行数，可能大于引擎单次上限：循环内按 ENGINE_ROW_CAP 再分块。 */
	batchSize: number;
	/** 服务端统计总数，用于结束时的差额提示；null = 未知。 */
	knownTotal: number | null;
	fetchPage: (request: ExportPageRequest) => Promise<ExportPage>;
	/** 取消标志：每块开始前检查，保证取消不必等整批取完。 */
	token: { cancelled: boolean };
	/** 每取完一批回调一次累计行数（任务进度用）。 */
	onProgress?: (rowsExported: number) => void;
}

export interface ExportAllResult {
	/** 取数途中被取消：调用方落取消态即可，不要写文件。 */
	cancelled: boolean;
	total: number;
	columns: string[];
	/** 文本导出的增量序列化器；kind === "xlsx" 时为 null。 */
	stream: ChunkedTextExport | null;
	xlsxRows: Record<string, unknown>[];
	truncationNote: string | null;
}

export async function runExportAll(options: ExportAllOptions): Promise<ExportAllResult> {
	const { kind, tableName, dialect, rowLimit, batchSize, knownTotal, fetchPage, token, onProgress } =
		options;

	let stream: ChunkedTextExport | null = null;
	let allColumns: string[] = [];
	const xlsxRows: Record<string, unknown>[] = [];
	let total = 0;
	let offset = 0;
	let truncationNote: string | null = null;

	/**
	 * 进度上报：按**每一次引擎请求**前进，而不是等整批取完才跳一格。
	 * batchSize 默认 2000 = 2 个引擎页，按批上报时进度条会「涨一下、停半天」，
	 * 顶栏进度看起来与真实取数不同步 —— 用户报的就是这个。
	 * 去重：等值回调不重发，避免 UI 收到同一进度白渲染。
	 */
	let lastReported = -1;
	function reportProgress(rows: number): void {
		if (!onProgress || rows <= lastReported) return;
		lastReported = rows;
		onProgress(rows);
	}

	/** 取消 / 结束时返回快照：本批未 push 的行不计入 total。 */
	function snapshot(cancelled: boolean): ExportAllResult {
		return { cancelled, total, columns: allColumns, stream, xlsxRows, truncationNote };
	}

	for (;;) {
		if (token.cancelled) return snapshot(true);

		// 按 batchSize 分批取数，每批内部可能分多次引擎调用（受 ENGINE_ROW_CAP 限制）
		const batchRows: Record<string, unknown>[] = [];
		let batchOffset = offset;
		const batchTarget =
			rowLimit === Infinity ? batchSize : Math.min(batchSize, Math.max(1, rowLimit - total));
		let lastOutcome: { paged?: boolean } | null = null;
		/** 本批是否已取到数据末尾（本块未取满）。 */
		let reachedEnd = false;

		while (batchRows.length < batchTarget) {
			// 每块都检查取消：一块最多一次引擎请求，取消延迟由「整批」降为「一次请求」。
			if (token.cancelled) return snapshot(true);

			const chunkLimit = Math.min(ENGINE_ROW_CAP, batchTarget - batchRows.length);
			const page = await fetchPage({ offset: batchOffset, limit: chunkLimit });
			lastOutcome = page;
			if (allColumns.length === 0) {
				allColumns = page.columns;
				if (kind !== "xlsx") {
					stream = createChunkedTextExport(kind, allColumns, { tableName, dialect });
				}
			}
			batchRows.push(...page.rows);
			// 每次引擎请求后立即上报（total 尚未计入本批，用 total + 本批已取行数）。
			reportProgress(total + batchRows.length);
			batchOffset += page.rows.length;

			// 不可分页查询：引擎忽略 page，单次结果最多 ENGINE_ROW_CAP 行
			if (!page.paged) {
				if (page.truncated === true) {
					truncationNote =
						`该 SQL 不支持服务端分页，仅导出引擎单次返回的前 ${(total + batchRows.length).toLocaleString()} 行；` +
						"如需完整数据，请在 SQL 中使用 LIMIT / OFFSET 分批导出";
				}
				break;
			}
			// 本块未取满 chunkLimit：数据已到末尾。
			if (page.rows.length < chunkLimit) {
				reachedEnd = true;
				break;
			}
		}

		total += batchRows.length;
		if (kind === "xlsx") xlsxRows.push(...batchRows);
		else stream?.push(batchRows);
		reportProgress(total);
		offset = batchOffset;

		// 不可分页查询已处理
		if (!lastOutcome?.paged) break;
		// 数据已取完：本块未取满，或本批不足 batchTarget
		if (reachedEnd || batchRows.length < batchTarget) break;
		// 已达到用户设置的上限
		if (rowLimit !== Infinity && total >= rowLimit) {
			truncationNote = `已按设置的导出行数上限导出前 ${total.toLocaleString()} 行，可在设置中调整或关闭上限`;
			break;
		}
	}

	// 取数收尾后仍可能已被取消（最后一批刚好取完）：不写文件，交给调用方落取消态。
	if (token.cancelled) return snapshot(true);

	// 统计总数已知但实导出更少：把差额明说，避免「只导出前 N 行」被当成完整结果。
	if (!truncationNote && knownTotal !== null && total < knownTotal) {
		truncationNote = `实导出 ${total.toLocaleString()} 行，少于统计总数 ${knownTotal.toLocaleString()} 行（可在结果页刷新总计后重试）`;
	}

	return snapshot(false);
}
