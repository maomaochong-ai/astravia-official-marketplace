import { useEffect, useRef, useState } from "react";
import type {
  Capabilities,
  DownloadTask,
  MediaItem,
  ProbeResult,
  ServiceSettings,
  ToolCapability,
  ToolInstall,
} from "../../../domain/media-info";
import type { DownloaderApi, ServiceRequestError } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { extractTargetUrl } from "../../../domain/target-url";
import { ensureServiceStarted, serviceStartupFailure } from "../../../runtime";

const POLL_INTERVAL_MS = 900;
const INSTALL_POLL_MS = 600;
const INSTALL_TIMEOUT_MS = 20 * 60_000;

/** Tool the service provisions on its own; the panel only ever reads progress for it. */
type ProvisionedTool = "ffmpeg" | "ytdlp";

/** Failure code the service reports while it is still fetching the download engine. */
const ENGINE_PREPARING = "engine_preparing";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DownloaderState {
  booting: boolean;
  bootError: string | null;
  capabilities: Capabilities | null;
  settings: ServiceSettings | null;
  tasks: DownloadTask[];
  url: string;
  probing: boolean;
  probeError: string | null;
  probeErrorCode: string | null;
  result: ProbeResult | null;
  activeItemIndex: number;
  selectedFormatId: string | null;
  starting: boolean;
  ffmpegInstall: ToolInstall | null;
  ffmpegBusy: boolean;
  ytdlpInstall: ToolInstall | null;
  ytdlpBusy: boolean;
}

export interface DownloaderController {
  state: DownloaderState;
  setUrl(value: string): void;
  analyze(): Promise<void>;
  useClipboard(): Promise<void>;
  selectItem(index: number): void;
  selectFormat(formatId: string): void;
  startDownload(): Promise<void>;
  cancelTask(id: string): Promise<void>;
  retryTask(id: string): Promise<void>;
  removeTask(id: string): Promise<void>;
  revealTask(id: string): Promise<void>;
  saveSettings(patch: Partial<ServiceSettings>): Promise<void>;
  refreshCapabilities(): Promise<void>;
  /** Retry a preparation that failed; the panel never asks the user to install anything. */
  retryPreparation(): Promise<void>;
  reload(): Promise<void>;
}

const INITIAL_STATE: DownloaderState = {
  booting: true,
  bootError: null,
  capabilities: null,
  settings: null,
  tasks: [],
  url: "",
  probing: false,
  probeError: null,
  probeErrorCode: null,
  result: null,
  activeItemIndex: 0,
  selectedFormatId: null,
  starting: false,
  ffmpegInstall: null,
  ytdlpInstall: null,
  ffmpegBusy: false,
  ytdlpBusy: false,
};

function activeItem(state: DownloaderState): MediaItem | null {
  const item = state.result?.items[state.activeItemIndex];
  return item ?? null;
}

export function useDownloader(ctx: ManagedPluginContext, api: DownloaderApi): DownloaderController {
  const [state, setState] = useState<DownloaderState>(INITIAL_STATE);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function patch(next: Partial<DownloaderState>): void {
    if (mounted.current) setState((current) => ({ ...current, ...next }));
  }

  function report(message: string, error?: unknown): void {
    ctx.ui.notify({ message, error, variant: "error" });
  }

  function messageOf(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async function loadTasks(): Promise<void> {
    const tasks = await api.tasks();
    patch({ tasks });
  }

  async function boot(): Promise<void> {
    patch({ booting: true, bootError: null });
    try {
      const [capabilities, settings, tasks, ffmpegTool, ytdlpTool] = await Promise.all([
        api.capabilities(),
        api.settings(),
        api.tasks(),
        api.ffmpeg(),
        api.ytdlp(),
      ]);
      patch({
        booting: false,
        capabilities: { ...capabilities, ffmpeg: ffmpegTool.ffmpeg, ytdlp: ytdlpTool.ytdlp },
        settings,
        tasks,
        ffmpegInstall: ffmpegTool.install,
        ytdlpInstall: ytdlpTool.install,
      });
    } catch (error) {
      // Activation already reported the bootstrap failure; show its cause here instead of the
      // downstream "Service is not ready" every request reports, and do not notify twice.
      const failure = serviceStartupFailure();
      patch({ booting: false, bootError: failure ?? messageOf(error) });
      if (!failure) report(ctx.i18n.t("error.serviceUnavailable"), error);
    }
  }

  async function restart(): Promise<void> {
    patch({ booting: true, bootError: null });
    try {
      await ensureServiceStarted(ctx);
    } catch (error) {
      patch({ booting: false, bootError: serviceStartupFailure() ?? messageOf(error) });
      report(ctx.i18n.t("error.serviceStart"), error);
      return;
    }
    await boot();
  }

  useEffect(() => {
    void boot();
    // `boot` closes over props only; running once on activation is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.booting || state.bootError) return;
    const timer = setInterval(() => {
      void loadTasks().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.booting, state.bootError]);

  const ytdlpReady = state.capabilities?.ytdlp.available === true;
  const engineStalled = state.ytdlpInstall?.phase === "failed";

  // The service fetches the engine by itself. This tracker just turns that download into a
  // visible percentage, so the first probe never fails for a reason the user cannot see.
  useEffect(() => {
    if (state.booting || state.bootError || ytdlpReady || engineStalled) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const body = await api.ytdlp();
          if (cancelled) return;
          applyTool("ytdlp", body.ytdlp, body.install);
        } catch {
          // The task poller already surfaces a service that stopped answering.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.booting, state.bootError, ytdlpReady, engineStalled]);

  async function analyze(): Promise<void> {
    // A pasted share message wraps the link in prose, so the target is extracted first and
    // written back into the field: the user sees the URL that is actually being resolved.
    const url = extractTargetUrl(state.url);
    if (!url) {
      patch({ probing: false, result: null, probeError: ctx.i18n.t("error.noLink"), probeErrorCode: null });
      return;
    }
    if (url !== state.url.trim()) patch({ url });
    patch({ probing: true, probeError: null, probeErrorCode: null });
    try {
      const result = await api.probe(url);
      if (!result.items.length && result.failureCode === ENGINE_PREPARING) {
        // First run on a fresh install: wait for the engine the service is fetching, then look
        // once more. A second `engine_preparing` is surfaced as an error instead of looping.
        if (await waitForTool("ytdlp")) {
          applyProbeResult(await api.probe(url));
          return;
        }
      }
      applyProbeResult(result);
    } catch (error) {
      patch({ probing: false, result: null, probeError: messageOf(error), probeErrorCode: null });
    }
  }

  function applyProbeResult(result: ProbeResult): void {
    if (!result.items.length) {
      patch({
        probing: false,
        result: null,
        probeError: result.failure ?? ctx.i18n.t("error.noMedia"),
        probeErrorCode: result.failureCode ?? null,
      });
      return;
    }
    const first = result.items[0];
    patch({
      probing: false,
      result,
      activeItemIndex: 0,
      selectedFormatId: first?.recommendedFormatId ?? first?.formats[0]?.id ?? null,
    });
  }

  async function useClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) patch({ url: extractTargetUrl(text) || text.trim(), probeError: null });
    } catch (error) {
      report(ctx.i18n.t("error.clipboard"), error);
    }
  }

  function selectItem(index: number): void {
    setState((current) => {
      const item = current.result?.items[index];
      if (!item) return current;
      return {
        ...current,
        activeItemIndex: index,
        selectedFormatId: item.recommendedFormatId ?? item.formats[0]?.id ?? null,
      };
    });
  }

  function selectFormat(formatId: string): void {
    patch({ selectedFormatId: formatId });
  }

  /** Read one provisioned tool plus its install progress; the two endpoints differ only in key. */
  async function readTool(tool: ProvisionedTool): Promise<{ capability: ToolCapability; install: ToolInstall }> {
    if (tool === "ffmpeg") {
      const body = await api.ffmpeg();
      return { capability: body.ffmpeg, install: body.install };
    }
    const body = await api.ytdlp();
    return { capability: body.ytdlp, install: body.install };
  }

  /** Merge a toolchain read into state without clobbering capabilities loaded in the same render. */
  function applyTool(tool: ProvisionedTool, capability: ToolCapability, install: ToolInstall): void {
    if (!mounted.current) return;
    setState((current) => {
      const capabilities = current.capabilities
        ? tool === "ffmpeg"
          ? { ...current.capabilities, ffmpeg: capability }
          : { ...current.capabilities, ytdlp: capability }
        : null;
      return tool === "ffmpeg"
        ? { ...current, ffmpegInstall: install, capabilities }
        : { ...current, ytdlpInstall: install, capabilities };
    });
  }

  /**
   * Wait for a tool the service is fetching, so a rendition that needs an extra step (a merge)
   * never leaves the user to install it by hand. Progress is mirrored into state as it moves.
   */
  async function waitForTool(tool: ProvisionedTool): Promise<boolean> {
    const current = await readTool(tool);
    if (current.capability.available) return true;

    patch(tool === "ffmpeg" ? { ffmpegBusy: true } : { ytdlpBusy: true });
    try {
      let install = await (tool === "ffmpeg" ? api.installFfmpeg() : api.installYtdlp());
      applyTool(tool, current.capability, install);
      const deadline = Date.now() + INSTALL_TIMEOUT_MS;
      while (install.phase === "idle" || install.phase === "downloading" || install.phase === "verifying") {
        if (Date.now() > deadline) break;
        await delay(INSTALL_POLL_MS);
        const next = await readTool(tool);
        install = next.install;
        applyTool(tool, next.capability, install);
      }
      if (install.phase === "failed") throw new Error(install.error ?? `${tool} provisioning failed`);
      // The POST may already have found a usable binary, so the authoritative answer is a fresh read.
      const latest = await readTool(tool);
      applyTool(tool, latest.capability, latest.install);
      return latest.capability.available;
    } finally {
      patch(tool === "ffmpeg" ? { ffmpegBusy: false } : { ytdlpBusy: false });
    }
  }

  async function sendDownload(): Promise<void> {
    const item = activeItem(state);
    const format = item?.formats.find((candidate) => candidate.id === state.selectedFormatId);
    if (!item || !format) return;
    await api.createTask({
      url: item.sourceUrl,
      site: item.site,
      title: item.title,
      streamId: format.id,
      quality: format.quality,
      ext: format.ext,
      needsFfmpeg: format.needsFfmpeg,
      totalBytes: format.sizeBytes,
    });
  }

  async function startDownload(): Promise<void> {
    if (!activeItem(state)) return;
    patch({ starting: true });
    try {
      await sendDownload();
      patch({ starting: false, result: null, url: "", selectedFormatId: null, activeItemIndex: 0 });
      await loadTasks();
    } catch (error) {
      const code = (error as ServiceRequestError).code;
      if (code === "ffmpeg_required") {
        patch({ starting: false });
        try {
          if (await waitForTool("ffmpeg")) {
            await startDownload();
            return;
          }
        } catch (installError) {
          report(ctx.i18n.t("error.ffmpegInstallFailed"), installError);
          return;
        }
        report(ctx.i18n.t("error.ffmpegRequired"), error);
        return;
      }
      patch({ starting: false });
      report(code === "engine_unavailable" ? ctx.i18n.t("error.serviceUnavailable") : ctx.i18n.t("error.startFailed"), error);
    }
  }

  async function runTaskAction(action: (id: string) => Promise<unknown>, id: string, failureKey: string): Promise<void> {
    try {
      await action(id);
      await loadTasks();
    } catch (error) {
      report(ctx.i18n.t(failureKey), error);
    }
  }

  return {
    state,
    setUrl: (value) => patch({ url: value, probeError: null }),
    analyze,
    useClipboard,
    selectItem,
    selectFormat,
    startDownload,
    cancelTask: (id) => runTaskAction(api.cancelTask, id, "error.cancelFailed"),
    retryTask: (id) => runTaskAction(api.retryTask, id, "error.retryFailed"),
    removeTask: (id) => runTaskAction(api.removeTask, id, "error.removeFailed"),
    revealTask: (id) => runTaskAction(api.revealTask, id, "error.revealFailed"),
    saveSettings: async (next) => {
      try {
        const settings = await api.saveSettings(next);
        patch({ settings });
      } catch (error) {
        report(ctx.i18n.t("error.settingsFailed"), error);
      }
    },
    retryPreparation: async () => {
      try {
        if (!(await waitForTool("ytdlp"))) report(ctx.i18n.t("error.enginePrepareFailed"));
      } catch (error) {
        report(ctx.i18n.t("error.enginePrepareFailed"), error);
      }
    },
    refreshCapabilities: async () => {
      try {
        const capabilities = await api.capabilities(true);
        patch({ capabilities });
      } catch (error) {
        report(ctx.i18n.t("error.capabilityRefreshFailed"), error);
      }
    },
    reload: restart,
  };
}
