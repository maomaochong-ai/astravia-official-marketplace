/**
 * 网格底栏「每页行数」下拉的自定义输入回归测试。
 *
 * 覆盖的缺陷：自定义行数超过上限时被 Math.min 静默改回上限值，界面上没有反馈。
 * 现在输入 20000 会照实说明「按上限取值」，应用时取的是上限值本身。
 *
 * 容器必须带 .dbx-root：菜单 portal 到最近的 .dbx-root（@scope 依赖它限定样式）。
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";
import { MAX_RESULT_PAGE_SIZE, MIN_RESULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../domain/workbench-settings.ts";
import { PageSizeMenu } from "../features/database-workspace/components/page-size-menu.tsx";

const { cleanup, fireEvent, render, screen } = RTL;

let container = null;

afterEach(() => {
	cleanup();
	container?.remove();
	container = null;
});

function renderMenu({ pageSize = 1_000, onApply = () => {}, onSetDefault = () => {} } = {}) {
	container = document.createElement("div");
	container.className = "dbx-root";
	document.body.appendChild(container);
	return render(
		createElement(PageSizeMenu, {
			pageSize,
			options: PAGE_SIZE_OPTIONS,
			defaultPageSize: 100,
			onApply,
			onSetDefault,
		}),
		{ container },
	);
}

/** 打开下拉：底栏触发器 → 菜单 portal 到 .dbx-root。 */
function openMenu(options) {
	const view = renderMenu(options);
	fireEvent.click(screen.getByTitle("每页显示行数"));
	const input = screen.getByLabelText("自定义每页行数");
	return { view, input };
}

describe("底栏每页行数下拉 · 自定义行数", () => {
	it("打开后列出档位并标出当前值", () => {
		openMenu();
		assert.ok(screen.getByRole("menu"));
		assert.ok(screen.getByText("2,000"), "2000 档位应可选（曾被夹回 1000）");
		assert.ok(screen.queryByText("10,000") === null);
	});

	it("输入 2000：无提示，本次查询生效", () => {
		const applied = [];
		const { input } = openMenu({ onApply: (value) => applied.push(value) });

		fireEvent.change(input, { target: { value: "2000" } });
		assert.equal(input.value, "2000");
		assert.equal(screen.queryByText(/超出上限|低于下限/), null);

		fireEvent.click(screen.getByText("本次查询"));
		assert.deepEqual(applied, [2_000]);
		assert.equal(screen.queryByRole("menu"), null, "应用后菜单应关闭");
	});

	it("输入 2000000：说明按上限取值，本次查询按上限生效", () => {
		const applied = [];
		const { input } = openMenu({ onApply: (value) => applied.push(value) });

		fireEvent.change(input, { target: { value: "2000000" } });
		assert.equal(input.value, "2000000");
		assert.ok(screen.getByText(`超出上限：单页最多 ${MAX_RESULT_PAGE_SIZE.toLocaleString()} 行，将按上限取值`));

		fireEvent.click(screen.getByText("本次查询"));
		assert.deepEqual(applied, [MAX_RESULT_PAGE_SIZE]);
	});

	it("输入 0：说明保留原值，不静默改成 1 行", () => {
		const applied = [];
		const { input } = openMenu({ onApply: (value) => applied.push(value) });

		fireEvent.change(input, { target: { value: "0" } });
		assert.ok(screen.getByText(`低于下限：每页至少 ${MIN_RESULT_PAGE_SIZE.toLocaleString()} 行，将保留原值`));

		fireEvent.click(screen.getByText("本次查询"));
		assert.deepEqual(applied, [1_000], "低于下限时保留当前页大小");
	});

	it("「设为默认」与「本次查询」走同一套取值", () => {
		const defaults = [];
		const { input } = openMenu({ onSetDefault: (value) => defaults.push(value) });

		fireEvent.change(input, { target: { value: "2000000" } });
		fireEvent.click(screen.getByText("设为默认"));
		assert.deepEqual(defaults, [MAX_RESULT_PAGE_SIZE]);
	});
});
