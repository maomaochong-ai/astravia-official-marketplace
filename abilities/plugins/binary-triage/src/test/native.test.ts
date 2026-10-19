import { describe, expect, it } from "vitest";
import { parseElf } from "../domain/native/elf";
import { parseMacho } from "../domain/native/macho";
import { parsePe } from "../domain/native/pe";
import { buildElf, buildMacho, buildPe, utf8 } from "./fixtures";

describe("elf", () => {
	it("reads the header, sections and PIE flag", () => {
		const { value: facts, warnings } = parseElf(buildElf());
		expect(warnings).toEqual([]);
		expect(facts).not.toBeNull();
		expect(facts!.format).toBe("elf");
		expect(facts!.arch).toBe("x86-64");
		expect(facts!.bits).toBe(64);
		expect(facts!.kind).toBe("shared object / PIE");
		expect(facts!.entryPoint).toBe(0x1040);
		expect(facts!.pie).toBe(true);
		expect(facts!.stripped).toBe(true);
		expect(facts!.sections.map(section => section.name)).toContain(".text");
		expect(facts!.sections.some(section => section.executable)).toBe(true);
	});

	it("refuses non-ELF input", () => {
		const { value, warnings } = parseElf(utf8("definitely not an elf file"));
		expect(value).toBeNull();
		expect(warnings[0]).toContain("not an ELF");
	});
});

describe("pe", () => {
	it("reads the image base, hardening flags and imports", () => {
		const { value: facts, warnings } = parsePe(buildPe());
		expect(warnings).toEqual(["image base 0x140000000"]);
		expect(facts).not.toBeNull();
		expect(facts!.format).toBe("pe");
		expect(facts!.arch).toBe("x86-64");
		expect(facts!.bits).toBe(64);
		expect(facts!.kind).toBe("executable");
		expect(facts!.entryPoint).toBe(0x1000);
		expect(facts!.pie).toBe(true);
		expect(facts!.nxCompat).toBe(true);
		expect(facts!.libraries).toEqual(["KERNEL32.dll"]);
		expect(facts!.imports[0]?.functions).toContain("CreateFileW");
		expect(facts!.sections[0]?.name).toBe(".text");
		expect(facts!.sections[0]?.executable).toBe(true);
	});

	it("refuses files without the PE signature", () => {
		expect(parsePe(utf8("MZ but nothing else")).value).toBeNull();
	});
});

describe("macho", () => {
	it("reads the load commands, entry offset and linked images", () => {
		const { value: facts } = parseMacho(buildMacho({ entryOffset: 0x1a00, library: "/usr/lib/libSystem.B.dylib" }));
		expect(facts).not.toBeNull();
		expect(facts!.format).toBe("macho");
		expect(facts!.arch).toBe("x86-64");
		expect(facts!.kind).toBe("dynamic library");
		expect(facts!.entryPoint).toBe(0x1a00);
		expect(facts!.pie).toBe(true);
		expect(facts!.libraries).toEqual(["libSystem.B.dylib"]);
	});
	it("keeps a zero entry offset honest instead of inventing one", () => {
		const { value: facts } = parseMacho(buildMacho({ entryOffset: 0 }));
		expect(facts!.entryPoint).toBe(0);
	});
});
