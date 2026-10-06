/**
 * DataTable — 数据表格组件
 */

import type { JSX } from "react";

export interface DataTableProps {
	title: string;
	columns: string[];
	rows: Array<Record<string, unknown>>;
	maxRows?: number;
}

export function DataTable({ title, columns, rows, maxRows = 20 }: DataTableProps): JSX.Element {
	const displayRows = rows.slice(0, maxRows);

	return (
		<div className="table-card">
			<h3>{title}</h3>
			<div className="table-wrapper">
				<table>
					<thead>
						<tr>
							{columns.map((col) => (
								<th key={col}>{col}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{displayRows.map((row, i) => (
							<tr key={i}>
								{columns.map((col) => (
									<td key={col} title={String(row[col] ?? "")}>
									{String(row[col] ?? "")}
								</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{rows.length > maxRows && (
				<div className="table-footer">显示前 {maxRows} 行，共 {rows.length} 行</div>
			)}
		</div>
	);
}
