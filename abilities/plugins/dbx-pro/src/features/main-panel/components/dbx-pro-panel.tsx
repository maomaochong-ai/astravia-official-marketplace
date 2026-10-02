/**
 * dbx-pro 工作台主面板 — 三栏布局装配。
 *
 * 本文件只负责：
 *   1. 持有面板级状态（连接列表 / 当前连接 / SQL / 运行状态）
 *   2. 编排 features 子组件的数据流
 *   3. 处理事件回调（执行查询 / inline 编辑 / 右键菜单）
 *
 * 领域模型、CLI 调用、introspection SQL 全部在 domain/ 和 services/ 下。
 */

import { useEffect, useMemo, useState } from "react";
import type { PluginCommandApi } from "@astravia-org/plugin-sdk";
import { getCommand, getConversation } from "../../../runtime-contract";
import {
	findDbType,
	inferCatalogFamily,
	type CatalogFamily,
	type DbColumn,
	type DbConnection,
	type DbQueryResult,
	type DbTableInfo,
	type RunState,
} from "../../../domain/connection-config";
import { readAllConfigs } from "../../../domain/dbx-storage";
import {
	listSchemasSql,
	listDatabasesSql,
	listTablesInScopeSql,
	tableObjectSql,
	filterSystemNames,
	type CatalogScope,
	type TableObjectKind,
} from "../../../domain/catalog";
import {
	listConnections as cliListConnections,
	describeTable,
	executeQuery,
} from "../../connection-management/services/dbx-cli";
import { ConnectionForm } from "../../connection-management/components/connection-form";
import { SqlEditor } from "../../sql-workbench/components/sql-editor";
import { ResultGrid } from "../../sql-workbench/components/result-grid";

interface SchemaNode {
	schema: string;
	tables: DbTableInfo[];
}

interface TableContextMenu {
	x: number; y: number;
	connection: string;
	schema?: string;
	table: string;
}

export function DbxProPanel() {
	const command = getCommand();

	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [activeConn, setActiveConn] = useState<string | null>(null);
	const [connFormOpen, setConnFormOpen] = useState(false);

	const [schemas, setSchemas] = useState<SchemaNode[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set(["public"]));
	const [selectedTable, setSelectedTable] = useState<{ name: string; schema?: string } | null>(null);
	const [columns, setColumns] = useState<DbColumn[]>([]);
	const [tableObjects, setTableObjects] = useState<Record<string, string[]>>({});
	const [tableMetaTab, setTableMetaTab] = useState<"columns" | "indexes" | "constraints" | "triggers" | "sample">("columns");

	const [sql, setSql] = useState<string>("-- ⌘/Ctrl+Enter 执行\nSELECT 1;");
	const [runState, setRunState] = useState<RunState>({ kind: "idle" });
	const [queryHistory, setQueryHistory] = useState<string[]>([]);

	const [writeConfirm, setWriteConfirm] = useState<null | { kind: "write" | "ddl"; sql: string; isProd: boolean }>(null);
	const [menu, setMenu] = useState<TableContextMenu | null>(null);

	const [resultPage, setResultPage] = useState(0);
	const [resultPageSize] = useState(100);
	const [resultFilter, setResultFilter] = useState("");

	// ── 初始化 ───────────────────────────────────────────────
	useEffect(() => { refreshConnections(); }, []);

	useEffect(() => {
		if (!activeConn) { setSchemas([]); return; }
		refreshSchemas();
		setSelectedTable(null); setColumns([]);
	}, [activeConn]);

	useEffect(() => {
		if (!selectedTable || !activeConn) { setColumns([]); return; }
		describeCurrentTable();
	}, [selectedTable, activeConn]);

	useEffect(() => {
		if (!menu) return;
		const h = () => setMenu(null);
		document.addEventListener("click", h);
		return () => document.removeEventListener("click", h);
	}, [menu]);

	// ── 连接层 ───────────────────────────────────────────────
	async function refreshConnections() {
		try {
			const cli = await cliListConnections(command);
			const sqlite = (await readAllConfigs(command)) as DbConnection[];
			const merged = cli.map((cli) => {
				const full = sqlite.find((c) => c.name === cli.name);
				return { ...full, ...cli, id: full?.id ?? cli.name } as DbConnection;
			});
			setConnections(merged);
			if (merged.length > 0 && !activeConn) setActiveConn(merged[0].name);
		} catch {
			try {
				setConnections((await readAllConfigs(command)) as DbConnection[]);
			} catch {
				setConnections([]);
			}
		}
	}

	async function refreshSchemas() {
		if (!activeConn) return;
		const conn = connections.find((c) => c.name === activeConn);
		if (!conn) return;
		const family: CatalogFamily = inferCatalogFamily(conn.db_type);

		try {
			if (family === "flat") {
				const r = await executeQuery(command, activeConn, "SELECT table_name AS name, table_type FROM information_schema.tables ORDER BY table_name", { limit: 2000 });
				const tables = r.rows.map((row) => ({
					name: String(row.name ?? row.table_name ?? ""),
					table_type: String(row.table_type ?? "BASE TABLE"),
				})).filter((t) => t.name);
				setSchemas([{ schema: "(default)", tables }]);
				setExpanded(new Set(["(default)"]));
				return;
			}

			const catalogSql = family === "schemas" ? listSchemasSql() : listDatabasesSql();
			const cat = await executeQuery(command, activeConn, catalogSql, { limit: 500, timeoutMs: 15_000 });
			const names = filterSystemNames(family, cat.rows.map((r) => String(r.name ?? "")));

			const nodes: SchemaNode[] = [];
			for (const name of names) {
				const scope: CatalogScope = family === "schemas" ? { schema: name } : { database: name };
				const tSql = listTablesInScopeSql(family, scope);
				try {
					const tRes = await executeQuery(command, activeConn, tSql, { limit: 2000, timeoutMs: 15_000 });
					const tables = tRes.rows.map((r) => ({
						name: String(r.name ?? r.table_name ?? ""),
						table_type: String(r.table_type ?? "BASE TABLE"),
					})).filter((t) => t.name);
					if (tables.length > 0) nodes.push({ schema: name, tables });
				} catch { /* skip scope on error */ }
			}
			setSchemas(nodes);
			setExpanded(new Set(nodes.slice(0, 3).map((n) => n.schema)));
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
		await loadTableObjects();
	}

	async function loadTableObjects() {
		if (!activeConn || !selectedTable) { setTableObjects({}); return; }
		const conn = connections.find((c) => c.name === activeConn);
		if (!conn) return;
		const family = inferCatalogFamily(conn.db_type);
		const scope: CatalogScope = family === "schemas"
			? { schema: selectedTable.schema ?? "public" }
			: family === "databases"
				? { database: selectedTable.schema ?? conn.database ?? "" }
				: {};

		const kinds: TableObjectKind[] = ["index", "constraint", "trigger"];
		const res: Record<string, string[]> = {};
		for (const k of kinds) {
			const sql = tableObjectSql(family, k, selectedTable.name, scope);
			if (!sql) continue;
			try {
				const r = await executeQuery(command, activeConn, sql, { limit: 200, timeoutMs: 10_000 });
				const colName = r.columns.includes("name") ? "name" : r.columns[0];
				res[k] = r.rows.map((row) => String(row[colName] ?? "")).filter(Boolean);
			} catch {
				res[k] = [];
			}
		}
		setTableObjects(res);
	}

	// ── SQL 执行 ───────────────────────────────────────────────
	async function runQuery(checkWrite = true, allowWrites = false, allowDangerous = false) {
		if (!activeConn) return;
		const trimmed = sql.trim();
		if (!trimmed) return;

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

	async function runExplain(withAnalyze: boolean) {
		if (!activeConn) return;
		const trimmed = sql.trim();
		if (!trimmed) return;
		const explainSql = withAnalyze ? `EXPLAIN ANALYZE ${trimmed}` : `EXPLAIN ${trimmed}`;
		setSql(explainSql);

		setRunState({ kind: "running" });
		try {
			const t0 = performance.now();
			const result = await executeQuery(command, activeConn, explainSql, { timeoutMs: 30_000 });
			setRunState({ kind: "result", data: result, elapsedMs: Math.round(performance.now() - t0), allowWrites: false });
			setResultPage(0);
		} catch (err) {
			const msg = (err as Error).message;
			const codeMatch = msg.match(/\[([A-Z_]+)\]/);
			setRunState({ kind: "error", message: msg, code: codeMatch?.[1] });
		}
	}

	// ── Result grid state ────────────────────────────────────────
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
	const pkColumns = useMemo(
		() => columns.filter((c) => c.is_primary_key).map((c) => c.name),
		[columns],
	);

	// ── Write confirm handlers ──────────────────────────────────
	function onWriteConfirmCancel() { setWriteConfirm(null); }
	function onWriteConfirmOk() {
		if (!writeConfirm) return;
		const allowDangerous = writeConfirm.kind === "ddl";
		runQuery(false, true, allowDangerous);
	}

	// ── Inline edit ──────────────────────────────────────────────
	function qualifiedTable(t: { name: string; schema?: string }): string {
		const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
		if (t.schema && t.schema !== "(default)") return `${ident(t.schema)}.${ident(t.name)}`;
		return ident(t.name);
	}
	function sqlVal(v: unknown): string {
		if (v === null || v === undefined) return "NULL";
		if (typeof v === "number" || typeof v === "boolean") return String(v);
		return `'${String(v).replace(/'/g, "''")}'`;
	}

	async function handleEditCell(row: Record<string, unknown>, column: string, newValue: unknown) {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		const setPart = `"${column.replace(/"/g, '""')}" = ${sqlVal(newValue)}`;
		const wherePart = pkColumns.map((pk) => `"${pk.replace(/"/g, '""')}" = ${sqlVal(row[pk])}`).join(" AND ");
		const sqlText = `UPDATE ${tbl} SET ${setPart} WHERE ${wherePart}`;
		if (!confirm(`执行 UPDATE？\n${sqlText}\n\n操作不可逆！`)) return;
		try {
			await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			const cur = sql.trim();
			if (cur) {
				const fresh = await executeQuery(command, activeConn, cur, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
		} catch (err) {
			alert(`UPDATE 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleDeleteRow(row: Record<string, unknown>) {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		const wherePart = pkColumns.map((pk) => `"${pk.replace(/"/g, '""')}" = ${sqlVal(row[pk])}`).join(" AND ");
		const sqlText = `DELETE FROM ${tbl} WHERE ${wherePart}`;
		if (!confirm(`确定删除这一行？\n${sqlText}\n\n操作不可逆！`)) return;
		try {
			await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			const cur = sql.trim();
			if (cur) {
				const fresh = await executeQuery(command, activeConn, cur, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
		} catch (err) {
			alert(`DELETE 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleAddRow() {
		if (!activeConn || !selectedTable || pkColumns.length === 0) return;
		const tbl = qualifiedTable(selectedTable);
		const sqlText = `INSERT INTO ${tbl} DEFAULT VALUES`;
		if (!confirm(`执行 INSERT？\n${sqlText}`)) return;
		try {
			await executeQuery(command, activeConn, sqlText, { allowWrites: true });
			const cur = sql.trim();
			if (cur) {
				const fresh = await executeQuery(command, activeConn, cur, { timeoutMs: 15_000 });
				setRunState({ kind: "result", data: fresh, elapsedMs: 0, allowWrites: false });
				setResultPage(0);
			}
		} catch (err) {
			alert(`INSERT 失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	// ── 表右键菜单动作 ───────────────────────────────────────────
	function menuPreview() {
		if (!menu) return;
		setSelectedTable({ name: menu.table, schema: menu.schema });
		setSql(`SELECT * FROM ${qualifiedTable({ name: menu.table, schema: menu.schema })} LIMIT 20;`);
		setMenu(null);
	}
	function menuDescribe() {
		if (!menu) return;
		setSelectedTable({ name: menu.table, schema: menu.schema });
		setMenu(null);
	}
	function menuExport() {
		if (!menu) return;
		setSelectedTable({ name: menu.table, schema: menu.schema });
		setSql(`SELECT * FROM ${qualifiedTable({ name: menu.table, schema: menu.schema })} LIMIT 1000;`);
		setMenu(null);
	}
	function menuSendToAI() {
		if (!menu || !activeConnection) return;
		const ctx = getConversation();
		const scope = menu.schema ? `\`${menu.schema}\`.` : "";
		const family = inferCatalogFamily(activeConnection.db_type);
		ctx.insertText(
			`[dbx-pro context]\n` +
			`connection: ${activeConnection.name} (${activeConnection.db_type}, family=${family})\n` +
			`table: ${scope}\`${menu.table}\`\n\n请帮我分析这个表的结构，看看有没有问题，或者生成一个查询。`
		);
		setMenu(null);
	}
	function menuTruncate() {
		if (!menu) return;
		const qt = qualifiedTable({ name: menu.table, schema: menu.schema });
		setSql(`TRUNCATE TABLE ${qt};`);
		setMenu(null);
	}
	function menuDrop() {
		if (!menu) return;
		const qt = qualifiedTable({ name: menu.table, schema: menu.schema });
		setSql(`DROP TABLE IF EXISTS ${qt};`);
		setMenu(null);
	}

	// ── 导出 ────────────────────────────────────────────────────
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

	// ── 渲染 ────────────────────────────────────────────────────
	const connDbType = activeConnection?.db_type ?? "";
	const connEntry = findDbType(connDbType);

	return (
		<div className="dbx-panel" onContextMenu={(e) => e.preventDefault()}>
			{/* 顶部工具栏 */}
			<div className="dbx-topbar">
				<select className="dbx-form-input" style={{ width: 180 }}
					value={activeConn ?? ""}
					onChange={(e) => setActiveConn(e.target.value || null)}
					disabled={connections.length === 0}
				>
					{connections.length === 0 && <option value="">(无连接)</option>}
					{connections.map((c) => (
						<option key={c.id} value={c.name}>
							{c.is_production ? "🔴 " : ""}
							{c.name}{c.database ? ` · ${c.database}` : ""}
						</option>
					))}
				</select>
				{activeConnection?.is_production && (
					<span style={{
						fontSize: 11, padding: "2px 8px", borderRadius: 10,
						background: "rgba(220,38,38,0.1)", color: "#dc2626", fontWeight: 600,
					}}>⚠️ PRODUCTION — 默认阻断写入/DDL</span>
				)}
				{connEntry?.runtimeMode === "bridge" && (
					<span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>bridge 模式</span>
				)}
				<div style={{ flex: 1 }} />
				{runState.kind !== "running" && activeConn && (
					<>
						<button className="dbx-btn ghost" onClick={() => setSql(`SELECT * FROM ${selectedTable ? qualifiedTable(selectedTable) : "your_table"} LIMIT 20;`)}>
							⟳ SELECT *
						</button>
					</>
				)}
				<button className="dbx-btn ghost" onClick={refreshConnections}>🔄 刷新</button>
				<button className="dbx-btn ghost"
					onClick={() => runExplain(false)}
					disabled={!activeConn || runState.kind === "running" || !connEntry?.sqlExplain}
					title={connEntry?.sqlExplain ? "EXPLAIN" : "此引擎不支持 EXPLAIN"}
				>📋 EXPLAIN</button>
				<button className="dbx-btn ghost"
					onClick={() => runExplain(true)}
					disabled={!activeConn || runState.kind === "running" || !connEntry?.sqlExplain}
					title={connEntry?.sqlExplain ? "EXPLAIN ANALYZE" : "此引擎不支持 EXPLAIN"}
				>📊 ANALYZE</button>
				<button className="dbx-btn ghost" onClick={() => setConnFormOpen(true)}>⚙️ 管理连接</button>
				<button className="dbx-btn primary"
					onClick={() => runQuery(true)}
					disabled={!activeConn || runState.kind === "running"}
				>{runState.kind === "running" ? "执行中…" : "▶ 运行"}</button>
			</div>

			{/* 主体三栏 */}
			<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
				{/* 左栏：连接 + schema 树 */}
				<div className="dbx-sidebar">
					<div style={{
						padding: "10px 12px", fontSize: 11, fontWeight: 600,
						color: "var(--muted-foreground)", letterSpacing: "0.06em", textTransform: "uppercase",
					}}>连接</div>
					<div style={{ flex: "0 0 auto", maxHeight: "38%", overflowY: "auto" }}>
						{connections.map((c) => (
							<div
								key={c.id}
								className={`dbx-connection-item ${activeConn === c.name ? "active" : ""}`}
								onClick={() => setActiveConn(c.name)}
								title={`${c.host}:${c.port}${c.database ? `/${c.database}` : ""}`}
							>
								<span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>{c.db_type}</span>
								<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{c.is_production && "🔴 "}{c.name}
								</span>
								{c.ssl && <span style={{ fontSize: 10 }}>🔒</span>}
							</div>
						))}
					</div>

					{activeConn && (
						<>
							<div style={{
								padding: "10px 12px", fontSize: 11, fontWeight: 600,
								color: "var(--muted-foreground)", letterSpacing: "0.06em", textTransform: "uppercase",
								borderTop: "1px solid var(--border)", marginTop: 6,
							}}>Schema · 表 ({schemas.reduce((s, n) => s + n.tables.length, 0)})</div>
							<div style={{ flex: 1, overflowY: "auto" }}>
								{schemas.map((node) => {
									const open = expanded.has(node.schema);
									return (
										<div key={node.schema}>
											<div
												className="dbx-connection-item"
												onClick={() => {
													const next = new Set(expanded);
													open ? next.delete(node.schema) : next.add(node.schema);
													setExpanded(next);
												}}
												style={{ fontWeight: 600 }}
											>
												<span style={{ width: 12, display: "inline-block", fontSize: 9 }}>{open ? "▼" : "▶"}</span>
												<span>📁 {node.schema}</span>
												<span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>{node.tables.length}</span>
											</div>
											{open && node.tables.map((t) => (
												<div
													key={t.name}
													className={`dbx-connection-item ${selectedTable?.name === t.name ? "active" : ""}`}
													onClick={(e) => { e.stopPropagation(); setSelectedTable({ name: t.name, schema: node.schema }); setTableMetaTab("columns"); }}
													onContextMenu={(e) => {
														e.preventDefault(); e.stopPropagation();
														setMenu({ x: e.clientX, y: e.clientY, connection: activeConn!, schema: node.schema, table: t.name });
													}}
													style={{ paddingLeft: 26 }}
													title={t.table_type}
												>
													<span style={{ fontSize: 10 }}>
														{t.table_type === "view" ? "👁" : t.table_type === "materialized_view" ? "📦" : "📄"}
													</span>
													<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
												</div>
											))}
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>

				{/* 右栏 SQL + 结果 */}
				<div className="dbx-main">
					{/* 编辑器 */}
					<div style={{ height: "38%", position: "relative" }}>
						<SqlEditor value={sql} onChange={setSql} onRun={() => runQuery(true)} placeholder="SELECT * FROM users LIMIT 20;" />
						<div style={{
							position: "absolute", bottom: 6, right: 10,
							fontSize: 11, color: "var(--muted-foreground)", pointerEvents: "none",
						}}>⌘/Ctrl+Enter 执行</div>
						{queryHistory.length > 0 && (
							<div style={{ borderBottom: "1px solid var(--border)", maxHeight: 72, overflowY: "auto", padding: "4px 8px" }}>
								<div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 2 }}>历史（点一下回填）</div>
								{queryHistory.slice(0, 5).map((h, i) => (
									<div key={i}
										onClick={() => setSql(h)}
										style={{ fontSize: 11, padding: "2px 4px", cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
										title={h}
									>{h.slice(0, 80)}{h.length > 80 ? "…" : ""}</div>
								))}
							</div>
						)}
					</div>

					{runState.kind === "running" && <div className="dbx-empty" style={{ padding: 24 }}>⏳ 执行中…</div>}

					{runState.kind === "error" && (
						<div className="dbx-error" style={{ borderTop: "1px solid var(--border)" }}>
							{runState.code && <div style={{ fontWeight: 600, marginBottom: 4 }}>[{runState.code}]</div>}
							{runState.message}
						</div>
					)}

					{runState.kind === "result" && (
						<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
							<div style={{
								padding: "6px 12px", fontSize: 12,
								borderBottom: "1px solid var(--border)",
								display: "flex", alignItems: "center", gap: 12,
							}}>
								<span style={{ fontWeight: 600 }}>结果</span>
								<span style={{ color: "var(--muted-foreground)" }}>{runState.data.row_count} 行 · {runState.elapsedMs}ms</span>
								<div style={{ flex: 1 }} />
								<input
									className="dbx-form-input"
									style={{ width: 180, height: 24, fontSize: 12, padding: "2px 8px" }}
									placeholder="过滤…"
									value={resultFilter}
									onChange={(e) => { setResultFilter(e.target.value); setResultPage(0); }}
								/>
								<span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>第 {resultPage + 1}/{totalPages} 页</span>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} disabled={resultPage === 0} onClick={() => setResultPage((p) => p - 1)}>←</button>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} disabled={resultPage >= totalPages - 1} onClick={() => setResultPage((p) => p + 1)}>→</button>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} onClick={() => exportResult("csv")}>CSV</button>
								<button className="dbx-btn ghost" style={{ padding: "2px 8px" }} onClick={() => exportResult("json")}>JSON</button>
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

					{runState.kind === "idle" && selectedTable && columns.length > 0 && (
						<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
							<div style={{
								padding: "6px 12px", borderBottom: "1px solid var(--border)",
								display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
							}}>
								<span style={{ fontWeight: 600 }}>
									{selectedTable.schema ? `${selectedTable.schema}.` : ""}{selectedTable.name}
								</span>
								<div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
									{([
										{ key: "columns", label: `列 (${columns.length})` },
										{ key: "indexes", label: `索引 (${tableObjects.index?.length ?? "—"})` },
										{ key: "constraints", label: `约束 (${tableObjects.constraint?.length ?? "—"})` },
										{ key: "triggers", label: `触发器 (${tableObjects.trigger?.length ?? "—"})` },
										{ key: "sample", label: "采样数据" },
									] as const).map((t) => (
										<button key={t.key}
											className="dbx-btn"
											style={{
												padding: "2px 10px", fontSize: 12, borderRadius: 4,
												background: tableMetaTab === t.key ? "var(--foreground)" : "transparent",
												color: tableMetaTab === t.key ? "var(--background)" : "inherit",
											}}
											onClick={() => setTableMetaTab(t.key)}
										>{t.label}</button>
									))}
								</div>
							</div>
							{tableMetaTab === "columns" && <ColumnsGrid columns={columns} />}
							{(tableMetaTab === "indexes" || tableMetaTab === "constraints" || tableMetaTab === "triggers") && (
								<ObjectList title={tableMetaTab === "indexes" ? "索引" : tableMetaTab === "constraints" ? "约束" : "触发器"} items={tableObjects[tableMetaTab] ?? []} />
							)}
							{tableMetaTab === "sample" && (
								<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
									<button className="dbx-btn primary" onClick={() => {
										setSql(`SELECT * FROM ${qualifiedTable(selectedTable)} LIMIT 20;`);
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

			{/* 右键菜单 */}
			{menu && (
				<div style={{
					position: "fixed", left: menu.x, top: menu.y,
					background: "var(--background)", border: "1px solid var(--border)",
					borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
					minWidth: 180, padding: "4px 0", zIndex: 200, fontSize: 13,
				}}>
					<MenuRow label="👁 预览前 20 行" onClick={menuPreview} />
					<MenuRow label="📄 DESCRIBE 结构" onClick={menuDescribe} />
					<MenuRow label="📤 导出 CSV（前 1000 行）" onClick={menuExport} />
					<div style={{ height: 1, background: "var(--border)", margin: "4px 8px" }} />
					<MenuRow label="🤖 发送到 AI 分析" onClick={menuSendToAI} />
					<div style={{ height: 1, background: "var(--border)", margin: "4px 8px" }} />
					<MenuRow label="⚠️ TRUNCATE TABLE" onClick={menuTruncate} danger />
					<MenuRow label="⚠️ DROP TABLE" onClick={menuDrop} danger />
				</div>
			)}

			{/* 写保护确认弹窗 */}
			{writeConfirm && (
				<>
					<div className="dbx-sheet-backdrop" onClick={onWriteConfirmCancel} />
					<div style={{
						position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
						background: "var(--background)", border: "1px solid var(--border)",
						borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
						width: 480, maxWidth: "90vw", zIndex: 300,
					}}>
						<div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
							<div style={{ fontWeight: 600, fontSize: 15, color: "#dc2626" }}>
								{writeConfirm.kind === "ddl" ? "⚠️ 危险 DDL 操作" : writeConfirm.isProd ? "⚠️ 生产环境写入" : "写入操作确认"}
							</div>
						</div>
						<div style={{ padding: 20 }}>
							<p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>
								{writeConfirm.kind === "ddl"
									? "这段 SQL 包含 DDL（CREATE/DROP/ALTER/TRUNCATE），会永久改变数据库结构。"
									: writeConfirm.isProd
										? "目标连接标记为 PRODUCTION，写入操作默认被阻断。"
										: "这段 SQL 会修改数据。请确认要继续执行。"}
							</p>
							<pre style={{
								background: "rgba(0,0,0,0.03)", padding: 12, borderRadius: 6,
								fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap",
								maxHeight: 120, overflow: "auto", color: "#dc2626",
							}}>{writeConfirm.sql.slice(0, 500)}{writeConfirm.sql.length > 500 ? "…" : ""}</pre>
						</div>
						<div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
							<button className="dbx-btn ghost" onClick={onWriteConfirmCancel}>取消</button>
							<button className="dbx-btn" style={{ background: "#dc2626", color: "#fff", border: "none" }} onClick={onWriteConfirmOk}>
								我知道风险，继续执行
							</button>
						</div>
					</div>
				</>
			)}

			<ConnectionForm open={connFormOpen} command={command} onClose={() => setConnFormOpen(false)} onSaved={() => refreshConnections()} />
		</div>
	);
}

function MenuRow({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
	return (
		<div onClick={onClick}
			style={{
				padding: "6px 12px", cursor: "pointer",
				color: danger ? "#dc2626" : "inherit",
			}}
			onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
			onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
		>{label}</div>
	);
}

function ColumnsGrid({ columns }: { columns: DbColumn[] }) {
	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			<table>
				<thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>PK</th><th>Default</th><th>Comment</th></tr></thead>
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

function ObjectList({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) {
		return (
			<div style={{ flex: 1, padding: 24, color: "var(--muted-foreground)", fontSize: 13, textAlign: "center" }}>
				暂无{title}
			</div>
		);
	}
	return (
		<div className="dbx-result" style={{ flex: 1 }}>
			<table>
				<thead><tr><th>{title}</th></tr></thead>
				<tbody>{items.map((n, i) => (<tr key={i}><td style={{ fontFamily: "monospace", fontSize: 12 }}>{n}</td></tr>))}</tbody>
			</table>
		</div>
	);
}

// ── 工具函数 ───────────────────────────────────────────────────
function classifySql(sql: string): "read" | "write" | "ddl" {
	const s = sql.trim().toUpperCase().replace(/^--.*\n/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
	const first = s.split(/\s+/)[0] ?? "";
	if (["CREATE", "DROP", "ALTER", "TRUNCATE", "GRANT", "REVOKE"].includes(first)) return "ddl";
	if (["INSERT", "UPDATE", "DELETE", "REPLACE"].includes(first)) return "write";
	return "read";
}

function downloadFile(name: string, content: string) {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url; a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

