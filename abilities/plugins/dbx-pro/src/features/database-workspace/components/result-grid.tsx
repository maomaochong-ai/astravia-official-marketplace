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
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";
import { cellText, toTsv, toCsv, toJson, toJsonLines, toMarkdown, toHtml, toSqlInsert } from "../services/result-export";
import { toXlsx } from "../services/xlsx-export";
import { CellDisplay } from "./cell-display";
import { CellEditor } from "./cell-editor";
import { TableInfoPanel, type TableInfoSelection } from "./table-info-panel";
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
	/** 服务端分页的总行数；undefined = 尚未统计。 */
	serverTotalCount?: number;
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
	pageLoading,
	note,
	onPageChange,
	onPageSizeChange,
	onSetDefaultPageSize,
	onRefreshTotalCount,
}: Props): JSX.Element {
	const isServer = serverPaged === true;
	const [localPage, setLocalPage] = useState(0);
	const [localPageSize, setLocalPageSize] = useState(() => resolvePageSize(defaultPageSize));
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
	const [customPageSize, setCustomPageSize] = useState<string>(""); // 自定义每页行数输入
	const [showCustomSizeInput, setShowCustomSizeInput] = useState(false); // 是否显示自定义输入框

	// 尝试从 SQL 中解析表名（用于表属性按钮）
	const { state, runTabSql } = useWorkbench();
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
			alert("过滤 / 排序仅支持单条 SELECT / WITH 查询");
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
			// 如果没有解析出表名，显示提示
			alert("无法从 SQL 中解析表名，请确保 SQL 包含 FROM 子句");
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
		// TODO: 检查是否可编辑（根据列类型、权限等）
		startCellEdit(rowIndex, col, value);
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
		? resolvePageSize(serverPageSize ?? defaultPageSize)
		: localPageSize;

	// 总页数：服务端总数未统计时为 null（不假装知道）。
	const totalPages = useMemo(() => {
		if (isServer) {
			return serverTotalCount !== undefined
				? Math.max(1, Math.ceil(serverTotalCount / pageSize))
				: null;
		}
		return Math.max(1, Math.ceil(rows.length / pageSize));
	}, [isServer, serverTotalCount, rows.length, pageSize]);

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

	const totalKnown = !isServer || serverTotalCount !== undefined;
	const displayTotal = isServer
		? serverTotalCount ?? safePage * pageSize + rows.length
		: rows.length;

	// 翻页 / 改每页行数：网格内部滚动回到顶部。
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = 0;
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

	/** 页大小变化：服务端交上层并回第 0 页；本地重置。 */
	function changePageSize(next: number): void {
		const size = resolvePageSize(next);
		if (isServer) onPageSizeChange?.(size);
		else {
			setLocalPageSize(size);
			setLocalPage(0);
		}
	}

	/** 应用自定义行数（仅本次）。 */
	function applyCustomPageSize(): void {
		const val = Number.parseInt(customPageSize, 10);
		if (!Number.isFinite(val) || val < 1) return;
		const size = resolvePageSize(val);
		if (isServer) onPageSizeChange?.(size);
		else {
			setLocalPageSize(size);
			setLocalPage(0);
		}
		setShowCustomSizeInput(false);
		setCustomPageSize("");
	}

	/** 设为默认行数：更新工作台设置。 */
	function setAsDefaultPageSize(): void {
		const val = Number.parseInt(customPageSize, 10);
		if (!Number.isFinite(val) || val < 1) return;
		const size = resolvePageSize(val);
		// 通过回调通知上层更新设置
		onSetDefaultPageSize?.(size);
		setShowCustomSizeInput(false);
		setCustomPageSize("");
	}

	/** 刷新总计行统计。 */
	function refreshTotalCount(): void {
		if (!isServer || !sql || !connectionName) return;
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

	function downloadBlob(blob: Blob, filename: string): void {
		try {
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.style.display = "none";
			document.body.appendChild(anchor);
			anchor.click();
			setTimeout(() => {
				document.body.removeChild(anchor);
				URL.revokeObjectURL(url);
			}, 100);
		} catch (error) {
			alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function downloadFile(content: string, filename: string, mimeType: string): void {
		downloadBlob(new Blob([content], { type: mimeType }), filename);
	}

	const exportCsv = useCallback(() => {
		downloadFile(toCsv(colList, rows), "query-result.csv", "text/csv;charset=utf-8");
	}, [colList, rows]);

	const exportXlsx = useCallback(() => {
		// 对齐 dbx：Excel 导出。零依赖最小 OOXML，工作表名取当前结果表名。
		const target = tableInfoSelection?.tableName || "query_result";
		downloadBlob(
			new Blob([toXlsx(colList, rows, target)], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"query-result.xlsx",
		);
	}, [colList, rows, tableInfoSelection?.tableName]);

	const exportTxt = useCallback(() => {
		// TXT：制表符分隔的纯文本，可直接粘贴进 Excel。
		downloadFile(toTsv(colList, rows), "query-result.txt", "text/plain;charset=utf-8");
	}, [colList, rows]);

	const exportJson = useCallback(() => {
		downloadFile(toJson(colList, rows), "query-result.json", "application/json");
	}, [colList, rows]);

	const exportJsonLines = useCallback(() => {
		downloadFile(toJsonLines(colList, rows), "query-result.jsonl", "application/x-ndjson");
	}, [colList, rows]);

	const exportMarkdown = useCallback(() => {
		downloadFile(toMarkdown(colList, rows), "query-result.md", "text/markdown");
	}, [colList, rows]);

	const exportHtml = useCallback(() => {
		downloadFile(toHtml(colList, rows), "query-result.html", "text/html");
	}, [colList, rows]);

	const exportSql = useCallback(() => {
		// 对齐 dbx：导出为 INSERT 语句。表名取当前结果对应的表（表属性打开来源），
		// 取不到则用 query_result；方言按连接类型选 MySQL 反引号或标准标识符。
		const dbType = (state.connections.find((c) => c.name === connectionName)?.db_type ?? "").toLowerCase();
		const dialect = /mysql|maria|tidb|starrocks|doris|goldendb|databend/.test(dbType) ? "mysql" : "standard";
		const target = tableInfoSelection?.tableName || "query_result";
		downloadFile(toSqlInsert(colList, rows, target, dialect), "query-result.sql", "application/sql;charset=utf-8");
	}, [colList, rows, state.connections, connectionName, tableInfoSelection?.tableName]);

	const [exportMenu, setExportMenu] = useState<ContextMenuState | null>(null);

	/** 导出格式菜单：左键 / 右键都在按钮上方展开（贴底栏，空间不足时菜单自动上翻）。 */
	function openExportMenu(e: React.MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();
		setExportMenu({
			x: e.clientX,
			y: e.clientY,
			items: [
				{ type: "item", label: "导出 CSV", icon: "icon-[lucide--file-spreadsheet]", onClick: exportCsv },
				{ type: "item", label: "导出 Excel（XLSX）", icon: "icon-[lucide--sheet]", onClick: exportXlsx },
				{ type: "item", label: "导出 JSON", icon: "icon-[lucide--file-json]", onClick: exportJson },
				{ type: "item", label: "导出 JSON Lines", icon: "icon-[lucide--file-code]", onClick: exportJsonLines },
				{ type: "item", label: "导出 Markdown", icon: "icon-[lucide--file-text]", onClick: exportMarkdown },
				{ type: "item", label: "导出 HTML", icon: "icon-[lucide--file-code-2]", onClick: exportHtml },
				{ type: "item", label: "导出 SQL（INSERT）", icon: "icon-[lucide--file-terminal]", onClick: exportSql },
				{ type: "item", label: "导出 TXT", icon: "icon-[lucide--file-text]", onClick: exportTxt },
			],
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
					items: [
						{ type: "item", label: "导出为 CSV", icon: "icon-[lucide--file-spreadsheet]", onClick: () => exportCsv() },
						{ type: "item", label: "导出为 Excel（XLSX）", icon: "icon-[lucide--sheet]", onClick: () => exportXlsx() },
						{ type: "item", label: "导出为 JSON", icon: "icon-[lucide--file-json]", onClick: () => exportJson() },
						{ type: "item", label: "导出为 JSON Lines", icon: "icon-[lucide--file-code]", onClick: () => exportJsonLines() },
						{ type: "item", label: "导出为 Markdown", icon: "icon-[lucide--file-text]", onClick: () => exportMarkdown() },
						{ type: "item", label: "导出为 HTML", icon: "icon-[lucide--file-code-2]", onClick: () => exportHtml() },
						{ type: "item", label: "导出为 SQL（INSERT）", icon: "icon-[lucide--file-terminal]", onClick: () => exportSql() },
						{ type: "item", label: "导出为 TXT", icon: "icon-[lucide--file-text]", onClick: () => exportTxt() },
					],
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
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
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
									<tr key={`${safePage}-${rowIdx}`} className="hover:bg-[var(--dbx-hover)]">
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
					{isServer && totalKnown && (
						<button
							type="button"
							onClick={refreshTotalCount}
							disabled={pageLoading === true}
							title="刷新总计行统计"
							className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						>
							<span className="icon-[lucide--refresh-cw] h-3 w-3" />
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
					{isServer && !totalKnown ? (
						<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80">
							总数统计中
						</span>
					) : null}
					{pageLoading ? <span className="shrink-0 text-[10px] text-muted-foreground">取数中…</span> : null}
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<label className="flex items-center gap-1">
						<span className="text-muted-foreground/60">每页</span>
						<select
							value={PAGE_SIZE_OPTIONS.includes(pageSize as typeof PAGE_SIZE_OPTIONS[number]) ? pageSize : "custom"}
							onChange={(e) => {
								const val = e.target.value;
								if (val === "custom") {
									setShowCustomSizeInput(true);
								} else {
									changePageSize(Number(val));
								}
							}}
							className="h-5 rounded border border-border bg-background px-1 text-[10px] text-foreground/80"
						>
							{PAGE_SIZE_OPTIONS.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
							<option value="custom">自定义</option>
						</select>
					</label>
					{showCustomSizeInput && (
						<div className="flex items-center gap-1">
							<input
								type="number"
								min="1"
								max={ENGINE_ROW_CAP}
								value={customPageSize}
								onChange={(e) => setCustomPageSize(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") applyCustomPageSize();
									else if (e.key === "Escape") {
										setShowCustomSizeInput(false);
										setCustomPageSize("");
									}
								}}
								placeholder={`1-${ENGINE_ROW_CAP}`}
								className="h-5 w-16 rounded border border-border bg-background px-1 text-[10px] text-foreground/80"
								autoFocus
							/>
							<button
								type="button"
								onClick={applyCustomPageSize}
								title="仅本次使用"
								className="h-5 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-foreground/80 hover:bg-[var(--dbx-hover)]"
							>
								应用
							</button>
							<button
								type="button"
								onClick={setAsDefaultPageSize}
								title="设为默认每页行数"
								className="h-5 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-foreground/80 hover:bg-[var(--dbx-hover)]"
							>
								设为默认
							</button>
						</div>
					)}
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
					<span className="rounded bg-[var(--dbx-surface-2)] px-1.5 py-0.5 text-[10px] text-foreground/80">
						{safePage + 1}
						{totalKnown && totalPages !== null ? ` / ${totalPages}` : ""}
					</span>
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
						disabled={!totalKnown || totalPages === null || !hasNextPage || pageLoading === true}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="最后一页"
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
