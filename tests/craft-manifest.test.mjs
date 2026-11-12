/**
 * What the host will accept, checked here rather than discovered after install.
 *
 * Each craft plugin is four things the host reads: a manifest, a skill package, an
 * icon and a pinned upstream source. All four can be wrong in ways that
 * `npm run build` does not notice — a bad surface key, a skill name that does not
 * match its plugin id, an icon path that does not exist, a provenance file left over
 * from the era when the plugin downloaded a zip. `node --test` is the cheap place to
 * catch that; the site itself (`web/`) is built by CI and is not in git.
 *
 * The skill showing up in the picker with a name and an icon is why these assertions exist:
 * the plugin is only reachable if the skill shows up in the picker with a name and an
 * icon, so that is a testable product requirement, not a cosmetic detail.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
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

/** The provenance pin: which upstream commit the shipped site was built from. */
function readPin(app) {
	return JSON.parse(readFileSync(join(ROOT, app, "payload/manifest.json"), "utf8"));
}

test("no craft plugin asks the host to run a service for it", () => {
	for (const app of APPS) {
		const { providers } = readManifest(app);
		assert.equal(providers, undefined, `${app}: providers must be gone — the site runs in the frame, not in a Node process`);
	}
});

test("the pin names the upstream release, its bundle and that bundle's digest", () => {
	for (const app of APPS) {
		const pin = readPin(app);
		assert.equal(pin.schemaVersion, 4, `${app}: payload/manifest.json must be schemaVersion 4`);
		assert.equal(pin.slug, app, `${app}: pin slug must equal the plugin id`);
		assert.equal(pin.site, "web", `${app}: the site directory is web/`);
		assert.equal(pin.upstream, `https://github.com/storytold/${app}`, `${app}: pin must point at the real upstream repository`);
		assert.match(pin.release, /^\d+\.\d+\.\d+$/, `${app}: pin.release must be the upstream release tag`);
		assert.match(pin.commit, /^[0-9a-f]{40}$/, `${app}: pin.commit must be a full 40-hex commit`);
		assert.equal(pin.asset, `${app}-web-${pin.release}.zip`, `${app}: pin.asset must be the bundle that release published`);
		assert.match(pin.sha256, /^[0-9a-f]{64}$/, `${app}: pin.sha256 must be the bundle digest build-craft-web.mjs verifies`);
		assert.equal(pin.builtBy, "scripts/build-craft-web.mjs", `${app}: pin must name the script that stages the site`);
	}
});

test("a staged site, when present, loads only relative paths", (t) => {
	let seen = 0;
	for (const app of APPS) {
		const index = join(ROOT, app, "web/index.html");
		if (!existsSync(index)) continue;
		seen += 1;
		const html = readFileSync(index, "utf8");
		assert.ok(html.trim().length > 0, `${app}: web/index.html is empty`);
		assert.ok(!/(?:src|href)="\//.test(html), `${app}: web/index.html loads an absolute path — the site lives in a package directory, not at a domain root`);
		assert.doesNotMatch(html, /127\.0\.0\.1|localhost/, `${app}: web/index.html still points at the removed loopback hub`);
	}
	if (seen === 0) t.skip("no site staged in this checkout (CI downloads upstream's bundle before packaging)");
});

test("the site directory is git-ignored so it never lands in the repository", () => {
	const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
	assert.match(ignore, /abilities\/plugins\/\*\/web\//, "abilities/plugins/*/web/ must be in .gitignore");
});
