import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideEntrySlot } from "../src/features/illustrated-guide/components/guide-entry-slot";

vi.mock("@astravia-org/plugin-sdk", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

describe("illustrated guide entry", () => {
	it("opens the host view instead of embedding a picture of the page", () => {
		const onOpen = vi.fn();
		const { container } = render(<GuideEntrySlot onOpen={onOpen} />);

		expect(screen.getByText("guide.slot.title")).toBeTruthy();
		expect(screen.getByText("guide.slot.subtitle")).toBeTruthy();
		// The page used to be a screenshot in the detail body; the entry must not
		// reintroduce one, or it goes stale the moment the page changes.
		expect(container.querySelector("img")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "guide.slot.open" }));
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("keeps the entry usable when the host reports the ability as not installed", () => {
		const onOpen = vi.fn();
		render(<GuideEntrySlot onOpen={onOpen} />);

		expect((screen.getByRole("button", { name: "guide.slot.open" }) as HTMLButtonElement).disabled).toBe(false);
	});
});
