/**
 * 元数据列表格 — 索引 / 外键 / 触发器 / 约束页签共用的只读表格。
 *
 * 纯展示组件：列规格 + 行数据由各页签传入；自带加载 / 错误 / 空 / 不支持四种状态。
 */

import type { JSX } from "react";
import type { MetadataColumnSpec } from "../services/table-metadata";
import { rowValue } from "../services/table-metadata";

export interface MetadataTableProps {
	loading: boolean;
	rows: Record<string, unknown>[];
	columns: MetadataColumnSpec[];
	unsupported: boolean;
	error: string | null;
	/** 对象中文名（"索引" / "外键" …），用于空态文案。 */
	objectLabel: string;
}

export function MetadataTable({
	loading,
	rows,
	columns,
	unsupported,
	error,
	objectLabel,
}: MetadataTableProps): JSX.Element {
	if (loading) {
		return (
			<div className="dbx-meta-state">
				<span className="icon-[lucide--loader] h-5 w-5 animate-spin text-muted-foreground" />
				<span className="text-[11px] text-muted-foreground">加载中…</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="dbx-meta-state">
				<span className="icon-[lucide--alert-circle] h-6 w-6 text-destructive" />
				<span className="max-w-full truncate text-[11px] text-destructive" title={error}>{error}</span>
			</div>
		);
	}
	if (unsupported) {
		return (
			<div className="dbx-meta-state">
				<span className="icon-[lucide--puzzle] h-7 w-7 text-muted-foreground/40" />
				<span className="text-[11px] text-muted-foreground">当前数据库类型暂不支持查看{objectLabel}</span>
			</div>
		);
	}
	if (rows.length === 0) {
		return (
			<div className="dbx-meta-state">
				<span className="icon-[lucide--inbox] h-7 w-7 text-muted-foreground/40" />
				<span className="text-[11px] text-muted-foreground">暂无{objectLabel}</span>
			</div>
		);
	}

	return (
		<div className="dbx-table-info-scroller min-h-0 flex-1 overflow-auto">
			<table className="dbx-columns-table w-full text-[12px]">
				<thead>
					<tr>
						{columns.map((col) => (
							<th key={col.key}>{col.label}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => (
						<tr key={index}>
							{columns.map((col) => (
								<td
									key={col.key}
									className={col.mono ? "dbx-meta-mono" : undefined}
									title={rowValue(row, col.key)}
								>
									<span className="block truncate">{rowValue(row, col.key) || "—"}</span>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
