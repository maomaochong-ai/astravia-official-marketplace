/**
 * 查询结果表格 — 基础网格 + inline cell editing。
 *
 * 底层实现为原生 <table>，列数无上限、行数由外层分页控制。
 * 双击单元格进入编辑态，Enter 确认 / Esc 取消。主键列标记 🔑。
 */

import { useState } from "react";

interface Props {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	highlightKeyword?: string;
	primaryKeys?: string[];
	onEditCell?: (row: Record<string, unknown>, column: string, newValue: unknown) => void;
	onDeleteRow?: (row: Record<string, unknown>) => void;
	onAddRow?: () => void;
}

export function ResultGrid({
	columns, rows, totalRows, highlightKeyword, primaryKeys,
	onEditCell, onDeleteRow, onAddRow,
}: Props) {
	const [editing, setEditing] = useState<{ rowIdx: number; col: string } | null>(null);
	const [editVal, setEditVal] = useState("");

	const canEdit = !!onEditCell;
	const canDelete = !!onDeleteRow && !!primaryKeys && primaryKeys.length > 0;

	const colList = columns.length > 0
		? columns
		: Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

	if (colList.length === 0 || totalRows === 0) {
		return (
			<div className="dbx-empty" style={{ flex: 1, flexDirection: "column", gap: 12 }}>
				<div>0 行（affected rows: {totalRows}）</div>
				{onAddRow && (
					<button className="dbx-btn primary" onClick={onAddRow}>+ 新增行</button>
				)}
			</div>
		);
	}

	function startEdit(rowIdx: number, col: string, val: unknown) {
		if (!canEdit) return;
		if (primaryKeys?.includes(col)) return;
		setEditing({ rowIdx, col });
		setEditVal(val === null || val === undefined ? "" : String(val));
	}

	function commitEdit() {
		if (!editing) return;
		const row = rows[editing.rowIdx];
		const oldVal = row[editing.col];
		let newVal: unknown = editVal;
		if (oldVal === null || oldVal === undefined) {
			newVal = editVal === "" ? null : editVal;
		} else if (typeof oldVal === "number") {
			const n = Number(editVal);
			newVal = Number.isNaN(n) ? editVal : n;
		} else if (typeof oldVal === "boolean") {
			newVal = editVal.toLowerCase() === "true" || editVal === "1";
		}
		onEditCell!(row, editing.col, newVal);
		setEditing(null);
	}

	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			{onAddRow && (
				<div style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>
					<button className="dbx-btn ghost" onClick={onAddRow} style={{ fontSize: 11, padding: "2px 8px" }}>
						+ 新增行
					</button>
				</div>
			)}
			<table>
				<thead>
					<tr>
						<th style={{ width: 32, color: "var(--muted-foreground)", fontSize: 11 }}>#</th>
						{canDelete && <th style={{ width: 36 }} />}
						{colList.map((c) => (
							<th key={c} title={c} style={{ minWidth: 100 }}>
								{primaryKeys?.includes(c) && <span style={{ color: "#dc2626", marginRight: 2 }}>🔑</span>}
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => (
						<tr key={i}>
							<td style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{i + 1}</td>
							{canDelete && (
								<td style={{ textAlign: "center", padding: "2px 4px" }}>
									<button
										className="dbx-btn ghost"
										onClick={() => onDeleteRow!(row)}
										style={{ padding: "0 4px", fontSize: 13, color: "#dc2626", border: "none" }}
										title="删除此行"
									>🗑</button>
								</td>
							)}
							{colList.map((c) => {
								const isEditing = editing?.rowIdx === i && editing?.col === c;
								const isPkCol = primaryKeys?.includes(c);
								return (
									<td
										key={c}
										title={String(row[c] ?? "NULL")}
										onDoubleClick={() => startEdit(i, c, row[c])}
										style={{
											cursor: canEdit && !isPkCol ? "pointer" : "default",
											background: isEditing ? "rgba(0,0,0,0.04)" : undefined,
										}}
									>
										{isEditing ? (
											<input
												autoFocus
												value={editVal}
												onChange={(e) => setEditVal(e.target.value)}
												onBlur={commitEdit}
												onKeyDown={(e) => {
													if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
													if (e.key === "Escape") { setEditing(null); }
												}}
												style={{
													width: "100%", minWidth: 60, padding: "1px 4px",
													fontSize: 12, border: "1px solid #b45309", borderRadius: 3,
													fontFamily: "inherit",
												}}
											/>
										) : (
											<CellDisplay value={row[c]} highlightKeyword={highlightKeyword} />
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function CellDisplay({ value, highlightKeyword }: { value: unknown; highlightKeyword?: string }) {
	if (value === null || value === undefined) {
		return <span style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>NULL</span>;
	}
	let text = typeof value === "object" ? JSON.stringify(value) : String(value);
	if (highlightKeyword) {
		const lower = highlightKeyword.toLowerCase();
		const idx = text.toLowerCase().indexOf(lower);
		if (idx >= 0) {
			return (
				<>
					{text.slice(0, idx)}
					<mark>{text.slice(idx, idx + highlightKeyword.length)}</mark>
					{text.slice(idx + highlightKeyword.length)}
				</>
			);
		}
	}
	return <>{text}</>;
}
