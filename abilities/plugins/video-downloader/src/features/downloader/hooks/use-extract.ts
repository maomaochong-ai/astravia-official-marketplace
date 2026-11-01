import { useRef, useState } from "react";
import type { MediaItem, ProbeResult } from "../../../domain/media-info";
import type { DownloaderApi, ServiceRequestError } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { extractTargetUrl } from "../../../domain/target-url";

/** Failure code the service reports while it is still fetching the download engine. */
const ENGINE_PREPARING = "engine_preparing";

export interface ExtractOptions {
  ensureTool(tool: "ffmpeg" | "ytdlp"): Promise<boolean>;
  /** True while an Adapter run owns the offscreen page; the two paths never run together. */
  blocked: boolean;
  onTaskCreated(): Promise<void>;
}

/**
 * The Extract view: one URL in, one Media Item out, one download started. It owns nothing the
 * queue or the service gate needs, so switching views can drop it safely.
 */
export interface ExtractController {
  url: string;
  probing: boolean;
  probeError: string | null;
  probeErrorCode: string | null;
  result: ProbeResult | null;
  activeItemIndex: number;
  selectedFormatId: string | null;
  starting: boolean;
  setUrl(value: string): void;
  analyze(): Promise<void>;
  useClipboard(): Promise<void>;
  selectItem(index: number): void;
  selectFormat(formatId: string): void;
  startDownload(): Promise<void>;
  /** Adopt an item resolved by an Adapter, so it renders and downloads like any other item. */
  adoptItem(item: MediaItem): void;
}

export function useExtract(ctx: ManagedPluginContext, api: DownloaderApi, options: ExtractOptions): ExtractController {
  const [url, setUrlState] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeErrorCode, setProbeErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const mounted = useRef(true);

  // No effect is used to set `mounted`; the panel owns the hook lifetime and React drops the
  // state with the component. Kept as a ref so an awaited call can bail before touching state.
  mounted.current = true;

  function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function applyProbeResult(next: ProbeResult): void {
    if (!next.items.length) {
      setProbing(false);
      setResult(null);
      setProbeError(next.failure ?? ctx.i18n.t("error.noMedia"));
      setProbeErrorCode(next.failureCode ?? null);
      return;
    }
    // The engine is the layer that answered, and labelling it makes the path visible in the card.
    const items = next.items.map((item) => ({ ...item, extractionPath: item.extractionPath ?? "engine" }));
    const first = items[0];
    setProbing(false);
    setResult({ ...next, items });
    setActiveItemIndex(0);
    setSelectedFormatId(first?.recommendedFormatId ?? first?.formats[0]?.id ?? null);
  }

  async function analyze(): Promise<void> {
    if (options.blocked) return;
    // A pasted share message wraps the link in prose, so the target is extracted first and
    // written back into the field: the user sees the URL that is actually being resolved.
    const target = extractTargetUrl(url);
    if (!target) {
      setProbing(false);
      setResult(null);
      setProbeError(ctx.i18n.t("error.noLink"));
      setProbeErrorCode(null);
      return;
    }
    if (target !== url.trim()) setUrlState(target);
    setProbing(true);
    setProbeError(null);
    setProbeErrorCode(null);
    try {
      const probed = await api.probe(target);
      if (!probed.items.length && probed.failureCode === ENGINE_PREPARING) {
        // First run on a fresh install: wait for the engine the service is fetching, then look
        // once more. A second `engine_preparing` is surfaced as an error instead of looping.
        if (await options.ensureTool("ytdlp")) {
          applyProbeResult(await api.probe(target));
          return;
        }
      }
      applyProbeResult(probed);
    } catch (error) {
      setProbing(false);
      setResult(null);
      setProbeError(messageOf(error));
      setProbeErrorCode(null);
    }
  }

  async function useClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrlState(extractTargetUrl(text) || text.trim());
        setProbeError(null);
      }
    } catch (error) {
      ctx.ui.notify({ message: ctx.i18n.t("error.clipboard"), error, variant: "error" });
    }
  }

  function selectItem(index: number): void {
    const item = result?.items[index];
    if (!item) return;
    setActiveItemIndex(index);
    setSelectedFormatId(item.recommendedFormatId ?? item.formats[0]?.id ?? null);
  }

  async function sendDownload(): Promise<void> {
    const item = result?.items[activeItemIndex];
    const format = item?.formats.find((candidate) => candidate.id === selectedFormatId);
    if (!item || !format) return;
    await api.createTask({
      url: item.sourceUrl,
      site: item.site,
      title: item.title,
      streamId: format.id,
      directUrl: format.directUrl,
      headers: format.headers,
      quality: format.quality,
      ext: format.ext,
      needsFfmpeg: format.needsFfmpeg,
      totalBytes: format.sizeBytes,
    });
  }

  async function startDownload(): Promise<void> {
    if (!result?.items[activeItemIndex]) return;
    setStarting(true);
    try {
      await sendDownload();
      setStarting(false);
      setResult(null);
      setUrlState("");
      setSelectedFormatId(null);
      setActiveItemIndex(0);
      await options.onTaskCreated();
    } catch (error) {
      const code = (error as ServiceRequestError).code;
      if (code === "ffmpeg_required") {
        setStarting(false);
        try {
          if (await options.ensureTool("ffmpeg")) {
            await startDownload();
            return;
          }
        } catch (installError) {
          ctx.ui.notify({ message: ctx.i18n.t("error.ffmpegInstallFailed"), error: installError, variant: "error" });
          return;
        }
        ctx.ui.notify({ message: ctx.i18n.t("error.ffmpegRequired"), error, variant: "error" });
        return;
      }
      setStarting(false);
      ctx.ui.notify({
        message: code === "engine_unavailable" ? ctx.i18n.t("error.serviceUnavailable") : ctx.i18n.t("error.startFailed"),
        error,
        variant: "error",
      });
    }
  }

  return {
    url,
    probing,
    probeError,
    probeErrorCode,
    result,
    activeItemIndex,
    selectedFormatId,
    starting,
    setUrl: (value) => {
      setUrlState(value);
      setProbeError(null);
    },
    analyze,
    useClipboard,
    selectItem,
    selectFormat: setSelectedFormatId,
    startDownload,
    adoptItem: (item) => {
      setResult({ items: [item], failure: null, failureCode: null, elapsedMs: 0 });
      setActiveItemIndex(0);
      setSelectedFormatId(item.recommendedFormatId ?? item.formats[0]?.id ?? null);
      setProbeError(null);
      setProbeErrorCode(null);
    },
  };
}
