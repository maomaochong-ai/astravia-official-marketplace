/**
 * A single-weight geometric stroke alphabet.
 *
 * Monograms are the one place where a real typeface would be the obvious answer,
 * but a logo cannot depend on a font being installed — and tracing a rendered
 * glyph back to outlines needs a font parser. So this is a hand-built marker
 * alphabet: straight strokes and cubics on a 100 × 140 box (cap top y=8, baseline
 * y=140), drawn with round caps. It reads as a modern geometric monogram, which
 * is exactly the register a monogram sits in.
 *
 * Only A–Z and 0–9 are defined; monogram initials drop everything else.
 */

export const GLYPH_BOX = { width: 100, height: 140 } as const;

const GLYPHS: Record<string, string> = {
	A: "M8 140L50 8L92 140M24 102L76 102",
	B: "M20 8L20 140M20 8L58 8C92 8 92 68 58 68L20 68M20 68L62 68C96 68 96 140 62 140L20 140",
	C: "M88 34C66 6 12 16 12 74C12 132 66 142 88 114",
	D: "M20 8L20 140M20 8L46 8C94 8 94 140 46 140L20 140",
	E: "M84 8L18 8L18 140L84 140M18 74L72 74",
	F: "M84 8L18 8L18 140M18 74L70 74",
	G: "M88 34C66 6 12 16 12 74C12 132 66 142 88 114L88 80L58 80",
	H: "M18 8L18 140M82 8L82 140M18 74L82 74",
	I: "M50 8L50 140",
	J: "M80 8L80 104C80 138 44 146 22 122",
	K: "M18 8L18 140M84 8L22 82M46 60L86 140",
	L: "M18 8L18 140L84 140",
	M: "M12 140L12 8L50 90L88 8L88 140",
	N: "M18 140L18 8L82 132L82 8",
	O: "M50 8C18 8 10 44 10 74C10 104 18 140 50 140C82 140 90 104 90 74C90 44 82 8 50 8Z",
	P: "M20 8L20 140M20 8L60 8C94 8 94 78 60 78L20 78",
	Q: "M50 8C18 8 10 44 10 74C10 104 18 140 50 140C82 140 90 104 90 74C90 44 82 8 50 8ZM58 106L94 146",
	R: "M20 8L20 140M20 8L60 8C94 8 94 76 60 76L20 76M48 76L86 140",
	S: "M86 32C64 4 16 10 16 42C16 72 84 66 84 98C84 130 38 144 12 112",
	T: "M8 8L92 8M50 8L50 140",
	U: "M18 8L18 96C18 138 82 138 82 96L82 8",
	V: "M10 8L50 140L90 8",
	W: "M6 8L26 140L50 46L74 140L94 8",
	X: "M14 8L86 140M86 8L14 140",
	Y: "M12 8L50 72L88 8M50 72L50 140",
	Z: "M14 8L86 8L14 140L86 140",
	"0": "M50 8C20 8 14 44 14 74C14 104 20 140 50 140C80 140 86 104 86 74C86 44 80 8 50 8Z",
	"1": "M26 30L50 8L50 140",
	"2": "M16 40C16 4 84 2 84 44C84 76 18 108 14 140L88 140",
	"3": "M18 26C34 2 84 10 84 42C84 66 60 72 46 72C64 72 88 80 88 106C88 138 36 148 16 116",
	"4": "M70 8L10 98L92 98M70 8L70 140",
	"5": "M82 8L26 8L20 66C48 52 88 58 88 96C88 134 40 148 14 114",
	"6": "M82 26C62 0 16 12 14 78C12 128 40 144 56 144C82 144 90 118 90 100C90 70 66 58 46 60C24 62 14 78 14 90",
	"7": "M12 8L88 8L42 140",
	"8": "M50 70C22 70 16 46 22 26C30 2 70 2 78 26C84 46 78 70 50 70ZM50 70C16 70 10 104 16 122C24 148 76 148 84 122C90 104 84 70 50 70Z",
	"9": "M16 118C36 146 84 132 86 66C88 14 58 2 42 2C16 2 8 30 8 44C8 74 32 86 52 84C74 82 86 66 86 54",
};

export interface PlacedGlyph {
	char: string;
	/** Path data already positioned in the shared 100×140 glyph space. */
	d: string;
	/** Horizontal offset from the text block's left edge. */
	offset: number;
}

export function hasGlyph(char: string): boolean {
	return char.toUpperCase() in GLYPHS;
}

/**
 * Lay out the initials of `text` (or the first `max` alphanumerics) as one block.
 * Returns null when nothing drawable remains — callers fall back to a motif
 * rather than rendering an empty box.
 */
export function initialsOf(text: string, max = 2): string {
	const words = text
		.split(/[\s\-_/|·.,]+/)
		.map((word) => word.replace(/[^0-9A-Za-z\u4e00-\u9fa5]/g, ""))
		.filter(Boolean);
	if (words.length >= 2) {
		const letters = words
			.slice(0, max)
			.map((word) => word[0].toUpperCase())
			.filter(hasGlyph);
		if (letters.length > 0) return letters.join("");
	}
	const single = (words[0] ?? "").toUpperCase();
	if (single.length === 0) return "";
	if (hasGlyph(single[0])) {
		// A single-word brand gets its first letter, or the first and last when it
		// is long enough that two would read better than one lonely letter.
		const rest = single.slice(1).split("").filter(hasGlyph);
		if (single.length >= 5 && rest.length > 0) return single[0] + rest[rest.length - 1];
		return single[0];
	}
	const cjk = /[\u4e00-\u9fa5]/.exec(text);
	return cjk ? cjk[0] : "";
}

/** Is this a CJK initial? Those are drawn by the text engine, not this alphabet. */
export function isCjkGlyph(text: string): boolean {
	return /[\u4e00-\u9fa5]/.test(text);
}

export interface GlyphBlock {
	glyphs: PlacedGlyph[];
	/** Total advance width in glyph units (1 unit = 1/100 of the em box). */
	width: number;
	height: number;
}

/**
 * Compose initials into a block. `tracking` is a fraction of the em box, matching
 * the CSS `letter-spacing` convention so the wordmark and the monogram can be
 * tuned with the same number.
 */
export function glyphBlock(initials: string, tracking = 0): GlyphBlock | null {
	const chars = initials.toUpperCase().split("").filter((c) => c in GLYPHS);
	if (chars.length === 0) return null;
	const advance = GLYPH_BOX.width * (1 + tracking);
	const glyphs: PlacedGlyph[] = chars.map((char, index) => ({
		char,
		d: GLYPHS[char],
		offset: index * advance,
	}));
	return {
		glyphs,
		width: advance * (chars.length - 1) + GLYPH_BOX.width,
		height: GLYPH_BOX.height,
	};
}

export const GLYPH_COUNT = Object.keys(GLYPHS).length;
