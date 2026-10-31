export type MediaKind = "video" | "audio" | "image";

/** A downloadable rendition of one extracted item. */
export interface MediaFormat {
  /** Identifier understood by `yt-dlp -f`; a video-only stream carries a merge selector. */
  id: string;
  /** Human label such as `1080P`, `仅音频`, `原始`. */
  label: string;
  quality: string;
  ext: string;
  sizeBytes: number;
  partCount: number;
  /** A video-only rendition is merged with the audio track, which needs ffmpeg. */
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
  /** Cover art advertised by the extractor; empty when the site has none. */
  thumbnailUrl: string;
  /** Runtime in seconds, 0 when the extractor does not report one. */
  durationSeconds: number;
  /** Uploader or channel name; empty for sites that expose neither. */
  uploader: string;
}

export interface MediaProbeResult {
  items: MediaItem[];
  elapsedMs: number;
}
