import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Three reports, one theme: the plugin was invisible or inert where the user expected it.
 *
 *  - the first button in the composer listed skills, and Strix had hidden itself from
 *    every surface, so there was nothing to click;
 *  - a message typed in the host chat did not reach the panel, because a tab that
 *    mounted before the host reported its conversation id adopted `null` and then
 *    ignored every event forever;
 *  - enabling the capsule set a flag but never installed the service, so the chip was on
 *    while the toolkit behind it did not exist.
 */
const manifest = JSON.parse(
	readFileSync(resolve(process.cwd(), "plugin.json"), "utf8"),
) as {
	agent: { skillPresentation: { defaultVisibility: string; skills: Record<string, { surfaces: Record<string, string> }> } };
};
const session = readFileSync(resolve(process.cwd(), "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
const index = readFileSync(resolve(process.cwd(), "src/index.tsx"), "utf8");

describe("the plugin is reachable from the composer", () => {
	it("exposes its entry skill to the picker and the palette", () => {
		const entry = manifest.agent.skillPresentation.skills["penetration-testing-with-strix"];
		expect(entry, "the entry skill must be presented").toBeTruthy();
		expect(entry.surfaces.skillPicker).toBe("visible");
		expect(entry.surfaces.commandPalette).toBe("visible");
	});

	it("keeps the internal knowledge skills hidden", () => {
		// They are read by the agent through strix_load_skills, not clicked by a human.
		expect(manifest.agent.skillPresentation.defaultVisibility).toBe("hidden");
		const internal = manifest.agent.skillPresentation.skills["owasp-top-10-testing"];
		expect(internal.surfaces.skillPicker).toBe("hidden");
	});
});

describe("a host message reaches the panel", () => {
	it("adopts the conversation id that arrives after mount", () => {
		expect(session).toContain("mountedIn.current === null && conversation?.id");
	});

	it("mirrors the host turn instead of starting a second run", () => {
		expect(session).toContain('setPhase("scanning")');
		expect(session).not.toContain("startRef.current(text)");
	});
});

describe("the capsule prepares what it claims", () => {
	it("installs and starts the bridge when it is switched on", () => {
		expect(index).toContain("runtime.ensureReady()");
		expect(index).toContain('ctx.i18n.t("log.bridgeError")');
	});
});
