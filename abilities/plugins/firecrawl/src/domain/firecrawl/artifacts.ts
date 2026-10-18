/**
 * One page is not one artifact.
 *
 * A crawl returns records, but what a user re-uses afterwards is typed: the prose
 * of a page, the outbound links worth following, the images that were on it, the
 * media streams, the structured fields an extract produced. Splitting them here
 * keeps the request honest — the text-shaped artifacts are derived from the
 * Markdown the crawl always asks for, and richer ones (`links`, `summary`, `json`)
 * only reuse fields the caller already requested, so nothing here can push a
 * crawl against the host's 32 MiB response cap.
 *
 * Caps are deliberate: the artifacts are kept in the panel snapshot and written to
 * plugin storage, so a 500-page crawl must not turn into a 50 MB file.
 */

import type { ElementProfile } from "./profile";
import type { FirecrawlDocument } from "./types";

export const ARTIFACT_KINDS = [
	"markdown",
	"links",
	"images",
	"video",
	"audio",
	// Kept so a run archived before 0.4.2 still restores; nothing emits it now.
	"media",
	"json",
	"document",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface CrawlArtifact {
	id: string;
	kind: ArtifactKind;
	/** Page the artifact came from, or the submitted file path for documents. */
	source: string;
	title: string;
	/** Body for text-shaped artifacts, truncated to `MAX_TEXT_CHARS`. */
	text?: string;
	/** Entries for list-shaped artifacts, capped per kind. */
	items?: string[];
	bytes: number;
	at: number;
}

export interface ArtifactTotals {
	total: number;
	byKind: Record<ArtifactKind, number>;
	items: Record<ArtifactKind, number>;
	bytes: number;
}

/** Body kept per text artifact in the live snapshot. */
export const MAX_TEXT_CHARS = 8_000;
/** Items kept per list artifact in the live snapshot. */
export const MAX_LINK_ITEMS = 80;
export const MAX_IMAGE_ITEMS = 60;
export const MAX_MEDIA_ITEMS = 30;
/** How many artifacts one run may accumulate; older pages drop out of the shelf. */
export const MAX_ARTIFACTS = 400;

const LINK_PATTERN = /\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g;
const IMAGE_PATTERN = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g;
const SKIP_PREFIX = /^(#|data:|javascript:|mailto:|tel:)/i;

function absolute(raw: string, base: string): string | null {
	const value = raw.trim().replace(/[)"']+$/, "");
	if (!value || SKIP_PREFIX.test(value)) return null;
	try {
		const url = new URL(value, base);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).length;
}

function unique(values: readonly (string | null)[], cap: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		if (!value || seen.has(value)) continue;
		seen.add(value);
		out.push(value);
		if (out.length >= cap) break;
	}
	return out;
}

function imageUrl(entry: unknown): string | null {
	if (typeof entry === "string") return entry;
	if (entry && typeof entry === "object") {
		const record = entry as Record<string, unknown>;
		const candidate = record.imageUrl ?? record.url ?? record.src;
		if (typeof candidate === "string") return candidate;
	}
	return null;
}

function markdownMatches(pattern: RegExp, markdown: string): string[] {
	const out: string[] = [];
	pattern.lastIndex = 0;
	let match: RegExpExecArray | null = pattern.exec(markdown);
	while (match) {
		out.push(match[1]);
		match = pattern.exec(markdown);
	}
	return out;
}

/** Outbound links: the API's own `links` array when present, else the Markdown. */
export function linkItems(document: FirecrawlDocument, markdown: string, base: string): string[] {
	const provided = Array.isArray(document.links)
		? document.links.map((entry) => (typeof entry === "string" ? entry : null))
		: [];
	const source = provided.length > 0 ? provided : markdownMatches(LINK_PATTERN, markdown);
	const images = new Set(
		(Array.isArray(document.images) ? document.images : markdownMatches(IMAGE_PATTERN, markdown))
			.map((entry) => absolute(imageUrl(entry) ?? "", base))
			.filter((entry): entry is string => Boolean(entry)),
	);
	return unique(
		source.map((entry) => absolute(entry ?? "", base)).filter((entry) => entry && !images.has(entry)),
		MAX_LINK_ITEMS,
	);
}

/**
 * Images: the API's array, the Markdown embeds, the page's own social image, and
 * the rendered screenshot when upstream stored it as a URL.
 *
 * The screenshot lands here rather than in a kind of its own: the crawled record
 * only carries a hosted image link, which is exactly what this list is for.
 */
export function imageItems(document: FirecrawlDocument, markdown: string, base: string): string[] {
	const provided = Array.isArray(document.images) ? document.images.map(imageUrl) : [];
	const metadata = document.metadata ?? {};
	const social = [metadata.ogImage, metadata["og:image"], metadata.twitterImage].filter(
		(entry): entry is string => typeof entry === "string" && entry.length > 0,
	);
	const shots = Array.isArray(document.actions?.screenshots) ? document.actions.screenshots : [];
	const screenshot = typeof document.screenshot === "string" && document.screenshot ? [document.screenshot] : [];
	return unique(
		[...provided, ...markdownMatches(IMAGE_PATTERN, markdown), ...social, ...screenshot, ...shots]
			.map((entry) => absolute(entry ?? "", base))
			.filter((entry): entry is string => Boolean(entry)),
		MAX_IMAGE_ITEMS,
	);
}

function textArtifact(
	kind: ArtifactKind,
	source: string,
	title: string,
	text: string,
	at: number,
): CrawlArtifact | null {
	if (!text.trim()) return null;
	const kept = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
	return {
		id: `${kind}:${source}`,
		kind,
		source,
		title,
		text: kept,
		bytes: byteLength(kept),
		at,
	};
}

function listArtifact(
	kind: ArtifactKind,
	source: string,
	title: string,
	items: string[],
	at: number,
): CrawlArtifact | null {
	if (items.length === 0) return null;
	return {
		id: `${kind}:${source}`,
		kind,
		source,
		title,
		items,
		bytes: byteLength(items.join("\n")),
		at,
	};
}

/** Formats that return records rather than prose, collected into one JSON artifact. */
const STRUCTURED_KEYS = [
	"branding",
	"product",
	"menu",
	"tools",
	"blocks",
	"attributes",
	"actions",
	"answer",
	"highlights",
	"accounting",
] as const;

export function structuredExtras(document: FirecrawlDocument): Record<string, unknown> | null {
	const out: Record<string, unknown> = {};
	for (const key of STRUCTURED_KEYS) {
		const value = document[key];
		if (value === undefined || value === null || value === "") continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[key] = value;
	}
	return Object.keys(out).length > 0 ? out : null;
}

/**
 * Every artifact one crawled page produced.
 *
 * `elements` is the profile the store already computed; reusing it keeps the
 * media list and the spider's element counts describing the same parse.
 */
export function pageArtifacts(
	document: FirecrawlDocument,
	options: { source: string; title: string; elements: ElementProfile; at: number },
): CrawlArtifact[] {
	const { source, title, elements, at } = options;
	const markdown = typeof document.markdown === "string" ? document.markdown : "";
	const out: CrawlArtifact[] = [];

	const prose = textArtifact("markdown", source, title, markdown, at);
	if (prose) out.push(prose);

	const links = listArtifact("links", source, title, linkItems(document, markdown, source), at);
	if (links) out.push(links);

	const images = listArtifact("images", source, title, imageItems(document, markdown, source), at);
	if (images) out.push(images);

	// Video and audio are separate kinds because they are separate deliverables: a
	// crawl page usually has one or the other, and a merged list forces the reader to
	// pick the extension out of the URL to know what they are looking at.
	const video = listArtifact(
		"video",
		source,
		title,
		unique(
			elements.media.filter((ref) => ref.kind === "video").map((ref) => ref.url),
			MAX_MEDIA_ITEMS,
		),
		at,
	);
	if (video) out.push(video);

	const audio = listArtifact(
		"audio",
		source,
		title,
		unique(
			elements.media.filter((ref) => ref.kind === "audio").map((ref) => ref.url),
			MAX_MEDIA_ITEMS,
		),
		at,
	);
	if (audio) out.push(audio);

	const structured = document.json ?? document.extract ?? document.summary;
	if (structured !== undefined && structured !== null && structured !== "") {
		const text = textArtifact(
			"json",
			source,
			title,
			typeof structured === "string" ? structured : JSON.stringify(structured, null, 2),
			at,
		);
		if (text) out.push(text);
	} else {
		const extras = structuredExtras(document);
		if (extras) {
			const text = textArtifact("json", source, title, JSON.stringify(extras, null, 2), at);
			if (text) out.push(text);
		}
	}

	return out;
}

/**
 * A parsed upload: one artifact, because the payload is the point and there is no
 * page topology to split it against.
 */
export function documentArtifact(
	name: string,
	document: FirecrawlDocument,
	at: number,
): CrawlArtifact | null {
	const markdown = typeof document.markdown === "string" ? document.markdown : "";
	const fallback = typeof document.html === "string" ? document.html : "";
	const text = markdown || fallback;
	if (!text.trim()) return null;
	const kept = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
	return {
		id: `document:${name}:${at}`,
		kind: "document",
		source: name,
		title: name,
		text: kept,
		bytes: byteLength(kept),
		at,
	};
}

export function emptyTotals(): ArtifactTotals {
	const zero = Object.fromEntries(ARTIFACT_KINDS.map((kind) => [kind, 0])) as Record<ArtifactKind, number>;
	return { total: 0, byKind: { ...zero }, items: { ...zero }, bytes: 0 };
}

/** Counts for the shelf header and the spider legend. */
export function artifactTotals(artifacts: readonly CrawlArtifact[]): ArtifactTotals {
	const totals = emptyTotals();
	for (const artifact of artifacts) {
		totals.total += 1;
		totals.byKind[artifact.kind] += 1;
		totals.items[artifact.kind] += artifact.items?.length ?? 1;
		totals.bytes += artifact.bytes;
	}
	return totals;
}

/** Everything a list artifact holds, as one exportable document. */
export function artifactText(artifact: CrawlArtifact): string {
	if (artifact.text) return artifact.text;
	return (artifact.items ?? []).join("\n");
}

export function artifactExtension(kind: ArtifactKind): string {
	if (kind === "json") return "json";
	if (["links", "images", "media", "video", "audio"].includes(kind)) return "txt";
	if (kind === "document") return "md";
	return "md";
}
