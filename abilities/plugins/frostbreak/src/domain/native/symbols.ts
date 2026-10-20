import { cstring, u16, u32, u64, u8 } from "../bytes";
import type { NativeFormat, NativeImportGroup } from "./types";

export type SymbolKind = "function" | "object" | "import" | "other";
export type SymbolSource = "symtab" | "dynsym" | "export" | "import";

export interface CodeSymbol {
	name: string;
	address: number;
	kind: SymbolKind;
	source: SymbolSource;
	exported: boolean;
}

export interface SymbolSurface {
	format: NativeFormat;
	symbols: CodeSymbol[];
	total: number;
	functions: number;
	imports: number;
	exports: number;
	truncated: boolean;
	warnings: string[];
}

const SHT_SYMTAB = 2;
const SHT_DYNSYM = 11;
const STT_OBJECT = 1;
const STT_FUNC = 2;
const MAX_SECTIONS = 512;
const MAX_SYMBOLS = 200_000;

function push(symbols: CodeSymbol[], symbol: CodeSymbol, limit: number): boolean {
	if (symbols.length >= limit) return false;
	symbols.push(symbol);
	return true;
}

function elfSymbols(bytes: Uint8Array, symbols: CodeSymbol[], limit: number, warnings: string[]): void {
	const bits = u8(bytes, 4) === 2 ? 64 : 32;
	if (bytes[5] === 2) {
		warnings.push("big-endian ELF symbol tables are not read");
		return;
	}
	const sectionOffset = bits === 64 ? u64(bytes, 40) : u32(bytes, 32);
	const entrySize = u16(bytes, bits === 64 ? 58 : 46);
	const sectionCount = u16(bytes, bits === 64 ? 60 : 48);
	if (sectionOffset === 0 || sectionCount === 0) {
		warnings.push("no section header table, so no symbol table");
		return;
	}

	interface Section {
		type: number;
		offset: number;
		size: number;
		link: number;
		entsize: number;
	}

	const sections: Section[] = [];
	for (let index = 0; index < Math.min(sectionCount, MAX_SECTIONS); index += 1) {
		const base = sectionOffset + index * entrySize;
		sections.push({
			type: u32(bytes, base + 4),
			offset: bits === 64 ? u64(bytes, base + 24) : u32(bytes, base + 16),
			size: bits === 64 ? u64(bytes, base + 32) : u32(bytes, base + 20),
			link: u32(bytes, base + (bits === 64 ? 40 : 24)),
			entsize: bits === 64 ? u64(bytes, base + 56) : u32(bytes, base + 36),
		});
	}

	let sawTable = false;
	for (const section of sections) {
		if (section.type !== SHT_SYMTAB && section.type !== SHT_DYNSYM) continue;
		const strings = sections[section.link];
		if (!strings) continue;
		sawTable = true;
		const source: SymbolSource = section.type === SHT_DYNSYM ? "dynsym" : "symtab";
		const itemSize = section.entsize || (bits === 64 ? 24 : 16);
		const count = Math.min(Math.floor(section.size / itemSize), MAX_SYMBOLS);
		for (let index = 0; index < count; index += 1) {
			const base = section.offset + index * itemSize;
			const nameIndex = u32(bytes, base);
			if (nameIndex === 0) continue;
			const name = cstring(bytes, strings.offset + nameIndex, 256);
			if (name === "") continue;
			const info = u8(bytes, bits === 64 ? base + 4 : base + 12);
			const shndx = u16(bytes, bits === 64 ? base + 6 : base + 14);
			const address = bits === 64 ? u64(bytes, base + 8) : u32(bytes, base + 4);
			const type = info & 0x0f;
			const bind = info >> 4;
			const kind: SymbolKind = shndx === 0 ? "import" : type === STT_FUNC ? "function" : type === STT_OBJECT ? "object" : "other";
			const exported = shndx !== 0 && (bind === 1 || bind === 2);
			if (!push(symbols, { name, address, kind, source, exported }, limit)) {
				warnings.push(`symbol list truncated at ${limit}`);
				return;
			}
		}
	}
	if (!sawTable) warnings.push("binary has no .symtab or .dynsym (stripped)");
}

function peSymbols(bytes: Uint8Array, symbols: CodeSymbol[], limit: number, warnings: string[]): void {
	const peOffset = u32(bytes, 0x3c);
	const coff = peOffset + 4;
	const sectionCount = u16(bytes, coff + 2);
	const optionalSize = u16(bytes, coff + 16);
	const optional = coff + 20;
	const plus = u16(bytes, optional) === 0x20b;
	const directoryCount = u32(bytes, optional + (plus ? 108 : 92));
	const directoryBase = optional + (plus ? 112 : 96);
	const sectionTable = optional + optionalSize;

	interface Section {
		virtualAddress: number;
		virtualSize: number;
		rawSize: number;
		rawPointer: number;
	}

	const sections: Section[] = [];
	for (let index = 0; index < Math.min(sectionCount, MAX_SECTIONS); index += 1) {
		const base = sectionTable + index * 40;
		sections.push({
			virtualSize: u32(bytes, base + 8),
			virtualAddress: u32(bytes, base + 12),
			rawSize: u32(bytes, base + 16),
			rawPointer: u32(bytes, base + 20),
		});
	}
	const headersSize = optional + optionalSize + sectionCount * 40;
	const rvaToOffset = (rva: number): number | null => {
		if (rva < headersSize) return rva;
		for (const section of sections) {
			const span = Math.max(section.virtualSize, section.rawSize);
			if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
				const delta = rva - section.virtualAddress;
				return delta >= section.rawSize ? null : section.rawPointer + delta;
			}
		}
		return null;
	};

	if (directoryCount <= 0) {
		warnings.push("image has no data directories, so no export table");
		return;
	}
	const exportRva = u32(bytes, directoryBase);
	const exportSize = u32(bytes, directoryBase + 4);
	if (exportRva === 0 || exportSize === 0) {
		warnings.push("image exports nothing (no export directory)");
		return;
	}
	const base = rvaToOffset(exportRva);
	if (base === null) {
		warnings.push("export directory is not mapped in any section");
		return;
	}
	const nameCount = u32(bytes, base + 24);
	const functionTable = u32(bytes, base + 28);
	const nameTable = u32(bytes, base + 32);
	const ordinalTable = u32(bytes, base + 36);
	const functionsOffset = rvaToOffset(functionTable);
	const namesOffset = rvaToOffset(nameTable);
	const ordinalsOffset = rvaToOffset(ordinalTable);
	if (functionsOffset === null || namesOffset === null || ordinalsOffset === null) {
		warnings.push("export tables point outside the image");
		return;
	}
	for (let index = 0; index < Math.min(nameCount, 20000); index += 1) {
		const nameRva = u32(bytes, namesOffset + index * 4);
		const nameOffset = rvaToOffset(nameRva);
		if (nameOffset === null) continue;
		const name = cstring(bytes, nameOffset, 512);
		if (name === "") continue;
		const ordinal = u16(bytes, ordinalsOffset + index * 2);
		const address = u32(bytes, functionsOffset + ordinal * 4);
		if (!push(symbols, { name, address, kind: "function", source: "export", exported: true }, limit)) {
			warnings.push(`symbol list truncated at ${limit}`);
			return;
		}
	}
	if (nameCount === 0) warnings.push("export directory has no named exports");
}

function machoSymbols(bytes: Uint8Array, symbols: CodeSymbol[], limit: number, warnings: string[]): void {
	const magic = u32(bytes, 0);
	if (magic === 0xcafebabe || magic === 0xbebafeca) {
		warnings.push("multi-architecture Mach-O containers are not read; pass a single slice");
		return;
	}
	const bits = magic === 0xfeedfacf ? 64 : 32;
	if (magic !== 0xfeedfacf && magic !== 0xfeedface) {
		warnings.push("not a thin little-endian Mach-O image");
		return;
	}
	const commandCount = u32(bytes, 16);
	const commandBytes = u32(bytes, 20);
	const headerSize = bits === 64 ? 32 : 28;
	const commandEnd = Math.min(bytes.byteLength, headerSize + commandBytes);

	let cursor = headerSize;
	let sawTable = false;
	for (let index = 0; index < Math.min(commandCount, 4096) && cursor + 8 <= commandEnd; index += 1) {
		const command = u32(bytes, cursor);
		const size = u32(bytes, cursor + 4);
		if (size < 8) break;
		if (command === 0x2) {
			sawTable = true;
			const symbolOffset = u32(bytes, cursor + 8);
			const symbolCount = u32(bytes, cursor + 12);
			const stringOffset = u32(bytes, cursor + 16);
			const itemSize = bits === 64 ? 16 : 12;
			for (let item = 0; item < Math.min(symbolCount, MAX_SYMBOLS); item += 1) {
				const base = symbolOffset + item * itemSize;
				const stringIndex = u32(bytes, base);
				if (stringIndex === 0) continue;
				const name = cstring(bytes, stringOffset + stringIndex, 512);
				if (name === "") continue;
				const type = u8(bytes, base + 4);
				const section = u8(bytes, base + 5);
				const address = bits === 64 ? u64(bytes, base + 8) : u32(bytes, base + 8);
				const external = (type & 0x01) !== 0;
				const kindCode = type & 0x0e;
				const kind: SymbolKind = kindCode === 0 ? "import" : kindCode === 0x0e && section !== 0 ? "function" : "other";
				const exported = external && kindCode !== 0;
				if (!push(symbols, { name, address, kind, source: "symtab", exported }, limit)) {
					warnings.push(`symbol list truncated at ${limit}`);
					return;
				}
			}
		}
		cursor += size;
	}
	if (!sawTable) warnings.push("no LC_SYMTAB load command (stripped)");
}

/**
 * Enumerate the code surface of a native image: named functions, exported
 * entry points and imported routines. Everything is read from the file itself,
 * so it works the same for stripped and unstripped samples — a stripped binary
 * simply reports fewer names.
 */
export function listSymbols(
	bytes: Uint8Array,
	format: NativeFormat,
	options: { limit?: number; imports?: readonly NativeImportGroup[] } = {},
): SymbolSurface {
	const limit = Math.max(1, Math.min(2000, options.limit ?? 400));
	const warnings: string[] = [];
	const symbols: CodeSymbol[] = [];

	if (format === "elf") elfSymbols(bytes, symbols, limit, warnings);
	else if (format === "pe") peSymbols(bytes, symbols, limit, warnings);
	else machoSymbols(bytes, symbols, limit, warnings);

	for (const group of options.imports ?? []) {
		for (const name of group.functions) {
			if (symbols.length >= limit) break;
			symbols.push({ name: `${name}@${group.library}`, address: 0, kind: "import", source: "import", exported: false });
		}
	}

	const seen = new Set<string>();
	const unique = symbols.filter(item => {
		const key = `${item.source}:${item.name}:${item.address}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return {
		format,
		symbols: unique,
		total: unique.length,
		functions: unique.filter(item => item.kind === "function").length,
		imports: unique.filter(item => item.kind === "import").length,
		exports: unique.filter(item => item.exported).length,
		truncated: unique.length >= limit,
		warnings,
	};
}
