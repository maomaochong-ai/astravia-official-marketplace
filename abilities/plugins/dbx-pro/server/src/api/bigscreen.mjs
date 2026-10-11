/**
 * bigscreen.mjs — JimuBI 同构大屏 API。
 *
 * 三条路由：
 *   POST /api/bigscreen/compile  → 紧凑 spec → JimuBI 兼容组件 JSON
 *   POST /api/bigscreen/render   → 紧凑 spec → 完整 HTML 字符串
 *   GET  /api/bigscreen/templates → 内置模板清单（id/name/industry/palette/spec）
 *
 * 模板来源：server/src/engine/templates/*.json 通过 esbuild JSON loader
 * 默认内联进 bundle（零运行时文件 I/O，bundle 体积 +~10KB）。
 * skill references/templates/bigScreen/ 是上游 JimuBI 导出的完整大屏
 * （有 template 字段），仅供 Python 脚本使用，与本引擎无关。
 */
import { engineError } from "../engine/protocol.mjs";
import { compileBigscreen, generateBigscreenHtml } from "../engine/bigscreen-compiler.mjs";

// esbuild 默认 JSON loader → 内联为 default export（无需 --experimental-import-attributes）
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — ESM JSON import
import _xiangshan from "../engine/templates/bigscreen-xiangshan-park.json";
// @ts-ignore
import _finance from "../engine/templates/bigscreen-finance-service.json";
// @ts-ignore
import _medical from "../engine/templates/bigscreen-medical-monitor.json";
// @ts-ignore
import _police from "../engine/templates/bigscreen-police-monitor.json";
// @ts-ignore
import _environment from "../engine/templates/bigscreen-environment-emit.json";
// @ts-ignore
import _group from "../engine/templates/bigscreen-group-data.json";

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
