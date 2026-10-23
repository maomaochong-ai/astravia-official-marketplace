#!/usr/bin/env node
/**
 * 把包内常驻提示词 `agent/prompts/SYSTEM.md` 编译成运行时常量。
 *
 * 为什么要生成而不是运行时读盘：插件的运行时代码活在渲染进程的 bundle 里，
 * 拿不到自己的安装目录（宿主不暴露 InstalledPlugin.path），所以包内文件只能
 * 在**构建期**内联。`agent/` 仍随市场包分发 —— 那是给人读、给审计看的母本。
 *
 * 单一真相是 `agent/prompts/SYSTEM.md`；`--check` 比对生成物与母本，防止两边漂移。
 *
 * 用法：
 *   node scripts/sync-system-prompt.mjs            重新生成
 *   node scripts/sync-system-prompt.mjs --check    仅校验（不一致则非零退出）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "agent/prompts/SYSTEM.md");
const targetPath = join(root, "src/domain/system-prompt.generated.ts");

const BANNER = [
	"// 本文件由 scripts/sync-system-prompt.mjs 从 agent/prompts/SYSTEM.md 生成，不要手改。",
	"// 改提示词请改母本，然后跑 `node scripts/sync-system-prompt.mjs`。",
	"",
].join("\n");

function render() {
	const body = readFileSync(sourcePath, "utf8").replace(/\r\n/gu, "\n").trimEnd();
	// 模板字符串里只需要防反引号、反斜杠和 ${ 三处；正文是英文 md，出现概率极低。
	const escaped = body.replace(/\\/gu, "\\\\").replace(/`/gu, "\\`").replace(/\$\{/gu, "\\${");
	return `${BANNER}export const SYSTEM_PROMPT_BODY = \`${escaped}\`;\n\nexport const SYSTEM_PROMPT_BLOCK_ID = "plugin.hanshuang-pojia.system";\n\n/** 低于核状态块：状态先说，规则随后。 */\nexport const SYSTEM_PROMPT_PRIORITY = 840;\n`;
}

const expected = render();

if (process.argv.includes("--check")) {
	let actual = "";
	try {
		actual = readFileSync(targetPath, "utf8");
	} catch {
		console.error(`missing ${targetPath}`);
		process.exit(1);
	}
	if (actual !== expected) {
		console.error(`${targetPath} is stale — run node scripts/sync-system-prompt.mjs`);
		process.exit(1);
	}
	console.log("system prompt in sync");
} else {
	writeFileSync(targetPath, expected, "utf8");
	console.log(`wrote ${targetPath} (${expected.length} bytes)`);
}
