import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchScreen } from "../features/scan-console/components/launch-screen";
import { ScanScreen } from "../features/scan-console/components/scan-screen";
import type { TraceEntry } from "../runtime-contract";

/**
 * The two screens as the user meets them: the launch column with its model line and
 * hints, and the scan frame with the trace rows upstream draws.
 */

afterEach(cleanup);

const t = (key: string) => key;
const model = { modelKey: "openrouter/z-ai/glm-5.3", name: "glm-5.3", provider: "openrouter/z-ai" };

describe("launch screen", () => {
	it("draws the wordmark, the tagline and the key hints", () => {
		render(
			<LaunchScreen
				t={t}
				model={model}
				log={[]}
				version="0.4.0"
				busy={false}
				onSubmit={() => undefined}
				onQuit={() => undefined}
			/>,
		);
		expect(screen.getByLabelText("Strix")).toBeTruthy();
		expect(screen.getByText("launch.tagline")).toBeTruthy();
		expect(screen.getByText("enter")).toBeTruthy();
		expect(screen.getByText("launch.hint.enter")).toBeTruthy();
		expect(screen.getByText("v0.4.0")).toBeTruthy();
	});

	it("shows the host's model the way upstream shows STRIX_LLM", () => {
		render(
			<LaunchScreen t={t} model={model} log={[]} version="0.4.0" busy={false} onSubmit={() => undefined} onQuit={() => undefined} />,
		);
		expect(screen.getByText("glm-5.3")).toBeTruthy();
		expect(screen.getByText(/openrouter\/z-ai/)).toBeTruthy();
	});

	it("says there is no model instead of showing a blank chip", () => {
		render(
			<LaunchScreen t={t} log={[]} version="0.4.0" busy={false} onSubmit={() => undefined} onQuit={() => undefined} />,
		);
		expect(screen.getByText("launch.noModel")).toBeTruthy();
		expect(screen.getByText(/launch.noModelHint/)).toBeTruthy();
	});

	it("hands the prompt over on Enter and keeps Shift+Enter for a newline", async () => {
		const onSubmit = vi.fn();
		render(
			<LaunchScreen t={t} model={model} log={[]} version="0.4.0" busy={false} onSubmit={onSubmit} onQuit={() => undefined} />,
		);
		const input = screen.getByLabelText("launch.label");
		await userEvent.type(input, "example.com");
		await userEvent.type(input, "{shift>}{enter}{/shift}");
		expect(onSubmit).not.toHaveBeenCalled();
		await userEvent.type(input, "{enter}");
		expect(onSubmit).toHaveBeenCalledWith("example.com\n");
	});

	it("quits on ctrl+c, the way the CLI does", () => {
		const onQuit = vi.fn();
		render(
			<LaunchScreen t={t} model={model} log={[]} version="0.4.0" busy={false} onSubmit={() => undefined} onQuit={onQuit} />,
		);
		fireEvent.keyDown(screen.getByLabelText("launch.label"), { key: "c", ctrlKey: true });
		expect(onQuit).toHaveBeenCalled();
	});

	it("prints the feedback log and names what is blocking the launch", () => {
		render(
			<LaunchScreen
				t={t}
				model={model}
				log={[{ text: "log.connecting" }, { text: "log.dockerDown", tone: "error" }]}
				version="0.4.0"
				busy={false}
				blocked="launch.blocked.docker"
				onSubmit={() => undefined}
				onQuit={() => undefined}
			/>,
		);
		expect(screen.getByText("log.connecting")).toBeTruthy();
		expect(screen.getByText("log.dockerDown")).toBeTruthy();
		expect(screen.getByText("launch.blocked.docker")).toBeTruthy();
	});
});

const run = (overrides: Partial<TraceEntry> = {}): TraceEntry => ({
	id: "e1",
	kind: "tool",
	label: "strix_exec",
	detail: "nmap -sV example.com",
	ok: true,
	at: Date.now(),
	...overrides,
});

const scanProps = {
	t,
	phase: "done" as const,
	model,
	sandbox: { running: true, sessionId: "s1", targets: ["example.com"] },
	findings: [],
	trace: [run()],
	busy: false,
	onSend: () => undefined,
	onStop: () => undefined,
};

describe("scan screen", () => {
	it("renders a completed tool the way the TUI does", () => {
		render(<ScanScreen {...scanProps} />);
		expect(screen.getByText("strix_exec")).toBeTruthy();
		expect(screen.getByText("nmap -sV example.com")).toBeTruthy();
		expect(screen.getByText(/✓ Done/)).toBeTruthy();
	});

	it("distinguishes a command still in flight", () => {
		render(<ScanScreen {...scanProps} phase="scanning" trace={[run({ ok: undefined })]} busy />);
		expect(screen.getByText(/In progress/)).toBeTruthy();
		expect(screen.getByText("scan.running")).toBeTruthy();
	});

	it("shows the operator's message as a You line", () => {
		render(
			<ScanScreen {...scanProps} trace={[run({ kind: "user", label: "check the admin panel", detail: undefined })]} />,
		);
		expect(screen.getByText("You:")).toBeTruthy();
		expect(screen.getByText(/check the admin panel/)).toBeTruthy();
	});

	it("lists the assessment targets in the sidebar", () => {
		render(<ScanScreen {...scanProps} />);
		expect(screen.getAllByText("example.com").length).toBeGreaterThan(0);
		expect(screen.getByText("findings.noneFound")).toBeTruthy();
	});
});
