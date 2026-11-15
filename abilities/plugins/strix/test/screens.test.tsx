import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchScreen } from "../src/features/scan-console/components/launch-screen";
import { ScanScreen } from "../src/features/scan-console/components/scan-screen";
import type { TraceEntry } from "../src/runtime-contract";

/**
 * The two screens as the user meets them: the launch column with its model line and
 * hints, and the scan frame with the trace rows upstream draws.
 */

afterEach(cleanup);

const t = (key: string) => key;
const model = { modelKey: "openrouter/z-ai/glm-5.3", name: "glm-5.3", provider: "openrouter/z-ai" };

describe("launch screen", () => {
	it("draws the wordmark, the tagline and the key hints", () => {
		const { container } = render(
			<LaunchScreen
				t={t}
				boot={{ state: "ready" }}
				model={model}
				log={[]}
				version="0.4.0"
				{...{ onOpenWorkbench: () => undefined, onSend: () => undefined }}
				onQuit={() => undefined}
			/>,
		);
		expect(screen.getByLabelText("Strix")).toBeTruthy();
		expect(screen.getByText("launch.tagline")).toBeTruthy();
		// 首屏有一个对话框（双向对话的入口），底条上还有一个「工作台」。
		expect(container.querySelector("textarea")).toBeTruthy();
		expect(screen.getByText("nav.workbench")).toBeTruthy();
		expect(screen.getByText("v0.4.0")).toBeTruthy();
	});

	it("shows the host's model the way upstream shows STRIX_LLM", () => {
		render(
			<LaunchScreen t={t}
 boot={{ state: "ready" }} model={model} log={[]} version="0.4.0"  onQuit={() => undefined} />,
		);
		expect(screen.getByText("glm-5.3")).toBeTruthy();
		expect(screen.getByText(/openrouter\/z-ai/)).toBeTruthy();
	});

	it("says there is no model instead of showing a blank chip", () => {
		render(
			<LaunchScreen t={t}
 boot={{ state: "ready" }} log={[]} version="0.4.0"  onQuit={() => undefined} />,
		);
		expect(screen.getByText("launch.noModel")).toBeTruthy();
		expect(screen.getByText(/launch.noModelHint/)).toBeTruthy();
	});

	it("quits on ctrl+c, the way the CLI does", () => {
		const onQuit = vi.fn();
		render(
			<LaunchScreen t={t}
 boot={{ state: "ready" }} model={model} log={[]} version="0.4.0"  onQuit={onQuit} />,
		);
		fireEvent.keyDown(screen.getByLabelText("Strix"), { key: "c", ctrlKey: true });
		expect(onQuit).toHaveBeenCalled();
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
	todos: [
		{ id: "t1", title: "Test the auth boundary", status: "in_progress", priority: "high" },
		{ id: "t2", title: "Fuzz the search endpoint", status: "done", priority: "normal" },
	],
	notes: [{ id: "n1", title: "Session cookie is not HttpOnly", category: "auth", updatedAt: "" }],
	coverage: [
		{ surface: "GET /api/orders", outcome: "vulnerable" as const },
		{ surface: "POST /login", outcome: "clean" as const },
	],
	workspace: "strix",
	hostStreaming: false,
	busy: false,
	onSend: () => undefined,
	onStop: () => undefined,
	mcp: [{ name: "strix", provider: "service", toolCount: 32, dead: false }],
};

describe("scan screen", () => {
	it("renders a completed tool the way the TUI does", () => {
		render(<ScanScreen {...scanProps} />);
		// 逐工具渲染：标题是家族名 `exec`，而不是原始 `strix_exec`。
		expect(screen.getByText("exec")).toBeTruthy();
		expect(screen.getByText("nmap -sV example.com")).toBeTruthy();
		expect(screen.getByText(/✓ Done/)).toBeTruthy();
	});

		it("distinguishes a command still in flight", () => {
		render(<ScanScreen {...scanProps} phase="scanning" hostStreaming busy trace={[run({ ok: undefined })]} />);
		expect(screen.getByText(/In progress/)).toBeTruthy();
		expect(screen.getByText("scan.running")).toBeTruthy();
	});

	it("says idle, not running, when the host turn is over", () => {
		// The assessment stays open after a turn ends; the band must not claim the agent
		// is still working, and the stop button must not offer to stop nothing.
		render(<ScanScreen {...scanProps} phase="scanning" hostStreaming={false} />);
		expect(screen.getByText("scan.idle")).toBeTruthy();
		expect(screen.queryByText("scan.running")).toBeNull();
		expect((screen.getByRole("button", { name: "scan.stop" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("has no You: row — the operator's words live in the chat", () => {
		// 这一行曾经存在，和聊天区重复。轨迹只剩工具、说明、结论。
		render(<ScanScreen {...scanProps} trace={[run({ kind: "note", label: "turn 1 · the words are in the chat" })]} />);
		expect(screen.queryByText("You:")).toBeNull();
		expect(screen.getByText(/turn 1/)).toBeTruthy();
	});

	it("lists the assessment targets in the sidebar", () => {
		render(<ScanScreen {...scanProps} />);
		expect(screen.getAllByText("example.com").length).toBeGreaterThan(0);
		expect(screen.getByText("findings.noneFound")).toBeTruthy();
	});
});
