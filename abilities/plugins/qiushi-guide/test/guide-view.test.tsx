import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideView } from "../src/features/illustrated-guide/components/guide-view";

vi.mock("@astravia-org/plugin-sdk", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

function renderedFrame(): HTMLIFrameElement {
	return screen.getByTitle("guide.frame.title") as HTMLIFrameElement;
}

describe("illustrated guide view", () => {
	it("renders the shipped page itself, not a re-creation of it", () => {
		render(<GuideView />);
		const frame = renderedFrame();
		const page = frame.getAttribute("srcdoc") ?? "";

		expect(page).toContain("<title>求是方法论 | Qiushi Methodology</title>");
		expect(page).toContain("--color-primary: #8b1a1a");
		// A regenerated stub would pass a title check; real page weight would not.
		expect(page.length).toBeGreaterThan(60000);
	});

	it("gives the page its own origin so its stylesheet cannot reach the host", () => {
		render(<GuideView />);
		const sandbox = renderedFrame().getAttribute("sandbox") ?? "";

		expect(sandbox).toContain("allow-scripts");
		// allow-same-origin together with allow-scripts would let the frame drop its
		// sandbox; the page needs neither host storage nor host DOM.
		expect(sandbox).not.toContain("allow-same-origin");
	});
});
