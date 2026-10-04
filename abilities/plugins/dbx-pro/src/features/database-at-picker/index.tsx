/**
 * 数据库 @ 选择器 — 在宿主 AI 对话框中以 @ 符号选取已连接数据库的库 / 表 / schema。
 *
 * 架构说明（不改宿主源码）：
 * - 宿主 AtPanel 无插件注册扩展点（atItems 由 connector 硬编码）
 * - 本组件作为 activity tab 渲染，用户点击顶栏「数据库」按钮后上栏
 * - 选中表/连接后通过 conversation.insertText() 注入 @`schema.table` 到宿主输入草稿
 * - agent 侧通过 dbx-pro MCP 工具识别该引用并查询对应数据库对象
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { getConversation } from "../../runtime-contract.ts";
import { engineListConnections, engineListSchemas, engineListTables } from "../../shared/services/engine-client.ts";

// ─── 类型 ────────────────────────────────────────────────────────────

interface DbxConnection {
	name: string;
	type: string;
	host: string;
	port: number;
	database: string;
}

interface SchemaNode {
	name: string;
	expanded: boolean;
	loading: boolean;
	tables?: { name: string; kind: string }[];
}

interface ConnectionNode {
	conn: DbxConnection;
	expanded: boolean;
	loading: boolean;
	schemas?: SchemaNode[];
	tables?: { name: string; kind: string }[];
}

// ─── 辅助 ────────────────────────────────────────────────────────────

function formatAtToken(connName: string, schema: string | undefined, table: string): string {
	const qualified = schema ? `${schema}.${table}` : table;
	return `@\`${connName}:${qualified}\` `;
}

function insertIntoHost(token: string): void {
	try {
		getConversation().insertText(token);
	} catch (err) {
		console.warn("[dbx-pro] insertText 失败：", err);
	}
}

// ─── 主组件 ──────────────────────────────────────────────────────────

export function DatabaseAtPicker(): JSX.Element {
	const [connections, setConnections] = useState<DbxConnection[]>([]);
	const [nodes, setNodes] = useState<ConnectionNode[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	// 初始加载连接列表
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				// 确保引擎就绪
				// 注意：activity tab 组件不经过 WorkbenchProvider，
				// 所以不能调用 useWorkbench()；直接通过 engine-client 调 HTTP API。
				const { connections: conns } = await engineListConnections();
				if (cancelled) return;
				setConnections(conns);
				setNodes(conns.map((c) => ({ conn: c, expanded: false, loading: false })));
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => { cancelled = true; };
	}, []);

	// 过滤
	const filteredNodes = useMemo(() => {
		if (!search.trim()) return nodes;
		const needle = search.trim().toLowerCase();
		return nodes.filter(
			(n) =>
				n.conn.name.toLowerCase().includes(needle) ||
				n.conn.type.toLowerCase().includes(needle) ||
				n.conn.host.toLowerCase().includes(needle),
		);
	}, [nodes, search]);

	// 展开连接节点
	const expandConnection = useCallback(async (connName: string) => {
		setNodes((prev) => prev.map((n) => (n.conn.name === connName ? { ...n, loading: true } : n)));
		try {
			// 先试 schema 目录
			const schemaResult = await engineListSchemas(connName);
			if (schemaResult.supported && schemaResult.schemas.length > 0) {
				setNodes((prev) =>
					prev.map((n) =>
						n.conn.name === connName
							? {
									...n,
									expanded: true,
									loading: false,
									schemas: schemaResult.schemas.map((s) => ({ name: s, expanded: false, loading: false })),
								}
							: n,
					),
				);
			} else {
				// 无 schema 概念，直接列表
				const tablesResult = await engineListTables(connName);
				setNodes((prev) =>
					prev.map((n) =>
						n.conn.name === connName
							? { ...n, expanded: true, loading: false, tables: tablesResult.tables }
							: n,
					),
				);
			}
		} catch {
			setNodes((prev) => prev.map((n) => (n.conn.name === connName ? { ...n, loading: false } : n)));
		}
	}, []);

	// 展开 schema 节点
	const expandSchema = useCallback(async (connName: string, schemaName: string) => {
		setNodes((prev) =>
			prev.map((n) =>
				n.conn.name === connName
					? {
							...n,
							schemas: n.schemas?.map((s) =>
								s.name === schemaName ? { ...s, loading: true } : s,
							),
						}
					: n,
			),
		);
		try {
			const tablesResult = await engineListTables(connName, { schema: schemaName });
			setNodes((prev) =>
				prev.map((n) =>
					n.conn.name === connName
						? {
								...n,
								schemas: n.schemas?.map((s) =>
									s.name === schemaName ? { ...s, expanded: true, loading: false, tables: tablesResult.tables } : s,
								),
							}
						: n,
				),
			);
		} catch {
			setNodes((prev) =>
				prev.map((n) =>
					n.conn.name === connName
						? {
								...n,
								schemas: n.schemas?.map((s) => (s.name === schemaName ? { ...s, loading: false } : s)),
							}
						: n,
				),
			);
		}
	}, []);

	// 选择表 → 注入宿主输入框
	const selectTable = useCallback(
		(connName: string, schema: string | undefined, tableName: string) => {
			const token = formatAtToken(connName, schema, tableName);
			insertIntoHost(token);
		},
		[],
	);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				<span className="icon-[lucide--loader] mr-2 h-4 w-4 animate-spin" />
				加载数据库连接…
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive">
				<span className="icon-[lucide--alert-circle] h-5 w-5" />
				<p>{error}</p>
				<button
					type="button"
					onClick={() => {
						setLoading(true);
						setError(null);
						setNodes([]);
						engineListConnections().then(({ connections: c }) => {
							setConnections(c);
							setNodes(c.map((conn) => ({ conn, expanded: false, loading: false })));
							setLoading(false);
						}).catch((e) => {
							setError(e instanceof Error ? e.message : String(e));
							setLoading(false);
						});
					}}
					className="text-xs text-foreground/60 underline hover:text-foreground"
				>
					重试
				</button>
			</div>
		);
	}

	if (connections.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
				<span className="icon-[lucide--database] h-8 w-8 opacity-40" />
				<p>暂无连接</p>
				<p className="text-xs text-muted-foreground/70">请先在工作台添加数据库连接</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 顶栏 */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<span className="icon-[lucide--database] h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium text-foreground">数据库 @ 选择器</span>
				<span className="ml-auto text-xs text-muted-foreground/60">
					{connections.length} 个连接
				</span>
			</div>

			{/* 搜索 */}
			<div className="shrink-0 px-3 py-2">
				<div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
					<span className="icon-[lucide--search] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="搜索连接名 / 类型 / 主机…"
						className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
					/>
				</div>
			</div>

			{/* 树形列表 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1">
				{filteredNodes.map((node) => (
					<ConnectionTreeNode
						key={node.conn.name}
						node={node}
						onExpand={() => expandConnection(node.conn.name)}
						onSelectTable={selectTable}
						onExpandSchema={expandSchema}
					/>
				))}
			</div>

			{/* 底部提示 */}
			<div className="shrink-0 border-t border-border px-3 py-2 text-[10px] text-muted-foreground/70">
				点击表名将 @`连接:表` 注入宿主输入框，发送后 agent 可查询该表
			</div>
		</div>
	);
}

// ─── 连接树节点 ──────────────────────────────────────────────────────

function ConnectionTreeNode({
	node,
	onExpand,
	onSelectTable,
	onExpandSchema,
}: {
	node: ConnectionNode;
	onExpand: () => void;
	onSelectTable: (connName: string, schema: string | undefined, table: string) => void;
	onExpandSchema: (connName: string, schemaName: string) => void;
}): JSX.Element {
	return (
		<div className="py-0.5">
			{/* 连接行 */}
			<div
				className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[var(--dbx-hover)]"
				onClick={onExpand}
			>
				<span
					className={`h-3.5 w-3.5 shrink-0 transition-transform ${node.expanded ? "rotate-90" : ""}`}
				>
					<span className="icon-[lucide--chevron-right] h-3.5 w-3.5 text-muted-foreground" />
				</span>
				<span className="icon-[lucide--database] h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
				<span className="min-w-0 flex-1 truncate font-medium text-foreground">{node.conn.name}</span>
				<span className="shrink-0 text-[10px] text-muted-foreground/60">{node.conn.type}</span>
				{node.loading && <span className="icon-[lucide--loader] h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
			</div>

			{/* 子节点 */}
			{node.expanded && (
				<div className="ml-4 mt-0.5 border-l border-border pl-3">
					{node.schemas ? (
						node.schemas.map((schema) => (
							<SchemaTreeNode
								key={schema.name}
								connName={node.conn.name}
								schema={schema}
								onExpand={() => onExpandSchema(node.conn.name, schema.name)}
								onSelectTable={onSelectTable}
							/>
						))
					) : node.tables ? (
						node.tables.map((t) => (
							<TableItemRow
								key={t.name}
								connName={node.conn.name}
								schema={undefined}
								table={t}
								onSelect={onSelectTable}
							/>
						))
					) : null}
				</div>
			)}
		</div>
	);
}

// ─── Schema 节点 ─────────────────────────────────────────────────────

function SchemaTreeNode({
	connName,
	schema,
	onExpand,
	onSelectTable,
}: {
	connName: string;
	schema: SchemaNode;
	onExpand: () => void;
	onSelectTable: (connName: string, schema: string | undefined, table: string) => void;
}): JSX.Element {
	return (
		<div className="py-0.5">
			<div
				className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[var(--dbx-hover)]"
				onClick={onExpand}
			>
				<span className={`h-3.5 w-3.5 shrink-0 transition-transform ${schema.expanded ? "rotate-90" : ""}`}>
					<span className="icon-[lucide--chevron-right] h-3.5 w-3.5 text-muted-foreground" />
				</span>
				<span className="icon-[lucide--layers] h-3.5 w-3.5 shrink-0 text-sky-400/70" />
				<span className="min-w-0 flex-1 truncate text-foreground/80">{schema.name}</span>
				{schema.loading && <span className="icon-[lucide--loader] h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
			</div>

			{schema.expanded && schema.tables && (
				<div className="ml-4 mt-0.5 border-l border-border pl-3">
					{schema.tables.map((t) => (
						<TableItemRow
							key={t.name}
							connName={connName}
							schema={schema.name}
							table={t}
							onSelect={onSelectTable}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ─── 表行 ────────────────────────────────────────────────────────────

function TableItemRow({
	connName,
	schema,
	table,
	onSelect,
}: {
	connName: string;
	schema: string | undefined;
	table: { name: string; kind: string };
	onSelect: (connName: string, schema: string | undefined, table: string) => void;
}): JSX.Element {
	return (
		<div
			className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[var(--dbx-hover)]"
			onClick={() => onSelect(connName, schema, table.name)}
		>
			<span
				className={`h-3.5 w-3.5 shrink-0 ${table.kind === "VIEW" ? "icon-[lucide--eye-off] text-sky-400/70" : "icon-[lucide--table-2] text-emerald-400/70"}`}
			/>
			<span className="min-w-0 flex-1 truncate text-foreground/70">{table.name}</span>
			<span className="shrink-0 text-[9px] text-muted-foreground/50">{table.kind}</span>
		</div>
	);
}
