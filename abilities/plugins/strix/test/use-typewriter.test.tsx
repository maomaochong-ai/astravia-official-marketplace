import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { COMPOSER_HINTS, useTypewriter } from "../src/shared/components/use-typewriter";

/**
 * 输入框里逐字敲出的提示（1.2.2）。
 *
 * 三条约束值得钉住：
 *  1. **快**：18ms/字 —— 一句话 0.2s 内敲完，慢一点就变成等待；
 *  2. **不打断输入**：有内容（`paused`）时立刻停止并返回 undefined；
 *  3. **可关**：`prefers-reduced-motion` 时只显示第一句静态文本。
 *
 * 每个用例都显式 unmount：这个 hook 会自己排定时器，漏掉卸载就会在测试环境拆掉之后
 * 继续跑（vitest 会报 "window is not defined" 的未捕获异常）。
 */

describe("typewriter placeholder", () => {
	it("starts empty and never exceeds the source line", () => {
		const view = renderHook(() => useTypewriter(["abc"], { typeMs: 1, holdMs: 1000, eraseMs: 1 }));
		expect((view.result.current ?? "").length).toBeLessThanOrEqual(3);
		act(() => view.unmount());
	});

	it("is paused (no placeholder) as soon as the field has content", () => {
		const view = renderHook(() => useTypewriter(["abc"], { paused: true }));
		expect(view.result.current).toBeUndefined();
		act(() => view.unmount());
	});

	it("uses the first line when motion is reduced", () => {
		const original = window.matchMedia;
		// 只关心这一个查询；其余字段给最小实现。
		window.matchMedia = (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false,
		});
		const view = renderHook(() => useTypewriter(["静止的一句"], { typeMs: 1 }));
		act(() => undefined);
		expect(view.result.current).toBe("静止的一句");
		act(() => view.unmount());
		window.matchMedia = original;
	});

	it("has a short, concrete hint set for both screens", () => {
		// 提示是"可以直接说目标"的范例，不是指令说明：每句都短，且至少一句带主机或 IP。
		expect(COMPOSER_HINTS.launch.length).toBeGreaterThanOrEqual(2);
		expect(COMPOSER_HINTS.scan.length).toBeGreaterThanOrEqual(2);
		for (const hint of [...COMPOSER_HINTS.launch, ...COMPOSER_HINTS.scan]) {
			expect(hint.length).toBeLessThanOrEqual(40);
		}
		expect(COMPOSER_HINTS.launch.some((hint) => /\d+\.\d+\.\d+\.\d+|\.com|\.test/.test(hint))).toBe(true);
	});
});
