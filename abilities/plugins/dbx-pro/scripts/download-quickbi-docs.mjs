#!/usr/bin/env node
/**
 * 下载 Quick BI llms.txt 索引里的全部文档到 research/quick-bi-docs/
 *
 * 用法：
 *   node scripts/download-quickbi-docs.mjs
 *   node scripts/download-quickbi-docs.mjs --limit 5        # 只下前 5 篇（调试）
 *   node scripts/download-quickbi-docs.mjs --force          # 覆盖已存在文件
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "research", "quick-bi-docs");
const LLMS_URL = "https://help.aliyun.com/zh/quick-bi/llms.txt";

const args = process.argv.slice(2);
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) || Infinity : Infinity;
const force = args.includes("--force");

mkdirSync(OUT_DIR, { recursive: true });

// 1. 拉 llms.txt 索引
console.log(`📥 拉取索引: ${LLMS_URL}`);
const indexRes = await fetch(LLMS_URL);
if (!indexRes.ok) {
	console.error(`❌ 索引拉取失败: ${indexRes.status}`);
	process.exit(1);
}
const indexText = await indexRes.text();

// 2. 提取 URL —— 匹配 `- [标题](https://help.aliyun.com/zh/quick-bi/.../xxx.md)`
const urlRe = /- \[([^\]]+)\]\((https:\/\/help\.aliyun\.com\/zh\/quick-bi\/[^)]+\.md)\)/g;
const entries = [];
let m;
while ((m = urlRe.exec(indexText)) !== null) {
	entries.push({ title: m[1], url: m[2] });
}

console.log(`📋 索引中共 ${entries.length} 篇文档，本次下载 ${Math.min(entries.length, limit)} 篇`);

// 3. 逐篇下载
let ok = 0, skip = 0, fail = 0;
for (let i = 0; i < Math.min(entries.length, limit); i++) {
	const { title, url } = entries[i];
	// 从 URL 推导文件名：https://help.aliyun.com/zh/quick-bi/xxx/yyy.md → xxx__yyy.md
	const pathPart = new URL(url).pathname.replace(/^\/zh\/quick-bi\//, "");
	const safeName = pathPart.replace(/\//g, "__");
	const outPath = join(OUT_DIR, safeName);

	if (existsSync(outPath) && !force) {
		skip++;
		continue;
	}

	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.log(`  ⚠️ [${i + 1}] ${res.status} ${safeName}`);
			fail++;
			continue;
		}
		const text = await res.text();
		const size = (Buffer.byteLength(text, "utf8") / 1024).toFixed(1);
		writeFileSync(outPath, text, "utf8");
		console.log(`  ✅ [${i + 1}] ${safeName}  (${size} KB)`);
		ok++;
	} catch (err) {
		console.log(`  ❌ [${i + 1}] ${safeName} — ${err.message}`);
		fail++;
	}

	// 轻微限速，避免被 WAF 拦
	await new Promise((r) => setTimeout(r, 200));
}

console.log(`\n📊 完成：✅ ${ok} 下载 | ⏭ ${skip} 跳过（已存在） | ❌ ${fail} 失败`);
console.log(`📁 输出目录: ${OUT_DIR}`);
