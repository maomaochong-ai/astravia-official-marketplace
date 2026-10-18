/**
 * Derived per-page structure, computed from the Markdown the API returns.
 *
 * The console shows element counts and media that the upstream document already
 * contains; nothing here fetches or parses HTML, it only reads the text.
 */

import type { FirecrawlDocument } from "./types";

export type MediaKind = "image" | "video" | "audio";

export interface MediaRef {
	url: string;
	kind: MediaKind;
	label?: string;
	/** HLS/DASH manifest: playable in a browser, not a downloadable file. */
	manifest?: boolean;
	streamed?: boolean;
	poster?: string;
}

export interface ElementProfile {
	headings: number;
	paragraphs: number;
	links: number;
	images: number;
	videos: number;
	audio: number;
	code: number;
	lists: number;
	tables: number;
	chars: number;
	media: MediaRef[];
	streamed: number;
}

export interface ElementTotals {
	headings: number;
	paragraphs: number;
	links: number;
	images: number;
	videos: number;
	audio: number;
	code: number;
	lists: number;
	tables: number;
	media: MediaRef[];
	streamed: number;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"];
const MANIFEST_EXTENSIONS = [".m3u8", ".mpd"];

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
const LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

function extensionOf(url: string): string {
	try {
		const path = new URL(url).pathname.toLowerCase();
		const dot = path.lastIndexOf(".");
		return dot >= 0 ? path.slice(dot) : "";
	} catch {
		return "";
	}
}

export function mediaKind(url: string): MediaKind | "manifest" | null {
	const extension = extensionOf(url);
	if (MANIFEST_EXTENSIONS.includes(extension)) return "manifest";
	if (VIDEO_EXTENSIONS.includes(extension)) return "video";
	if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
	return null;
}

function pushMedia(target: Map<string, MediaRef>, ref: MediaRef): void {
	if (!ref.url || target.has(ref.url)) return;
	target.set(ref.url, ref);
}

/** Media the page references directly (images in Markdown, video/audio fields). */
export function collectMedia(document: FirecrawlDocument): MediaRef[] {
	const found = new Map<string, MediaRef>();
	const markdown = document.markdown ?? "";
	for (const match of markdown.matchAll(IMAGE_PATTERN)) {
		pushMedia(found, { url: match[2], kind: "image", label: match[1] || undefined });
	}
	for (const match of markdown.matchAll(LINK_PATTERN)) {
		const url = match[1];
		const kind = mediaKind(url);
		if (kind === "video") pushMedia(found, { url, kind: "video" });
		else if (kind === "audio") pushMedia(found, { url, kind: "audio" });
		else if (kind === "manifest") pushMedia(found, { url, kind: "video", manifest: true, streamed: true });
	}
	for (const image of document.images ?? []) pushMedia(found, { url: image, kind: "image" });

	const videos: string[] = [];
	if (typeof document.video === "string" && document.video.length > 0) videos.push(document.video);
	for (const entry of document.videos ?? []) {
		if (typeof entry === "string") videos.push(entry);
		else if (entry && typeof entry === "object") {
			const record = entry as Record<string, unknown>;
			const url = record.url ?? record.src;
			if (typeof url === "string") {
				videos.push(url);
				if (typeof record.poster === "string") pushMedia(found, { url, kind: "video", poster: record.poster });
			}
		}
	}
	for (const url of videos) {
		const manifest = extensionOf(url) === ".m3u8" || extensionOf(url) === ".mpd";
		pushMedia(found, { url, kind: "video", manifest: manifest || undefined, streamed: manifest || undefined });
	}
	if (typeof document.audio === "string" && document.audio.length > 0) {
		pushMedia(found, { url: document.audio, kind: "audio" });
	}
	return [...found.values()].slice(0, 60);
}

export function profileDocument(document: FirecrawlDocument): ElementProfile {
	const markdown = document.markdown ?? "";
	const media = collectMedia(document);
	const count = (kind: MediaKind): number => media.filter((ref) => ref.kind === kind).length;
	const lines = markdown.split("\n");
	const headings = lines.filter((line) => /^#{1,6}\s+\S/.test(line)).length;
	const paragraphs = markdown
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0 && !block.startsWith("#") && !block.startsWith("```") && !block.startsWith("|")).length;
	const links = [...markdown.matchAll(LINK_PATTERN)].length;
	const code = Math.floor((markdown.match(/^```/gm) ?? []).length / 2);
	const lists = lines.filter((line) => /^\s*([-*+]|\d+\.)\s+\S/.test(line)).length;
	const tables = Math.floor(lines.filter((line) => /^\s*\|.*\|\s*$/.test(line)).length / 2);

	return {
		headings,
		paragraphs,
		links,
		images: count("image"),
		videos: count("video"),
		audio: count("audio"),
		code,
		lists,
		tables,
		chars: markdown.length,
		media,
		streamed: media.filter((ref) => ref.manifest).length,
	};
}

export const EMPTY_ELEMENT_TOTALS: ElementTotals = {
	headings: 0,
	paragraphs: 0,
	links: 0,
	images: 0,
	videos: 0,
	audio: 0,
	code: 0,
	lists: 0,
	tables: 0,
	media: [],
	streamed: 0,
};

export function addProfile(totals: ElementTotals, profile: ElementProfile): ElementTotals {
	return {
		headings: totals.headings + profile.headings,
		paragraphs: totals.paragraphs + profile.paragraphs,
		links: totals.links + profile.links,
		images: totals.images + profile.images,
		videos: totals.videos + profile.videos,
		audio: totals.audio + profile.audio,
		code: totals.code + profile.code,
		lists: totals.lists + profile.lists,
		tables: totals.tables + profile.tables,
		streamed: totals.streamed + profile.streamed,
		media: [...totals.media, ...profile.media].slice(0, 120),
	};
}
