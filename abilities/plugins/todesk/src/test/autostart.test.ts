import { describe, expect, it } from "vitest";
import { judgeAutostart } from "../domain/autostart";

describe("judgeAutostart", () => {
	it("confirms when the read-back agrees", () => {
		expect(judgeAutostart(true, true)).toEqual({ applied: true });
		expect(judgeAutostart(false, false)).toEqual({ applied: true });
	});

	it("does not claim success when the client still says otherwise", () => {
		const verdict = judgeAutostart(true, false);
		expect(verdict.applied).toBe(false);
		expect(verdict.hint).toContain("still reports");
		// The official remedy for faq 104 is Fast Startup, quoted rather than invented.
		expect(verdict.remedy).toContain("快速启动");
		expect(verdict.remedy).not.toContain("同上");
	});

	it("explains the opposite mismatch too, because -autostart off can also fail", () => {
		const verdict = judgeAutostart(false, true);
		expect(verdict.applied).toBe(false);
		expect(verdict.hint).toContain("still reports start-with-Windows on");
		// Both branches must be readable on their own: no "同上" pointing at the other one.
		expect(verdict.remedy).not.toContain("同上");
		expect(verdict.remedy).toContain("取消勾选「启用快速启动」");
	});

	it("says unverified instead of failing when the flag is not reported at all", () => {
		expect(judgeAutostart(true, null)).toEqual({
			applied: null,
			hint: "the client did not report the startup flag, so this is unverified",
		});
	});
});
