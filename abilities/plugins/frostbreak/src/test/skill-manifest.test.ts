import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));

interface PluginManifest {
	agent?: {
		skillPaths?: string[];
		skillPresentation?: {
			skills?: Record<string, { displayName?: string; displayDescription?: string }>;
		};
	};
}

/**
 * 宿主用 YAML 解析技能 frontmatter。plain scalar 里出现 ": " 会直接解析失败，
 * 而失败只会记一条 diagnostic——技能就这样从技能列表里消失了（1.1.0 的真实故障）。
 * 这里用同一套规则复刻最小子集：带引号的值按 JSON 反序列化，其余值不允许 ": "。
 */
function parseFrontmatter(raw: string): Record<string, string> {
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
	if (!match) throw new Error("missing frontmatter block");
	const fields: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		if (line.trim().length === 0) continue;
		const separator = line.indexOf(":");
		if (separator < 1) throw new Error(`not a mapping line: ${line}`);
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim();
		if (value.startsWith('"')) {
			fields[key] = JSON.parse(value) as string;
			continue;
		}
		if (value.includes(": ")) throw new Error(`${key} has an unquoted ": " and would break YAML parsing`);
		if (value.length === 0) throw new Error(`${key} is empty`);
		fields[key] = value;
	}
	return fields;
}

function readJson<T>(relative: string): T {
	return JSON.parse(readFileSync(join(pluginRoot, relative), "utf8")) as T;
}

const manifest = readJson<PluginManifest>("plugin.json");
const skillPaths = manifest.agent?.skillPaths ?? [];
const presentation = manifest.agent?.skillPresentation?.skills ?? {};

describe("plugin skills", () => {
	it("declares at least one skill path", () => {
		expect(skillPaths.length).toBeGreaterThan(0);
	});

	it("keeps every declared skill directory loadable", () => {
		for (const relative of skillPaths) {
			const directory = join(pluginRoot, relative);
			expect(statSync(directory).isDirectory()).toBe(true);

			const frontmatter = parseFrontmatter(readFileSync(join(directory, "SKILL.md"), "utf8"));
			expect(frontmatter.name).toBe(basename(directory));
			expect(frontmatter.description.length).toBeGreaterThan(40);
			// 宿主的技能描述有上限，超长会整条丢弃。
			expect(frontmatter.description.length).toBeLessThanOrEqual(1024);
		}
	});

	it("presents every skill with resolved placeholders", () => {
		const catalogs = ["locales/en.json", "locales/zh.json"].map(file => readJson<Record<string, string>>(file));
		const names = skillPaths.map(relative => basename(relative));

		expect(Object.keys(presentation).sort()).toEqual(names.slice().sort());

		for (const rule of Object.values(presentation)) {
			const placeholders = [rule.displayName, rule.displayDescription].filter(
				(value): value is string => typeof value === "string",
			);
			expect(placeholders.length).toBe(2);
			for (const placeholder of placeholders) {
				const key = /^%(.+)%$/.exec(placeholder)?.[1];
				expect(key).toBeTruthy();
				for (const catalog of catalogs) expect(catalog[key!]).toBeTruthy();
			}
		}
	});
});
