/**
 * 连接字段表单 — 新建 / 编辑单个连接的输入项集合（受控，无副作用）。
 *
 * 字段覆盖 ConnectionConfig 核心属性：基础信息、网络连接、凭据、安全旗标。
 * DB 类型下拉按 category 分组；文件型数据库（SQLite / Turso / Cloudflare D1 /
 * DuckDB）只显示文件路径 + database，不显示端口和凭据。
 */

import { useMemo, useState } from "react";
import { DB_TYPE_MANIFEST, type DbConnection, type DbTypeManifestEntry } from "../../../domain/connection-config";
import { isReadyDbType, tierFor, tierLabel, tierReasonText, tierStats } from "../../../domain/driver-tiers";
import { defaultHostPlaceholder, defaultUsernameFor, isFileBasedDbType } from "../services/connection-type-catalog";

export interface ConnectionFieldsProps {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
	/** 换类型要连带修正端口 / host / 用户名，所以单独一个入口。 */
	onTypeChange: (dbType: string) => void;
	groupedManifest: Array<{ label: string; entries: DbTypeManifestEntry[] }>;
}

export function ConnectionFields({ conn, onChange, onTypeChange, groupedManifest }: ConnectionFieldsProps) {
	const isFileBased = isFileBasedDbType(conn.db_type);
	const [showPassword, setShowPassword] = useState(false);
	const manifestEntry = useMemo(
		() => DB_TYPE_MANIFEST.find((e) => e.dbType === conn.db_type),
		[conn.db_type],
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

			<div className="dbx-form-row">
				<label className="dbx-form-label">默认 Schema（可选）</label>
				<input
					className="dbx-form-input"
					value={conn.schema ?? ""}
					onChange={(e) => onChange({ ...conn, schema: e.target.value })}
					placeholder="留空用服务器默认（PG 通常是 public）"
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
