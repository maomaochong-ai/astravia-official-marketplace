// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import { LibraryPage } from "../src/features/workbench/components/pages/LibraryPage.js";
import type { StudioState } from "../src/features/workbench/hooks/use-studio-state.js";
import type { BookIndexEntry } from "../src/repository/manuscript-repository.js";
import { resetStudioRuntime, setStudioRuntime } from "../src/plugin-context.js";

/**
 * 书架行内的删除入口。
 *
 * 这一页的每一行整体是一个 `<button>`（点行进书），所以删除只能是它的兄弟节点：
 * 嵌进去是非法 HTML，点下去只会进书。测试因此从「行尾那枚按钮」而不是「行」开始找，
 * 并把「先确认、再调 deleteBook」这段接线钉住——没有确认带就等于一点误删。
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
	resetStudioRuntime();
});

function entry(id: string, title: string): BookIndexEntry {
	return {
		id,
		title,
		phase: "briefing",
		currentChapter: 0,
		committedCount: 0,
		targetChapters: 120,
		words: 0,
		genre: "长篇",
		updatedAt: new Date().toISOString(),
	};
}

function mount(
	books: BookIndexEntry[],
	deleteBook: StudioState["deleteBook"],
): { container: HTMLElement } {
	setStudioRuntime({
		ctx: { i18n: { t }, storage: {} } as never,
		service: {} as never,
		gate: {} as never,
	});
	const data = {
		loading: false,
		error: null,
		books,
		book: null,
		selectBook: vi.fn(),
		deleteBook,
	} as unknown as StudioState;
	const { container } = render(<LibraryPage data={data} onNavigate={() => {}} />);
	return { container };
}

describe("the shelf can delete a book in place", () => {
	it("asks before deleting and only calls deleteBook on confirm", async () => {
		const deleteBook = vi.fn(async () => ({ ok: true as const, data: { id: "b1" } }));
		const { container } = mount([entry("b1", "长夜")], deleteBook);

		const trigger = await waitFor(() => {
			const found = container.querySelector<HTMLButtonElement>(
				'button[aria-label="Delete 长夜"]',
			);
			expect(found).not.toBeNull();
			return found as HTMLButtonElement;
		});

		fireEvent.click(trigger);
		expect(deleteBook).not.toHaveBeenCalled();

		// 确认带必须说明删的是哪一本，否则同一屏两本书时分不清。
		await waitFor(() => expect(container.textContent).toContain("Delete 长夜?"));
		const confirm = [...container.querySelectorAll("button")].find(
			(node) => node.textContent?.trim() === catalog["book.deleteRun"],
		);
		expect(confirm).toBeDefined();
		fireEvent.click(confirm as HTMLButtonElement);

		await waitFor(() => expect(deleteBook).toHaveBeenCalledWith("b1"));
	});

	it("cancelling closes the strip without touching the book", async () => {
		const deleteBook = vi.fn(async () => ({ ok: true as const, data: { id: "b1" } }));
		const { container } = mount([entry("b1", "长夜")], deleteBook);

		fireEvent.click(
			(await waitFor(() => {
				const found = container.querySelector<HTMLButtonElement>(
					'button[aria-label="Delete 长夜"]',
				);
				expect(found).not.toBeNull();
				return found as HTMLButtonElement;
			})) as HTMLButtonElement,
		);
		const cancel = [...container.querySelectorAll("button")].find(
			(node) => node.textContent?.trim() === catalog["library.deleteCancel"],
		);
		fireEvent.click(cancel as HTMLButtonElement);

		await waitFor(() => expect(container.textContent).not.toContain("Delete 长夜?"));
		expect(deleteBook).not.toHaveBeenCalled();
	});

	it("keeps the failure reason on screen instead of a bare 'not deleted'", async () => {
		const deleteBook = vi.fn(async () => ({
			ok: false as const,
			error: "write-failed",
			detail: "revision-conflict: expected rev-3, current rev-5",
		}));
		const { container } = mount([entry("b1", "长夜")], deleteBook);

		fireEvent.click(
			(await waitFor(() => {
				const found = container.querySelector<HTMLButtonElement>(
					'button[aria-label="Delete 长夜"]',
				);
				expect(found).not.toBeNull();
				return found as HTMLButtonElement;
			})) as HTMLButtonElement,
		);
		const confirm = [...container.querySelectorAll("button")].find(
			(node) => node.textContent?.trim() === catalog["book.deleteRun"],
		);
		fireEvent.click(confirm as HTMLButtonElement);

		await waitFor(() => expect(container.textContent).toContain("revision-conflict"));
		expect(container.textContent).toContain(catalog["book.deleteFailed"]);
	});
});
