import { describe, expect, it } from "vitest";
import { applyPatch, applyUpdate, parsePatch } from "\.\./service/patch";

/**
 * The patch surface, held to the cases that actually break it.
 *
 * Upstream hands this to the SDK's `ApplyPatchTool`; here it is our own parser, so the
 * edge cases are ours to get right: CRLF from a Windows host against a Linux container,
 * context that matches twice, context the model half-remembers, and a body full of quotes
 * that a heredoc would have destroyed.
 */

const wrap = (body: string): string => `*** Begin Patch\n${body}\n*** End Patch`;

describe("parsing", () => {
	it("reads add / update / delete in one document", () => {
		const parsed = parsePatch(
			wrap(
				[
					"*** Add File: src/new.ts",
					"+export const x = 1;",
					"*** Update File: src/old.ts",
					"@@ export function f() {",
					"-  return 1;",
					"+  return 2;",
					"*** Delete File: src/gone.ts",
				].join("\n"),
			),
		);
		expect(parsed.errors).toEqual([]);
		expect(parsed.operations.map((operation) => operation.kind)).toEqual(["add", "update", "delete"]);
		expect(parsed.operations[0]).toMatchObject({ kind: "add", path: "src/new.ts", content: "export const x = 1;\n" });
	});

	it("ignores prose before Begin and after End", () => {
		const parsed = parsePatch(
			`Writing the fix now.\n${wrap("*** Delete File: a.txt")}\nDone — that removes the file.`,
		);
		expect(parsed.errors).toEqual([]);
		expect(parsed.operations).toHaveLength(1);
	});

	it("refuses a document with no Begin marker", () => {
		expect(parsePatch("*** Update File: a.txt\n@@ x\n-y\n+z").errors[0]).toContain("*** Begin Patch");
	});

	it("reports an unknown directive instead of half-applying", () => {
		const parsed = parsePatch(wrap("*** Rename File: a -> b\n*** Delete File: a.txt"));
		expect(parsed.errors.some((error) => error.includes("unrecognised"))).toBe(true);
	});

	it("rejects a move: a silent rename would lose the operator's own edits", () => {
		const parsed = parsePatch(wrap("*** Update File: a.txt\n*** Move to: b.txt"));
		expect(parsed.errors.join(" ")).toContain("Move to");
	});

	it("keeps every file operation out when any error is present", () => {
		const parsed = parsePatch(wrap("*** Add File: \n+x"));
		const applied = applyPatch(parsed, () => undefined);
		expect(applied.files).toEqual([]);
		expect(applied.errors.length).toBeGreaterThan(0);
	});
});

describe("applying an update", () => {
	it("replaces the matched lines", () => {
		const result = applyUpdate("line a\nline b\nline c\n", [
			{ before: ["line b"], after: ["line B", "line B2"] },
		]);
		expect(result.ok).toBe(true);
		expect(result.content).toBe("line a\nline B\nline B2\nline c\n");
	});

	it("does not care whether the file uses CRLF", () => {
		const result = applyUpdate("line a\r\nline b\r\n", [{ before: ["line b"], after: ["line B"] }]);
		expect(result.ok).toBe(true);
		expect(result.content).toBe("line a\nline B\n");
	});

	it("uses @@ to disambiguate context that appears twice", () => {
		const file = "function one() {\n  return 1;\n}\nfunction two() {\n  return 1;\n}\n";
		// Bare context is ambiguous …
		const ambiguous = applyUpdate(file, [{ before: ["  return 1;"], after: ["  return 2;"] }]);
		expect(ambiguous.ok).toBe(false);
		expect(ambiguous.error).toContain("more than one place");

		// … and the anchor resolves it, in this case to the later occurrence.
		const anchored = applyUpdate(file, [
			{ anchor: "function two() {", before: ["  return 1;"], after: ["  return 2;"] },
		]);
		expect(anchored.ok).toBe(true);
		expect(anchored.content).toContain("function two() {\n  return 2;");
		expect(anchored.content).toContain("function one() {\n  return 1;");
	});

	it("tolerates whitespace drift in the model's memory of the context", () => {
		const file = "if (x) {\n\t\treturn value;\n}\n";
		const result = applyUpdate(file, [{ before: ["if (x) {", "  return value;"], after: ["if (x) {", "  return other;"] }]);
		expect(result.ok).toBe(true);
		expect(result.content).toContain("return other;");
	});

	it("fails loudly when the context is not there at all", () => {
		const result = applyUpdate("a\nb\n", [{ before: ["nope"], after: ["x"] }]);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("context not found");
	});

	it("keeps quotes, backslashes and $ verbatim", () => {
		const payload = 'const s = "a\\b $HOME `id`";';
		const result = applyUpdate("placeholder\n", [{ before: ["placeholder"], after: [payload] }]);
		expect(result.content).toBe(`${payload}\n`);
	});

	it("applies several hunks back to front so indices stay valid", () => {
		const file = ["one", "two", "three", "four", "five"].join("\n");
		const result = applyUpdate(file, [
			{ before: ["two"], after: ["TWO"] },
			{ before: ["four"], after: ["FOUR", "FOUR2"] },
		]);
		expect(result.ok).toBe(true);
		expect(result.content).toBe(["one", "TWO", "three", "FOUR", "FOUR2", "five"].join("\n"));
	});
});

describe("applying a whole patch", () => {
	const read = (files: Record<string, string>) => (path: string) => files[path];

	it("writes every file it was asked to", () => {
		const parsed = parsePatch(
			wrap(
				[
					"*** Add File: poc.py",
					"+print('boom')",
					"*** Update File: notes.md",
					"@@ ## Findings",
					"-nothing yet",
					"+one IDOR",
				].join("\n"),
			),
		);
		const applied = applyPatch(parsed, read({ "notes.md": "## Findings\nnothing yet\n" }));
		expect(applied.errors).toEqual([]);
		expect(applied.files).toEqual([
			{ path: "poc.py", content: "print('boom')\n" },
			{ path: "notes.md", content: "## Findings\none IDOR\n" },
		]);
	});

	it("will not add a file that already exists", () => {
		const parsed = parsePatch(wrap("*** Add File: a.txt\n+new"));
		const applied = applyPatch(parsed, read({ "a.txt": "old" }));
		expect(applied.errors[0]).toContain("already exists");
	});

	it("will not update a file that is not there", () => {
		const parsed = parsePatch(wrap("*** Update File: missing.txt\n@@ x\n-a\n+b"));
		const applied = applyPatch(parsed, read({}));
		expect(applied.errors[0]).toContain("no such file");
	});

	it("represents a delete as null content", () => {
		const parsed = parsePatch(wrap("*** Delete File: gone.txt"));
		const applied = applyPatch(parsed, read({ "gone.txt": "x" }));
		expect(applied.files).toEqual([{ path: "gone.txt", content: null }]);
	});
});
