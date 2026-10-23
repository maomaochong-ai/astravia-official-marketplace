import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));
const libraryRoot = join(pluginRoot, "agent/skills");
const manifestPath = join(pluginRoot, "agent/docs/skill-library.sha256");

/**
 * 上游 seep-kit 1.6.0 的 Tool/skill 树，加上 7 个跨平台 .sh 兄弟脚本。
 * 数字一变就说明有人改过上游文档或增删了 .sh。
 */
const EXPECTED_FILES = 171;
const EXPECTED_BYTES = 2481035;
/** `shasum -a 256 agent/docs/skill-library.sha256` */
const EXPECTED_MANIFEST_SHA256 = "a0b03be3040fdd72fc1f05e55f7ad409f3a9787c1a1590ca0e944a9a262e6560";

/** 上游 seep-kit 原样搬运的八个技能目录（旧版 ida-reverse 已被 safe-skills 版本取代）。 */
const LIBRARY_SKILLS = [
	"apkseep",
	"apk-reverse",
	"client-license-validation-bypass",
	"ida-reverse",
	"mcp-js-reverse-playbook",
	"radare2",
	"reverse-engineering",
	"softseep",
];

/** 宿主要能加载到的全部技能目录，含本插件自己写的主技能。 */
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
