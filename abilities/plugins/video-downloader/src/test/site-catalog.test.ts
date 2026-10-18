import { describe, expect, it } from "vitest";
import { FEATURED_SITES, siteLabel, siteMonogram } from "../domain/site-catalog";

describe("siteLabel", () => {
  it("uses the catalogue for the site key lux reports", () => {
    expect(siteLabel("youtu")).toBe("YouTube");
    expect(siteLabel("b23")).toBe("Bilibili");
    expect(siteLabel("zhihu")).toBe("知乎");
  });

  it("falls back to the host when lux reports an unknown key", () => {
    expect(siteLabel("somewhere-new", "https://videos.example.org/watch/1")).toBe("Videos");
    expect(siteLabel("somewhere-new", "https://www.youtube.com/watch?v=1")).toBe("YouTube");
  });

  it("never leaves the label blank", () => {
    expect(siteLabel(undefined, undefined)).toBe("Unknown");
    expect(siteLabel(undefined, undefined, "未知来源")).toBe("未知来源");
    expect(siteLabel("newtube")).toBe("Newtube");
  });
});

describe("siteMonogram", () => {
  it("takes one glyph from the same label", () => {
    expect(siteMonogram("youtu")).toBe("Y");
    expect(siteMonogram("bilibili")).toBe("B");
    expect(siteMonogram(undefined, "https://www.instagram.com/reel/1")).toBe("I");
  });
});

describe("featured sites", () => {
  it("only advertises sites the catalogue can name", () => {
    for (const site of FEATURED_SITES) {
      expect(site.length).toBeGreaterThan(0);
    }
  });
});
