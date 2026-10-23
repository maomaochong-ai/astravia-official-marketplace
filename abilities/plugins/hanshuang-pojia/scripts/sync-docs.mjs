#!/usr/bin/env node
/**
 * 把参考工具包里的实战文档整理成面板可检索的索引。
 *
 * 文档本体由 src/content/docs/**\/*.md 承载（vite 以 ?raw 惰性加载），
 * 这里只生成索引与完整性清单，因此重新同步时不会触碰任何正文。
 *
 * 用法：
 *   node scripts/sync-docs.mjs --from <seep-kit 根目录>
 *   node scripts/sync-docs.mjs --check          仅校验索引与磁盘一致
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "src/content/docs");
const indexPath = join(contentDir, "index.json");
const shaPath = join(contentDir, "docs.sha256");

const GROUPS = [
	{ id: "kb", label: "Knowledge base", source: "Tool/mcp/Tool/reverselab/kb" },
	{ id: "manual", label: "Manuals", source: "MANUAL" },
	{ id: "kit-docs", label: "Tool docs", source: "Tool/docs" },
];

function walk(dir, base = dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full, base));
		else if (entry.endsWith(".md")) out.push(relative(base, full).split(sep).join("/"));
	}
	return out.sort();
}

/** 机器可读附件（signal 索引、工具索引）：不参与全文索引，但应当能被 read_doc 直接打开。 */
function walkAssets(dir, base = dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walkAssets(full, base));
		else if (entry.endsWith(".json")) out.push(relative(base, full).split(sep).join("/"));
	}
	return out.sort();
}

/** 首个一级标题；跳过 YAML frontmatter，避免把 --- 当成标题。 */
function titleOf(text, fallback) {
	let body = text;
	if (body.startsWith("---")) {
		const end = body.indexOf("\n---", 3);
		if (end > 0) body = body.slice(end + 4);
	}
	for (const line of body.split("\n")) {
		const match = /^#\s+(.+?)\s*$/.exec(line);
		if (match) return match[1].replace(/[`*_]/g, "").trim();
	}
	return fallback;
}

function humanize(id) {
	const base = id.slice(id.lastIndexOf("/") + 1).replace(/\.md$/, "");
	return base.replace(/^\d+[-_]/, "").replace(/[-_]+/g, " ");
}

function buildIndex() {
	const entries = [];
	for (const group of GROUPS) {
		const dir = join(contentDir, group.id);
		if (!existsSync(dir)) continue;
		for (const rel of walk(dir)) {
			const full = join(dir, rel);
			const text = readFileSync(full, "utf8");
			const id = `${group.id}/${rel.replace(/\.md$/, "")}`;
			const segments = rel.split("/");
			entries.push({
				id,
				group: group.id,
				topic: segments.length > 1 ? segments.slice(0, -1).join("/") : "",
				title: titleOf(text, humanize(rel)),
				path: `src/content/docs/${group.id}/${rel}`,
				bytes: Buffer.byteLength(text),
				lines: text.split("\n").length,
				sha256: createHash("sha256").update(text).digest("hex").slice(0, 16),
			});
		}
	}
	return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 非 Markdown 附件索引。`kb/<分类>/techniques/kb-index.json` 是「信号 → 技术文件」映射，
 * `kit-docs/tool-index.json` 是 42 项工具清单。它们是数据不是文章，所以不进全文索引
 * （否则 `searchFullText` 会把 292 篇正文扫一遍再命中间隔表），但 `read_doc` 能直接打开。
 */
function buildAssets() {
	const out = [];
	for (const group of GROUPS) {
		const dir = join(contentDir, group.id);
		if (!existsSync(dir)) continue;
		for (const rel of walkAssets(dir)) {
			const text = readFileSync(join(dir, rel), "utf8");
			const segments = rel.split("/");
			out.push({
				/** 保留 `.json` 后缀：同名 Markdown（如 kit-docs/tool-index.md）已经占用了无后缀的 id。 */
				id: `${group.id}/${rel}`,
				group: group.id,
				topic: segments.length > 1 ? segments.slice(0, -1).join("/") : "",
				label: labelOfAsset(text, humanize(rel)),
				path: `src/content/docs/${group.id}/${rel}`,
				bytes: Buffer.byteLength(text),
				lines: text.split("\n").length,
				sha256: createHash("sha256").update(text).digest("hex").slice(0, 16),
			});
		}
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** 附件没有一级标题，用它能自我描述的字段当名字：知识库索引有 purpose，工具索引没有。 */
function labelOfAsset(text, fallback) {
	try {
		const parsed = JSON.parse(text);
		if (typeof parsed.purpose === "string" && parsed.purpose.trim() !== "") return parsed.purpose.trim();
		if (typeof parsed.source === "string") return `${fallback} — ${parsed.source}`;
	} catch {
		/* 不是合法 JSON 就退回文件名 */
	}
	return fallback;
}

function manifest(entries) {
	return entries.map(entry => `${entry.sha256}  ${entry.id}.md`).join("\n") + "\n";
}

function main() {
	const checkOnly = process.argv.includes("--check");
	const entries = buildIndex();
	const nextIndex = JSON.stringify(entries, null, "\t") + "\n";
	const nextSha = manifest(entries);
	const assetsPath = join(contentDir, "assets.json");
	const nextAssets = `${JSON.stringify(buildAssets(), null, "\t")}\n`;

	if (checkOnly) {
		const currentIndex = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
		const currentSha = existsSync(shaPath) ? readFileSync(shaPath, "utf8") : "";
		const currentAssets = existsSync(assetsPath) ? readFileSync(assetsPath, "utf8") : "";
		const stale = currentIndex !== nextIndex || currentSha !== nextSha || currentAssets !== nextAssets;
		if (stale) {
			console.error("docs index is stale — run node scripts/sync-docs.mjs");
			process.exit(1);
		}
		console.log(`docs index ok: ${entries.length} documents`);
		return;
	}

	writeFileSync(indexPath, nextIndex);
	writeFileSync(shaPath, nextSha);
	writeFileSync(assetsPath, nextAssets);
	const groups = new Map();
	for (const entry of entries) groups.set(entry.group, (groups.get(entry.group) ?? 0) + 1);
	const summary = [...groups].map(([id, count]) => `${id}=${count}`).join(" ");
	console.log(`wrote ${relative(root, indexPath)}: ${entries.length} documents (${summary})`);
}

main();
