/**
 * 连接管理侧栏表单 — 新增/编辑/删除/测试连接。
 *
 * 表单字段覆盖 ConnectionConfig 核心属性：基础信息、网络连接、
 * 凭据、安全旗标、连接超时和 URL 参数。DB 类型下拉项从引擎
 * manifest 生成（80+ 种），按 category 分组展示。默认端口/
 * 默认用户名根据 manifest 自动填充。文件型数据库（SQLite /
 * Turso / Cloudflare D1 / DuckDB）仅显示文件路径 + database。
 */

import { useEffect, useState, useMemo } from "react";
import {
	DB_TYPE_MANIFEST,
	type DbConnection,
	type DbType,
	type DbTypeManifestEntry,
} from "../../../domain/connection-config";
import { genUuid, readAllConfigs, writeConfig, deleteConfig } from "../../../domain/dbx-storage";
import { tierFor, tierLabel, tierReasonText, isReadyDbType, tierStats } from "../../../domain/driver-tiers";
import { engineExecuteByName } from "../../../shared/services/engine-client";

// ─── dbType 分类（对齐 dbx 桌面端 ConnectionDialog） ────────────

interface DbCategory {
	/** 显示名称 */
	label: string;
	/** dbType 集合 */
	dbTypes: DbType[];
}

/** 预定义的 dbType → category 映射；不在任何预定义组里的归入 "其他" */
const CATEGORY_DEFS: DbCategory[] = [
	{
		label: "关系型 SQL",
		dbTypes: [
			"postgres", "postgresql", "aurora-postgresql",
			"mysql", "mariadb", "sundb", "kwdb", "gbase", "goldendb", "uds",
			"oracle", "oceanbase-oracle", "yashandb", "dameng",
			"sqlserver",
			"sqlite", "duckdb", "cloudflare-d1", "turso", "rqlite",
			"db2", "informix",
			"clickhouse",
			"access", "h2", "firebird", "exasol", "vertica", "saphana", "teradata",
			"hive", "spark", "kyuubi", "transwarp", "argo",
			"impala", "iris", "ignite", "ignite3", "xugu", "oscar", "iotdb",
		],
	},
	{
		label: "分析型",
		dbTypes: ["redshift", "snowflake", "bigquery", "starrocks", "doris", "tidb", "databend", "databricks", "spanner"],
	},
	{
		label: "文档 / NoSQL",
		dbTypes: ["mongodb", "redis", "elasticsearch", "easysearch", "meilisearch", "solr"],
	},
	{
		label: "国产",
		dbTypes: [
			"oceanbase-oracle", "kingbase", "dameng", "highgo",
			"gaussdb", "opengauss", "vastbase", "uds", "xugu", "oscar",
			"kwdb", "gbase", "goldendb", "yashandb", "sundb",
		],
	},
	{
		label: "其他",
		dbTypes: ["mssql", "trino", "prestosql", "presto", "cassandra", "kylin"],
	},
];

/**
 * 把 DB_TYPE_MANIFEST 按 CATEGORY_DEFS 分组。每个 entry 至多属于一个预定义组；
 * 未命中任何预定义组的集中归入 "其他"，同时保留 manifest 原生 order。
 */
function groupManifestByCategory(): Array<{ label: string; entries: DbTypeManifestEntry[] }> {
	const bucket = new Map<string, DbTypeManifestEntry[]>();
	for (const cat of CATEGORY_DEFS) bucket.set(cat.label, []);
	bucket.set("其他", []);

	const dbTypeToCat = new Map<string, string>();
	for (const cat of CATEGORY_DEFS) {
		for (const t of cat.dbTypes) {
			// 若重复（例如 oceanbase-oracle 同时在 "关系型 SQL" 和 "国产"），
			// 保留先出现的那个（此处 "国产" 在 "关系型 SQL" 之后，所以会被覆盖到 "国产"）
			dbTypeToCat.set(t, cat.label);
		}
	}

	for (const entry of DB_TYPE_MANIFEST) {
		const cat = dbTypeToCat.get(entry.dbType) ?? "其他";
		bucket.get(cat)!.push(entry);
	}

	const out: Array<{ label: string; entries: DbTypeManifestEntry[] }> = [];
	for (const cat of CATEGORY_DEFS) {
		const entries = bucket.get(cat.label)!;
		if (entries.length > 0) out.push({ label: cat.label, entries });
	}
	const others = bucket.get("其他")!;
	if (others.length > 0) out.push({ label: "其他", entries: others });

	// 每个组内按 manifest 原生 order 排序
	for (const g of out) g.entries.sort((a, b) => a.order - b.order);
	return out;
}

// ─── 默认用户名映射（dbType → 合理默认） ─────────────────────

const DEFAULT_USERNAME_BY_DB_TYPE: Record<string, string> = {
	postgres: "postgres",
	postgresql: "postgres",
	"aurora-postgresql": "postgres",
	mysql: "root",
	mariadb: "root",
	sqlserver: "sa",
	oracle: "system",
	snowflake: "",
	redshift: "awsuser",
	bigquery: "",
	starrocks: "root",
	doris: "root",
	clickhouse: "default",
	mongodb: "",
	redis: "",
	elasticsearch: "",
	meilisearch: "",
	kingbase: "system",
	gaussdb: "gaussdb",
	opengauss: "gsdb",
	highgo: "highgo",
	oceanbase: "root",
	"oceanbase-oracle": "root",
	db2: "db2inst1",
	informix: "informix",
	trino: "",
	prestosql: "",
	presto: "",
	hive: "hive",
	spark: "",
	saphana: "SYSTEM",
	teradata: "dbc",
};

// ─── 文件型数据库集合（跳过 host/port/user/password） ─────────

const FILE_BASED_DB_TYPES = new Set<DbType>(["sqlite", "cloudflare-d1", "turso", "duckdb"]);

function isFileBasedDbType(dbType: DbType): boolean {
	return FILE_BASED_DB_TYPES.has(dbType);
}

function defaultHostPlaceholder(dbType: DbType): string {
	if (FILE_BASED_DB_TYPES.has(dbType)) return "/path/to/db.sqlite";
	if (dbType === "turso") return "database.turso.io";
	if (dbType === "cloudflare-d1") return "Cloudflare D1 database id";
	return "localhost";
}

function defaultUsernameFor(dbType: DbType): string {
	const v = DEFAULT_USERNAME_BY_DB_TYPE[dbType];
	return v !== undefined ? v : "";
}

// ─── 初始值 ───────────────────────────────────────────────────

function emptyConnection(): DbConnection {
	const first = DB_TYPE_MANIFEST[0];
	const dbType = first?.dbType ?? "postgres";
	const fileBased = isFileBasedDbType(dbType);
	return {
		id: genUuid(),
		name: "",
		db_type: dbType,
		host: fileBased ? "/path/to/db.sqlite" : "localhost",
		port: first?.defaultPort ?? 5432,
		username: fileBased ? "" : defaultUsernameFor(dbType),
		password: "",
		ssl: false,
		is_production: false,
		read_only: false,
	};
}

// ─── 主组件 ───────────────────────────────────────────────────

interface Props {
	/** 连接增/删/改后通知外层重载列表。 */
	onChange: () => void;
	onCancel: () => void;
	/** 从连接树右键「编辑连接」进入时，直接打开该连接的表单。 */
	initialEditName?: string;
}

export function ConnectionForm({ onChange, onCancel, initialEditName }: Props) {
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [editing, setEditing] = useState<DbConnection | null>(null);
	const [activeTab, setActiveTab] = useState<"list" | "form">("list");
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			const cfgs = await readAllConfigs().catch(() => [] as DbConnection[]);
			setConnections(cfgs);
			const target = initialEditName ? cfgs.find((c) => c.name === initialEditName) : undefined;
			if (target) { setEditing({ ...target }); setActiveTab("form"); }
		})();
	}, [initialEditName]);

	async function refresh() {
		try {
			const cfgs = await readAllConfigs();
			setConnections(cfgs);
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
		if (!editing) return;
		const entry = DB_TYPE_MANIFEST.find((e) => e.dbType === val);
		const fileBased = isFileBasedDbType(val);
		setEditing({
			...editing,
			db_type: val,
			port: entry?.defaultPort ?? editing.port,
			// 若用户尚未填 host，自动切换 placeholder 语义；保留已填内容
			host: editing.host
				? (fileBased
					? (editing.host === "localhost" ? defaultHostPlaceholder(val) : editing.host)
					: (editing.host.startsWith("/") ? "localhost" : editing.host))
				: (fileBased ? defaultHostPlaceholder(val) : "localhost"),
			// 用户名：仅在用户未改过 / 当前为空时才自动填默认
			username: editing.username
				? editing.username
				: defaultUsernameFor(val),
		});
	}

	async function save() {
		if (!editing) return;
		if (!editing.name.trim()) { alert("请填写连接名称"); return; }
		try {
			await writeConfig(editing);
			await refresh();
			onChange();
			back();
		} catch (err) {
			alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function remove(c: DbConnection) {
		if (!confirm(`删除连接 "${c.name}" ？此操作不可撤销。`)) return;
		try {
			await deleteConfig(c.id);
			await refresh();
			onChange();
		} catch (err) {
			alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function test(c: DbConnection) {
		setTesting(true);
		setTestResult(null);
		try {
			await writeConfig(c);
			await engineExecuteByName(c.name, "SELECT 1 AS ok", { timeoutMs: 10_000 });
			onChange();
			setTestResult("✅ 连接成功 · 取数路径：引擎");
		} catch (err) {
			const code = (err as { code?: string } | null)?.code;
			setTestResult(`❌ 连接失败${code ? ` [${code}]` : ""}: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setTesting(false);
		}
	}

	const groupedManifest = useMemo(() => groupManifestByCategory(), []);

	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onCancel} />
			<div className="dbx-sheet" style={{ width: 560 }}>
				<div className="dbx-sheet-header">
					<div style={{ fontWeight: 600, fontSize: 14 }}>
						{activeTab === "form" ? (editing?.name ? "编辑连接" : "新建连接") : "管理连接"}
					</div>
					<button className="dbx-btn ghost" onClick={onCancel} style={{ padding: "4px 8px" }}>✕</button>
				</div>

				<div className="dbx-sheet-body">
					{activeTab === "list" && (
						<>
							<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
								<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
									共 {connections.length} 个连接
								</div>
								<button className="dbx-btn primary" onClick={startNew}>+ 新建</button>
							</div>
							{connections.length === 0 && (
								<div className="dbx-empty" style={{ padding: 24, borderRadius: 8 }}>
									暂无连接 · 点右上「新建」
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
											{c.db_type} · {c.host}{c.port ? `:${c.port}` : ""}
											{c.database ? ` · ${c.database}` : ""}
										</div>
									</div>
									<button className="dbx-btn ghost" onClick={() => startEdit(c)}>编辑</button>
									<button className="dbx-btn ghost" onClick={() => test(c)} disabled={testing}>
										{testing ? "…" : "测试"}
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
						<FormFields
							conn={editing}
							onChange={setEditing}
							onTypeChange={onTypeChange}
							groupedManifest={groupedManifest}
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

// ─── 表单主体 ─────────────────────────────────────────────────

function FormFields({
	conn, onChange, onTypeChange, groupedManifest,
}: {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
	onTypeChange: (t: string) => void;
	groupedManifest: Array<{ label: string; entries: DbTypeManifestEntry[] }>;
}) {
	const isFileBased = isFileBasedDbType(conn.db_type);
	const [showPassword, setShowPassword] = useState(false);
	const manifestEntry = useMemo(
		() => DB_TYPE_MANIFEST.find((e) => e.dbType === conn.dbType),
		[conn.dbType],
	);

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
				<label className="dbx-form-label">
					数据库类型 *
					<span style={{ fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>
						（{DB_TYPE_MANIFEST.length} 种，{tierStats().ready} 种可直接查询）
					</span>
				</label>
				<select
					className="dbx-form-input"
					value={conn.db_type}
					onChange={(e) => onTypeChange(e.target.value)}
				>
					{groupedManifest.map((g) => (
						<optgroup key={g.label} label={g.label}>
							{g.entries.map((e) => (
								<option key={e.dbType} value={e.dbType}>
									{e.label} ({e.dbType}) · {tierLabel(tierFor(e.dbType))}
									{e.runtimeMode === "bridge" ? " · bridge" : ""}
								</option>
							))}
						</optgroup>
					))}
				</select>
				<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
					档位只表示当前实现状态：<b>可直接查询</b>（引擎已实现）/ <b>试验性</b>（引擎已登记未实现，连接会如实返回 DRIVER_UNSUPPORTED）/ <b>范围外</b>（仅保留配置形态）。
				</div>
				<div
					style={{
						fontSize: 11,
						marginTop: 4,
						lineHeight: 1.5,
						color: isReadyDbType(conn.db_type) ? "var(--muted-foreground)" : "var(--destructive, #c0392b)",
					}}
				>
					当前选中：<b>{conn.db_type}</b> —— {tierLabel(tierFor(conn.db_type))}：{tierReasonText(conn.db_type)}
					{manifestEntry && (
						<span style={{ color: "var(--muted-foreground)", marginLeft: 6 }}>
							· dialect <code>{manifestEntry.dialect}</code> · 默认端口 {manifestEntry.defaultPort}
						</span>
					)}
				</div>
			</div>

			{conn.db_type === "mongodb" && (
				<div className="dbx-form-row">
					<label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
						<input
							type="checkbox"
							checked={Boolean((conn as unknown as { useLegacyShell?: boolean }).useLegacyShell)}
							onChange={(e) => onChange({ ...conn, useLegacyShell: e.target.checked } as DbConnection)}
						/>
						使用 legacy mongo shell（旧版 API 兼容模式）
					</label>
				</div>
			)}

			{/* 网络端点：文件型只显示文件路径 */}
			{isFileBased ? (
				<div className="dbx-form-row">
					<label className="dbx-form-label">文件路径 *</label>
					<input
						className="dbx-form-input"
						value={conn.host}
						onChange={(e) => onChange({ ...conn, host: e.target.value })}
						placeholder={defaultHostPlaceholder(conn.db_type)}
					/>
				</div>
			) : (
				<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
					<div className="dbx-form-row">
						<label className="dbx-form-label">Host *</label>
						<input
							className="dbx-form-input"
							value={conn.host}
							onChange={(e) => onChange({ ...conn, host: e.target.value })}
							placeholder={defaultHostPlaceholder(conn.db_type)}
						/>
					</div>
					<div className="dbx-form-row">
						<label className="dbx-form-label">Port</label>
						<input
							className="dbx-form-input"
							type="number"
							value={conn.port}
							onChange={(e) => onChange({ ...conn, port: Number(e.target.value) || 0 })}
						/>
					</div>
				</div>
			)}

			{/* 凭据：文件型不显示 */}
			{!isFileBased && (
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
					<div className="dbx-form-row">
						<label className="dbx-form-label">用户名</label>
						<input
							className="dbx-form-input"
							value={conn.username}
							onChange={(e) => onChange({ ...conn, username: e.target.value })}
							placeholder={defaultUsernameFor(conn.db_type) || "留空"}
						/>
					</div>
					<div className="dbx-form-row">
						<label className="dbx-form-label">密码</label>
						<div style={{ position: "relative" }}>
							<input
								className="dbx-form-input"
								type={showPassword ? "text" : "password"}
								value={conn.password}
								onChange={(e) => onChange({ ...conn, password: e.target.value })}
								placeholder="••••••"
								style={{ paddingRight: 32 }}
							/>
							<button
								type="button"
								onClick={() => setShowPassword((v) => !v)}
								title={showPassword ? "隐藏密码" : "显示密码"}
								aria-label={showPassword ? "隐藏密码" : "显示密码"}
								style={{
									position: "absolute",
									right: 4,
									top: "50%",
									transform: "translateY(-50%)",
									background: "transparent",
									border: "none",
									cursor: "pointer",
									fontSize: 14,
									padding: "2px 6px",
									color: "var(--muted-foreground)",
									lineHeight: 1,
								}}
							>
								{showPassword ? "🙈" : "👁"}
							</button>
						</div>
					</div>
				</div>
			)}

			<div className="dbx-form-row">
				<label className="dbx-form-label">默认 Database（可选）</label>
				<input
					className="dbx-form-input"
					value={conn.database ?? ""}
					onChange={(e) => onChange({ ...conn, database: e.target.value })}
					placeholder="留空用服务器默认"
				/>
			</div>

			<div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input type="checkbox" checked={!!conn.ssl} onChange={(e) => onChange({ ...conn, ssl: e.target.checked })} />
					SSL/TLS
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input type="checkbox" checked={!!conn.is_production} onChange={(e) => onChange({ ...conn, is_production: e.target.checked })} />
					⚠️ 生产环境（默认阻断写入）
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
					<input type="checkbox" checked={!!conn.read_only} onChange={(e) => onChange({ ...conn, read_only: e.target.checked })} />
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
					placeholder="此连接用途..."
				/>
			</div>

			{!isFileBased && (
				<div style={{
					marginTop: 12, padding: 12, borderRadius: 6,
					background: "rgba(0,0,0,0.02)", fontSize: 12,
				}}>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>高级</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
						<div>
							<label className="dbx-form-label">连接超时 (秒)</label>
							<input
								className="dbx-form-input" type="number"
								value={conn.connect_timeout_secs ?? 10}
								onChange={(e) => onChange({ ...conn, connect_timeout_secs: Number(e.target.value) })}
							/>
						</div>
						<div>
							<label className="dbx-form-label">查询超时 (秒)</label>
							<input
								className="dbx-form-input" type="number"
								value={conn.query_timeout_secs ?? 60}
								onChange={(e) => onChange({ ...conn, query_timeout_secs: Number(e.target.value) })}
							/>
						</div>
					</div>
					<div style={{ marginTop: 8 }}>
						<label className="dbx-form-label">URL 参数（?key=value&...）</label>
						<input
							className="dbx-form-input"
							value={(conn.url_params as string | undefined) ?? ""}
							onChange={(e) => onChange({ ...conn, url_params: e.target.value })}
							placeholder="sslmode=require"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
