/**
 * What the host will accept from this plugin, checked before CI finds out.
 *
 * Excalidraw is a single plugin, not a member of the craft family: its site is built
 * from a pinned upstream commit at packaging time instead of being downloaded as a
 * release bundle. So the provenance assertions here are about a *source-build* pin,
 * and there is no parity test holding it to the other canvas plugins.
 *
 * The four things a user can be let down by, and which `npm run build` does not see:
 *   - the skill missing from the picker (it is the only doorway to the plugin);
 *   - an icon that is not Excalidraw's own;
 *   - a pin that names a repository, commit or recipe that does not exist;
 *   - a showcase line that the detail card clips, or a locale key that falls back to
 *     the key name in front of the user.
 *
 * ADR: docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md
 * ADR: docs/adr/excalidraw/0002-bytes-move-through-the-host.md
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url).pathname;
const APP = join(ROOT, "abilities/plugins/excalidraw");

function readJson(relative) {
	return JSON.parse(readFileSync(join(APP, relative), "utf8"));
}

function readText(relative) {
	return readFileSync(join(APP, relative), "utf8");
}

const manifest = readJson("plugin.json");

/** The host's own schema, reachable only where the vendored SDK is installed. */
function loadSchema() {
	try {
		const sdk = join(APP, "node_modules/@astravia-org/plugin-sdk/dist/manifest-schema.js");
		const require = createRequire(sdk);
		const { Value } = require("@sinclair/typebox/value");
		const { PluginManifestSchema } = require(sdk);
		return { check: (value) => Value.Check(PluginManifestSchema, value) };
	} catch {
		return null;
	}
}

const schema = loadSchema();

test("the manifest passes the host's own schema", (t) => {
	if (!schema) {
		t.skip("vendored plugin-sdk not installed (run npm install in this plugin)");
		return;
	}
	assert.ok(schema.check(manifest), "plugin.json does not match PluginManifestSchema");
});

test("the skill is visible wherever a user can pick one", () => {
	const presentation = manifest.agent?.skillPresentation;
	assert.ok(presentation, "no agent.skillPresentation — the skill would never be offered");
	assert.equal(presentation.defaultVisibility, "visible", "the skill must be visible by default");
	assert.equal(presentation.surfaces?.commandPalette, "visible", "hidden in the slash panel");
	assert.equal(presentation.surfaces?.skillPicker, "visible", "hidden in the skill picker");
});

test("the skill package names itself after the plugin", () => {
	const paths = manifest.agent?.skillPaths ?? [];
	assert.equal(paths.length, 1, "expected exactly one skill package");
	const source = readText(join(paths[0], "SKILL.md"));
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
	assert.ok(block, "SKILL.md has no frontmatter");
	const fields = {};
	for (const line of block[1].split(/\r?\n/)) {
		const match = /^(name|alias|description):\s*(.+)$/.exec(line);
		if (match) fields[match[1]] = match[2].trim();
	}
	assert.equal(fields.name, manifest.id, "SKILL.md name must equal the plugin id");
	assert.ok(fields.alias, "SKILL.md needs an alias — that is what the picker prints");
	assert.ok(fields.description, "SKILL.md needs a description — that is the picker's second line");
});

test("the skill documents exactly the tools the plugin registers", () => {
	const tools = readText("src/features/agent/editor-tools.ts");
	const registered = [...tools.matchAll(/id: `\$\{id\}_([a-z_]+)`/g)].map((match) => `${manifest.id}_${match[1]}`);
	assert.equal(registered.length, 5, `expected five tools, found ${registered.join(", ")}`);
	const skill = readText("agent/skills/excalidraw/SKILL.md");
	for (const name of registered) {
		assert.ok(skill.includes(name), `SKILL.md never mentions ${name} — the agent cannot find it`);
	}
});

test("the icon is Excalidraw's own bitmap, not a placeholder", () => {
	assert.equal(manifest.icon, "assets/icon.png", "the manifest should point at the packaged bitmap");
	const path = join(APP, "assets/icon.png");
	assert.ok(existsSync(path), "assets/icon.png is missing");
	const bytes = readFileSync(path);
	assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "not a PNG");
	// IHDR width/height live at 16..24. Upstream ships 512×512 app icons; anything
	// smaller is a redrawn or downscaled stand-in.
	assert.equal(bytes.readUInt32BE(16), 512, "icon width should be upstream's 512");
	assert.equal(bytes.readUInt32BE(20), 512, "icon height should be upstream's 512");
	assert.ok(statSync(path).size > 8192, "a 512×512 branded icon is never this small — looks like a placeholder");
});

test("the pin is a source-build pin that names a real recipe", () => {
	const pin = readJson("payload/manifest.json");
	assert.equal(pin.schemaVersion, 5, "payload/manifest.json must be schemaVersion 5");
	assert.equal(pin.slug, manifest.id, "pin slug must equal the plugin id");
	assert.equal(pin.site, "web", "the site directory is web/");
	assert.equal(pin.build?.kind, "source-build", "this plugin builds upstream from source, it does not download a bundle");
	assert.equal(pin.build?.upstream, "https://github.com/excalidraw/excalidraw", "pin must point at the real upstream repository");
	assert.match(pin.build?.commit ?? "", /^[0-9a-f]{40}$/, "pin.build.commit must be a full 40-hex commit");
	assert.equal(pin.build?.package, "excalidraw-app", "the pinned workspace package is excalidraw-app");
	assert.equal(pin.build?.recipe, "scripts/build-excalidraw-web.mjs", "pin must name the script that stages the site");
	assert.ok(existsSync(join(ROOT, pin.build.recipe)), `${pin.build.recipe} does not exist`);
	assert.equal(typeof pin.build?.recipeVersion, "number", "recipeVersion is what a recipe change bumps");
});

test("the marketplace tooling dispatches this pin to its recipe", () => {
	const tooling = readFileSync(join(ROOT, "scripts/marketplace.mjs"), "utf8");
	assert.match(tooling, /source-build/, "marketplace.mjs never looks at build.kind");
	assert.ok(tooling.includes("pin.build?.recipe") || tooling.includes("build.recipe"), "marketplace.mjs never reads the pin's recipe");
	const recipe = readFileSync(join(ROOT, "scripts/build-excalidraw-web.mjs"), "utf8");
	assert.match(recipe, /--slug/, "the recipe must take a slug so it can be run for one plugin");
	assert.ok(!/https:\/\/raw\.githubusercontent\.com/.test(recipe), "the recipe should clone the pinned commit, not fetch moving branch files");
});

test("the market entry mirrors the plugin identity", () => {
	const source = JSON.parse(readFileSync(join(ROOT, ".astravia/marketplace.source.json"), "utf8"));
	const entry = (source.abilities ?? []).find((item) => item.slug === manifest.id);
	assert.ok(entry, "excalidraw is not registered in .astravia/marketplace.source.json");
	assert.equal(entry.type, "plugin", "wrong ability type");
	assert.equal(entry.version, manifest.version, "market entry and plugin.json disagree on the version");
	assert.equal(entry.source?.path, "abilities/plugins/excalidraw", "source.path must point at this package");
	assert.ok(entry.minAppVersion, "a plugin entry declares minAppVersion");
	assert.equal(entry.categoryI18n?.zh, "图表", "the category needs a Chinese name");
	assert.equal(entry.categoryI18n?.en, entry.category, "the English category name must match the stable key");
	assert.equal(entry.detail?.i18n?.zh?.name, "Excalidraw", "the card needs a Chinese name");
	assert.doesNotMatch(entry.description ?? "", /[\u4e00-\u9fff]/, "the default description must be English — Chinese lives in detail.i18n.zh");
});

test("locales carry the same keys in both languages", () => {
	const en = readJson("locales/en.json");
	const zh = readJson("locales/zh.json");
	assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort(), "a missing key renders as %key% in front of the user");
	for (const [key, value] of Object.entries(en)) {
		assert.ok(value.trim().length > 0, `en: ${key} is empty`);
		assert.ok(zh[key].trim().length > 0, `zh: ${key} is empty`);
	}
	// The tools use `%tool.x%` labels, so those keys are load-bearing.
	for (const key of ["tool.open", "tool.status", "tool.act", "tool.probe", "tool.document"]) {
		assert.ok(key in en, `missing ${key} — the tool header would show the raw key`);
	}
});

test("the detail card fits the host's fixed-height showcase", () => {
	const en = readJson("detail.json");
	const zh = readJson("detail.zh.json");
	for (const [locale, detail] of [["en", en], ["zh", zh]]) {
		const showcase = detail.blocks.find((block) => block.type === "showcase")?.showcase;
		assert.ok(showcase, `${locale}: no showcase block — the page would show the fallback`);
		// `h-44` plus `line-clamp-3` on the bubble: a long prompt is clipped mid-sentence,
		// which is exactly what a user reads as "the card is broken".
		assert.ok(showcase.user_prompt.length <= 48, `${locale}: user_prompt is too long for the card`);
		assert.ok(showcase.assistant_reply.length <= 64, `${locale}: assistant_reply is too long for the card`);
		assert.doesNotMatch(showcase.user_prompt + showcase.assistant_reply, /```|\n/, `${locale}: the showcase is one line, not markdown`);
	}
	assert.match(zh.blocks.find((block) => block.type === "showcase").showcase.user_prompt, /[\u4e00-\u9fff]/, "zh showcase must be Chinese");
});

test("every link and image in the detail is shippable", () => {
	for (const file of ["detail.json", "detail.zh.json"]) {
		const detail = readJson(file);
		for (const block of detail.blocks) {
			if (block.type === "links") {
				for (const item of block.items ?? []) {
					assert.match(item.href, /^https?:\/\//, `${file}: ${item.href} is not http(s)`);
				}
			}
			if (block.type === "image") {
				assert.doesNotMatch(block.src, /^solar:/, `${file}: image blocks cannot use solar: icons`);
			}
			if (block.type === "showcase") {
				assert.doesNotMatch(block.showcase?.brand_icon_url ?? "", /^solar:/, `${file}: brand_icon_url cannot be a solar: name`);
			}
		}
	}
	for (const meta of readJson("ability.json").detail?.meta ?? []) {
		if (meta.key) assert.ok(["homepage", "repository", "docs", "license"].includes(meta.key), `unknown meta key ${meta.key}`);
	}
});

test("the bridge only trusts its own frame and hits the interactive canvas", () => {
	const bridge = readText("src/bridge/host-bridge.js");
	// Identity, not origin: in `about:srcdoc` the origin is "null" and an origin check
	// would be no check at all.
	assert.match(bridge, /if \(event\.source !== parentWindow\) return;/, "the bridge accepts messages from any window");
	// Excalidraw stacks three canvases; only `.interactive` carries the handlers.
	assert.match(
		bridge,
		/document\.querySelector\("canvas\.excalidraw__canvas\.interactive"\)/,
		"canvasNode() must prefer the interactive canvas, or gestures land on the static one",
	);
	assert.ok(
		bridge.indexOf("canvas.excalidraw__canvas.interactive") < bridge.indexOf('document.querySelector("canvas")'),
		"the interactive canvas must be tried first",
	);
});

test("the site is built, not committed", () => {
	const ignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
	assert.match(ignore, /abilities\/plugins\/\*\/web\//, "abilities/plugins/*/web/ must be in .gitignore");
	const index = join(APP, "web/index.html");
	if (!existsSync(index)) return; // CI builds it before packaging; a bare checkout has no site
	const html = readFileSync(index, "utf8");
	assert.ok(html.trim().length > 0, "web/index.html is empty");
	assert.ok(!/(?:src|href)="\//.test(html), "web/index.html loads an absolute path — the site lives in a package directory");
	assert.doesNotMatch(html, /127\.0\.0\.1|localhost/, "web/index.html still points at a local server");
	assert.doesNotMatch(html, /excalidraw\.nyc3\.cdn\.digitaloceanspaces\.com/, "the site still fetches assets from upstream's CDN");
	assert.doesNotMatch(html, /serviceWorker\.register|workbox/, "the site must not register a service worker — it cannot in about:srcdoc");
	assert.doesNotMatch(html, /simpleanalyticscdn/, "the site still loads upstream's pageview beacon — a packaged site runs offline");
});

test("the recipe strips the beacon and keeps the file seams on the legacy path", () => {
	const recipe = readFileSync(join(ROOT, "scripts/build-excalidraw-web.mjs"), "utf8");
	// The beacon is removed at build time: a runtime stub cannot stop a script that
	// has already been appended, and its iframe branch throws `action is not defined`.
	assert.match(recipe, /simpleanalyticscdn/, "the recipe no longer removes the analytics loader");
	assert.match(
		recipe,
		/if \(!analytics\.test\(out\)\) \{\s*fail\(/,
		"the recipe must fail loudly when upstream renames the beacon instead of shipping it",
	);
	// Native pickers bypass the bridge entirely; the legacy implementation is the only
	// one that renders an <a download> or an <input type=file> for the bridge to intercept.
	assert.match(
		recipe,
		/\{ find: \/\^browser-fs-access\$\/, replacement: legacyFs \}/,
		"browser-fs-access must be aliased, or the app opens the native pickers",
	);
	assert.match(recipe, /fileOpenLegacy as fileOpen/, "the shim must re-export the legacy exports");
	assert.match(recipe, /export const supported = false/, "the shim must report native FS as unsupported");
});

test("the document empties the referrer before upstream's first script", () => {
	const document = readText("src/features/editor/services/site-document.ts");
	// Upstream refuses a frame whose referrer shares the origin; under the host both
	// `about:srcdoc` and `astravia-plugin://…` are the opaque origin "null".
	assert.match(document, /excalidraw-embed-seed/, "the embed seed is gone — the editor will render \"I'm not a pretzel!\"");
	assert.match(document, /Object\.defineProperty\(document,"referrer"/, "the embed seed must empty document.referrer");

	const head = document.slice(document.indexOf("const head = ["));
	const order = ["<base href", "history.replaceState", "embedSeedScript()", "seedScript(request.uiLang)"];
	const positions = order.map((needle) => head.indexOf(needle));
	assert.ok(positions.every((at) => at >= 0), `the head is missing one of: ${order.join(", ")}`);
	assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "the injections must run in the order the header comment claims");
});

test("the bridge intercepts both ways an app opens a file dialog", () => {
	const bridge = readText("src/bridge/host-bridge.js");
	// `browser-fs-access` prefers `input.showPicker()` where it exists (Chromium), so a
	// click-only hook lets the native dialog through and the editor waits forever.
	assert.match(bridge, /HTMLInputElement\.prototype\.showPicker = function/, "the bridge misses the showPicker() seam");
	assert.match(bridge, /typeof HTMLInputElement\.prototype\.showPicker === "function"/, "the bridge must not assume showPicker() exists");
	const seam = bridge.slice(bridge.indexOf("function openSeam("));
	assert.ok(seam.length > 0, "the open seam is gone");
	assert.match(seam, /craft:pickOpen/, "the open seam must ask the host for the file");
});

test("a separator-only accept does not reject every file", () => {
	// Upstream loads scenes with `fileOpen({})`; browser-fs-access then leaves the input
	// with `accept = ","`. Read as "nothing matches", the staged file is never handed over
	// and the editor keeps asking. A list with no tokens is not a filter.
	const bridge = readText("src/bridge/host-bridge.js");
	const accept = bridge.slice(bridge.indexOf("function accepts("), bridge.indexOf("function openSeam("));
	assert.ok(accept.length > 0, "the accept check is gone");
	assert.match(accept, /filtered = true;/, "the accept check must remember whether it saw a real token");
	assert.match(accept, /return filtered \? false : true;/, "a separator-only accept must accept everything");
});

test("the probe composites every painted layer, not just the interactive canvas", () => {
	// Excalidraw draws the scene on `canvas.excalidraw__canvas.static` and only the
	// selection on `.interactive`. Reading one canvas reports an empty page for a full one.
	const bridge = readText("src/bridge/host-bridge.js");
	assert.match(bridge, /function sceneLayers\(\)/, "the bridge lost its layer list");
	assert.match(bridge, /querySelectorAll\("canvas\.excalidraw__canvas"\)/, "the layer list must cover every painted canvas");
	const probe = bridge.slice(bridge.indexOf("function probe("), bridge.indexOf("async function probeMessage("));
	assert.match(probe, /sceneLayers\(\)/, "probe() must read the composited layers");
	const capture = bridge.slice(bridge.indexOf("function pngBytes("), bridge.indexOf("// ------------------------------------------------------------- text probe"));
	assert.match(capture, /sceneLayers\(\)/, "a screenshot of the interactive canvas alone is not the picture");
});

test("the open tool presses the platform's own primary modifier", () => {
	// Upstream tests `KEYS.CTRL_OR_CMD`, which is Meta on macOS: a literal "ctrl+o"
	// opens nothing on a Mac and the tool would report a canvas that never changed.
	const tools = readText("src/features/agent/editor-tools.ts");
	assert.match(tools, /const PRIMARY_MODIFIER =/, "the shortcut is hard-coded again");
	assert.match(tools, /const OPEN_CHORD = `\$\{PRIMARY_MODIFIER\}\+o`/, "the open chord must be built from the platform");
	assert.doesNotMatch(tools, /input\.shortcut \|\| "ctrl\+o"/, "the literal ctrl+o default is back");
});
