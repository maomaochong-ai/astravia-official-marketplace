// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TriageReport } from "../domain/report/report";
import { buildReport } from "../domain/report/report";
import type { TriageSample } from "../domain/triage";
import type { WorkbenchBridge } from "../features/workbench/bridge";
import { WorkbenchScreen } from "../features/workbench/components/workbench-screen";
import { publishPanelEvent, publishTaskEvent } from "../runtime/panel-channel";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const TEXT = new TextEncoder().encode("http://example.com/api\0AKIAABCDEFGHIJKLMNOP\0");
const BYTES = new Uint8Array(2048);
BYTES.set(TEXT.subarray(0, 40), 0);
BYTES.set(TEXT.subarray(41), 64);

const SAMPLE: TriageSample = { path: "/work/demo.apk", name: "demo.apk", bytes: BYTES };

const REPORT: TriageReport = buildReport({
	mode: "summary",
	target: {
		path: "/work/demo.apk",
		name: "demo.apk",
		size: 4_194_304,
		sha256: "a".repeat(64),
		format: "apk",
		formatLabel: "Android package (APK)",
		generatedAt: "2026-10-20T00:00:00.000Z",
	},
	findings: [
		{ ruleId: "apk.debuggable", severity: "high", title: "Application is debuggable", detail: "debuggable is true", evidence: [] },
		{
			ruleId: "apk.hardcoded-secret",
			severity: "high",
			title: "Credential-shaped string in the binaries",
			detail: "one unmasked string",
			evidence: ["AWS access key: AKIA…LE (20 chars)"],
		},
	],
	facts: [
		{ label: "Package name", value: "com.example.triage" },
		{ label: "Version name", value: "2.0" },
	],
	sections: [
		{ id: "components", title: "Components", columns: ["Component", "Exposure"], rows: [{ label: "activity .Main", value: "exported" }] },
		{ id: "permissions", title: "Requested permissions", columns: ["Permission", "Note"], rows: [{ label: "android.permission.CAMERA", value: "platform" }] },
	],
	limits: ["Only the first DEX file was scanned."],
	summary: ["com.example.triage 2.0 · 3 components"],
	signature: { v1: true, v2: true, v3: false, schemes: ["SHA-256"] },
});

function makeBridge(overrides: Partial<WorkbenchBridge> = {}): WorkbenchBridge {
	return {
		listFiles: vi.fn(async () => [
			{ name: "demo.apk", path: "/work/demo.apk", size: 4_194_304, isDirectory: false, modifiedAt: 0 },
			{ name: "notes.txt", path: "/work/notes.txt", size: 128, isDirectory: false, modifiedAt: 0 },
			{ name: "lib", path: "/work/lib", size: 0, isDirectory: true, modifiedAt: 0 },
		]),
		readTextFile: vi.fn(async () => null),
		stat: vi.fn(async () => ({ size: 4_194_304 })),
		loadSample: vi.fn(async () => SAMPLE),
		importSample: vi.fn(async () => "/work/.hanshuang/samples/picked.apk"),
		analyse: vi.fn(async () => REPORT),
		notify: vi.fn(),
		saveReport: vi.fn(async () => "/work/demo-triage.md"),
		chat: vi.fn(async () => "sent" as const),
		subscribeChat: vi.fn(() => () => {}),
		readState: vi.fn(async () => null),
		writeState: vi.fn(async () => true),
		settings: vi.fn(async () => null),
		saveSettings: vi.fn(async () => true),
		library: vi.fn(async () => null),
		saveLibrary: vi.fn(async () => true),
		labMode: vi.fn(async () => null),
		saveLabMode: vi.fn(async () => true),
		...overrides,
	};
}

async function open(api: WorkbenchBridge, cwd: string | null = "/work") {
	render(<WorkbenchScreen bridge={api} cwd={cwd} />);
	await act(async () => {});
	if (cwd) await waitFor(() => expect(api.listFiles).toHaveBeenCalled());
}

async function go(page: string) {
	fireEvent.click(screen.getByTitle(`nav.${page}`));
}

async function analyseDemo(api: WorkbenchBridge) {
	await go("samples");
	fireEvent.click(await screen.findByTitle("/work/demo.apk"));
	await waitFor(() => expect(api.stat).toHaveBeenCalled());
}

afterEach(cleanup);

describe("workbench shell", () => {
	it("opens the document library and renders a bundled write-up", async () => {
		const api = makeBridge();
		await open(api);
		await go("docs");
		expect(await screen.findByText("page.docs.title")).toBeTruthy();
		// 默认选中知识库根文档；正文经 import.meta.glob 惰性加载后才出现。
		expect(await screen.findByRole("heading", { level: 1 }, { timeout: 4000 })).toBeTruthy();
		expect(screen.getAllByText(/Knowledge Base/).length).toBeGreaterThan(0);
	}, 15_000);

	it("hands the pane to the reader after a pick, and gives the list back", async () => {
		const api = makeBridge();
		await open(api);
		await go("docs");
		await screen.findByRole("heading", { level: 1 }, { timeout: 4000 });

		// 窄面板下单列：目录在开，正文在下方。
		const list = screen.getByTestId("docs-list");
		expect(list.className).toContain("flex");
		expect(list.className).not.toContain("hidden");

		fireEvent.click(list.querySelector('[data-doc-id="kb/README"]') as HTMLButtonElement);
		await waitFor(() => expect(screen.getByTestId("docs-list").className).toContain("hidden"));

		// 返回按钮把目录让回来，而不是让人以为文档打不开。
		fireEvent.click(screen.getByText("docs.reader.back"));
		await waitFor(() => expect(screen.getByTestId("docs-list").className).not.toContain("hidden"));
	}, 15_000);

	it("lists only sample files from the workspace", async () => {
		const api = makeBridge();
		await open(api);
		await go("samples");
		expect(await screen.findByTitle("/work/demo.apk")).toBeTruthy();
		expect(screen.queryByText("notes.txt")).toBeNull();
		expect(screen.queryByText("lib")).toBeNull();
	});

	it("copies a picked local file into the workspace and analyses it", async () => {
		const api = makeBridge();
		await open(api);
		await go("samples");

		// 宿主的 fs 只授权到项目根，所以选中文件必须经 importSample 先落进工作区。
		const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(picker).toBeTruthy();
		const picked = new File([new Uint8Array([1, 2, 3])], "../evil.apk");
		fireEvent.change(picker, { target: { files: [picked] } });

		// 渲染进程只负责交字节；名字的净化和落盘路径由 bridge 侧的 importRelativePath 决定。
		await waitFor(() =>
			expect(api.importSample).toHaveBeenCalledWith({ name: "../evil.apk", base64: "AQID", index: 0, last: true }, "/work"),
		);
		await waitFor(() => expect(api.loadSample).toHaveBeenCalledWith("/work/.hanshuang/samples/picked.apk", "/work"));
	});

	it("runs a triage from a click and shows the score and findings", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		expect(api.loadSample).toHaveBeenCalledWith("/work/demo.apk", "/work");
		expect(api.analyse).toHaveBeenCalledWith(SAMPLE, { mode: "summary", disabledRules: [] });
		expect((await screen.findAllByText("Application is debuggable")).length).toBeGreaterThan(0);
		expect(screen.getAllByText(String(REPORT.risk.score)).length).toBeGreaterThan(0);
	});

	it("re-analyses with the full mode after switching it in settings", async () => {
		const api = makeBridge();
		await open(api);
		await go("settings");
		fireEvent.click(screen.getByText("mode.full"));
		await analyseDemo(api);
		await waitFor(() => expect(api.analyse).toHaveBeenLastCalledWith(SAMPLE, { mode: "full", disabledRules: [] }));
	});

	it("saves a report and reports where it landed", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		await go("reports");
		fireEvent.click(screen.getByText("reports.export"));
		await waitFor(() => expect(api.saveReport).toHaveBeenCalledWith(REPORT, "summary", "markdown"));
		expect(api.notify).toHaveBeenCalledWith("panel.action.saved", "success");
	});

	it("surfaces a failed load as an error that can be cleared", async () => {
		const api = makeBridge({ loadSample: vi.fn(async () => Promise.reject(new Error("boom"))) });
		await open(api);
		await analyseDemo(api);
		expect(await screen.findByText("blocked.other.title")).toBeTruthy();
		expect(screen.getByText("boom")).toBeTruthy();
		fireEvent.click(screen.getByText("blocked.retry"));
		await waitFor(() => expect(screen.queryByText("blocked.other.title")).toBeNull());
	});

	it("indexes the cases in the project and shows which are gated", async () => {
		// 面板不写盘，只把 cases/ 下的声明读出来：与 search_cases 共用同一个扫描器。
		const scope = [
			"## auth",
			"- status: granted",
			"",
			"## in_scope",
			"- assets:",
			"  - demo.apk",
			"",
			"## network_profile",
			"- mode: offline",
			"- offline_sample: samples/demo.apk",
			"",
		].join("\n");
		const workitems =
			"| ID | title | role | targets | surface | status | evidence | notes |\n|----|-------|------|---------|---------|--------|----------|-------|\n| WI-001 | Baseline | lead | demo.apk | android | done | E-001 | |\n";
		const entries = (paths: [string, boolean][]) =>
			paths.map(([path, isDirectory]) => ({ name: path.split("/").pop()!, path, size: 0, isDirectory, modifiedAt: 0 }));
		const api = makeBridge({
			listFiles: vi.fn(async (path: string) => {
				if (path === "/work") return entries([["/work/cases", true]]);
				if (path === "/work/cases") return entries([["/work/cases/demo", true]]);
				if (path === "/work/cases/demo")
					return entries([
						["/work/cases/demo/scope.md", false],
						["/work/cases/demo/workitems.md", false],
						["/work/cases/demo/README.md", false],
						["/work/cases/demo/evidence", true],
					]);
				if (path === "/work/cases/demo/evidence") return entries([["/work/cases/demo/evidence/E-001-entry.md", false]]);
				return Promise.reject(new Error("ENOENT"));
			}),
			readTextFile: vi.fn(async (path: string) => {
				if (path.endsWith("scope.md")) return scope;
				if (path.endsWith("workitems.md")) return workitems;
				if (path.endsWith("E-001-entry.md")) return "# E-001 — baseline\n\nObserved: the stub jumps to a computed address.\n";
				return null;
			}),
		});
		await open(api);
		await go("cases");

		expect(await screen.findByText("page.cases.title")).toBeTruthy();
		// 目录名就是案例名；计数在行里，正文在右侧阅读区。
		const row = await screen.findByTitle("/work/cases/demo");
		expect(screen.getByText("cases.ready.yes")).toBeTruthy();
		expect(screen.getByText("cases.count", { exact: false })).toBeTruthy();
		expect(screen.getByText("cases.reader.empty.title")).toBeTruthy();
		fireEvent.click(row);
		expect(await screen.findByText("cases.detail.inScope")).toBeTruthy();

		// 「预览」不是再给一条路径：案例目录里的 Markdown 直接读出来。
		const reader = screen.getByTestId("cases-reader");
		expect(await within(reader).findByText("in_scope")).toBeTruthy();
		expect(within(reader).getAllByText("demo.apk").length).toBeGreaterThan(0);
		expect(screen.getByTestId("case-doc-tabs")).toBeTruthy();
		expect(screen.getByText("README.md")).toBeTruthy();

		// 标签条能换篇：证据条目有自己的正文。
		const evidenceTab = document.querySelector('[data-doc-id="evidence/E-001-entry.md"]');
		expect(evidenceTab).not.toBeNull();
		fireEvent.click(evidenceTab!);
		expect(await within(reader).findByText(/the stub jumps to a computed address/)).toBeTruthy();
		// 先例库与本地案例同页但不同源：包名来自随包语料，而它自己的 scope 仍是待定。
		expect(screen.getByText("cases.precedent.title")).toBeTruthy();
		expect(screen.getByText("cases/elf-packed-loader/")).toBeTruthy();
	});

	it("reads a shipped precedent in place, without touching the disk", async () => {
		// 先例正文在编译期内联，预览它不需要任何文件通道。
		const api = makeBridge();
		await open(api);
		await go("cases");

		fireEvent.click(await screen.findByTitle("cases/elf-packed-loader/"));

		const reader = screen.getByTestId("cases-reader");
		expect(within(reader).getByText("Packed ELF loader — precedent")).toBeTruthy();
		expect(screen.getByTestId("precedent-doc-tabs")).toBeTruthy();
		const methodTab = document.querySelector('[data-doc-id="docs/method.md"]');
		expect(methodTab).not.toBeNull();
		fireEvent.click(methodTab!);
		expect(within(reader).getByText("Method — recovering a packed ELF")).toBeTruthy();
		// 一份先例都没碰过文件通道：命中它的路径既没被列过，也没被读过。
		const touched = [...vi.mocked(api.listFiles).mock.calls, ...vi.mocked(api.readTextFile).mock.calls]
			.map(call => call[0])
			.filter(path => path.includes("elf-packed-loader"));
		expect(touched).toEqual([]);
	});
});

describe("workbench handoff", () => {
	it("explains the flow and sends a prompt from the guide", async () => {
		const api = makeBridge();
		await open(api);
		await go("guide");
		expect(await screen.findByText("guide.step.pick.title")).toBeTruthy();
		fireEvent.click(screen.getByTitle("ai.workflow"));
		await waitFor(() => expect(api.chat).toHaveBeenCalled());
		expect(api.notify).toHaveBeenCalledWith("chat.sent", "success");
	});

	it("translates a host path rejection into the handoff lane", async () => {
		const api = makeBridge({
			loadSample: vi.fn(async () => Promise.reject(new Error("Capability provider failed: path is outside the project"))),
		});
		await open(api);
		await analyseDemo(api);
		expect(await screen.findByText("blocked.outside.title")).toBeTruthy();
		expect(screen.getByText("blocked.handoff")).toBeTruthy();
	});

	it("rejects a sample outside the project before the host IPC", async () => {
		const api = makeBridge();
		await open(api);
		await go("samples");
		fireEvent.change(screen.getByPlaceholderText("panel.path.placeholder"), { target: { value: "/tmp/other.apk" } });
		fireEvent.click(screen.getByText("panel.path.analyse"));
		expect(await screen.findByText("blocked.outside.title")).toBeTruthy();
		expect(api.loadSample).not.toHaveBeenCalled();
	});

	it("refuses an oversized sample before reading it", async () => {
		const api = makeBridge({ stat: vi.fn(async () => ({ size: 40 * 1024 * 1024 })) });
		await open(api);
		await analyseDemo(api);
		expect(await screen.findByText("blocked.tooLarge.title")).toBeTruthy();
		expect(api.loadSample).not.toHaveBeenCalled();
	});

	it("hands an oversized sample to the agent with one click", async () => {
		const api = makeBridge({ stat: vi.fn(async () => ({ size: 40 * 1024 * 1024 })) });
		await open(api);
		await analyseDemo(api);
		fireEvent.click(await screen.findByText("blocked.handoff"));
		// 先开对话框（默认中文、可改），再点发送才真正到对话。
		const dialog = await screen.findByTestId("handoff-dialog");
		expect((dialog.querySelector("textarea") as HTMLTextAreaElement).value).toContain("/work/demo.apk");
		fireEvent.click(within(dialog).getByText("handoff.send"));
		await waitFor(() => expect(api.chat).toHaveBeenCalled());
		const [prompt] = vi.mocked(api.chat).mock.calls[0]!;
		expect(prompt.length).toBeGreaterThan(0);
		expect(api.notify).toHaveBeenCalledWith("chat.sent", "success");
	});

	it("reports a queued prompt instead of claiming it was sent", async () => {
		const api = makeBridge({ chat: vi.fn(async () => "queued" as const) });
		await open(api);
		await go("guide");
		fireEvent.click(await screen.findByTitle("ai.workflow"));
		await waitFor(() => expect(api.notify).toHaveBeenCalledWith("chat.queued", "info"));
	});

	it("asks for a workspace when the host has no cwd", async () => {
		const api = makeBridge();
		await open(api, null);
		await go("samples");
		expect(await screen.findByText("panel.rail.noCwd")).toBeTruthy();
	});
});

describe("workbench state", () => {
	it("navigates every page from the sidebar", async () => {
		const api = makeBridge();
		await open(api);
		await go("findings");
		expect(await screen.findByText("empty.noReport.title")).toBeTruthy();
		await go("selfcheck");
		expect(await screen.findByText("selfcheck.item.engine.digest")).toBeTruthy();
		await go("settings");
		expect(await screen.findByText("settings.mode.title")).toBeTruthy();
		await go("prompts");
		// 注入块预览不依赖已保存的提示词：没有激活的就展示默认契约。
		expect(await screen.findByText("prompt.inject.title")).toBeTruthy();
		expect(screen.getByText("prompt.inject.sourceDefault")).toBeTruthy();
	});

	it("renders the workflow bar and locks steps until their precondition is met", async () => {
		const api = makeBridge();
		await open(api);
		expect(await screen.findByText("workflow.pick.title")).toBeTruthy();
		expect(screen.getByText("workflow.analyse.title").closest("button")).toHaveProperty("disabled", true);
		expect(screen.getByText("workflow.forensic.title").closest("button")).toHaveProperty("disabled", true);
		expect(screen.getByText("workflow.toolbox.title").closest("button")).not.toHaveProperty("disabled", true);
	});

	it("renders the pipeline bar with idle / lit stages from real state", async () => {
		const api = makeBridge();
		await open(api);
		// 无样本：整条落在 waiting，四段不可点。
		expect(await screen.findByText("pipeline.idle")).toBeTruthy();
		expect(screen.getByText("pipeline.profile.title").closest("button")).toHaveProperty("disabled", true);

		await analyseDemo(api);
		// 有报告：画像与控制流点亮，智库 / 验证一直可读。
		expect(screen.queryByText("pipeline.idle")).toBeNull();
		expect(screen.getByText("pipeline.profile.title").closest("button")).not.toHaveProperty("disabled", true);
		expect(screen.getByText("pipeline.controlflow.title").closest("button")).not.toHaveProperty("disabled", true);
	});

	it("sends the install-all command to the conversation from the self-check page", async () => {
		const api = makeBridge();
		await open(api);
		await go("selfcheck");
		fireEvent.click(await screen.findByText("selfcheck.tools.installAll"));
		await waitFor(() => expect(api.chat).toHaveBeenCalled());
		const [prompt] = vi.mocked(api.chat).mock.calls[0]!;
		expect(prompt).toContain("install_toolchain");
	});

	it("takes a report published from the conversation", async () => {
		const api = makeBridge();
		await open(api);
		act(() => publishPanelEvent({ type: "report", report: REPORT, source: "agent" }));
		expect(await screen.findByText("dropzone.fromAgent")).toBeTruthy();
		await go("reports");
		expect((await screen.findAllByText("demo.apk")).length).toBeGreaterThan(0);
	});

	it("passes disabled rules into the engine", async () => {
		const api = makeBridge();
		await open(api);
		await go("settings");
		fireEvent.click(screen.getAllByRole("switch")[0]!);
		await analyseDemo(api);
		await waitFor(() => expect(api.analyse).toHaveBeenLastCalledWith(SAMPLE, { mode: "summary", disabledRules: [expect.any(String)] }));
	});

	it("extracts strings locally once a sample is loaded", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		await go("strings");
		expect(await screen.findByText("http://example.com/api")).toBeTruthy();
	});

	it("refuses deep disassembly for a package that is not a native image", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		await go("disasm");
		// APK 字节里没有可解析的 ELF / PE / Mach-O 头，页面必须说清楚而不是空着。
		expect(await screen.findByText("disasm.unsupported.no-facts.title")).toBeTruthy();
	});

	it("needs two analysed reports before comparing", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		await go("compare");
		expect(await screen.findByText("compare.needTwo.title")).toBeTruthy();
	});

	it("shows the manifest pages only after a report exists", async () => {
		const api = makeBridge();
		await open(api);
		await go("manifest");
		expect(await screen.findByText("empty.noReport.title")).toBeTruthy();
		await analyseDemo(api);
		await go("manifest");
		expect(await screen.findByText("android.permission.CAMERA")).toBeTruthy();
	});

	it("keeps the panel usable when the host denies the chat subscription", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const api = makeBridge({
			subscribeChat: vi.fn(() => {
				throw new Error("Plugin permission denied: agent.session.read");
			}),
		});
		await open(api);
		expect(api.subscribeChat).toHaveBeenCalled();
		expect(screen.getByTitle("nav.samples")).toBeTruthy();
		await analyseDemo(api);
		expect((await screen.findAllByText("Application is debuggable")).length).toBeGreaterThan(0);
		warn.mockRestore();
	});

	it("keeps the sidebar live area in step with the agent session", async () => {
		const api = makeBridge();
		await open(api);

		const status = screen.getByTestId("sidebar-status");
		expect(status).toBeTruthy();
		expect(screen.getByText("status.sample.none")).toBeTruthy();

		// 侧栏只消费已有事件：turn / tool 生命周期进「本轮」，报告进「当前样本」。
		act(() => {
			publishTaskEvent({ phase: "turn-start", sessionId: "s1" });
			publishTaskEvent({ phase: "tool-start", sessionId: "s1", toolName: "triage_binary" });
		});
		expect(await screen.findByText("status.run.active")).toBeTruthy();
		expect(screen.getAllByText("triage_binary").length).toBeGreaterThan(0);

		act(() => {
			publishTaskEvent({ phase: "tool-end", sessionId: "s1", toolName: "triage_binary", isError: true });
		});
		expect(await screen.findByText("status.run.failed")).toBeTruthy();

		act(() => publishPanelEvent({ type: "report", report: REPORT, source: "agent" }));
		await waitFor(() => expect(status.querySelector('[data-row="sample"]')?.textContent).toContain("demo.apk"));
	});
});
