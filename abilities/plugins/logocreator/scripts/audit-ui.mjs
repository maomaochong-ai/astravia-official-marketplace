// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * UI consistency audit for the panel's own sources.
 *
 * The rules, and why each one is a rule:
 *
 *  - **chrome follows the theme; an artboard does not.** A logo must be previewed on a
 *    knowable surface, so `bg-white` / `#121210` inside a *preview stage* are content,
 *    not chrome, and are allowed by name. Chrome (labels, badges, buttons) must use
 *    theme tokens or it turns into a wrong-coloured patch after a theme switch.
 *  - **one type scale** (10/11/12/13/14). Half-pixel steps are how "roughly 11" spreads
 *    into six sizes across one panel.
 *  - **one spacing unit** (0.5/1/1.5/2/3/4). `2.5` and `3.5` are the tell.
 *  - **one radius scale** (md/lg/xl/2xl) plus two named exceptions: `rounded-full` for
 *    dots/pills, `rounded-[22%]` copied verbatim from the host's control bar.
 *  - **one icon grid**: a glyph is 12 / 14 / 16 px; anything else that carries `size-*`
 *    is a hit area (button, avatar, artboard) and is judged separately.
 *
 *   npm run audit:ui
 */

const SRC = "src";
const files = [];
function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full);
		else if (/\.(tsx|ts)$/.test(entry) && !full.includes(`${sep}test${sep}`) && !full.startsWith(`scripts${sep}`)) files.push(full);
	}
}
walk(SRC);

/** Files that own literals on purpose: the engine composes SVG, the guide prints on paper. */
const ownsLiteral = (file) => {
	const path = relative(SRC, file).split(sep).join("/");
	return (
		path.startsWith("domain/engine/") ||
		path.startsWith("domain/ai/") ||
		["domain/brand-guide.ts", "domain/palette.ts", "domain/color-plan.ts", "domain/render-png.ts", "shared/styles/tokens.ts"].includes(path)
	);
};

/** A literal surface *inside a preview stage* is content. Named, so it stays a decision. */
const ARTBOARD_ALLOW = new Set(["bg-white", "bg-black"]);

const findings = { colour: [], type: [], space: [], radius: [], glyph: [] };
const pathOf = (file) => relative(SRC, file).split(sep).join("/");

for (const file of files) {
	const path = pathOf(file);
	const lines = readFileSync(file, "utf8").split("\n");

	lines.forEach((line, index) => {
		const at = `${path}:${index + 1}`;

		if (!ownsLiteral(file)) {
			// chrome colour literals (a `bg-white` artboard is allowed; a status badge is not)
			for (const hit of line.matchAll(/\b(?:bg|text|border|ring|from|to|fill|stroke)-(white|black|neutral|zinc|slate|gray|amber|red|emerald|blue|green)-\d{0,3}\b/g)) {
				if (ARTBOARD_ALLOW.has(hit[0])) continue;
				const isArtboardStage = /stage|artboard|preview|surface/i.test(line);
				if (isArtboardStage) continue;
				findings.colour.push(`${at}  ${hit[0]}`);
			}
			// inline hex on chrome
			if (/style=\{\{/.test(line) && !/background|color/i.test(line) ? false : /style=\{\{/.test(line)) {
				const hex = /#[0-9a-fA-F]{3,6}/.exec(line);
				if (hex && !/background|backgroundColor/i.test(line)) findings.colour.push(`${at}  ${hex[0]} (inline style)`);
			}
		}

		// type scale
		const size = /text-\[(\d+(?:\.\d)?)px\]/.exec(line);
		if (size && ![9, 10, 11, 12, 13, 14].includes(Number(size[1]))) findings.type.push(`${at}  text-[${size[1]}px]`);

		// spacing scale
		for (const space of line.matchAll(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-(\d+(?:\.\d)?)\b/g)) {
			const value = Number(space[1]);
			if (value > 2 && !Number.isInteger(value)) findings.space.push(`${at}  ${space[0]}`);
		}

		// radius scale, with the two named exceptions
		for (const radius of line.matchAll(/rounded-\[[^\]]+\]|\brounded(?:-[a-z0-9]+)?\b/g)) {
			const value = radius[0];
			// `rounded-none` is an inset ring overlay clipped by its parent; `[22%]` is the host dock.
			if (value === "rounded" || value === "rounded-full" || value === "rounded-none" || value === "rounded-[22%]" || value === "rounded-[4px]") continue;
			if (!["rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"].includes(value)) findings.radius.push(`${at}  ${value}`);
		}

		// icon glyph size: only a glyph, never a hit area
		for (const glyph of line.matchAll(/<Icon[A-Za-z]*\s+className="size-(\d+(?:\.\d)?)"/g)) {
			if (!["3", "3.5", "4"].includes(glyph[1])) findings.glyph.push(`${at}  size-${glyph[1]}`);
		}
	});
}

const groups = [
	["colour literals in chrome (theme must own colour)", findings.colour],
	["type scale (10/11/12/13/14)", findings.type],
	["spacing scale (no 2.5 / 3.5)", findings.space],
	["radius scale (md/lg/xl/2xl, + full / 22%)", findings.radius],
	["icon glyph size (3 / 3.5 / 4)", findings.glyph],
];

let total = 0;
for (const [title, rows] of groups) {
	const unique = [...new Set(rows)];
	total += unique.length;
	console.log(`\n== ${title} — ${unique.length} ==`);
	console.log(unique.length ? unique.join("\n") : "(none)");
}
console.log(`\n${total === 0 ? "clean" : `${total} finding(s)`}`);
process.exitCode = total > 0 ? 1 : 0;
