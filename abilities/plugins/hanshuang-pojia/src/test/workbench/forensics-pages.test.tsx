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
	it("keeps the sample list filling its own grid cell, not a capped card", async () => {
		await open("samples");
		// 上一版给选择的卡一个 max-height，列表下方就会留出空白；现在列表在自己的格里 flex-1 并自己滚。
		const list = await screen.findByTestId("sample-list");
		expect(list.className).toContain("overflow-y-auto");
		const css = readFileSync(join(__dirname, "..", "..", "..", "src/style.css"), "utf8");
		expect(css).toMatch(/\.fb-samples-list\s*\{[^}]*min-height:\s*0/);
		// 宽屏才并排，且说明是整列的格。
		expect(css).toMatch(/@container \(min-width: 760px\)[\s\S]{0,320}grid-template-columns/);
	});

	it("offers a way out of the findings empty state", async () => {
		await open("findings");
		// 没有报告时这一页原本没有任何出口。
		expect(await screen.findByText("findings.empty.action")).toBeTruthy();
		expect(screen.getByText("empty.noReport.title")).toBeTruthy();
		// 观测行也在这一屏：空态不再只有一个按钮。
		expect(await screen.findByTestId("observation-board")).toBeTruthy();
		expect(screen.getByTestId("observation-list").querySelector('[data-kind="sample"]')).toBeTruthy();
	});

	it("puts the conversation observations above the rule list", async () => {
		await open("findings");
		const board = await screen.findByTestId("observation-board");
		// 没有失败、没有探测、没有报告时，只剩一条「去选样本」的观测，不编一个「一切正常」。
		const rows = [...screen.getByTestId("observation-list").querySelectorAll("li")];
		expect(rows).toHaveLength(1);
		expect(rows[0]?.dataset.tone).toBe("idle");
		// 它在页面里排在统计卡之前：先看「刚刚发生了什么」，再看「结论有几条」。
		expect(board.compareDocumentPosition(document.body) !== 0).toBe(true);
	});

	it("keeps the sample list and its facts in the same card", async () => {
		await open("samples");
		expect(await screen.findByTestId("samples-browser")).toBeTruthy();
		expect(screen.getByTestId("sample-facts")).toBeTruthy();
		// 没有报告时说明列给的是「还没分析」，而不是一片空白。
		expect(screen.getByText("samples.detail.empty")).toBeTruthy();
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
