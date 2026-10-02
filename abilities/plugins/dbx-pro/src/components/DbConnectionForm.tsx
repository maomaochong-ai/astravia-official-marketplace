import { useEffect, useState } from "react";
import type { PluginCommandApi } from "@astravia-org/plugin-sdk";
import { genUuid, writeConfig, deleteConfig, readAllConfigs } from "../db/dbx-sqlite";
import type { DbConnection } from "../db-types";

/**
 * 连接管理侧栏表单 — 完整覆盖 dbx ConnectionConfig 核心字段。
 * 新增/编辑/删除/测试连接都在这里，持久化走 sqlite3 CLI 读写 dbx.db。
 */
interface Props {
	open: boolean;
	command: PluginCommandApi;
	onClose: () => void;
	onSaved: () => void; // 连接变更后调用，刷新外部列表
}

const DB_TYPE_OPTIONS = [
	{ value: "postgres", label: "PostgreSQL", port: 5432 },
	{ value: "mysql", label: "MySQL", port: 3306 },
	{ value: "sqlite", label: "SQLite", port: 0 },
	{ value: "redshift", label: "Amazon Redshift", port: 5439 },
	{ value: "clickhouse", label: "ClickHouse", port: 8123 },
	{ value: "sqlserver", label: "SQL Server", port: 1433 },
	{ value: "mongodb", label: "MongoDB", port: 27017 },
	{ value: "oracle", label: "Oracle", port: 1521 },
	{ value: "duckdb", label: "DuckDB (文件)", port: 0 },
	{ value: "redis", label: "Redis", port: 6379 },
	{ value: "elasticsearch", label: "Elasticsearch", port: 9200 },
	{ value: "snowflake", label: "Snowflake", port: 443 },
	{ value: "trino", label: "Trino", port: 8080 },
	{ value: "doris", label: "Apache Doris", port: 9030 },
	{ value: "starrocks", label: "StarRocks", port: 9030 },
	{ value: "influxdb", label: "InfluxDB", port: 8086 },
	{ value: "neo4j", label: "Neo4j", port: 7687 },
	{ value: "tidb", label: "TiDB", port: 4000 },
	{ value: "cloudflare-d1", label: "Cloudflare D1", port: 0 },
	{ value: "rqlite", label: "rqlite", port: 4001 },
];

function emptyConnection(): DbConnection {
	return {
		id: genUuid(),
		name: "",
		db_type: "postgres",
		host: "localhost",
		port: 5432,
		username: "",
		password: "",
		database: "",
		note: "",
		ssl: false,
		is_production: false,
		read_only: false,
	};
}

export function DbConnectionForm({ open, command, onClose, onSaved }: Props) {
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [editing, setEditing] = useState<DbConnection | null>(null);
	const [activeTab, setActiveTab] = useState<"list" | "form">("list");
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<string | null>(null);

	useEffect(() => {
		if (open) refresh();
	}, [open]);

	async function refresh() {
		try {
			const cfgs = await readAllConfigs(command);
			setConnections(cfgs as DbConnection[]);
		} catch {
			setConnections([]);
		}
	}

	function startNew() {
		setEditing(emptyConnection());
		setTestResult(null);
		setActiveTab("form");
	}

	function startEdit(c: DbConnection) {
		setEditing({ ...c });
		setTestResult(null);
		setActiveTab("form");
	}

	function back() {
		setEditing(null);
		setTestResult(null);
		setActiveTab("list");
	}

	function onTypeChange(val: string) {
		const opt = DB_TYPE_OPTIONS.find((o) => o.value === val);
		if (!editing) return;
		setEditing({
			...editing,
			db_type: val,
			port: opt?.port ?? editing.port,
			// SQLite/DuckDB 类型切换时 host 改成文件路径提示
			host: (val === "sqlite" || val === "duckdb")
				? editing.host || "/path/to/db.sqlite"
				: editing.host || "localhost",
		});
	}

	async function save() {
		if (!editing) return;
		if (!editing.name.trim()) { alert("请填写连接名称"); return; }
		try {
			await writeConfig(command, editing);
			await refresh();
			onSaved();
			back();
		} catch (err) {
			alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function remove(c: DbConnection) {
		if (!confirm(`删除连接 "${c.name}" ？`)) return;
		try {
			await deleteConfig(command, c.id);
			await refresh();
			onSaved();
		} catch (err) {
			alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function test(c: DbConnection) {
		setTesting(true);
		setTestResult(null);
		try {
			// 临时保存一份再用 dbx query 探测（dbx 不会保存测试连接）
			await writeConfig(command, c);
			// 用 dbx capabilities 做探测，或直接发一条 SELECT 1
			// 简单探测：try a simple query on this connection
			const dbx = await import("../db/dbx-cli");
			const r = await dbx.executeQuery(command, c.name, "SELECT 1 AS ok", { limit: 1, timeoutMs: 10_000 });
			setTestResult(`✅ 连接成功 · 返回 ${r.row_count} 行`);
		} catch (err) {
			setTestResult(`❌ 连接失败: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setTesting(false);
		}
	}

	if (!open) return null;

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onClose} />
			<div className="dbx-sheet" style={{ width: 520 }}>
				<div className="dbx-sheet-header">
					<div style={{ fontWeight: 600, fontSize: 14 }}>
						{activeTab === "form" ? (editing?.name ? "编辑连接" : "新建连接") : "管理连接"}
					</div>
					<button className="dbx-btn ghost" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
				</div>

				<div className="dbx-sheet-body">
					{activeTab === "list" && (
						<>
							<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
								<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
									共 {connections.length} 个连接 · 存储于 dbx.db
								</div>
								<button className="dbx-btn primary" onClick={startNew}>+ 新建</button>
							</div>
							{connections.length === 0 && (
								<div className="dbx-empty" style={{ padding: 24, borderRadius: 8, background: "rgba(0,0,0,0.02)" }}>
									暂无连接 · 点「新建」或先在 dbx 桌面应用中添加
								</div>
							)}
							{connections.map((c) => (
								<div
									key={c.id}
									style={{
										display: "flex", alignItems: "center", gap: 8,
										padding: "10px 12px", borderRadius: 6, marginBottom: 6,
										border: "1px solid var(--border)", fontSize: 13,
									}}
								>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
											{c.is_production && <span style={{
												fontSize: 10, padding: "1px 6px", borderRadius: 10,
												background: "rgba(220,38,38,0.1)", color: "#dc2626",
											}}>PROD</span>}
											{c.name}
										</div>
										<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
											{c.db_type} · {c.host}:{c.port}
											{c.database ? ` · ${c.database}` : ""}
										</div>
									</div>
									<button className="dbx-btn ghost" onClick={() => startEdit(c)}>编辑</button>
									<button className="dbx-btn ghost" onClick={() => test(c)} disabled={testing}>
										{testing ? "测试中…" : "测试"}
									</button>
									<button className="dbx-btn ghost" onClick={() => remove(c)} style={{ color: "#dc2626" }}>删除</button>
								</div>
							))}
							{testResult && (
								<div style={{
									marginTop: 12, padding: "8px 12px", borderRadius: 6,
									background: "rgba(0,0,0,0.03)", fontSize: 12,
								}}>
									{testResult}
								</div>
							)}
						</>
					)}

					{activeTab === "form" && editing && (
						<ConnectionFormFields
							conn={editing}
							onChange={setEditing}
							onTypeChange={onTypeChange}
						/>
					)}
				</div>

				{activeTab === "form" && editing && (
					<div className="dbx-sheet-footer">
						<button className="dbx-btn ghost" onClick={back}>取消</button>
						<button className="dbx-btn primary" onClick={save}>保存</button>
					</div>
				)}
			</div>
		</>
	);
}

function ConnectionFormFields({
	conn, onChange, onTypeChange,
}: {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
	onTypeChange: (t: string) => void;
}) {
	const isSqlite = conn.db_type === "sqlite" || conn.db_type === "duckdb" || conn.db_type === "cloudflare-d1";
	const isMongo = conn.db_type === "mongodb";
	const isRedis = conn.db_type === "redis";

	return (
		<div>
			<div className="dbx-form-row">
				<label className="dbx-form-label">连接名称 *</label>
				<input
					className="dbx-form-input"
					value={conn.name}
					onChange={(e) => onChange({ ...conn, name: e.target.value })}
					placeholder="生产 PostgreSQL"
				/>
			</div>

			<div className="dbx-form-row">
				<label className="dbx-form-label">数据库类型 *</label>
				<select
					className="dbx-form-input"
					value={conn.db_type}
					onChange={(e) => onTypeChange(e.target.value)}
				>
					{DB_TYPE_OPTIONS.map((t) => (
						<option key={t.value} value={t.value}>{t.label}</option>
					))}
				</select>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
				<div className="dbx-form-row">
					<label className="dbx-form-label">{isSqlite ? "文件路径" : "Host"} *</label>
					<input
						className="dbx-form-input"
						value={conn.host}
						onChange={(e) => onChange({ ...conn, host: e.target.value })}
						placeholder={isSqlite ? "/path/to/db.sqlite" : "localhost"}
					/>
				</div>
				{!isSqlite && (
					<div className="dbx-form-row">
						<label className="dbx-form-label">Port</label>
						<input
							className="dbx-form-input"
							type="number"
							value={conn.port}
							onChange={(e) => onChange({ ...conn, port: Number(e.target.value) || 0 })}
						/>
					</div>
				)}
			</div>

			{!isSqlite && (
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
					<div className="dbx-form-row">
						<label className="dbx-form-label">用户名</label>
						<input
							className="dbx-form-input"
							value={conn.username}
							onChange={(e) => onChange({ ...conn, username: e.target.value })}
							placeholder="postgres"
						/>
					</div>
					<div className="dbx-form-row">
						<label className="dbx-form-label">密码</label>
						<input
							className="dbx-form-input"
							type="password"
							value={conn.password}
							onChange={(e) => onChange({ ...conn, password: e.target.value })}
							placeholder="••••••"
						/>
					</div>
				</div>
			)}

			<div className="dbx-form-row">
				<label className="dbx-form-label">默认 {isMongo ? "数据库" : "Database"}（可选）</label>
				<input
					className="dbx-form-input"
					value={conn.database ?? ""}
					onChange={(e) => onChange({ ...conn, database: e.target.value })}
					placeholder={isMongo ? "mydb" : "留空用服务器默认"}
				/>
			</div>

			{isMongo && (
				<div className="dbx-form-row">
					<label className="dbx-form-label">连接字符串（覆盖 host/port/user/pass）</label>
					<input
						className="dbx-form-input"
						value={(conn.connection_string as string) ?? ""}
						onChange={(e) => onChange({ ...conn, connection_string: e.target.value })}
						placeholder="mongodb://user:pass@host:27017"
					/>
				</div>
			)}

			<div style={{ display: "flex", gap: 16, marginTop: 8 }}>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input
						type="checkbox"
						checked={!!conn.ssl}
						onChange={(e) => onChange({ ...conn, ssl: e.target.checked })}
					/>
					SSL
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input
						type="checkbox"
						checked={!!conn.is_production}
						onChange={(e) => onChange({ ...conn, is_production: e.target.checked })}
					/>
					⚠️ 标记为生产环境（默认阻断写入/DDL）
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input
						type="checkbox"
						checked={!!conn.read_only}
						onChange={(e) => onChange({ ...conn, read_only: e.target.checked })}
					/>
					只读
				</label>
			</div>

			<div className="dbx-form-row" style={{ marginTop: 12 }}>
				<label className="dbx-form-label">备注</label>
				<textarea
					className="dbx-form-input"
					rows={2}
					value={conn.note ?? ""}
					onChange={(e) => onChange({ ...conn, note: e.target.value })}
					placeholder="这个连接是做什么用的…"
				/>
			</div>

			{!isSqlite && (
				<div style={{
					marginTop: 12, padding: 12, borderRadius: 6,
					background: "rgba(0,0,0,0.02)", fontSize: 12,
				}}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>高级</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
						<div>
							<label className="dbx-form-label">连接超时 (秒)</label>
							<input
								className="dbx-form-input"
								type="number"
								value={conn.connect_timeout_secs ?? 10}
								onChange={(e) => onChange({ ...conn, connect_timeout_secs: Number(e.target.value) })}
							/>
						</div>
						<div>
							<label className="dbx-form-label">查询超时 (秒)</label>
							<input
								className="dbx-form-input"
								type="number"
								value={conn.query_timeout_secs ?? 60}
								onChange={(e) => onChange({ ...conn, query_timeout_secs: Number(e.target.value) })}
							/>
						</div>
					</div>
					<div style={{ marginTop: 8 }}>
						<label className="dbx-form-label">URL 参数（?key=value&...）</label>
						<input
							className="dbx-form-input"
							value={(conn.url_params as string) ?? ""}
							onChange={(e) => onChange({ ...conn, url_params: e.target.value })}
							placeholder="sslmode=require&pool_max=10"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
