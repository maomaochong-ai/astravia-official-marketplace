import { cstring, u32, i32, u64 } from "../bytes";
import { entropyOfRange } from "../entropy";
import { describeError, failed, MACHO_CPUS, parsed, type NativeFacts, type NativeImportGroup, type NativeSection, type Parsed } from "./types";

const FAT_MAGIC = 0xcafebabe;
const MH_PIE = 0x200000;
const MH_ALLOW_STACK_EXECUTION = 0x20000;
const LC_SEGMENT = 0x1;
const LC_SEGMENT_64 = 0x19;
const LC_MAIN = 0x80000028;
const VM_PROT_WRITE = 0x2;
const VM_PROT_EXECUTE = 0x4;
const SECTION_TYPE_MASK = 0xff;
const S_ATTR_SOME_INSTRUCTIONS = 0x400;
const S_ATTR_PURE_INSTRUCTIONS = 0x80000000;

const FILE_TYPES: Record<number, string> = {
	1: "object",
	2: "executable",
	6: "dynamic library",
	7: "dynamic linker",
	8: "bundle",
	9: "dylib stub",
	10: "debug symbols",
	11: "kernel extension",
	12: "fileset",
};

interface Slice {
	offset: number;
	size: number;
	littleEndian: boolean;
	bits: 32 | 64;
}

function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
	return u32(bytes, offset, littleEndian);
}

function readU64(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
	return u64(bytes, offset, littleEndian);
}

function detectSlices(bytes: Uint8Array): Slice[] {
	if (bytes.byteLength < 8) return [];
	const be = u32(bytes, 0, false);
	if (be === FAT_MAGIC) {
		const count = Math.min(u32(bytes, 4, false), 8);
		const slices: Slice[] = [];
		for (let index = 0; index < count; index += 1) {
			const base = 8 + index * 20;
			const offset = u32(bytes, base + 8, false);
			const size = u32(bytes, base + 12, false);
			const nested = detectSlicesAt(bytes, offset, offset);
			slices.push({ offset, size, littleEndian: nested?.littleEndian ?? true, bits: nested?.bits ?? 64 });
		}
		return slices;
	}
	const single = detectSlicesAt(bytes, 0, 0);
	return single ? [single] : [];
}

function detectSlicesAt(bytes: Uint8Array, headerOffset: number, sliceOffset: number): Slice | null {
	const rawLe = u32(bytes, headerOffset, true);
	const rawBe = u32(bytes, headerOffset, false);
	if (rawLe === 0xfeedface || rawLe === 0xfeedfacf) {
		return { offset: sliceOffset, size: bytes.byteLength - sliceOffset, littleEndian: true, bits: rawLe === 0xfeedfacf ? 64 : 32 };
	}
	if (rawBe === 0xfeedface || rawBe === 0xfeedfacf) {
		return { offset: sliceOffset, size: bytes.byteLength - sliceOffset, littleEndian: false, bits: rawBe === 0xfeedfacf ? 64 : 32 };
	}
	return null;
}

export function looksLikeMacho(bytes: Uint8Array): boolean {
	if (bytes.byteLength < 8) return false;
	const be = u32(bytes, 0, false);
	const le = u32(bytes, 0, true);
	return be === FAT_MAGIC || be === 0xfeedface || be === 0xfeedfacf || le === 0xfeedface || le === 0xfeedfacf;
}

export function parseMacho(bytes: Uint8Array): Parsed<NativeFacts> {
	try {
		if (!looksLikeMacho(bytes)) return failed("not a Mach-O image");
		const slices = detectSlices(bytes);
		if (slices.length === 0) return failed("unrecognised Mach-O magic");
		const slice = slices[0]!;
		const header = slice.offset;
		const headerSize = slice.bits === 64 ? 32 : 28;
		const cputype = i32(bytes, header + 4, slice.littleEndian);
		const fileType = readU32(bytes, header + 12, slice.littleEndian);
		const ncmds = readU32(bytes, header + 16, slice.littleEndian);
		const flags = readU32(bytes, header + 24, slice.littleEndian);

		const sections: NativeSection[] = [];
		const libraries: string[] = [];
		const imports: NativeImportGroup[] = [];
		let pieceOffset = header + headerSize;
		let entryPoint = 0;

		for (let index = 0; index < Math.min(ncmds, 512); index += 1) {
			const cmd = readU32(bytes, pieceOffset, slice.littleEndian);
			const cmdsize = readU32(bytes, pieceOffset + 4, slice.littleEndian);
			if (cmdsize < 8) break;
			if (cmd === LC_SEGMENT_64 || cmd === LC_SEGMENT) {
				const is64 = cmd === LC_SEGMENT_64;
				const segmentName = cstring(bytes, pieceOffset + 8, 16);
				const initProt = readU32(bytes, pieceOffset + (is64 ? 60 : 44), slice.littleEndian);
				const sectionCount = readU32(bytes, pieceOffset + (is64 ? 64 : 48), slice.littleEndian);
				const sectionSize = is64 ? 80 : 68;
				const sectionBase = pieceOffset + (is64 ? 72 : 56);
				for (let sectionIndex = 0; sectionIndex < Math.min(sectionCount, 64); sectionIndex += 1) {
					const base = sectionBase + sectionIndex * sectionSize;
					const name = cstring(bytes, base, 16);
					const size = is64 ? readU64(bytes, base + 40, slice.littleEndian) : readU32(bytes, base + 36, slice.littleEndian);
					const addr = is64 ? readU64(bytes, base + 32, slice.littleEndian) : readU32(bytes, base + 32, slice.littleEndian);
					const fileOffset = readU32(bytes, base + (is64 ? 48 : 40), slice.littleEndian);
					const sectionFlags = readU32(bytes, base + (is64 ? 64 : 56), slice.littleEndian);
					const type = sectionFlags & SECTION_TYPE_MASK;
					sections.push({
						name: `${segmentName},${name}`,
						size,
						entropy: type === 0x1 || type === 0xc || type === 0x12 ? 0 : entropyOfRange(bytes, slice.offset + fileOffset, size, 128 * 1024),
						executable: (sectionFlags & (S_ATTR_PURE_INSTRUCTIONS | S_ATTR_SOME_INSTRUCTIONS)) !== 0 || (initProt & VM_PROT_EXECUTE) !== 0,
						writable: (initProt & VM_PROT_WRITE) !== 0,
						offset: slice.offset + fileOffset,
						vaddr: addr,
					});
				}
			} else {
				const kind = cmd & 0x7fffffff;
				if (cmd === LC_MAIN) entryPoint = readU64(bytes, pieceOffset + 8, slice.littleEndian);
				if (kind === 0xc || kind === 0xd || kind === 0x18 || kind === 0x1f || kind === 0x20 || kind === 0x23) {
					const nameOffset = readU32(bytes, pieceOffset + 8, slice.littleEndian);
					const name = cstring(bytes, pieceOffset + nameOffset, 512);
					if (name) libraries.push(name.split("/").pop() ?? name);
				}
			}
			pieceOffset += cmdsize;
		}

		const multiSlice = slices.length > 1;
		const facts: NativeFacts = {
			format: "macho",
			arch: MACHO_CPUS[cputype] ?? `cpu-${cputype}`,
			bits: slice.bits,
			endianness: slice.littleEndian ? "little" : "big",
			kind: FILE_TYPES[fileType] ?? `filetype-${fileType}`,
			entryPoint,
			// LC_MAIN 的 entryoff 是相对 __TEXT 段文件偏移的，加上切片偏移才是真实文件偏移。
			entryOffset: entryPoint === 0 ? null : slice.offset + entryPoint,
			pie: (flags & MH_PIE) !== 0,
			executableStack: (flags & MH_ALLOW_STACK_EXECUTION) !== 0,
			nxCompat: null,
			signed: null,
			stripped: null,
			dotnet: false,
			interpreter: null,
			sections,
			imports,
			libraries,
			notes: [multiSlice ? `${slices.length} architecture slices, first slice analysed` : `single ${slice.bits}-bit slice, ${slice.size} bytes`],
		};
		return parsed(facts, facts.notes);
	} catch (error) {
		return failed(`Mach-O parse failed: ${describeError(error)}`);
	}
}
