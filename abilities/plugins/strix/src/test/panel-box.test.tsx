import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PanelBox } from "../shared/components/panel-box";

/**
 * ADR strix-0004, the two rules that live in this component:
 * a zero is not a badge, and an empty section collapses until asked.
 */
afterEach(cleanup);

describe("panel box", () => {
	it("shows a count when there is something to count", () => {
		render(
			<PanelBox title="Findings" hint="3" emptyLabel="Nothing recorded yet">
				<p>three rows</p>
			</PanelBox>,
		);
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("three rows")).toBeTruthy();
		// No toggle: there is content, so nothing to open.
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("turns a zero into a sentence instead of a badge", () => {
		render(
			<PanelBox title="Coverage" hint="0" emptyLabel="Nothing recorded yet">
				<p>empty body</p>
			</PanelBox>,
		);
		expect(screen.getByText("Nothing recorded yet")).toBeTruthy();
		expect(screen.queryByText("0")).toBeNull();
	});

	it("keeps an empty section's body hidden until it is opened", () => {
		render(
			<PanelBox title="Notes" hint="0" emptyLabel="Nothing recorded yet">
				<p>empty body</p>
			</PanelBox>,
		);
		expect(screen.queryByText("empty body")).toBeNull();
		const toggle = screen.getByRole("button");
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(toggle);
		expect(screen.getByText("empty body")).toBeTruthy();
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
	});

	it("stays open when no empty label is given", () => {
		render(
			<PanelBox title="Session" hint="0">
				<p>session body</p>
			</PanelBox>,
		);
		expect(screen.getByText("session body")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
