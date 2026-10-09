/**
 * ResultToolbar — 结果网格工具栏（v0.0.95 从 result-grid.tsx 抽离）
 *
 * 纯展示型组件：双排工具栏（actions 上排 + filters 下排）。
 * 所有交互回调由父组件传入，不持有自身 state。
 * 内部包含列导航 Popover 的完整 DOM（受控于 navOpen/navFilter 状态）。
 */

import type { JSX, MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { ResultTableSort } from "./result-table";

interface ResultToolbarProps {
	/** 双排 vs 单排 */
	splitToolbar: boolean;
	onToggleSplit: () => void;
	/** 加载状态（刷新按钮显示 spinner） */
	pageLoading: boolean;
	onRefresh: () => void;
	/** 复制/导出 */
	onCopyAll: () => void;
	onOpenExportMenu: (e: ReactMouseEvent) => void;
	/** 视图选项 */
	showRowNumbers: boolean;
	onToggleRowNumbers: () => void;
	/** 列导航 Popover */
	navPopoverRef: RefObject<HTMLDivElement | null>;
	navOpen: boolean;
	onToggleNav: () => void;
	navFilter: string;
	onNavFilterChange: (v: string) => void;
	colList: string[];
	onScrollToColumn: (col: string) => void;
	/** 清除排序 */
	sort: ResultTableSort | null;
	onClearSort: () => void;
	/** 表属性 */
	connectionName: string | undefined;
	parsedTableName: string | undefined;
	tableInfoOpen: boolean;
	onOpenTableInfo: () => void;
	/** 过滤条件（仅双排显示） */
	whereClause: string;
	onWhereChange: (v: string) => void;
	orderByClause: string;
	onOrderByChange: (v: string) => void;
	onApplyFilterSort: () => void;
}

export function ResultToolbar(props: ResultToolbarProps): JSX.Element {
	const {
		splitToolbar, onToggleSplit,
		pageLoading, onRefresh,
		onCopyAll, onOpenExportMenu,
		showRowNumbers, onToggleRowNumbers,
		navPopoverRef, navOpen, onToggleNav, navFilter, onNavFilterChange, colList, onScrollToColumn,
		sort, onClearSort,
		connectionName, parsedTableName, tableInfoOpen, onOpenTableInfo,
		whereClause, onWhereChange, orderByClause, onOrderByChange, onApplyFilterSort,
	} = props;

	const filteredCols = colList.filter(
		(c) => !navFilter || c.toLowerCase().includes(navFilter.toLowerCase()),
	);

	return (
		<div className={`dbx-result-toolbar ${splitToolbar ? "split-layout" : "single-layout"}`}>
			{/* 上排：操作按钮 */}
			<div className="dbx-toolbar-row-actions">
				{/* 左侧：刷新 */}
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={onRefresh}
						disabled={pageLoading === true}
						className="dbx-toolbar-btn"
						title="刷新结果"
					>
						<span
							className={
								pageLoading
									? "icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin"
									: "icon-[lucide--refresh-cw] h-3.5 w-3.5"
							}
						/>
						<span className="dbx-toolbar-btn-label">刷新</span>
					</button>
				</div>
				{/* 左侧：复制 + 导出 */}
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={onCopyAll}
						title="复制全部为 TSV"
						className="dbx-toolbar-btn"
					>
						<span className="icon-[lucide--clipboard-list] h-3.5 w-3.5" />
						<span className="dbx-toolbar-btn-label">复制</span>
					</button>
					<button
						type="button"
						onClick={onOpenExportMenu}
						title="导出数据（CSV/JSON/XLSX/Markdown/SQL 等）"
						className="dbx-toolbar-btn"
					>
						<span className="icon-[lucide--upload] h-3.5 w-3.5" />
						<span className="dbx-toolbar-btn-label">导出</span>
					</button>
				</div>

				{/* 中间：视图选项 */}
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={onToggleRowNumbers}
						title="显示/隐藏行号"
						className={`dbx-toolbar-btn ${showRowNumbers ? "dbx-toolbar-btn-active" : ""}`}
					>
						<span className="icon-[lucide--list-ordered] h-3.5 w-3.5" />
						<span className="dbx-toolbar-btn-label">行号</span>
					</button>
					{/* 列导航：列数多时快速定位 */}
					<div className="relative" ref={navPopoverRef}>
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={onToggleNav}
							title={`列导航（${colList.length} 列）`}
							className={`dbx-toolbar-btn ${navOpen ? "dbx-toolbar-btn-active" : ""}`}
						>
							<span className="icon-[lucide--columns-3] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">列</span>
						</button>
						{navOpen && colList.length > 0 && (
							<div
								className="absolute left-0 top-full z-40 mt-1 w-60 rounded-md border border-border bg-popover p-2 shadow-lg"
								onMouseDown={(e) => e.preventDefault()}
							>
								<input
									type="text"
									value={navFilter}
									onChange={(e) => onNavFilterChange(e.target.value)}
									placeholder="搜索列名…"
									autoFocus
									className="mb-2 w-full rounded border border-[var(--dbx-surface-2)] bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
								/>
								<div className="max-h-48 overflow-auto">
									{filteredCols.map((c) => (
										<button
											key={c}
											type="button"
											onClick={() => onScrollToColumn(c)}
											className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-foreground/80 hover:bg-[var(--dbx-hover)]"
											title={c}
										>
											{c}
										</button>
									))}
									{filteredCols.length === 0 && (
										<p className="px-2 py-1 text-[11px] text-muted-foreground/60">无匹配列</p>
									)}
								</div>
							</div>
						)}
					</div>
					{sort && (
						<button
							type="button"
							onClick={onClearSort}
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
							onClick={onOpenTableInfo}
							title="查看表属性（列、索引、外键等）"
							className={`dbx-toolbar-btn ${tableInfoOpen ? "dbx-toolbar-btn-active" : ""}`}
						>
							<span className="icon-[lucide--table-properties] h-3.5 w-3.5" />
							<span className="dbx-toolbar-btn-label">表属性</span>
						</button>
					)}
					<button
						type="button"
						onClick={onToggleSplit}
						title={splitToolbar ? "切换为单排工具栏" : "切换为双排工具栏"}
						className={`dbx-toolbar-btn ${splitToolbar ? "dbx-toolbar-btn-active" : ""}`}
					>
						<span className="icon-[lucide--rows-3] h-3.5 w-3.5" />
						<span className="dbx-toolbar-btn-label">{splitToolbar ? "单排" : "双排"}</span>
					</button>
				</div>

				{/* AI 分析入口统一收敛到结果面板的「AI 分析 → 通用分析」，此处不再重复 */}
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
							onChange={(e) => onWhereChange(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") onApplyFilterSort(); }}
						/>
					</div>
					<div className="flex items-center gap-2 flex-1">
						<span className="icon-[lucide--arrow-up-down] h-3.5 w-3.5 text-muted-foreground" />
						<input
							type="text"
							className="dbx-toolbar-filter-input"
							placeholder="ORDER BY（如：created_at DESC, id ASC）"
							value={orderByClause}
							onChange={(e) => onOrderByChange(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") onApplyFilterSort(); }}
						/>
					</div>
					<button
						type="button"
						onClick={onApplyFilterSort}
						className="dbx-toolbar-btn dbx-toolbar-btn-primary"
						title="按以上条件重新查询"
					>
						<span className="icon-[lucide--play] h-3.5 w-3.5" />
						<span className="dbx-toolbar-btn-label">应用</span>
					</button>
				</div>
			)}
		</div>
	);
}
