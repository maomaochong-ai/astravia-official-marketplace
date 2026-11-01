import type { Disposable } from "@astravia-org/plugin-sdk";

import { adapterMatchesUrl } from "../domain/adapter";
import type { MediaFormat, MediaItem, NewDownloadInput } from "../domain/media-info";
import { AdapterStore } from "../services/adapter-store";
import { createDownloaderApi, ServiceRequestError, type DownloaderApi } from "../services/downloader-api";
import type { ManagedPluginContext } from "../runtime-contract";

export const VIDEO_RESOLVE_TOOL_ID = "video_resolve";

interface ResolveInput {
  url: string;
  download?: boolean;
  formatId?: string;
}

function pickFormat(item: MediaItem, formatId?: string): MediaFormat | null {
  if (formatId) return item.formats.find((format) => format.id === formatId) ?? null;
  return item.formats.find((format) => format.id === item.recommendedFormatId) ?? item.formats[0] ?? null;
}

function toDownloadInput(item: MediaItem, format: MediaFormat): NewDownloadInput {
  return {
    url: item.sourceUrl,
    site: item.site,
    title: item.title,
    streamId: format.id,
    quality: format.quality,
    ext: format.ext,
    needsFfmpeg: format.needsFfmpeg,
    totalBytes: format.sizeBytes,
    directUrl: format.directUrl,
    headers: format.headers,
  };
}

/**
 * The reverse direction of the panel: the agent can ask what a link resolves to, and optionally put
 * the chosen rendition on the queue, without a user driving the UI. It reports the same failure
 * codes the panel shows, plus which adapters apply, so a follow-up turn can act on it.
 */
export function registerVideoResolveTool(ctx: ManagedPluginContext, api: DownloaderApi = createDownloaderApi(ctx)): Disposable | null {
  if (!ctx.permissions.has("agent.tools.register")) return null;

  return ctx.agent.registerTool<ResolveInput>({
    id: VIDEO_RESOLVE_TOOL_ID,
    label: "%tool.videoResolve.label%",
    description:
      "Resolve one video page URL through the Video Downloader engine and return its formats. " +
      "Use when the user wants to know what a link contains, which qualities exist, or wants a download queued. " +
      "Do NOT use for plain web pages with no media, and do not call it for the same URL twice in one turn.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Page URL, including its share text if the user pasted one." },
        download: {
          type: "boolean",
          description: "Queue the rendition right away instead of only reporting it. Defaults to false.",
        },
        formatId: { type: "string", description: "Format id to queue. Defaults to the recommended one." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    scope_use: ["conversation", "project"],
    timeoutMs: 120_000,
    handler: async ({ trigger }) => {
      const input = trigger.input;
      const url = String(input?.url ?? "").trim();
      if (!url) return JSON.stringify({ ok: false, error: "url is required" });

      let probed;
      try {
        probed = await api.probe(url);
      } catch (cause) {
        const code = cause instanceof ServiceRequestError ? cause.code : "request_failed";
        return JSON.stringify({ ok: false, url, failureCode: code, failure: cause instanceof Error ? cause.message : String(cause) });
      }

      if (!probed.items.length) {
        const adapters = await new AdapterStore(ctx.storage)
          .list()
          .then((list) => list.filter((adapter) => adapter.enabled && adapterMatchesUrl(adapter, url)).map((adapter) => adapter.meta.name))
          .catch(() => []);
        return JSON.stringify({
          ok: false,
          url,
          failureCode: probed.failureCode ?? "engine_unavailable",
          failure: probed.failure ?? "the engine returned no formats",
          adapters,
          hint: adapters.length
            ? "The panel can resolve this page inside its browser: open Supports, then run one of the listed adapters."
            : "No adapter covers this page either.",
        });
      }

      const item = probed.items[0] as MediaItem;
      const summary = probed.items.map((candidate) => ({
        title: candidate.title,
        site: candidate.site,
        uploader: candidate.uploader,
        formats: candidate.formats.map((format) => ({
          id: format.id,
          quality: format.quality,
          ext: format.ext,
          sizeBytes: format.sizeBytes,
          needsFfmpeg: format.needsFfmpeg,
        })),
        recommendedFormatId: candidate.recommendedFormatId,
      }));

      if (!input?.download) return JSON.stringify({ ok: true, url, elapsedMs: probed.elapsedMs, items: summary });

      const format = pickFormat(item, input.formatId);
      if (!format) return JSON.stringify({ ok: false, url, error: "the requested format does not exist", items: summary });

      try {
        const task = await api.createTask(toDownloadInput(item, format));
        return JSON.stringify({ ok: true, url, queued: { id: task.id, title: task.title, quality: format.quality } });
      } catch (cause) {
        const code = cause instanceof ServiceRequestError ? cause.code : "request_failed";
        return JSON.stringify({
          ok: false,
          url,
          failureCode: code,
          failure: cause instanceof Error ? cause.message : String(cause),
          items: summary,
        });
      }
    },
  });
}
