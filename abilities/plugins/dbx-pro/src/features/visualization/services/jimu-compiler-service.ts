/**
 * jimu-compiler-service — 前端调 server 端 /api/bigscreen/compile。
 *
 * AI 生成 spec → compile → 返回 JimuBI 组件 JSON → 存入 visualization store。
 * spec 是紧凑格式（同 server bigscreen-compiler.mjs 定义）：
 *   { page:{name,theme,bg}, palette, components:[{ type, title, data, pos, w, h, ... }] }
 *
 * compile 返回：
 *   { page: {...}, components: [{ type, title, cfg: { w, h, option, chartData, chart } }], palette, warnings }
 *
 * 不硬编码 fetch URL，走宿主插件 runtime 的 fetchCapability（dbx-pro 有 http-server.mjs）。
 */

export interface JimuSpec {
	page?: { name?: string; theme?: string; width?: number; height?: number };
	palette?: string;
	components: Array<Record<string, unknown>>;
}

export interface JimuCompiledComponent {
	type: string;
	title: string;
	cfg: Record<string, unknown>;
	error?: string;
}

export interface JimuCompiledResult {
	page: Record<string, unknown>;
	components: JimuCompiledComponent[];
	palette: Record<string, unknown> & { name: string };
	warnings: string[];
}

export interface JimuCompileError {
	code: string;
	message: string;
	detail?: string;
}

/** 连接名 → endpoint URL 映射（server 启动时传入 --port，前端可从 runtime 读）。 */
function getCompileEndpoint(): string {
	// 优先从宿主 runtime 的 dbx-pro 服务 URL 读；fallback 到默认 localhost:38123
	try {
		const g = globalThis as { __dbxProApiUrl?: string };
		if (g.__dbxProApiUrl) return `${g.__dbxProApiUrl}/api/bigscreen/compile`;
	} catch { /* ignore */ }
	return "http://127.0.0.1:38123/api/bigscreen/compile";
}

/**
 * 调用 server 端 /api/bigscreen/compile。
 * 失败时返回可恢复的错误结构（不是 throw），方便 UI 层显示。
 */
export async function compileJimuBigscreen(spec: JimuSpec): Promise<{ ok: true; data: JimuCompiledResult } | { ok: false; error: JimuCompileError }> {
	try {
		const resp = await fetch(getCompileEndpoint(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ spec }),
		});
		const body = await resp.json().catch(() => ({ error: { code: "BAD_RESPONSE", message: "Server 返回非 JSON" } }));
		if (!resp.ok || body.ok === false) {
			const err = body.error ?? { code: "HTTP_" + resp.status, message: `请求失败 (${resp.status})` };
			return { ok: false, error: { code: err.code ?? "INTERNAL", message: err.message ?? "未知错误", detail: err.detail } };
		}
		return { ok: true, data: body.data as JimuCompiledResult };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: { code: "FETCH_FAILED", message: msg } };
	}
}
