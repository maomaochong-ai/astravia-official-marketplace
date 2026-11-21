import { resolvePalette, subjectFor } from "./color-plan";
import { AUTO, normalizeSpec, type LogoSpec } from "./spec";
import { hashSeed } from "./prng";

/**
 * The offline composer: a brief in, concrete specs out.
 *
 * This is the piece that makes the plugin work **without any image model**, which is
 * the whole reason the reference design plugin can design with nothing but the
 * host's text model: the model's job is to choose fields, and a local engine draws
 * them. Here the choosing is deterministic and offline, so even a text-only host
 * session — or a user with no image provider connected — gets real proposals instead
 * of a disabled button.
 *
 * The planner is deliberately explainable: every candidate carries the reason its
 * fields were chosen, so the agent (or the user) can argue with it instead of
 * accepting a black box.
 */

export interface PlanCandidate {
	spec: LogoSpec;
	type: string;
	style: string;
	subject: string;
	/** One line: why these fields. */
	rationale: string;
}

const STYLE_BY_SECTOR: { match: RegExp; style: LogoSpec["style"]; note: string }[] = [
	{ match: /cafe|coffee|tea|bakery|bread|food|restaurant|kitchen|bar\b/i, style: "hand-drawn", note: "food reads as handmade" },
	{ match: /law|legal|attorney|finance|bank|invest|consult|audit/i, style: "luxury", note: "formal sectors read thin strokes as authority" },
	{ match: /tech|software|data|cloud|api|platform|dev|ai\b|saas/i, style: "geometric", note: "technical buyers read precision" },
	{ match: /game|esport|toy|kids|play|festival|event/i, style: "3d", note: "playful sectors tolerate volume" },
	{ match: /beauty|cosmetic|jewel|hotel|spa|perfume|boutique/i, style: "luxury", note: "hairline strokes and wide tracking read premium" },
	{ match: /gym|fitness|sport|run|train|athlet|energy/i, style: "minimal", note: "sport needs a mark that survives motion" },
	{ match: /organic|eco|farm|garden|plant|forest|sustain/i, style: "minimal", note: "organic claims are made with restraint" },
	{ match: /music|studio|podcast|record|band/i, style: "gradient", note: "audio brands can carry tonal movement" },
	{ match: /photo|film|camera|studio|design|art/i, style: "minimal", note: "visual trades cannot out-decorate their own work" },
	{ match: /retro|vintage|classic|1960|1970|1980/i, style: "retro", note: "the brief asked for it" },
];

const TYPE_BY_USE: { match: RegExp; type: LogoSpec["type"]; note: string }[] = [
	{ match: /app|icon|avatar|favicon|profile/i, type: "icon", note: "the brief mentions an icon-sized surface" },
	{ match: /packag|label|bottle|can\b|sticker|badge|seal/i, type: "emblem", note: "a container wants an enclosed badge" },
	{ match: /restaurant|bar|cafe|hotel|club|estate|law|brewery/i, type: "emblem", note: "hospitality and heritage use badges" },
	{ match: /book|publish|magazine|editorial|type|word/i, type: "wordmark", note: "the name itself is the asset" },
];

/**
 * Intent clues take precedence over sector guesses: if the user already said
 * "a leaf mark", the design must be a leaf, whatever industry they are in.
 */
function subjectForBrief(brief: string): string | null {
	return subjectFor(brief);
}

function pickStyle(brief: string): { style: LogoSpec["style"]; note: string } {
	for (const rule of STYLE_BY_SECTOR) {
		if (rule.match.test(brief)) return { style: rule.style, note: rule.note };
	}
	return { style: "minimal", note: "no sector cue in the brief, so the safest register" };
}

function pickType(brief: string): { type: LogoSpec["type"]; note: string } {
	for (const rule of TYPE_BY_USE) {
		if (rule.match.test(brief)) return { type: rule.type, note: rule.note };
	}
	return { type: "icon-name", note: "default lockup: a mark plus the name" };
}

function pickDetail(brief: string): LogoSpec["detail"] {
	if (/minimal|simple|clean|quiet|calm|plain/i.test(brief)) return "minimal";
	if (/ornate|detail|rich|vintage|complex|intricate/i.test(brief)) return "detailed";
	return "balanced";
}

/**
 * Three candidates that differ in a way a person can actually choose between:
 * same subject, different structure — not three random seeds of one idea.
 */
export function planFromBrief(brief: string, options: { brandName?: string; count?: number } = {}): PlanCandidate[] {
	const text = brief.trim();
	const brandName = (options.brandName ?? extractBrandName(text)).slice(0, 48);
	const subject = subjectForBrief(text);
	const style = pickStyle(text);
	const preferredType = pickType(text);
	const detail = pickDetail(text);
	const count = Math.max(1, Math.min(3, options.count ?? 3));

	const types: LogoSpec["type"][] = [preferredType.type, "icon-name", "emblem", "wordmark", "abstract"];
	const ordered = [...new Set(types)].slice(0, count);

	return ordered.map((type, index) => {
		const seed = hashSeed(`${brandName}|${text}|${index}`) % 100000;
		const spec = normalizeSpec({
			brandName,
			type,
			style: index === ordered.length - 1 && ordered.length > 1 ? alternateStyle(style.style) : style.style,
			detail: index === 0 ? detail : "balanced",
			primary: AUTO,
			intent: subject ? `${subject} — ${text}` : text,
			seed,
		});
		const palette = resolvePalette(spec);
		return {
			spec,
			type,
			style: spec.style,
			subject: subject ?? "abstract",
			rationale: [
				type === preferredType.type ? preferredType.note : `a ${type} alternative to the usual lockup`,
				spec.style === style.style ? style.note : `a ${spec.style} take, for contrast`,
				`colour derived from the brief: ${palette.primary}`,
			].join("; "),
		};
	});
}

function alternateStyle(style: LogoSpec["style"]): LogoSpec["style"] {
	const cycle: Record<string, LogoSpec["style"]> = {
		minimal: "geometric",
		geometric: "minimal",
		"hand-drawn": "retro",
		retro: "hand-drawn",
		luxury: "minimal",
		gradient: "minimal",
		"3d": "gradient",
		mascot: "hand-drawn",
	};
	return cycle[style] ?? "minimal";
}

/** "Logo for Kettle Lane, a coffee roastery" → "Kettle Lane". */
export function extractBrandName(brief: string): string {
	const quoted = /["“'']([^"”'']{2,48})["”'']/.exec(brief);
	if (quoted) return quoted[1].trim();
	// A brand name may contain connectors: "Fern & Field", "Moss and Pine", "A/B Co."
	const forMatch = /\b(?:for|called|named|叫做|名为)\s+([A-Z][\w'’.-]*(?:\s+(?:&|and|of|de|la|the|[A-Z])[\w&'’.-]*){0,4})/.exec(brief);
	if (forMatch) return forMatch[1].trim();
	// Longest alternative first: `品牌名[是]?` would otherwise eat only 「品牌名」 and
	// leave 「叫做…」 inside the captured name.
	const cjk = /(?:品牌名\s*(?:叫做|名为|是)?|叫做|名为)\s*([\u4e00-\u9fa5A-Za-z0-9]{2,16})/.exec(brief);
	if (cjk) return cjk[1];
	return "";
}

