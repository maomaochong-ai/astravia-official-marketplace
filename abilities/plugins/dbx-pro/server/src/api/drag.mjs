/**
 * drag.mjs — 自研大屏页面 API（JimuBI 兼容层）。
 *
 * 本 domain 实现 AI skill（bi_utils.py / spec_builder.py / template_ops.py 等）
 * 所需的 JimuBI 后端接口，完全用本地 JSON 文件存储（不依赖外部服务）。
 *
 * 存储位置：`${ctx.dataDir}/pages/{pageId}.json`
 *   （dataDir 由宿主通过 --data 注入，dbx DATA_DIR 下的 pages/ 子目录）
 *
 * 支持端点（全部带 /drag/page 前缀，与 bi_utils.py 完全对齐）：
 *   POST   /drag/page/add                创建空白大屏/仪表盘
 *   POST   /drag/page/edit                保存页面（含 template 组件数组）
 *   GET    /drag/page/queryById?id=...   查询页面详情
 *   GET    /drag/page/list?pageNo&pageSize&style=...  分页列表
 *   GET    /drag/page/copyPage?id=...    复制页面
 *   DELETE /drag/page/physicalDelete?id=...  物理删除
 *   DELETE /drag/page/delete?id=...      软删除（本地实现 = 物理删除）
 *   POST   /drag/page/recoveryDelete?id=...  恢复（本地实现 = no-op）
 *   POST   /drag/page/addVisitsNumber    访问计数（no-op）
 *
 * 数据集端点 stub（Phase A2 补）：
 *   GET    /drag/onlDragDatasetHead/list               → 返回空
 *   POST   /drag/onlDragDatasetHead/add/edit/delete   → 返回 ok
 *   GET    /drag/onlDragDatasetHead/queryFieldBySql    → 用 dbx-mcp 执行 SQL 返回列名（Phase A2）
 *   GET    /drag/onlDragDataSource/getOptions          → 用 dbx-mcp list_connections 返回（Phase A2）
 *   GET    /drag/jimuDragMap/list                       → 返回空
 *
 * 响应格式：统一 `{ success: true, result: ... }`（与 JeecgBoot JimuBI 后端一致）
 *   错误：`{ success: false, message: "..." }`
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { engineError } from "../engine/protocol.mjs";

// ─── 存储辅助 ───

function pagesDir(ctx) {
	const base = ctx.dataDir || process.env.DBX_DATA_DIR || join(process.cwd(), ".dbx-data");
	const dir = join(base, "pages");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}

function pageFile(ctx, id) {
	return join(pagesDir(ctx), `${id}.json`);
}

function genId() {
	// JimuBI 用雪花 ID（19-20 位纯数字），本地用 UUID v4 + 前缀
	const uuid = createHash("md5").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16);
	return uuid;
}

function readPage(ctx, id) {
	const file = pageFile(ctx, id);
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, "utf-8"));
	} catch {
		return null;
	}
}

function writePage(ctx, page) {
	const file = pageFile(ctx, page.id);
	writeFileSync(file, JSON.stringify(page, null, 2), "utf-8");
}

function emptyPage(id, fields) {
	return {
		id,
		name: fields.name ?? "untitled",
		type: fields.type ?? "0",
		theme: fields.theme ?? "dark",
		style: fields.style ?? "bigScreen",
		backgroundImage: fields.backgroundImage ?? "",
		designType: fields.designType ?? 100,
		protectionCode: fields.protectionCode ?? "",
		template: "[]",
		updateCount: 1,
		createTime: new Date().toISOString(),
		updateTime: new Date().toISOString(),
		path: `/drag/page/edit?id=${id}`,
		visits: 0,
		izTemplate: false,
		izPrivate: false,
	};
}

function jimuResp(result) {
	return { success: true, result };
}

function jimuErr(message, code = "BAD_REQUEST") {
	return { success: false, message, code };
}

// ─── request-router 元组风格 + 原生 JimuBI handler ───

// 注意：本 domain 有两种调用方式
//   1. request-router 走 dragRoutes(ctx) → 外层会套 ok(data)，handler 必须返回 JimuBI 格式
//   2. http-server 直接调 handleJimuRequest() → 直接返回，不套 ok(data)
// 无论哪种，handler 内部必须返回 JimuBI 原生格式 { success, result/error }

export function dragRoutes(ctx) {
	return [
		// ── 创建空白页面 ──
		["/drag/page/add", "POST", true, async ({ body }) => {
			const name = body?.name;
			if (!name) throw engineError("BAD_REQUEST", "缺少 name");
			const id = genId();
			const page = emptyPage(id, body);
			writePage(ctx, page);
			return jimuResp({
				id,
				updateCount: page.updateCount,
				path: page.path,
				name: page.name,
			});
		}],

		// ── 查询页面详情 ──
		["/drag/page/queryById", "GET", true, async ({ query }) => {
			const id = query?.id ?? query;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const page = readPage(ctx, id);
			if (!page) return jimuErr(`页面不存在: ${id}`, "NOT_FOUND");
			return jimuResp(page);
		}],

		// ── 保存页面（整页覆盖写 template）──
		["/drag/page/edit", "POST", true, async ({ body }) => {
			const id = body?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const page = readPage(ctx, id) ?? emptyPage(id, {});

			if (body.name !== undefined) page.name = body.name;
			if (body.style !== undefined) page.style = body.style;
			if (body.theme !== undefined) page.theme = body.theme;
			if (body.backgroundImage !== undefined) page.backgroundImage = body.backgroundImage;
			if (body.designType !== undefined) page.designType = body.designType;
			if (body.protectionCode !== undefined) page.protectionCode = body.protectionCode;
			if (body.desJson !== undefined) page.desJson = body.desJson;
			if (body.template !== undefined) page.template = body.template; // bi_utils 传 JSON 字符串

			// updateCount 并发保护：客户端传的 updateCount 落后时自增
			const clientCount = Number(body.updateCount ?? 0);
			if (clientCount >= page.updateCount) {
				page.updateCount = clientCount + 1;
			} else {
				page.updateCount += 1;
			}
			page.updateTime = new Date().toISOString();

			writePage(ctx, page);
			return jimuResp({ updateCount: page.updateCount });
		}],

		// ── 分页列表 ──
		["/drag/page/list", "GET", true, async ({ query }) => {
			const pageNo = Math.max(1, Number(query?.pageNo ?? 1));
			const pageSize = Number(query?.pageSize ?? 50);
			const style = query?.style;

			const dir = pagesDir(ctx);
			const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
			const records = [];
			for (const f of files) {
				const p = readPage(ctx, f.replace(/\.json$/, ""));
				if (!p) continue;
				if (style && p.style !== style) continue;
				records.push(p);
			}
			records.sort((a, b) => (b.updateTime ?? "").localeCompare(a.updateTime ?? ""));

			const total = records.length;
			const start = (pageNo - 1) * pageSize;
			const slice = records.slice(start, start + pageSize).map((p) => ({
				id: p.id,
				name: p.name,
				style: p.style,
				theme: p.theme,
				designType: p.designType,
				backgroundImage: p.backgroundImage,
				updateCount: p.updateCount,
				updateTime: p.updateTime,
				createTime: p.createTime,
				visits: p.visits ?? 0,
			}));

			return jimuResp({
				records: slice,
				total,
				size: pageSize,
				pages: Math.ceil(total / pageSize) || 1,
				current: pageNo,
			});
		}],

		// ── 复制页面 ──
		["/drag/page/copyPage", "GET", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const src = readPage(ctx, id);
			if (!src) return jimuErr(`源页面不存在: ${id}`, "NOT_FOUND");
			const newId = genId();
			const copy = {
				...src,
				id: newId,
				name: `${src.name} (副本)`,
				updateCount: 1,
				createTime: new Date().toISOString(),
				updateTime: new Date().toISOString(),
				path: `/drag/page/edit?id=${newId}`,
			};
			writePage(ctx, copy);
			return jimuResp({ id: newId, name: copy.name, path: copy.path });
		}],

		// ── 物理删除 ──
		["/drag/page/physicalDelete", "DELETE", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const file = pageFile(ctx, id);
			if (existsSync(file)) unlinkSync(file);
			return jimuResp(true);
		}],

		// ── 软删除（本地 = 物理删除）──
		["/drag/page/delete", "DELETE", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const file = pageFile(ctx, id);
			if (existsSync(file)) unlinkSync(file);
			return jimuResp(true);
		}],

		// ── 恢复（no-op）──
		["/drag/page/recoveryDelete", "POST", true, async () => jimuResp(true)],

		// ── 访问计数（no-op）──
		["/drag/page/addVisitsNumber", "POST", true, async ({ body }) => {
			const id = body?.id;
			if (!id) return jimuResp(true);
			const p = readPage(ctx, id);
			if (p) {
				p.visits = (p.visits ?? 0) + 1;
				writePage(ctx, p);
			}
			return jimuResp(true);
		}],

		// ── 数据集 stub（让 script_builder.py 等不报错）──
		["/drag/onlDragDatasetHead/list", "GET", true, async () => jimuResp({ records: [], total: 0 })],
		["/drag/onlDragDatasetHead/add", "POST", true, async () => jimuResp({ id: genId() })],
		["/drag/onlDragDatasetHead/edit", "POST", true, async () => jimuResp(true)],
		["/drag/onlDragDatasetHead/delete", "DELETE", true, async () => jimuResp(true)],
		["/drag/onlDragDatasetHead/queryFieldBySql", "GET", true, async () => jimuResp([])],
		["/drag/onlDragDataSource/getOptions", "GET", true, async () => jimuResp([])],
		["/drag/jimuDragMap/list", "GET", true, async () => jimuResp({ records: [], total: 0 })],
	];
}
