/**
 * ResultGrid — 查询结果网格。
 *
 * - 行号列（横向滚动时固定左侧）；列宽拖拽
 * - 双击单元格 → 详情弹窗；右键单元格 → 复制 / 导出菜单
 * - 工具栏：复制为 TSV、导出 CSV、表属性
 * - 分页：
 *   - 服务端分页（表预览 / 可分页 SELECT）：引擎按 LIMIT/OFFSET 取页，
 *     翻页经 onPageChange 重跑；总数 COUNT 未回来时只按「本页是否装满」给下一页。
 *   - 本地分页（其余 SQL）：对已取回的行切片。
 *   两种模式底部均提供每页行数选择，默认来自工作台设置（设置 200 即 200）。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import {
	ContextMenu,
	type ContextMenuState,
	type ContextMenuEntry,
} from "../../../shared/components/context-menu";
import {
	CellDetailDialog,
	type CellDetail,
} from "./cell-detail-dialog";
import {
	PAGE_SIZE_OPTIONS,
	resolvePageSize,
	ENGINE_ROW_CAP,
} from "../../../domain/workbench-settings";
import { engineExecuteByName, engineRevealInFolder } from "../../../shared/services/engine-client";
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";
import {
	cellText,
	toTsv,
	toCsv,
	toJson,
	toJsonLines,
	toMarkdown,
	toHtml,
	toSqlInsert,
	createChunkedTextExport,
	type ChunkedTextExport,
	type TextExportKind,
} from "../services/result-export";
import { toXlsx } from "../services/xlsx-export";
import { buildExportFileName } from "../services/export-file-name";
import {
	addExportTask,
	updateExportTask,
	registerExportCancelHandler,
	requestCancelExportTask,
	useExportTasks,
	type ExportTask,
} from "../export-tasks-store";
import { getFs, getUi } from "../../../runtime-contract";
import { CellDisplay } from "./cell-display";
import { CellEditor } from "./cell-editor";
import { TableInfoPanel, type TableInfoSelection } from "./table-info-panel";
import { PageSizeMenu } from "./page-size-menu";
import { ExportProgressDialog } from "./export-progress-dialog";
import { useWorkbench } from "../hooks/use-workbench";
import { buildFilteredSql } from "../services/query-filter";

interface Props {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	/** 产生该结果的连接 / SQL，用于「分析结果」回流给 AI。 */
	connectionName?: string;
	sql?: string;
	/** 引擎已按 LIMIT/OFFSET 取页：组件不本地切片，翻页交给 onPageChange。 */
	serverPaged?: boolean;
	/** 当前服务端页码（0-based）。 */
	serverPage?: number;
	/** 服务端分页实际页大小。 */
	serverPageSize?: number;
	/** 初始页大小（本地分页的默认值；取设置 rowLimit）。 */
	defaultPageSize: number;
	/** 服务端分页的总行数；undefined = 尚未统计或统计失败。 */
	serverTotalCount?: number;
	/** 服务端总数统计状态：pending=统计中；failed=统计失败（总数仍未知）。 */
	serverTotalStatus?: "pending" | "failed";
	/** 正在取页。 */
	pageLoading?: boolean;
	/** 截断 / 多语句等需要告知的提示。 */
	note?: string;
	onPageChange?: (pageIndex: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
	/** 设为默认每页行数。 */
	onSetDefaultPageSize?: (pageSize: number) => void;
	/** 刷新总计行统计。 */
	onRefreshTotalCount?: () => void;
	/** 停止当前取数（翻页 / 改每页行数卡住时给出路）。 */
	onCancelLoading?: () => void;
}

/** Uint8Array → base64（分块拼接，避免大 XLSX 时 String.fromCharCode 参数溢出栈）。 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	const chunkSize = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export function ResultGrid({
	columns,
	rows,
	totalRows,
	connectionName,
	sql,
	serverPaged,
	serverPage,
	serverPageSize,
	defaultPageSize,
	serverTotalCount,
	serverTotalStatus,
	pageLoading,
	note,
	onPageChange,
	onPageSizeChange,
	onSetDefaultPageSize,
	onRefreshTotalCount,
	onCancelLoading,
}: Props): JSX.Element {
	const isServer = serverPaged === true;
	const [localPage, setLocalPage] = useState(0);
	const [localPageSize, setLocalPageSize] = useState(() => resolvePageSize(defaultPageSize));
	// 页码跳转输入框（对齐 dbx DataGridPagination：直接输入页码，Enter/失焦跳转）。
	const [pageInput, setPageInput] = useState("1");

	const scrollRef = useRef<HTMLDivElement>(null);
	const [colWidths, setColWidths] = useState<Record<string, number>>({});
	const [menu, setMenu] = useState<ContextMenuState | null>(null);
	const [detail, setDetail] = useState<CellDetail | null>(null);
	const [showRowNumbers, setShowRowNumbers] = useState(true);
	const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
	const [aiDialogOpen, setAiDialogOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");
	const [tableInfoOpen, setTableInfoOpen] = useState(false);
	const [tableInfoSelection, setTableInfoSelection] = useState<TableInfoSelection | null>(null);
	const [splitToolbar, setSplitToolbar] = useState(false); // 双排工具栏开关
	const [whereClause, setWhereClause] = useState(""); // WHERE 条件
	const [orderByClause, setOrderByClause] = useState(""); // ORDER BY 条件
	const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null); // 当前编辑的单元格
	const [editValue, setEditValue] = useState<unknown>(null); // 编辑中的值
	const [editHistory, setEditHistory] = useState<Array<{ row: number; col: string; oldValue: unknown; newValue: unknown }>>([]); // 编辑历史（用于 Undo）
	const [editHistoryIndex, setEditHistoryIndex] = useState(-1); // 当前历史索引（用于 Redo）
	const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null); // 当前选中的单元格（用于导航）
	// 当前在模态中展示的后台导出任务 id（最小化后置 null，任务仍在顶栏后台任务里）。
	const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
	const exportCancelTokensRef = useRef<Map<string, { cancelled: boolean }>>(new Map());
	const exportTasks = useExportTasks();
	const dialogTask = dialogTaskId ? (exportTasks.find((t) => t.id === dialogTaskId) ?? null) : null;

	// 尝试从 SQL 中解析表名（用于表属性按钮）
	const { state, dispatch, runTabSql, settings } = useWorkbench();
	const activeTabId = state.activeTabId;
	const parsedTableName = useMemo(() => {
		if (!sql) return null;
		// 简单解析：SELECT ... FROM table_name 或 SELECT ... FROM schema.table_name
		const match = sql.match(/FROM\s+["`]?(\w+(?:\.["`]?\w+)?)[\s;)]?/i);
		if (match) {
			const full = match[1];
			const parts = full.split(".");
			if (parts.length === 2) {
				return { schema: parts[0].replace(/["`]/g, ""), tableName: parts[1].replace(/["`]/g, "") };
			}
			return { schema: undefined, tableName: full.replace(/["`]/g, "") };
		}
		return null;
	}, [sql]);

	// ── 快捷键支持（仅在网格区域聚焦时生效）────────────────────────

	const gridRootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent): void {
			// 1) 真实表单控件与 contenteditable（CodeMirror 是 contenteditable，
			//    不是 textarea）一律放行，否则编辑器内粘贴 / 撤销 / 全选会被吞掉。
			const target = e.target;
			if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
			if (target instanceof HTMLElement && (target.isContentEditable || target.closest(".cm-editor"))) return;
			// 2) 快捷键只作用于结果网格自身区域，不在树 / 编辑器 / 宿主输入区触发。
			if (!(target instanceof HTMLElement) || !gridRootRef.current?.contains(target)) return;

			const isMod = e.metaKey || e.ctrlKey;

			// Undo: Mod+Z
			if (isMod && e.key.toLowerCase() === "z" && !e.shiftKey) {
				e.preventDefault();
				undoEdit();
			}
			// Redo: Shift+Mod+Z 或 Ctrl+Y
			else if ((isMod && e.shiftKey && e.key.toLowerCase() === "z") || (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "y")) {
				e.preventDefault();
				redoEdit();
			}
			// Enter: 开始编辑当前选中的单元格
			else if (e.key === "Enter" && !isMod && selectedCell) {
				e.preventDefault();
				const { row, col } = selectedCell;
				const value = rows[row]?.[col];
				startCellEdit(row, col, value);
			}
			// 方向键导航
			else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedCell) {
				e.preventDefault();
				navigateCell(e.key);
			}
			// Mod+C: 复制选中单元格（不拦截 Mod+V/A/X：网格只读，浏览器默认行为放行）
			else if (isMod && e.key.toLowerCase() === "c" && selectedCell) {
				e.preventDefault();
				copySelectedCell();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [editHistory, editHistoryIndex, selectedCell, rows]);

	/** 方向键导航单元格 */
	function navigateCell(key: string): void {
		if (!selectedCell) return;
		const { row, col } = selectedCell;
		const colIndex = colList.indexOf(col);
		let newRow = row;
		let newColIndex = colIndex;
		
		switch (key) {
			case "ArrowUp":
				newRow = Math.max(0, row - 1);
				break;
			case "ArrowDown":
				newRow = Math.min(pagedRows.length - 1, row + 1);
				break;
			case "ArrowLeft":
				newColIndex = Math.max(0, colIndex - 1);
				break;
			case "ArrowRight":
				newColIndex = Math.min(colList.length - 1, colIndex + 1);
				break;
		}
		
		if (newRow !== row || newColIndex !== colIndex) {
			setSelectedCell({ row: newRow, col: colList[newColIndex] });
		}
	}

	/** 复制选中单元格 */
	function copySelectedCell(): void {
		if (!selectedCell) return;
		const { row, col } = selectedCell;
		const value = rows[row]?.[col];
		const text = cellText(value);
		void navigator.clipboard.writeText(text).catch(() => {});
	}

	// 设置的每页行数变化时跟随为本地默认页大小。
	useEffect(() => {
		setLocalPageSize(resolvePageSize(defaultPageSize));
		setLocalPage(0);
	}, [defaultPageSize]);

	function openAiDialogForQuery(): void {
		setAiPrompt(buildQueryPrompt(connectionName ?? "", sql ?? "", rows));
		setAiDialogOpen(true);
	}

	/**
	 * 应用第二排的 WHERE / ORDER BY：把子查询包装在派生表里重跑，
	 * 这样无需解析用户 SQL 里是否已有 WHERE，也兼容服务端分页（分页改写作用于外层）。
	 * 仅支持单条 SELECT / WITH。
	 */
	function applyFilterSort(): void {
		const where = whereClause.trim();
		const orderBy = orderByClause.trim();
		if (!where && !orderBy) return;
		const tabId = activeTabId;
		const baseSql = (sql ?? "").trim();
		if (!tabId || !baseSql) return;
		const wrapped = buildFilteredSql(baseSql, where, orderBy);
		if (!wrapped) {
			dispatch({ type: "setError", message: "过滤 / 排序仅支持单条 SELECT / WITH 查询" });
			return;
		}
		void runTabSql(tabId, wrapped, undefined, { mode: "server" });
	}

	function openTableInfo(): void {
		if (!connectionName) return;
		// 优先使用解析出的表名，否则使用连接名作为表名（让用户手动选择）
		if (parsedTableName) {
			setTableInfoSelection({
				connectionName,
				tableName: parsedTableName.tableName,
				schema: parsedTableName.schema,
			});
		} else {
			// 解析不出表名：提示用户，不做静默失败。
			dispatch({ type: "setError", message: "无法从 SQL 中解析表名，请确保 SQL 包含 FROM 子句" });
			return;
		}
		setTableInfoOpen(true);
	}

	// ─── 单元格编辑 ─────────────────────────────────────────

	/** 开始编辑单元格 */
	function startCellEdit(rowIndex: number, col: string, value: unknown): void {
		setEditingCell({ row: rowIndex, col });
		setEditValue(value);
	}

	/** 提交单元格编辑 */
	function commitCellEdit(newValue: unknown): void {
		if (!editingCell) return;
		const { row, col } = editingCell;
		const oldValue = rows[row]?.[col];
		
		// 添加到编辑历史
		const newHistory = editHistory.slice(0, editHistoryIndex + 1);
		newHistory.push({ row, col, oldValue, newValue });
		setEditHistory(newHistory);
		setEditHistoryIndex(newHistory.length - 1);
		
		// 更新数据（注意：这里只是本地更新，实际应该调用引擎 API）
		// TODO: 调用引擎 API 更新数据库
		const newRows = [...rows];
		newRows[row] = { ...newRows[row], [col]: newValue };
		// 注意：这里不能直接修改 rows，因为 rows 是 props
		// 实际应该通过回调通知父组件
		
		setEditingCell(null);
		setEditValue(null);
	}

	/** 取消单元格编辑 */
	function cancelCellEdit(): void {
		setEditingCell(null);
		setEditValue(null);
	}

	/** Undo 最后一次编辑 */
	function undoEdit(): void {
		if (editHistoryIndex < 0) return;
		const edit = editHistory[editHistoryIndex];
		// TODO: 恢复旧值
		setEditHistoryIndex(editHistoryIndex - 1);
	}

	/** Redo 最后一次撤销的编辑 */
	function redoEdit(): void {
		if (editHistoryIndex >= editHistory.length - 1) return;
		const edit = editHistory[editHistoryIndex + 1];
		// TODO: 恢复新值
		setEditHistoryIndex(editHistoryIndex + 1);
	}

	/** 处理单元格双击 */
	function handleCellDoubleClick(rowIndex: number, col: string, value: unknown): void {
		if (!settings.dataGridCellDetailButtonVisible) return;
		setDetail({ column: col, value });
	}

	// 客户端排序（仅对已取回的行；null/undefined 始终排最后）。
	const orderedRows = useMemo(() => {
		if (!sort) return rows;
		const factor = sort.dir === "asc" ? 1 : -1;
		const compare = (a: Record<string, unknown>, b: Record<string, unknown>): number => {
			const av = a[sort.col];
			const bv = b[sort.col];
			if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
			if (bv === null || bv === undefined) return -1;
			if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
			return String(av).localeCompare(String(bv)) * factor;
		};
		return [...rows].sort(compare);
	}, [rows, sort]);

	const pageSize = isServer
		? (serverPageSize ?? defaultPageSize)
		: localPageSize;

	// 总数已知才敢算总页数；未知（统计中/失败）时为 null，翻页改用「本页是否取满」判断。
	const totalKnown = !isServer || (serverTotalCount !== undefined && serverTotalCount >= 0);
	const totalPages = useMemo(() => {
		if (isServer) {
			const total = serverTotalCount;
			return totalKnown && total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : null;
		}
		return Math.max(1, Math.ceil(rows.length / pageSize));
	}, [isServer, totalKnown, serverTotalCount, rows.length, pageSize]);

	const safePage = isServer
		? Math.max(0, serverPage ?? 0)
		: Math.min(localPage, (totalPages ?? 1) - 1);

	const pagedRows = useMemo(
		() =>
			isServer
				? orderedRows
				: orderedRows.slice(safePage * pageSize, (safePage + 1) * pageSize),
		[isServer, orderedRows, safePage, pageSize],
	);

	const displayTotal = isServer
		? (serverTotalCount !== undefined && serverTotalCount >= 0 ? serverTotalCount : safePage * pageSize + rows.length)
		: rows.length;

	// 翻页 / 改每页行数：网格内部滚动回到顶部；页码输入框与当前页保持同步。
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = 0;
		setPageInput(String(safePage + 1));
	}, [safePage, pageSize]);
	const hasNextPage = isServer
		? totalPages === null
			? rows.length >= pageSize
			: safePage < totalPages - 1
		: safePage < (totalPages ?? 1) - 1;

	/** 翻页：服务端交给上层重跑 SQL；本地切片。 */
	function goToPage(next: number): void {
		if (isServer) onPageChange?.(Math.max(0, next));
		else setLocalPage(Math.max(0, Math.min((totalPages ?? 1) - 1, next)));
	}

	/**
	 * 提交页码跳转：正整数，夹到 [1, totalPages]；总数未知时只夹下界，
	 * 超出数据范围的页由引擎返回空结果。Enter 与失焦共用。
	 */
	function commitPageInput(): void {
		const parsed = Number(pageInput);
		if (Number.isFinite(parsed) && parsed >= 1) {
			const target = Math.floor(parsed);
			const clamped = totalPages !== null ? Math.min(target, totalPages) : target;
			if (clamped - 1 !== safePage) goToPage(clamped - 1);
		}
		setPageInput(String(safePage + 1));
	}

	/** 页大小变化：服务端交上层并回第 0 页；本地重置。 */
	function changePageSize(next: number): void {
		if (isServer) onPageSizeChange?.(next);
		else {
			setLocalPageSize(next);
			setLocalPage(0);
		}
	}

	/**
	 * 总数统计中（首批自动统计与手动刷新共用）：状态由 tab 携带，
	 * 不依赖本地计时器，统计一旦落定就必然结束，不会出现永久转圈。
	 */
	const totalCounting = isServer && serverTotalStatus === "pending";

	function refreshTotalCount(): void {
		if (!isServer || !sql || !connectionName || totalCounting) return;
		onRefreshTotalCount?.();
	}

	/** 点击表头：无→升序→降序→清除。 */
	function toggleSort(col: string) {
		setLocalPage(0);
		setSort((prev) => {
			if (!prev || prev.col !== col) return { col, dir: "asc" };
			if (prev.dir === "asc") return { col, dir: "desc" };
			return null;
		});
	}

	const colList = useMemo(
		() => (columns.length > 0 ? columns : Array.from(new Set(rows.flatMap((r) => Object.keys(r))))),
		[columns, rows],
	);

	const copyAll = useCallback(async () => {
		const text = toTsv(colList, rows);
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback: 使用传统方法复制
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			try {
				document.execCommand("copy");
			} catch {
				// 忽略错误
			}
			document.body.removeChild(textarea);
		}
	}, [colList, rows]);

	const copyAsJson = useCallback(async () => {
		await navigator.clipboard.writeText(toJson(colList, rows)).catch(() => {});
	}, [colList, rows]);

	const copyAsMarkdown = useCallback(async () => {
		await navigator.clipboard.writeText(toMarkdown(colList, rows)).catch(() => {});
	}, [colList, rows]);

	// ─── 导出：格式表驱动（当前页 / 全部共用一套序列化）────────────
	type ExportKind = TextExportKind | "xlsx";

	const EXPORT_FORMATS: ReadonlyArray<{
		kind: ExportKind;
		label: string;
		icon: string;
	}> = [
		{ kind: "csv", label: "CSV", icon: "icon-[lucide--file-spreadsheet]" },
		{ kind: "xlsx", label: "Excel（XLSX）", icon: "icon-[lucide--sheet]" },
		{ kind: "json", label: "JSON", icon: "icon-[lucide--file-json]" },
		{ kind: "jsonl", label: "JSON Lines", icon: "icon-[lucide--file-code]" },
		{ kind: "md", label: "Markdown", icon: "icon-[lucide--file-text]" },
		{ kind: "html", label: "HTML", icon: "icon-[lucide--file-code-2]" },
		{ kind: "sql", label: "SQL（INSERT）", icon: "icon-[lucide--file-terminal]" },
		{ kind: "txt", label: "TXT", icon: "icon-[lucide--file-text]" },
	];

	const EXPORT_EXT: Record<ExportKind, string> = {
		csv: "csv",
		xlsx: "xlsx",
		json: "json",
		jsonl: "jsonl",
		md: "md",
		html: "html",
		sql: "sql",
		txt: "txt",
	};

	const EXPORT_MIME: Record<ExportKind, string> = {
		csv: "text/csv;charset=utf-8",
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		json: "application/json",
		jsonl: "application/x-ndjson",
		md: "text/markdown",
		html: "text/html",
		sql: "application/sql;charset=utf-8",
		txt: "text/plain;charset=utf-8",
	};

	function sqlDialect(): "mysql" | "standard" {
		const dbType = (state.connections.find((c) => c.name === connectionName)?.db_type ?? "").toLowerCase();
		return /mysql|maria|tidb|starrocks|doris|goldendb|databend/.test(dbType) ? "mysql" : "standard";
	}

	/** 导出文件名各段：库名（连接 database）+ 表名（表信息选择 / SQL 解析），缺失自动降级。 */
	function exportNameParts(): { database: string | null; tableName: string | null } {
		const database = state.connections.find((c) => c.name === connectionName)?.database ?? null;
		const tableName = tableInfoSelection?.tableName || parsedTableName?.tableName || null;
		return { database: database || null, tableName };
	}

	/** 文本格式整量序列化（当前页 saveAs 与旧宿主降级 Blob 共用）。 */
	function serializeText(kind: TextExportKind, cols: string[], dataRows: Record<string, unknown>[], target: string): string {
		switch (kind) {
			case "csv":
				return toCsv(cols, dataRows);
			case "json":
				return toJson(cols, dataRows);
			case "jsonl":
				return toJsonLines(cols, dataRows);
			case "md":
				return toMarkdown(cols, dataRows);
			case "html":
				return toHtml(cols, dataRows);
			case "sql":
				return toSqlInsert(cols, dataRows, target, sqlDialect());
			case "txt":
				// TSV 纯文本，可直接粘贴进 Excel。
				return toTsv(cols, dataRows);
		}
	}

	/** 按格式序列化为 Blob（仅用于旧宿主无 fs.saveAs 时的浏览器下载降级）。 */
	function buildExportBlob(kind: ExportKind, cols: string[], dataRows: Record<string, unknown>[]): Blob {
		const target = exportNameParts().tableName || "query_result";
		if (kind === "xlsx") {
			// 零依赖最小 OOXML，工作表名取当前结果表名。
			return new Blob([toXlsx(cols, dataRows, target)], { type: EXPORT_MIME.xlsx });
		}
		return new Blob([serializeText(kind, cols, dataRows, target)], { type: EXPORT_MIME[kind] });
	}

	/** 触发浏览器下载（降级路径）；ObjectURL 延时回收，避免大文件下载尚未开始就被撤销。 */
	function triggerUrlDownload(url: string, filename: string): void {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}

	/** 导出当前页（数据已在内存）：优先宿主原生保存框拿真实路径，旧宿主降级浏览器下载。 */
	async function downloadAs(kind: ExportKind, cols: string[], dataRows: Record<string, unknown>[]): Promise<void> {
		const parts = exportNameParts();
		const target = parts.tableName || "query_result";
		const fileName = buildExportFileName(parts, EXPORT_EXT[kind]);
		try {
			const fsApi = getFs();
			if (fsApi) {
				// saveAs 返回 null = 用户在系统保存框点了取消，不算错误。
				const saved =
					kind === "xlsx"
						? await fsApi.saveAs(fileName, uint8ArrayToBase64(toXlsx(cols, dataRows, target)), "base64")
						: await fsApi.saveAs(fileName, serializeText(kind, cols, dataRows, target), "utf8");
				if (saved === null) return;
				return;
			}
			const blob = buildExportBlob(kind, cols, dataRows);
			triggerUrlDownload(URL.createObjectURL(blob), fileName);
		} catch (error) {
			dispatch({ type: "setError", message: `导出失败：${error instanceof Error ? error.message : String(error)}` });
		}
	}

	/**
	 * 导出全部数据（对齐 dbx 桌面壳「导出全部」）：
	 * - 默认不限制行数（dbx exportRowLimitEnabled 默认 false），按 ENGINE_ROW_CAP 分页循环；
	 *   用户在设置中开启上限后按 exportRowLimit 提前停止并如实标注。
	 * - 文本格式走分块序列化器，边拉边拼，不在浏览器侧堆积全部行；
	 *   XLSX 受文件格式所限必须收集全部行，超大结果集有内存风险。
	 * - 落盘走宿主 ctx.fs.saveAs（原生保存框，返回真实路径，完成态可「打开所在文件夹」）；
	 *   旧宿主没有该 API 时降级浏览器下载。
	 * - 任务全程登记到后台任务 store，可最小化到顶栏、可块间取消。
	 */
	async function exportAllAs(kind: ExportKind): Promise<void> {
		if (!sql || !connectionName) return;
		const parts = exportNameParts();
		const target = parts.tableName || "query_result";
		const fileName = buildExportFileName(parts, EXPORT_EXT[kind]);
		// 服务端总数已知时给确定百分比；未知走滑动动画。
		const knownTotal = isServer && serverTotalCount !== undefined ? serverTotalCount : null;
		const task = addExportTask({ fileName, format: kind, database: parts.database, tableName: parts.tableName, totalRows: knownTotal });
		setDialogTaskId(task.id);

		const token = { cancelled: false };
		exportCancelTokensRef.current.set(task.id, token);
		const unregisterCancel = registerExportCancelHandler(task.id, () => {
			token.cancelled = true;
		});

		try {
			const foundConn = state.connections.find((c) => c.name === connectionName);
			const dbType = typeof foundConn?.db_type === "string" ? foundConn.db_type : undefined;
			// 导出行数上限：仅由 exportRowLimit 控制（当 exportLimitEnabled 开启时）。
			// 对齐 dbx 桌面壳：导出全部默认不限制，可以导出完整数据。
			// queryResultMaxRows 仅用于查询结果展示，不影响导出。
			const rowLimit = settings.exportLimitEnabled ? settings.exportRowLimit : Infinity;
			// 每批取数行数：使用 exportBatchSize，但实际引擎调用受 ENGINE_ROW_CAP 限制。
			// 当 exportBatchSize > ENGINE_ROW_CAP 时，会在循环中分多次请求拼凑。
			const batchSize = settings.exportBatchSize;

			let stream: ChunkedTextExport | null = null;
			let allColumns: string[] = [];
			const xlsxRows: Record<string, unknown>[] = [];
			let total = 0;
			let offset = 0;
			let truncationNote: string | null = null;

			for (;;) {
				if (token.cancelled) {
					updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now() });
					return;
				}
				// 按 batchSize 分批取数，每批内部可能分多次引擎调用（受 ENGINE_ROW_CAP 限制）
				let batchRows: Record<string, unknown>[] = [];
				let batchOffset = offset;
				const batchTarget = rowLimit === Infinity ? batchSize : Math.min(batchSize, Math.max(1, rowLimit - total));
				let lastOutcome: { paged?: boolean; truncated?: boolean } | null = null;
				
				while (batchRows.length < batchTarget) {
					const chunkLimit = Math.min(ENGINE_ROW_CAP, batchTarget - batchRows.length);
					const chunkOutcome = await engineExecuteByName(connectionName, sql, {
						rowLimit: ENGINE_ROW_CAP,
						timeoutMs: 60_000,
						dbType,
						page: { offset: batchOffset, limit: chunkLimit },
					});
					lastOutcome = chunkOutcome;
					if (allColumns.length === 0) {
						allColumns = chunkOutcome.columns;
						if (kind !== "xlsx") {
							stream = createChunkedTextExport(kind, allColumns, { tableName: target, dialect: sqlDialect() });
						}
					}
					batchRows.push(...chunkOutcome.rows);
					batchOffset += chunkOutcome.rows.length;
					
					// 不可分页查询：引擎忽略 page，单次结果最多 ENGINE_ROW_CAP 行
					if (!chunkOutcome.paged) {
						if (chunkOutcome.truncated === true) {
							truncationNote =
								`该 SQL 不支持服务端分页，仅导出引擎单次返回的前 ${total + batchRows.length.toLocaleString()} 行；` +
								"如需完整数据，请在 SQL 中使用 LIMIT / OFFSET 分批导出";
						}
						break;
					}
					// 末页或已达到引擎单次上限
					if (chunkOutcome.rows.length < chunkLimit) break;
				}
				
				total += batchRows.length;
				if (kind === "xlsx") xlsxRows.push(...batchRows);
				else stream?.push(batchRows);
				updateExportTask(task.id, { rowsExported: total });
				offset = batchOffset;
				
				// 不可分页查询已处理
				if (!lastOutcome?.paged) break;
				// 本批取数不足 batchSize，说明已到末页
				if (batchRows.length < batchTarget) break;
				// 已达到用户设置的上限
				if (rowLimit !== Infinity && total >= rowLimit) {
					truncationNote = `已按设置的导出行数上限导出前 ${total.toLocaleString()} 行，可在设置中调整或关闭上限`;
					break;
				}
			}

			if (token.cancelled) {
				updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now() });
				return;
			}

			updateExportTask(task.id, { status: "writing" });
			// 让出一帧，确保「正在写入文件…」状态先上屏（大结果集序列化可能耗时）。
			await new Promise((resolve) => setTimeout(resolve, 0));

			const fsApi = getFs();
			let filePath: string | null = null;
			if (fsApi) {
				const saved =
					kind === "xlsx"
						? await fsApi.saveAs(fileName, uint8ArrayToBase64(toXlsx(allColumns, xlsxRows, target)), "base64")
						: await fsApi.saveAs(fileName, (stream as ChunkedTextExport).content(), "utf8");
				if (saved === null) {
					// 用户在系统保存框点了取消：不落错误，记为已取消并说明原因。
					updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now(), note: "未选择保存位置，已取消导出" });
					return;
				}
				filePath = saved;
			} else {
				// 旧宿主降级：浏览器下载，无法提供真实落盘路径（完成态不显示「打开所在文件夹」）。
				const blob =
					kind === "xlsx"
						? new Blob([toXlsx(allColumns, xlsxRows, target)], { type: EXPORT_MIME.xlsx })
						: new Blob([(stream as ChunkedTextExport).content()], { type: EXPORT_MIME[kind] });
				triggerUrlDownload(URL.createObjectURL(blob), fileName);
			}

			updateExportTask(task.id, {
				status: "done",
				rowsExported: total,
				filePath,
				totalRows: truncationNote ? total : knownTotal ?? total,
				note: truncationNote,
				finishedAt: Date.now(),
			});
			if (truncationNote) dispatch({ type: "setError", message: truncationNote });
		} catch (error) {
			updateExportTask(task.id, {
				status: "error",
				finishedAt: Date.now(),
				errorMessage: `导出失败：${error instanceof Error ? error.message : String(error)}`,
			});
		} finally {
			unregisterCancel();
			exportCancelTokensRef.current.delete(task.id);
		}
	}

	/** 在系统文件管理器中定位导出的文件（经插件自有 host-node 服务，不依赖宿主 shell API）。 */
	async function revealExportFile(path: string): Promise<void> {
		try {
			await engineRevealInFolder(path);
		} catch (error) {
			const message = `打开所在文件夹失败：${error instanceof Error ? error.message : String(error)}`;
			try {
				getUi()?.notify({ message, variant: "error" });
			} catch {
				dispatch({ type: "setError", message });
			}
		}
	}

	const [exportMenu, setExportMenu] = useState<ContextMenuState | null>(null);

	/** 导出格式菜单：左键 / 右键都在按钮上方展开（贴底栏，空间不足时菜单自动上翻）。 */
	function openExportMenu(e: React.MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();
		const items: ContextMenuEntry[] = [
			...EXPORT_FORMATS.map((f) => ({
				type: "item" as const,
				label: `导出当前页 ${f.label}`,
				icon: f.icon,
				onClick: () => void downloadAs(f.kind, colList, rows),
			})),
			{ type: "separator" as const },
			...EXPORT_FORMATS.map((f) => ({
				type: "item" as const,
				label: `导出全部数据 ${f.label}`,
				icon: f.icon,
				// 多个导出可并行（与 dbx 后台任务一致），各自独立进度与取消。
				onClick: () => void exportAllAs(f.kind),
			})),
		];
		setExportMenu({
			x: e.clientX,
			y: e.clientY,
			items,
		});
	}

	if (colList.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 bg-background text-muted-foreground">
				<span className="icon-[lucide--table] h-10 w-10 opacity-30" />
				<p className="text-[12px]">执行查询后显示结果</p>
			</div>
		);
	}

	function defaultWidth(col: string): number {
		return colWidths[col] ?? Math.max(96, Math.min(260, col.length * 9 + 64));
	}

	function startResize(e: React.MouseEvent, col: string): void {
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW = defaultWidth(col);
		function onMove(ev: MouseEvent): void {
			const next = Math.max(48, startW + (ev.clientX - startX));
			setColWidths((prev) => ({ ...prev, [col]: next }));
		}
		function onUp(): void {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		}
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	function openCellMenu(e: React.MouseEvent, col: string, row: Record<string, unknown>): void {
		e.preventDefault();
		e.stopPropagation();
		const value = row[col];
		const cellValue = cellText(value);
		
		// 复制列名
		const copyColumnName = () => void navigator.clipboard.writeText(col).catch(() => {});
		// 按此值筛选：回填 WHERE 输入框、展开双排工具栏并立即重查
		const filterByThisValue = () => {
			const cond = `${col} = '${cellValue.replace(/'/g, "''")}'`;
			setWhereClause(cond);
			setSplitToolbar(true);
			const tabId = activeTabId;
			const base = (sql ?? "").trim();
			if (tabId && base) {
				const wrapped = buildFilteredSql(base, cond, orderByClause.trim());
				if (wrapped) void runTabSql(tabId, wrapped, undefined, { mode: "server" });
			}

		};
		// 复制为不同格式
		const copyAsJson = () => void navigator.clipboard.writeText(JSON.stringify(value, null, 2)).catch(() => {});
		const copyAsSql = () => void navigator.clipboard.writeText(`'${cellValue.replace(/'/g, "''")}'`).catch(() => {});
		
		setMenu({
			x: e.clientX,
			y: e.clientY,
			items: [
				{
					type: "item",
					label: "查看详情",
					icon: "icon-[lucide--maximize-2]",
					onClick: () => setDetail({ column: col, value }),
				},
				{ type: "separator" },
				{
					type: "item",
					label: "复制单元格值",
					icon: "icon-[lucide--copy]",
					onClick: () => void navigator.clipboard.writeText(cellValue).catch(() => {}),
				},
				{
					type: "item",
					label: "复制列名",
					icon: "icon-[lucide--heading]",
					onClick: copyColumnName,
				},
				{
					type: "item",
					label: "复制为 JSON",
					icon: "icon-[lucide--braces]",
					onClick: copyAsJson,
				},
				{
					type: "item",
					label: "复制为 SQL 字面量",
					icon: "icon-[lucide--quote]",
					onClick: copyAsSql,
				},
				{ type: "separator" },
				{
					type: "item",
					label: "复制整行为 TSV",
					icon: "icon-[lucide--clipboard-copy]",
					onClick: () => void navigator.clipboard.writeText(toTsv(colList, [row])).catch(() => {}),
				},
				{
					type: "item",
					label: "复制整行为 JSON",
					icon: "icon-[lucide--braces]",
					onClick: () => void navigator.clipboard.writeText(toJson(colList, [row])).catch(() => {}),
				},
				{ type: "separator" },
				{
					type: "item",
					label: "按此值筛选",
					icon: "icon-[lucide--filter]",
					onClick: filterByThisValue,
				},
				{
					type: "item",
					label: "复制筛选条件",
					icon: "icon-[lucide--equal]",
					onClick: () => void navigator.clipboard.writeText(`${col} = '${cellValue.replace(/'/g, "''")}'`).catch(() => {}),
				},
				{ type: "separator" },
				{
					type: "submenu",
					label: "导出全部",
					icon: "icon-[lucide--download]",
					items: EXPORT_FORMATS.map((f) => ({
						type: "item" as const,
						label: `导出为 ${f.label}`,
						icon: f.icon,
						onClick: () => void exportAllAs(f.kind),
					})),
				},
				{
					type: "submenu",
					label: "复制全部",
					icon: "icon-[lucide--clipboard-list]",
					items: [
						{ type: "item", label: "复制为 TSV", onClick: () => void copyAll() },
						{ type: "item", label: "复制为 JSON", onClick: () => void copyAsJson() },
						{ type: "item", label: "复制为 Markdown", onClick: () => void copyAsMarkdown() },
					],
				},
			],
		});
	}

	return (
		<div ref={gridRootRef} className="relative flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 - 双排布局 */}
			<div className={`dbx-result-toolbar ${splitToolbar ? "split-layout" : "single-layout"}`}>
				{/* 上排：操作按钮 */}
				<div className="dbx-toolbar-row-actions">
					{/* 左侧：复制（导出已移至结果网格底栏） */}
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => void copyAll()}
							title="复制全部为 TSV"
							className="dbx-toolbar-btn"
						>
							<span className="icon-[lucide--clipboard-list] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">复制</span>
						</button>
					</div>

					{/* 中间：视图选项 */}
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => setShowRowNumbers((v) => !v)}
							title="显示/隐藏行号"
							className={`dbx-toolbar-btn ${showRowNumbers ? "dbx-toolbar-btn-active" : ""}`}
						>
							<span className="icon-[lucide--list-ordered] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">行号</span>
						</button>
						{sort && (
							<button
								type="button"
								onClick={() => setSort(null)}
								title="清除排序"
								className="dbx-toolbar-btn"
							>
								<span className="icon-[lucide--arrow-up-down] h-3.5 w-3.5" />
								<span className="dbx-toolbar-btn-label">排序: {sort.col} {sort.dir === "asc" ? "↑" : "↓"}</span>
							</button>
						)}
						{connectionName && parsedTableName && (
							<button
								type="button"
								onClick={openTableInfo}
								title="查看表属性（列、索引、外键等）"
								className={`dbx-toolbar-btn ${tableInfoOpen ? "dbx-toolbar-btn-active" : ""}`}
							>
								<span className="icon-[lucide--table-properties] h-3.5 w-3.5" />
								<span className="dbx-toolbar-btn-label">表属性</span>
							</button>
						)}
						<button
							type="button"
							onClick={() => setSplitToolbar((v) => !v)}
							title={splitToolbar ? "切换为单排工具栏" : "切换为双排工具栏"}
							className={`dbx-toolbar-btn ${splitToolbar ? "dbx-toolbar-btn-active" : ""}`}
						>
							<span className="icon-[lucide--rows-3] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">{splitToolbar ? "单排" : "双排"}</span>
						</button>
					</div>

					{/* 右侧：AI 分析 */}
					<div className="flex items-center gap-0.5 ml-auto">
						{connectionName && sql && (
							<button
								type="button"
								onClick={openAiDialogForQuery}
								title="把该 SQL 与结果发给 AI 分析"
								className="dbx-toolbar-btn dbx-toolbar-btn-primary"
							>
								<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
								<span className="dbx-toolbar-btn-label">分析结果</span>
							</button>
						)}
					</div>
				</div>

				{/* 下排：过滤控件（仅双排模式显示） */}
				{splitToolbar && (
					<div className="dbx-toolbar-row-filters">
						<div className="flex items-center gap-2 flex-1">
							<span className="icon-[lucide--filter] h-3.5 w-3.5 text-muted-foreground" />
							<input
								type="text"
								className="dbx-toolbar-filter-input"
								placeholder="WHERE 条件（如：id > 10 AND name LIKE '%test%'）"
								value={whereClause}
								onChange={(e) => setWhereClause(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") applyFilterSort();
								}}
							/>
						</div>
						<div className="flex items-center gap-2 flex-1">
							<span className="icon-[lucide--arrow-up-down] h-3.5 w-3.5 text-muted-foreground" />
							<input
								type="text"
								className="dbx-toolbar-filter-input"
								placeholder="ORDER BY（如：created_at DESC, id ASC）"
								value={orderByClause}
								onChange={(e) => setOrderByClause(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") applyFilterSort();
								}}
							/>
						</div>
						<button
							type="button"
							onClick={applyFilterSort}
							className="dbx-toolbar-btn dbx-toolbar-btn-primary"
							title="按以上条件重新查询"
						>
							<span className="icon-[lucide--play] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">应用</span>
						</button>
					</div>
				)}
			</div>

			{/* 网格（内部滚动） */}
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto relative">
				{/* 取数状态：翻页 / 改每页行数都走这里，给出进度、目标与中止入口。 */}
				{pageLoading && (
					<div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
						<div className="flex items-center gap-3 rounded-md border border-border bg-popover px-3 py-2 shadow-md">
							<span className="icon-[lucide--loader-2] h-4 w-4 animate-spin text-warning" />
							<span className="text-[11px] text-foreground/80">
								{isServer ? "取数中" : "加载中"}
								<span className="ml-1 font-mono text-muted-foreground">
									第 {safePage + 1} 页 · 每页 {pageSize} 行
								</span>
							</span>
							{onCancelLoading ? (
								<button
									type="button"
									onClick={onCancelLoading}
									className="rounded bg-destructive/90 px-2 py-0.5 text-[10px] font-medium text-destructive-foreground hover:bg-destructive"
								>
									停止
								</button>
							) : null}
						</div>
					</div>
				)}
				<table className="border-separate border-spacing-0 text-[12px] w-full" style={{ minWidth: "100%" }}>
					<thead>
						<tr>
							{showRowNumbers && (
								<th className="sticky left-0 z-20 w-10 min-w-10 border-b border-r border-border px-1 py-2 text-center text-[10px] font-semibold text-muted-foreground" style={{ backgroundColor: "var(--dbx-surface-2)" }}>
									#
								</th>
							)}
							{colList.map((c, i) => (
								<th
									key={c}
									className="relative border-b border-r border-border px-3 py-2 text-left font-semibold text-[10.5px] text-muted-foreground"
									style={{ backgroundColor: "var(--dbx-surface-2)", width: defaultWidth(c), minWidth: defaultWidth(c) }}
								>
									<div className="flex items-center gap-1">
									<span
										className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1 truncate hover:text-foreground"
										title={`按 ${c} 排序`}
										onClick={() => toggleSort(c)}
									>
										<span className="min-w-0 flex-1 truncate">{c}</span>
										{sort?.col === c ? (
											<span className={`h-2.5 w-2.5 shrink-0 text-foreground ${sort.dir === "asc" ? "icon-[lucide--arrow-up]" : "icon-[lucide--arrow-down]"}`} />
										) : null}
									</span>
									<span className="shrink-0 text-[9px] text-muted-foreground/70">{i + 1}</span>
								</div>
									<span
										onMouseDown={(e) => startResize(e, c)}
										className="absolute right-[-2px] top-0 h-full w-1.5 cursor-col-resize hover:bg-foreground/40"
									/>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{pagedRows.length === 0 ? (
							<tr>
								<td
									colSpan={colList.length + (showRowNumbers ? 1 : 0)}
									className="py-10 text-center text-[12px] text-muted-foreground"
								>
									该页无数据
								</td>
							</tr>
						) : (
							pagedRows.map((row, rowIdx) => {
								const globalIdx = safePage * pageSize + rowIdx + 1;
								return (
									<tr key={`${safePage}-${rowIdx}`} className={`hover:bg-[var(--dbx-hover)] ${settings.dataGridStripedRows && rowIdx % 2 === 1 ? "bg-[var(--dbx-surface)]" : ""}`}>
										{showRowNumbers && (
											<td className="sticky left-0 z-10 w-10 min-w-10 border-r border-border px-1 py-1.5 text-center font-mono text-[10px] text-muted-foreground" style={{ backgroundColor: "var(--dbx-surface)" }}>
												{globalIdx}
											</td>
										)}
										{colList.map((c) => {
											const isEditing = editingCell?.row === rowIdx && editingCell?.col === c;
											const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === c;
											return (
												<td
													key={c}
													className={`max-w-0 border-b border-r border-border/60 px-3 py-1.5 text-foreground/80 ${isEditing ? "" : "truncate"} ${isSelected ? "bg-[var(--dbx-hover)]" : ""}`}
													style={{ maxWidth: defaultWidth(c) }}
													title={!isEditing ? cellText(row[c]) : undefined}
													onClick={() => setSelectedCell({ row: rowIdx, col: c })}
													onDoubleClick={() => handleCellDoubleClick(rowIdx, c, row[c])}
													onContextMenu={(e) => openCellMenu(e, c, row)}
												>
													{isEditing ? (
														<CellEditor
															value={editValue}
															column={c}
															onCommit={commitCellEdit}
															onCancel={cancelCellEdit}
														/>
													) : (
														<CellDisplay value={row[c]} />
													)}
												</td>
											);
										})}
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* 分页栏（固定底部，不随网格滚动）；上分割线用 .dbx-pagination，
			    与侧边栏竖线及桌面壳分割线对齐。
			    布局：左侧元信息 min-w-0 可截断，右侧操作区 shrink-0 永不被遮挡。 */}
			<div className="dbx-pagination flex h-7 shrink-0 items-center gap-2 px-3 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="shrink-0">
						{totalKnown ? "共 " : "已取回 "}
						<span className="font-medium text-foreground/80">{displayTotal}</span> 行
					</span>
					{isServer && (
					<button
						type="button"
						onClick={refreshTotalCount}
						disabled={pageLoading === true || totalCounting}
						title={totalCounting ? "正在统计总行数…" : "刷新总计行统计"}
						className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-60"
					>
						<span
							className={
								totalCounting
									? "icon-[lucide--loader-2] h-3 w-3 animate-spin"
									: "icon-[lucide--refresh-cw] h-3 w-3"
							}
						/>
					</button>
				)}
				{note ? (
					<span
						className="min-w-0 truncate rounded bg-amber-500/10 px-1.5 text-[10px] text-amber-500"
						title={note}
					>
						{note}
					</span>
				) : null}
				{totalCounting ? (
					<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80">
						总数统计中
					</span>
				) : null}
				{isServer && serverTotalStatus === "failed" ? (
					<span
						className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80"
						title="统计总行数失败（如 COUNT 超时），不影响翻页；点左侧刷新按钮可重试"
					>
						总数未知
					</span>
				) : null}
				{pageLoading ? <span className="shrink-0 text-[10px] text-muted-foreground">取数中…</span> : null}
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<PageSizeMenu
						pageSize={pageSize}
						options={[...new Set<number>([...PAGE_SIZE_OPTIONS, pageSize])].sort((a, b) => a - b)}
						defaultPageSize={defaultPageSize}
						disabled={pageLoading === true}
						onApply={changePageSize}
						onSetDefault={(n) => onSetDefaultPageSize?.(n)}
					/>
					<span className="text-muted-foreground/70">
						{pagedRows.length === 0 ? 0 : safePage * pageSize + 1}–
						{safePage * pageSize + pagedRows.length}
					</span>
					<span className="text-muted-foreground/60">/</span>
					<span className="text-muted-foreground/70">{totalKnown ? displayTotal : "?"}</span>
					<div className="mx-2 h-3 w-px bg-[var(--dbx-surface-2)]" />
					<button
						type="button"
						onClick={() => goToPage(0)}
						disabled={safePage === 0 || pageLoading === true}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="第一页"
					>
						<span className="icon-[lucide--chevrons-left] h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={() => goToPage(safePage - 1)}
						disabled={safePage === 0 || pageLoading === true}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="上一页"
					>
						<span className="icon-[lucide--chevron-left] h-3 w-3" />
					</button>
					{/* 页码跳转：对齐 dbx，输入正整数后 Enter / 失焦跳转到该页。 */}
					<input
						value={pageInput}
						onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/gu, "").slice(0, 9))}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								commitPageInput();
								e.currentTarget.blur();
							}
						}}
						onBlur={commitPageInput}
						inputMode="numeric"
						aria-label="跳转页码"
						disabled={pageLoading === true}
						className="h-5 w-10 rounded border border-[var(--dbx-surface-2)] bg-transparent px-1 text-center text-[10px] text-foreground/80 outline-none focus:border-primary disabled:opacity-30"
					/>
					{totalKnown && totalPages !== null ? (
						<span className="text-muted-foreground/70">/ {totalPages}</span>
					) : null}
					<button
						type="button"
						onClick={() => goToPage(safePage + 1)}
						disabled={!hasNextPage || pageLoading === true}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="下一页"
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</button>
				<button
					type="button"
					onClick={() => totalPages !== null && goToPage(totalPages - 1)}
					disabled={totalPages === null || !hasNextPage || pageLoading === true}
					className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
					title={totalPages === null ? "总数未知（统计中或统计失败），暂不能跳末页" : "最后一页"}
				>
					<span className="icon-[lucide--chevrons-right] h-3 w-3" />
				</button>
					<div className="mx-2 h-3 w-px bg-[var(--dbx-surface-2)]" />
					{/* 导出：左键 / 右键均弹格式菜单 */}
					<button
						type="button"
						onClick={openExportMenu}
						onContextMenu={openExportMenu}
						title="导出结果（CSV / Excel / JSON / Markdown / HTML / SQL / TXT）"
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
					>
						<span className="icon-[lucide--download] h-3.5 w-3.5" />
					</button>
				</div>
			</div>

			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
			{exportMenu && <ContextMenu menu={exportMenu} onClose={() => setExportMenu(null)} />}
			{detail && <CellDetailDialog detail={detail} onClose={() => setDetail(null)} />}
			<SendToAiDialog open={aiDialogOpen} prompt={aiPrompt} onClose={() => setAiDialogOpen(false)} />
			{dialogTask && (
				<ExportProgressDialog
					task={dialogTask}
					onMinimize={() => setDialogTaskId(null)}
					onClose={() => setDialogTaskId(null)}
					onCancel={() => requestCancelExportTask(dialogTask.id)}
					onReveal={(filePath) => void revealExportFile(filePath)}
				/>
			)}

			{/* 表属性面板 - 相对于结果网格容器定位 */}
			{tableInfoOpen && tableInfoSelection && (
				<div 
					className="absolute inset-0 z-[200] flex"
					onClick={() => setTableInfoOpen(false)}
				>
					<div 
						className="ml-auto h-full w-[400px] max-w-[50%] bg-background border-l border-border shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<TableInfoPanel 
							selection={tableInfoSelection} 
							onClose={() => setTableInfoOpen(false)} 
						/>
					</div>
				</div>
			)}
		</div>
	);
}
