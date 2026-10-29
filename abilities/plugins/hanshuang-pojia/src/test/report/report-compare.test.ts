import { describe, expect, it } from "vitest";
import { buildReport, type TriageReport } from "../../domain/report/report";
import type { Finding } from "../../domain/audit/findings";
import { compareReports, familyBaseline } from "../../features/workbench/report-compare";

const COMMON: Finding = { ruleId: "apk.debuggable", severity: "high", title: "Debuggable", detail: "", evidence: [] };
const LEFT_ONLY: Finding = { ruleId: "apk.hardcoded-secret", severity: "medium", title: "Hardcoded", detail: "", evidence: [] };
const FAMILY_ONLY: Finding = { ruleId: "archive.high-entropy", severity: "low", title: "Entropy", detail: "", evidence: [] };

function report(name: string, findings: Finding[]): TriageReport {
	return buildReport({
		mode: "summary",
		target: { path: `/work/${name}.apk`, name: `${name}.apk`, size: 1000, sha256: name, format: "apk", formatLabel: "APK", generatedAt: "2026-10-24T00:00:00.000Z" },
		findings,
		facts: [{ label: "Package name", value: "com.example.family" }],
		sections: [{ id: "permissions", title: "Permissions", columns: ["P", "N"], rows: [] }],
		limits: [],
		summary: [],
	});
}

describe("compareReports (two-report diff)", () => {
	it("kept added/resolved/kept accounting stable", () => {
		const left = report("a", [COMMON, LEFT_ONLY]);
		const right = report("b", [COMMON, FAMILY_ONLY]);
		const diff = compareReports(left, right);
		expect(diff.findings.added.map(item => item.ruleId)).toEqual(["archive.high-entropy"]);
		expect(diff.findings.resolved.map(item => item.ruleId)).toEqual(["apk.hardcoded-secret"]);
		expect(diff.findings.kept).toBe(1);
	});
});

describe("familyBaseline (three-column baseline)", () => {
	it("splits findings into common / left-only / family-only", () => {
		const left = report("left", [COMMON, LEFT_ONLY]);
		const family = [report("m1", [COMMON, FAMILY_ONLY]), report("m2", [COMMON, FAMILY_ONLY])];
		const baseline = familyBaseline(left, family);

		expect(baseline.familySize).toBe(2);
		expect(baseline.commonFindings).toBe(1);
		expect(baseline.leftOnlyFindings).toBe(1);
		expect(baseline.familyOnlyFindings).toBe(1);

		const common = baseline.findings.find(f => f.ruleId === COMMON.ruleId)!;
		expect(common.side).toBe("common");
		expect(common.familyCount).toBe(2);

		const leftOnly = baseline.findings.find(f => f.ruleId === LEFT_ONLY.ruleId)!;
		expect(leftOnly.side).toBe("left-only");
		expect(leftOnly.familyCount).toBe(0);

		const familyOnly = baseline.findings.find(f => f.ruleId === FAMILY_ONLY.ruleId)!;
		expect(familyOnly.side).toBe("family-only");
		expect(familyOnly.familyCount).toBe(2);
	});

	it("reports family score average and max", () => {
		// left 只有一个 high；family 每份一个 high → 分数一致。
		const left = report("left", [COMMON, LEFT_ONLY]);
		const family = [report("m1", [COMMON, FAMILY_ONLY]), report("m2", [COMMON, FAMILY_ONLY])];
		const baseline = familyBaseline(left, family);
		// high(22)+medium(10)=32；family 每份 high(22)+low(4)=26。
		expect(baseline.score.left).toBe(32);
		expect(baseline.score.familyAvg).toBeCloseTo(26);
		expect(baseline.score.familyMax).toBe(26);
	});

	it("handles a family with no comparable members", () => {
		const left = report("left", [LEFT_ONLY]);
		const baseline = familyBaseline(left, []);
		expect(baseline.familySize).toBe(0);
		expect(baseline.commonFindings).toBe(0);
		expect(baseline.leftOnlyFindings).toBe(1);
		expect(baseline.familyOnlyFindings).toBe(0);
		expect(baseline.findings[0]!.side).toBe("left-only");
		expect(baseline.score.familyAvg).toBe(10);
		expect(baseline.score.familyMax).toBe(10);
	});
});