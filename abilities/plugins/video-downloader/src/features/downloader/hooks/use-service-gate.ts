import { useEffect, useRef, useState } from "react";
import type { Capabilities, ToolCapability, ToolInstall } from "../../../domain/media-info";
import type { DownloaderApi } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { ensureServiceStarted, serviceStartupFailure } from "../../../runtime";

const POLL_INTERVAL_MS = 900;
const INSTALL_POLL_MS = 600;
/**
 * The engine is 17–40 MB and comes from GitHub or a mirror, so a slow link spends several attempts
 * resuming before it finishes. This deadline covers roughly ten of them and still ends the wait.
 */
const INSTALL_TIMEOUT_MS = 45 * 60_000;

/** Tool the service provisions on its own; the panel only ever reads progress for it. */
export type ProvisionedTool = "ffmpeg" | "ytdlp";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Service health, tool capability and provisioning progress. Shared by every view through the
 * header badge, so it lives as long as the panel rather than as long as one view.
 */
export interface ServiceGate {
  booting: boolean;
  bootError: string | null;
  capabilities: Capabilities | null;
  ffmpegInstall: ToolInstall | null;
  ffmpegBusy: boolean;
  ytdlpInstall: ToolInstall | null;
  ytdlpBusy: boolean;
  boot(): Promise<void>;
  /** Wait for a tool the service is fetching; true once it answers as available. */
  ensureTool(tool: ProvisionedTool): Promise<boolean>;
  refreshCapabilities(): Promise<void>;
  retryPreparation(): Promise<void>;
  reload(): Promise<void>;
}

export function useServiceGate(ctx: ManagedPluginContext, api: DownloaderApi): ServiceGate {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [ffmpegInstall, setFfmpegInstall] = useState<ToolInstall | null>(null);
  const [ytdlpInstall, setYtdlpInstall] = useState<ToolInstall | null>(null);
  const [ffmpegBusy, setFfmpegBusy] = useState(false);
  const [ytdlpBusy, setYtdlpBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function applyTool(tool: ProvisionedTool, capability: ToolCapability, install: ToolInstall): void {
    if (!mounted.current) return;
    setCapabilities((current) =>
      current
        ? tool === "ffmpeg"
          ? { ...current, ffmpeg: capability }
          : { ...current, ytdlp: capability }
        : null,
    );
    if (tool === "ffmpeg") {
      setFfmpegInstall(install);
    } else {
      setYtdlpInstall(install);
    }
  }

  async function boot(): Promise<void> {
    setBooting(true);
    setBootError(null);
    try {
      const [engine, ffmpeg, ytdlp] = await Promise.all([api.capabilities(), api.ffmpeg(), api.ytdlp()]);
      if (!mounted.current) return;
      setCapabilities({ ...engine, ffmpeg: ffmpeg.ffmpeg, ytdlp: ytdlp.ytdlp });
      setFfmpegInstall(ffmpeg.install);
      setYtdlpInstall(ytdlp.install);
      setBooting(false);
    } catch (error) {
      // Activation already reported the bootstrap failure; show its cause here instead of the
      // downstream "Service is not ready" every request reports, and do not notify twice.
      const failure = serviceStartupFailure();
      if (!mounted.current) return;
      setBooting(false);
      setBootError(failure ?? messageOf(error));
      if (!failure) ctx.ui.notify({ message: ctx.i18n.t("error.serviceUnavailable"), error, variant: "error" });
    }
  }

  async function reload(): Promise<void> {
    setBooting(true);
    setBootError(null);
    try {
      await ensureServiceStarted(ctx);
    } catch (error) {
      if (!mounted.current) return;
      setBooting(false);
      setBootError(serviceStartupFailure() ?? messageOf(error));
      ctx.ui.notify({ message: ctx.i18n.t("error.serviceStart"), error, variant: "error" });
      return;
    }
    await boot();
  }

  useEffect(() => {
    void boot();
    // `boot` closes over props only; running once on activation is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ytdlpReady = capabilities?.ytdlp.available === true;
  const engineStalled = ytdlpInstall?.phase === "failed";

  // The service fetches the engine by itself. This tracker just turns that download into a
  // visible percentage, so the first probe never fails for a reason the user cannot see.
  useEffect(() => {
    if (booting || bootError || ytdlpReady || engineStalled) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const body = await api.ytdlp();
          if (cancelled) return;
          applyTool("ytdlp", body.ytdlp, body.install);
        } catch {
          // A stopped service is already visible through the header badge.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, bootError, ytdlpReady, engineStalled]);

  async function readTool(tool: ProvisionedTool): Promise<{ capability: ToolCapability; install: ToolInstall }> {
    if (tool === "ffmpeg") {
      const body = await api.ffmpeg();
      return { capability: body.ffmpeg, install: body.install };
    }
    const body = await api.ytdlp();
    return { capability: body.ytdlp, install: body.install };
  }

  async function ensureTool(tool: ProvisionedTool): Promise<boolean> {
    const current = await readTool(tool);
    if (current.capability.available) return true;

    if (tool === "ffmpeg") setFfmpegBusy(true);
    else setYtdlpBusy(true);
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
      if (tool === "ffmpeg") setFfmpegBusy(false);
      else setYtdlpBusy(false);
    }
  }

  return {
    booting,
    bootError,
    capabilities,
    ffmpegInstall,
    ffmpegBusy,
    ytdlpInstall,
    ytdlpBusy,
    boot,
    ensureTool,
    refreshCapabilities: async () => {
      try {
        setCapabilities(await api.capabilities(true));
      } catch (error) {
        ctx.ui.notify({ message: ctx.i18n.t("error.capabilityRefreshFailed"), error, variant: "error" });
      }
    },
    retryPreparation: async () => {
      try {
        if (!(await ensureTool("ytdlp"))) {
          ctx.ui.notify({ message: ctx.i18n.t("error.enginePrepareFailed"), variant: "error" });
        }
      } catch (error) {
        ctx.ui.notify({ message: ctx.i18n.t("error.enginePrepareFailed"), error, variant: "error" });
      }
    },
    reload,
  };
}
