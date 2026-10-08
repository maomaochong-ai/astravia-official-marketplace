import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOcrArgs, normalizeFindings } from "../src/review/tool.ts";

/** as-ocr 插件纯函数层的回归测试：OCR 发现规范化与 CLI 参数组装。 */

describe("normalizeFindings（OCR JSON → 结构化发现）", () => {
	it("完整字段原样通过，severity 白名单外的归 info", () => {
		const findings = normalizeFindings([
			{ file: "src/a.ts", line: 10, severity: "critical", message: "NPE 风险", rule: "NPE-101" },
			{ file: "src/b.ts", line: 3, severity: "weird", message: "未知级别" },
		]);
		assert.equal(findings.length, 2);
		assert.deepEqual(findings[0], {
			file: "src/a.ts",
			line: 10,
			severity: "critical",
			message: "NPE 风险",
			rule: "NPE-101",
		});
		assert.equal(findings[1]?.severity, "info");
	});

	it("缺 file 或 message 的条目丢弃；非数组输入返回空", () => {
		assert.equal(normalizeFindings([{ file: "a.ts" }, { message: "no file" }, null, 42]).length, 0);
		assert.equal(normalizeFindings(undefined).length, 0);
	});

	it("line 缺省为 0（面板渲染省略行号）", () => {
		const findings = normalizeFindings([{ file: "x.ts", message: "m" }]);
		assert.equal(findings[0]?.line, 0);
	});
});

describe("buildOcrArgs（CLI 参数组装）", () => {
	it("工作区模式：review --format json --output <path>", () => {
		assert.deepEqual(buildOcrArgs({}, "/tmp/out.json"), [
			"review",
			"--format",
			"json",
			"--output",
			"/tmp/out.json",
		]);
	});

	it("分支区间模式：--from <base> --to HEAD", () => {
		assert.deepEqual(buildOcrArgs({ from: "main" }, "/tmp/out.json"), [
			"review",
			"--format",
			"json",
			"--output",
			"/tmp/out.json",
			"--from",
			"main",
			"--to",
			"HEAD",
		]);
	});
});
