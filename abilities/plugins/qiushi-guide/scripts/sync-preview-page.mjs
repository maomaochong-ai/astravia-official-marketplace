#!/usr/bin/env node
/**
 * Refreshes `src/assets/preview-page.html` from the skill package.
 *
 * The illustrated page belongs to the skill; this plugin only renders it. Copying
 * at authoring time (instead of reading it at runtime) is what lets the view work
 * without knowing where the skill was installed. Run this after changing the
 * skill's page — `tests/qiushi-guide.test.mjs` fails while the two differ.
 */
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(pluginRoot, "../../skills/qiushi-skill/assets/preview/index.html");
const target = join(pluginRoot, "src/assets/preview-page.html");

if (!statSync(source, { throwIfNoEntry: false })) {
	console.error(`skill preview page not found: ${source}`);
	process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`synced ${target} from ${source} (${readFileSync(target).byteLength} bytes)`);
