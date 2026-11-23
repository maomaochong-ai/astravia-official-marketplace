// @vitest-environment jsdom

/**
 * 卡片铺满的 DOM 约束。
 *
 * 真实缺陷：三列栅格里的两列带 `self-start`，行高由最高的那列决定，短的那列
 * 下方留出一大片空白（截图里「快捷入口」下面 400px 什么都没有）。jsdom 没有
 * 排版引擎，`getBoundingClientRect()` 恒为 0，量不出像素；能守住的是**产生铺满
 * 的那组成类名契约**：
 *
 *   1. 两列都不再 `self-start`（否则列不参与行高分配）；
 *   2. 每一列里至少有一个 `flex-1` 面板吸收剩余高度；
 *   3. 目标类型按钮用 `auto-rows-fr` 平铺，卡片被拉高时不会在底部留半格；
 *   4. 快捷入口的两行 `flex-1`，与卡片同高。
 *
 * 改回任意一条，这里就红——这就是这个缺陷在无排版环境下的最紧闭环。
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	useActivityTab: () => ({ active: true, cwd: null }),
}));

import { ReaWorkflowTab } from "../src/features/rea-workflow/components/rea-workflow-tab";

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

afterEach(cleanup);

describe("工作台三列铺满面板", () => {
	it("两列都不再用 self-start 收缩到内容高度", () => {
		const container = renderTab();
		const grid = container.querySelector("main .grid.grid-cols-1.gap-3");
		expect(grid).toBeTruthy();
		const columns = Array.from(grid!.children).filter((child) => child instanceof HTMLElement);
		expect(columns.length).toBeGreaterThanOrEqual(2);
		for (const column of columns) {
			expect(column.className).not.toContain("self-start");
		}
	});

	it("每一列都有一个 flex-1 面板吸收剩余高度", () => {
		const container = renderTab();
		const grid = container.querySelector("main .grid.grid-cols-1.gap-3");
		const columns = Array.from(grid!.children).filter((child) => child instanceof HTMLElement);
		for (const column of columns) {
			const panels = column.querySelectorAll("section");
			const growing = Array.from(panels).filter((panel) => panel.className.includes("flex-1"));
			expect(growing.length, `column without a growing panel: ${column.className}`).toBeGreaterThanOrEqual(1);
		}
	});

	it("目标类型按钮按 fr 行高平铺", () => {
		const container = renderTab();
		const tiles = container.querySelector(".auto-rows-fr");
		expect(tiles).toBeTruthy();
		expect(tiles!.className).toContain("h-full");
	});

	it("快捷入口的两行与卡片同高", () => {
		const container = renderTab();
		const rows = Array.from(container.querySelectorAll("button")).filter(
			(button) => button.className.includes("justify-between") && button.className.includes("flex-1"),
		);
		expect(rows.length).toBe(2);
	});
});
