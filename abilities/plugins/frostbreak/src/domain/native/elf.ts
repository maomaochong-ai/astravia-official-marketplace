import { cstring, u16, u32, u64, u8 } from "../bytes";
import { entropyOfRange } from "../entropy";
import { describeError, ELF_MACHINES, failed, parsed, type NativeFacts, type NativeSection, type Parsed } from "./types";

const ET_EXEC = 2;
const ET_DYN = 3;
const PT_LOAD = 1;
const PT_INTERP = 3;
const PT_GNU_STACK = 0x6474e551;
const PF_X = 1;
const PF_W = 2;
const SHF_WRITE = 0x1;
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;
const SHT_SYMTAB = 2;
const SHT_NOBITS = 8;

const KINDS: Record<number, string> = {
	1: "relocatable object",
	2: "executable",
	3: "shared object / PIE",
	4: "core dump",
};

/** 节区名表是 NUL 分隔的原始字节，按索引从这个偏移往后读一个 C 字符串。 */
function sectionNameAt(bytes: Uint8Array, tableOffset: number, index: number, fallback: string): string {
	if (tableOffset <= 0 || index <= 0) return fallback;
	const name = cstring(bytes, tableOffset + index, 256);
	return name.length > 0 ? name : fallback;
}

export function looksLikeElf(bytes: Uint8Array): boolean {
	return bytes.byteLength >= 16 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
}

export function parseElf(bytes: Uint8Array): Parsed<NativeFacts> {
	try {
		if (!looksLikeElf(bytes)) return failed("not an ELF file");
		const bits = u8(bytes, 4) === 2 ? 64 : 32;
		const littleEndian = u8(bytes, 5) !== 2;
		const warnings: string[] = [];
		const type = u16(bytes, 16, littleEndian);
		const machine = u16(bytes, 18, littleEndian);
		const entryPoint = bits === 64 ? u64(bytes, 24, littleEndian) : u32(bytes, 24, littleEndian);
		const phoff = bits === 64 ? u64(bytes, 32, littleEndian) : u32(bytes, 28, littleEndian);
		const shoff = bits === 64 ? u64(bytes, 40, littleEndian) : u32(bytes, 32, littleEndian);
		const phentsize = u16(bytes, bits === 64 ? 54 : 42, littleEndian);
		const phnum = u16(bytes, bits === 64 ? 56 : 44, littleEndian);
		const shentsize = u16(bytes, bits === 64 ? 58 : 46, littleEndian);
		const shnum = u16(bytes, bits === 64 ? 60 : 48, littleEndian);
		const shstrndx = u16(bytes, bits === 64 ? 62 : 50, littleEndian);

		let interpreter: string | null = null;
		let executableStack: boolean | null = null;
		let rwxSegments = 0;

		for (let index = 0; index < phnum; index += 1) {
			if (phentsize === 0) break;
			const base = phoff + index * phentsize;
			const pType = u32(bytes, base, littleEndian);
			const pFlags = bits === 64 ? u32(bytes, base + 4, littleEndian) : u32(bytes, base + 24, littleEndian);
			const pOffset = bits === 64 ? u64(bytes, base + 8, littleEndian) : u32(bytes, base + 4, littleEndian);
			if (pType === PT_INTERP) interpreter = cstring(bytes, pOffset, 256);
			if (pType === PT_GNU_STACK) executableStack = (pFlags & PF_X) !== 0;
			if (pType === PT_LOAD && (pFlags & PF_X) !== 0 && (pFlags & PF_W) !== 0) rwxSegments += 1;
		}

		const sections: NativeSection[] = [];
		let nameTableOffset = -1;
		if (shoff > 0 && shnum > 0 && shstrndx < shnum && shentsize > 0) {
			const strBase = shoff + shstrndx * shentsize;
			const strOffset = bits === 64 ? u64(bytes, strBase + 24, littleEndian) : u32(bytes, strBase + 16, littleEndian);
			nameTableOffset = strOffset;
		}

		let hasSymbolTable = false;
		for (let index = 0; index < Math.min(shnum, 96); index += 1) {
			const base = shoff + index * shentsize;
			const nameIndex = u32(bytes, base, littleEndian);
			const sectionType = u32(bytes, base + 4, littleEndian);
			const flags = bits === 64 ? u64(bytes, base + 8, littleEndian) : u32(bytes, base + 8, littleEndian);
			const offset = bits === 64 ? u64(bytes, base + 24, littleEndian) : u32(bytes, base + 16, littleEndian);
			const size = bits === 64 ? u64(bytes, base + 32, littleEndian) : u32(bytes, base + 20, littleEndian);
			if (sectionType === SHT_SYMTAB) hasSymbolTable = true;
			sections.push({
				name: sectionNameAt(bytes, nameTableOffset, nameIndex, `section-${index}`),
				size,
				entropy: sectionType === SHT_NOBITS || (flags & SHF_ALLOC) === 0 ? 0 : entropyOfRange(bytes, offset, size, 128 * 1024),
				executable: (flags & SHF_EXECINSTR) !== 0,
				writable: (flags & SHF_WRITE) !== 0,
			});
		}

		const facts: NativeFacts = {
			format: "elf",
			arch: ELF_MACHINES[machine] ?? `machine-0x${machine.toString(16)}`,
			bits,
			endianness: littleEndian ? "little" : "big",
			kind: KINDS[type] ?? `type-${type}`,
			entryPoint,
			pie: type === ET_DYN ? true : type === ET_EXEC ? false : null,
			executableStack,
			nxCompat: null,
			signed: null,
			stripped: shnum > 0 ? !hasSymbolTable : null,
			dotnet: false,
			interpreter,
			sections,
			imports: [],
			libraries: [],
			notes: warnings,
		};
		if (rwxSegments > 0) facts.notes.push(`${rwxSegments} writable+executable segment(s)`);
		return parsed(facts, facts.notes);
	} catch (error) {
		return failed(`ELF header parse failed: ${describeError(error)}`);
	}
}
