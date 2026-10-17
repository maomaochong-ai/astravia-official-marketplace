/**
 * Main-content extraction.
 *
 * `@mozilla/readability` is the same algorithm firecrawl's `readability`
 * transformer is built on. Readability mutates the document it scores, so the
 * caller passes a dedicated clone; when scoring fails we fall back to the
 * `<article>`/`<main>`/`<body>` subtree, which is what the raw-HTML engine does.
 */

import { Readability } from "@mozilla/readability";

export interface MainContent {
	html: string;
	title: string;
	byline: string;
	excerpt: string;
	siteName: string;
	lang: string;
	/** True when readability produced the result; false means structural fallback. */
	scored: boolean;
}

export function extractMainContent(doc: Document): MainContent {
	const lang = (doc.documentElement.getAttribute("lang") ?? "").trim();
	try {
		const parsed = new Readability(doc, { charThreshold: 200 }).parse();
		if (parsed?.content && parsed.content.trim().length > 0) {
			// Readability drops a heading that duplicates the title, which leaves the page
			// starting mid-sentence. Restore it so the Markdown keeps its document title.
			const heading = (parsed.title ?? doc.title ?? "").trim();
			const html = /<h1[\s>]/i.test(parsed.content) || !heading
				? parsed.content
				: `<h1>${escapeText(heading)}</h1>${parsed.content}`;
			return {
				html,
				title: parsed.title ?? "",
				byline: parsed.byline ?? "",
				excerpt: parsed.excerpt ?? "",
				siteName: parsed.siteName ?? "",
				lang: parsed.lang ?? lang,
				scored: true,
			};
		}
	} catch {
		// Readability throws on documents it cannot score; the fallback below is the engine retry.
	}
	const structural =
		doc.querySelector("article") ?? doc.querySelector("main") ?? doc.querySelector("[role='main']") ?? doc.body;
	return {
		html: structural?.innerHTML ?? "",
		title: (doc.title ?? "").trim(),
		byline: "",
		excerpt: "",
		siteName: "",
		lang,
		scored: false,
	};
}

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
