/**
 * 连接字段表单 — 新建 / 编辑单个连接的输入项集合（受控，无副作用）。
 *
 * 结构对齐设计稿 frames/connection-config.tsx：基础 / 高级两段，
 * 双列 grid、字段控件 32px、只读与生产环境用开关、Schema 用 chip 多选。
 * DB 类型下拉按 category 分组；文件型数据库（SQLite / Turso / Cloudflare D1 /
 * DuckDB）只显示文件路径 + database，不显示端口和凭据。
 */

import { useMemo, useState } from "react";
import { DB_TYPE_MANIFEST, type DbConnection, type DbTypeManifestEntry } from "../../../domain/connection-config";
import { isReadyDbType, tierFor, tierLabel, tierReasonText, tierStats } from "../../../domain/driver-tiers";
import { defaultHostPlaceholder, defaultUsernameFor, isApiConnectionType, isFileBasedDbType } from "../services/connection-type-catalog";
import { ApiConnectionFields } from "./api-connection-fields";

export interface ConnectionFieldsProps {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
	/** 换类型要连带修正端口 / host / 用户名，所以单独一个入口。 */
	onTypeChange: (dbType: string) => void;
	groupedManifest: Array<{ label: string; entries: DbTypeManifestEntry[] }>;
	/** 该库可勾选的全部 schema（拉取后填充）。 */
	availableSchemas?: string[];
	loadingSchemas?: boolean;
	/** 落盘草稿并拉取全部 schema。 */
	onLoadSchemas?: () => Promise<void>;
}

export function ConnectionFields({
	conn,
	onChange,
	onTypeChange,
	groupedManifest,
	availableSchemas,
	loadingSchemas,
	onLoadSchemas,
}: ConnectionFieldsProps) {
	const isFileBased = isFileBasedDbType(conn.db_type);
	const isApi = isApiConnectionType(conn.db_type);
	const [showPassword, setShowPassword] = useState(false);
	const [showSchemas, setShowSchemas] = useState(true);
	const selectedSchemas = conn.schemas ?? [];
	const useLegacyShell = Boolean((conn as unknown as { useLegacyShell?: boolean }).useLegacyShell);

	/** 勾选/取消某个 schema；空选择 = 展示全部。 */
	function toggleSchema(schema: string): void {
		const next = selectedSchemas.includes(schema)
			? selectedSchemas.filter((s) => s !== schema)
			: [...selectedSchemas, schema];
		onChange({ ...conn, schemas: next });
	}
	const manifestEntry = useMemo(
		() => DB_TYPE_MANIFEST.find((e) => e.dbType === conn.db_type),
		[conn.db_type],
	);
	const ready = isReadyDbType(conn.db_type);

	return (
		<div className="dbx-field-stack">
			<section className="dbx-field-section">
				<div className="dbx-field-section__head">基础</div>
				<div className="dbx-field-grid">
					<div className="dbx-field">
						<label className="dbx-field__label" htmlFor="dbx-conn-name">
							连接名称 <span className="dbx-field__req">*</span>
						</label>
						<input
							id="dbx-conn-name"
							className="dbx-form-input"
							value={conn.name}
							onChange={(e) => onChange({ ...conn, name: e.target.value })}
							placeholder="生产 PostgreSQL"
						/>
					</div>

					<div className="dbx-field">
						<label className="dbx-field__label" htmlFor="dbx-conn-type">
							数据库类型 <span className="dbx-field__req">*</span>
						</label>
						<select
							id="dbx-conn-type"
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
						{isApi ? (
							<p className="dbx-field__hint">
								接口直连取数：插件直接请求该 HTTP 接口，把返回结果落成本地临时表，再用 SQL 查询；不走数据库驱动。
							</p>
						) : (
							<>
								<p className="dbx-field__hint">
									共 {DB_TYPE_MANIFEST.length} 种，{tierStats().ready} 种可直接查询。档位只表示当前实现状态：
									<b>可直接查询</b>（引擎已实现）/ <b>试验性</b>（引擎已登记未实现，连接会如实返回
									DRIVER_UNSUPPORTED）/ <b>范围外</b>（仅保留配置形态）。
								</p>
								<p className={`dbx-field__hint${ready ? "" : " is-warning"}`}>
									当前选中：<b>{conn.db_type}</b> —— {tierLabel(tierFor(conn.db_type))}：
									{tierReasonText(conn.db_type)}
									{manifestEntry && (
										<span>
											{" "}· dialect <code>{manifestEntry.dialect}</code> · 默认端口{" "}
											{manifestEntry.defaultPort}
										</span>
									)}
								</p>
							</>
						)}
					</div>

					{isApi ? (
						<div className="dbx-field dbx-field--full">
							<ApiConnectionFields key={conn.id} conn={conn} onChange={onChange} />
						</div>
					) : (
						<>
							{/* 网络端点：文件型只显示文件路径 */}
							{isFileBased ? (
								<div className="dbx-field dbx-field--full">
									<label className="dbx-field__label" htmlFor="dbx-conn-file">
										文件路径 <span className="dbx-field__req">*</span>
									</label>
									<input
										id="dbx-conn-file"
										className="dbx-form-input"
										value={conn.host}
										onChange={(e) => onChange({ ...conn, host: e.target.value })}
										placeholder={defaultHostPlaceholder(conn.db_type)}
									/>
								</div>
							) : (
								<div className="dbx-field-row">
									<div className="dbx-field">
										<label className="dbx-field__label" htmlFor="dbx-conn-host">
											主机 <span className="dbx-field__req">*</span>
										</label>
										<input
											id="dbx-conn-host"
											className="dbx-form-input"
											value={conn.host}
											onChange={(e) => onChange({ ...conn, host: e.target.value })}
											placeholder={defaultHostPlaceholder(conn.db_type)}
										/>
									</div>
									<div className="dbx-field">
										<label className="dbx-field__label" htmlFor="dbx-conn-port">
											端口
										</label>
										<input
											id="dbx-conn-port"
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
								<>
									<div className="dbx-field">
										<label className="dbx-field__label" htmlFor="dbx-conn-database">
											默认 Database
										</label>
										<input
											id="dbx-conn-database"
											className="dbx-form-input"
											value={conn.database ?? ""}
											onChange={(e) => onChange({ ...conn, database: e.target.value })}
											placeholder="留空用服务器默认"
										/>
									</div>
									<div className="dbx-field">
										<label className="dbx-field__label" htmlFor="dbx-conn-username">
											用户名
										</label>
										<input
											id="dbx-conn-username"
											className="dbx-form-input"
											value={conn.username}
											onChange={(e) => onChange({ ...conn, username: e.target.value })}
											placeholder={defaultUsernameFor(conn.db_type) || "留空"}
										/>
									</div>
									<div className="dbx-field">
										<label className="dbx-field__label" htmlFor="dbx-conn-password">
											密码
										</label>
										<div className="dbx-field-control">
											<input
												id="dbx-conn-password"
												className="dbx-form-input"
												type={showPassword ? "text" : "password"}
												value={conn.password}
												onChange={(e) => onChange({ ...conn, password: e.target.value })}
												placeholder="••••••"
												style={{ paddingRight: 36 }}
											/>
											<button
												type="button"
												className="dbx-iconbtn"
												onClick={() => setShowPassword((v) => !v)}
												title={showPassword ? "隐藏密码" : "显示密码"}
												aria-label={showPassword ? "隐藏密码" : "显示密码"}
												style={{ position: "absolute", right: 4 }}
											>
												<span
													className={`h-3.5 w-3.5 ${showPassword ? "icon-[lucide--eye-off]" : "icon-[lucide--eye]"}`}
												/>
											</button>
										</div>
										<p className="dbx-field__hint">仅保存在本机连接配置中</p>
									</div>
									<div className="dbx-field">
										<div className="dbx-field__label">SSL / TLS</div>
										<label className="dbx-switch-row" style={{ height: 32 }}>
											<input
												type="checkbox"
												className="dbx-switch"
												checked={!!conn.ssl}
												onChange={(e) => onChange({ ...conn, ssl: e.target.checked })}
											/>
											<span className="dbx-field__hint" style={{ lineHeight: "32px" }}>
												{conn.ssl ? "已启用加密连接" : "未启用"}
											</span>
										</label>
									</div>
								</>
							)}
						</>
					)}
				</div>
			</section>

			{!isApi && (
				<section className="dbx-field-section">
					<div className="dbx-field-section__head">高级</div>
					<div className="dbx-field-advanced">
						<label className="dbx-switch-row">
							<input
								type="checkbox"
								className="dbx-switch"
								checked={!!conn.read_only}
								onChange={(e) => onChange({ ...conn, read_only: e.target.checked })}
							/>
							<span className="dbx-switch-row__label">
								只读连接
								<span className="dbx-switch-row__hint">阻止所有写操作，仅允许查询</span>
							</span>
						</label>

						<label className="dbx-switch-row">
							<input
								type="checkbox"
								className="dbx-switch"
								checked={!!conn.is_production}
								onChange={(e) => onChange({ ...conn, is_production: e.target.checked })}
							/>
							<span className="dbx-switch-row__label">
								生产环境
								<span className="dbx-switch-row__hint">默认阻断写入，执行前需二次确认</span>
							</span>
						</label>

						{conn.db_type === "mongodb" && (
							<label className="dbx-switch-row">
								<input
									type="checkbox"
									className="dbx-switch"
									checked={useLegacyShell}
									onChange={(e) =>
										onChange({ ...conn, useLegacyShell: e.target.checked } as DbConnection)
									}
								/>
								<span className="dbx-switch-row__label">
									使用 legacy mongo shell
									<span className="dbx-switch-row__hint">旧版 API 兼容模式</span>
								</span>
							</label>
						)}

						{manifestEntry?.schemaAware && (
							<div className="dbx-field">
								<div className="flex items-center gap-2">
									<span className="dbx-field__label">默认 Schema</span>
									<div className="dbx-field-tools">
										{onLoadSchemas && (
											<button
												type="button"
												className="dbx-iconbtn"
												onClick={() => void onLoadSchemas()}
												disabled={loadingSchemas}
												title="拉取 Schema"
												aria-label="拉取 Schema"
											>
												<span
													className={`h-3.5 w-3.5 ${loadingSchemas ? "icon-[lucide--loader] animate-spin" : "icon-[lucide--refresh-cw]"}`}
												/>
											</button>
										)}
										<button
											type="button"
											className="dbx-iconbtn"
											onClick={() => setShowSchemas((v) => !v)}
											title={showSchemas ? "收起 Schema 列表" : "展开 Schema 列表"}
											aria-label={showSchemas ? "收起 Schema 列表" : "展开 Schema 列表"}
											aria-expanded={showSchemas}
										>
											<span
												className={`h-3.5 w-3.5 ${showSchemas ? "icon-[lucide--chevron-up]" : "icon-[lucide--chevron-down]"}`}
											/>
										</button>
									</div>
								</div>
								<p className="dbx-field__hint">不勾选 = 展示该库全部 schema；勾选 = 仅展示所选</p>
								{showSchemas &&
									(availableSchemas && availableSchemas.length > 0 ? (
										<div className="dbx-schema-chips">
											{availableSchemas.map((s) => (
												<button
													key={s}
													type="button"
													className={`dbx-schema-chip${selectedSchemas.includes(s) ? " active" : ""}`}
													onClick={() => toggleSchema(s)}
													aria-pressed={selectedSchemas.includes(s)}
												>
													{selectedSchemas.includes(s) && (
														<span className="icon-[lucide--check] h-3 w-3" />
													)}
													{s}
												</button>
											))}
										</div>
									) : (
										<p className="dbx-field__hint">尚未拉取 Schema 列表</p>
									))}
							</div>
						)}

						{!isFileBased && (
							<div className="dbx-field-grid">
								<div className="dbx-field">
									<label className="dbx-field__label" htmlFor="dbx-conn-connect-timeout">
										连接超时（秒）
									</label>
									<input
										id="dbx-conn-connect-timeout"
										className="dbx-form-input"
										type="number"
										value={conn.connect_timeout_secs ?? 10}
										onChange={(e) =>
											onChange({ ...conn, connect_timeout_secs: Number(e.target.value) })
										}
									/>
								</div>
								<div className="dbx-field">
									<label className="dbx-field__label" htmlFor="dbx-conn-query-timeout">
										查询超时（秒）
									</label>
									<input
										id="dbx-conn-query-timeout"
										className="dbx-form-input"
										type="number"
										value={conn.query_timeout_secs ?? 60}
										onChange={(e) =>
											onChange({ ...conn, query_timeout_secs: Number(e.target.value) })
										}
									/>
								</div>
								<div className="dbx-field dbx-field--full">
									<label className="dbx-field__label" htmlFor="dbx-conn-url-params">
										URL 参数（?key=value&…）
									</label>
									<input
										id="dbx-conn-url-params"
										className="dbx-form-input"
										value={(conn.url_params as string | undefined) ?? ""}
										onChange={(e) => onChange({ ...conn, url_params: e.target.value })}
										placeholder="sslmode=require"
									/>
								</div>
							</div>
						)}

						<div className="dbx-field dbx-field--full">
							<label className="dbx-field__label" htmlFor="dbx-conn-note">
								备注
							</label>
							<textarea
								id="dbx-conn-note"
								className="dbx-form-input"
								rows={2}
								value={conn.note ?? ""}
								onChange={(e) => onChange({ ...conn, note: e.target.value })}
								placeholder="此连接用途…"
							/>
						</div>
					</div>
				</section>
			)}

			{isFileBased && (
				<section className="dbx-field-section">
					<div className="dbx-field-section__head">其他</div>
					<div className="dbx-field-advanced">
						<label className="dbx-switch-row">
							<input
								type="checkbox"
								className="dbx-switch"
								checked={!!conn.read_only}
								onChange={(e) => onChange({ ...conn, read_only: e.target.checked })}
							/>
							<span className="dbx-switch-row__label">
								只读连接
								<span className="dbx-switch-row__hint">阻止所有写操作，仅允许查询</span>
							</span>
						</label>
						<div className="dbx-field dbx-field--full">
							<label className="dbx-field__label" htmlFor="dbx-conn-note-file">
								备注
							</label>
							<textarea
								id="dbx-conn-note-file"
								className="dbx-form-input"
								rows={2}
								value={conn.note ?? ""}
								onChange={(e) => onChange({ ...conn, note: e.target.value })}
								placeholder="此连接用途…"
							/>
						</div>
					</div>
				</section>
			)}
		</div>
	);
}
