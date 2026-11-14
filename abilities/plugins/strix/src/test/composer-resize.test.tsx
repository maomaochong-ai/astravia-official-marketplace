// 渲染级验证：把两个屏真挂起来，量输入框的高度是否随「向上拖」变大。
// jsdom 没有布局，所以这里量的是组件把什么写进了 DOM（自定义属性 + 手柄存在），
// 以及拖拽事件之后的属性值——方向错误会在这里立刻显形。
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LaunchScreen } from "../features/scan-console/components/launch-screen";
import { ScanScreen } from "../features/scan-console/components/scan-screen";

/**
 * jsdom 有 MouseEvent，没有 PointerEvent：直接 `fireEvent.pointerDown` 拿到的事件没有
 * `clientY`，拖拽会静默算成 NaN。补一个最小 polyfill，让这条测试验证的是插件的方向，
 * 不是 DOM shim 的缺口。
 */
if (typeof globalThis.PointerEvent === "undefined") {
	class PointerEventLike extends MouseEvent {
		readonly pointerId: number;
		readonly pointerType = "mouse";
		readonly isPrimary = true;
		constructor(type: string, init: PointerEventInit = {}) {
			super(type, init);
			this.pointerId = init.pointerId ?? 1;
		}
	}
	Object.defineProperty(globalThis, "PointerEvent", { value: PointerEventLike, writable: true });
}

afterEach(cleanup);

const t = (key: string) => key;
const model = { modelKey: "openrouter/x", name: "glm-5.3", provider: "openrouter" };

/** The handle in a container, found by role so the test is about the control, not the class. */
function handleOf(container: HTMLElement): HTMLElement {
	const node = container.querySelector('[role="separator"]');
	if (!node) throw new Error("no resize handle rendered");
	return node as HTMLElement;
}

function heightVar(container: HTMLElement): number {
	const box = container.querySelector(".astra-strix-prompt, .astra-strix-composer") as HTMLElement | null;
	const raw = box?.style.getPropertyValue("--sx-composer-h") ?? "";
	return Number.parseInt(raw, 10) || 0;
}

describe("launch screen composer", () => {
	function renderLaunch() {
		const utils = render(
			<LaunchScreen
				t={t}
				model={model}
				log={[]}
				boot={{ state: "ready" }}
				version="0.6.2"
				busy={false}
				onSubmit={() => undefined}
				onQuit={() => undefined}
			/>,
		);
		return utils;
	}

	it("renders a separator handle and starts with no fixed height", () => {
		const { container } = renderLaunch();
		expect(handleOf(container)).toBeTruthy();
		expect(heightVar(container)).toBe(0);
	});

	it("gets taller when the handle is dragged up", () => {
		const { container } = renderLaunch();
		const handle = handleOf(container);
		const box = container.querySelector(".astra-strix-prompt") as HTMLElement;

		// The hook measures the rendered box; jsdom has no layout, so give it one.
		box.getBoundingClientRect = () => ({ height: 120, width: 400, top: 0, left: 0, bottom: 120, right: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

		act(() => {
			fireEvent.pointerDown(handle, { pointerId: 1, clientY: 400 });
		});
		act(() => {
			// 60px up: a working implementation grows the box.
			fireEvent.pointerMove(handle, { pointerId: 1, clientY: 340 });
		});
		act(() => {
			fireEvent.pointerUp(handle, { pointerId: 1, clientY: 340 });
		});

		expect(heightVar(container)).toBe(180);
	});

	it("gets shorter when the handle is dragged down", () => {
		const { container } = renderLaunch();
		const handle = handleOf(container);
		const box = container.querySelector(".astra-strix-prompt") as HTMLElement;
		box.getBoundingClientRect = () => ({ height: 120, width: 400, top: 0, left: 0, bottom: 120, right: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

		act(() => {
			fireEvent.pointerDown(handle, { pointerId: 1, clientY: 300 });
		});
		act(() => {
			fireEvent.pointerMove(handle, { pointerId: 1, clientY: 340 });
		});

		// Already at the floor for a 40px shrink from 120 → 80; must not invert past it.
		expect(heightVar(container)).toBe(80);
	});

	it("answers arrow keys as well, so the control is reachable without a pointer", () => {
		const { container } = renderLaunch();
		const handle = handleOf(container);
		const box = container.querySelector(".astra-strix-prompt") as HTMLElement;
		box.getBoundingClientRect = () => ({ height: 120, width: 400, top: 0, left: 0, bottom: 120, right: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

		act(() => {
			fireEvent.keyDown(handle, { key: "ArrowUp" });
		});
		expect(heightVar(container)).toBe(136);
	});
});

describe("scan screen composer", () => {
	const base = {
		t,
		phase: "scanning" as const,
		model,
		sandbox: { running: true, targets: ["a.test"] },
		findings: [],
		trace: [],
		todos: [],
		notes: [],
		coverage: [],
		mcp: [],
		hostStreaming: false,
		busy: false,
		onSend: () => undefined,
		onStop: () => undefined,
	};

	it("carries the same handle, so both screens behave alike", () => {
		const { container } = render(<ScanScreen {...base} />);
		const handle = handleOf(container);
		expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
		expect(handle.getAttribute("tabindex")).toBe("0");
	});
});
