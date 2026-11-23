// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { revealInCanvas } from "../features/canvas/reveal";
import { claimPendingDesignId, clearPendingDesigns } from "../features/canvas/pending-design";
import { clearCanvasPromptState, setActiveConversation } from "../features/canvas/canvas-prompt";
import { LOGO_TAB_ID } from "../tab-ids";

/**
 * 「对话里做完了，tab 里什么都没有」。
 *
 * 三个成因，全部钉在这里：
 *  1. 宿主对「cwd 与会话不匹配」常常是**静默无操作**，不抛错 —— 所以「抛错才重试带 cwd」
 *     永远不会触发。现在两种目标各调一次，不靠异常做判据；
 *  2. 参考插件（astravia-ui-design）的工具显式传 `{ cwd: session.cwd }`，SDK 文档也说
 *     tool handler 应当传自己的 cwd；只传不带 cwd 的那一种在某些宿主里根本不开面板；
 *  3. 一次 `setActivityTabVisible` 抛错曾把 `openActivityTab` 一起跳过，失败还被吞掉。
 */

function host(options: { failVisible?: boolean } = {}) {
	const setActivityTabVisible = vi.fn(() => {
		if (options.failVisible) throw new Error("permission denied: ui.slot.activity-tab");
	});
	const openActivityTab = vi.fn();
	const ctx = { ui: { setActivityTabVisible, openActivityTab } } as unknown as PluginContext;
	return { ctx, setActivityTabVisible, openActivityTab };
}

describe("bringing the canvas up", () => {
	it("attaches and opens for the tool session as well as the visible conversation", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		const { ctx, setActivityTabVisible, openActivityTab } = host();

		const result = revealInCanvas(ctx, "C:/repo/demo", "design-1");

		expect(result.opened).toBe(true);
		// 两条路径都走：带 cwd（SDK 对 tool handler 的约定）与不带 cwd（前台会话）。
		expect(setActivityTabVisible.mock.calls).toEqual([
			[LOGO_TAB_ID, true, { cwd: "C:/repo/demo" }],
			[LOGO_TAB_ID, true, undefined],
		]);
		expect(openActivityTab.mock.calls).toEqual([
			[LOGO_TAB_ID, { width: "max", cwd: "C:/repo/demo" }],
			[LOGO_TAB_ID, { width: "max" }],
		]);
	});

	it("still opens the visible conversation when there is no tool cwd", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		const { ctx, setActivityTabVisible, openActivityTab } = host();

		revealInCanvas(ctx, null, "design-x");

		expect(setActivityTabVisible.mock.calls).toEqual([[LOGO_TAB_ID, true, undefined]]);
		expect(openActivityTab.mock.calls).toEqual([[LOGO_TAB_ID, { width: "max" }]]);
	});

	it("hands the design over under both scopes, so whichever the panel reads matches", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		setActiveConversation("C:/repo/demo");
		const { ctx } = host();

		revealInCanvas(ctx, "C:/repo/other", "design-2");

		expect(claimPendingDesignId("C:/repo/other")).toBe("design-2");
		expect(claimPendingDesignId("C:/repo/demo")).toBe("design-2");
	});

	it("reports a refusal instead of swallowing it", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		const { ctx, openActivityTab } = host({ failVisible: true });

		const result = revealInCanvas(ctx, "C:/repo/demo", "design-3");

		expect(result.opened).toBe(false);
		expect(String(result.error)).toMatch(/permission denied/i);
		// 一次失败不能跳过真正把面板显示出来的调用。
		expect(openActivityTab).toHaveBeenCalled();
	});
});
