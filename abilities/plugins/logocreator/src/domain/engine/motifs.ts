import type { DetailLevel } from "../spec";
import type { Rng } from "../prng";
import {
	arc,
	circle,
	lerp,
	nGon,
	polar,
	polyline,
	ring,
	roundedRect,
	smooth,
	star,
	teeth,
	type Point,
} from "./geometry";
import type { StyleRecipe } from "./style-recipes";

/**
 * The mark library.
 *
 * A motif is a pure function of (rng, recipe, detail) returning filled/stroked
 * path data inside a 0–100 box. Nothing here knows about colour: shapes carry a
 * *role* and the composer resolves roles against the palette, which is what lets
 * one motif work in all eight styles and in monochrome.
 */

export type PaintRole = "primary" | "secondary" | "accent" | "paper";

export interface Shape {
	d: string;
	role: PaintRole;
	mode?: "fill" | "stroke";
	width?: number;
	opacity?: number;
	evenOdd?: boolean;
	/** Applied as the SVG `transform` attribute. */
	transform?: string;
	linecap?: "butt" | "round" | "square";
}

export interface MotifInput {
	rng: Rng;
	recipe: StyleRecipe;
	detail: DetailLevel;
}

export type MotifFn = (input: MotifInput) => Shape[];

const CX = 50;
const CY = 50;

function stroke(d: string, role: PaintRole, recipe: StyleRecipe, scale = 1): Shape {
	return { d, role, mode: "stroke", width: recipe.stroke * scale, linecap: "round" };
}

function fill(d: string, role: PaintRole, extra: Partial<Shape> = {}): Shape {
	return { d, role, mode: "fill", ...extra };
}

// ── Pictograms ────────────────────────────────────────────────────────────────

const leaf: MotifFn = ({ rng, recipe, detail }) => {
	// Narrower or fuller leaf, on a seed — two brands in the same industry should
	// not receive the identical silhouette.
	const width = rng.range(0.78, 1.04);
	const cx = 50;
	const right = cx + 34 * width;
	const left = cx - 34 * width;
	const veins = detail === "minimal" ? 0 : detail === "detailed" ? 3 : 2;
	const shapes: Shape[] = [
		fill(`M50 8C${right.toFixed(1)} 28 ${right.toFixed(1)} 68 50 94C${left.toFixed(1)} 68 ${left.toFixed(1)} 28 50 8Z`, "primary"),
		stroke("M50 16L50 90", "paper", recipe, 0.45),
	];
	for (let i = 0; i < veins; i += 1) {
		const y = 38 + i * 16;
		const spread = 24 - i * 3;
		shapes.push(stroke(`M50 ${y}C${50 + spread * width * 0.5} ${y - 4} ${50 + spread * width * 0.8} ${y - 10} ${50 + spread * width} ${y - 18}`, "paper", recipe, 0.32));
		if (i < veins - 1) {
			shapes.push(stroke(`M50 ${y + 8}C${50 - spread * width * 0.5} ${y + 4} ${50 - spread * width * 0.8} ${y - 2} ${50 - spread * width} ${y - 10}`, "paper", recipe, 0.32));
		}
	}
	return shapes;
};

const mountain: MotifFn = ({ rng, recipe, detail }) => {
	const mainPeak = rng.range(30, 40);
	const shoulder = rng.range(52, 60);
	const shapes: Shape[] = [
		fill(`M4 84L${mainPeak.toFixed(1)} 22L${shoulder.toFixed(1)} 58L68 40L96 84Z`, "primary"),
		fill(`M${mainPeak.toFixed(1)} 22L${(mainPeak + 10).toFixed(1)} 40L${(mainPeak - 6).toFixed(1)} 40Z`, "paper"),
	];
	if (detail !== "minimal") shapes.push(stroke(`M${shoulder.toFixed(1)} 58L64 72`, "secondary", recipe, 0.7));
	if (detail === "detailed") shapes.push(fill("M68 40L76 54L62 54Z", "secondary"));
	return shapes;
};

function waveBand(phase: number, amplitude: number, y: number): string {
	const points: Point[] = [];
	for (let i = 0; i <= 6; i += 1) {
		const x = 4 + (i / 6) * 92;
		const yy = y + Math.sin((i / 6) * Math.PI * 2 + phase) * amplitude;
		points.push({ x, y: yy });
	}
	return smooth(points, false);
}

const wave: MotifFn = ({ rng, recipe, detail }) => {
	const amplitude = rng.range(11, 17);
	const bands: Shape[] = [
		stroke(waveBand(0, amplitude, 34), "primary", recipe, 1),
		stroke(waveBand(Math.PI, amplitude, 56), "secondary", recipe, 0.9),
	];
	if (detail !== "minimal") bands.push(stroke(waveBand(0, amplitude * 0.7, 76), "accent", recipe, 0.7));
	return bands;
};

const orbit: MotifFn = ({ recipe, detail }) => {
	const tilt = -22;
	const satellite = polar(CX, CY, 40, tilt + 90);
	const shapes: Shape[] = [
		stroke(circle(CX, CY, 34), "secondary", recipe, 0.85),
		{
			d: "M12 50A38 15 0 1 0 88 50A38 15 0 1 0 12 50Z",
			role: "primary",
			mode: "stroke",
			width: recipe.stroke * 0.8,
			transform: `rotate(${tilt} 50 50)`,
		},
		fill(circle(CX, CY, 11), "primary"),
		fill(circle(satellite.x, satellite.y, 6), "accent"),
	];
	if (detail === "detailed") {
		const far = polar(CX, CY, 40, tilt - 90);
		shapes.push(fill(circle(far.x, far.y, 4), "accent"));
	}
	return shapes;
};

const aperture: MotifFn = ({ recipe, detail }) => {
	const blades = detail === "minimal" ? 5 : 6;
	const shapes: Shape[] = [];
	for (let i = 0; i < blades; i += 1) {
		const base = i * (360 / blades);
		const a = polar(CX, CY, 40, base);
		const b = polar(CX, CY, 40, base + 360 / blades - 8);
		const c = polar(CX, CY, 14, base + 360 / blades / 2);
		const blade = polyline([a, b, c], true);
		shapes.push(fill(blade, i % 2 === 0 ? "primary" : "secondary", { opacity: i % 2 === 0 ? 1 : 0.82 }));
	}
	shapes.push(fill(circle(CX, CY, 9), "paper"));
	return shapes;
};

const flame: MotifFn = ({ recipe, detail }) => [
	fill(
		"M46 4C58 22 78 36 80 56C82 80 68 96 50 96C32 96 18 82 18 60C18 44 28 32 34 20C38 32 44 40 50 44C44 28 43 14 46 4Z",
		"primary",
	),
	fill("M50 50C60 60 64 68 64 75C64 84 58 90 50 90C42 90 36 84 36 75C36 68 40 60 50 50Z", "accent", {
		opacity: 0.92,
	}),
	...(detail === "minimal" ? [] : [stroke("M50 62L50 80", "paper", recipe, 0.45)]),
];

const droplet: MotifFn = ({ recipe, detail }) => [
	fill("M50 6C64 30 78 46 78 62C78 82 65 95 50 95C35 95 22 82 22 62C22 46 36 30 50 6Z", "primary"),
	...(detail === "minimal"
		? []
		: [stroke("M38 64C38 72 42 78 48 80", "paper", recipe, 0.5)]),
];

const sun: MotifFn = ({ recipe, detail }) => {
	const shapes: Shape[] = [fill(circle(CX, CY, 22), "primary")];
	const rays = detail === "detailed" ? 12 : 8;
	for (let i = 0; i < rays; i += 1) {
		const deg = (360 / rays) * i;
		const long = i % 2 === 0;
		const inner = 30;
		const outer = long ? 44 : 38;
		shapes.push(stroke(polyline([polar(CX, CY, inner, deg), polar(CX, CY, outer, deg)]), "secondary", recipe, 0.7));
	}
	return shapes;
};

const moon: MotifFn = ({ recipe }) => [
	fill(`${circle(46, 50, 36)}${circle(64, 40, 30)}`, "primary", { evenOdd: true }),
	fill(star(78, 74, 8, 3, 4, -90), "accent"),
	stroke(circle(46, 50, 36), "secondary", recipe, 0.5),
];

const house: MotifFn = ({ recipe, detail }) => [
	stroke("M6 48L50 10L94 48", "primary", recipe, 1.1),
	stroke("M18 48V88H82V48", "primary", recipe, 1.1),
	fill(roundedRect(40, 60, 20, 28, recipe.corner * 6), "secondary"),
	...(detail === "minimal" ? [] : [fill(circle(50, 38, 5), "accent")]),
];

const pillar: MotifFn = ({ recipe, detail }) => {
	const shapes: Shape[] = [
		fill("M12 20L50 6L88 20Z", "primary"),
		fill(roundedRect(14, 22, 72, 7, recipe.corner * 3), "primary"),
		fill(roundedRect(14, 79, 72, 7, recipe.corner * 3), "primary"),
	];
	for (const x of detail === "minimal" ? [34, 66] : [30, 50, 70]) {
		shapes.push(stroke(`M${x} 33L${x} 76`, "primary", recipe, 0.85));
	}
	return shapes;
};

const cross: MotifFn = ({ recipe }) => {
	const arm = 30;
	const thickness = 26;
	const r = recipe.corner * 8;
	return [
		fill(roundedRect(CX - thickness / 2, CY - arm, thickness, arm * 2, r), "primary"),
		fill(roundedRect(CX - arm, CY - thickness / 2, arm * 2, thickness, r), "primary"),
	];
};

const note: MotifFn = ({ recipe, detail }) => [
	{ ...fill(circle(34, 76, 15), "primary"), transform: "rotate(-18 34 76)" },
	stroke("M47 72L47 20", "primary", recipe, 1.1),
	stroke("M47 20C66 24 76 36 71 52", "primary", recipe, 1),
	...(detail === "minimal"
		? []
		: [
				stroke("M47 40L76 46", "secondary", recipe, 0.8),
				fill(circle(70, 70, 10), "secondary"),
			]),
];

const wing: MotifFn = ({ recipe, detail }) => {
	const shapes: Shape[] = [
		fill("M12 80C28 42 56 20 92 12C74 38 58 60 50 86Z", "primary"),
		stroke("M26 74C42 56 58 44 80 30", "paper", recipe, 0.4),
	];
	if (detail !== "minimal") shapes.push(stroke("M36 84C50 68 62 58 84 48", "paper", recipe, 0.35));
	if (detail === "detailed") shapes.push(stroke("M46 90C58 78 68 70 88 62", "paper", recipe, 0.3));
	return shapes;
};

const paw: MotifFn = ({ recipe }) => [
	fill("M24 60C24 46 36 34 50 34C64 34 76 46 76 60C76 78 64 90 50 90C36 90 24 78 24 60Z", "primary"),
	fill(circle(22, 34, 11), "primary"),
	fill(circle(40, 22, 12), "primary"),
	fill(circle(60, 22, 12), "primary"),
	fill(circle(78, 34, 11), "primary"),
	stroke(arc(CX, CY, 60, 0, 360), "secondary", recipe, 0.35),
];

const creature: MotifFn = ({ rng, recipe, detail }) => {
	const ears = rng.pick(["round", "point"]);
	const shapes: Shape[] = [];
	if (ears === "point") {
		shapes.push(fill("M22 44L18 10L44 30Z", "primary"));
		shapes.push(fill("M78 44L82 10L56 30Z", "primary"));
	} else {
		shapes.push(fill(circle(26, 28, 13), "primary"));
		shapes.push(fill(circle(74, 28, 13), "primary"));
	}
	shapes.push(fill(circle(CX, 56, 34), "primary"));
	shapes.push(fill(circle(38, 50, 5.5), "paper"));
	shapes.push(fill(circle(62, 50, 5.5), "paper"));
	shapes.push(fill("M50 62L57 70H43Z", "paper"));
	if (detail !== "minimal") {
		shapes.push(stroke("M40 78C46 83 54 83 60 78", "paper", recipe, 0.4));
	}
	if (detail === "detailed") {
		shapes.push(fill(circle(30, 62, 6), "accent", { opacity: 0.75 }));
		shapes.push(fill(circle(70, 62, 6), "accent", { opacity: 0.75 }));
	}
	return shapes;
};

const hex: MotifFn = ({ recipe, detail }) => [
	fill(nGon(CX, CY, 42, 6), "primary"),
	fill(nGon(CX, CY, 26, 6), "paper"),
	fill(nGon(CX, CY, 17, 6), "secondary"),
	...(detail === "minimal" ? [] : [stroke(nGon(CX, CY, 33, 6), "accent", recipe, 0.4)]),
];

const shield: MotifFn = ({ recipe, detail }) => [
	fill("M50 6L88 20V52C88 76 70 90 50 96C30 90 12 76 12 52V20Z", "primary"),
	fill("M50 22L74 31V52C74 66 63 76 50 81C37 76 26 66 26 52V31Z", "paper", { opacity: 0.92 }),
	stroke("M34 56L46 68L68 40", "secondary", recipe, 0.9),
	...(detail === "detailed" ? [fill(circle(50, 16, 4), "accent")] : []),
];

const spark: MotifFn = ({ recipe, detail }) => {
	const shapes: Shape[] = [
		fill("M46 4C53 32 62 41 90 48C62 55 53 64 46 92C39 64 30 55 2 48C30 41 39 32 46 4Z", "primary"),
	];
	if (detail !== "minimal") shapes.push(fill("M78 62C82 74 85 77 96 80C85 83 82 86 78 98C74 86 71 83 60 80C71 77 74 74 78 62Z", "accent", { opacity: 0.9 }));
	if (detail === "detailed") shapes.push(stroke(circle(46, 48, 44), "secondary", recipe, 0.3));
	return shapes;
};

const book: MotifFn = ({ recipe, detail }) => [
	fill("M50 20C36 12 20 12 10 19V82C22 76 38 76 50 84C62 76 78 76 90 82V19C80 12 64 12 50 20Z", "primary"),
	stroke("M50 24L50 84", "paper", recipe, 0.5),
	...(detail === "minimal"
		? []
		: [
				stroke("M22 32C30 30 40 30 44 33", "paper", recipe, 0.3),
				stroke("M56 33C60 30 70 30 78 32", "paper", recipe, 0.3),
			]),
];

const compass: MotifFn = ({ recipe, detail }) => [
	stroke(circle(CX, CY, 38), "primary", recipe, 0.9),
	fill("M50 16L60 50L50 84L40 50Z", "secondary"),
	fill(circle(CX, CY, 5), "accent"),
	...(detail === "detailed"
		? [
				stroke(polyline([polar(CX, CY, 38, -90), polar(CX, CY, 44, -90)]), "accent", recipe, 0.4),
				stroke(polyline([polar(CX, CY, 38, 90), polar(CX, CY, 44, 90)]), "accent", recipe, 0.4),
			]
		: []),
];

const gear: MotifFn = ({ recipe, detail }) => [
	fill(teeth(CX, CY, 30, 44, detail === "minimal" ? 8 : 12, 16), "primary"),
	fill(ring(CX, CY, 30, 16), "primary", { evenOdd: true }),
	fill(circle(CX, CY, 12), "paper"),
	stroke(circle(CX, CY, 6), "secondary", recipe, 0.4),
];

const heart: MotifFn = ({ recipe, detail }) => [
	fill("M50 92C20 70 8 54 8 36C8 18 24 8 36 8C44 8 50 14 50 22C50 14 56 8 64 8C76 8 92 18 92 36C92 54 80 70 50 92Z", "primary"),
	...(detail === "minimal" ? [] : [stroke("M26 34C26 28 30 24 36 24", "paper", recipe, 0.5)]),
];

const link: MotifFn = ({ recipe }) => [
	{ ...stroke(roundedRect(-24, -11, 48, 22, 10), "primary", recipe, 0.9), transform: "translate(38 40) rotate(-45)" },
	{ ...stroke(roundedRect(-24, -11, 48, 22, 10), "secondary", recipe, 0.9), transform: "translate(62 60) rotate(-45)" },
];

const knot: MotifFn = ({ recipe, detail }) => [
	{ ...stroke(nGon(CX, CY, 34, 4, -90), "primary", recipe, 0.95), transform: "rotate(0 50 50)" },
	{ ...stroke(nGon(CX, CY, 34, 4, -90), "secondary", recipe, 0.95), transform: "rotate(45 50 50)" },
	...(detail === "detailed" ? [fill(circle(CX, CY, 7), "accent")] : []),
];

const cup: MotifFn = ({ recipe, detail }) => {
	const shapes: Shape[] = [
		fill("M20 40L27 88H67L74 40Z", "primary"),
		stroke("M76 48C92 48 92 74 76 74", "primary", recipe, 0.9),
	];
	const steam = detail === "minimal" ? 1 : 2;
	for (let i = 0; i < steam; i += 1) {
		const x = 36 + i * 16;
		shapes.push(stroke(`M${x} 30C${x + 7} 22 ${x - 4} 16 ${x + 3} 6`, "secondary", recipe, 0.55));
	}
	if (detail === "detailed") shapes.push(fill(roundedRect(20, 40, 54, 6, 3), "secondary"));
	return shapes;
};

export const MOTIFS: Record<string, MotifFn> = {
	cup,
	leaf,
	wave,
	mountain,
	sun,
	moon,
	house,
	pillar,
	cross,
	note,
	aperture,
	wing,
	paw,
	creature,
	hex,
	shield,
	spark,
	droplet,
	book,
	compass,
	gear,
	heart,
	orbit,
	link,
	knot,
	flame,
};

export const PICTORIAL_SUBJECTS = Object.keys(MOTIFS);

/**
 * Abstract constructions. These are the fallback vocabulary: no subject was
 * recognised in the brief, so the mark is built from pure geometry — which is
 * what most real abstract logos are anyway.
 */
const abstractVariants: Record<string, MotifFn> = {
	slices: ({ rng, recipe, detail }) => {
		const cuts = rng.int(2, 3);
		const shapes: Shape[] = [fill(circle(CX, CY, 42), "primary")];
		for (let i = 0; i < cuts; i += 1) {
			const a = rng.range(0, 360);
			const width = rng.range(26, 58);
			const p1 = polar(CX, CY, 46, a);
			const p2 = polar(CX, CY, 46, a + width);
			shapes.push(fill(polyline([p1, p2, { x: CX, y: CY }], true), "secondary", { opacity: 0.92 }));
		}
		if (detail !== "minimal") shapes.push(fill(circle(CX, CY, 12), "paper"));
		return shapes;
	},
	arcs: ({ rng, recipe }) => {
		const start = rng.range(-40, 40);
		return [
			{ ...stroke(arc(CX, CY, 40, start, start + 210), "primary", recipe, 1.2), linecap: "round" },
			{ ...stroke(arc(CX, CY, 26, start + 90, start + 330), "secondary", recipe, 1), linecap: "round" },
			{ ...stroke(arc(CX, CY, 12, start + 40, start + 220), "accent", recipe, 0.8), linecap: "round" },
		];
	},
	mosaic: ({ rng }) => {
		const variants = [
			["M6 6H58L6 58Z", "M58 6H94L94 42L58 42Z", "M6 58L42 58V94H6Z", "M42 58H94V94H58Z"],
			["M6 6H50V50H6Z", "M50 6H94V34L50 50Z", "M6 50L50 50L6 94Z", "M50 50H94V94H66Z"],
			["M6 6L58 6L6 58Z", "M58 6L94 6L94 58L42 58Z", "M6 58L58 58L6 94Z", "M58 58H94V94H42Z"],
		];
		return rng.pick(variants).map((d, i) => fill(d, i % 2 === 0 ? "primary" : "secondary"));
	},
	bands: ({ rng, recipe, detail }) => {
		const count = detail === "minimal" ? 3 : 4;
		return Array.from({ length: count }, (_, i) => {
			const y = lerp(22, 78, i / Math.max(1, count - 1));
			const amp = rng.range(6, 16);
			return stroke(waveBand(i % 2 === 0 ? 0 : Math.PI, amp, y), i === 0 ? "primary" : i % 2 === 0 ? "accent" : "secondary", recipe, i === 0 ? 1.2 : 0.85);
		});
	},
	burst: ({ rng, recipe, detail }) => {
		const rays = detail === "minimal" ? 6 : 10;
		const shapes: Shape[] = [];
		for (let i = 0; i < rays; i += 1) {
			const a = (360 / rays) * i + rng.range(-4, 4);
			const inner = rng.range(10, 20);
			const outer = rng.range(34, 46);
			shapes.push(stroke(polyline([polar(CX, CY, inner, a), polar(CX, CY, outer, a)]), i % 3 === 0 ? "accent" : "primary", recipe, i % 3 === 0 ? 0.7 : 1));
		}
		shapes.push(fill(circle(CX, CY, 8), "secondary"));
		return shapes;
	},
	lens: ({ rng, recipe }) => {
		const dx = rng.range(14, 22);
		return [
			fill(`${circle(CX - dx / 2, CY, 30)}${circle(CX + dx / 2, CY, 30)}`, "primary", { evenOdd: true }),
			{ ...stroke(circle(CX - dx / 2, CY, 30), "primary", recipe, 0.9), opacity: 0.55 },
			{ ...stroke(circle(CX + dx / 2, CY, 30), "secondary", recipe, 0.9), opacity: 0.55 },
		];
	},
	lattice: ({ rng, recipe }) => {
		const shapes: Shape[] = [];
		const step = 26;
		const start = CX - step;
		for (let row = 0; row < 3; row += 1) {
			for (let col = 0; col < 3; col += 1) {
				if (rng.chance(0.28)) continue;
				const x = start + col * step;
				const y = start + row * step;
				shapes.push(fill(circle(x, y, 7), (row + col) % 2 === 0 ? "primary" : "secondary"));
			}
		}
		shapes.push(stroke(polyline([polar(CX, CY, 44, 135), polar(CX, CY, 44, -45)]), "accent", recipe, 0.4));
		return shapes;
	},
	ribbon: ({ recipe }) => [
		fill("M8 66C26 22 74 22 92 42C74 38 56 46 44 58C32 70 20 76 8 66Z", "primary"),
		fill("M12 34C30 60 62 62 82 54C66 74 28 76 12 34Z", "secondary", { opacity: 0.9 }),
		stroke("M8 66C26 22 74 22 92 42", "accent", recipe, 0.35),
	],
};

export const ABSTRACT_VARIANTS = Object.keys(abstractVariants);

/** Pick an abstract construction. `seedIndex` keeps variations visibly different. */
export function abstractMotif(name: string): MotifFn {
	return abstractVariants[name] ?? abstractVariants.slices;
}
