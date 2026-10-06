/**
 * 结果网格两个可观察行为的回归：底栏的「已取回 / 共 N 行」语义，以及生效中的导出行数上限提示。
 *
 *
 * 底栏要同时说清两件独立的事：本次会话真正从数据库取回了多少行（已取回 = 当前页
 * 末行的绝对行号），以及这张结果集总共有多少行（共 N 行，需要引擎统计）。
 * 历史缺陷是「查询结果总量限制」默认开启并把统计夹到 100_000，底栏于是常驻
 * 「共 100000 行」，与真实总数无关；总数未知时又拿取回行数兜底，两个数字互相污染。
 *
 * 只给 ResultGrid 提供它真正读取的上下文字段（state / dispatch / runTabSql / settings），
 * 不挂载真实的 WorkbenchProvider —— 后者会去连宿主服务。
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement。
 */

import RTL from "@testing-library/react";
import { createElement } from "react";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../domain/workbench-settings.ts";
import { ResultGrid } from "../features/database-workspace/components/result-grid.tsx";
import { WorkbenchContext } from "../features/database-workspace/hooks/workbench-context.ts";

const { cleanup, fireEvent, render } = RTL;

// RTL 的自动清理依赖全局 afterEach（node:test 不提供），不显式清理会让上一个用例的 DOM
// 留在 document.body 里，title / 文本查询会命中重复元素。
afterEach(() => cleanup());

const PAGE_SIZE = 1_000;

function contextValue({ settings = DEFAULT_SETTINGS, dispatch = () => {} } = {}) {
	return {
		state: {
			activeTabId: "tab-1",
			connections: [{ name: "conn", db_type: "postgres", database: "demo" }],
		},
		dispatch,
		runTabSql: async () => {},
		settings,
	};
}

/** 渲染一页服务端分页结果：1000 行，页码 0。 */
function renderGrid({ settings, ...props } = {}) {
	const rows = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i + 1 }));
	return render(
		createElement(
			WorkbenchContext.Provider,
			{ value: contextValue({ settings }) },
			createElement(ResultGrid, {
				columns: ["id"],
				rows,
				totalRows: rows.length,
				connectionName: "conn",
				sql: "SELECT id FROM demo.t",
				serverPaged: true,
				serverPage: 0,
				serverPageSize: PAGE_SIZE,
				defaultPageSize: PAGE_SIZE,
				pageLoading: false,
				...props,
			}),
		),
	);
}

describe("结果网格底栏：已取回与总行数相互独立", () => {
	it("总数未知时不拿取回行数冒充总数", () => {
		const { container } = renderGrid({ serverTotalStatus: "pending" });

		const text = container.textContent ?? "";
		assert.ok(text.includes(`已取回 ${PAGE_SIZE.toLocaleString()} 行`));
		assert.ok(text.includes("总数统计中"));
		// 历史缺陷：这里会显示「共 100000 行」或「共 1000 行」。
		assert.ok(!text.includes(`共 ${PAGE_SIZE.toLocaleString()} 行`));
	});

	it("统计成功后「共 N 行」与「已取回」同时显示", () => {
		const { container } = renderGrid({ serverTotalCount: 4_321 });

		const text = container.textContent ?? "";
		assert.ok(text.includes(`已取回 ${PAGE_SIZE.toLocaleString()} 行`));
		assert.ok(text.includes(`共 ${(4_321).toLocaleString()} 行`));
	});

	it("统计失败时只说总数未知，不伪造数字", () => {
		const { container } = renderGrid({ serverTotalStatus: "failed" });

		const text = container.textContent ?? "";
		assert.ok(text.includes("总数未知"));
		assert.ok(!text.includes("共 "));
	});

	it("本地分页只显示共 N 行", () => {
		const { container } = renderGrid({ serverPaged: false, rows: [{ id: 1 }, { id: 2 }] });

		const text = container.textContent ?? "";
		assert.ok(text.includes(`共 ${(2).toLocaleString()} 行`));
		assert.ok(!text.includes("已取回"));
	});
});

describe("结果网格底栏：刷新总计", () => {
	it("点刷新按钮触发重新统计", () => {
		let refreshed = 0;
		const { getByTitle } = renderGrid({
			serverTotalCount: 4_321,
			onRefreshTotalCount: () => {
				refreshed += 1;
			},
		});

		fireEvent.click(getByTitle("刷新总计行统计"));

		assert.equal(refreshed, 1);
	});

	it("统计中按钮禁用，避免重复统计", () => {
		let refreshed = 0;
		const { getByTitle } = renderGrid({
			serverTotalStatus: "pending",
			onRefreshTotalCount: () => {
				refreshed += 1;
			},
		});

		const button = getByTitle("正在统计总行数…");
		assert.equal(button.disabled, true);
		fireEvent.click(button);

		assert.equal(refreshed, 0);
	});
});

describe("结果网格工具栏：生效中的导出行数上限", () => {
	it("开启行数限制时常驻显示上限，避免误以为已导出全部", () => {
		const { container } = renderGrid({
			settings: { ...DEFAULT_SETTINGS, exportLimitEnabled: true, exportRowLimit: 100_000 },
		});

		assert.ok((container.textContent ?? "").includes(`上限 ${(100_000).toLocaleString()} 行`));
	});

	it("未开启行数限制时不占位", () => {
		const { container } = renderGrid({
			settings: { ...DEFAULT_SETTINGS, exportLimitEnabled: false },
		});

		assert.ok(!(container.textContent ?? "").includes("上限"));
	});
});
