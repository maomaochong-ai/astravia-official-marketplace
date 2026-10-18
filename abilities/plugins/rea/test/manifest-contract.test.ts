import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 清单合同回归。
 *
 * 三件事只写在 plugin.json 里，宿主没有任何本地暗示能提示写错：
 * - `icon` 决定 tab 与输入栏 chip 的品牌图标（贡献不内联 icon 时由宿主回落）；
 * - `agent.skillPresentation` 决定技能在「技能/场景」等表面是否可见（插件提供的技能默认隐藏）；
 * - 展示名 / 描述写 `%key%`，键缺失会静默回落到 SKILL.md 原文。
 */
const pluginDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(pluginDir, "plugin.json"), "utf8")) as {
	icon?: string;
	agent?: {
		skillPaths?: string[];
		skillPresentation?: {
			defaultVisibility?: string;
			surfaces?: Record<string, string>;
			skills?: Record<string, { displayName?: string; displayDescription?: string }>;
		};
	};
};

const SURFACES = [
	"abilityCatalog",
	"agentConfiguration",
	"commandPalette",
	"skillPicker",
	"pluginDetail",
] as const;

function catalogs(): Record<string, Record<string, string>> {
	return {
		en: JSON.parse(readFileSync(join(pluginDir, "locales/en.json"), "utf8")),
		zh: JSON.parse(readFileSync(join(pluginDir, "locales/zh.json"), "utf8")),
	};
}

function placeholderKeys(value: string | undefined): string[] {
	if (!value) return [];
	const match = /^%([^%]+)%$/.exec(value);
	return match ? [match[1]] : [];
}

describe("plugin manifest contract", () => {
	it("declares a packaged icon that exists in the package", () => {
		expect(manifest.icon).toBe("assets/icon.svg");
		expect(existsSync(join(pluginDir, "assets/icon.svg"))).toBe(true);
	});

	it("makes the contributed skill visible on every user-facing surface", () => {
		const presentation = manifest.agent?.skillPresentation;
		expect(presentation?.defaultVisibility).toBe("visible");
		for (const surface of SURFACES) {
			expect(presentation?.surfaces?.[surface]).toBe("visible");
		}
	});

	it("presents the contributed skill under a real display name and description", () => {
		const skills = manifest.agent?.skillPresentation?.skills ?? {};
		const skill = skills["reverse-engineer-anything"];
		expect(skill).toBeDefined();
		const keys = [
			...placeholderKeys(skill?.displayName),
			...placeholderKeys(skill?.displayDescription),
		];
		expect(keys.length).toBe(2);

		const localeCatalogs = catalogs();
		for (const [locale, catalog] of Object.entries(localeCatalogs)) {
			for (const key of keys) {
				const value = catalog[key];
				expect(typeof value, `${locale} is missing ${key}`).toBe("string");
				expect(value.trim().length, `${locale}.${key} is empty`).toBeGreaterThan(0);
			}
		}
	});

	it("declares the skill path that the presentation rules refer to", () => {
		const paths = manifest.agent?.skillPaths ?? [];
		expect(paths.length).toBe(1);
		expect(existsSync(join(pluginDir, paths[0], "SKILL.md"))).toBe(true);
	});
});
