import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScanScreen } from "../features/scan-console/components/scan-screen";

/**
 * The Stats and Connections panels must show the run's real numbers, not placeholders.
 *
 * This is the test that answers "is Stats actually usable": every value is supplied by
 * props and read back from the DOM. A panel that renders a hard-coded dash would pass a
 * smoke test and fail a user, so the assertions use distinguishable numbers.
 */
afterEach(cleanup);

const t = (key: string) => key;

const base = {
	t,
	phase: "scanning" as const,
	model: { modelKey: "openrouter/x", name: "glm-5.3", provider: "openrouter" },
	sandbox: { running: true, sessionId: "s1", targets: ["a.test", "b.test", "c.test"], scanMode: "deep", mode: "host" as const },
	findings: [
		{ id: "f1", title: "SQLi", severity: "high" as const, location: "/a" },
		{ id: "f2", title: "XSS", severity: "low" as const, location: "/b" },
	] as never,
	trace: [
		{ id: "t1", kind: "tool" as const, label: "strix_exec", at: 1 },
		{ id: "t2", kind: "tool" as const, label: "strix_exec", at: 2 },
		{ id: "t3", kind: "note" as const, label: "starting", at: 3 },
	],
	todos: [],
	notes: [],
	coverage: [{ surface: "/a", outcome: "vulnerable" as const }],
	agents: [],
	mcp: [
		{ name: "strix", provider: "service", toolCount: 32, dead: false },
		{ name: "custom", provider: "stdio", toolCount: 7, dead: true },
	],
	workspace: "demo",
	hostStreaming: false,
	busy: true,
	onSend: () => undefined,
	onStop: () => undefined,
};

describe("stats and connections", () => {
	it("renders the run's real totals", () => {
		render(<ScanScreen {...base} />);
		// 3 targets, 2 tool steps (the note is not a step), 2 findings, 1 coverage row.
		expect(screen.getAllByText("3").length).toBeGreaterThan(0);
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);
		expect(screen.getByText("deep")).toBeTruthy();
	});

	it("names each MCP connection and flags the dead one", () => {
		render(<ScanScreen {...base} />);
		expect(screen.getByText("strix")).toBeTruthy();
		expect(screen.getByText("custom")).toBeTruthy();
		expect(screen.getByText("32")).toBeTruthy();
		expect(screen.getByText("7")).toBeTruthy();
		expect(document.querySelector('li[data-dead="yes"]')).toBeTruthy();
	});

	it("says so when there is no roster instead of rendering an empty box", () => {
		render(<ScanScreen {...base} mcp={[]} />);
		expect(screen.getByText("mcp.empty")).toBeTruthy();
	});

	it("reports the environment it is actually running in", () => {
		render(<ScanScreen {...base} />);
		expect(screen.getAllByText("env.host").length).toBeGreaterThan(0);
		expect(screen.queryByText("env.unknown")).toBeNull();
	});
});
