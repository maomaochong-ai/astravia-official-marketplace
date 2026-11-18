import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_IDS } from "./register-tools";

/**
 * The ids and the install paths have exactly one owner each. The preflight script reads them
 * from the source; these tests fail the moment someone pastes a copy back in.
 */
describe("tool ids", () => {
	it("are unique and namespaced", () => {
		expect(new Set(TOOL_IDS).size).toBe(TOOL_IDS.length);
		expect(TOOL_IDS.every((id) => id.startsWith("todesk_"))).toBe(true);
	});

	it("are the eleven the plugin registers", () => {
		expect(TOOL_IDS).toHaveLength(11);
	});

	it("are not re-declared by the preflight script", () => {
		// vitest runs with the plugin directory as cwd.
		const script = readFileSync(join(process.cwd(), "scripts", "preflight.mjs"), "utf8");
		expect(script).not.toMatch(/"todesk_[a-z_]+",/);
		// …and it must actually read them from the source, not guess.
		expect(script).toContain("register-tools.ts");
		expect(script).toContain("TODESK_DIRS");
	});
});
