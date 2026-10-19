import { createHash } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { toolDirectory } from "./tool-paths.js";
import { ffmpegReleaseFor, type FfmpegRelease } from "./ffmpeg-release.js";

export type FfmpegInstallPhase = "idle" | "downloading" | "verifying" | "ready" | "failed";

export interface FfmpegInstallState {
  phase: FfmpegInstallPhase;
  receivedBytes: number;
  totalBytes: number;
  /** Whether this platform has a pinned build at all. */
  supported: boolean;
  error: string | null;
}

const DOWNLOAD_TIMEOUT_MS = 6 * 60_000;

/**
 * Provisions the pinned ffmpeg build into `<dataRoot>/bin`.
 *
 * ffmpeg is not shipped inside the plugin package: it is 18-79 MB per platform and only needed
 * for multi-part renditions, so it is fetched on demand from the upstream release and verified
 * against a digest pinned in `ffmpeg-release.ts`.
 */
export class FfmpegInstaller {
  private state: FfmpegInstallState;
  private current: Promise<FfmpegInstallState> | null = null;

  constructor(
    private readonly dataRoot: string,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly arch: string = process.arch,
  ) {
    const release = ffmpegReleaseFor(platform, arch);
    this.state = {
      phase: "idle",
      receivedBytes: 0,
      totalBytes: release?.bytes ?? 0,
      supported: release !== null,
      error: null,
    };
  }

  get targetPath(): string {
    return join(toolDirectory(this.dataRoot), this.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  }

  snapshot(): FfmpegInstallState {
    return { ...this.state };
  }

  /** Idempotent: concurrent callers share the same download. */
  install(): Promise<FfmpegInstallState> {
    const release = ffmpegReleaseFor(this.platform, this.arch);
    if (!release) {
      this.state = { ...this.state, phase: "failed", supported: false, error: "该平台暂不支持自动安装 ffmpeg" };
      return Promise.resolve(this.snapshot());
    }
    if (existsSync(this.targetPath)) {
      this.state = { ...this.state, phase: "ready", error: null };
      return Promise.resolve(this.snapshot());
    }
    if (!this.current) {
      this.current = this.run(release).finally(() => {
        this.current = null;
      });
    }
    return this.current;
  }

  private async run(release: FfmpegRelease): Promise<FfmpegInstallState> {
    this.state = { ...this.state, phase: "downloading", receivedBytes: 0, totalBytes: release.bytes, error: null };
    const directory = toolDirectory(this.dataRoot);
    const staged = `${this.targetPath}.tmp`;
    try {
      await mkdir(directory, { recursive: true });
      const archive = await this.download(release);
      this.state = { ...this.state, phase: "verifying" };

      const digest = createHash("sha256").update(archive).digest("hex");
      if (digest !== release.sha256) {
        throw new Error(`ffmpeg 校验失败（sha256 ${digest.slice(0, 12)}），请稍后重试`);
      }

      const binary = gunzipSync(archive);
      if (binary.length === 0) throw new Error("ffmpeg 解压结果为空");

      await writeFile(staged, binary);
      await chmod(staged, 0o755);
      await rename(staged, this.targetPath);

      this.state = { ...this.state, phase: "ready", error: null };
      return this.snapshot();
    } catch (error: unknown) {
      await rm(staged, { force: true }).catch(() => undefined);
      this.state = {
        ...this.state,
        phase: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
      return this.snapshot();
    }
  }

  /**
   * Tries each pinned source until one delivers the full asset. A slow primary host must not
   * leave the user without ffmpeg, so the next source starts as soon as one fails.
   */
  private async download(release: FfmpegRelease): Promise<Buffer> {
    let lastError: Error | null = null;
    for (const source of release.sources) {
      try {
        return await this.downloadFrom(source, release);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.state = { ...this.state, receivedBytes: 0 };
      }
    }
    throw lastError ?? new Error("下载 ffmpeg 失败");
  }

  private async downloadFrom(url: string, release: FfmpegRelease): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, { redirect: "follow", signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`下载 ffmpeg 失败（HTTP ${response.status}）`);
      const total = Number.parseInt(response.headers.get("content-length") ?? "", 10);
      if (Number.isFinite(total) && total > 0) {
        this.state = { ...this.state, totalBytes: total };
      }

      const chunks: Buffer[] = [];
      let received = 0;
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(Buffer.from(value));
        received += value.byteLength;
        this.state = { ...this.state, receivedBytes: received };
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length !== release.bytes) {
        // Upstream asset replaced under the same tag: the digest check would catch it too,
        // but the size mismatch is the clearer message.
        throw new Error(`下载不完整（${buffer.length}/${release.bytes} 字节），请重试`);
      }
      return buffer;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("下载 ffmpeg 超时，请检查网络后重试");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
