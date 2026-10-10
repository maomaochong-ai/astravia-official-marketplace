/**
 * ResultTable — 结果网格的纯展示层
 *
 * 从 result-grid.tsx 抽离（v0.0.95）。只负责表格 DOM 渲染：thead 列头 + tbody 行，
 * 所有交互回调（排序、菜单、选择、双击）都由父组件传入。
 * scrollRef 也由父提供（ResultGrid 需要在翻页后做 scrollIntoView 定位）。
 */

import type { JSX, MouseEvent, RefObject } from "react";
import { CellDisplay } from "./cell-display";
import { cellText } from "../services/result-export";

export interface ResultTableSort {
	col: string;
	dir: "asc" | "desc";
}

export interface ResultTableSelection {
	row: number;
	col: string;
}

interface ResultTableProps {
	columns: string[];
	rows: Array<Record<string, unknown>>;
	sort: ResultTableSort | null;
	showRowNumbers: boolean;
	stripedRows: boolean;
	selectedCell: ResultTableSelection | null;
	safePage: number;
	pageSize: number;
	scrollRef: RefObject<HTMLDivElement | null>;
	defaultWidth: (col: string) => number;
	onToggleSort: (col: string) => void;
	onOpenColumnMenu: (e: MouseEvent, col: string) => void;
	onStartResize: (e: MouseEvent, col: string) => void;
	onSelectCell: (sel: ResultTableSelection) => void;
	onCellDoubleClick: (rowIdx: number, col: string, val: unknown) => void;
	onOpenCellMenu: (e: MouseEvent, col: string, row: Record<string, unknown>) => void;
}

export function ResultTable({
	columns,
	rows,
	sort,
	showRowNumbers,
	stripedRows,
	selectedCell,
	safePage,
	pageSize,
	scrollRef,
	defaultWidth,
	onToggleSort,
	onOpenColumnMenu,
	onStartResize,
	onSelectCell,
	onCellDoubleClick,
	onOpenCellMenu,
}: ResultTableProps): JSX.Element {
	return (
		<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
			<table className="w-full border-separate border-spacing-0 font-sans text-[12px]" style={{ minWidth: "100%" }}>
				<thead>
					<tr className="h-10">
						{showRowNumbers && (
							<th className="sticky left-0 z-20 w-12 min-w-12 border-b border-border bg-surface-sunken px-2 py-1 text-right font-mono text-[12px] tabular-nums text-faint select-none" />
						)}
						{columns.map((c, i) => (
							<th
								key={c}
								data-col={c}
								onContextMenu={(e) => onOpenColumnMenu(e, c)}
								className="relative border-b border-border px-3 py-1 text-left align-middle font-normal text-[12px] text-surface-foreground"
								style={{ backgroundColor: "var(--dbx-panel-sunken)", width: defaultWidth(c), minWidth: defaultWidth(c) }}
							>
								<div className="flex items-center gap-1">
									<span
										className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1 truncate hover:text-foreground"
										title={`按 ${c} 排序`}
										onClick={() => onToggleSort(c)}
									>
										<span className="min-w-0 flex-1 truncate">{c}</span>
										{sort?.col === c ? (
											<span className={`h-2.5 w-2.5 shrink-0 text-foreground ${sort.dir === "asc" ? "icon-[lucide--arrow-up]" : "icon-[lucide--arrow-down]"}`} />
										) : null}
									</span>
									<span className="shrink-0 font-mono text-[12px] text-faint">{i + 1}</span>
								</div>
								<span
									onMouseDown={(e) => onStartResize(e, c)}
									className="absolute right-[-2px] top-0 h-full w-1.5 cursor-col-resize hover:bg-foreground/40"
								/>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length + (showRowNumbers ? 1 : 0)}
								className="py-10 text-center text-[12px] text-faint"
							>
								该页无数据
							</td>
						</tr>
					) : (
						rows.map((row, rowIdx) => {
							const globalIdx = safePage * pageSize + rowIdx + 1;
							const rowBg = stripedRows && rowIdx % 2 === 1 ? "bg-surface-raised" : "bg-background";
							return (
								<tr key={`${safePage}-${rowIdx}`} className={`group h-[30px] ${rowBg} hover:bg-[var(--dbx-hover)]`}>
									{showRowNumbers && (
										<td className={`sticky left-0 z-10 w-12 min-w-12 border-b border-border px-2 py-1.5 text-right font-mono text-[12px] tabular-nums text-faint select-none group-hover:bg-[var(--dbx-hover)] ${rowBg}`}>
											{globalIdx}
										</td>
									)}
									{columns.map((c) => {
										const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === c;
										return (
											<td
												key={c}
												className={`max-w-0 truncate border-b border-border px-3 py-1.5 font-mono text-[13px] text-surface-foreground whitespace-nowrap ${isSelected ? "bg-link-soft" : ""}`}
												style={{ maxWidth: defaultWidth(c) }}
												title={cellText(row[c])}
												onClick={() => onSelectCell({ row: rowIdx, col: c })}
												onDoubleClick={() => onCellDoubleClick(rowIdx, c, row[c])}
												onContextMenu={(e) => onOpenCellMenu(e, c, row)}
											>
												<CellDisplay value={row[c]} />
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
	);
}
