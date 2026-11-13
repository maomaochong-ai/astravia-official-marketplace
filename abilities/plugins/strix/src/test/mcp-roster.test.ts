import { describe, expect, it } from "vitest";
import { describeRoster, mergeRoster, normalizeRoster } from "../service/mcp-roster";

/**
 * Upstream docks an MCP panel because a dead connection otherwise looks like the model
 * forgetting its tools. The rules worth pinning are the ones that keep the panel honest:
 * no nameless rows, no invented "dead" for a server that simply has not reported yet, and
 * no hiding a connection the manifest never declared.
 */
describe("mcp roster", () => {
	it("accepts both a bare list and a wrapped payload", () => {
		const rows = [{ name: "strix", provider: "service", tool_count: 32, dead: false }];
		expect(normalizeRoster(rows)).toHaveLength(1);
		expect(normalizeRoster({ connections: rows })[0]?.toolCount).toBe(32);
		expect(normalizeRoster(null)).toEqual([]);
	});

	it("drops rows without a name, because they cannot be attributed", () => {
		expect(normalizeRoster([{ provider: "x" }, { name: "  " }, { name: "ok" }])).toEqual([
			{ name: "ok", provider: "", toolCount: 0, dead: false },
		]);
	});

	it("keeps a declared server pending instead of calling it dead", () => {
		const merged = mergeRoster([{ name: "strix" }], []);
		expect(merged).toEqual([{ name: "strix", provider: "declared", toolCount: 0, dead: false }]);
	});

	it("keeps connections the manifest does not declare", () => {
		const merged = mergeRoster(
			[{ name: "strix" }],
			[{ name: "strix", provider: "service", toolCount: 32, dead: false }, { name: "custom", provider: "stdio", toolCount: 3, dead: true }],
		);
		expect(merged.map((entry) => entry.name)).toEqual(["strix", "custom"]);
		expect(merged[1]?.dead).toBe(true);
	});

	it("describes the roster in one block for the model", () => {
		expect(describeRoster([])).toBe("no MCP connections");
		expect(describeRoster([{ name: "strix", provider: "service", toolCount: 32, dead: false }])).toBe(
			"strix (service): 32 tools",
		);
		expect(describeRoster([{ name: "x", provider: "", toolCount: 0, dead: true }])).toContain("DEAD");
	});
});
