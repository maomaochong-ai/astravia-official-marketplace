import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColourPicker } from "../features/canvas/components/colour-picker";
import { ResultGrid } from "../features/canvas/components/result-grid";
import { Segmented } from "../shared/components/segmented";
import { useLogoForm } from "../features/canvas/hooks/use-logo-form";
import { STARTER_PRESETS } from "../domain/catalog";
import { AUTO } from "../domain/spec";
import type { DesignRecord } from "../domain/history-store";
import { normalizeSpec } from "../domain/spec";

const t = (key: string) => key;

function FormHarness(): import("react").JSX.Element {
	const form = useLogoForm();
	return (
		<div>
			<span data-testid="name">{form.spec.brandName || "(empty)"}</span>
			<span data-testid="style">{form.spec.style}</span>
			<span data-testid="preset">{form.activePreset ?? "(none)"}</span>
			<span data-testid="primary">{form.spec.primary}</span>
			<button type="button" onClick={() => form.patch({ brandName: "Fern & Field" })}>
				name
			</button>
			<button type="button" onClick={() => form.patch({ style: "luxury" })}>
				style
			</button>
			<button type="button" onClick={() => form.applyPreset(STARTER_PRESETS[0])}>
				preset
			</button>
			<button type="button" onClick={() => form.applyPreset(STARTER_PRESETS[0])}>
				preset-again
			</button>
			<button type="button" onClick={() => form.load(normalizeSpec({ brandName: "Vellum", style: "retro" }))}>
				load
			</button>
		</div>
	);
}

describe("the studio form", () => {
	it("edits the spec through one state shape", () => {
		render(<FormHarness />);
		expect(screen.getByTestId("name").textContent).toBe("(empty)");
		fireEvent.click(screen.getByText("name"));
		expect(screen.getByTestId("name").textContent).toBe("Fern & Field");
		fireEvent.click(screen.getByText("style"));
		expect(screen.getByTestId("style").textContent).toBe("luxury");
	});

	it("applies a preset and clears it on a second tap", () => {
		render(<FormHarness />);
		fireEvent.click(screen.getByText("preset"));
		expect(screen.getByTestId("preset").textContent).toBe(STARTER_PRESETS[0].id);
		expect(screen.getByTestId("style").textContent).toBe(STARTER_PRESETS[0].style);
		fireEvent.click(screen.getByText("preset-again"));
		expect(screen.getByTestId("preset").textContent).toBe("(none)");
		expect(screen.getByTestId("primary").textContent).toBe(AUTO);
	});

	it("drops the active preset once the user edits a structural field", () => {
		render(<FormHarness />);
		fireEvent.click(screen.getByText("preset"));
		fireEvent.click(screen.getByText("style"));
		expect(screen.getByTestId("preset").textContent).toBe("(none)");
	});

	it("loads a saved design", () => {
		render(<FormHarness />);
		fireEvent.click(screen.getByText("load"));
		expect(screen.getByTestId("name").textContent).toBe("Vellum");
		expect(screen.getByTestId("style").textContent).toBe("retro");
	});
});

describe("the colour picker", () => {
	const labels = { auto: "Auto", custom: "Custom", fromImage: "From image", imageFailed: "x", tooLarge: "y" };

	it("returns to auto and reports an explicit swatch", () => {
		const onChange = vi.fn();
		render(
			<ColourPicker
				value="#2F6FF5"
				autoHex="#30A46C"
				onChange={onChange}
				swatches={[
					{ hex: "#2F6FF5", label: "Blue" },
					{ hex: "#E5484D", label: "Red" },
				]}
				labels={labels}
			/>,
		);
		fireEvent.click(screen.getByTitle("Red"));
		expect(onChange).toHaveBeenCalledWith("#E5484D");
		fireEvent.click(screen.getByTitle("Auto"));
		expect(onChange).toHaveBeenCalledWith(AUTO);
	});

	it("marks the active swatch for assistive tech", () => {
		render(
			<ColourPicker
				value="#E5484D"
				autoHex="#30A46C"
				onChange={() => undefined}
				swatches={[{ hex: "#E5484D", label: "Red" }]}
				labels={labels}
			/>,
		);
		expect(screen.getByTitle("Red").getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByTitle("Auto").getAttribute("aria-pressed")).toBe("false");
	});
});

describe("segmented control", () => {
	it("exposes radio semantics and reports the picked value", () => {
		const onChange = vi.fn();
		render(
			<Segmented
				ariaLabel="detail"
				value="balanced"
				options={[
					{ value: "minimal", label: "Minimal" },
					{ value: "balanced", label: "Balanced" },
				]}
				onChange={onChange}
			/>,
		);
		expect(screen.getByRole("radio", { name: "Balanced" }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(screen.getByRole("radio", { name: "Minimal" }));
		expect(onChange).toHaveBeenCalledWith("minimal");
	});
});

describe("the result grid", () => {
	const empty = <p>nothing yet</p>;

	it("shows the empty state instead of a blank area", () => {
		render(
			<ResultGrid
				records={[]}
				ready
				selectedId={null}
				locale="en"
				label={() => "x"}
				onSelect={() => undefined}
				onToggleFavorite={() => undefined}
				onSaveSvg={() => undefined}
				onSavePng={() => undefined}
				onOpenKit={() => undefined}
				onDelete={() => undefined}
				emptyState={empty}
				t={t}
			/>,
		);
		expect(screen.getByText("nothing yet")).toBeTruthy();
	});

	it("renders a tile per design and wires the actions", () => {
		const record: DesignRecord = {
			id: "a",
			spec: normalizeSpec({ brandName: "Fern & Field" }),
			engine: "local",
			subject: "leaf",
			createdAt: Date.now(),
			favorite: false,
		};
		const onSelect = vi.fn();
		const onToggleFavorite = vi.fn();
		render(
			<ResultGrid
				records={[record]}
				ready
				selectedId={null}
				locale="en"
				label={() => "Fern & Field"}
				onSelect={onSelect}
				onToggleFavorite={onToggleFavorite}
				onSaveSvg={() => undefined}
				onSavePng={() => undefined}
				onOpenKit={() => undefined}
				onDelete={() => undefined}
				emptyState={empty}
				t={t}
			/>,
		);
		expect(screen.getByText("Fern & Field")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("tile.load"));
		expect(onSelect).toHaveBeenCalledWith(record);
		fireEvent.click(screen.getByLabelText("tile.favorite"));
		expect(onToggleFavorite).toHaveBeenCalledWith(record);
	});

	it("shows skeletons before the history has loaded", () => {
		const { container } = render(
			<ResultGrid
				records={[]}
				ready={false}
				selectedId={null}
				locale="en"
				label={() => "x"}
				onSelect={() => undefined}
				onToggleFavorite={() => undefined}
				onSaveSvg={() => undefined}
				onSavePng={() => undefined}
				onOpenKit={() => undefined}
				onDelete={() => undefined}
				emptyState={empty}
				t={t}
			/>,
		);
		expect(container.querySelector("[aria-busy]")).toBeTruthy();
		expect(screen.queryByText("nothing yet")).toBeNull();
	});
});
