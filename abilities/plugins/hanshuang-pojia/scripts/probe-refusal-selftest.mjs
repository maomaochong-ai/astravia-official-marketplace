#!/usr/bin/env node
/**
 * `probe_refusal` 的端到端自检：不碰任何外部服务、不需要密钥、不需要加白名单。
 *
 * 为什么是一个本地 HTTP 服务而不是 mock 函数：工具真正走的路径是
 * `ctx.network.request → POST {base}/chat/completions → 解析 choices[0].message.content`。
 * 只 mock 分类器会漏掉「请求体形状 / 响应解析 / 空正文 / HTTP 错误」这四段，
 * 而这四段恰好是上游 `probe-refusal.py` 与本站实现差异最大的地方。
 *
 * 起一个 127.0.0.1 的 OpenAI 兼容桩，按档位返回四种响应：
 *   1 正常回答（含 sorry，验证不会被关键词误判）
 *   2 正常回答（带偏移与函数名）
 *   3 政策拒绝（中文）
 *   4 HTTP 200 + 空正文（服务端拦截）
 * 然后把 domain/refusal-probe 的梯度、判定、汇总、表格串起来跑一遍，断言结论。
 *
 * 用法：
 *   node --experimental-strip-types scripts/probe-refusal-selftest.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// 先用 esbuild 把领域模块打成一个 ESM 文件：node 的 ESM 解析器要求 import 带扩展名，
// 而源码里写的是 `./refusal`。与 scripts/analyze.mjs 同一套做法，不依赖 loader。
const bundle = join(root, ".cache", "refusal-probe.mjs");
await mkdir(dirname(bundle), { recursive: true });
await build({
	entryPoints: [join(root, "src/domain/refusal-probe.ts")],
	bundle: true,
	format: "esm",
	platform: "node",
	outfile: bundle,
	logLevel: "silent",
});
const { probesFor, toResult, summarise, renderTable } = await import(pathToFileURL(bundle).href);

/** 按档位回放四种形态；`level` 由提示词里的级别关键字识别，与服务端无关。 */
const REPLIES = {
	1: "Sorry for the confusion — a SQL injection is untrusted input concatenated into a query.",
	2: "在授权范围内：先看参数是否进入 SQL 拼接，再用参数化查询修复。判定点在 login handler 的 query builder。",
	3: "很抱歉，我不能提供这段分析。",
	4: "",
};

function levelOf(content) {
	if (content.includes("SQL 注入漏洞")) return 1;
	if (content.includes("授权的安全审计")) return 2;
	if (content.includes("CWE-602")) return 3;
	return 4;
}

const server = createServer((request, response) => {
	let raw = "";
	request.on("data", chunk => {
		raw += chunk;
	});
	request.on("end", () => {
		if (!request.url.endsWith("/chat/completions")) {
			response.writeHead(404, { "content-type": "application/json" });
			response.end(JSON.stringify({ error: { message: "not found" } }));
			return;
		}
		let level = 4;
		try {
			const body = JSON.parse(raw);
			level = levelOf(body.messages?.[0]?.content ?? "");
		} catch {
			// 解析失败就按最后一档回空正文：与真实服务端行为一致。
		}
		response.writeHead(200, { "content-type": "application/json" });
		response.end(
			JSON.stringify({
				choices: [{ message: { content: REPLIES[level] ?? "" }, finish_reason: level === 4 ? "stop" : "stop" }],
			}),
		);
	});
});

await new Promise(done => server.listen(0, "127.0.0.1", done));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/v1`;

/** 与工具内一致的请求形状：body 显式 {type:"json"} 是宿主网络层的要求，这里直接发 JSON。 */
async function ask(probe) {
	const response = await fetch(`${base}/chat/completions`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ model: "stub", messages: [{ role: "user", content: probe.text }], temperature: 0, max_tokens: 800 }),
	});
	const payload = await response.json();
	return toResult(probe, payload.choices?.[0]?.message?.content ?? "");
}

const results = [];
for (const probe of probesFor("zh")) results.push(await ask(probe));
server.close();

const summary = summarise(results);
console.log("# probe_refusal 自检（本地桩，127.0.0.1）\n");
console.log(renderTable(results));
console.log(`\n结论：${summary.headline}`);
console.log(`firstRefusal=${summary.firstRefusal} answered=${summary.answered} refused=${summary.refused} empty=${summary.empty}`);

const failures = [];
if (results[0].verdict !== "answered") failures.push("第 1 档含 sorry 的正常回答被误判为拒答");
if (results[1].verdict !== "answered") failures.push("第 2 档授权审计场景应当正常回答");
if (results[2].verdict !== "refused") failures.push("第 3 档政策拒绝未被识别");
if (results[3].verdict !== "empty") failures.push("第 4 档空正文未被单列为 empty");
if (summary.firstRefusal !== 3) failures.push(`firstRefusal 应为 3，得到 ${summary.firstRefusal}`);

if (failures.length > 0) {
	console.error(`\nFAIL: ${failures.length} 项`);
	for (const line of failures) console.error(`  - ${line}`);
	process.exit(1);
}
console.log("\nPASS: 四档判定与 upstream 语义一致（含 sorry 豁免、空正文单列）");
