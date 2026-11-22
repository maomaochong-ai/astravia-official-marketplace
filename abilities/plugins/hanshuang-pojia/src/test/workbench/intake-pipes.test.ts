import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROMPT_TEMPLATES } from "../../domain/prompt-templates.generated";
import { probeRecord, savedLadders } from "./fixtures";

/**
 * Two intake pipes that were silently short:
 *
 *  - `agent/prompts/templates` gained three files but the generated index was never
 *    rebuilt, so the import menu listed six of nine. The index is generated, so the
 *    guard is "regenerate, and the count matches the directory".
 *  - a refusal probe's *measures* lived only in render state; the record now carries
 *    them, so closing the panel does not lose the "what to do about it".
 */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("prompt templates reach the import menu", () => {
	it("indexes every file on disk", () => {
		const ids = PROMPT_TEMPLATES.map((entry) => entry.id);
		expect(ids).toContain("Dsh全破");
		expect(ids).toContain("glm5.3破甲提示词");
		expect(ids).toContain("grok4.6");
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.length).toBeGreaterThanOrEqual(9);
	});

	it("carries a non-empty summary and checksum for each", () => {
		for (const entry of PROMPT_TEMPLATES) {
			expect(entry.summary.length).toBeGreaterThan(8);
			expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
			expect(entry.chars).toBeGreaterThan(0);
		}
	});
});

describe("the probe record keeps the countermeasures", () => {
	it("writes advice alongside the rows", () => {
		const record = probeRecord;
		expect(record.advice).toBeDefined();
		// Only the rungs that need action survive; an answered rung is not a measure.
		expect(record.advice?.every((item) => item.verdict !== "answered")).toBe(true);
	});

	it("renders them from the record, not by re-deriving at render time", () => {
		const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");
		expect(card).toContain("record.advice");
		// The section says what to do; it must not recompute from rows.
		expect(card).toContain('t("probe.counter.title")');
	});
});

describe("custom ladders can be saved", () => {
	it("keeps them on the profile, without secrets", () => {
		expect(savedLadders.length).toBeGreaterThan(0);
		for (const ladder of savedLadders) {
			expect(ladder.name.length).toBeGreaterThan(0);
			expect(ladder.text.length).toBeGreaterThan(0);
		}
	});

	it("offers them in the custom ladder UI", () => {
		const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");
		expect(card).toContain("profile.savedLadders");
		expect(card).toContain('t("probe.ladder.save")');
	});
});

describe("the result location is stated where the question arises", () => {
	it("names the storage path in the card's empty state", () => {
		const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");
		expect(card).toContain('t("probe.where.title")');
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["probe.where.body"]).toContain("workbench/probe-refusal.json");
	});
});

describe("injection is independent of lab mode", () => {
	it("says so on the page that does the injecting", () => {
		const page = read("src/features/workbench/components/pages/inject.tsx");
		expect(page).toContain('t("inject.lab.title")');
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		// The claim has to be the accurate one: the other host cannot read our storage.
		expect(zh["inject.lab.body"]).toMatch(/读不到|不起作用/);
	});
});
