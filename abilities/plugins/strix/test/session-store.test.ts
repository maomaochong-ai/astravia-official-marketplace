import { describe, expect, it } from "vitest";
import { belongsTo, forgetSnapshot, readSnapshot, writeSnapshot } from "../src/features/scan-console/session-store";

/**
 * Two failures were reported as one: "the panel reset" and "conversations bleed".
 *
 * They share a cause — the panel had no idea which conversation it belonged to, and no
 * memory of what it had already done. These assertions pin both halves: a snapshot
 * survives a remount, and a panel opened in one conversation refuses events from another.
 */
describe("session scope", () => {
	it("keeps a snapshot for the conversation that made it, and drops it on request", () => {
		writeSnapshot("conv-a", {
			phase: "scanning",
			trace: [],
			targets: ["https://example.test"],
			sandbox: { running: true, targets: [] },
			findings: [],
			todos: [],
			notes: [],
			coverage: [],
			mcp: [],
		});
		expect(readSnapshot("conv-a")?.targets).toEqual(["https://example.test"]);
		expect(readSnapshot("conv-b")).toBeUndefined();
		forgetSnapshot("conv-a");
		expect(readSnapshot("conv-a")).toBeUndefined();
	});

	it("ignores an undefined conversation instead of sharing one global slot", () => {
		writeSnapshot(undefined, {
			phase: "setup",
			trace: [],
			targets: [],
			sandbox: { running: false, targets: [] },
			findings: [],
			todos: [],
			notes: [],
			coverage: [],
			mcp: [],
		});
		expect(readSnapshot(undefined)).toBeUndefined();
	});

	it("accepts events only from the conversation the panel mounted in", () => {
		expect(belongsTo("conv-a", "conv-a")).toBe(true);
		expect(belongsTo("conv-a", "conv-b")).toBe(false);
		// 1.5.0：未绑定的面板接受第一个真会话。原实现返回 false，导致“发出去了、宿主在跑、
		// 面板不动”——那一轮的 turn-start 与 tool-call 全被这一条挡掉。
		expect(belongsTo(null, "conv-b")).toBe(true);
		expect(belongsTo(null, undefined)).toBe(true);
	});
});
