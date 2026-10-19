import { describe, expect, it } from "vitest";
import { MISSING_TOOL, normalizeCapabilities, toolCapability } from "../domain/capabilities";

const ytdlp = { available: true, path: "/data/bin/yt-dlp", version: "2026.08.19", source: "bundled" as const };
const ffmpeg = { available: false, path: null, version: null, source: null };

const full = { ytdlp, ffmpeg };
const empty = { ytdlp: MISSING_TOOL, ffmpeg: MISSING_TOOL };

describe("normalizeCapabilities", () => {
  it("reads the flat payload the service actually sends", () => {
    expect(normalizeCapabilities(full)).toEqual(full);
  });

  it("also accepts the older nested envelope", () => {
    expect(normalizeCapabilities({ capabilities: full })).toEqual(full);
  });

  it("fills a tool the payload forgot instead of leaving it undefined", () => {
    const normalized = normalizeCapabilities({ ffmpeg });
    expect(normalized.ytdlp).toEqual(MISSING_TOOL);
    expect(normalized.ffmpeg).toEqual(ffmpeg);
  });

  it("drops a tool the service no longer reports", () => {
    // 2.0.0 has a single engine, so a stale `lux` key must not resurface in the panel.
    expect(normalizeCapabilities({ ...full, lux: { available: true } })).toEqual(full);
  });

  it("coerces junk values into an unavailable tool", () => {
    expect(normalizeCapabilities({ ytdlp: "yes", ffmpeg: { available: "true" } })).toEqual(empty);
    expect(normalizeCapabilities(null)).toEqual(empty);
    expect(normalizeCapabilities(undefined)).toEqual(empty);
  });
});

describe("toolCapability", () => {
  it("never returns undefined, even for a malformed snapshot", () => {
    expect(toolCapability({} as never, "ytdlp")).toEqual(MISSING_TOOL);
    expect(toolCapability(null, "ffmpeg")).toEqual(MISSING_TOOL);
    expect(toolCapability(full, "ytdlp")).toEqual(ytdlp);
  });
});
