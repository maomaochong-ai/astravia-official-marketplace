// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import plugin from "../index";
import { LOGO_TAB_ID } from "../tab-ids";

/**
 * "装好了，但活动面板里没有这个 tab."
 *
 * Two ways that happens, both structural rather than cosmetic:
 *
 *  1. **Activation aborted before the tab was registered.** The tab used to be
 *     registered *after* `conversation.on(...)`, which is a bridge call; when it threw,
 *     everything downstream — including the tab — never ran.
 *  2. **A stale detach record.** A user who once pressed the minus leaves
 *     `-logocreator:logocreator-canvas` for that project, and an explicit record
 *     overrides `initiallyVisible` (`resolve-activity-tabs.ts:41`). The tab stays gone
 *     until something writes an attach record.
 *
 * Plus `scope_use` is fail-closed: a narrow list hides the tab in CLI/IM sessions.
 */

function context(options: { conversationThrows?: boolean } = {}) {
	const registerActivityTab = vi.fn((_contribution: unknown) => ({ dispose: () => undefined }));
	const setActivityTabVisible = vi.fn();
	const openActivityTab = vi.fn();
	const registerTool = vi.fn(() => ({ dispose: () => undefined }));
	const registered: unknown[] = [];
	registerActivityTab.mockImplementation((contribution: unknown) => {
		registered.push(contribution);
		return { dispose: () => undefined };
	});

	const ctx = {
		plugin: { id: "logocreator", version: "0.0.0" },
		permissions: { has: () => true, require: () => undefined },
		ui: {
			registerActivityTab,
			setActivityTabVisible,
			openActivityTab,
			registerInputAction: vi.fn(() => ({ dispose: () => undefined })),
			registerCardRenderer: vi.fn(() => ({ dispose: () => undefined })),
			notify: vi.fn(),
			openExternal: vi.fn(),
			getSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
			onSidebarStateChanged: () => ({ dispose: () => undefined }),
		},
		conversation: {
			on: vi.fn(() => {
				if (options.conversationThrows) throw new Error("bridge not ready");
				return { dispose: () => undefined };
			}),
			sendPrompt: vi.fn(),
			createSession: vi.fn(),
			insertText: vi.fn(),
			abort: vi.fn(),
		},
		agent: {
			registerTool,
			registerSystemPromptProvider: vi.fn(() => ({ dispose: () => undefined })),
			registerHook: vi.fn(() => ({ dispose: () => undefined })),
			registerContinuationProvider: vi.fn(() => ({ dispose: () => undefined })),
		},
		storage: {
			list: async () => [],
			readFile: async () => null,
			writeFile: async () => ({ revision: "r", changedPaths: [] }),
			commit: async () => ({ revision: "r", changedPaths: [] }),
			readSnapshot: async () => ({ revision: "r", files: {} }),
			putBlob: async () => ({ id: "b", url: "", mimeType: "image/png" }),
			putBlobFromFile: async () => ({ id: "b", url: "", mimeType: "image/png" }),
			readBlob: async () => null,
			getBlobRef: async () => null,
			deleteBlob: async () => undefined,
		},
		fs: {},
		secrets: { get: async () => null, set: async () => undefined, delete: async () => undefined, has: async () => false },
		i18n: { locale: "zh", t: (key: string) => key, onChange: () => ({ dispose: () => undefined }) },
	} as unknown as PluginContext;

	return { ctx, registerActivityTab, setActivityTabVisible, registerTool, registered };
}

describe("the tab is registered", () => {
	it("registers it even when the conversation bridge throws", () => {
		const { ctx, registerActivityTab } = context({ conversationThrows: true });
		const dispose = plugin.activate?.(ctx) as (() => void) | void;
		expect(registerActivityTab).toHaveBeenCalledTimes(1);
		// …and the rest of the plugin still came up.
		expect(context().registerTool).toBeTruthy();
		if (typeof dispose === "function") dispose();
	});

	it("registers it before anything that can throw on its own", () => {
		// Structural order matters: the tab is the plugin's visible presence.
		const source = readFileSync(join(process.cwd(), "src/index.tsx"), "utf8");
		const tab = source.indexOf("registerActivityTab");
		const conversation = source.indexOf("ctx.conversation.on");
		expect(tab).toBeGreaterThan(-1);
		expect(conversation).toBeGreaterThan(-1);
		expect(tab).toBeLessThan(conversation);
	});

	it("attaches itself, clearing a stale detach record", () => {
		const { ctx, setActivityTabVisible } = context();
		const dispose = plugin.activate?.(ctx) as (() => void) | void;
		// A user who pressed the minus leaves `-logocreator:logocreator-canvas`, and that
		// record beats `initiallyVisible`. Only an explicit attach brings it back.
		expect(setActivityTabVisible).toHaveBeenCalledWith(LOGO_TAB_ID, true);
		if (typeof dispose === "function") dispose();
	});

	it("shows in every interactive scenario, not just two", () => {
		const { ctx, registered } = context();
		const dispose = plugin.activate?.(ctx) as (() => void) | void;
		const tab = registered[0] as { id: string; scope_use: string[]; initiallyVisible: boolean };
		expect(tab.id).toBe(LOGO_TAB_ID);
		expect(tab.initiallyVisible).toBe(true);
		// Fail-closed list: leaving a scenario out hides the tab there.
		expect(tab.scope_use).toEqual(expect.arrayContaining(["conversation", "project", "im-claw", "cli"]));
		if (typeof dispose === "function") dispose();
	});
});
