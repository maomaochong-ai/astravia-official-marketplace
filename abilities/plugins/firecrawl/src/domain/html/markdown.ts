/**
 * HTML → Markdown.
 *
 * turndown is the library firecrawl's `markdown` transformer is built on, and
 * `turndown-plugin-gfm` supplies the table/strikethrough rules. We pass HTML
 * strings so turndown's own DOMParser handles the tree walk.
 */

import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let service: TurndownService | null = null;

function turndown(): TurndownService {
	if (service) return service;
	const instance = new TurndownService({
		headingStyle: "atx",
		hr: "---",
		bulletListMarker: "-",
		codeBlockStyle: "fenced",
		emDelimiter: "*",
		strongDelimiter: "**",
		linkStyle: "inlined",
	});
	instance.use(gfm);
	instance.remove(["script", "style", "noscript", "iframe", "form"]);
	// Inline data: images are megabytes of noise in an agent prompt.
	instance.addRule("dropDataImages", {
		filter: (node) => node.nodeName === "IMG" && (node.getAttribute("src") ?? "").startsWith("data:"),
		replacement: () => "",
	});
	// Collapse icon-only links that would otherwise render as "[]()".
	instance.addRule("dropEmptyLinks", {
		filter: (node) => node.nodeName === "A" && (node.textContent ?? "").trim() === "",
		replacement: (content, node) => (node.getAttribute("href") ?? "").startsWith("#") ? "" : content,
	});
	service = instance;
	return instance;
}

export function htmlToMarkdown(html: string): string {
	if (!html.trim()) return "";
	return tidyMarkdown(turndown().turndown(html));
}

export function tidyMarkdown(markdown: string): string {
	return markdown
		.replace(/\u00a0/g, " ")
		.replace(/[\u200b\u200c\u200d\ufeff]/g, "")
		.replace(/[ \t]+$/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\s+|\s+$/g, "");
}

