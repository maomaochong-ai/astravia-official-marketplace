import { resolvePalette } from "../color-plan";
import { AUTO, type LogoSpec } from "../spec";
import { recipeFor } from "../engine/style-recipes";

/**
 * Text-to-image prompt, built from the same spec the local engine renders.
 *
 * Upstream's prompt builder is the reference for structure: subject first, then
 * composition rules, then hard negatives. Keeping it here (rather than inline in
 * the client) means the prompt can be shown to the user before it is spent on a
 * paid generation.
 */

const STYLE_PROMPTS: Record<string, string> = {
	minimal: "minimal vector logo, generous negative space, one simple shape, thick uniform strokes",
	geometric: "geometric logo built from precise polygons on a strict grid, sharp corners, exact symmetry",
	gradient: "logo with a smooth modern gradient across the mark, vibrant but controlled, flat vector",
	mascot: "friendly mascot logo, rounded character mark, big simple eyes, charming and approachable",
	"hand-drawn": "hand-drawn logo, slightly irregular ink strokes, warm and human, not mechanical",
	luxury: "luxury logo, thin elegant strokes, high-contrast serif feel, restrained metallic accent",
	retro: "retro badge logo, vintage badge outline, mid-century proportions, warm muted inks",
	"3d": "three-dimensional logo mark, soft glossy volume, subtle depth and highlight, still clean",
};

const TYPE_PROMPTS: Record<string, string> = {
	"icon-name": "a simple pictorial symbol",
	icon: "a single pictorial symbol only",
	wordmark: "a typographic logotype",
	monogram: "a geometric monogram of the initials",
	emblem: "an enclosed emblem with a circular badge",
	abstract: "an abstract geometric mark",
};

export function buildLogoPrompt(spec: LogoSpec): string {
	const palette = resolvePalette(spec);
	const recipe = recipeFor(spec.style);
	const parts: string[] = [];

	const subject = TYPE_PROMPTS[spec.type] ?? TYPE_PROMPTS["icon-name"];
	parts.push(`A professional logo. ${subject.charAt(0).toUpperCase()}${subject.slice(1)} for a brand called "${spec.brandName || "the brand"}".`);
	parts.push(STYLE_PROMPTS[spec.style] ?? STYLE_PROMPTS.minimal);

	if (spec.intent.trim()) parts.push(`Subject: ${spec.intent.trim()}.`);

	if (spec.monochrome) {
		parts.push("Single colour only, one flat ink on a plain background.");
	} else {
		const primary = spec.primary !== AUTO ? `Primary colour ${spec.primary}` : `Primary colour ${palette.primary}`;
		parts.push(`${primary}, with ${palette.secondary} as a supporting tone.`);
	}

	const detail =
		spec.detail === "minimal"
			? "Very few elements; readable at 16 px."
			: spec.detail === "detailed"
				? "Moderate detail, still legible at small sizes."
				: "Balanced detail; clean at both large and small sizes.";
	parts.push(detail);

	parts.push(
		[
			"Centred composition with even margins, flat background, no photograph.",
			"Vector-like clean edges, no texture noise, no drop shadow unless the style calls for depth.",
			spec.type === "icon" || spec.type === "icon-name" || spec.type === "abstract"
				? "No lettering, no words, no numbers, no watermark."
				: "Only the wording described; no extra words, no watermark.",
			"Not a mockup, not a business card, no frame.",
		].join(" "),
	);

	void recipe;
	return parts.join("\n\n");
}
