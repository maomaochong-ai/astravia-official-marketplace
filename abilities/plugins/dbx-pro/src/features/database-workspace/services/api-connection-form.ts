/**
 * 「API 接入」表单的纯逻辑 — 不含 React，可直接单测。
 *
 * DbConnection 外壳只承载 id/name/note 等通用字段；接口地址、认证与取数规则全在
 * api 子对象里。这里集中处理它的默认值、请求头文本互转与变更合并，避免这些细节
 * 散落在表单组件里。
 */

import type {
	ApiAuthKind,
	ApiAuthSpec,
	ApiConnectionSpec,
	DbConnection,
} from "../../../domain/connection-config.ts";

export const AUTH_KIND_OPTIONS: Array<{ kind: ApiAuthKind; label: string }> = [
	{ kind: "none", label: "无需认证" },
	{ kind: "bearer", label: "Bearer Token" },
	{ kind: "api-key", label: "API Key（放请求头）" },
	{ kind: "basic", label: "Basic（用户名 + 密码）" },
];

export function defaultApiSpec(): ApiConnectionSpec {
	return { url: "", method: "GET", auth: { kind: "none" }, dataPath: "", rowLimit: 1000 };
}

/**
 * 取连接的 api 配置并补齐缺省值。
 *
 * 两处来源都可能缺字段：本地镜像里的老连接，以及引擎返回的连接摘要。
 */
export function apiSpecOf(conn: DbConnection): ApiConnectionSpec {
	const spec = conn.api;
	if (!spec) return defaultApiSpec();
	return {
		...defaultApiSpec(),
		...spec,
		auth: { ...(spec.auth ?? {}), kind: spec.auth?.kind ?? "none" },
	};
}

/** 合并 api 配置改动，返回新的连接对象（不改写入参）。 */
export function withApiPatch(conn: DbConnection, patch: Partial<ApiConnectionSpec>): DbConnection {
	return { ...conn, api: { ...apiSpecOf(conn), ...patch } };
}

/** 合并认证方式里的字段改动。 */
export function withAuthPatch(conn: DbConnection, patch: Partial<ApiAuthSpec>): DbConnection {
	const spec = apiSpecOf(conn);
	const auth: ApiAuthSpec = { ...spec.auth, ...patch, kind: patch.kind ?? spec.auth?.kind ?? "none" };
	return { ...conn, api: { ...spec, auth } };
}

/** 请求头对象 → `key: value` 多行文本（表单展示用）。 */
export function headersToText(headers?: Record<string, string>): string {
	if (!headers) return "";
	return Object.entries(headers)
		.map(([key, value]) => `${key}: ${value}`)
		.join("\n");
}

/** `key: value` 多行文本 → 请求头对象；忽略空行、注释与缺冒号的行。 */
export function textToHeaders(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const at = trimmed.indexOf(":");
		if (at <= 0) continue;
		const key = trimmed.slice(0, at).trim();
		const value = trimmed.slice(at + 1).trim();
		if (key) out[key] = value;
	}
	return out;
}
