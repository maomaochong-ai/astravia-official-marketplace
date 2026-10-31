import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 占位符对账。
 *
 * 语言包里写着 `{{active}}`、源码却传 `{ writing }` 时，界面不会报错——它直接把 `{{active}}`
 * 印在用户脸上。这类缺陷 tsc 看不见、键存在性检查也看不见，只能逐条比对。
 *
 * 规则只有一条：语言包里出现的每个 `{{name}}`，调用点都必须给；给了多余的不算错
 * （有些键两种语言用到的参数不同，共用一处的调用点）。
 */

const ROOT = new URL("..", import.meta.url).pathname;

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
		else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(path);
	}
	return out;
}

/** 从 `{` 开始按深度截出对象字面量，返回其中的标识符（`a: …` 与简写 `a`）。 */
function identifiers(block: string): Set<string> {
	const found = new Set<string>();
	for (const match of block.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) found.add(match[1] ?? "");
	for (const match of block.matchAll(/[,{]\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g)) found.add(match[1] ?? "");
	return found;
}

function objectAfter(source: string, afterKey: number): string | null {
	const open = source.indexOf("{", afterKey);
	if (open === -1) return null;
	// `t("key", someVariable)` 不是字面量，跳过。
	if (!/^[\s,]*$/.test(source.slice(afterKey, open))) return null;
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		const char = source[i];
		if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(open, i + 1);
		}
	}
	return null;
}

const en = JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")) as Record<string, string>;
const zh = JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")) as Record<string, string>;
const needs = new Map<string, string[]>();
for (const [key, value] of Object.entries(en)) {
	const slots = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? "");
	if (slots.length > 0) needs.set(key, [...new Set(slots)]);
}

describe("locale placeholders", () => {
	it("every {{slot}} the copy asks for is supplied at the call site", () => {
		const problems: string[] = [];
		for (const file of sourceFiles(join(ROOT, "src"))) {
			const source = stripComments(readFileSync(file, "utf8"));
			for (const [key, slots] of needs) {
				for (const match of source.matchAll(new RegExp(`t\\(\\s*"${key.replace(/\./g, "\\.")}"`, "g"))) {
					const afterKey = (match.index ?? 0) + match[0].length;
					const block = objectAfter(source, afterKey);
					if (block === null) {
						problems.push(`${file}: t("${key}") has no parameters, copy needs ${slots.join(", ")}`);
						continue;
					}
					if (block === null) continue;
					const given = identifiers(block);
					const missing = slots.filter((slot) => !given.has(slot));
					if (missing.length > 0) {
						problems.push(`${file}: t("${key}") is missing ${missing.join(", ")}`);
					}
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it("both locales ask for the same slots", () => {
		const problems: string[] = [];
		for (const [key, value] of Object.entries(zh)) {
			const a = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
			const b = [...(en[key] ?? "").matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
			if (a.join() !== b.join()) problems.push(`${key}: en=${b.join()} zh=${a.join()}`);
		}
		expect(problems).toEqual([]);
	});
});
