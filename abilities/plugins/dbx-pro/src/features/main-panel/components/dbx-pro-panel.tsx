/**
 * dbx-pro 工作台主面板 — 三栏布局（对齐旧项目 Astravia 数据库工作台设计）。
 *
 * 左栏：连接树（连接列表 + schema/table 懒加载）
 * 中栏：SQL 查询面板 + 结果表格
 * 右栏：详情/表信息
 *
 * 设计模式来源：旧项目 /packages/desktop-app/src/renderer/domains/database/
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { inferCatalogFamily, type DbConnection, type DbQueryResult, type RunState } from "../../../domain/connection-config";
import { readAllConfigs, deleteConfig } from "../../../domain/dbx-storage";
import { listSchemasSql, listDatabasesSql, listTablesInScopeSql, tableObjectSql, listFlatTablesSql, flatColumnsSql, listFlatIndexesSql, filterSystemNames } from "../../../domain/catalog";
import { executeQuery } from "../../../shared/services/query-service";
import { ConnectionForm } from "../../connection-management/components/connection-form";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";
import { SqlEditor } from "../../sql-workbench/components/sql-editor";
import { ResultGrid } from "../../sql-workbench/components/result-grid";

// ─── 共享样式组件（对齐旧项目）────────────────────────────────

function Surface({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
	return <div className={`rounded-xl border border-border bg-card ${className || ""}`}>{children}</div>;
}

function SectionLabel({ icon, children, className }: { icon?: string; children: React.ReactNode; className?: string }): JSX.Element {
	return (
		<div className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase ${className || ""}`}>
			{icon ? <span className={`h-3.5 w-3.5 shrink-0 ${icon}`} /> : null}
			{children}
		</div>
	);
}

function Badge({ children }: { children: React.ReactNode }): JSX.Element {
	return <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{children}</span>;
}

function TypeBadge({ type }: { type: string }): JSX.Element {
	const visual = getDatabaseTypeVisual(type);
	return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold shadow-sm text-white" style={{ backgroundColor: visual.color }}>{visual.badge}</span>;
}

// ─── 左栏：连接树 ──────────────────────────────────────────

interface SchemaNode { schema: string; tables: { name: string }[]; }

/** 连接状态点语义：只反映本会话真实发生过的事情，不做「永远在线」的装饰。 */
type ConnStatus = "idle" | "ok" | "running" | "error";

const CONN_STATUS_DOT: Record<ConnStatus, string> = {
	idle: "bg-muted-foreground/30",
	ok: "bg-emerald-400",
	running: "bg-amber-400 animate-pulse",
	error: "bg-destructive",
};

const CONN_STATUS_HINT: Record<ConnStatus, string> = {
	idle: "尚未在本会话执行过查询",
	ok: "最近一次查询成功",
	running: "正在查询",
	error: "最近一次查询失败",
};

function ConnectionTree({
	connections, activeConn, schemas, expanded, selectedTable,
	onSelectConnection, onToggleSchema, onSelectTable, onContextMenu, statusOf, onConnectionContextMenu,
}: {
	connections: DbConnection[]; activeConn: string | null; schemas: SchemaNode[];
	expanded: Set<string>; selectedTable: string | null;
	onSelectConnection: (name: string) => void; onToggleSchema: (schema: string) => void;
	onConnectionContextMenu: (e: React.MouseEvent, name: string) => void;
	onSelectTable: (tableName: string, schema?: string) => void;
	onContextMenu: (e: React.MouseEvent, tableName: string, schema?: string) => void;
	statusOf: (name: string) => ConnStatus;
}): JSX.Element {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const visibleConnections = needle ? connections.filter((c) => c.name.toLowerCase().includes(needle)) : connections;
	/** 过滤命中：表名自身命中，或连接名命中时展示其全部表。 */
	function visibleTables(tables: { name: string }[]): { name: string }[] {
		if (!needle) return tables;
		if (activeConn && activeConn.toLowerCase().includes(needle)) return tables;
		return tables.filter((t) => t.name.toLowerCase().includes(needle));
	}
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-9 shrink-0 items-center gap-px border-b bg-muted/20 px-3 text-xs font-medium text-muted-foreground">
				<span className="min-w-0 truncate">连接</span>
				{connections.length > 0 && <Badge>{connections.length}</Badge>}
				<span className="flex-1" />
			</div>
			<div className="shrink-0 border-b px-2 py-1.5">
				<div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
					<span className="icon-[lucide--search] h-3 w-3 shrink-0 text-muted-foreground/70" />
					<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="过滤连接与表"
						className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60" />
					{query ? (
						<button type="button" onClick={() => setQuery("")} title="清除过滤" className="shrink-0 text-muted-foreground/70 hover:text-foreground">
							<span className="icon-[lucide--x] h-3 w-3" />
						</button>
					) : null}
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
				{connections.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<span className="icon-[lucide--database] h-8 w-8 text-muted-foreground/30" />
						<p className="mt-2 text-[11px] text-muted-foreground">暂无连接</p>
					</div>
				) : visibleConnections.map((conn) => (
					<div key={conn.id}>
						<button type="button" onClick={() => onSelectConnection(conn.name)}
							onContextMenu={(e) => onConnectionContextMenu(e, conn.name)}
							className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${activeConn === conn.name ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground/80"}`}>
							<TypeBadge type={conn.db_type} />
							<span className="min-w-0 flex-1 truncate">{conn.name}</span>
							<span title={CONN_STATUS_HINT[statusOf(conn.name)]} className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONN_STATUS_DOT[statusOf(conn.name)]}`} />
						</button>
						{activeConn === conn.name && schemas.length > 0 && (
							<div className="ml-4 mt-0.5">
								{schemas.map((schema) => {
									const isExpanded = expanded.has(schema.schema);
									return (
										<div key={schema.schema}>
											<button type="button" onClick={() => onToggleSchema(schema.schema)}
												className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/40">
												<span className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
													<span className="icon-[lucide--chevron-right] h-3 w-3" />
												</span>
												<span className="icon-[lucide--database] h-3 w-3" />
												<span className="truncate">{schema.schema}</span>
											</button>
											{isExpanded && (
												<div className="ml-3">
									{visibleTables(schema.tables).map((table) => (
														<button key={table.name} type="button"
															onClick={() => onSelectTable(table.name, schema.schema)}
															onContextMenu={(e) => onContextMenu(e, table.name, schema.schema)}
															className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors ${selectedTable === `${schema.schema}.${table.name}` ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted/40"}`}>
															<span className="icon-[lucide--table] h-3 w-3" />
															<span className="truncate">{table.name}</span>
														</button>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

// ─── 主面板 ──────────────────────────────────────────────────

interface SqlTab { id: string; label: string; sql: string; }
const INITIAL_TABS: SqlTab[] = [{ id: "t1", label: "查询 1", sql: "-- ⌘/Ctrl+Enter 执行\nSELECT 1;" }];

export function DbxProPanel(): JSX.Element {
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [activeConn, setActiveConn] = useState<string | null>(null);
	const [connFormOpen, setConnFormOpen] = useState(false);
	const [editConnName, setEditConnName] = useState<string | null>(null);
	const [connMenu, setConnMenu] = useState<{ x: number; y: number; name: string } | null>(null);
	const [schemas, setSchemas] = useState<SchemaNode[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set(["public"]));
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [columns, setColumns] = useState<{ name: string; type: string; nullable: boolean }[]>([]);
	const [indexes, setIndexes] = useState<{ name: string; unique: boolean }[]>([]);
	const [connOutcome, setConnOutcome] = useState<Record<string, "ok" | "error">>({});
	const [sqlTabs, setSqlTabs] = useState<SqlTab[]>(INITIAL_TABS);
	const [activeTabId, setActiveTabId] = useState<string>("t1");
	const activeTab = useMemo(() => sqlTabs.find((t) => t.id === activeTabId) ?? sqlTabs[0], [sqlTabs, activeTabId]);
	const sql = activeTab?.sql ?? "";
	function setSqlTab(newSql: string) { setSqlTabs((tabs) => tabs.map((t) => t.id === activeTabId ? { ...t, sql: newSql } : t)); }
	const [runState, setRunState] = useState<RunState>({ kind: "idle" });
	const [result, setResult] = useState<DbQueryResult | null>(null);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; table: string; schema?: string } | null>(null);

	useEffect(() => { refreshConnections(); }, []);
	useEffect(() => { if (!activeConn) { setSchemas([]); return; } refreshSchemas(); setSelectedTable(null); setColumns([]); setIndexes([]); }, [activeConn]);
	useEffect(() => { if (!activeConn || !selectedTable) { setColumns([]); setIndexes([]); return; } refreshColumns(); void refreshIndexes(); }, [activeConn, selectedTable]);

	async function refreshConnections() {
		try {
			setConnections(await readAllConfigs());
		} catch {
			setConnections([]);
		}
	}

	async function refreshSchemas() {
		if (!activeConn) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const family = inferCatalogFamily(conn.db_type);
			if (family === "flat") {
				// flat 引擎没有 schema/database 概念：挂一个根节点，表清单按引擎取。
				const root = conn.db_type === "sqlite" ? "main" : conn.db_type;
				if (!listFlatTablesSql(conn.db_type)) { setSchemas([]); return; }
				setSchemas([{ schema: root, tables: [] }]);
				setExpanded((prev) => new Set(prev).add(root));
				await refreshTables(root);
				return;
			}
			const listSql = family === "schemas" ? listSchemasSql() : listDatabasesSql();
			if (!listSql) return;
			const res = await executeQuery(conn, listSql);
			const names = filterSystemNames(family, res.rows.map((r) => Object.values(r)[0] as string));
			const nodes: SchemaNode[] = names.map((name) => ({ schema: name, tables: [] }));
			setSchemas(nodes);
			if (nodes.length > 0) await refreshTables(nodes[0].schema);
		} catch { setSchemas([]); }
	}

	async function refreshTables(schema: string) {
		if (!activeConn) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const family = inferCatalogFamily(conn.db_type);
			const sql = family === "flat"
				? listFlatTablesSql(conn.db_type)
				: listTablesInScopeSql(family, family === "schemas" ? { schema } : { database: schema });
			if (!sql) return;
			const res = await executeQuery(conn, sql);
			setSchemas((prev) => prev.map((s) => s.schema === schema ? { ...s, tables: res.rows.map((r) => ({ name: r.table_name as string })) } : s));
		} catch { /* ignore */ }
	}

	async function refreshColumns() {
		if (!activeConn || !selectedTable) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const [schema, table] = selectedTable.includes(".") ? selectedTable.split(".") : ["public", selectedTable];
			const family = inferCatalogFamily(conn.db_type);
			const sql = family === "flat"
				? flatColumnsSql(conn.db_type, table)
				: tableObjectSql(family, "column", table, family === "schemas" ? { schema } : { database: schema });
			if (!sql) { setColumns([]); return; }
			const res = await executeQuery(conn, sql);
			setColumns(res.rows.map((r) => ({ name: r.column_name as string, type: r.data_type as string, nullable: r.is_nullable === "YES" })));
		} catch { setColumns([]); }
	}

	async function refreshIndexes() {
		if (!activeConn || !selectedTable) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const [schema, table] = selectedTable.includes(".") ? selectedTable.split(".") : ["public", selectedTable];
			const family = inferCatalogFamily(conn.db_type);
			const sql = family === "flat"
				? listFlatIndexesSql(conn.db_type, table)
				: tableObjectSql(family, "index", table, family === "schemas" ? { schema } : { database: schema });
			if (!sql) { setIndexes([]); return; }
			const res = await executeQuery(conn, sql);
			setIndexes(res.rows.map((r) => ({ name: r.name as string, unique: r.is_unique === "YES" })));
		} catch { setIndexes([]); }
	}

	/** 执行一段 SQL 并把结果落到结果区。 */
	async function runSql(sqlText: string) {
		if (!sqlText.trim() || !activeConn) return;
		setRunState({ kind: "running" });
		const conn = connections.find((c) => c.name === activeConn);
		if (!conn) { setRunState({ kind: "idle" }); return; }
		const startedAt = Date.now();
		try {
			const data = await executeQuery(conn, sqlText);
			setResult(data);
			setConnOutcome((prev) => ({ ...prev, [conn.name]: "ok" }));
			setRunState({ kind: "result", data, elapsedMs: Date.now() - startedAt, allowWrites: false });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setResult({ connection: conn.name, columns: [], rows: [], row_count: 0, error: message });
			setConnOutcome((prev) => ({ ...prev, [conn.name]: "error" }));
			setRunState({ kind: "error", message });
		}
	}

	function runQuery() { void runSql(sql); }

	/** 新建查询 Tab。 */
	function addTab() {
		const id = `t${Date.now().toString(36)}`;
		setSqlTabs((tabs) => [...tabs, { id, label: `查询 ${tabs.length + 1}`, sql: "" }]);
		setActiveTabId(id);
	}

	function closeTab(id: string) {
		if (sqlTabs.length <= 1) return;
		const next = sqlTabs.filter((t) => t.id !== id);
		setSqlTabs(next);
		if (id === activeTabId) setActiveTabId(next[0].id);
	}

	/** 右键「预览数据」：不污染用户正在写的 Tab，另开一个 Tab 跑 LIMIT 200。 */
	function previewTable(table: string, schema?: string) {
		const qualified = schema ? `${schema}.${table}` : table;
		const previewSql = `SELECT * FROM ${qualified} LIMIT 200;`;
		const id = `t${Date.now().toString(36)}`;
		setSqlTabs((tabs) => [...tabs, { id, label: table, sql: previewSql }]);
		setActiveTabId(id);
		void runSql(previewSql);
	}

	async function copyTableName(table: string) {
		// 剪贴板在部分宿主上下文不可用；失败时静默，不阻断工作台。
		try { await navigator.clipboard.writeText(table); } catch { /* ignore */ }
	}

	const handleContextMenu = useCallback((e: React.MouseEvent, table: string, schema?: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, table, schema }); }, []);
	const handleConnContextMenu = useCallback((e: React.MouseEvent, name: string) => { e.preventDefault(); setConnMenu({ x: e.clientX, y: e.clientY, name }); }, []);

	/** 删除连接：只删本地配置，不动任何远端库。 */
	async function deleteConnection(name: string) {
		const conn = connections.find((c) => c.name === name);
		if (!conn) return;
		await deleteConfig(conn.id).catch(() => { /* 删除失败保持原状 */ });
		if (activeConn === name) setActiveConn(null);
		await refreshConnections();
	}

	/** 把当前结果导出为 CSV：纯前端生成，不经过宿主。 */
	function exportCsv() {
		if (!result || result.rows.length === 0) return;
		const cols = result.columns.length > 0 ? result.columns : Object.keys(result.rows[0]);
		const cell = (v: unknown) => {
			const s = v === null || v === undefined ? "" : String(v);
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		const text = [cols.join(","), ...result.rows.map((row) => cols.map((c) => cell(row[c])).join(","))].join("\n");
		const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `dbx-pro-${Date.now().toString(36)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	/** 连接状态点：运行中 > 最近一次真实结果 > 未使用过。 */
	function statusOf(name: string): ConnStatus {
		if (activeConn === name && runState.kind === "running") return "running";
		const outcome = connOutcome[name];
		if (outcome === "error") return "error";
		if (outcome === "ok") return "ok";
		return "idle";
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col bg-muted/30">
			<div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background/80 px-3">
				<span className="icon-[solar--database-bold] h-4 w-4 text-primary" />
				<span className="text-[12px] font-medium text-foreground">dbx-pro</span>
				<span className="flex-1" />
				<button type="button" onClick={() => { void refreshConnections(); }} title="刷新连接"
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground">
					<span className="icon-[lucide--refresh-cw] h-3.5 w-3.5" />
				</button>
				<button type="button" onClick={runQuery} disabled={!activeConn || runState.kind === "running"}
					className="flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-40">
					<span className="icon-[lucide--play] h-3.5 w-3.5" />执行
				</button>
				<button type="button" onClick={() => { setEditConnName(null); setConnFormOpen(true); }} className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
					<span className="icon-[lucide--plus] h-3.5 w-3.5" />添加连接
				</button>
			</div>

			<div className="flex min-h-0 flex-1 gap-px bg-border/50 p-px">
				<Surface className="w-[260px] shrink-0 overflow-hidden">
					<ConnectionTree connections={connections} activeConn={activeConn} schemas={schemas} expanded={expanded} selectedTable={selectedTable}
						onSelectConnection={setActiveConn} onToggleSchema={(s) => setExpanded((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; })}
						onSelectTable={(t, s) => setSelectedTable(s ? `${s}.${t}` : t)} onContextMenu={handleContextMenu} statusOf={statusOf} onConnectionContextMenu={handleConnContextMenu} />
				</Surface>

				<Surface className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex shrink-0 items-center gap-px border-b bg-muted/20 px-2">
						{sqlTabs.map((tab) => (
							<button key={tab.id} type="button" onClick={() => setActiveTabId(tab.id)}
								className={`group flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] transition-colors ${activeTabId === tab.id ? "border-primary bg-background text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
								<span className="icon-[lucide--file-code] h-3 w-3" />{tab.label}
								{sqlTabs.length > 1 && (
									<span role="button" tabIndex={-1} title="关闭"
										onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
										className="ml-0.5 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100">
										<span className="icon-[lucide--x] h-3 w-3" />
									</span>
								)}
							</button>
						))}
						<span className="flex-1" />
						<button type="button" onClick={addTab} title="新建查询"
							className="my-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground">
							<span className="icon-[lucide--plus] h-3.5 w-3.5" />
						</button>
					</div>
					<div className="min-h-[160px] shrink-0 border-b">
						<SqlEditor value={sql} onChange={setSqlTab} onRun={runQuery} busy={runState.kind === "running"} />
					</div>
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="min-h-0 flex-1 overflow-auto">
						{result ? result.error ? (
							<div className="flex h-full items-center justify-center"><pre className="max-w-full rounded-lg bg-destructive/10 px-4 py-3 text-[11px] text-destructive whitespace-pre-wrap">{result.error}</pre></div>
						) : <ResultGrid columns={result.columns} rows={result.rows} totalRows={result.row_count} /> : (
							<div className="flex h-full flex-col items-center justify-center text-center">
								<span className="icon-[lucide--table] h-8 w-8 text-muted-foreground/30" />
								<p className="mt-2 text-[11px] text-muted-foreground">执行查询后显示结果</p>
							</div>
						)}
						</div>
						<div className="flex h-6 shrink-0 items-center gap-1.5 bg-muted/20 px-2 text-[10.5px] text-muted-foreground">
							{runState.kind === "running" ? <span>执行中…</span> : null}
							{runState.kind === "result" ? <span>返回 {runState.data.row_count} 行 · {runState.elapsedMs} ms{runState.data.note ? ` · ${runState.data.note}` : ""}</span> : null}
							{runState.kind === "error" ? <span className="text-destructive">执行失败</span> : null}
							{runState.kind === "idle" ? <span>{activeConn ? `已选择 ${activeConn}` : "未选择连接"}</span> : null}
							{result && result.rows.length > 0 ? (
								<button type="button" onClick={exportCsv} title="导出当前结果为 CSV"
									className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-muted/60 hover:text-foreground">
									<span className="icon-[lucide--download] h-3 w-3" />导出 CSV
								</button>
							) : null}
							<span className="flex-1" />
							{selectedTable ? <span className="truncate">{selectedTable}</span> : null}
						</div>
					</div>
				</Surface>

				<Surface className="w-[220px] shrink-0 overflow-y-auto">
					<div className="p-3">
						<SectionLabel icon="icon-[lucide--info]">表信息</SectionLabel>
						{selectedTable ? (
							<div className="mt-2 space-y-2">
								<div className="rounded-lg bg-muted/40 px-2 py-1.5">
									<span className="text-[10px] text-muted-foreground">表名</span>
									<p className="text-[12px] font-medium text-foreground">{selectedTable}</p>
								</div>
								<button type="button"
									onClick={() => { const [s, t] = selectedTable.includes(".") ? selectedTable.split(".") : ["", selectedTable]; previewTable(t, s || undefined); }}
									className="flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted/60">
									<span className="icon-[lucide--eye] h-3.5 w-3.5" />预览数据
								</button>
								{columns.length > 0 && (
									<div>
										<SectionLabel className="mt-3">列 ({columns.length})</SectionLabel>
										<div className="mt-1 space-y-0.5">
											{columns.map((col) => (
												<div key={col.name} className="flex items-center justify-between rounded px-1.5 py-1 text-[11px] hover:bg-muted/40">
													<span className="truncate text-foreground/80">{col.name}</span>
													<span className="shrink-0 text-[10px] text-muted-foreground">{col.type}</span>
												</div>
											))}
										</div>
									</div>
								)}
								{indexes.length > 0 && (
									<div>
										<SectionLabel className="mt-3">索引 ({indexes.length})</SectionLabel>
										<div className="mt-1 space-y-0.5">
											{indexes.map((idx) => (
												<div key={idx.name} className="flex items-center justify-between rounded px-1.5 py-1 text-[11px] hover:bg-muted/40">
													<span className="truncate text-foreground/80">{idx.name}</span>
													{idx.unique ? <span className="shrink-0 text-[10px] text-muted-foreground">UNIQUE</span> : null}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="mt-4 flex flex-col items-center text-center">
								<span className="icon-[lucide--mouse-pointer-click] h-6 w-6 text-muted-foreground/30" />
								<p className="mt-2 text-[11px] text-muted-foreground">选择表查看详情</p>
							</div>
						)}
					</div>
				</Surface>
			</div>

			{connFormOpen && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
					<Surface className="w-[480px] p-4">
						<SectionLabel>添加连接</SectionLabel>
						<ConnectionForm onChange={refreshConnections} onCancel={() => { setConnFormOpen(false); setEditConnName(null); }} initialEditName={editConnName ?? undefined} />
					</Surface>
				</div>
			)}

			{connMenu && (
				<div className="absolute z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg" style={{ left: connMenu.x, top: connMenu.y }} onClick={() => setConnMenu(null)}>
					<button onClick={() => { setEditConnName(connMenu.name); setConnFormOpen(true); setConnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"><span className="icon-[lucide--pencil] h-3.5 w-3.5" /> 编辑连接</button>
					<button onClick={() => { void deleteConnection(connMenu.name); setConnMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-destructive hover:bg-muted"><span className="icon-[lucide--trash-2] h-3.5 w-3.5" /> 删除连接</button>
				</div>
			)}

			{contextMenu && (
				<div className="absolute z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={() => setContextMenu(null)}>
					<button onClick={() => { previewTable(contextMenu.table, contextMenu.schema); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"><span className="icon-[lucide--eye] h-3.5 w-3.5" /> 预览数据</button>
					<button onClick={() => { void copyTableName(contextMenu.table); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"><span className="icon-[lucide--copy] h-3.5 w-3.5" /> 复制表名</button>
				</div>
			)}
		</div>
	);
}
