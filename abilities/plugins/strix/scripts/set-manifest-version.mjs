/**
 * Set the two version fields plugin.json carries: the plugin's own version and
 * the managed service's runtime version. Both must move together, because the
 * host records the service runtime version next to the installed artifact.
 *
 * The service artifact checksum is left alone on purpose: it describes
 * service/main.mjs, which a version bump does not touch. Recompute it with
 * scripts/fill-service-checksum.py if that file changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
	console.error("usage: node set-manifest-version.mjs <x.y.z>");
	process.exit(1);
}

const file = join(ROOT, "plugin.json");
const before = readFileSync(file, "utf8");
const pattern = /"version":(\s*)"[^"]+"/g;
const found = before.match(pattern) ?? [];
if (found.length !== 2) {
	console.error(`expected 2 version fields in plugin.json, found ${found.length}`);
	process.exit(1);
}
writeFileSync(file, before.replace(pattern, `"version":$1"${next}"`));
console.log(`plugin.json: plugin + service runtime -> ${next}`);
