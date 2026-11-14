/**
 * `strix_patch` — upstream's file editor, without upstream's SDK.
 *
 * Upstream surfaces this as `patch` (`agents.sandbox.capabilities.tools.apply_patch_tool`,
 * renamed via `_TOOL_NAME_OVERRIDES`), and the model is explicitly told to prefer it over
 * `exec_command` for edits: a heredoc through a shell mangles quotes, eats backslashes and
 * cannot be reviewed. The wire format is the same one that tool documents.
 *
 * Two layers, deliberately separated:
 *
 *  - **parse + apply** are pure string functions over file content. They are where the
 *    bugs live (fuzzy anchors, CRLF, context that matches twice), so they are tested
 *    against the same edge cases upstream's implementation has to survive.
 *  - **reading and writing** happen in the sandbox; this module never touches the disk.
 *
 * The format:
 *
 *     *** Begin Patch
 *     *** Add File: src/new.ts
 *     +export const x = 1;
 *     *** Update File: src/old.ts
 *     @@ export function f() {
 *     -  return 1;
 *     +  return 2;
 *     *** Delete File: src/gone.ts
 *     *** End Patch
 *
 * Every line of a file body carries a prefix: `+` added, `-` removed, ` ` context.
 * A line without a prefix inside an Update hunk is treated as context, because models
 * drop it constantly and rejecting the whole patch over one space is not useful.
 */

export type PatchOperation =
	| { kind: "add"; path: string; content: string }
	| { kind: "delete"; path: string }
	| {
			kind: "update";
			path: string;
			hunks: Array<{ anchor?: string; before: string[]; after: string[] }>;
	  };

export interface ParsedPatch {
	operations: PatchOperation[];
	/** Human-readable problems; a patch with any of these must not be applied. */
	errors: string[];
}

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const ADD = "*** Add File: ";
const DELETE = "*** Delete File: ";
const UPDATE = "*** Update File: ";
const MOVE = "*** Move to: ";

/** Normalise to LF so a patch written on Windows applies inside a Linux container. */
function toLf(text: string): string {
	return text.replace(/\r\n/g, "\n");
}

function trimmedPath(value: string): string {
	return value.trim().replace(/^["']|["']$/g, "");
}

/**
 * Parse a patch document.
 *
 * Lenient about formatting, strict about meaning: unknown `***` directives are errors
 * (a typo there would silently apply half a patch), but bare context lines, trailing
 * whitespace and missing `@@` anchors are accepted.
 */
export function parsePatch(input: string): ParsedPatch {
	const operations: PatchOperation[] = [];
	const errors: string[] = [];
	const lines = toLf(input).split("\n");

	let index = 0;
	// Text before `*** Begin Patch` is allowed (models like to explain first); text after
	// `*** End Patch` is ignored. Only the bracketed body is a patch.
	const begin = lines.findIndex((line) => line.trim() === BEGIN);
	if (begin === -1) {
		return { operations, errors: ["patch must start with *** Begin Patch"] };
	}
	index = begin + 1;

	const end = lines.findIndex((line, at) => at > begin && line.trim() === END);
	if (end === -1) errors.push("patch is missing *** End Patch");

	const body = lines.slice(index, end === -1 ? lines.length : end);
	let current: PatchOperation | null = null;
	let pending: { anchor?: string; before: string[]; after: string[] } | null = null;

	const flushHunk = (): void => {
		if (current?.kind === "update" && pending) current.hunks.push(pending);
		pending = null;
	};

	for (const raw of body) {
		const line = raw.replace(/\s+$/, "");

		if (line.startsWith(ADD)) {
			flushHunk();
			current = { kind: "add", path: trimmedPath(line.slice(ADD.length)), content: "" };
			operations.push(current);
			continue;
		}
		if (line.startsWith(DELETE)) {
			flushHunk();
			current = { kind: "delete", path: trimmedPath(line.slice(DELETE.length)) };
			operations.push(current);
			continue;
		}
		if (line.startsWith(UPDATE)) {
			flushHunk();
			current = { kind: "update", path: trimmedPath(line.slice(UPDATE.length)), hunks: [] };
			operations.push(current);
			continue;
		}
		if (line.startsWith(MOVE)) {
			// Renames are not part of this surface: the model can add + delete instead, and
			// silently moving a file would lose the operator's own edits to it.
			errors.push("*** Move to: is not supported; use Delete File + Add File");
			continue;
		}
		if (line.startsWith("***")) {
			errors.push(`unrecognised directive: ${line.trim().slice(0, 40)}`);
			continue;
		}
		if (!current) {
			if (line.trim()) errors.push(`content before any file header: ${line.slice(0, 40)}`);
			continue;
		}

		if (current.kind === "add") {
			if (line.startsWith("+")) current.content += `${line.slice(1)}\n`;
			else if (line.trim()) current.content += `${line}\n`;
			continue;
		}
		if (current.kind === "delete") continue;

		if (line.startsWith("@@")) {
			flushHunk();
			const anchor = line.slice(2).trim();
			pending = { ...(anchor ? { anchor } : {}), before: [], after: [] };
			continue;
		}
		if (!pending) pending = { before: [], after: [] };
		if (line.startsWith("+")) pending.after.push(line.slice(1));
		else if (line.startsWith("-")) pending.before.push(line.slice(1));
		else pending.after.push(line.replace(/^ /, ""));
	}
	flushHunk();

	for (const operation of operations) {
		if (!operation.path) errors.push(`${operation.kind}: empty path`);
		if (operation.kind === "update" && operation.hunks.length === 0) {
			errors.push(`update ${operation.path}: no hunks`);
		}
	}
	if (operations.length === 0 && errors.length === 0) errors.push("patch contains no file operations");
	return { operations, errors };
}

/** One replacement in a file: which lines go, which arrive, and where. */
interface Replacement {
	start: number;
	remove: number;
	insert: string[];
}

/**
 * Locate one hunk in the file.
 *
 * Strategy, in order — the same tolerance upstream needs because models reproduce context
 * from memory:
 *  1. the anchor line (`@@ …`) if it appears exactly once;
 *  2. the `before` block, exactly;
 *  3. the `before` block with whitespace collapsed, when it appears exactly once.
 *
 * A hunk whose context matches twice is ambiguous and is reported, not guessed: picking
 * the first occurrence is how a patch edits the wrong function.
 */
function locate(lines: readonly string[], hunk: { anchor?: string; before: string[] }, from: number): number | -1 | -2 {
	const anchor = hunk.anchor?.trim();

	// 1. An anchor narrows the search *first*. A `@@ function handle() {` line that occurs
	//    once is the strongest signal there is; using it only as a tiebreaker would report
	//    "ambiguous" on a file the author told us exactly where to edit.
	if (anchor) {
		const anchors = lines
			.map((line, index) => (index >= from && line.trim() === anchor ? index : -1))
			.filter((index) => index >= 0);
		if (anchors.length > 1) return -2;
		if (anchors.length === 1) {
			const at = anchors[0] as number;
			// The hunk's context sits at or after the anchor line; if the anchor *is* the
			// first context line, the match starts there.
			if (hunk.before.length === 0) return at;
			if (lines[at]?.trim() === (hunk.before[0] ?? "").trim()) return at;
			const after = findAll(lines, hunk.before, at, false);
			if (after.length === 1) return after[0] as number;
			const looseAfter = findAll(lines, hunk.before, at, true);
			return looseAfter.length === 1 ? (looseAfter[0] as number) : -1;
		}
		// Anchor not present: fall through to context matching, which may still work.
	}

	if (hunk.before.length === 0) return -1;

	// 2. The context block, exactly.
	const exact = findAll(lines, hunk.before, from, false);
	if (exact.length === 1) return exact[0] as number;
	if (exact.length > 1) return -2;

	// 3. The context block with whitespace collapsed.
	const loose = findAll(lines, hunk.before, from, true);
	if (loose.length === 1) return loose[0] as number;
	if (loose.length > 1) return -2;
	return -1;
}

function findAll(lines: readonly string[], needle: readonly string[], from: number, loose: boolean): number[] {
	const found: number[] = [];
	const normalise = (value: string): string => (loose ? value.replace(/\s+/g, " ").trim() : value.trimEnd());
	const target = needle.map(normalise);
	for (let index = from; index <= lines.length - target.length; index += 1) {
		let matched = true;
		for (let offset = 0; offset < target.length; offset += 1) {
			if (normalise(lines[index + offset]) !== target[offset]) {
				matched = false;
				break;
			}
		}
		if (matched) found.push(index);
	}
	return found;
}

export interface ApplyResult {
	ok: boolean;
	content?: string;
	error?: string;
	/** How many hunks landed; useful in the tool result so the model can double-check. */
	applied?: number;
}

/** Apply one update's hunks to its current content. Pure: same inputs, same result. */
export function applyUpdate(current: string, hunks: ReadonlyArray<{ anchor?: string; before: string[]; after: string[] }>): ApplyResult {
	const lines = toLf(current).split("\n");
	const replacements: Replacement[] = [];
	let cursor = 0;

	for (const [position, hunk] of hunks.entries()) {
		const at = locate(lines, hunk, cursor);
		if (at === -2) {
			return { ok: false, error: `hunk ${position + 1}: context matches more than one place in the file` };
		}
		if (at === -1) {
			const sample = hunk.before.slice(0, 2).join(" / ") || hunk.anchor || "(empty)";
			return { ok: false, error: `hunk ${position + 1}: context not found — ${sample}` };
		}
		replacements.push({ start: at, remove: hunk.before.length, insert: hunk.after });
		cursor = at + Math.max(hunk.before.length, 1);
	}

	// Apply back-to-front so earlier indices stay valid.
	for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
		lines.splice(replacement.start, replacement.remove, ...replacement.insert);
	}
	return { ok: true, content: lines.join("\n"), applied: replacements.length };
}

/** The whole patch, applied to a reader that knows the current content of a path. */
export function applyPatch(
	patch: ParsedPatch,
	read: (path: string) => string | undefined,
): { files: Array<{ path: string; content: string | null }>; errors: string[] } {
	const files: Array<{ path: string; content: string | null }> = [];
	const errors = [...patch.errors];
	if (errors.length) return { files, errors };

	for (const operation of patch.operations) {
		if (operation.kind === "add") {
			if (read(operation.path) !== undefined) {
				errors.push(`add ${operation.path}: file already exists`);
				continue;
			}
			files.push({ path: operation.path, content: operation.content });
			continue;
		}
		if (operation.kind === "delete") {
			if (read(operation.path) === undefined) {
				errors.push(`delete ${operation.path}: no such file`);
				continue;
			}
			files.push({ path: operation.path, content: null });
			continue;
		}
		const current = read(operation.path);
		if (current === undefined) {
			errors.push(`update ${operation.path}: no such file`);
			continue;
		}
		const result = applyUpdate(current, operation.hunks);
		if (!result.ok || result.content === undefined) {
			errors.push(`update ${operation.path}: ${result.error ?? "failed"}`);
			continue;
		}
		files.push({ path: operation.path, content: result.content });
	}
	return { files, errors };
}
