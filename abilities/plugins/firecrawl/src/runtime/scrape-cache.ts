/**
 * Plugin-private page cache.
 *
 * One bounded JSON file instead of one file per URL: the plugin has no cheap way
 * to read file mtimes, so an LRU cap inside the document is the only way to keep
 * `~/.astravia/plugin-data/<plugin>/` from growing without limit. Reads and
 * writes are cheap because the whole index is held in memory after the first
 * load.
 *
 * Storage may be unavailable (permission not granted, older host). Every call
 * degrades to "no cache" rather than failing the scrape.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CachedPage, PageCache } from "../domain/scrape/cache";

const PATH = "scrape-cache.json";
const MAX_ENTRIES = 50;
/** A page's Markdown is the expensive part; the rest is metadata. */
const MAX_MARKDOWN_CHARS = 40_000;
const MAX_HTML_CHARS = 60_000;

interface CacheDocument {
	version: 1;
	entries: Record<string, CachedPage>;
}

export function createHostPageCache(ctx: PluginContext): PageCache | undefined {
	const storage = ctx.storage as PluginContext["storage"] | undefined;
	if (!storage || typeof storage.readFile !== "function" || typeof storage.writeFile !== "function") return undefined;

	let loaded: CacheDocument | null = null;

	const load = async (): Promise<CacheDocument> => {
		if (loaded) return loaded;
		try {
			const raw = await storage.readFile(PATH, "utf8");
			const parsed = raw ? (JSON.parse(raw) as CacheDocument) : null;
			loaded = parsed && parsed.version === 1 && parsed.entries ? parsed : { version: 1, entries: {} };
		} catch {
			loaded = { version: 1, entries: {} };
		}
		return loaded;
	};

	return {
		async read(key: string): Promise<CachedPage | null> {
			const document = await load();
			return document.entries[key] ?? null;
		},
		async write(key: string, page: CachedPage): Promise<void> {
			const document = await load();
			document.entries[key] = trim(page);
			const keys = Object.keys(document.entries);
			if (keys.length > MAX_ENTRIES) {
				keys
					.sort((left, right) => (document.entries[left]?.storedAt ?? 0) - (document.entries[right]?.storedAt ?? 0))
					.slice(0, keys.length - MAX_ENTRIES)
					.forEach((stale) => delete document.entries[stale]);
			}
			try {
				await storage.writeFile(PATH, JSON.stringify(document), "utf8");
			} catch {
				// A full or read-only data directory must not fail a scrape.
			}
		},
	};
}

function trim(page: CachedPage): CachedPage {
	return {
		...page,
		markdown: page.markdown.slice(0, MAX_MARKDOWN_CHARS),
		text: page.text.slice(0, MAX_MARKDOWN_CHARS),
		html: page.html.slice(0, MAX_HTML_CHARS),
		rawHtml: page.rawHtml.slice(0, MAX_HTML_CHARS),
	};
}
