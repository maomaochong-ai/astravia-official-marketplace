/**
 * 「API 接入」的表单字段 — 接口地址、认证方式与取数规则。
 *
 * 独立成一个组件：它与 host/port/用户名/SSL 那一套没有任何同义字段，
 * 由 ConnectionFields 在 db_type === "api" 时整体替换掉网络与凭据区块。
 */

import { useState } from "react";
import type { ApiConnectionSpec, DbConnection } from "../../../domain/connection-config";
import {
	AUTH_KIND_OPTIONS,
	apiSpecOf,
	headersToText,
	textToHeaders,
	withApiPatch,
	withAuthPatch,
} from "../services/api-connection-form";

export interface ApiConnectionFieldsProps {
	conn: DbConnection;
	onChange: (c: DbConnection) => void;
}

function tokenPlaceholder(spec: ApiConnectionSpec, fallback: string): string {
	return spec.hasSecret ? "已保存，留空表示不修改" : fallback;
}

/** 请求头框的占位：值从不回传，只能告诉用户「服务端已经存了」。 */
function headersPlaceholder(spec: ApiConnectionSpec): string {
	return spec.hasHeaders ? "已保存，留空表示不修改" : "X-Env: prod\nAccept-Language: zh-CN";
}

export function ApiConnectionFields({ conn, onChange }: ApiConnectionFieldsProps) {
	const spec = apiSpecOf(conn);
	const auth = spec.auth ?? { kind: "none" };
	const [showToken, setShowToken] = useState(false);
	const [headersText, setHeadersText] = useState(() => headersToText(spec.headers));

	return (
		<div>
			<div className="dbx-form-row">
				<label className="dbx-form-label">接口地址 *</label>
				<input
					className="dbx-form-input"
					value={spec.url}
					onChange={(e) => onChange(withApiPatch(conn, { url: e.target.value }))}
					placeholder="https://api.example.com/v1/orders"
				/>
				<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
					只支持 GET。返回的每一行会物化成本地快照，再用 SQL 查询。
				</div>
			</div>

			<div className="dbx-form-row">
				<label className="dbx-form-label">认证方式</label>
				<select
					className="dbx-form-input"
					value={auth.kind}
					onChange={(e) => onChange(withAuthPatch(conn, { kind: e.target.value as typeof auth.kind }))}
				>
					{AUTH_KIND_OPTIONS.map((o) => (
						<option key={o.kind} value={o.kind}>
							{o.label}
						</option>
					))}
				</select>
			</div>

			{(auth.kind === "api-key" || auth.kind === "basic") && (
				<div className="dbx-form-row">
					<label className="dbx-form-label">{auth.kind === "basic" ? "用户名" : "请求头名"}</label>
					{auth.kind === "basic" ? (
						<input
							className="dbx-form-input"
							value={auth.username ?? ""}
							onChange={(e) => onChange(withAuthPatch(conn, { username: e.target.value }))}
							placeholder="用户名"
						/>
					) : (
						<input
							className="dbx-form-input"
							value={auth.headerName ?? ""}
							onChange={(e) => onChange(withAuthPatch(conn, { headerName: e.target.value }))}
							placeholder="X-API-Key"
						/>
					)}
				</div>
			)}

			{auth.kind === "api-key" && (
				<div className="dbx-form-row">
					<label className="dbx-form-label">值前缀（可选）</label>
					<input
						className="dbx-form-input"
						value={auth.prefix ?? ""}
						onChange={(e) => onChange(withAuthPatch(conn, { prefix: e.target.value }))}
						placeholder="留空即原样发送"
					/>
					<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
						会拼在凭据前面，中间隔一个空格；填 <code>Token</code> 即发出 <code>X-API-Key: Token &lt;凭据&gt;</code>。
					</div>
				</div>
			)}

			{auth.kind !== "none" && (
				<div className="dbx-form-row">
					<label className="dbx-form-label">{auth.kind === "basic" ? "密码" : "凭据"}</label>
					<div style={{ position: "relative" }}>
						<input
							className="dbx-form-input"
							type={showToken ? "text" : "password"}
							value={spec.token ?? ""}
							onChange={(e) => onChange(withApiPatch(conn, { token: e.target.value }))}
							placeholder={tokenPlaceholder(spec, auth.kind === "basic" ? "密码" : "粘贴令牌")}
							style={{ paddingRight: 32 }}
						/>
						<button
							type="button"
							onClick={() => setShowToken((v) => !v)}
							title={showToken ? "隐藏凭据" : "显示凭据"}
							aria-label={showToken ? "隐藏凭据" : "显示凭据"}
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
							<span className={`h-3.5 w-3.5 ${showToken ? "icon-[lucide--eye-off]" : "icon-[lucide--eye]"}`} />
						</button>
					</div>
					<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
						凭据只保存在本机（仅本机账号可读），不会随连接信息回传。
					</div>
				</div>
			)}

			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
				<div className="dbx-form-row">
					<label className="dbx-form-label">数据路径</label>
					<input
						className="dbx-form-input"
						value={spec.dataPath ?? ""}
						onChange={(e) => onChange(withApiPatch(conn, { dataPath: e.target.value }))}
						placeholder="data.items"
					/>
				</div>
				<div className="dbx-form-row">
					<label className="dbx-form-label">行数上限</label>
					<input
						className="dbx-form-input"
						type="number"
						value={spec.rowLimit ?? 1000}
						onChange={(e) => onChange(withApiPatch(conn, { rowLimit: Number(e.target.value) || 0 }))}
					/>
				</div>
			</div>
			<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: -4, marginBottom: 8, lineHeight: 1.5 }}>
				数据路径指向响应里装数据的字段（如 <code>data.items</code>）；留空表示响应本身就是数组。
			</div>

			<div className="dbx-form-row">
				<label className="dbx-form-label">自定义请求头（可选）</label>
				<textarea
					className="dbx-form-input"
					rows={3}
					value={headersText}
					onChange={(e) => {
						setHeadersText(e.target.value);
						onChange(withApiPatch(conn, { headers: textToHeaders(e.target.value) }));
					}}
					placeholder={headersPlaceholder(spec)}
				/>
				<div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
					每行一条 <code>名称: 值</code>；认证头由上面的认证方式自动生成。
					{spec.hasHeaders && "留空表示不修改已保存的请求头；重新填入则整体替换。"}
				</div>
			</div>
		</div>
	);
}
