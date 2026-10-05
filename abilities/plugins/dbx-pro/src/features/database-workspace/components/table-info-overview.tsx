/**
 * 表属性 · 表信息页签 — 对齐 dbx 桌面壳的 label/value 行布局：
 * 定宽标签列 + 整行可选中的值，单列铺满（非卡片网格）。
 */

import type { JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";
import type { TableInfoSelection } from "./table-info-panel";

export function TableInfoOverview({
	selection,
	columns,
}: {
	selection: TableInfoSelection;
	columns: EngineColumn[];
}): JSX.Element {
	const primaryKeyCount = columns.filter((c) => c.isPrimaryKey).length;
	const nullableCount = columns.filter((c) => c.nullable).length;
	const withDefaultCount = columns.filter((c) => c.hasDefault).length;

	const rows: { label: string; value: string }[] = [
		{ label: "表名", value: selection.tableName },
		{ label: "Schema", value: selection.schema || "(默认)" },
		{ label: "连接", value: selection.connectionName },
		{ label: "列数", value: String(columns.length) },
		{ label: "主键列", value: String(primaryKeyCount) },
		{ label: "可空列", value: String(nullableCount) },
		{ label: "有默认值", value: String(withDefaultCount) },
	];

	return (
		<div className="dbx-info-rows">
			{rows.map((row) => (
				<div key={row.label} className="dbx-info-row">
					<span className="dbx-info-label">{row.label}</span>
					<span className="dbx-info-value" title={row.value}>{row.value}</span>
				</div>
			))}
		</div>
	);
}
