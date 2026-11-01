import { describe, expect, it } from "vitest";

import type { MediaFormat, MediaItem } from "../domain/media-info";
import { buildReplicatePrompt, type ReplicateLabels } from "../domain/replicate-prompt";

const labels: ReplicateLabels = {
  heading: "heading",
  site: "site",
  title: "title",
  uploader: "uploader",
  page: "page",
  quality: "quality",
  stream: "stream",
  path: "path",
  engine: "engine",
  adapter: "adapter",
  metadataOnly: "metadata-only",
  mergeNote: "merge",
  ask: "ask",
};

const item: MediaItem = {
  id: "bilibili:BV1",
  sourceUrl: "https://www.bilibili.com/video/BV1",
  site: "bilibili",
  title: "Example",
  thumbnailUrl: "https://i0.hdslb.com/cover.jpg",
  uploader: "Someone",
  kind: "video",
  durationSeconds: 60,
  formats: [],
  recommendedFormatId: null,
  extractionPath: "engine",
};

const format: MediaFormat = {
  id: "1080",
  label: "1080P",
  quality: "1080P",
  partCount: 1,
  kind: "video",
  ext: "mp4",
  sizeBytes: 1024,
  needsFfmpeg: true,
  directUrl: "https://cdn.example.com/v.mp4",
};

describe("buildReplicatePrompt", () => {
  it("lists the observed facts of the selected rendition", () => {
    const text = buildReplicatePrompt({ item, format }, labels);
    expect(text.split("\n")[0]).toBe("heading");
    expect(text).toContain("page: https://www.bilibili.com/video/BV1");
    expect(text).toContain("uploader: Someone");
    expect(text).toContain("quality: 1080P · mp4 (merge)");
    expect(text).toContain("stream: https://cdn.example.com/v.mp4");
    expect(text).toContain("path: engine");
    expect(text.endsWith("ask")).toBe(true);
  });

  it("names the adapter that answered instead of claiming the engine did", () => {
    const text = buildReplicatePrompt(
      { item: { ...item, extractionPath: "adapter" }, format: null, adapterName: "iQIYI Player" },
      labels,
    );
    expect(text).toContain("path: adapter (iQIYI Player)");
    expect(text).toContain("metadata-only");
    expect(text).not.toContain("stream:");
  });
});
