/**
 * ResultToolbar — 结果网格工具栏。
 *
 * 密度模式：
 *   compact（单排）→ 过滤排（WHERE/ORDER BY）收进 popover，工具栏只保留操作排一行。
 *   dense（双排）→ 过滤排常驻展开。
 *
 * 注意：双排按钮之前被误解为"网格行高"开关（会变数据行高度），
 * 实际意图是控制工具栏排数——这里把按钮语义改回工具栏密度控制，
 * 行高开关留给未来需要时新增独立按钮。
 */

import type { JSX, MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { ResultTableSort } from "./result-table";

interface ResultToolbarProps {
	/** 加载状态（刷新按钮显示 spinner） */
	pageLoading: boolean;
	onRefresh: () => void;
	/** 复制/导出 */
	onCopyAll: () => void;
	onOpenExportMenu: (e: ReactMouseEvent) => void;
	/** 视图选项 */
	showRowNumbers: boolean;
	onToggleRowNumbers: () => void;
	/** 工具栏密度：compact（单排，过滤排收进 popover） / dense（双排，过滤排展开） */
	denseToolbar: boolean;
	onToggleToolbarDensity: () => void;
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
	/** 过滤条件（常驻显示） */
	whereClause: string;
	onWhereChange: (v: string) => void;
	orderByClause: string;
	onOrderByChange: (v: string) => void;
	onApplyFilterSort: () => void;
	/** 右侧元信息：耗时（行数由底部分页栏展示，避免顶底重复） */
	elapsedLabel?: string;
	/** 服务端分页的 COUNT 状态（pending 时刷新按钮转圈） */
	totalCountStatus?: "pending" | "failed";
	onRefreshTotalCount?: () => void;
	/** 生效中的导出行数上限；未开启时为 undefined（不占位） */
	exportLimitRows?: number;
}

export function ResultToolbar(props: ResultToolbarProps): JSX.Element {
	const {
		pageLoading, onRefresh,
		onCopyAll, onOpenExportMenu,
		showRowNumbers, onToggleRowNumbers,
		denseToolbar, onToggleToolbarDensity,
		navPopoverRef, navOpen, onToggleNav, navFilter, onNavFilterChange, colList, onScrollToColumn,
		sort, onClearSort,
		connectionName, parsedTableName, tableInfoOpen, onOpenTableInfo,
		whereClause, onWhereChange, orderByClause, onOrderByChange, onApplyFilterSort,
		elapsedLabel, totalCountStatus, onRefreshTotalCount, exportLimitRows,
	} = props;

	const filteredCols = colList.filter(
		(c) => !navFilter || c.toLowerCase().includes(navFilter.toLowerCase()),
	);
	const canOpenTableInfo = Boolean(connectionName && parsedTableName);
	const countingTotal = totalCountStatus === "pending";

	return (
		<div className="dbx-result-toolbar">
			{/* 操作排：24px 纯图标按钮（.dbx-icon-btn），语义只放在 title 里 */}
			<div className="dbx-toolbar-row-actions">
				<button
					type="button"
					onClick={onRefresh}
					disabled={pageLoading === true}
					className="dbx-icon-btn"
					title="刷新结果"
				>
					<span
						className={
							pageLoading
								? "icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin"
								: "icon-[lucide--refresh-cw] h-3.5 w-3.5"
						}
					/>
				</button>
				<button
					type="button"
					onClick={onCopyAll}
					className="dbx-icon-btn"
					title="复制单元格 / 行"
				>
					<span className="icon-[lucide--copy] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onOpenExportMenu}
					className="dbx-icon-btn"
					title="导出（CSV / JSON / SQL / XLSX）"
				>
					<span className="icon-[lucide--download] h-3.5 w-3.5" />
				</button>

				<span className="mx-1 h-4 w-px shrink-0 bg-border" />

				<button
					type="button"
					onClick={onToggleRowNumbers}
					title="显示行号"
					aria-pressed={showRowNumbers}
					className={`dbx-icon-btn${showRowNumbers ? " dbx-icon-btn--active" : ""}`}
				>
					<span className="icon-[lucide--hash] h-3.5 w-3.5" />
				</button>
				{/* 列导航：列数多时快速定位 */}
				<div className="relative" ref={navPopoverRef}>
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={onToggleNav}
						title={`显示 / 隐藏列（${colList.length} 列）`}
						aria-expanded={navOpen}
						className={`dbx-icon-btn${navOpen ? " dbx-icon-btn--active" : ""}`}
					>
						<span className="icon-[lucide--columns-3] h-3.5 w-3.5" />
					</button>
					{navOpen && colList.length > 0 && (
						<div
							className="absolute left-0 top-full z-40 mt-1 w-60 rounded-control border border-border bg-popover p-2 shadow-[var(--dbx-shadow-popover)]"
							onMouseDown={(e) => e.preventDefault()}
						>
							<input
								type="text"
								value={navFilter}
								onChange={(e) => onNavFilterChange(e.target.value)}
								placeholder="搜索列名…"
								autoFocus
								className="mb-2 w-full rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-surface-foreground outline-none focus:border-primary"
							/>
							<div className="max-h-48 overflow-auto">
								{filteredCols.map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => onScrollToColumn(c)}
										className="block w-full truncate rounded-control px-2 py-1 text-left text-[12px] text-muted hover:bg-neutral-muted hover:text-surface-foreground"
										title={c}
									>
										{c}
									</button>
								))}
								{filteredCols.length === 0 && (
									<p className="px-2 py-1 text-[12px] text-muted">无匹配列</p>
								)}
							</div>
						</div>
					)}
				</div>
				<button
					type="button"
					onClick={onClearSort}
					disabled={!sort}
					title={sort ? `排序：${sort.col} ${sort.dir === "asc" ? "升序" : "降序"}` : "排序"}
					className={`dbx-icon-btn${sort ? " dbx-icon-btn--active" : ""}`}
				>
					<span className="icon-[lucide--arrow-up-down] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onOpenTableInfo}
					disabled={!canOpenTableInfo}
					title="表属性"
					aria-pressed={tableInfoOpen}
					className={`dbx-icon-btn${tableInfoOpen ? " dbx-icon-btn--active" : ""}`}
				>
					<span className="icon-[lucide--table-properties] h-3.5 w-3.5" />
				</button>

				<span className="mx-1 h-4 w-px shrink-0 bg-border" />

				<button
					type="button"
					onClick={onToggleToolbarDensity}
					title={denseToolbar ? "工具栏：双排（展开过滤排）" : "工具栏：单排（过滤排收起）"}
					aria-pressed={denseToolbar}
					className={`dbx-icon-btn${denseToolbar ? " dbx-icon-btn--active" : ""}`}
				>
					<span className="icon-[lucide--rows-3] h-3.5 w-3.5" />
				</button>

				{/* 紧凑模式下：过滤排收进 popover 按钮 */}
				{!denseToolbar && (whereClause || orderByClause) ? (
					<div className="relative">
						<button
							type="button"
							title="已应用过滤 / 排序"
							className="dbx-icon-btn dbx-icon-btn--active"
						>
							<span className="icon-[lucide--filter] h-3.5 w-3.5" />
						</button>
					</div>
				) : null}

				{/* 元信息：耗时 · 导出行数上限提示（完整总行数由底部分页栏的范围 / 总数承担，避免顶底重复） */}
				<div className="dbx-toolbar-meta">
					{exportLimitRows !== undefined ? (
						<span
							className="flex shrink-0 items-center gap-1 rounded-chip border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-warning"
							title={`导出全部数据最多取回 ${exportLimitRows.toLocaleString()} 行，可在「导出设置」中调整`}
						>
							<span className="icon-[lucide--alert-triangle] h-3 w-3" />
							上限 {exportLimitRows.toLocaleString()} 行
						</span>
					) : null}
					{elapsedLabel ? (
						<span
							className="shrink-0 font-mono text-surface-foreground"
							title="本次查询执行耗时"
						>
							{elapsedLabel}
						</span>
					) : null}
					{onRefreshTotalCount ? (
						<button
							type="button"
							onClick={onRefreshTotalCount}
							disabled={pageLoading === true || countingTotal}
							title={countingTotal ? "正在统计总行数…" : "刷新总计行统计"}
							className="flex h-5 w-5 shrink-0 items-center justify-center rounded-control hover:bg-neutral-muted hover:text-surface-foreground disabled:opacity-50"
						>
							<span
								className={
									countingTotal
										? "icon-[lucide--loader-2] h-3 w-3 animate-spin"
										: "icon-[lucide--refresh-cw] h-3 w-3"
								}
							/>
						</button>
					) : null}
				</div>
			</div>

			{/* 过滤排：dense（双排）模式下展开；compact（单排）模式下隐藏，过滤条件通过按钮或 WHERE 状态条体现 */}
			{denseToolbar && (
				<div className="dbx-toolbar-row-filters">
					<span className="dbx-toolbar-filter-label">WHERE</span>
					<input
						type="text"
						className="dbx-toolbar-filter-input"
						placeholder="如：id > 10 AND name LIKE '%test%'"
						value={whereClause}
						onChange={(e) => onWhereChange(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter") onApplyFilterSort(); }}
					/>
					<span className="dbx-toolbar-filter-label">ORDER BY</span>
					<input
						type="text"
						className="dbx-toolbar-filter-input dbx-toolbar-filter-input--order"
						placeholder="如：created_at DESC"
						value={orderByClause}
						onChange={(e) => onOrderByChange(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter") onApplyFilterSort(); }}
					/>
					<button
						type="button"
						onClick={onApplyFilterSort}
						className="dbx-btn"
						title="按以上条件重新查询"
					>
						应用
					</button>
				</div>
			)}
		</div>
	);
}
