/**
 * A skill only appears in Astravia's skill picker if its frontmatter survives the
 * host's strict YAML parse — `packages/coding-agent` calls `parse()` from `yaml`
 * and drops the whole skill when it throws
 *
 * The trap is the description: these sentences are long, and one colon-space in
 * the middle of a plain scalar turns the rest of the line into a nested mapping
 * ("Nested mappings are not allowed in compact mappings"). Quoting the value is
 * the whole fix, and this test keeps it quoted. It deliberately does not depend
 * on a YAML library: it only rejects the shapes that make a plain scalar unsafe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
const APPS = ["effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
	"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
	"craft-anything", "designcraft"];

/** Same boundaries the host uses: the document starts with `---` and ends at the next `\n---`. */
function frontmatter(text) {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	assert.ok(normalized.startsWith("---"), "SKILL.md must open with a frontmatter block");
	const end = normalized.indexOf("\n---", 3);
	assert.ok(end !== -1, "SKILL.md frontmatter must be closed by a --- line");
	return normalized.slice(4, end);
}

/** Reject every plain-scalar shape that a strict parser reads as something other than text. */
function assertPlainScalarIsSafe(key, value, where) {
	if (value === "") return;
	if (value.startsWith('"')) {
		assert.ok(value.length > 1 && value.endsWith('"'), `${where}: unterminated quoted ${key}`);
		assert.ok(!/(?<!\\)"/.test(value.slice(1, -1)), `${where}: unescaped quote inside ${key}`);
		return;
	}
	assert.ok(!value.includes(": "), `${where}: ${key} has a colon-space and is not quoted`);
	assert.ok(!value.includes(" #"), `${where}: ${key} has a bare comment marker and is not quoted`);
	assert.ok(!/^[!&*|>%@`[\]{}]/.test(value), `${where}: ${key} starts with a YAML indicator`);
}

test("every craft skill has frontmatter a strict YAML parser accepts", () => {
	const problems = [];
	for (const app of APPS) {
		const where = `${app}/agent/skills/${app}/SKILL.md`;
		const fields = new Map();
		for (const line of frontmatter(readFileSync(join(ROOT, where), "utf8")).split("\n")) {
			if (line.trim() === "" || /^\s/.test(line)) continue;
			const match = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
			if (!match) {
				problems.push(`${where}: cannot read frontmatter line ${JSON.stringify(line)}`);
				continue;
			}
			fields.set(match[1], match[2]);
		}
		for (const [key, value] of fields) {
			try {
				assertPlainScalarIsSafe(key, value, where);
			} catch (error) {
				problems.push(error.message.replace(/^AssertionError \[ERR_ASSERTION\]: /, ""));
			}
		}
		const name = (fields.get("name") ?? "").replace(/^"|"$/g, "");
		if (name !== app) problems.push(`${where}: name is ${JSON.stringify(name)}, expected ${app}`);
		if (!fields.get("description")) problems.push(`${where}: description is missing`);
	}
	assert.deepEqual(problems, []);
});
