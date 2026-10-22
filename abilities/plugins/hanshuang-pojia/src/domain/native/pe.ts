import { cstring, u16, u32, u64 } from "../bytes";
import { entropyOfRange } from "../entropy";
import { describeError, failed, parsed, PE_MACHINES, type NativeFacts, type NativeImportGroup, type NativeSection, type Parsed } from "./types";

const IMAGE_FILE_DLL = 0x2000;
const IMAGE_FILE_RELOCS_STRIPPED = 0x1;
const DYNAMIC_BASE = 0x0040;
const NX_COMPAT = 0x0100;
const SCN_MEM_EXECUTE = 0x20000000;
const SCN_MEM_WRITE = 0x80000000;

interface PeSectionHeader {
	name: string;
	virtualAddress: number;
	virtualSize: number;
	rawSize: number;
	rawPointer: number;
	characteristics: number;
}

function alignUp(value: number, alignment: number): number {
	return Math.ceil(value / alignment) * alignment;
}

export function looksLikePe(bytes: Uint8Array): boolean {
	if (bytes.byteLength < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return false;
	try {
		const offset = u32(bytes, 0x3c);
		return bytes[offset] === 0x50 && bytes[offset + 1] === 0x45 && bytes[offset + 2] === 0 && bytes[offset + 3] === 0;
	} catch {
		return false;
	}
}

function rvaToOffset(rva: number, sections: readonly PeSectionHeader[], headersSize: number): number | null {
	if (rva < headersSize) return rva;
	for (const section of sections) {
		const span = Math.max(section.virtualSize, section.rawSize);
		if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
			const delta = rva - section.virtualAddress;
			if (delta >= section.rawSize) return null;
			return section.rawPointer + delta;
		}
	}
	return null;
}

export function parsePe(bytes: Uint8Array): Parsed<NativeFacts> {
	try {
		if (!looksLikePe(bytes)) return failed("not a PE image");
		const peOffset = u32(bytes, 0x3c);
		const coff = peOffset + 4;
		const machine = u16(bytes, coff);
		const sectionCount = u16(bytes, coff + 2);
		const optionalSize = u16(bytes, coff + 16);
		const characteristics = u16(bytes, coff + 18);
		const optional = coff + 20;
		const magic = u16(bytes, optional);
		const plus = magic === 0x20b;
		const bits: 32 | 64 = plus ? 64 : 32;
		const entryPoint = u32(bytes, optional + 16);
		const imageBase = plus ? u64(bytes, optional + 24) : u32(bytes, optional + 28);
		const dllCharacteristics = u16(bytes, optional + 70);
		const directoryCount = u32(bytes, optional + (plus ? 108 : 92));
		const directoryBase = optional + (plus ? 112 : 96);
		const directory = (index: number): { rva: number; size: number } => {
			if (index >= directoryCount) return { rva: 0, size: 0 };
			return { rva: u32(bytes, directoryBase + index * 8), size: u32(bytes, directoryBase + index * 8 + 4) };
		};

		const sections: PeSectionHeader[] = [];
		const sectionTable = optional + optionalSize;
		for (let index = 0; index < Math.min(sectionCount, 96); index += 1) {
			const base = sectionTable + index * 40;
			sections.push({
				name: cstring(bytes, base, 8),
				virtualSize: u32(bytes, base + 8),
				virtualAddress: u32(bytes, base + 12),
				rawSize: u32(bytes, base + 16),
				rawPointer: u32(bytes, base + 20),
				characteristics: u32(bytes, base + 36),
			});
		}
		const headersSize = alignUp(optional + optionalSize + sectionCount * 40, 0x200);

		const nativeSections: NativeSection[] = sections.map(section => ({
			name: section.name,
			size: section.rawSize,
			entropy: entropyOfRange(bytes, section.rawPointer, section.rawSize, 128 * 1024),
			executable: (section.characteristics & SCN_MEM_EXECUTE) !== 0,
			writable: (section.characteristics & SCN_MEM_WRITE) !== 0,
			// PE 的 vaddr 域统一用 RVA：符号表、导出表和 AddressOfEntryPoint 都是 RVA。
			offset: section.rawPointer,
			vaddr: section.virtualAddress,
		}));

		const imports: NativeImportGroup[] = [];
		const libraries: string[] = [];
		const importDirectory = directory(1);
		if (importDirectory.rva > 0) {
			let descriptorOffset = rvaToOffset(importDirectory.rva, sections, headersSize);
			for (let guard = 0; descriptorOffset !== null && guard < 64; guard += 1) {
				const nameRva = u32(bytes, descriptorOffset + 12);
				const firstThunk = u32(bytes, descriptorOffset + 16);
				if (nameRva === 0 && firstThunk === 0) break;
				const nameOffset = rvaToOffset(nameRva, sections, headersSize);
				const library = nameOffset === null ? `<rva 0x${nameRva.toString(16)}>` : cstring(bytes, nameOffset, 260);
				libraries.push(library);
				const functions: string[] = [];
				const thunkRva = u32(bytes, descriptorOffset) || firstThunk;
				let thunkOffset = rvaToOffset(thunkRva, sections, headersSize);
				for (let slot = 0; thunkOffset !== null && slot < 64; slot += 1) {
					const value = plus ? u64(bytes, thunkOffset + slot * 8) : u32(bytes, thunkOffset + slot * 4);
					if (value === 0) break;
					const ordinalMask = plus ? 0x8000000000000000 : 0x80000000;
					if (value >= ordinalMask) {
						functions.push(`#${value & 0xffff}`);
						continue;
					}
					const hintOffset = rvaToOffset(value, sections, headersSize);
					functions.push(hintOffset === null ? `<rva 0x${value.toString(16)}>` : cstring(bytes, hintOffset + 2, 128));
				}
				imports.push({ library, functions });
				descriptorOffset = descriptorOffset + 20;
			}
		}

		const clr = directory(14);
		const signing = directory(4);
		const facts: NativeFacts = {
			format: "pe",
			arch: PE_MACHINES[machine] ?? `machine-0x${machine.toString(16)}`,
			bits,
			endianness: "little",
			kind: characteristics & IMAGE_FILE_DLL ? "dll" : "executable",
			entryPoint,
			entryOffset: rvaToOffset(entryPoint, sections, headersSize),
			pie: (dllCharacteristics & DYNAMIC_BASE) !== 0,
			executableStack: null,
			nxCompat: (dllCharacteristics & NX_COMPAT) !== 0,
			signed: signing.size > 0 && signing.rva > 0,
			stripped: (characteristics & IMAGE_FILE_RELOCS_STRIPPED) !== 0 ? true : null,
			dotnet: clr.rva > 0 && clr.size > 0,
			interpreter: null,
			sections: nativeSections,
			imports,
			libraries,
			notes: [`image base 0x${imageBase.toString(16)}`],
		};
		return parsed(facts, facts.notes);
	} catch (error) {
		return failed(`PE parse failed: ${describeError(error)}`);
	}
}
