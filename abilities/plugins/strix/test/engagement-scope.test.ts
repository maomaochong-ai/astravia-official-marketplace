import { afterEach, describe, expect, it } from "vitest";
import {
	claimPendingEngagement,
	clearEngagement,
	isStrixEngaged,
	setStrixEngaged,
} from "../src/domain/engagement";

/**
 * 「每次打开宿主会话，strix 自动打开了」。
 *
 * 根因有两层，都在这个模块和它的调用处：
 *  1. 胶囊状态是**模块级布尔**：在 A 里开过一次，之后每一个会话的 turn-start 都认为
 *     「这一轮交给了 Strix」；
 *  2. 团队会话被 `shouldFollowTurn` 无条件跟随："没有胶囊可开"被读成"应该跳出来"。
 *
 * 现在胶囊按会话记，团队会话按"没有胶囊 = 没人要求"处理。
 */

afterEach(() => {
	clearEngagement();
});

describe("胶囊按会话记，不是整台机器一份", () => {
	it("在 A 开的胶囊不会让 B 也算开着", () => {
		setStrixEngaged(true, "conv-A");
		expect(isStrixEngaged("conv-A")).toBe(true);
		expect(isStrixEngaged("conv-B")).toBe(false);
	});

	it("关掉一个会话不影响另一个", () => {
		setStrixEngaged(true, "conv-A");
		setStrixEngaged(true, "conv-B");
		setStrixEngaged(false, "conv-A");
		expect(isStrixEngaged("conv-A")).toBe(false);
		expect(isStrixEngaged("conv-B")).toBe(true);
	});

	it("新会话页先开胶囊：等会话出现再归过去", () => {
		setStrixEngaged(true); // 还没有 id
		expect(isStrixEngaged("conv-C")).toBe(false);
		claimPendingEngagement("conv-C");
		expect(isStrixEngaged("conv-C")).toBe(true);
		// 只归一次：之后新出现的会话不应该继承。
		claimPendingEngagement("conv-D");
		expect(isStrixEngaged("conv-D")).toBe(false);
	});

	it("新会话页关胶囊同样要接过去", () => {
		setStrixEngaged(true, "conv-C");
		setStrixEngaged(false); // 在新会话页关掉
		claimPendingEngagement("conv-C");
		expect(isStrixEngaged("conv-C")).toBe(false);
	});

	it("插件重新激活时清空：宿主把胶囊恢复成未开，两边不能分叉", () => {
		setStrixEngaged(true, "conv-A");
		setStrixEngaged(true);
		clearEngagement();
		expect(isStrixEngaged("conv-A")).toBe(false);
		expect(isStrixEngaged()).toBe(false);
	});
});
