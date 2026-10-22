import { describe, expect, it } from "vitest";
import { gradeFor, RULES, RULES_BY_ID, ruleFor, SEVERITY_ORDER, SEVERITY_WEIGHT } from "../domain/audit/rules";
import { dedupeFindings, finding, scoreFindings } from "../domain/audit/findings";
import en from "../../locales/en.json";
import zh from "../../locales/zh.json";

describe("rule registry", () => {
	it("has unique ids and a known severity for each rule", () => {
		const ids = RULES.map(rule => rule.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(RULES.length).toBeGreaterThan(20);
		for (const rule of RULES) {
			expect(SEVERITY_ORDER).toContain(rule.severity);
			expect(rule.title.length).toBeGreaterThan(0);
			expect(rule.advice.length).toBeGreaterThan(0);
		}
	});

	it("localises every registered rule in both catalogs", () => {
		const english = en as Record<string, string>;
		const chinese = zh as Record<string, string>;
		for (const rule of RULES) {
			const key = `rule.${rule.id}.title`;
			expect(english[key], `missing ${key} in locales/en.json`).toBeTruthy();
			expect(chinese[key], `missing ${key} in locales/zh.json`).toBeTruthy();
		}
		const registered = new Set(RULES.map(rule => `rule.${rule.id}.title`));
		const catalogs = [english, chinese];
		for (const catalog of catalogs) {
			for (const key of Object.keys(catalog)) {
				if (!key.startsWith("rule.") || !key.endsWith(".title")) continue;
				expect(registered.has(key), `${key} has no rule in RULES`).toBe(true);
			}
		}
	});

	it("keeps both catalogs on the same key set", () => {
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
	});

	it("falls back to an info rule for unknown ids", () => {
		const rule = ruleFor("nope.not-registered");
		expect(rule.severity).toBe("info");
		expect(rule.id).toBe("nope.not-registered");
		expect(RULES_BY_ID.has("nope.not-registered")).toBe(false);
	});
});

describe("scoring", () => {
	it("uses the published weights and caps at 100", () => {
		expect(SEVERITY_WEIGHT).toEqual({ critical: 45, high: 22, medium: 10, low: 4, info: 0 });
		expect(scoreFindings([])).toBe(0);
		expect(scoreFindings([finding("apk.debuggable", "x")])).toBe(SEVERITY_WEIGHT.high);
		expect(scoreFindings([finding("apk.debuggable", "x"), finding("apk.allow-backup", "y")])).toBe(
			SEVERITY_WEIGHT.high + SEVERITY_WEIGHT.medium,
		);
		expect(scoreFindings([finding("apk.debuggable", "x"), finding("apk.debuggable", "again")])).toBe(SEVERITY_WEIGHT.high);
	});

	it("maps scores onto letter grades at the documented cut-offs", () => {
		expect(gradeFor(0)).toBe("A");
		expect(gradeFor(9)).toBe("A");
		expect(gradeFor(10)).toBe("B");
		expect(gradeFor(29)).toBe("B");
		expect(gradeFor(30)).toBe("C");
		expect(gradeFor(54)).toBe("C");
		expect(gradeFor(55)).toBe("D");
		expect(gradeFor(74)).toBe("D");
		expect(gradeFor(75)).toBe("E");
		expect(gradeFor(100)).toBe("E");
	});

	it("collapses repeats of one rule into a single finding with merged evidence", () => {
		const merged = dedupeFindings([
			finding("apk.exported-component", "first", ["a"]),
			finding("apk.exported-component", "second", ["b"]),
			finding("apk.allow-backup", "third"),
		]);
		expect(merged).toHaveLength(2);
		const exported = merged.find(item => item.ruleId === "apk.exported-component");
		expect(exported?.evidence).toEqual(["a", "b"]);
		expect(merged[0]?.severity).toBe("high");
	});
});
