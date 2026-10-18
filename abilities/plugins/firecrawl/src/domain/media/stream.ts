/**
 * Stream planning and download: HLS and DASH, unencrypted only.
 *
 * The host browser cannot evaluate script, so a player's own pipeline is out of
 * reach. What is reachable is the manifest: playlists and MPDs are plain text, so
 * the segments behind them can be enumerated and fetched individually here.
 *
 * Encryption is where this stops, deliberately. An `#EXT-X-KEY` that is not
 * `METHOD=NONE`, `ContentProtection` in an MPD, or a `SAMPLE-AES`/Widevine entry
 * means the media is protected — that is DRM, and this module reports it as such
 * instead of trying to work around it. Init segments (`EXT-X-MAP`) are part of the
 * container, not protection, so they are fetched like any other segment.
 */

import type { BinaryFetch, HttpClient } from "../scrape/http";

export type StreamKind = "hls" | "dash" | "file";

export interface StreamPlan {
	kind: StreamKind;
	/** The playlist or file actually read (after master-playlist selection). */
	url: string;
	/** Init segment first, then media segments in presentation order. */
	segments: string[];
	container: "mp4" | "ts" | "bin";
	/** Non-null when the media is protected; nothing is downloaded in that case. */
	encryption: string | null;
	contentType: string;
}

export class StreamError extends Error {
	constructor(
		message: string,
		readonly reason: "unsupported" | "protected" | "empty" | "network",
	) {
		super(message);
		this.name = "StreamError";
	}
}

const MAX_SEGMENTS = 2_000;

function absolute(reference: string, base: string): string {
	try {
		return new URL(reference, base).toString();
	} catch {
		return reference;
	}
}

/** `null` when this is neither an HLS playlist, a DASH manifest, nor a media file. */
export function streamKind(url: string, contentType: string, head: string): StreamKind | null {
	const type = contentType.toLowerCase();
	if (type.includes("mpegurl") || head.startsWith("#EXTM3U")) return "hls";
	if (type.includes("dash+xml") || head.includes("<MPD")) return "dash";
	if (type.startsWith("video/") || type.startsWith("audio/") || /\.(mp4|m4v|webm|mkv|mov|mp3|m4a)(\?|$)/i.test(url)) {
		return "file";
	}
	return null;
}

export async function planStream(client: HttpClient, url: string, notes: string[], depth = 0): Promise<StreamPlan> {
	if (depth > 3) throw new StreamError("The playlist chain is deeper than 3 levels; give the media playlist URL instead", "unsupported");
	const response = await client({ url, timeoutMs: 45_000 });
	if (!response.ok) throw new StreamError(`HTTP ${response.status} while reading ${url}`, "network");
	const contentType = response.headers["content-type"] ?? "";
	const kind = streamKind(url, contentType, response.body.slice(0, 512));
	if (kind === "hls") return planHls(client, url, response.body, notes, depth);
	if (kind === "dash") return planDash(url, response.body);
	if (kind === "file") {
		return { kind: "file", url, segments: [url], container: containerOf(url), encryption: null, contentType };
	}
	throw new StreamError(
		`${url} is not a video stream: expected an HLS playlist (.m3u8), a DASH manifest (.mpd) or a media file`,
		"unsupported",
	);
}

async function planHls(
	client: HttpClient,
	url: string,
	body: string,
	notes: string[],
	depth: number,
): Promise<StreamPlan> {
	const lines = body.split(/\r?\n/).map((line) => line.trim());
	if (lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) {
		const variant = highestBandwidthVariant(lines, url);
		if (!variant) throw new StreamError("The master playlist lists no variants", "empty");
		notes.push(`Master playlist: rendering the ${variant.bandwidth.toLocaleString()} bps variant ${variant.resolution ?? ""}`.trim());
		return planStream(client, variant.url, notes, depth + 1);
	}

	let init: string | null = null;
	let encryption: string | null = null;
	const segments: string[] = [];
	for (const line of lines) {
		if (line.startsWith("#EXT-X-MAP:")) {
			const uri = /URI="([^"]+)"/.exec(line);
			if (uri?.[1]) init = absolute(uri[1], url);
			continue;
		}
		if (line.startsWith("#EXT-X-KEY:")) {
			const method = /METHOD=([^,]+)/.exec(line)?.[1]?.trim() ?? "";
			if (method && method !== "NONE") encryption = method;
			continue;
		}
		if (line.startsWith("#") || line.length === 0) continue;
		segments.push(absolute(line, url));
	}
	if (segments.length === 0) throw new StreamError("The media playlist lists no segments", "empty");
	if (segments.length > MAX_SEGMENTS) {
		notes.push(`Only the first ${MAX_SEGMENTS} of ${segments.length} segments are used`);
		segments.length = MAX_SEGMENTS;
	}
	return {
		kind: "hls",
		url,
		segments: init ? [init, ...segments] : segments,
		container: init || /\.m4s(\?|$)/i.test(segments[0]) ? "mp4" : "ts",
		encryption,
		contentType: "application/vnd.apple.mpegurl",
	};
}

function highestBandwidthVariant(lines: string[], url: string): { url: string; bandwidth: number; resolution?: string } | null {
	let best: { url: string; bandwidth: number; resolution?: string } | null = null;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
		const next = lines.slice(index + 1).find((candidate) => candidate.length > 0 && !candidate.startsWith("#"));
		if (!next) continue;
		const bandwidth = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? "0");
		const resolution = /RESOLUTION=([\dx]+)/i.exec(line)?.[1];
		if (!best || bandwidth > best.bandwidth) best = { url: absolute(next, url), bandwidth, resolution };
	}
	return best;
}

function planDash(url: string, body: string): StreamPlan {
	if (/<ContentProtection/i.test(body)) {
		return { kind: "dash", url, segments: [], container: "mp4", encryption: "ContentProtection (DRM)", contentType: "application/dash+xml" };
	}
	const template = /<SegmentTemplate\b([^>]*)>/i.exec(body);
	if (!template) {
		throw new StreamError(
			"This DASH manifest has no SegmentTemplate, so its segments cannot be addressed without a full MPD implementation. Use the HLS playlist if the site offers one",
			"unsupported",
		);
	}
	const attributes = attributeMap(template[1]);
	const media = attributes.media;
	if (!media || !/\$Number(\$|%)/.test(media)) {
		throw new StreamError(
			"Only SegmentTemplate manifests with a $Number$ or $Number%0Nd$ media pattern are supported",
			"unsupported",
		);
	}
	// $RepresentationID$/$Bandwidth$ are part of the common template shape; with a
	// single representation (the usual case for one video) both are resolvable.
	const representationId = /<Representation\b[^>]*\bid="([^"]+)"/i.exec(body)?.[1] ?? "";
	const bandwidth = /<Representation\b[^>]*\bbandwidth="(\d+)"/i.exec(body)?.[1] ?? "";
	const expand = (template: string, number: number): string =>
		template
			.replace(/\$\$/g, "\u0000")
			.replace(/\$RepresentationID\$/g, representationId)
			.replace(/\$Bandwidth\$/g, bandwidth)
			.replace(/\$Number(?:%0(\d+)d)?\$/g, (_, width: string | undefined) =>
				width ? String(number).padStart(Number(width), "0") : String(number),
			)
			.replace(/\u0000/g, "$");
	const start = Number(attributes.startNumber ?? "1");
	const timescale = Number(attributes.timescale ?? "1");
	const segments: string[] = [];
	const timeline = /<SegmentTimeline>([\s\S]*?)<\/SegmentTimeline>/i.exec(body);
	if (timeline) {
		let number = start;
		for (const entry of timeline[1].matchAll(/<S\b([^>]*)\/?>/gi)) {
			const map = attributeMap(entry[1]);
			const repeat = Number(map.r ?? "0");
			for (let index = 0; index <= repeat; index += 1) {
				segments.push(absolute(expand(media, number), url));
				number += 1;
				if (segments.length >= MAX_SEGMENTS) break;
			}
			if (segments.length >= MAX_SEGMENTS) break;
		}
	} else {
		const duration = Number(attributes.duration ?? "0");
		const total = totalDurationSeconds(body);
		if (duration <= 0 || total <= 0) {
			throw new StreamError("This DASH manifest has neither a SegmentTimeline nor a duration, so the segment count is unknown", "unsupported");
		}
		const count = Math.min(MAX_SEGMENTS, Math.ceil((total * timescale) / duration));
		for (let index = 0; index < count; index += 1) {
			segments.push(absolute(expand(media, start + index), url));
		}
	}
	if (segments.length === 0) throw new StreamError("The DASH manifest produced no segments", "empty");
	const initialization = attributes.initialization;
	return {
		kind: "dash",
		url,
		segments: initialization ? [absolute(expand(initialization, start), url), ...segments] : segments,
		container: "mp4",
		encryption: null,
		contentType: "application/dash+xml",
	};
}

function attributeMap(source: string | undefined): Record<string, string> {
	const map: Record<string, string> = {};
	if (!source) return map;
	for (const match of source.matchAll(/([\w:]+)="([^"]*)"/g)) map[match[1]] = match[2];
	return map;
}

function totalDurationSeconds(body: string): number {
	const iso = /mediaPresentationDuration="([^"]+)"/i.exec(body)?.[1];
	if (!iso) return 0;
	const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(iso);
	if (!match) return 0;
	return Number(match[1] ?? 0) * 86_400 + Number(match[2] ?? 0) * 3_600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

function containerOf(url: string): "mp4" | "ts" | "bin" {
	if (/\.(mp4|m4v|mov)(\?|$)/i.test(url)) return "mp4";
	if (/\.ts(\?|$)/i.test(url)) return "ts";
	return "bin";
}

export interface StreamDownload {
	base64: string;
	bytes: number;
	segments: number;
	/** Set when the size cap stopped the download early. */
	truncated: boolean;
}

/** Segments are concatenated in order: init segment first, then the media. */
export async function downloadStream(
	binary: BinaryFetch,
	plan: StreamPlan,
	maxBytes: number,
	onProgress?: (done: number, total: number) => void,
): Promise<StreamDownload> {
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	let truncated = false;
	for (let index = 0; index < plan.segments.length; index += 1) {
		const response = await binary({ url: plan.segments[index], timeoutMs: 120_000 });
		if (!response.ok) throw new StreamError(`HTTP ${response.status} while fetching segment ${index + 1}`, "network");
		const chunk = base64ToBytes(response.base64);
		if (bytes + chunk.length > maxBytes) {
			truncated = true;
			break;
		}
		chunks.push(chunk);
		bytes += chunk.length;
		onProgress?.(index + 1, plan.segments.length);
	}
	if (chunks.length === 0) throw new StreamError("No segment could be downloaded within the size limit", "empty");
	return { base64: bytesToBase64(chunks, bytes), bytes, segments: chunks.length, truncated };
}

export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

export function bytesToBase64(chunks: readonly Uint8Array[], total: number): string {
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}
	let binary = "";
	const step = 0x8000;
	for (let index = 0; index < merged.length; index += step) {
		binary += String.fromCharCode(...merged.subarray(index, index + step));
	}
	return btoa(binary);
}
