import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../errors.js";
import { ServiceContext } from "../service-context.js";

const temporaryDirectories: string[] = [];

async function makeContext(): Promise<ServiceContext> {
  const dataRoot = await mkdtemp(join(tmpdir(), "video-downloader-provisioning-"));
  temporaryDirectories.push(dataRoot);
  return new ServiceContext({ port: 0, dataRoot, runtimeRoot: dataRoot });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

/**
 * The engine is provisioned by the service itself, so the first request after a fresh install
 * cannot succeed. It must say so immediately and start the download instead of blocking until a
 * client timeout or asking the user to install anything.
 */
describe("engine provisioning", () => {
  it("queues a download as 'preparing' and starts fetching the engine", async () => {
    const context = await makeContext();
    const start = vi.spyOn(context, "startYtdlpInstall").mockReturnValue({
      phase: "downloading",
      receivedBytes: 0,
      totalBytes: 100,
      error: null,
    });

    let thrown: unknown;
    try {
      context.createTask({ url: "https://example.com/v", streamId: "best" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceError);
    expect((thrown as ServiceError).code).toBe("engine_preparing");
    expect((thrown as ServiceError).status).toBe(503);
    expect(start).toHaveBeenCalled();
  });

  it("reports 'preparing' from a probe without waiting for the download", async () => {
    const context = await makeContext();
    const start = vi.spyOn(context, "startYtdlpInstall").mockReturnValue({
      phase: "idle",
      receivedBytes: 0,
      totalBytes: 100,
      error: null,
    });

    const summary = await context.probe("https://example.com/v");

    expect(summary.items).toEqual([]);
    expect(summary.failureCode).toBe("engine_preparing");
    expect(start).toHaveBeenCalled();
  });

  it("asks for ffmpeg only when a rendition needs merging, and starts fetching it", async () => {
    const context = await makeContext();
    context.ytdlp = { available: true, path: "/tmp/yt-dlp", version: "2026.08.19" };
    const startFfmpeg = vi.spyOn(context, "startFfmpegInstall").mockReturnValue({
      phase: "idle",
      receivedBytes: 0,
      totalBytes: 100,
      supported: true,
      error: null,
    });

    expect(() =>
      context.createTask({ url: "https://example.com/v", streamId: "137+bestaudio/best", needsFfmpeg: true }),
    ).toThrowError(/ffmpeg/u);
    expect(startFfmpeg).toHaveBeenCalled();
  });
});
