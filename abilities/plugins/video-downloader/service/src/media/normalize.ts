import type { LuxRawData, LuxRawStream, MediaFormat, MediaItem, MediaKind } from "./types.js";

const AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "aac", "opus", "ogg", "wav", "flac"]);

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `1080` / `1080p60` / `hd` / `flv` — pull the vertical resolution when present. */
export function resolutionOf(...candidates: string[]): number {
  for (const candidate of candidates) {
    const match = /(\d{3,4})\s*p?/i.exec(candidate);
    if (match) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(value) && value >= 144 && value <= 8640) return value;
    }
  }
  return 0;
}

export function isAudioOnly(stream: LuxRawStream): boolean {
  const parts = stream.parts ?? [];
  if (parts.length === 0) return false;
  return parts.every((part) => AUDIO_EXTENSIONS.has(asString(part.ext).toLowerCase()));
}

export function formatLabel(stream: LuxRawStream, kind: "video" | "audio"): string {
  const quality = asString(stream.quality) || asString(stream.id);
  if (kind === "audio") return quality ? `音频 ${quality}` : "仅音频";
  const resolution = resolutionOf(quality, asString(stream.id));
  if (resolution > 0) return `${resolution}P`;
  return quality || "原始画质";
}

function buildFormat(stream: LuxRawStream, id: string): MediaFormat | null {
  const parts = Array.isArray(stream.parts) ? stream.parts : [];
  const partCount = parts.length;
  if (partCount === 0) return null;
  const ext = (asString(stream.ext) || asString(parts[0]?.ext) || "mp4").toLowerCase();
  const kind: "video" | "audio" = isAudioOnly(stream) ? "audio" : "video";
  const sizeBytes = asFiniteNumber(stream.size) || parts.reduce((total, part) => total + asFiniteNumber(part.size), 0);
  const needMux = stream.NeedMux === true;
  return {
    id,
    label: formatLabel(stream, kind),
    quality: asString(stream.quality) || asString(stream.id) || id,
    ext,
    sizeBytes,
    partCount,
    // Every multi-part rendition is remuxed through ffmpeg: `MergeToMP4` for plain MP4 and
    // `MergeFilesWithSameExtension` (one `-i` per part, stream copy) for muxed DASH/fMP4
    // payloads. Only a single-part stream is written without invoking ffmpeg.
    needsFfmpeg: partCount > 1,
    kind,
  };
}

function sortFormats(formats: MediaFormat[]): MediaFormat[] {
  return [...formats].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "video" ? -1 : 1;
    const leftResolution = resolutionOf(left.quality, left.id);
    const rightResolution = resolutionOf(right.quality, right.id);
    if (leftResolution !== rightResolution) return rightResolution - leftResolution;
    if (left.sizeBytes !== right.sizeBytes) return right.sizeBytes - left.sizeBytes;
    return left.id.localeCompare(right.id);
  });
}

function kindOf(data: LuxRawData): MediaKind {
  const type = asString(data.type).toLowerCase();
  if (type === "image") return "image";
  if (type === "audio") return "audio";
  return "video";
}

export function normalizeFormatId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Turn one `lux -j` entry into the item the panel renders.
 *
 * Entries carrying `err` describe extraction failures, and entries without any usable
 * rendition are dropped: showing a card the user cannot act on is worse than reporting
 * the failure once.
 */
export function normalizeItem(data: LuxRawData, index: number): MediaItem | null {
  if (data.err) return null;
  const streams = data.streams ?? {};
  const formats: MediaFormat[] = [];
  for (const [key, stream] of Object.entries(streams)) {
    if (!stream || typeof stream !== "object") continue;
    const format = buildFormat(stream, asString(stream.id) || key);
    if (format) formats.push(format);
  }
  if (formats.length === 0) return null;
  const sorted = sortFormats(formats);
  const recommended = sorted.find((format) => format.kind === "video") ?? sorted[0] ?? null;
  const sourceUrl = asString(data.url);
  return {
    id: `item-${index}-${sourceUrl.slice(0, 24)}`,
    sourceUrl,
    site: asString(data.site),
    title: asString(data.title) || sourceUrl,
    kind: kindOf(data),
    formats: sorted,
    recommendedFormatId: recommended?.id ?? null,
  };
}

export function normalizeProbe(dataList: LuxRawData[]): MediaItem[] {
  const items: MediaItem[] = [];
  dataList.forEach((data, index) => {
    const item = normalizeItem(data, index);
    if (item) items.push(item);
  });
  return items;
}

/** Reason extracted from a failed probe entry, used to explain the empty result. */
export function probeFailureReason(dataList: LuxRawData[]): string | null {
  for (const data of dataList) {
    const error = data.err;
    if (!error) continue;
    if (typeof error === "string" && error.trim()) return error.trim();
    if (typeof error === "object") {
      const message = (error as { message?: unknown; Message?: unknown }).message ?? (error as { Message?: unknown }).Message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    // Go marshals `error` through its exported fields, which is usually an empty object.
    if (typeof error === "object" && Object.keys(error as object).length === 0) {
      return "该链接无法解析，可能需要登录或 Cookie";
    }
  }
  return null;
}
