import { describe, expect, it } from "vitest";
import { asHeaders } from "../http/router.js";
import { engineArguments } from "../tasks/download-runner.js";
import { ADAPTER_STREAM_ID, type DownloadTask } from "../tasks/types.js";
import { DEFAULT_SETTINGS } from "../settings/settings-store.js";

function task(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: "task-1",
    url: "https://example.com/watch?v=1",
    site: "Example",
    title: "Example clip",
    streamId: "137",
    directUrl: "",
    headers: {},
    quality: "1080P",
    ext: "mp4",
    needsFfmpeg: false,
    totalBytes: 1024,
    receivedBytes: 0,
    speedBps: 0,
    etaSeconds: null,
    phase: "queued",
    createdAt: 0,
    startedAt: null,
    finishedAt: null,
    filePath: null,
    error: null,
    errorCode: null,
    ...overrides,
  };
}

describe("adapter task contract", () => {
  it("keeps only whitelisted headers and strips line breaks", () => {
    const headers = asHeaders({
      Referer: "https://example.com/watch",
      "User-Agent": "Mozilla/5.0",
      Authorization: "Bearer secret",
      "X-Forwarded-For": "10.0.0.1",
      "x-requested-with": "XMLHttpRequest",
      "X-Broken": "a\r\nb",
    });
    expect(headers).toEqual({
      referer: "https://example.com/watch",
      "user-agent": "Mozilla/5.0",
      "x-requested-with": "XMLHttpRequest",
    });
    expect(headers).not.toHaveProperty("authorization");
    expect(headers).not.toHaveProperty("x-forwarded-for");
    expect(headers).not.toHaveProperty("x-broken");
  });

  it("drops non-objects, empty values and oversized values", () => {
    expect(asHeaders(null)).toEqual({});
    expect(asHeaders(["referer"])).toEqual({});
    expect(asHeaders({ referer: "   " })).toEqual({});
    expect(asHeaders({ referer: "x".repeat(2049) })).toEqual({});
  });

  it("targets the resolved address and skips the format selector for an adapter task", () => {
    const args = engineArguments(
      task({
        streamId: ADAPTER_STREAM_ID,
        directUrl: "https://cdn.example.com/v.mp4",
        headers: { referer: "https://example.com/watch", "user-agent": "Mozilla/5.0" },
      }),
      { ...DEFAULT_SETTINGS, proxyMode: "off", multiThread: false },
      "/tmp/work",
      null,
    );
    expect(args).not.toContain("-f");
    expect(args).toContain("--add-header");
    expect(args).toContain("referer: https://example.com/watch");
    expect(args[args.length - 1]).toBe("https://cdn.example.com/v.mp4");
  });

  it("keeps the engine path unchanged for an engine task", () => {
    const args = engineArguments(
      task(),
      { ...DEFAULT_SETTINGS, proxyMode: "off", multiThread: false },
      "/tmp/work",
      null,
    );
    const selector = args.indexOf("-f");
    expect(selector).toBeGreaterThanOrEqual(0);
    expect(args[selector + 1]).toBe("137");
    expect(args[args.length - 1]).toBe("https://example.com/watch?v=1");
    expect(args).not.toContain("--add-header");
  });

  it("falls back to the page URL when an adapter task carries no address", () => {
    const args = engineArguments(
      task({ streamId: ADAPTER_STREAM_ID }),
      { ...DEFAULT_SETTINGS, proxyMode: "off", multiThread: false },
      "/tmp/work",
      null,
    );
    expect(args[args.length - 1]).toBe("https://example.com/watch?v=1");
  });
});
