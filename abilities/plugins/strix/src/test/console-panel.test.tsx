import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrixConsolePanel } from "../features/scan-console/components/strix-console-panel";
import type { ScanConsoleModel } from "../features/scan-console/hooks/use-scan-console";
import type { EnvironmentProbe, StrixFinding } from "../runtime-contract";

// Vitest runs without globals here, so RTL does not unmount between cases and the
// second render would otherwise see the first one's DOM.
afterEach(cleanup);
import { StrixConsolePanel } from "../features/scan-console/components/strix-console-panel";
import type { ScanConsoleModel } from "../features/scan-console/hooks/use-scan-console";
import type { EnvironmentProbe, StrixFinding } from "../runtime-contract";

const t = (key: string): string => key;

const probe = (overrides: Partial<EnvironmentProbe> = {}): EnvironmentProbe => ({
	python: { version: "3.13.0", executable: "/usr/bin/python3" },
	engine: { installed: true, version: "1.7.0" },
	docker: { ready: true, detail: "", image: "ghcr.io/usestrix/strix-sandbox:1.4.0" },
	llm: { model: "anthropic/claude-sonnet-4", configured: true, keySource: "env" },
	configPath: "/root/.strix/cli-config.json",
	ready: true,
	...overrides,
});

const model = (overrides: Partial<ScanConsoleModel> = {}): ScanConsoleModel => ({
	phase: "ready",
	environment: probe(),
	runs: [],
	findings: [],
	timeline: [],
	scanning: false,
	boot: async () => undefined,
	start: async () => undefined,
	cancel: async () => undefined,
	selectRun: () => undefined,
	...overrides,
});

const finding = (overrides: Partial<StrixFinding> = {}): StrixFinding => ({
	title: "IDOR on /api/orders",
	severity: "critical",
	description: "Any authenticated user can read another tenant's orders.",
	...overrides,
});

describe("Strix console panel", () => {
	it("lists exactly what is missing before the first scan instead of showing a dead button", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					phase: "unready",
					environment: probe({
						ready: false,
						docker: { ready: false, detail: "docker daemon is not reachable", image: "x" },
						engine: { installed: false, version: "not importable" },
					}),
				})}
			/>,
		);
		expect(screen.getByText("setup.docker")).toBeTruthy();
		expect(screen.getByText("docker daemon is not reachable")).toBeTruthy();
		expect(screen.getByText("uv tool install strix-agent")).toBeTruthy();
	});

	it("sends targets split by line, dropping blanks", async () => {
		const start = vi.fn(async () => undefined);
		render(<StrixConsolePanel t={t} model={model({ start })} />);
		const targets = screen.getByLabelText("launch.targets.label") as HTMLTextAreaElement;
		await userEvent.type(targets, "https://a.example{enter}{enter}https://b.example");
		await userEvent.click(screen.getByRole("button", { name: "launch.button.start" }));
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ targets: ["https://a.example", "https://b.example"], scanMode: "deep" }),
		);
	});

	it("shows the highest severity first and keeps the tally visible", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					runs: [
						{
							runName: "acme_ab12",
							runId: "acme_ab12",
							status: "completed",
							findingCount: 2,
							hasReport: true,
							hasSarif: true,
						},
					],
					activeRun: {
						runName: "acme_ab12",
						runId: "acme_ab12",
						status: "completed",
						findingCount: 2,
						hasReport: true,
						hasSarif: true,
					},
					findings: [finding({ title: "Low one", severity: "low" }), finding()],
				})}
			/>,
		);
		const titles = screen.getAllByRole("heading", { level: 4 }).map((node) => node.textContent);
		expect(titles).toEqual(["IDOR on /api/orders", "Low one"]);
		// The tally and the card badge both name the severity; both are expected.
		expect(screen.getAllByText("severity.critical").length).toBeGreaterThanOrEqual(2);
	});

	it("distinguishes a clean run from one that has not produced results", () => {
		const { rerender } = render(
			<StrixConsolePanel
				t={t}
				model={model({
					runs: [
						{ runName: "r", runId: "r", status: "completed", findingCount: 0, hasReport: true, hasSarif: true },
					],
					activeRun: {
						runName: "r",
						runId: "r",
						status: "completed",
						findingCount: 0,
						hasReport: true,
						hasSarif: true,
					},
				})}
			/>,
		);
		expect(screen.getByText("findings.noneFound")).toBeTruthy();
		rerender(
			<StrixConsolePanel
				t={t}
				model={model({
					runs: [
						{ runName: "r", runId: "r", status: "running", findingCount: 0, hasReport: false, hasSarif: false },
					],
					activeRun: {
						runName: "r",
						runId: "r",
						status: "running",
						findingCount: 0,
						hasReport: false,
						hasSarif: false,
					},
				})}
			/>,
		);
		expect(screen.getByText("findings.notScanned")).toBeTruthy();
	});
});
