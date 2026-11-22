import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Panel chrome contracts — the parts that decide whether the tab exists at all.
 *
 * These are source-level because the host bridge does not exist in a unit test: what can be
 * checked is that the registration is written the way the host documents it, and that every
 * failure path leaves the user something rather than a blank frame.
 */
const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const index = read("src/index.tsx");
const canvas = read("src/features/canvas/components/logo-canvas.tsx");
const dock = read("src/features/canvas/components/canvas-dock.tsx");
const boundary = read("src/features/panel/panel-boundary.tsx");

describe("the activity tab", () => {
	it("registers id, label, scope and component first, so one bad option cannot remove it", () => {
		// The retry carries the minimum the host needs to show anything at all.
		expect(index).toMatch(/catch \(error\)[\s\S]{0,600}registerActivityTab\(\{/);
		expect(index).toMatch(/id: LOGO_TAB_ID,[\s\S]{0,200}component: PanelShell,/);
	});

	it("re-asserts visibility per conversation instead of once at activation", () => {
		// Attach records are keyed by cwd; at app start there may be no displayed conversation.
		expect(index).toMatch(/conversation-changed[\s\S]{0,900}setActivityTabVisible\(LOGO_TAB_ID, true, \{ cwd \}\)/);
	});

	it("takes its icon from the plugin's own mark", () => {
		expect(index).toContain("ctx.plugin.iconUrl");
		// One fallback for hosts that do not expose iconUrl; no third copy anywhere.
		expect(index.match(/<IconGenerate/g)?.length).toBe(1);
	});
});

describe("the panel never renders a blank frame", () => {
	it("wraps the canvas in a boundary that reports and can be reset", () => {
		expect(index).toContain("<PanelBoundary");
		expect(boundary).toContain("getDerivedStateFromError");
		expect(boundary).toContain("componentDidCatch");
		expect(boundary).toContain("ui.notify(");
	});

	it("shows the error text rather than swallowing it", () => {
		expect(boundary).toContain("{this.state.message}");
	});
});

describe("a design that arrives while the panel is open", () => {
	it("claims a pending hand-off only once the record exists", () => {
		// peek → lookup → claim. Claiming first lost the design when the store had not caught up.
		expect(canvas).toMatch(/const pendingId = peekPendingDesignId\(cwd\);[\s\S]{0,900}claimPendingDesignId\(cwd\);/);
		expect(canvas.indexOf("peekPendingDesignId(cwd)")).toBeLessThan(canvas.lastIndexOf("claimPendingDesignId(cwd)"));
	});

	it("drops a hand-off that never resolves, so a later one is not blocked", () => {
		expect(canvas).toMatch(/setTimeout\([\s\S]{0,300}claimPendingDesignId\(cwd\)/);
	});

	it("follows the newest AI record when the conversation just produced one", () => {
		expect(canvas).toMatch(/newest\.engine !== "ai"[\s\S]{0,200}form\.load\(newest\.spec\)/);
	});
});

describe("image-to-image in the panel", () => {
	it("passes the reference through and keeps it to one result", () => {
		const generation = read("src/features/canvas/hooks/use-generation.ts");
		expect(generation).toContain("referenceBlobId: options.reference");
		expect(generation).toContain("count: options.reference ? 1 : count");
	});

	it("offers the action only for an AI design that still has its blob", () => {
		expect(canvas).toMatch(/selectedRecord\?\.engine === "ai" && selectedRecord\.blobId/);
		expect(dock).toContain("onGenerateFromReference");
		expect(dock).toContain('t("dock.reference")');
	});
});
