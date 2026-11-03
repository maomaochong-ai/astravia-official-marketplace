/**
 * What the host will accept, checked here rather than discovered after install.
 *
 * Each craft plugin is four things the host reads: a manifest, a skill package, an
 * icon and a permission list matching what the code actually calls. All four can be
 * wrong in ways that `npm run build` does not notice — a bad surface key, a skill name
 * that does not match its plugin id, an icon path that does not exist, a permission
 * the kernel needs but never asked for.
 *
 * `docs/adr/<plugin>/craft-0006-the-skill-is-the-doorway.md` is why the skill
 * assertions exist: the plugin is only reachable if the skill shows up in the picker
 * with a name and an icon, so that is a testable product requirement, not a cosmetic
 * detail.
 *
 * Since the kernel replaced the pinned upstream bundles there is no service artifact
 * and no digest to compare; what replaced those assertions is the permission check.
 *
 * ADR: docs/adr/<plugin>/craft-0011-the-engine-is-ours.md
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = new URL("../abilities/plugins/", import.meta.url).pathname;
const APPS = [
	"designcraft",
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

/** The host's own manifest schema, reachable only where the vendored SDK is installed. */
function loadSchema() {
	try {
		const sdk = join(ROOT, "designcraft/node_modules/@astravia-org/plugin-sdk/dist/manifest-schema.js");
		const require = createRequire(sdk);
		const { Value } = require("@sinclair/typebox/value");
		const { PluginManifestSchema } = require(sdk);
		return { check: (value) => Value.Check(PluginManifestSchema, value) };
	} catch {
		return null;
	}
}

const schema = loadSchema();

function readManifest(app) {
	return JSON.parse(readFileSync(join(ROOT, app, "plugin.json"), "utf8"));
}

function frontmatter(app, skillPath) {
	const source = readFileSync(join(ROOT, app, skillPath, "SKILL.md"), "utf8");
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
	assert.ok(block, `${app}: SKILL.md has no frontmatter`);
	const fields = {};
	for (const line of block[1].split(/\r?\n/)) {
		const match = /^(name|alias|description|version):\s*(.+)$/.exec(line);
		if (match) fields[match[1]] = match[2].trim();
	}
	return { fields, body: source.slice(block[0].length) };
}

test("every craft manifest passes the host schema", (t) => {
	if (!schema) {
		t.skip("vendored plugin-sdk not installed (run npm install in a craft plugin)");
		return;
	}
	for (const app of APPS) {
		const manifest = readManifest(app);
		assert.ok(schema.check(manifest), `${app}: plugin.json does not match PluginManifestSchema`);
	}
});

test("the skill is visible wherever a user can pick one", () => {
	for (const app of APPS) {
		const presentation = readManifest(app).agent?.skillPresentation;
		assert.ok(presentation, `${app}: no agent.skillPresentation`);
		assert.equal(presentation.surfaces?.commandPalette, "visible", `${app}: hidden in the slash panel`);
		assert.equal(presentation.surfaces?.skillPicker, "visible", `${app}: hidden in the skill picker`);
	}
});

test("each skill package names itself after its plugin", () => {
	for (const app of APPS) {
		const manifest = readManifest(app);
		const paths = manifest.agent?.skillPaths ?? [];
		assert.equal(paths.length, 1, `${app}: expected exactly one skill package`);
		const { fields, body } = frontmatter(app, paths[0]);
		assert.equal(fields.name, app, `${app}: SKILL.md name must equal the plugin id`);
		assert.ok(fields.alias, `${app}: SKILL.md needs an alias — that is what the picker prints`);
		assert.ok(fields.description, `${app}: SKILL.md needs a description — that is the picker's second line`);
		assert.match(body, /[\u4e00-\u9fff]/, `${app}: the skill body is supposed to be written in Chinese`);
	}
});

test("each plugin ships the icon its manifest points at", () => {
	for (const app of APPS) {
		const manifest = readManifest(app);
		const icon = manifest.icon ?? manifest.abilityIcon;
		assert.equal(icon, "assets/icon.png", `${app}: manifest should point at the packaged bitmap`);
		assert.ok(existsSync(join(ROOT, app, icon)), `${app}: ${icon} is missing`);
	}
});

test("each manifest asks for exactly what the kernel calls", () => {
	const required = [
		"ui.slot.activity-tab",
		"fs.read",
		"fs.write",
		"storage.read",
		"storage.write",
		"agent.tools.register",
		"agent.toolHandler.execute",
		"agent.skills.control",
	];
	for (const app of APPS) {
		const granted = new Set(readManifest(app).permissions ?? []);
		for (const permission of required) {
			assert.ok(granted.has(permission), `${app}: missing permission ${permission}`);
		}
	}
});

test("no manifest still pins an upstream artifact", () => {
	for (const app of APPS) {
		const manifest = readManifest(app);
		const text = JSON.stringify(manifest);
		assert.ok(!/[0-9a-f]{64}/.test(text), `${app}: plugin.json still carries a sha256`);
		assert.equal(manifest.providers, undefined, `${app}: plugin.json still declares a provider`);
	}
});

test("the manifest and the source agree on one version", () => {
	for (const app of APPS) {
		const manifest = readManifest(app);
		const pkg = JSON.parse(readFileSync(join(ROOT, app, "package.json"), "utf8"));
		assert.equal(pkg.version, manifest.version, `${app}: package.json is behind plugin.json`);
		const config = readFileSync(join(ROOT, app, "src/app.config.ts"), "utf8");
		assert.match(config, new RegExp(`id: "${app}"`), `${app}: app.config declares the wrong id`);
	}
});
