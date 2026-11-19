import { describe, expect, it } from "vitest";

import { caseFromReport, MAX_MY_CASES, sanitizeCases, upsertCase, type MyCase } from "../../domain/my-cases";
import type { TriageReport } from "../../domain/report/report";

function report(overrides: Partial<TriageReport> = {}): TriageReport {
	return {
		schemaVersion: 1,
		mode: "summary",
		target: {
			path: "/work/demo.apk",
			name: "demo.apk",
			size: 4_194_304,
			sha256: "a".repeat(64),
			format: "apk",
			formatLabel: "Android package (APK)",
			generatedAt: "2026-11-18T10:00:00.000Z",
		},
		risk: { score: 70, grade: "D", drivers: [] },
		summary: ["two high findings"],
		findings: [
			{ ruleId: "apk.debuggable", severity: "high", title: "Application is debuggable", detail: "", evidence: [] },
			{ ruleId: "apk.cleartext", severity: "medium", title: "Cleartext traffic allowed", detail: "", evidence: [] },
			{ ruleId: "apk.minSdk", severity: "info", title: "Very old minSdk", detail: "", evidence: [] },
		],
		facts: [],
		sections: [],
		limits: [],
		signature: { v1: true, v2: true, v3: false, schemes: [] },
		...overrides,
	} as TriageReport;
}

describe("我的案例：报告沉淀成条目", () => {
	it("把报告折成一条可读条目，id 与样本库同口径", () => {
		const entry = caseFromReport(report());
		expect(entry.id).toBe(`${"a".repeat(16)}-4194304`);
		expect(entry.name).toBe("demo.apk");
		expect(entry.grade).toBe("D");
		expect(entry.findings).toBe(3);
		expect(entry.seen).toBe(1);
		// 亮点只取非 info 的前三条：info 是提示，不该占「一眼看到」的位置。
		expect(entry.highlights).toEqual(["high: Application is debuggable", "medium: Cleartext traffic allowed"]);
	});

	it("没有非 info 的发现时退回报告摘要，而不是空数组", () => {
		const entry = caseFromReport(
			report({
				findings: [{ ruleId: "apk.minSdk", severity: "info", title: "old", detail: "", evidence: [] }],
			} as Partial<TriageReport>),
		);
		expect(entry.highlights).toEqual(["two high findings"]);
	});
});

describe("我的案例：写入", () => {
	it("同一份样本重复分析是累加次数，不是新增第二条", () => {
		const first = caseFromReport(report());
		const second = caseFromReport(
			report({ target: { ...report().target, generatedAt: "2026-11-19T10:00:00.000Z" } }),
		);
		const list = upsertCase(upsertCase([], first), second);
		expect(list).toHaveLength(1);
		expect(list[0]?.seen).toBe(2);
		// 首次沉淀时间保留，最近时间更新：前者是历史，后者是排序键。
		expect(list[0]?.at).toBe("2026-11-18T10:00:00.000Z");
		expect(list[0]?.lastSeenAt).toBe("2026-11-19T10:00:00.000Z");
	});

	it("按最近分析时间倒序", () => {
		const older = caseFromReport(report());
		const newer = caseFromReport(
			report({
				target: {
					...report().target,
					name: "newer.apk",
					sha256: "b".repeat(64),
					generatedAt: "2026-11-19T10:00:00.000Z",
				},
			}),
		);
		const list = upsertCase(upsertCase([], older), newer);
		expect(list.map(item => item.name)).toEqual(["newer.apk", "demo.apk"]);
	});

	it("超过上限时丢最旧的", () => {
		let list: MyCase[] = [];
		for (let index = 0; index < MAX_MY_CASES + 5; index += 1) {
			list = upsertCase(
				list,
				caseFromReport(
					report({
						target: {
							...report().target,
							name: `s${index}.apk`,
							// id 取 sha256 前 16 位：可变位必须放在开头，否则全部折叠成同一条。
							sha256: `${String(index).padStart(8, "0")}${"0".repeat(56)}`,
							generatedAt: `2026-11-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
						},
					}),
				),
			);
		}
		expect(list).toHaveLength(MAX_MY_CASES);
	});
});

describe("我的案例：读回来的数据可能是坏的", () => {
	it("丢弃形状不对的条目，而不是让页面崩", () => {
		const cleaned = sanitizeCases([
			{ id: "ok", name: "kept" },
			{ name: "no id" },
			null,
			"string",
			{ id: "x", name: "y", highlights: "not-array", seen: -3 },
		]);
		expect(cleaned.map(item => item.id).sort()).toEqual(["ok", "x"]);
		const broken = cleaned.find(item => item.id === "x");
		expect(broken?.highlights).toEqual([]);
		expect(broken?.seen).toBe(1);
	});

	it("非数组一律当空", () => {
		expect(sanitizeCases(null)).toEqual([]);
		expect(sanitizeCases({ items: [] })).toEqual([]);
	});
});
