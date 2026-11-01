import { describe, expect, it } from "vitest";
import {
  ADAPTER_TEMPLATE,
  adapterId,
  adapterMatchesUrl,
  adapterToItem,
  matchingAdapters,
  normalizeExtraction,
  normalizeValues,
  parseAdapterJson,
  serializeAdapter,
  type Adapter,
} from "../domain/adapter";
import { ADAPTER_STREAM_ID } from "../domain/media-info";

const ADAPTER: Adapter = {
  id: "example",
  meta: {
    name: "Example",
    version: "1.0.0",
    match: ["https://example.com/*"],
    description: "reads the page video element",
    grant: "page-fetch",
  },
  body: "async function extract() { return { directUrl: 'https://cdn.example.com/v.mp4' }; }",
  enabled: true,
  updatedAt: 0,
};

describe("adapter manifest", () => {
  it("accepts the template the editor inserts", () => {
    const parsed = parseAdapterJson(ADAPTER_TEMPLATE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.adapter.meta.name).toBe("My Adapter");
      expect(parsed.adapter.meta.match).toEqual(["https://example.com/*"]);
      expect(parsed.adapter.body).toContain("og:video");
    }
  });

  it("accepts a flat object as well as the documented envelope", () => {
    const parsed = parseAdapterJson(
      JSON.stringify({ name: "Flat", match: "https://a.com/* https://b.com/*", body: "() => ({})" }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.adapter.meta.match).toEqual(["https://a.com/*", "https://b.com/*"]);
      expect(parsed.adapter.meta.grant).toBe("none");
    }
  });

  it("reports why an import was refused", () => {
    expect(parseAdapterJson("{")).toEqual({ ok: false, error: expect.stringContaining("JSON") });
    expect(parseAdapterJson("[]")).toEqual({ ok: false, error: expect.stringContaining("对象") });
    expect(parseAdapterJson(JSON.stringify({ body: "() => ({})" }))).toEqual({
      ok: false,
      error: expect.stringContaining("name"),
    });
    expect(parseAdapterJson(JSON.stringify({ name: "No body" }))).toEqual({
      ok: false,
      error: expect.stringContaining("body"),
    });
  });

  it("round-trips through serialize", () => {
    const parsed = parseAdapterJson(serializeAdapter(ADAPTER));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.adapter.meta).toEqual(ADAPTER.meta);
      expect(parsed.adapter.body).toBe(ADAPTER.body);
      expect(parsed.adapter.id).toBe(ADAPTER.id);
    }
  });

  it("derives a stable id from the name", () => {
    expect(adapterId("Bilibili Mobile")).toBe("bilibili-mobile");
    expect(adapterId("  。  ")).toBe("adapter");
  });
});

describe("adapter matching", () => {
  it("honours the scheme, host and path in @match", () => {
    expect(adapterMatchesUrl(ADAPTER, "https://example.com/watch?v=1")).toBe(true);
    expect(adapterMatchesUrl(ADAPTER, "https://other.com/watch?v=1")).toBe(false);
    expect(adapterMatchesUrl(ADAPTER, "http://example.com/watch")).toBe(false);
  });

  it("supports a wildcard scheme and subdomain", () => {
    const wildcard: Adapter = { ...ADAPTER, meta: { ...ADAPTER.meta, match: ["*://*.bilibili.com/*"] } };
    expect(adapterMatchesUrl(wildcard, "https://www.bilibili.com/video/BV1")).toBe(true);
    expect(adapterMatchesUrl(wildcard, "https://bilibili.com/video/BV1")).toBe(false);
  });

  it("treats <all_urls> as every http(s) page", () => {
    const anywhere: Adapter = { ...ADAPTER, meta: { ...ADAPTER.meta, match: ["<all_urls>"] } };
    expect(adapterMatchesUrl(anywhere, "https://any.site/x")).toBe(true);
    expect(adapterMatchesUrl(anywhere, "file:///tmp/x.html")).toBe(false);
  });

  it("skips disabled adapters when listing candidates", () => {
    const disabled: Adapter = { ...ADAPTER, id: "off", enabled: false };
    expect(matchingAdapters([ADAPTER, disabled], "https://example.com/a")).toEqual([ADAPTER]);
  });
});

describe("adapter extraction", () => {
  it("refuses an address that is not http(s)", () => {
    expect(normalizeExtraction({ directUrl: "javascript:alert(1)" })).toBeNull();
    expect(normalizeExtraction({ directUrl: "/relative.mp4" })).toBeNull();
    expect(normalizeExtraction(null)).toBeNull();
    expect(normalizeExtraction("https://example.com/v.mp4")).toBeNull();
  });

  it("drops headers the engine must not receive", () => {
    const extraction = normalizeExtraction({
      directUrl: "https://cdn.example.com/v.mp4",
      headers: {
        Referer: "https://example.com/watch",
        Authorization: "Bearer secret",
        Cookie: "a=1\r\nb=2",
        "X-Weird": "1",
      },
    });
    expect(extraction?.headers).toEqual({ referer: "https://example.com/watch", cookie: "a=1b=2" });
  });

  it("marks an HLS address as needing a remux", () => {
    const extraction = normalizeExtraction({ directUrl: "https://cdn.example.com/live/index.m3u8?token=1" });
    expect(extraction).not.toBeNull();
    const item = adapterToItem(ADAPTER, "https://example.com/watch", extraction!);
    expect(item.formats[0].needsFfmpeg).toBe(true);
    expect(item.extractionPath).toBe("adapter");
    expect(item.formats[0].id).toBe(ADAPTER_STREAM_ID);
    expect(item.recommendedFormatId).toBe(ADAPTER_STREAM_ID);
    expect(item.sourceUrl).toBe("https://example.com/watch");
    expect(item.site).toBe("Example");
  });

  it("carries the direct address and headers onto the format", () => {
    const extraction = normalizeExtraction({
      directUrl: "https://cdn.example.com/v.mp4",
      title: "Clip",
      quality: "1080P",
      ext: "mp4",
      headers: { referer: "https://example.com/watch" },
    });
    const item = adapterToItem(ADAPTER, "https://example.com/watch", extraction!);
    expect(item.title).toBe("Clip");
    expect(item.formats[0].directUrl).toBe("https://cdn.example.com/v.mp4");
    expect(item.formats[0].headers).toEqual({ referer: "https://example.com/watch" });
    expect(item.formats[0].label).toBe("1080P");
    expect(item.formats[0].needsFfmpeg).toBe(false);
  });
});

describe("adapter selection", () => {
  it("tries the site's own reader before a catch-all sniffer", () => {
    const sniffer: Adapter = { ...ADAPTER, id: "sniff", meta: { ...ADAPTER.meta, name: "Sniffer", match: ["<all_urls>"] } };
    const site: Adapter = { ...ADAPTER, id: "site", meta: { ...ADAPTER.meta, name: "Site", match: ["https://example.com/*"] } };
    const maybe = matchingAdapters([sniffer, site], "https://example.com/watch");
    expect(maybe.map((adapter) => adapter.id)).toEqual(["site", "sniff"]);
    // A page the site reader does not claim still gets the sniffer.
    expect(matchingAdapters([sniffer, site], "https://other.test/watch").map((adapter) => adapter.id)).toEqual(["sniff"]);
  });

  it("skips a disabled adapter even when it matches", () => {
    expect(matchingAdapters([{ ...ADAPTER, enabled: false }], "https://example.com/watch")).toEqual([]);
  });
});

describe("adapter values", () => {
  it("keeps a bounded snapshot and drops the rest", () => {
    expect(normalizeValues({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
    expect(normalizeValues(null)).toEqual({});
    expect(normalizeValues(["a"])).toEqual({});
    expect(normalizeValues({ ["k".repeat(65)]: 1 })).toEqual({});
    expect(normalizeValues({ big: "x".repeat(9000) })).toEqual({});
  });
});
