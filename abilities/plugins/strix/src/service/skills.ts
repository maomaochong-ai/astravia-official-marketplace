/**
 * 技能库：一份随包的技术知识，运行时不再探测上游 Python 包。
 *
 * 用户的要求（ADR 0012）：技能要**完整**参考上游实现到插件里供宿主使用，但不能去扫上游——
 * 插件是参考上游自研的，对另一套 Python 安装的依赖会让"插件能不能用"取决于别人装没装好。
 *
 * 所以 0.9.1 起只有一条路：
 *
 *   agent/skills/library/            ← 上游 11 类 76 篇的逐字副本（tools/vendor-skills.cjs 同步）
 *   agent/skills/strix/tooling/      ← 13 份工具手册（本插件自己的写法）
 *
 * 曾经的 `locateSkills()` 会去问每个 python 解释器「strix 包装在哪」，然后把上游的 skills 目录
 * 当根——那是**运行时耦合**：升级上游、切换 venv、CI 没有 Python，都会改变插件的行为。删掉了。
 *
 * 保留一个逃生口：`STRIX_SKILLS_DIR`。它不是"扫上游"，而是让运维在打包漏了随包副本时
 * 能指向任意目录（排查用），并且日志/工具结果里会照实说明"根来自环境变量"。
 */

import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 类别在面板/工具结果里默认收起：它们是 agent 内部流程，不是给用户挑的技术面。 */
const INTERNAL_CATEGORIES = new Set(["scan_modes", "coordination", "analysis"]);

export interface SkillEntry {
	name: string;
	category: string;
	description: string;
	internal: boolean;
	path: string;
}

export interface SkillLocation {
	root: string;
	/** `bundled` = 随包副本；`env` = 运维用 STRIX_SKILLS_DIR 指过去（排查用）。 */
	source: "bundled" | "env";
}

/**
 * 技能库的根。
 *
 * `main.ts` 打包成 `dist/service/main.mjs`，所以 package 根在上两层；库放在 `agent/skills/library`。
 * 必须留在 `agent/` 下而不是顶层 `assets/`：打包器只带 `dist/` 与声明的代码目录，
 * 别处的东西进不了安装包。
 */
export function packagedSkillsRoot(): string {
	// 运行期是 `file:`（打包后的 dist/service/main.mjs）；测试运行器里 import.meta.url 不一定是
	// file 协议，此时退回「从工作目录找」——测试的工作目录就是插件根。
	// 运行期 import.meta.url 是 file: 协议；测试运行器可能给的是别的 scheme，
	// 此时 fileURLToPath 会抛 "The URL must be of scheme file"，所以用 try/catch 兜住，
	// 退回「从工作目录找」（测试的工作目录就是插件根）。
	try {
		return fileURLToPath(new URL("../../agent/skills/library/", import.meta.url));
	} catch {
		return resolve(process.cwd(), "agent/skills/library");
	}
}

/** 库根 + 来源。没有探测，没有回退链——一个根，来源可解释。 */
export function locateSkills(): SkillLocation {
	const override = process.env.STRIX_SKILLS_DIR;
	if (override) return { root: override, source: "env" };
	return { root: packagedSkillsRoot(), source: "bundled" };
}

/** Parse YAML-ish frontmatter: the subset skill files use (flat scalars). */
export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (!match) return { meta: {}, body: text.trim() };
	const meta: Record<string, string> = {};
	for (const line of (match[1] ?? "").split(/\r?\n/)) {
		const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!pair) continue;
		const [, key, raw] = pair;
		if (!key) continue;
		meta[key] = (raw ?? "").replace(/^["']|["']$/g, "").trim();
	}
	return { meta, body: text.slice(match[0].length).trim() };
}

/** Every `*.md` under the skill root, grouped the way upstream groups them. */
export async function loadIndex(location: SkillLocation): Promise<{ entries: SkillEntry[]; categories: string[] }> {
	const entries: SkillEntry[] = [];
	let top: string[] = [];
	try {
		top = await readdir(location.root, { withFileTypes: true }).then((items) =>
			items.map((item) => `${item.isDirectory() ? "d:" : "f:"}${item.name}`),
		);
	} catch {
		return { entries, categories: [] };
	}

	const categories = new Set<string>();
	for (const item of top) {
		const isDir = item.startsWith("d:");
		const name = item.slice(2);
		if (name.startsWith("__") || name === "README.md") continue;
		// 副本目录里的出处/许可文件不是技能。
		if (name === "PROVENANCE.md" || name === "LICENSE") continue;
		if (!isDir) {
			if (extname(name) !== ".md") continue;
			const path = join(location.root, name);
			entries.push(await describe(path, "root", basename(name, ".md")));
			categories.add("root");
			continue;
		}
		categories.add(name);
		const files = await readdir(join(location.root, name)).catch(() => []);
		for (const file of files) {
			if (extname(file) !== ".md") continue;
			const path = join(location.root, name, file);
			entries.push(await describe(path, name, basename(file, ".md")));
		}
	}
	return { entries, categories: [...categories].sort() };
}

async function describe(path: string, category: string, fallbackName: string): Promise<SkillEntry> {
	let description = "";
	let name = fallbackName;
	try {
		const text = await readFile(path, "utf8");
		const { meta } = parseFrontmatter(text);
		name = meta.name || fallbackName;
		description = (meta.description ?? "").replace(/\s+/g, " ").trim();
	} catch {
		/* an unreadable pack simply lists without a description */
	}
	return { name, category, description, internal: INTERNAL_CATEGORIES.has(category), path };
}

/** Bodies for the requested names; `category/name` disambiguates. */
export async function loadBodies(
	location: SkillLocation,
	names: string[],
): Promise<{ markdown: Record<string, string>; missing: string[] }> {
	const { entries } = await loadIndex(location);
	const markdown: Record<string, string> = {};
	const missing: string[] = [];
	for (const requested of names) {
		const [maybeCategory, maybeName] = requested.includes("/")
			? (requested.split("/", 2) as [string, string])
			: [undefined, requested];
		const hit = entries.find(
			(entry) =>
				(maybeCategory ? entry.category === maybeCategory : true) &&
				(entry.name === maybeName || basename(entry.path, ".md") === maybeName),
		);
		if (!hit) {
			missing.push(requested);
			continue;
		}
		try {
			const text = await readFile(hit.path, "utf8");
			markdown[hit.name] = parseFrontmatter(text).body;
		} catch {
			missing.push(requested);
		}
	}
	return { markdown, missing };
}
