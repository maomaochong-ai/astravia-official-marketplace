import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DEFAULT_FILTERS,
	countByCategory,
	countBySeverity,
	countFiles,
	countMarked,
	filterFindings,
	groupByFile,
	normalizeCategory,
	normalizeFinding,
	normalizeFindings,
	normalizeSeverity,
	worstSeverity,
} from "../src/review/finding.ts";

/**
 * 发现模型的回归测试：两种输入形态（delegate 上报 / ocr JSON）、旧数据兼容、
 * 计数、分组排序与过滤。面板渲染全部建立在这些纯函数上，所以先钉住它们。
 */

describe("normalizeSeverity（四级词表 + 旧数据兼容）", () => {
	it("ocr 四级原样通过", () => {
		for (const severity of ["critical", "high", "medium", "low"]) {
			assert.equal(normalizeSeverity(severity), severity);
		}
	});

	it("旧的 major/minor/info 映射到新词表，非法值落 low", () => {
		assert.equal(normalizeSeverity("major"), "high");
		assert.equal(normalizeSeverity("minor"), "medium");
		assert.equal(normalizeSeverity("info"), "low");
		assert.equal(normalizeSeverity("blocker"), "low");
		assert.equal(normalizeSeverity(undefined), "low");
		assert.equal(normalizeSeverity(3), "low");
	});

	it("大小写与空白不影响判定", () => {
		assert.equal(normalizeSeverity(" CRITICAL "), "critical");
	});
});

describe("normalizeCategory（8 类 + other 兜底）", () => {
	it("合法类别原样通过", () => {
		assert.equal(normalizeCategory("security"), "security");
		assert.equal(normalizeCategory("Performance"), "performance");
	});

	it("未知类别落 other", () => {
		assert.equal(normalizeCategory("nitpick"), "other");
		assert.equal(normalizeCategory(undefined), "other");
	});
});

describe("normalizeFinding（两种输入形态）", () => {
	it("delegate 上报：file / line / message / rule", () => {
		const finding = normalizeFinding({
			file: "src/a.ts",
			line: 10,
			severity: "critical",
			category: "bug",
			message: "NPE 风险",
			rule: "NPE-101",
		});
		assert.ok(finding);
		assert.equal(finding.file, "src/a.ts");
		assert.equal(finding.line, 10);
		assert.equal(finding.severity, "critical");
		assert.equal(finding.category, "bug");
		assert.equal(finding.message, "NPE 风险");
		assert.equal(finding.rule, "NPE-101");
		assert.match(finding.key, /^src\/a\.ts:10:/);
	});

	it("ocr JSON：path / content / start_line / end_line / existing_code / suggestion_code", () => {
		const finding = normalizeFinding({
			path: "internal/x.go",
			content: "并发写 map 会 panic",
			start_line: 42,
			end_line: 45,
			severity: "high",
			category: "bug",
			existing_code: "m[k] = v",
			suggestion_code: "mu.Lock()\nm[k] = v\nmu.Unlock()",
		});
		assert.ok(finding);
		assert.equal(finding.file, "internal/x.go");
		assert.equal(finding.message, "并发写 map 会 panic");
		assert.equal(finding.line, 42);
		assert.equal(finding.endLine, 45);
		assert.equal(finding.existingCode, "m[k] = v");
		assert.equal(finding.suggestionCode, "mu.Lock()\nm[k] = v\nmu.Unlock()");
	});

	it("end_line 小于 start_line 时退化成单行；缺行号记 0", () => {
		const weird = normalizeFinding({ path: "a.ts", content: "m", start_line: 9, end_line: 3 });
		assert.equal(weird?.endLine, 9);
		const noLine = normalizeFinding({ path: "a.ts", content: "m" });
		assert.equal(noLine?.line, 0);
		assert.equal(noLine?.endLine, 0);
	});

	it("同一发现无论来自哪种形态都得到同一个 key", () => {
		const fromDelegate = normalizeFinding({ file: "a.ts", line: 7, message: "boom", severity: "high" });
		const fromOcr = normalizeFinding({ path: "a.ts", start_line: 7, content: "boom", severity: "high" });
		assert.equal(fromDelegate?.key, fromOcr?.key);
	});

	it("缺 file/path 或 message/content 的条目丢弃", () => {
		assert.equal(normalizeFinding({ file: "a.ts" }), null);
		assert.equal(normalizeFinding({ message: "no file" }), null);
		assert.equal(normalizeFinding(null), null);
		assert.equal(normalizeFinding(42), null);
	});
});

describe("normalizeFindings（批量、去重、旧级别）", () => {
	it("丢非法条目并按 key 去重", () => {
		const findings = normalizeFindings([
			{ file: "a.ts", line: 1, message: "same" },
			{ path: "a.ts", start_line: 1, content: "same" },
			{ file: "b.ts", line: 2, message: "other" },
			null,
			"nope",
		]);
		assert.equal(findings.length, 2);
	});

	it("非数组输入返回空数组", () => {
		assert.deepEqual(normalizeFindings(undefined), []);
		assert.deepEqual(normalizeFindings({ comments: [] }), []);
	});

	it("历史记录里的旧级别被映射，不产生未知级别", () => {
		const findings = normalizeFindings([
			{ file: "a.ts", line: 1, message: "m1", severity: "major" },
			{ file: "a.ts", line: 2, message: "m2", severity: "minor" },
			{ file: "a.ts", line: 3, message: "m3", severity: "info" },
		]);
		assert.deepEqual(
			findings.map((finding) => finding.severity),
			["high", "medium", "low"],
		);
	});
});

describe("计数与最严重级别", () => {
	const findings = normalizeFindings([
		{ file: "a.ts", line: 1, message: "m1", severity: "critical", category: "security" },
		{ file: "a.ts", line: 2, message: "m2", severity: "low", category: "style" },
		{ file: "b.ts", line: 3, message: "m3", severity: "low", category: "style" },
	]);

	it("按级别 / 类别计数，缺项为 0", () => {
		const bySeverity = countBySeverity(findings);
		assert.equal(bySeverity.critical, 1);
		assert.equal(bySeverity.low, 2);
		assert.equal(bySeverity.high, 0);
		assert.equal(countByCategory(findings).style, 2);
		assert.equal(countByCategory(findings).security, 1);
		assert.equal(countByCategory(findings).documentation, 0);
	});

	it("文件数与最严重级别", () => {
		assert.equal(countFiles(findings), 2);
		assert.equal(worstSeverity(findings), "critical");
		assert.equal(worstSeverity([]), null);
	});
});

describe("groupByFile（顺序稳定）", () => {
	it("文件按路径排序，文件内按行号升序，未定位排末尾", () => {
		const findings = normalizeFindings([
			{ file: "b.ts", line: 5, message: "b5" },
			{ file: "a.ts", line: 0, message: "a?" },
			{ file: "a.ts", line: 9, message: "a9" },
			{ file: "a.ts", line: 2, message: "a2" },
		]);
		const groups = groupByFile(findings);
		assert.deepEqual(
			groups.map((group) => group.file),
			["a.ts", "b.ts"],
		);
		assert.deepEqual(
			groups[0]?.findings.map((finding) => finding.line),
			[2, 9, 0],
		);
	});
});

describe("filterFindings / countMarked", () => {
	const findings = normalizeFindings([
		{ file: "a.ts", line: 1, message: "m1", severity: "critical", category: "bug" },
		{ file: "a.ts", line: 2, message: "m2", severity: "low", category: "style" },
		{ file: "b.ts", line: 3, message: "m3", severity: "low", category: "bug" },
	]);
	const marks = { [findings[0]?.key ?? ""]: "fixed" as const };

	it("默认值：不按级别/类别过滤，但隐藏已标记", () => {
		assert.equal(DEFAULT_FILTERS.hideMarked, true);
		assert.equal(filterFindings(findings, DEFAULT_FILTERS, marks).length, 2);
	});

	it("级别与类别可叠乘", () => {
		const low = filterFindings(findings, { severity: "low", category: null, hideMarked: false });
		assert.equal(low.length, 2);
		const lowBug = filterFindings(findings, { severity: "low", category: "bug", hideMarked: false });
		assert.deepEqual(
			lowBug.map((finding) => finding.message),
			["m3"],
		);
	});

	it("关掉隐藏时标记过的仍可见，但计数不失真", () => {
		const all = filterFindings(findings, { severity: null, category: null, hideMarked: false }, marks);
		assert.equal(all.length, 3);
		assert.equal(countMarked(findings, marks), 1);
	});
});
