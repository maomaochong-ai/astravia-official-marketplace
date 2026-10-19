import { ServiceError } from "./errors.js";
import { inspectFfmpeg, inspectLux, UNAVAILABLE, type ToolCapability } from "./lux/lux-binary.js";
import { probeMedia } from "./lux/probe.js";
import type { MediaItem } from "./media/types.js";
import { describeSiteGroups } from "./media/site-catalog.js";
import { SettingsStore, type ServiceSettings } from "./settings/settings-store.js";
import { DownloadRunner } from "./tasks/download-runner.js";
import { TaskStore } from "./tasks/task-store.js";
import type { DownloadTask } from "./tasks/types.js";
import { ensureDirectory } from "./fs/files.js";
import { FfmpegInstaller, type FfmpegInstallState } from "./tools/ffmpeg-installer.js";
import { toolDirectory } from "./tools/tool-paths.js";
import type { ServiceEnvironment } from "./environment.js";

export interface ProbeSummary {
  items: MediaItem[];
  failure: string | null;
  failureCode: string | null;
  elapsedMs: number;
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
}

export class ServiceContext {
  readonly settingsStore: SettingsStore;
  readonly taskStore: TaskStore;
  readonly runner: DownloadRunner;
  readonly ffmpegInstaller: FfmpegInstaller;
  lux: ToolCapability = UNAVAILABLE;
  ffmpeg: ToolCapability = UNAVAILABLE;

  constructor(readonly environment: ServiceEnvironment) {
    this.settingsStore = new SettingsStore(environment.dataRoot);
    this.taskStore = new TaskStore(environment.dataRoot);
    this.ffmpegInstaller = new FfmpegInstaller(environment.dataRoot);
    this.runner = new DownloadRunner({
      store: this.taskStore,
      settings: () => this.settingsStore.current(),
      luxPath: () => (this.lux.available ? this.lux.path : null),
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

  async refreshCapabilities(): Promise<{ lux: ToolCapability; ffmpeg: ToolCapability }> {
    const [lux, ffmpeg] = await Promise.all([
      inspectLux(this.environment.runtimeRoot),
      inspectFfmpeg(toolDirectory(this.environment.dataRoot)),
    ]);
    this.lux = lux;
    this.ffmpeg = ffmpeg;
    return { lux, ffmpeg };
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

  settings(): ServiceSettings {
    return this.settingsStore.current();
  }

  async updateSettings(patch: Partial<ServiceSettings>): Promise<ServiceSettings> {
    return this.settingsStore.update(patch);
  }

  async probe(url: string): Promise<ProbeSummary> {
    if (!this.lux.available || !this.lux.path) {
      return { items: [], failure: "下载引擎尚未就绪，请先在插件面板完成安装", failureCode: "engine_unavailable", elapsedMs: 0 };
    }
    const outcome = await probeMedia(this.lux.path, url, { cookie: this.settings().cookie });
    return { items: outcome.items, failure: outcome.failure, failureCode: outcome.failureCode, elapsedMs: outcome.elapsedMs };
  }

  createTask(input: CreateTaskInput): DownloadTask {
    if (!this.lux.available) {
      throw new ServiceError("engine_unavailable", "下载引擎尚未就绪，请先在插件面板完成安装", 503);
    }
    if (input.needsFfmpeg === true && !this.ffmpeg.available) {
      throw new ServiceError("ffmpeg_required", "该清晰度由多段视频组成，需要 ffmpeg 合并。请先安装 ffmpeg 再试。", 412);
    }
    const task = this.taskStore.create({
      url: input.url,
      site: input.site?.trim() ?? "",
      title: input.title?.trim() || input.url,
      streamId: input.streamId,
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
