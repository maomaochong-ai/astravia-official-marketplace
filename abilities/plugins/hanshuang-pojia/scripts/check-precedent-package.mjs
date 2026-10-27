#!/usr/bin/env node
/**
 * 单包校验器：整棵 cases/ 还没写完时，作者只校验自己那一个目录。
 *
 * 用法：
 *   node scripts/check-precedent-package.mjs cases/<slug>
 *   node scripts/check-precedent-package.mjs <slug>
 *   node scripts/check-precedent-package.mjs --all
 *   node scripts/check-precedent-package.mjs --all --no-tools   # 跳过工具自检
 *
 * 默认会真的执行每个工具的 --self-test：脚本能跑是唯一硬证据，
 * 只检查文件存在等于把「能跑」降级成「看起来能跑」。
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPackage, checkSharedKit, precedentDirs, readToolManifest } from "./lib/precedent-package.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = join(root, "cases");
const docsDir = join(root, "src/content/docs");

const args = process.argv.slice(2).filter(arg => !arg.startsWith("-"));
const all = process.argv.includes("--all");
const runTools = !process.argv.includes("--no-tools");

let dirs;
if (all) dirs = precedentDirs(casesDir);
else if (args.length === 0) {
	console.error("usage: node scripts/check-precedent-package.mjs <slug|cases/slug> [--all] [--no-tools]");
	process.exit(2);
} else dirs = args.map(arg => arg.replace(/^cases\//, "").replace(/\/$/, ""));

let failed = 0;

// 共享原语目录不是先例包，但工具全部依赖它，所以单独校验一次。
const sharedProblems = checkSharedKit(casesDir);
if (sharedProblems.length > 0) {
	failed += 1;
	console.error("✗ cases/_shared");
	for (const line of sharedProblems) console.error(`  - ${line}`);
} else {
	console.log("✓ cases/_shared");
}

for (const dir of dirs) {
	const { meta, problems } = checkPackage({ casesDir, docsDir, dir, runTools });
	if (problems.length > 0) {
		failed += 1;
		console.error(`✗ cases/${dir}`);
		for (const line of problems) console.error(`  - ${line}`);
	} else {
		const extra = meta.docs.length - 4;
		const deep = (meta.caseDocs ?? []).length;
		const toolCount = readToolManifest(join(casesDir, dir)).tools.length;
		console.log(
			`✓ cases/${dir}  docs=${meta.docs.length}${extra > 0 ? ` (+${extra})` : ""}  caseDocs=${deep}  tools=${toolCount}`,
		);
	}
}

if (failed === 0) {
	console.log(`\n${dirs.length} packages checked${runTools ? " with tool self tests" : " (tools skipped)"}`);
}

process.exit(failed === 0 ? 0 : 1);
