import { randomUUID } from "node:crypto";
import { ServiceError } from "./errors.js";
import { inspectLux } from "./lux/lux-binary.js";
import { probeMedia } from "./lux/probe.js";
import type { MediaItem } from "./media/types.js";
import { describeSiteGroups } from "./media/site-catalog.js";
import { SettingsStore, type ServiceSettings } from "./settings/settings-store.js";
import { DownloadRunner } from "./tasks/download-runner.js";
import { TaskStore } from "./tasks/task-store.js";
import type { DownloadTask } from "./tasks/types.js";
import { ensureDirectory } from "./fs/files.js";
import { FfmpegInstaller, type FfmpegInstallState } from "./tools/ffmpeg-installer.js";
import { inspectFfmpeg, UNAVAILABLE, type ToolCapability } from "./tools/tool-capability.js";
import { toolDirectory } from "./tools/tool-paths.js";
import type { ServiceEnvironment } from "./environment.js";
import { engineOrder, isEngineName, type EngineName, type EnginePreference } from "./engine/engine-name.js";
import { inspectYtdlp } from "./ytdlp/ytdlp-binary.js";
import { probeWithYtdlp } from "./ytdlp/probe.js";
import { removeCookieFile, writeCookieFile } from "./ytdlp/cookies.js";
import { YtdlpInstaller, type YtdlpInstallState } from "./ytdlp/ytdlp-installer.js";

export interface ProbeSummary {
  items: MediaItem[];
  failure: string | null;
  failureCode: string | null;
  elapsedMs: number;
  /** Engine that produced the items, or whose failure is being reported. */
  engine: EngineName | null;
  /** Engines that actually ran; empty when none was installed. */
  triedEngines: EngineName[];
}

export interface CreateTaskInput {
  url: string;
  site?: string;
  title?: string;
  streamId: string;
  quality?: string;
  ext?: string;
  needsFfmpeg?: boolean;
  totalBytes?: number;
  /** Engine the item was probed with; defaults to the first available one. */
  engine?: string;
}

/**
 * How much a failure tells the user, used to pick between two engines' diagnoses.
 *
 * A blocked page is more informative than an engine that was not installed: the first can be
 * retried elsewhere, the second only says the tool is missing.
 */
const FAILURE_RANK: Record<string, number> = {
  engine_unavailable: 0,
  site_blocked: 1,
  site_unsupported: 2,
  auth_required: 3,
  network_timeout: 4,
  network_blocked: 5,
};

function rankOf(code: string | null): number {
  return code ? (FAILURE_RANK[code] ?? 0) : 0;
}

export class ServiceContext {
  readonly settingsStore: SettingsStore;
  readonly taskStore: TaskStore;
  readonly runner: DownloadRunner;
  readonly ffmpegInstaller: FfmpegInstaller;
  readonly ytdlpInstaller: YtdlpInstaller;
  lux: ToolCapability = UNAVAILABLE;
  ffmpeg: ToolCapability = UNAVAILABLE;
  ytdlp: ToolCapability = UNAVAILABLE;

  constructor(readonly environment: ServiceEnvironment) {
    this.settingsStore = new SettingsStore(environment.dataRoot);
    this.taskStore = new TaskStore(environment.dataRoot);
    this.ffmpegInstaller = new FfmpegInstaller(environment.dataRoot);
    this.ytdlpInstaller = new YtdlpInstaller(environment.dataRoot);
    this.runner = new DownloadRunner({
      store: this.taskStore,
      settings: () => this.settingsStore.current(),
      luxPath: () => (this.lux.available ? this.lux.path : null),
      ytdlpPath: () => (this.ytdlp.available ? this.ytdlp.path : null),
      dataRoot: environment.dataRoot,
      toolDirectory: toolDirectory(environment.dataRoot),
    });
  }

  async initialize(): Promise<void> {
    await ensureDirectory(this.environment.dataRoot);
    const settings = await this.settingsStore.load();
    await ensureDirectory(settings.downloadDirectory);
    await this.taskStore.load();
    await this.refreshCapabilities();
  }

  async refreshCapabilities(): Promise<{ lux: ToolCapability; ffmpeg: ToolCapability; ytdlp: ToolCapability }> {
    const [lux, ffmpeg, ytdlp] = await Promise.all([
      inspectLux(this.environment.runtimeRoot),
      inspectFfmpeg(toolDirectory(this.environment.dataRoot)),
      inspectYtdlp(this.environment.dataRoot),
    ]);
    this.lux = lux;
    this.ffmpeg = ffmpeg;
    this.ytdlp = ytdlp;
    return { lux, ffmpeg, ytdlp };
  }

  ffmpegInstallState(): FfmpegInstallState {
    return this.ffmpegInstaller.snapshot();
  }

  /** Kick off provisioning and return immediately; callers poll `ffmpegInstallState`. */
  startFfmpegInstall(): FfmpegInstallState {
    // A usable ffmpeg (ours or one on PATH) means there is nothing to download.
    if (!this.ffmpeg.available) {
      void this.ffmpegInstaller.install().then(() => this.refreshCapabilities()).catch(() => undefined);
    }
    return this.ffmpegInstallState();
  }

  /** Await provisioning — used by callers that gate a download on ffmpeg (MCP tools). */
  async ensureFfmpeg(): Promise<ToolCapability> {
    if (this.ffmpeg.available) return this.ffmpeg;
    await this.ffmpegInstaller.install();
    await this.refreshCapabilities();
    return this.ffmpeg;
  }

  ytdlpInstallState(): YtdlpInstallState {
    return this.ytdlpInstaller.snapshot();
  }

  startYtdlpInstall(): YtdlpInstallState {
    if (!this.ytdlp.available) {
      void this.ytdlpInstaller.install().then(() => this.refreshCapabilities()).catch(() => undefined);
    }
    return this.ytdlpInstallState();
  }

  async ensureYtdlp(): Promise<ToolCapability> {
    if (this.ytdlp.available) return this.ytdlp;
    await this.ytdlpInstaller.install();
    await this.refreshCapabilities();
    return this.ytdlp;
  }

  settings(): ServiceSettings {
    return this.settingsStore.current();
  }

  async updateSettings(patch: Partial<ServiceSettings>): Promise<ServiceSettings> {
    return this.settingsStore.update(patch);
  }

  /**
   * Resolve a page with the configured engine, or with both when the setting is `auto`.
   *
   * `auto` stops at the first engine that returns items, so the bundled lux stays the default
   * and yt-dlp is only paid for when the first engine refuses the page. An explicit `engine`
   * overrides the setting for this call only, which is how the panel retries a refused page
   * with the other engine without rewriting the user's preference.
   */
  async probe(url: string, engine?: EnginePreference): Promise<ProbeSummary> {
    const preference = engine ?? this.settings().engine;
    const tried: EngineName[] = [];
    let best: ProbeSummary | null = null;

    for (const candidate of engineOrder(preference)) {
      const capability = candidate === "yt-dlp" ? this.ytdlp : this.lux;
      if (!capability.available || !capability.path) continue;
      tried.push(candidate);
      const outcome =
        candidate === "yt-dlp" ? await this.probeWithYtdlp(capability.path, url) : await this.probeWithLux(capability.path, url);
      const summary: ProbeSummary = { ...outcome, engine: candidate, triedEngines: [...tried] };
      if (summary.items.length > 0) return summary;
      if (!best || rankOf(summary.failureCode) > rankOf(best.failureCode)) best = summary;
    }

    if (!best) {
      return {
        items: [],
        failure: "下载引擎尚未就绪，请先在插件面板完成安装",
        failureCode: "engine_unavailable",
        elapsedMs: 0,
        engine: null,
        triedEngines: tried,
      };
    }
    return { ...best, triedEngines: tried };
  }

  private async probeWithLux(luxPath: string, url: string): Promise<Omit<ProbeSummary, "engine" | "triedEngines">> {
    const outcome = await probeMedia(luxPath, url, { cookie: this.settings().cookie });
    return { items: outcome.items, failure: outcome.failure, failureCode: outcome.failureCode, elapsedMs: outcome.elapsedMs };
  }

  private async probeWithYtdlp(ytdlpPath: string, url: string): Promise<Omit<ProbeSummary, "engine" | "triedEngines">> {
    const jarName = `probe-${randomUUID().slice(0, 8)}`;
    const cookieFile = await writeCookieFile(this.environment.dataRoot, this.settings().cookie, url, jarName).catch(() => null);
    try {
      const outcome = await probeWithYtdlp(ytdlpPath, url, { cookieFile });
      return { items: outcome.items, failure: outcome.failure, failureCode: outcome.failureCode, elapsedMs: outcome.elapsedMs };
    } finally {
      await removeCookieFile(cookieFile);
    }
  }

  createTask(input: CreateTaskInput): DownloadTask {
    const engine: EngineName = isEngineName(input.engine)
      ? input.engine
      : this.lux.available
        ? "lux"
        : "yt-dlp";
    const capability = engine === "yt-dlp" ? this.ytdlp : this.lux;
    if (!capability.available) {
      throw new ServiceError(
        "engine_unavailable",
        engine === "yt-dlp" ? "yt-dlp 引擎尚未安装，请先在设置里安装" : "下载引擎尚未就绪，请先在插件面板完成安装",
        503,
      );
    }
    if (input.needsFfmpeg === true && !this.ffmpeg.available) {
      throw new ServiceError("ffmpeg_required", "该清晰度需要 ffmpeg 合并音视频。请先安装 ffmpeg 再试。", 412);
    }
    const task = this.taskStore.create({
      url: input.url,
      site: input.site?.trim() ?? "",
      title: input.title?.trim() || input.url,
      streamId: input.streamId,
      engine,
      quality: input.quality?.trim() ?? "",
      ext: (input.ext ?? "mp4").toLowerCase(),
      needsFfmpeg: input.needsFfmpeg === true,
      totalBytes: typeof input.totalBytes === "number" && Number.isFinite(input.totalBytes) ? Math.max(0, input.totalBytes) : 0,
    });
    this.runner.schedule(task.id);
    return task;
  }

  listTasks(): DownloadTask[] {
    return this.taskStore.list();
  }

  getTask(id: string): DownloadTask | undefined {
    return this.taskStore.get(id);
  }

  cancelTask(id: string): boolean {
    return this.runner.cancel(id);
  }

  removeTask(id: string): Promise<boolean> {
    return this.runner.remove(id);
  }

  describeSites(): Array<{ name: string; sites: string[] }> {
    return describeSiteGroups();
  }

  async shutdown(): Promise<void> {
    await this.runner.shutdown();
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
