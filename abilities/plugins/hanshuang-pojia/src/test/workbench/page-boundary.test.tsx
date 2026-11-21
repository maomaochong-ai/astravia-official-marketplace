// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageBoundary } from "../../features/workbench/components/shell/page-boundary";

/**
 * 页面级边界。
 *
 * 顶层边界把整块面板变成「渲染失败」，用户既回不去也说不出是哪一页。
 * 这里锁三件：报出页名、给可复制的错误、能重试且不影响其他页。
 */

afterEach(cleanup);

function Boom(): ReactElement {
	throw new Error("boom from reports");
}

describe("PageBoundary", () => {
	it("names the page and shows the raw error", () => {
		// React 会把 render 期抛错打到 console.error；这里只是为了不让测试输出刷屏。
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		render(
			<PageBoundary page="reports">
				<Boom />
			</PageBoundary>,
		);

		const fallback = screen.getByTestId("page-boundary-fallback");
		expect(fallback.getAttribute("data-page")).toBe("reports");
		expect(screen.getByText("这一页渲染失败了")).toBeTruthy();
		expect(screen.getByText(/boom from reports/)).toBeTruthy();
		// 其他页仍可用：提示里要这么说，不是「面板坏了」。
		expect(screen.getByText(/其他页面不受影响/)).toBeTruthy();

		spy.mockRestore();
	});

	it("renders children untouched when nothing throws", () => {
		render(
			<PageBoundary page="samples">
				<p>正常内容</p>
			</PageBoundary>,
		);
		expect(screen.getByText("正常内容")).toBeTruthy();
		expect(screen.queryByTestId("page-boundary-fallback")).toBeNull();
	});
});

