#!/usr/bin/env node
/**
 * 把上游的任务路由表 `Tool/scripts/routing.json` 固化成本地数据资产。
 *
 * 上游那份表是「reverse-skill 任务路由的单一事实源」，共 44 条，指向 43 个技能目标。
 * 这些目标绝大多数没有随插件分发（上游便携包自己也缺），所以运行时必须知道
 * 「命中的是哪条路由」以及「这条路由的技能在不在包里」，否则只能凭印象回答。
 *
 * 产物是纯数据 JSON，匹配逻辑在 src/domain/routing-table.ts；这样浏览器包里不需要 fs。
 * `present` 在生成时按 agent/skills 下实际存在的目录算好，运行时不必再读盘。
 *
 * 用法：
 *   node scripts/sync-routing-table.mjs --from <seep-kit 根目录 | routing.json>
 *   node scripts/sync-routing-table.mjs --check      校验数据文件没被手改
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/domain/routing-table.generated.json");
const skillsDir = join(root, "agent/skills");

/**
 * 上游技能名与包内目录名不一致的情况。只登记确有对应物的，其余一律算缺失：
 * 把「名字像」当「已经有了」，正是这份表最容易骗人的地方。
 */
const TARGET_ALIASES = {
	"js-reverse": "mcp-js-reverse-playbook",
};

function argValue(name) {
	const index = process.argv.indexOf(name);
	return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function locateRouting(from) {
	if (!from) return null;
	const direct = resolve(from);
	if (existsSync(direct) && statSync(direct).isFile()) return direct;
	const nested = join(direct, "Tool/scripts/routing.json");
	return existsSync(nested) ? nested : null;
}

/** 上游 skill 写成 `apk-reverse/SKILL.md`；技能目标就是去掉 SKILL.md 的那一段路径。 */
function targetOf(skill) {
	return String(skill ?? "")
		.replace(/\/?SKILL\.md$/i, "")
		.split("/")
		.map(part => part.trim())
		.filter(part => part !== "")
		.join("/");
}

function walkDirs(dir, base = dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (!statSync(full).isDirectory()) continue;
		out.push(relative(base, full).split(sep).join("/"));
		out.push(...walkDirs(full, base));
	}
	return out;
}

function presentTargets() {
	const dirs = walkDirs(skillsDir);
	const byName = new Set();
	for (const dir of dirs) {
		byName.add(dir);
		const parts = dir.split("/");
		byName.add(parts[parts.length - 1]);
	}
	return byName;
}

function normalize(source) {
	const routes = source?.routes;
	if (!routes || typeof routes !== "object") throw new Error("routing.json 缺少 routes 对象");
	const present = presentTargets();
	const rows = [];
	for (const [id, route] of Object.entries(routes)) {
		const skill = String(route.skill ?? "");
		const target = targetOf(skill);
		const alias = TARGET_ALIASES[target];
		const keywords = (route.keywords ?? [])
			.map(keyword => (typeof keyword === "string" ? keyword : (keyword?.must ?? "")))
			.filter(pattern => pattern !== "");
		rows.push({
			id,
			label: String(route.label ?? id),
			skill,
			target,
			present: present.has(target) || (alias !== undefined && present.has(alias)),
			keywords,
		});
	}
	// id 是 R0…R45 的序号，按数字排一次；缺号或异常 id 也不会乱序。
	rows.sort((left, right) => {
		const leftNo = Number(left.id.replace(/\D+/g, ""));
		const rightNo = Number(right.id.replace(/\D+/g, ""));
		if (Number.isFinite(leftNo) && Number.isFinite(rightNo) && leftNo !== rightNo) return leftNo - rightNo;
		return left.id.localeCompare(right.id);
	});
	return { routes: rows, fallbackId: String(source?.meta?.fallbackId ?? "R0") };
}

function digest(routes) {
	return createHash("sha256").update(JSON.stringify(routes)).digest("hex");
}

function main() {
	const check = process.argv.includes("--check");

	if (check) {
		if (!existsSync(outPath)) {
			console.error(`缺少生成文件：${outPath}，请用 --from 生成`);
			process.exit(1);
		}
		const data = JSON.parse(readFileSync(outPath, "utf8"));
		const actual = digest(data.routes);
		if (actual !== data.sourceSha256) {
			console.error("路由数据与记录摘要不一致：文件被手改过，请重新 --from 生成");
			process.exit(1);
		}
		const present = data.routes.filter(row => row.present).length;
		console.log(`routing-table: ${data.routes.length} routes, ${present} present, sha256 ${actual.slice(0, 12)}…`);
		return;
	}

	const source = locateRouting(argValue("--from"));
	if (!source) {
		console.error("找不到 routing.json：请用 --from 指向 seep-kit 根目录或其 Tool/scripts/routing.json");
		process.exit(1);
	}
	const { routes, fallbackId } = normalize(JSON.parse(readFileSync(source, "utf8")));
	const payload = { schemaVersion: 1, fallbackId, sourceSha256: digest(routes), routes };
	writeFileSync(outPath, `${JSON.stringify(payload, null, "\t")}\n`, "utf8");
	const present = routes.filter(row => row.present).length;
	const targets = new Set(routes.map(row => row.target)).size;
	console.log(`routing-table: ${routes.length} routes → ${targets} targets, ${present} present → ${relative(root, outPath)}`);
}

main();
