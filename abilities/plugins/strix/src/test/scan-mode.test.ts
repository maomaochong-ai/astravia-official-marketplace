import { describe, expect, it } from "vitest";
import { asScanMode, commandCapSeconds, describeMode, finishGate } from "../domain/scan-mode";

/**
 * A mode has to change behaviour, not just a label.
 *
 * These pin the two things a depth decides: how long one command may run, and what
 * has to be true before a `deep` run is allowed to call itself finished.
 */
describe("scan mode", () => {
	it("falls back to standard for anything it does not recognise", () => {
		expect(asScanMode("deep")).toBe("deep");
		expect(asScanMode("nonsense")).toBe("standard");
		expect(asScanMode(undefined)).toBe("standard");
	});

	it("shortens the command ceiling only for quick", () => {
		expect(commandCapSeconds("quick")).toBe(120);
		for (const mode of ["standard", "deep", "diff"] as const) expect(commandCapSeconds(mode)).toBe(600);
	});

	it("lets quick, standard and diff finish without coverage", () => {
		for (const mode of ["quick", "standard", "diff"] as const) {
			expect(finishGate(mode, []).allowed).toBe(true);
		}
	});

	it("refuses a deep run that recorded nothing", () => {
		const gate = finishGate("deep", []);
		expect(gate.allowed).toBe(false);
		expect(gate.reason).toContain("strix_coverage_record");
	});

	it("refuses a deep run that only skipped surfaces, and names them", () => {
		const gate = finishGate("deep", [
			{ surface: "/login", outcome: "clean" },
			{ surface: "/admin", outcome: "skipped" },
			{ surface: "/api/orders", outcome: "skipped" },
		]);
		expect(gate.allowed).toBe(false);
		expect(gate.reason).toContain("/admin");
		expect(gate.reason).toContain("/api/orders");
	});

	it("allows a deep run once every surface has an outcome", () => {
		expect(
			finishGate("deep", [
				{ surface: "/login", outcome: "clean" },
				{ surface: "/admin", outcome: "vulnerable" },
			]).allowed,
		).toBe(true);
	});

	it("describes each mode in one line for the run log", () => {
		for (const mode of ["quick", "standard", "deep", "diff"] as const) {
			expect(describeMode(mode).length).toBeGreaterThan(0);
		}
	});
});
