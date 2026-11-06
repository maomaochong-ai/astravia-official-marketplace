#!/usr/bin/env node
/**
 * Put the site this plugin ships inside its own package.
 *
 *   node abilities/plugins/photocraft/scripts/build-craft-web.mjs
 *   node abilities/plugins/photocraft/scripts/build-craft-web.mjs --if-missing
 *
 * The script lives inside the plugin because the thing it produces is the plugin's own
 * runtime payload: `payload/manifest.json` and `web/` are this plugin's files, and
 * `web/` is what the package ships. It reads that manifest, so it has no `--slug`: the
 * plugin it works on is the one it sits in. There is no repository-level dispatcher either —
 * `scripts/marketplace.mjs` runs this file inside the plugin it is packaging, so the download
 * has exactly one implementation, and it belongs to the plugin that carries it.
 *
 * Every plugin carries `payload/manifest.json` (schemaVersion 4): which upstream
 * repository, which of its releases, the 40-hex commit that release points at, the name
 * of the web bundle that release published, and that bundle's sha256.
 *
 * Nothing is compiled here. The site is the archive upstream's own releaser produced —
 * their `packaging/web/package.sh` output, attached to the release: the editor they
 * ship, byte for byte, including the `integrity` hashes their `index.html` carries for
 * their own glue. This script downloads it, checks it against the pinned digest and
 * against upstream's `SHA256SUMS.txt`, strips the archive's single top-level directory,
 * and stages the result at `web/` inside the plugin.
 *
 * Why not rebuild upstream's recipe: fifteen Rust/wasm release builds take tens of
 * minutes each, which is a single-point-of-failure CI job rather than a two-minute
 * download, and a rebuild is our reading of their recipe — the release archive is not.
 *
 * The site is NOT committed: `web/` is gitignored and only exists between CI's build
 * step and its packaging step.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = basename(PLUGIN_DIR);
const PIN_PATH = join(PLUGIN_DIR, "payload/manifest.json");
/** Generous: the largest pinned bundle is ~70 MiB and release downloads are throttled. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

function hasCommand(command) {
	return spawnSync("sh", ["-c", `command -v ${command} >/dev/null 2>&1`], { stdio: "ignore" }).status === 0;
}

function step(title) {
	process.stdout.write(`\n== ${title}\n`);
}

function parseArgs(argv) {
	const options = { ifMissing: false };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--if-missing") options.ifMissing = true;
		else if (arg === "--slug" || arg === "--all") {
			throw new Error(`${arg} is not an argument of this entry: it builds ${SLUG}, the plugin it sits in`);
		} else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

function readPin() {
	if (!existsSync(PIN_PATH)) {
		throw new Error(`${SLUG}: no payload/manifest.json — nothing pins a site for this plugin`);
	}
	const pin = JSON.parse(readFileSync(PIN_PATH, "utf8"));
	if (pin.schemaVersion !== 4) throw new Error(`${SLUG}: manifest schemaVersion is ${pin.schemaVersion}, expected 4`);
	return pin;
}

function hashFile(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function duBytes(dir) {
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) total += duBytes(path);
		else if (entry.isFile()) total += statSync(path).size;
	}
	return total;
}

/** `https://github.com/storytold/cadcraft` + release `0.17.0` + asset name. */
function releaseAssetUrl(pin, asset) {
	return `${pin.upstream}/releases/download/v${pin.release}/${asset}`;
}

/**
 * `CRAFT_WEB_CACHE=<dir>` reads `<dir>/<slug>/<asset>` and `<dir>/<slug>/SHA256SUMS.txt`
 * instead of the network. Cached bytes go through the same two checks below, so a stale or
 * edited copy in there still fails.
 */
async function fetchAsset(url, cachedPath) {
	if (cachedPath && existsSync(cachedPath)) {
		process.stdout.write(`  ${url.split("/").pop()} from ${dirname(cachedPath)}\n`);
		return readFileSync(cachedPath);
	}
	const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
	if (!response.ok) throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
	return Buffer.from(await response.arrayBuffer());
}

/**
 * The digest the pin records must survive both checks: it is what we downloaded, and it is
 * what upstream's own `SHA256SUMS.txt` says that asset was when they published it. A
 * release asset republished under the same tag would pass the second and fail the first —
 * which is exactly the case worth failing loudly on rather than silently shipping new bytes.
 */
function verifyBundle(pin, bundle, sums) {
	const actual = createHash("sha256").update(bundle).digest("hex");
	if (actual !== pin.sha256) {
		throw new Error(`${pin.slug}: downloaded sha256 ${actual} does not match the pinned ${pin.sha256}`);
	}
	const listed = new RegExp(`^([0-9a-f]{64})  ${pin.asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m").exec(sums);
	if (!listed) throw new Error(`${pin.slug}: upstream's SHA256SUMS.txt lists no ${pin.asset}`);
	if (listed[1] !== pin.sha256) {
		throw new Error(`${pin.slug}: upstream now lists ${listed[1]} for ${pin.asset}, the pin says ${pin.sha256}`);
	}
}

/** Entry names inside the archive, without extracting it. */
function archiveEntries(zipPath) {
	if (hasCommand("unzip")) {
		const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
		if (listed.status === 0) return listed.stdout.split("\n").filter(Boolean);
	}
	if (hasCommand("python3")) {
		const listed = spawnSync("python3", ["-c", "import sys,zipfile;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", zipPath], { encoding: "utf8" });
		if (listed.status === 0) return listed.stdout.split("\n").filter(Boolean);
		throw new Error(listed.stderr.trim() || "python3 could not list the archive");
	}
	throw new Error("need unzip or python3 to read a zip archive");
}

/**
 * Upstream's releaser wraps the site in `<app>-web-<version>/`; the plugin needs the files
 * themselves at `web/`. An archive that already has `index.html` at its root is taken as is.
 * Names are validated first: the plugin protocol resolves paths inside the package, so an
 * absolute path or a `..` segment in the archive would land somewhere it must not.
 */
function topLevelDir(entries) {
	const tops = new Set(entries.map((name) => name.split("/")[0]));
	if (tops.size !== 1) return "";
	const [top] = tops;
	if (!entries.includes(`${top}/`)) return "";
	if (!entries.every((name) => name === `${top}/` || name.startsWith(`${top}/`))) return "";
	return top;
}

function extract(zipPath, into) {
	if (hasCommand("unzip")) {
		const result = spawnSync("unzip", ["-q", "-o", zipPath, "-d", into], { stdio: "inherit" });
		if (result.status === 0) return;
		throw new Error(`unzip failed with status ${result.status}`);
	}
	if (hasCommand("python3")) {
		const result = spawnSync("python3", ["-c", "import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zipPath, into], { stdio: "inherit" });
		if (result.status === 0) return;
		throw new Error(`python3 -m zipfile failed with status ${result.status}`);
	}
	throw new Error("need unzip or python3 to read a zip archive");
}

/** No symlinks: the packager walks the site and the host must not follow a link out of it. */
function assertNoSymlinks(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (lstatSync(path).isSymbolicLink()) throw new Error(`${path} is a symlink`);
		if (entry.isDirectory()) assertNoSymlinks(path);
	}
}

/**
 * Upstream's package script refuses a root-absolute URL, because the site is served from a
 * package directory rather than a domain root. Same rule here, before the copy.
 */
function assertRelativeIndex(indexPath) {
	const html = readFileSync(indexPath, "utf8");
	const absolute = /(?:src|href)="\/(?!\/)/.exec(html);
	if (absolute) throw new Error(`index.html has a root-absolute URL: ${absolute[0]}`);
}

/**
 * Relative import specifiers inside a shipped module: `from "./x"`, `import("./x")`,
 * `new URL("./x", import.meta.url)`. Only literals — a template string is not a specifier
 * we can resolve without running the page.
 */
const RELATIVE_SPECIFIER =
	/(?:\bfrom\s*|\bimport\s*\(\s*|new\s+URL\s*\(\s*)['"`](\.{1,2}\/[^'"`?#]+)['"`]/g;

/**
 * The site ships precompressed twins (`x.wasm.gz`, `x.wasm.br`) for hosts that negotiate
 * Content-Encoding. The plugin protocol serves raw bytes and the page fetches the module
 * directly, so those copies are dead weight — and already-compressed bytes do not shrink
 * again inside the package, which is where the 50 MB archive limit bites.
 */
function dropPrecompressed(dir) {
	let dropped = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			dropped += dropPrecompressed(path);
			continue;
		}
		if (!entry.isFile() || !/\.(?:gz|br)$/.test(entry.name)) continue;
		rmSync(path);
		dropped += 1;
	}
	return dropped;
}

function collectModules(dir, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) collectModules(path, out);
		else if (entry.isFile() && /\.m?js$/.test(entry.name)) out.push(path);
	}
	return out;
}

/**
 * Upstream's chunked builds put the app module under `app/` while the `snippets/` it imports
 * stay at the site root, so `app/<app>.js` asks for `app/snippets/…` and gets a 404 — a module
 * graph that never finishes loading, which reads as "the editor does not open" and produces no
 * error any Rust could report. Reproduce it by serving the unpacked release from a plain static
 * server: the page sits on its own "taking longer than usual" notice forever.
 *
 * The bytes are theirs; only the missing copy is ours, and only when the file it means to load
 * is already in the bundle at the same relative path from the site root.
 */
function repairModuleGraph(dir) {
	const repaired = [];
	const unresolved = [];
	for (const file of collectModules(dir)) {
		const text = readFileSync(file, "utf8");
		for (const match of text.matchAll(RELATIVE_SPECIFIER)) {
			const specifier = match[1];
			const wanted = resolve(dirname(file), specifier);
			if (existsSync(wanted)) continue;
			const atRoot = resolve(dir, specifier);
			if (existsSync(atRoot)) {
				mkdirSync(dirname(wanted), { recursive: true });
				cpSync(atRoot, wanted);
				repaired.push(`${(file.slice(dir.length + 1))} → ${specifier}`);
				continue;
			}
			unresolved.push(`${file.slice(dir.length + 1)} → ${specifier}`);
		}
	}
	return { repaired: [...new Set(repaired)], unresolved: [...new Set(unresolved)] };
}

async function stage() {
	const pin = readPin();
	const site = pin.site || "web";
	process.stdout.write(`\n[${SLUG}] ${pin.upstream} v${pin.release} → ${pin.asset}\n`);

	step(`${SLUG}: download`);
	const cacheDir = process.env.CRAFT_WEB_CACHE ? join(resolve(process.env.CRAFT_WEB_CACHE), SLUG) : "";
	const bundle = await fetchAsset(releaseAssetUrl(pin, pin.asset), cacheDir ? join(cacheDir, pin.asset) : "");
	const sums = (await fetchAsset(releaseAssetUrl(pin, "SHA256SUMS.txt"), cacheDir ? join(cacheDir, "SHA256SUMS.txt") : "")).toString("utf8");
	verifyBundle(pin, bundle, sums);
	process.stdout.write(`  ${(bundle.length / 1024 / 1024).toFixed(1)} MiB, sha256 ${pin.sha256.slice(0, 12)} matches the pin and upstream's sums\n`);

	const work = join(tmpdir(), `craft-site-${SLUG}-${process.pid}`);
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	try {
		const zipPath = join(work, pin.asset);
		writeFileSync(zipPath, bundle);

		const entries = archiveEntries(zipPath);
		if (entries.length === 0) throw new Error(`${SLUG}: ${pin.asset} is empty`);
		for (const name of entries) {
			if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
				throw new Error(`${SLUG}: ${pin.asset} contains an unusable path: ${name}`);
			}
		}

		const unpacked = join(work, "unpacked");
		mkdirSync(unpacked, { recursive: true });
		extract(zipPath, unpacked);
		assertNoSymlinks(unpacked);

		const top = topLevelDir(entries);
		const from = top ? join(unpacked, top) : unpacked;
		if (!existsSync(join(from, "index.html"))) {
			throw new Error(`${SLUG}: ${pin.asset} has no index.html${top ? ` under ${top}/` : ""}`);
		}
		assertRelativeIndex(join(from, "index.html"));

		const target = join(PLUGIN_DIR, site);
		rmSync(target, { recursive: true, force: true });
		mkdirSync(target, { recursive: true });
		cpSync(from, target, { recursive: true });

		const graph = repairModuleGraph(target);
		if (graph.repaired.length > 0) {
			process.stdout.write(
				`[${SLUG}] rewired ${graph.repaired.length} module path(s) upstream's chunk layout leaves dangling:\n` +
					graph.repaired.map((line) => `  ${line}\n`).join(""),
			);
		}
		for (const line of graph.unresolved) {
			process.stderr.write(`[${SLUG}] WARNING unresolved relative import: ${line}\n`);
		}

		if (pin.skipPrecompressed) {
			const dropped = dropPrecompressed(target);
			process.stdout.write(`[${SLUG}] dropped ${dropped} precompressed file(s) the plugin protocol cannot use\n`);
		}

		const bytes = duBytes(target);
		process.stdout.write(
			`[${SLUG}] ${site}/ ${(bytes / 1024 / 1024).toFixed(1)} MiB, index.html sha256 ${hashFile(join(target, "index.html")).slice(0, 12)}\n`,
		);
		return bytes;
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	// `--if-missing` is what the package build passes: a site already on disk came from the
	// same pin, and re-downloading it would only add time to every packaging run.
	if (options.ifMissing && existsSync(join(PLUGIN_DIR, readPin().site || "web", "index.html"))) {
		process.stdout.write(`[${SLUG}] site already staged, skipping\n`);
		return;
	}

	const bytes = await stage();
	process.stdout.write(`\n[${SLUG}] ${(bytes / 1024 / 1024).toFixed(1)} MiB staged\n`);
}

main().catch((error) => {
	process.stderr.write(`${error?.message ?? error}\n`);
	process.exit(1);
});
