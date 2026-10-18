import { describe, expect, it } from "vitest";
import { isAudioOnly, normalizeItem, normalizeProbe, probeFailureReason, resolutionOf } from "../media/normalize.js";
import { parseProbeOutput } from "../lux/probe.js";

const sample = [
  {
    url: "https://www.bilibili.com/video/BV1xx",
    site: "bilibili",
    title: "一个小时学会做菜",
    type: "video",
    streams: {
      "80": {
        id: "80",
        quality: "1080p",
        ext: "mp4",
        size: 300,
        parts: [
          { url: "https://cdn/1.m4s", size: 200, ext: "m4s" },
          { url: "https://cdn/2.m4s", size: 100, ext: "m4s" },
        ],
        NeedMux: true,
      },
      "64": { id: "64", quality: "720p", ext: "mp4", size: 120, parts: [{ url: "https://cdn/720.mp4", size: 120, ext: "mp4" }] },
      "30280": { id: "30280", quality: "192k", ext: "m4a", size: 12, parts: [{ url: "https://cdn/a.m4a", size: 12, ext: "m4a" }] },
    },
  },
];

describe("resolutionOf", () => {
  it("extracts the vertical resolution from quality strings", () => {
    expect(resolutionOf("1080p60")).toBe(1080);
    expect(resolutionOf("id-720")).toBe(720);
    expect(resolutionOf("hd")).toBe(0);
    expect(resolutionOf("")).toBe(0);
  });
});

describe("isAudioOnly", () => {
  it("treats a stream whose parts are all audio as audio", () => {
    expect(isAudioOnly({ parts: [{ ext: "m4a" }] })).toBe(true);
    expect(isAudioOnly({ parts: [{ ext: "mp4" }, { ext: "m4a" }] })).toBe(false);
    expect(isAudioOnly({ parts: [] })).toBe(false);
  });
});

describe("normalizeItem", () => {
  it("orders video renditions by resolution and pushes audio last", () => {
    const item = normalizeItem(sample[0]!, 0)!;
    expect(item.formats.map((format) => format.id)).toEqual(["80", "64", "30280"]);
    expect(item.formats[2]?.kind).toBe("audio");
    expect(item.formats[2]?.label).toBe("音频 192k");
    expect(item.recommendedFormatId).toBe("80");
  });

  it("requires ffmpeg for every multi-part rendition", () => {
    const item = normalizeItem(sample[0]!, 0)!;
    const high = item.formats.find((format) => format.id === "80")!;
    const low = item.formats.find((format) => format.id === "64")!;
    expect(high.partCount).toBe(2);
    expect(high.needsFfmpeg).toBe(true); // DASH video+audio, muxed by ffmpeg
    expect(low.needsFfmpeg).toBe(false); // single part is written straight through
  });

  it("falls back to a readable label when upstream reports no quality", () => {
    const item = normalizeItem({ title: "t", streams: { x: { parts: [{ ext: "mp4", size: 5 }] } } }, 0)!;
    expect(item.formats[0]?.label).toBe("原始画质");
    expect(item.formats[0]?.id).toBe("x");
    expect(item.formats[0]?.sizeBytes).toBe(5);
  });

  it("drops entries that failed extraction", () => {
    expect(normalizeItem({ title: "x", err: {} }, 0)).toBeNull();
    expect(normalizeItem({ title: "x", streams: {} }, 0)).toBeNull();
    expect(normalizeProbe([{ err: {} }, sample[0]!])).toHaveLength(1);
  });
});

describe("probeFailureReason", () => {
  it("explains an empty Go error object", () => {
    expect(probeFailureReason([{ err: {} }])).toContain("Cookie");
  });

  it("uses a plain string error when present", () => {
    expect(probeFailureReason([{ err: "unsupported URL" }])).toBe("unsupported URL");
  });
});

describe("parseProbeOutput", () => {
  it("parses a clean JSON array", () => {
    expect(parseProbeOutput(JSON.stringify(sample))).toHaveLength(1);
  });

  it("skips coloured diagnostics printed before the payload", () => {
    const noisy = `\u001b[36mDownloading https://x error:\u001b[0m\n${JSON.stringify(sample)}`;
    expect(parseProbeOutput(noisy)).toHaveLength(1);
  });

  it("accepts a bare object and rejects garbage", () => {
    expect(parseProbeOutput(JSON.stringify(sample[0]))).toHaveLength(1);
    expect(parseProbeOutput("not json at all")).toHaveLength(0);
  });
});
