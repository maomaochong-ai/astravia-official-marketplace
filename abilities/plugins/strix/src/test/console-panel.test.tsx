import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrixConsolePanel } from "../features/scan-console/components/strix-console-panel";
import type { ScanConsoleModel } from "../features/scan-console/hooks/use-scan-console";
import type { EnvironmentProbe, StrixFinding, TraceEntry } from "../runtime-contract";

// Vitest runs without globals here, so RTL does not unmount between cases and the
// second render would otherwise see the first one's DOM.
afterEach(cleanup);

// Keys are returned as-is so assertions can name them, except the prompt template,
// which has to keep its placeholder for the composer's substitution to be visible.
const t = (key: string): string => (key === "composer.prompt" ? "Assess {target} please." : key);

const probe = (overrides: Partial<EnvironmentProbe> = {}): EnvironmentProbe => ({
	python: { version: "3.13.0", executable: "/usr/bin/python3", found: true },
	engine: { installed: true, version: "1.7.0" },
	docker: { ready: true, detail: "", image: "ghcr.io/usestrix/strix-sandbox:1.4.0", imagePresent: true },
	ready: true,
	...overrides,
});

const model = (overrides: Partial<ScanConsoleModel> = {}): ScanConsoleModel => ({
	phase: "ready",
	environment: probe(),
	sandbox: { running: true, sessionId: "strix-1", targets: ["example.com"], uptimeSec: 42 },
	findings: [],
	trace: [],
	busy: false,
	boot: async () => undefined,
	stopSandbox: async () => undefined,
	...overrides,
});

const finding = (overrides: Partial<StrixFinding> = {}): StrixFinding => ({
	title: "IDOR on /api/orders",
	severity: "critical",
	description: "Any authenticated user can read another tenant's orders.",
	...overrides,
});

const run = (label: string, ok?: boolean): TraceEntry => ({
	id: label,
	kind: "command",
	label,
	detail: ok === undefined ? undefined : "exit 0",
	ok,
	at: Date.now(),
});

describe("Strix console panel", () => {
	it("renders the upstream frame: trace pane, sandbox box, targets, findings", () => {
		render(<StrixConsolePanel t={t} model={model()} send={async () => undefined} />);
		for (const title of ["session.title", "targets.title", "findings.title"]) {
			expect(screen.getByText(title)).toBeTruthy();
		}
		expect(screen.getByText("example.com")).toBeTruthy();
		expect(screen.getByText("timeline.empty")).toBeTruthy();
	});

	it("renders a command the way the TUI does, with the status glyph", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({ trace: [run("nmap -sV example.com", true)] })}
				send={async () => undefined}
			/>,
		);
		expect(screen.getByText("exec_command")).toBeTruthy();
		expect(screen.getByText("✓ Done")).toBeTruthy();
		expect(screen.getByText(/nmap -sV example.com/)).toBeTruthy();
	});

	it("shows a command still in flight instead of claiming it finished", () => {
		render(
			<StrixConsolePanel t={t} model={model({ trace: [run("ffuf -u https://example.com/FUZZ")], busy: true })} send={async () => undefined} />,
		);
		expect(screen.getByText("● In progress...")).toBeTruthy();
		expect(screen.getByText("panel.working")).toBeTruthy();
	});

	it("hands the target to the host agent and reports it was sent", async () => {
		const send = vi.fn(async () => undefined);
		render(<StrixConsolePanel t={t} model={model()} send={send} />);
		const input = screen.getByLabelText("composer.label") as HTMLTextAreaElement;
		await userEvent.type(input, "example.org{Enter}");
		expect(send).toHaveBeenCalledWith(expect.stringContaining("example.org"));
		await screen.findByText("composer.sent");
	});

	it("blocks the composer and names what is missing when the machine cannot run Strix", () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({
					phase: "unready",
					environment: probe({
						ready: false,
						engine: { installed: false, version: "not importable" },
						docker: { ready: false, detail: "docker daemon is not reachable", image: "x" },
					}),
				})}
				send={async () => undefined}
			/>,
		);
		expect(screen.getByText("setup.engine")).toBeTruthy();
		expect(screen.getByText("setup.docker")).toBeTruthy();
		expect(screen.getByText("composer.blocked")).toBeTruthy();
		expect((screen.getByRole("button", { name: "composer.start" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("sorts findings by severity and expands detail on click", async () => {
		render(
			<StrixConsolePanel
				t={t}
				model={model({ findings: [finding({ title: "Low one", severity: "low" }), finding()] })}
				send={async () => undefined}
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

	it("distinguishes a finished assessment from one with nothing filed yet", () => {
		const { rerender } = render(
			<StrixConsolePanel t={t} model={model({ sandbox: { running: false } })} send={async () => undefined} />,
		);
		expect(screen.getByText("findings.noneFound")).toBeTruthy();
		rerender(<StrixConsolePanel t={t} model={model()} send={async () => undefined} />);
		expect(screen.getByText("findings.notScanned")).toBeTruthy();
	});
});
