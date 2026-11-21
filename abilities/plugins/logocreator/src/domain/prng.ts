/**
 * Deterministic randomness.
 *
 * Every mark in this plugin must be reproducible from its spec: a saved design
 * stores the numbers, not the picture, and re-rendering it months later has to
 * give the same bytes. That rules out `Math.random()` everywhere in the engine,
 * so all variation flows through here.
 *
 * `xmur3` turns a string into a 32-bit seed; `mulberry32` walks it.
 */

export interface Rng {
	/** Uniform in [0, 1). */
	next(): number;
	/** Uniform in [min, max). */
	range(min: number, max: number): number;
	/** Integer in [min, max]. */
	int(min: number, max: number): number;
	/** True with probability `p` (default 0.5). */
	chance(p?: number): boolean;
	pick<T>(items: readonly T[]): T;
	/** Fisher–Yates copy; the input is never mutated. */
	shuffle<T>(items: readonly T[]): T[];
	/** A new generator seeded from this one — independent streams per concern. */
	fork(salt: string): Rng;
}

function xmur3(seed: string): () => number {
	let h = 1779033703 ^ seed.length;
	for (let i = 0; i < seed.length; i += 1) {
		h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return () => {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return h >>> 0;
	};
}

function mulberry32(state: number): () => number {
	let a = state >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Stable 32-bit seed for any string. Used for spec seeds and gradient ids. */
export function hashSeed(input: string): number {
	return xmur3(input)();
}

export function createRng(seed: number | string): Rng {
	const numeric = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
	const next = mulberry32(numeric);
	return {
		next,
		range: (min, max) => min + next() * (max - min),
		int: (min, max) => Math.floor(min + next() * (max - min + 1)),
		chance: (p = 0.5) => next() < p,
		pick: (items) => items[Math.floor(next() * items.length) % items.length],
		shuffle: (items) => {
			const copy = [...items];
			for (let i = copy.length - 1; i > 0; i -= 1) {
				const j = Math.floor(next() * (i + 1));
				[copy[i], copy[j]] = [copy[j], copy[i]];
			}
			return copy;
		},
		fork: (salt) => createRng(hashSeed(`${numeric}:${salt}`)),
	};
}
