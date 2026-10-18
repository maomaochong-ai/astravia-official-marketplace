/**
 * What a page is made of.
 *
 * The console draws a page skeleton and walks the spider across it, so the crawl
 * needs to report structure, not just a character count. The same profile is what
 * lets `formats: ["media"]` answer "where are this page's videos?" without
 * downloading anything.
 */

export type MediaKind = "image" | "video" | "audio";

export interface MediaRef {
	url: string;
	kind: MediaKind;
	/** Alt text, `<source type>`, or the attribute that produced the URL. */
	label?: string;
	/** True for `.m3u8` / `.mpd` playlists — the URLs that enumerate a video's parts. */
	manifest?: boolean;
	/** Poster frame, when the markup has one. */
	poster?: string;
	/** True when the player only exposes a `blob:` URL, i.e. Media Source Extensions. */
	streamed?: boolean;
}

export interface ElementProfile {
	title: string;
	headings: number;
	paragraphs: number;
	links: number;
	images: number;
	videos: number;
	audio: number;
	code: number;
	lists: number;
	tables: number;
	forms: number;
	iframes: number;
	chars: number;
	/** Playlists and direct media URLs in document order, deduplicated. */
	media: MediaRef[];
	/** Media that exists only as a `blob:`/MSE stream — readable text, not a file. */
	streamed: number;
}

const MANIFEST_SUFFIX = /\.(m3u8|mpd)(\?|#|$)/i;

export function isManifestUrl(url: string): boolean {
	return MANIFEST_SUFFIX.test(url);
}

function absolute(raw: string | null, base: string): string | null {
	if (!raw) return null;
	const value = raw.trim();
	if (!value || value.startsWith("data:") || value.startsWith("javascript:")) return null;
	if (value.startsWith("blob:")) return value;
	try {
		return new URL(value, base).toString();
	} catch {
		return null;
	}
}

function pushMedia(media: MediaRef[], seen: Set<string>, ref: MediaRef): void {
	const key = `${ref.kind}:${ref.url}`;
	if (seen.has(key)) return;
	seen.add(key);
	media.push(ref);
}

/**
 * Counts the structures a reader would notice. `doc` is parsed already, so the
 * caller decides which subtree counts (main content vs whole document).
 */
export function profileElements(doc: Document, chars: number): ElementProfile {
	const all = doc.querySelectorAll.bind(doc);
	const media: MediaRef[] = [];
	const seen = new Set<string>();
	const base = doc.baseURI || "about:blank";
	let streamed = 0;

	for (const image of Array.from(all("img[src], img[data-src]"))) {
		const url = absolute(image.getAttribute("src") ?? image.getAttribute("data-src"), base);
		if (url && !url.startsWith("blob:")) {
			pushMedia(media, seen, { url, kind: "image", label: image.getAttribute("alt") ?? undefined });
		}
	}

	for (const video of Array.from(all("video"))) {
		const src = video.getAttribute("src");
		if (src?.startsWith("blob:")) {
			streamed += 1;
			continue;
		}
		const poster = absolute(video.getAttribute("poster"), base) ?? undefined;
		for (const candidate of [src, video.getAttribute("data-src")]) {
			const url = absolute(candidate, base);
			if (url) pushMedia(media, seen, { url, kind: "video", label: "video", manifest: isManifestUrl(url), poster });
		}
		for (const source of Array.from(video.querySelectorAll("source[src]"))) {
			const url = absolute(source.getAttribute("src"), base);
			if (url?.startsWith("blob:")) {
				// A Media Source URL is only valid inside the playing page: no file to list.
				streamed += 1;
				continue;
			}
			if (url) {
				pushMedia(media, seen, {
					url,
					kind: "video",
					label: source.getAttribute("type") ?? "source",
					manifest: isManifestUrl(url),
				});
			}
		}
	}

	for (const audio of Array.from(all("audio[src], audio source[src]"))) {
		const url = absolute(audio.getAttribute("src"), base);
		if (url?.startsWith("blob:")) {
			streamed += 1;
			continue;
		}
		if (url) pushMedia(media, seen, { url, kind: "audio", label: "audio", manifest: isManifestUrl(url) });
	}

	// Social cards and JSON-LD are the only place a player's manifest shows up on
	// pages that lazy-load the <video> tag itself.
	for (const meta of Array.from(all('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[property="og:audio"]'))) {
		const url = absolute(meta.getAttribute("content"), base);
		if (!url) continue;
		const kind: MediaKind = (meta.getAttribute("property") ?? "").includes("audio") ? "audio" : "video";
		pushMedia(media, seen, { url, kind, label: "og", manifest: isManifestUrl(url) });
	}

	return {
		title: doc.title?.trim() ?? "",
		headings: all("h1, h2, h3, h4, h5, h6").length,
		paragraphs: all("p").length,
		links: all("a[href]").length,
		images: all("img").length,
		videos: all("video").length,
		audio: all("audio").length,
		code: all("pre, code").length,
		lists: all("ul, ol").length,
		tables: all("table").length,
		forms: all("form").length,
		iframes: all("iframe").length,
		chars,
		media: media.slice(0, 400),
		streamed,
	};
}

/** Element counts without a DOM (browser engine, plain text). */
export function profileText(text: string, title = ""): ElementProfile {
	const paragraphs = text.split(/\n{2,}/).filter((block) => block.trim().length > 0).length;
	return {
		title,
		headings: 0,
		paragraphs,
		links: (text.match(/https?:\/\/\S+/g) ?? []).length,
		images: 0,
		videos: 0,
		audio: 0,
		code: 0,
		lists: 0,
		tables: 0,
		forms: 0,
		iframes: 0,
		chars: text.length,
		media: [],
		streamed: 0,
	};
}
