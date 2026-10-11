/**
 * bigscreen.mjs — 大屏编译/渲染 API。
 *
 * 三条路由：
 *   POST /api/bigscreen/compile  → 紧凑 spec → 大屏组件 JSON
 *   POST /api/bigscreen/render   → 紧凑 spec → 完整 HTML 字符串
 *   GET  /api/bigscreen/templates → 内置模板清单（id/name/industry/palette/spec）
 *
 * 模板位置：agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/*.json
 * （skill 目录统一管理所有大屏资源）。esbuild JSON loader 默认内联进 bundle，
 * 零运行时文件 I/O。
 */
import { engineError } from "../engine/protocol.mjs";
import { compileBigscreen, generateBigscreenHtml } from "../engine/bigscreen-compiler.mjs";

// esbuild 默认 JSON loader → 内联为 default export
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — ESM JSON import
import _xiangshan from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-xiangshan-park.json";
// @ts-ignore
import _finance from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-finance-service.json";
// @ts-ignore
import _medical from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-medical-monitor.json";
// @ts-ignore
import _police from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-police-monitor.json";
// @ts-ignore
import _environment from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-environment-emit.json";
// @ts-ignore
import _group from "../../../agent/skills/dbx-pro-bigscreen/references/templates/spec-templates/bigscreen-group-data.json";

const TEMPLATES = [_xiangshan, _finance, _medical, _police, _environment, _group]
	.filter(Boolean)
	.map((t) => ({
		id: t.id,
		name: t.name,
		industry: t.industry ?? "通用",
		layout: t.layout ?? "grid",
		palette: t.palette,
		spec: t.spec,
	}))
	.sort((a, b) => a.id.localeCompare(b.id));

/**
 * spec 解析兼容两种调用方式：
 *  - body.spec === 完整 spec 对象（显式字段）
 *  - body 本身就是 spec 对象（page/palette/components 顶层）
 */
function resolveSpec(body) {
	if (!body) return null;
	if (body.spec && typeof body.spec === "object") return body.spec;
	if (body.components || body.page) return body;
	return null;
}

function findTemplate(templateId) {
	if (!templateId) return null;
	return TEMPLATES.find((t) => t.id === templateId) ?? null;
}

export function bigscreenRoutes() {
	return [
		["/api/bigscreen/compile", "POST", false, async ({ body }) => {
			const spec = resolveSpec(body);
			if (!spec) throw engineError("BAD_REQUEST", "spec is required — 传 body.spec 或 body 本身就是 {page, components}");
			return compileBigscreen(spec);
		}],

		["/api/bigscreen/render", "POST", false, async ({ body }) => {
			const spec = resolveSpec(body);
			if (!spec) throw engineError("BAD_REQUEST", "spec is required — 传 body.spec 或 body 本身就是 {page, components}");
			return { html: generateBigscreenHtml(spec) };
		}],

		["/api/bigscreen/templates", "GET", false, async () => {
			return { templates: TEMPLATES };
		}],

		["/api/bigscreen/templates/:id", "GET", false, async ({ params }) => {
			const t = findTemplate(params.id);
			if (!t) throw engineError("NOT_FOUND", `template ${params.id} not found`);
			return t;
		}],
	];
}
