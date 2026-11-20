#!/usr/bin/env node
/**
 * docs 依赖体检：仓库文档（docs/{audits,contract,domains,reference}）里，哪些真的被代码读、哪些只是被点名。
 *
 * 为什么需要它：`docs/` 不进发布包（`stage-plugin-release.py` 的 RUNTIME_DIRS 没有 docs），
 * 所以「移动或删除一篇文档」是否安全，取决于有没有代码在读它 —— 而不是取决于有没有别处提到它。
 * 单靠 grep 分不清这两种：`readFileSync(".../toolchain-parity.md")` 与注释里一句
 * 「差异见 docs/audits/x.md」看起来一模一样。
 *
 * 判定口径：命中文件名 / 路径，并且同一行（或前一行）出现读取 API；
 * 字符串常量里写出路径但没读，算「点名」。
 *
 * 用法：node scripts/check-docs-deps.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const DOC_DIRS = ["docs/audits", "docs/contract", "docs/domains", "docs/reference"];
const CODE_DIRS = ["src", "scripts"];
/** 排除自身：它的注释里写了这些路径，不排除就会把自己算成消费方。 */
const SELF = "scripts/check-docs-deps.mjs";
const READ_API = /\b(readFileSync|readFile|createReadStream)\s*\(/;
/** 本仓库打开文件的两种写法：直接 readFileSync(path)，或先用 join / new URL 拼路径。 */
const PATH_BUILD = /\b(join|new URL|resolve)\s*\(/;

function walk(dir, filter) {
	const out = [];
	const step = current => {
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) step(full);
			else if (!filter || filter.test(entry.name)) out.push(full);
		}
	};
	step(dir);
	return out;
}

const docs = DOC_DIRS.flatMap(dir => walk(join(root, dir))).map(file => relative(root, file).split("\\").join("/"));
const code = [...CODE_DIRS.flatMap(dir => walk(join(root, dir), /\.(ts|tsx|mjs|js)$/)), join(root, "package.json")];

const sources = code
	.map(file => ({ file: relative(root, file).split("\\").join("/"), lines: readFileSync(file, "utf8").split("\n") }))
	.filter(source => source.file !== SELF);

const read = [];
const mention = [];
for (const doc of docs) {
	const name = basename(doc);
	const hits = [];
	let readHit = false;
	for (const source of sources) {
		source.lines.forEach((line, index) => {
			if (!line.includes(name) && !line.includes(doc)) return;
			hits.push(`${source.file}:${index + 1}`);
			// 同一行或前一行出现读取 API，才算真的在读这个文件。
			const window = `${source.lines[index] ?? ""}\n${source.lines[index - 1] ?? ""}`;
			// 三种都算在读：同一行有读取 API；同一行用 join / new URL 拼了这个路径；上一行拼、这一行读。
			// 只是字符串里写了个路径（例如写进 scope.md 的引用列表）不算。
			if (READ_API.test(window) || PATH_BUILD.test(line)) readHit = true;
		});
	}
	if (readHit) read.push({ doc, hits });
	else if (hits.length > 0) mention.push({ doc, hits });
}

console.log(`# docs dependency report`);
console.log(`\n文档 ${docs.length} 篇 · 代码文件 ${sources.length} 个\n`);

console.log(`## 被代码读取（移动/删除要先改代码）— ${read.length}`);
for (const item of read) console.log(`- ${item.doc}  ← ${item.hits.join(", ")}`);
if (read.length === 0) console.log("- (none)");

console.log(`\n## 只在源码里被点名（注释或字符串常量，非读取）— ${mention.length}`);
for (const item of mention) console.log(`- ${item.doc}  ← ${item.hits.join(", ")}`);
if (mention.length === 0) console.log("- (none)");

const untouched = docs.filter(doc => !read.some(item => item.doc === doc) && !mention.some(item => item.doc === doc));
console.log(`\n## 无任何代码引用（纯人读）— ${untouched.length}`);
for (const doc of untouched) console.log(`- ${doc}`);
