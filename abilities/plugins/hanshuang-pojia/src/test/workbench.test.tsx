// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TriageReport } from "../domain/report/report";
import { buildReport } from "../domain/report/report";
import type { TriageSample } from "../domain/triage";
import type { WorkbenchBridge } from "../features/workbench/bridge";
import { WorkbenchScreen } from "../features/workbench/components/workbench-screen";
import { publishPanelEvent } from "../runtime/panel-channel";

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
		stat: vi.fn(async () => ({ size: 4_194_304 })),
		loadSample: vi.fn(async () => SAMPLE),
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
	});

	it("lists only sample files from the workspace", async () => {
		const api = makeBridge();
		await open(api);
		await go("samples");
		expect(await screen.findByTitle("/work/demo.apk")).toBeTruthy();
		expect(screen.queryByText("notes.txt")).toBeNull();
		expect(screen.queryByText("lib")).toBeNull();
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
		expect(await screen.findByText("selfcheck.item.digest")).toBeTruthy();
		await go("settings");
		expect(await screen.findByText("settings.mode.title")).toBeTruthy();
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
});
