/**
 * drag.mjs — 自研大屏页面后端（AI skill 所需的 HTTP API）。
 *
 * 本 domain 实现 AI skill（bi_utils.py / spec_builder.py / template_ops.py 等）
 * 所需的大屏页面后端接口，完全用本地 JSON 文件存储（不依赖外部服务）。
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
 *   GET    /drag/jimuDragMap/list                       → 返回空（AI skill 约定路径，保持原名）
 *
 * 响应格式：统一 `{ success: true, result: ... }`（AI skill bi_utils.py 期望的原生格式）
 *   错误：`{ success: false, message: "..." }`
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { engineError } from "../../engine/protocol.ts";

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
	// 本地替代雪花 ID — 16 位 hex，足够区分
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

function pageResp(result) {
	return { success: true, result };
}

function pageErr(message, code = "BAD_REQUEST") {
	return { success: false, message, code };
}

// ─── 路由导出（由 http-server.mjs 直接消费，绕过 request-router） ───

// 本 domain 有特殊调用路径：http-server.mjs 在路径分发阶段直接拦截 /drag/*，
// 用 dragRoutes(pageCtx) 返回的元组表做 path+method 匹配，不走 request-router 的
// 统一 ok() 包装。因此 handler 返回值必须是 AI skill 期望的原生格式 { success, result }，
// 不能是 { ok, data }。ctx 也只传 { dataDir }，不依赖 createRouterContext 的 dbx-mcp 依赖。

// ══════════════════════════════════════════════════════════════════════════
// Phase B — BI 工作台端点组
// ══════════════════════════════════════════════════════════════════════════

// ─── 统一 data base 推导 ───
function dataBase(ctx) {
	return ctx.dataDir || process.env.DBX_DATA_DIR || join(process.cwd(), ".dbx-data");
}
function biDir(ctx) {
	const dir = join(dataBase(ctx), "bi");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}

// ─── 工厂：生成 bi/<name>.json 的 read / write 辅助 ───
// publishes 特例：defaultEmpty 是对象 { pages: {} }，其余都是数组
function makeBiListStore(filename: string, defaultEmpty: unknown[] | Record<string, unknown> = []) {
	const file = (ctx) => join(biDir(ctx), filename);
	const read = (ctx) => {
		const f = file(ctx);
		if (!existsSync(f)) return defaultEmpty;
		try { return JSON.parse(readFileSync(f, "utf8")); } catch { return defaultEmpty; }
	};
	const write = (ctx, list) => { writeFileSync(file(ctx), JSON.stringify(list, null, 2)); };
	return { file, read, write };
}

const datasourcesStore = makeBiListStore("datasources.json");
const runlogsStore = makeBiListStore("runlogs.json");
const sharelinksStore = makeBiListStore("sharelinks.json");
const publishesStore = makeBiListStore("publishes.json", { pages: {} });
const templatesStore = makeBiListStore("templates.json");

// 兼容旧调用名
const datasourcesFile = datasourcesStore.file;
const readDatasources = datasourcesStore.read;
const writeDatasources = datasourcesStore.write;
const runlogsFile = runlogsStore.file;
const readRunlogs = runlogsStore.read;
const writeRunlogs = runlogsStore.write;
const sharelinksFile = sharelinksStore.file;
const readSharelinks = sharelinksStore.read;
const writeSharelinks = sharelinksStore.write;
const publishFile = publishesStore.file;
const readPublishes = publishesStore.read;
const writePublishes = publishesStore.write;
const templatesFile = templatesStore.file;
const readTemplates = templatesStore.read;
const writeTemplates = templatesStore.write;

function shortCode(len = 6) {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let s = "";
	for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}

// ══════════════════════════════════════════════════════════════════════════
// 路由表（4 组新端点 + drag/page + dataset stub）
// ══════════════════════════════════════════════════════════════════════════

export function dragRoutes(ctx) {
	return [
		// ── 创建空白页面 ──
		["/drag/page/add", "POST", true, async ({ body }) => {
			const name = body?.name;
			if (!name) throw engineError("BAD_REQUEST", "缺少 name");
			const id = genId();
			const page = emptyPage(id, body);
			writePage(ctx, page);
			return pageResp({ id, updateCount: page.updateCount, path: page.path, name: page.name });
		}],

		// ── 查询页面详情 ──
		["/drag/page/queryById", "GET", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id 参数");
			const page = readPage(ctx, id);
			if (!page) return pageErr(`页面不存在: ${id}`, "NOT_FOUND");
			return pageResp(page);
		}],

		// ── 保存页面 ──
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
			if (body.template !== undefined) page.template = body.template;
			const clientCount = Number(body.updateCount ?? 0);
			page.updateCount = Math.max(page.updateCount + 1, clientCount + 1);
			page.updateTime = new Date().toISOString();
			writePage(ctx, page);
			return pageResp({ updateCount: page.updateCount });
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
				id: p.id, name: p.name, style: p.style, theme: p.theme,
				designType: p.designType, backgroundImage: p.backgroundImage,
				updateCount: p.updateCount, updateTime: p.updateTime,
				createTime: p.createTime, visits: p.visits ?? 0,
			}));
			return pageResp({ records: slice, total, size: pageSize, pages: Math.ceil(total / pageSize) || 1, current: pageNo });
		}],

		// ── 复制页面 ──
		["/drag/page/copyPage", "GET", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const src = readPage(ctx, id);
			if (!src) return pageErr(`源页面不存在: ${id}`, "NOT_FOUND");
			const newId = genId();
			const copy = {
				...src, id: newId, name: `${src.name} (副本)`,
				updateCount: 1, createTime: new Date().toISOString(),
				updateTime: new Date().toISOString(), path: `/drag/page/edit?id=${newId}`,
			};
			writePage(ctx, copy);
			return pageResp({ id: newId, name: copy.name, path: copy.path });
		}],

		// ── 物理删除 ──
		["/drag/page/physicalDelete", "DELETE", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const file = pageFile(ctx, id);
			if (existsSync(file)) unlinkSync(file);
			return pageResp(true);
		}],

		["/drag/page/delete", "DELETE", true, async ({ query }) => {
			const id = query?.id;
			if (!id) throw engineError("BAD_REQUEST", "缺少 id");
			const file = pageFile(ctx, id);
			if (existsSync(file)) unlinkSync(file);
			return pageResp(true);
		}],

		["/drag/page/recoveryDelete", "POST", true, async () => pageResp(true)],

		["/drag/page/addVisitsNumber", "POST", true, async ({ body }) => {
			const id = body?.id;
			if (!id) return pageResp(true);
			const p = readPage(ctx, id);
			if (p) { p.visits = (p.visits ?? 0) + 1; writePage(ctx, p); }
			return pageResp(true);
		}],

		// ── 数据集 stub ──
		["/drag/onlDragDatasetHead/list", "GET", true, async () => pageResp({ records: [], total: 0 })],
		["/drag/onlDragDatasetHead/add", "POST", true, async () => pageResp({ id: genId() })],
		["/drag/onlDragDatasetHead/edit", "POST", true, async () => pageResp(true)],
		["/drag/onlDragDatasetHead/delete", "DELETE", true, async () => pageResp(true)],
		["/drag/onlDragDatasetHead/queryFieldBySql", "GET", true, async () => pageResp([])],
		["/drag/onlDragDataSource/getOptions", "GET", true, async () => pageResp([])],
		["/drag/jimuDragMap/list", "GET", true, async () => pageResp({ records: [], total: 0 })],

		// ════════════════════════════════════════════════════════════════════
		// Phase B-1 · 数据源 CRUD（bi-editor 左栏数据源列表）
		// ════════════════════════════════════════════════════════════════════
		["/drag/datasource/list", "GET", true, async () => pageResp(readDatasources(ctx))],
		["/drag/datasource/add", "POST", true, async ({ body }) => {
			const list = readDatasources(ctx);
			const ds = {
				id: genId(),
				name: body?.name ?? "未命名",
				type: body?.type ?? "mysql",
				host: body?.host ?? "",
				port: body?.port ?? 3306,
				database: body?.database ?? "",
				status: "connected",
				createTime: new Date().toISOString(),
			};
			list.push(ds);
			writeDatasources(ctx, list);
			return pageResp(ds);
		}],
		["/drag/datasource/edit", "POST", true, async ({ body }) => {
			const list = readDatasources(ctx);
			const i = list.findIndex((d) => d.id === body?.id);
			if (i < 0) return pageErr("数据源不存在", "NOT_FOUND");
			list[i] = { ...list[i], ...body };
			writeDatasources(ctx, list);
			return pageResp(list[i]);
		}],
		["/drag/datasource/delete", "DELETE", true, async ({ query }) => {
			const id = query?.id;
			const list = readDatasources(ctx).filter((d) => d.id !== id);
			writeDatasources(ctx, list);
			return pageResp(true);
		}],

		// ════════════════════════════════════════════════════════════════════
		// Phase B-2 · Run 日志（append-only，workbench 右侧"最近运行"）
		// ════════════════════════════════════════════════════════════════════
		["/drag/runlog/list", "GET", true, async ({ query }) => {
			const limit = Number(query?.limit ?? 20);
			const all = readRunlogs(ctx);
			const recent = all.slice(-limit).reverse();
			return pageResp({ records: recent, total: all.length });
		}],
		["/drag/runlog/add", "POST", true, async ({ body }) => {
			const list = readRunlogs(ctx);
			const log = {
				id: genId(),
				pageId: body?.pageId,
				pageName: body?.pageName ?? "未命名",
				detail: body?.detail ?? "",
				cost: body?.cost ?? "—",
				state: body?.state ?? "成功",
				createTime: new Date().toISOString(),
			};
			list.push(log);
			writeRunlogs(ctx, list);
			return pageResp(log);
		}],

		// ════════════════════════════════════════════════════════════════════
		// Phase B-3 · 分享链接（permanent + timed）
		// ════════════════════════════════════════════════════════════════════
		["/drag/sharelink/list", "GET", true, async ({ query }) => {
			const pageId = query?.pageId;
			const all = readSharelinks(ctx);
			const filtered = pageId ? all.filter((s) => s.pageId === pageId) : all;
			return pageResp(filtered);
		}],
		["/drag/sharelink/create", "POST", true, async ({ body }) => {
			const list = readSharelinks(ctx);
			const type = body?.type ?? "permanent"; // permanent | timed
			const link = {
				id: genId(),
				pageId: body?.pageId,
				path: body?.path ?? `bi.local/${type === "permanent" ? "d" : "s"}/${shortCode()}`,
				type,
				expiresAt: type === "timed" ? body?.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : null,
				password: body?.password ?? null,
				createTime: new Date().toISOString(),
			};
			list.push(link);
			writeSharelinks(ctx, list);
			return pageResp(link);
		}],
		["/drag/sharelink/revoke", "POST", true, async ({ body }) => {
			const list = readSharelinks(ctx).filter((s) => s.id !== body?.id);
			writeSharelinks(ctx, list);
			return pageResp(true);
		}],

		// ════════════════════════════════════════════════════════════════════
		// Phase B-4 · 工作树发布状态
		// ════════════════════════════════════════════════════════════════════
		["/drag/worktree/status", "GET", true, async () => {
			const pagesDir_ = pagesDir(ctx);
			const files = existsSync(pagesDir_) ? readdirSync(pagesDir_).filter((f) => f.endsWith(".json")) : [];
			const publish = readPublishes(ctx);
			const pages = [];
			let dirty = 0;
			for (const f of files) {
				const p = readPage(ctx, f.replace(/\.json$/, ""));
				if (!p) continue;
				const pub = publish.pages[p.id];
				const isDirty = !pub || pub.updateCount < p.updateCount;
				if (isDirty) dirty++;
				pages.push({
					id: p.id, name: p.name, style: p.style,
					updateCount: p.updateCount,
					publishedCount: pub?.updateCount ?? 0,
					publishedAt: pub?.publishTime ?? null,
					dirty: isDirty,
				});
			}
			return pageResp({ pages, dirtyCount: dirty });
		}],
		["/drag/worktree/publish", "POST", true, async ({ body }) => {
			const ids = body?.pageIds ?? [];
			const publish = readPublishes(ctx);
			for (const id of ids) {
				const p = readPage(ctx, id);
				if (p) {
					publish.pages[id] = { updateCount: p.updateCount, publishTime: new Date().toISOString() };
				}
			}
			writePublishes(ctx, publish);
			return pageResp({ published: ids.length });
		}],

		// ════════════════════════════════════════════════════════════════════
		// Phase C2-模板系统
		// ════════════════════════════════════════════════════════════════════
		["/drag/template/list", "GET", true, async () => pageResp(readTemplates(ctx))],
		["/drag/template/save", "POST", true, async ({ body }) => {
			const list = readTemplates(ctx);
			const tpl = {
				id: genId(),
				name: body?.name ?? "未命名模板",
				template: body?.template ?? JSON.stringify({ nodes: {}, links: [] }),
				createTime: new Date().toISOString(),
			};
			list.push(tpl);
			writeTemplates(ctx, list);
			return pageResp(tpl);
		}],
		["/drag/template/delete", "DELETE", true, async ({ query }) => {
			const list = readTemplates(ctx).filter((t) => t.id !== query?.id);
			writeTemplates(ctx, list);
			return pageResp(true);
		}],

		// ════════════════════════════════════════════════════════════════════
		// Phase D · AI 生成节点参数（engine mock，宿主端点未暴露时降级此）
		// ════════════════════════════════════════════════════════════════════
		["/drag/ai/generate", "POST", true, async ({ body }) => {
			/**
			 * 画布 AI 生成参数 mock 端点：
			 *   输入：{ prompt: string, canvasContext?: { nodes: [...], datasources: [...] } }
			 *   输出：{ prompt, rows: ParamRow[], resultName, paramCount, pendingCount }
			 *
			 * 真实宿主端点未暴露时用此降级：
			 *   用 FNV-1a 对 prompt 哈希 → 生成稳定的"AI 推断"参数行
			 *   这样同一个 prompt 每次返回一样的参数（可重现、可插入画布）
			 *   UI 上显示 Chip"AI 推断" vs "手动" vs "取自数据集" 区分来源
			 */
			const prompt = body?.prompt ?? "";
			const seed = prompt || `ai-${Date.now()}`;
			let h = 2166136261 >>> 0;
			for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }

			const pick = (arr) => arr[h % arr.length];
			h = Math.imul(h, 16777619); h ^= (h >>> 16);

			// 图表类型从 prompt 里猜
			const chartHints = [
				{ kw: ["折线", "趋势", "增长"], kind: "line", label: "折线图 · 面积" },
				{ kw: ["饼", "环形", "占比"], kind: "donut", label: "环形图" },
				{ kw: ["柱", "条形", "对比"], kind: "bar", label: "柱状图" },
				{ kw: ["漏斗", "转化"], kind: "funnel", label: "漏斗图" },
				{ kw: ["KPI", "大数字", "指标"], kind: "kpi", label: "KPI 大数字" },
				{ kw: ["箱线", "分布"], kind: "boxplot", label: "箱线图" },
			];
			let guessed = chartHints.find((c) => c.kw.some((k) => prompt.includes(k)));
			if (!guessed) guessed = pick(chartHints);

			// 聚合粒度
			const grains = ["按天", "按周（ISO 周）", "按月", "按季度"];
			const grain = pick(grains);
			h = Math.imul(h, 16777619); h ^= (h >>> 16);

			// 对比策略
			const comparisons = ["无对比", "去年同期 · 虚线", "上期环比", "均值参考线"];
			const cmp = pick(comparisons);
			h = Math.imul(h, 16777619); h ^= (h >>> 16);

			// 调色板
			const palettes = ["科技（沿用）", "商务蓝", "暖色调", "深色模式"];
			const pal = pick(palettes);

			const rows = [
				{ field: "图表类型", value: guessed.label, from: "ai" },
				{ field: "聚合粒度", value: grain, from: "ai" },
				{ field: "对比", value: cmp, from: "ai" },
				{ field: "调色板", value: pal, from: "user" },
				{ field: "数据源", value: "插件工作台 · MySQL", from: "dataset" },
			];

			// 生成结果名：小写 prompt 前几个词
			const slug = prompt
				.replace(/[^\w\u4e00-\u9fa5]/g, "_")
				.replace(/_+/g, "_")
				.slice(0, 32) || `ai_${(h >>> 0).toString(16).slice(0, 6)}`;

			return pageResp({
				prompt,
				rows,
				resultName: slug.startsWith("_") ? `ai${slug}` : slug,
				paramCount: rows.length,
				pendingCount: 1,
				kindHint: guessed.kind,
			});
		}],
	];
}
