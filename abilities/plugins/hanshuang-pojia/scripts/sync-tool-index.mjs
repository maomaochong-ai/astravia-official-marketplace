#!/usr/bin/env node
/**
 * 生成本插件的工具索引 `src/content/docs/kit-docs/tool-index.json`。
 *
 * 2.0 便携版在部署后跑 `refresh-tool-index.ps1`，把磁盘实况（找到没有、解析到哪个路径、
 * 什么版本）写成 `Tool/docs/tool-index.json`。那份快照会随环境漂移，交付到别的机器上
 * 之后 `available` / `resolved_path` 全是假的。
 *
 * 这里不复制那份快照，而是把「编译期真相」写下来：谁是本插件探测的可执行文件、谁是
 * 只出现在安装计划里的建议项、谁被明确判定为不做以及为什么。有没有装、装的是哪个版本，
 * 由运行时的 `probe_environment` 回答，永远不在这份文件里猜测。
 *
 * 42 项总数与 `docs/toolchain-parity.md` 一一对应；测试 `src/test/tool-index.test.ts`
 * 会同时校验 json 与 catalog / parity 文档三者一致，改了一处忘了另一处会失败。
 *
 * 用法（catalog.ts 是纯数据文件，可以用 Node 的类型剥离直接加载）：
 *   node --experimental-strip-types scripts/sync-tool-index.mjs
 *   node --experimental-strip-types scripts/sync-tool-index.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/content/docs/kit-docs/tool-index.json");

const { TOOLCHAIN, COMPANIONS } = await import(join(root, "src/domain/toolchain/catalog.ts"));

/**
 * 2.0 索引里有、本插件明确不做的 17 项。
 * `group` / `skill` 沿用 2.0 的名字，便于两边对照；`reason` 是下一次重新讨论时唯一的入口。
 */
const UNSUPPORTED = [
	{ name: "idalib-mcp", group: "ida-reverse", skill: "ida-reverse", reason: "MCP server registered by the client, not an executable file" },
	{ name: "ida-pro-mcp", group: "ida-reverse", skill: "ida-reverse", reason: "MCP server registered by the client, not an executable file" },
	{ name: "r2mcp", group: "radare2", skill: "apk-reverse", reason: "MCP server; the plugin calls r2 directly instead" },
	{ name: "r2xsql", group: "radare2", skill: "native-reverse", reason: "r2 plugin installed through r2pm — a second permission surface" },
	{ name: "r2xsql-full", group: "radare2", skill: "native-reverse", reason: "same r2 plugin, full build" },
	{ name: "radius2", group: "radare2", skill: "native-reverse", reason: "symbolic execution; same r2pm surface" },
	{ name: "r2pm", group: "radare2", skill: "native-reverse", reason: "package manager: the plugin plans installs, it never runs them (ADR 0003 §2)" },
	{ name: "jshookmcp", group: "js-reverse", skill: "js-reverse", reason: "MCP server" },
	{ name: "reqable-mcp", group: "pentest-tools", skill: "js-reverse", reason: "MCP server" },
	{ name: "xquik-mcp", group: "threat-intelligence", skill: "threat-intelligence", reason: "remote MCP server with OAuth" },
	{ name: "pentestswarm", group: "pentest-tools", skill: "pentest-tools", reason: "MCP server" },
	{ name: "agent-browser", group: "browser-automation", skill: "js-reverse", reason: "browser automation, outside binary auditing" },
	{ name: "playwright", group: "browser-automation", skill: "js-reverse", reason: "browser automation, outside binary auditing" },
	{ name: "proxycat", group: "pentest-tools", skill: "pentest-tools", reason: "proxy pool, not needed for local auditing" },
	{ name: "seclists", group: "pentest-tools", skill: "pentest-tools", reason: "wordlists belong to a pentest engagement, not file auditing" },
	{ name: "bkcrack", group: "reverse-engineering", skill: "reverse-engineering", reason: "known-plaintext attack, specialised; the user supplies it when needed" },
	{ name: "npx", group: "js-reverse", skill: "js-reverse", reason: "2.0 uses npx to launch MCP servers; this plugin runs none" },
];

/** 2.0 索引里的分组名，按出现顺序排列，仅用于稳定输出。 */
const GROUP_ORDER = [
	"radare2",
	"apk-reverse",
	"ida-reverse",
	"binary-ninja-reverse",
	"reverse-engineering",
	"js-reverse",
	"firmware-pentest",
	"malware-analysis",
	"pentest-tools",
	"threat-intelligence",
	"browser-automation",
];

/** 探测项与建议项的 2.0 分组归属。字段来自 catalog，只有分组需要在这里补。 */
const GROUP_OF = {
	r2: "radare2",
	rabin2: "radare2",
	radiff2: "radare2",
	rasm2: "radare2",
	rahash2: "radare2",
	rax2: "radare2",
	jadx: "apk-reverse",
	apktool: "apk-reverse",
	java: "apk-reverse",
	adb: "apk-reverse",
	apksigner: "apk-reverse",
	zipalign: "apk-reverse",
	frida: "apk-reverse",
	"frida-ps": "apk-reverse",
	python3: "reverse-engineering",
	node: "js-reverse",
	binwalk: "firmware-pentest",
	yara: "malware-analysis",
	nmap: "pentest-tools",
	ida: "ida-reverse",
	binaryninja: "binary-ninja-reverse",
	"jeb-pro": "apk-reverse",
	analyzeHeadless: "reverse-engineering",
	pip: "reverse-engineering",
	pwntools: "reverse-engineering",
};

function groupsOf(name, fallback) {
	const group = GROUP_OF[name];
	if (!group) {
		throw new Error(`scripts/sync-tool-index.mjs: no 2.0 group for "${name}" — add it to GROUP_OF`);
	}
	return group;
}

function probedEntries() {
	return TOOLCHAIN.map(tool => ({
		name: tool.binary,
		kind: "probed",
		group: groupsOf(tool.binary),
		skill: "hanshuang-pojia",
		purpose: tool.purpose,
		tool_id: tool.id,
		provides: [...tool.provides],
		goals: [...tool.goals],
		version_args: [...tool.versionArgs],
		recipe: tool.recipe ? { ...tool.recipe } : null,
		/** 探测项必须有 recipe 或明确「随另一个包装」；install 是给人看的一行。 */
		install: tool.install,
	}));
}

function advisoryEntries() {
	return COMPANIONS.map(companion => ({
		name: companion.name,
		kind: "advisory",
		group: groupsOf(companion.name),
		skill: "hanshuang-pojia",
		purpose: companion.purpose,
		commercial: companion.commercial === true,
		goals: [...companion.goals],
		recipe: companion.recipe ? { ...companion.recipe } : null,
		install: companion.install,
	}));
}

function unsupportedEntries() {
	return UNSUPPORTED.map(entry => ({
		name: entry.name,
		kind: "unsupported",
		group: entry.group,
		skill: entry.skill,
		reason: entry.reason,
	}));
}

function build() {
	const tools = [...probedEntries(), ...advisoryEntries(), ...unsupportedEntries()];
	const byGroup = new Map(GROUP_ORDER.map(group => [group, 0]));
	for (const tool of tools) byGroup.set(tool.group, (byGroup.get(tool.group) ?? 0) + 1);
	return {
		purpose: "Tool index: which of the 42 upstream tools this plugin probes, recommends, or declines, and why",
		generated_by: "scripts/sync-tool-index.mjs",
		source: "src/domain/toolchain/catalog.ts",
		upstream: {
			artifact: "hanshuang-pojia-2.0 · seep-kit/Tool/docs/tool-index.json",
			schema: "Tool/docs/refresh-tool-index.ps1",
			total: 42,
		},
		/**
		 * 语义与 2.0 的 `available` / `resolved_path` 不同：这里一律不猜。
		 * 有没有装、哪个版本，问 `probe_environment`；怎么装，问 `install_toolchain`。
		 */
		availability: "runtime — call probe_environment; this file never claims a tool is installed",
		counts: {
			total: tools.length,
			probed: TOOLCHAIN.length,
			advisory: COMPANIONS.length,
			unsupported: UNSUPPORTED.length,
		},
		groups: GROUP_ORDER.filter(group => (byGroup.get(group) ?? 0) > 0).map(group => ({
			id: group,
			count: byGroup.get(group) ?? 0,
		})),
		tools,
	};
}

const next = `${JSON.stringify(build(), null, "\t")}\n`;

if (process.argv.includes("--check")) {
	const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
	if (current !== next) {
		console.error("tool index is stale — run node --experimental-strip-types scripts/sync-tool-index.mjs");
		process.exit(1);
	}
	console.log(`tool index ok: ${JSON.parse(current).counts.total} entries`);
	process.exit(0);
}

writeFileSync(outPath, next);
const built = JSON.parse(next);
console.log(
	`wrote ${built.counts.total} entries (probed=${built.counts.probed} advisory=${built.counts.advisory} unsupported=${built.counts.unsupported})`,
);
