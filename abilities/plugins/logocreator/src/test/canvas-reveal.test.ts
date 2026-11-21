// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { revealInCanvas } from "../features/canvas/reveal";
import { claimPendingDesignId, clearPendingDesigns } from "../features/canvas/pending-design";
import { clearCanvasPromptState, setActiveConversation } from "../features/canvas/canvas-prompt";
import { LOGO_TAB_ID } from "../tab-ids";

/**
 * "Image generation works, but the canvas never opens."
 *
 * Two causes, both fixed here and both pinned by a test:
 *  1. the open call passed the *tool's* cwd. The SDK says to omit it for "the
 *     conversation the host is displaying"; passing a mismatched cwd records the tab
 *     against a conversation nobody is watching.
 *  2. a throwing `setActivityTabVisible` skipped `openActivityTab` entirely, and the
 *     failure was swallowed by an empty catch.
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
	it("opens the tab for the conversation the host is showing, not a tool cwd", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		const { ctx, setActivityTabVisible, openActivityTab } = host();

		const result = revealInCanvas(ctx, "C:/repo/demo", "design-1");

		expect(result.opened).toBe(true);
		// No positional cwd and no `{cwd}`: both calls default to the visible conversation.
		expect(setActivityTabVisible.mock.calls[0]).toEqual([LOGO_TAB_ID, true]);
		expect(openActivityTab.mock.calls[0]).toEqual([LOGO_TAB_ID, { width: "max" }]);
	});

	it("hands the design over under both scopes, so whichever the panel reads matches", () => {
		clearPendingDesigns();
		clearCanvasPromptState();
		setActiveConversation("C:/repo/demo");
		const { ctx } = host();

		revealInCanvas(ctx, "C:/repo/other", "design-2");

		// The tool's cwd and the active conversation can differ; both keys carry the id.
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
		// One failing call must not skip the one that actually shows the tab.
		expect(openActivityTab).toHaveBeenCalled();
	});
});
