/**
 * ResultGrid — 查询结果网格（对标 dbx DataGrid）。
 *
 * - 行号列（横向滚动时固定左侧）
 * - 列宽拖拽（th relative，边缘手柄）
 * - 双击单元格 → 详情弹窗；右键单元格 → 复制 / 导出菜单
 * - 工具栏：复制为 TSV、导出 CSV
 * - NULL / JSON / 数字 / 布尔类型着色；客户端分页
 */

import { useCallback, useMemo, useState, type JSX } from "react";
import {
	ContextMenu,
	type ContextMenuState,
} from "../../../shared/components/context-menu";
import {
	CellDetailDialog,
	type CellDetail,
} from "./cell-detail-dialog";
import { sendQueryToAi } from "../../../shared/ai/send-context";

interface Props {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	/** 产生该结果的连接 / SQL，用于「分析结果」回流给 AI。 */
	connectionName?: string;
	sql?: string;
}

const PAGE_SIZE = 100;

function cellText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function toTsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.join("\t")];
	for (const row of rows) lines.push(cols.map((c) => cellText(row[c]).replaceAll("\t", " ")).join("\t"));
	return lines.join("\n");
}

function csvEscape(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toCsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.map(csvEscape).join(",")];
	for (const row of rows) lines.push(cols.map((c) => csvEscape(cellText(row[c]))).join(","));
	return `﻿${lines.join("\r\n")}`;
}

export function ResultGrid({ columns, rows, totalRows, connectionName, sql }: Props): JSX.Element {
	const [page, setPage] = useState(0);
	const [colWidths, setColWidths] = useState<Record<string, number>>({});
	const [menu, setMenu] = useState<ContextMenuState | null>(null);
	const [detail, setDetail] = useState<CellDetail | null>(null);
	const [showRowNumbers, setShowRowNumbers] = useState(true);
	const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);

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

	const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
	const safePage = Math.min(page, totalPages - 1);
	const pagedRows = useMemo(
		() => orderedRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
		[orderedRows, safePage],
	);

	/** 点击表头：无→升序→降序→清除。 */
	function toggleSort(col: string) {
		setPage(0);
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

	const exportCsv = useCallback(() => {
		const blob = new Blob([toCsv(colList, rows)], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "query-result.csv";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}, [colList, rows]);

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
		const value = row[col];
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
				{
					type: "item",
					label: "复制单元格",
					icon: "icon-[lucide--copy]",
					onClick: () => void navigator.clipboard.writeText(cellText(value)).catch(() => {}),
				},
				{
					type: "item",
					label: "复制整行为 TSV",
					icon: "icon-[lucide--clipboard-copy]",
					onClick: () => void navigator.clipboard.writeText(toTsv(colList, [row])).catch(() => {}),
				},
				{ type: "separator" },
				{ type: "item", label: "复制全部为 TSV", icon: "icon-[lucide--clipboard-list]", onClick: () => void copyAll() },
				{ type: "item", label: "导出全部为 CSV", icon: "icon-[lucide--download]", onClick: () => exportCsv() },
			],
		});
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 */}
			<div className="flex h-7 shrink-0 items-center gap-1 px-2" style={{ backgroundColor: "var(--dbx-surface)", borderBottom: "1px solid var(--dbx-line-soft)" }}>
				<button
					type="button"
					onClick={() => void copyAll()}
					title="复制全部为 TSV"
					className="flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
				>
					<span className="icon-[lucide--clipboard-list] h-3 w-3" />
					复制
				</button>
				<button
					type="button"
					onClick={() => exportCsv()}
					title="导出 CSV"
					className="flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
				>
					<span className="icon-[lucide--download] h-3 w-3" />
					CSV
				</button>
				<button
					type="button"
					onClick={() => setShowRowNumbers((v) => !v)}
					title="行号"
					className={`flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] ${showRowNumbers ? "text-blue-400" : "text-muted-foreground hover:text-foreground"}`}
				>
					<span className="icon-[lucide--list-ordered] h-3 w-3" />
					#
				</button>
				{connectionName && sql && (
					<button
						type="button"
						onClick={() => sendQueryToAi(connectionName, sql, rows)}
						title="把该 SQL 与结果发给 AI 分析"
						className="flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] text-purple-300 hover:bg-purple-500/15"
					>
						<span className="icon-[lucide--sparkles] h-3 w-3" />
						分析结果
					</button>
				)}
				<span className="ml-auto text-[10px] text-muted-foreground/70">双击查看详情 · 右键更多操作</span>
			</div>

			{/* 网格 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-auto">
				<table className="border-separate border-spacing-0 text-[12px]" style={{ minWidth: "100%" }}>
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
											<span className={`h-2.5 w-2.5 shrink-0 text-blue-400 ${sort.dir === "asc" ? "icon-[lucide--arrow-up]" : "icon-[lucide--arrow-down]"}`} />
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
								const globalIdx = safePage * PAGE_SIZE + rowIdx + 1;
								return (
									<tr key={rowIdx} className="hover:bg-[var(--dbx-hover)]">
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

			{/* 分页栏 */}
			<div className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
				<span>
					共 <span className="font-medium text-foreground/80">{totalRows}</span> 行
				</span>
				{rows.length < totalRows && (
					<span className="rounded bg-amber-500/10 px-1.5 text-[10px] text-amber-400">
						仅展示前 {rows.length} 行
					</span>
				)}
				<div className="ml-auto flex items-center gap-1">
					<span className="text-muted-foreground/70">
						{pagedRows.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
						{safePage * PAGE_SIZE + pagedRows.length}
					</span>
					<span className="text-muted-foreground/60">/</span>
					<span className="text-muted-foreground/70">{totalRows}</span>
					<div className="mx-2 h-3 w-px bg-[var(--dbx-surface-2)]" />
					<button
						type="button"
						onClick={() => setPage(0)}
						disabled={safePage === 0}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="第一页"
					>
						<span className="icon-[lucide--chevrons-left] h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={() => setPage(Math.max(0, safePage - 1))}
						disabled={safePage === 0}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="上一页"
					>
						<span className="icon-[lucide--chevron-left] h-3 w-3" />
					</button>
					<span className="rounded bg-[var(--dbx-surface-2)] px-1.5 py-0.5 text-[10px] text-foreground/80">
						{safePage + 1} / {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
						disabled={safePage >= totalPages - 1}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="下一页"
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={() => setPage(totalPages - 1)}
						disabled={safePage >= totalPages - 1}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
						title="最后一页"
					>
						<span className="icon-[lucide--chevrons-right] h-3 w-3" />
					</button>
				</div>
			</div>

			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
			{detail && <CellDetailDialog detail={detail} onClose={() => setDetail(null)} />}
		</div>
	);
}

function CellDisplay({ value }: { value: unknown }): JSX.Element {
	if (value === null || value === undefined) {
		return <span className="italic text-muted-foreground/70">NULL</span>;
	}
	if (typeof value === "boolean") {
		return <span className={value ? "text-emerald-400" : "text-red-400"}>{String(value)}</span>;
	}
	if (typeof value === "number") {
		return <span className="font-mono text-amber-300">{String(value)}</span>;
	}
	if (typeof value === "object") {
		return <span className="font-mono text-foreground/70">{JSON.stringify(value)}</span>;
	}
	const text = String(value);
	if (/^https?:\/\//i.test(text)) {
		return (
			<span className="text-blue-400 underline decoration-blue-400/40">{text}</span>
		);
	}
	return <span>{text}</span>;
}
