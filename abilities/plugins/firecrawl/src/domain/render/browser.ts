/**
 * Browser engine: the page as Chromium sees it after JavaScript ran.
 *
 * The host sandbox deliberately exposes no DOM/HTML access to plugins — a
 * browser session gives text, an accessibility snapshot and screenshots. That
 * ceiling shapes this module: rendered pages are converted to Markdown from
 * their visible text, never from markup, and link discovery reads the snapshot
 * instead of `<a href>`.
 */

import { ScrapeError } from "./errors";
import { profileText } from "../html/elements";
import type { BrowserAction, BrowserPort, BrowserPortFactory, BrowserRenderOptions, RenderedPage } from "./types";

export interface BrowserRender extends RenderedPage {
	/** Page had a `<title>`; kept separately because the snapshot cannot carry metadata. */
	notes: string[];
}

const MAX_TEXT_CHARS = 400_000;

export async function renderWithBrowser(
	factory: BrowserPortFactory,
	options: BrowserRenderOptions,
): Promise<BrowserRender> {
	const startedAt = Date.now();
	let port: BrowserPort | null = null;
	try {
		port = await factory();
	} catch (error) {
		throw new ScrapeError(
			`Browser rendering is unavailable: ${error instanceof Error ? error.message : String(error)}`,
			"browser-unavailable",
		);
	}

	const notes: string[] = [];
	let finalUrl = options.url;
	let title = "";
	let text = "";
	let snapshot = "";
	let screenshotDataUrl: string | null = null;

	try {
		const opened = await port.open(options.url, options.timeoutMs);
		finalUrl = opened.url || options.url;
		title = opened.title ?? "";

		if (options.waitForMs && options.waitForMs > 0) {
			await port.act({ type: "wait", milliseconds: Math.min(options.waitForMs, 60_000) });
		}
		for (const action of options.actions ?? []) {
			await port.act(action);
		}

		text = (await port.readText()).slice(0, MAX_TEXT_CHARS);
		if (options.includeLinks !== false) {
			try {
				snapshot = await port.snapshot();
			} catch (error) {
				notes.push(`Accessibility snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (options.screenshot && options.screenshot !== "none") {
			try {
				screenshotDataUrl = await port.screenshot(options.screenshot === "fullPage");
			} catch (error) {
				notes.push(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	} catch (error) {
		throw new ScrapeError(
			`Browser failed on ${options.url}: ${error instanceof Error ? error.message : String(error)}`,
			"browser-failed",
		);
	} finally {
		await port.close().catch(() => undefined);
	}

	const markdown = textToMarkdown(text);
	if (!markdown.trim()) {
		throw new ScrapeError(
			"The rendered page produced no visible text (blank page, canvas-only app, or the content is behind an interaction)",
			"empty-content",
		);
	}

	return {
		requestedUrl: options.url,
		finalUrl,
		// A rendered navigation has no HTTP status of its own; 200 means "the page loaded".
		status: 200,
		engine: "browser",
		attempts: ["browser"],
		fallbackReason: null,
		title,
		metadata: {
			title,
			description: "",
			canonical: finalUrl,
			lang: "",
			siteName: "",
			image: "",
		},
		markdown,
		text,
		html: "",
		rawHtml: "",
		elements: profileText(text || markdown, title),
		links: extractSnapshotLinks(snapshot, finalUrl),
		screenshotDataUrl,
		bytes: text.length,
		durationMs: Date.now() - startedAt,
		notes,
	};
}

/** InnerText → Markdown. Paragraph breaks survive; the DOM's inline emphasis does not. */
export function textToMarkdown(text: string): string {
	const lines = text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, "").replace(/^[ \t]+(?=\S)/g, (indent) => (indent.length >= 2 ? "  " : "")));
	const out: string[] = [];
	let blank = 0;
	for (const line of lines) {
		if (line.trim() === "") {
			blank += 1;
			if (blank <= 1 && out.length > 0) out.push("");
			continue;
		}
		blank = 0;
		out.push(line.trim());
	}
	return out
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Pulls candidate link targets out of the accessibility snapshot.
 *
 * The snapshot format belongs to the host's browser CLI; we only trust absolute
 * http(s) strings and `href="…"` pairs, and resolve the latter against the page.
 */
export function extractSnapshotLinks(snapshot: string, pageUrl: string): RenderedPage["links"] {
	if (!snapshot.trim()) return [];
	const seen = new Set<string>();
	const links: RenderedPage["links"] = [];
	const push = (raw: string, label: string): void => {
		let url: URL;
		try {
			url = new URL(raw, pageUrl);
		} catch {
			return;
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") return;
		url.hash = "";
		const href = url.toString();
		if (href === pageUrl || seen.has(href)) return;
		seen.add(href);
		links.push({ url: href, text: label.trim().slice(0, 120), anchored: false });
	};

	for (const match of snapshot.matchAll(/\bhref\s*[=:]\s*["']?([^"'\]\s>]+)/gi)) {
		if (match[1]) push(match[1], "");
	}
	for (const match of snapshot.matchAll(/\bhttps?:\/\/[^\s"'<>\]\\)]+/g)) {
		push(match[0].replace(/[.,;]+$/, ""), "");
	}
	return links;
}
