// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { describeSpec } from "../features/canvas/describe-spec";
import { normalizeSpec } from "../domain/spec";
import { ICON_PATHS, ICON_SOURCES } from "../shared/components/icons.generated";

/**
 * 这一轮四个真机问题各自的守卫。
 *
 * 1. AI 生图报 `Capability input validation failed: / Expected union value`
 * 2. 面板打开了但只有一条背景色（高度没传下去）
 * 3. 备注编辑器在画布下面，而不是点哪儿弹哪儿
 * 4. dock 图标是一堆手抄字形，与宿主图标风格不一致
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the host media request matches the host's runtime schema", () => {
	const media = read("src/domain/ai/host-media.ts");

	it("always sends inputs, even for text-to-image", () => {
		// 宿主的 submit 校验把 inputs 放在三个分支的必填项里；SDK 的 TS 类型写的是可选，
		// 于是「类型通过、运行时报 Expected union value」—— 这条断言盯的就是那个间隙。
		expect(media).toMatch(/inputs: request\.referenceBlobId\s*\?/);
		expect(media).toContain(": [],");
		expect(media).not.toMatch(/\.\.\.\(request\.referenceBlobId\s*\n?\s*\?\s*\{\s*\n?\s*inputs:/);
	});

	it("names the required fields the host actually validates", () => {
		expect(media).toMatch(/operation: "generate"/);
		expect(media).toMatch(/kind: "image"/);
		expect(media).toMatch(/mode: request\.referenceBlobId \? "image-to-image" : "text-to-image"/);
	});

	it("keeps the reference image on the image-to-image path only", () => {
		expect(media).toMatch(/type: "plugin-blob" as const/);
	});
});

describe("the panel gets a height from its wrapper", () => {
	const boundary = read("src/features/panel/panel-boundary.tsx");

	it("passes full height through the error boundary", () => {
		// 裸 <div key> 高度 auto：里面画布的 h-full 解析成 0，绝对定位的子元素全被裁掉。
		expect(boundary).toMatch(/className="flex h-full min-h-0 w-full flex-col"/);
		expect(boundary).not.toMatch(/return <div key=\{this\.props\.resetKey\}>\{this\.props\.children\}<\/div>/);
	});
});

describe("notes attach to the art, not to a box below it", () => {
	const surface = read("src/features/canvas/components/canvas-surface.tsx");

	it("renders the composer as a popover inside the surface", () => {
		expect(surface).toContain('data-testid="note-popover"');
		expect(surface).toMatch(/style=\{popoverStyle\(draft\)\}/);
		// 浮层在画布内部，因此点击点就是它的锚点。
		const popover = surface.indexOf('data-testid="note-popover"');
		const closeTag = surface.lastIndexOf("className={`relative w-full select-none");
		expect(closeTag).toBeGreaterThan(-1);
		expect(popover).toBeGreaterThan(closeTag);
	});

	it("no longer renders a second composer under the art", () => {
		// 旧的实现是画布之后再来一段 space-y-1.5 的编辑器。
		expect(surface).not.toMatch(/<\/div>\s*\n\s*\{draft \? \(\s*\n\s*<div className="space-y-1.5">/);
	});
});

describe("icons come from the host's own set", () => {
	it("generated 21 solar glyphs with a source map", () => {
		expect(Object.keys(ICON_PATHS).length).toBeGreaterThanOrEqual(20);
		expect(Object.keys(ICON_SOURCES).length).toBe(Object.keys(ICON_PATHS).length);
		for (const id of Object.values(ICON_SOURCES)) expect(id).toMatch(/-bold$/);
	});

	it("the dock verbs map to distinct solar icons", () => {
		const dockVerbs = ["generate", "raster", "reference", "surprise", "inspector", "notes", "export"] as const;
		const ids = dockVerbs.map(name => ICON_SOURCES[name]);
		expect(new Set(ids).size).toBe(dockVerbs.length);
		expect(ICON_SOURCES.generate).toBe("magic-wand-3-bold");
		expect(ICON_SOURCES.notes).toBe("notes-bold");
	});

	it("renders every glyph on the shared 24 grid in currentColor", () => {
		for (const nodes of Object.values(ICON_PATHS)) {
			expect(nodes.length).toBeGreaterThan(0);
		}
		const icons = read("src/shared/components/icons.tsx");
		expect(icons).toContain('viewBox="0 0 24 24"');
		expect(icons).not.toMatch(/<svg?[^>]*fill="#/);
	});
});

describe("what the panel sends to the host agent", () => {
	it("describes the decision fields, not internal ones", () => {
		const spec = normalizeSpec({ brandName: "Acme", type: "monogram", style: "geometric", detail: "balanced", primary: "#2F6FF5" });
		const line = describeSpec(spec);
		expect(line).toContain('brand "Acme"');
		expect(line).toContain("structure monogram");
		expect(line).toContain("style geometric");
		expect(line).toContain("seed");
		expect(line).not.toContain("idSalt");
	});

	it("is empty for an unnamed draft", () => {
		expect(describeSpec(normalizeSpec({ brandName: "" }))).toBe("");
	});

	it("travels with the notes hand-off", () => {
		const handoff = read("src/features/canvas/hooks/use-notes-handoff.ts");
		// prompt 现在带上本次要处理的备注 id，避免自动派发把已处理的再发一遍。
		expect(handoff).toMatch(/dispatchPrompt\(designRef\.current, notes\.map/);
		expect(handoff).toMatch(/Current design: \$\{design\}/);
		const canvas = read("src/features/canvas/components/logo-canvas.tsx");
		expect(canvas).toContain("describeSpec(form.spec)");
	});

	it("says in the inspector that the parameters are sent", () => {
		const inspector = read("src/features/canvas/components/canvas-inspector.tsx");
		expect(inspector).toContain('t("inspector.hostNote")');
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["inspector.hostNoteBody"]).toMatch(/结构|参数/);
	});
});
