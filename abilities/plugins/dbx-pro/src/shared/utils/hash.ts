/**
 * FNV-1a hash 工具函数。
 * 
 * 用于生成稳定的伪随机值，保证相同输入总是产生相同输出。
 * 典型用途：预览图表数据、临时 ID、颜色种子等。
 */

/**
 * FNV-1a 32-bit hash，返回 0-2^32 之间的整数。
 * 
 * @param seed 输入字符串
 * @returns 32-bit 无符号整数
 */
export function fnv1a(seed: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * FNV-1a hash，返回指定范围内的整数 [min, max)。
 * 
 * @param seed 输入字符串
 * @param min 最小值（含）
 * @param max 最大值（不含）
 * @returns [min, max) 范围内的整数
 */
export function fnv1aRange(seed: string, min: number, max: number): number {
	const h = fnv1a(seed);
	return min + (h % (max - min));
}

/**
 * FNV-1a hash，返回指定长度的稳定字符串。
 * 
 * @param seed 输入字符串
 * @param len 输出字符串长度
 * @param charset 字符集（默认 a-z0-9）
 * @returns 稳定 hash 字符串
 */
export function fnv1aString(seed: string, len = 8, charset = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
	let h = fnv1a(seed);
	let out = "";
	for (let i = 0; i < len; i++) {
		h ^= (h >>> 13);
		h = Math.imul(h, 1274126177);
		h ^= (h >>> 16);
		out += charset[h % charset.length];
	}
	return out;
}

/**
 * FNV-1a hash，返回稳定伪随机数组。
 * 
 * @param seed 输入字符串
 * @param len 数组长度
 * @param min 最小值（含）
 * @param max 最大值（不含）
 * @returns 稳定伪随机整数数组
 */
export function fnv1aArray(seed: string, len: number, min: number, max: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < len; i++) {
		out.push(fnv1aRange(`${seed}-${i}`, min, max));
	}
	return out;
}
