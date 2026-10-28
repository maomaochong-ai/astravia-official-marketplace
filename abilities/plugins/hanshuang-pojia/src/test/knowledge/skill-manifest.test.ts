import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../../../", import.meta.url));

interface PluginManifest {
	agent?: {
		skillPaths?: string[];
		skillPresentation?: {
			defaultVisibility?: "visible" | "hidden";
			surfaces?: Record<string, "visible" | "hidden">;
			skills?: Record<
				string,
				{
					displayName?: string;
					displayDescription?: string;
					defaultVisibility?: "visible" | "hidden";
					surfaces?: Record<string, "visible" | "hidden">;
				}
			>;
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
	const lines = match[1].split(/\r?\n/);
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.trim().length === 0) continue;
		// 注释块不是字段（上游技能在 frontmatter 里写了整段 ATTRIBUTION）。
		if (line.startsWith("#")) continue;
		// 缩进行是上一个键的嵌套内容（`metadata:` 之类）或块标量正文，已在下面整段吃掉。
		if (/^[ \t]/.test(line)) continue;
		const separator = line.indexOf(":");
		if (separator < 1) throw new Error(`not a mapping line: ${line}`);
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim();
		// `description: >` / `|`（以及带裁剪指示符的写法）和空值都接缩进块。
		// 空值后面跟缩进内容时是嵌套映射或嵌套列表，真 YAML 里合法，这里只记录被折平后的文本。
		if (value === "" || /^[>|][+-]?$/.test(value)) {
			const block: string[] = [];
			for (let next = index + 1; next < lines.length; next += 1) {
				const candidate = lines[next];
				if (candidate.trim().length === 0) continue;
				if (!/^[ \t]/.test(candidate)) break;
				block.push(candidate.trim());
				index = next;
			}
			if (key === "description" && block.length === 0) throw new Error(`${key} is empty`);
			fields[key] = block.join(" ").trim();
			continue;
		}
		if (value.startsWith('"')) {
			fields[key] = JSON.parse(value) as string;
			continue;
		}
		if (value.includes(": ")) throw new Error(`${key} has an unquoted ": " and would break YAML parsing`);
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

/**
 * 宿主把每条 skillPath 当资源登记，目录可递归；技能身份取 SKILL.md 所在目录名。
 * 所以这里也按目录递归收集，而不是假设 skillPaths 每条都直接指向一个技能。
 */
function collectSkillDirectories(relative: string): string[] {
	const root = join(pluginRoot, relative);
	const found: string[] = [];
	const visit = (directory: string): void => {
		if (existsSync(join(directory, "SKILL.md"))) {
			found.push(directory);
			return;
		}
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) visit(join(directory, entry.name));
		}
	};
	visit(root);
	return found;
}

const skillDirectories = skillPaths.flatMap(collectSkillDirectories);

describe("plugin skills", () => {
	it("declares at least one skill path", () => {
		expect(skillPaths.length).toBeGreaterThan(0);
	});

	it("keeps every declared skill directory loadable", () => {
		expect(skillDirectories.length).toBeGreaterThan(0);
		for (const directory of skillDirectories) {
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
		const names = skillDirectories.map(directory => basename(directory));

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

	it("exposes exactly one entry in the conversation skill picker", () => {
		const provider = manifest.agent?.skillPresentation ?? {};
		const visibleInPicker = Object.entries(presentation)
			.filter(([, rule]) => (rule.surfaces?.skillPicker ?? rule.defaultVisibility ?? provider.defaultVisibility) === "visible")
			.map(([name]) => name);

		// 对话里的技能/场景列表只留一个入口：其余技能仍落在 agent/skills 下，由 Agent 按需读取，
		// 不该在每个用户的技能选择器里各占一行。
		expect(visibleInPicker).toEqual(["hanshuang-pojia"]);
		expect(provider.defaultVisibility).toBe("hidden");
		// 插件详情页仍然要把全部技能列出来，否则用户看不到插件到底带什么。
		expect(provider.surfaces?.pluginDetail).toBe("visible");
	});
});
