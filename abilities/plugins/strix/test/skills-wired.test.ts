import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 技能库「真的被使用」的静态证据（1.5.0）。
 *
 * 用户的问题是"技能库是否真的被使用"。回答它需要三件事同时成立，缺一件就是摆设：
 *
 *  1. **随包存在**：`agent/skills/library/` 里真有那些文件（不是运行时去扫上游）；
 *  2. **工具描述说对数字**：模型看到的 `strix_list_skills` 写的是 11 类 75 篇，
 *     与磁盘一致——数字错了，模型会以为库更大或更小；
 *  3. **取用路径存在**：`strix_load_skills` 能按名字取到正文，且 miss 时给建议。
 *
 * 这里只钉 1 与 2（3 在 skills-loading.test.ts 里跑真实调用）。
 */

const plugin = resolve(process.cwd());
const library = join(plugin, "agent/skills/library");
const tools = readFileSync(join(plugin, "src/agent/strix-tools.ts"), "utf8");

const categories = readdirSync(library, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);
const packs = categories.reduce((total, category) => {
	try {
		return total + readdirSync(join(library, category)).filter((name) => name.endsWith(".md")).length;
	} catch {
		return total;
	}
}, 0);

describe("the shipped library and what the model is told agree", () => {
	it("counts 11 categories of packs, exactly as the tool description says", () => {
		expect(categories.length).toBe(11);
		expect(packs).toBe(75);
		expect(tools).toContain("11 categories, 75 packs");
	});

	it("ships a licence and provenance next to the copies", () => {
		expect(readdirSync(library)).toContain("LICENSE");
		expect(readdirSync(library)).toContain("PROVENANCE.md");
	});

	it("keeps the entry skills outside the library, so the host slash menu stays short", () => {
		// library 里没有 SKILL.md：宿主的技能发现只认这个文件名（resources/skills/discovery.ts）。
		const skillManifests = categories.reduce((total, category) => {
			try {
				return total + readdirSync(join(library, category)).filter((name) => name === "SKILL.md").length;
			} catch {
				return total;
			}
		}, 0);
		expect(skillManifests).toBe(0);
		// 入口技能在 agent/skills/<name>/SKILL.md，数量与 plugin.json 的 skillPaths 一致。
		const entries = readdirSync(join(plugin, "agent/skills"), { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name !== "library")
			.map((entry) => entry.name);
		expect(entries.length).toBeGreaterThanOrEqual(9);
		for (const entry of entries) {
			expect(readdirSync(join(plugin, "agent/skills", entry))).toContain("SKILL.md");
		}
	});

	it("tells the model that a miss comes with suggestions", () => {
		expect(tools).toContain("suggestions");
	});
});
