/**
 * Set one release version across the files that carry it, without reformatting.
 *
 * `scripts/marketplace.mjs bump` rewrites five JSON files with its own
 * indentation, which turns a version bump into a thousands-line diff on a
 * plugin whose files are tab-indented. This rewrites only the version values so
 * the review shows one line per file.
 *
 * Usage: node scripts/bump-version.mjs 0.1.1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
	console.error("usage: node scripts/bump-version.mjs <x.y.z>");
	process.exit(1);
}

const targets = [
	"plugin.json",
	"ability.json",
	"package.json",
	"package-lock.json",
].map((file) => join(ROOT, file));

for (const file of targets) {
	const before = readFileSync(file, "utf8");
	const matches = before.match(/"version":(\s*)"[^"]+"/g) ?? [];
	if (!matches.length) {
		console.error(`no version field in ${file}`);
		process.exit(1);
	}
	const after = before.replace(/"version":(\s*)"[^"]+"/g, `"version":$1"${next}"`);
	if (after !== before) writeFileSync(file, after);
	console.log(`${file.split(/[\\/]/).at(-1)}: ${matches.length} field(s) -> ${next}`);
}

// The marketplace catalog entry is the fifth carrier, but it belongs to the
// repository rather than the package, so it is edited by its slug.
const catalogPath = join(ROOT, "../../../.astravia/marketplace.source.json");
const catalog = readFileSync(catalogPath, "utf8");
const entry = /("slug":\s*"strix",[\s\S]*?"version":\s*)"[^"]+"/;
if (!entry.test(catalog)) {
	console.error("strix entry not found in .astravia/marketplace.source.json");
	process.exit(1);
}
writeFileSync(catalogPath, catalog.replace(entry, `$1"${next}"`));
console.log(".astravia/marketplace.source.json: strix ->", next);
