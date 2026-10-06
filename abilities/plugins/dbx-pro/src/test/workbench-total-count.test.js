/**
 * 总数统计状态机回归测试。
 *
 * 历史缺陷：统计失败时把 totalCount 写成 -1，总页数被算成 max(1, ceil(-1/pageSize)) = 1，
 * 于是「下一页 / 末页」全部置灰、页码锁死在第 1 页；自动统计又被设置项
 * autoCalculateTotalRows（默认 false）挡住，分页栏永久停在「总数统计中」。
 *
 * 这里锁定两条不变量：
 * 1. 统计进行中 / 统计失败都不会写入一个假的数字总数，失败必须表达为「总数未知」，
 *    让结果网格退回「本页是否取满」判断，翻页保持可用。
 * 2. 统计结果只回填到 ranSql 匹配的那个结果集，翻页 / 改页大小产生的旧请求不能写脏新结果。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialState, reducer } from "../features/database-workspace/state/workbench-reducer.ts";

const TAB_ID = "tab-1";
const SQL = "SELECT * FROM outbound.dwd_qy_outbound_bill_detail_di;";

/** 一个已经渲染出服务端分页首页的 tab（尚未统计总数）。 */
function stateWithPagedResult() {
	const base = createInitialState();
	return reducer(base, {
		type: "updateTab",
		id: TAB_ID,
		patch: {
			connectionName: "PostgreSQL",
			pageSize: 100,
			result: {
				ok: true,
				columns: ["id"],
				rows: [{ id: 1 }],
				rowCount: 1,
				elapsedMs: 12,
				paged: true,
				serverPage: 0,
				ranSql: SQL,
			},
		},
	});
}

function resultOf(state) {
	return state.tabs.find((t) => t.id === TAB_ID)?.result;
}

describe("总数统计状态机", () => {
	it("统计开始：标记 pending，且不伪造总数", () => {
		const next = reducer(stateWithPagedResult(), {
			type: "tabTotalCountPending",
			id: TAB_ID,
			ranSql: SQL,
		});
		const result = resultOf(next);
		assert.equal(result.totalCountStatus, "pending");
		assert.equal(result.totalCount, undefined);
	});

	it("统计成功：回填真实总数并清除 pending", () => {
		const pending = reducer(stateWithPagedResult(), {
			type: "tabTotalCountPending",
			id: TAB_ID,
			ranSql: SQL,
		});
		const next = reducer(pending, {
			type: "tabTotalCountSettled",
			id: TAB_ID,
			ranSql: SQL,
			totalCount: 4321,
		});
		const result = resultOf(next);
		assert.equal(result.totalCount, 4321);
		assert.equal(result.totalCountStatus, undefined);
	});

	it("统计失败：只标 failed，绝不写入 -1 之类会算坏总页数的数字", () => {
		const pending = reducer(stateWithPagedResult(), {
			type: "tabTotalCountPending",
			id: TAB_ID,
			ranSql: SQL,
		});
		const next = reducer(pending, {
			type: "tabTotalCountSettled",
			id: TAB_ID,
			ranSql: SQL,
			totalCount: null,
		});
		const result = resultOf(next);
		assert.equal(result.totalCount, undefined);
		assert.equal(result.totalCountStatus, "failed");
		// 总数未知时网格按「本页是否取满」判断下一页：本页 1 行 < 每页 100 行 → 就是末页。
		const pageSize = 100;
		const totalPages = result.totalCount === undefined ? null : Math.max(1, Math.ceil(result.totalCount / pageSize));
		assert.equal(totalPages, null);
	});

	it("竞态：旧 SQL 的统计结果不回填到已翻页的新结果", () => {
		const paged = stateWithPagedResult();
		const turned = reducer(paged, {
			type: "updateTab",
			id: TAB_ID,
			patch: { result: { ...resultOf(paged), serverPage: 1, ranSql: `${SQL} -- page 2` } },
		});
		const next = reducer(turned, {
			type: "tabTotalCountSettled",
			id: TAB_ID,
			ranSql: SQL,
			totalCount: 999,
		});
		assert.equal(resultOf(next).totalCount, undefined);
		assert.equal(resultOf(next).totalCountStatus, undefined);
	});
});
