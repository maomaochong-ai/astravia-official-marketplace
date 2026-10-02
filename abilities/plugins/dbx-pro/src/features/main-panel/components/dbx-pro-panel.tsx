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
import { getCommand } from "../../../runtime-contract";
import type { DbConnection, DbQueryResult, RunState } from "../../../domain/connection-config";
import { readAllConfigs } from "../../../domain/dbx-storage";
import { listSchemasSql, listDatabasesSql, listTablesInScopeSql, tableObjectSql, filterSystemNames, type CatalogScope } from "../../../domain/catalog";
import { listConnections as cliListConnections, executeQuery } from "../../connection-management/services/dbx-cli";
import { ConnectionForm } from "../../connection-management/components/connection-form";
import { SqlEditor } from "../../sql-workbench/components/sql-editor";
import { ResultGrid } from "../../sql-workbench/components/result-grid";

// ─── 共享样式组件（对齐旧项目）────────────────────────────────

function Surface({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
	return <div className={`rounded-xl border border-border bg-card ${className || ""}`}>{children}</div>;
}

function SectionLabel({ icon, children, className }: { icon?: string; children: string; className?: string }): JSX.Element {
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
	const colors: Record<string, string> = { postgres: "#336791", mysql: "#4479A1", mongodb: "#47A248", clickhouse: "#FFCC01", sqlite: "#003B57", sqlserver: "#CC2927" };
	const initials: Record<string, string> = { postgres: "PG", mysql: "MY", mongodb: "MG", clickhouse: "CK", sqlite: "SQ", sqlserver: "MS" };
	const color = colors[type] ?? "#64748b";
	const badge = initials[type] ?? type.slice(0, 2).toUpperCase();
	return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold shadow-sm text-white" style={{ backgroundColor: color }}>{badge}</span>;
}

// ─── 左栏：连接树 ──────────────────────────────────────────

interface SchemaNode { schema: string; tables: { name: string }[]; }

function ConnectionTree({
	connections, activeConn, schemas, expanded, selectedTable,
	onSelectConnection, onToggleSchema, onSelectTable, onContextMenu,
}: {
	connections: DbConnection[]; activeConn: string | null; schemas: SchemaNode[];
	expanded: Set<string>; selectedTable: string | null;
	onSelectConnection: (name: string) => void; onToggleSchema: (schema: string) => void;
	onSelectTable: (tableName: string, schema?: string) => void;
	onContextMenu: (e: React.MouseEvent, tableName: string, schema?: string) => void;
}): JSX.Element {
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-9 shrink-0 items-center gap-px border-b bg-muted/20 px-3 text-xs font-medium text-muted-foreground">
				<span className="min-w-0 truncate">连接</span>
				{connections.length > 0 && <Badge>{connections.length}</Badge>}
				<span className="flex-1" />
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
				{connections.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<span className="icon-[lucide--database] h-8 w-8 text-muted-foreground/30" />
						<p className="mt-2 text-[11px] text-muted-foreground">暂无连接</p>
					</div>
				) : connections.map((conn) => (
					<div key={conn.id}>
						<button type="button" onClick={() => onSelectConnection(conn.name)}
							className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${activeConn === conn.name ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground/80"}`}>
							<TypeBadge type={conn.type} />
							<span className="min-w-0 flex-1 truncate">{conn.name}</span>
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
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
													{schema.tables.map((table) => (
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
	const command = getCommand();
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [activeConn, setActiveConn] = useState<string | null>(null);
	const [connFormOpen, setConnFormOpen] = useState(false);
	const [schemas, setSchemas] = useState<SchemaNode[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set(["public"]));
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [columns, setColumns] = useState<{ name: string; type: string; nullable: boolean }[]>([]);
	const [sqlTabs, setSqlTabs] = useState<SqlTab[]>(INITIAL_TABS);
	const [activeTabId, setActiveTabId] = useState<string>("t1");
	const activeTab = useMemo(() => sqlTabs.find((t) => t.id === activeTabId) ?? sqlTabs[0], [sqlTabs, activeTabId]);
	const sql = activeTab?.sql ?? "";
	function setSqlTab(newSql: string) { setSqlTabs((tabs) => tabs.map((t) => t.id === activeTabId ? { ...t, sql: newSql } : t)); }
	const [runState, setRunState] = useState<RunState>({ kind: "idle" });
	const [result, setResult] = useState<DbQueryResult | null>(null);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; table: string; schema?: string } | null>(null);

	useEffect(() => { refreshConnections(); }, []);
	useEffect(() => { if (!activeConn) { setSchemas([]); return; } refreshSchemas(); setSelectedTable(null); setColumns([]); }, [activeConn]);
	useEffect(() => { if (!activeConn || !selectedTable) { setColumns([]); return; } refreshColumns(); }, [activeConn, selectedTable]);

	async function refreshConnections() {
		try {
			const local = await readAllConfigs();
			let cli: DbConnection[] = [];
			try { cli = await cliListConnections(); } catch { /* CLI 未安装 */ }
			const merged = [...local];
			for (const c of cli) { if (!merged.find((x) => x.name === c.name)) merged.push(c); }
			setConnections(merged);
		} catch { setConnections([]); }
	}

	async function refreshSchemas() {
		if (!activeConn) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const family = conn.type === "postgres" ? "schema" : conn.type === "mysql" ? "database" : "flat";
			const sql = family === "schema" ? listSchemasSql() : family === "database" ? listDatabasesSql() : "";
			if (!sql) return;
			const res = await executeQuery(conn, sql);
			const names = filterSystemNames(res.rows.map((r) => Object.values(r)[0] as string));
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
			const scope: CatalogScope = conn.type === "postgres" ? { kind: "schema", name: schema } : { kind: "database", name: schema };
			const res = await executeQuery(conn, listTablesInScopeSql(scope));
			setSchemas((prev) => prev.map((s) => s.schema === schema ? { ...s, tables: res.rows.map((r) => ({ name: r.table_name as string })) } : s));
		} catch { /* ignore */ }
	}

	async function refreshColumns() {
		if (!activeConn || !selectedTable) return;
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			const [schema, table] = selectedTable.includes(".") ? selectedTable.split(".") : ["public", selectedTable];
			const scope: CatalogScope = conn.type === "postgres" ? { kind: "schema", name: schema } : { kind: "database", name: schema };
			const res = await executeQuery(conn, tableObjectSql(scope, table, "column"));
			setColumns(res.rows.map((r) => ({ name: r.column_name as string, type: r.data_type as string, nullable: r.is_nullable === "YES" })));
		} catch { setColumns([]); }
	}

	async function runQuery() {
		if (!sql.trim() || !activeConn) return;
		setRunState({ kind: "running" });
		try {
			const conn = connections.find((c) => c.name === activeConn);
			if (!conn) return;
			setResult(await executeQuery(conn, sql));
			setRunState({ kind: "idle" });
		} catch (error) { setResult({ columns: [], rows: [], error: String(error) }); setRunState({ kind: "idle" }); }
	}

	const handleContextMenu = useCallback((e: React.MouseEvent, table: string, schema?: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, table, schema }); }, []);

	return (
		<div className="flex h-full min-h-0 flex-col bg-muted/30">
			<div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background/80 px-3">
				<span className="icon-[solar--database-bold] h-4 w-4 text-primary" />
				<span className="text-[12px] font-medium text-foreground">dbx-pro</span>
				<span className="flex-1" />
				<button type="button" onClick={() => setConnFormOpen(true)} className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
					<span className="icon-[lucide--plus] h-3.5 w-3.5" />添加连接
				</button>
			</div>

			<div className="flex min-h-0 flex-1 gap-px bg-border/50 p-px">
				<Surface className="w-[260px] shrink-0 overflow-hidden">
					<ConnectionTree connections={connections} activeConn={activeConn} schemas={schemas} expanded={expanded} selectedTable={selectedTable}
						onSelectConnection={setActiveConn} onToggleSchema={(s) => setExpanded((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; })}
						onSelectTable={(t, s) => setSelectedTable(s ? `${s}.${t}` : t)} onContextMenu={handleContextMenu} />
				</Surface>

				<Surface className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex shrink-0 items-center gap-px border-b bg-muted/20 px-2">
						{sqlTabs.map((tab) => (
							<button key={tab.id} type="button" onClick={() => setActiveTabId(tab.id)}
								className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] transition-colors ${activeTabId === tab.id ? "border-primary bg-background text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
								<span className="icon-[lucide--file-code] h-3 w-3" />{tab.label}
							</button>
						))}
					</div>
					<div className="min-h-[160px] shrink-0 border-b">
						<SqlEditor value={sql} onChange={setSqlTab} onRun={runQuery} busy={runState.kind === "running"} />
					</div>
					<div className="min-h-0 flex-1 overflow-auto">
						{result ? result.error ? (
							<div className="flex h-full items-center justify-center"><pre className="rounded-lg bg-destructive/10 px-4 py-3 text-[11px] text-destructive whitespace-pre-wrap">{result.error}</pre></div>
						) : <ResultGrid columns={result.columns} rows={result.rows} /> : (
							<div className="flex h-full flex-col items-center justify-center text-center">
								<span className="icon-[lucide--table] h-8 w-8 text-muted-foreground/30" />
								<p className="mt-2 text-[11px] text-muted-foreground">执行查询后显示结果</p>
							</div>
						)}
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
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<Surface className="w-[480px] p-4">
						<SectionLabel>添加连接</SectionLabel>
						<ConnectionForm onSave={(c) => { setConnections((p) => [...p, c]); setConnFormOpen(false); refreshConnections(); }} onCancel={() => setConnFormOpen(false)} />
					</Surface>
				</div>
			)}

			{contextMenu && (
				<div className="fixed z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={() => setContextMenu(null)}>
					<button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"><span className="icon-[lucide--eye] h-3.5 w-3.5" /> 预览数据</button>
					<button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"><span className="icon-[lucide--copy] h-3.5 w-3.5" /> 复制表名</button>
				</div>
			)}
		</div>
	);
}
