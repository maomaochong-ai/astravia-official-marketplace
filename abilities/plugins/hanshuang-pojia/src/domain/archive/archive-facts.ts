/**
 * 容器层的体检事实：条目统计、嵌入的原生库、签名块的结构性读取。
 *
 * 这里**不做密码学校验**：v2/v3 只记 APK Signing Block 里出现了哪些 id，
 * 真正的裁决在宿主的 apksigner，报告里两层必须分开写。
 */

import type { ZipIndex } from "./zip";

export interface NativeLibrary {
	path: string;
	abi: string;
	name: string;
	size: number;
}

export interface ArchiveFacts {
	entryCount: number;
	totalUncompressed: number;
	storedEntries: number;
	dexEntries: string[];
	nativeLibraries: NativeLibrary[];
	abis: string[];
	assetEntries: number;
	resourceTable: boolean;
	unsafePaths: string[];
	duplicateNames: string[];
	embeddedExecutables: string[];
	largestEntry: { name: string; size: number } | null;
}

const EXECUTABLE_SUFFIX = /\.(exe|dll|so|dylib|elf|bin|dex|jar|apk|xapk|zip|7z)$/i;

export function summarizeArchive(index: ZipIndex): ArchiveFacts {
	let totalUncompressed = 0;
	let storedEntries = 0;
	let assetEntries = 0;
	const seen = new Map<string, number>();
	const duplicateNames: string[] = [];
	const unsafePaths: string[] = [];
	const embeddedExecutables: string[] = [];
	const nativeLibraries: NativeLibrary[] = [];
	const dexEntries: string[] = [];
	const abis = new Set<string>();
	let largestEntry: { name: string; size: number } | null = null;

	for (const entry of index.entries) {
		totalUncompressed += entry.uncompressedSize;
		if (entry.method === 0 && !entry.isDirectory) storedEntries += 1;
		if (/^assets\//.test(entry.name)) assetEntries += 1;

		const count = (seen.get(entry.name) ?? 0) + 1;
		seen.set(entry.name, count);
		if (count === 2) duplicateNames.push(entry.name);

		if (entry.name.startsWith("/") || entry.name.includes("../") || /^[a-zA-Z]:\\/.test(entry.name)) unsafePaths.push(entry.name);

		if (/^classes\d*\.dex$/.test(entry.name) || /^base\/dex\/classes\d*\.dex$/.test(entry.name)) dexEntries.push(entry.name);

		const library = /^lib\/([^/]+)\/([^/]+\.so)$/.exec(entry.name);
		if (library) {
			abis.add(library[1]!);
			nativeLibraries.push({ path: entry.name, abi: library[1]!, name: library[2]!, size: entry.uncompressedSize });
		}

		if ((/^(assets|res\/raw)\//.test(entry.name) || !entry.name.includes("/")) && EXECUTABLE_SUFFIX.test(entry.name) && !library) {
			embeddedExecutables.push(entry.name);
		}

		if (!entry.isDirectory && (!largestEntry || entry.uncompressedSize > largestEntry.size)) {
			largestEntry = { name: entry.name, size: entry.uncompressedSize };
		}
	}

	return {
		entryCount: index.entries.length,
		totalUncompressed,
		storedEntries,
		dexEntries,
		nativeLibraries,
		abis: Array.from(abis).sort(),
		assetEntries,
		resourceTable: index.entries.some(entry => entry.name === "resources.arsc"),
		unsafePaths: unsafePaths.slice(0, 10),
		duplicateNames: duplicateNames.slice(0, 10),
		embeddedExecutables: embeddedExecutables.slice(0, 10),
		largestEntry,
	};
}

/** APK Signing Block 的 v2 / v3 标记位；v1 靠 META-INF 里的签名文件判断。 */
export interface SignatureFacts {
	v1: boolean;
	v2: boolean;
	v3: boolean;
	schemes: string[];
}

const APK_SIG_BLOCK_MAGIC = "APK Sig Block 42";
const SCHEME_V2 = 0x7109871a;
const SCHEME_V3 = 0xf05368c0;
const SCHEME_V31 = 0x1b93ad61;

export function readSignatureFacts(bytes: Uint8Array, index: ZipIndex): SignatureFacts {
	const hasV1 =
		index.entries.some(entry => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(entry.name)) &&
		index.entries.some(entry => /^META-INF\/[^/]+\.SF$/i.test(entry.name));

	let v2 = false;
	let v3 = false;
	const cd = index.centralDirectoryOffset;
	if (cd >= 32 && cd <= bytes.byteLength) {
		const magic = new TextDecoder("latin1").decode(bytes.subarray(cd - 16, cd));
		if (magic === APK_SIG_BLOCK_MAGIC) {
			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const blockSize = Number(view.getBigUint64(cd - 24, true));
			const blockStart = cd - blockSize - 8;
			if (blockStart >= 0 && blockStart < cd) {
				let cursor = blockStart + 8;
				while (cursor + 12 <= cd - 24) {
					const pairLength = Number(view.getBigUint64(cursor, true));
					if (pairLength <= 0 || cursor + 8 + pairLength > cd) break;
					const id = view.getUint32(cursor + 8, true);
					if (id === SCHEME_V2) v2 = true;
					if (id === SCHEME_V3 || id === SCHEME_V31) v3 = true;
					cursor += 8 + pairLength;
				}
			}
		}
	}

	const schemes: string[] = [];
	if (hasV1) schemes.push("v1");
	if (v2) schemes.push("v2");
	if (v3) schemes.push("v3");
	return { v1: hasV1, v2, v3, schemes };
}
