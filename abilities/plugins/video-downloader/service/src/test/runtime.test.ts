import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectProducedFiles, moveProducedFiles, sanitizeFileName, uniqueDestination } from "../fs/files.js";
import { measureDirectory } from "../fs/directory-usage.js";
import { normalizeSettings } from "../settings/settings-store.js";
import { summarizeFailure } from "../tasks/download-runner.js";
import { estimateRemaining, progressRatio, type DownloadTask } from "../tasks/types.js";

const temporaryDirectories: string[] = [];

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "video-downloader-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("sanitizeFileName", () => {
  it("strips separators and the incoming extension", () => {
    expect(sanitizeFileName("a/b:c*d?.mp4")).toBe("a b c d");
  });

  it("keeps meaningful dots and truncates long names", () => {
    expect(sanitizeFileName("S01E02. 第 3 集", 6)).toHaveLength(6);
    expect(sanitizeFileName("   ")).toBe("video");
  });
});

describe("uniqueDestination", () => {
  it("does not clobber an existing file", async () => {
    const directory = await makeTempDirectory();
    await writeFile(join(directory, "clip.mp4"), "first");
    expect(await uniqueDestination(directory, "clip.mp4")).toBe(join(directory, "clip (1).mp4"));
  });
});

describe("collectProducedFiles", () => {
  it("ignores partial downloads and dot files", async () => {
    const directory = await makeTempDirectory();
    await writeFile(join(directory, "clip.mp4"), "done");
    await writeFile(join(directory, "clip.mp4.download"), "partial");
    await writeFile(join(directory, ".hidden"), "x");
    const files = await collectProducedFiles(directory);
    expect(files.map((file) => file.name)).toEqual(["clip.mp4"]);
  });
});

describe("moveProducedFiles", () => {
  it("moves finished files into the destination and keeps the work directory tidy", async () => {
    const work = await makeTempDirectory();
    const destination = await makeTempDirectory();
    await writeFile(join(work, "clip.mp4"), "payload");
    await writeFile(join(work, "clip.mp4.download"), "partial");
    const moved = await moveProducedFiles(work, destination);
    expect(moved).toHaveLength(1);
    expect(moved[0]?.path).toBe(join(destination, "clip.mp4"));
    expect(await readdir(destination)).toEqual(["clip.mp4"]);
  });
});

describe("measureDirectory", () => {
  it("sums nested files and tolerates a missing directory", async () => {
    const directory = await makeTempDirectory();
    await writeFile(join(directory, "a.bin"), Buffer.alloc(10));
    await writeFile(join(directory, "b.bin"), Buffer.alloc(32));
    const usage = await measureDirectory(directory);
    expect(usage).toEqual({ bytes: 42, files: 2 });
    expect(await measureDirectory(join(directory, "missing"))).toEqual({ bytes: 0, files: 0 });
  });
});

describe("normalizeSettings", () => {
  it("clamps concurrency and fills defaults", () => {
    const settings = normalizeSettings({ maxConcurrent: 99, downloadDirectory: "  " });
    expect(settings.maxConcurrent).toBe(4);
    expect(settings.downloadDirectory.length).toBeGreaterThan(0);
    expect(normalizeSettings({ maxConcurrent: 0 }).maxConcurrent).toBe(1);
  });

  it("accepts a proxy address and rejects anything that is not one", () => {
    expect(normalizeSettings({}).proxy).toBe("");
    // A bare host:port is what people copy out of a proxy client, so it is completed for them.
    expect(normalizeSettings({ proxy: " 127.0.0.1:7890 " }).proxy).toBe("http://127.0.0.1:7890");
    expect(normalizeSettings({ proxy: "socks5://127.0.0.1:1080" }).proxy).toBe("socks5://127.0.0.1:1080");
    expect(normalizeSettings({ proxy: "http://user:pass@10.0.0.2:8080" }).proxy).toBe("http://user:pass@10.0.0.2:8080");
    // Forwarding an unparseable value would make every request fail for an unrelated reason.
    expect(normalizeSettings({ proxy: "http://127.0.0.1:7890/extra" }).proxy).toBe("");
    expect(normalizeSettings({ proxy: "http://" }).proxy).toBe("");
    expect(normalizeSettings({ proxy: 42 }).proxy).toBe("");
  });
});

describe("summarizeFailure", () => {
  it("keeps the engine's ERROR line and drops warnings", () => {
    const stderr = [
      "WARNING: [youtube] falling back to the next client",
      "ERROR: unable to download video data: HTTP Error 403: Forbidden",
    ].join("\n");
    const failure = summarizeFailure(stderr, "");
    expect(failure.message).toBe("unable to download video data: HTTP Error 403: Forbidden");
    expect(failure.code).toBe("site_blocked");
  });

  it("never returns an empty string", () => {
    expect(summarizeFailure("", "")).toEqual({ message: "下载失败", code: null });
  });

  it("falls back to stdout when the engine reported there", () => {
    expect(summarizeFailure("", "ERROR: Fresh cookies (not necessarily logged in) are needed").code).toBe(
      "auth_required",
    );
  });
});

function taskWith(overrides: Partial<DownloadTask>): DownloadTask {
  return {
    id: "t",
    url: "https://example.com/v",
    site: "youtube",
    title: "v",
    streamId: "1080",
    quality: "1080P",
    ext: "mp4",
    needsFfmpeg: false,
    totalBytes: 0,
    receivedBytes: 0,
    speedBps: 0,
    etaSeconds: null,
    phase: "downloading",
    createdAt: 0,
    startedAt: null,
    finishedAt: null,
    filePath: null,
    error: null,
    ...overrides,
  };
}

describe("progress helpers", () => {
  it("reports null while the total size is unknown", () => {
    expect(progressRatio(taskWith({}))).toBeNull();
    expect(estimateRemaining(taskWith({}))).toBeNull();
  });

  it("computes a ratio and an ETA", () => {
    const task = taskWith({ totalBytes: 1000, receivedBytes: 500, speedBps: 100 });
    expect(progressRatio(task)).toBe(0.5);
    expect(estimateRemaining(task)).toBe(5);
  });

  it("clamps the ratio when the transfer overshoots the reported size", () => {
    expect(progressRatio(taskWith({ totalBytes: 100, receivedBytes: 400 }))).toBe(1);
  });
});
