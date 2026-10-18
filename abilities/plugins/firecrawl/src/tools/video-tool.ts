/**
 * firecrawl_video — media URLs from a page, via `scrape` with media formats.
 *
 * The upstream returns signed URLs (they expire after about an hour); we report
 * them instead of streaming or transcoding locally.
 */

import { clip } from "../domain/firecrawl/documents";
import type { ToolDeps } from "./deps";
import { requireUrl } from "./tool-arguments";

export function createVideoTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_video",
		name: "firecrawl_video",
		label: "%tool.video.label%",
		description: [
			"Inspect the media on a page: returns video and audio URLs Firecrawl found, including HLS/DASH",
			"manifests, plus the page's Markdown when available.",
			"",
			"Use it when the user asks 'is there a video on this page', wants a downloadable URL, or needs to",
			"know which formats are available. For reading the page itself use firecrawl_scrape.",
			"",
			"The URLs are signed and expire after about an hour; share them or download them promptly.",
			"Nothing is transcoded: if the page only offers a manifest, report that instead of inventing an",
			"MP4 link.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL of the page with media." },
				kind: {
					type: "string",
					enum: ["video", "audio", "both"],
					description: "Which media to request. Default video.",
				},
				onlyMainContent: { type: "boolean", description: "Restrict the search to the main content. Default false." },
				waitFor: { type: "number", description: "Milliseconds to wait for players to initialise (0-60000)." },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const url = requireUrl(input);
			const record = (input ?? {}) as Record<string, unknown>;
			const kind = record.kind === "audio" ? "audio" : record.kind === "both" ? "both" : "video";
			const formats = kind === "both" ? ["video", "audio", "markdown"] : [kind, "markdown"];
			const client = await config.require();
			const document = await client.scrape({
				url,
				formats,
				onlyMainContent: record.onlyMainContent === true,
				...(typeof record.waitFor === "number" ? { waitFor: record.waitFor } : {}),
			});
			store.note("ok", `video  ${url}`);

			const lines = [`Media on ${url}`];
			const videos: string[] = [];
			if (typeof document.video === "string") videos.push(document.video);
			for (const entry of document.videos ?? []) {
				if (typeof entry === "string") videos.push(entry);
				else if (entry && typeof entry === "object") {
					const value = (entry as Record<string, unknown>).url;
					if (typeof value === "string") videos.push(value);
				}
			}
			if (videos.length > 0) {
				lines.push("", `Videos (${videos.length}):`);
				for (const video of videos) lines.push(`- ${video}${/\.(m3u8|mpd)(\?|$)/i.test(video) ? "  (manifest)" : ""}`);
			}
			if (typeof document.audio === "string" && document.audio.length > 0) {
				lines.push("", `Audio: ${document.audio}`);
			}
			if (videos.length === 0 && !document.audio) {
				lines.push("", "No video or audio URL was found on this page.");
			} else {
				lines.push("", "Signed URLs expire after about an hour.");
			}
			if (document.markdown) lines.push("", "--- Page text ---", clip(document.markdown, 4_000));
			return lines.join("\n");
		},
	};
}
