/**
 * codegen.mjs — 模板代码生成（jeecg-codegen 对等）。
 *   POST /api/codegen/generate — 表结构 + 模板 → 生成文件列表
 *   POST /api/codegen/save     — 保存生成配置（可选，复用 json-store）
 *   POST /api/codegen/list
 *
 * 与其他 domain 不同：generate 是**纯函数**（输入表元数据 + 模板配置，输出代码文件内容），
 * 不依赖外部服务。save 是可选的生成配置持久化。
 *
 * 对应 JeecgBoot codegen.py + FtlRunner.java — JeecgBoot 用 FreeMarker 模板引擎，
 * dbx-pro 版本用 EJS 风格简单模板（无外部依赖，Node 内置字符串替换足够）。
 */
import { engineError } from "../engine/protocol.ts";
import * as store from "./json-store.ts";

const TABLE = "dbx_codegen_configs";

/** 内置模板：CRUD controller / entity / 前端列表页（极简骨架）。 */
const BUILTIN_TEMPLATES = {
	controller: (t) => `// ${t.name}Controller.ts — auto-generated
import { Request, Response } from "express";
export async function list${t.name}(req: Request, res: Response) {
  // TODO: query ${t.table} with ${t.columns.length} columns
  res.json({ columns: ${JSON.stringify(t.columns.map(c => c.name))} });
}`,
	entity: (t) => `// ${t.name}.ts — auto-generated
export interface ${t.name} {
${t.columns.map(c => `  ${c.name}: ${mapType(c.type)};`).join("\n")}
}`,
	api: (t) => `// api/${t.name.toLowerCase()}.ts — auto-generated
export const ${t.name.toLowerCase()}Api = {
  list: () => fetch("/api/${t.table.toLowerCase()}"),
  get: (id: string) => fetch(\`/api/${t.table.toLowerCase()}/\${id}\`),
};`,
};

function mapType(dbType) {
	const t = String(dbType ?? "").toLowerCase();
	if (/int|num|float|decimal|real|double/.test(t)) return "number";
	if (/bool/.test(t)) return "boolean";
	if (/date|time/.test(t)) return "string";
	return "string";
}

export function codegenRoutes(ctx?: { dataDir?: string | null }) {
	return [
		["/api/codegen/generate", "POST", true, async ({ body }) => {
			const table = body?.table;
			const columns = body?.columns;
			const name = body?.name ?? body?.table;
			if (!table || !columns || !name) throw engineError("BAD_REQUEST", "table + columns + name 必填");
			if (!Array.isArray(columns)) throw engineError("BAD_REQUEST", "columns 必须是数组");

			const tplCtx = { table, name, columns: columns.map((c: any) => ({ name: c.name, type: c.type ?? "varchar" })) };
			const templates = body?.templates ?? Object.keys(BUILTIN_TEMPLATES);

			const files = templates.map((key) => {
				const fn = BUILTIN_TEMPLATES[key];
				if (!fn) return null;
				return {
					template: key,
					path: `${name.toLowerCase()}/${key === "controller" ? `${name}Controller.ts` : key === "entity" ? `${name}.ts` : `${name.toLowerCase()}.ts`}`,
					content: fn(tplCtx),
				};
			}).filter(Boolean);

			return { table, name, files, templateCount: files.length };
		}],

		["/api/codegen/save", "POST", true, async ({ body }) => {
			if (!body?.name) throw engineError("BAD_REQUEST", "name 必填");
			if (!ctx) throw engineError("BAD_REQUEST", "context 不可用");
			return store.save(ctx, { table: TABLE, id: body.id, name: body.name, data: body.config ?? body, meta: body.meta ?? {} });
		}],

		["/api/codegen/list", "POST", true, async ({ body }) => {
			if (!ctx) throw engineError("BAD_REQUEST", "context 不可用");
			return store.list(ctx, { table: TABLE, keyword: body?.keyword ?? "", limit: body?.limit ?? 100 });
		}],
	];
}
