// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelBoundary } from "../features/workbench/components/shell/panel-boundary";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

function Broken(): never {
	throw new Error("page exploded");
}

afterEach(cleanup);

describe("panel boundary", () => {
	it("renders the child when nothing throws", () => {
		render(
			<PanelBoundary>
				<p>inside</p>
			</PanelBoundary>,
		);
		expect(screen.getByText("inside")).toBeTruthy();
		expect(screen.queryByText("panel.crash.title")).toBeNull();
	});

	it("replaces a crashed subtree with the failure message", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		render(
			<PanelBoundary>
				<Broken />
			</PanelBoundary>,
		);
		expect(screen.getByText("panel.crash.title")).toBeTruthy();
		expect(screen.getByText("Error: page exploded")).toBeTruthy();
		spy.mockRestore();
	});
});
