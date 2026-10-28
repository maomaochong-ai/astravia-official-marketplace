import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../../../", import.meta.url));
const libraryRoot = join(pluginRoot, "agent/skills");
const manifestPath = join(pluginRoot, "agent/prompts/skill-library.sha256");

/**
 * 上游 seep-kit 1.6.0 的 Tool/skill 树，加上 7 个跨平台 .sh 兄弟脚本。
 * 数字一变就说明有人改过上游文档或增删了 .sh。
 */
const EXPECTED_FILES = 171;
const EXPECTED_BYTES = 2480612;
/** `shasum -a 256 agent/prompts/skill-library.sha256` */
const EXPECTED_MANIFEST_SHA256 = "7377480c0f202cf038c0014d58065946b81c7d0a3287c4df36c4609dd2d184d7";

/**
 * 上游 `Tool/skill` 的两层归类：根层是作战台技能（含本插件自己的主技能），
 * `safe-skills/` 下是通用逆向战术包。旧版 ida-reverse 已被 safe-skills 版本取代。
 */
const LIBRARY_SKILLS = [
	"apkseep",
	"client-license-validation-bypass",
	"safe-skills/apk-reverse",
	"safe-skills/ida-reverse",
	"safe-skills/mcp-js-reverse-playbook",
	"safe-skills/radare2",
	"safe-skills/reverse-engineering",
	"softseep",
];

/** 宿主要能加载到的全部技能目录（宿主对 skillPaths 递归扫描），含本插件自己写的主技能。 */
const ALL_SKILLS = ["hanshuang-pojia", ...LIBRARY_SKILLS];

function walk(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) found.push(...walk(full));
		else if (entry.isFile()) found.push(full);
	}
	return found;
}

describe("bundled skill library", () => {
	it("ships the whole upstream tree and matches its integrity manifest", () => {
		const files = LIBRARY_SKILLS.flatMap((name) => walk(join(libraryRoot, name))).sort();
		expect(files.length).toBe(EXPECTED_FILES);

		let bytes = 0;
		const lines: string[] = [];
		for (const file of files) {
			const buffer = readFileSync(file);
			bytes += buffer.byteLength;
			const path = relative(libraryRoot, file).split(sep).join("/");
			lines.push(`${createHash("sha256").update(buffer).digest("hex")}  ${path}`);
		}
		expect(bytes).toBe(EXPECTED_BYTES);

		// 逐行复算必须与提交的清单完全一致：既验证「没被改」，也验证「没少文件」。
		const manifest = readFileSync(manifestPath, "utf8");
		expect(`${lines.join("\n")}\n`).toBe(manifest);
		expect(createHash("sha256").update(manifest).digest("hex")).toBe(EXPECTED_MANIFEST_SHA256);
	});

	it("keeps every skill loadable by path", () => {
		for (const skill of ALL_SKILLS) {
			const entry = join(libraryRoot, skill, "SKILL.md");
			expect(statSync(entry).isFile()).toBe(true);
			const raw = readFileSync(entry, "utf8");
			expect(raw.startsWith("---")).toBe(true);
			expect(raw).toContain("name:");
			expect(raw).toContain("description:");
		}
	});
});
