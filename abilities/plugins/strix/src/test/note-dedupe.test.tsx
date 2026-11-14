import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TraceBlock } from "../features/scan-console/components/trace-block";

afterEach(cleanup);

/**
 * 真机截图里 `preparing image` / `starting container` 各出现二十多次。
 *
 * 容器起不来时服务会反复重试，每次两条 note，把面板刷成一堵重复的墙，真正的证据
 * （命令、输出）被挤出视野。规则：**相邻且完全同文**的 note 合并成一条并计数；
 * 工具行与轮次分隔行不合并——它们的重复本身就是信息。
 */

describe("collapsed duplicate notes", () => {
	it("shows a count when a note repeated", () => {
		render(<TraceBlock entry={{ id: "e1", at: 0, kind: "note", label: "starting container", count: 12 }} />);
		expect(screen.getByText(/starting container/)).toBeTruthy();
		expect(screen.getByText(/×12/)).toBeTruthy();
	});

	it("stays clean when it did not repeat", () => {
		render(<TraceBlock entry={{ id: "e1", at: 0, kind: "note", label: "sandbox ready" }} />);
		expect(screen.queryByText(/×/)).toBeNull();
	});
});
