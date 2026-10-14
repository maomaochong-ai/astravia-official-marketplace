#!/usr/bin/env node
/**
 * 下载 Quick BI 文档到 research/quick-bi-docs/
 *
 * 双源策略：
 * 1. 优先从 alibabacloud 镜像拉取（无 WAF 限制）
 * 2. 对 alibabacloud 缺失的文档，回退到 help.aliyun.com
 *
 * 用法：
 *   node scripts/download-quickbi-docs.mjs
 *   node scripts/download-quickbi-docs.mjs --force          # 覆盖已存在文件
 *   node scripts/download-quickbi-docs.mjs --limit 5        # 只下前 5 篇（调试）
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "research", "quick-bi-docs");

const SOURCES = {
  alibabacloud: {
    llms: "https://www.alibabacloud.com/help/zh/quick-bi/llms.txt",
    base: "https://www.alibabacloud.com/help/zh/quick-bi/",
    pathPrefix: "/help/zh/quick-bi/",
  },
  aliyun: {
    llms: "https://help.aliyun.com/zh/quick-bi/llms.txt",
    base: "https://help.aliyun.com/zh/quick-bi/",
    pathPrefix: "/zh/quick-bi/",
  },
};

const args = process.argv.slice(2);
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) || Infinity : Infinity;
const force = args.includes("--force");

mkdirSync(OUT_DIR, { recursive: true });

function isBadContent(text) {
  return text.includes("_____tmd_____") ||
    text.includes("x5referer") ||
    text.includes("window.location.replace") ||
    text.includes("punish?x5secdata");
}

async function fetchIndex(source) {
  console.log(`📥 拉取索引: ${source.llms}`);
  const res = await fetch(source.llms);
  if (!res.ok) {
    console.error(`❌ 索引拉取失败: ${res.status}`);
    return [];
  }
  const text = await res.text();
  const urlRe = /\[([^\]]+)\]\((https?:\/\/[^)]+\.md)\)/g;
  const entries = [];
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[2];
    if (url.startsWith(source.base)) {
      entries.push({ title: m[1], url });
    }
  }
  return entries;
}

async function fetchDoc(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/markdown, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });
      if (!res.ok) return { ok: false, status: res.status };
      const text = await res.text();
      if (isBadContent(text)) return { ok: false, status: "WAF" };
      return { ok: true, text };
    } catch (err) {
      if (i === retries) return { ok: false, status: err.message };
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function urlToFilename(url, pathPrefix) {
  const pathPart = new URL(url).pathname.replace(new RegExp(`^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), "");
  return pathPart.replace(/\//g, "__");
}

async function main() {
  // 1. 从两个源拉取索引
  const acEntries = await fetchIndex(SOURCES.alibabacloud);
  const aliyunEntries = await fetchIndex(SOURCES.aliyun);

  console.log(`📋 alibabacloud: ${acEntries.length} 篇 | help.aliyun.com: ${aliyunEntries.length} 篇`);

  // 2. 合并：alibabacloud 优先，aliyun 补全
  const allDocs = new Map();

  for (const e of acEntries) {
    const filename = urlToFilename(e.url, SOURCES.alibabacloud.pathPrefix);
    allDocs.set(filename, { ...e, source: "alibabacloud", pathPrefix: SOURCES.alibabacloud.pathPrefix });
  }

  for (const e of aliyunEntries) {
    const filename = urlToFilename(e.url, SOURCES.aliyun.pathPrefix);
    if (!allDocs.has(filename)) {
      allDocs.set(filename, { ...e, source: "aliyun", pathPrefix: SOURCES.aliyun.pathPrefix });
    }
  }

  console.log(`📋 合并后共 ${allDocs.size} 篇文档`);

  // 3. 下载
  let ok = 0, skip = 0, fail = 0;
  const errors = [];
  const docs = [...allDocs.entries()].slice(0, limit);

  for (let i = 0; i < docs.length; i++) {
    const [filename, entry] = docs[i];
    const outPath = join(OUT_DIR, filename);

    if (existsSync(outPath) && !force) {
      const existing = readFileSync(outPath, "utf-8");
      if (existing.length > 100 && !isBadContent(existing)) {
        skip++;
        continue;
      }
    }

    const result = await fetchDoc(entry.url);
    if (!result.ok) {
      console.log(`  ⚠️ [${i + 1}] ${result.status} ${filename} (${entry.source})`);
      fail++;
      errors.push({ file: filename, status: result.status, source: entry.source });
    } else {
      const size = (Buffer.byteLength(result.text, "utf8") / 1024).toFixed(1);
      writeFileSync(outPath, result.text, "utf8");
      console.log(`  ✅ [${i + 1}] ${filename}  (${size} KB) [${entry.source}]`);
      ok++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 完成：✅ ${ok} 下载 | ⏭ ${skip} 跳过 | ❌ ${fail} 失败`);
  console.log(`📁 输出目录: ${OUT_DIR}`);

  if (errors.length > 0) {
    console.log(`\n失败文件 (${errors.length})：`);
    for (const e of errors.slice(0, 20)) {
      console.log(`  ${e.file}: ${e.status} [${e.source}]`);
    }
    if (errors.length > 20) console.log(`  ... 及其他 ${errors.length - 20} 个`);
  }
}

main().catch(console.error);
