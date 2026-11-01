// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import { StudioService } from "../src/application/studio-service.js";
import { EntitlementGate } from "../src/entitlement/entitlement-gate.js";
import { WorkbenchMount } from "../src/features/workbench/components/WorkbenchMount.js";
import {
	clearStudioRuntime,
	resetStudioRuntime,
	setStudioRuntime,
} from "../src/plugin-context.js";
import { ManuscriptRepository } from "../src/repository/manuscript-repository.js";
import { MemoryManuscriptStorage } from "../src/repository/manuscript-storage.js";

/**
 * 装配门必须「一定画出东西」。
 *
 * 宿主机面板空白那次排查里，唯一还能自证的判据就是这条：只要 `WorkbenchMount` 跑到了，
 * 树上就必有一句文字（报头标题，或各分支兜底），绝不会是一块既无文字也无报错的平色。
 * 所以这里断开 `ResizeObserver` 之外的宿主依赖，把整棵树真挂一遍，钉住这条不变量。
 */

const catalog = en as Record<string, string>;
const missing: string[] = [];
const t = (key: string, params?: Record<string, string | number>): string => {
	const raw = catalog[key];
	if (raw === undefined) {
		missing.push(key);
		return key;
	}
	return params ? raw.replace(/\{\{(\w+)\}\}/g, (_, slot: string) => String(params[slot] ?? "")) : raw;
};

beforeAll(() => {
	// jsdom 没有 ResizeObserver，`use-narrow-surface` 依赖它。
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	} as unknown as typeof ResizeObserver;
});

afterEach(() => {
	cleanup();
	resetStudioRuntime();
	missing.length = 0;
});

function mount(): { text: string; html: string } {
	const storage = new MemoryManuscriptStorage();
	const gate = new EntitlementGate(storage, () => new Date());
	const repository = new ManuscriptRepository(storage, () => new Date().toISOString());
	const service = new StudioService(repository, gate, () => new Date());
	setStudioRuntime({ ctx: { i18n: { t }, storage } as never, service, gate });

	const { container } = render(
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="contents" data-astravia-plugin-root="mahua-writing-team">
				<WorkbenchMount />
			</div>
		</div>,
	);
	return { text: (container.textContent ?? "").trim(), html: container.innerHTML };
}

describe("the workbench always paints a word", () => {
	it("renders the masthead inside the host panel wrapper", async () => {
		const { text } = mount();
		await waitFor(() => expect(text.length).toBeGreaterThan(0));
		expect(text).toMatch(/Shelf|Activation/);
		expect(text).not.toContain("The workbench broke");
		expect(missing).toEqual([]);
	});

	it("keeps the skeleton text-free but structured while the runtime is missing", () => {
		resetStudioRuntime();
		const { container } = render(<WorkbenchMount />);
		expect((container.textContent ?? "").trim()).toBe("");
		// 骨架不靠文字，但必须留下结构：容器数 > 3，否则宿主里就是一块空平色。
		expect(container.querySelectorAll("div").length).toBeGreaterThan(3);
		// 分支标记是「面板空白」时唯一能查的证据，不能丢。
		expect(container.querySelector("[data-mahua-state]")?.getAttribute("data-mahua-state")).toBe(
			"waiting",
		);
	});

	it("replaces the silent skeleton with a readable wait once the runtime is gone", () => {
		vi.useFakeTimers();
		try {
			// 复刻启动竞态：一次 activate 装好运行时，随后那次卸载把它拆掉，翻译函数还留着。
			const owned = setStudioRuntime({
				ctx: { i18n: { t } } as never,
				service: {} as never,
				gate: {} as never,
			});
			clearStudioRuntime(owned);

			const { container } = render(<WorkbenchMount />);
			act(() => {
				vi.advanceTimersByTime(61_000);
			});

			expect(container.querySelector("[data-mahua-state]")?.getAttribute("data-mahua-state")).toBe(
				"stalled",
			);
			expect(container.textContent).toContain("still starting");
			expect(missing).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});
});
