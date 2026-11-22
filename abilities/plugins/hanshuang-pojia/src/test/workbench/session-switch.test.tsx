// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkbenchBridge } from "../../features/workbench/bridge";
import { WorkbenchScreen } from "../../features/workbench/components/workbench-screen";
import { publishPanelEvent } from "../../runtime/panel-channel";

/**
 * 会话切换的复位边界。
 *
 * 宿主「新建会话」只换 sessionId，面板是同一个组件实例 —— 内存里的 report 不会自己清。
 * 不复位的话，新会话第一屏还挂着上一个会话的样本与评分。
 *
 * 复位范围按存储作用域划：只清「这一次分析」（report / sample / phase），
 * 保留工作区级（样本库）与插件级（设置、提示词库、探测档案）。
 */

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

function makeBridge(captured: ((state: Record<string, unknown>) => void)[]): WorkbenchBridge {
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
		subscribeChat: vi.fn((callback: (state: Record<string, unknown>) => void) => {
			captured.push(callback);
			return () => {};
		}),
	} as unknown as WorkbenchBridge;
}

afterEach(cleanup);

describe("session switch", () => {
	it("drops the in-memory report when the host starts a new conversation", async () => {
		const captured: ((state: Record<string, unknown>) => void)[] = [];
		render(<WorkbenchScreen bridge={makeBridge(captured)} cwd="/work" />);
		await act(async () => {});

		// 一个会话推来一份报告：工作台因此显示样本名。
		act(() =>
			publishPanelEvent({
				type: "report",
				source: "agent",
				report: {
					mode: "summary",
					target: { path: "/work/a.apk", name: "session-one.apk", size: 1, sha256: "a", format: "apk", formatLabel: "APK", generatedAt: "2026-11-20T00:00:00.000Z" },
					risk: { score: 10, grade: "low", drivers: [] },
					findings: [],
					facts: [],
					sections: [],
					limits: [],
					summary: [],
				} as never,
			}),
		);
		// 样本名会同时出现在侧栏状态、概览与活动里：断言「至少有一处」。
		expect((await screen.findAllByText(/session-one\.apk/)).length).toBeGreaterThan(0);

		// 宿主新建会话：sessionId 由 subscribeChat 的会话事件送进来（不是 task 事件）。
		act(() => captured[0]?.({ sessionId: "session-two", status: "idle", tool: null, cwd: "/work" }));

		// 新会话的第一屏不该还挂着上一个会话的样本。
		// 注意：工作区样本库（entries）按设计保留 —— 「同一目录下的历史不该因为换会话就消失」，
		// 所以这里断言的是**当前样本**回到空，而不是名字从界面上消失。
		await waitFor(() => expect(screen.getAllByText("status.sample.none").length).toBeGreaterThan(0));
	});

	it("keeps the prompt library and settings across the switch", async () => {
		const captured: ((state: Record<string, unknown>) => void)[] = [];
		const api = makeBridge(captured);
		render(<WorkbenchScreen bridge={api} cwd="/work" />);
		await act(async () => {});

		act(() => captured[0]?.({ sessionId: "session-two", status: "idle", tool: null, cwd: "/work" }));

		// 插件级存储与会话无关：切会话不该触发新的读取。
		// 注意基线不是 0：首次加载会读一次主路径 + 一次 legacy 回落，所以比「切前 vs 切后」。
		const reads = () => vi.mocked(api.readState).mock.calls.filter(([path]) => String(path).includes("prompt-library")).length;
		const before = reads();
		act(() => captured[0]?.({ sessionId: "session-three", status: "idle", tool: null, cwd: "/work" }));
		expect(reads()).toBe(before);
	});
});
