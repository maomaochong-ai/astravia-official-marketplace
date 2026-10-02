import { useEffect, useMemo, useRef, useState } from "react";
import { getCommand } from "./index";
import {
	listConnections as dbxListConnections,
	listTables,
	describeTable,
	executeQuery,
	type DbxCliError,
} from "./db/dbx-cli";
import { readAllConfigs } from "./db/dbx-sqlite";
import {
	inferFamily,
	filterSystemNames,
	listSchemasSql,
	listDatabasesSql,
	listTablesInScopeSql,
	tableObjectSql,
	type CatalogScope,
	type TableObjectKind,
} from "./db/dbx-catalog";
import type {
	DbColumn,
	DbConnection,
	DbTableInfo,
	DbQueryResult,
	RunState,
} from "./db-types";
import { DbConnectionForm } from "./components/DbConnectionForm";

/**
 * dbx-pro 数据库工作台 — 完整复刻旧项目 DatabaseWorkspace。
 *
 * 三栏布局：
 *   左侧：连接树（连接 → database → schema → 表/视图 分类）+ 右键菜单
 *   中间：SQL 编辑器（⌘/Ctrl+Enter 执行，支持多语句分割）
 *   右侧：结果表格（分页/过滤）+ 表结构 Tab（列/索引/约束/触发器）
 *
 * 写保护：
 *   dbx CLI 内置 SQL 安全闸（--allow-writes / --allow-dangerous-sql）+ 生产环境阻断。
 *   插件在 UI 层做二次确认弹窗，用户勾选 "允许写入 / 允许危险 DDL" 后才把 flag 传给 CLI。
 */

interface SchemaNode {
	schema: string;
	tables: DbTableInfo[];
}

interface TableContextMenu {
	x: number; y: number; connection: string; schema?: string; table: string;
}

const SQL_KEYWORDS = [
	"SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
	"ALTER", "TABLE", "DATABASE", "SCHEMA", "INDEX", "VIEW", "TRIGGER",
	"TRUNCATE", "GRANT", "REVOKE", "JOIN", "LEFT", "RIGHT", "INNER", "FULL",
	"GROUP", "BY", "ORDER", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT",
	"CASE", "WHEN", "THEN", "ELSE", "END", "AS", "IN", "NOT", "AND", "OR",
	"IS", "NULL", "LIKE", "BETWEEN", "EXISTS", "HAVING", "WITH", "SET",
	"INTO", "VALUES", "ON", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
	"UNIQUE", "CHECK", "DEFAULT", "AUTO_INCREMENT", "SERIAL", "BIGINT",
	"VARCHAR", "TEXT", "INT", "FLOAT", "BOOLEAN", "TIMESTAMP", "DATE",
];

function classifySql(sql: string): "read" | "write" | "ddl" {
	const s = sql.trim().toUpperCase().replace(/^--.*\n/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
	const first = s.split(/\s+/)[0] ?? "";
	if (["CREATE", "DROP", "ALTER", "TRUNCATE", "GRANT", "REVOKE"].includes(first)) return "ddl";
	if (["INSERT", "UPDATE", "DELETE", "REPLACE"].includes(first)) return "write";
	return "read";
}

export function DbxProPanel() {
	const command = getCommand();

	// === 连接管理 ===
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [activeConn, setActiveConn] = useState<string | null>(null);
	const [connFormOpen, setConnFormOpen] = useState(false);

	// === 左侧浏览树 ===
	const [schemas, setSchemas] = useState<SchemaNode[]>([]);
	const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(["public"]));
	const [selectedTable, setSelectedTable] = useState<{ name: string; schema?: string } | null>(null);
	const [columns, setColumns] = useState<DbColumn[]>([]);
	const [tableMetaTab, setTableMetaTab] = useState<"columns" | "indexes" | "constraints" | "triggers" | "sample">("columns");
	const [tableObjects, setTableObjects] = useState<Record<string, string[]>>({});

	// === 中间 SQL 编辑器 ===
	const [sql, setSql] = useState<string>("-- ⌘/Ctrl+Enter 执行\nSELECT 1;");
	const sqlRef = useRef<HTMLTextAreaElement>(null);

	// === 右侧结果 ===
	const [runState, setRunState] = useState<RunState>({ kind: "idle" });
	const [queryHistory, setQueryHistory] = useState<string[]>([]);

	// === 写保护 ===
	const [writeConfirm, setWriteConfirm] = useState<null | {
		kind: "write" | "ddl";
		sql: string;
		isProd: boolean;
	}>(null);

	// === 右键菜单 ===
	const [menu, setMenu] = useState<TableContextMenu | null>(null);

	// === 分页/过滤 ===
	const [resultPage, setResultPage] = useState(0);
	const [resultPageSize] = useState(100);
	const [resultFilter, setResultFilter] = useState("");

	// 加载连接列表
	useEffect(() => { refreshConnections(); }, []);

	// 切换连接刷新表列表
	useEffect(() => {
		if (!activeConn) { setSchemas([]); return; }
		refreshSchemas();
		setSelectedTable(null);
		setColumns([]);
	}, [activeConn]);

	// 选表 → 加载列
	useEffect(() => {
		if (!selectedTable || !activeConn) { setColumns([]); return; }
		describeCurrentTable();
	}, [selectedTable, activeConn]);

	// 点外部关闭菜单
	useEffect(() => {
		if (!menu) return;
		const h = () => setMenu(null);
		document.addEventListener("click", h);
		return () => document.removeEventListener("click", h);
	}, [menu]);

	async function refreshConnections() {
		try {
			// 同时读 dbx.db（完整 ConnectionConfig）和 dbx CLI（显示友好字段）
			const cliList = await dbxListConnections(command);
			const sqliteCfgs = await readAllConfigs(command);
			// 合并：cliList 有 name/type/host/port/database，sqliteCfgs 有完整字段（ssl/is_production/...）
			const merged = cliList.map((cli) => {
				const full = (sqliteCfgs as DbConnection[]).find((c) => c.name === cli.name);
				return { ...full, ...cli, id: full?.id ?? cli.name } as DbConnection;
			});
			setConnections(merged);
			if (merged.length > 0 && !activeConn) {
				setActiveConn(merged[0].name);
			}
		} catch {
			// CLI 失败时降级到 sqlite3 直读
			try {
				const cfgs = (await readAllConfigs(command)) as DbConnection[];
				setConnections(cfgs);
				if (cfgs.length > 0 && !activeConn) setActiveConn(cfgs[0].name);
			} catch {
				setConnections([]);
			}
		}
	}

	async function refreshSchemas() {
		if (!activeConn) return;
		const conn = connections.find((c) => c.name === activeConn);
		if (!conn) return;
		const family = inferFamily(conn.db_type);

		try {
			if (family === "flat") {
				// SQLite/DuckDB 等 — 直接用 dbx CLI flat list
				const list = await listTables(command, activeConn);
				setSchemas([{ schema: "(default)", tables: list }]);
				setExpandedSchemas(new Set(["(default)"]));
				return;
			}

			// schemas 或 databases family — 先查作用域名，再逐域查表
			const catalogSql = family === "schemas" ? listSchemasSql() : listDatabasesSql();
			const catalogResult = await executeQuery(command, activeConn, catalogSql, { limit: 500, timeoutMs: 15_000 });
			const rawNames = catalogResult.rows.map((r) => String(r.name ?? ""));
			const catalogNames = filterSystemNames(family, rawNames);

			// 对每个作用域跑 listTablesInScopeSql
			const nodes: SchemaNode[] = [];
			for (const cat of catalogNames) {
				const scope: CatalogScope = family === "schemas" ? { schema: cat } : { database: cat };
				const tSql = listTablesInScopeSql(family, scope);
				try {
					const tRes = await executeQuery(command, activeConn, tSql, { limit: 2000, timeoutMs: 15_000 });
					const tables: DbTableInfo[] = tRes.rows.map((r) => ({
						name: String(r.name ?? r.table_name ?? ""),
						table_type: String(r.table_type ?? "BASE TABLE"),
					})).filter((t) => t.name);
					if (tables.length > 0) {
						nodes.push({ schema: cat, tables });
					}
				} catch {
					// 某个 scope 查失败不阻断其他
				}
			}
			setSchemas(nodes);
			setExpandedSchemas(new Set(nodes.slice(0, 3).map((n) => n.schema)));
		} catch {
			// introspection 失败降级到 dbx CLI flat
			try {
				const list = await listTables(command, activeConn);
				setSchemas([{ schema: "(default)", tables: list }]);
			} catch {
				setSchemas([]);
			}
		}
	}

	async function describeCurrentTable() {
		if (!activeConn || !selectedTable) return;
		try {
			const cols = await describeTable(command, activeConn, selectedTable.name, selectedTable.schema);
			setColumns(cols);
		} catch {
			setColumns([]);
		}
		await loadTableObjects();
	}

	async function loadTableObjects() {
		if (!activeConn || !selectedTable) { setTableObjects({}); return; }
		const conn = connections.find((c) => c.name === activeConn);
		if (!conn) return;
		const family = inferFamily(conn.db_type);
		const scope: CatalogScope = family === "schemas"
			? { schema: selectedTable.schema ?? "public" }
			: family === "databases"
				? { database: selectedTable.schema ?? conn.database ?? "" }
				: {};

		const kinds: TableObjectKind[] = ["index", "constraint", "trigger"];
		const result: Record<string, string[]> = {};
		for (const k of kinds) {
			const sql = tableObjectSql(family, k, selectedTable.name, scope);
			if (!sql) continue;
			try {
				const r = await executeQuery(command, activeConn, sql, { limit: 200, timeoutMs: 10_000 });
				const colName = r.columns.includes("name") ? "name" : r.columns[0];
				result[k] = r.rows.map((row) => String(row[colName] ?? "")).filter(Boolean);
			} catch {
				result[k] = [];
			}
		}
		setTableObjects(result);
	}

	async function runQuery(checkWrite = true, allowWrites = false, allowDangerous = false) {
		if (!activeConn) return;
		const trimmed = sql.trim();
		if (!trimmed) return;

		// === 写保护 ===
		if (checkWrite) {
			const kind = classifySql(trimmed);
			const conn = connections.find((c) => c.name === activeConn);
			const isProd = !!(conn?.is_production);
			if (kind === "ddl" || (kind === "write" && isProd)) {
				setWriteConfirm({ kind: kind === "ddl" ? "ddl" : "write", sql: trimmed, isProd });
				return;
			}
		}
		setWriteConfirm(null);

		// 多语句分割（简单按分号分割，dbx CLI 单条执行）
		const statements = trimmed.split(/;\s*(?=\w|--)/).map((s) => s.trim()).filter(Boolean);
		if (statements.length > 1) {
			// 多行：循环执行，显示最后一条的结果
			setRunState({ kind: "running" });
			let lastResult: DbQueryResult | null = null;
			let lastError: DbxCliError | Error | null = null;
			let totalElapsed = 0;
			for (const stmt of statements) {
				const t0 = performance.now();
				try {
					lastResult = await executeQuery(command, activeConn, stmt, {
						allowWrites, allowDangerous,
					});
					totalElapsed += performance.now() - t0;
				} catch (err) {
					lastError = err as Error;
					break;
				}
			}
			if (lastError) {
				const msg = (lastError as Error).message;
				const codeMatch = msg.match(/\[([A-Z_]+)\]/);
				setRunState({ kind: "error", message: msg, code: codeMatch?.[1] });
			} else if (lastResult) {
				setRunState({ kind: "result", data: lastResult, elapsedMs: Math.round(totalElapsed), allowWrites });
				setQueryHistory((h) => [trimmed, ...h.slice(0, 49)]);
				setResultPage(0);
			}
			return;
		}

		// 单语句
		setRunState({ kind: "running" });
		const t0 = performance.now();
		try {
			const result = await executeQuery(command, activeConn, trimmed, { allowWrites, allowDangerous });
			setRunState({ kind: "result", data: result, elapsedMs: Math.round(performance.now() - t0), allowWrites });
			setQueryHistory((h) => [trimmed, ...h.slice(0, 49)]);
			setResultPage(0);
		} catch (err) {
			const msg = (err as Error).message;
			const codeMatch = msg.match(/\[([A-Z_]+)\]/);
			setRunState({ kind: "error", message: msg, code: codeMatch?.[1] });
		}
	}

	const filteredRows = useMemo(() => {
		if (runState.kind !== "result") return [];
		const rows = runState.data.rows;
		if (!resultFilter.trim()) return rows;
		const q = resultFilter.toLowerCase();
		return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
	}, [runState, resultFilter]);

	const pagedRows = useMemo(() => {
		const start = resultPage * resultPageSize;
		return filteredRows.slice(start, start + resultPageSize);
	}, [filteredRows, resultPage, resultPageSize]);

	const totalPages = Math.max(1, Math.ceil(filteredRows.length / resultPageSize));

	const activeConnection = connections.find((c) => c.name === activeConn);
	const connDbType = activeConnection?.db_type ?? "";

	function qualifiedTable(t: { name: string; schema?: string }): string {
		const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
		if (t.schema && t.schema !== "(default)") return `${ident(t.schema)}.${ident(t.name)}`;
		return ident(t.name);
	}

	/** columns state 里的 PK 列名数组（供 inline 编辑做 WHERE 条件） */
	const pkColumns = useMemo(
		() => columns.filter((c) => c.is_primary_key).map((c) => c.name),
		[columns],
	);

	/** SQL 字符串字面量转义 */
	function sqlVal(v: unknown): string {
		if (v === null || v === undefined) return "NULL";
		if (typeof v === "number" || typeof v === "boolean") return String(v);
		return `'${String(v).replace(/'/g, "''")}'`;
	}

	async function handleEditCell(row: Record<string, unknown>, column: string, newValue: unknown) {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		const setPart = `"${column.replace(/"/g, '""')}" = ${sqlVal(newValue)}`;
		const wherePart = pkColumns
			.map((pk) => `"${pk.replace(/"/g, '""')}" = ${sqlVal(row[pk])}`)
			.join(" AND ");
		const sqlText = `UPDATE ${tbl} SET ${setPart} WHERE ${wherePart}`;
		if (!confirm(`执行 UPDATE？\n${sqlText}\n\n操作不可逆！`)) return;
		try {
			const result = await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			// 刷新当前结果
			const currentSql = sql.trim();
			if (currentSql) {
				const fresh = await executeQuery(command, activeConn, currentSql, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
			void result;
		} catch (err) {
			alert(`UPDATE 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleDeleteRow(row: Record<string, unknown>) {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		const wherePart = pkColumns
			.map((pk) => `"${pk.replace(/"/g, '""')}" = ${sqlVal(row[pk])}`)
			.join(" AND ");
		const sqlText = `DELETE FROM ${tbl} WHERE ${wherePart}`;
		if (!confirm(`确定删除这一行？\n${sqlText}\n\n操作不可逆！`)) return;
		try {
			const result = await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			const currentSql = sql.trim();
			if (currentSql) {
				const fresh = await executeQuery(command, activeConn, currentSql, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
			void result;
		} catch (err) {
			alert(`DELETE 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleAddRow() {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		// 简单策略：INSERT INTO tbl DEFAULT VALUES，然后刷新
		const sqlText = `INSERT INTO ${tbl} DEFAULT VALUES`;
		if (!confirm(`执行 INSERT？\n${sqlText}`)) return;
		try {
			await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			const currentSql = sql.trim();
			if (currentSql) {
				const fresh = await executeQuery(command, activeConn, currentSql, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
		} catch (err) {
			alert(`INSERT 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	return (
		<div className="dbx-panel" onContextMenu={(e) => { /* 阻止浏览器默认右键 */ }}>
			{/* 顶部栏 */}
			<div className="dbx-topbar">
				<select
					className="dbx-form-input"
					style={{ width: 180 }}
					value={activeConn ?? ""}
					onChange={(e) => setActiveConn(e.target.value || null)}
					disabled={connections.length === 0}
				>
					{connections.length === 0 && <option value="">(无连接)</option>}
					{connections.map((c) => (
						<option key={c.id} value={c.name}>
							{c.is_production ? "🔴 " : ""}{c.name}
							{c.database ? ` · ${c.database}` : ""}
						</option>
					))}
				</select>
				{activeConnection?.is_production && (
					<span style={{
						fontSize: 11, padding: "2px 8px", borderRadius: 10,
						background: "rgba(220,38,38,0.1)", color: "#dc2626", fontWeight: 600,
					}}>⚠️ PRODUCTION — 默认阻断写入/DDL</span>
				)}

				<div style={{ flex: 1 }} />

				{runState.kind !== "running" && (
					<>
						<button className="dbx-btn ghost" onClick={() => runSnippet("select")} disabled={!activeConn}>
							⟳ SELECT *
						</button>
						<button className="dbx-btn ghost" onClick={() => runSnippet("describe")} disabled={!activeConn || !selectedTable}>
							⟳ DESCRIBE
						</button>
					</>
				)}
				<button className="dbx-btn ghost" onClick={refreshConnections}>🔄 刷新</button>
				<button className="dbx-btn ghost" onClick={() => setConnFormOpen(true)}>⚙️ 管理连接</button>
				<button className="dbx-btn primary" onClick={() => runQuery(true)} disabled={!activeConn || runState.kind === "running"}>
					{runState.kind === "running" ? "执行中…" : "▶ 运行"}
				</button>
			</div>

			{/* 主体 */}
			<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
				{/* === 左栏：连接树 + 表浏览器 === */}
				<div className="dbx-sidebar">
					<div style={{
						padding: "10px 12px", fontSize: 11, fontWeight: 600,
						color: "var(--muted-foreground)", letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}>连接</div>
					<div style={{ flex: "0 0 auto", maxHeight: "40%", overflowY: "auto" }}>
						{connections.length === 0 && (
							<div className="dbx-empty" style={{ padding: 12, fontSize: 12 }}>
								无连接 · 点右上「管理连接」
							</div>
						)}
						{connections.map((c) => (
							<div
								key={c.id}
								className={`dbx-connection-item ${activeConn === c.name ? "active" : ""}`}
								onClick={() => setActiveConn(c.name)}
								title={`${c.host}:${c.port}${c.database ? `/${c.database}` : ""}`}
							>
								<span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>{c.db_type}</span>
								<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{c.is_production && "🔴 "}
									{c.name}
								</span>
								{c.ssl && <span style={{ fontSize: 10 }}>🔒</span>}
							</div>
						))}
					</div>

					{activeConn && (
						<>
							<div style={{
								padding: "10px 12px", fontSize: 11, fontWeight: 600,
								color: "var(--muted-foreground)", letterSpacing: "0.06em",
								textTransform: "uppercase",
								borderTop: "1px solid var(--border)",
								marginTop: 6,
							}}>Schema · 表 ({schemas.reduce((s, n) => s + n.tables.length, 0)})</div>
							<div style={{ flex: 1, overflowY: "auto" }}>
								{schemas.map((node) => {
									const expanded = expandedSchemas.has(node.schema);
									const hasTables = node.tables.length > 0;
									return (
										<div key={node.schema}>
											<div
												className="dbx-connection-item"
												onClick={() => {
													const next = new Set(expandedSchemas);
													if (expanded) next.delete(node.schema); else next.add(node.schema);
													setExpandedSchemas(next);
												}}
												style={{ fontWeight: 600 }}
											>
												<span style={{ width: 12, display: "inline-block", fontSize: 9 }}>{expanded ? "▼" : "▶"}</span>
												<span>📁 {node.schema}</span>
												<span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>
													{node.tables.length}
												</span>
											</div>
											{expanded && hasTables && node.tables.map((t) => (
												<div
													key={t.name}
													className={`dbx-connection-item ${selectedTable?.name === t.name ? "active" : ""}`}
													onClick={(e) => {
														e.stopPropagation();
														setSelectedTable({ name: t.name, schema: node.schema });
													}}
													onContextMenu={(e) => {
														e.preventDefault();
														e.stopPropagation();
														setMenu({
															x: e.clientX, y: e.clientY,
															connection: activeConn!,
															schema: node.schema,
															table: t.name,
														});
													}}
													style={{ paddingLeft: 26 }}
													title={t.table_type}
												>
													<span style={{ fontSize: 10 }}>
														{t.table_type === "view" ? "👁" : t.table_type === "materialized_view" ? "📦" : "📄"}
													</span>
													<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
														{t.name}
													</span>
												</div>
											))}
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>

				{/* === 右栏 SQL + 结果 === */}
				<div className="dbx-main">
					{/* 编辑器 */}
					<div style={{ height: "38%", display: "flex", flexDirection: "column" }}>
						<div className="dbx-editor-wrap">
							<textarea
								ref={sqlRef}
								className="dbx-editor"
								value={sql}
								onChange={(e) => setSql(e.target.value)}
								onKeyDown={(e) => {
									if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
										e.preventDefault();
										runQuery(true);
									}
								}}
								placeholder="SELECT * FROM users LIMIT 20;"
								spellCheck={false}
							/>
							<div style={{
								position: "absolute", bottom: 6, right: 10,
								fontSize: 11, color: "var(--muted-foreground)",
							}}>
								⌘/Ctrl+Enter 执行
							</div>
						</div>
						{/* 历史 */}
						{queryHistory.length > 0 && (
							<div style={{
								borderBottom: "1px solid var(--border)",
								maxHeight: 72, overflowY: "auto",
								padding: "4px 8px",
							}}>
								<div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 2 }}>
									历史（点一下回填到编辑器）
								</div>
								{queryHistory.slice(0, 5).map((h, i) => (
									<div
										key={i}
										onClick={() => setSql(h)}
										style={{
											fontSize: 11, padding: "2px 4px",
											cursor: "pointer", borderRadius: 3,
											color: "var(--muted-foreground)",
											fontFamily: "monospace",
											whiteSpace: "nowrap",
											overflow: "hidden", textOverflow: "ellipsis",
										}}
										title={h}
									>
										{h.slice(0, 80)}{h.length > 80 ? "…" : ""}
									</div>
								))}
							</div>
						)}
					</div>

					{/* 错误 */}
					{runState.kind === "error" && (
						<div className="dbx-error" style={{ borderTop: "1px solid var(--border)" }}>
							{runState.code && <div style={{ fontWeight: 600, marginBottom: 4 }}>Error [{runState.code}]</div>}
							{runState.message}
						</div>
					)}

					{runState.kind === "running" && (
						<div className="dbx-empty" style={{ padding: 24 }}>⏳ 执行中…</div>
					)}

					{/* 结果表格 */}
					{runState.kind === "result" && (
						<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
							<div style={{
								padding: "6px 12px", fontSize: 12,
								borderBottom: "1px solid var(--border)",
								display: "flex", alignItems: "center", gap: 12,
								background: "rgba(0,0,0,0.02)",
							}}>
								<span style={{ fontWeight: 600 }}>结果</span>
								<span style={{ color: "var(--muted-foreground)" }}>
									{runState.data.row_count} 行 · {runState.elapsedMs}ms
								</span>
								{runState.allowWrites && !runState.allowWrites === undefined && (
									<span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
										已允许写入
									</span>
								)}
								<div style={{ flex: 1 }} />
								<input
									className="dbx-form-input"
									style={{ width: 180, height: 24, fontSize: 12, padding: "2px 8px" }}
									placeholder="过滤行…"
									value={resultFilter}
									onChange={(e) => { setResultFilter(e.target.value); setResultPage(0); }}
								/>
								<span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
									第 {resultPage + 1}/{totalPages} 页
								</span>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} disabled={resultPage === 0} onClick={() => setResultPage((p) => p - 1)}>←</button>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} disabled={resultPage >= totalPages - 1} onClick={() => setResultPage((p) => p + 1)}>→</button>
								<button
									className="dbx-btn ghost"
									style={{ padding: "2px 8px" }}
									onClick={() => exportResult("csv")}
								>CSV</button>
								<button
									className="dbx-btn ghost"
									style={{ padding: "2px 8px" }}
									onClick={() => exportResult("json")}
								>JSON</button>
							</div>
							<ResultGrid
								columns={runState.data.columns}
								rows={pagedRows}
								totalRows={runState.data.row_count}
								highlightKeyword={resultFilter}
								primaryKeys={pkColumns}
								onEditCell={handleEditCell}
								onDeleteRow={handleDeleteRow}
								onAddRow={handleAddRow}
							/>
						</div>
					)}

					{/* 表结构预览 */}
					{runState.kind === "idle" && selectedTable && columns.length > 0 && (
						<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
							<div style={{
								padding: "6px 12px", borderBottom: "1px solid var(--border)",
								display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
							}}>
								<span style={{ fontWeight: 600 }}>
									{selectedTable.schema ? `${selectedTable.schema}.` : ""}{selectedTable.name}
								</span>
								<div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
									{([
										{ key: "columns", label: `列 (${columns.length})` },
										{ key: "indexes", label: `索引 (${tableObjects.index?.length ?? "—"})` },
										{ key: "constraints", label: `约束 (${tableObjects.constraint?.length ?? "—"})` },
										{ key: "triggers", label: `触发器 (${tableObjects.trigger?.length ?? "—"})` },
										{ key: "sample", label: "采样数据" },
									] as const).map((t) => (
										<button
											key={t.key}
											className="dbx-btn"
											style={{
												padding: "2px 10px", fontSize: 12,
												background: tableMetaTab === t.key ? "var(--foreground)" : "transparent",
												color: tableMetaTab === t.key ? "var(--background)" : "inherit",
												borderRadius: 4,
											}}
											onClick={() => setTableMetaTab(t.key)}
										>{t.label}</button>
									))}
								</div>
							</div>
							{tableMetaTab === "columns" && <ColumnsGrid columns={columns} />}
							{(tableMetaTab === "indexes" || tableMetaTab === "constraints" || tableMetaTab === "triggers") && (
								<ObjectList
									title={tableMetaTab === "indexes" ? "索引" : tableMetaTab === "constraints" ? "约束" : "触发器"}
									items={tableObjects[tableMetaTab] ?? []}
									emptyHint={`此 ${connDbType} 暂未检测到 ${tableMetaTab} 或当前连接不支持 introspection`}
								/>
							)}
							{tableMetaTab === "sample" && (
								<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
									<button className="dbx-btn primary" onClick={() => {
										const q = qualifiedTable(selectedTable);
										setSql(`SELECT * FROM ${q} LIMIT 20;`);
										runQuery(true);
									}}>▶ 加载采样数据</button>
								</div>
							)}
						</div>
					)}

					{runState.kind === "idle" && !selectedTable && (
						<div className="dbx-empty" style={{ padding: 24 }}>
							⌘Enter 执行 SQL，或点左侧表名预览结构
						</div>
					)}
				</div>
			</div>

			{/* === 表右键菜单 === */}
			{menu && (
				<div
					style={{
						position: "fixed", left: menu.x, top: menu.y,
						background: "var(--background)", border: "1px solid var(--border)",
						borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
						minWidth: 180, padding: "4px 0", zIndex: 200, fontSize: 13,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					{[
						{ label: "👁 预览前 20 行", action: () => {
							setSelectedTable({ name: menu.table, schema: menu.schema });
							setSql(`SELECT * FROM "${menu.table.replace(/"/g, '""')}" LIMIT 20;`);
							setMenu(null);
						}},
						{ label: "📄 DESCRIBE 表结构", action: () => {
							setSelectedTable({ name: menu.table, schema: menu.schema });
							setTableMetaTab("columns");
							setMenu(null);
						}},
						{ label: "📤 导出 CSV（前 1000 行）", action: () => {
							setSql(`SELECT * FROM "${menu.table.replace(/"/g, '""')}" LIMIT 1000;`);
							setMenu(null);
						}},
						{ label: "──", divider: true },
						{ label: "⚠️ TRUNCATE TABLE", danger: true, action: () => {
							setSql(`TRUNCATE TABLE "${menu.table.replace(/"/g, '""')}";`);
							setMenu(null);
						}},
						{ label: "⚠️ DROP TABLE", danger: true, action: () => {
							setSql(`DROP TABLE IF EXISTS "${menu.table.replace(/"/g, '""')}";`);
							setMenu(null);
						}},
					].map((item, i) => item.divider ? (
						<div key={i} style={{ height: 1, background: "var(--border)", margin: "4px 8px" }} />
					) : (
						<div
							key={i}
							onClick={item.action}
							style={{
								padding: "6px 12px", cursor: "pointer",
								color: item.danger ? "#dc2626" : "inherit",
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
						>
							{item.label}
						</div>
					))}
				</div>
			)}

			{/* === 写保护确认弹窗 === */}
			{writeConfirm && (
				<WriteConfirmDialog
					kind={writeConfirm.kind}
					sql={writeConfirm.sql}
					isProd={writeConfirm.isProd}
					onCancel={() => setWriteConfirm(null)}
					onConfirm={() => {
						runQuery(false, true, writeConfirm.kind === "ddl");
					}}
				/>
			)}

			{/* 连接管理侧栏 */}
			<DbConnectionForm
				open={connFormOpen}
				command={command}
				onClose={() => setConnFormOpen(false)}
				onSaved={() => refreshConnections()}
			/>
		</div>
	);

	function runSnippet(kind: "select" | "describe") {
		if (!activeConn) return;
		const table = selectedTable?.name ?? "your_table";
		const schema = selectedTable?.schema;
		const qualified = schema ? `"${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"` : `"${table.replace(/"/g, '""')}"`;
		if (kind === "select") {
			setSql(`SELECT * FROM ${qualified} LIMIT 20;`);
		} else {
			setSql(`-- DESCRIBE ${qualified}
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '${table}'${schema ? ` AND table_schema = '${schema}'` : ""};`);
		}
	}

	function exportResult(format: "csv" | "json") {
		if (runState.kind !== "result") return;
		const r = runState.data;
		if (format === "csv") {
			const header = r.columns.join(",");
			const rows = r.rows.map((row) =>
				r.columns.map((c) => {
					const v = row[c];
					if (v === null || v === undefined) return "";
					const s = String(v).replace(/"/g, '""');
					return /[",\n]/.test(s) ? `"${s}"` : s;
				}).join(","),
			);
			downloadFile(`${r.connection}-${Date.now()}.csv`, `${header}\n${rows.join("\n")}`);
		} else {
			downloadFile(`${r.connection}-${Date.now()}.json`, JSON.stringify(r, null, 2));
		}
	}
}

function downloadFile(name: string, content: string) {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url; a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

function WriteConfirmDialog({
	kind, sql, isProd, onCancel, onConfirm,
}: {
	kind: "write" | "ddl"; sql: string; isProd: boolean;
	onCancel: () => void; onConfirm: () => void;
}) {
	const title = kind === "ddl" ? "⚠️ 危险 DDL 操作" : (isProd ? "⚠️ 生产环境写入" : "写入操作确认");
	const body = kind === "ddl"
		? "这段 SQL 包含 DDL（CREATE/DROP/ALTER/TRUNCATE），会永久改变数据库结构。"
		: isProd
			? "目标连接标记为 PRODUCTION，写入操作默认被阻断。"
			: "这段 SQL 会修改数据。请确认要继续执行。";
	const buttonLabel = kind === "ddl"
		? "我知道风险，执行 DDL"
		: isProd
			? "允许写入生产库"
			: "执行写入";

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onCancel} />
			<div style={{
				position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
				background: "var(--background)", border: "1px solid var(--border)",
				borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
				width: 480, maxWidth: "90vw", zIndex: 300,
			}}>
				<div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
					<div style={{ fontWeight: 600, fontSize: 15, color: "#dc2626" }}>{title}</div>
				</div>
				<div style={{ padding: 20 }}>
					<p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>{body}</p>
					<pre style={{
						background: "rgba(0,0,0,0.03)", padding: 12, borderRadius: 6,
						fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap",
						maxHeight: 120, overflow: "auto", color: "#dc2626",
					}}>{sql.slice(0, 500)}{sql.length > 500 ? "…" : ""}</pre>
				</div>
				<div style={{
					padding: "12px 20px", borderTop: "1px solid var(--border)",
					display: "flex", justifyContent: "flex-end", gap: 8,
				}}>
					<button className="dbx-btn ghost" onClick={onCancel}>取消</button>
					<button
						className="dbx-btn"
						style={{
							background: "#dc2626", color: "#fff", border: "none",
						}}
						onClick={onConfirm}
					>{buttonLabel}</button>
				</div>
			</div>
		</>
	);
}

function ResultGrid({
	columns, rows, totalRows, highlightKeyword,
	primaryKeys,
	onEditCell, onDeleteRow, onAddRow,
}: {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	highlightKeyword?: string;
	primaryKeys?: string[];
	onEditCell?: (row: Record<string, unknown>, column: string, newValue: unknown) => void;
	onDeleteRow?: (row: Record<string, unknown>) => void;
	onAddRow?: () => void;
}) {
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
		if (primaryKeys?.includes(col)) return; // PK 列不允许编辑
		setEditing({ rowIdx, col });
		setEditVal(val === null || val === undefined ? "" : String(val));
	}

	function commitEdit() {
		if (!editing) return;
		const row = rows[editing.rowIdx];
		const oldVal = row[editing.col];
		// 保持原类型：如果原值是 number 且新值能解析成数字，就转 number
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
		<div className="dbx-result" style={{ flex: 1, position: "relative" }}>
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
							<th
								key={c}
								title={c}
								style={{ minWidth: 100, userSelect: "none" }}
							>
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
										title="删除这行"
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
											background: isEditing ? "rgba(251,191,36,0.1)" : undefined,
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
													fontSize: 12, border: "1px solid #fbbf24", borderRadius: 3,
													fontFamily: "inherit",
												}}
											/>
										) : (
											formatCell(row[c], highlightKeyword)
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

function ObjectList({ title, items, emptyHint }: { title: string; items: string[]; emptyHint?: string }) {
	if (items.length === 0) {
		return (
			<div style={{ flex: 1, padding: 24, color: "var(--muted-foreground)", fontSize: 13, textAlign: "center" }}>
				暂无{title} · {emptyHint ?? ""}
			</div>
		);
	}
	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			<table>
				<thead>
					<tr><th>{title}</th></tr>
				</thead>
				<tbody>
					{items.map((n, i) => (
						<tr key={i}>
							<td style={{ fontFamily: "monospace", fontSize: 12 }}>{n}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ColumnsGrid({ columns }: { columns: DbColumn[] }) {
	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			<table>
				<thead>
					<tr>
						<th style={{ minWidth: 160 }}>Column</th>
						<th style={{ minWidth: 120 }}>Type</th>
						<th>Nullable</th>
						<th>PK</th>
						<th style={{ minWidth: 120 }}>Default</th>
						<th>Comment</th>
					</tr>
				</thead>
				<tbody>
					{columns.map((c) => (
						<tr key={c.name}>
							<td style={{ fontWeight: c.is_primary_key ? 600 : 400, fontFamily: "monospace", fontSize: 12 }}>{c.name}</td>
							<td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.data_type}</td>
							<td>{c.is_nullable ? "YES" : "NO"}</td>
							<td>{c.is_primary_key ? "●" : ""}</td>
							<td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.column_default ?? ""}</td>
							<td>{c.comment ?? ""}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function formatCell(v: unknown, highlight?: string): React.ReactNode {
	if (v === null || v === undefined) return <span style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>NULL</span>;
	let text = typeof v === "object" ? JSON.stringify(v) : String(v);
	if (highlight) {
		const lower = highlight.toLowerCase();
		const idx = text.toLowerCase().indexOf(lower);
		if (idx >= 0) {
			return (
				<>
					{text.slice(0, idx)}
					<mark style={{ background: "rgba(251,191,36,0.4)", padding: "0 2px", borderRadius: 2 }}>
						{text.slice(idx, idx + highlight.length)}
					</mark>
					{text.slice(idx + highlight.length)}
				</>
			);
		}
	}
	return text;
}

// SQL 语法高亮（编辑器 textarea 无语法高亮——留给后续 CodeMirror 集成）
// 这里只是个占位
void SQL_KEYWORDS;
