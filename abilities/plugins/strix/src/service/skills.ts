/**
 * Strix's skill library: the tool knowledge that ships with this plugin, plus the
 * fuller library inside the installed Python package when there is one.
 *
 * The packaged copy is not a fallback in the "nice to have" sense: without Docker
 * there is no container to read skills from, so `host` mode would otherwise run
 * with no tool knowledge at all (ADR strix-0002). The Python package's copy wins
 * when present because an engine upgrade may carry newer text.
 */

import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

/** Categories upstream keeps out of the user-facing selector but its agents still load. */
const INTERNAL_CATEGORIES = new Set(["scan_modes", "coordination", "analysis"]);

export interface SkillEntry {
	name: string;
	category: string;
	description: string;
	internal: boolean;
	path: string;
}

export interface SkillLocation {
	root: string;
	/** How it was found, for the panel's diagnostics. */
	source: "python" | "env" | "bundled";
}

/** Ask the interpreter where the package lives; STRIX_SKILLS_DIR overrides for odd installs. */
export async function locateSkills(python = process.env.STRIX_PYTHON || "python"): Promise<SkillLocation | undefined> {
	const override = process.env.STRIX_SKILLS_DIR;
	if (override) return { root: override, source: "env" };
	for (const candidate of [python, "python3", "py"]) {
		const args = candidate === "py" ? ["-3", "-c"] : ["-c"];
		try {
			const { stdout } = await run(
				candidate,
				[...args, "import os, strix; print(os.path.join(os.path.dirname(strix.__file__), 'skills'))"],
				{ timeout: 20_000, windowsHide: true },
			);
			const root = stdout.trim();
			if (root) return { root, source: "python" };
		} catch {
			/* try the next interpreter */
		}
	}
	// No Python package: the packaged tool knowledge is what this build has.
	return { root: packagedSkillsRoot(), source: "bundled" };
}

/**
 * Where the tool knowledge shipped inside the plugin lives.
 *
 * `main.ts` is bundled to `dist/service/main.mjs`, so the package root is two levels
 * up and the knowledge sits beside the plugin's own SKILL.md. It has to live under
 * `agent/` rather than a top-level `assets/`: the packer takes `dist/` plus declared
 * code directories, so anything outside them never reaches the installed package.
 * working directory: the service is started by the host from anywhere.
 */
export function packagedSkillsRoot(): string {
	return fileURLToPath(new URL("../../agent/skills/strix/", import.meta.url));
}

/** Parse YAML-ish frontmatter: the subset skill files use (flat scalars). */
export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (!match) return { meta: {}, body: text.trim() };
	const meta: Record<string, string> = {};
	for (const line of (match[1] ?? "").split(/\r?\n/)) {
		const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!pair) continue;
		const [, key, raw] = pair;
		if (!key) continue;
		meta[key] = (raw ?? "").replace(/^["']|["']$/g, "").trim();
	}
	return { meta, body: text.slice(match[0].length).trim() };
}

/** Every `*.md` under the skill root, grouped the way upstream groups them. */
export async function loadIndex(location: SkillLocation): Promise<{ entries: SkillEntry[]; categories: string[] }> {
	const entries: SkillEntry[] = [];
	let top: string[] = [];
	try {
		top = await readdir(location.root, { withFileTypes: true }).then((items) =>
			items.map((item) => `${item.isDirectory() ? "d:" : "f:"}${item.name}`),
		);
	} catch {
		return { entries, categories: [] };
	}

	const categories = new Set<string>();
	for (const item of top) {
		const isDir = item.startsWith("d:");
		const name = item.slice(2);
		if (name.startsWith("__") || name === "README.md") continue;
		if (!isDir) {
			if (extname(name) !== ".md") continue;
			const path = join(location.root, name);
			entries.push(await describe(path, "root", basename(name, ".md")));
			categories.add("root");
			continue;
		}
		categories.add(name);
		const files = await readdir(join(location.root, name)).catch(() => []);
		for (const file of files) {
			if (extname(file) !== ".md") continue;
			const path = join(location.root, name, file);
			entries.push(await describe(path, name, basename(file, ".md")));
		}
	}
	return { entries, categories: [...categories].sort() };
}

async function describe(path: string, category: string, fallbackName: string): Promise<SkillEntry> {
	let description = "";
	let name = fallbackName;
	try {
		const text = await readFile(path, "utf8");
		const { meta } = parseFrontmatter(text);
		name = meta.name || fallbackName;
		description = (meta.description ?? "").replace(/\s+/g, " ").trim();
	} catch {
		/* an unreadable pack simply lists without a description */
	}
	return { name, category, description, internal: INTERNAL_CATEGORIES.has(category), path };
}

/** Bodies for the requested names; `category/name` disambiguates. */
export async function loadBodies(
	location: SkillLocation,
	names: string[],
): Promise<{ markdown: Record<string, string>; missing: string[] }> {
	const { entries } = await loadIndex(location);
	const markdown: Record<string, string> = {};
	const missing: string[] = [];
	for (const requested of names) {
		const [maybeCategory, maybeName] = requested.includes("/")
			? (requested.split("/", 2) as [string, string])
			: [undefined, requested];
		const hit = entries.find(
			(entry) =>
				(maybeCategory ? entry.category === maybeCategory : true) &&
				(entry.name === maybeName || basename(entry.path, ".md") === maybeName),
		);
		if (!hit) {
			missing.push(requested);
			continue;
		}
		try {
			const text = await readFile(hit.path, "utf8");
			markdown[hit.name] = parseFrontmatter(text).body;
		} catch {
			missing.push(requested);
		}
	}
	return { markdown, missing };
}
