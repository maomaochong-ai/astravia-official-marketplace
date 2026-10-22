#!/usr/bin/env node
/**
 * Keeps the Hanshuang Pojia agent document in sync with the two places that read it.
 *
 *   1. `<plugin>/AGENTS.md`                     — the copy the host injects into every session
 *                                                   through `agent.systemPrompt.promptPaths`
 *   2. `<agentDir>/AGENTS.md`                     — the same text as a user-level instruction file,
 *                                                   the equivalent of `~/.claude/CLAUDE.md`
 *
 * Usage
 *   node scripts/sync-agent-doc.mjs                 write/refresh the user-level file
 *   node scripts/sync-agent-doc.mjs --check         exit 1 when either copy is out of date
 *   node scripts/sync-agent-doc.mjs --print         print the resolved paths, change nothing
 *   node scripts/sync-agent-doc.mjs --from <md>     copy <md> into the plugin root as AGENTS.md
 *   node scripts/sync-agent-doc.mjs --target <dir>  install into <dir>/AGENTS.md instead
 *   node scripts/sync-agent-doc.mjs --remove        drop the managed block again
 *
 * The user-level file is edited in place: the text lives between
 * `<!-- hanshuang-pojia:begin -->` and `<!-- hanshuang-pojia:end -->`, so anything the user wrote around it
 * survives. Running the script twice changes nothing the second time.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BEGIN = "<!-- hanshuang-pojia:begin -->";
const END = "<!-- hanshuang-pojia:end -->";
const DOC_NAME = "AGENTS.md";
const TARGET_NAME = "AGENTS.md";

// The block this plugin wrote before it was renamed. Stripped wherever the current block is
// stripped, so a machine that already carries the old copy does not end up with both.
const LEGACY_MARKERS = [["<!-- frostbreak:begin -->", "<!-- frostbreak:end -->"]];

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(pluginRoot, DOC_NAME);

function expandHome(value) {
	return value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
}

/**
 * Mirrors the host's own resolution so a dev or per-tenant install writes to the directory the
 * agent actually reads. Order: ASTRAVIA_CODING_AGENT_DIR, then the home root plus `agent`.
 */
function resolveAgentDir() {
	const explicit = process.env.ASTRAVIA_CODING_AGENT_DIR;
	if (explicit) return resolve(expandHome(explicit));
	const home =
		process.env.ASTRAVIA_HOME || process.env.ASTRAVIA_CONFIG_DIR || join(homedir(), ".astravia");
	return join(resolve(expandHome(home)), "agent");
}

function parseArgs(argv) {
	const options = { check: false, print: false, remove: false, from: null, target: null };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--check") options.check = true;
		else if (argument === "--print") options.print = true;
		else if (argument === "--remove") options.remove = true;
		else if (argument === "--from") options.from = argv[++index] ?? null;
		else if (argument === "--target") options.target = argv[++index] ?? null;
		else if (argument === "--help" || argument === "-h") options.help = true;
		else {
			console.error(`sync-agent-doc: unknown argument "${argument}"`);
			process.exit(2);
		}
	}
	return options;
}

function readSource() {
	if (!existsSync(sourcePath)) {
		console.error(`sync-agent-doc: ${DOC_NAME} is missing from the plugin root`);
		process.exit(1);
	}
	const text = readFileSync(sourcePath, "utf8").trimEnd();
	if (text.length === 0) {
		console.error(`sync-agent-doc: ${DOC_NAME} is empty`);
		process.exit(1);
	}
	return `${text}\n`;
}

function stripBlock(text, begin = BEGIN, end = END) {
	const start = text.indexOf(begin);
	const endIndex = text.indexOf(end);
	if (start === -1 || endIndex === -1 || endIndex < start) return text;
	const before = text.slice(0, start);
	const after = text.slice(endIndex + end.length);
	return `${before.trimEnd()}\n${after.trimStart()}`.trim() === ""
		? ""
		: `${before.trimEnd()}\n${after.replace(/^\n+/, "")}`;
}

function stripAll(text) {
	return LEGACY_MARKERS.reduce(
		(current, [begin, end]) => stripBlock(current, begin, end),
		stripBlock(text),
	);
}

function mergeBlock(existing, body) {
	const block = `${BEGIN}\n${body}${END}\n`;
	const stripped = stripAll(existing);
	if (stripped.trim().length === 0) return block;
	return `${stripped.trimEnd()}\n\n${block}`;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		console.log("node scripts/sync-agent-doc.mjs [--check|--print|--remove|--from <md>|--target <dir>]");
		return;
	}

	if (options.from) {
		const fromPath = resolve(process.cwd(), expandHome(options.from));
		if (!existsSync(fromPath)) {
			console.error(`sync-agent-doc: ${fromPath} does not exist`);
			process.exit(1);
		}
		const incoming = readFileSync(fromPath, "utf8");
		if (incoming.trim().length === 0) {
			console.error(`sync-agent-doc: ${fromPath} is empty`);
			process.exit(1);
		}
		writeFileSync(sourcePath, incoming.endsWith("\n") ? incoming : `${incoming}\n`);
		console.log(`copied ${fromPath} -> ${sourcePath}`);
		return;
	}

	const targetDir = options.target ? resolve(process.cwd(), expandHome(options.target)) : resolveAgentDir();
	const targetPath = join(targetDir, TARGET_NAME);

	if (options.print) {
		console.log(`source: ${sourcePath}`);
		console.log(`target: ${targetPath}`);
		return;
	}

	const existing = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
	const next = options.remove ? `${stripAll(existing).trimEnd()}\n` : mergeBlock(existing, readSource());

	if (next === existing) {
		console.log(`unchanged: ${targetPath}`);
		return;
	}

	if (options.check) {
		console.error(
			options.remove
				? `stale: ${targetPath} still carries a managed block`
				: `stale: ${targetPath} does not match ${sourcePath}`,
		);
		process.exit(1);
	}

	if (options.remove && next.trim().length === 0 && existsSync(targetPath)) {
		writeFileSync(targetPath, "");
		console.log(`cleared: ${targetPath}`);
		return;
	}

	mkdirSync(targetDir, { recursive: true });
	writeFileSync(targetPath, next);
	console.log(`wrote: ${targetPath} (${next.length} bytes)`);
}

main();
