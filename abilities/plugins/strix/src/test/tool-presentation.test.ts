import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { presentTool, EXPANDABLE_FAMILIES } from "../features/scan-console/tool-presentation";
import { SERVICE_TOOL_NAMES } from "../agent/strix-tools";

/**
 * 逐工具渲染：与上游 `internal/render/*` 对齐的那一层（ADR 0009）。
 *
 * 上游给 24 种工具各写了一个渲染器；本插件用 12 个家族覆盖这 35 个工具，未登记的落到
 * generic（上游的 `_render_default_tool_widget`）。这条测试守两件事：
 *  1. 35 个工具**全部**有落点，没有一个悄悄退回 generic 还以为自己特制过；
 *  2. 每个家族的字形与色调是固定的，不随调用漂移。
 */

describe("tool families", () => {
	const upstreamRegistry = readFileSync(
		"D:/open-source-projects/strix/strix/interface/tui/internal/render/registry.go",
		"utf8",
	);

	it("maps every tool this plugin serves (except deliberate generics)", () => {
		const generic = SERVICE_TOOL_NAMES.filter((name) => presentTool(name).family === "generic");
		// 只允许“沙箱元信息”这类天生没有专属形状的工具落到 generic。
		expect(new Set(generic)).toEqual(
			new Set(["strix_sandbox_start", "strix_sandbox_status", "strix_sandbox_stop", "strix_environment", "strix_mcp"]),
		);
	});

	it("uses the glyph vocabulary upstream uses for the same families", () => {
		// 上游 file_edit.go / image.go 用 ◇，notes.go 用 ✎，coverage.go 用 → + 结果色。
		expect(presentTool("strix_patch").glyph).toBe("◇");
		expect(presentTool("strix_view_image").glyph).toBe("◇");
		expect(presentTool("strix_note_create").title).toBe("note");
		expect(presentTool("strix_coverage_record").tone).toBe("emerald");
		expect(presentTool("strix_file_finding").tone).toBe("red");
	});

	it("falls back to the upstream generic shape for an unknown tool", () => {
		const look = presentTool("strix_something_new");
		expect(look.family).toBe("generic");
		expect(look.glyph).toBe("→");
		expect(look.title).toBe("strix_something_new");
	});

	it("only expands families whose output is evidence, not JSON", () => {
		for (const family of EXPANDABLE_FAMILIES) {
			expect(["exec", "patch", "browser", "proxy", "report"]).toContain(family);
		}
		// 计划/覆盖/笔记的结果是台账状态，已经在侧栏里；展开它只会重复。
		expect(presentTool("strix_todo_create").expandable).toBe(false);
		expect(presentTool("strix_exec").expandable).toBe(true);
	});

	it("stays honest about upstream's renderer count", () => {
		// 上游注册表里的键（去掉状态词）就是“它有几种专属画法”。
		const keys = [...upstreamRegistry.matchAll(/"([a-z_]+)":/g)]
			.map((match) => match[1])
			.filter((key) => !["completed", "failed", "error", "running"].includes(key));
		expect(keys.length).toBeGreaterThanOrEqual(20);
		// 我们不是复制 24 个，而是 14 个家族 + generic；这条防止有人把家族悄悄扩成一对一复制。
		const families = new Set(SERVICE_TOOL_NAMES.map((name) => presentTool(name).family));
		expect(families.size).toBe(15);
	});
});
