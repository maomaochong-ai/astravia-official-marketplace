import { describe, expect, it } from "vitest";
import { missingTools, TOOLCHAIN, type ToolProbe } from "../service/toolchain";

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
			{ name: "nmap", found: true, version: "Nmap version 7.95" },
			{ name: "sqlmap", found: false, version: "" },
			{ name: "nuclei", found: true, version: "v3.1.0" },
		];
		expect(missingTools(probes)).toEqual(["sqlmap"]);
	});

	it("reports nothing missing when everything answered", () => {
		expect(missingTools(TOOLCHAIN.map((name) => ({ name, found: true, version: "x" })))).toEqual([]);
	});
});
