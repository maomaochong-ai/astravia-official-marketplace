import { describe, expect, it } from "vitest";
import { INJECT_MARKER_END, INJECT_TARGETS, layerOf, planFor, targetById, usableTargets, wrapBlock } from "../../domain/inject/targets";

describe("inject target matrix", () => {
	it("covers the nine hosts the upstream desktop injector supports", () => {
		expect(INJECT_TARGETS).toHaveLength(9);
		expect(new Set(INJECT_TARGETS.map(target => target.id)).size).toBe(9);
		for (const id of ["codex", "claude", "opencode", "cursor", "zcode", "dsh", "workbuddy-intl", "workbuddy-cn", "doubao"]) {
			expect(targetById(id), id).toBeTruthy();
		}
	});

	it("every marker-block target names a file and the shared marker pair", () => {
		const markerTargets = INJECT_TARGETS.filter(target => target.form === "marker-block");
		expect(markerTargets).toHaveLength(7);
		for (const target of markerTargets) {
			expect(target.entry.length, target.id).toBeGreaterThan(0);
			expect(target.platforms.length, target.id).toBeGreaterThan(0);
		}
	});

	it("the system-layer target must point at a config key, or the host never picks it up", () => {
		const systemTargets = INJECT_TARGETS.filter(target => target.form === "system-layer");
		expect(systemTargets).toHaveLength(1);
		for (const target of systemTargets) expect(target.configKey, target.id).toBeTruthy();
	});

	it("an unavailable target carries the reason instead of looking unfinished", () => {
		const blocked = INJECT_TARGETS.filter(target => target.form === "unavailable");
		expect(blocked).toHaveLength(1);
		for (const target of blocked) {
			expect(target.note ?? "").toContain("调试端口");
			// 不可用目标不在「可写」集合里：否则界面会给出一个永远失败的按钮。
			expect(usableTargets().some(item => item.id === target.id)).toBe(false);
		}
	});

	it("maps forms onto layers for the explanation, not as a permission claim", () => {
		expect(layerOf(targetById("codex")!)).toBe("payload");
		expect(layerOf(targetById("opencode")!)).toBe("system");
		expect(layerOf(targetById("doubao")!)).toBe("config");
	});
});

describe("planFor", () => {
	it("puts the backup first and keeps the marker semantics for a payload target", () => {
		const plan = planFor(targetById("codex")!, { packLabel: "execution-kernel", body: "正文" });
		expect(plan.writes[0]).toMatchObject({ path: "~/.codex/AGENTS.md", kind: "marker" });
		expect(plan.steps[0]).toContain("备份");
		expect(plan.steps[0]).toContain(".hanshuang-backup-");
		expect(plan.restore.join("\n")).toContain("按标记摘除");
		expect(plan.block).toContain(INJECT_MARKER_END);
	});

	it("stops calling it a marker when the target needs a whole file", () => {
		const plan = planFor(targetById("opencode")!, { packLabel: "execution-kernel", body: "内核" });
		expect(plan.writes[0]).toMatchObject({ kind: "whole" });
		expect(plan.steps.join("\n")).toContain("JSON 校验");
		// 整份写入的风险必须自己说出来。
		expect(plan.warnings.join("\n")).toContain("覆盖");
	});

	it("produces no script-worthy writes for a blocked target", () => {
		const plan = planFor(targetById("doubao")!, { packLabel: "execution-kernel", body: "x" });
		expect(plan.steps.join("\n")).toContain("跳过");
		expect(plan.warnings.length).toBeGreaterThan(0);
	});
});

describe("wrapBlock", () => {
	it("normalises line endings and labels the block with the pack name", () => {
		const block = wrapBlock("第一行\r\n第二行", "execution-kernel");
		expect(block).toContain("→ execution-kernel -->");
		expect(block).toContain("第一行\n第二行");
		expect(block.endsWith("\n")).toBe(true);
	});
});
