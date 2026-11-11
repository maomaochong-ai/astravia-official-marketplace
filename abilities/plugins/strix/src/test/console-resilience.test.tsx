import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConsoleBoundary } from "../features/scan-console/components/console-boundary";
import { StrixConsolePanel } from "../features/scan-console/components/strix-console-panel";
import type { ScanConsoleModel } from "../features/scan-console/hooks/use-scan-console";

afterEach(cleanup);

const t = (key: string) => key;

const model = (overrides: Partial<ScanConsoleModel> = {}): ScanConsoleModel => ({
	phase: "unready",
	environment: { ready: false } as never,
	sandbox: { running: false },
	findings: [],
	trace: [],
	busy: false,
	boot: async () => undefined,
	stopSandbox: async () => undefined,
	...overrides,
});

describe("console resilience", () => {
	it("renders a probe that carries only `ready` instead of crashing on missing sections", () => {
		render(<StrixConsolePanel t={t} model={model()} send={async () => undefined} />);
		expect(screen.getByText("panel.subtitle")).toBeTruthy();
	});

	it("turns a render crash into a visible message instead of a blank pane", () => {
		const Broken = (): React.ReactElement => {
			throw new Error("boom from a child");
		};
		render(
			<ConsoleBoundary t={t}>
				<Broken />
			</ConsoleBoundary>,
		);
		expect(screen.getByRole("alert")).toBeTruthy();
		expect(screen.getByText(/boom from a child/)).toBeTruthy();
	});
});
