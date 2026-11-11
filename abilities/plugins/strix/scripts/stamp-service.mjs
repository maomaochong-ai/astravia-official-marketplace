/**
 * Fill providers.services[].runtime.platforms[*].artifacts from the shipped file(s).
 *
 * The host's installer accepts a service runtime only when the payload set matches
 * the declared artifact set one-for-one and every SHA-256 verifies
 * (plugin-service-runtime-installer.ts). The service is one bundled entry, so this
 * computes one digest per platform - derived from disk and rounded up here, so the
 * digests are never copied by hand.
 *
 * Run after `npm run build:service`:
 *
 *     npm run stamp-service
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];
/** Everything the service needs at runtime; the TS sources are bundled into this file. */
const SERVICE_FILES = ["dist/service/main.mjs"];

const entries = [];
for (const relative of SERVICE_FILES) {
	try {
		const bytes = await readFile(join(root, relative));
		entries.push({
			sha256: createHash("sha256").update(bytes).digest("hex"),
			archive: "file",
			destination: relative,
		});
	} catch {
		throw new Error(`missing ${relative}; run \`npm run build:service\` first`);
	}
}

const manifestPath = join(root, "plugin.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const services = manifest.providers?.services ?? [];
if (services.length !== 1) throw new Error(`expected one service, found ${services.length}`);
for (const tag of PLATFORMS) {
	services[0].runtime.platforms[tag].artifacts = entries.map((entry) => ({ ...entry }));
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`stamped ${entries.length} artifact(s) across ${PLATFORMS.length} platforms`);
