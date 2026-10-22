import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));
const libraryRoot = join(pluginRoot, "agent/docs/skill-library");
const manifestPath = join(pluginRoot, "agent/docs/skill-library.sha256");

/** 上游 seep-kit 1.6.0 的 Tool/skill 树，逐字节打包；数字一变就说明有人改过上游文档。 */
const EXPECTED_FILES = 165;
const EXPECTED_BYTES = 2450341;
/** `shasum -a 256 agent/docs/skill-library.sha256` */
const EXPECTED_MANIFEST_SHA256 = "9527d6b7a46af565911c4d861ca93154b3a6c30509891b813da1f936fefaaff9";

const TIER_ONE = [
	"softseep",
	"apkseep",
	"ida-reverse",
	"client-license-validation-bypass",
	"safe-skills/apk-reverse",
	"safe-skills/ida-reverse",
	"safe-skills/mcp-js-reverse-playbook",
	"safe-skills/radare2",
	"safe-skills/reverse-engineering",
];

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
		const files = walk(libraryRoot).sort();
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
		for (const skill of TIER_ONE) {
			const entry = join(libraryRoot, skill, "SKILL.md");
			expect(statSync(entry).isFile()).toBe(true);
			const raw = readFileSync(entry, "utf8");
			expect(raw.startsWith("---")).toBe(true);
			expect(raw).toContain("name:");
			expect(raw).toContain("description:");
		}
	});
});
