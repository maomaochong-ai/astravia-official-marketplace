import { u16, u32, u8 } from "../bytes";

export interface AxmlAttribute {
	namespace: string | null;
	name: string;
	value: string;
}

export interface AxmlNode {
	name: string;
	attributes: AxmlAttribute[];
	children: AxmlNode[];
}

export interface AxmlDocument {
	root: AxmlNode | null;
	warnings: string[];
}

const RES_STRING_POOL = 0x0001;
const RES_XML_START_ELEMENT = 0x0102;
const RES_XML_END_ELEMENT = 0x0103;
const UTF8_FLAG = 0x100;
const NO_INDEX = 0xffffffff;

function readPoolString(bytes: Uint8Array, offset: number, utf8: boolean): string {
	if (utf8) {
		let cursor = offset;
		let length = u8(bytes, cursor);
		if ((length & 0x80) !== 0) {
			length = ((length & 0x7f) << 8) | u8(bytes, cursor + 1);
			cursor += 2;
		} else {
			cursor += 1;
		}
		// UTF-8 池里还有第二个（UTF-16 长度）变长前缀，必须跳过。
		let utf16Length = u8(bytes, cursor);
		if ((utf16Length & 0x80) !== 0) {
			utf16Length = ((utf16Length & 0x7f) << 8) | u8(bytes, cursor + 1);
			cursor += 2;
		} else {
			cursor += 1;
		}
		const slice = bytes.subarray(cursor, cursor + length);
		try {
			return new TextDecoder("utf-8", { fatal: false }).decode(slice);
		} catch {
			return "";
		}
	}
	const length = u16(bytes, offset);
	const slice = bytes.subarray(offset + 2, offset + 2 + length * 2);
	try {
		return new TextDecoder("utf-16le", { fatal: false }).decode(slice);
	} catch {
		return "";
	}
}

function readStringPool(bytes: Uint8Array, start: number): string[] {
	const count = u32(bytes, start + 8);
	const flags = u32(bytes, start + 16);
	const stringsStart = u32(bytes, start + 20);
	const utf8 = (flags & UTF8_FLAG) !== 0;
	const out: string[] = [];
	for (let index = 0; index < Math.min(count, 8192); index += 1) {
		const offset = u32(bytes, start + 28 + index * 4);
		try {
			out.push(readPoolString(bytes, start + stringsStart + offset, utf8));
		} catch {
			out.push("");
		}
	}
	return out;
}

function typedValue(type: number, data: number, strings: readonly string[], raw: string | null): string {
	if (raw !== null) return raw;
	switch (type) {
		case 0x03:
			return strings[data] ?? "";
		case 0x12:
			return data === 0 ? "false" : "true";
		case 0x10:
			return String(data | 0);
		case 0x11:
			return `0x${(data >>> 0).toString(16)}`;
		case 0x01:
			return `@0x${(data >>> 0).toString(16)}`;
		case 0x02:
			return `?0x${(data >>> 0).toString(16)}`;
		case 0x04: {
			const view = new DataView(new ArrayBuffer(4));
			view.setUint32(0, data >>> 0);
			return String(view.getFloat32(0));
		}
		case 0x1c:
		case 0x1d:
		case 0x1e:
		case 0x1f:
			return `#${(data >>> 0).toString(16).padStart(8, "0")}`;
		default:
			return String(data >>> 0);
	}
}

/**
 * 解析 Android 二进制 XML（AXML）。这是 APK 审计的核心：没有它，清单里的
 * package / 权限 / 导出组件只能靠猜。
 */
export function parseAxml(bytes: Uint8Array): AxmlDocument {
	const warnings: string[] = [];
	let strings: string[] = [];
	const stack: AxmlNode[] = [];
	let root: AxmlNode | null = null;

	try {
		if (u16(bytes, 0) !== 0x0003) return { root: null, warnings: ["not a binary XML document"] };
		let cursor = u16(bytes, 2) || 8;
		const total = Math.min(u32(bytes, 4) || bytes.byteLength, bytes.byteLength);

		while (cursor + 8 <= total) {
			const type = u16(bytes, cursor);
			const headerSize = u16(bytes, cursor + 2);
			const chunkSize = u32(bytes, cursor + 4);
			if (chunkSize < 8 || cursor + chunkSize > bytes.byteLength) {
				warnings.push(`truncated chunk 0x${type.toString(16)} at ${cursor}`);
				break;
			}

			if (type === RES_STRING_POOL) {
				strings = readStringPool(bytes, cursor);
			} else if (type === RES_XML_START_ELEMENT) {
				const body = cursor + headerSize;
				const name = strings[u32(bytes, body + 4)] ?? "";
				const attributeStart = u16(bytes, body + 8);
				const attributeSize = u16(bytes, body + 10);
				const attributeCount = u16(bytes, body + 12);
				const attributes: AxmlAttribute[] = [];
				for (let index = 0; index < Math.min(attributeCount, 256); index += 1) {
					const base = body + attributeStart + index * (attributeSize || 20);
					const namespaceIndex = u32(bytes, base);
					const nameIndex = u32(bytes, base + 4);
					const rawIndex = u32(bytes, base + 8);
					const valueType = u8(bytes, base + 15);
					const data = u32(bytes, base + 16);
					attributes.push({
						namespace: namespaceIndex === NO_INDEX ? null : (strings[namespaceIndex] ?? null),
						name: strings[nameIndex] ?? "",
						value: typedValue(valueType, data, strings, rawIndex === NO_INDEX ? null : (strings[rawIndex] ?? null)),
					});
				}
				const node: AxmlNode = { name, attributes, children: [] };
				const parent = stack[stack.length - 1];
				if (parent) parent.children.push(node);
				else if (!root) root = node;
				stack.push(node);
			} else if (type === RES_XML_END_ELEMENT) {
				stack.pop();
			}

			cursor += chunkSize;
		}
	} catch (error) {
		warnings.push(`binary XML parse stopped: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (!root) warnings.push("no manifest element found");
	return { root, warnings };
}

export const ANDROID_NS = "http://schemas.android.com/apk/res/android";

export function attr(node: AxmlNode, name: string, namespace: string | null = ANDROID_NS): string | null {
	const direct = node.attributes.find(item => item.name === name && (namespace === null ? item.namespace === null : item.namespace === namespace));
	if (direct) return direct.value;
	const fallback = node.attributes.find(item => item.name === name);
	return fallback ? fallback.value : null;
}

export function childrenNamed(node: AxmlNode, name: string): AxmlNode[] {
	return node.children.filter(child => child.name === name);
}
