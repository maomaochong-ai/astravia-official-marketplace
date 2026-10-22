import type { ReactNode } from "react";

export interface DataTableRow {
	key: string;
	cells: readonly ReactNode[];
}

export interface DataTableProps {
	columns: readonly string[];
	rows: readonly DataTableRow[];
	/** 每列是否用等宽体；默认除第一列外都用。 */
	mono?: readonly boolean[];
	/** 单元格为空时的占位文案。 */
	empty?: string;
	className?: string;
}

/**
 * 取证页面的只读表格。
 *
 * 横向可滚：面板宽度由宿主侧栏决定，一张 4 列的表塞不下时必须滚动，
 * 不能压缩到看不清内容。
 */
export function DataTable({ columns, rows, mono, empty, className }: DataTableProps) {
	if (rows.length === 0) {
		return <div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{empty ?? "—"}</div>;
	}
	const isMono = (index: number) => mono?.[index] ?? index > 0;
	return (
		<div className={`fb-scroll overflow-x-auto ${className ?? ""}`}>
			<table className="w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-line-subtle">
						{columns.map(column => (
							<th key={column} className="whitespace-nowrap px-3.5 py-2 text-[10.5px] font-medium uppercase tracking-wide text-text-4">
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(row => (
						<tr key={row.key} className="border-b border-line-subtle last:border-0 hover:bg-surface-hover">
							{row.cells.map((cell, index) => (
								<td
									key={`${row.key}-${index}`}
									className={`max-w-[42ch] truncate px-3.5 py-2 align-top text-[12px] ${isMono(index) ? "font-mono text-text-2" : "text-text"}`}
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
