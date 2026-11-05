// @vitest-environment jsdom
import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BoardmixSeed } from "../../../domain/boardmix-entry";
import type { BoardmixTabHandle } from "../services/tab-registry";
import { BoardmixSurface } from "./boardmix-surface";

/**
 * jsdom 既不能注册 `webview` 自定义元素（名称必须带连字符），也不允许 `new HTMLElement()`
 * 子类。这里用一个普通元素补上 Electron 访客的四个方法，并拦截 `createElement` 把它交给
 * 组件的 `<webview>`——React 只按 `type` 分发属性，不读 tagName。
 */
interface FakeGuest extends HTMLElement {
	loads: string[];
	loadURL(url: string): Promise<void>;
	getURL(): string;
	reload(): void;
	stop(): void;
	goBack(): void;
	goForward(): void;
	canGoBack(): boolean;
	canGoForward(): boolean;
}

const originalCreateElement = document.createElement.bind(document);

function makeGuest(): FakeGuest {
	const element = originalCreateElement("div") as unknown as FakeGuest;
	let current = "about:blank";
	element.loads = [];
	element.loadURL = (url: string) => {
		element.loads.push(url);
		current = url;
		return Promise.resolve();
	};
	element.getURL = () => current;
	element.reload = () => {};
	element.stop = () => {};
	element.goBack = () => {};
	element.goForward = () => {};
	element.canGoBack = () => false;
	element.canGoForward = () => false;
	return element;
}

beforeAll(() => {
	document.createElement = ((tagName: string, options?: ElementCreationOptions) =>
		tagName.toLowerCase() === "webview"
			? makeGuest()
			: originalCreateElement(tagName, options)) as typeof document.createElement;
});

function fire(element: Element, name: string, props: Record<string, unknown> = {}): void {
	const event = new Event(name);
	Object.assign(event, props);
	element.dispatchEvent(event);
}

const ladder: BoardmixSeed[] = [
	{ level: 1, url: "https://boardmix.cn/app/recent-file" },
	{ level: 2, url: "https://boardmix.cn/app/" },
	{ level: 3, url: "https://boardmix.cn/" },
];

function mountSurface() {
	const ref = createRef<BoardmixTabHandle>();
	const onLanded = vi.fn();
	const openExternal = vi.fn();
	const view = render(
		<BoardmixSurface
			ref={ref}
			ladder={ladder}
			onLanded={onLanded}
			openExternal={openExternal}
			translate={(key: string) => key}
		/>,
	);
	const wrapper = view.container.firstElementChild as HTMLElement;
	const guest = wrapper.lastElementChild as FakeGuest;
	return { ref, onLanded, openExternal, guest, view };
}

describe("BoardmixSurface", () => {
	it("navigates to the first seed only once the guest is ready", () => {
		const { guest, view } = mountSurface();
		expect(guest.loads).toEqual([]);

		act(() => fire(guest, "dom-ready"));
		expect(guest.loads).toEqual(["https://boardmix.cn/app/recent-file"]);

		// A second dom-ready (reload) must not re-seed and reset the user's position.
		act(() => fire(guest, "dom-ready"));
		expect(guest.loads).toHaveLength(1);
		view.unmount();
	});

	it("reports the landed address and its phase", () => {
		const { guest, onLanded, ref, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));

		act(() => fire(guest, "did-navigate", { url: "https://boardmix.cn/price/" }));
		expect(onLanded).toHaveBeenCalledTimes(1);
		expect(onLanded.mock.calls[0][0]).toBe("https://boardmix.cn/price/");
		expect(ref.current?.snapshot().phase).toBe("unknown");

		act(() => fire(guest, "did-navigate", { url: "https://boardmix.cn/app/recent-file" }));
		expect(ref.current?.snapshot()).toMatchObject({
			open: true,
			url: "https://boardmix.cn/app/recent-file",
			phase: "workspace",
			seedLevel: 1,
		});
		view.unmount();
	});

	it("ignores a foreign address instead of writing it back", () => {
		const { guest, onLanded, ref, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));
		act(() => fire(guest, "did-navigate", { url: "https://example.com/app/" }));
		expect(onLanded).not.toHaveBeenCalled();
		// 已知地址保持不动，不会被站外跳转覆盖。
		expect(ref.current?.snapshot().url).toBe("https://boardmix.cn/app/recent-file");
		view.unmount();
	});

	it("falls back to the next seed on a fatal main-frame failure", () => {
		const { guest, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));

		act(() => fire(guest, "did-fail-load", { isMainFrame: false, errorCode: -105 }));
		expect(guest.loads).toHaveLength(1);

		act(() => fire(guest, "did-fail-load", { isMainFrame: true, errorCode: -3 }));
		expect(guest.loads).toHaveLength(1);

		act(() => fire(guest, "did-fail-load", { isMainFrame: true, errorCode: -105 }));
		expect(guest.loads).toEqual([
			"https://boardmix.cn/app/recent-file",
			"https://boardmix.cn/app/",
		]);
		view.unmount();
	});

	it("shows the failure notice only after the whole ladder is spent", () => {
		const { guest, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));
		for (const code of [-105, -106, -107]) {
			act(() => fire(guest, "did-fail-load", { isMainFrame: true, errorCode: code }));
		}
		expect(guest.loads.at(-1)).toBe("https://boardmix.cn/");
		expect(view.getByText("panel.failure.title")).toBeTruthy();
		view.unmount();
	});

	it("resolves navigate() with the snapshot that actually landed", async () => {
		const { guest, ref, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));

		let pending: Promise<unknown> | undefined;
		act(() => {
			pending = ref.current?.navigate("https://boardmix.cn/app/create");
		});
		expect(guest.loads.at(-1)).toBe("https://boardmix.cn/app/create");

		act(() => fire(guest, "did-navigate", { url: "https://boardmix.cn/app/create" }));
		await expect(pending).resolves.toMatchObject({
			open: true,
			url: "https://boardmix.cn/app/create",
			phase: "workspace",
			seedLevel: 1,
		});
		view.unmount();
	});

	it("hands the current address to the browser", async () => {
		const { guest, openExternal, ref, view } = mountSurface();
		act(() => fire(guest, "dom-ready"));
		act(() => fire(guest, "did-navigate", { url: "https://boardmix.cn/app/recent-file" }));

		await act(async () => {
			await expect(ref.current?.openInBrowser()).resolves.toBe(true);
		});
		expect(openExternal).toHaveBeenCalledWith("https://boardmix.cn/app/recent-file");
		view.unmount();
	});
});
