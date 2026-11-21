// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The manifest is the contract with the host and with the marketplace index.
 * These checks are cheap and they catch the failures that only show up after a
 * release: an id that drifted from the slug, a card that cannot be found, a
 * locale missing the key a component asks for.
 */

// Vitest runs with the plugin directory as cwd. `import.meta.url` is an http URL
// under the DOM environment, so paths resolve from cwd instead.
const ROOT = process.cwd();
const MARKETPLACE_ROOT = join(ROOT, "../../..");

const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const plugin = readJson("plugin.json");
const ability = readJson("ability.json");
const pkg = readJson("package.json");
const en = readJson("locales/en.json") as Record<string, string>;
const zh = readJson("locales/zh.json") as Record<string, string>;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist" || entry === "release") continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
}

const SOURCE_FILES = walk(join(ROOT, "src")).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes("/test/"));

describe("plugin identity", () => {
	it("uses the marketplace slug as its plugin id", () => {
		expect(plugin.id).toBe(ability.slug);
		expect(plugin.id).toBe("logocreator");
	});

	it("keeps every version in step", () => {
		expect(ability.version).toBe(plugin.version);
		expect(pkg.version).toBe(plugin.version);
	});

	it("ships the files it points at", () => {
		expect(existsSync(join(ROOT, plugin.icon))).toBe(true);
		expect(existsSync(join(ROOT, ability.detail.path))).toBe(true);
		expect(existsSync(join(ROOT, ability.detail.i18n.zh.path))).toBe(true);
		for (const skillPath of plugin.agent.skillPaths) {
			expect(existsSync(join(ROOT, skillPath, "SKILL.md"))).toBe(true);
		}
		expect(plugin.entry).toMatch(/^dist\//);
		expect(plugin.styles.every((style: string) => style.startsWith("dist/"))).toBe(true);
	});

	it("declares the permissions its code actually needs", () => {
		const declared = new Set<string>(plugin.permissions);
		for (const permission of [
			"ui.slot.activity-tab",
			"ui.slot.input-action",
			"agent.tools.register",
			"agent.toolHandler.execute",
			"agent.skills.control",
			"storage.read",
			"storage.write",
			"secrets.read",
			"secrets.write",
			"fs.read",
			"fs.write",
			"network.fetch",
		]) {
			expect(declared.has(permission), `plugin.json must declare ${permission}`).toBe(true);
		}
		expect(plugin.network.allowedHosts).toContain("api.together.xyz");
	});
});

describe("marketplace registration", () => {
	const catalog = JSON.parse(readFileSync(join(MARKETPLACE_ROOT, ".astravia/marketplace.source.json"), "utf8"));
	const entry = catalog.abilities.find((item: { slug: string }) => item.slug === "logocreator");

	it("is registered in the source catalog", () => {
		expect(entry, "logocreator must be registered in .astravia/marketplace.source.json").toBeTruthy();
	});

	it("agrees with the package on type, version and path", () => {
		expect(entry.type).toBe("plugin");
		expect(entry.version).toBe(plugin.version);
		expect(entry.source.path).toBe("abilities/plugins/logocreator");
	});

	it("names itself without a type suffix and carries both locale fields", () => {
		expect(entry.name).not.toMatch(/plugin|skill|mcp|bundle|插件|技能|套装/i);
		expect(entry.detail.i18n.zh.name).toBeTruthy();
		expect(entry.categoryI18n.zh).toBeTruthy();
		expect(entry.categoryI18n.en).toBeTruthy();
	});

	it("keeps the package manifest on the same minimum app version", () => {
		expect(entry.minAppVersion).toBe(catalog.minAppVersion);
	});
});

describe("locales", () => {
	it("defines the same keys in both languages", () => {
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
	});

	it("resolves every %key% the manifest uses", () => {
		const raw = readFileSync(join(ROOT, "plugin.json"), "utf8");
		const keys = [...raw.matchAll(/%([a-zA-Z0-9_.]+)%/g)].map((match) => match[1]);
		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			expect(en[key], `en is missing %${key}%`).toBeTruthy();
			expect(zh[key], `zh is missing %${key}%`).toBeTruthy();
		}
	});

	it("resolves every key a component asks for", () => {
		const candidates = new Set<string>();
		for (const file of SOURCE_FILES) {
			const text = readFileSync(file, "utf8");
			for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) candidates.add(match[1]);
			for (const match of text.matchAll(/\b(?:labelKey|hintKey|structureKey|nameKey)\s*:\s*"([a-zA-Z0-9_.]+)"/g)) {
				candidates.add(match[1]);
			}
		}
		expect(candidates.size).toBeGreaterThan(40);
		const missingEn = [...candidates].filter((key) => !(key in en));
		const missingZh = [...candidates].filter((key) => !(key in zh));
		expect(missingEn, `missing in en.json: ${missingEn.join(", ")}`).toEqual([]);
		expect(missingZh, `missing in zh.json: ${missingZh.join(", ")}`).toEqual([]);
	});

	it("keeps the default language English", () => {
		expect(plugin.defaultLocale).toBe("en");
		// A Chinese value where the English one is identical usually means one of the
		// two files was copy-pasted and never translated.
		const untranslated = Object.keys(en).filter(
			(key) => key.startsWith("panel.") || key.startsWith("action.") || key.startsWith("kit."),
		);
		const identical = untranslated.filter((key) => en[key] === zh[key] && en[key].length > 8);
		expect(identical.length).toBeLessThan(3);
	});
});

describe("the skill", () => {
	const text = readFileSync(join(ROOT, "agent/skills/logo-studio/SKILL.md"), "utf8");

	it("has frontmatter that matches its directory", () => {
		const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
		expect(front).toContain("name: logo-studio");
		expect(front).toMatch(/description:\s*"?[^"\n]{40,}/);
	});

	it("names the real tool ids", () => {
		expect(text).toContain("logocreator_design");
		expect(text).toContain("logocreator_brand_kit");
		expect(text).toContain("logocreator_catalog");
	});
});
