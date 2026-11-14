import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach } from "vitest";
import { useStickToBottom } from "../features/scan-console/hooks/use-stick-to-bottom";
import { nextFollow } from "../features/scan-console/scroll-stick";

afterEach(() => {
	document.body.innerHTML = "";
});

/**
 * 跟随 / 待读计数的钩子：不依赖面板，直接挂一个可滚容器。
 *
 * 这一层对应「流式输出时内容往上跑」的两个侧面：
 *  - 跟随态：每来一行都把 scrollTop 推到 scrollHeight；
 *  - 读者上滚后：位置不动，只累计“有几条新内容”。
 */

interface Growable {
	__grow: (by: number) => void;
}

function fakeLayout(element: HTMLElement, initial: { scrollHeight: number; clientHeight: number }): void {
	let scrollHeight = initial.scrollHeight;
	const clientHeight = initial.clientHeight;
	let scrollTop = 0;
	Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
	Object.defineProperty(element, "clientHeight", { configurable: true, get: () => clientHeight });
	Object.defineProperty(element, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
	});
	(element as unknown as Growable).__grow = (by: number) => {
		scrollHeight += by;
	};
}

function Harness({ rows }: { rows: number }): React.ReactElement {
	const stick = useStickToBottom(`rows-${rows}`, rows);
	return (
		<div
			data-testid="scroller"
			ref={stick.ref}
			onScroll={stick.onScroll}
			{...stick.wheelProps}
			{...stick.touchProps}
			{...stick.keyProps}
			style={{ height: 400, overflowY: "auto" }}
		>
			{Array.from({ length: rows }, (_, index) => (
				<p key={index}>row {index}</p>
			))}
			<span data-testid="pending">{stick.pending}</span>
			<button type="button" onClick={stick.jumpToBottom}>
				jump
			</button>
		</div>
	);
}

const flush = async (): Promise<void> => {
	for (let index = 0; index < 3; index += 1) {
		await act(async () => {
			await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		});
	}
};

describe("useStickToBottom", () => {
	it("pins to the bottom on every growth while following", async () => {
		const { getByTestId, rerender } = render(<Harness rows={1} />);
		const scroller = getByTestId("scroller");
		fakeLayout(scroller, { scrollHeight: 600, clientHeight: 400 });
		await flush();

		for (let rows = 2; rows <= 8; rows += 1) {
			(scroller as unknown as Growable).__grow(150);
			rerender(<Harness rows={rows} />);
			await flush();
		}

		expect(scroller.scrollTop).toBe(scroller.scrollHeight - scroller.clientHeight);
		expect(getByTestId("pending").textContent).toBe("0");
	});

	it("does not follow once the reader wheels up, and counts what arrived", async () => {
		const { getByTestId, rerender } = render(<Harness rows={1} />);
		const scroller = getByTestId("scroller");
		fakeLayout(scroller, { scrollHeight: 600, clientHeight: 400 });
		await flush();

		// 读者离开底部，并发出真实手势：这是唯一能取消跟随的信号。
		scroller.scrollTop = 0;
		await act(async () => {
			fireEvent.wheel(scroller, { deltaY: -120 });
		});
		await flush();

		(scroller as unknown as Growable).__grow(300);
		rerender(<Harness rows={2} />);
		await flush();

		expect(scroller.scrollTop).toBe(0);
		expect(getByTestId("pending").textContent).toBe("1");
	});

	it("resumes following when the reader jumps back to the end", async () => {
		const { getByTestId, rerender, getByText } = render(<Harness rows={1} />);
		const scroller = getByTestId("scroller");
		fakeLayout(scroller, { scrollHeight: 600, clientHeight: 400 });
		await flush();

		scroller.scrollTop = 0;
		await act(async () => {
			fireEvent.wheel(scroller, { deltaY: -120 });
		});
		(scroller as unknown as Growable).__grow(300);
		rerender(<Harness rows={2} />);
		await flush();

		await act(async () => {
			fireEvent.click(getByText("jump"));
		});
		await flush();

		expect(getByTestId("pending").textContent).toBe("0");
		expect(scroller.scrollTop).toBe(scroller.scrollHeight - scroller.clientHeight);
	});

	it("keeps the decision honest at the pure level", () => {
		// 几何变化（内容长高）永远不该是取消跟随的理由。
		expect(nextFollow(true, "wheel-down", false)).toBe(true);
		expect(nextFollow(true, "wheel-up", true)).toBe(false);
	});
});
