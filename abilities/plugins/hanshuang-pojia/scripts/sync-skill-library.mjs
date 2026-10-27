#!/usr/bin/env node
/**
 * 重新生成 `agent/prompts/skill-library.sha256`：随包携带的技能库逐文件摘要。
 *
 * 清单此前是手工维护的，改一次目录结构就得手工重算两份东西（清单本身 + 测试里的
 * 清单摘要）。这里把「按路径排序、相对 agent/skills 计算」的规则固定下来，
 * 让 `--check` 能当护栏用：谁在技能库里动了字节，CI 立刻看得见。
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const libraryRoot = join(root, "agent/skills");
const manifestPath = join(root, "agent/prompts/skill-library.sha256");

/**
 * 上游 `Tool/skill` 的两层归类：根层是作战台技能，`safe-skills/` 下是通用逆向战术包。
 * 路径必须与实际目录一致——移动目录时同步改这里。
 */
export const LIBRARY_SKILLS = [
	"apkseep",
	"client-license-validation-bypass",
	"safe-skills/apk-reverse",
	"safe-skills/ida-reverse",
	"safe-skills/mcp-js-reverse-playbook",
	"safe-skills/radare2",
	"safe-skills/reverse-engineering",
	"softseep",
];

function walk(directory) {
	const found = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) found.push(...walk(full));
		else if (entry.isFile()) found.push(full);
	}
	return found;
}

export function buildManifest() {
	const files = LIBRARY_SKILLS.flatMap(name => walk(join(libraryRoot, name))).sort();
	let bytes = 0;
	const lines = [];
	for (const file of files) {
		const buffer = readFileSync(file);
		bytes += buffer.byteLength;
		const path = relative(libraryRoot, file).split(sep).join("/");
		lines.push(`${createHash("sha256").update(buffer).digest("hex")}  ${path}`);
	}
	return { text: `${lines.join("\n")}\n`, files: files.length, bytes };
}

function main() {
	const check = process.argv.includes("--check");
	let current = null;
	try {
		current = readFileSync(manifestPath, "utf8");
	} catch {
		current = null;
	}
	const { text, files, bytes } = buildManifest();
	if (check) {
		if (current !== text) {
			console.error(`skill-library manifest is stale (${files} files, ${bytes} bytes on disk)`);
			process.exit(1);
		}
		console.log(`skill library ok: ${files} files, ${bytes} bytes`);
		return;
	}
	writeFileSync(manifestPath, text);
	console.log(`wrote ${relative(root, manifestPath)} (${files} files, ${bytes} bytes)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
