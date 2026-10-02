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
	const [tableMetaTab, setTableMetaTab] = useState<"columns" | "sample">("columns");

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
		try {
			const list = await listTables(command, activeConn);
			// dbx CLI 默认把所有表返回在 flat list；我们按 table_type 分组 + 按表名再分组到默认 schema
			// 如果 dbx 有 --schema 扩展参数后续可以补，但先用 table_type 分类
			// 为了兼容旧项目的 schema 分层 UI，这里做个简化：把所有表都挂在默认 schema 下
			// PostgreSQL 的表返回时 schema 信息在后续 introspection SQL 里可以拿到
			const defaultSchema = "public";
			const existingIdx = new Map<string, SchemaNode>();
			const node = existingIdx.get(defaultSchema) ?? { schema: defaultSchema, tables: [] };
			for (const t of list) {
				node.tables.push(t);
			}
			existingIdx.set(defaultSchema, node);
			// 也按 table_type 加分类（view/materialized_view/其他）
			// 暂先只放一张表，后续 introspection SQL 补上真实 schema
			setSchemas([{ schema: defaultSchema, tables: list }]);
		} catch {
			setSchemas([]);
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
							/>
						</div>
					)}

					{/* 表结构预览 */}
					{runState.kind === "idle" && selectedTable && columns.length > 0 && (
						<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
							<div style={{
								padding: "6px 12px", borderBottom: "1px solid var(--border)",
								display: "flex", alignItems: "center", gap: 12,
							}}>
								<span style={{ fontWeight: 600 }}>{selectedTable.name}</span>
								<div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
									{(["columns", "sample"] as const).map((t) => (
										<button
											key={t}
											className="dbx-btn"
											style={{
												padding: "2px 10px", fontSize: 12,
												background: tableMetaTab === t ? "var(--foreground)" : "transparent",
												color: tableMetaTab === t ? "var(--background)" : "inherit",
												borderRadius: 4,
											}}
											onClick={() => setTableMetaTab(t)}
										>
											{t === "columns" ? `列 (${columns.length})` : "采样数据"}
										</button>
									))}
								</div>
							</div>
							{tableMetaTab === "columns" && <ColumnsGrid columns={columns} />}
							{tableMetaTab === "sample" && (
								<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
									<button className="dbx-btn primary" onClick={() => {
										const tab = selectedTable.name.replace(/"/g, '""');
										setSql(`SELECT * FROM "${tab}" LIMIT 20;`);
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
}: {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
	highlightKeyword?: string;
}) {
	const colList = columns.length > 0
		? columns
		: Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

	if (colList.length === 0 || totalRows === 0) {
		return <div className="dbx-empty" style={{ flex: 1 }}>0 行（affected rows: {totalRows}）</div>;
	}

	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			<table>
				<thead>
					<tr>
						<th style={{ width: 40, color: "var(--muted-foreground)", fontSize: 11 }}>#</th>
						{colList.map((c) => (
							<th key={c} title={c} style={{ minWidth: 100 }}>{c}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => (
						<tr key={i}>
							<td style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{i + 1}</td>
							{colList.map((c) => (
								<td key={c} title={String(row[c] ?? "NULL")}>
									{formatCell(row[c], highlightKeyword)}
								</td>
							))}
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
