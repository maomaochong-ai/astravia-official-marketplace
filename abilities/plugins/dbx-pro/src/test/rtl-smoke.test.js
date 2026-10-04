/**
 * RTL + happy-dom 环境冒烟：验证 React 渲染与 act 更新链路可用。
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement。
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function Counter() {
	const [count, setCount] = useState(0);
	return createElement(
		"button",
		{ type: "button", onClick: () => setCount((c) => c + 1) },
		`count: ${count}`,
	);
}

describe("RTL 环境冒烟", () => {
	it("渲染并响应点击", () => {
		render(createElement(Counter));
		assert.equal(screen.getByText("count: 0").textContent, "count: 0");
		act(() => {
			fireEvent.click(screen.getByText("count: 0"));
		});
		assert.equal(screen.getByText(/count: 1/).textContent, "count: 1");
	});
});
