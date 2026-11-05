import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_OUTLINE_SCRIPT } from "./boardmix-outline";

interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

function button(label: string, box: Box) {
	return {
		tagName: "BUTTON",
		getAttribute: () => null,
		innerText: label,
		value: "",
		getBoundingClientRect: () => ({
			...box,
			right: box.left + box.width,
			bottom: box.top + box.height,
		}),
	};
}

function run(options: {
	href?: string;
	innerText?: string;
	nodes?: unknown[];
	innerWidth?: number;
	innerHeight?: number;
	scrollY?: number;
}) {
	vi.stubGlobal("document", {
		title: "Boardmix",
		readyState: "complete",
		body: { innerText: options.innerText ?? "" },
		querySelectorAll: () => options.nodes ?? [],
	});
	vi.stubGlobal("window", {
		innerWidth: options.innerWidth ?? 1200,
		innerHeight: options.innerHeight ?? 800,
		scrollX: 0,
		scrollY: options.scrollY ?? 0,
	});
	vi.stubGlobal("location", { href: options.href ?? "https://boardmix.cn/app/my-folder/1/0" });
	return new Function(`return ${PAGE_OUTLINE_SCRIPT}`)() as {
		items: { label: string; x: number; y: number; tag: string }[];
		text: string;
		login: boolean;
		url: string;
		size: { width: number; height: number };
		scroll: { x: number; y: number };
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("PAGE_OUTLINE_SCRIPT", () => {
	it("reports each control at the centre of its box, in viewport pixels", () => {
		const out = run({ nodes: [button("保存", { left: 10, top: 20, width: 100, height: 40 })] });
		expect(out.items).toHaveLength(1);
		expect(out.items[0]).toMatchObject({ tag: "button", label: "保存", x: 60, y: 40 });
	});

	it("skips what a person could not hit", () => {
		const out = run({
			nodes: [
				button("太小", { left: 0, top: 0, width: 2, height: 2 }),
				button("在视口上方", { left: 40, top: -400, width: 100, height: 40 }),
				button("可以点", { left: 40, top: 400, width: 100, height: 40 }),
			],
		});
		expect(out.items.map(item => item.label)).toEqual(["可以点"]);
	});

	it("keeps the page text well past a label's length", () => {
		const long = `${"这是一段很长的页面正文。".repeat(20)}尾`;
		expect(long.length).toBeGreaterThan(200);
		const out = run({ innerText: long.replace(/\s/g, " ") });
		expect(out.text.length).toBeGreaterThan(80);
		expect(out.text.endsWith("尾")).toBe(true);
		// Still bounded: an outline that returned a whole document would be useless as context.
		expect(out.text.length).toBeLessThanOrEqual(1800);
	});

	it("collapses whitespace instead of quoting it", () => {
		const out = run({ innerText: "  第一段   内容\n 第二段 " });
		expect(out.text).toBe("第一段 内容 第二段");
	});

	it("says whether the page is a sign-in screen", () => {
		expect(run({ href: "https://boardmix.cn/login?redirect=%2Fapp" }).login).toBe(true);
		expect(run({ href: "https://passport.boardmix.cn/x" }).login).toBe(true);
		expect(run({ href: "https://boardmix.cn/app/my-folder/1/0" }).login).toBe(false);
	});

	it("reports the viewport and scroll it measured", () => {
		const out = run({ innerWidth: 1440, innerHeight: 900, scrollY: 320 });
		expect(out.size).toEqual({ width: 1440, height: 900 });
		expect(out.scroll).toEqual({ x: 0, y: 320 });
	});
});
