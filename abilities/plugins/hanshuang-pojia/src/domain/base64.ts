const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = (() => {
	const table = new Uint8Array(256).fill(255);
	for (let index = 0; index < ALPHABET.length; index += 1) table[ALPHABET.charCodeAt(index)] = index;
	table["=".charCodeAt(0)] = 0;
	return table;
})();

/** 纯 TS base64 解码：宿主返回二进制文件时是 base64 文本，不依赖 atob/Buffer。 */
export function fromBase64(text: string): Uint8Array {
	const clean = text.replace(/[\s\r\n]+/g, "");
	const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
	const output = new Uint8Array(Math.floor((clean.length * 3) / 4) - padding);
	let outIndex = 0;
	let buffer = 0;
	let bits = 0;
	for (let index = 0; index < clean.length; index += 1) {
		const code = clean.charCodeAt(index);
		if (code === 61) break;
		const value = LOOKUP[code];
		if (value === 255) continue;
		buffer = (buffer << 6) | value;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			output[outIndex] = (buffer >> bits) & 0xff;
			outIndex += 1;
		}
	}
	return outIndex === output.length ? output : output.subarray(0, outIndex);
}

export function toBase64(bytes: Uint8Array): string {
	let out = "";
	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index]!;
		const second = bytes[index + 1];
		const third = bytes[index + 2];
		out += ALPHABET[first >> 2];
		out += ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
		out += second === undefined ? "=" : ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
		out += third === undefined ? "=" : ALPHABET[third & 0x3f];
	}
	return out;
}
