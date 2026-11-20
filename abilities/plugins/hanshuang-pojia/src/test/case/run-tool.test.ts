import { describe, expect, it } from "vitest";
import { findTool, planRunTool, splitArgs, toolsOf } from "../../domain/case/run-tool";
import { findPrecedent, SHIPPED_PRECEDENTS } from "../../domain/case/precedents";

/**
 * `run_case_tool` 的纯逻辑部分：参数怎么拆、manifest 里怎么找、自检是否先行。
 *
 * 真正开进程的部分不在这里断言 —— 那需要机器上有 python，属于集成测试的范围。
 * 但这三条恰恰是最容易出错的地方：路径带空格被拆成两段、工具名写错却静默跑错脚本、
 * 跳过自检直接拿真样本试。
 */
describe("splitArgs", () => {
	it("keeps a quoted path with spaces in one piece", () => {
		expect(splitArgs('--sample "samples/my app.apk"')).toEqual(["--sample", "samples/my app.apk"]);
		expect(splitArgs("--sample 'a b.apk'")).toEqual(["--sample", "a b.apk"]);
	});

	it("returns nothing for empty input so the caller runs the self-test alone", () => {
		expect(splitArgs(undefined)).toEqual([]);
		expect(splitArgs("   ")).toEqual([]);
	});

	it("collapses repeated whitespace instead of producing empty arguments", () => {
		expect(splitArgs("  --a   --b  ")).toEqual(["--a", "--b"]);
	});
});

describe("findTool", () => {
	it("accepts either the manifest id or the file name, case-insensitively", () => {
		const precedent = findPrecedent("android-ssl-pin-bypass")!;
		expect(findTool(precedent, "pin_surface")?.entry).toBe("pin_surface.py");
		expect(findTool(precedent, "PIN_SURFACE.PY")?.id).toBe("pin_surface");
	});

	it("refuses an unknown name instead of guessing the first tool", () => {
		const precedent = findPrecedent("elf-packed-loader")!;
		expect(findTool(precedent, "not_a_tool")).toBeUndefined();
		expect(findTool(precedent, "")).toBeUndefined();
	});

	it("every shipped precedent that ships tools names a python entry", () => {
		for (const precedent of SHIPPED_PRECEDENTS) {
			for (const tool of toolsOf(precedent)) {
				expect(tool.entry.endsWith(".py"), precedent.slug).toBe(true);
				// 生成物只带 id/entry/purpose/args/expect；自检命令由 planRunTool 统一拼，
				// 不让每份 manifest 各写一遍（写多了就会各不一致）。
				expect(tool.id.length, precedent.slug).toBeGreaterThan(0);
			}
		}
	});
});

describe("planRunTool", () => {
	it("always plans the self-test first", () => {
		const precedent = findPrecedent("android-ssl-pin-bypass")!;
		const tool = findTool(precedent, "pin_surface")!;
		const plan = planRunTool(precedent, tool, ".hanshuang/cases/android-ssl-pin-bypass/tools/pin_surface.py");
		expect(plan.selfTest[1]).toBe("--self-test");
		// 没给参数就只做自检：run 为 null，避免拿真样本当自检输入。
		expect(plan.run).toBeNull();
	});

	it("appends the supplied arguments after the resolved entry path", () => {
		const precedent = findPrecedent("android-ssl-pin-bypass")!;
		const tool = findTool(precedent, "pin_surface")!;
		const entry = ".hanshuang/cases/android-ssl-pin-bypass/tools/pin_surface.py";
		const plan = planRunTool(precedent, tool, entry, "--sample samples/a.apk");
		expect(plan.run).toEqual([entry, "--sample", "samples/a.apk"]);
		expect(plan.usage.some(item => item.includes("--sample"))).toBe(true);
	});
});
