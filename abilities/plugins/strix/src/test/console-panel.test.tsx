import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrixConsolePanel } from "../features/scan-console/components/strix-console-panel";
import type { ScanConsoleModel } from "../features/scan-console/hooks/use-scan-console";
import type { TuiUiEvent } from "../features/scan-console/components/trace-block";
import type { EnvironmentProbe, StrixFinding } from "../runtime-contract";

// Vitest runs without globals here, so RTL does not unmount between cases and the
// second render would otherwise see the first one's DOM.
afterEach(cleanup);

const t = (key: string): string => key;

const probe = (overrides: Partial<EnvironmentProbe> = {}): EnvironmentProbe => ({
	python: { version: "3.13.0", executable: "/usr/bin/python3", found: true },
	engine: { installed: true, version: "1.7.0" },
	docker: { ready: true, detail: "", image: "ghcr.io/usestrix/strix-sandbox:1.4.0" },
	llm: { model: "anthropic/claude-sonnet-4", mode: "api", configured: true, keySource: "env", missing: [] },
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

const run = (overrides: Partial<NonNullable<ScanConsoleModel["activeRun"]>> = {}) => ({
	runName: "acme_ab12",
	runId: "acme_ab12",
	status: "completed",
	findingCount: 2,
	hasReport: true,
	hasSarif: true,
	...overrides,
});

const finding = (overrides: Partial<StrixFinding> = {}): StrixFinding => ({
	title: "IDOR on /api/orders",
	severity: "critical",
	description: "Any authenticated user can read another tenant's orders.",
	...overrides,
});

const toolEvent = (id: string, agent: string, status: string, name = "exec_command"): TuiUiEvent => ({
	id,
	type: "tool",
	agent_id: agent,
	data: { tool_name: name, args: { command: "nmap -sV target" }, status },
});

describe("Strix console panel", () => {
	it("renders the two-column layout: trace pane, findings box, one composer", () => {
		render(<StrixConsolePanel t={t} model={model()} />);
		expect(screen.getByText("findings.title")).toBeTruthy();
		expect(screen.getByText("timeline.empty")).toBeTruthy();
		// The composer is the only form; a target box and Start are enough to begin.
		expect(screen.getByLabelText("launch.targets.label")).toBeTruthy();
		expect(screen.getByRole("button", { name: "launch.button.start" })).toBeTruthy();
	});

	it("renders tool events the way the TUI does, with the status glyph", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({ timeline: [toolEvent("tool_1", "root", "completed")] })}
			/>,
		);
		expect(screen.getByText("exec_command")).toBeTruthy();
		expect(screen.getByText("✓ Done")).toBeTruthy();
		expect(screen.getByText(/nmap -sV target/)).toBeTruthy();
	});

	it("names the host model in the header, because that is what the scan will use", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({ relay: { available: true, model: "deepseek/deepseek-chat" } })}
			/>,
		);
		expect(screen.getByText("deepseek/deepseek-chat")).toBeTruthy();
	});

	it("lists exactly what is missing before the first scan instead of showing a dead button", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					phase: "unready",
					environment: probe({
						ready: false,
						python: { version: "", executable: "", found: false },
						docker: { ready: false, detail: "docker daemon is not reachable", image: "x" },
						engine: { installed: false, version: "not importable" },
					}),
				})}
			/>,
		);
		expect(screen.getByText("setup.python")).toBeTruthy();
		expect(screen.getByText("setup.docker")).toBeTruthy();
		expect(screen.getByText("docker daemon is not reachable")).toBeTruthy();
		expect(screen.getByText("setup.engine")).toBeTruthy();
		expect(screen.getByText("setup.engineHint")).toBeTruthy();
	});

	it("does not treat a missing strix credential as a blocker when the host supplies the model", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					phase: "ready",
					relay: { available: true, model: "anthropic/claude-sonnet-4-5" },
					environment: probe({
						llm: {
							model: "",
							mode: "none",
							configured: false,
							keySource: "missing",
							missing: ["model"],
						},
					}),
				})}
			/>,
		);
		// The relay covers inference, so nothing about strix's own key may appear here.
		expect(screen.queryByText("setup.llm")).toBeNull();
		expect(screen.getAllByText("anthropic/claude-sonnet-4-5").length).toBeGreaterThan(0);
	});

	it("still blocks on a model when neither the host nor strix has one", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					phase: "unready",
					environment: probe({ llm: { model: "", mode: "none", configured: false, keySource: "missing", missing: ["model"] } }),
				})}
			/>,
		);
		expect(screen.getByText("setup.llm")).toBeTruthy();
	});

	it("Enter starts the scan, Shift+Enter adds another target", async () => {
		const start = vi.fn(async () => undefined);
		render(<StrixConsolePanel t={t} model={model({ start })} />);
		const targets = screen.getByLabelText("launch.targets.label") as HTMLTextAreaElement;
		await userEvent.type(targets, "https://a.example{Shift>}{Enter}{/Shift}https://b.example{Enter}");
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ targets: ["https://a.example", "https://b.example"], scanMode: "deep" }),
		);
	});

	it("sorts findings by severity and expands detail on click", async () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					activeRun: run(),
					findings: [finding({ title: "Low one", severity: "low" }), finding()],
				})}
			/>,
		);
		const rows = screen.getAllByRole("button").filter((node) => node.className.includes("finding-row"));
		expect(rows.map((node) => node.textContent)).toEqual([
			expect.stringContaining("IDOR on /api/orders"),
			expect.stringContaining("Low one"),
		]);
		await userEvent.click(rows[0]);
		expect(screen.getByText(/another tenant/)).toBeTruthy();
	});

	it("distinguishes a clean run from one that has not produced results", () => {
		const { rerender } = render(
			<StrixConsolePanel t={t} model={model({ activeRun: run() })} />,
		);
		expect(screen.getByText("findings.noneFound")).toBeTruthy();
		rerender(
			<StrixConsolePanel
				t={t}
				model={model({ activeRun: run({ status: "running", hasReport: false, hasSarif: false }) })}
			/>,
		);
		expect(screen.getByText("findings.notScanned")).toBeTruthy();
	});
});
