import type {
  Capabilities,
  DownloadTask,
  NewDownloadInput,
  ProbeResult,
  ServiceSettings,
  ToolInstall,
} from "../domain/media-info";
import { normalizeCapabilities } from "../domain/capabilities";
import { SERVICE_ID } from "../plugin-ids";
import type { ManagedPluginContext } from "../runtime-contract";

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export class ServiceRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ServiceRequestError";
  }
}

export interface DownloaderApi {
  capabilities(refresh?: boolean): Promise<Capabilities>;
  ffmpeg(): Promise<{ ffmpeg: Capabilities["ffmpeg"]; install: ToolInstall }>;
  installFfmpeg(): Promise<ToolInstall>;
  ytdlp(): Promise<{ ytdlp: Capabilities["ytdlp"]; install: ToolInstall }>;
  installYtdlp(): Promise<ToolInstall>;
  probe(url: string): Promise<ProbeResult>;
  tasks(): Promise<DownloadTask[]>;
  createTask(input: NewDownloadInput): Promise<DownloadTask>;
  cancelTask(id: string): Promise<void>;
  retryTask(id: string): Promise<DownloadTask>;
  removeTask(id: string): Promise<void>;
  revealTask(id: string): Promise<void>;
  settings(): Promise<ServiceSettings>;
  saveSettings(patch: Partial<ServiceSettings>): Promise<ServiceSettings>;
}

export function createDownloaderApi(ctx: ManagedPluginContext): DownloaderApi {
  async function call<T>(
    path: string,
    init: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: unknown;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const response = await ctx.services.request<T & ErrorBody>(SERVICE_ID, {
      path,
      method: init.method ?? "GET",
      responseType: "json",
      timeoutMs: init.timeoutMs,
      body: init.body,
    });
    if (!response.ok) {
      const detail = response.body as ErrorBody | null;
      throw new ServiceRequestError(
        detail?.error?.message ?? `${response.status} ${response.statusText}`,
        detail?.error?.code ?? "request_failed",
        response.status,
      );
    }
    return response.body as T;
  }

  return {
    capabilities: (refresh = false) =>
      call<Record<string, unknown>>("/api/v1/capabilities", {
        method: refresh ? "POST" : "GET",
        timeoutMs: 30_000,
      }).then(normalizeCapabilities),

    ffmpeg: () => call<{ ffmpeg: Capabilities["ffmpeg"]; install: ToolInstall }>("/api/v1/ffmpeg", { timeoutMs: 30_000 }),

    installFfmpeg: () =>
      call<{ install: ToolInstall }>("/api/v1/ffmpeg", { method: "POST", timeoutMs: 30_000 }).then((body) => body.install),

    ytdlp: () => call<{ ytdlp: Capabilities["ytdlp"]; install: ToolInstall }>("/api/v1/ytdlp", { timeoutMs: 30_000 }),

    installYtdlp: () =>
      call<{ install: ToolInstall }>("/api/v1/ytdlp", { method: "POST", timeoutMs: 30_000 }).then((body) => body.install),

    // Longer than the service's own 90 s probe so its localised reason wins the race.
    probe: (url) => call<ProbeResult>("/api/v1/probe", { method: "POST", body: { url }, timeoutMs: 120_000 }),

    tasks: () => call<{ tasks: DownloadTask[] }>("/api/v1/tasks").then((body) => body.tasks),

    createTask: (input) => call<{ task: DownloadTask }>("/api/v1/tasks", { method: "POST", body: input }).then((body) => body.task),

    cancelTask: (id) => call<{ ok: boolean }>(`/api/v1/tasks/${id}/cancel`, { method: "POST" }).then(() => undefined),

    retryTask: (id) => call<{ task: DownloadTask }>(`/api/v1/tasks/${id}/retry`, { method: "POST" }).then((body) => body.task),

    removeTask: (id) => call<{ ok: boolean }>(`/api/v1/tasks/${id}`, { method: "DELETE" }).then(() => undefined),

    revealTask: (id) => call<{ ok: boolean }>(`/api/v1/tasks/${id}/reveal`, { method: "POST" }).then(() => undefined),

    settings: () => call<{ settings: ServiceSettings }>("/api/v1/settings").then((body) => body.settings),

    saveSettings: (patch) =>
      call<{ settings: ServiceSettings }>("/api/v1/settings", { method: "PUT", body: patch }).then((body) => body.settings),
  };
}
