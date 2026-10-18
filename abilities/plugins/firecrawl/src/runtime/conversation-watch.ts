/**
 * Follows the conversation so the console knows what the user is aiming at.
 *
 * Two sources, in order of confidence:
 *
 *   tool-call-args  – the agent already decided a URL; the console should show it
 *                     while the call is still being generated, not after it lands
 *   user message    – the prompt contains a URL; the console pre-fills, it does
 *                     not start anything the user did not ask for
 *
 * Everything is best effort: without `agent.session.read` the subscription
 * throws, and the console simply stays manual.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";

const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]]+/gi;
const TOOL_PREFIX = "firecrawl_";

/** First http(s) URL in a block of text, trimmed of trailing punctuation. */
export function extractUrl(text: string): string | null {
	URL_PATTERN.lastIndex = 0;
	const match = URL_PATTERN.exec(text);
	if (!match) return null;
	const url = match[0].replace(/[.,;:!?]+$/, "");
	return url.length > 8 ? url : null;
}

function toolUrl(args: Record<string, unknown> | undefined): string | null {
	if (!args) return null;
	const candidate = args.url ?? args.target ?? args.startUrl ?? args.baseUrl;
	return typeof candidate === "string" && /^https?:\/\//i.test(candidate) ? candidate : null;
}

export function watchConversation(ctx: PluginContext, store: CrawlRunStore): { dispose(): void } {
	let subscription: { dispose(): void } | null = null;
	try {
		subscription = ctx.conversation.on((event) => {
			if (event.type === "tool-call-args" || event.type === "tool-call-start") {
				if (!event.toolName.startsWith(TOOL_PREFIX)) return;
				const url = toolUrl(event.args);
				if (url) store.setTarget(url, "tool");
				return;
			}
			if (event.type === "message-added" && event.message.role === "user") {
				const url = extractUrl(event.message.text);
				if (url) store.setTarget(url, "conversation");
			}
		});
	} catch {
		subscription = null;
	}
	return {
		dispose: () => subscription?.dispose(),
	};
}
