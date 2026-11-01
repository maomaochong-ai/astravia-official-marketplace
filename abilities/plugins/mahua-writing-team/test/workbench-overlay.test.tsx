// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import type { StudioRuntime } from "../src/plugin-context.js";
import { resetStudioRuntime, setStudioRuntime } from "../src/plugin-context.js";
import { PanelOverlay } from "../src/features/workbench/components/PanelOverlay.js";
import { WorkbenchBoundary } from "../src/features/workbench/components/WorkbenchBoundary.js";

type Catalog = Record<string, string>;

function useCatalog(catalog: Catalog) {
	const t = (key: string): string => catalog[key] ?? key;
	setStudioRuntime({ ctx: { i18n: { t } } } as unknown as StudioRuntime);
}

afterEach(() => {
	cleanup();
	resetStudioRuntime();
	document.body.innerHTML = "";
});

/**
 * 覆盖层是插件唯一逃出面板宽度的出口。它靠的不是 `fixed` 本身，
 * 而是「portal 出去的节点重新带上作用域根」——插件 CSS 全部编译在
 * `@scope ([data-astravia-plugin-root=mahua-writing-team])` 里，少了这个属性，
 * 覆盖层连 `fixed` 都不生效，界面上只是原地不动。
 */
describe("panel overlay", () => {
	it("re-attaches the style scope to everything it portals out", () => {
		const { container } = render(
			<PanelOverlay>
				<span>surface</span>
			</PanelOverlay>,
		);

		// 原位置什么都不剩：内容整体搬到 body 上。
		expect(container.childElementCount).toBe(0);
		const scope = document.body.querySelector("[data-astravia-plugin-root]");
		expect(scope).not.toBeNull();
		expect(scope?.getAttribute("data-astravia-plugin-root")).toBe("mahua-writing-team");
		// 根自身不匹配 @scope 内的选择器，挂 class 等于给自己挖坑；`display: contents`
		// 让它不产生盒子，子元素的 `fixed` 才能贴着视口。
		expect(scope?.className).toBe("");
		expect((scope as HTMLElement).style.display).toBe("contents");
		expect(scope?.textContent).toBe("surface");
	});
});

/**
 * 护栏只兜渲染错误。它的价值不在好看的失败页，而在于「标签页里一片空白」
 * 变成一句能读的话——面板里没有控制台，空白等于没有线索。
 */
describe("workbench boundary", () => {
	it("shows the catalog copy instead of a blank panel when a child throws", () => {
		useCatalog(en as Catalog);
		// React 会把捕获到的错误再打一次到 console.error；这条用例故意制造错误，
		// 所以把那段噪音关掉，否则测试输出里会混进一段假的堆栈。
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const Bomb = () => {
			throw new Error("render blew up");
		};

		render(
			<WorkbenchBoundary>
				<Bomb />
			</WorkbenchBoundary>,
		);

		expect(screen.getByText(String((en as Catalog)["window.crashed"]))).toBeTruthy();
		expect(screen.getByText(String((en as Catalog)["window.crashedHint"]))).toBeTruthy();
		expect(screen.getByRole("button", { name: String((en as Catalog)["window.crashedRetry"]) })).toBeTruthy();
		// 原文也要露出来：没有它，「重新载入试试」这句建议没法验证。
		expect(screen.getByText("render blew up")).toBeTruthy();

		consoleError.mockRestore();
	});

	it("keeps rendering the children when nothing throws", () => {
		useCatalog(en as Catalog);
		render(
			<WorkbenchBoundary>
				<span>alive</span>
			</WorkbenchBoundary>,
		);
		expect(screen.getByText("alive")).toBeTruthy();
	});
});
