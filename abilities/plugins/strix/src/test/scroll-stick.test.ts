import { describe, expect, it } from "vitest";
import { isNearBottom, nextScrollTop, STICK_SLACK_PX } from "../features/scan-console/scroll-stick";

/**
 * 「流式输出时滚动条往上走」的规则。
 *
 * 滚动容器的 `scrollTop` 是从顶部量的：内容往下长时它不变，于是视口相对内容向上退，
 * 看起来就是旧行在往上顶、新行在下面看不见。规则是聊天界面的老规矩：本来就贴着底就跟着，
 * 读者自己往上滚了就不抢回来。
 */

const metrics = (scrollTop: number, scrollHeight: number, clientHeight: number) => ({
	scrollTop,
	scrollHeight,
	clientHeight,
});

describe("isNearBottom", () => {
	it("counts an exactly-bottom viewport as at the bottom", () => {
		expect(isNearBottom(metrics(900, 1000, 100))).toBe(true);
	});

	it("allows sub-pixel and rounding slack", () => {
		// 布局取整会留下几像素，人是觉察不到的；判定卡在这里会把贴底误判成"读者走了"。
		expect(isNearBottom(metrics(900 - STICK_SLACK_PX + 1, 1000, 100))).toBe(true);
	});

	it("treats a real scroll-up as leaving the bottom", () => {
		expect(isNearBottom(metrics(400, 1000, 100))).toBe(false);
	});
});

describe("nextScrollTop", () => {
	it("follows the content when the reader was at the bottom", () => {
		const before = metrics(900, 1000, 100);
		const after = metrics(900, 1200, 100);
		expect(nextScrollTop({ before, after, follow: true })).toBe(1100);
	});

	it("leaves the offset alone when the reader scrolled up", () => {
		const before = metrics(400, 1000, 100);
		const after = metrics(400, 1200, 100);
		expect(nextScrollTop({ before, after, follow: false })).toBe(400);
	});

	it("never returns a negative offset for content shorter than the pane", () => {
		const before = metrics(0, 60, 200);
		const after = metrics(0, 80, 200);
		expect(nextScrollTop({ before, after, follow: true })).toBe(0);
	});
});
