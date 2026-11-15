import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { locateSkills, loadIndex, loadBodies, packagedSkillsRoot } from "../src/service/skills";

/**
 * 「library/ 怎么被用、用了有什么用」的另一半：**只有一份**。
 *
 * 0.9.1 把上游 76 篇复制进 library/ 之后，`agent/skills/strix/tooling/` 那 13 篇与
 * `library/tooling/` 逐字节相同，而运行时只读 library —— 那 13 份成了读不到的副本
 * （62 KB，且会随上游漂移而与新版不一致）。1.0.1 删掉它，这条守着别再长出第二份。
 */

const plugin = resolve(process.cwd());

describe("one copy of the library", () => {
	it("has exactly one tooling directory, and it is the packaged library", () => {
		expect(existsSync(join(plugin, "agent/skills/library/tooling"))).toBe(true);
		expect(existsSync(join(plugin, "agent/skills/strix"))).toBe(false);
	});

	it("resolves to library and reports where it came from", () => {
		const location = locateSkills();
		expect(location.source).toBe("bundled");
		expect(location.root.replace(/\\/g, "/")).toContain("agent/skills/library");
	});

	it("keeps the host-visible entry skills separate from the library", () => {
		// 宿主技能列表只认 SKILL.md（resources/skills/discovery.ts:201）。library/ 里没有
		// SKILL.md，所以 75 篇不会挤进斜杠菜单 —— 它们只能通过 strix_load_skills 取。
		const library = join(plugin, "agent/skills/library");
		let skillFiles = 0;
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.name === "SKILL.md") skillFiles += 1;
			}
		};
		walk(library);
		expect(skillFiles).toBe(0);

		// 而入口技能确实存在（9 个）
		const entries = readdirSync(join(plugin, "agent/skills"), { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name !== "library")
			.filter((entry) => statSync(join(plugin, "agent/skills", entry.name, "SKILL.md")).isFile());
		expect(entries.length).toBe(9);
	});

	it("a loaded pack is method and payloads, not code (what the capability actually is)", async () => {
		const { markdown } = await loadBodies(locateSkills(), ["vulnerabilities/idor"]);
		const body = markdown["idor"] ?? "";
		// 正文必须带「怎么判定」的规则，否则它只是背景阅读，不能支撑一个发现。
		expect(body.length).toBeGreaterThan(4000);
		expect(body.toLowerCase()).toMatch(/(false positive|verify|confirm)/);
	});

	it("the catalogue tells the model what exists before it loads anything", async () => {
		const { entries, categories } = await loadIndex(locateSkills());
		expect(entries.length).toBe(75);
		expect(categories.length).toBe(11);
		// 每条目录项都要有描述：只有名字的目录等于让人盲选。
		expect(entries.every((entry) => entry.description.length > 0)).toBe(true);
		// 76 篇真实文件 I/O：并行负载下默认 5s 会偶发超时，给足时间而不是缩小样本。
	}, 20_000);
});

/**
 * 技能库随包这条决定的另两面：解析走打包目录、索引口径正确。
 * 与上面同属"library 是唯一副本"这一个域，所以并在一个文件里。
 */
describe("skills are vendored, not scanned", () => {
	it("resolves to the packaged library without touching python", () => {
		const location = locateSkills();
		expect(location.source).toBe("bundled");
		expect(location.root.replace(/\\/g, "/")).toContain("agent/skills/library");
		// 旧实现会问解释器；现在这个名字不该再出现在源码里。
		const source = readFileSync(join(plugin, "src/service/skills.ts"), "utf8");
		expect(source).not.toContain("pythonCandidates");
		expect(source).not.toContain("import os, strix");
	});

	it("ships the whole upstream library with provenance and licence", () => {
		const root = packagedSkillsRoot();
		expect(existsSync(join(root, "PROVENANCE.md"))).toBe(true);
		expect(existsSync(join(root, "LICENSE"))).toBe(true);
		const categories = readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
		expect(categories.sort()).toEqual([
			"analysis",
			"cloud",
			"coordination",
			"custom",
			"frameworks",
			"protocols",
			"reconnaissance",
			"scan_modes",
			"technologies",
			"tooling",
			"vulnerabilities",
		]);
	});

	it("indexes at least 75 packs and can load a body by name", async () => {
		const { entries, categories } = await loadIndex(locateSkills());
		expect(entries.length).toBeGreaterThanOrEqual(75);
		expect(categories.length).toBe(11);
		// 出处/许可文件不能被当成技能条目
		expect(entries.some((entry) => entry.name === "PROVENANCE")).toBe(false);
		// 76 篇真实文件 I/O：并行负载下默认 5s 会偶发超时，给足时间而不是 уменьшать样本。
	}, 20_000);
});
