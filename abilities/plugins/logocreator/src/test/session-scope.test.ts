// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { scopeKey } from "../shared/lib/scope-key";
import { claimPendingDesignId, clearPendingDesigns, peekPendingDesignId, setPendingDesignId } from "../features/canvas/pending-design";
import {
	activeScopeKey,
	canvasInstructions,
	clearCanvasPromptState,
	isCanvasEngaged,
	publishCanvasSpec,
	setActiveConversation,
	setCanvasEngaged,
} from "../features/canvas/canvas-prompt";
import { normalizeSpec } from "../domain/spec";

/**
 * Cross-conversation isolation.
 *
 * Two conversations can each have this panel open. The host isolates its own state
 * per session (input-action working set, tab attach), so if the plugin keeps one
 * global slot for "the design to show" or "the brand to decorate with", one
 * conversation silently receives the other's work — the "串会话" symptom.
 *
 * These are the two channels that can do that, asserted directly.
 */

const A = "C:/work/alpha";
const B = "C:/work/beta";
const spec = (name: string) => normalizeSpec({ brandName: name, intent: "a leaf mark" });

beforeEach(() => {
	clearPendingDesigns();
	clearCanvasPromptState();
});

describe("scope keys", () => {
	it("collapses the shapes one path is written in", () => {
		expect(scopeKey("C:/work/alpha")).toBe(scopeKey("c:\\work\\ALPHA\\"));
		expect(scopeKey("/srv/app/")).toBe("/srv/app");
	});

	it("keeps POSIX case distinct, because those paths are case-sensitive", () => {
		expect(scopeKey("/srv/App")).not.toBe(scopeKey("/srv/app"));
	});

	it("has a scope even without a cwd", () => {
		expect(scopeKey(null)).toBe(scopeKey(undefined));
		expect(scopeKey("")).toBe(scopeKey(null));
	});
});

describe("the pending design hand-off", () => {
	it("does not cross conversations", () => {
		setPendingDesignId(A, "design-in-a");

		// Conversation B opens its panel: nothing of A's is visible to it.
		expect(peekPendingDesignId(B)).toBeNull();
		expect(claimPendingDesignId(B)).toBeNull();
		// …and A still owns its own.
		expect(claimPendingDesignId(A)).toBe("design-in-a");
	});

	it("is one-shot per conversation", () => {
		setPendingDesignId(B, "d1");
		expect(claimPendingDesignId(B)).toBe("d1");
		expect(claimPendingDesignId(B)).toBeNull();
	});

	it("treats windows path spellings as one conversation", () => {
		setPendingDesignId("C:\\Work\\Alpha", "d2");
		expect(claimPendingDesignId("c:/work/alpha/")).toBe("d2");
	});
});

describe("the composer decoration", () => {
	it("stays silent in a conversation whose toggle is off", () => {
		setCanvasEngaged(A, true);
		publishCanvasSpec(A, spec("Fern & Field"));
		setActiveConversation(A);
		expect(canvasInstructions()).toHaveLength(1);

		// The user switches to B, where the chip was never turned on.
		setActiveConversation(B);
		expect(isCanvasEngaged(B)).toBe(false);
		expect(canvasInstructions()).toEqual([]);
	});

	it("never leaks one brand into another conversation's prompt", () => {
		setCanvasEngaged(A, true);
		publishCanvasSpec(A, spec("Fern & Field"));
		setCanvasEngaged(B, true);
		publishCanvasSpec(B, spec("Kettle Lane"));

		setActiveConversation(A);
		expect(canvasInstructions()[0]).toContain("Fern & Field");
		expect(canvasInstructions()[0]).not.toContain("Kettle Lane");

		setActiveConversation(B);
		expect(canvasInstructions()[0]).toContain("Kettle Lane");
		expect(canvasInstructions()[0]).not.toContain("Fern & Field");
	});

	it("contributes nothing for an unnamed brand", () => {
		setCanvasEngaged(A, true);
		publishCanvasSpec(A, normalizeSpec({ brandName: "   " }));
		setActiveConversation(A);
		expect(canvasInstructions()).toEqual([]);
	});

	it("remembers which conversation is active", () => {
		setActiveConversation("C:\\work\\Alpha\\");
		expect(activeScopeKey()).toBe("c:/work/alpha");
	});
});
