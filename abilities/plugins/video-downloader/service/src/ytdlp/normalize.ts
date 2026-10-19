import type { MediaFormat, MediaItem, MediaKind } from "../media/types.js";

/** One entry of `formats[]` in yt-dlp's `--dump-single-json` output. */
export interface YtdlpRawFormat {
  format_id?: string;
  ext?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  abr?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
}

export interface YtdlpRawInfo {
  id?: string;
  title?: string;
  extractor?: string;
  extractor_key?: string;
  webpage_url?: string;
  original_url?: string;
  url?: string;
  _type?: string;
  formats?: YtdlpRawFormat[];
  entries?: YtdlpRawInfo[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function codecPresent(codec: string): boolean {
  return codec !== "" && codec !== "none";
}

interface RankedFormat {
  format: MediaFormat;
  height: number;
  audio: boolean;
}

/**
 * Map one yt-dlp rendition onto the panel's format model.
 *
 * Video-only renditions keep their `format_id` but are requested as a selector
 * (`<id>+bestaudio/best`) so yt-dlp fetches the matching audio track and merges the pair
 * itself; that merge is what makes the rendition depend on ffmpeg.
 */
export function normalizeYtdlpFormat(raw: YtdlpRawFormat): RankedFormat | null {
  const formatId = asString(raw.format_id);
  if (!formatId) return null;
  const hasVideo = codecPresent(asString(raw.vcodec));
  const hasAudio = codecPresent(asString(raw.acodec));
  // Storyboards and other metadata-only entries carry neither codec.
  if (!hasVideo && !hasAudio) return null;

  const height = asFiniteNumber(raw.height);
  const fps = asFiniteNumber(raw.fps);
  const abr = asFiniteNumber(raw.abr);
  const kind: "video" | "audio" = hasVideo ? "video" : "audio";
  const needsFfmpeg = hasVideo && !hasAudio;
  const quality = hasVideo
    ? height > 0
      ? `${Math.round(height)}P${fps > 60 ? Math.round(fps) : ""}`
      : asString(raw.format_note) || "原始画质"
    : abr > 0
      ? `音频 ${Math.round(abr)}k`
      : "仅音频";
  const ext = (asString(raw.ext) || (hasVideo ? "mp4" : "m4a")).toLowerCase();

  const format: MediaFormat = {
    id: needsFfmpeg ? `${formatId}+bestaudio/best` : formatId,
    label: quality,
    quality,
    ext,
    sizeBytes: asFiniteNumber(raw.filesize) || asFiniteNumber(raw.filesize_approx),
    // A merged rendition is two transfers; a progressive one is a single file.
    partCount: needsFfmpeg ? 2 : 1,
    needsFfmpeg,
    kind,
  };
  return { format, height, audio: !hasVideo };
}

function rankFormats(entries: Array<RankedFormat | null>): RankedFormat[] {
  const formats = entries.filter((entry): entry is RankedFormat => entry !== null);
  return formats.sort((left, right) => {
    if (left.audio !== right.audio) return left.audio ? 1 : -1;
    if (left.height !== right.height) return right.height - left.height;
    // At the same resolution, a rendition that needs no extra merge is the better default.
    if (left.format.needsFfmpeg !== right.format.needsFfmpeg) return left.format.needsFfmpeg ? 1 : -1;
    if (left.format.sizeBytes !== right.format.sizeBytes) return right.format.sizeBytes - left.format.sizeBytes;
    return left.format.id.localeCompare(right.format.id);
  });
}

function kindOf(formats: MediaFormat[]): MediaKind {
  return formats.length > 0 && formats.every((format) => format.kind === "audio") ? "audio" : "video";
}

function sourceUrlOf(info: YtdlpRawInfo): string {
  return asString(info.webpage_url) || asString(info.original_url) || asString(info.url);
}

/** `entries[]` of a playlist, flattened one level and capped so a channel dump stays bounded. */
export function flattenYtdlpEntries(info: YtdlpRawInfo, limit = 50): YtdlpRawInfo[] {
  const entries = Array.isArray(info.entries) ? info.entries : [];
  if (entries.length === 0) return [info];
  return entries.filter((entry): entry is YtdlpRawInfo => Boolean(entry) && typeof entry === "object").slice(0, limit);
}

export function normalizeYtdlpInfo(info: YtdlpRawInfo, index: number): MediaItem | null {
  const rawFormats = Array.isArray(info.formats) ? info.formats : [];
  const formats = rankFormats(rawFormats.map((raw) => normalizeYtdlpFormat(raw))).map((entry) => entry.format);
  if (formats.length === 0) return null;

  const sourceUrl = sourceUrlOf(info);
  if (!sourceUrl) return null;
  // Highest rendition by default, matching what the lux engine recommends; the panel shows the
  // ffmpeg requirement and installs it on demand rather than silently downgrading the pick.
  const recommended = formats.find((format) => format.kind === "video") ?? formats[0] ?? null;

  return {
    id: `item-${index}-${sourceUrl.slice(0, 24)}`,
    sourceUrl,
    site: asString(info.extractor_key) || asString(info.extractor),
    title: asString(info.title) || sourceUrl,
    kind: kindOf(formats),
    formats,
    recommendedFormatId: recommended?.id ?? null,
  };
}
