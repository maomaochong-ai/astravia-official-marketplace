import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { once } from "node:events";
import { ensureDirectory } from "../fs/files.js";
import { ytdlpReleaseFor, ytdlpReleasePath, type YtdlpRelease } from "./ytdlp-release.js";

export type YtdlpInstallPhase = "idle" | "downloading" | "verifying" | "ready" | "failed";

export interface YtdlpInstallState {
  phase: YtdlpInstallPhase;
  receivedBytes: number;
  totalBytes: number;
  /** False when the pinned release has no build for this platform/arch pair. */
  supported: boolean;
  error: string | null;
}

/** One connection attempt is bounded so a stalled socket cannot hang the install forever. */
const ATTEMPT_TIMEOUT_MS = 4 * 60_000;
/** GitHub release downloads are frequently cut mid-stream; each retry resumes from the last byte. */
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1_500;
const MAX_RESTARTS = 1;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function sha256Of(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/**
 * Provisions the pinned yt-dlp build into `<dataRoot>/bin`.
 *
 * The transfer is resumable on purpose: the standalone binaries are 17–40 MB and the release
 * host regularly truncates a long-lived response, which is indistinguishable from a corrupt
 * asset unless the missing tail is requested again instead of restarting from zero.
 */
export class YtdlpInstaller {
  private state: YtdlpInstallState;
  private running: Promise<YtdlpInstallState> | null = null;

  constructor(
    private readonly dataRoot: string,
    // Injected so a test can exercise the resume path without a 37 MB release download.
    private readonly release: YtdlpRelease | null = ytdlpReleaseFor(),
  ) {
    this.state = {
      phase: "idle",
      receivedBytes: 0,
      totalBytes: this.release?.bytes ?? 0,
      supported: this.release !== null,
      error: null,
    };
  }

  get targetPath(): string {
    return ytdlpReleasePath(this.dataRoot);
  }

  snapshot(): YtdlpInstallState {
    return { ...this.state };
  }

  install(): Promise<YtdlpInstallState> {
    if (this.running) return this.running;
    if (this.state.phase === "ready") return Promise.resolve(this.snapshot());
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private set(patch: Partial<YtdlpInstallState>): void {
    this.state = { ...this.state, ...patch };
  }

  private async run(): Promise<YtdlpInstallState> {
    const release = this.release;
    if (!release) {
      this.set({ phase: "failed", error: "当前平台没有匹配的 yt-dlp 版本" });
      return this.snapshot();
    }
    // A previous service instance may already have finished the install.
    if (
      (await sizeOf(this.targetPath)) === release.bytes &&
      (await sha256Of(this.targetPath).catch(() => "")) === release.sha256
    ) {
      this.set({ phase: "ready", receivedBytes: release.bytes, totalBytes: release.bytes, error: null });
      return this.snapshot();
    }
    await rm(this.targetPath, { force: true }).catch(() => undefined);

    const partPath = `${this.targetPath}.part`;
    await ensureDirectory(dirname(this.targetPath));

    for (let restart = 0; restart <= MAX_RESTARTS; restart += 1) {
      await rm(partPath, { force: true }).catch(() => undefined);
      this.set({ phase: "downloading", receivedBytes: 0, error: null });
      try {
        await this.transfer(release, partPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await rm(partPath, { force: true }).catch(() => undefined);
        this.set({ phase: "failed", error: reason });
        return this.snapshot();
      }

      this.set({ phase: "verifying" });
      const digest = await sha256Of(partPath).catch(() => "");
      if (digest === release.sha256) {
        await chmod(partPath, 0o755).catch(() => undefined);
        await rename(partPath, this.targetPath);
        this.set({ phase: "ready", receivedBytes: release.bytes, error: null });
        return this.snapshot();
      }
      await rm(partPath, { force: true }).catch(() => undefined);
      if (restart === MAX_RESTARTS) {
        this.set({
          phase: "failed",
          error: `yt-dlp 校验失败（sha256 ${(digest || "空").slice(0, 12)}），请稍后重试`,
        });
        return this.snapshot();
      }
    }
    return this.snapshot();
  }

  private async transfer(release: YtdlpRelease, partPath: string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const received = await sizeOf(partPath);
      this.set({ receivedBytes: Math.min(received, release.bytes) });
      if (received >= release.bytes) break;
      try {
        await this.fetchInto(release, partPath, received);
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`yt-dlp 下载失败（已下载 ${await sizeOf(partPath)}/${release.bytes} 字节）：${reason}`);
        }
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
    const received = await sizeOf(partPath);
    if (received !== release.bytes) throw new Error(`下载不完整（${received}/${release.bytes} 字节），请重试`);
  }

  private async fetchInto(release: YtdlpRelease, partPath: string, offset: number): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(release.url, {
        // A resumed request is answered with the remaining bytes, which keeps the retry cheap.
        headers: offset > 0 ? { range: `bytes=${offset}-` } : {},
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.status === 416) return;

      let start = offset;
      if (offset > 0 && response.status === 200) {
        // The server ignored the range, so the response is the whole asset: start over.
        start = 0;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = response.body;
      if (!body) throw new Error("响应没有内容");

      const sink = createWriteStream(partPath, { flags: start > 0 ? "a" : "w" });
      const sinkFailure = new Promise<never>((_, reject) => sink.once("error", reject));
      // The race below may settle on the reader first; this keeps the sink rejection observed.
      void sinkFailure.catch(() => undefined);

      const reader = body.getReader();
      let written = start;
      const writing = (async () => {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const value = chunk.value;
          if (!value) continue;
          written += value.byteLength;
          this.set({ receivedBytes: Math.min(written, release.bytes) });
          if (!sink.write(value)) await once(sink, "drain");
        }
      })();
      try {
        await Promise.race([writing, sinkFailure]);
      } finally {
        await reader.cancel().catch(() => undefined);
        await new Promise<void>((resolve) => sink.end(resolve));
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
