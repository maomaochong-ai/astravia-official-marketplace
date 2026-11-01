import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ServiceError } from "../errors.js";
import { revealInFileManager } from "../fs/reveal.js";
import { callTool, MCP_TOOLS } from "../mcp/tool-catalog.js";
import { isHttpUrl, type ServiceContext } from "../service-context.js";
import type { ServiceSettings } from "../settings/settings-store.js";
import { SERVICE_VERSION } from "../version.js";
import { PreviewProxy } from "../preview/preview-proxy.js";

const BODY_LIMIT_BYTES = 1024 * 1024;


// The panel plays these routes from a different origin than the loopback service, and hls.js reads
// both the playlist and the segments with fetch, so every preview response has to be readable.
const PREVIEW_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "range",
  "access-control-expose-headers": "content-type, content-length, content-range, accept-ranges",
};
interface JsonBody {
  [key: string]: unknown;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = body === undefined ? "" : JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(payload);
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { error: { code, message } });
}

async function readJsonBody(request: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > BODY_LIMIT_BYTES) throw new Error("request body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expected a JSON object");
  return parsed as JsonBody;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Headers an extracted media address may carry; anything else is dropped before it reaches argv. */
const ALLOWED_TASK_HEADERS = new Set([
  "referer",
  "user-agent",
  "origin",
  "cookie",
  "accept",
  "x-requested-with",
]);

const MAX_HEADER_LENGTH = 2048;

export function asHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const name = rawName.trim().toLowerCase();
    if (!ALLOWED_TASK_HEADERS.has(name)) continue;
    const text = asString(rawValue).replace(/[\r\n]/gu, "");
    if (!text || text.length > MAX_HEADER_LENGTH) continue;
    headers[name] = text;
  }
  return headers;
}


function mcpEnvelope(id: unknown, result: unknown): unknown {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function mcpText(id: unknown, text: string, isError = false): unknown {
  return mcpEnvelope(id, { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) });
}

export function createRouter(context: ServiceContext) {
  // One proxy per service process: a preview session only lives as long as the player using it.
  const preview = new PreviewProxy();
  const server = createServer((request, response) => {
    void route(request, response).catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      if (error instanceof ServiceError) {
        sendError(response, error.status, error.code, error.message);
        return;
      }
      sendError(response, 500, "internal_error", error instanceof Error ? error.message : String(error));
    });
  });

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (method === "GET" && (path === "/health" || path === "/api/v1/health")) {
      sendJson(response, 200, {
        status: "ok",
        version: SERVICE_VERSION,
        capabilities: { ytdlp: context.ytdlp, ffmpeg: context.ffmpeg },
        directory: context.settings().downloadDirectory,
      });
      return;
    }

    if (path === "/api/v1/capabilities") {
      if (method === "GET") {
        sendJson(response, 200, { ytdlp: context.ytdlp, ffmpeg: context.ffmpeg });
        return;
      }
      if (method === "POST") {
        sendJson(response, 200, await context.refreshCapabilities());
        return;
      }
    }

    if (path === "/api/v1/ffmpeg") {
      if (method === "GET") {
        sendJson(response, 200, { ffmpeg: context.ffmpeg, install: context.ffmpegInstallState() });
        return;
      }
      if (method === "POST") {
        const install = context.startFfmpegInstall();
        sendJson(response, 202, { ffmpeg: context.ffmpeg, install });
        return;
      }
    }

    if (method === "GET" && path === "/api/v1/sites") {
      sendJson(response, 200, context.siteCoverage());
      return;
    }

    if (path === "/api/v1/ytdlp") {
      if (method === "GET") {
        sendJson(response, 200, { ytdlp: context.ytdlp, install: context.ytdlpInstallState() });
        return;
      }
      if (method === "POST") {
        const install = context.startYtdlpInstall();
        sendJson(response, 202, { ytdlp: context.ytdlp, install });
        return;
      }
    }

    if (method === "POST" && path === "/api/v1/probe") {
      const body = await readJsonBody(request);
      const target = asString(body.url);
      if (!isHttpUrl(target)) {
        sendError(response, 400, "invalid_url", "请输入以 http:// 或 https:// 开头的链接");
        return;
      }
      const result = await context.probe(target);
      sendJson(response, 200, result);
      return;
    }

    if (path === "/api/v1/tasks") {
      if (method === "GET") {
        sendJson(response, 200, { tasks: context.listTasks(), directory: context.settings().downloadDirectory });
        return;
      }
      if (method === "POST") {
        const body = await readJsonBody(request);
        const target = asString(body.url);
        const streamId = asString(body.streamId);
        if (!isHttpUrl(target)) {
          sendError(response, 400, "invalid_url", "请输入以 http:// 或 https:// 开头的链接");
          return;
        }
        if (!streamId) {
          sendError(response, 400, "invalid_format", "缺少清晰度标识，请先解析链接");
          return;
        }
        const directUrl = asString(body.directUrl);
        if (directUrl && !isHttpUrl(directUrl)) {
          sendError(response, 400, "invalid_url", "适配器给出的地址不是 http(s) 链接");
          return;
        }
        const task = context.createTask({
          url: target,
          site: asString(body.site),
          title: asString(body.title),
          streamId,
          directUrl,
          headers: asHeaders(body.headers),
          quality: asString(body.quality),
          ext: asString(body.ext) || "mp4",
          needsFfmpeg: body.needsFfmpeg === true,
          totalBytes: asNumber(body.totalBytes),
        });
        sendJson(response, 201, { task });
        return;
      }
    }

    const taskMatch = /^\/api\/v1\/tasks\/([^/]+)(\/[a-z]+)?$/u.exec(path);
    if (taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1] ?? "");
      const action = taskMatch[2] ?? "";
      const task = context.getTask(taskId);
      if (method === "GET" && !action) {
        if (!task) {
          sendError(response, 404, "not_found", "任务不存在");
          return;
        }
        sendJson(response, 200, { task });
        return;
      }
      if (method === "DELETE" && !action) {
        const removed = await context.removeTask(taskId);
        sendJson(response, removed ? 200 : 404, { removed });
        return;
      }
      if (method === "POST" && action === "/cancel") {
        const canceled = context.cancelTask(taskId);
        if (!canceled) {
          sendError(response, 409, "not_running", "该任务没有在运行");
          return;
        }
        sendJson(response, 200, { canceled });
        return;
      }
      if (method === "POST" && action === "/reveal") {
        if (!task) {
          sendError(response, 404, "not_found", "任务不存在");
          return;
        }
        const target = task.filePath ?? context.settings().downloadDirectory;
        const revealed = await revealInFileManager(target);
        sendJson(response, 200, { revealed });
        return;
      }
      if (method === "POST" && action === "/retry") {
        if (!task) {
          sendError(response, 404, "not_found", "任务不存在");
          return;
        }
        const retried = context.createTask({
          url: task.url,
          site: task.site,
          title: task.title,
          streamId: task.streamId,
          directUrl: task.directUrl,
          headers: task.headers,
          quality: task.quality,
          ext: task.ext,
          needsFfmpeg: task.needsFfmpeg,
          totalBytes: task.totalBytes,
        });
        sendJson(response, 201, { task: retried });
        return;
      }
    }

    if (path === "/api/v1/settings") {
      if (method === "GET") {
        sendJson(response, 200, { settings: context.settings() });
        return;
      }
      if (method === "PUT" || method === "POST") {
        const body = await readJsonBody(request);
        const patch: Record<string, unknown> = {};
        if (typeof body.downloadDirectory === "string") patch.downloadDirectory = body.downloadDirectory;
        if (body.maxConcurrent !== undefined) patch.maxConcurrent = asNumber(body.maxConcurrent);
        if (typeof body.cookie === "string") patch.cookie = body.cookie;
        if (typeof body.multiThread === "boolean") patch.multiThread = body.multiThread;
        if (typeof body.keepPartialFiles === "boolean") patch.keepPartialFiles = body.keepPartialFiles;
        if (typeof body.proxy === "string") patch.proxy = body.proxy;
        if (typeof body.proxyMode === "string") patch.proxyMode = body.proxyMode;
        if (typeof body.cookieBrowser === "string") patch.cookieBrowser = body.cookieBrowser;
        sendJson(response, 200, { settings: await context.updateSettings(patch) });
        return;
      }
    }

    if (method === "POST" && path === "/mcp") {
      const rpc = await readJsonBody(request);
      const id = rpc.id ?? null;
      if (rpc.method === "initialize") {
        sendJson(
          response,
          200,
          mcpEnvelope(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "video-downloader", version: SERVICE_VERSION },
          }),
        );
        return;
      }
      if (rpc.method === "tools/list") {
        sendJson(response, 200, mcpEnvelope(id, { tools: MCP_TOOLS }));
        return;
      }
      if (rpc.method === "tools/call") {
        const params = rpc.params as JsonBody | undefined;
        const name = asString(params?.name);
        const rawArguments = params?.arguments;
        const args = rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments) ? (rawArguments as JsonBody) : {};
        if (!name) {
          sendJson(response, 200, { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
          return;
        }
        try {
          const result = await callTool(name, args, {
            probe: (target) => context.probe(target),
            createTask: (input) => context.createTask(input),
            listTasks: () => context.listTasks(),
            getTask: (taskId) => context.getTask(taskId),
            cancelTask: (taskId) => context.cancelTask(taskId),
            settings: () => context.settings(),
            engineStatus: () => ({
              ytdlp: context.ytdlp,
              ytdlpInstall: context.ytdlpInstallState(),
              ffmpeg: context.ffmpeg,
              ffmpegInstall: context.ffmpegInstallState(),
            }),
            prepareEngine: () => context.provisionEngine(),
            describeSites: () => context.describeSites(),
          });
          sendJson(response, 200, mcpText(id, result.text, result.isError === true));
        } catch (error: unknown) {
          sendJson(response, 200, mcpText(id, error instanceof Error ? error.message : String(error), true));
        }
        return;
      }
      sendJson(response, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Unsupported MCP method" } });
      return;
    }

    if (method === "POST" && path === "/api/v1/preview/open") {
      const body = await readJsonBody(request);
      const target = asString(body.url);
      if (!isHttpUrl(target)) {
        sendError(response, 400, "invalid_url", "请输入以 http:// 或 https:// 开头的链接");
        return;
      }
      const opened = await preview.open(target, asHeaders(body.headers));
      sendJson(response, 201, { preview: opened });
      return;
    }

    const previewMatch = /^\/api\/v1\/preview\/([^/]+)(\/index\.m3u8|\/media)?$/u.exec(path);
    if (previewMatch && method === "OPTIONS") {
      response.writeHead(204, { ...PREVIEW_CORS, "access-control-max-age": "600" });
      response.end();
      return;
    }
    if (previewMatch) {
      const previewKey = decodeURIComponent(previewMatch[1] ?? "");
      const previewAction = previewMatch[2] ?? "";
      if (method === "GET" && previewAction === "/index.m3u8") {
        const playlist = await preview.playlist(previewKey);
        response.writeHead(200, {
          ...PREVIEW_CORS,
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "no-store",
        });
        response.end(playlist);
        return;
      }
      if (method === "GET" && previewAction === "/media") {
        // writeHead merges these with the passthrough headers the proxy sets; both are needed.
        for (const [name, value] of Object.entries(PREVIEW_CORS)) response.setHeader(name, value);
        await preview.proxyMedia(previewKey, url.searchParams.get("u") ?? "", request, response);
        return;
      }
      if (method === "DELETE" && !previewAction) {
        sendJson(response, 200, { closed: preview.close(previewKey) });
        return;
      }
    }

    sendError(response, 404, "not_found", "未知接口");
  }

  return {
    async listen(port: number): Promise<number> {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      const address = server.address() as AddressInfo | null;
      return address?.port ?? port;
    },
    async close(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
