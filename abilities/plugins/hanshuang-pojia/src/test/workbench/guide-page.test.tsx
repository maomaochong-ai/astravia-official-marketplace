// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 指南页的四个硬约定。
 *
 * 这一页没有业务逻辑，全是排版与文案，所以回归只能钉形状：
 *   1. 工序线一行到底（横向滚），不折行 —— 折行会让箭头悬在行尾指向空白；
 *   2. 「在哪看」可点，点了真的跳页 —— 页名的唯一用途就是让人去动手；
 *   3. 没报告时给空态，不是整卡消失；
 *   4. 组件里不留中文字面量（页名走 nav.*、产出走 guide.stage.*），否则英文界面永远中文。
 */

const translate = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
vi.mock("@astravia-org/plugin-sdk", () => ({ useTranslation: () => ({ t: translate }) }));

const root = join(__dirname, "..", "..", "..");
const source = () => readFileSync(join(root, "src/features/workbench/components/pages/guide.tsx"), "utf8");

const { GuidePage } = await import("../../features/workbench/components/pages/guide");

function makeModel(overrides: Record<string, unknown> = {}) {
	const go = vi.fn();
	return {
		go,
		model: {
			chat: { sending: false },
			report: null,
			ask: vi.fn(),
			go,
			...overrides,
		} as never,
	};
}

afterEach(cleanup);

describe("guide page", () => {
	it("keeps the flow on one row with horizontal scroll instead of wrapping", () => {
		const text = source();
		expect(text).toContain("overflow-x-auto");
		expect(text).toContain("w-max");
		// 段卡是固定宽 + shrink-0，否则 flex 会把它们压成标签宽
		expect(text).toMatch(/w-\[150px\]/);
		expect(text).toContain("shrink-0 snap-start");
		expect(text).not.toMatch(/<ol className="flex flex-wrap/);
	});

	it("jumps to the stage's pages when a chip is clicked", () => {
		const { model, go } = makeModel();
		render(<GuidePage model={model} />);
		// 默认段是 intake；工序线上的小字也是 nav.samples，所以限定在 chip 容器内找
		fireEvent.click(within(screen.getByTestId("guide-where")).getByText("nav.samples"));
		expect(go).toHaveBeenCalledWith("samples");
	});

	it("explains why there is no next step instead of dropping the card", () => {
		const { model, go } = makeModel();
		render(<GuidePage model={model} />);
		expect(screen.getByText("guide.next.empty")).toBeTruthy();
		fireEvent.click(screen.getByText("guide.next.goSamples"));
		expect(go).toHaveBeenCalledWith("samples");
	});

	it("carries no Chinese copy in the component", () => {
		// 注释可以写中文；先把两种注释形态剥掉，剩下的中文都是会渲染出去的字面量。
		const stripped = source()
			.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");
		const cjk = /[\u4e00-\u9fff]/;
		const lines = stripped.split("\n").filter(line => cjk.test(line));
		expect(lines, `中文残留在组件里：\n${lines.join("\n")}`).toEqual([]);
	});
});
