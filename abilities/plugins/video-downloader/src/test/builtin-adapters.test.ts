// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { BUILTIN_ADAPTERS, isBuiltinAdapter } from "../domain/builtin-adapters";
import { adapterMatchesUrl } from "../domain/adapter";
import { adapterToItem, normalizeExtraction } from "../domain/adapter";
import type { Adapter } from "../domain/adapter";

/**
 * The three built-ins are shipped as page-side source, and nothing in the panel touches that code
 * until a run actually mounts it in a window. These tests mount them in a real DOM, which is the
 * only way to know the selector and player-state paths still match what they claim to match.
 */
const sniffer = BUILTIN_ADAPTERS.find((adapter) => adapter.meta.name === "Page Sniffer") as Adapter;
const iqiyi = BUILTIN_ADAPTERS.find((adapter) => adapter.meta.name === "iQIYI Player") as Adapter;
const channels = BUILTIN_ADAPTERS.find((adapter) => adapter.meta.name === "WeChat Channels") as Adapter;

interface AdapterContext {
  url: string;
  document: Document;
  window: Window;
}

type ExtractFn = (context: AdapterContext) => Promise<unknown>;

function load(adapter: Adapter): ExtractFn {
  // Same shape the offscreen prepareScript uses: the body evaluates to the function itself.
  return new Function(`return (${adapter.body});`)() as ExtractFn;
}

function run(adapter: Adapter): Promise<unknown> {
  return load(adapter)({ url: window.location.href, document, window });
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  // The sniffer also reads what the page already fetched; give it a clean slate per test.
  performance.clearResourceTimings();
});

describe("built-in adapters", () => {
  it("ships exactly the three read-only adapters, and none of them is editable", () => {
    expect(BUILTIN_ADAPTERS).toHaveLength(3);
    for (const adapter of BUILTIN_ADAPTERS) {
      expect(adapter.builtin).toBe(true);
      expect(adapter.enabled).toBe(true);
      expect(isBuiltinAdapter(adapter.id)).toBe(true);
      // Descriptions are catalogue keys, so both panel languages can render them.
      expect(adapter.meta.description?.startsWith("%")).toBe(true);
    }
    expect(isBuiltinAdapter("user-made")).toBe(false);
  });

  it("routes each built-in to the pages it claims", () => {
    expect(adapterMatchesUrl(sniffer, "https://example.com/watch")).toBe(true);
    expect(adapterMatchesUrl(iqiyi, "https://www.iqiyi.com/v_1jm50v4hx7c.html")).toBe(true);
    expect(adapterMatchesUrl(iqiyi, "https://m.iqiyi.com/v_1jm50v4hx7c.html")).toBe(true);
    expect(adapterMatchesUrl(iqiyi, "https://example.com/v_1.html")).toBe(false);
    expect(adapterMatchesUrl(channels, "https://weixin.qq.com/sph/AfDHNPBu7M")).toBe(true);
    expect(adapterMatchesUrl(channels, "https://channels.weixin.qq.com/x")).toBe(true);
  });

  it("sniffs the address a page is already playing, preferring the playlist", async () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Fixture title" />
      <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
      <meta property="og:site_name" content="Fixture" />
      <meta property="og:video" content="https://cdn.example.com/trailer.mp4" />
    `;
    document.body.innerHTML = `
      <video src="https://cdn.example.com/low.mp4"></video>
      <div id="player"></div>
    `;
    // What the player really requested outranks a markup guess.
    const events = [
      { name: "https://cdn.example.com/hls/master.m3u8?token=abc", duration: 1 },
      { name: "https://cdn.example.com/low.mp4", duration: 1 },
    ];
    const original = performance.getEntriesByType.bind(performance);
    performance.getEntriesByType = ((type: string) =>
      type === "resource" ? (events as unknown as PerformanceEntry[]) : original(type)) as typeof performance.getEntriesByType;

    try {
      const result = (await run(sniffer)) as { directUrl: string; title: string; headers?: Record<string, string> };
      expect(result.directUrl).toBe("https://cdn.example.com/hls/master.m3u8?token=abc");
      expect(result.title).toBe("Fixture title");
      expect(result.headers?.referer).toBeTruthy();
      const extraction = normalizeExtraction(result);
      expect(extraction?.directUrl).toContain("master.m3u8");
      // The sniffer does not guess a container, so the merge decision has to come from the address.
      const item = adapterToItem(sniffer, "https://example.com/watch", extraction!);
      expect(item.formats[0]?.directUrl).toContain("master.m3u8");
      expect(item.formats[0]?.needsFfmpeg).toBe(true);
    } finally {
      performance.getEntriesByType = original;
    }
  });

  it("falls back to markup when the page has fetched nothing", async () => {
    document.head.innerHTML = `<meta property="og:title" content="Only markup" />`;
    document.body.innerHTML = `<video src="https://cdn.example.com/a.mp4"></video>`;

    const result = (await run(sniffer)) as { directUrl: string; title: string };
    expect(result.directUrl).toBe("https://cdn.example.com/a.mp4");
    expect(result.title).toBe("Only markup");
  });

  it("says so instead of returning junk when the page plays nothing", async () => {
    document.body.innerHTML = `<p>nothing here</p>`;
    await expect(run(sniffer)).rejects.toThrow();
  });

  it("reads the signed playlist out of the iQIYI player state and ranks the highest rendition", async () => {
    document.head.innerHTML = `<meta property="og:title" content="Episode" />`;
    const playback = {
      msePlayback: {
        _mvInfo: {
          data: {
            vid: "1jm50v4hx7c",
            urlMaps: {
              360: ["https://cache.video.iqiyi.com/dash/360.m3u8?bid=360"],
              1080: ["https://cache.video.iqiyi.com/dash/1080.m3u8?bid=1080"],
              720: ["https://cache.video.iqiyi.com/dash/720.m3u8?bid=720"],
            },
          },
        },
      },
    };
    (window as unknown as { playback: unknown }).playback = playback;

    try {
      const result = (await run(iqiyi)) as { directUrl: string; headers?: Record<string, string> };
      expect(result.directUrl).toContain("bid=1080");
      expect(result.headers?.["user-agent"]).toBeTruthy();
    } finally {
      delete (window as unknown as { playback?: unknown }).playback;
    }
  });

  it("asks for a few seconds of playback when the player state is not there yet", async () => {
    await expect(run(iqiyi)).rejects.toThrow(/播放/);
  });

  it("reports Channels metadata and refuses to invent a stream address", async () => {
    document.head.innerHTML = `
      <meta property="og:title" content="青慕在云南" />
      <meta property="og:image" content="https://finder.video.qq.com/cover.jpg" />
      <meta property="og:site_name" content="微信视频号" />
    `;

    const result = (await run(channels)) as { metadataOnly?: boolean; directUrl?: string; title: string };
    expect(result.metadataOnly).toBe(true);
    expect(result.directUrl).toBeUndefined();
    expect(result.title).toBe("青慕在云南");

    const extraction = normalizeExtraction(result);
    expect(extraction?.metadataOnly).toBe(true);
    expect(extraction?.directUrl).toBe("");
    expect(extraction?.title).toBe("青慕在云南");
  });

  it("accepts a preview shell that only exposes the nickname", async () => {
    document.title = "视频号";
    document.body.innerHTML = `<div class="nickname">青慕在云南</div>`;
    const result = (await run(channels)) as { uploader?: string; title: string };
    expect(result.uploader).toBe("青慕在云南");
    expect(result.title).toBe("视频号");
  });

  it("takes a stream address that carries no file extension", async () => {
    document.head.innerHTML = `<meta property="og:title" content="Channels clip" />`;
    document.body.innerHTML = `<video src="https://finder.video.qq.com/251/20302/stodownload?encfilekey=abc"></video>`;

    const result = (await run(sniffer)) as { directUrl: string };
    expect(result.directUrl).toContain("stodownload");
  });

  it("keeps the playlist and drops the segment it fetched", async () => {
    const events = [
      { name: "https://cdn.example.com/hls/seg-1.ts", duration: 1 },
      { name: "https://cdn.example.com/hls/index.m3u8", duration: 1 },
    ];
    const original = performance.getEntriesByType.bind(performance);
    performance.getEntriesByType = ((type: string) =>
      type === "resource" ? (events as unknown as PerformanceEntry[]) : original(type)) as typeof performance.getEntriesByType;

    try {
      const result = (await run(sniffer)) as { directUrl: string };
      expect(result.directUrl).toContain("index.m3u8");
    } finally {
      performance.getEntriesByType = original;
    }
  });

  it("catches the request a nudged player makes itself", async () => {
    document.body.innerHTML = `<div id="player"></div><button class="play">play</button>`;
    const button = document.querySelector("button") as HTMLButtonElement;
    const fakeFetch = async () => ({ ok: true });
    const target = window as unknown as { fetch?: unknown };
    const hadFetch = "fetch" in target;
    const previous = target.fetch;
    target.fetch = fakeFetch;
    button.addEventListener("click", () => {
      void (window.fetch as unknown as (input: string) => Promise<unknown>)("https://cdn.example.com/live/index.m3u8?id=1");
    });

    try {
      const result = (await run(sniffer)) as { directUrl: string };
      expect(result.directUrl).toBe("https://cdn.example.com/live/index.m3u8?id=1");
    } finally {
      if (hadFetch) target.fetch = previous;
      else delete target.fetch;
    }
  });

  it("takes the stream when the Channels player is actually playing", async () => {
    document.head.innerHTML = `<meta property="og:title" content="青慕在云南" />`;
    document.body.innerHTML = `<video src="https://finder.video.qq.com/251/20302/stodownload?encfilekey=abc"></video>`;

    const result = (await run(channels)) as { directUrl: string; metadataOnly?: boolean };
    expect(result.metadataOnly).toBeUndefined();
    expect(result.directUrl).toContain("stodownload");
  });

  it("asks for a sign-in instead of reporting empty metadata", async () => {
    document.head.innerHTML = `<meta property="og:title" content="视频号" />`;
    document.body.innerHTML = `<div class="qrcode"><img src="/qr.png" /></div><p>请使用微信扫码登录</p>`;

    await expect(run(channels)).rejects.toThrow(/NEEDS_LOGIN/);
  });
});
