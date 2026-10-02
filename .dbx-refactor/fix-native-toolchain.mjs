#!/usr/bin/env node
/**
 * 本机原生包修复（幂等，开发环境专用；不进入 .astraviapkg）。
 *
 * 背景：构建进程是 x64 Node（在 arm64 Mac 上经 Rosetta 运行），而依赖树按 arm64 解析，
 * 于是 rollup / esbuild / @tailwindcss/oxide / lightningcss 的原生二进制不匹配，构建直接失败。
 * 手工补齐的 x64 包会在任何一次 `npm install` / `bun install` 之后丢失（依赖被重新解析）。
 *
 * 做法：在 workspace 各 node_modules 中找出「已存在同族其他平台变体、但缺少当前平台变体」
 * 的目录，从别处版本一致的副本补进去；找不到就跳过并打印原因。
 *
 * 用法：node .dbx-refactor/fix-native-toolchain.mjs [--dry-run]
 */
import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "..");
const OPEN_ASTRAVIA = resolve(WORKSPACE, ".tooling", "open-astravia");
const DRY_RUN = process.argv.includes("--dry-run");

const PLATFORM = process.platform;
const ARCH = process.arch;

/**
 * 按平台拆包的原生依赖族。
 * scopeDir 为 null 表示包直接放在 node_modules 根下（lightningcss）。
 */
const FAMILIES = [
	{ scopeDir: "@rollup", localName: `rollup-${PLATFORM}-${ARCH}`, matchesFamily: (name) => name.startsWith("rollup-") },
	{ scopeDir: "@esbuild", localName: `${PLATFORM}-${ARCH}`, matchesFamily: () => true },
	{ scopeDir: "@tailwindcss", localName: `oxide-${PLATFORM}-${ARCH}`, matchesFamily: (name) => name.startsWith("oxide-") },
	{ scopeDir: null, localName: `lightningcss-${PLATFORM}-${ARCH}`, matchesFamily: (name) => name.startsWith("lightningcss-") },
];

function childDirs(dir) {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
			.map((entry) => join(dir, entry.name));
	} catch {
		return [];
	}
}

function readVersion(packageDir) {
	try {
		return JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).version;
	} catch {
		return null;
	}
}

/** 收集所有 node_modules 根，含 bun 的扁平化目录（.bun/<pkg>@<ver>/node_modules）。 */
function collectNodeModulesRoots() {
	const roots = new Set();
	const add = (dir) => {
		if (existsSync(dir)) roots.add(dir);
	};
	for (const plugin of childDirs(join(WORKSPACE, "abilities", "plugins"))) {
		add(join(plugin, "node_modules"));
	}
	add(join(WORKSPACE, "node_modules"));
	if (existsSync(OPEN_ASTRAVIA)) {
		add(join(OPEN_ASTRAVIA, "node_modules"));
		for (const entry of childDirs(join(OPEN_ASTRAVIA, "node_modules", ".bun"))) {
			add(join(entry, "node_modules"));
		}
		for (const entry of childDirs(join(OPEN_ASTRAVIA, "website", "node_modules"))) {
			add(join(OPEN_ASTRAVIA, "website", "node_modules"));
			break;
		}
	}
	return [...roots];
}

const ROOTS = collectNodeModulesRoots();

/** 某族在某 node_modules 根下的实际目录。 */
function scopePathFor(root, family) {
	return family.scopeDir ? join(root, family.scopeDir) : root;
}

/** 判定该目录是否真的是这一族的 scope 目录（避免把任意目录当目标）。 */
function isScopeDir(root, family) {
	const path = scopePathFor(root, family);
	if (!existsSync(path)) return false;
	if (!family.scopeDir) return true;
	return (path.split("/").pop() ?? "") === family.scopeDir;
}

const targets = [];
for (const root of ROOTS) {
	for (const family of FAMILIES) {
		if (!isScopeDir(root, family)) continue;
		const scopePath = scopePathFor(root, family);
		const entries = childDirs(scopePath).map((dir) => dir.split("/").pop() ?? "");
		if (!entries.some(family.matchesFamily)) continue;
		const wanted = join(scopePath, family.localName);
		if (existsSync(wanted)) continue;
		targets.push({ wanted, family, siblings: entries.filter(family.matchesFamily) });
	}
}

const uniqueTargets = [...new Map(targets.map((target) => [target.wanted, target])).values()];

/** 源：workspace 中已经存在的当前平台副本，按族收集。 */
const sourcesByFamily = new Map();
for (const root of ROOTS) {
	for (const family of FAMILIES) {
		if (!isScopeDir(root, family)) continue;
		const candidate = join(scopePathFor(root, family), family.localName);
		if (!existsSync(candidate)) continue;
		const version = readVersion(candidate);
		if (!version) continue;
		const list = sourcesByFamily.get(family.localName) ?? [];
		list.push({ dir: candidate, version });
		sourcesByFamily.set(family.localName, list);
	}
}

let copied = 0;
let skipped = 0;
for (const target of uniqueTargets) {
	const candidates = sourcesByFamily.get(target.family.localName) ?? [];
	if (candidates.length === 0) {
		console.log(`跳过 ${target.wanted}：workspace 内没有同平台副本`);
		skipped += 1;
		continue;
	}
	const scopePath = dirname(target.wanted);
	const siblingVersions = target.siblings
		.map((name) => readVersion(join(scopePath, name)))
		.filter(Boolean);
	const source =
		candidates.find((candidate) => siblingVersions.includes(candidate.version)) ?? null;
	if (!source) {
		console.log(
			`跳过 ${target.wanted}：副本版本 ${candidates.map((c) => c.version).join("/")} 与同族变体 ${[...new Set(siblingVersions)].join("/")} 不一致`,
		);
		skipped += 1;
		continue;
	}
	if (!DRY_RUN) cpSync(source.dir, target.wanted, { recursive: true });
	console.log(`${DRY_RUN ? "待复制" : "已复制"} ${source.dir} -> ${target.wanted}`);
	copied += 1;
}

console.log(`\n平台 ${PLATFORM}-${ARCH}：扫描 ${ROOTS.length} 个 node_modules 根，补齐 ${copied} 处，跳过 ${skipped} 处。`);
