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

/** 面板「熵分布」柱状图需要逐桶的熵值，与 highEntropyBands 的判定阈值无关。 */
export interface EntropyBucket {
	/** 桶在文件中的起始偏移；面板据此把柱子和字节范围对上。 */
	offset: number;
	length: number;
	entropy: number;
}

/**
 * 把文件等分成 buckets 个桶，逐桶算熵。
 *
 * 面板只画这一条曲线，因此桶数固定在上限内并做抽样：一个 32 MiB 的样本
 * 也要在几百毫秒内出图，而曲线形状足够看出「哪里是不可压缩的载荷」。
 */
export function entropyProfile(bytes: Uint8Array, buckets = 25, sampleLimit = 32 * 1024): EntropyBucket[] {
	const count = Math.max(1, Math.min(200, Math.floor(buckets)));
	const total = bytes.byteLength;
	if (total === 0) return [];
	const size = Math.max(1, Math.ceil(total / count));
	const out: EntropyBucket[] = [];
	for (let index = 0; index < count; index += 1) {
		const offset = index * size;
		if (offset >= total) break;
		const end = Math.min(total, offset + size);
		out.push({
			offset,
			length: end - offset,
			entropy: shannonEntropy(sampleBytes(bytes.subarray(offset, end), sampleLimit)),
		});
	}
	return out;
}
