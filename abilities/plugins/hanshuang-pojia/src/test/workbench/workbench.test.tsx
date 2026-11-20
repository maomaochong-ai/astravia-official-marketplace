// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TriageReport } from "../../domain/report/report";
import { buildReport } from "../../domain/report/report";
import type { TriageSample } from "../../domain/triage";
import type { WorkbenchBridge } from "../../features/workbench/bridge";
import { WorkbenchScreen } from "../../features/workbench/components/workbench-screen";
import { publishPanelEvent, publishTaskEvent } from "../../runtime/panel-channel";

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
		// 新增的四个存储面：默认不可用（null / 空），与「没授权」的真实表现一致。
		listState: vi.fn(async () => []),
		stateUsage: vi.fn(async () => ({ files: 0, bytes: 0 })),
		removeState: vi.fn(async () => true),
		myCases: vi.fn(async () => null),
		saveMyCases: vi.fn(async () => true),
		labMode: vi.fn(async () => null),
		saveLabMode: vi.fn(async () => true),
		probeRecord: vi.fn(async () => null),
		saveInjectScript: vi.fn(async () => ".hanshuang/inject/x.ps1"),
		listReports: vi.fn(async () => []),
		readReport: vi.fn(async () => null),
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
		await go("knowledge");
		expect(await screen.findByText("page.knowledge.title")).toBeTruthy();
		// 默认选中知识库根文档；正文经包内资源按需加载后才出现，所以等它，不同步断言。
		expect(await screen.findAllByText(/Knowledge Base/)).toBeTruthy();
	}, 15_000);

	it("opens a document in a preview overlay and returns to the list", async () => {
		const api = makeBridge();
		await open(api);
		await go("knowledge");
		await screen.findByTestId("docs-list");

		// 目录吃满主区；点一行开弹窗，而不是把正文挤进另一栏。
		fireEvent.click(screen.getByTestId("docs-list").querySelector('[data-doc-id="kb/README"]') as HTMLButtonElement);
		expect(await screen.findByTestId("doc-preview")).toBeTruthy();

		// 弹窗里的「返回目录」关掉预览，列表仍在原位。
		fireEvent.click(screen.getByText("docs.preview.back"));
		await waitFor(() => expect(screen.queryByTestId("doc-preview")).toBeNull());
		expect(screen.getByTestId("docs-list-card")).toBeTruthy();
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
		// 设置页分两栏：先切到「分析」分组才看得到模式选择。
		fireEvent.click(screen.getByTestId("settings-tab-analysis"));
		fireEvent.click(await screen.findByText("mode.full"));
		await analyseDemo(api);
		await waitFor(() => expect(api.analyse).toHaveBeenLastCalledWith(SAMPLE, { mode: "full", disabledRules: [] }));
	});

	it("saves a report and reports where it landed", async () => {
		const api = makeBridge();
		await open(api);
		await analyseDemo(api);
		await go("reports");
		fireEvent.click(await screen.findByText("reports.export"));
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

	it("indexes the cases in the project and reads one in place", async () => {
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
		const entries = (paths: [string, boolean][]) =>
			paths.map(([path, isDirectory]) => ({ name: path.split("/").pop()!, path, size: 0, isDirectory, modifiedAt: 0 }));
		const api = makeBridge({
			listFiles: vi.fn(async (path: string) => {
				if (path === "/work") return entries([["/work/cases", true]]);
				if (path === "/work/cases") return entries([["/work/cases/demo", true]]);
				if (path === "/work/cases/demo")
					return entries([
						["/work/cases/demo/scope.md", false],
						["/work/cases/demo/README.md", false],
						["/work/cases/demo/evidence", true],
					]);
				if (path === "/work/cases/demo/evidence") return entries([["/work/cases/demo/evidence/E-001-entry.md", false]]);
				return Promise.reject(new Error("ENOENT"));
			}),
			readTextFile: vi.fn(async (path: string) => {
				if (path.endsWith("scope.md")) return scope;
				if (path.endsWith("E-001-entry.md")) return "# E-001 — baseline\n\nObserved: the stub jumps to a computed address.\n";
				return null;
			}),
		});
		await open(api);
		await go("knowledge");
		// 知识页默认在文档视图；案例是同一页的另一个分段。
		fireEvent.click(await screen.findByText("page.knowledge.cases"));

		expect(await screen.findByText("cases.tab.precedent")).toBeTruthy();
		// 扫描到的案例在「我的案例」清单里。
		fireEvent.click(screen.getByText("cases.tab.mine"));
		// 目录名就是案例名；计数在行里，正文在右侧阅读区。
		const row = await screen.findByTitle("/work/cases/demo");
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
		// 两份清单同页但不同源：切回先例清单才会列出随包包名。
		fireEvent.click(screen.getByText("cases.tab.precedent"));
		expect(screen.getByText("cases/elf-packed-loader/")).toBeTruthy();
	});

	it("reads a shipped precedent in place, without touching the disk", async () => {
		// 正文按需从包内读取：预览它不经过宿主的文件通道。
		const api = makeBridge();
		await open(api);
		await go("knowledge");
		fireEvent.click(await screen.findByText("page.knowledge.cases"));

		fireEvent.click(await screen.findByTitle("cases/elf-packed-loader/"));

		const reader = screen.getByTestId("cases-reader");
		expect(await within(reader).findByText("Packed ELF loader — precedent")).toBeTruthy();
		expect(screen.getByTestId("precedent-doc-tabs")).toBeTruthy();
		const methodTab = document.querySelector('[data-doc-id="docs/method.md"]');
		expect(methodTab).not.toBeNull();
		fireEvent.click(methodTab!);
		expect(await within(reader).findByText("Method — recovering a packed ELF")).toBeTruthy();
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
		expect(await screen.findByText("guide.stage.intake.title")).toBeTruthy();
		fireEvent.click(await screen.findByTitle("ai.workflow"));
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
		fireEvent.click(screen.getByTestId("settings-tab-analysis"));
		expect(await screen.findByText("settings.mode.title")).toBeTruthy();
		await go("prompts");
		// 注入块现在是提示词页的第二个视图：没有激活提示词时展示默认契约。
		fireEvent.click(await screen.findByText("prompt.view.inject"));
		expect(await screen.findByText("prompt.inject.title")).toBeTruthy();
		// 卡片里给的是「说明 + 目标路径 + 预览/原文」，不再是单一来源文案。
		// 说明文案在注入视图里可能出现两处（卡片一处），断言存在而不是唯一。
		expect(screen.getAllByText("inject.intro").length).toBeGreaterThan(0);
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
		// 规则开关在「分析」分组里（设置页现在是两栏）。
		fireEvent.click(screen.getByTestId("settings-tab-analysis"));
		// 同组里还有实验环境开关，按 aria-label 前缀挑规则那一个。
		const ruleSwitch = screen
			.getAllByRole("switch")
			.find(node => (node.getAttribute("aria-label") ?? "").startsWith("rule."));
		fireEvent.click(ruleSwitch!);
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

	it("shows the static views only after a report exists", async () => {
		const api = makeBridge();
		await open(api);
		await go("static");
		expect(await screen.findByText("empty.noReport.title")).toBeTruthy();
		await analyseDemo(api);
		await go("static");
		// 清单 / 熵 / 签名在同一页的三个视图里：默认先看清单，数据到了就出现。
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
