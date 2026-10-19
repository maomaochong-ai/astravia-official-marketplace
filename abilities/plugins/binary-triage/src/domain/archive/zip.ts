import { decodeUtf8, u16, u32, u64 } from "../bytes";

export interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
	crc32: number;
	isDirectory: boolean;
}

export interface ZipIndex {
	entries: ZipEntry[];
	centralDirectoryOffset: number;
	comment: string;
	zip64: boolean;
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_ENTRIES = 20000;

export function looksLikeZip(bytes: Uint8Array): boolean {
	if (bytes.byteLength < 4) return false;
	if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) return true;
	return findEndOfCentralDirectory(bytes) >= 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
	if (bytes.byteLength < EOCD_MIN_SIZE) return -1;
	const lowest = Math.max(0, bytes.byteLength - 65557);
	for (let offset = bytes.byteLength - EOCD_MIN_SIZE; offset >= lowest; offset -= 1) {
		if (u32(bytes, offset) === EOCD_SIGNATURE) {
			const commentLength = u16(bytes, offset + 20);
			if (offset + EOCD_MIN_SIZE + commentLength <= bytes.byteLength) return offset;
		}
	}
	return -1;
}

export function readZipIndex(bytes: Uint8Array): ZipIndex {
	const eocd = findEndOfCentralDirectory(bytes);
	if (eocd < 0) throw new Error("ZIP end-of-central-directory record not found");
	let entryCount = u16(bytes, eocd + 10);
	let centralDirectoryOffset = u32(bytes, eocd + 16);
	const commentLength = u16(bytes, eocd + 20);
	const comment = commentLength > 0 ? decodeUtf8(bytes.subarray(eocd + EOCD_MIN_SIZE, eocd + EOCD_MIN_SIZE + commentLength)) : "";
	let zip64 = false;

	if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
		const locator = eocd - 20;
		if (locator >= 0 && u32(bytes, locator) === ZIP64_LOCATOR_SIGNATURE) {
			const zip64Eocd = u64(bytes, locator + 8);
			if (u32(bytes, zip64Eocd) === ZIP64_EOCD_SIGNATURE) {
				entryCount = u64(bytes, zip64Eocd + 32);
				centralDirectoryOffset = u64(bytes, zip64Eocd + 48);
				zip64 = true;
			}
		}
	}

	const entries: ZipEntry[] = [];
	let cursor = centralDirectoryOffset;
	for (let index = 0; index < Math.min(entryCount, MAX_ENTRIES); index += 1) {
		if (u32(bytes, cursor) !== CENTRAL_SIGNATURE) break;
		const method = u16(bytes, cursor + 10);
		const crc32 = u32(bytes, cursor + 16);
		let compressedSize = u32(bytes, cursor + 20);
		let uncompressedSize = u32(bytes, cursor + 24);
		const nameLength = u16(bytes, cursor + 28);
		const extraLength = u16(bytes, cursor + 30);
		const commentSize = u16(bytes, cursor + 32);
		let localHeaderOffset = u32(bytes, cursor + 42);
		const name = decodeUtf8(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

		if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
			const extra = parseZip64Extra(bytes, cursor + 46 + nameLength, extraLength, {
				uncompressedSize: uncompressedSize === 0xffffffff,
				compressedSize: compressedSize === 0xffffffff,
				localHeaderOffset: localHeaderOffset === 0xffffffff,
			});
			uncompressedSize = extra.uncompressedSize ?? uncompressedSize;
			compressedSize = extra.compressedSize ?? compressedSize;
			localHeaderOffset = extra.localHeaderOffset ?? localHeaderOffset;
			zip64 = true;
		}

		entries.push({
			name,
			method,
			compressedSize,
			uncompressedSize,
			localHeaderOffset,
			crc32,
			isDirectory: name.endsWith("/"),
		});
		cursor += 46 + nameLength + extraLength + commentSize;
	}

	return { entries, centralDirectoryOffset, comment, zip64 };
}

function parseZip64Extra(
	bytes: Uint8Array,
	start: number,
	length: number,
	needs: { uncompressedSize: boolean; compressedSize: boolean; localHeaderOffset: boolean },
): { uncompressedSize?: number; compressedSize?: number; localHeaderOffset?: number } {
	let cursor = start;
	const end = start + length;
	while (cursor + 4 <= end) {
		const id = u16(bytes, cursor);
		const size = u16(bytes, cursor + 2);
		if (id === 0x0001) {
			let field = cursor + 4;
			const out: { uncompressedSize?: number; compressedSize?: number; localHeaderOffset?: number } = {};
			if (needs.uncompressedSize) {
				out.uncompressedSize = u64(bytes, field);
				field += 8;
			}
			if (needs.compressedSize) {
				out.compressedSize = u64(bytes, field);
				field += 8;
			}
			if (needs.localHeaderOffset) out.localHeaderOffset = u64(bytes, field);
			return out;
		}
		cursor += 4 + size;
	}
	return {};
}

export function findZipEntry(index: ZipIndex, name: string): ZipEntry | undefined {
	return index.entries.find(entry => entry.name === name);
}

export function findZipEntries(index: ZipIndex, predicate: (name: string) => boolean): ZipEntry[] {
	return index.entries.filter(entry => predicate(entry.name));
}

const MAX_INFLATE_BYTES = 64 * 1024 * 1024;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
	const Decompressor = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
	if (typeof Decompressor !== "function") throw new Error("deflate-raw decompression is unavailable in this runtime");
	const stream = new Blob([data as BlobPart]).stream().pipeThrough(new Decompressor("deflate-raw"));
	const buffer = await new Response(stream).arrayBuffer();
	if (buffer.byteLength > MAX_INFLATE_BYTES) throw new Error("entry inflates beyond the analysis limit");
	return new Uint8Array(buffer);
}

/** 解出单个条目。用于 AndroidManifest.xml / classes.dex 这类必须读内容的入口。 */
export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
	if (entry.uncompressedSize > MAX_INFLATE_BYTES) throw new Error(`${entry.name} is larger than the analysis limit`);
	const local = entry.localHeaderOffset;
	if (u32(bytes, local) !== LOCAL_SIGNATURE) throw new Error(`bad local header for ${entry.name}`);
	const nameLength = u16(bytes, local + 26);
	const extraLength = u16(bytes, local + 28);
	const dataStart = local + 30 + nameLength + extraLength;
	const dataEnd = dataStart + entry.compressedSize;
	if (dataEnd > bytes.byteLength) throw new Error(`${entry.name} is truncated`);
	const raw = bytes.subarray(dataStart, dataEnd);
	if (entry.method === 0) return raw.slice();
	if (entry.method === 8) return inflateRaw(raw);
	throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
}
