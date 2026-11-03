/**
 * What the host will accept, checked here rather than discovered after install.
 *
 * Each craft plugin is four things the host reads: a manifest, a skill package, an
 * icon and a service artifact pinned by sha256. All four can be wrong in ways that
 * `npm run build` does not notice — a bad surface key, a skill name that does not
 * match its plugin id, an icon path that does not exist, a digest left behind by an
 * earlier hub build. `node --test` is the cheap place to catch that.
 *
 * `docs/adr/<plugin>/craft-0006-the-skill-is-the-doorway.md` is why the skill assertions exist:
 * the plugin is only reachable if the skill shows up in the picker with a name and an
 * icon, so that is a testable product requirement, not a cosmetic detail.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = new URL("../abilities/plugins/", import.meta.url).pathname;
const APPS = [
	"designcraft",
	"effectcraft",
	"filmcraft",
	"lightcraft",
	"pdfcraft",
	"vectorcraft",
	"photocraft",
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

test("every pinned sha256 is the hub the plugin actually ships", () => {
	for (const app of APPS) {
		const manifestText = readFileSync(join(ROOT, app, "plugin.json"), "utf8");
		const pinned = new Set(manifestText.match(/[0-9a-f]{64}/g) ?? []);
		assert.equal(pinned.size, 1, `${app}: expected one digest across platforms, found ${pinned.size}`);
		const actual = createHash("sha256")
			.update(readFileSync(join(ROOT, app, "server/hub.mjs")))
			.digest("hex");
		assert.equal([...pinned][0], actual, `${app}: plugin.json pins a stale hub — run npm run build:hub`);
	}
});

test("the manifest, the service and the source agree on one version", () => {
	for (const app of APPS) {
		const manifest = readManifest(app);
		const runtime = manifest.providers?.services?.[0]?.runtime;
		assert.ok(runtime, `${app}: no service runtime`);
		assert.equal(runtime.version, manifest.version, `${app}: runtime.version must equal the plugin version`);
		const config = readFileSync(join(ROOT, app, "src/app.config.ts"), "utf8");
		const serviceVersion = /serviceVersion:\s*"([^"]+)"/.exec(config)?.[1];
		assert.equal(serviceVersion, manifest.version, `${app}: app.config serviceVersion is behind plugin.json`);
	}
});
