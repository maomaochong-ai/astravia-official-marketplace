/**
 * The site each craft plugin ships is built by a script inside that plugin.
 *
 * `web/` is the plugin's own runtime payload, so the step that produces it belongs beside
 * `payload/manifest.json` rather than in the repository's `scripts/`. There is one copy per
 * plugin and no repository-level forwarder: the packaging step reaches into the plugin it is
 * building and runs the script sitting there.
 *
 * Fifteen copies of the same download is only acceptable while they stay one download:
 * this test holds them to designcraft's copy byte for byte, and checks that the packaging
 * step still calls a per-plugin entry instead of growing a shared one again.
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

test("the repository keeps no second copy of the site builder", () => {
	// A repo-level dispatcher used to forward `--slug`/`--all` here. It was a third place to
	// keep in sync with nothing to add, and the packaging step can address a plugin directly,
	// so it is gone; this guards against it growing back.
	assert.equal(existsSync(new URL("../scripts/build-craft-web.mjs", import.meta.url)), false);

	const packaging = readFileSync(new URL("../scripts/marketplace.mjs", import.meta.url), "utf8");
	// The pinned-release branch must run the script inside the plugin being built, without a
	// `--slug`: that argument is what the per-plugin entry rejects.
	assert.match(packaging, /join\(directory, 'scripts\/build-craft-web\.mjs'\)/);
	assert.match(packaging, /fromSource\s*\?\s*\['--slug', basename\(directory\), '--if-missing'\]\s*:\s*\['--if-missing'\]/);
	// Exactly one call site. A leftover second invocation would stage the same site twice and, worse,
	// the stale one passes `--slug`, which the per-plugin entry rejects outright.
	assert.equal(packaging.split("execFileSync(process.execPath, [builder").length - 1, 1,
		"the payload step must reach the builder exactly once");
});
