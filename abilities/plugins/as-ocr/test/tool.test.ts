import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOcrArgs, describeRunFailure, resolveRunCwd } from "../src/review/tool.ts";

/** as-ocr 工具层回归：CLI 参数组装、cwd 守卫与失败信息。发现归一化见 finding.test.ts。 */


describe("buildOcrArgs（CLI 参数组装）", () => {
	it("工作区模式：review --format json --output -（结果走 stdout）", () => {
		assert.deepEqual(buildOcrArgs({}), ["review", "--format", "json", "--output", "-"]);
	});

	it("分支区间模式：--from <base> --to HEAD", () => {
		assert.deepEqual(buildOcrArgs({ from: "main" }), [
			"review",
			"--format",
			"json",
			"--output",
			"-",
			"--from",
			"main",
			"--to",
			"HEAD",
		]);
	});

	it("单提交模式：--commit 优先于 from", () => {
		assert.deepEqual(buildOcrArgs({ commit: "abc123", from: "main" }), [
			"review",
			"--format",
			"json",
			"--output",
			"-",
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
