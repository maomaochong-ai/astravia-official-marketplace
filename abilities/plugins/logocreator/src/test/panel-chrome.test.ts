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
		// 批次 API：一次工具调用可能产出多张，认领的是整个列表。
		expect(canvas).toMatch(/const pendingIds = peekPendingDesignIds\(cwd\);[\s\S]{0,900}claimPendingDesignIds\(cwd\);/);
		expect(canvas.indexOf("peekPendingDesignIds(cwd)")).toBeLessThan(canvas.lastIndexOf("claimPendingDesignIds(cwd)"));
	});

	it("drops a hand-off that never resolves, so a later one is not blocked", () => {
		expect(canvas).toMatch(/setTimeout\([\s\S]{0,320}claimPendingDesignIds\(cwd\)/);
	});

	it("follows the newest AI record when the conversation just produced one", () => {
		expect(canvas).toMatch(/newest\.engine !== "ai"[\s\S]{0,200}form\.load\(newest\.spec\)/);
	});
});

describe("image-to-image in the panel", () => {
	it("passes the reference through and keeps it to one result", () => {
		const generation = read("src/features/canvas/hooks/use-generation.ts");
		expect(generation).toContain("referenceBlobId: options.reference");
		// 编辑只出一张：换风格就不是「改这张」了，所以 reference 时固定 count = 1。
		expect(generation).toMatch(/const count = options\.reference \? 1/);
	});

	it("offers the action for any selected design, not only AI images", () => {
		// 上一版只对 AI 位图开放，且忽略表单里刚改的参数：看矢量稿想照它再出一版时没有入口。
		expect(canvas).toMatch(/onGenerateFromReference=\{\s*selectedRecord\s*\?/);
		// AI 稿额外带上图片做 image-to-image；矢量稿只带参数。
		expect(canvas).toMatch(/selectedRecord\.engine === "ai" \? selectedRecord\.blobId : undefined/);
		// 先载回该稿的 spec，再按当前表单重跑。
		expect(canvas).toMatch(/form\.load\(selectedRecord\.spec\);[\s\S]{0,160}runBatch\(/);
		expect(dock).toContain('t("dock.reference")');
	});
});


describe("identity strings never leak a variable name", () => {
	const manifest = JSON.parse(read("plugin.json")) as {
		agent: { skillPresentation: { skills: Record<string, { displayName?: string }> } };
	};
	const locales = {
		zh: JSON.parse(read("locales/zh.json")) as Record<string, string>,
		en: JSON.parse(read("locales/en.json")) as Record<string, string>,
	};

	it("gives the skill a literal display name, because tokens persist it into messages", () => {
		// 消息里的 skill token 会把 displayName 存下来：宿主某条路径没解析 `%…%` 时，
		// 用户看到的就是 `%name%`（已经发生过）。身份串用字面值。
		const display = manifest.agent.skillPresentation.skills.logocreator?.displayName ?? "";
		expect(display.length).toBeGreaterThan(0);
		expect(display).not.toMatch(/^%.*%$/);
	});

	it("keeps no unresolved placeholder in either catalogue", () => {
		for (const locale of [locales.zh, locales.en]) {
			for (const [key, value] of Object.entries(locale)) {
				expect(`${key}=${value}`).not.toMatch(/^[^=]+=%[^%]+%$/);
			}
		}
	});

	it("names the file-tree action in both languages", () => {
		expect(locales.zh["fileExplorer.openDesign"]).toBeTruthy();
		expect(locales.en["fileExplorer.openDesign"]).toBeTruthy();
	});
});

describe("the panel cannot render nothing", () => {
	it("declares a minimum height, because the host may hand it zero", () => {
		// 宿主容器的 h-full 解析成 0 时，绝对定位的stage全被裁掉 —— 面板一片全黑。
		expect(canvas).toMatch(/min-h-\[320px\]/);
	});

	it("logs its measured size on mount, so a blank panel is diagnosable", () => {
		expect(canvas).toContain('"[logocreator] panel mounted"');
		expect(canvas).toMatch(/height === 0/);
	});
});


describe("a denied permission must not take the panel down", () => {
	const handoff = read("src/features/canvas/hooks/use-notes-handoff.ts");
	const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };

	it("declares agent.session.read, which the event subscription needs", () => {
		expect(manifest.permissions).toContain("agent.session.read");
	});

	it("survives a rejected conversation.on by falling back to the hook", () => {
		// 升级不自动授予新权限：这里抛错会被 React 当成渲染错误，整块 tab 变成「面板没能渲染」。
		expect(handoff).toMatch(/try \{[\s\S]{0,500}conversation\.on\(/);
		expect(handoff).toMatch(/catch \(error\)[\s\S]{0,400}falling back/);
		expect(handoff).toContain("useActiveConversation");
	});

	it("warns at activation when the permission is missing, instead of failing silently", () => {
		expect(index).toMatch(/permissions\.has\("agent\.session\.read"\)/);
		expect(index).toContain("agent.session.read not granted");
	});
});
