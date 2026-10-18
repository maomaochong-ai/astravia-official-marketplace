export type MediaKind = "video" | "audio" | "image";

/** A downloadable rendition of one extracted item. */
export interface MediaFormat {
  /** Identifier understood by `lux -f`. */
  id: string;
  /** Human label such as `1080P`, `仅音频`, `原始`. */
  label: string;
  quality: string;
  ext: string;
  sizeBytes: number;
  partCount: number;
  /** lux merges multi-part MP4 renditions with ffmpeg, which is an external dependency. */
  needsFfmpeg: boolean;
  kind: Exclude<MediaKind, "image">;
}

export interface MediaItem {
  id: string;
  sourceUrl: string;
  site: string;
  title: string;
  kind: MediaKind;
  formats: MediaFormat[];
  recommendedFormatId: string | null;
}

export interface MediaProbeResult {
  items: MediaItem[];
  elapsedMs: number;
}

/** Shape of `lux -j` output; every field is optional because upstream is loosely typed. */
export interface LuxRawPart {
  url?: string;
  size?: number;
  ext?: string;
}

export interface LuxRawStream {
  id?: string;
  quality?: string;
  parts?: LuxRawPart[];
  size?: number;
  ext?: string;
  NeedMux?: boolean;
}

export interface LuxRawData {
  url?: string;
  site?: string;
  title?: string;
  type?: string;
  streams?: Record<string, LuxRawStream | null> | null;
  err?: unknown;
}
