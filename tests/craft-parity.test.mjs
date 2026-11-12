/**
 * The fifteen craft plugins ship the same shell under fifteen names.
 *
 * There used to be a generator that rewrote the shared copies; it was removed on
 * purpose. The copy model only holds
 * if drift is visible, so this test fails the moment one plugin's copy of a shared
 * file differs from designcraft's. `app.config.ts` is the one file that is meant to
 * differ: it is the whole per-app surface.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
const APPS = ["effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
	"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft", "craft-anything"];
const REFERENCE = "designcraft";

/** Every file that is supposed to be byte-identical across the family. */
function sharedFiles() {
	const files = [];

	function walk(absolute, prefix) {
		for (const entry of readdirSync(absolute)) {
			const full = join(absolute, entry);
			if (statSync(full).isDirectory()) {
				walk(full, `${prefix}/${entry}`);
				continue;
			}
			files.push(`${prefix}/${entry}`);
		}
	}

	walk(join(ROOT, REFERENCE, "src"), "src");
	return files.filter((file) => !file.endsWith("app.config.ts")).sort();
}

test("the craft family shares one copy of every shell file", () => {
	const problems = [];
	for (const file of sharedFiles()) {
		const expected = createHash("sha256")
			.update(readFileSync(join(ROOT, REFERENCE, file)))
			.digest("hex");
		for (const app of APPS) {
			let actual;
			try {
				actual = createHash("sha256").update(readFileSync(join(ROOT, app, file))).digest("hex");
			} catch {
				problems.push(`${app}/${file}: missing`);
				continue;
			}
			if (actual !== expected) problems.push(`${app}/${file}: differs from ${REFERENCE}`);
		}
	}
	assert.deepEqual(problems, [], `shared source drifted:\n${problems.join("\n")}`);
});

test("each app still declares only its own identity", () => {
	for (const app of [...[REFERENCE], ...APPS]) {
		const config = readFileSync(join(ROOT, app, "src/app.config.ts"), "utf8");
		assert.match(config, new RegExp(`id: "${app}"`), `${app} declares the wrong id`);
	}
});

test("relative paths stay inside each plugin", () => {
	for (const app of [...[REFERENCE], ...APPS]) {
		assert.ok(!relative(ROOT, join(ROOT, app)).startsWith(".."), `${app} escapes the marketplace root`);
	}
});
