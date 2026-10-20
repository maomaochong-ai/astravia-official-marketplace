// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReport } from "../domain/report/report";
import type { TriageReport } from "../domain/report/report";
import type { TriageSample } from "../domain/triage";
import type { TriageBridge } from "../features/triage-workbench/bridge";
import { TriageWorkbench } from "../features/triage-workbench/components/triage-workbench";
import { sampleErrorText } from "../features/triage-workbench/sample-error";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const SAMPLE: TriageSample = { path: "/work/demo.apk", name: "demo.apk", bytes: new Uint8Array(2048) };

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
	facts: [{ label: "Archive entries", value: "6" }],
	sections: [{ id: "components", title: "Components", columns: ["Component", "Exposure"], rows: [{ label: "activity .Main", value: "exported" }] }],
	limits: ["Only the first DEX file was scanned."],
	summary: ["com.example.triage 2.0 · 3 components"],
});

function bridge(overrides: Partial<TriageBridge> = {}): TriageBridge {
	return {
		listFiles: vi.fn(async () => [
			{ name: "demo.apk", path: "/work/demo.apk", size: 4_194_304, isDirectory: false },
			{ name: "notes.txt", path: "/work/notes.txt", size: 128, isDirectory: false },
			{ name: "lib", path: "/work/lib", size: 0, isDirectory: true },
		]),
		loadSample: vi.fn(async () => SAMPLE),
		analyse: vi.fn(async () => REPORT),
		notify: vi.fn(),
		saveReport: vi.fn(async () => "/work/demo-triage.md"),
		...overrides,
	} as TriageBridge;
}

afterEach(cleanup);

describe("triage workbench", () => {
	it("lists only sample files from the workspace", async () => {
		render(<TriageWorkbench bridge={bridge()} cwd="/work" />);
		expect(await screen.findByTitle("/work/demo.apk")).toBeTruthy();
		expect(screen.queryByText("notes.txt")).toBeNull();
		expect(screen.queryByText("lib")).toBeNull();
	});

	it("runs a triage from a click and shows the score, grade and findings", async () => {
		const api = bridge();
		render(<TriageWorkbench bridge={api} cwd="/work" />);

		fireEvent.click(await screen.findByTitle("/work/demo.apk"));

		await waitFor(() => expect(api.analyse).toHaveBeenCalledWith(SAMPLE, "summary"));
		expect(api.loadSample).toHaveBeenCalledWith("/work/demo.apk", "/work");

		expect(await screen.findByText(String(REPORT.risk.score))).toBeTruthy();
		expect(screen.getAllByText(REPORT.risk.grade).length).toBeGreaterThan(0);
		expect(screen.getAllByText("Application is debuggable").length).toBeGreaterThan(0);
		expect(screen.getByText("debuggable is true")).toBeTruthy();
		expect(screen.getByText("com.example.triage 2.0 · 3 components")).toBeTruthy();
		expect(screen.getByText("Android package (APK)")).toBeTruthy();
	});

	it("re-analyses with the full mode when the header switch is used", async () => {
		const api = bridge();
		render(<TriageWorkbench bridge={api} cwd="/work" />);
		fireEvent.click(await screen.findByTitle("/work/demo.apk"));
		fireEvent.click(await screen.findByText("panel.mode.full"));
		await waitFor(() => expect(api.analyse).toHaveBeenLastCalledWith(SAMPLE, "full"));
	});

	it("saves a report and reports where it landed", async () => {
		const api = bridge();
		render(<TriageWorkbench bridge={api} cwd="/work" />);
		fireEvent.click(await screen.findByTitle("/work/demo.apk"));
		fireEvent.click(await screen.findByText("panel.action.exportMarkdown"));

		await waitFor(() => expect(api.saveReport).toHaveBeenCalledWith(REPORT, "summary", "markdown"));
		await waitFor(() => expect(api.notify).toHaveBeenCalledWith("panel.action.saved", "success"));
	});

	it("surfaces a failed load as an error with a retry", async () => {
		const api = bridge({ loadSample: vi.fn(async () => Promise.reject(new Error("file is too large"))) });
		render(<TriageWorkbench bridge={api} cwd="/work" />);
		fireEvent.click(await screen.findByTitle("/work/demo.apk"));

		expect(await screen.findByText("file is too large")).toBeTruthy();
		expect(screen.getByText("panel.error.retry")).toBeTruthy();
	});

	it("explains how to start and copies a ready-made prompt", async () => {
		const writeText = vi.fn(async () => undefined);
		Object.assign(navigator, { clipboard: { writeText } });
		const api = bridge();
		render(<TriageWorkbench bridge={api} cwd="/work" />);

		expect(screen.getByText("panel.intro.step1.title")).toBeTruthy();
		expect(screen.getByText("panel.intro.step3.title")).toBeTruthy();

		fireEvent.click(screen.getByText("panel.intro.prompts.one"));

		await waitFor(() => expect(writeText).toHaveBeenCalledWith("panel.intro.prompts.one"));
		await waitFor(() => expect(api.notify).toHaveBeenCalledWith("panel.intro.prompts.copied", "success"));
	});

	it("translates a host path rejection into an actionable message", async () => {
		const api = bridge({
			loadSample: vi.fn(async () =>
				Promise.reject(
					new Error("Error invoking remote method 'astravia:plugins:capabilities:fs:stat': CapabilityError: Capability provider failed: cap.foundation.astravia.fs.stat"),
				),
			),
		});
		render(<TriageWorkbench bridge={api} cwd="/work" />);
		fireEvent.click(await screen.findByTitle("/work/demo.apk"));

		expect(await screen.findByText("panel.error.outsideProject")).toBeTruthy();
	});

	it("leaves ordinary load errors untouched", () => {
		const t = (key: string) => key;
		expect(sampleErrorText("file not found: /work/x.apk", t)).toBe("file not found: /work/x.apk");
		expect(sampleErrorText("Capability provider failed: cap.foundation.astravia.fs.stat", t)).toBe(
			"panel.error.outsideProject",
		);
	});

	it("asks for a workspace when the host has no cwd", () => {
		render(<TriageWorkbench bridge={bridge()} cwd={null} />);
		expect(screen.getByText("panel.rail.noCwd")).toBeTruthy();
	});
});
