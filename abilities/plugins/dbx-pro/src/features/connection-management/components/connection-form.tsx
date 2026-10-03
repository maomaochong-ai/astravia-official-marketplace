/**
 * 连接管理侧栏表单 — 新增/编辑/删除/测试连接。
 *
 * 表单字段覆盖 ConnectionConfig 核心属性：基础信息、网络连接、
 * 凭据、安全旗标、连接超时和 URL 参数。DB 类型下拉项从引擎
 * manifest 生成（80+ 种），默认端口根据 manifest 自动填充。
 */

import { useEffect, useState } from "react";
import {
	DB_TYPE_MANIFEST,
	defaultPortFor,
	type DbConnection,
	type DbType,
} from "../../../domain/connection-config";
import { genUuid, readAllConfigs, writeConfig, deleteConfig } from "../../../domain/dbx-storage";
import { tierFor, tierLabel, tierReasonText, isReadyDbType, tierStats } from "../../../domain/driver-tiers";
import { describeFallbackReason, queryRouter } from "../../../shared/services/query-router";

interface Props {
	/** 连接增/删/改后通知外层重载列表。 */
	onChange: () => void;
	onCancel: () => void;
	/** 从连接树右键「编辑连接」进入时，直接打开该连接的表单。 */
	initialEditName?: string;
}

function emptyConnection(): DbConnection {
	const first = DB_TYPE_MANIFEST[0];
	return {
		id: genUuid(),
		name: "",
		db_type: first?.dbType ?? "postgres",
		host: "localhost",
		port: first?.defaultPort ?? 5432,
		username: "",
		password: "",
		ssl: false,
		is_production: false,
		read_only: false,
	};
}

function isSqliteFamily(dbType: DbType): boolean {
	return ["sqlite", "duckdb", "cloudflare-d1"].includes(dbType);
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
		setEditing({
			...editing,
			db_type: val,
			port: entry?.defaultPort ?? editing.port,
			host: isSqliteFamily(val)
				? editing.host || "/path/to/db.sqlite"
				: editing.host || "localhost",
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
			const outcome = await queryRouter.test(c);
			onChange();
			const via = outcome.path === "engine" ? "引擎" : "回退 sqlite3 CLI";
			const why = outcome.fallbackReason ? `（${describeFallbackReason(outcome.fallbackReason)}）` : "";
			setTestResult(`✅ 连接成功 · 取数路径：${via}${why}`);
		} catch (err) {
			const code = (err as { code?: string } | null)?.code;
			setTestResult(`❌ 连接失败${code ? ` [${code}]` : ""}: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setTesting(false);
		}
	}


	return (
		<>
			<div className="dbx-sheet-backdrop" onClick={onCancel} />
			<div className="dbx-sheet" style={{ width: 540 }}>
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
											{c.db_type} · {c.host}:{c.port}
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

					{activeTab === "form" && editing && <FormFields conn={editing} onChange={setEditing} onTypeChange={onTypeChange} />}
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

function FormFields({
	conn, onChange, onTypeChange,
}: {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
	onTypeChange: (t: string) => void;
}) {
	const isFileBased = isSqliteFamily(conn.db_type);

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
				<label className="dbx-form-label">数据库类型 *（{DB_TYPE_MANIFEST.length} 种，{tierStats().ready} 种可直接查询）</label>
				<select className="dbx-form-input" value={conn.db_type} onChange={(e) => onTypeChange(e.target.value)}>
					{DB_TYPE_MANIFEST.map((e) => (
						<option key={e.dbType} value={e.dbType}>
							{e.label} ({e.dbType}) · {tierLabel(tierFor(e.dbType))}
							{e.runtimeMode === "bridge" ? " · bridge" : ""}
						</option>
					))}
				</select>
				<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
					档位只表示当前实现状态：<b>可直接查询</b>（引擎已实现，现仅 SQLite）/ <b>试验性</b>（引擎已登记未实现，连接会如实返回 DRIVER_UNSUPPORTED）/ <b>范围外</b>（仅保留配置形态）。
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
				</div>
			</div>

			{conn.db_type === "mongodb" && (
				<div className="dbx-form-row">
					<label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
						<input
							type="checkbox"
							checked={Boolean((conn as any).useLegacyShell)}
							onChange={(e) => onChange({ ...conn, useLegacyShell: e.target.checked })}
						/>
						使用 legacy mongo shell（旧版 API 兼容模式）
					</label>
				</div>
			)}

			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
				<div className="dbx-form-row">
					<label className="dbx-form-label">{isFileBased ? "文件路径" : "Host"} *</label>
					<input
						className="dbx-form-input"
						value={conn.host}
						onChange={(e) => onChange({ ...conn, host: e.target.value })}
						placeholder={isFileBased ? "/path/to/db.sqlite" : "localhost"}
					/>
				</div>
				{!isFileBased && (
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

			{!isFileBased && (
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
							value={conn.url_params as string ?? ""}
							onChange={(e) => onChange({ ...conn, url_params: e.target.value })}
							placeholder="sslmode=require"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
