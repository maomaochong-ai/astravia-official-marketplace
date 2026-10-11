/**
 * request-router.mjs — HTTP 路由聚合 + 统一分发。
 *
 * 架构：各功能域一个文件，放在 server/src/api/<domain>.mjs，
 * 每个导出 `<domain>Routes(ctx)` 返回 [[pathname, method, auth, handler], ...]。
 * 本文件负责：
 *   1. 创建共享 Context（createRouterContext）
 *   2. 聚合所有 domain routes
 *   3. 构建两级 Map（pathname → method → { auth, handler }）
 *   4. 统一请求处理（鉴权 / handler 调用 / 响应格式化）
 *
 * 为什么这么拆：20 个 route 原来全在 createRouter() 里（闭包 + 内联 helper 900+ 行），
 * 新增功能域需要改 request-router.mjs 本体。拆成独立文件后，
 * 新增 domain = 新增一个 server/src/api/<name>.mjs + import + 一行 aggregate。
 */

import {
	engineError,
	fail,
	httpStatusForCode,
	normalizeThrown,
	ok,
} from "./protocol.mjs";
import { createRouterContext } from "../api/router-context.mjs";

// === 各功能域路由（import 顺序 = 注册顺序，对行为无影响）===
import { healthRoutes } from "../api/health.mjs";
import { connectionsRoutes } from "../api/connections.mjs";
import { apiSourcesRoutes } from "../api/api-sources.mjs";
import { queryRoutes } from "../api/query.mjs";
import { schemaRoutes } from "../api/schema.mjs";
import { revealRoutes } from "../api/reveal.mjs";
import { bigscreenRoutes } from "../api/bigscreen.mjs";
import { reportRoutes } from "../api/report.mjs";
import { chartRoutes } from "../api/chart.mjs";

export function createRouter({ auth, dataDir = null, now = () => Date.now() } = {}) {
	if (!auth) throw new Error("createRouter 需要 auth");

	// 共享 Context —— 各 domain handler 用它访问 mcpClient / ensureApiEngineConnection 等
	const ctx = createRouterContext({ auth, dataDir, now });

	// === 聚合所有 domain routes ===
	const allRoutes = [
		...healthRoutes(ctx),
		...connectionsRoutes(ctx),
		...apiSourcesRoutes(ctx),
		...queryRoutes(ctx),
		...schemaRoutes(ctx),
		...revealRoutes(ctx),
		...bigscreenRoutes(),
		...reportRoutes(ctx),
		...chartRoutes(),
	];

	// 构建两级 Map：pathname → method → { auth, handler }
	const routes = new Map();
	for (const [pathname, method, authRequired, handler] of allRoutes) {
		if (!routes.has(pathname)) routes.set(pathname, new Map());
		routes.get(pathname).set(method, { auth: authRequired, handler });
	}

	// === 统一请求处理 ===
	async function handle(request) {
		const { method = "GET", pathname, headers = {}, body = null } = request ?? {};
		const methodMap = routes.get(pathname);
		if (!methodMap) {
			const error = engineError("NOT_FOUND", `未知路径：${pathname}`);
			return { status: httpStatusForCode(error.code), body: fail(error) };
		}
		const route = methodMap.get(method);
		if (!route) {
			const allowed = [...methodMap.keys()].join(", ");
			const error = engineError("METHOD_NOT_ALLOWED", `${pathname} 只接受 ${allowed}`);
			return { status: httpStatusForCode(error.code), body: fail(error) };
		}
		try {
			if (route.auth) auth.verify(headers);
			const data = await route.handler({ body, headers });
			return { status: 200, body: ok(data) };
		} catch (error) {
			const normalized = normalizeThrown(error);
			return { status: httpStatusForCode(normalized.code), body: fail(normalized) };
		}
	}

	return { handle, routes };
}
