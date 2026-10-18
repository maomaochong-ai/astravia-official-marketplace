import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatSpeed } from "../domain/format-bytes";

describe("formatBytes", () => {
  it("keeps bytes unit-less below 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
  });

  it("scales and chooses decimals by magnitude", () => {
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(20480)).toBe("20.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(formatBytes(150 * 1024 * 1024)).toBe("150 MB");
  });
});

describe("formatSpeed", () => {
  it("omits a meaningless zero", () => {
    expect(formatSpeed(0)).toBeNull();
    expect(formatSpeed(Number.NaN)).toBeNull();
    expect(formatSpeed(1536)).toBe("1.50 KB/s");
  });
});

describe("formatDuration", () => {
  it("reads the same in every locale", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(47)).toBe("47s");
    expect(formatDuration(192)).toBe("3:12");
    expect(formatDuration(3900)).toBe("1:05:00");
  });
});
