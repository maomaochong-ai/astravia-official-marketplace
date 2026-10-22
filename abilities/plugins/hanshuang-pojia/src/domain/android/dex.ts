import { u32, u8 } from "../bytes";

export interface DexFacts {
	version: string;
	stringCount: number;
	typeCount: number;
	methodCount: number;
	classCount: number;
	/** 去重后的字符串样本，供 API 指纹与关键字检索使用。 */
	strings: string[];
	truncated: boolean;
}

const MAX_STRINGS = 60000;
const MAX_STRING_LENGTH = 512;

export function looksLikeDex(bytes: Uint8Array): boolean {
	return (
		bytes.byteLength >= 0x70 &&
		bytes[0] === 0x64 &&
		bytes[1] === 0x65 &&
		bytes[2] === 0x78 &&
		bytes[3] === 0x0a &&
		bytes[7] === 0x00
	);
}

/** MUTF-8 与 UTF-8 在 BMP 范围内一致，代理对在应用层不会出现（DEX 用 \u0000 转义）。 */
function readMutf8(bytes: Uint8Array, start: number, length: number): string {
	const end = Math.min(bytes.byteLength, start + length);
	const pairs: number[] = [];
	for (let index = start; index < end; index += 1) {
		const byte = bytes[index]!;
		if (byte === 0xc0 && bytes[index + 1] === 0x80) {
			pairs.push(0);
			index += 1;
			continue;
		}
		pairs.push(byte);
	}
	try {
		return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(pairs));
	} catch {
		return "";
	}
}

export function readUleb128(bytes: Uint8Array, start: number): { value: number; next: number } {
	let value = 0;
	let shift = 0;
	let cursor = start;
	for (let index = 0; index < 5; index += 1) {
		const byte = bytes[cursor] ?? 0;
		cursor += 1;
		value |= (byte & 0x7f) << shift;
		if ((byte & 0x80) === 0) break;
		shift += 7;
	}
	return { value: value >>> 0, next: cursor };
}

/** 读取 string_ids 指向的一条 MUTF-8 字符串；越界或超长返回空串。 */
export function readDexString(bytes: Uint8Array, dataOffset: number, maxLength = MAX_STRING_LENGTH): string {
	if (dataOffset + 2 >= bytes.byteLength) return "";
	const { value: length, next } = readUleb128(bytes, dataOffset);
	if (length === 0 || length > maxLength) return "";
	return readMutf8(bytes, next, length);
}

export function parseDex(bytes: Uint8Array, options: { maxStrings?: number } = {}): DexFacts {
	const maxStrings = options.maxStrings ?? MAX_STRINGS;
	const version = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!);
	const stringCount = u32(bytes, 56);
	const stringIdsOffset = u32(bytes, 60);
	const typeCount = u32(bytes, 64);
	const methodCount = u32(bytes, 88);
	const classCount = u32(bytes, 96);
	const strings: string[] = [];
	let truncated = false;

	for (let index = 0; index < Math.min(stringCount, maxStrings); index += 1) {
		const dataOffset = u32(bytes, stringIdsOffset + index * 4);
		const value = readDexString(bytes, dataOffset);
		if (value.length > 0) strings.push(value);
	}
	if (stringCount > maxStrings) truncated = true;

	return { version, stringCount, typeCount, methodCount, classCount, strings, truncated };
}

/** 多个 dex（classes.dex…classesN.dex）合并，保留前 N 个字符串避免报告膨胀。 */
export function mergeDexFacts(list: readonly DexFacts[], options: { maxStrings?: number } = {}): DexFacts {
	const maxStrings = options.maxStrings ?? MAX_STRINGS;
	const seen = new Set<string>();
	const strings: string[] = [];
	let truncated = list.some(item => item.truncated);
	for (const item of list) {
		for (const value of item.strings) {
			if (seen.has(value)) continue;
			seen.add(value);
			if (strings.length >= maxStrings) {
				truncated = true;
				break;
			}
			strings.push(value);
		}
	}
	return {
		version: list[0]?.version ?? "035",
		stringCount: list.reduce((sum, item) => sum + item.stringCount, 0),
		typeCount: list.reduce((sum, item) => sum + item.typeCount, 0),
		methodCount: list.reduce((sum, item) => sum + item.methodCount, 0),
		classCount: list.reduce((sum, item) => sum + item.classCount, 0),
		strings,
		truncated,
	};
}

export function dexSignature(bytes: Uint8Array): string {
	let out = "";
	for (let index = 12; index < 32; index += 1) out += u8(bytes, index).toString(16).padStart(2, "0");
	return out;
}
