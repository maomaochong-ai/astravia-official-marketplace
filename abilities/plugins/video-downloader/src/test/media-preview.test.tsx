// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import type { MediaItem, SiteCoverage } from "../domain/media-info";

// The cards only need catalog lookup; the host bridge is not mounted outside Astravia.
vi.mock("@astravia-org/plugin-sdk", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, unknown>) => {
      const template = (en as Record<string, string>)[key] ?? key;
      return params
        ? template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
            name in params ? String(params[name]) : match,
          )
        : template;
    },
  }),
}));

const { MediaPreviewCard } = await import("../features/downloader/components/media-preview-card");
const { SiteCoveragePanel } = await import("../features/downloader/components/site-coverage-panel");

const item: MediaItem = {
  id: "item-0-https://www.bilibili.com",
  sourceUrl: "https://www.bilibili.com/video/BV1",
  site: "BiliBili",
  title: "示例视频",
  kind: "video",
  thumbnailUrl: "https://i0.hdslb.com/cover.jpg",
  durationSeconds: 3725,
  uploader: "某 UP 主",
  recommendedFormatId: "1080",
  formats: [
    { id: "1080", label: "1080P", quality: "1080P", ext: "mp4", sizeBytes: 0, partCount: 1, needsFfmpeg: false, kind: "video" },
    { id: "480", label: "480P", quality: "480P", ext: "mp4", sizeBytes: 0, partCount: 1, needsFfmpeg: false, kind: "video" },
  ],
};

const previewProps = {
  items: [item],
  activeIndex: 0,
  selectedFormatId: "1080",
  ffmpegAvailable: true,
  ffmpegInstall: null,
  ffmpegBusy: false,
  starting: false,
  onSelectItem: () => undefined,
  onSelectFormat: () => undefined,
  onStart: () => undefined,
};

describe("MediaPreviewCard", () => {
  it("shows the cover, its runtime badge, the uploader and the recommended marker", () => {
    const html = renderToString(<MediaPreviewCard {...previewProps} />);
    expect(html).toContain("https://i0.hdslb.com/cover.jpg");
    expect(html).toContain("1:02:05");
    expect(html).toContain("某 UP 主");
    expect(html).toContain("Best");
  });

  it("falls back to the monogram and keeps the runtime in the meta line", () => {
    const html = renderToString(
      <MediaPreviewCard {...previewProps} items={[{ ...item, thumbnailUrl: "" }]} />,
    );
    expect(html).not.toContain("cover.jpg");
    // No cover means no overlay; the runtime still has to be visible somewhere.
    expect(html).toContain("1:02:05");
  });
});

const coverage: SiteCoverage = {
  groups: [
    { key: "global", sites: ["YouTube", "Vimeo"] },
    { key: "china", sites: ["哔哩哔哩"] },
  ],
  unsupported: [
    { label: "快手", reason: "engine-missing" },
    { label: "酷我音乐", reason: "upstream-broken" },
  ],
};

describe("SiteCoveragePanel", () => {
  it("groups what the engine resolves and names the reason for what it does not", () => {
    const html = renderToString(<SiteCoveragePanel coverage={coverage} onOpenCookie={() => undefined} />);
    expect(html).toContain("International");
    expect(html).toContain("Mainland China");
    expect(html).toContain("YouTube");
    expect(html).toContain("Engine has no extractor");
    expect(html).toContain("Broken upstream");
    expect(html).toContain(".m3u8");
  });
});
