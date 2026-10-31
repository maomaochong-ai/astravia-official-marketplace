import { randomUUID } from "node:crypto";
import { ServiceError } from "./errors.js";
import type { MediaItem } from "./media/types.js";
import { describeSiteGroups, describeUnsupportedSites, SITE_GROUPS } from "./media/site-catalog.js";
import { SettingsStore, type ServiceSettings } from "./settings/settings-store.js";
import { DownloadRunner } from "./tasks/download-runner.js";
import { TaskStore } from "./tasks/task-store.js";
import type { DownloadTask } from "./tasks/types.js";
import { ensureDirectory } from "./fs/files.js";
import { FfmpegInstaller, type FfmpegInstallState } from "./tools/ffmpeg-installer.js";
import { inspectFfmpeg, UNAVAILABLE, type ToolCapability } from "./tools/tool-capability.js";
import { toolDirectory } from "./tools/tool-paths.js";
import type { ServiceEnvironment } from "./environment.js";
import { inspectYtdlp } from "./ytdlp/ytdlp-binary.js";
import { probeWithYtdlp } from "./ytdlp/probe.js";
import { removeCookieFile, writeCookieFile } from "./ytdlp/cookies.js";
import { YtdlpInstaller, type YtdlpInstallState } from "./ytdlp/ytdlp-installer.js";
import { capabilityForUrl, isDirectMediaUrl, type SiteCapability, type SiteReason } from "./media/site-capabilities.js";
import { proxyForUrl } from "./network/egress.js";
import { writeAnonymousCookieFile } from "./ytdlp/cookie-bootstrap.js";

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

/** Failure code used while the engine is still being provisioned in the background. */
export const ENGINE_PREPARING = "engine_preparing";

/**
 * Add the one instruction the generic engine message cannot carry: which session source to use.
 * A platform that gates its page reports `auth_required` or `site_blocked` whether or not an
 * anonymous client asked, so the site table decides what the user is told to do next.
 */
function enrichFailure(failure: string | null, code: string | null, capability: SiteCapability | null): string | null {
  if (!failure || !capability || capability.cookie !== "session") return failure;
  if (code !== "auth_required" && code !== "site_blocked") return failure;
  return `${failure}\n${capability.label}需要登录态：请在设置里把「Cookie 来源」选为常用浏览器，或粘贴该站 Cookie 后重试`;
}

/** Failure codes the panel translates, one per reason the engine cannot resolve a host. */
export function unsupportedCode(reason: SiteReason | undefined): string {
  if (reason === "upstream-broken") return "site_upstream_broken";
  if (reason === "site-offline") return "site_offline";
  return "site_unsupported";
}

/** Detail line shown under the translated headline; it is the only place the site name appears. */
function unsupportedMessage(label: string, reason: SiteReason | undefined): string {
  if (reason === "upstream-broken") return `${label}的解析器在上游被标记为已知损坏，暂时无法解析`;
  if (reason === "site-offline") return `${label}的站点服务不可达，暂时无法解析`;
  return `${label}没有可用的解析器，暂时无法下载`;
}

/**
 * Owns settings, tasks and the two provisioned tools.
 *
 * yt-dlp is the only engine and is fetched on first use: the service starts downloading it as
 * soon as the process is up, so a user who opens the panel a moment later finds it ready. ffmpeg
 * is only needed to merge a video-only rendition with its audio track, so it is fetched when a
 * download actually asks for it instead of costing everyone ~30 MB up front.
 */
export class ServiceContext {
  readonly settingsStore: SettingsStore;
  readonly taskStore: TaskStore;
  readonly runner: DownloadRunner;
  readonly ffmpegInstaller: FfmpegInstaller;
  readonly ytdlpInstaller: YtdlpInstaller;
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

  async refreshCapabilities(): Promise<{ ytdlp: ToolCapability; ffmpeg: ToolCapability }> {
    const [ffmpeg, ytdlp] = await Promise.all([
      inspectFfmpeg(toolDirectory(this.environment.dataRoot)),
      inspectYtdlp(this.environment.dataRoot),
    ]);
    this.ffmpeg = ffmpeg;
    this.ytdlp = ytdlp;
    return { ytdlp, ffmpeg };
  }

  /**
   * Start fetching the engine in the background. Safe to call repeatedly: the installer is
   * single-flight and returns immediately once the binary is in place.
   */
  provisionEngine(): void {
    this.startYtdlpInstall();
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
   * Resolve a page with the engine.
   *
   * Probing never waits for the provisioning download: the panel's request has a short budget and
   * a first run on a slow link would exceed it. It reports `engine_preparing` instead, the panel
   * follows the install progress and probes again once the binary is in place.
   */
  async probe(url: string): Promise<ProbeSummary> {
    // A bare media file needs no extractor: the engine's generic path downloads it as is, so a
    // platform the table marks unsupported must not block a direct link on the same host.
    const capability = isDirectMediaUrl(url) ? null : capabilityForUrl(url);
    if (capability && !capability.extractor) {
      // No extractor exists for this host, so a request would only spend the timeout budget.
      return {
        items: [],
        failure: unsupportedMessage(capability.label, capability.reason),
        failureCode: unsupportedCode(capability.reason),
        elapsedMs: 0,
      };
    }
    if (!this.ytdlp.available || !this.ytdlp.path) {
      this.provisionEngine();
      return {
        items: [],
        failure: "下载引擎正在准备，请稍候再试",
        failureCode: ENGINE_PREPARING,
        elapsedMs: 0,
      };
    }
    return this.probeWithYtdlp(this.ytdlp.path, url);
  }

  private async probeWithYtdlp(ytdlpPath: string, url: string): Promise<ProbeSummary> {
    const settings = this.settings();
    const jarName = `probe-${randomUUID().slice(0, 8)}`;
    const cookieFile = await this.prepareCookieJar(settings, url, jarName);
    try {
      const outcome = await probeWithYtdlp(ytdlpPath, url, {
        cookieFile,
        cookieBrowser: settings.cookieBrowser,
        proxy: proxyForUrl(url, settings),
      });
      return {
        items: outcome.items,
        failure: enrichFailure(outcome.failure, outcome.failureCode, capabilityForUrl(url)),
        failureCode: outcome.failureCode,
        elapsedMs: outcome.elapsedMs,
      };
    } finally {
      await removeCookieFile(cookieFile);
    }
  }

  /**
   * Prepare a session for one request: a pasted cookie wins, then an anonymous jar where the site
   * accepts one. A configured browser is left to the engine, which reads it itself.
   */
  private async prepareCookieJar(settings: ServiceSettings, url: string, name: string): Promise<string | null> {
    const manual = await writeCookieFile(this.environment.dataRoot, settings.cookie, url, name).catch(() => null);
    if (manual || settings.cookieBrowser) return manual;
    return writeAnonymousCookieFile({ url, dataRoot: this.environment.dataRoot, name }).catch(() => null);
  }

  createTask(input: CreateTaskInput): DownloadTask {
    if (!this.ytdlp.available) {
      this.provisionEngine();
      throw new ServiceError(ENGINE_PREPARING, "下载引擎正在准备，请稍候再试", 503);
    }
    if (input.needsFfmpeg === true && !this.ffmpeg.available) {
      // The retry that follows this failure finds ffmpeg downloaded or downloading.
      this.startFfmpegInstall();
      throw new ServiceError("ffmpeg_required", "该清晰度需要 ffmpeg 合并音视频，正在自动准备，请稍候再试。", 412);
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

  /** The panel's coverage view: groups keep their machine key so the UI can translate the heading. */
  siteCoverage(): {
    groups: Array<{ key: string; sites: string[] }>;
    unsupported: Array<{ label: string; reason: SiteReason }>;
  } {
    return {
      groups: SITE_GROUPS.map((group) => ({ key: group.key, sites: group.sites })),
      unsupported: describeUnsupportedSites(),
    };
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
