/**
 * 二进制读取的基础工具。所有越界访问都抛 RangeError，由各格式解析器在最外层
 * 收敛成「解析失败 + 原因」，避免畸形样本把面板打挂。
 */

export function dataView(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function requireRange(bytes: Uint8Array, offset: number, length: number): void {
	if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length < 0 || offset + length > bytes.byteLength) {
		throw new RangeError(`need ${length} bytes at ${offset}, have ${bytes.byteLength}`);
	}
}

export function u8(bytes: Uint8Array, offset: number): number {
	requireRange(bytes, offset, 1);
	return bytes[offset]!;
}

export function u16(bytes: Uint8Array, offset: number, littleEndian = true): number {
	requireRange(bytes, offset, 2);
	return dataView(bytes).getUint16(offset, littleEndian);
}

export function u32(bytes: Uint8Array, offset: number, littleEndian = true): number {
	requireRange(bytes, offset, 4);
	return dataView(bytes).getUint32(offset, littleEndian);
}

export function i32(bytes: Uint8Array, offset: number, littleEndian = true): number {
	requireRange(bytes, offset, 4);
	return dataView(bytes).getInt32(offset, littleEndian);
}

/** 64 位值以 number 返回；超过 2^53 的极端值按精度损失处理（文件偏移不会到那里）。 */
export function u64(bytes: Uint8Array, offset: number, littleEndian = true): number {
	requireRange(bytes, offset, 8);
	return Number(dataView(bytes).getBigUint64(offset, littleEndian));
}

export function ascii(bytes: Uint8Array, offset: number, length: number): string {
	requireRange(bytes, offset, length);
	let out = "";
	for (let index = 0; index < length; index += 1) {
		const code = bytes[offset + index]!;
		out += code >= 32 && code < 127 ? String.fromCharCode(code) : ".";
	}
	return out;
}

/** 读取 NUL 结尾的字节串（C 字符串 / ZIP 名称 / Mach-O load command 里的名字）。 */
export function cstring(bytes: Uint8Array, offset: number, maxLength = 4096): string {
	if (offset < 0 || offset >= bytes.byteLength) return "";
	const end = Math.min(bytes.byteLength, offset + maxLength);
	let cursor = offset;
	while (cursor < end && bytes[cursor] !== 0) cursor += 1;
	return decodeUtf8(bytes.subarray(offset, cursor));
}

export function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	} catch {
		return "";
	}
}

export function indexOfAscii(bytes: Uint8Array, needle: string, from = 0): number {
	const target = Array.from(needle, char => char.charCodeAt(0));
	outer: for (let start = Math.max(0, from); start <= bytes.byteLength - target.length; start += 1) {
		for (let index = 0; index < target.length; index += 1) {
			if (bytes[start + index] !== target[index]) continue outer;
		}
		return start;
	}
	return -1;
}

