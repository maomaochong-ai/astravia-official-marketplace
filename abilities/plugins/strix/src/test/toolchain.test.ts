import { describe, expect, it } from "vitest";
import { installHint, missingTools, TOOLCHAIN, type ToolProbe } from "../service/toolchain";

/**
 * The toolchain probe answers one question: can this step actually run here?
 *
 * In host mode the tools are only present if they are installed, so "unknown" is not
 * an option — a tool either answered or it did not. These assertions pin the shape the
 * panel and the model both read.
 */
describe("toolchain probe", () => {
	it("covers every tool the container's image carries", () => {
		for (const name of ["nmap", "nuclei", "ffuf", "sqlmap", "subfinder", "naabu", "trivy"]) {
			expect(TOOLCHAIN).toContain(name);
		}
	});

	it("names exactly the tools that did not answer", () => {
		const probes: ToolProbe[] = [
			{ name: "nmap", found: true, version: "Nmap version 7.95", source: "system" },
			{ name: "sqlmap", found: false, version: "", source: "missing" },
			{ name: "nuclei", found: true, version: "v3.1.0", source: "bundled" },
		];
		expect(missingTools(probes)).toEqual(["sqlmap"]);
	});

	it("reports nothing missing when everything answered", () => {
		expect(missingTools(TOOLCHAIN.map((name) => ({ name, found: true, version: "x", source: "bundled" as const })))).toEqual([]);
	});

	it("gives a copyable install line per platform, never a guess", () => {
		expect(installHint("trivy", "darwin")).toBe("brew install trivy");
		expect(installHint("sqlmap", "linux")).toBe("pipx install sqlmap");
		expect(installHint("nmap", "win32")).toBe("scoop install nmap");
		// httpx's binary name is mapped, so the hint must not say "nahttpx".
		expect(installHint("nahttpx", "win32")).toBe("scoop install httpx");
		for (const platform of ["win32", "darwin", "linux"] as const) {
			for (const name of TOOLCHAIN) {
				expect(installHint(name, platform).length).toBeGreaterThan(0);
				expect(installHint(name, platform)).not.toContain("nahttpx");
			}
		}
	});
});
