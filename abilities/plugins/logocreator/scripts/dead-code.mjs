import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

/**
 * Dead-code sweep, for this plugin's own sources only.
 *
 * Two questions, both answerable without a bundler:
 *  1. Is a module never imported? (orphan)
 *  2. Is an *export* never referenced from production code? (zombie)
 *
 * Test-only usage is reported separately rather than counted as "used": a symbol
 * only the tests touch is still weight in the shipped chunk. Run it after moving
 * code around, and keep the output empty.
 *
 *   node scripts/dead-code.mjs
 */

const SRC = "src";
const files = [];
function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full);
		else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
	}
}
walk(SRC);

const TEST_DIR = `${SRC}${sep}test${sep}`;
const isTest = (file) => file.startsWith(TEST_DIR) || file.includes(`${sep}test${sep}`);
const production = files.filter((file) => !isTest(file));
const tests = files.filter(isTest);

const read = (file) => readFileSync(file, "utf8");

const EXPORT_PATTERNS = [
	/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
	/export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/g,
	/export\s+(?:class|interface|type|enum)\s+([A-Za-z0-9_]+)/g,
];

function countWord(text, word) {
	const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
	return (text.match(re) ?? []).length;
}

// ── orphan modules ───────────────────────────────────────────────────────────
const importedBases = new Set();
for (const file of files) {
	for (const match of read(file).matchAll(/from\s+["']([^"']+)["']/g)) {
		const spec = match[1];
		if (!spec.startsWith(".")) continue;
		importedBases.add(basename(spec.replace(/\.(ts|tsx|js)$/, "")));
	}
}

const ENTRY = new Set(["index", "style"]);
const orphans = production.filter((file) => {
	const base = basename(file).replace(/\.(ts|tsx)$/, "");
	return !ENTRY.has(base) && !importedBases.has(base);
});

// ── zombie exports ──────────────────────────────────────────────────────────
const testText = tests.map(read).join("\n");
/**
 * Names that are *supposed* to have no production consumer: test seams that reset
 * module-level state between cases. Listing them is the difference between "a seam"
 * and "a zombie", and it keeps the report actionable instead of noisy.
 */
const TEST_SEAMS = new Set([
	"clearPendingDesigns",
	"clearCanvasPromptState",
	"isCanvasEngaged",
	"catalogKey",
	"CONTRIBUTION_LABEL_KEYS",
	"GLYPH_COUNT",
]);
const zombies = [];
const testOnly = [];

for (const file of production) {
	const text = read(file);
	const others = production.filter((other) => other !== file);
	for (const pattern of EXPORT_PATTERNS) {
		for (const match of text.matchAll(pattern)) {
			const name = match[1];
			const usedElsewhere = others.reduce((sum, other) => sum + countWord(read(other), name), 0);
			// `-1` removes the declaration itself.
			const usedHere = countWord(text, name) - 1;
			if (usedElsewhere + usedHere > 0) continue;
			if (TEST_SEAMS.has(name)) continue;
			if (countWord(testText, name) > 0) testOnly.push(`${relative(SRC, file)}: ${name}`);
			else zombies.push(`${relative(SRC, file)}: ${name}`);
		}
	}
}

// ── dead style tokens ─────────────────────────────────────────────────────────
// A class string nobody composes is the Tailwind-era unused selector: it ships in
// the chunk and documents a look that no longer exists.
const TOKENS_FILE = join(SRC, "shared", "styles", "tokens.ts");
const tokenNames = [...read(TOKENS_FILE).matchAll(/export const ([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
const consumerText = production.filter((file) => file !== TOKENS_FILE).map(read).join("\n");
const deadTokens = tokenNames.filter((name) => countWord(consumerText, name) === 0);
const report = (title, rows) => {
	console.log(`\n== ${title} ==`);
	console.log(rows.length ? rows.join("\n") : "(none)");
};

report("orphan modules (never imported)", orphans.map((f) => relative(SRC, f)));
report("zombie exports (no reference anywhere)", zombies);
report("dead style tokens (never composed)", deadTokens);
report("test-only exports", testOnly);

const total = orphans.length + zombies.length + deadTokens.length;
console.log(`\n${total === 0 ? "clean" : `${total} finding(s)`}`);
process.exitCode = total > 0 ? 1 : 0;
