/**
 * 测试夹具构造器：手工拼出 ZIP / AXML / DEX / ELF / PE / Mach-O，
 * 让解析器测试不依赖开发机上的真实样本。
 */

export function concat(parts: readonly Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const out = new Uint8Array(total);
	let cursor = 0;
	for (const part of parts) {
		out.set(part, cursor);
		cursor += part.byteLength;
	}
	return out;
}

export function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

export function u16le(value: number): Uint8Array {
	const out = new Uint8Array(2);
	new DataView(out.buffer).setUint16(0, value & 0xffff, true);
	return out;
}

export function u32le(value: number): Uint8Array {
	const out = new Uint8Array(4);
	new DataView(out.buffer).setUint32(0, value >>> 0, true);
	return out;
}

export function u64le(value: number): Uint8Array {
	const out = new Uint8Array(8);
	new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
	return out;
}

function padTo(value: number, alignment: number): number {
	return (alignment - (value % alignment)) % alignment;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let entry = index;
		for (let bit = 0; bit < 8; bit += 1) entry = entry & 1 ? 0xedb88320 ^ (entry >>> 1) : entry >>> 1;
		table[index] = entry >>> 0;
	}
	return table;
})();

export function crc32(bytes: Uint8Array): number {
	let value = 0xffffffff;
	for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
	return (value ^ 0xffffffff) >>> 0;
}

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface ZipInputEntry {
	name: string;
	data: Uint8Array;
	/** 8 表示 deflate；调用方需先 deflateRaw 并传入压缩后的字节。 */
	method?: 0 | 8;
	/** 未压缩大小；method 8 时必须给，否则等于 data.byteLength。 */
	uncompressedSize?: number;
}

export function buildZip(entries: readonly ZipInputEntry[]): Uint8Array {
	const local: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = utf8(entry.name);
		const method = entry.method ?? 0;
		const uncompressedSize = entry.uncompressedSize ?? entry.data.byteLength;
		const crc = crc32(entry.data);
		const localHeader = concat([
			u32le(0x04034b50),
			u16le(20),
			u16le(0),
			u16le(method),
			u16le(0),
			u16le(0),
			u32le(crc),
			u32le(entry.data.byteLength),
			u32le(uncompressedSize),
			u16le(name.byteLength),
			u16le(0),
			name,
		]);
		local.push(localHeader, entry.data);
		central.push(
			concat([
				u32le(0x02014b50),
				u16le(20),
				u16le(20),
				u16le(0),
				u16le(method),
				u16le(0),
				u16le(0),
				u32le(crc),
				u32le(entry.data.byteLength),
				u32le(uncompressedSize),
				u16le(name.byteLength),
				u16le(0),
				u16le(0),
				u16le(0),
				u16le(0),
				u32le(0),
				u32le(offset),
				name,
			]),
		);
		offset += localHeader.byteLength + entry.data.byteLength;
	}

	const directory = concat(central);
	const eocd = concat([
		u32le(0x06054b50),
		u16le(0),
		u16le(0),
		u16le(entries.length),
		u16le(entries.length),
		u32le(directory.byteLength),
		u32le(offset),
		u16le(0),
	]);
	return concat([...local, directory, eocd]);
}

class StringPool {
	private readonly values: string[] = [];

	index(value: string): number {
		const existing = this.values.indexOf(value);
		if (existing >= 0) return existing;
		this.values.push(value);
		return this.values.length - 1;
	}

	all(): readonly string[] {
		return this.values;
	}
}

function buildStringPool(values: readonly string[]): Uint8Array {
	const header = concat([
		u16le(0x0001),
		u16le(28),
		new Uint8Array(4), // size 稍后回填
		u32le(values.length),
		u32le(0),
		u32le(0x100), // UTF8_FLAG
		new Uint8Array(4), // stringsStart 稍后回填
		u32le(0),
	]);

	const offsets: Uint8Array[] = [];
	const data: Uint8Array[] = [];
	let cursor = 0;
	for (const value of values) {
		const encoded = utf8(value);
		offsets.push(u32le(cursor));
		const lengthPrefix = encoded.byteLength < 0x80 ? new Uint8Array([encoded.byteLength]) : new Uint8Array([(encoded.byteLength >> 8) | 0x80, encoded.byteLength & 0x7f]);
		const chunk = concat([lengthPrefix, lengthPrefix, encoded, new Uint8Array([0])]);
		data.push(chunk);
		cursor += chunk.byteLength;
	}

	const offsetsBytes = concat(offsets);
	const dataBytes = concat(data);
	const stringsStart = 28 + offsetsBytes.byteLength;
	const total = stringsStart + dataBytes.byteLength + padTo(stringsStart + dataBytes.byteLength, 4);
	const chunk = new Uint8Array(total);
	chunk.set(header, 0);
	chunk.set(offsetsBytes, 28);
	chunk.set(dataBytes, stringsStart);
	const view = new DataView(chunk.buffer);
	view.setUint32(4, total, true);
	view.setUint32(20, stringsStart, true);
	return chunk;
}

export const ANDROID_NAMESPACE = "http://schemas.android.com/apk/res/android";

export type AxmlValueType = "string" | "bool" | "int";

export interface AxmlAttributeSpec {
	name: string;
	value: string;
	type?: AxmlValueType;
	android?: boolean;
}

export interface AxmlNodeSpec {
	name: string;
	attrs?: readonly AxmlAttributeSpec[];
	children?: readonly AxmlNodeSpec[];
}

const NO_INDEX = 0xffffffff;

/** 极简二进制 XML（AXML）编码器，只覆盖清单解析需要的 chunk 类型。 */
export function buildAxml(root: AxmlNodeSpec): Uint8Array {
	const pool = new StringPool();
	const androidNamespace = pool.index(ANDROID_NAMESPACE);

	interface EncodedNode {
		nameIndex: number;
		attributes: { namespace: number; nameIndex: number; type: AxmlValueType; value: string }[];
		children: EncodedNode[];
	}

	const encode = (spec: AxmlNodeSpec): EncodedNode => ({
		nameIndex: pool.index(spec.name),
		attributes: (spec.attrs ?? []).map(attribute => ({
			namespace: attribute.android ? androidNamespace : NO_INDEX,
			nameIndex: pool.index(attribute.name),
			type: attribute.type ?? "string",
			value: attribute.value,
		})),
		children: (spec.children ?? []).map(encode),
	});

	const encoded = encode(root);

	const chunks: Uint8Array[] = [];
	const emit = (node: EncodedNode): void => {
		const attributes = node.attributes.map(attribute => {
			const typed =
				attribute.type === "bool"
					? { type: 0x12, data: attribute.value === "true" || attribute.value === "1" ? 1 : 0 }
					: attribute.type === "int"
						? { type: 0x10, data: Number.parseInt(attribute.value, 10) >>> 0 }
						: { type: 0x03, data: pool.index(attribute.value) };
			return concat([
				u32le(attribute.namespace),
				u32le(attribute.nameIndex),
				u32le(NO_INDEX),
				u16le(8),
				new Uint8Array([0, typed.type]),
				u32le(typed.data),
			]);
		});
		const body = concat([
			u32le(NO_INDEX),
			u32le(node.nameIndex),
			u16le(20),
			u16le(20),
			u16le(node.attributes.length),
			u16le(0),
			u16le(0),
			u16le(0),
			...attributes,
		]);
		const size = 16 + body.byteLength;
		chunks.push(concat([u16le(0x0102), u16le(16), u32le(size), u32le(0), u32le(NO_INDEX), body]));
		for (const child of node.children) emit(child);
		const endSize = 24;
		chunks.push(concat([u16le(0x0103), u16le(16), u32le(endSize), u32le(0), u32le(NO_INDEX), u32le(NO_INDEX), u32le(node.nameIndex)]));
	};

	emit(encoded);

	const resources = concat([buildStringPool(pool.all()), ...chunks]);
	const total = 8 + resources.byteLength;
	return concat([u16le(0x0003), u16le(8), u32le(total), resources]);
}

/** 极简 DEX：只有 header + string_ids + 数据段，足够验证字符串与计数解析。 */
export function buildDex(strings: readonly string[], options: { version?: string; typeIds?: number; methodIds?: number; classDefs?: number } = {}): Uint8Array {
	const version = options.version ?? "035";
	const headerSize = 0x70;
	const stringIdsOffset = headerSize;
	const dataOffset = stringIdsOffset + strings.length * 4;

	const data: Uint8Array[] = [];
	const offsets: number[] = [];
	let cursor = 0;
	for (const value of strings) {
		const encoded = utf8(value);
		// MUTF-8 长度前缀用 uleb128；这里只支持 < 128 的字符串。
		const chunk = concat([new Uint8Array([encoded.byteLength & 0x7f]), encoded, new Uint8Array([0])]);
		offsets.push(cursor);
		data.push(chunk);
		cursor += chunk.byteLength;
	}

	const dataBytes = concat(data);
	const fileSize = dataOffset + dataBytes.byteLength;
	const out = new Uint8Array(fileSize);
	const view = new DataView(out.buffer);
	out.set([0x64, 0x65, 0x78, 0x0a, ...[...version].map(char => char.charCodeAt(0)), 0x00], 0);
	view.setUint32(32, fileSize, true);
	view.setUint32(36, headerSize, true);
	view.setUint32(40, 0x12345678, true);
	view.setUint32(56, strings.length, true);
	view.setUint32(60, stringIdsOffset, true);
	view.setUint32(64, options.typeIds ?? strings.length, true);
	view.setUint32(88, options.methodIds ?? 10, true);
	view.setUint32(96, options.classDefs ?? 3, true);
	view.setUint32(104, dataBytes.byteLength, true);
	view.setUint32(108, dataOffset, true);
	offsets.forEach((value, index) => view.setUint32(stringIdsOffset + index * 4, dataOffset + value, true));
	out.set(dataBytes, dataOffset);
	return out;
}

/** 最小可用 ELF64 x86-64 可执行体：三段节头（空 / .text / .shstrtab）。 */
export function buildElf(options: { entry?: number; executableStack?: boolean } = {}): Uint8Array {
	const shstrtab = concat([new Uint8Array([0]), utf8(".text\0.shstrtab\0")]);
	const textOffset = 64;
	const textBytes = new Uint8Array([0x55, 0x48, 0x89, 0xe5, 0xc3, 0x90, 0x90, 0x90]);
	const shstrtabOffset = textOffset + textBytes.byteLength;
	const sectionCount = 3;
	const sectionOffset = shstrtabOffset + shstrtab.byteLength + padTo(shstrtabOffset + shstrtab.byteLength, 8);
	const fileSize = sectionOffset + sectionCount * 64;
	const out = new Uint8Array(fileSize);
	const view = new DataView(out.buffer);

	out.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
	view.setUint16(16, 3, true); // ET_DYN（PIE）
	view.setUint16(18, 0x3e, true); // x86-64
	view.setUint32(20, 1, true);
	view.setBigUint64(24, BigInt(options.entry ?? 0x1040), true);
	view.setUint16(52, 64, true);
	view.setUint16(54, 56, true);
	view.setUint16(56, 0, true);
	view.setUint16(58, 64, true);
	view.setUint16(60, sectionCount, true);
	view.setUint16(62, 2, true);
	view.setBigUint64(40, BigInt(sectionOffset), true);
	out.set(textBytes, textOffset);
	out.set(shstrtab, shstrtabOffset);

	const writeSection = (index: number, name: number, type: number, flags: number, offset: number, size: number): void => {
		const base = sectionOffset + index * 64;
		view.setUint32(base, name, true);
		view.setUint32(base + 4, type, true);
		view.setBigUint64(base + 8, BigInt(flags), true);
		view.setBigUint64(base + 24, BigInt(offset), true);
		view.setBigUint64(base + 32, BigInt(size), true);
		view.setBigUint64(base + 48, BigInt(16), true);
	};
	writeSection(0, 0, 0, 0, 0, 0);
	writeSection(1, 1, 1, 0x6, textOffset, textBytes.byteLength);
	writeSection(2, 7, 3, 0, shstrtabOffset, shstrtab.byteLength);
	return out;
}

/** 带一条导入的最小 PE32+ 映像。 */
export function buildPe(): Uint8Array {
	const headersEnd = 0x200;
	const out = new Uint8Array(headersEnd + 0x200);
	const view = new DataView(out.buffer);

	out.set([0x4d, 0x5a], 0);
	view.setUint32(0x3c, 0x40, true);
	out.set([0x50, 0x45, 0x00, 0x00], 0x40);
	const coff = 0x44;
	view.setUint16(coff, 0x8664, true);
	view.setUint16(coff + 2, 1, true);
	view.setUint16(coff + 16, 0xf0, true);
	view.setUint16(coff + 18, 0x0022, true);
	const optional = coff + 20;
	view.setUint16(optional, 0x20b, true);
	view.setUint32(optional + 16, 0x1000, true);
	view.setBigUint64(optional + 24, 0x140000000n, true);
	view.setUint16(optional + 70, 0x0160, true);
	view.setUint32(optional + 108, 16, true);
	view.setUint32(optional + 112 + 8, 0x1000, true);
	view.setUint32(optional + 112 + 12, 20, true);

	const section = optional + 0xf0;
	out.set(utf8(".text"), section);
	view.setUint32(section + 8, 0x200, true);
	view.setUint32(section + 12, 0x1000, true);
	view.setUint32(section + 16, 0x200, true);
	view.setUint32(section + 20, 0x200, true);
	view.setUint32(section + 36, 0x60000020, true);

	const data = 0x200;
	view.setUint32(data + 12, 0x1060, true); // Name RVA
	view.setUint32(data + 16, 0x1040, true); // FirstThunk
	view.setBigUint64(data + 0x40, 0x1080n, true);
	view.setBigUint64(data + 0x48, 0n, true);
	out.set(utf8("KERNEL32.dll\0"), data + 0x60);
	view.setUint16(data + 0x80, 0, true);
	out.set(utf8("CreateFileW\0"), data + 0x82);
	return out;
}

/** 单切片 Mach-O 64 位动态库：LC_MAIN + LC_LOAD_DYLIB。 */
export function buildMacho(options: { entryOffset?: number; library?: string } = {}): Uint8Array {
	const library = `${options.library ?? "/usr/lib/libSystem.B.dylib"}\0`;
	const libraryPadded = library + "\0".repeat(padTo(24 + library.length, 8));
	const commands = concat([
		concat([u32le(0x80000028), u32le(24), u64le(options.entryOffset ?? 0x1a00), u64le(0)]),
		concat([u32le(0x0c), u32le(24 + libraryPadded.length), u32le(24), u32le(0), u32le(0x10000), u32le(0x10000), utf8(libraryPadded)]),
	]);
	const header = concat([
		u32le(0xfeedfacf),
		u32le(0x01000007),
		u32le(3),
		u32le(6),
		u32le(2),
		u32le(commands.byteLength),
		u32le(0x00200085),
		u32le(0),
	]);
	return concat([header, commands]);
}

/** 一段示例 APK：清单 + dex + v1 签名 + 一个原生库 + 一个明文口令形态的字符串。 */
export const APK_SECRET = "AKIAIOSFODNN7EXAMPLE";

export function buildApk(options: { withSignature?: boolean; withDex?: boolean } = {}): Uint8Array {
	const manifest = buildAxml({
		name: "manifest",
		attrs: [
			{ name: "package", value: "com.example.triage" },
			{ name: "versionName", value: "2.0" },
			{ name: "versionCode", value: "20", type: "int" },
		],
		children: [
			{
				name: "uses-sdk",
				attrs: [
					{ name: "minSdkVersion", value: "21", type: "int", android: true },
					{ name: "targetSdkVersion", value: "30", type: "int", android: true },
				],
			},
			{ name: "uses-permission", attrs: [{ name: "name", value: "android.permission.CAMERA", android: true }] },
			{ name: "uses-permission", attrs: [{ name: "name", value: "android.permission.READ_SMS", android: true }] },
			{
				name: "application",
				attrs: [
					{ name: "debuggable", value: "true", type: "bool", android: true },
					{ name: "allowBackup", value: "true", type: "bool", android: true },
					{ name: "usesCleartextTraffic", value: "true", type: "bool", android: true },
					{ name: "label", value: "Triage Demo", android: true },
				],
				children: [
					{
						name: "activity",
						attrs: [{ name: "name", value: ".MainActivity", android: true }],
						children: [
							{
								name: "intent-filter",
								children: [{ name: "action", attrs: [{ name: "name", value: "android.intent.action.MAIN", android: true }] }],
							},
						],
					},
					{ name: "service", attrs: [{ name: "name", value: ".SyncService", android: true }, { name: "exported", value: "true", type: "bool", android: true }] },
					{
						name: "provider",
						attrs: [
							{ name: "name", value: ".DataProvider", android: true },
							{ name: "exported", value: "true", type: "bool", android: true },
							{ name: "authorities", value: "com.example.triage.data", android: true },
						],
					},
				],
			},
		],
	});

	const entries: ZipInputEntry[] = [{ name: "AndroidManifest.xml", data: manifest }];
	if (options.withDex !== false) {
		entries.push({
			name: "classes.dex",
			data: buildDex(["Lcom/example/triage/MainActivity;", "https://api.example.com/v2/login", APK_SECRET, "Ljava/lang/Runtime;->exec"]),
		});
	}
	entries.push({ name: "lib/arm64-v8a/libnative.so", data: buildElf() });
	entries.push({ name: "resources.arsc", data: new Uint8Array(64) });
	if (options.withSignature !== false) {
		entries.push({ name: "META-INF/CERT.SF", data: utf8("Signature-Version: 1.0\n") });
		entries.push({ name: "META-INF/CERT.RSA", data: new Uint8Array(128) });
	}
	return buildZip(entries);
}

/* --------------------------------------------------- symbol-table fixtures */

function alignTo(value: number, alignment: number): number {
	return value + padTo(value, alignment);
}

function elf64Symbol(name: number, info: number, shndx: number, value: number): Uint8Array {
	return concat([u32le(name), new Uint8Array([info, 0]), u16le(shndx), u64le(value), u64le(0)]);
}

/** ELF64 带 .dynsym（一条导入 + 一条导出）与 .symtab（一条本地函数）。 */
export function buildElfWithSymbols(): Uint8Array {
	const text = new Uint8Array([0x55, 0x48, 0x89, 0xe5, 0xc3]);
	const dynstr = utf8("\0imported_fn\0exported_init\0");
	const strtab = utf8("\0local_helper\0");
	const dynsym = concat([new Uint8Array(24), elf64Symbol(1, 0x12, 0, 0), elf64Symbol(13, 0x12, 1, 0x1040)]);
	const symtab = concat([new Uint8Array(24), elf64Symbol(1, 0x02, 1, 0x1050)]);
	const shstrtab = utf8("\0.text\0.dynsym\0.dynstr\0.symtab\0.strtab\0.shstrtab\0");

	const parts: { offset: number; data: Uint8Array }[] = [];
	let cursor = 64;
	const place = (data: Uint8Array, alignment = 8): number => {
		cursor = alignTo(cursor, alignment);
		const offset = cursor;
		cursor += data.byteLength;
		parts.push({ offset, data });
		return offset;
	};
	const textOffset = place(text);
	const dynsymOffset = place(dynsym);
	const dynstrOffset = place(dynstr);
	const symtabOffset = place(symtab);
	const strtabOffset = place(strtab);
	const shstrtabOffset = place(shstrtab);
	const sectionOffset = alignTo(cursor, 8);
	const sectionCount = 7;
	const out = new Uint8Array(sectionOffset + sectionCount * 64);
	const view = new DataView(out.buffer);

	out.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
	view.setUint16(16, 3, true);
	view.setUint16(18, 0x3e, true);
	view.setUint32(20, 1, true);
	view.setBigUint64(24, 0x1040n, true);
	view.setUint16(52, 64, true);
	view.setUint16(54, 56, true);
	view.setUint16(58, 64, true);
	view.setUint16(60, sectionCount, true);
	view.setUint16(62, 6, true);
	view.setBigUint64(40, BigInt(sectionOffset), true);
	for (const part of parts) out.set(part.data, part.offset);

	const writeSection = (index: number, name: number, type: number, flags: number, offset: number, size: number, link: number, entsize: number): void => {
		const base = sectionOffset + index * 64;
		view.setUint32(base, name, true);
		view.setUint32(base + 4, type, true);
		view.setBigUint64(base + 8, BigInt(flags), true);
		view.setBigUint64(base + 24, BigInt(offset), true);
		view.setBigUint64(base + 32, BigInt(size), true);
		view.setUint32(base + 40, link, true);
		view.setBigUint64(base + 48, BigInt(16), true);
		view.setBigUint64(base + 56, BigInt(entsize), true);
	};
	writeSection(0, 0, 0, 0, 0, 0, 0, 0);
	writeSection(1, 1, 1, 0x6, textOffset, text.byteLength, 0, 0);
	writeSection(2, 7, 11, 0x2, dynsymOffset, dynsym.byteLength, 3, 24);
	writeSection(3, 15, 3, 0x2, dynstrOffset, dynstr.byteLength, 0, 0);
	writeSection(4, 23, 2, 0, symtabOffset, symtab.byteLength, 5, 24);
	writeSection(5, 31, 3, 0, strtabOffset, strtab.byteLength, 0, 0);
	writeSection(6, 39, 3, 0, shstrtabOffset, shstrtab.byteLength, 0, 0);
	return out;
}

/**
 * ELF64，`.text` 带真实 vaddr（0x1000）与按地址命名的符号。
 *
 * 前面的 `buildElfWithSymbols` 不写 sh_addr，符号地址落不进可执行段 —— 用来测符号表没问题，
 * 但函数级分析（指纹、边界推断）需要地址能真正映射回文件偏移，所以另建一个。
 */
export function buildElfWithAddressedText(code: Uint8Array, symbols: readonly { name: string; offset: number }[], base = 0x1000): Uint8Array {
	const names = ["\0", ...symbols.map(symbol => `${symbol.name}\0`)].join("");
	const strtab = utf8(names);
	const symtab = concat([
		new Uint8Array(24),
		...symbols.map(symbol => {
			const nameOffset = names.indexOf(`\0${symbol.name}\0`) + 1;
			return elf64Symbol(nameOffset, 0x12, 1, base + symbol.offset);
		}),
	]);
	const shstrtab = utf8("\0.text\0.symtab\0.strtab\0.shstrtab\0");

	const parts: { offset: number; data: Uint8Array }[] = [];
	let cursor = 64;
	const place = (data: Uint8Array, alignment = 8): number => {
		cursor = alignTo(cursor, alignment);
		const offset = cursor;
		cursor += data.byteLength;
		parts.push({ offset, data });
		return offset;
	};
	const textOffset = place(code);
	const symtabOffset = place(symtab);
	const strtabOffset = place(strtab);
	const shstrtabOffset = place(shstrtab);
	const sectionOffset = alignTo(cursor, 8);
	const sectionCount = 5;
	const out = new Uint8Array(sectionOffset + sectionCount * 64);
	const view = new DataView(out.buffer);

	out.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
	view.setUint16(16, 2, true);
	view.setUint16(18, 0x3e, true);
	view.setUint32(20, 1, true);
	view.setBigUint64(24, BigInt(base + (symbols[0]?.offset ?? 0)), true);
	view.setUint16(52, 64, true);
	view.setUint16(54, 56, true);
	view.setUint16(58, 64, true);
	view.setUint16(60, sectionCount, true);
	view.setUint16(62, 4, true);
	view.setBigUint64(40, BigInt(sectionOffset), true);
	for (const part of parts) out.set(part.data, part.offset);

	const writeSection = (index: number, name: number, type: number, flags: number, addr: number, offset: number, size: number, link: number, entsize: number): void => {
		const at = sectionOffset + index * 64;
		view.setUint32(at, name, true);
		view.setUint32(at + 4, type, true);
		view.setBigUint64(at + 8, BigInt(flags), true);
		view.setBigUint64(at + 16, BigInt(addr), true);
		view.setBigUint64(at + 24, BigInt(offset), true);
		view.setBigUint64(at + 32, BigInt(size), true);
		view.setUint32(at + 40, link, true);
		view.setBigUint64(at + 56, BigInt(entsize), true);
	};
	writeSection(0, 0, 0, 0, 0, 0, 0, 0, 0);
	writeSection(1, 1, 1, 0x6, base, textOffset, code.byteLength, 0, 0);
	writeSection(2, 7, 2, 0, 0, symtabOffset, symtab.byteLength, 3, 24);
	writeSection(3, 15, 3, 0, 0, strtabOffset, strtab.byteLength, 0, 0);
	writeSection(4, 23, 3, 0, 0, shstrtabOffset, shstrtab.byteLength, 0, 0);
	return out;
}

/** PE32+，两个节，导出表里两条具名导出（0x1000 / 0x1010）。 */
export function buildPeWithExports(): Uint8Array {
	const out = new Uint8Array(0x600);
	const view = new DataView(out.buffer);
	out.set([0x4d, 0x5a], 0);
	view.setUint32(0x3c, 0x40, true);
	out.set([0x50, 0x45, 0x00, 0x00], 0x40);
	const coff = 0x44;
	view.setUint16(coff, 0x8664, true);
	view.setUint16(coff + 2, 2, true);
	view.setUint16(coff + 16, 0xf0, true);
	view.setUint16(coff + 18, 0x0022, true);
	const optional = coff + 20;
	view.setUint16(optional, 0x20b, true);
	view.setUint32(optional + 16, 0x1000, true);
	view.setBigUint64(optional + 24, 0x140000000n, true);
	view.setUint16(optional + 70, 0x0160, true);
	view.setUint32(optional + 108, 16, true);
	view.setUint32(optional + 112, 0x2000, true);
	view.setUint32(optional + 116, 0x28, true);

	const sectionTable = optional + 0xf0;
	out.set(utf8(".text"), sectionTable);
	view.setUint32(sectionTable + 8, 0x200, true);
	view.setUint32(sectionTable + 12, 0x1000, true);
	view.setUint32(sectionTable + 16, 0x200, true);
	view.setUint32(sectionTable + 20, 0x200, true);
	view.setUint32(sectionTable + 36, 0x60000020, true);
	out.set(utf8(".rdata"), sectionTable + 40);
	view.setUint32(sectionTable + 48, 0x200, true);
	view.setUint32(sectionTable + 52, 0x2000, true);
	view.setUint32(sectionTable + 56, 0x200, true);
	view.setUint32(sectionTable + 60, 0x400, true);
	view.setUint32(sectionTable + 76, 0x40000040, true);

	const rdata = 0x400;
	view.setUint32(rdata + 12, 0x2040, true);
	view.setUint32(rdata + 16, 1, true);
	view.setUint32(rdata + 20, 2, true);
	view.setUint32(rdata + 24, 2, true);
	view.setUint32(rdata + 28, 0x2060, true);
	view.setUint32(rdata + 32, 0x2070, true);
	view.setUint32(rdata + 36, 0x20a0, true);
	out.set(utf8("demo.dll\0"), rdata + 0x40);
	view.setUint32(rdata + 0x60, 0x1000, true);
	view.setUint32(rdata + 0x64, 0x1010, true);
	view.setUint32(rdata + 0x70, 0x2080, true);
	view.setUint32(rdata + 0x74, 0x2090, true);
	view.setUint16(rdata + 0xa0, 0, true);
	view.setUint16(rdata + 0xa2, 1, true);
	out.set(utf8("ExportedMain\0"), rdata + 0x80);
	out.set(utf8("ExportedHelper\0"), rdata + 0x90);
	return out;
}

/** 单切片 Mach-O 64：LC_SYMTAB 里一条具名函数 + 一条未定义导入。 */
export function buildMachoWithSymbols(): Uint8Array {
	const symoff = 32 + 24;
	const strings = utf8("\0_main\0_printf\0");
	const symbols = concat([
		new Uint8Array(16),
		concat([u32le(1), new Uint8Array([0x0f, 1]), u16le(0), u64le(0x1000)]),
		concat([u32le(7), new Uint8Array([0x01, 0]), u16le(0), u64le(0)]),
	]);
	const stroff = symoff + symbols.byteLength;
	const header = concat([
		u32le(0xfeedfacf),
		u32le(0x01000007),
		u32le(3),
		u32le(6),
		u32le(1),
		u32le(24),
		u32le(0x00200085),
		u32le(0),
	]);
	const command = concat([u32le(0x2), u32le(24), u32le(symoff), u32le(3), u32le(stroff), u32le(strings.byteLength)]);
	return concat([header, command, symbols, strings]);
}

/**
 * DEX：一个类 com.example.PremiumGate，三个方法（checkLicense / isVip / onCreate(int)），
 * 以及字符串池里的 license 与 VIP 接口地址。
 */
export function buildDexWithClasses(): Uint8Array {
	const strings = [
		"Lcom/example/PremiumGate;",
		"Ljava/lang/Object;",
		"V",
		"I",
		"checkLicense",
		"isVip",
		"onCreate",
		"license",
		"https://api.example.com/vip",
		"VI",
	];
	const stringIdsOffset = 0x70;
	const typeIdsOffset = stringIdsOffset + strings.length * 4;
	const protoIdsOffset = typeIdsOffset + 4 * 4;
	const methodIdsOffset = protoIdsOffset + 2 * 12;
	const classDefsOffset = methodIdsOffset + 3 * 8;
	const dataOffset = classDefsOffset + 32;

	const stringData: Uint8Array[] = [];
	const stringOffsets: number[] = [];
	let cursor = 0;
	for (const value of strings) {
		const encoded = utf8(value);
		stringOffsets.push(cursor);
		const chunk = concat([new Uint8Array([encoded.byteLength & 0x7f]), encoded, new Uint8Array([0])]);
		stringData.push(chunk);
		cursor += chunk.byteLength;
	}
	const stringBytes = concat(stringData);

	const typeList = concat([u32le(1), u16le(3), u16le(0)]);
	const classData = new Uint8Array([0x00, 0x00, 0x02, 0x01, 0x00, 0x02, 0x00, 0x01, 0x01, 0x00, 0x01, 0x04, 0x00]);
	const typeListOffset = dataOffset + stringBytes.byteLength;
	const classDataOffset = typeListOffset + typeList.byteLength;
	const fileSize = classDataOffset + classData.byteLength;

	const out = new Uint8Array(fileSize);
	const view = new DataView(out.buffer);
	out.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0);
	view.setUint32(32, fileSize, true);
	view.setUint32(36, 0x70, true);
	view.setUint32(40, 0x12345678, true);
	view.setUint32(56, strings.length, true);
	view.setUint32(60, stringIdsOffset, true);
	view.setUint32(64, 4, true);
	view.setUint32(68, typeIdsOffset, true);
	view.setUint32(72, 2, true);
	view.setUint32(76, protoIdsOffset, true);
	view.setUint32(88, 3, true);
	view.setUint32(92, methodIdsOffset, true);
	view.setUint32(96, 1, true);
	view.setUint32(100, classDefsOffset, true);
	view.setUint32(104, fileSize - dataOffset, true);
	view.setUint32(108, dataOffset, true);

	stringOffsets.forEach((value, index) => view.setUint32(stringIdsOffset + index * 4, dataOffset + value, true));
	[0, 1, 2, 3].forEach((value, index) => view.setUint32(typeIdsOffset + index * 4, value, true));
	view.setUint32(protoIdsOffset, 2, true);
	view.setUint32(protoIdsOffset + 4, 2, true);
	view.setUint32(protoIdsOffset + 8, 0, true);
	view.setUint32(protoIdsOffset + 12, 9, true);
	view.setUint32(protoIdsOffset + 16, 2, true);
	view.setUint32(protoIdsOffset + 20, typeListOffset, true);

	const writeMethod = (index: number, proto: number, name: number): void => {
		const base = methodIdsOffset + index * 8;
		view.setUint16(base, 0, true);
		view.setUint16(base + 2, proto, true);
		view.setUint32(base + 4, name, true);
	};
	writeMethod(0, 0, 4);
	writeMethod(1, 0, 5);
	writeMethod(2, 1, 6);

	view.setUint32(classDefsOffset, 0, true);
	view.setUint32(classDefsOffset + 4, 0x0001, true);
	view.setUint32(classDefsOffset + 8, 1, true);
	view.setUint32(classDefsOffset + 20, 0xffffffff, true);
	view.setUint32(classDefsOffset + 24, classDataOffset, true);

	out.set(stringBytes, dataOffset);
	out.set(typeList, typeListOffset);
	out.set(classData, classDataOffset);
	return out;
}
