#!/usr/bin/env node
/**
 * 真跑一遍路由：lab 开、lab 关两种状态，各自产出 kernel 块，检查是否路由到核心技能 memory。
 *
 * 为什么是一个可执行脚本而不是一条单测：路由由三样东西共同决定 ——
 *   1. `buildKernelBlock`（每轮注入的文本）；
 *   2. `parseLabCommand`（`lab：` 口令是否把状态切到 ON）；
 *   3. `plugin.json` 的 `skillPaths` + 磁盘上的技能目录（宿主要能扫到 memory）。
 * 任何一样断了，界面上的表现都是「插件在，但模型没按手册办事」。单测各测一段，
 * 这里把它们串起来在真文件上跑一次，看到的就是宿主会看到的那份结果。
 *
 * 用法（Node 22.6+，需要 TS 剥离）：
 *   node --experimental-strip-types scripts/verify-routing.mjs
 *   node --experimental-strip-types scripts/verify-routing.mjs --package release/hanshuang-pojia-2.17.5.astraviapkg
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgFlag = process.argv.indexOf("--package");
const target = pkgFlag > -1 ? resolve(process.argv[pkgFlag + 1]) : root;

const { buildKernelBlock } = await import(pathToFileURL(join(root, "src/domain/kernel.ts")).href);
const { LAB_OFF, labAfter, parseLabCommand } = await import(pathToFileURL(join(root, "src/domain/lab-mode.ts")).href);

const manifest = JSON.parse(readFileSync(join(target, "plugin.json"), "utf8"));
const presentation = manifest.agent?.skillPresentation ?? {};
const skillPaths = manifest.agent?.skillPaths ?? [];

/** 宿主对 skillPaths 递归扫描 `**\/SKILL.md`；这里按同样的规则列举，并读 front matter 的名字。 */
function scanSkills(base) {
	const found = [];
	const walk = dir => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name === "SKILL.md") {
				const text = readFileSync(full, "utf8");
				const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "(unnamed)";
				const description = /^description:\s*"?(.*?)"?\s*$/m.exec(text)?.[1] ?? "";
				found.push({ name, description, dir: full.slice(base.length + 1).replace(/\\/g, "/") });
			}
		}
	};
	for (const prefix of skillPaths) {
		const dir = join(target, prefix);
		if (existsSync(dir)) walk(dir);
	}
	return found;
}

const skills = scanSkills(target);
const byName = new Map(skills.map(skill => [skill.name, skill]));
const memory = byName.get("memory");

const picker = Object.entries(presentation.skills ?? {})
	.filter(([, value]) => value?.surfaces?.skillPicker === "visible")
	.map(([name]) => name);
const catalog = Object.entries(presentation.skills ?? {})
	.filter(([, value]) => value?.surfaces?.abilityCatalog === "visible")
	.map(([name]) => name);

const off = buildKernelBlock({ lab: LAB_OFF, page: null, tools: [] });
const parsed = parseLabCommand("lab：");
const labOn = labAfter(LAB_OFF, parsed, "2026-11-20T00:00:00.000Z");
const on = buildKernelBlock({ lab: labOn, page: "docs", tools: [] });
// 再说一句「退出实验」：口令能把状态关掉，路由不能跟着消失。
const labOffAgain = labAfter(labOn, parseLabCommand("退出实验"), "2026-11-21T00:00:00.000Z");
const offAgain = buildKernelBlock({ lab: labOffAgain, page: null, tools: [] });

const routeOf = text => /agent\/skills\/([a-z0-9-]+)\/SKILL\.md/.exec(text)?.[1] ?? null;

const rows = [
	["target", target],
	["skillPaths", skillPaths.join(", ")],
	["技能目录里扫到", skills.map(skill => skill.name).join(", ")],
	["memory 在磁盘上", memory ? `yes (${memory.dir})` : "NO"],
	["memory front matter", memory ? memory.name : "(missing)"],
	["技能选择器可见", picker.join(", ") || "(none)"],
	["能力目录可见数", String(catalog.length)],
	["`lab：` 解析结果", parsed.action === "enter" ? `enter → enabled=${labOn.enabled}` : JSON.stringify(parsed)],
	["非 lab 块行数", String(off.split("\n").length)],
	["非 lab 路由", routeOf(off) ?? "(none)"],
	["lab 块行数", String(on.split("\n").length)],
	["lab 路由", routeOf(on) ?? "(none)"],
	["lab 块含交付形状", on.includes("Patch table") ? "yes" : "no"],
	["非 lab 块含交付形状", off.includes("Patch table") ? "YES (不该有)" : "no"],
	["退出实验后 enabled", String(labOffAgain.enabled)],
	["退出实验后仍路由", routeOf(offAgain) ?? "(none)"],
];

const width = Math.max(...rows.map(([key]) => key.length));
for (const [key, value] of rows) console.log(`${key.padEnd(width)}  ${value}`);

console.log("\n--- 非 lab（LAB_OFF）kernel 块全文 ---");
console.log(off);
console.log("\n--- lab 开启（lab：）kernel 块全文 ---");
console.log(on);

const failures = [];
if (!memory) failures.push("磁盘上没有名为 memory 的技能");
if (routeOf(off) !== "memory") failures.push(`非 lab 块未路由到 memory（得到 ${routeOf(off) ?? "无"}）`);
if (routeOf(on) !== "memory") failures.push(`lab 块未路由到 memory（得到 ${routeOf(on) ?? "无"}）`);
if (picker.join(",") !== "memory") failures.push(`技能选择器可见项应为 memory，实际 ${picker.join(",") || "无"}`);
if (labOn.enabled !== true) failures.push("`lab：` 没有把状态切到 ON");
if (labOffAgain.enabled !== false) failures.push("`退出实验` 没有把状态切回 OFF");
if (routeOf(offAgain) !== "memory") failures.push(`退出实验后丢失了 memory 路由（得到 ${routeOf(offAgain) ?? "无"}）`);

if (failures.length > 0) {
	console.error(`\nFAIL: ${failures.length} 项`);
	for (const line of failures) console.error(`  - ${line}`);
	process.exit(1);
}
console.log("\nPASS: 两种状态都路由到 memory，且宿主能扫到这个技能");
