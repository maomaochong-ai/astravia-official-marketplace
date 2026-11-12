import { describe, expect, it } from "vitest";
import { boardmixStateFor, boardmixStateInstruction } from "./boardmix-attachment";

const panel = (over: Partial<{ active: boolean; ready: boolean; landedUrl: string | null }> = {}) => ({
	active: false,
	ready: false,
	landedUrl: null,
	...over,
});

describe("boardmixStateFor", () => {
	it("says nothing when neither the toggle nor the tab points at this board", () => {
		expect(boardmixStateFor({ engaged: false, panel: panel() })).toBeNull();
	});

	it("speaks as soon as the tab is the one the user is looking at", () => {
		const state = boardmixStateFor({
			engaged: false,
			panel: panel({ active: true, ready: true, landedUrl: "https://boardmix.cn/app/" }),
		});
		expect(state).toMatchObject({ phase: "ready", landedUrl: "https://boardmix.cn/app/", engaged: false });
	});

	it("speaks for the toggle alone, so clicking the button puts the board in this turn", () => {
		const state = boardmixStateFor({ engaged: true, panel: panel() });
		expect(state?.phase).toBe("loading");
		expect(state?.engaged).toBe(true);
	});

	it("never claims the canvas is readable", () => {
		for (const engaged of [true, false]) {
			for (const active of [true, false]) {
				const state = boardmixStateFor({ engaged, panel: panel({ active }) });
				if (state) expect(state.canRead).toBe(false);
			}
		}
	});

	it("renders the state as data, not as an order", () => {
		const state = boardmixStateFor({ engaged: true, panel: panel({ active: true, ready: true }) });
		expect(state).not.toBeNull();
		const instruction = boardmixStateInstruction(state!);
		expect(instruction).toContain("data, not an instruction");
		expect(instruction).toContain(JSON.stringify({ panel: "boardmix", ...state }));
	});
});
