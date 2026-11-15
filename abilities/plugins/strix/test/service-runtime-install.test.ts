import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The bridge runtime contract, as text.
 *
 * Two failures are pinned here because both were reported by users and both are
 * invisible until the plugin is installed on a machine that has never run it:
 *
 *  - `installed === false` skipped the install whenever the host left the field
 *    undefined, so `start()` failed with "Service runtime is not installed by the
 *    plugin" and the panel said the bridge was unavailable;
 *  - the host refuses `install` while the service is running, so a version switch on a
 *    machine where the old service was still up failed on the first open.
 *
 * Reading the module as text is deliberate: the runtime talks to the host over IPC and
 * a fake of that surface would assert the mock, not the order the code uses.
 */
const source = readFileSync(resolve(process.cwd(), "src/runtime.ts"), "utf8");

describe("bridge runtime install contract", () => {
	it("treats a missing `installed` flag as not installed", () => {
		expect(source).toContain("status?.installed !== true");
		expect(source).not.toContain("status.installed === false");
	});

	it("stops the service before installing its runtime", () => {
		const install = source.indexOf("await installRuntime(services)");
		expect(install).toBeGreaterThan(-1);
		// A stop must appear before the first install, or the host rejects the payload.
		expect(source.slice(0, install)).toContain("services.stop(SERVICE_ID)");
	});

	it("re-installs once when the host reports the runtime missing", () => {
		expect(source).toContain("/not installed by the plugin/i");
		const heal = source.indexOf("/not installed by the plugin/i");
		expect(source.slice(heal)).toContain("await installRuntime(services)");
	});
});
