/**
 * `includeTags` / `excludeTags` and plain-text extraction.
 *
 * firecrawl documents these as CSS selectors applied to the scraped document.
 * We accept the same selectors, tolerate the ones the DOM rejects, and never
 * return an empty page because a selector happened to miss: the miss is
 * reported as a note so the caller can correct the selector.
 */

const BLOCK_TAGS = new Set([
	"ADDRESS",
	"ARTICLE",
	"ASIDE",
	"BLOCKQUOTE",
	"DD",
	"DIV",
	"DL",
	"DT",
	"FIELDSET",
	"FIGCAPTION",
	"FIGURE",
	"FOOTER",
	"FORM",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HEADER",
	"HR",
	"LI",
	"MAIN",
	"NAV",
	"OL",
	"P",
	"PRE",
	"SECTION",
	"TABLE",
	"TD",
	"TH",
	"TR",
	"UL",
]);

export interface TagFilterReport {
	/** Selectors that matched at least one element. */
	matched: string[];
	/** Selectors the DOM rejected (syntax) or that matched nothing. */
	ignored: string[];
	/** True when includeTags replaced the body. */
	restricted: boolean;
}

function safeQueryAll(doc: Document, selector: string): Element[] | null {
	try {
		return Array.from(doc.querySelectorAll(selector));
	} catch {
		return null;
	}
}

export function applyTagFilters(
	doc: Document,
	includeTags: readonly string[],
	excludeTags: readonly string[],
): TagFilterReport {
	const report: TagFilterReport = { matched: [], ignored: [], restricted: false };

	if (includeTags.length > 0) {
		const kept: Element[] = [];
		for (const selector of includeTags) {
			const elements = safeQueryAll(doc, selector);
			if (!elements || elements.length === 0) {
				report.ignored.push(selector);
				continue;
			}
			report.matched.push(selector);
			kept.push(...elements);
		}
		// An include list that matches nothing would erase the page; keep the page and say so.
		if (kept.length > 0 && doc.body) {
			const container = doc.createElement("div");
			for (const element of kept) container.append(element.cloneNode(true));
			doc.body.replaceChildren(container);
			report.restricted = true;
		}
	}

	for (const selector of excludeTags) {
		const elements = safeQueryAll(doc, selector);
		if (!elements || elements.length === 0) {
			report.ignored.push(selector);
			continue;
		}
		report.matched.push(selector);
		for (const element of elements) element.remove();
	}

	return report;
}

/** Visible text with block boundaries preserved — the browser engine's `innerText` analogue. */
export function domText(node: Node | null | undefined): string {
	if (!node) return "";
	const parts: string[] = [];
	const walk = (current: Node): void => {
		if (current.nodeType === 3) {
			const value = current.nodeValue ?? "";
			if (value.trim()) parts.push(value.replace(/\s+/g, " "));
			return;
		}
		if (current.nodeName === "SCRIPT" || current.nodeName === "STYLE" || current.nodeName === "NOSCRIPT") return;
		const element = current as Element;
		const block = BLOCK_TAGS.has(element.nodeName);
		if (block) parts.push("\n");
		for (const child of Array.from(current.childNodes)) walk(child);
		if (block) parts.push("\n");
	};
	walk(node);
	return parts
		.join("")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
