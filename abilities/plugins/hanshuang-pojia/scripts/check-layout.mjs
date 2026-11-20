#!/usr/bin/env node
/**
 * 排版裁切门禁：找出「文字可能被容器裁掉」的写法，按允许清单判定是否放行。
 *
 * 为什么需要一条命令而不是靠肉眼：面板有 20+ 个页面、若干对话框，跨 Windows / macOS / Linux
 * 都要读得全。同一类问题（内容型文字用了单行截断、栏体写了固定高度）会随新页面不断复发。
 *
 * 三类检查，各自的「允许」条件都写死：
 *   1. `truncate` / `line-clamp-*` —— 只允许出现在：带 title 的属性、tabular-nums 的数值列、
 *      固定宽度的计数/时间列、以及明确标注为「预览片段」的 search snippet。
 *   2. 固定高度 `h-6..h-11` 且 `overflow-hidden` —— 一律不允许；承载文字用 min-h。
 *   3. `max-h-[Npx]` + `overflow-hidden` —— 只允许出现在对话框（`flex-col` 且内部有滚动区）。
 *
 * 用法：
 *   node scripts/check-layout.mjs            列出全部命中
 *   node scripts/check-layout.mjs --strict   有未放行的命中就非零退出（CI）
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = join(root, "src/features/workbench/components");
const strict = process.argv.includes("--strict");

/**
 * 向上找几行看有没有 title / aria-label：包在 <button title=...> 里的内层 span
 * 不重复写 title，但全文同样可读，所以不该被拦。
 */
function nearbyTitle(lines, index) {
	for (let i = index; i >= Math.max(0, index - 20); i -= 1) {
		if (/title=|aria-label=/.test(lines[i])) return true;
		if (/^\s*<(\w+)/.test(lines[i]) === false && i < index) continue;
	}
	return false;
}

/** 允许单行截断的判定：数值列、计数、时间、带 title 的标签。 */
function singleLineAllowed(line) {
	if (/tabular-nums/.test(line)) return true;
	if (/font-mono text-\[9/.test(line)) return true;
	if (/shrink-0/.test(line)) return true;
	// 同一行或紧邻的上一行给了 title，全文仍可读
	if (/title=/.test(line)) return true;
	return false;
}

/** 对话框的 max-h 是正确的：高度封顶、内部滚动。判据是同一行有 flex-col。 */
function cappedDialog(line) {
	return /flex-col/.test(line) && /overflow-hidden/.test(line) && /max-h-\[/.test(line);
}

const hits = [];
const walk = dir => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (entry.name.endsWith(".tsx")) {
			const lines = readFileSync(full, "utf8").split("\n");
			lines.forEach((line, index) => {
				if (!/className=/.test(line)) return;
				const rel = relative(root, full).replace(/\\/g, "/");
				if (/\btruncate\b|line-clamp-/.test(line) && !singleLineAllowed(line) && !nearbyTitle(lines, index)) {
					hits.push({ rel, line: index + 1, kind: "single-line", text: line.trim().slice(0, 96) });
				}
				if (/\boverflow-hidden\b/.test(line) && /\bh-(?:6|7|8|9|10|11)\b/.test(line)) {
					hits.push({ rel, line: index + 1, kind: "fixed-height", text: line.trim().slice(0, 96) });
				}
				if (/max-h-\[\d+px\]/.test(line) && /\boverflow-hidden\b/.test(line) && !cappedDialog(line)) {
					hits.push({ rel, line: index + 1, kind: "max-h", text: line.trim().slice(0, 96) });
				}
			});
		}
	}
};
walk(uiDir);

if (hits.length === 0) {
	console.log("layout: no clipping risk found");
} else {
	console.log(`layout: ${hits.length} clipping risk(s)`);
	for (const hit of hits) console.log(`  ${hit.kind.padEnd(12)} ${hit.rel}:${hit.line}  ${hit.text}`);
}

if (strict && hits.length > 0) {
	console.error("\nFAIL: content text may be clipped — give it a title, let it wrap (.fb-wrap), or use min-height.");
	process.exit(1);
}
