/**
 * Minimal ZIP reader for OOXML containers (.docx / .xlsx).
 *
 * The browser gives us Uint8Array but no file-system access, and the plugin must
 * stay dependency-free on binary formats, so the central directory is parsed by
 * hand: only stored (0) and deflate (8) entries are accepted, encrypted entries
 * are rejected, and every size is bounded by the caller.
 */


export class ZipError extends Error {
	constructor(
		message: string,
		readonly reason: "format" | "encrypted" | "unsupported" | "missing",
	) {
		super(message);
		this.name = "ZipError";
	}
}

export interface ZipEntry {
	name: string;
	compressedSize: number;
	uncompressedSize: number;
	method: number;
	dataOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** Guard against zip bombs and crafted offsets. */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

function u16(view: DataView, offset: number): number {
	return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
	return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
	const min = Math.max(0, view.byteLength - 0xffff - 22);
	for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
		if (u32(view, offset) === EOCD_SIGNATURE) return offset;
	}
	throw new ZipError("Not a ZIP container: end of central directory not found", "format");
}

/** Entries in the archive, in central-directory order. */
export function listEntries(bytes: Uint8Array): ZipEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(view);
	const count = u16(view, eocd + 10);
	let offset = u32(view, eocd + 16);
	const entries: ZipEntry[] = [];
	const decoder = new TextDecoder();

	for (let index = 0; index < count; index += 1) {
		if (offset + 46 > view.byteLength || u32(view, offset) !== CENTRAL_SIGNATURE) {
			throw new ZipError("Corrupt ZIP central directory", "format");
		}
		const flags = u16(view, offset + 8);
		const method = u16(view, offset + 10);
		const compressedSize = u32(view, offset + 20);
		const uncompressedSize = u32(view, offset + 24);
		const nameLength = u16(view, offset + 28);
		const extraLength = u16(view, offset + 30);
		const commentLength = u16(view, offset + 32);
		const localOffset = u32(view, offset + 42);
		const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
		offset += 46 + nameLength + extraLength + commentLength;

		if (flags & 0x0001) {
			throw new ZipError(`Encrypted ZIP entry is not supported: ${name}`, "encrypted");
		}
		if (method !== 0 && method !== 8) {
			throw new ZipError(`Unsupported ZIP compression method ${method} for ${name}`, "unsupported");
		}
		if (uncompressedSize > MAX_ENTRY_BYTES) {
			throw new ZipError(`ZIP entry is too large: ${name}`, "unsupported");
		}
		if (localOffset + 30 > view.byteLength || u32(view, localOffset) !== LOCAL_SIGNATURE) {
			throw new ZipError(`Corrupt ZIP local header for ${name}`, "format");
		}
		const localNameLength = u16(view, localOffset + 26);
		const localExtraLength = u16(view, localOffset + 28);
		entries.push({
			name,
			compressedSize,
			uncompressedSize,
			method,
			dataOffset: localOffset + 30 + localNameLength + localExtraLength,
		});
	}
	return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}

/** Raw bytes of one entry. */
export async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
	const slice = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
	const raw = entry.method === 0 ? slice : await inflateRaw(slice);
	return raw.subarray(0, entry.uncompressedSize || raw.byteLength);
}

/** UTF-8 text of one entry, or `null` when the archive does not contain it. */
export async function readText(bytes: Uint8Array, name: string): Promise<string | null> {
	const entry = listEntries(bytes).find((candidate) => candidate.name === name);
	if (!entry) return null;
	const data = await readEntry(bytes, entry);
	return new TextDecoder("utf-8").decode(data);
}

export function entryNames(bytes: Uint8Array): string[] {
	return listEntries(bytes).map((entry) => entry.name);
}
