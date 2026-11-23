// @vitest-environment jsdom

/**
 * 案卷页在没有插件上下文时必须优雅降级。
 *
 * 真实风险：`case-store` 通过 `getPluginContext()` 拿 ctx，未激活时它抛
 * `REA plugin is not active`。surface 可能比 activate 先挂载（宿主先渲染 tab，
 * 再跑 activate），单测也会直接渲染页面；那两种情况都必须显示「还没有案件」，
 * 而不是白屏或抛出未捕获异常。
 *
 * 这里的红/绿信号：把 `hasPluginContext()` 守卫去掉后，`listCaseSummaries()`
 * 会抛错，页面变成错误横幅而不再出现空态文案 —— 第一条断言随即变红。
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	useActivityTab: () => ({ active: true, cwd: null }),
}));

import { CaseBoardPage } from "../src/features/case-board/components/case-board-page";

afterEach(cleanup);

describe("案卷页降级", () => {
	it("没有插件上下文时显示空态而不是报错", async () => {
		const { container } = render(<CaseBoardPage active cwd={null} onContinue={() => {}} />);
		expect(await screen.findByText("case.board.empty")).toBeTruthy();
		// 关键：不是「报错横幅 + 空列表」共存。上下文缺失是正常状态（surface 先于 activate 挂载），
		// 不该把内部异常当错误展示给用户。
		expect(container.querySelector(".border-risk-high\\/40")).toBeNull();
	});

	it("空态下仍然可以刷新", async () => {
		render(<CaseBoardPage active cwd={null} onContinue={() => {}} />);
		await screen.findByText("case.board.empty");
		expect(screen.getByRole("button", { name: "case.board.refresh" })).toBeTruthy();
	});

	it("未激活时不渲染内容（分节一次性挂载、靠 hidden 切换）", () => {
		const { container } = render(<CaseBoardPage active={false} cwd={null} onContinue={() => {}} />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
	});
});
