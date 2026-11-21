// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * The manifest is the contract with the host and with the marketplace index.
 * These checks are cheap and they catch the failures that only show up after a
 * release: an id that drifted from the slug, a card that cannot be found, a
 * locale missing the key a component asks for.
 */

// Vitest runs with the plugin directory as cwd. `import.meta.url` is an http URL
// under the DOM environment, so paths resolve from cwd instead.
const ROOT = process.cwd();
const MARKETPLACE_ROOT = join(ROOT, "../../..");

const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const plugin = readJson("plugin.json");
const ability = readJson("ability.json");
const pkg = readJson("package.json");
const en = readJson("locales/en.json") as Record<string, string>;
const zh = readJson("locales/zh.json") as Record<string, string>;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist" || entry === "release") continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
}

/** Read the pixel size of a PNG or WebP so the avatar check can assert a square. */
function imageInfo(bytes: Buffer): { format: "png" | "webp"; width?: number; height?: number } | null {
	const isPng = [...bytes.subarray(0, 8)].join(",") === "137,80,78,71,13,10,26,10";
	if (isPng) {
		return { format: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	}
	if (bytes.subarray(0, 4).toString("latin1") !== "RIFF" || bytes.subarray(8, 12).toString("latin1") !== "WEBP") return null;
	const kind = bytes.subarray(12, 16).toString("latin1");
	if (kind === "VP8X") {
		return { format: "webp", width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
	}
	if (kind === "VP8 ") {
		// Lossy: 14-bit dimensions after the 3-byte frame tag and 3-byte start code.
		return { format: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
	}
	if (kind === "VP8L") {
		// Lossless: 14 bits each, packed across three bytes after the signature.
		return {
			format: "webp",
			width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
			height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
		};
	}
	return { format: "webp" };
}

const SOURCE_FILES = walk(join(ROOT, "src")).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes("/test/"));

describe("plugin identity", () => {
	it("uses the marketplace slug as its plugin id", () => {
		expect(plugin.id).toBe(ability.slug);
		expect(plugin.id).toBe("logocreator");
	});

	it("keeps every version in step", () => {
		expect(ability.version).toBe(plugin.version);
		expect(pkg.version).toBe(plugin.version);
	});

	it("ships the files it points at", () => {
		expect(existsSync(join(ROOT, plugin.icon))).toBe(true);
		// The card icon and the ability icon must be the same file, or the two
		// surfaces show two different marks for one plugin.
		expect(ability.icon).toBe(plugin.icon);
		expect(existsSync(join(ROOT, plugin.icon))).toBe(true);
		expect(existsSync(join(ROOT, ability.detail.path))).toBe(true);
		expect(existsSync(join(ROOT, ability.detail.i18n.zh.path))).toBe(true);
		for (const skillPath of plugin.agent.skillPaths) {
			expect(existsSync(join(ROOT, skillPath, "SKILL.md"))).toBe(true);
		}
		expect(plugin.entry).toMatch(/^dist\//);
		expect(plugin.styles.every((style: string) => style.startsWith("dist/"))).toBe(true);
	});

	it("gives the game its agent avatar and prompt as real files", () => {
		for (const agent of plugin.agent.agents) {
			expect(existsSync(join(ROOT, agent.systemPromptPath)), `${agent.id} system prompt`).toBe(true);
			expect(existsSync(join(ROOT, agent.avatar)), `${agent.id} avatar`).toBe(true);
			// The host refuses an avatar over 512 KB at reconcile time; catching it here
			// keeps the failure in CI instead of in a user's ability list.
			expect(statSync(join(ROOT, agent.avatar)).size).toBeLessThan(512 * 1024);
			expect(agent.mentionHandle).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
		}
	});

	it("registers the specialist as an agent, so @ lists it under the agents block", () => {
		// A teams entry would put the same persona under the teams block ("N members"),
		// which is not what this plugin is: one specialist, no crew.
		expect(plugin.agent.agents).toHaveLength(1);
		expect(plugin.agent.teams ?? []).toHaveLength(0);
	});


	it("declares exactly the permissions its code needs, and no egress", () => {
		const declared = new Set<string>(plugin.permissions);
		for (const permission of [
			"ui.slot.activity-tab",
			"ui.slot.input-action",
			"agent.tools.register",
			"agent.toolHandler.execute",
			"agent.skills.control",
			"storage.read",
			"storage.write",
			"fs.read",
			"fs.write",
			"media.generate",
		]) {
			expect(declared.has(permission), `plugin.json must declare ${permission}`).toBe(true);
		}

		// The AI path goes through `ctx.media`, i.e. the host's own providers. That is
		// the whole reason this plugin asks for no vault, no HTTP and no host allow-list:
		// a second credential store and a second egress path for a host capability is
		// exactly the kind of duplication this check exists to prevent.
		for (const forbidden of ["network.fetch", "secrets.read", "secrets.write", "agent.command.run", "shell.openExternal"]) {
			expect(declared.has(forbidden), `plugin.json must not declare ${forbidden}`).toBe(false);
		}
		expect(plugin.network, "no network block: nothing leaves through this plugin").toBeUndefined();
	});
});

describe("marketplace registration", () => {
	const catalog = JSON.parse(readFileSync(join(MARKETPLACE_ROOT, ".astravia/marketplace.source.json"), "utf8"));
	const entry = catalog.abilities.find((item: { slug: string }) => item.slug === "logocreator");

	it("is registered in the source catalog", () => {
		expect(entry, "logocreator must be registered in .astravia/marketplace.source.json").toBeTruthy();
	});

	it("agrees with the package on type, version and path", () => {
		expect(entry.type).toBe("plugin");
		expect(entry.version).toBe(plugin.version);
		expect(entry.source.path).toBe("abilities/plugins/logocreator");
	});

	it("names itself without a type suffix and carries both locale fields", () => {
		expect(entry.name).not.toMatch(/plugin|skill|mcp|bundle|插件|技能|套装/i);
		expect(entry.detail.i18n.zh.name).toBeTruthy();
		expect(entry.categoryI18n.zh).toBeTruthy();
		expect(entry.categoryI18n.en).toBeTruthy();
	});

	it("shows a Chinese name by default and keeps an English one for English hosts", () => {
		// The card's own name is the English product name; a Chinese UI reads the zh
		// override, which is Chinese prose rather than a transliteration.
		expect(plugin.defaultLocale).toBe("zh");
		expect(en.name).toBe("LogoCreator");
		expect(zh.name).toBe(entry.detail.i18n.zh.name);
		expect(zh.name).toMatch(/[\u4e00-\u9fa5]/);
		expect(zh.name).not.toMatch(/plugin|skill|mcp|bundle|studio|插件|技能|套装/i);
		// Everything the host renders as the plugin's own name goes through these keys.
		expect(zh["tab.label"]).toBe(zh.name);
		expect(zh["panel.title"]).toBe(zh.name);
		expect(en["tab.label"]).toBe(en.name);
		// The copy that *should* differ: the two descriptions are not the same text.
		expect(zh.description).not.toBe(en.description);
	});

	it("keeps the package manifest on the same minimum app version", () => {
		expect(entry.minAppVersion).toBe(catalog.minAppVersion);
	});
});

describe("locales", () => {
	it("defines the same keys in both languages", () => {
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
	});

	it("resolves every %key% the manifest uses", () => {
		const raw = readFileSync(join(ROOT, "plugin.json"), "utf8");
		const keys = [...raw.matchAll(/%([a-zA-Z0-9_.]+)%/g)].map((match) => match[1]);
		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			expect(en[key], `en is missing %${key}%`).toBeTruthy();
			expect(zh[key], `zh is missing %${key}%`).toBeTruthy();
		}
	});

	it("resolves every key a component asks for", () => {
		const candidates = new Set<string>();
		for (const file of SOURCE_FILES) {
			const text = readFileSync(file, "utf8");
			for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) candidates.add(match[1]);
			for (const match of text.matchAll(/\b(?:labelKey|hintKey|structureKey|nameKey)\s*:\s*"([a-zA-Z0-9_.]+)"/g)) {
				candidates.add(match[1]);
			}
		}
		expect(candidates.size).toBeGreaterThan(40);
		const missingEn = [...candidates].filter((key) => !(key in en));
		const missingZh = [...candidates].filter((key) => !(key in zh));
		expect(missingEn, `missing in en.json: ${missingEn.join(", ")}`).toEqual([]);
		expect(missingZh, `missing in zh.json: ${missingZh.join(", ")}`).toEqual([]);
	});

	it("defaults to Chinese, with English still complete", () => {
		expect(plugin.defaultLocale).toBe("zh");
		// A Chinese value where the English one is identical usually means one of the
		// two files was copy-pasted and never translated.
		const untranslated = Object.keys(en).filter(
			(key) => key.startsWith("panel.") || key.startsWith("action.") || key.startsWith("kit."),
		);
		const identical = untranslated.filter((key) => en[key] === zh[key] && en[key].length > 8);
		expect(identical.length).toBeLessThan(3);
	});
});

describe("the skill", () => {
	const text = readFileSync(join(ROOT, "agent/skills/logocreator/SKILL.md"), "utf8");

	it("has frontmatter that matches its directory", () => {
		const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
		// The host keys the skill by this `name`, and the presentation block in
		// plugin.json keys it again — a drifted name makes the skill load under one id
		// while the manifest tries to show another.
		const dirName = basename(join(ROOT, plugin.agent.skillPaths[0]));
		expect(front).toContain(`name: ${dirName}`);
		expect(plugin.agent.skillPresentation.skills[dirName]).toBeTruthy();
		expect(front).toMatch(/description:\s*"?[^"\n]{40,}/);
	});

	it("names the real tool ids", () => {
		expect(text).toContain("logocreator_design");
		expect(text).toContain("logocreator_brand_kit");
		expect(text).toContain("logocreator_catalog");
	});

	it("routes every reference file it promises", () => {
		const refs = /## References \(read on demand\)([\s\S]*)$/.exec(text)?.[1] ?? "";
		expect(refs).toBeTruthy();
		const named = [...refs.matchAll(/references\/([a-z-]+\.md)/g)].map((match) => match[1]);
		expect(new Set(named).size).toBeGreaterThanOrEqual(8);
		for (const file of new Set(named)) {
			expect(existsSync(join(ROOT, "agent/skills/logocreator/references", file)), `${file} is missing`).toBe(true);
		}
	});

	it("ships no reference file the skill does not route", () => {
		const dir = join(ROOT, "agent/skills/logocreator/references");
		for (const file of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
			expect(text, `${file} is not reachable from SKILL.md`).toContain(`references/${file}`);
		}
	});

	it("keeps each reference grounded in engine facts, not adjectives", () => {
		const dir = join(ROOT, "agent/skills/logocreator/references");
		for (const file of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
			const body = readFileSync(join(dir, file), "utf8");
			// Every reference must cite at least one concrete engine artefact: a file, a
			// function, a type id or a measured number. Otherwise it is filler.
			const concrete = [/\.ts\b/, /\.json\b/, /renderLogo|resolvePalette|subjectFor|initialsOf|planWordmark/, /0x[0-9a-f]+|#1[0-9A-F]{5}|\b\d+(\.\d+)?\s*(:1|units|px|°)/i];
			expect(concrete.some((pattern) => pattern.test(body)), `${file} cites nothing concrete`).toBe(true);
		}
	});
});

describe("the team agent", () => {
	const declared = plugin.agent?.agents?.[0];
	const catalogEntry = JSON.parse(readFileSync(join(MARKETPLACE_ROOT, ".astravia/marketplace.source.json"), "utf8")).abilities.find(
		(item: { slug: string }) => item.slug === "logocreator",
	);

	it("is registered with a mention handle and a persona prompt", () => {
		expect(plugin.agent.agents).toHaveLength(1);
		expect(declared.id).toBe("logo-master");
		expect(declared.mentionHandle).toBe("logo-master");
		expect(declared.systemPromptPath).toBe("agent/agents/logo-master.md");
		const prompt = readFileSync(join(ROOT, declared.systemPromptPath), "utf8");
		// The host skips an agent whose prompt is missing or empty (plugin-agent-presets.ts).
		expect(prompt.trim().length).toBeGreaterThan(800);
		expect(prompt).toContain("logocreator");
	});

	it("resolves its name and description in both languages", () => {
		for (const key of ["agent.logoMaster.name", "agent.logoMaster.description"]) {
			expect(en[key], `en is missing ${key}`).toBeTruthy();
			expect(zh[key], `zh is missing ${key}`).toBeTruthy();
		}
		expect(zh["agent.logoMaster.name"]).toBe("标志设计");
	});

	it("ships an avatar inside the package, in a format the host accepts", () => {
		const avatar = join(ROOT, declared.avatar);
		expect(existsSync(avatar)).toBe(true);

		// `plugin-agent-presets.ts` whitelists exactly these extensions and caps a
		// single avatar at 512 KB, because the whole blueprint crosses IPC.
		expect(declared.avatar).toMatch(/\.(webp|png|jpe?g|gif|svg)$/i);
		const bytes = readFileSync(avatar);
		expect(bytes.byteLength).toBeLessThan(512 * 1024);

		const info = imageInfo(bytes);
		expect(info, "avatar must be PNG or WebP").toBeTruthy();
		// A square is what the round slot in the agent list expects; a wide image
		// gets cropped through the head.
		if (info?.width && info?.height) {
			expect(info.width).toBe(info.height);
			expect(info.width).toBeGreaterThanOrEqual(128);
		}
	});

	it("takes only this plugin's abilities", () => {
		// `own` → selectionMode custom + plugins [id]; `all` would hand a logo
		// specialist every tool the user has installed.
		expect(declared.abilities).toBe("own");
		expect(declared.roles).toEqual(["designer"]);
	});

	it("carries a stable semver that the catalog agrees with", () => {
		// A literal here would have to be edited on every bump, which is how a test
		// stops being a check and becomes a chore. The real invariants are the shape
		// (the marketplace only accepts stable semver) and agreement with the entry.
		expect(plugin.version).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
		expect(plugin.version).toBe(catalogEntry.version);
	});
});
