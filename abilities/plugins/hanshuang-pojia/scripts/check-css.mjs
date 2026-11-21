#!/usr/bin/env node
/**
 * 样式表结构门禁。
 *
 * 由来：一次 `edit` 把 `/*` 那一行替换掉了，于是「设置页两栏」的注释只剩正文，
 * 后面那条 `.fb-settings { display: grid; … }` 被当成注释外垃圾吞掉 ——
 * **CSS 不报错，规则静默消失**，页面上只表现为「两栏没生效」。
 * 这类事故无法靠读代码发现，只能靠结构检查。
 *
 * 四类检查：
 *   1. 注释块成对（`/*` 与 `*​/` 数量相等，且没有孤立的 `*​/`）；
 *   2. 花括号成对；
 *   3. 形如 `属性: 值;` 的行必须落在某个规则块内（否则就是被吞掉的孤儿声明）；
 *   4. 一组关键布局类必须存在（防止整条规则再次消失）。
 *
 * 用法：
 *   node scripts/check-css.mjs            只报告
 *   node scripts/check-css.mjs --strict   有问题就非零退出
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const file = join(root, "src/style.css");
const css = readFileSync(file, "utf8");
const lines = css.split(/\r?\n/);

const problems = [];

// ── 1. 注释块
const openCount = (css.match(/\/\*/g) ?? []).length;
const closeCount = (css.match(/\*\//g) ?? []).length;
if (openCount !== closeCount) {
	problems.push(`comment blocks unbalanced: ${openCount} "/*" vs ${closeCount} "*/"`);
}

// 逐行跟踪注释状态，找出「注释正文出现在注释外」的行（本次事故的形态）
let inComment = false;
lines.forEach((line, index) => {
	const trimmed = line.trim();
	const opens = (line.match(/\/\*/g) ?? []).length;
	const closes = (line.match(/\*\//g) ?? []).length;

	if (!inComment && trimmed.startsWith("*") && !trimmed.startsWith("*/")) {
		problems.push(`line ${index + 1}: comment body outside a comment block — ${trimmed.slice(0, 60)}`);
	}
	if (!inComment && closes > opens) {
		problems.push(`line ${index + 1}: stray "*/" — ${trimmed.slice(0, 60)}`);
	}

	inComment = inComment ? !(closes > 0) : opens > closes;
});

// ── 2. 花括号（忽略注释内容）
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
const opens = (stripped.match(/\{/g) ?? []).length;
const closes = (stripped.match(/\}/g) ?? []).length;
if (opens !== closes) problems.push(`braces unbalanced: ${opens} "{" vs ${closes} "}"`);

// ── 3. 孤儿声明：形如 `prop: value;` 的行必须在块内
let depth = 0;
let comment = false;
lines.forEach((line, index) => {
	const strippedLine = line.replace(/\/\*[\s\S]*?\*\//g, "");
	const trimmed = strippedLine.trim();
	if (trimmed.startsWith("/*")) comment = true;
	if (comment) {
		if (trimmed.includes("*/")) comment = false;
		return;
	}
	if (depth === 0 && /^[a-z-]+\s*:\s*[^;]+;$/i.test(trimmed)) {
		problems.push(`line ${index + 1}: declaration outside any rule — ${trimmed.slice(0, 60)}`);
	}
	depth += (strippedLine.match(/\{/g) ?? []).length;
	depth -= (strippedLine.match(/\}/g) ?? []).length;
});

// ── 4. 关键布局类必须在场
for (const selector of [":where(.fb-page)", ".fb-settings", ".fb-settings-body", ".fb-samples", ".fb-samples-picker", ".fb-line-clamp-2"]) {
	if (!css.includes(selector)) problems.push(`missing selector: ${selector}`);
}

if (problems.length === 0) {
	console.log("css: structure ok");
} else {
	console.log(`css: ${problems.length} problem(s)`);
	for (const item of problems) console.log(`  ${item}`);
}

if (strict && problems.length > 0) {
	console.error("\nFAIL: src/style.css is structurally broken — a dropped rule fails silently in the browser.");
	process.exit(1);
}
