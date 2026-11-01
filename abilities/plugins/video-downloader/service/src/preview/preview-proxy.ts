import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceError } from "../errors.js";

/**
 * A preview session turns one extracted media address into a localhost URL a `<video>` element can
 * play.
 *
 * The panel cannot point a player at the address an Adapter returned: licensed platforms answer a
 * bare request with 403 because the address is bound to the page it came from, and a browser fetch
 * of an `.m3u8` fails on CORS before the first segment is asked for. The service already holds the
 * headers and has no CORS, so it fetches once here, rewrites the playlist to loop back through this
 * process, and streams the segments through with the same headers.
 */

const SESSION_TTL_MS = 30 * 60_000;
const MAX_SESSIONS = 32;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PLAYLIST_BYTES = 4 * 1024 * 1024;
const MAX_URL_LENGTH = 4096;

interface PreviewSession {
  key: string;
  createdAt: number;
  /** Headers the platform expects, already reduced to the allowed set by the HTTP layer. */
  headers: Record<string, string>;
  /** Absolute media addresses this session actually saw; nothing else may be fetched through it. */
  allowed: Set<string>;
  /** Address the playlist came from, so a live stream can be re-read on the next request. */
  playlistUrl: string;
  playlist: string;
}

export interface PreviewOpenResult {
  key: string;
  kind: "hls" | "file";
  /** Path relative to the service base URL, ready to be used as a `<video src>`. */
  entry: string;
  contentType: string;
  bytes: number | null;
  /**
   * Whether a segment can actually be fetched. A playlist that loads proves nothing: a platform can
   * hand out a valid `.m3u8` and still reject every segment, and the player then sits on a black
   * frame with nothing to explain it.
   */
  playable: boolean;
  /** `drm`, `empty_playlist`, `upstream_unreachable` or `upstream_<status>` when `playable` is false. */
  detail: string | null;
}

/** How one media address is fetched, so tests can run without a network. */
export type PreviewFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<Response>;

/** Segment encryption this service cannot and does not attempt to open. */
const DRM_MARKER = /#EXT-X-(?:KEY|SESSION-KEY):[^\n]*?(?:METHOD=(?:SAMPLE-AES|SAMPLE-AES-CTR|SAMPLE-AES-CENC)|URI="skd:\/\/)/iu;

/** The first address in a playlist that holds media bytes — a segment, or the init segment. */
export function firstMediaUri(text: string, base: string): string | null {
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (!line.startsWith("#EXT-X-MAP")) continue;
      const uri = /URI="([^"]+)"/u.exec(line)?.[1];
      if (uri) return absoluteUrl(uri, base);
      continue;
    }
    const resolved = absoluteUrl(line, base);
    if (resolved) return resolved;
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function absoluteUrl(raw: string, base: string): string | null {
  try {
    const resolved = new URL(raw, base).toString();
    return isHttpUrl(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/** Whether a fetched body is a playlist; a `.m3u8` served as text/plain still has to be rewritten. */
export function isPlaylist(url: string, contentType: string, body: string): boolean {
  const type = contentType.toLowerCase();
  if (type.includes("mpegurl")) return true;
  if (body.trimStart().startsWith("#EXTM3U")) return true;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

/**
 * Rewrites every URI in a playlist so the player asks this service instead of the platform.
 *
 * `#EXT-X-KEY` carries the decryption key address and `#EXT-X-MAP` the initialisation segment;
 * missing either one leaves the player with an unplayable stream rather than a 403, which is much
 * harder to diagnose from the panel.
 */
export function rewritePlaylist(text: string, baseUrl: string, key: string, seen: Set<string>): string {
  const media = (raw: string): string => {
    const resolved = absoluteUrl(raw, baseUrl);
    if (!resolved) return raw;
    seen.add(resolved);
    return `/api/v1/preview/${key}/media?u=${encodeURIComponent(resolved)}`;
  };

  return text
    .split(/\r?\n/u)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        // Attribute-list tags name their address as URI="…"; nothing else in a playlist does.
        return line.replace(/URI="([^"]+)"/gu, (_, uri: string) => `URI="${media(uri)}"`);
      }
      return media(trimmed);
    })
    .join("\n");
}

export class PreviewProxy {
  private readonly sessions = new Map<string, PreviewSession>();

  constructor(private readonly fetchImpl: PreviewFetch = (url, init) => fetch(url, init)) {}

  /** Registers one address and probes it, so the panel knows whether it can even be played. */
  async open(url: string, headers: Record<string, string>): Promise<PreviewOpenResult> {
    if (!isHttpUrl(url)) throw new ServiceError("invalid_url", "预览地址必须是 http(s) 链接");
    this.prune();
    const key = randomUUID().replace(/-/gu, "");
    const session: PreviewSession = {
      key,
      createdAt: Date.now(),
      headers,
      allowed: new Set([url]),
      playlistUrl: "",
      playlist: "",
    };
    const response = await this.request(url, session);
    if (!response.ok) {
      throw new ServiceError("preview_failed", `预览失败：站点返回 ${response.status}`, 502);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const body = await this.readText(response);
    if (isPlaylist(url, contentType, body)) {
      session.playlistUrl = url;
      session.playlist = rewritePlaylist(body, url, key, session.allowed);
      this.sessions.set(key, session);
      return {
        key,
        kind: "hls",
        entry: `/api/v1/preview/${key}/index.m3u8`,
        contentType,
        bytes: session.playlist.length,
        ...(await this.checkPlayable(session, body, url)),
      };
    }
    // A single file: the player streams it through the media route so Range and headers survive.
    session.allowed.add(url);
    this.sessions.set(key, session);
    const length = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    return {
      key,
      kind: "file",
      entry: `/api/v1/preview/${key}/media?u=${encodeURIComponent(url)}`,
      contentType,
      bytes: Number.isFinite(length) ? length : null,
      playable: true,
      detail: null,
    };
  }

  /** The rewritten playlist, re-read from upstream when it came from a live stream. */
  async playlist(key: string): Promise<string> {
    const session = this.require(key);
    if (!session.playlistUrl) return session.playlist;
    const response = await this.request(session.playlistUrl, session);
    if (!response.ok) return session.playlist;
    const text = await this.readText(response);
    session.playlist = rewritePlaylist(text, session.playlistUrl, key, session.allowed);
    return session.playlist;
  }

  /** Streams one already-authorised address, forwarding Range and the platform headers. */
  async proxyMedia(
    key: string,
    target: string,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const session = this.require(key);
    if (target.length > MAX_URL_LENGTH || !session.allowed.has(target)) {
      throw new ServiceError("preview_blocked", "预览只允许当前会话发现过的媒体地址", 403);
    }
    const range = typeof request.headers.range === "string" ? request.headers.range : "";
    const upstream = await this.request(target, session, range ? { range } : {});
    const passthrough: Record<string, string> = {};
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name);
      if (value) passthrough[name] = value;
    }
    // The real status, not a blanket 200: a rejected segment has to reach the player as a failure,
    // otherwise hls.js sees a successful response with a JSON body and stalls on a black frame.
    const status = upstream.status >= 200 && upstream.status < 600 ? upstream.status : 502;
    response.writeHead(status, { ...passthrough, "cache-control": "no-store", "x-preview-status": String(status) });
    if (!upstream.body) {
      response.end();
      return;
    }
    const stream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      response.on("close", resolve);
      stream.pipe(response).on("finish", resolve);
    });
  }

  /**
   * Answers the question the panel actually has: will a picture appear? Reads the encryption tags
   * first (cheap, no request), then asks upstream for two bytes of the first segment.
   */
  private async checkPlayable(
    session: PreviewSession,
    playlist: string,
    base: string,
  ): Promise<{ playable: boolean; detail: string | null }> {
    if (DRM_MARKER.test(playlist)) return { playable: false, detail: "drm" };
    const segment = firstMediaUri(playlist, base);
    if (!segment) return { playable: false, detail: "empty_playlist" };
    const probe = await this.request(segment, session, { range: "bytes=0-1" }).catch(() => null);
    if (!probe) return { playable: false, detail: "upstream_unreachable" };
    if (probe.status < 400) return { playable: true, detail: null };
    return { playable: false, detail: `upstream_${probe.status}` };
  }

  close(key: string): boolean {
    return this.sessions.delete(key);
  }

  private require(key: string): PreviewSession {
    const session = this.sessions.get(key);
    if (!session) throw new ServiceError("preview_expired", "预览已过期，请重新解析", 404);
    return session;
  }

  private async request(
    url: string,
    session: PreviewSession,
    extra: Record<string, string> = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(url, {
        headers: { ...session.headers, ...extra },
        // A segment request is a plain GET; the timeout below covers connect and headers.
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceError("preview_failed", `预览失败：${error instanceof Error ? error.message : String(error)}`, 502);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readText(response: Response): Promise<string> {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.subarray(0, MAX_PLAYLIST_BYTES).toString("utf8");
  }

  private prune(): void {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [key, session] of this.sessions) {
      if (session.createdAt < cutoff) this.sessions.delete(key);
    }
    while (this.sessions.size >= MAX_SESSIONS) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldest) break;
      this.sessions.delete(oldest.key);
    }
  }
}
