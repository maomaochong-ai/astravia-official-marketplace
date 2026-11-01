import { ADAPTER_STREAM_ID, type MediaItem } from "./media-info";

/**
 * What an Adapter is allowed to use. The set is deliberately small: every entry has to map onto
 * something the offscreen page or `ctx.storage` can actually provide.
 */
export type AdapterGrant = "none" | "page-fetch" | "storage";

export interface AdapterMeta {
  /** Stable identity; also the storage key for `storage` grants. */
  name: string;
  version: string;
  /** Tampermonkey-style `@match` patterns; the run is refused unless the page URL hits one. */
  match: string[];
  description: string;
  grant: AdapterGrant;
}

export interface Adapter {
  id: string;
  meta: AdapterMeta;
  /**
   * Source of one function. It runs inside the target page, receives `{ url, document, window }`
   * and must resolve to an `AdapterExtraction`.
   */
  body: string;
  enabled: boolean;
  /** Epoch millis of the last import or edit. */
  updatedAt: number;
}

export interface AdapterExtraction {
  directUrl: string;
  title?: string;
  thumbnailUrl?: string;
  uploader?: string;
  durationSeconds?: number;
  /** `mp4` / `mp3` / `m4a`; defaults to `mp4`. */
  ext?: string;
  /** Human readable rendition, e.g. `1080P`. */
  quality?: string;
  headers?: Record<string, string>;
}

export interface AdapterRunResult {
  extraction: AdapterExtraction;
  elapsedMs: number;
}

export type AdapterImportResult =
  | { ok: true; adapter: Adapter }
  | { ok: false; error: string };

const MAX_BODY_LENGTH = 40_000;

/** Header names the engine accepts through `--add-header`; mirrors the service whitelist. */
const ALLOWED_HEADERS = new Set(["referer", "user-agent", "origin", "cookie", "accept", "x-requested-with"]);

export function adapterId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug || "adapter";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asMatchList(value: unknown): string[] {
  const raw = typeof value === "string" ? value.split(/[\s,]+/u) : Array.isArray(value) ? value : [];
  const patterns = raw.map((entry) => asText(entry)).filter((entry) => entry.length > 0);
  return patterns.length > 0 ? patterns : ["<all_urls>"];
}

function asGrant(value: unknown): AdapterGrant {
  return value === "page-fetch" || value === "storage" ? value : "none";
}

/** Accepts both the documented envelope and a flat `{ name, match, body }` object. */
export function parseAdapterJson(text: string): AdapterImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "JSON 无法解析，请检查括号与逗号" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "顶层必须是一个对象" };
  }
  const record = parsed as Record<string, unknown>;
  const metaSource = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : record;
  const name = asText(metaSource.name);
  if (!name) return { ok: false, error: "缺少 name" };
  const body = asText(record.body);
  if (!body) return { ok: false, error: "缺少 body（提取函数源码）" };
  if (body.length > MAX_BODY_LENGTH) return { ok: false, error: "body 超过 40000 字符" };
  return {
    ok: true,
    adapter: {
      id: adapterId(name),
      meta: {
        name,
        version: asText(metaSource.version) || "0.1.0",
        match: asMatchList(metaSource.match),
        description: asText(metaSource.description),
        grant: asGrant(metaSource.grant),
      },
      body,
      enabled: record.enabled !== false,
      updatedAt: Date.now(),
    },
  };
}

export function serializeAdapter(adapter: Adapter): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      meta: adapter.meta,
      enabled: adapter.enabled,
      body: adapter.body,
    },
    null,
    2,
  )}\n`;
}

function patternToRegExp(pattern: string): RegExp {
  if (pattern === "<all_urls>") return /^https?:\/\//u;
  // `*` spans scheme, host and path the way Tampermonkey's @match does.
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*/gu, ".*");
  return new RegExp(`^${escaped}$`, "u");
}

export function adapterMatchesUrl(adapter: Adapter, url: string): boolean {
  return adapter.meta.match.some((pattern) => {
    try {
      return patternToRegExp(pattern).test(url);
    } catch {
      return false;
    }
  });
}

export function matchingAdapters(adapters: Adapter[], url: string): Adapter[] {
  return adapters.filter((adapter) => adapter.enabled && adapterMatchesUrl(adapter, url));
}

function safeHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const name = rawName.trim().toLowerCase();
    const text = asText(rawValue).replace(/[\r\n]/gu, "");
    if (!ALLOWED_HEADERS.has(name) || !text || text.length > 2048) continue;
    headers[name] = text;
  }
  return headers;
}

/** HLS needs a remux, which is the one case where the adapter path still wants ffmpeg. */
function needsFfmpegFor(directUrl: string): boolean {
  return /\.m3u8(\?|$)/iu.test(directUrl);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

export function normalizeExtraction(value: unknown): AdapterExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const directUrl = asText(record.directUrl);
  if (!isHttpUrl(directUrl)) return null;
  const duration = typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds)
    ? Math.max(0, record.durationSeconds)
    : 0;
  return {
    directUrl,
    title: asText(record.title) || undefined,
    thumbnailUrl: isHttpUrl(asText(record.thumbnailUrl)) ? asText(record.thumbnailUrl) : undefined,
    uploader: asText(record.uploader) || undefined,
    durationSeconds: duration || undefined,
    ext: asText(record.ext).toLowerCase() || undefined,
    quality: asText(record.quality) || undefined,
    headers: safeHeaders(record.headers),
  };
}

export function adapterToItem(adapter: Adapter, sourceUrl: string, extraction: AdapterExtraction): MediaItem {
  const ext = extraction.ext || "mp4";
  const needsFfmpeg = needsFfmpegFor(extraction.directUrl);
  return {
    id: `adapter-${adapter.id}`,
    sourceUrl,
    site: adapter.meta.name,
    title: extraction.title || sourceUrl,
    kind: "video",
    formats: [
      {
        id: ADAPTER_STREAM_ID,
        label: extraction.quality || ext.toUpperCase(),
        quality: extraction.quality || "",
        ext,
        sizeBytes: 0,
        partCount: 1,
        needsFfmpeg,
        kind: "video",
        directUrl: extraction.directUrl,
        headers: extraction.headers,
      },
    ],
    recommendedFormatId: ADAPTER_STREAM_ID,
    thumbnailUrl: extraction.thumbnailUrl || "",
    durationSeconds: extraction.durationSeconds || 0,
    uploader: extraction.uploader || "",
    extractionPath: "adapter",
  };
}

const MAX_VALUES_BYTES = 8_192;

/** Values an Adapter persisted through `GM_setValue`, bounded so one run cannot grow storage unbounded. */
export function normalizeValues(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 32)) {
    if (key.length > 0 && key.length <= 64) next[key] = entry;
  }
  try {
    if (JSON.stringify(next).length > MAX_VALUES_BYTES) return {};
  } catch {
    return {};
  }
  return next;
}

/** Skeleton shown by the editor; it contains no site-specific logic on purpose. */
export const ADAPTER_TEMPLATE = `{
  "schemaVersion": 1,
  "meta": {
    "name": "My Adapter",
    "version": "0.1.0",
    "description": "Resolve the playable address of a page the engine cannot read.",
    "match": ["https://example.com/*"],
    "grant": "page-fetch"
  },
  "body": "async function extract(ctx) {\\n  const meta = document.querySelector('meta[property=\\"og:video\\"]');\\n  const directUrl = meta ? meta.getAttribute('content') : '';\\n  if (!directUrl) throw new Error('页面里没有可播地址');\\n  return { directUrl, title: document.title, headers: { referer: location.href } };\\n}"
}
`;
