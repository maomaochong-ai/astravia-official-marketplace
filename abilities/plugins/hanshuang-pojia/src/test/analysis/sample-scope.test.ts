// 样本读取范围：项目内 / 超限 / 越界三类的判定与上限常量。
// 判定只依赖路径与大小，不读盘——面板与工具必须拿到同一个结论。

import { describe, expect, it } from "vitest";
import { READ_LIMIT_BYTES, scopeForSample } from "../../domain/sample-scope";

describe("sample scope", () => {
	it("keeps the read limit aligned with the host ceiling", () => {
		expect(READ_LIMIT_BYTES).toBe(32 * 1024 * 1024);
	});

	it("accepts a project file below the limit", () => {
		expect(scopeForSample("/work/demo.apk", "/work", 4_194_304)).toBe("ready");
		expect(scopeForSample("demo.apk", "/work", null)).toBe("ready");
	});

	it("flags a project file above the limit", () => {
		expect(scopeForSample("/work/app.exe", "/work", READ_LIMIT_BYTES + 1)).toBe("too-large");
	});

	it("accepts a file exactly at the limit", () => {
		expect(scopeForSample("/work/app.exe", "/work", READ_LIMIT_BYTES)).toBe("ready");
	});

	it("flags anything outside the project before looking at its size", () => {
		expect(scopeForSample("~/Desktop/tool.zip", "/work", 1024)).toBe("outside-project");
		expect(scopeForSample("/Users/someone/Desktop/app.exe", "/work", 200 * 1024 * 1024)).toBe("outside-project");
	});

	it("treats a missing workspace as unconstrained", () => {
		expect(scopeForSample("/anywhere/app.exe", null, 1024)).toBe("ready");
	});
});
