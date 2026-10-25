// @vitest-environment jsdom

/**
 * 外壳骨架约束。
 *
 * 上一版的真实缺陷是「侧栏压在正文上」：侧栏用绝对定位浮在内容上方，面板一窄就重叠。
 * 现在侧栏是主区之外的 flex 兄弟节点，这条性质没有编译期保护，只能渲染后看 DOM：
 *
 *   1. `aside` 带 `w-56` + `shrink-0`，且外壳里没有任何 `absolute` —— 一旦有人把
 *      侧栏改回浮层，第一条就红；
 *   2. 六个分节各一个导航项，当前分节恰好一个 `aria-current="page"`；
 *   3. 六个分节一次性全部挂载（`hidden` 切换），因此订阅、探测、安装状态只有一份：
 *      目标输入框全文档一个、执行环标题一个；
 *   4. 翻页按钮在多个分节各有一份，全部落在同一阶段上：首阶段时「上一页」一律禁用。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	useActivityTab: () => ({ active: true, cwd: null }),
}));

import { ReaWorkflowTab } from "../src/features/rea-workflow/components/rea-workflow-tab";

// 一个永不 resolve 的状态查询：外壳渲染不依赖引擎答复，等待中的挂起也不该阻塞断言。
const provider = {
	getStatus: () => new Promise<never>(() => {}),
	onStatusChanged: () => ({ dispose: () => {} }),
	retry: async () => {},
	run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
	spawn: null,
};

function renderTab(): HTMLElement {
	const { container } = render(
		<ReaWorkflowTab
			provider={provider as never}
			store={null}
			sendPrompt={async () => ({ ok: true }) as never}
			insertPrompt={() => true}
			runCommand={null}
			spawnCommand={null}
			setPanelWidth={null}
		/>,
	);
	return container;
}

function countText(container: HTMLElement, text: string): number {
	return Array.from(container.querySelectorAll("*")).filter(
		(node) => node.children.length === 0 && (node.textContent ?? "").trim() === text,
	).length;
}

afterEach(cleanup);

describe("外壳布局", () => {
	it("侧栏在流内，不靠绝对定位覆盖正文", () => {
		const container = renderTab();
		const aside = container.querySelector("aside");
		expect(aside).toBeTruthy();
		expect(aside?.className).toContain("w-56");
		expect(aside?.className).toContain("shrink-0");
		expect(aside?.className).not.toContain("absolute");
		expect(container.querySelectorAll(".absolute").length).toBe(0);
	});

	it("六个分节各一个导航项，当前分节只有一个", () => {
		const container = renderTab();
		const aside = container.querySelector("aside");
		expect(aside?.querySelectorAll("button").length).toBe(6);
		expect(aside?.querySelectorAll('[aria-current="page"]').length).toBe(1);
		// 阶段条与阶段指引各有一份阶段导航，各自只标记当前阶段一个 —— 全文档两个，
		// 但每个分节内部恰好一个，不会出现「同一页里标了两个当前阶段」。
		expect(container.querySelectorAll('[aria-current="step"]').length).toBe(2);
		const track = container.querySelector('[role="group"]');
		expect(track?.querySelectorAll('[aria-current="step"]').length).toBe(1);
	});
});

describe("分节切换", () => {
	it("点导航切走工作台，目标输入框仍只有一份", () => {
		const container = renderTab();
		const navCalls = screen.getByText("ui.nav.calls").closest("button") as HTMLButtonElement;
		fireEvent.click(navCalls);

		const pages = Array.from(container.querySelectorAll('main > div[aria-hidden]'));
		expect(pages.length).toBe(6);
		const visible = pages.filter((page) => page.getAttribute("aria-hidden") === "false");
		expect(visible.length).toBe(1);
		expect(visible[0]?.textContent ?? "").toContain("ui.page.calls.title");

		// 全部挂载：切页不重新挂载，输入框与执行环各只有一份。
		expect(document.querySelectorAll("#rea-target-input").length).toBe(1);
		expect(countText(container, "live.loop.title")).toBe(1);
	});
});

describe("同一事实不重复出现", () => {
	it("执行环标题只出现一次", () => {
		const container = renderTab();
		expect(countText(container, "live.loop.title")).toBe(1);
	});

	it("目标输入框只有一个", () => {
		renderTab();
		expect(document.querySelectorAll("#rea-target-input").length).toBe(1);
	});
});

describe("翻页边界", () => {
	it("首个阶段下所有「上一页」都禁用、「下一页」都可用", () => {
		renderTab();
		const prevs = screen.getAllByText("tab.controls.prev").map((node) => node.closest("button") as HTMLButtonElement);
		const nexts = screen.getAllByText("tab.controls.next").map((node) => node.closest("button") as HTMLButtonElement);
		expect(prevs.length).toBeGreaterThan(0);
		expect(nexts.length).toBeGreaterThan(0);
		for (const button of prevs) expect(button.disabled).toBe(true);
		for (const button of nexts) expect(button.disabled).toBe(false);
	});
});
