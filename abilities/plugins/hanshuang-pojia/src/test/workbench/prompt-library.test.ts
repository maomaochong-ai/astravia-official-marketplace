import { describe, expect, it } from "vitest";
import { EMPTY_LIBRARY, reconcileActive, searchPromptHits, searchPrompts } from "../../domain/prompt-library";
import type { PromptItem } from "../../domain/prompt-library";

/**
 * 提示词库域层的两条契约。
 *
 *   1. `activeId` 是唯一真相：`item.active` 只许被它派生。
 *   2. 搜索要能说明「为什么这条被列出来」—— 正文命中与名称命中不是一回事。
 */

function item(id: string, patch: Partial<PromptItem> = {}): PromptItem {
	return {
		id,
		name: id,
		description: "",
		content: "",
		mode: "append",
		active: false,
		createdAt: 1,
		updatedAt: 1,
		...patch,
	};
}

describe("reconcileActive", () => {
	it("keeps only the entry activeId points at", () => {
		const before = { activeId: "a", items: [item("a", { active: true }), item("b", { active: true })] };
		const after = reconcileActive(before);

		expect(after.activeId).toBe("a");
		expect(after.items.map(entry => [entry.id, entry.active])).toEqual([
			["a", true],
			["b", false],
		]);
	});

	it("adopts a lone self-declared entry when activeId was lost", () => {
		const after = reconcileActive({ activeId: null, items: [item("a"), item("b", { active: true })] });

		expect(after.activeId).toBe("b");
		expect(after.items.find(entry => entry.id === "b")?.active).toBe(true);
	});

	it("drops an activeId that points at nothing", () => {
		const after = reconcileActive({ activeId: "gone", items: [item("a")] });

		expect(after.activeId).toBeNull();
		expect(after.items.every(entry => !entry.active)).toBe(true);
	});

	it("leaves the empty library alone", () => {
		expect(reconcileActive(EMPTY_LIBRARY)).toEqual({ activeId: null, items: [] });
	});
});

describe("searchPromptHits", () => {
	it("returns a snippet only when the hit is in the body", () => {
		const library = {
			activeId: null,
			items: [
				item("named", { name: "needle prompt" }),
				item("body", { content: "some text around needle and more" }),
			],
		};

		const hits = searchPromptHits(library, "needle");
		const named = hits.find(hit => hit.prompt.id === "named");
		const body = hits.find(hit => hit.prompt.id === "body");

		// 名称里已经写着关键词，不必再截一段正文来证明。
		expect(named?.snippet).toBeNull();
		expect(body?.snippet).toContain("needle");
	});

	it("gives every item when the query is blank", () => {
		const library = { activeId: null, items: [item("a"), item("b")] };
		expect(searchPromptHits(library, "   ")).toHaveLength(2);
		expect(searchPrompts(library, "   ")).toHaveLength(2);
	});
});
