import { useEffect, useMemo, useState } from "react";
import type { PluginActivityTabContext, PluginCommandApi } from "@astravia-org/plugin-sdk";
import {
	listConnections,
	executeQuery,
	listTables,
	describeTable,
	type DbConnection,
	type DbColumn,
	type DbTableInfo,
	type DbQueryResult,
} from "./db/dbx-cli";
import { DbSheet } from "./components/DbSheet";

type RunState =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "result"; data: DbQueryResult; elapsedMs: number }
	| { kind: "error"; message: string; code?: string };

export function DbxProPanel({ ctx }: { ctx: PluginActivityTabContext }) {
	const command = ctx.command as PluginCommandApi;

	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [activeConn, setActiveConn] = useState<string | null>(null);
	const [sql, setSql] = useState<string>("SELECT 1;");
	const [runState, setRunState] = useState<RunState>({ kind: "idle" });
	const [tables, setTables] = useState<DbTableInfo[]>([]);
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [columns, setColumns] = useState<DbColumn[]>([]);
	const [loading, setLoading] = useState(false);
	const [showManageSheet, setShowManageSheet] = useState(false);

	// 首次加载连接列表
	useEffect(() => {
		refreshConnections();
	}, []);

	// 切换连接时刷新表列表
	useEffect(() => {
		if (!activeConn) {
			setTables([]);
			setColumns([]);
			setSelectedTable(null);
			return;
		}
		refreshTables();
	}, [activeConn]);

	async function refreshConnections() {
		setLoading(true);
		try {
			const conns = await listConnections(command);
			setConnections(conns);
			if (conns.length > 0 && !activeConn) {
				setActiveConn(conns[0].name);
			} else if (activeConn && !conns.find((c) => c.name === activeConn)) {
				setActiveConn(conns[0]?.name ?? null);
			}
		} catch (err) {
			setRunState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
		} finally {
			setLoading(false);
		}
	}

	async function refreshTables() {
		if (!activeConn) return;
		try {
			const list = await listTables(command, activeConn);
			setTables(list);
		} catch {
			setTables([]);
		}
	}

	async function runQuery() {
		if (!activeConn) return;
		setRunState({ kind: "running" });
		const t0 = performance.now();
		try {
			const result = await executeQuery(command, activeConn, sql);
			const elapsed = Math.round(performance.now() - t0);
			setRunState({ kind: "result", data: result, elapsedMs: elapsed });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			// 尝试解析错误码
			const codeMatch = msg.match(/\[([A-Z_]+)\]/);
			setRunState({ kind: "error", message: msg, code: codeMatch?.[1] });
		}
	}

	async function pickTable(tableName: string) {
		setSelectedTable(tableName);
		if (!activeConn) return;
		try {
			const cols = await describeTable(command, activeConn, tableName);
			setColumns(cols);
		} catch {
			setColumns([]);
		}
	}

	function runSnippet(kind: "select" | "describe") {
		if (!activeConn) return;
		const table = selectedTable ?? "users";
		if (kind === "select") {
			setSql(`SELECT * FROM ${table} LIMIT 20;`);
		} else {
			setSql(`DESCRIBE ${table};`);
		}
	}

	return (
		<div className="dbx-panel">
			<DbSheet
				open={showManageSheet}
				onClose={() => setShowManageSheet(false)}
				onSaved={() => {
					setShowManageSheet(false);
					refreshConnections();
				}}
			/>

			{/* 顶栏 */}
			<div className="dbx-topbar">
				<select
					className="dbx-form-input"
					style={{ flex: "0 0 auto", width: 160 }}
					value={activeConn ?? ""}
					onChange={(e) => setActiveConn(e.target.value || null)}
					disabled={connections.length === 0}
				>
					{connections.length === 0 && <option value="">(无连接)</option>}
					{connections.map((c) => (
						<option key={c.name} value={c.name}>
							{c.name} — {c.type}
						</option>
					))}
				</select>
				<button className="dbx-btn primary" onClick={runQuery} disabled={!activeConn || runState.kind === "running"}>
					{runState.kind === "running" ? "执行中…" : "▶ 运行"}
				</button>
				<button className="dbx-btn ghost" onClick={() => runSnippet("select")} disabled={!activeConn}>
					⟳ SELECT * LIMIT 20
				</button>
				<button className="dbx-btn ghost" onClick={() => runSnippet("describe")} disabled={!activeConn}>
					⟳ DESCRIBE
				</button>
				<div style={{ flex: 1 }} />
				<button className="dbx-btn ghost" onClick={refreshConnections} disabled={loading}>
					🔄 刷新
				</button>
				<button className="dbx-btn ghost" onClick={() => setShowManageSheet(true)}>
					⚙️ 管理连接
				</button>
			</div>

			{/* 主体三栏 */}
			<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
				{/* 左栏：连接 + 表 */}
				<div className="dbx-sidebar">
					<div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, letterSpacing: "0.04em" }}>
						连接
					</div>
					<div style={{ flex: 1, overflowY: "auto" }}>
						{connections.length === 0 && (
							<div className="dbx-empty" style={{ padding: 12 }}>
								暂无连接 · 点右上「管理连接」
							</div>
						)}
						{connections.map((c) => (
							<div
								key={c.name}
								className={`dbx-connection-item ${activeConn === c.name ? "active" : ""}`}
								onClick={() => setActiveConn(c.name)}
								title={`${c.host}:${c.port} · ${c.database ?? "(默认)"}`}
							>
								<span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{c.type}</span>
								<span>{c.name}</span>
							</div>
						))}
					</div>
					{activeConn && (
						<>
							<div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, borderTop: "1px solid var(--border)", letterSpacing: "0.04em" }}>
								表 · {tables.length}
							</div>
							<div style={{ flex: 1, overflowY: "auto" }}>
								{tables.length === 0 && (
									<div className="dbx-empty" style={{ padding: 12 }}>无表</div>
								)}
								{tables.map((t) => (
									<div
										key={t.name}
										className={`dbx-connection-item ${selectedTable === t.name ? "active" : ""}`}
										onClick={() => pickTable(t.name)}
										title={t.table_type}
									>
										<span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{t.table_type}</span>
										<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
									</div>
								))}
							</div>
						</>
					)}
				</div>

				{/* 右栏：SQL 编辑器 + 结果 + 字段预览 */}
				<div className="dbx-main">
					<div className="dbx-editor-wrap" style={{ height: "40%" }}>
						<textarea
							className="dbx-editor"
							value={sql}
							onChange={(e) => setSql(e.target.value)}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
									e.preventDefault();
									runQuery();
								}
							}}
							placeholder="SELECT * FROM users LIMIT 20;"
							spellCheck={false}
						/>
						<div style={{
							position: "absolute", bottom: 6, right: 10,
							fontSize: 11, color: "var(--muted-foreground)",
						}}>
							⌘/Ctrl + Enter 执行
						</div>
					</div>

					{runState.kind === "error" && (
						<div className="dbx-error">
							{runState.code && <div style={{ fontWeight: 600, marginBottom: 4 }}>Error [{runState.code}]</div>}
							{runState.message}
						</div>
					)}

					{runState.kind === "running" && (
						<div className="dbx-empty" style={{ padding: 16 }}>⏳ 执行中…</div>
					)}

					{runState.kind === "result" && (
						<div className="dbx-result">
							<div style={{
								padding: "6px 12px",
								fontSize: 12,
								color: "var(--muted-foreground)",
								borderBottom: "1px solid var(--border)",
								display: "flex",
								justifyContent: "space-between",
							}}>
								<span>结果 · {runState.data.row_count} 行</span>
								<span>{runState.elapsedMs}ms</span>
							</div>
							<ResultGrid columns={runState.data.columns} rows={runState.data.rows} />
						</div>
					)}

					{runState.kind === "idle" && columns.length > 0 && (
						<div className="dbx-result">
							<div style={{
								padding: "6px 12px",
								fontSize: 12,
								color: "var(--muted-foreground)",
								borderBottom: "1px solid var(--border)",
							}}>
								表结构 · {selectedTable}
							</div>
							<table>
								<thead>
									<tr>
										<th>Column</th>
										<th>Type</th>
										<th>Nullable</th>
										<th>PK</th>
										<th>Default</th>
										<th>Comment</th>
									</tr>
								</thead>
								<tbody>
									{columns.map((c) => (
										<tr key={c.name}>
											<td style={{ fontWeight: c.is_primary_key ? 600 : 400 }}>{c.name}</td>
											<td>{c.data_type}</td>
											<td>{c.is_nullable ? "YES" : "NO"}</td>
											<td>{c.is_primary_key ? "●" : ""}</td>
											<td>{c.column_default ?? ""}</td>
											<td>{c.comment ?? ""}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{runState.kind === "idle" && columns.length === 0 && (
						<div className="dbx-empty">⌘Enter 执行 SQL，或点左侧表名预览结构</div>
					)}
				</div>
			</div>
		</div>
	);
}

/** 结果表格：把 records 的所有列做 columns 并渲染 */
function ResultGrid({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
	// 如果列名来自 dbx JSON 的 columns 字段，直接用；否则从 rows 推断
	const cols = columns.length > 0
		? columns
		: useMemo(() => Array.from(new Set(rows.flatMap((r) => Object.keys(r)))), [rows]);
	if (cols.length === 0) {
		return <div className="dbx-empty" style={{ padding: 16 }}>0 行</div>;
	}
	return (
		<table>
			<thead>
				<tr>
					<th style={{ width: 40, color: "var(--muted-foreground)" }}>#</th>
					{cols.map((c) => (
						<th key={c}>{c}</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, i) => (
					<tr key={i}>
						<td style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{i + 1}</td>
						{cols.map((c) => (
							<td key={c} style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{formatCell(row[c])}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function formatCell(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "object") {
		try { return JSON.stringify(v); } catch { return String(v); }
	}
	return String(v);
}
