import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOcrArgs, describeRunFailure, normalizeFindings, resolveRunCwd } from "../src/review/tool.ts";

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

	it("单提交模式：--commit 优先于 from", () => {
		assert.deepEqual(buildOcrArgs({ commit: "abc123", from: "main" }, "/tmp/out.json"), [
			"review",
			"--format",
			"json",
			"--output",
			"/tmp/out.json",
			"--commit",
			"abc123",
		]);
	});
});

describe("resolveRunCwd（会话 cwd → 子进程 cwd）", () => {
	it("项目目录原样返回，去掉末尾分隔符", () => {
		assert.equal(resolveRunCwd("/Users/me/repo"), "/Users/me/repo");
		assert.equal(resolveRunCwd("/Users/me/repo/"), "/Users/me/repo");
	});

	it("文件系统根 / 空串 / 非绝对路径一律拒绝（否则 ocr 会在 / 上跑）", () => {
		assert.equal(resolveRunCwd("/"), null);
		assert.equal(resolveRunCwd(""), null);
		assert.equal(resolveRunCwd(undefined), null);
		assert.equal(resolveRunCwd("relative/dir"), null);
	});

	it("Windows 盘符根拒绝，盘内路径保留", () => {
		assert.equal(resolveRunCwd("C:\\"), null);
		assert.equal(resolveRunCwd("C:\\Users\\me\\repo"), "C:\\Users\\me\\repo");
	});
});

describe("describeRunFailure（失败信息可行动化）", () => {
	it("非 git 目录的原始 stderr 换成可执行提示", () => {
		const text = describeRunFailure("Error: / is not a git repository\n", "/Users/me/repo");
		assert.match(text, /git/);
		assert.match(text, /\/Users\/me\/repo/);
		assert.doesNotMatch(text, /^Error:/);
	});

	it("其他错误保持原文（截断到 200 字），空 stderr 给兼容提示", () => {
		assert.equal(describeRunFailure("  boom ", "/r"), "boom");
		assert.equal(describeRunFailure("x".repeat(300), "/r").length, 200);
		assert.equal(describeRunFailure("", "/r"), "可执行文件未响应");
	});

	it("未配模型端点时指向委托模式，而不是叫用户读 stderr", () => {
		const text = describeRunFailure(
			"Error: resolve LLM endpoint: no valid LLM endpoint configured; one of OCR_LLM_URL/OCR_LLM_TOKEN/OCR_LLM_MODEL",
			"/repo",
		);
		assert.match(text, /委托模式/);
		assert.match(text, /ocr config provider/);
	});
});
