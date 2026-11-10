/**
 * Set only the two package versions inside package-lock.json.
 *
 * A global `"version"` replacement also rewrites every dependency's version,
 * which quietly breaks `npm ci`. Only the root record and the `""` package
 * entry describe this package.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const next = process.argv[3];
if (!file || !/^\d+\.\d+\.\d+$/.test(next ?? "")) {
	console.error("usage: node set-lock-version.mjs <lockfile> <x.y.z>");
	process.exit(1);
}

const raw = readFileSync(file, "utf8");
const indent = raw.includes("\n\t") ? "\t" : "  ";
const lock = JSON.parse(raw);
lock.version = next;
if (lock.packages?.[""]) lock.packages[""].version = next;
writeFileSync(file, `${JSON.stringify(lock, null, indent)}\n`);
console.log(`${file}: ${lock.version}`);
