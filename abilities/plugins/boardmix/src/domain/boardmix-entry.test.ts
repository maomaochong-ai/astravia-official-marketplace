import { describe, expect, it } from "vitest";
import { phaseOf } from "./boardmix-destinations";
import {
	EMPTY_ENTRY_STATE,
	isFatalLoadFailure,
	nextSeed,
	readEntryState,
	seedLadder,
} from "./boardmix-entry";

describe("readEntryState", () => {
	it("keeps an https boardmix address", () => {
		const state = readEntryState({
			lastGoodUrl: "https://boardmix.cn/app/recent-file",
			landedAt: "2026-11-05T10:00:00.000Z",
			entryUrlOverride: null,
		});
		expect(state.lastGoodUrl).toBe("https://boardmix.cn/app/recent-file");
		expect(state.landedAt).toBe("2026-11-05T10:00:00.000Z");
	});

	it("drops a foreign origin and any non-https scheme", () => {
		expect(readEntryState({ lastGoodUrl: "https://evil.example/app/" }).lastGoodUrl).toBeNull();
		expect(readEntryState({ lastGoodUrl: "http://boardmix.cn/app/" }).lastGoodUrl).toBeNull();
		expect(readEntryState(null)).toEqual(EMPTY_ENTRY_STATE);
	});

	it("drops landedAt when there is no address to attach it to", () => {
		const state = readEntryState({ lastGoodUrl: "https://evil.example/", landedAt: "2026-11-05" });
		expect(state.landedAt).toBeNull();
	});
});

describe("seedLadder", () => {
	it("falls back from the learned address to the workspace root and then the site root", () => {
		const ladder = seedLadder({
			lastGoodUrl: "https://boardmix.cn/app/recent-file",
			landedAt: null,
			entryUrlOverride: null,
		});
		expect(ladder).toEqual([
			{ level: 1, url: "https://boardmix.cn/app/recent-file" },
			{ level: 2, url: "https://boardmix.cn/app/" },
			{ level: 3, url: "https://boardmix.cn/" },
		]);
	});

	it("puts the manual override first without duplicating a repeated address", () => {
		const ladder = seedLadder({
			lastGoodUrl: "https://boardmix.cn/app/",
			landedAt: null,
			entryUrlOverride: "https://boardmix.cn/app/",
		});
		expect(ladder.map(seed => seed.url)).toEqual(["https://boardmix.cn/app/", "https://boardmix.cn/"]);
	});

	it("still produces a usable ladder when nothing was ever learned", () => {
		expect(seedLadder(EMPTY_ENTRY_STATE).map(seed => seed.level)).toEqual([2, 3]);
	});
});

describe("nextSeed", () => {
	it("moves strictly down the ladder and stops at the last level", () => {
		const ladder = seedLadder(EMPTY_ENTRY_STATE);
		expect(nextSeed(ladder, 2)?.level).toBe(3);
		expect(nextSeed(ladder, 3)).toBeNull();
	});
});

describe("isFatalLoadFailure", () => {
	it("ignores sub-frame failures and aborted loads", () => {
		expect(isFatalLoadFailure({ isMainFrame: false, errorCode: -105 })).toBe(false);
		expect(isFatalLoadFailure({ isMainFrame: true, errorCode: -3 })).toBe(false);
	});

	it("treats a main-frame network error as fatal", () => {
		expect(isFatalLoadFailure({ isMainFrame: true, errorCode: -105 })).toBe(true);
	});
});

describe("phaseOf", () => {
	it("recognises the workspace and the login page", () => {
		expect(phaseOf("https://boardmix.cn/app/recent-file")).toBe("workspace");
		expect(phaseOf("https://boardmix.cn/user/login/")).toBe("login");
	});

	it("does not guess outside those two", () => {
		expect(phaseOf("https://boardmix.cn/price/")).toBe("unknown");
		expect(phaseOf("https://example.com/app/")).toBe("unknown");
	});
});
