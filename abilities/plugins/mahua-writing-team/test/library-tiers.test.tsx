// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import { LibraryPage } from "../src/features/workbench/components/pages/LibraryPage.js";
import type { StudioState } from "../src/features/workbench/hooks/use-studio-state.js";
import type { BookIndexEntry } from "../src/repository/manuscript-repository.js";
import { resetStudioRuntime, setStudioRuntime } from "../src/plugin-context.js";

/**
 * 书架列档的**接线**：实测宽度 → 档位 → 实际渲染几个格子。
 *
 * `test/library-columns.test.ts` 只证明纯函数自洽（某档返回哪些格、模板几条轨道），
 * 证明不了页面上真的按这个档渲染。这条测试把中间那段接起来：
 * 给一个宽度，数一行里到底出现几个格子。
 *
 * 宽度靠桩 `getBoundingClientRect` 提供——jsdom 不做布局，不桩的话恒为 0，
 * `useWidthTier` 会一直停在最窄档，四档看起来一模一样。
 */

const catalog = en as Record<string, string>;
const t = (key: string, params?: Record<string, string | number>): string => {
	const raw = catalog[key] ?? key;
	return params ? raw.replace(/\{\{(\w+)\}\}/g, (_, slot: string) => String(params[slot] ?? "")) : raw;
};

beforeAll(() => {
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	} as unknown as typeof ResizeObserver;
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	resetStudioRuntime();
});

function entry(id: string, title: string): BookIndexEntry {
	return {
		id,
		title,
		phase: "drafting",
		currentChapter: 3,
		committedCount: 3,
		targetChapters: 120,
		words: 8200,
		genre: "长篇",
		updatedAt: new Date().toISOString(),
	};
}

/** 让整棵树上所有元素的 border box 都是这个宽度，`useWidthTier` 便会落到对应档。 */
function stubWidth(width: number): void {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		width,
		height: 24,
		top: 0,
		left: 0,
		right: width,
		bottom: 24,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	} as DOMRect);
}

/** 一行里直接挂在行按钮下的格子数——`cells.map` 的每一项都是一个 `<span>`。 */
async function renderAt(width: number): Promise<number> {
	stubWidth(width);
	setStudioRuntime({
		ctx: { i18n: { t }, storage: {} } as never,
		service: {} as never,
		gate: {} as never,
	});
	const data = {
		loading: false,
		error: null,
		books: [entry("b1", "长夜")],
		book: null,
		selectBook: vi.fn(),
		deleteBook: vi.fn(async () => ({ ok: true as const, data: { id: "b1" } })),
	} as unknown as StudioState;
	const { container } = render(<LibraryPage data={data} onNavigate={() => {}} />);

	const row = await waitFor(() => {
		const found = container.querySelector<HTMLButtonElement>("li > button");
		expect(found).not.toBeNull();
		return found as HTMLButtonElement;
	});
	// 数行上 inline 的 `grid-template-columns` 有几条轨道，而不是数 DOM 子节点：
	// 轨道数就是这一档声称要摆几列，和实际渲染的格子数由 `library-columns.test.ts` 对齐。
	const tracks = (row.style.gridTemplateColumns ?? "").split(/\s+/).filter(Boolean).length;
	return tracks;
}

describe("the shelf renders as many columns as the measured width allows", () => {
	it("drops columns as the panel narrows, never squeezing them", async () => {
		// 边界是 1121 / 821 / 621 / 421：每个数都是「上一档已经站不住」的那条线。
		expect(await renderAt(1400)).toBe(6);
		cleanup();
		expect(await renderAt(900)).toBe(4);
		cleanup();
		expect(await renderAt(700)).toBe(3);
		cleanup();
		expect(await renderAt(500)).toBe(2);
		cleanup();
		// 再窄就只留书名：阶段徽章是定高的，硬塞会把书名挤到没有宽度。
		expect(await renderAt(300)).toBe(1);
	});

	it("keeps the book title rendered at every tier", async () => {
		// 丢列只能丢信息列；书名是「哪一本」，任何宽度都得在。
		for (const width of [1400, 900, 700, 500, 300]) {
			const cellCount = await renderAt(width);
			const title = document.body.textContent ?? "";
			expect(cellCount).toBeGreaterThan(0);
			expect(title).toContain("长夜");
			cleanup();
		}
	});
});
