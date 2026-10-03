/**
 * TableInspector — 右栏表详情面板。
 *
 * - 选中表时显示：表名、schema、列信息（类型/可空/PK/默认值）、CREATE TABLE DDL
 * - 快捷操作：SELECT * 预览
 * - 默认显示连接详情（未选中表时）
 */

import { useEffect, useState, type JSX } from "react";
import { useWorkbench, type EngineColumn } from "./workbench-context";
import { engineDescribeByName } from "../../../shared/services/engine-client";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";

export function TableInspector(): JSX.Element {
	const { state, dispatch, openPreviewTab } = useWorkbench();
	const selection = state.rightPanelTable;
	const activeConn = state.activeConnectionName
		? state.connections.find((c) => c.name === state.activeConnectionName)
		: null;
	const [describeOutcome, setDescribeOutcome] = useState<{ columns: EngineColumn[]; sql?: string } | null>(null);
	const [loadingDescribe, setLoadingDescribe] = useState(false);

	// 选中表时懒加载完整 describe 信息
	useEffect(() => {
		if (!selection) { setDescribeOutcome(null); return; }
		const cacheKey = `${selection.connectionName}::${selection.tableName}`;
		const cached = state.tabColumnsMap.get(cacheKey);
		if (cached) { setDescribeOutcome({ columns: cached }); return; }
		setLoadingDescribe(true);
		engineDescribeByName(selection.connectionName, { schema: selection.schema, table: selection.tableName })
			.then((outcome) => {
				const cols: EngineColumn[] = outcome.columns.map((c) => ({
					name: c.name,
					type: c.type,
					nullable: c.nullable,
					hasDefault: c.hasDefault,
					defaultValue: c.defaultValue,
					comment: c.comment,
					isPrimaryKey: c.isPrimaryKey,
				}));
				setDescribeOutcome({ columns: cols, sql: (outcome as unknown as { sql?: string }).sql });
			})
			.catch(() => setDescribeOutcome({ columns: [] }))
			.finally(() => setLoadingDescribe(false));
	}, [selection?.connectionName, selection?.tableName, selection?.schema]);

	if (selection) {
		return (
			<div className="flex h-full flex-col bg-background">
				<TableHeader selection={selection} onClose={() => dispatch({ type: "selectRightTable", selection: null })} />

				{/* 快捷操作 */}
				<div className="dbx-scroll flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-2" style={{ borderBottom: "1px solid var(--dbx-line-soft)" }}>
					<button
						type="button"
						onClick={() => {
							const qualified = selection.schema
								? `${selection.schema}.${selection.tableName}`
								: selection.tableName;
							void openPreviewTab(selection.connectionName, `SELECT * FROM ${qualified} LIMIT 200;`, selection.tableName);
						}}
						className="flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-medium"
						style={{ backgroundColor: "var(--dbx-surface-2)", color: "var(--foreground)" }}
						title="新标签预览前 200 行"
					>
						<span className="icon-[lucide--eye] h-3 w-3" />
						SELECT *
					</button>
					<button
						type="button"
						onClick={() => {
							const qualified = selection.schema
								? `${selection.schema}.${selection.tableName}`
								: selection.tableName;
							void openPreviewTab(selection.connectionName, `SELECT COUNT(*) AS __cnt FROM ${qualified};`, "计数");
						}}
						className="flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[11px] text-muted-foreground"
						style={{ border: "1px solid var(--dbx-line)" }}
					>
						<span className="icon-[lucide--hash] h-3 w-3" />
						行数
					</button>
					<button
						type="button"
						onClick={() => void navigator.clipboard.writeText(selection.tableName).catch(() => {})}
						title="复制表名"
						className="dbx-iconbtn"
						style={{ height: 24, minWidth: 24, padding: 0 }}
					>
						<span className="icon-[lucide--copy] h-3 w-3" />
					</button>
				</div>

				{/* 列信息 */}
				<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
					<SectionLabel icon="icon-[lucide--columns-3]">
						列 {describeOutcome?.columns.length ? `(${describeOutcome.columns.length})` : ""}
					</SectionLabel>
					{loadingDescribe ? (
						<div className="flex items-center gap-1 pt-2 text-[11px] text-muted-foreground">
							<span className="icon-[lucide--loader] h-3 w-3 animate-spin" /> 加载中…
						</div>
					) : describeOutcome?.columns && describeOutcome.columns.length > 0 ? (
						<div className="mt-2 space-y-0.5">
							{describeOutcome.columns.map((col) => (
								<ColumnRow key={col.name} col={col} />
							))}
						</div>
					) : (
						<p className="mt-2 text-[11px] text-muted-foreground/70">无法获取列信息</p>
					)}

					{/* DDL */}
					{describeOutcome?.sql && (
						<div className="mt-4">
							<SectionLabel icon="icon-[lucide--file-code]">DDL</SectionLabel>
							<pre className="mt-2 max-h-[200px] overflow-auto rounded-md bg-background p-2 font-mono text-[10.5px] leading-relaxed text-foreground/80">
								{describeOutcome.sql}
							</pre>
						</div>
					)}
				</div>
			</div>
		);
	}

	// 默认：连接详情
	return (
		<div className="flex h-full flex-col bg-background">
			{activeConn ? (
				<ConnectionCard conn={activeConn} />
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/70">
					<span className="icon-[lucide--mouse-pointer-click] h-6 w-6 opacity-40" />
					<p className="text-[11px]">选择连接或表查看详情</p>
				</div>
			)}
		</div>
	);
}

function TableHeader({ selection, onClose }: { selection: { connectionName: string; tableName: string; schema?: string }; onClose: () => void }): JSX.Element {
	const qualified = selection.schema ? `${selection.schema}.${selection.tableName}` : selection.tableName;
	return (
		<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
			<span className="icon-[lucide--table-2] h-4 w-4 text-emerald-400" />
			<div className="min-w-0 flex-1">
				<h3 className="truncate text-[13px] font-semibold text-foreground">{qualified}</h3>
				<p className="truncate text-[10px] text-muted-foreground/70">连接: {selection.connectionName}</p>
			</div>
			<button
				type="button"
				onClick={onClose}
				title="关闭"
				className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground"
			>
				<span className="icon-[lucide--x] h-3 w-3" />
			</button>
		</div>
	);
}

function ColumnRow({ col }: { col: EngineColumn }): JSX.Element {
	return (
		<div className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--dbx-hover)]">
			<span className={`shrink-0 ${col.isPrimaryKey ? "icon-[lucide--key-round] text-amber-400" : col.nullable ? "icon-[lucide--circle-dot] text-muted-foreground/70" : "icon-[lucide--dot] text-muted-foreground"} h-3 w-3`} />
			<span className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={col.name}>{col.name}</span>
			<span className="shrink-0 rounded bg-[var(--dbx-surface-2)] px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{col.type}</span>
			{col.isPrimaryKey && <span className="shrink-0 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400">PK</span>}
			{!col.nullable && !col.isPrimaryKey && <span className="shrink-0 text-[9px] text-muted-foreground/70">NOT NULL</span>}
			{col.hasDefault && col.defaultValue && (
				<span className="shrink-0 text-[9px] font-mono text-muted-foreground" title={col.defaultValue}>
					= {col.defaultValue.length > 12 ? col.defaultValue.slice(0, 11) + "…" : col.defaultValue}
				</span>
			)}
		</div>
	);
}

function ConnectionCard({ conn }: { conn: DbConnectionRef }): JSX.Element {
	const visual = getDatabaseTypeVisual(conn.db_type);
	const endpoint = ["sqlite", "duckdb", "cloudflare-d1"].includes(conn.db_type)
		? conn.host
		: conn.port ? `${conn.host}:${conn.port}` : conn.host;
	return (
		<div className="flex h-full flex-col">
			<div className="flex items-start gap-3 border-b border-border p-3">
				<span
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
					style={{ backgroundColor: visual.color, color: visual.badge === "DU" ? "#1e293b" : "#fff" }}
				>
					{visual.badge}
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-[13px] font-semibold text-foreground">{conn.name}</h3>
					<p className="text-[10px] text-muted-foreground">{conn.db_type}</p>
				</div>
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto p-3">
				<SectionLabel icon="icon-[lucide--server]">连接信息</SectionLabel>
				<InfoRow icon="icon-[lucide--server]" label="端点" value={endpoint} />
				{conn.username && <InfoRow icon="icon-[lucide--user]" label="用户" value={conn.username} />}
				{conn.database && <InfoRow icon="icon-[lucide--database]" label="默认库" value={conn.database} />}
				{conn.ssl && <InfoRow icon="icon-[lucide--lock]" label="SSL" value="启用" />}
				{conn.read_only && <InfoRow icon="icon-[lucide--shield]" label="只读" value="是" />}
				{conn.is_production && <InfoRow icon="icon-[lucide--alert-triangle]" label="生产" value="是" valueCls="text-amber-400" />}
				{conn.note && <InfoRow icon="icon-[lucide--file-text]" label="备注" value={conn.note} />}
			</div>
		</div>
	);
}

type DbConnectionRef = {
	name: string; db_type: string; host: string; port: number; username: string; database?: string; ssl?: boolean; read_only?: boolean; is_production?: boolean; note?: string;
};

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }): JSX.Element {
	return (
		<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
			<span className={`h-3 w-3 ${icon}`} />
			{children}
		</div>
	);
}

function InfoRow({ icon, label, value, valueCls }: { icon: string; label: string; value: string; valueCls?: string }): JSX.Element {
	const [copied, setCopied] = useState(false);
	function copy() {
		void navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		}).catch(() => {});
	}
	return (
		<div className="group flex items-center gap-2">
			<span className={`h-3 w-3 shrink-0 text-muted-foreground/70 ${icon}`} />
			<span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
			<span className={`min-w-0 flex-1 truncate text-[11px] text-foreground/80 ${valueCls ?? ""}`} title={value}>{value}</span>
			<button
				type="button"
				onClick={copy}
				className="opacity-0 group-hover:opacity-100"
				title={copied ? "已复制" : "复制"}
			>
				<span className={`h-3 w-3 ${copied ? "icon-[lucide--check] text-emerald-400" : "icon-[lucide--copy] text-muted-foreground"}`} />
			</button>
		</div>
	);
}
