import { describe, expect, it } from "vitest";
import {
	countBySeverity,
	normalizeSeverity,
	severityRank,
	sortBySeverity,
} from "../shared/formatters/severity";

describe("severity vocabulary", () => {
	it("keeps the five upstream buckets and maps long words onto them", () => {
		expect(normalizeSeverity("CRITICAL")).toBe("critical");
		expect(normalizeSeverity("High")).toBe("high");
		expect(normalizeSeverity("moderate")).toBe("medium");
		expect(normalizeSeverity("low-risk")).toBe("low");
	});

	it("keeps an unknown severity visible instead of dropping the finding", () => {
		// A finding the user cannot see is worse than one in the wrong bucket.
		expect(normalizeSeverity("weird")).toBe("info");
		expect(normalizeSeverity(undefined)).toBe("info");
	});

	it("orders critical first", () => {
		expect(severityRank("critical")).toBeLessThan(severityRank("high"));
		const sorted = sortBySeverity([{ severity: "low" }, { severity: "critical" }, { severity: "medium" }]);
		expect(sorted.map((item) => item.severity)).toEqual(["critical", "medium", "low"]);
	});

	it("tallies every bucket, including empty ones", () => {
		const tally = countBySeverity([{ severity: "high" }, { severity: "high" }, { severity: "info" }]);
		expect(tally).toEqual({ critical: 0, high: 2, medium: 0, low: 0, info: 1 });
	});
});
