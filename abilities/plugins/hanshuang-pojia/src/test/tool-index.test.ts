import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANIONS, TOOLCHAIN } from "../domain/toolchain/catalog";

/**
 * `src/content/docs/kit-docs/tool-index.json` 由 `scripts/sync-tool-index.mjs` 从
 * `catalog.ts` 生成。这三个来源必须始终一致，否则 agent 拿到的清单和实际能力会分叉：
 *
 * - `catalog.ts` 决定探测谁、建议谁；
 * - `docs/reference/toolchain-parity.md` 是对 2.0 的 42 项逐条判定（人读）；
 * - `tool-index.json` 是把同一份判定变成机器可读（agent 读）。
 */
const index = JSON.parse(readFileSync(new URL("../content/docs/kit-docs/tool-index.json", import.meta.url), "utf8")) as {
	counts: { total: number; probed: number; advisory: number; unsupported: number };
	availability: string;
	groups: Array<{ id: string; count: number }>;
	tools: Array<{ name: string; kind: string; group: string; purpose?: string; reason?: string }>;
};

const parity = readFileSync(new URL("../../docs/reference/toolchain-parity.md", import.meta.url), "utf8");

/** 从对照表里数出三档的行数，而不是再抄一遍数字。 */
function parityCount(status: string): number {
	return parity.split("\n").filter(line => line.startsWith("| ") && line.includes(`| ${status}`)).length;
}

describe("tool index", () => {
	it("covers all 42 tools from the 2.0 index", () => {
		expect(index.counts.total).toBe(42);
		expect(index.counts.total).toBe(index.counts.probed + index.counts.advisory + index.counts.unsupported);
		expect(index.tools).toHaveLength(42);
	});

	it("matches the catalog it was generated from", () => {
		const probed = index.tools.filter(tool => tool.kind === "probed").map(tool => tool.name);
		const advisory = index.tools.filter(tool => tool.kind === "advisory").map(tool => tool.name);
		expect(probed).toEqual(TOOLCHAIN.map(tool => tool.binary));
		expect(advisory).toEqual(COMPANIONS.map(companion => companion.name));
		expect(index.counts.probed).toBe(TOOLCHAIN.length);
		expect(index.counts.advisory).toBe(COMPANIONS.length);
	});

	it("agrees with the human-readable parity table, row for row", () => {
		expect(parityCount("探测")).toBe(index.counts.probed);
		expect(parityCount("建议")).toBe(index.counts.advisory);
		expect(parityCount("不做")).toBe(index.counts.unsupported);
	});

	it("never claims a tool is installed", () => {
		expect(index.availability).toMatch(/probe_environment/);
		for (const tool of index.tools) expect(tool).not.toHaveProperty("available");
	});

	it("gives every tool a reason and a group that exists", () => {
		const groups = new Set(index.groups.map(group => group.id));
		for (const tool of index.tools) {
			expect(tool.name.length, tool.name).toBeGreaterThan(0);
			expect(groups.has(tool.group), `${tool.name} → ${tool.group}`).toBe(true);
			if (tool.kind === "unsupported") expect(tool.reason, tool.name).toBeTruthy();
			else expect(tool.purpose, tool.name).toBeTruthy();
		}
		expect(new Set(index.tools.map(tool => tool.name)).size).toBe(42);
	});
});
