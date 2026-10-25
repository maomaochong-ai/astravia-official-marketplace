// @vitest-environment jsdom

/**
 * 工作台外壳的骨架约束。
 *
 * 面板由三档容器查询重排，同一块内容在 DOM 里只渲染一次（重复挂载会让订阅、探测、
 * 安装状态各跑两遍）。这条约束没有编译期保护，只能靠渲染后数节点，所以在这里钉住：
 *
 *   1. 六个阶段各一个可点行，当前阶段恰好一个 `aria-current="step"`；
 *   2. 「执行环」这个标题全面板只出现一次 —— 左栏摘要与右栏明细都叫它，撞在一起
 *      就成了同一个标题堆两遍；
 *   3. 底部作曲器的目标输入框只有一个 id，宿主不会拿到两个同名输入；
 *   4. 首个阶段时「上一页」禁用、「下一页」可用，翻页不会把用户翻出流程边界。
 */

import { cleanup, render, screen } from "@testing-library/react";
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

describe("阶段轨道", () => {
	it("六个阶段各一行，当前阶段只有一个", () => {
		const container = renderTab();
		const rail = container.querySelector("aside");
		expect(rail).toBeTruthy();
		expect(rail?.querySelectorAll("button").length).toBe(6);
		// 两个导航面各只标记一个：左栏轨道一个当前行，顶部阶段条也是一个。
		expect(rail?.querySelectorAll('[aria-current="step"]').length).toBe(1);
		expect(container.querySelectorAll('[aria-current="step"]').length).toBe(2);
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
	it("首个阶段禁用上一页、保留下一页", () => {
		renderTab();
		const prev = screen.getByText("tab.controls.prev").closest("button") as HTMLButtonElement;
		const next = screen.getByText("tab.controls.next").closest("button") as HTMLButtonElement;
		expect(prev.disabled).toBe(true);
		expect(next.disabled).toBe(false);
	});
});
