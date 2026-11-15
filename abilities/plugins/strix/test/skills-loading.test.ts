import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { locateSkills, loadBodies, loadIndex } from "../src/service/skills";
import { normalizeSkillName, suggestSkills } from "../src/service/skill-matching";

/**
 * 技能库真的能被取到（1.2.2）。
 *
 * 用户的原话是"技能库是否真的生效"。随包的 75 篇一直在，问题在**取用**：
 * 文件名 `authentication_jwt` vs 包名 `authentication-jwt`，按 `jwt` 查不到；
 * 查不到只回一句 missing，调用方会以为这个能力不存在。
 */

const plugin = resolve(process.cwd());
const skills = locateSkills();

describe("the library is where the plugin says it is", () => {
	it("resolves to the bundled copy, not a scan of upstream", () => {
		expect(skills.source).toBe("bundled");
		expect(skills.root.replaceAll("\\", "/")).toContain("agent/skills/library");
	});

	it("indexes 75 packs in 11 categories", async () => {
		const index = await loadIndex(skills);
		expect(index.entries.length).toBe(75);
		expect(index.categories.length).toBe(11);
		// 每一篇都有描述：列表里没有空壳行。
		expect(index.entries.filter((entry) => !entry.description)).toEqual([]);
	});
});

describe("names are normalised before matching", () => {
	it("treats -, _ and spaces as the same separator", () => {
		expect(normalizeSkillName("Authentication JWT")).toBe(normalizeSkillName("authentication_jwt"));
		expect(normalizeSkillName("authentication-jwt")).toBe(normalizeSkillName("authentication_jwt"));
	});

	it("loads a pack by its hyphenated name", async () => {
		const result = await loadBodies(skills, ["authentication-jwt"]);
		expect(result.missing).toEqual([]);
		const body = Object.values(result.markdown)[0] ?? "";
		expect(body).toContain("JWT");
		// 正文不带 frontmatter：模型看到的是内容，不是元数据。
		expect(body.startsWith("---")).toBe(false);
	});

	it("still accepts category/name", async () => {
		const result = await loadBodies(skills, ["tooling/nmap"]);
		expect(result.missing).toEqual([]);
		expect(Object.keys(result.markdown)).toContain("nmap");
	});
});

describe("a miss comes with somewhere to go", () => {
	it("suggests near names instead of only saying missing", async () => {
		const result = await loadBodies(skills, ["jwt"]);
		expect(result.missing).toEqual(["jwt"]);
		const near = result.suggestions["jwt"] ?? [];
		expect(near.length).toBeGreaterThan(0);
		expect(near.some((entry) => entry.includes("authentication-jwt"))).toBe(true);
	});

	it("tells a caller that a category is not a skill", async () => {
		// `reconnaissance` 是类别：直接 load 会 miss，但建议里该给出这一类里的几篇。
		const result = await loadBodies(skills, ["reconnaissance"]);
		const near = result.suggestions["reconnaissance"] ?? [];
		expect(near.length).toBeGreaterThan(0);
		expect(near.every((entry) => entry.includes("/"))).toBe(true);
	});

	it("ranks name hits above description hits", () => {
		const entries = [
			{ name: "nmap", category: "tooling", description: "Canonical Nmap CLI syntax" },
			{ name: "port-scan", category: "reconnaissance", description: "uses nmap under the hood" },
			{ name: "graphql", category: "technologies", description: "schema probing" },
		];
		const near = suggestSkills(entries, "nmap");
		expect(near[0]).toBe("tooling/nmap");
		expect(near).toContain("reconnaissance/port-scan");
		expect(near).not.toContain("technologies/graphql");
	});
});

describe("nothing is silently empty", () => {
	it("returns one entry per requested name, hit or miss", async () => {
		const result = await loadBodies(skills, ["nmap", "definitely-not-a-skill"]);
		expect(Object.keys(result.markdown)).toHaveLength(1);
		expect(result.missing).toEqual(["definitely-not-a-skill"]);
		expect(join(plugin, "agent/skills/library")).toBeTruthy();
	});
});
