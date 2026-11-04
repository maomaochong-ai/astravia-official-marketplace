#!/usr/bin/env node
/**
 * Run the site-staging step of one, several, or every craft plugin.
 *
 *   node scripts/build-craft-web.mjs --slug photocraft
 *   node scripts/build-craft-web.mjs --all
 *   node scripts/build-craft-web.mjs --all --if-missing
 *
 * This file is only the loop. The work — read `payload/manifest.json`, download the
 * pinned release bundle, verify it, unpack it, stage `web/`, repair upstream's chunk
 * layout — belongs to the plugin whose payload it produces, so each plugin carries it at
 * `abilities/plugins/<slug>/scripts/build-craft-web.mjs`. Keeping one copy outside them
 * meant the packaging step for a plugin lived in the repository rather than in the
 * plugin, and a plugin copied out of this repository came without the script that builds
 * its payload.
 *
 * `tests/craft-scripts.test.mjs` holds the fifteen copies to one another, so the split
 * cannot drift into fifteen variations of the same download.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = join(ROOT, "abilities/plugins");
const ENTRY = "scripts/build-craft-web.mjs";

function parseArgs(argv) {
	const options = { slugs: [], all: false, ifMissing: false };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--all") options.all = true;
		else if (arg === "--slug") options.slugs.push(argv[++i]);
		else if (arg === "--if-missing") options.ifMissing = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.all && options.slugs.length === 0) throw new Error("pass --slug <slug> or --all");
	return options;
}

/** Every plugin that carries a v4 provenance manifest, i.e. that ships a staged site. */
function pluginsWithSites() {
	return readdirSync(PLUGINS)
		.filter((slug) => existsSync(join(PLUGINS, slug, "payload/manifest.json")))
		.filter((slug) => {
			const manifest = JSON.parse(readFileSync(join(PLUGINS, slug, "payload/manifest.json"), "utf8"));
			return manifest.schemaVersion === 4;
		});
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const slugs = options.all ? pluginsWithSites() : options.slugs;

	const missing = slugs.filter((slug) => !existsSync(join(PLUGINS, slug, ENTRY)));
	if (missing.length > 0) throw new Error(`no ${ENTRY} in: ${missing.join(", ")}`);

	for (const slug of slugs) {
		const result = spawnSync(process.execPath, [join(PLUGINS, slug, ENTRY), ...(options.ifMissing ? ["--if-missing"] : [])], {
			stdio: "inherit",
		});
		if (result.status !== 0) {
			process.stderr.write(`[${slug}] site staging failed with status ${result.status}\n`);
			process.exit(result.status ?? 1);
		}
	}
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error?.message ?? error}\n`);
	process.exit(1);
}
