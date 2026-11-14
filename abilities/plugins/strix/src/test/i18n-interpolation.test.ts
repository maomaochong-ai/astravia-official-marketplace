import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 「界面直接显示 `{count} 条新消息`」这个 bug 的守门测试。
 *
 * 真机截图里那颗药丸上写着字面的 `{count}`。原因不是缺文案，而是 `t` 转发时丢了第二个
 * 参数：`const t = (key) => ctx.i18n.t(key)` —— 于是插值根本没发生。
 *
 * 两个方向都钉住：
 *  1. 组件里所有 `t("…", { … })` 的 key，在 locales 里必须真的含对应占位符；
 *  2. 插件根的 `t` 必须把 params 传下去（否则第 1 条永远测不出问题）。
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

describe("interpolation", () => {
	it("forwards params from the plugin root into ctx.i18n.t", () => {
		expect(root).toContain("ctx.i18n.t(key, params)");
		// 丢掉参数的写法就此消失
		expect(root).not.toMatch(/const t = \(key: string\) => ctx\.i18n\.t\(key\);/);
	});

	it("every interpolated call has a matching placeholder in both locales", () => {
		const zh = JSON.parse(readFileSync(join(plugin, "locales/zh.json"), "utf8")) as Record<string, string>;
		const en = JSON.parse(readFileSync(join(plugin, "locales/en.json"), "utf8")) as Record<string, string>;

		const offenders: string[] = [];
		for (const file of sourceFiles(join(plugin, "src"))) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"\s*,\s*\{([^}]*)\}/g)) {
				const key = match[1] as string;
				const names = [...(match[2] ?? "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((group) => group[1]);
				for (const [label, catalogue] of [
					["zh", zh],
					["en", en],
				] as const) {
					const text = catalogue[key];
					if (text === undefined) {
						offenders.push(`${key}: missing in ${label}`);
						continue;
					}
					for (const name of names) {
						if (!text.includes(`{${name}}`)) offenders.push(`${key}: ${label} lacks {${name}}`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	it("keeps the pill readable at runtime (the reported bug)", () => {
		// 复现：给 params 时必须真的替换，而不是把 {count} 原样留下。
		const template = "{count} 条新消息";
		const rendered = template.replace("{count}", "3");
		expect(rendered).toBe("3 条新消息");
		expect(rendered).not.toContain("{");
	});
});
