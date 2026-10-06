/**
 * 设置面板「默认每页行数 / 表打开默认行数」回归测试。
 *
 * 覆盖的缺陷：输入框每按一个键就夹逼，用户敲 2000 时字符被改写；超过上限（10,000）时
 * 数字被静默改回上限值，界面上没有任何解释 —— 只能以为自定义行数没生效。
 * 现在的行为：编辑期间保留原文，失焦 / 回车才提交，越界时说明实际会取哪个值。
 *
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement（与 result-grid.test.js 一致）。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";
import { DEFAULT_SETTINGS, MAX_RESULT_PAGE_SIZE, MIN_RESULT_PAGE_SIZE } from "../domain/workbench-settings.ts";
import { SettingsPanel } from "../features/database-workspace/components/settings-panel.tsx";

const { cleanup, fireEvent, render, screen } = RTL;

afterEach(() => cleanup());

function panelProps({ settings = DEFAULT_SETTINGS, onChange = () => {} } = {}) {
	return {
		settings,
		// 面板对外只抛整份设置（字段级分发在面板内部完成）。
		onChange,
		onReset: () => {},
		onClearHistory: () => {},
		onClose: () => {},
		onWipeData: () => {},
	};
}

/** 面板默认停在「查询结果」分类，两个行数输入框直接可见。 */
function openPanel(options) {
	return render(createElement(SettingsPanel, panelProps(options)));
}

/** 逐位输入：复现真实按键顺序，才能暴露「每按一次键就被夹逼」的旧行为。 */
function type(input, text) {
	fireEvent.focus(input);
	for (let i = 1; i <= text.length; i += 1) {
		fireEvent.change(input, { target: { value: text.slice(0, i) } });
	}
}

describe("设置面板 · 每页行数输入", () => {
	it("初始显示当前设置值", () => {
		openPanel();
		assert.equal(screen.getByLabelText("默认每页行数").value, String(DEFAULT_SETTINGS.rowLimit));
		assert.equal(screen.getByLabelText("表打开默认行数").value, String(DEFAULT_SETTINGS.tableOpenPageSize));
	});

	it("输入 2000 时不被逐位夹逼，失焦后写入设置", () => {
		const changes = [];
		openPanel({ onChange: (next) => changes.push(next) });
		const input = screen.getByLabelText("默认每页行数");

		type(input, "2000");
		assert.equal(input.value, "2000");
		assert.equal(screen.queryByText(/超出上限|低于下限/), null);
		// 编辑期间不写设置，避免把中间态（2 / 20 / 200）持久化。
		assert.equal(changes.length, 0);

		fireEvent.blur(input);
		assert.equal(changes.length, 1);
		assert.equal(changes[0].rowLimit, 2_000);
		// 其他字段原样带过去：变更只针对这一项。
		assert.equal(changes[0].tableOpenPageSize, DEFAULT_SETTINGS.tableOpenPageSize);
		assert.equal(input.value, "2000");
	});

	it("输入 2000000 时保留原文，并说明会按上限取值", () => {
		const changes = [];
		openPanel({ onChange: (next) => changes.push(next) });
		const input = screen.getByLabelText("默认每页行数");

		type(input, "2000000");
		assert.equal(input.value, "2000000");
		assert.ok(
			screen.getByText(`超出上限：单页最多 ${MAX_RESULT_PAGE_SIZE.toLocaleString()} 行，将按上限取值`),
			"超上限时必须给出提示，而不是静默改数",
		);

		fireEvent.blur(input);
		assert.equal(input.value, String(MAX_RESULT_PAGE_SIZE));
		assert.equal(changes.length, 1);
		assert.equal(changes[0].rowLimit, MAX_RESULT_PAGE_SIZE);
	});

	it("输入 0 时保留原值，并说明下限", () => {
		const changes = [];
		openPanel({ onChange: (next) => changes.push(next) });
		const input = screen.getByLabelText("默认每页行数");

		type(input, "0");
		assert.ok(screen.getByText(`低于下限：每页至少 ${MIN_RESULT_PAGE_SIZE.toLocaleString()} 行，将保留原值`));

		fireEvent.blur(input);
		assert.equal(input.value, String(DEFAULT_SETTINGS.rowLimit));
		assert.equal(changes.length, 0);
	});

	it("回车提交，且与当前值相同时不重复写入", () => {
		const changes = [];
		openPanel({ onChange: (next) => changes.push(next) });
		const input = screen.getByLabelText("默认每页行数");

		type(input, "3000");
		fireEvent.keyDown(input, { key: "Enter" });
		assert.equal(changes.length, 1);
		assert.equal(changes[0].rowLimit, 3_000);

		fireEvent.change(input, { target: { value: String(DEFAULT_SETTINGS.rowLimit) } });
		fireEvent.blur(input);
		assert.equal(changes.length, 1, "值未变化时不应触发写入");
	});

	it("表打开默认行数走同一套校验", () => {
		const changes = [];
		openPanel({ onChange: (next) => changes.push(next) });
		const input = screen.getByLabelText("表打开默认行数");

		type(input, "5000");
		fireEvent.blur(input);
		assert.equal(changes.length, 1);
		assert.equal(changes[0].tableOpenPageSize, 5_000);
		assert.equal(changes[0].rowLimit, DEFAULT_SETTINGS.rowLimit);

		type(input, "2000000");
		fireEvent.blur(input);
		assert.equal(changes.length, 2);
		assert.equal(changes[1].tableOpenPageSize, MAX_RESULT_PAGE_SIZE);
	});

	it("外部改动（重置设置 / 底栏「设为默认」）同步回输入框并清掉提示", () => {
		const view = openPanel();
		const input = screen.getByLabelText("默认每页行数");

		type(input, "2000000");
		fireEvent.blur(input);
		assert.equal(input.value, String(MAX_RESULT_PAGE_SIZE));
		assert.ok(screen.queryByText(/超出上限/) !== null);

		view.rerender(createElement(SettingsPanel, panelProps({
			settings: { ...DEFAULT_SETTINGS, rowLimit: 500 },
		})));
		const synced = screen.getByLabelText("默认每页行数");
		assert.equal(synced.value, "500");
		assert.equal(screen.queryByText(/超出上限/), null);
	});
});
