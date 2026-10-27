#!/usr/bin/env node
/**
 * 单包校验器：整棵 cases/ 还没写完时，作者只校验自己那一个目录。
 *
 * 用法：
 *   node scripts/check-precedent-package.mjs cases/<slug>
 *   node scripts/check-precedent-package.mjs <slug>
 *   node scripts/check-precedent-package.mjs --all
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPackage, precedentDirs } from "./lib/precedent-package.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = join(root, "cases");
const docsDir = join(root, "src/content/docs");

const args = process.argv.slice(2).filter(arg => !arg.startsWith("-"));
const all = process.argv.includes("--all");

let dirs;
if (all) dirs = precedentDirs(casesDir);
else if (args.length === 0) {
	console.error("usage: node scripts/check-precedent-package.mjs <slug|cases/slug> [--all]");
	process.exit(2);
} else dirs = args.map(arg => arg.replace(/^cases\//, "").replace(/\/$/, ""));

let failed = 0;
for (const dir of dirs) {
	const { meta, problems } = checkPackage({ casesDir, docsDir, dir });
	if (problems.length > 0) {
		failed += 1;
		console.error(`✗ cases/${dir}`);
		for (const line of problems) console.error(`  - ${line}`);
	} else {
		const extra = meta.docs.length - 4;
		const deep = (meta.caseDocs ?? []).length;
		console.log(`✓ cases/${dir}  docs=${meta.docs.length}${extra > 0 ? ` (+${extra})` : ""}  caseDocs=${deep}`);
	}
}

process.exit(failed === 0 ? 0 : 1);
