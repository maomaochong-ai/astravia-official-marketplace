import { describe, expect, it } from "vitest";
import { dayKey, parseUsage, summarizeUsage } from "./usage-store";

const sample = JSON.stringify([
	{ date: "20261118", usageinfo: [{ count: 3, deviceid: "111222333" }] },
	{ date: "20261117", usageinfo: [{ count: 2, deviceid: "111222333" }, { count: 1, deviceid: "444555666" }] },
	{ date: "20261110", usageinfo: [{ count: 5, deviceid: "444555666" }] },
]);

describe("parseUsage", () => {
	it("reads day buckets, newest first", () => {
		const days = parseUsage(sample);
		expect(days).toHaveLength(3);
		expect(days[0].date).toBe("20261118");
		expect(days[0].entries).toEqual([{ deviceId: "111222333", count: 3 }]);
	});

	it("drops malformed days and entries instead of failing the whole read", () => {
		const days = parseUsage(
			JSON.stringify([
				{ date: "bad", usageinfo: [{ count: 1, deviceid: "111222333" }] },
				{ date: "20261118", usageinfo: [{ count: 0, deviceid: "111222333" }, { count: 2, deviceid: "x" }, { count: 4, deviceid: "444555666" }] },
			]),
		);
		expect(days).toHaveLength(1);
		expect(days[0].entries).toEqual([{ deviceId: "444555666", count: 4 }]);
	});

	it("returns nothing for unreadable input", () => {
		expect(parseUsage("{")).toEqual([]);
		expect(parseUsage("{}")).toEqual([]);
	});
});

describe("summarizeUsage", () => {
	const days = parseUsage(sample);

	it("totals per device over the whole file", () => {
		const summary = summarizeUsage(days);
		expect(summary.total).toBe(11);
		expect(summary.byDevice).toEqual([
			{ deviceId: "444555666", count: 6 },
			{ deviceId: "111222333", count: 5 },
		]);
		expect(summary.to).toBe("20261118");
		expect(summary.from).toBe("20261110");
	});

	it("honours the day window, so 'today' does not count last week", () => {
		const today = new Date(2026, 10, 18); // 2026-11-18 local, the newest bucket
		expect(summarizeUsage(days, 1, today).total).toBe(3);
		expect(summarizeUsage(days, 2, today).total).toBe(6);
		expect(summarizeUsage(days, 7, today).total).toBe(6);
	});
});

describe("dayKey", () => {
	it("uses local time, because the client writes local dates", () => {
		expect(dayKey(new Date(2026, 0, 5))).toBe("20260105");
	});
});
