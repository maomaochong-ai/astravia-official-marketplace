import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveScanRoot } from "../src/store/codemap-build-tool.ts";

/** 码谱扫描根的回归测试：工具 handler 不能把文件系统根当成工作区。 */

describe("resolveScanRoot（会话 cwd → 扫描根）", () => {
	it("项目目录原样返回，去掉末尾分隔符", () => {
		assert.equal(resolveScanRoot("/Users/me/repo"), "/Users/me/repo");
		assert.equal(resolveScanRoot("/Users/me/repo/"), "/Users/me/repo");
	});

	it("文件系统根 / 空串 / 非绝对路径一律拒绝", () => {
		assert.equal(resolveScanRoot("/"), null);
		assert.equal(resolveScanRoot(""), null);
		assert.equal(resolveScanRoot(undefined), null);
		assert.equal(resolveScanRoot("relative/dir"), null);
	});

	it("Windows 盘符根拒绝，盘内路径保留", () => {
		assert.equal(resolveScanRoot("C:\\"), null);
		assert.equal(resolveScanRoot("C:\\Users\\me\\repo"), "C:\\Users\\me\\repo");
	});
});
