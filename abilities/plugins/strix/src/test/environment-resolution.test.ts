import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The environment must resolve to something that actually runs.
 *
 * ghcr.io is unreachable on restricted networks, so "pull the sandbox image" is not a
 * thing the panel may block on: a failed pull left the session with nothing to run on
 * and printed `sandbox failed to start`. These assertions pin the resolution rules and
 * the fallback that has to exist behind them.
 */
const environment = readFileSync(resolve(process.cwd(), "src/service/environment.ts"), "utf8");
const sandbox = readFileSync(resolve(process.cwd(), "src/service/sandbox.ts"), "utf8");
const payloads = readFileSync(resolve(process.cwd(), "src/domain/bridge-payloads.ts"), "utf8");

describe("environment resolution", () => {
	it("still prefers the container when the daemon is up but the image is missing", () => {
		// Giving up the container up front would throw away its toolchain; the pull is
		// bounded and has a fallback, so docker stays the first choice.
		expect(environment).toContain("is not pulled yet");
		expect(sandbox).toContain("could not be pulled");
		expect(sandbox).toContain("degraded(");
	});

	it("keeps a single definition of the host path", () => {
		// Two copies drifted once already: the fallback called a helper that did not exist.
		expect(sandbox.match(/beginHost\(/g)?.length).toBeGreaterThan(1);
		expect(sandbox).toContain("private beginHost(");
	});

	it("reports why the container was skipped", () => {
		// The reason travels to the panel as an event; it is not kept as dead state.
		expect(sandbox).toContain("sandbox_degraded");
		expect(sandbox).not.toContain("degradedReason");
	});

	it("passes the mode through so the panel can name the environment", () => {
		expect(payloads).toContain("value.mode === \"docker\" || value.mode === \"host\"");
	});
});
