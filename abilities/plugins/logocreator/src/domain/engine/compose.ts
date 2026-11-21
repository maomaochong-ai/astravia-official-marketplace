import { resolvePalette, subjectFor, type BrandPalette } from "../color-plan";
import { mixHex } from "../palette";
import { createRng, hashSeed, type Rng } from "../prng";
import { normalizeSpec, type LogoSpec } from "../spec";
import { ABSTRACT_VARIANTS, MOTIFS, PICTORIAL_SUBJECTS, abstractMotif, type MotifFn, type Shape } from "./motifs";
import { polar, roundedRect } from "./geometry";
import { FONT_STACKS, recipeFor, type FontStackKey, type StyleRecipe } from "./style-recipes";
import { glyphBlock, initialsOf, isCjkGlyph } from "./glyphs";

/**
 * The composer: mark + typography + ornaments into one standalone SVG.
 *
 * Constraints that shaped this file:
 *  - one canvas (512 × 512) for every layout, so a favicon crop needs no special
 *    case and the gallery grid is uniform;
 *  - the mark is authored in a 0–100 box and placed by a transform, so a motif
 *    never has to know where it is going;
 *  - the SVG is self-contained (no external font, image or stylesheet), because
 *    it is what users export, print and paste into other tools.
 */

export const CANVAS = 512;

export interface RenderOptions {
	/** Draw only the mark — favicon, app icon, brand-kit mark file. */
	markOnly?: boolean;
	/** Override the surface fill (the on-dark / on-light kit variants). */
	surface?: string;
	/** Override every mark colour with one ink (the mono variant). */
	monoInk?: string;
	/** Extra entropy for gradient/filter ids so two SVGs never collide. */
	idSalt?: string;
}

export interface RenderedLogo {
	svg: string;
	/** The mark alone, same canvas. */
	markSvg: string;
	/** Which subject/construction the engine chose — shown in the UI and the kit. */
	subject: string;
	palette: BrandPalette;
}

interface Ctx {
	spec: LogoSpec;
	palette: BrandPalette;
	recipe: StyleRecipe;
	/** Colour that fills knockout/negative-space shapes. */
	paper: string;
	monoInk?: string;
	uid: string;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function colorFor(ctx: Ctx, role: Shape["role"]): string {
	if (ctx.monoInk) return ctx.monoInk;
	switch (role) {
		case "primary":
			return ctx.palette.primary;
		case "secondary":
			return ctx.palette.secondary;
		case "accent":
			return ctx.palette.accent;
		default:
			return ctx.paper;
	}
}

function gradientId(ctx: Ctx): string {
	return `grad-${ctx.uid}`;
}

function shapeToSvg(ctx: Ctx, shape: Shape): string {
	const paint = colorFor(ctx, shape.role);
	const usesGradient =
		ctx.recipe.gradient && !ctx.monoInk && (shape.role === "primary" || shape.role === "secondary");
	const paintValue = usesGradient ? `url(#${gradientId(ctx)})` : paint;
	const attrs: string[] = [`d="${shape.d}"`];
	if (shape.transform) attrs.push(`transform="${shape.transform}"`);
	if (shape.mode === "stroke") {
		attrs.push('fill="none"');
		attrs.push(`stroke="${paintValue}"`);
		attrs.push(`stroke-width="${shape.width ?? ctx.recipe.stroke}"`);
		attrs.push(`stroke-linecap="${shape.linecap ?? "round"}"`);
		attrs.push('stroke-linejoin="round"');
	} else {
		attrs.push(`fill="${paintValue}"`);
		attrs.push(`fill-rule="${shape.evenOdd ? "evenodd" : "nonzero"}"`);
	}
	if (shape.opacity !== undefined && shape.opacity < 1) attrs.push(`fill-opacity="${shape.opacity}"`);
	return `<path ${attrs.join(" ")}/>`;
}

function ornamentSvg(ctx: Ctx): string {
	const { ornament } = ctx.recipe;
	const tint = ctx.monoInk ?? ctx.palette.accent;
	if (ornament === "none") return "";
	if (ornament === "ring") {
		return `<circle cx="50" cy="50" r="47" fill="none" stroke="${tint}" stroke-width="1.6" stroke-opacity="0.55"/>`;
	}
	if (ornament === "double-ring") {
		return [
			`<circle cx="50" cy="50" r="48" fill="none" stroke="${tint}" stroke-width="1.2" stroke-opacity="0.7"/>`,
			`<circle cx="50" cy="50" r="44" fill="none" stroke="${tint}" stroke-width="0.6" stroke-opacity="0.5"/>`,
		].join("");
	}
	if (ornament === "rays") {
		return Array.from({ length: 24 }, (_, i) => {
			const angle = (360 / 24) * i;
			const inner = polar(50, 50, i % 2 === 0 ? 45 : 47.5, angle);
			const outer = polar(50, 50, 49, angle);
			return `<path d="M${inner.x} ${inner.y}L${outer.x} ${outer.y}" stroke="${tint}" stroke-width="0.9" stroke-opacity="0.45" stroke-linecap="round"/>`;
		}).join("");
	}
	// laurel
	const leaves: string[] = [];
	for (let i = 0; i < 5; i += 1) {
		for (const side of [-1, 1]) {
			const angle = side < 0 ? -150 + i * 22 : -30 - i * 22;
			const at = polar(50, 50, 46, angle);
			leaves.push(
				`<ellipse cx="${at.x}" cy="${at.y}" rx="3.4" ry="7" fill="${tint}" fill-opacity="0.7" transform="rotate(${angle + 90} ${at.x} ${at.y})"/>`,
			);
		}
	}
	return leaves.join("");
}

/** Initials drawn from the stroke alphabet, scaled into the mark box. */
function monogramSvg(ctx: Ctx, initials: string): string {
	const block = glyphBlock(initials, ctx.recipe.tracking * 0.5);
	if (!block) return "";
	const padding = 22;
	const scale = Math.min((100 - padding * 2) / block.width, (100 - padding * 2) / block.height);
	const width = block.width * scale;
	const height = block.height * scale;
	const originX = (100 - width) / 2;
	const originY = (100 - height) / 2;
	const strokeColor = ctx.monoInk ?? ctx.palette.primary;
	const strokeWidth = (ctx.recipe.stroke * 0.78) / scale;
	const glyphs = block.glyphs
		.map(
			(glyph) =>
				`<path d="${glyph.d}" transform="translate(${(originX + glyph.offset * scale).toFixed(2)} ${originY.toFixed(2)}) scale(${scale.toFixed(4)})"/>`,
		)
		.join("");
	return `<g fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round">${glyphs}</g>`;
}

/** CJK initials cannot come from the stroke alphabet; set them as text instead. */
function cjkInitialSvg(ctx: Ctx, initial: string): string {
	return `<text x="0" y="0" transform="translate(50 50)" text-anchor="middle" dominant-baseline="central" font-family='${FONT_STACKS.sans}' font-size="62" font-weight="600" fill="${ctx.monoInk ?? ctx.palette.primary}">${escapeXml(initial)}</text>`;
}

/** The frame a monogram sits in. Luxury already draws rings via its ornament. */
function monogramFrame(ctx: Ctx): string {
	if (ctx.recipe.ornament === "double-ring" || ctx.recipe.ornament === "ring") return "";
	const color = ctx.monoInk ?? ctx.palette.secondary;
	const radius = 26 * ctx.recipe.corner + 4;
	return `<path d="${roundedRect(8, 8, 84, 84, radius)}" fill="none" stroke="${color}" stroke-width="1.8" stroke-opacity="0.6"/>`;
}

/** 3D style: a stack of offset copies behind the mark, darkening with depth. */
function extrudeSvg(ctx: Ctx, shapes: readonly Shape[]): string {
	const depth = ctx.recipe.extrusion;
	if (depth <= 0) return "";
	const steps = 5;
	const layers: string[] = [];
	for (let step = steps; step >= 1; step -= 1) {
		const offset = (depth / steps) * step;
		const shade = mixHex(ctx.monoInk ?? ctx.palette.primary, "#08080A", Math.min(0.72, 0.24 + step * 0.09));
		const inner = shapes
			.map((shape) =>
				shape.mode === "stroke"
					? `<path d="${shape.d}" fill="none" stroke="${shade}" stroke-width="${shape.width ?? ctx.recipe.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
					: `<path d="${shape.d}" fill="${shade}" fill-rule="${shape.evenOdd ? "evenodd" : "nonzero"}"/>`,
			)
			.join("");
		layers.push(`<g transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)})">${inner}</g>`);
	}
	return layers.join("");
}

/**
 * Which construction the spec resolves to. Split from the drawing so the UI can
 * show "leaf" without building a whole SVG on every keystroke.
 */
export interface ResolvedMark {
	subject: string;
	/** null means the mark is drawn from the glyph alphabet. */
	motif: MotifFn | null;
}

export function resolveMark(input: Partial<LogoSpec>): ResolvedMark {
	const spec = normalizeSpec(input);
	if (spec.type === "monogram") return { subject: "monogram", motif: null };
	const brief = `${spec.brandName} ${spec.intent}`;
	const detected = subjectFor(brief);
	const abstractName = ABSTRACT_VARIANTS[hashSeed(`abstract:${spec.seed}:${brief}`) % ABSTRACT_VARIANTS.length];
	if (spec.type === "abstract" || !detected || !MOTIFS[detected]) {
		return { subject: `abstract:${abstractName}`, motif: abstractMotif(abstractName) };
	}
	return { subject: detected, motif: MOTIFS[detected] };
}

function buildMarkGroup(ctx: Ctx, rng: Rng): { inner: string; subject: string } {
	const spec = ctx.spec;
	const resolved = resolveMark(spec);

	if (resolved.motif === null) {
		const initials = initialsOf(spec.brandName || "A");
		const ornament = ornamentSvg(ctx);
		const body =
			initials && isCjkGlyph(initials)
				? cjkInitialSvg(ctx, initials)
				: `${monogramFrame(ctx)}${monogramSvg(ctx, initials || "A")}`;
		return { inner: `<g>${ornament}${body}</g>`, subject: resolved.subject };
	}

	const shapes = resolved.motif({ rng, recipe: ctx.recipe, detail: spec.detail });
	const body = shapes.map((shape) => shapeToSvg(ctx, shape)).join("");
	return {
		inner: `<g>${ornamentSvg(ctx)}${extrudeSvg(ctx, shapes)}${body}</g>`,
		subject: resolved.subject,
	};
}

interface TextPlan {
	lines: string[];
	fontSize: number;
	lineHeight: number;
	tracking: number;
}

/**
 * Advance width of a run, in em, for the chosen stack.
 *
 * A per-character average is wrong the moment a name is not pure Latin: a CJK
 * glyph advances a full em where a lowercase Latin letter advances about half.
 * Estimating by average would let a 12-character Chinese name compute a font size
 * that renders ~630 px wide inside a 512 px canvas — the type does not clip, it
 * just runs off the edge. Summing per glyph costs nothing and stays correct in
 * both scripts.
 */
function advanceEm(text: string, font: FontStackKey): number {
	let em = 0;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= 0x2e80) em += 1; // CJK, kana, hangul, full-width punctuation
		else if (char === " ") em += 0.28;
		else if (/[A-Z0-9]/.test(char)) em += font === "serif" ? 0.66 : 0.62;
		else if (/[a-z]/.test(char)) em += font === "serif" ? 0.5 : 0.52;
		else em += 0.36; // punctuation and symbols
	}
	return em;
}

/**
 * Fit the brand name into `availableWidth`. There is no font-metrics API inside
 * a pure-SVG generator, so the run is measured from `advanceEm` and the result is
 * clamped rather than trusted.
 */
function planWordmark(spec: LogoSpec, recipe: StyleRecipe, availableWidth: number, baseSize: number): TextPlan {
	const raw = spec.brandName || "Untitled";
	const text = recipe.uppercase ? raw.toUpperCase() : raw;
	const words = text.split(/\s+/).filter(Boolean);
	// CJK names have no spaces, so the multi-word policy never applies to them; the
	// size clamp is what keeps a long one inside the canvas.
	const lines = words.length > 1 && text.length > 16 ? balanceLines(words) : [text];
	const widest = lines.reduce((max, line) => Math.max(max, advanceEm(line, recipe.font)), 1);
	const longest = lines.reduce((max, line) => Math.max(max, [...line].length), 1);
	const trackingWidth = recipe.tracking * Math.max(0, longest - 1);
	const fitted = (availableWidth * 0.96) / (widest + trackingWidth);
	const fontSize = Math.max(18, Math.min(baseSize, fitted));
	return { lines, fontSize, lineHeight: fontSize * 1.16, tracking: recipe.tracking };
}

function balanceLines(words: string[]): string[] {
	let best = 1;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let split = 1; split < words.length; split += 1) {
		const first = words.slice(0, split).join(" ").length;
		const second = words.slice(split).join(" ").length;
		const score = Math.abs(first - second);
		if (score < bestScore) {
			bestScore = score;
			best = split;
		}
	}
	return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function textBlock(ctx: Ctx, plan: TextPlan, centerX: number, firstBaseline: number, color: string): string {
	const family = FONT_STACKS[ctx.recipe.font];
	const spacing = plan.tracking * plan.fontSize;
	// SVG adds the trailing letter-space after the last glyph, which drags a
	// middle-anchored run left by half a space. Compensate.
	const offset = spacing / 2;
	return plan.lines
		.map((line, index) => {
			const y = firstBaseline + index * plan.lineHeight;
			return `<text x="${(centerX + offset).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-family='${family}' font-size="${plan.fontSize.toFixed(2)}" font-weight="${ctx.recipe.weight}" letter-spacing="${spacing.toFixed(2)}" fill="${color}">${escapeXml(line)}</text>`;
		})
		.join("");
}

function taglineBlock(ctx: Ctx, centerX: number, baseline: number, size: number): string {
	if (!ctx.spec.tagline) return "";
	const color = ctx.monoInk ?? ctx.palette.muted;
	const family = FONT_STACKS[ctx.recipe.font];
	const value = ctx.recipe.uppercase ? ctx.spec.tagline.toUpperCase() : ctx.spec.tagline;
	const spacing = size * 0.14;
	return `<text x="${(centerX + spacing / 2).toFixed(2)}" y="${baseline.toFixed(2)}" text-anchor="middle" font-family='${family}' font-size="${size.toFixed(2)}" font-weight="500" letter-spacing="${spacing.toFixed(2)}" fill="${color}">${escapeXml(value)}</text>`;
}

function placeMark(inner: string, cx: number, cy: number, size: number): string {
	const scale = size / 100;
	return `<g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2).toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>`;
}

function badgeLayout(ctx: Ctx, markInner: string): string {
	const cx = CANVAS / 2;
	const cy = CANVAS / 2 - 8;
	const radius = 196;
	const ring = ctx.monoInk ?? ctx.palette.primary;
	const name = (ctx.spec.brandName || "BRAND").toUpperCase().slice(0, 26);
	const family = FONT_STACKS[ctx.recipe.font];
	const topArc = `M${cx - radius} ${cy}A${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
	const bottomArc = `M${cx - radius + 12} ${cy}A${radius - 12} ${radius - 12} 0 0 0 ${cx + radius - 12} ${cy}`;
	const parts = [
		`<circle cx="${cx}" cy="${cy}" r="${radius + 22}" fill="none" stroke="${ring}" stroke-width="3"/>`,
		`<circle cx="${cx}" cy="${cy}" r="${radius + 12}" fill="none" stroke="${ring}" stroke-width="1.2" stroke-opacity="0.55"/>`,
		`<defs><path id="arc-top-${ctx.uid}" d="${topArc}"/><path id="arc-bot-${ctx.uid}" d="${bottomArc}"/></defs>`,
		`<text font-family='${family}' font-size="30" font-weight="600" letter-spacing="${(30 * Math.max(0.1, ctx.recipe.tracking)).toFixed(2)}" fill="${ring}"><textPath href="#arc-top-${ctx.uid}" startOffset="50%" text-anchor="middle">${escapeXml(name)}</textPath></text>`,
		placeMark(markInner, cx, cy, 244),
	];
	if (ctx.spec.tagline) {
		parts.push(
			`<text font-family='${family}' font-size="19" font-weight="500" letter-spacing="4" fill="${ctx.monoInk ?? ctx.palette.muted}"><textPath href="#arc-bot-${ctx.uid}" startOffset="50%" text-anchor="middle">${escapeXml(ctx.spec.tagline.toUpperCase().slice(0, 30))}</textPath></text>`,
		);
	}
	return parts.join("");
}

function defsFor(ctx: Ctx): string {
	const { recipe, palette } = ctx;
	const gradient = recipe.gradient
		? `<linearGradient id="${gradientId(ctx)}" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="${ctx.monoInk ?? palette.primary}"/>
			<stop offset="0.55" stop-color="${ctx.monoInk ?? mixHex(palette.primary, palette.secondary, 0.6)}"/>
			<stop offset="1" stop-color="${ctx.monoInk ?? palette.secondary}"/>
		</linearGradient>`
		: "";
	const rough =
		recipe.wobble > 0
			? `<filter id="rough-${ctx.uid}" x="-14%" y="-14%" width="128%" height="128%">
				<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${ctx.spec.seed % 97}" result="noise"/>
				<feDisplacementMap in="SourceGraphic" in2="noise" scale="${(recipe.wobble * 1.6).toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>
			</filter>`
			: "";
	const grain = `<filter id="grain-${ctx.uid}" x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
			<feColorMatrix type="saturate" values="0"/>
		</filter>`;
	return `<defs>${gradient}${rough}${grain}</defs>`;
}

function textureOverlay(ctx: Ctx, rng: Rng): string {
	if (ctx.recipe.texture === "none") return "";
	if (ctx.recipe.texture === "grain") {
		return `<rect width="${CANVAS}" height="${CANVAS}" filter="url(#grain-${ctx.uid})" opacity="0.05"/>`;
	}
	// Retro's printer's rule sits under a stacked lockup only. An emblem already
	// fills the canvas, and a dot row behind its badge reads as a printing fault.
	if (ctx.spec.type === "emblem" || ctx.spec.type === "icon") return "";
	const color = ctx.monoInk ?? ctx.palette.accent;
	const jitter = rng.fork("dots");
	const dots: string[] = [];
	for (let row = 0; row < 2; row += 1) {
		for (let col = 0; col < 12; col += 1) {
			dots.push(
				`<circle cx="${(176 + col * 16 + jitter.range(-1.2, 1.2)).toFixed(1)}" cy="${(478 + row * 9).toFixed(1)}" r="${(2.2 - row * 0.7).toFixed(1)}" fill="${color}" fill-opacity="0.4"/>`,
			);
		}
	}
	return dots.join("");
}

function backgroundColor(ctx: Ctx): string {
	return ctx.paper ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${ctx.paper}"/>` : "";
}

export function renderLogo(input: Partial<LogoSpec>, options: RenderOptions = {}): RenderedLogo {
	const spec = normalizeSpec(input);
	const palette = resolvePalette(spec);
	const uid = `${(hashSeed(options.idSalt ?? `${spec.brandName}:${spec.seed}`) % 0xffffff).toString(36)}${(spec.seed % 997).toString(36)}`;
	const ctx: Ctx = {
		spec,
		palette,
		recipe: recipeFor(spec.style),
		paper: options.surface ?? palette.surface,
		monoInk: options.monoInk,
		uid,
	};

	const rng = createRng(`${spec.seed}:${spec.style}:${spec.type}:${spec.brandName}`);
	const { inner, subject } = buildMarkGroup(ctx, rng.fork("mark"));

	const body: string[] = [];
	if (!options.markOnly) body.push(backgroundColor(ctx));
	body.push(defsFor(ctx));

	if (options.markOnly) {
		body.push(placeMark(inner, CANVAS / 2, CANVAS / 2, CANVAS * 0.84));
	} else if (spec.type === "wordmark") {
		const plan = planWordmark(spec, ctx.recipe, CANVAS * 0.78, 96);
		const blockHeight = plan.lines.length * plan.lineHeight;
		const firstBaseline = (CANVAS - blockHeight) / 2 + plan.fontSize * 0.78;
		body.push(textBlock(ctx, plan, CANVAS / 2, firstBaseline, ctx.monoInk ?? palette.ink));
		const ruleY = firstBaseline + blockHeight - plan.fontSize * 0.42;
		body.push(
			`<path d="M${CANVAS / 2 - 62} ${ruleY.toFixed(1)}H${CANVAS / 2 + 62}" stroke="${ctx.monoInk ?? palette.primary}" stroke-width="3" stroke-linecap="round"/>`,
		);
		body.push(taglineBlock(ctx, CANVAS / 2, ruleY + 34, 15));
	} else if (spec.type === "emblem") {
		body.push(badgeLayout(ctx, inner));
	} else if (spec.type === "icon") {
		body.push(placeMark(inner, CANVAS / 2, CANVAS / 2, CANVAS * 0.74));
	} else {
		// icon-name / monogram / abstract: mark above, wordmark below.
		const markSize = CANVAS * 0.56;
		const markCenterY = CANVAS * 0.38;
		body.push(placeMark(inner, CANVAS / 2, markCenterY, markSize));
		const plan = planWordmark(spec, ctx.recipe, CANVAS * 0.8, 60);
		const baseline = markCenterY + markSize / 2 + plan.fontSize + 18;
		body.push(textBlock(ctx, plan, CANVAS / 2, baseline, ctx.monoInk ?? palette.ink));
		body.push(taglineBlock(ctx, CANVAS / 2, baseline + 32, 15));
		if (spec.detail === "detailed") {
			const ruleY = baseline + plan.fontSize * 0.5;
			body.push(
				`<path d="M${CANVAS / 2 - 26} ${ruleY.toFixed(1)}H${CANVAS / 2 + 26}" stroke="${ctx.monoInk ?? palette.primary}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.5"/>`,
			);
		}
	}

	body.push(textureOverlay(ctx, rng.fork("texture")));

	const label = escapeXml(spec.brandName || "Logo");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-label="${label}">${body.join("")}</svg>`;
	const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-label="${label} mark">${backgroundColor(ctx)}${defsFor(ctx)}${placeMark(inner, CANVAS / 2, CANVAS / 2, CANVAS * 0.84)}</svg>`;

	return { svg, markSvg, subject, palette };
}

/** Which subjects the library can draw — used by the agent tool and the UI. */
export function availableSubjects(): string[] {
	return [...PICTORIAL_SUBJECTS].sort();
}
