/**
 * bigscreen-api —— dbx-pro bigscreen HTTP API 路由
 *
 * 所有 dbx-pro server API 路由都是纯 HTTP 函数，接收 req/res 调用。
 * 不依赖 Express，兼容任何 HTTP server（当前是 Node.js 内置 http.createServer）。
 */
import { compileBigscreen, generateBigscreenHtml } from "../engine/bigscreen-compiler.mjs";

const TEMPLATE_DIR = new URL("../engine/templates/", import.meta.url);
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

export async function handleBigscreenAPI(req, res, url) {
	const pathname = url.pathname.replace(/^\/api\/bigscreen/, ""); // e.g. /generate, /templates, /templates/:id
	const method = req.method;

	// POST /api/bigscreen/generate
	if (pathname === "/generate" && method === "POST") {
		const body = await readJson(req);
		const { spec, engine = "echarts" } = body;
		if (!spec) { return jsonError(res, 400, "spec is required"); }
		const { components, palette } = compileBigscreen(spec);
		const html = generateBigscreenHtml(spec, { engine });
		const templates = await loadTemplates();
		return jsonRes(res, 200, { html, components, palette, template: body.templateId ?? null });
	}

	// GET /api/bigscreen/compile —— 只编译组件选项，不生成 HTML
	if (pathname === "/compile" && method === "POST") {
		const body = await readJson(req);
		const { spec } = body;
		if (!spec) { return jsonError(res, 400, "spec is required"); }
		const { components, palette } = compileBigscreen(spec);
		return jsonRes(res, 200, { components, palette });
	}

	// GET /api/bigscreen/templates
	if (pathname === "/templates" && method === "GET") {
		const templates = await loadTemplates();
		return jsonRes(res, 200, { templates });
	}

	// GET /api/bigscreen/templates/:id
	const tmplMatch = pathname.match(/^\/templates\/([\w-]+)$/);
	if (tmplMatch && method === "GET") {
		const templates = await loadTemplates();
		const tpl = templates.find(t => t.id === tmplMatch[1]);
		if (!tpl) return jsonError(res, 404, `template ${tmplMatch[1]} not found`);
		return jsonRes(res, 200, tpl);
	}

	return jsonError(res, 404, `unknown bigscreen endpoint: ${method} ${pathname}`);
}

// ============ Helpers ============
async function readJson(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", chunk => { data += chunk; });
		req.on("end", () => {
			try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error(`invalid JSON: ${e.message}`)); }
		});
		req.on("error", reject);
	});
}

function jsonRes(res, status, body) {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify({ ok: true, data: body }));
}
function jsonError(res, status, message) {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify({ ok: false, error: message }));
}

let _templatesCache = null;
async function loadTemplates() {
	if (_templatesCache) return _templatesCache;
	try {
		const files = await glob("bigscreen-*.json", { cwd: TEMPLATE_DIR });
		const templates = [];
		for (const f of files) {
			const raw = await readFile(new URL(f, TEMPLATE_DIR), "utf-8");
			const tpl = JSON.parse(raw);
			templates.push({ id: tpl.id ?? f.replace(/\.json$/, ""), name: tpl.name ?? f, industry: tpl.industry ?? "", description: tpl.description ?? "" });
		}
		_templatesCache = templates;
		return templates;
	} catch (e) {
		console.warn("[bigscreen-api] template load failed:", e.message);
		return [];
	}
}
