/**
 * Plain-text rendering of upstream documents and jobs.
 *
 * Tools answer in text, not JSON: the agent reads the same shape regardless of
 * which page it scraped, and the console parses none of it.
 */

import { formatBytes, formatCount, formatDuration } from "../../shared/formatters/format";
import type { FirecrawlDocument, JobStatus } from "./types";

const MAX_MARKDOWN = 60_000;
const MAX_LISTED = 60;

export function clip(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max)}\n[... truncated]`;
}

export function documentTitle(document: FirecrawlDocument): string {
	if (typeof document.title === "string" && document.title.length > 0) return document.title;
	const meta = document.metadata?.title;
	return typeof meta === "string" ? meta : "";
}

export function documentUrl(document: FirecrawlDocument): string {
	return document.url ?? String(document.metadata?.sourceURL ?? document.metadata?.url ?? "");
}

export function describeDocument(
	document: FirecrawlDocument,
	endpoint: string,
	elapsedMs: number,
	credits?: number,
): string {
	const lines = [
		`URL: ${documentUrl(document) || "(unknown)"}`,
		`Source: Firecrawl API ${endpoint}`,
		`Title: ${documentTitle(document) || "(none)"}`,
	];
	const description = document.description ?? document.metadata?.description;
	if (description) lines.push(`Description: ${String(description)}`);
	const status = document.metadata?.statusCode;
	if (status !== undefined) lines.push(`Status: ${String(status)}`);
	lines.push(`Time: ${formatDuration(elapsedMs)}${credits !== undefined ? `  credits: ${credits}` : ""}`);
	if (document.warning) lines.push(`Warning: ${document.warning}`);

	const markdown = document.markdown ?? "";
	lines.push("", `--- Markdown (${formatCount(markdown.length)} chars) ---`, clip(markdown, MAX_MARKDOWN));
	if (markdown.length > MAX_MARKDOWN) lines.push(`[... ${markdown.length - MAX_MARKDOWN} more characters]`);

	const extras = describeExtras(document);
	if (extras.length > 0) lines.push("", ...extras);
	return lines.join("\n");
}

export function describeExtras(document: FirecrawlDocument): string[] {
	const lines: string[] = [];
	if (document.html) lines.push(`HTML: ${formatCount(document.html.length)} chars captured.`);
	if (document.rawHtml) lines.push(`rawHtml: ${formatCount(document.rawHtml.length)} chars captured.`);
	if (document.rawBase64) lines.push(`rawBase64: ${formatBytes(Math.floor((document.rawBase64.length * 3) / 4))} captured.`);
	if (document.screenshot) lines.push("Screenshot: data URL captured.");
	if (document.summary) lines.push("", "--- Summary ---", clip(document.summary, 4_000));
	if (document.answer) lines.push("", "--- Answer ---", clip(document.answer, 4_000));
	if (document.highlights && document.highlights.length > 0) lines.push("", "--- Highlights ---", clip(document.highlights.join("\n"), 4_000));
	if (document.json !== undefined && document.json !== null) {
		lines.push("", "--- JSON ---", clip(JSON.stringify(document.json, null, 2), 8_000));
	}
	if (document.extract !== undefined && document.extract !== null) {
		lines.push("", "--- Extracted ---", clip(JSON.stringify(document.extract, null, 2), 8_000));
	}
	if (Array.isArray(document.links) && document.links.length > 0) {
		lines.push("", `--- Links (${document.links.length}) ---`);
		for (const link of document.links.slice(0, MAX_LISTED)) lines.push(link);
		if (document.links.length > MAX_LISTED) lines.push(`[... ${document.links.length - MAX_LISTED} more]`);
	}
	if (Array.isArray(document.images) && document.images.length > 0) {
		lines.push("", `--- Images (${document.images.length}) ---`);
		for (const image of document.images.slice(0, MAX_LISTED)) lines.push(image);
	}
	if (Array.isArray(document.attributes) && document.attributes.length > 0) {
		lines.push("", "--- Attributes ---");
		for (const attribute of document.attributes) {
			lines.push(`${attribute.selector} @ ${attribute.attribute}: ${attribute.values.slice(0, 20).join(" | ")}`);
		}
	}
	if (Array.isArray(document.videos) && document.videos.length > 0) {
		lines.push("", `--- Videos (${document.videos.length}) ---`);
		for (const video of document.videos.slice(0, MAX_LISTED)) lines.push(JSON.stringify(video));
	}
	if (typeof document.video === "string" && document.video.length > 0) lines.push(`Video: ${document.video}`);
	if (typeof document.audio === "string" && document.audio.length > 0) lines.push(`Audio: ${document.audio}`);
	if (Array.isArray(document.pages) && document.pages.length > 0) {
		lines.push("", `--- Pages (${document.pages.length}) ---`);
		for (const page of document.pages.slice(0, 20)) lines.push(`p${page.pageNumber}: ${clip(page.markdown, 400)}`);
	}
	lines.push(...describeStructured(document));
	if (document.warning) lines.push("", `Warning: ${document.warning}`);
	return lines;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function scalar(value: unknown, max = 200): string | undefined {
	if (typeof value === "string") return clip(value.replace(/\s+/g, " ").trim(), max);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

/**
 * `branding`, `product`, `menu`, `tools` and `blocks` are what Firecrawl's
 * format layer returns instead of prose. Rendering a short digest keeps the
 * text answer useful without dumping a design token tree at the model.
 */
function describeStructured(document: FirecrawlDocument): string[] {
	const lines: string[] = [];

	const branding = asRecord(document.branding);
	if (branding) {
		const parts = ["colorScheme", "logo", "fontFamily", "primaryColor", "secondaryColor", "accentColor"]
			.map((key) => {
			const value = scalar(branding[key]);
			return value ? `${key}=${value}` : "";
		})
			.filter(Boolean);
		lines.push("", "--- Branding ---", parts.length > 0 ? parts.join("  ") : clip(JSON.stringify(branding), 1_500));
	}

	const product = asRecord(document.product);
	if (product) {
		const parts = ["name", "price", "currency", "availability", "sku", "brand", "rating"]
			.map((key) => {
				const value = scalar(product[key]);
				return value ? `${key}=${value}` : "";
			})
			.filter(Boolean);
		lines.push("", "--- Product ---", parts.length > 0 ? parts.join("  ") : clip(JSON.stringify(product), 1_500));
	}

	const menu = asRecord(document.menu);
	if (menu) {
		const sections = ["sections", "items", "categories"]
			.map((key) => (Array.isArray(menu[key]) ? (menu[key] as unknown[]).length : 0))
			.reduce((sum, count) => sum + count, 0);
		lines.push("", `--- Menu --- (${sections} entr${sections === 1 ? "y" : "ies"})`, clip(JSON.stringify(menu), 3_000));
	}

	const tools = asRecord(document.tools);
	if (tools) {
		const names = Object.keys(tools);
		lines.push("", `--- Tools (${names.length}) ---`, names.slice(0, 20).join(", "));
	}

	if (Array.isArray(document.blocks) && document.blocks.length > 0) {
		const kinds = new Map<string, number>();
		for (const block of document.blocks) {
			const type = scalar(asRecord(block)?.type, 40) ?? "unknown";
			kinds.set(type, (kinds.get(type) ?? 0) + 1);
		}
		const digest = [...kinds.entries()].map(([type, count]) => `${type}×${count}`).join(", ");
		lines.push("", `--- Layout blocks (${document.blocks.length}) ---`, digest);
	}

	const actions = document.actions;
	if (actions) {
		const counts = [
			["screenshots", actions.screenshots?.length ?? 0],
			["scrapes", actions.scrapes?.length ?? 0],
			["pdfs", actions.pdfs?.length ?? 0],
			["javascriptReturns", actions.javascriptReturns?.length ?? 0],
		].filter(([, count]) => (count as number) > 0);
		lines.push("", "--- Actions ---", counts.map(([name, count]) => `${name}=${count}`).join("  "));
		const returned = actions.javascriptReturns ?? [];
		for (const entry of returned.slice(0, 10)) {
			if (entry.error) lines.push(`javascript: error: ${clip(entry.error, 300)}`);
			else lines.push(`javascript: ${clip(JSON.stringify(entry.value), 500)}`);
		}
		for (const [index, scrape] of (actions.scrapes ?? []).slice(0, 3).entries()) {
			lines.push(`action scrape ${index + 1}: ${scrape.url ?? ""}  ${formatCount((scrape.markdown ?? "").length)} chars`);
		}
	}
	return lines;
}

export function jobSummary(status: JobStatus, endpoint: string, kind: "crawl" | "batch"): string[] {
	const lines = [
		`Status: ${status.status}  ${status.completed}/${status.total || "?"} page(s)${
			status.creditsUsed !== undefined ? `  credits: ${status.creditsUsed}` : ""
		}`,
		`Source: Firecrawl API ${endpoint} (${kind} job)`,
	];
	if (status.expiresAt) lines.push(`Expires: ${status.expiresAt}`);
	if (status.error) lines.push(`Error: ${status.error}`);
	if (status.warning) lines.push(`Warning: ${status.warning}`);
	return lines;
}

export function pagesBlock(data: readonly FirecrawlDocument[]): string[] {
	const lines: string[] = [];
	for (const [index, page] of data.entries()) {
		lines.push("", `### ${index + 1}. ${documentTitle(page) || "(untitled)"}`, `URL: ${documentUrl(page) || "(unknown)"}`);
		if (page.markdown) lines.push(clip(page.markdown, 6_000));
		if (page.warning) lines.push(`Warning: ${page.warning}`);
	}
	return lines;
}
