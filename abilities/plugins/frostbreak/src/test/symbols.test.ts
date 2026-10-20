import { describe, expect, it } from "vitest";
import { parsePe } from "../domain/native/pe";
import { listSymbols } from "../domain/native/symbols";
import { buildElf, buildElfWithSymbols, buildMacho, buildMachoWithSymbols, buildPe, buildPeWithExports } from "./fixtures";

describe("code symbols", () => {
	it("reads ELF dynsym and symtab together", () => {
		const surface = listSymbols(buildElfWithSymbols(), "elf");
		const names = surface.symbols.map(symbol => symbol.name);
		expect(names).toContain("imported_fn");
		expect(names).toContain("exported_init");
		expect(names).toContain("local_helper");

		const imported = surface.symbols.find(symbol => symbol.name === "imported_fn")!;
		expect(imported.kind).toBe("import");
		expect(imported.exported).toBe(false);

		const exported = surface.symbols.find(symbol => symbol.name === "exported_init")!;
		expect(exported.kind).toBe("function");
		expect(exported.exported).toBe(true);
		expect(exported.address).toBe(0x1040);

		const local = surface.symbols.find(symbol => symbol.name === "local_helper")!;
		expect(local.kind).toBe("function");
		expect(local.exported).toBe(false);

		expect(surface.functions).toBe(2);
		expect(surface.imports).toBe(1);
		expect(surface.exports).toBe(1);
	});

	it("reports a stripped ELF instead of inventing names", () => {
		const surface = listSymbols(buildElf(), "elf");
		expect(surface.symbols).toEqual([]);
		expect(surface.warnings.join(" ")).toContain("stripped");
	});

	it("reads PE exports with their RVAs", () => {
		const surface = listSymbols(buildPeWithExports(), "pe");
		const names = surface.symbols.map(symbol => symbol.name);
		expect(names).toEqual(["ExportedMain", "ExportedHelper"]);
		expect(surface.symbols.map(symbol => symbol.address)).toEqual([0x1000, 0x1010]);
		expect(surface.symbols.every(symbol => symbol.exported)).toBe(true);
		// parsePe 仍然能解析同一份映像，说明夹具本身是合法的 PE。
		expect(parsePe(buildPeWithExports()).value?.arch).toBe("x86-64");
	});

	it("merges imported routines from the native facts", () => {
		const facts = parsePe(buildPe()).value!;
		const surface = listSymbols(buildPe(), "pe", { imports: facts.imports });
		const imported = surface.symbols.filter(symbol => symbol.kind === "import").map(symbol => symbol.name);
		expect(imported.length).toBeGreaterThan(0);
		expect(imported.every(name => name.includes("@"))).toBe(true);
	});

	it("reads Mach-O LC_SYMTAB and separates defined from undefined symbols", () => {
		const surface = listSymbols(buildMachoWithSymbols(), "macho");
		const defined = surface.symbols.find(symbol => symbol.name === "_main")!;
		const imported = surface.symbols.find(symbol => symbol.name === "_printf")!;
		expect(defined.kind).toBe("function");
		expect(defined.exported).toBe(true);
		expect(defined.address).toBe(0x1000);
		expect(imported.kind).toBe("import");
		expect(surface.imports).toBe(1);
	});

	it("reports a Mach-O without LC_SYMTAB", () => {
		const surface = listSymbols(buildMacho(), "macho");
		expect(surface.symbols).toEqual([]);
		expect(surface.warnings.join(" ")).toContain("LC_SYMTAB");
	});

	it("honours the symbol budget", () => {
		const surface = listSymbols(buildElfWithSymbols(), "elf", { limit: 2 });
		expect(surface.symbols).toHaveLength(2);
		expect(surface.truncated).toBe(true);
	});
});
