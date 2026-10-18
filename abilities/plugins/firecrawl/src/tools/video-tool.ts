/**
 * firecrawl_video — pull an actual video or audio file off a page.
 *
 * Give it one of: a page URL (the manifest or media URL is discovered from its
 * HTML), an HLS playlist, a DASH manifest, or a direct media file. Unencrypted
 * streams are downloaded segment by segment and concatenated into one file the
 * user picks a destination for.
 *
 * Encrypted or DRM-protected media is refused with an explanation: that is a
 * licensing boundary, not a capability gap this plugin can close.
 */

import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import {
	downloadStream,
	planStream,
	StreamError,
	type StreamPlan,
} from "../domain/media/stream";
import { headerValue } from "../domain/scrape/http";
import { formatBytes, formatDuration } from "../shared/formatters/format";
import { readBoolean, readNumber, readOptionalString, requireUrl } from "./tool-arguments";

const MAX_BYTES_DEFAULT = 256 * 1024 * 1024;

interface ToolContext {
	trigger: { input?: unknown };
	host?: {
		fs?: {
			saveAs?: (
				fileName: string,
				content: string,
				encoding?: "utf8" | "base64",
				options?: { title?: string },
			) => Promise<string | null>;
		};
	};
}

export function createVideoTool(client: HttpClient, binary?: BinaryFetch) {
	return {
		id: "firecrawl_video",
		name: "firecrawl_video",
		label: "%tool.video.label%",
		description: [
			"Download a video or audio stream. Accepts a page URL (the stream is discovered from the page), an",
			"HLS playlist (.m3u8), a DASH manifest (.mpd) or a direct media URL. Segments are fetched and",
			"concatenated into one file, and the host's save dialog picks the destination.",
			"",
			"Unencrypted streams only: AES-128/AES-SAMPLE playlists and DRM-protected DASH manifests are reported,",
			"not worked around. Use firecrawl_scrape when you only need metadata or transcripts.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Page URL, .m3u8, .mpd, or direct media URL." },
				fileName: { type: "string", description: "Suggested file name (default: derived from the URL)." },
				save: { type: "boolean", description: "Write the file through the host save dialog (default true)." },
				maxBytes: { type: "number", description: `Size cap in bytes (default ${MAX_BYTES_DEFAULT}).` },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		timeoutMs: 600_000,
		handler: async (context: ToolContext) => {
			const input = context.trigger.input;
			const requested = requireUrl(input);
			const save = readBoolean(input, "save", true);
			const maxBytes = readNumber(input, "maxBytes", { min: 1_048_576, max: 2_147_483_648, def: MAX_BYTES_DEFAULT });
			if (!binary) {
				throw new Error("The host cannot return binary bodies, so stream segments cannot be downloaded here.");
			}

			const notes: string[] = [];
			const startedAt = Date.now();
			const plan = await resolveStream(client, requested, notes);
			if (plan.encryption) {
				throw new StreamError(
					`This stream is protected (${plan.encryption}). Decrypting it is a licensing matter, not a parser limitation, so it is not downloaded. Try a trailer, a public sample, or the publisher's own download.`,
					"protected",
				);
			}

			const download = await downloadStream(binary, plan, maxBytes);
			const extension = extensionFor(plan);
			const fileName = readOptionalString(input, "fileName") ?? suggestName(plan.url, extension);
			const lines = [
				`Stream: ${plan.url}`,
				`Kind: ${plan.kind.toUpperCase()}  container: ${plan.container}  segments: ${download.segments}/${plan.segments.length}`,
				`Size: ${formatBytes(download.bytes)}  time: ${formatDuration(Date.now() - startedAt)}`,
			];
			if (download.truncated) lines.push(`Stopped at the ${formatBytes(maxBytes)} cap; raise maxBytes to keep going.`);
			for (const note of notes) lines.push(`Note: ${note}`);

			if (!save) {
				lines.push("", "Not written: `save` was false. Pass save=true to write it through the host save dialog.");
				return lines.join("\n");
			}
			const saveAs = context.host?.fs?.saveAs;
			if (!saveAs) {
				throw new Error("Writing files needs the `fs.write` permission on this host; call again with save=false to inspect the stream instead.");
			}
			const path = await saveAs(fileName, download.base64, "base64", { title: "Save video" });
			lines.push("", path ? `Saved: ${path}` : "The save dialog was cancelled; nothing was written.");
			return lines.join("\n");
		},
	};
}

/** Page URL → manifest or media URL; playlist/manifest/media URL → itself. */
async function resolveStream(client: HttpClient, url: string, notes: string[]): Promise<StreamPlan> {
	try {
		return await planStream(client, url, notes);
	} catch (error) {
		if (!(error instanceof StreamError) || error.reason !== "unsupported") throw error;
		// Not a stream itself: read the page and look for one.
	}
	const page = await client({ url, timeoutMs: 45_000 });
	if (!page.ok) throw new Error(`HTTP ${page.status} while reading ${url}`);
	const mime = headerValue(page.headers, "content-type");
	if (!mime.includes("html")) {
		throw new Error(`${url} returned ${mime || "an unknown content type"}, which is neither a page nor a media stream`);
	}
	const candidate = discoverStreamUrl(page.body, url);
	if (!candidate) {
		throw new Error(
			"No video or audio stream was found in the page HTML. Players that build the manifest URL in JavaScript need the manifest URL given directly (open the browser devtools network tab and copy it).",
		);
	}
	notes.push(`Discovered the stream from the page: ${candidate}`);
	if (candidate !== url) notes.push(`Manifest read from ${candidate}`);
	return planStream(client, candidate, notes);
}

/** `#EXTM3U`-adjacent URLs first, then `<video>`/`<source>`/`<audio>`, then og:video. */
export function discoverStreamUrl(html: string, pageUrl: string): string | null {
	const patterns = [
		/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i,
		/https?:\/\/[^\s"'<>\\]+\.mpd[^\s"'<>\\]*/i,
		/(?:src|data-src)\s*=\s*["']([^"']+\.(?:m3u8|mpd|mp4|webm|m4a|mp3)[^"']*)["']/i,
		/<(?:video|audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
		/property\s*=\s*["']og:video(?::url)?["'][^>]*content\s*=\s*["']([^"']+)["']/i,
	];
	for (const pattern of patterns) {
		const match = pattern.exec(html);
		const raw = match?.[1] ?? match?.[0];
		if (!raw) continue;
		try {
			return new URL(raw, pageUrl).toString();
		} catch {
			continue;
		}
	}
	return null;
}

function extensionFor(plan: StreamPlan): string {
	if (plan.kind === "hls") return plan.container === "mp4" ? "mp4" : "ts";
	if (plan.kind === "dash") return "mp4";
	const match = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(plan.url);
	return match ? match[1].toLowerCase() : "bin";
}

function suggestName(url: string, extension: string): string {
	const base = url.split("?")[0].split("/").filter(Boolean).pop() ?? "stream";
	const stem = base.replace(/\.[a-z0-9]{2,4}$/i, "") || "stream";
	return `${stem}.${extension}`;
}
