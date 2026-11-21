import type { DetailLevel, LogoType, StyleId } from "./spec";

/**
 * User-facing catalogues. Labels are i18n keys (see `locales/*.json`); the engine
 * reads only ids. Keeping the two apart is what lets the visual recipes change
 * without touching copy, and the copy be translated without touching geometry.
 */

export interface TypeEntry {
	id: LogoType;
	labelKey: string;
	hintKey: string;
	/** Structural description shown under the picker. */
	structureKey: string;
}

export const TYPE_ENTRIES: readonly TypeEntry[] = [
	{
		id: "icon-name",
		labelKey: "type.iconName",
		hintKey: "type.iconName.hint",
		structureKey: "type.iconName.structure",
	},
	{ id: "icon", labelKey: "type.icon", hintKey: "type.icon.hint", structureKey: "type.icon.structure" },
	{ id: "wordmark", labelKey: "type.wordmark", hintKey: "type.wordmark.hint", structureKey: "type.wordmark.structure" },
	{ id: "monogram", labelKey: "type.monogram", hintKey: "type.monogram.hint", structureKey: "type.monogram.structure" },
	{ id: "emblem", labelKey: "type.emblem", hintKey: "type.emblem.hint", structureKey: "type.emblem.structure" },
	{ id: "abstract", labelKey: "type.abstract", hintKey: "type.abstract.hint", structureKey: "type.abstract.structure" },
];

export interface StyleEntry {
	id: StyleId;
	labelKey: string;
	hintKey: string;
}

export const STYLE_ENTRIES: readonly StyleEntry[] = [
	{ id: "minimal", labelKey: "style.minimal", hintKey: "style.minimal.hint" },
	{ id: "geometric", labelKey: "style.geometric", hintKey: "style.geometric.hint" },
	{ id: "gradient", labelKey: "style.gradient", hintKey: "style.gradient.hint" },
	{ id: "mascot", labelKey: "style.mascot", hintKey: "style.mascot.hint" },
	{ id: "hand-drawn", labelKey: "style.handDrawn", hintKey: "style.handDrawn.hint" },
	{ id: "luxury", labelKey: "style.luxury", hintKey: "style.luxury.hint" },
	{ id: "retro", labelKey: "style.retro", hintKey: "style.retro.hint" },
	{ id: "3d", labelKey: "style.threeD", hintKey: "style.threeD.hint" },
];

export const DETAIL_ENTRIES: readonly { id: DetailLevel; labelKey: string }[] = [
	{ id: "minimal", labelKey: "detail.minimal" },
	{ id: "balanced", labelKey: "detail.balanced" },
	{ id: "detailed", labelKey: "detail.detailed" },
];

export const BRAND_COLORS: readonly { nameKey: string; hex: string }[] = [
	{ nameKey: "color.blue", hex: "#2F6FF5" },
	{ nameKey: "color.red", hex: "#E5484D" },
	{ nameKey: "color.green", hex: "#30A46C" },
	{ nameKey: "color.amber", hex: "#E8A33D" },
	{ nameKey: "color.violet", hex: "#7C5CF0" },
	{ nameKey: "color.teal", hex: "#12938C" },
];

export interface StarterPreset {
	id: string;
	labelKey: string;
	type: LogoType;
	style: StyleId;
	detail: DetailLevel;
	intent: string;
	surface: "light" | "dark";
}

/**
 * One tap seeds the whole form. Brand colour stays `auto` on purpose: a preset
 * that also pinned the palette would make every "Coffee" logo the same logo.
 */
export const STARTER_PRESETS: readonly StarterPreset[] = [
	{
		id: "tech",
		labelKey: "preset.tech",
		type: "icon-name",
		style: "geometric",
		detail: "balanced",
		intent: "a clean geometric mark suggesting connection, speed and reliability",
		surface: "light",
	},
	{
		id: "coffee",
		labelKey: "preset.coffee",
		type: "icon-name",
		style: "hand-drawn",
		detail: "balanced",
		intent: "a warm hand-drawn coffee cup with rising steam, cozy and artisanal",
		surface: "light",
	},
	{
		id: "fitness",
		labelKey: "preset.fitness",
		type: "icon-name",
		style: "minimal",
		detail: "balanced",
		intent: "a bold dynamic mark suggesting motion, energy and strength",
		surface: "dark",
	},
	{
		id: "finance",
		labelKey: "preset.finance",
		type: "emblem",
		style: "luxury",
		detail: "balanced",
		intent: "a refined emblem suggesting trust, stability and growth",
		surface: "light",
	},
	{
		id: "beauty",
		labelKey: "preset.beauty",
		type: "icon-name",
		style: "luxury",
		detail: "minimal",
		intent: "an elegant minimal floral mark, soft, premium and refined",
		surface: "light",
	},
	{
		id: "food",
		labelKey: "preset.food",
		type: "emblem",
		style: "retro",
		detail: "detailed",
		intent: "a vintage restaurant badge, appetizing, classic and crafted",
		surface: "light",
	},
	{
		id: "eco",
		labelKey: "preset.eco",
		type: "icon-name",
		style: "minimal",
		detail: "minimal",
		intent: "a simple leaf-based mark, organic, calm and sustainable",
		surface: "light",
	},
	{
		id: "gaming",
		labelKey: "preset.gaming",
		type: "icon-name",
		style: "3d",
		detail: "detailed",
		intent: "a bold three-dimensional emblem with energy, edge and a futuristic feel",
		surface: "dark",
	},
	{
		id: "law",
		labelKey: "preset.law",
		type: "monogram",
		style: "luxury",
		detail: "balanced",
		intent: "a classic monogram, authoritative, timeless and trustworthy",
		surface: "light",
	},
	{
		id: "creative",
		labelKey: "preset.creative",
		type: "abstract",
		style: "gradient",
		detail: "balanced",
		intent: "a vibrant gradient abstract mark, playful, bold and modern",
		surface: "light",
	},
	{
		id: "realestate",
		labelKey: "preset.realestate",
		type: "icon-name",
		style: "minimal",
		detail: "balanced",
		intent: "a clean architectural mark suggesting property, trust and modern living",
		surface: "light",
	},
	{
		id: "photo",
		labelKey: "preset.photo",
		type: "icon-name",
		style: "minimal",
		detail: "minimal",
		intent: "a sleek minimal aperture or lens mark, sharp and professional",
		surface: "dark",
	},
	{
		id: "music",
		labelKey: "preset.music",
		type: "abstract",
		style: "gradient",
		detail: "balanced",
		intent: "a vibrant abstract sound-wave mark, energetic and rhythmic",
		surface: "dark",
	},
	{
		id: "travel",
		labelKey: "preset.travel",
		type: "icon-name",
		style: "hand-drawn",
		detail: "balanced",
		intent: "a friendly mark evoking journeys, destinations and adventure",
		surface: "light",
	},
];

/**
 * Keyword → subject. The keyword that appears **earliest** in the brief wins, not
 * the one listed first: a brief reads front-to-back, so "leaf mark for a bakery"
 * means a leaf, and "photography studio lens" means a lens. Each value is a
 * pictogram the engine can draw.
 */
export const SUBJECT_KEYWORDS: readonly (readonly [RegExp, string])[] = [
	[/coffee|cafe|café|espresso|roast|brew|tea\b|teahouse|matcha/i, "cup"],
	[/flame|fire\b|ember|blaze|baker|bread|pastry|patisserie|grill|barbecue|smoke/i, "flame"],
	[/leaf|eco\b|green|organic|garden|plant|botanic|forest|sustainab|farm|herb|nursery/i, "leaf"],
	[/wave|sea\b|ocean|river|lake|tide|surf|marine|aqua|hydro|water|coast/i, "wave"],
	[/mountain|peak|alpine|summit|ridge|trail|outdoor|hike|climb/i, "mountain"],
	[/\bsun\b|solar|daylight|dawn|sunrise|sunshine/i, "sun"],
	[/\bmoon\b|lunar|midnight|\bnight\b|sleep|dream|calm/i, "moon"],
	[/\bhome\b|\bhouse\b|estate|propert|realty|dwelling|\bnest\b|roof|residen/i, "house"],
	[/\blaw\b|legal|justice|attorney|counsel|\bcourt\b|pillar|\bcolumn\b|notary/i, "pillar"],
	[/health|clinic|medical|wellness|therap|pharma|heal|doctor|dental/i, "cross"],
	[/music|sound|audio|\beat\b|melody|song|lyric|listen|podcast/i, "note"],
	[/photo|camera|lens|aperture|optic|shutter|\bfilm\b|cinema/i, "aperture"],
	[/travel|flight|\bair\b|plane|wing|aviation|tour|voyage|\bjet\b/i, "wing"],
	[/\bpets?\b|\bdog\b|\bcat\b|paw|animal|\bvet\b|hound|puppy|kitten/i, "paw"],
	[/fox|owl|bird|bear|wolf|crane|mascot|dragon|\bbee\b|panda|rabbit/i, "creature"],
	[/\bcode\b|\bdev\b|software|\bstack\b|\bapi\b|cloud|server|\bdata\b|byte|engine|hexagon/i, "hex"],
	[/secur|shield|guard|defen|trust|vault|protect|privacy/i, "shield"],
	[/\bstar\b|spark|sparkle|magic|\bnova\b|\bwish\b|shine/i, "spark"],
	[/\bdrop\b|drop\b|\brain\b|purity|juice|drink|bottle|hydrat/i, "droplet"],
	[/\bbook\b|\bread\b|library|\bpage\b|story|publish|study|manuscript/i, "book"],
	[/compass|navigat|\bway\b|route|\bmap\b|direction|wayfind/i, "compass"],
	[/\bgear\b|\bcog\b|machine|industrial|workshop|forge|maker|craft beer/i, "gear"],
	[/heart|\blove\b|kindness|charity|\bhuman\b|donat/i, "heart"],
	[/orbit|\bspace\b|cosmos|galaxy|satellite|\bloop\b|\bcycle\b/i, "orbit"],
	[/\blink\b|connect|\bnode\b|network|\bchain\b|bridge|integr/i, "link"],
	[/knot|weave|\bcraft\b|atelier|textile|knit/i, "knot"],
];

export const BRAND_IMPORT_ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
