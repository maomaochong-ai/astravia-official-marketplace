import type { DownloadTask } from "../tasks/types.js";
import type { ServiceSettings } from "../settings/settings-store.js";
import type { MediaItem } from "../media/types.js";

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolSchema[] = [
  {
    name: "video_probe",
    description:
      "Inspect a video page URL and return the title, site and every downloadable rendition (resolution, container, size). Read only: nothing is downloaded.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Public http(s) video page URL." },
      },
      required: ["url"],
    },
  },
  {
    name: "video_download",
    description:
      "Queue a download for a video page URL and return the task id. Omit `format` to take the best video rendition reported by video_probe. The task runs in the background; poll it with video_tasks.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Public http(s) video page URL." },
        format: { type: "string", description: "Rendition id from video_probe, for example `1080`." },
        audio_only: { type: "boolean", description: "Pick the best audio-only rendition instead of video." },
      },
      required: ["url"],
    },
  },
  {
    name: "video_tasks",
    description: "List download tasks with phase, progress, speed, remaining time and the saved file path.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Return a single task instead of the list." },
        limit: { type: "number", description: "Maximum number of tasks to return (default 10)." },
      },
    },
  },
  {
    name: "video_cancel",
    description: "Cancel a running download task and discard its partial files.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "video_supported_sites",
    description: "List the sites this downloader is known to handle, grouped by brand.",
    inputSchema: { type: "object", properties: {} },
  },
];

export interface ToolDependencies {
  probe: (url: string) => Promise<{ items: MediaItem[]; failure: string | null }>;
  createTask: (input: {
    url: string;
    site: string;
    title: string;
    streamId: string;
    quality: string;
    ext: string;
    needsFfmpeg: boolean;
    totalBytes: number;
  }) => DownloadTask;
  listTasks: () => DownloadTask[];
  getTask: (id: string) => DownloadTask | undefined;
  cancelTask: (id: string) => boolean;
  settings: () => ServiceSettings;
  describeSites: () => Array<{ name: string; sites: string[] }>;
}

export interface ToolResult {
  text: string;
  isError?: boolean;
}

function summarizeTask(task: DownloadTask): Record<string, unknown> {
  return {
    task_id: task.id,
    title: task.title,
    site: task.site,
    format: task.quality || task.streamId,
    ext: task.ext,
    needs_ffmpeg: task.needsFfmpeg,
    phase: task.phase,
    received_bytes: task.receivedBytes,
    total_bytes: task.totalBytes,
    percent: task.totalBytes > 0 ? Math.round((task.receivedBytes / task.totalBytes) * 1000) / 10 : null,
    speed_bps: task.speedBps,
    file_path: task.filePath,
    error: task.error,
    url: task.url,
  };
}

function summarizeItem(item: MediaItem, includeFormats: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = { title: item.title, site: item.site, url: item.sourceUrl, kind: item.kind };
  if (!includeFormats) {
    base.formats = item.formats.map((format) => format.id);
    return base;
  }
  base.recommended_format = item.recommendedFormatId;
  base.formats = item.formats.map((format) => ({
    id: format.id,
    label: format.label,
    ext: format.ext,
    size_bytes: format.sizeBytes,
    parts: format.partCount,
    audio_only: format.kind === "audio",
  }));
  return base;
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function callTool(name: string, args: Record<string, unknown>, deps: ToolDependencies): Promise<ToolResult> {
  switch (name) {
    case "video_probe": {
      const url = stringArg(args, "url");
      if (!url) return { text: "Missing required argument: url", isError: true };
      const outcome = await deps.probe(url);
      if (outcome.items.length === 0) return { text: outcome.failure ?? "No downloadable media found.", isError: true };
      return { text: JSON.stringify({ items: outcome.items.map((item) => summarizeItem(item, true)) }, null, 2) };
    }
    case "video_download": {
      const url = stringArg(args, "url");
      if (!url) return { text: "Missing required argument: url", isError: true };
      const outcome = await deps.probe(url);
      const item = outcome.items[0];
      if (!item) return { text: outcome.failure ?? "No downloadable media found.", isError: true };
      const audioOnly = args.audio_only === true;
      const requested = stringArg(args, "format");
      const format =
        (requested ? item.formats.find((entry) => entry.id === requested) : undefined) ??
        (audioOnly
          ? item.formats.find((entry) => entry.kind === "audio")
          : item.formats.find((entry) => entry.id === item.recommendedFormatId)) ??
        item.formats[0];
      if (!format) return { text: "No usable rendition reported for this URL.", isError: true };
      const task = deps.createTask({
        url: item.sourceUrl || url,
        site: item.site,
        title: item.title,
        streamId: format.id,
        quality: format.label,
        ext: format.ext,
        needsFfmpeg: format.needsFfmpeg,
        totalBytes: format.sizeBytes,
      });
      return { text: JSON.stringify({ queued: summarizeTask(task), directory: deps.settings().downloadDirectory }, null, 2) };
    }
    case "video_tasks": {
      const taskId = stringArg(args, "task_id");
      if (taskId) {
        const task = deps.getTask(taskId);
        return task ? { text: JSON.stringify(summarizeTask(task), null, 2) } : { text: `Task not found: ${taskId}`, isError: true };
      }
      const rawLimit = args.limit;
      const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.round(rawLimit))) : 10;
      const tasks = deps.listTasks().slice(0, limit).map(summarizeTask);
      return { text: JSON.stringify({ tasks, directory: deps.settings().downloadDirectory }, null, 2) };
    }
    case "video_cancel": {
      const taskId = stringArg(args, "task_id");
      if (!taskId) return { text: "Missing required argument: task_id", isError: true };
      const canceled = deps.cancelTask(taskId);
      return canceled ? { text: `Canceled ${taskId}` } : { text: `Task is not running: ${taskId}`, isError: true };
    }
    case "video_supported_sites": {
      return { text: JSON.stringify({ groups: deps.describeSites() }, null, 2) };
    }
    default:
      return { text: `Unknown tool: ${name}`, isError: true };
  }
}
