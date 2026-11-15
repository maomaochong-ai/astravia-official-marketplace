import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { interpolatePluginText } from "@astravia-org/plugin-sdk";

/**
 * 「界面直接显示 `{count}`」这类 bug 的两道门。
 *
 * 真机截图里首屏写着「工具面 {count} 个」。两处原因叠在一起：
 *
 *  1. 曾经 `const t = (key) => ctx.i18n.t(key)` 丢掉了第二个参数 → 见下面第一条；
 *  2. 更隐蔽的一层：**宿主只替换 `{{name}}`**（`plugin-sdk/src/i18n.ts` 的
 *     `interpolatePluginText` 用的是 `/\{\{(\w+)\}\}/`）。我们的 13 个键写的是单括号
 *     `{name}`，于是即便参数传到了，也一个都没被替换——测试还把单括号当成正确形态。
 *
 * 所以这里不再复述替换规则，而是**直接调用宿主的那个函数**，并扫两套文案：
 *  - 任何逗号式占位符都不许留（单括号 = 永远不会被替换）；
 *  - 每个带参调用在 zh/en 里都要有对应的 `{{name}}`；
 *  - 缺失的数值由调用点补 0，而不是把变量名留给用户看。
 */

const plugin = resolve(process.cwd());
const root = readFileSync(join(plugin, "src/index.tsx"), "utf8");

function sourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "test") continue;
			files.push(...sourceFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

const zh = JSON.parse(readFileSync(join(plugin, "locales/zh.json"), "utf8")) as Record<string, string>;
const en = JSON.parse(readFileSync(join(plugin, "locales/en.json"), "utf8")) as Record<string, string>;
const catalogues = [
	["zh", zh],
	["en", en],
] as const;

describe("interpolation", () => {
	it("forwards params from the plugin root into ctx.i18n.t", () => {
		expect(root).toContain("ctx.i18n.t(key, params)");
		expect(root).not.toMatch(/const t = \(key: string\) => ctx\.i18n\.t\(key\);/);
	});

	it("uses the host's own interpolator, not a private copy of the rule", () => {
		// 这条是这次的真根因：宿主替换 `{{name}}`，我们写的是 `{name}`。
		expect(interpolatePluginText("{{count}} 条新消息", { count: 3 })).toBe("3 条新消息");
		expect(interpolatePluginText("{count} 条新消息", { count: 3 })).toBe("{count} 条新消息");
	});

	it("has no single-brace placeholder in either catalogue", () => {
		const offenders: string[] = [];
		for (const [label, catalogue] of catalogues) {
			for (const [key, text] of Object.entries(catalogue)) {
				if (/(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}(?!\})/.test(text)) offenders.push(`${label}:${key}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it("every interpolated call has a matching placeholder in both locales", () => {
		const offenders: string[] = [];
		for (const file of sourceFiles(join(plugin, "src"))) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"\s*,\s*\{([^}]*)\}/g)) {
				const key = match[1] as string;
				const names = [...(match[2] ?? "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((group) => group[1]!);
				for (const [label, catalogue] of catalogues) {
					const text = catalogue[key];
					if (text === undefined) {
						offenders.push(`${key}: missing in ${label}`);
						continue;
					}
					for (const name of names) {
						if (!text.includes(`{{${name}}}`)) offenders.push(`${key}: ${label} lacks {{${name}}}`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	it("renders every catalogue entry without leaving braces behind", () => {
		// 用宿主的函数把所有键跑一遍：给了对应参数之后，文本里不该还有 `{{`。
		const offenders: string[] = [];
		for (const [label, catalogue] of catalogues) {
			for (const [key, text] of Object.entries(catalogue)) {
				const names = [...text.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)].map((group) => group[1]!);
				const params = Object.fromEntries(names.map((name) => [name, 1]));
				const rendered = interpolatePluginText(text, params);
				if (rendered.includes("{{") || rendered.includes("}}")) offenders.push(`${label}:${key}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it("counts read zero, never a variable name, when the service has no value", () => {
		// 用户的原话：“没有就是 0 不要使用变量”。首屏三处计数都按 0 兜底。
		const launch = readFileSync(join(plugin, "src/features/scan-console/components/launch-screen.tsx"), "utf8");
		expect(launch).toContain("capabilities?.tools ?? 0");
		// 技能库那一行 1.5.0 删掉了（界面里恒为 0，没有信息量），所以只保留工具面的 0 兜底。
		expect(launch).not.toContain("capabilities?.skills");
		expect(launch).toContain("scope?.entries.length ?? 0");
	});
});
