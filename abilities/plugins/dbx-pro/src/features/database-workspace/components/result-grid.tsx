/**
 * ResultGrid — 查询结果网格。
 *
 * 增强版：
 * - 暗色主题（适配 #0d0f15 / #0f1117 配色）
 * - 列宽可拖拽（简单实现：鼠标按下列头边缘 → 水平移动 → 宽度变化）
 * - 空态/错误态分区
 * - NULL / JSON / 长文本等类型的特殊渲染
 * - 底部分页控制器
 */

import { useMemo, useState, type JSX } from "react";

interface Props {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
}

const PAGE_SIZE = 100;

export function ResultGrid({ columns, rows, totalRows }: Props): JSX.Element {
	const [page, setPage] = useState(0);
	const [colWidths, setColWidths] = useState<Record<string, number>>({});

	const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
	const safePage = Math.min(page, totalPages - 1);
	const pagedRows = useMemo(
		() => rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
		[rows, safePage],
	);

	const colList = columns.length > 0
		? columns
		: Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

	if (colList.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 bg-background text-zinc-500">
				<span className="icon-[lucide--table] h-10 w-10 opacity-30" />
				<p className="text-[12px]">执行查询后显示结果</p>
			</div>
		);
	}

	function defaultWidth(col: string) {
		return colWidths[col] ?? Math.max(80, Math.min(240, col.length * 10 + 60));
	}

	function startResize(e: React.MouseEvent, col: string) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = defaultWidth(col);
		function onMove(ev: MouseEvent) {
			const next = Math.max(40, startW + (ev.clientX - startX));
			setColWidths((prev) => ({ ...prev, [col]: next }));
		}
		function onUp() {
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

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<div className="flex min-h-0 flex-1 overflow-auto">
				<table className="min-w-full border-separate border-spacing-0 text-[12px]">
					<thead>
						<tr>
							{colList.map((c, i) => (
								<th
									key={c}
									style={{ width: defaultWidth(c), minWidth: defaultWidth(c) }}
									className="sticky top-0 z-10 border-b border-border bg-[#111320] px-3 py-2 text-left font-semibold text-muted-foreground text-[10.5px] uppercase tracking-wider"
								>
									<div className="flex items-center gap-1">
										<span className="min-w-0 truncate" title={c}>{c}</span>
										<span className="ml-auto text-[9px] text-zinc-600">#{i + 1}</span>
									</div>
									<span
										onMouseDown={(e) => startResize(e, c)}
										className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50"
										style={{ right: -1 }}
									/>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{pagedRows.length === 0 ? (
							<tr>
								<td
									colSpan={colList.length}
									className="py-10 text-center text-[12px] text-zinc-500"
								>
									该页无数据
								</td>
							</tr>
						) : (
							pagedRows.map((row, rowIdx) => (
								<tr
									key={rowIdx}
									className="hover:bg-zinc-800/40"
								>
									{colList.map((c) => (
										<td
											key={c}
											className="truncate border-b border-border/60 px-3 py-1.5 text-zinc-300"
											style={{ maxWidth: defaultWidth(c) }}
											title={formatTooltip(row[c])}
										>
											<CellDisplay value={row[c]} />
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* 底部分页 + 状态 */}
			<div className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-background px-3 text-[11px] text-zinc-500">
				<span>
					共 <span className="text-zinc-300 font-medium">{totalRows}</span> 行
				</span>
				{rows.length < totalRows && (
					<span className="rounded bg-amber-500/10 px-1.5 text-[10px] text-amber-400">
						仅展示前 {rows.length} 行
					</span>
				)}
				<div className="ml-auto flex items-center gap-1">
					<span className="text-zinc-600">
						{pagedRows.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
						{safePage * PAGE_SIZE + pagedRows.length}
					</span>
					<span className="text-zinc-700">/</span>
					<span className="text-zinc-600">{totalRows}</span>
					<div className="mx-2 h-3 w-px bg-zinc-800" />
					<button
						type="button"
						onClick={() => setPage(0)}
						disabled={safePage === 0}
						className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
						title="第一页"
					>
						<span className="icon-[lucide--chevrons-left] h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={() => setPage(Math.max(0, safePage - 1))}
						disabled={safePage === 0}
						className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
						title="上一页"
					>
						<span className="icon-[lucide--chevron-left] h-3 w-3" />
					</button>
					<span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-muted-foreground">
						{safePage + 1} / {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
						disabled={safePage >= totalPages - 1}
						className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
						title="下一页"
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={() => setPage(totalPages - 1)}
						disabled={safePage >= totalPages - 1}
						className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
						title="最后一页"
					>
						<span className="icon-[lucide--chevrons-right] h-3 w-3" />
					</button>
				</div>
			</div>
		</div>
	);
}

function formatTooltip(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "object") return JSON.stringify(v, null, 2);
	return String(v);
}

function CellDisplay({ value }: { value: unknown }) {
	if (value === null || value === undefined) {
		return <span className="text-zinc-600 italic">NULL</span>;
	}
	if (typeof value === "boolean") {
		return <span className={value ? "text-emerald-400" : "text-red-400"}>{String(value)}</span>;
	}
	if (typeof value === "number") {
		return <span className="font-mono text-amber-300">{String(value)}</span>;
	}
	if (typeof value === "object") {
		return <span className="font-mono text-muted-foreground">{JSON.stringify(value)}</span>;
	}
	const text = String(value);
	if (/^https?:\/\//i.test(text)) {
		return (
			<a href={text} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
				{text}
			</a>
		);
	}
	return <span>{text}</span>;
}
