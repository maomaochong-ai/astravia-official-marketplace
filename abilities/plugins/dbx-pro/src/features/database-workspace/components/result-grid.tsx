/**
 * ResultGrid — 查询结果网格（对标 dbx DataGrid）。
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
} from "../../../domain/workbench-settings";
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";
import { cellText, toTsv, toCsv, toJson, toJsonLines, toMarkdown, toHtml } from "../services/result-export";
import { CellDisplay } from "./cell-display";
import { TableInfoPanel, type TableInfoSelection } from "./table-info-panel";
import { useWorkbench } from "../hooks/use-workbench";

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

	// 尝试从 SQL 中解析表名（用于表属性按钮）
	const { state } = useWorkbench();
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

	// 设置的每页行数变化时跟随为本地默认页大小。
	useEffect(() => {
		setLocalPageSize(resolvePageSize(defaultPageSize));
		setLocalPage(0);
	}, [defaultPageSize]);

	function openAiDialogForQuery(): void {
		setAiPrompt(buildQueryPrompt(connectionName ?? "", sql ?? "", rows));
		setAiDialogOpen(true);
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
		await navigator.clipboard.writeText(toTsv(colList, rows)).catch(() => {});
	}, [colList, rows]);

	const copyAsJson = useCallback(async () => {
		await navigator.clipboard.writeText(toJson(colList, rows)).catch(() => {});
	}, [colList, rows]);

	const copyAsMarkdown = useCallback(async () => {
		await navigator.clipboard.writeText(toMarkdown(colList, rows)).catch(() => {});
	}, [colList, rows]);

	function downloadFile(content: string, filename: string, mimeType: string): void {
		try {
			// 使用 Blob + URL.createObjectURL 方式下载
			const blob = new Blob([content], { type: mimeType });
			const url = URL.createObjectURL(blob);
			
			// 创建临时链接并触发下载
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.style.display = "none";
			
			// 添加到 DOM 并触发点击
			document.body.appendChild(anchor);
			anchor.click();
			
			// 清理
			setTimeout(() => {
				document.body.removeChild(anchor);
				URL.revokeObjectURL(url);
			}, 100);
		} catch (error) {
			// 如果下载失败，尝试使用 data URL 方式
			try {
				const dataUrl = `data:${mimeType};base64,${btoa(unescape(encodeURIComponent(content)))}`;
				const anchor = document.createElement("a");
				anchor.href = dataUrl;
				anchor.download = filename;
				anchor.click();
			} catch {
				// 最后手段：复制到剪贴板
				void navigator.clipboard.writeText(content).then(() => {
					alert(`无法下载文件，已将内容复制到剪贴板。请手动保存为 ${filename}`);
				}).catch(() => {
					alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
				});
			}
		}
	}

	const exportCsv = useCallback(() => {
		downloadFile(toCsv(colList, rows), "query-result.csv", "text/csv;charset=utf-8");
		setExportMenuOpen(false);
	}, [colList, rows]);

	const exportJson = useCallback(() => {
		downloadFile(toJson(colList, rows), "query-result.json", "application/json");
		setExportMenuOpen(false);
	}, [colList, rows]);

	const exportJsonLines = useCallback(() => {
		downloadFile(toJsonLines(colList, rows), "query-result.jsonl", "application/x-ndjson");
		setExportMenuOpen(false);
	}, [colList, rows]);

	const exportMarkdown = useCallback(() => {
		downloadFile(toMarkdown(colList, rows), "query-result.md", "text/markdown");
		setExportMenuOpen(false);
	}, [colList, rows]);

	const exportHtml = useCallback(() => {
		downloadFile(toHtml(colList, rows), "query-result.html", "text/html");
		setExportMenuOpen(false);
	}, [colList, rows]);

	const [exportMenuOpen, setExportMenuOpen] = useState(false);

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
		// 按此值筛选（简单实现：复制到剪贴板让用户粘贴到 WHERE 子句）
		const filterByThisValue = () => void navigator.clipboard.writeText(`${col} = '${cellValue.replace(/'/g, "''")}'`).catch(() => {});
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
						{ type: "item", label: "导出为 CSV", icon: "icon-[lucide--file-text]", onClick: () => exportCsv() },
						{ type: "item", label: "导出为 JSON", icon: "icon-[lucide--file-json]", onClick: () => exportJson() },
						{ type: "item", label: "导出为 JSON Lines", icon: "icon-[lucide--file-code]", onClick: () => exportJsonLines() },
						{ type: "item", label: "导出为 Markdown", icon: "icon-[lucide--file-text]", onClick: () => exportMarkdown() },
						{ type: "item", label: "导出为 HTML", icon: "icon-[lucide--file-code-2]", onClick: () => exportHtml() },
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
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 */}
			<div className="dbx-result-toolbar">
				{/* 左侧：复制和导出 */}
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={() => void copyAll()}
						title="复制全部为 TSV"
						className="dbx-toolbar-btn"
					>
						<span className="icon-[lucide--clipboard-list] h-3 w-3" />
						<span className="dbx-toolbar-btn-label">复制</span>
					</button>
					<div className="dbx-toolbar-btn-group">
						<button
							type="button"
							onClick={() => exportCsv()}
							title="导出 CSV"
							className="dbx-toolbar-btn dbx-toolbar-btn-grouped"
						>
							<span className="icon-[lucide--download] h-3 w-3" />
							<span className="dbx-toolbar-btn-label">导出</span>
						</button>
						<button
							type="button"
							onClick={() => setExportMenuOpen(!exportMenuOpen)}
							title="更多导出选项"
							className="dbx-toolbar-btn dbx-toolbar-btn-grouped dbx-toolbar-btn-dropdown"
						>
							<span className="icon-[lucide--chevron-down] h-2.5 w-2.5" />
						</button>
					</div>
					{exportMenuOpen && (
						<div className="dbx-toolbar-dropdown-menu">
							<button type="button" onClick={exportCsv} className="dbx-toolbar-dropdown-item">
								<span className="icon-[lucide--file-text] h-3 w-3" />
								CSV 文件
							</button>
							<button type="button" onClick={exportJson} className="dbx-toolbar-dropdown-item">
								<span className="icon-[lucide--file-json] h-3 w-3" />
								JSON 文件
							</button>
							<button type="button" onClick={exportJsonLines} className="dbx-toolbar-dropdown-item">
								<span className="icon-[lucide--file-code] h-3 w-3" />
								JSON Lines 文件
							</button>
							<button type="button" onClick={exportMarkdown} className="dbx-toolbar-dropdown-item">
								<span className="icon-[lucide--file-text] h-3 w-3" />
								Markdown 文件
							</button>
							<button type="button" onClick={exportHtml} className="dbx-toolbar-dropdown-item">
								<span className="icon-[lucide--file-code-2] h-3 w-3" />
								HTML 文件
							</button>
						</div>
					)}
				</div>

				{/* 中间：视图选项和表属性 */}
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={() => setShowRowNumbers((v) => !v)}
						title="显示/隐藏行号"
						className={`dbx-toolbar-btn ${showRowNumbers ? "dbx-toolbar-btn-active" : ""}`}
					>
						<span className="icon-[lucide--list-ordered] h-3 w-3" />
						<span className="dbx-toolbar-btn-label">行号</span>
					</button>
					{sort && (
						<button
							type="button"
							onClick={() => setSort(null)}
							title="清除排序"
							className="dbx-toolbar-btn"
						>
							<span className="icon-[lucide--arrow-up-down] h-3 w-3" />
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
							<span className="icon-[lucide--table-properties] h-3 w-3" />
							<span className="dbx-toolbar-btn-label">表属性</span>
						</button>
					)}
				</div>

				{/* 右侧：AI 分析 */}
				<div className="flex items-center gap-0.5">
					{connectionName && sql && (
						<button
							type="button"
							onClick={openAiDialogForQuery}
							title="把该 SQL 与结果发给 AI 分析"
							className="dbx-toolbar-btn dbx-toolbar-btn-primary"
						>
							<span className="icon-[lucide--sparkles] h-3 w-3" />
							<span className="dbx-toolbar-btn-label">分析结果</span>
						</button>
					)}
					<span className="ml-2 text-[10px] text-muted-foreground/60">双击查看详情 · 右键更多操作</span>
				</div>
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
										{colList.map((c) => (
											<td
												key={c}
												className="max-w-0 truncate border-b border-r border-border/60 px-3 py-1.5 text-foreground/80"
												style={{ maxWidth: defaultWidth(c) }}
												title={cellText(row[c])}
												onDoubleClick={() => setDetail({ column: c, value: row[c] })}
												onContextMenu={(e) => openCellMenu(e, c, row)}
											>
												<CellDisplay value={row[c]} />
											</td>
										))}
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* 分页栏（固定底部，不随网格滚动）；上分割线用 .dbx-pagination，
			    与侧边栏竖线及桌面壳分割线对齐。 */}
			<div className="dbx-pagination flex h-7 shrink-0 items-center gap-2 px-3 text-[11px] text-muted-foreground">
				<span>
					{totalKnown ? "共 " : "已取回 "}
					<span className="font-medium text-foreground/80">{displayTotal}</span> 行
				</span>
				{note ? (
					<span className="rounded bg-amber-500/10 px-1.5 text-[10px] text-amber-400" title={note}>
						{note}
					</span>
				) : null}
				{isServer && !totalKnown ? (
					<span className="rounded bg-[var(--dbx-surface-2)] px-1.5 text-[10px] text-muted-foreground/80">
						总数统计中
					</span>
				) : null}
				{pageLoading ? <span className="text-[10px] text-muted-foreground">取数中…</span> : null}
				<div className="ml-auto flex items-center gap-1">
					<label className="flex items-center gap-1">
						<span className="text-muted-foreground/60">每页</span>
						<select
							value={pageSize}
							onChange={(e) => changePageSize(Number(e.target.value))}
							className="h-5 rounded border border-border bg-background px-1 text-[10px] text-foreground/80"
						>
							{PAGE_SIZE_OPTIONS.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</label>
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
				</div>
			</div>

			{/* 点击外部关闭导出菜单 */}
			{exportMenuOpen && (
				<div
					className="fixed inset-0 z-50"
					onClick={() => setExportMenuOpen(false)}
				/>
			)}

			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
			{detail && <CellDetailDialog detail={detail} onClose={() => setDetail(null)} />}
			<SendToAiDialog open={aiDialogOpen} prompt={aiPrompt} onClose={() => setAiDialogOpen(false)} />
			
			{/* 表属性面板 */}
			{tableInfoOpen && tableInfoSelection && (
				<div className="fixed inset-0 z-[200]" onClick={() => setTableInfoOpen(false)}>
					<div 
						className="absolute right-0 top-0 bottom-0 w-[400px] max-w-[50vw] bg-background border-l border-border shadow-2xl"
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
