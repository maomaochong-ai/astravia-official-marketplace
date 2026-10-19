import { describe, expect, it } from "vitest";
import { MISSING_TOOL, normalizeCapabilities, toolCapability } from "../domain/capabilities";

const lux = { available: true, path: "/bin/lux", version: "0.24.1", source: "bundled" as const };
const ffmpeg = { available: false, path: null, version: null, source: null };

describe("normalizeCapabilities", () => {
  it("reads the flat payload the service actually sends", () => {
    expect(normalizeCapabilities({ lux, ffmpeg })).toEqual({ lux, ffmpeg });
  });

  it("also accepts the older nested envelope", () => {
    expect(normalizeCapabilities({ capabilities: { lux, ffmpeg } })).toEqual({ lux, ffmpeg });
  });

  it("fills a tool the payload forgot instead of leaving it undefined", () => {
    const normalized = normalizeCapabilities({ ffmpeg });
    expect(normalized.lux).toEqual(MISSING_TOOL);
    expect(normalized.ffmpeg).toEqual(ffmpeg);
  });

  it("coerces junk values into an unavailable tool", () => {
    expect(normalizeCapabilities({ lux: "yes", ffmpeg: { available: "true" } })).toEqual({
      lux: MISSING_TOOL,
      ffmpeg: MISSING_TOOL,
    });
    expect(normalizeCapabilities(null)).toEqual({ lux: MISSING_TOOL, ffmpeg: MISSING_TOOL });
    expect(normalizeCapabilities(undefined)).toEqual({ lux: MISSING_TOOL, ffmpeg: MISSING_TOOL });
  });
});

describe("toolCapability", () => {
  it("never returns undefined, even for a malformed snapshot", () => {
    expect(toolCapability({ ffmpeg } as never, "lux")).toEqual(MISSING_TOOL);
    expect(toolCapability(null, "ffmpeg")).toEqual(MISSING_TOOL);
    expect(toolCapability({ lux, ffmpeg }, "lux")).toEqual(lux);
  });
});
