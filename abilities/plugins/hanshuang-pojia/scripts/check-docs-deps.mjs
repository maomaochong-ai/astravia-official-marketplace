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
 * 用法：node scripts/check-docs-deps.mjs            报告三类
 *       node scripts/check-docs-deps.mjs --strict   目录职责不对就非零退出
 *
 * `--strict` 判两条：
 *   1. `docs/**` 里出现被代码读取的文件 → 机器读的产物应该放 `spec/`；
 *   2. `spec/**` 里出现没有任何代码引用的文件 → 产物目录里放了散文。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const DOC_DIRS = ["docs/audits", "docs/contract", "docs/domains", "docs/reference"];
/** 机器读产物的家：代码解析它，人写的散文不在这里。 */
const SPEC_DIR = "spec";
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
const specs = existsSync(join(root, SPEC_DIR))
	? walk(join(root, SPEC_DIR)).map(file => relative(root, file).split("\\").join("/"))
	: [];
const code = [...CODE_DIRS.flatMap(dir => walk(join(root, dir), /\.(ts|tsx|mjs|js)$/)), join(root, "package.json")];

const sources = code
	.map(file => ({ file: relative(root, file).split("\\").join("/"), lines: readFileSync(file, "utf8").split("\n") }))
	.filter(source => source.file !== SELF);

/**
 * 把一批文件分成「被读取」「只被点名」「无人引用」三档。
 *
 * `matchFullPath` 用于 `spec/`：那里有 `README.md` 这种重名极多的文件，
 * 只按 basename 匹配会把「任何提到 README.md 的那一行」都算成消费方。
 */
function classify(files, matchFullPath = false) {
	const read = [];
	const mention = [];
	for (const doc of files) {
		const name = basename(doc);
		const hits = [];
		let readHit = false;
		for (const source of sources) {
			source.lines.forEach((line, index) => {
				const matched = matchFullPath ? line.includes(doc) : line.includes(name) || line.includes(doc);
				if (!matched) return;
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
	const untouched = files.filter(doc => !read.some(item => item.doc === doc) && !mention.some(item => item.doc === doc));
	return { read, mention, untouched };
}

const docResult = classify(docs);
// spec/ 里 README.md 是目录自身的说明，同 docs/README.md 一样不参与「必须被读」的判定。
const specResult = classify(
	specs.filter(doc => !doc.endsWith("/README.md")),
	true,
);
const { read, mention, untouched } = docResult;

console.log(`# docs dependency report`);
console.log(`\n文档 ${docs.length} 篇 · 代码文件 ${sources.length} 个\n`);

console.log(`## 被代码读取（移动/删除要先改代码）— ${read.length}`);
for (const item of read) console.log(`- ${item.doc}  ← ${item.hits.join(", ")}`);
if (read.length === 0) console.log("- (none)");

console.log(`\n## 只在源码里被点名（注释或字符串常量，非读取）— ${mention.length}`);
for (const item of mention) console.log(`- ${item.doc}  ← ${item.hits.join(", ")}`);
if (mention.length === 0) console.log("- (none)");

console.log(`\n## 无任何代码引用（纯人读）— ${untouched.length}`);
for (const doc of untouched) console.log(`- ${doc}`);

console.log(`\n## spec/ —— 被代码读取 — ${specResult.read.length}`);
for (const item of specResult.read) console.log(`- ${item.doc}  ← ${item.hits.join(", ")}`);
if (specResult.read.length === 0) console.log("- (none)");
if (specResult.mention.length + specResult.untouched.length > 0) {
	console.log(`\n## spec/ —— 没有任何代码读取（产物目录里不该有）— ${specResult.mention.length + specResult.untouched.length}`);
	for (const item of [...specResult.mention, ...specResult.untouched.map(doc => ({ doc, hits: [] }))]) {
		console.log(`- ${item.doc}${item.hits.length > 0 ? `  ← 仅点名：${item.hits.join(", ")}` : ""}`);
	}
}

/**
 * 目录职责不对就是错，不是提醒。`docs/` 是给人读的散文，`spec/` 是被代码解析的产物；
 * 两份混在一起时，改文档的人无法从目录判断「动它会不会弄红测试」。
 */
if (process.argv.includes("--strict")) {
	const problems = [
		...read.map(item => `docs/ 下被代码读取，应该放 spec/：${item.doc}  ← ${item.hits.join(", ")}`),
		...specResult.mention.map(item => `spec/ 下只被点名、没有代码读取，应该放 docs/：${item.doc}`),
		...specResult.untouched.map(doc => `spec/ 下无人读取，应该删掉或放 docs/：${doc}`),
	];
	if (problems.length > 0) {
		console.error(`\nFAIL: ${problems.length} 处目录职责不对`);
		for (const line of problems) console.error(`  - ${line}`);
		process.exit(1);
	}
	console.log(`\nPASS: docs/ 无机器读产物，spec/ 全部被代码读取`);
}