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
import {
	cellText,
	toTsv,
	toCsv,
	toJson,
	toJsonLines,
	toMarkdown,
	toHtml,
	toSqlInsert,
	type ChunkedTextExport,
	type TextExportKind,
} from "../services/result-export";
import { runExportAll } from "../services/export-all-runner";
import { toXlsx } from "../services/xlsx-export";
import { buildExportFileName } from "../services/export-file-name";
import {
	releaseExportPayload,
	stageExportPayload,
	addExportTask,
	updateExportTask,
	registerExportCancelHandler,
	requestCancelExportTask,
	useExportTasks,
} from "../state/export-tasks-store";
import { getFs, getUi } from "../../../runtime-contract";
import { ResultTable } from "./result-table";
import { ResultToolbar } from "./result-toolbar";
import { TableInfoPanel, type TableInfoSelection } from "./table-info-panel";
import { PageSizeMenu } from "./page-size-menu";
import { ExportProgressDialog } from "./export-progress-dialog";
import { CONTENT_KEPT_NOTE, discardStagedExport, saveStagedExport } from "../services/export-save";
import { useWorkbench } from "../hooks/use-workbench";
import { buildFilteredSql } from "../services/query-filter";

interface Props {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	/** 产生该结果的连接 / SQL：「导出全部数据」重跑查询与筛选 SQL 都基于它。 */
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
	/** 查询执行耗时（ms）。来自 result.elapsedMs。 */
	elapsedMs?: number;
	/** 写 / DDL 的影响行数；SELECT 为 null。来自 result.affectedRows。 */
	affectedRows?: number | null;
	/** 刷新按钮回调：重新执行当前 SQL 并回到第一页。 */
	onRefresh?: () => void;
	/** 加载全部按钮回调：循环拉取所有页直到末页。 */
	onLoadAll?: () => void;
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
	totalRows: _totalRows,
	connectionName,
	sql,
	serverPaged,
	serverPage,
	serverPageSize,
	defaultPageSize,
	serverTotalCount,
	serverTotalStatus,
	pageLoading,
	elapsedMs,
	affectedRows,
	onRefresh,
	onLoadAll,
	note: _note,
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
	const [tableInfoOpen, setTableInfoOpen] = useState(false);
	const [tableInfoSelection, setTableInfoSelection] = useState<TableInfoSelection | null>(null);
	const [splitToolbar, setSplitToolbar] = useState(false); // 双排工具栏开关
	const [whereClause, setWhereClause] = useState(""); // WHERE 条件
	const [orderByClause, setOrderByClause] = useState(""); // ORDER BY 条件
	const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null); // 当前选中的单元格（用于导航）
	// 列导航 Popover：搜索过滤 + 点击列名横向滚动到该列
	const [navOpen, setNavOpen] = useState(false);
	const [navFilter, setNavFilter] = useState("");
	const navPopoverRef = useRef<HTMLDivElement | null>(null);
	// 加载全部状态（底栏按钮触发，循环拉取直到末页）
	const [loadAllActive, setLoadAllActive] = useState(false);
	const [columnMenu, setColumnMenu] = useState<ContextMenuState | null>(null);
	// 当前在模态中展示的后台导出任务 id（最小化后置 null，任务仍在顶栏后台任务里）。
	const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
	const exportCancelTokensRef = useRef<Map<string, { cancelled: boolean }>>(new Map());
	/** 导出任务 → 发起时所在结果集的 SQL：用于判断服务端总数是否属于同一次查询。 */
	const exportSqlRef = useRef<Map<string, string>>(new Map());
	/** 最近一次渲染看到的服务端总数：导出收尾时优先用它，避免用开始时的过期快照。 */
	const latestKnownTotalRef = useRef<number | null>(null);
	latestKnownTotalRef.current = isServer && serverTotalCount !== undefined ? serverTotalCount : null;
	const exportTasks = useExportTasks();
	const dialogTask = dialogTaskId ? (exportTasks.find((t) => t.id === dialogTaskId) ?? null) : null;

	/**
	 * 服务端总数是**执行完之后**第二趟统计的，导出往往赶在它回来之前就开始：
	 * 任务以「总数未知」起步，进度条只能走滑动动画、永远不给百分比 ——
	 * 用户看到的「进度条不跟随进度」多半就是这个。
	 * 总数落定后回填任务；只回填仍在跑、且 SQL 未被换掉的任务，
	 * 避免把另一个查询的总数灌进正在运行的导出。
	 */
	useEffect(() => {
		if (!dialogTaskId) return;
		// 统计失败（totalCountStatus=failed）时总数就是未知，不能假装有总数。
		if (serverTotalStatus !== undefined) return;
		if (typeof serverTotalCount !== "number" || serverTotalCount <= 0) return;
		if (exportSqlRef.current.get(dialogTaskId) !== sql) return;
		const task = exportTasks.find((t) => t.id === dialogTaskId);
		if (!task || task.totalRows === serverTotalCount) return;
		if (task.status !== "running" && task.status !== "writing") return;
		updateExportTask(dialogTaskId, { totalRows: serverTotalCount });
	}, [dialogTaskId, serverTotalCount, serverTotalStatus, sql, exportTasks]);

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

			// 方向键导航
			if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedCell) {
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
	}, [selectedCell, rows]);

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

	// 列导航 click-outside：点外部关闭，避免 onBlur 竞态
	useEffect(() => {
		if (!navOpen) return;
		function handleClickOutside(e: MouseEvent): void {
			const el = navPopoverRef.current;
			if (el && !el.contains(e.target as Node)) {
				setNavOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [navOpen]);


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

	// ─── 刷新 / 加载全部 / 列导航 / 列头右键菜单 ────────────

	/** 格式化执行耗时：ms → "123ms" 或 "1.2s"。 */
	function formatDuration(ms: number): string {
		if (ms < 1_000) return `${ms}ms`;
		if (ms < 60_000) return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)}s`;
		return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
	}

	/** 刷新按钮 handler。 */
	function handleRefresh(): void {
		if (pageLoading) return;
		onRefresh?.();
	}

	/** 列导航：点击列名后横向滚动到该列。 */
	function scrollToColumn(col: string): void {
		const headerCell = scrollRef.current?.querySelector(
			`th[data-col="${CSS.escape(col)}"]`,
		) as HTMLElement | null;
		if (headerCell) {
			headerCell.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
		}
		setNavOpen(false);
		setNavFilter("");
	}

	/** 加载全部：循环调用 onLoadAll。 */
	function handleLoadAll(): void {
		if (pageLoading || loadAllActive) return;
		setLoadAllActive(true);
		onLoadAll?.();
		// 加载完成后由外部回调重置；此处先置位让按钮变 loading 态。
	}

	/** 列头右键菜单：复制列名、复制全部列名、数据库端/当前页排序、过滤子菜单。 */
	function openColumnMenu(e: React.MouseEvent, col: string): void {
		e.preventDefault();
		e.stopPropagation();
		const items: ContextMenuEntry[] = [
			{
				type: "item",
				label: "复制列名",
				icon: "icon-[lucide--copy]",
				onClick: () => void navigator.clipboard.writeText(col).catch(() => {}),
			},
			{
				type: "item",
				label: "复制所有列名",
				icon: "icon-[lucide--copy]",
				onClick: () => void navigator.clipboard.writeText(colList.join(", ")).catch(() => {}),
			},
			{ type: "separator" },
			{
				type: "item",
				label: "数据库端升序排序",
				icon: "icon-[lucide--database]",
				onClick: () => {
					// 服务端排序：用 ORDER BY 重跑 SQL
					const tabId = activeTabId;
					const base = (sql ?? "").trim();
					if (!tabId || !base) return;
					const wrapped = buildFilteredSql(base, whereClause.trim(), `${col} ASC`);
					if (wrapped) void runTabSql(tabId, wrapped, undefined, { mode: "server" });
				},
			},
			{
				type: "item",
				label: "数据库端降序排序",
				icon: "icon-[lucide--database]",
				onClick: () => {
					const tabId = activeTabId;
					const base = (sql ?? "").trim();
					if (!tabId || !base) return;
					const wrapped = buildFilteredSql(base, whereClause.trim(), `${col} DESC`);
					if (wrapped) void runTabSql(tabId, wrapped, undefined, { mode: "server" });
				},
			},
			{ type: "separator" },
			{
				type: "item",
				label: "当前页升序排序",
				icon: "icon-[lucide--arrow-up]",
				onClick: () => {
					setLocalPage(0);
					setSort({ col, dir: "asc" });
				},
			},
			{
				type: "item",
				label: "当前页降序排序",
				icon: "icon-[lucide--arrow-down]",
				onClick: () => {
					setLocalPage(0);
					setSort({ col, dir: "desc" });
				},
			},
			{
				type: "item",
				label: "清除排序",
				icon: "icon-[lucide--eraser]",
				disabled: !sort,
				onClick: () => setSort(null),
			},
			{ type: "separator" },
			{
				type: "submenu",
				label: "按此列过滤",
				icon: "icon-[lucide--filter]",
				items: [
					{
						type: "item",
						label: `= ...`,
						onClick: () => {
							setWhereClause(`${col} = `);
							setSplitToolbar(true);
						},
					},
					{
						type: "item",
						label: `!= ...`,
						onClick: () => {
							setWhereClause(`${col} != `);
							setSplitToolbar(true);
						},
					},
					{
						type: "item",
						label: `包含 ...`,
						onClick: () => {
							setWhereClause(`${col} LIKE '%' || '' || '%'`);
							setSplitToolbar(true);
						},
					},
					{
						type: "item",
						label: `为空`,
						onClick: () => {
							setWhereClause(`${col} IS NULL`);
							setSplitToolbar(true);
							void applyFilterSort();
						},
					},
					{
						type: "item",
						label: `不为空`,
						onClick: () => {
							setWhereClause(`${col} IS NOT NULL`);
							setSplitToolbar(true);
							void applyFilterSort();
						},
					},
				],
			},
		];
		setColumnMenu({ x: e.clientX, y: e.clientY, items });
	}

	/** 处理单元格双击 → 弹出单元格详情对话框（长文本/JSON 查看）。
	 * 可编辑网格暂不支持：插件当前为 read-only SQL 查询模式，无 writable grid 架构。 */
	function handleCellDoubleClick(_rowIndex: number, col: string, value: unknown): void {
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
	/** 已从数据库取回的行数：当前页末行的绝对行号，与「共 N 行」相互独立。 */
	const takenRows = safePage * pageSize + rows.length;

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
	 * - 内容组好后先进导出暂存，再交给宿主 ctx.fs.saveAs（原生保存框，返回真实路径，
	 *   完成态可「打开所在文件夹」）：用户取消保存时内容仍在，任务落到「未保存」，
	 *   可在弹窗或顶栏重新保存 / 明确放弃，不会出现「导出完了但找不到文件」；
	 *   旧宿主没有该 API 时降级浏览器下载，数据不丢。
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
		exportSqlRef.current.set(task.id, sql);

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
			// 每批取行数：使用 exportBatchSize，引擎单次上限由 runner 内部再分块。
			const batchSize = settings.exportBatchSize;

			const outcome = await runExportAll({
				kind,
				tableName: target,
				dialect: sqlDialect(),
				rowLimit,
				batchSize,
				knownTotal,
				token,
				onProgress: (rowsExported) => updateExportTask(task.id, { rowsExported }),
				fetchPage: ({ offset, limit }) =>
					engineExecuteByName(connectionName, sql, {
						rowLimit: ENGINE_ROW_CAP,
						timeoutMs: 60_000,
						dbType,
						page: { offset, limit },
					}),
			});

			if (outcome.cancelled) {
				updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now() });
				return;
			}

			const { columns: allColumns, xlsxRows, stream, total, truncationNote } = outcome;

			updateExportTask(task.id, { status: "writing" });
			// 让出一帧，确保「正在写入文件…」状态先上屏（大结果集序列化可能耗时）。
			await new Promise((resolve) => setTimeout(resolve, 0));
			// 「正在写入」阶段仍可取消：直接落取消态，不产生文件。
			if (token.cancelled) {
				updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now() });
				return;
			}

			const fsApi = getFs();
			let filePath: string | null = null;
			// 组包只做一次：降级下载复用同一份内容，不必在 base64 与字节数组之间来回转。
			const xlsxBytes = kind === "xlsx" ? toXlsx(allColumns, xlsxRows, target) : null;
			const textContent = kind === "xlsx" ? null : (stream as ChunkedTextExport).content();
			const downloadFallback = (): void => {
				const blob = xlsxBytes
					? new Blob([xlsxBytes], { type: EXPORT_MIME.xlsx })
					: new Blob([textContent as string], { type: EXPORT_MIME[kind] });
				triggerUrlDownload(URL.createObjectURL(blob), fileName);
			};
			if (fsApi) {
				// 内容先入暂存：保存框被取消也不丢数据，任务落到 unsaved，可重开保存框。
				stageExportPayload(task.id, {
					fileName,
					encoding: kind === "xlsx" ? "base64" : "utf8",
					content: xlsxBytes ? uint8ArrayToBase64(xlsxBytes) : (textContent as string),
				});
				const saveResult = await saveStagedExport(task.id);
				if (saveResult.outcome === "unsaved" || saveResult.outcome === "error") {
					// 内容已取全、只是没落盘：行数、总数与截断提示也要落账，这条记录才算完整。
					updateExportTask(task.id, {
						rowsExported: total,
						totalRows: truncationNote ? total : knownTotal ?? latestKnownTotalRef.current ?? total,
						note: truncationNote ? CONTENT_KEPT_NOTE + "；" + truncationNote : CONTENT_KEPT_NOTE,
					});
					if (truncationNote) dispatch({ type: "setError", message: truncationNote });
					return;
				}
				if (saveResult.outcome === "saved") {
					filePath = saveResult.filePath;
				} else {
					// 宿主能力在落盘前丢失：退回浏览器下载，数据不丢。
					releaseExportPayload(task.id);
					downloadFallback();
				}
			} else {
				// 旧宿主降级：浏览器下载，无法提供真实落盘路径（完成态不显示「打开所在文件夹」）。
				downloadFallback();
			}

			updateExportTask(task.id, {
				status: "done",
				rowsExported: total,
				filePath,
				totalRows: truncationNote ? total : knownTotal ?? latestKnownTotalRef.current ?? total,
				note: truncationNote,
				finishedAt: Date.now(),
			});
			if (truncationNote) dispatch({ type: "setError", message: truncationNote });
		} catch (error) {
			// 取消期间的异常（例如请求被放弃）不算失败，落取消态即可。
			if (token.cancelled) {
				updateExportTask(task.id, { status: "cancelled", finishedAt: Date.now() });
			} else {
				updateExportTask(task.id, {
					status: "error",
					finishedAt: Date.now(),
					errorMessage: `导出失败：${error instanceof Error ? error.message : String(error)}`,
				});
			}
		} finally {
			unregisterCancel();
			exportCancelTokensRef.current.delete(task.id);
			exportSqlRef.current.delete(task.id);
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
		// 导出前先把本次生效的上限说清楚：历史上用户以为已经导出全部数据，实际只取到上限行。
		const exportLimitLabel = settings.exportLimitEnabled
			? `导出行数上限：${settings.exportRowLimit.toLocaleString()} 行`
			: "导出行数上限：不限";
		const items: ContextMenuEntry[] = [
			...EXPORT_FORMATS.map((f) => ({
				type: "item" as const,
				label: `导出当前页 ${f.label}`,
				icon: f.icon,
				onClick: () => void downloadAs(f.kind, colList, rows),
			})),
			{ type: "separator" as const },
			{
				type: "item" as const,
				label: exportLimitLabel,
				icon: "icon-[lucide--info]",
				// 纯展示项：上限是设置里的结果，不在这里改。
				disabled: true,
				onClick: () => {},
			},
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
			{/* 取数状态：overlay 放在滚动容器外面，绝对定位跟随整个网格区域而非内部滚动。 */}
			{pageLoading && (
				<div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px] pointer-events-auto">
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
			{/* 工具栏 — 已抽离到独立组件 ResultToolbar */}
			<ResultToolbar
				splitToolbar={splitToolbar}
				onToggleSplit={() => setSplitToolbar((v) => !v)}
				pageLoading={pageLoading ?? false}
				onRefresh={handleRefresh}
				onCopyAll={() => void copyAll()}
				onOpenExportMenu={openExportMenu}
				showRowNumbers={showRowNumbers}
				onToggleRowNumbers={() => setShowRowNumbers((v) => !v)}
				navPopoverRef={navPopoverRef}
				navOpen={navOpen}
				onToggleNav={() => setNavOpen((v) => !v)}
				navFilter={navFilter}
				onNavFilterChange={setNavFilter}
				colList={colList}
				onScrollToColumn={scrollToColumn}
				sort={sort}
				onClearSort={() => setSort(null)}
				connectionName={connectionName}
				parsedTableName={parsedTableName?.tableName}
				tableInfoOpen={tableInfoOpen}
				onOpenTableInfo={openTableInfo}
				whereClause={whereClause}
				onWhereChange={setWhereClause}
				orderByClause={orderByClause}
				onOrderByChange={setOrderByClause}
				onApplyFilterSort={applyFilterSort}
			/>


			{/* 网格（内部滚动）— 已抽离到独立组件 ResultTable */}
			<ResultTable
				columns={colList}
				rows={pagedRows}
				sort={sort}
				showRowNumbers={showRowNumbers}
				stripedRows={settings.dataGridStripedRows}
				selectedCell={selectedCell}
				safePage={safePage}
				pageSize={pageSize}
				scrollRef={scrollRef}
				defaultWidth={defaultWidth}
				onToggleSort={toggleSort}
				onOpenColumnMenu={openColumnMenu}
				onStartResize={startResize}
				onSelectCell={setSelectedCell}
				onCellDoubleClick={handleCellDoubleClick}
				onOpenCellMenu={openCellMenu}
			/>

			{/* 分页栏（固定底部，不随网格滚动）；上分割线用 .dbx-pagination，
			    与侧边栏竖线及桌面壳分割线对齐。
			    布局：左侧元信息 min-w-0 可截断，右侧操作区 shrink-0 永不被遮挡。 */}
			<div className="dbx-pagination flex h-7 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap px-3 text-[11px] text-muted-foreground">
				{/* 左侧：元信息（行数 + 执行时间 + 影响行数） */}
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{isServer ? (
						<>
							{/* 「已取回」与「共 N 行」是两个独立事实：前者是本会话真正拉到的行数，
							    后者是数据库侧的真实总数；总数未知时不再拿取回行数兜底。 */}
							<span className="shrink-0" title="已从数据库取回的行数（含当前页）">
								已取回 <span className="font-medium text-foreground/80">{takenRows.toLocaleString()}</span> 行
							</span>
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
							{totalKnown ? (
								<span className="shrink-0" title="数据库统计得到的真实总行数">
									共 <span className="font-medium text-foreground/80">{(serverTotalCount ?? 0).toLocaleString()}</span> 行
								</span>
							) : totalCounting ? (
								<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80">
									总数统计中
								</span>
							) : serverTotalStatus === "failed" ? (
								<span
									className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80"
									title="统计总行数失败（如 COUNT 超时），不影响翻页；点左侧刷新按钮可重试"
								>
									总数未知
								</span>
							) : null}
						</>
					) : (
						<span className="shrink-0">
							共 <span className="font-medium text-foreground/80">{displayTotal.toLocaleString()}</span> 行
						</span>
					)}
					{pageLoading ? <span className="shrink-0 text-[10px] text-muted-foreground">取数中…</span> : null}
					{/* 执行耗时 */}
					{elapsedMs !== undefined && elapsedMs >= 0 && !pageLoading && (
						<span className="shrink-0 text-muted-foreground/70" title="本次查询执行耗时">
							<span className="icon-[lucide--timer] h-3 w-3 align-middle" /> {formatDuration(elapsedMs)}
						</span>
					)}
					{/* 影响行数（写 / DDL） */}
					{affectedRows !== null && affectedRows !== undefined && affectedRows >= 0 && (
						<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80" title="写操作影响的行数">
							{affectedRows} rows affected
						</span>
					)}
				</div>
				{/* 中间：SQL 预览（截断 + 点击复制） */}
				{sql && (
					<div className="flex min-w-0 flex-1 items-center justify-center">
						<span
							className="truncate text-[10px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground/80"
							title={sql}
							onClick={() => void navigator.clipboard.writeText(sql).catch(() => {})}
						>
							{sql}
						</span>
					</div>
				)}
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
					{/* 加载全部：循环拉取直到末页（仅服务端分页） */}
					{isServer && (
						<button
							type="button"
							onClick={handleLoadAll}
							disabled={pageLoading === true || loadAllActive || !hasNextPage}
							className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
							title={loadAllActive ? "正在加载全部…" : "加载全部（循环拉取所有页）"}
						>
							<span
								className={
									loadAllActive
										? "icon-[lucide--loader-2] h-3 w-3 animate-spin"
										: "icon-[lucide--chevrons-down] h-3 w-3"
								}
							/>
						</button>
					)}
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
					{/* 生效中的导出行数上限：不开启时不占位；开启时常驻，避免用户以为已经导出了全部数据。 */}
					{settings.exportLimitEnabled ? (
						<span
							className="flex shrink-0 items-center gap-1 rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80"
							title={`导出全部数据最多取回 ${settings.exportRowLimit.toLocaleString()} 行，可在「导出设置」中调整`}
						>
							<span className="icon-[lucide--alert-triangle] h-3 w-3" />
							上限 {settings.exportRowLimit.toLocaleString()} 行
						</span>
					) : null}
				</div>
			</div>

			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
			{exportMenu && <ContextMenu menu={exportMenu} onClose={() => setExportMenu(null)} />}
			{columnMenu && <ContextMenu menu={columnMenu} onClose={() => setColumnMenu(null)} />}
			{detail && <CellDetailDialog detail={detail} onClose={() => setDetail(null)} />}
			{dialogTask && (
				<ExportProgressDialog
					task={dialogTask}
					onMinimize={() => setDialogTaskId(null)}
					onClose={() => setDialogTaskId(null)}
					onCancel={() => requestCancelExportTask(dialogTask.id)}
					onReveal={(filePath) => void revealExportFile(filePath)}
					onSave={() => void saveStagedExport(dialogTask.id)}
					onDiscard={() => discardStagedExport(dialogTask.id)}
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
