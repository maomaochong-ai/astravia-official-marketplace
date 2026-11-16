// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SafeSurface } from "./safe-surface";

/**
 * 边界必须真的兜住：插件里任何一次 render 抛错都不能把宿主的窗口带黑。
 * 这条测试同时钉住"重试"能把错误清掉（用户不用重载插件）。
 */
function Bomb({ explode }: { explode: boolean }): React.ReactElement {
	if (explode) throw new Error("boom from plugin");
	return <p>ok</p>;
}

describe("SafeSurface", () => {
	it("renders children when nothing throws", () => {
		render(
			<SafeSurface label="白板面板">
				<Bomb explode={false} />
			</SafeSurface>,
		);
		expect(screen.getByText("ok")).toBeTruthy();
	});

	it("shows the reason in place instead of blanking the window", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		render(
			<SafeSurface label="白板面板">
				<Bomb explode={true} />
			</SafeSurface>,
		);
		expect(screen.getByText(/白板面板 渲染失败/)).toBeTruthy();
		expect(screen.getByText(/boom from plugin/)).toBeTruthy();
		expect(screen.getByText("重试")).toBeTruthy();
	});
});
