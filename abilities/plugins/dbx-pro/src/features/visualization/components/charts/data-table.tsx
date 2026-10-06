/**
 * DataTable — 数据表格组件（主题感知）
 * Dashboard: 浅灰表头 + 白底; BigScreen: cyan 发光表头 + 暗色玻璃态
 */

import type { JSX } from "react";

export interface DataTableProps {
	title: string;
	columns: string[];
	rows: Array<Record<string, unknown>>;
	maxRows?: number;
	themeMode?: "dashboard" | "bigscreen";
}

export function DataTable({ title, columns, rows, maxRows = 20, themeMode = "dashboard" }: DataTableProps): JSX.Element {
	const displayRows = rows.slice(0, maxRows);

	return (
		<div className={`viz-card viz-card--table viz-table-${themeMode}`}>
			<h3>{title}</h3>
			<div className="viz-table-wrapper">
				<table className="viz-table">
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
				<div className="viz-table-footer">显示前 {maxRows} 行，共 {rows.length} 行</div>
			)}
		</div>
	);
}
