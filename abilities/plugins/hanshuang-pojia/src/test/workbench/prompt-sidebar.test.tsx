// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkbenchBridge } from "../../features/workbench/bridge";
import { WorkbenchScreen } from "../../features/workbench/components/workbench-screen";

/**
 * 提示词侧栏：五条只有实测才会暴露的契约。
 *
 *   1. `activeId` 是唯一真相：库里某条条目自称激活但 activeId 指向别处时，必须以 activeId 校正；
 *   2. 搜索只在正文命中时要摊出那段上下文，否则卡片上没有关键词，看起来像搜索坏了；
 *   3. 删除要两次点击（行内武装），不用原生 confirm；
 *   4. 停用会改掉注入正文，所以它要一次确认；
 *   5. 弹窗要 Esc 可关，编辑器还要拦住「有未保存修改就关闭」。
 */

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({
		t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
	}),
	// 面板现在从对话里读实时对照与附件；这一套用例只关心提示词库，所以给空实现。
	useConversationMessages: () => [],
	useActiveConversation: () => ({ id: null, cwd: null, sessionPath: null, model: null, isStreaming: false }),
	usePromptAttachment: () => null,
}));

/**
 * 库里两条，`activeId` 指向 p1；但两条都写着 `active: true`
 * —— 正是旧版本写入后能造出的组合。
 */
const LIBRARY = {
	activeId: "p1",
	items: [
		{ id: "p1", name: "alpha", description: "first", content: "prefix needle suffix", mode: "append", active: true, createdAt: 1, updatedAt: 2 },
		{ id: "p2", name: "beta", description: "second", content: "no hit here", mode: "append", active: true, createdAt: 1, updatedAt: 1 },
	],
};

function makeBridge(): WorkbenchBridge {
	const empty = async () => ({ ok: true, value: [] as unknown[] });
	return {
		listFiles: vi.fn(async () => []),
		// 只喂提示词库那一个键：别的 state 读同一份会造出重复条目。
		readState: vi.fn(async (path: string) => (String(path).endsWith("prompt-library.json") ? LIBRARY : null)),
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

/** 卡片是 `<article>`：testing-library 的 role 映射把 article 排除在可查询角色外。 */
const cards = () => [...document.querySelectorAll("article")] as HTMLElement[];

async function openPrompts() {
	render(<WorkbenchScreen bridge={makeBridge()} cwd="/work" />);
	await act(async () => {});
	fireEvent.click(screen.getByTitle("nav.prompts"));
	await waitFor(() => expect(cards().length).toBe(2));
	await act(async () => {});
}

afterEach(cleanup);

describe("prompt sidebar", () => {
	it("treats activeId as the single source of truth", async () => {
		await openPrompts();
		// 两条都写着 active，但 activeId 只指向 p1：只有 p1 该带「已激活」。
		expect(within(cards()[0]).getByText("prompt.active")).toBeTruthy();
		expect(within(cards()[1]).queryByText("prompt.active")).toBeNull();
	});

	it("explains a hit that only exists in the body", async () => {
		await openPrompts();
		fireEvent.change(screen.getByPlaceholderText("prompt.searchPlaceholder"), { target: { value: "needle" } });

		// 卡片上原本没有这个词；snippet 把它连同上下文摊出来，并标明来自正文。
		const snippet = await screen.findByText(/needle/);
		expect(snippet.textContent).toContain("prefix");
		expect(screen.getByText("prompt.search.inBody")).toBeTruthy();
	});

	it("needs two clicks to delete, and never calls the native confirm", async () => {
		const nativeConfirm = vi.fn(() => true);
		vi.stubGlobal("confirm", nativeConfirm);
		await openPrompts();

		fireEvent.click(within(cards()[0]).getByText("common.delete"));
		// 第一次只是武装：卡还在，按钮换成确认文案。
		expect(cards().length).toBe(2);
		expect(within(cards()[0]).getByText("prompt.deleteArmed")).toBeTruthy();
		expect(nativeConfirm).not.toHaveBeenCalled();

		fireEvent.click(within(cards()[0]).getByText("prompt.deleteArmed"));
		await waitFor(() => expect(cards().length).toBe(1));
		vi.unstubAllGlobals();
	});

	it("spells out what deactivating does before doing it", async () => {
		await openPrompts();
		const card = cards()[0];

		fireEvent.click(within(card).getByText("prompt.deactivate"));
		// 后果必须先说出来：注入正文会回到默认契约；确认之前不该真的停用。
		expect(within(card).getByText("prompt.deactivateHint")).toBeTruthy();
		expect(within(card).getByText("prompt.deactivateConfirm")).toBeTruthy();
		expect(within(card).queryByText("prompt.activate")).toBeNull();
	});

	it("closes the editor on Escape and guards unsaved edits", async () => {
		await openPrompts();
		fireEvent.click(screen.getAllByText("common.edit")[0]);

		const dialog = await screen.findByRole("dialog");
		expect(dialog.getAttribute("aria-modal")).toBe("true");

		// 没改过：Esc 直接关。
		act(() => {
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		// 改过：Esc 先问一句，不丢字。
		fireEvent.click(screen.getAllByText("common.edit")[0]);
		const again = await screen.findByRole("dialog");
		fireEvent.change(within(again).getAllByRole("textbox")[0], { target: { value: "alpha-renamed" } });
		act(() => {
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		});

		expect(await screen.findByText("prompt.editor.dirty")).toBeTruthy();
		expect(screen.getByRole("dialog")).toBeTruthy();
	});
});
