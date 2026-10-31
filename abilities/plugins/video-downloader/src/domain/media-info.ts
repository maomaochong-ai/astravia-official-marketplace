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
  /** Cover art advertised by the extractor; empty when the site has none. */
  thumbnailUrl: string;
  /** Runtime in seconds, 0 when the extractor does not report one. */
  durationSeconds: number;
  /** Uploader or channel name; empty for sites that expose neither. */
  uploader: string;
}

export interface ProbeResult {
  items: MediaItem[];
  failure: string | null;
  /** Machine readable reason for `failure`, when the service could classify it. */
  failureCode: string | null;
  elapsedMs: number;
}

/** One group of handles the engine can resolve; `key` selects the translated heading. */
export interface SiteGroupCoverage {
  key: "global" | "china" | "screen" | "audio" | "live";
  sites: string[];
}

/** What the pinned engine cannot resolve, so the panel can explain the failure as a site fact. */
export interface UnsupportedSite {
  label: string;
  reason: "engine-missing" | "upstream-broken" | "site-offline";
}

export interface SiteCoverage {
  groups: SiteGroupCoverage[];
  unsupported: UnsupportedSite[];
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
  /** Machine readable reason for `error`; older persisted tasks may omit it. */
  errorCode?: string | null;
}

export interface ToolCapability {
  available: boolean;
  path: string | null;
  version: string | null;
  source: "bundled" | "path" | null;
}

export interface Capabilities {
  ytdlp: ToolCapability;
  ffmpeg: ToolCapability;
}

export type ToolInstallPhase = "idle" | "downloading" | "verifying" | "ready" | "failed";

/** Progress of a tool download; ffmpeg and yt-dlp share the same lifecycle. */
export interface ToolInstall {
  phase: ToolInstallPhase;
  receivedBytes: number;
  totalBytes: number;
  /** False when the platform has no pinned build to download. */
  supported: boolean;
  error: string | null;
}

export interface ServiceSettings {
  downloadDirectory: string;
  maxConcurrent: number;
  cookie: string;
  /** Browser the engine reads a session from; empty when the cookie field is the only source. */
  cookieBrowser: "" | "chrome" | "edge" | "safari" | "firefox" | "brave" | "chromium";
  /** Proxy URL handed to the engine; empty means the machine's own egress. */
  proxy: string;
  /** `auto` keeps mainland platforms on the direct route and only proxies foreign ones. */
  proxyMode: "auto" | "always" | "off";
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
