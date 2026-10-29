#!/usr/bin/env node
/**
 * 导出面体检：找出「导出了但没人用」的符号。
 *
 * 三类分开报，因为它们要动的地方不同：
 *   dead      —— 定义之外一次都没出现，删掉即可；
 *   testOnly  —— 只有测试在用，属于测试夹具，别当生产依赖；
 *   internal  —— 只在本文件里用，`export` 是多余的（接口面虚胖，但不影响行为）。
 *
 * 局限：按标识符做全文计数，识别不了「字符串拼出来的动态调用」。所以它给的是候选，
 * 删之前还是要看那个符号到底是什么。
 *
 * 用法：
 *   node scripts/report-dead-exports.mjs            打印三类清单
 *   node scripts/report-dead-exports.mjs --json     机读输出
 *   node scripts/report-dead-exports.mjs --fail-on-dead   有 dead 就以 1 退出（CI 用）
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

const DECLARATION =
	/^\s*export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const info = statSync(full);
		if (info.isDirectory()) out.push(...walk(full));
		else if (/\.tsx?$/.test(entry) && !/\.generated\.ts$/.test(entry)) out.push(full);
	}
	return out;
}

function countOccurrences(haystack, name) {
	const pattern = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g");
	return (haystack.match(pattern) ?? []).length;
}

function main() {
	const files = walk(srcDir);
	const sources = new Map(files.map(file => [file, readFileSync(file, "utf8")]));
	const declarations = [];

	for (const [file, text] of sources) {
		DECLARATION.lastIndex = 0;
		let match;
		while ((match = DECLARATION.exec(text)) !== null) {
			declarations.push({ name: match[1], file });
		}
	}

	const report = { dead: [], testOnly: [], internal: [] };
	for (const { name, file } of declarations) {
		let total = 0;
		let outsideDefinition = 0;
		let inTests = 0;
		for (const [other, text] of sources) {
			const hits = countOccurrences(text, name);
			if (hits === 0) continue;
			total += hits;
			if (other !== file) outsideDefinition += hits;
			if (/\/test\//.test(other) || /\.test\.tsx?$/.test(other)) inTests += hits;
		}
		const entry = { name, file: relative(root, file) };
		// 定义本身占一次；同一文件里还有别处用，就是 internal，不是 dead。
		if (total <= 1) report.dead.push(entry);
		else if (outsideDefinition === 0) report.internal.push(entry);
		else if (outsideDefinition === inTests) report.testOnly.push({ ...entry, testHits: inTests });
	}

	if (process.argv.includes("--json")) {
		console.log(JSON.stringify(report, null, "\t"));
	} else {
		const section = (title, rows, note) => {
			console.log(`\n## ${title} (${rows.length}) — ${note}`);
			for (const row of rows) console.log(`  ${row.name.padEnd(28)} ${row.file}`);
		};
		section("dead", report.dead, "定义之外零出现，可以删");
		section("testOnly", report.testOnly, "只有测试在用");
		section("internal", report.internal, "只在本文件用，export 多余");
		console.log(
			`\n合计 ${declarations.length} 个导出：dead ${report.dead.length} · testOnly ${report.testOnly.length} · internal ${report.internal.length}`,
		);
	}

	if (process.argv.includes("--fail-on-dead") && report.dead.length > 0) process.exit(1);
}

main();
