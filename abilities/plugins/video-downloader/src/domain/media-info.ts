export type MediaKind = "video" | "audio" | "image";

export interface MediaFormat {
  id: string;
  label: string;
  quality: string;
  ext: string;
  sizeBytes: number;
  partCount: number;
  needsFfmpeg: boolean;
  kind: "video" | "audio";
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

export interface ProbeResult {
  items: MediaItem[];
  failure: string | null;
  elapsedMs: number;
}

export type TaskPhase =
  | "queued"
  | "extracting"
  | "downloading"
  | "merging"
  | "moving"
  | "completed"
  | "failed"
  | "canceled";

export interface DownloadTask {
  id: string;
  url: string;
  site: string;
  title: string;
  streamId: string;
  quality: string;
  ext: string;
  needsFfmpeg: boolean;
  totalBytes: number;
  receivedBytes: number;
  speedBps: number;
  etaSeconds: number | null;
  phase: TaskPhase;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  filePath: string | null;
  error: string | null;
}

export interface ToolCapability {
  available: boolean;
  path: string | null;
  version: string | null;
  source: "bundled" | "path" | null;
}

export interface Capabilities {
  lux: ToolCapability;
  ffmpeg: ToolCapability;
}

export interface ServiceSettings {
  downloadDirectory: string;
  maxConcurrent: number;
  cookie: string;
  multiThread: boolean;
  keepPartialFiles: boolean;
}

export interface NewDownloadInput {
  url: string;
  site: string;
  title: string;
  streamId: string;
  quality: string;
  ext: string;
  needsFfmpeg: boolean;
  totalBytes: number;
}
