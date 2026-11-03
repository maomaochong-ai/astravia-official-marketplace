/**
 * The sixteen craft plugins ship the same engine under sixteen names.
 *
 * There used to be a generator that rewrote the shared copies; it was removed on
 * purpose (ADR docs/adr/<plugin>/craft-0001-seven-copies-and-a-parity-test.md). The
 * copy model only holds if drift is visible, so this test fails the moment one
 * plugin's copy of a shared file differs from designcraft's. `app.config.ts` is the
 * one file meant to differ: it is the whole per-app surface.
 *
 * Since the kernel replaced the pinned upstream bundles, `src/**` is the entire shared
 * surface — there is no server, no payload, no build script to compare any more, and
 * the family test refuses to let one creep back in.
 *
 * ADR: docs/adr/<plugin>/craft-0011-the-engine-is-ours.md
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = new URL("../abilities/plugins/", import.meta.url).pathname;
const REFERENCE = "designcraft";
const APPS = [
	"photocraft",
	"artcraft",
	"effectcraft",
	"filmcraft",
	"lightcraft",
	"pdfcraft",
	"vectorcraft",
	"cadcraft",
	"deckcraft",
	"figcraft",
	"gridcraft",
	"wordcraft",
	"texturecraft",
	"materialcraft",
	"craft-anything",
];
const ALL = [REFERENCE, ...APPS];

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
	files.push("tsconfig.json", "vite.config.ts");
	return files.filter((file) => !file.endsWith("app.config.ts")).sort();
}

test("the craft family shares one copy of every engine file", () => {
	const problems = [];
	for (const file of sharedFiles()) {
		const expected = createHash("sha256").update(readFileSync(join(ROOT, REFERENCE, file))).digest("hex");
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

test("every app carries the same set of source files", () => {
	const expected = sharedFiles();
	for (const app of APPS) {
		const present = [];
		const root = join(ROOT, app, "src");
		const walk = (absolute, prefix) => {
			for (const entry of readdirSync(absolute)) {
				const full = join(absolute, entry);
				if (statSync(full).isDirectory()) walk(full, `${prefix}/${entry}`);
				else present.push(`${prefix}/${entry}`);
			}
		};
		walk(root, "src");
		present.push("tsconfig.json", "vite.config.ts");
		const missing = expected.filter((file) => !present.includes(file));
		const extra = present.filter((file) => !expected.includes(file) && !file.endsWith("app.config.ts"));
		assert.deepEqual(missing, [], `${app} is missing shared files`);
		assert.deepEqual(extra, [], `${app} has files the family does not share`);
	}
});

test("each app still declares only its own identity", () => {
	for (const app of ALL) {
		const config = readFileSync(join(ROOT, app, "src/app.config.ts"), "utf8");
		assert.match(config, new RegExp(`id: "${app}"`), `${app} declares the wrong id`);
		assert.match(config, /kernel:\s*\{/, `${app} has no kernel block`);
	}
});

test("no app still ships a pinned upstream runtime", () => {
	for (const app of ALL) {
		for (const legacy of ["payload", "server", "scripts", "src/bridge", "src/runtime.ts"]) {
			assert.ok(!existsSync(join(ROOT, app, legacy)), `${app} still has ${legacy}`);
		}
		const manifest = readFileSync(join(ROOT, app, "plugin.json"), "utf8");
		assert.ok(!manifest.includes("\"providers\""), `${app} still declares a provider service`);
	}
});

test("the three identity files agree on the version", () => {
	const source = JSON.parse(readFileSync(new URL("../.astravia/marketplace.source.json", import.meta.url), "utf8"));
	const versions = new Map(source.abilities.map((entry) => [entry.slug, entry.version]));
	for (const app of ALL) {
		const plugin = JSON.parse(readFileSync(join(ROOT, app, "plugin.json"), "utf8"));
		const pkg = JSON.parse(readFileSync(join(ROOT, app, "package.json"), "utf8"));
		const ability = JSON.parse(readFileSync(join(ROOT, app, "ability.json"), "utf8"));
		assert.equal(pkg.version, plugin.version, `${app}: package.json version`);
		assert.equal(ability.version, plugin.version, `${app}: ability.json version`);
		assert.equal(versions.get(app), plugin.version, `${app}: marketplace.source.json version`);
	}
});

test("relative paths stay inside each plugin", () => {
	for (const app of ALL) {
		assert.ok(!relative(ROOT, join(ROOT, app)).startsWith(".."), `${app} escapes the marketplace root`);
	}
});
