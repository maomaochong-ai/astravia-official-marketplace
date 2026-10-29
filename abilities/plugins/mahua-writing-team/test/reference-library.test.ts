import { describe, expect, it } from "vitest";
import { REFERENCE_LIBRARY } from "../src/reference/library.generated.js";
import {
	DEFAULT_REFERENCE_BUDGET,
	listReferences,
	readReference,
} from "../src/reference/reference-index.js";
import type { ReferenceKind } from "../src/reference/reference-types.js";

const KINDS: ReferenceKind[] = ["guide", "genre", "style", "voice"];

describe("the craft library ships with the plugin (ADR 0012)", () => {
	it("carries every ported document, not a subset", () => {
		// 25 篇 ainovel-cli 移植 + 9 篇 novel-master 改编（ADR 0019 §2）。
		expect(REFERENCE_LIBRARY).toHaveLength(34);
		for (const kind of KINDS) {
			expect(REFERENCE_LIBRARY.some((entry) => entry.kind === kind)).toBe(true);
		}
	});

	it("has unique ids and a title and body on every entry", () => {
		const ids = REFERENCE_LIBRARY.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of REFERENCE_LIBRARY) {
			expect(entry.id.length).toBeGreaterThan(0);
			expect(entry.title.length).toBeGreaterThan(0);
			expect(entry.body.length).toBeGreaterThan(100);
		}
	});

	it("keeps the whole carried corpus, not a trimmed-down sample", () => {
		const total = REFERENCE_LIBRARY.reduce((sum, entry) => sum + entry.body.length, 0);
		expect(total).toBeGreaterThan(30000);
	});

	it("lists the index with an excerpt instead of the whole document", () => {
		const entries = listReferences(REFERENCE_LIBRARY);
		expect(entries).toHaveLength(REFERENCE_LIBRARY.length);
		for (const entry of entries) {
			expect(entry.excerpt.length).toBeGreaterThan(0);
			expect(entry.excerpt.length).toBeLessThanOrEqual(160);
			expect(entry).not.toHaveProperty("body");
		}
	});

	it("filters the index by kind", () => {
		const styles = listReferences(REFERENCE_LIBRARY, { kind: "style" });
		expect(styles.length).toBeGreaterThan(0);
		expect(styles.every((entry) => entry.kind === "style")).toBe(true);
	});
});

describe("reading one entry", () => {
	it("returns the body when it fits the budget", () => {
		const target = REFERENCE_LIBRARY[0];
		const page = readReference(REFERENCE_LIBRARY, target.id);
		expect(page).not.toBeNull();
		expect(page?.truncated).toBe(false);
		expect(page?.body).toBe(target.body);
	});

	it("cuts on a line boundary and says it was cut", () => {
		const target = REFERENCE_LIBRARY.reduce((longest, entry) =>
			entry.body.length > longest.body.length ? entry : longest,
		);
		const budget = 400;
		const page = readReference(REFERENCE_LIBRARY, target.id, budget);
		expect(page?.truncated).toBe(true);
		expect(page?.body.length).toBeLessThanOrEqual(budget);
		// 截断只发生在换行处：最后一行是完整的
		expect(target.body.startsWith(page?.body ?? "x")).toBe(true);
		expect(page?.body.endsWith("\n")).toBe(false);
	});

	it("defaults to the documented budget", () => {
		expect(DEFAULT_REFERENCE_BUDGET).toBe(6000);
	});

	it("returns null for an unknown id instead of inventing a page", () => {
		expect(readReference(REFERENCE_LIBRARY, "no-such-entry")).toBeNull();
	});
});
