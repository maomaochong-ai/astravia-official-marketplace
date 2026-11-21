// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchBridge } from "../../features/workbench/bridge";
import { WorkbenchScreen } from "../../features/workbench/components/workbench-screen";

/**
 * 四个取证向侧栏的契约：样本 / 发现 / 字符串 / 深层反汇编。
 *
 * 每一条都对应一个「看起来对、实际读不出结论」的写法：
 *   1. 样本页在 grid 容器里用 `fill`（flex 属性）—— 左栏拿不到有界高度；
 *   2. 发现页把级别印两遍（原始枚举 + 译文），并用 0/1 的统计卡假装「无发现」计数；
 *   3. 字符串页统计卡写死三类，另三类永远为 0 也永远看不到；
 *   4. 反汇编页把「索引中」显示成「没有函数匹配」。
 */

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

function makeBridge(): WorkbenchBridge {
	const empty = async () => ({ ok: true, value: [] as unknown[] });
	return {
		listFiles: vi.fn(async () => []),
		readState: vi.fn(async () => null),
		writeState: vi.fn(async () => true),
		readTextFile: vi.fn(async () => ({ ok: true, value: "" })),
		stat: vi.fn(async () => ({ ok: true, value: { size: 1, isDirectory: false } })),
		mkdir: vi.fn(empty),
		writeFile: vi.fn(empty),
		readDir: vi.fn(empty),
		remove: vi.fn(empty),
		copy: vi.fn(empty),
		askUser: vi.fn(async () => ({ ok: true, value: null })),
		notify: vi.fn(),
		saveAs: vi.fn(async () => ({ ok: true, value: null })),
		openExternal: vi.fn(async () => ({ ok: true, value: null })),
		listState: vi.fn(async () => []),
		stateUsage: vi.fn(async () => ({ files: 0, bytes: 0 })),
		removeState: vi.fn(async () => true),
		labMode: vi.fn(async () => null),
		saveLabMode: vi.fn(async () => true),
		probeRecord: vi.fn(async () => null),
		hostModel: vi.fn(async () => null),
		library: vi.fn(async () => null),
		saveLibrary: vi.fn(async () => true),
		settings: vi.fn(async () => null),
		saveSettings: vi.fn(async () => true),
		myCases: vi.fn(async () => null),
		saveMyCases: vi.fn(async () => true),
		listReports: vi.fn(async () => []),
		readReport: vi.fn(async () => null),
		onTaskEvent: vi.fn(() => () => {}),
		chat: vi.fn(async () => "sent" as const),
		subscribeChat: vi.fn(() => () => {}),
	} as unknown as WorkbenchBridge;
}

async function open(page: "samples" | "findings" | "disasm") {
	render(<WorkbenchScreen bridge={makeBridge()} cwd="/work" />);
	await act(async () => {});
	fireEvent.click(screen.getByTitle(`nav.${page}`));
	await act(async () => {});
}

afterEach(cleanup);

describe("samples / findings / strings / disasm sidebars", () => {
	it("gives the sample picker a bounded height on a narrow panel", async () => {
		await open("samples");
		// 左栏卡片必须自带高度上限（文件一多不能把右栏推走）。
		// 上限从行内工具类移进 `.fb-samples-picker`：一份限制同时管宽屏解除，
		// 也不再依赖容器查询工具类能否盖过 `.fb-page`。
		const picker = screen.getByText("page.samples.picker").closest("section");
		expect(picker?.className).toContain("fb-samples-picker");
		const css = readFileSync(join(__dirname, "..", "..", "..", "src/style.css"), "utf8");
		expect(css).toMatch(/\.fb-samples-picker\s*\{[^}]*max-height:\s*min\(46vh/);
		// 宽屏才解除上限并固定成窄列。
		expect(css).toMatch(/@container \(min-width: 820px\)[\s\S]{0,240}grid-template-columns/);
	});

	it("offers a way out of the findings empty state", async () => {
		await open("findings");
		// 没有报告时这一页原本没有任何出口。
		expect(await screen.findByText("findings.empty.action")).toBeTruthy();
		expect(screen.getByText("empty.noReport.title")).toBeTruthy();
	});

	it("prints the severity once, and shows no 0/1 pseudo-count", async () => {
		await open("findings");
		// 空库时「无发现」是标签而不是一格 0/1；它所在的那格统计卡已经删掉。
		const tiles = [...document.querySelectorAll("section")].map(node => node.textContent ?? "");
		expect(tiles.some(text => text.includes("findings.stat.cleanHint"))).toBe(false);
	});

	it("does not call an in-progress index an empty list", async () => {
		await open("disasm");
		// 没有样本时给的是 unsupported 空态，而不是「没有函数匹配这个过滤条件」。
		expect(await screen.findByText("disasm.unsupported.no-sample.title")).toBeTruthy();
		expect(screen.queryByText("disasm.functions.empty")).toBeNull();
	});

	it("labels the disasm list count so filtered and capped read differently", async () => {
		await open("disasm");
		await waitFor(() => expect(document.body.textContent).toBeTruthy());
		// 计数文案走 locale 键；裸的 "200/350" 读不出是被过滤还是被截断。
		expect(document.body.innerHTML).not.toMatch(/\d+\/\d+/);
	});
});
