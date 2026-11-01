import { Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { isPlaylist, PreviewProxy, rewritePlaylist, type PreviewFetch } from "../preview/preview-proxy.js";

const MASTER = [
  "#EXTM3U",
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",URI="audio.m3u8"',
  "#EXT-X-STREAM-INF:BANDWIDTH=900000",
  "video-720.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=400000",
  "https://cdn.example.com/video-360.m3u8?token=abc",
].join("\n");

const MEDIA = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key.bin"',
  '#EXT-X-MAP:URI="/init.mp4"',
  "#EXTINF:4.0,",
  "seg-1.ts",
  "#EXTINF:4.0,",
  "seg-2.ts",
  "#EXT-X-ENDLIST",
].join("\n");

function jsonFetch(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), init);
}

describe("playlist rewriting", () => {
  it("routes every URI through the session, including relative ones", () => {
    const seen = new Set<string>();
    const rewritten = rewritePlaylist(MASTER, "https://cdn.example.com/hls/master.m3u8", "k1", seen);
    expect(rewritten).toContain("/api/v1/preview/k1/media?u=https%3A%2F%2Fcdn.example.com%2Fhls%2Faudio.m3u8");
    expect(rewritten).toContain("/api/v1/preview/k1/media?u=https%3A%2F%2Fcdn.example.com%2Fhls%2Fvideo-720.m3u8");
    // An absolute URI in the playlist keeps its own host.
    expect(rewritten).toContain(encodeURIComponent("https://cdn.example.com/video-360.m3u8?token=abc"));
    expect(rewritten).not.toContain("#EXT-X-STREAM-INF:/api");
    expect(seen.size).toBe(3);
  });

  it("rewrites the key and init-segment URIs of a media playlist", () => {
    // Missing these leaves the player with a stream it cannot decrypt rather than a clear 403.
    const seen = new Set<string>();
    const rewritten = rewritePlaylist(MEDIA, "https://cdn.example.com/hls/index.m3u8", "k2", seen);
    expect(rewritten).toContain('URI="/api/v1/preview/k2/media?u=https%3A%2F%2Fcdn.example.com%2Fkey.bin"');
    expect(rewritten).toContain('URI="/api/v1/preview/k2/media?u=https%3A%2F%2Fcdn.example.com%2Finit.mp4"');
    expect(rewritten).toContain("u=https%3A%2F%2Fcdn.example.com%2Fhls%2Fseg-1.ts");
    expect(seen).toContain("https://cdn.example.com/key.bin");
  });

  it("leaves a URI it cannot resolve untouched instead of inventing one", () => {
    const rewritten = rewritePlaylist("#EXT-X-KEY:URI=\"data:text/plain,no\"", "https://a.example/x.m3u8", "k", new Set());
    expect(rewritten).toBe('#EXT-X-KEY:URI="data:text/plain,no"');
  });

  it("detects a playlist by body even when the platform labels it text/plain", () => {
    expect(isPlaylist("https://a.example/list", "text/plain", MEDIA)).toBe(true);
    expect(isPlaylist("https://a.example/x.m3u8", "", "")).toBe(true);
    expect(isPlaylist("https://a.example/x.mp4", "video/mp4", "\u0000\u0000")).toBe(false);
  });
});

describe("preview sessions", () => {
  it("opens an HLS address and hands back a local playlist entry", async () => {
    const proxy = new PreviewProxy(async () => new Response(MASTER, { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
    const opened = await proxy.open("https://cdn.example.com/hls/master.m3u8", { referer: "https://a.example/" });
    expect(opened.kind).toBe("hls");
    expect(opened.entry).toBe(`/api/v1/preview/${opened.key}/index.m3u8`);
    const playlist = await proxy.playlist(opened.key);
    expect(playlist).toContain(`/api/v1/preview/${opened.key}/media?u=`);
  });

  it("opens a single file and points the player at the media route", async () => {
    const proxy = new PreviewProxy(
      async () => new Response("binary", { headers: { "content-type": "video/mp4", "content-length": "6" } }),
    );
    const opened = await proxy.open("https://cdn.example.com/a.mp4", {});
    expect(opened.kind).toBe("file");
    expect(opened.bytes).toBe(6);
    expect(opened.entry).toContain("/media?u=https%3A%2F%2Fcdn.example.com%2Fa.mp4");
  });

  it("refuses a segment address the session never discovered", async () => {
    // Without the allowlist the media route would be an open proxy for anything on the machine.
    const proxy = new PreviewProxy(async () => new Response(MASTER, { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
    const opened = await proxy.open("https://cdn.example.com/hls/master.m3u8", {});
    const response = fakeResponse();
    await expect(
      proxy.proxyMedia(opened.key, "http://127.0.0.1:9200/_cat/indices", fakeRequest(), response),
    ).rejects.toThrow(/只允许当前会话/);
  });

  it("forwards Range and the response status of a segment", async () => {
    const calls: string[] = [];
    const fetchImpl: PreviewFetch = async (_url, init) => {
      calls.push(init.headers.range ?? "");
      return new Response("chunk", {
        status: 206,
        headers: { "content-type": "video/mp2t", "content-range": "bytes 0-4/100", "content-length": "5" },
      });
    };
    const proxy = new PreviewProxy(async (url, init) =>
      url.endsWith(".m3u8") ? new Response(MEDIA, { headers: { "content-type": "application/vnd.apple.mpegurl" } }) : fetchImpl(url, init),
    );
    const opened = await proxy.open("https://cdn.example.com/hls/index.m3u8", {});
    const segment = "https://cdn.example.com/hls/seg-1.ts";
    const response = fakeResponse();
    await proxy.proxyMedia(opened.key, segment, fakeRequest({ range: "bytes=0-4" }), response);
    // calls[0] is the open-time probe of the first segment; the player's own request comes after.
    expect(calls.at(-1)).toBe("bytes=0-4");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 0-4/100");
  });

  it("reports a platform refusal instead of pretending the address is playable", async () => {
    const proxy = new PreviewProxy(async () => new Response("nope", { status: 403 }));
    await expect(proxy.open("https://cdn.example.com/a.mp4", {})).rejects.toThrow(/403/);
  });

  it("rejects a non-HTTP address before any request leaves the process", async () => {
    let called = false;
    const proxy = new PreviewProxy(async () => {
      called = true;
      return jsonFetch({});
    });
    await expect(proxy.open("file:///etc/passwd", {})).rejects.toThrow(/http/);
    expect(called).toBe(false);
  });

  it("forgets a closed session", async () => {
    const proxy = new PreviewProxy(async () => new Response(MASTER, { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
    const opened = await proxy.open("https://cdn.example.com/hls/master.m3u8", {});
    expect(proxy.close(opened.key)).toBe(true);
    await expect(proxy.playlist(opened.key)).rejects.toThrow(/过期/);
  });

  it("marks a playlist unplayable when the platform refuses the first segment", async () => {
    // The iQIYI shape: a valid playlist whose segments answer 405 with a JSON error body.
    const proxy = new PreviewProxy(async (url) =>
      url.endsWith(".m3u8")
        ? new Response(MEDIA, { headers: { "content-type": "application/vnd.apple.mpegurl" } })
        : new Response('{"code":"D2102"}', { status: 405, headers: { "content-type": "application/json" } }),
    );
    const opened = await proxy.open("https://cdn.example.com/hls/index.m3u8", {});
    expect(opened.kind).toBe("hls");
    expect(opened.playable).toBe(false);
    expect(opened.detail).toBe("upstream_405");
  });

  it("reports an encrypted stream instead of probing it", async () => {
    const drm = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://key-id"',
      "#EXTINF:4.0,",
      "seg-1.ts",
    ].join("\n");
    let probed = 0;
    const proxy = new PreviewProxy(async (url) => {
      if (!url.endsWith(".m3u8")) probed += 1;
      return new Response(drm, { headers: { "content-type": "application/vnd.apple.mpegurl" } });
    });
    const opened = await proxy.open("https://cdn.example.com/hls/drm.m3u8", {});
    expect(opened.playable).toBe(false);
    expect(opened.detail).toBe("drm");
    expect(probed).toBe(0);
  });

  it("passes a segment refusal through as the real status", async () => {
    // A blanket 200 here is what turns a platform refusal into a silent black frame.
    const proxy = new PreviewProxy(async (url) =>
      url.endsWith(".m3u8")
        ? new Response(MEDIA, { headers: { "content-type": "application/vnd.apple.mpegurl" } })
        : new Response('{"code":"D2102"}', { status: 403, headers: { "content-type": "application/json" } }),
    );
    const opened = await proxy.open("https://cdn.example.com/hls/index.m3u8", {});
    const response = fakeResponse();
    await proxy.proxyMedia(opened.key, "https://cdn.example.com/hls/seg-1.ts", fakeRequest(), response);
    expect(response.status).toBe(403);
    expect(response.body).toContain("D2102");
  });
});

function fakeRequest(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

/** A real Writable so `stream.pipe(response)` in the proxy actually runs. */
function fakeResponse(): ServerResponse & {
  status: number;
  headers: Record<string, string>;
  body: string;
  ended: boolean;
} {
  const state = { status: 0, headers: {} as Record<string, string>, chunks: [] as Buffer[], ended: false };
  const writable = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      state.chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      state.ended = true;
      callback();
    },
  });
  // Object.assign would invoke the getters once and freeze their first value.
  Object.defineProperties(writable, {
    writeHead: {
      value(status: number, headers: Record<string, string>) {
        state.status = status;
        state.headers = headers;
        return writable;
      },
    },
    status: { get: () => state.status },
    headers: { get: () => state.headers },
    body: { get: () => Buffer.concat(state.chunks).toString("utf8") },
    ended: { get: () => state.ended },
  });
  return writable as unknown as ServerResponse & {
    status: number;
    headers: Record<string, string>;
    body: string;
    ended: boolean;
  };
}
