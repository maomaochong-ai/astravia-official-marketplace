/**
 * bigscreen.mjs — JimuBI 同构大屏 API（返回组件 JSON，不是 HTML）。
 *   POST /api/bigscreen/compile
 *   POST /api/bigscreen/render
 *   GET  /api/bigscreen/templates   — 动态扫描 engine/templates/*.json
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { engineError } from "../engine/protocol.mjs";
import { compileBigscreen, generateBigscreenHtml } from "../engine/bigscreen-compiler.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _templateCache = null;
async function loadBigscreenTemplates() {
	if (_templateCache) return _templateCache;
	const templatesDir = join(__dirname, "..", "engine", "templates");
	try {
		const files = await readdir(templatesDir);
		const templates = [];
		for (const file of files.filter((f) => f.endsWith(".json"))) {
			const raw = await readFile(join(templatesDir, file), "utf-8");
			const t = JSON.parse(raw);
			templates.push({
				id: t.id ?? file.replace(/\.json$/, ""),
				name: t.name ?? t.id ?? file.replace(/\.json$/, ""),
				industry: t.industry ?? "通用",
				layout: t.layout ?? "grid",
				palette: t.palette,
				hasSpec: !!t.spec,
			});
		}
		_templateCache = templates.sort((a, b) => a.id.localeCompare(b.id));
		return _templateCache;
	} catch {
		return [];
	}
}

export function bigscreenRoutes() {
	return [
		["/api/bigscreen/compile", "POST", false, async ({ body }) => {
			const spec = body?.spec;
			if (!spec) throw engineError("BAD_REQUEST", "spec is required");
			return compileBigscreen(spec);
		}],

		["/api/bigscreen/render", "POST", false, async ({ body }) => {
			const spec = body?.spec;
			if (!spec) throw engineError("BAD_REQUEST", "spec is required");
			return { html: generateBigscreenHtml(spec) };
		}],

		["/api/bigscreen/templates", "GET", false, async () => {
			const templates = await loadBigscreenTemplates();
			return { templates };
		}],
	];
}
