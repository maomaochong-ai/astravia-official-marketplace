/**
 * The site each craft plugin ships is built by a script inside that plugin.
 *
 * `web/` is the plugin's own runtime payload, so the step that produces it belongs beside
 * `payload/manifest.json` rather than in the repository's `scripts/`. The repository keeps
 * only a loop (`scripts/build-craft-web.mjs`) so `--all` and CI's per-slug call still work.
 *
 * Fifteen copies of the same download is only acceptable while they stay one download:
 * this test holds them to designcraft's copy byte for byte, and checks that the loop
 * forwards the arguments the packaging step actually passes instead of re-implementing
 * anything itself.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = new URL("../abilities/plugins/", import.meta.url).pathname;
const APPS = ["effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
	"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft", "craft-anything"];
const REFERENCE = "designcraft";
const ENTRY = "scripts/build-craft-web.mjs";

function digest(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("every craft plugin carries the site builder, byte for byte", () => {
	const reference = join(ROOT, REFERENCE, ENTRY);
	assert.ok(existsSync(reference), `${REFERENCE} has no ${ENTRY}`);
	const expected = digest(reference);

	const drifted = [REFERENCE, ...APPS].filter((slug) => {
		const path = join(ROOT, slug, ENTRY);
		return !existsSync(path) || digest(path) !== expected;
	});
	assert.deepEqual(drifted, [], `site builders differ from ${REFERENCE}: ${drifted.join(", ")}`);
});

test("the site builder works on the plugin it sits in", () => {
	const source = readFileSync(join(ROOT, REFERENCE, ENTRY), "utf8");
	// Derived from the script's own location, not from an argument: a copy of the plugin
	// outside this repository must still know which manifest it belongs to.
	assert.match(source, /const PLUGIN_DIR = resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), "\.\."\)/);
	assert.match(source, /position|basename\(PLUGIN_DIR\)/);
	assert.match(source, /payload\/manifest\.json/);
});

test("the repository entry only loops over the per-plugin ones", () => {
	const loop = readFileSync(new URL("../scripts/build-craft-web.mjs", import.meta.url), "utf8");
	// The shared file must not keep a second implementation of the download.
	assert.doesNotMatch(loop, /SHA256SUMS\.txt/);
	assert.doesNotMatch(loop, /repairModuleGraph/);
	assert.match(loop, /spawnSync\(process\.execPath/);
	// The packaging step calls it as `--slug <dir> --if-missing`; that contract stays.
	assert.match(loop, /arg === "--if-missing"/);
	assert.match(loop, /arg === "--slug"/);
});
