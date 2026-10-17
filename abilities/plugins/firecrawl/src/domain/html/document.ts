/**
 * HTML parsing, noise removal and metadata/link extraction.
 *
 * The plugin runs inside the host renderer, so `DOMParser` is a real Chromium
 * parser — no server-side DOM shim is needed. Every function here is pure and
 * takes/returns DOM nodes so it stays testable under happy-dom.
 */

const DROP_TAGS = [
	"script",
	"style",
	"noscript",
	"template",
	"iframe",
	"frame",
	"object",
	"embed",
	"applet",
	"canvas",
	"svg",
	"math",
	"form",
	"input",
	"select",
	"textarea",
	"button",
	"dialog",
	"link",
	"meta",
] as const;

/** Structural chrome that never carries page content. */
const CHROME_TAGS = ["nav", "aside", "footer"] as const;

/** `class`/`id`/`role` fragments that mark boilerplate. */
const NOISE_PATTERN =
	/(^|[-_\s])(nav|navbar|navigation|menu|sidebar|footer|header|breadcrumb|pagination|pager|comments?|disqus|share|social|cookie|consent|banner|popup|modal|newsletter|subscribe|advert|ads?|promo|sponsor|related|recommend|skip-link|sr-only|visually-hidden)([-_\s]|$)/i;

export interface PageMetadata {
	title: string;
	description: string;
	canonical: string;
	lang: string;
	siteName: string;
	image: string;
}

export function parseHtml(html: string, baseUrl?: string): Document {
	const doc = new DOMParser().parseFromString(html, "text/html");
	// DOMParser leaves baseURI at the host page, so relative hrefs inside Readability
	// and turndown would resolve against the app URL. Pin it to the fetched page.
	if (baseUrl && doc.head && !doc.querySelector("base[href]")) {
		const base = doc.createElement("base");
		base.setAttribute("href", baseUrl);
		doc.head.insertBefore(base, doc.head.firstChild);
	}
	return doc;
}

export function absoluteUrl(raw: string, base: string): string | null {
	try {
		const url = new URL(raw, base);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		url.hash = "";
		return url.toString();
	} catch {
		return null;
	}
}

/**
 * Removes payload-free elements. `chrome` additionally drops nav/aside/footer
 * and class/id noise, which is what `onlyMainContent: false` needs to keep a
 * readable page rather than a full site skeleton.
 */
export function cleanDocument(doc: Document, options: { chrome: boolean }): void {
	for (const tag of DROP_TAGS) {
		for (const element of Array.from(doc.querySelectorAll(tag))) element.remove();
	}
	for (const element of Array.from(doc.querySelectorAll("[hidden], [aria-hidden='true']"))) {
		element.remove();
	}
	if (!options.chrome) return;
	for (const tag of CHROME_TAGS) {
		for (const element of Array.from(doc.querySelectorAll(tag))) element.remove();
	}
	for (const element of Array.from(doc.body?.querySelectorAll("div, section, ul, ol, header") ?? [])) {
		const signature = `${element.getAttribute("class") ?? ""} ${element.id} ${element.getAttribute("role") ?? ""}`;
		if (signature.trim() && NOISE_PATTERN.test(signature)) element.remove();
	}
}

export function extractMetadata(doc: Document, pageUrl: string): PageMetadata {
	const meta = (selector: string): string => {
		const element = doc.querySelector(selector);
		return (element?.getAttribute("content") ?? "").trim();
	};
	const title =
		meta("meta[property='og:title']") || meta("meta[name='twitter:title']") || (doc.title ?? "").trim();
	const canonical = absoluteUrl(doc.querySelector("link[rel='canonical']")?.getAttribute("href") ?? "", pageUrl);
	return {
		title,
		description: meta("meta[property='og:description']") || meta("meta[name='description']"),
		canonical: canonical ?? pageUrl,
		lang: (doc.documentElement.getAttribute("lang") ?? "").trim(),
		siteName: meta("meta[property='og:site_name']"),
		image: meta("meta[property='og:image']"),
	};
}

export interface ExtractedLink {
	url: string;
	text: string;
	/** In-page `#section` link — the page itself is crawled once. */
	anchored: boolean;
}

/** Anchors from the untouched document — cleaning would delete in-page links. */
export function extractLinks(doc: Document, pageUrl: string): ExtractedLink[] {
	const seen = new Set<string>();
	const links: ExtractedLink[] = [];
	for (const anchor of Array.from(doc.querySelectorAll("a[href], area[href]"))) {
		const href = anchor.getAttribute("href");
		if (!href) continue;
		const url = absoluteUrl(href, pageUrl);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({
			url,
			text: (anchor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
			anchored: href.startsWith("#"),
		});
	}
	return links;
}

