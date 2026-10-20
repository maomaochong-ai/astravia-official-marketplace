/** 香农熵（bit/byte，0..8）与高熵分块统计，用来判断「加壳 / 加密 / 打包」。 */

const SAMPLE_LIMIT = 512 * 1024;
const BLOCK_LIMIT = 256 * 1024 * 1024;

export function shannonEntropy(bytes: Uint8Array): number {
	if (bytes.byteLength === 0) return 0;
	const counts = new Uint32Array(256);
	for (let index = 0; index < bytes.byteLength; index += 1) counts[bytes[index]!] += 1;
	let entropy = 0;
	for (let index = 0; index < 256; index += 1) {
		const count = counts[index]!;
		if (count === 0) continue;
		const probability = count / bytes.byteLength;
		entropy -= probability * Math.log2(probability);
	}
	return entropy;
}

/** 大文件按等距抽样的方式截到 limit 字节，保持整体统计特性同时限制耗时。 */
export function sampleBytes(bytes: Uint8Array, limit = SAMPLE_LIMIT): Uint8Array {
	if (bytes.byteLength <= limit) return bytes;
	const out = new Uint8Array(limit);
	const step = bytes.byteLength / limit;
	for (let index = 0; index < limit; index += 1) out[index] = bytes[Math.floor(index * step)]!;
	return out;
}

export function entropyOfRange(bytes: Uint8Array, offset: number, length: number, limit = SAMPLE_LIMIT): number {
	const start = Math.max(0, Math.min(offset, bytes.byteLength));
	const end = Math.max(start, Math.min(offset + Math.max(0, length), bytes.byteLength));
	return shannonEntropy(sampleBytes(bytes.subarray(start, end), limit));
}

export interface EntropyBand {
	offset: number;
	length: number;
	entropy: number;
}

/** 找连续的「几乎不可压缩」区块，用来定位加壳载荷或加密资源。 */
export function highEntropyBands(bytes: Uint8Array, options: { blockSize?: number; threshold?: number; maxBands?: number } = {}): EntropyBand[] {
	const blockSize = options.blockSize ?? 8192;
	const threshold = options.threshold ?? 7.4;
	const maxBands = options.maxBands ?? 20;
	const limit = Math.min(bytes.byteLength, BLOCK_LIMIT);
	const bands: EntropyBand[] = [];
	let open: EntropyBand | null = null;

	for (let offset = 0; offset + blockSize <= limit; offset += blockSize) {
		const entropy = shannonEntropy(bytes.subarray(offset, offset + blockSize));
		if (entropy >= threshold) {
			if (open) {
				open.length += blockSize;
				open.entropy = Math.max(open.entropy, entropy);
			} else {
				open = { offset, length: blockSize, entropy };
			}
		} else if (open) {
			bands.push(open);
			open = null;
			if (bands.length >= maxBands) return bands;
		}
	}
	if (open) bands.push(open);
	return bands;
}
