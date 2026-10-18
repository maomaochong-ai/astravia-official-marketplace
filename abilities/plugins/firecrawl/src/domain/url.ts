/**
 * URL normalization and crawl-depth maths.
 *
 * Mirrors the semantics of firecrawl's JS fallback filter (`filterLinks` in
 * apps/api/src/scraper/WebScraper/crawler.ts) so that a plugin-driven crawl
 * denies and accepts the same edges a server-side crawl would.
 */

const NON_WEB_PROTOCOLS = ["mailto:", "tel:", "telnet:", "ftp:", "ftps:", "ssh:", "file:"] as const;

/** Social networks firecrawl refuses to crawl: they are not documents we can read. */
const SOCIAL_MEDIA_HOSTS = [
	"facebook.com",
	"twitter.com",
	"x.com",
	"linkedin.com",
	"instagram.com",
	"pinterest.com",
	"tiktok.com",
	"reddit.com",
	"youtube.com",
	"youtu.be",
	"discord.gg",
	"t.me",
	"wa.me",
	"threads.net",
	"mastodon.social",
	"bsky.app",
] as const;

/** Extensions skipped by `isFile()` — non-document payloads. */
const FILE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"avif",
	"svg",
	"ico",
	"bmp",
	"tiff",
	"mp4",
	"mov",
	"webm",
	"avi",
	"mkv",
	"mp3",
	"wav",
	"ogg",
	"flac",
	"m4a",
	"zip",
	"gz",
	"tar",
	"bz2",
	"xz",
	"7z",
	"rar",
	"css",
	"js",
	"mjs",
	"json",
	"xml",
	"rss",
	"atom",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"exe",
	"dmg",
	"pkg",
	"deb",
	"rpm",
	"apk",
	"wasm",
	"map",
	// Office containers stay refused: nothing in the plugin can turn them into text.
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"epub",
	"rtf",
]);

export interface NormalizedUrl {
	href: string;
	origin: string;
	hostname: string;
	pathname: string;
	search: string;
	hash: string;
}

export function isNonWebProtocol(raw: string): boolean {
	const value = raw.trim().toLowerCase();
	return NON_WEB_PROTOCOLS.some((protocol) => value.startsWith(protocol));
}

export function isSocialMediaHost(hostname: string): boolean {
	const host = hostname.replace(/^www\./, "").toLowerCase();
	return SOCIAL_MEDIA_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * Normalizes a link for de-duplication: resolves it against a base, drops the
 * section anchor (firecrawl treats `#fragment` as a duplicate of the page) and
 * removes default ports. Returns `null` for anything unusable.
 */
export function normalizeUrl(raw: string, base?: string): NormalizedUrl | null {
	const trimmed = raw.trim();
	if (!trimmed || trimmed.startsWith("#")) return null;
	if (isNonWebProtocol(trimmed)) return null;
	let url: URL;
	try {
		url = base ? new URL(trimmed, base) : new URL(trimmed);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	url.hash = "";
	url.hostname = url.hostname.toLowerCase();
	return {
		href: url.toString(),
		origin: url.origin,
		hostname: url.hostname,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
	};
}

/** Number of path segments, the unit firecrawl's `maxDepth` is expressed in. */
export function getUrlDepth(raw: string): number {
	let pathname: string;
	try {
		pathname = new URL(raw).pathname;
	} catch {
		return 0;
	}
	return pathname.split("/").filter(Boolean).length;
}

/** `www.example.com` and `example.com` are the same site for crawl purposes. */
export function stripWww(hostname: string): string {
	return hostname.replace(/^www\./, "").toLowerCase();
}

export function isSameSite(left: string, right: string): boolean {
	return stripWww(left) === stripWww(right);
}

export function isSubdomainOf(hostname: string, domain: string): boolean {
	const host = stripWww(hostname);
	const parent = stripWww(domain);
	return host !== parent && host.endsWith(`.${parent}`);
}

export function fileExtension(url: string): string | null {
	const path = url.split("?")[0]?.split("#")[0] ?? "";
	const last = path.split("/").pop() ?? "";
	const dot = last.lastIndexOf(".");
	if (dot <= 0 || dot === last.length - 1) return null;
	return last.slice(dot + 1).toLowerCase();
}

export function isFileUrl(url: string): boolean {
	const extension = fileExtension(url);
	return extension !== null && FILE_EXTENSIONS.has(extension);
}

/** PDFs are documents we can read, so they are crawled and parsed instead of refused. */
export function isPdfUrl(url: string): boolean {
	return fileExtension(url) === "pdf";
}

/**
 * The string include/exclude regexes run against.
 *
 * firecrawl matches the pathname by default and the whole URL with
 * `regexOnFullURL`, which is the difference between `/blog` and
 * `https://site.com/blog`.
 */
export function pathForPatterns(url: string, fullUrl = false): string {
	if (fullUrl) return url;
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

/** Query parameters that only describe a campaign, not a different page. */
const TRACKING_PARAMETERS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"utm_id",
	"gclid",
	"fbclid",
	"msclkid",
	"mc_cid",
	"mc_eid",
	"ref",
	"ref_src",
	"_hsenc",
	"_hsmi",
] as const;

export interface DedupeOptions {
	/** Treat `?page=2` and no query string as the same page. */
	ignoreQueryParameters?: boolean;
	/** Drop tracking parameters and normalise index suffixes (`/docs` vs `/docs/`). */
	deduplicateSimilarURLs?: boolean;
}

/**
 * Key used to decide whether two links point at the same document.
 *
 * Kept separate from `normalizeUrl` because the crawl queue still needs the
 * original href: this only answers "have we already got this page?"
 */
export function dedupeKey(url: string, options: DedupeOptions = {}): string {
	if (!options.ignoreQueryParameters && !options.deduplicateSimilarURLs) return url;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	parsed.hash = "";
	if (options.ignoreQueryParameters) {
		parsed.search = "";
	} else if (options.deduplicateSimilarURLs) {
		for (const parameter of TRACKING_PARAMETERS) parsed.searchParams.delete(parameter);
		parsed.searchParams.sort();
		if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) parsed.pathname = parsed.pathname.slice(0, -1);
		if (parsed.protocol === "https:" && parsed.port === "443") parsed.port = "";
	}
	return parsed.toString();
}


export function originOf(url: string): string {
	try {
		return new URL(url).origin;
	} catch {
		return "";
	}
}

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/** Last path segment, used as the spider-web node label. */
export function urlLabel(url: string): string {
	let pathname = "/";
	let search = "";
	try {
		const parsed = new URL(url);
		pathname = parsed.pathname;
		search = parsed.search;
	} catch {
		return url;
	}
	const segment = pathname.split("/").filter(Boolean).pop();
	if (!segment) return hostOf(url) || "/";
	const decoded = safeDecode(segment);
	return `${decoded}${search ? "?…" : ""}`.slice(0, 42);
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
