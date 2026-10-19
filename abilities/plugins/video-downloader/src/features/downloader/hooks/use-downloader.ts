import { useEffect, useRef, useState } from "react";
import type {
  Capabilities,
  DownloadTask,
  FfmpegInstall,
  MediaItem,
  ProbeResult,
  ServiceSettings,
} from "../../../domain/media-info";
import type { DownloaderApi, ServiceRequestError } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { extractTargetUrl } from "../../../domain/target-url";

const POLL_INTERVAL_MS = 900;
const INSTALL_POLL_MS = 600;
const INSTALL_TIMEOUT_MS = 20 * 60_000;

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
  ffmpegInstall: FfmpegInstall | null;
  ffmpegBusy: boolean;
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
  installFfmpeg(): Promise<void>;
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
  ffmpegBusy: false,
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
      const [capabilities, settings, tasks, toolchain] = await Promise.all([
        api.capabilities(),
        api.settings(),
        api.tasks(),
        api.ffmpeg(),
      ]);
      patch({
        booting: false,
        capabilities: { ...capabilities, ffmpeg: toolchain.ffmpeg },
        settings,
        tasks,
        ffmpegInstall: toolchain.install,
      });
    } catch (error) {
      patch({ booting: false, bootError: messageOf(error) });
      report(ctx.i18n.t("error.serviceUnavailable"), error);
    }
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
    } catch (error) {
      patch({ probing: false, result: null, probeError: messageOf(error), probeErrorCode: null });
    }
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

  /**
   * Downloads the pinned ffmpeg build and waits for it, so a multi-part rendition never leaves
   * the user to install ffmpeg by hand.
   */
  async function waitForFfmpeg(): Promise<boolean> {
    let capability = state.capabilities?.ffmpeg ?? (await api.ffmpeg()).ffmpeg;
    if (capability.available) return true;

    patch({ ffmpegBusy: true });
    try {
      let install = await api.installFfmpeg();
      patch({ ffmpegInstall: install });
      const deadline = Date.now() + INSTALL_TIMEOUT_MS;
      while (install.phase === "idle" || install.phase === "downloading" || install.phase === "verifying") {
        if (Date.now() > deadline) break;
        await delay(INSTALL_POLL_MS);
        const next = await api.ffmpeg();
        install = next.install;
        applyCapabilities(next.ffmpeg, install);
      }
      if (install.phase === "failed") throw new Error(install.error ?? "ffmpeg install failed");
      // The POST may already have found a usable binary, so the authoritative answer is a fresh read.
      const latest = await api.ffmpeg();
      applyCapabilities(latest.ffmpeg, latest.install);
      return latest.ffmpeg.available;
    } finally {
      patch({ ffmpegBusy: false });
    }
  }

  /** Merge a toolchain read into state without clobbering capabilities loaded in the same render. */
  function applyCapabilities(ffmpeg: Capabilities["ffmpeg"], install: FfmpegInstall): void {
    if (!mounted.current) return;
    setState((current) => ({
      ...current,
      ffmpegInstall: install,
      capabilities: current.capabilities ? { ...current.capabilities, ffmpeg } : null,
    }));
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
          if (await waitForFfmpeg()) {
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
    installFfmpeg: async () => {
      try {
        await waitForFfmpeg();
      } catch (error) {
        report(ctx.i18n.t("error.ffmpegInstallFailed"), error);
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
    reload: boot,
  };
}
