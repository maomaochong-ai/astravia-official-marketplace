/**
 * 画布模型目录与任务适配（ADR-0013）。
 *
 * 真源是画布的 `GET /api/models`（`app.PublicLogicalModel`）：它按登录用户返回
 * 「画布里已经配好的模型」，每条带 `capability`、`capabilitySpec.operations` 与
 * `priceTiers[].selector`。渠道表 `/api/admin/channels` 是 system 作用域，
 * 用户自建渠道既读不到、密钥也永远不下发（`ModelChannel.APIKey` 是 `json:"-"`），
 * 所以「把画布渠道连密钥抄进宿主」在这条路径上不可能成立。
 *
 * 这里只做三件事：读目录、建任务、读任务结果。媒体产物不直接外链画布地址：
 * 画布的 `/api/resources/:id/file` 需要会话 Cookie，宿主读不到；改由 shim 的
 * `/bridge/media/:id` 带着会话转发，宿主拿到的是一条本地可读的 URL。
 */
import http from "node:http";
import { goPort } from "./backend-process.ts";
import { SESSION_TOKEN } from "./canvas-session-store.ts";
import { rawCanvasApi } from "./mcp-protocol-server.ts";

export type CanvasModelKind = "text" | "image" | "video" | "audio";

const KINDS: CanvasModelKind[] = ["text", "image", "video", "audio"];
/** 画布把比例写在 `size` 里，形如 `16:9`；像素尺寸与 `auto` 不算比例。 */
const RATIO = /^\d+\s*:\s*\d+$/;

/** 画布任务类型：`validateTaskType` 只接受这四种 canvas_* 分支。 */
const TASK_TYPE: Record<CanvasModelKind, string> = {
  text: "canvas_text",
  image: "canvas_image",
  video: "canvas_video",
  audio: "canvas_audio",
};

export interface CanvasCatalogModel {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: CanvasModelKind;
  /** 画布能力声明的操作名，例如 `text_to_image` / `image_to_video`。 */
  operations: string[];
  /** 路由可用性：目录会说谎，但这是画布自己给出的唯一提示。 */
  available: boolean;
  resolutions: string[];
  videoSeconds: number[];
  aspectRatios: string[];
}

export interface CanvasCatalog {
  models: CanvasCatalogModel[];
  counts: Record<CanvasModelKind, number>;
}

export interface CanvasTaskArtifact {
  /** 画布资源 id；shim 用它换本地可读的 `/bridge/media/<id>`。 */
  resourceId?: string;
  /** 相对 `PUBLIC_ORIGIN` 或绝对 http(s) 的取件地址。 */
  url: string;
  kind: string;
}

export interface CanvasTaskView {
  id: string;
  /** `canvas_image` / `canvas_video` …；任务体自己不说明产物类型，只有这个字段说明。 */
  kind: string;
  status: string;
  progress: number;
  stage: string;
  error?: string;
  artifacts: CanvasTaskArtifact[];
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["data", "items", "models", "list"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function numberList(value: unknown): number[] {
  return asArray(value)
    .map((item) => (typeof item === "number" ? item : Number(text(item))))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function kindOf(raw: Record<string, unknown>): CanvasModelKind | null {
  const capability = text(raw.capability).toLowerCase();
  if (capability === "chat") return "text";
  return KINDS.includes(capability as CanvasModelKind) ? (capability as CanvasModelKind) : null;
}

/** 规格选项只从服务端已经声明的 `option.values` 与价格档选择器里取，不猜。 */
function optionValues(spec: Record<string, unknown>, name: string): string[] {
  const options = asRecord(spec.options);
  return stringList(asRecord(options[name]).values);
}

export function normalizeCanvasCatalog(raw: unknown): CanvasCatalog {
  const models: CanvasCatalogModel[] = [];
  for (const entry of asArray(raw)) {
    const record = asRecord(entry);
    const id = text(record.id);
    const kind = kindOf(record);
    if (!id || !kind) continue;

    const spec = asRecord(record.capabilitySpec);
    const profiles = asArray(record.capabilityProfiles).map(asRecord);
    const operations = uniq([...stringList(spec.operations), ...profiles.flatMap((profile) => stringList(profile.operations))]);

    const tiers = asArray(record.priceTiers).map(asRecord);
    const selectors = tiers.map((tier) => asRecord(tier.selector));
    // 画布把图片分辨率叫 quality、视频分辨率叫 vquality，比例与尺寸都塞在 size 里
    // （canonicalCapabilityOptionName 的结果），时长叫 videoSeconds。
    const resolutions = uniq([
      ...selectors.flatMap((selector) => [
        text(selector.quality),
        text(selector.vquality),
        text(selector.imageResolution),
        text(selector.resolution),
      ]),
      ...optionValues(spec, "quality"),
      ...optionValues(spec, "vquality"),
      ...optionValues(spec, "imageResolution"),
    ]).filter((value) => value && value !== "auto" && value !== "any");
    const aspectRatios = uniq([
      ...selectors.map((selector) => text(selector.aspectRatio)),
      ...selectors.map((selector) => text(selector.size)),
      ...optionValues(spec, "aspectRatio"),
      ...optionValues(spec, "size"),
    ]).filter((value) => RATIO.test(value));
    const videoSeconds = uniq([
      ...tiers.map((tier) => (typeof tier.videoSeconds === "number" ? tier.videoSeconds : Number(text(tier.videoSeconds)))),
      ...selectors.map((selector) => Number(text(selector.videoSeconds))),
      ...numberList(asRecord(asRecord(spec.options).videoSeconds).values),
    ])
      .filter((seconds) => Number.isFinite(seconds) && seconds > 0)
      .sort((a, b) => a - b);

    models.push({
      id,
      code: text(record.code) || id,
      name: text(record.name) || text(record.code) || id,
      description: text(record.description),
      kind,
      operations,
      available: record.available === true,
      resolutions,
      videoSeconds,
      aspectRatios,
    });
  }
  models.sort((a, b) => a.name.localeCompare(b.name));

  const counts: Record<CanvasModelKind, number> = { text: 0, image: 0, video: 0, audio: 0 };
  for (const model of models) counts[model.kind] += 1;
  return { models, counts };
}

export async function readCanvasCatalog(): Promise<{ status: number; body: any }> {
  const result = await rawCanvasApi("GET", "/api/models");
  if (result.status !== 200) return result;
  return { status: 200, body: normalizeCanvasCatalog(result.body) };
}

export interface CanvasTaskRequest {
  logicalModelId: string;
  kind: CanvasModelKind;
  operation: string;
  prompt: string;
  options?: Record<string, unknown>;
  projectId?: string;
}

/**
 * 任务体的形状跟着画布自己的 admission 走：
 * `resolveTaskModelSelection` 在前台模型模式下要求 `logicalModelId`，
 * `ModelRequestIntentFromTaskInput` 从 `input.mode` 取能力、从 `input.config` 取创作参数。
 */
export function buildCanvasTaskBody(request: CanvasTaskRequest): Record<string, unknown> {
  const options = request.options && typeof request.options === "object" ? request.options : {};
  const body: Record<string, unknown> = {
    type: TASK_TYPE[request.kind],
    operation: request.operation,
    prompt: request.prompt,
    logicalModelId: request.logicalModelId,
    input: { mode: request.kind, prompt: request.prompt, config: options },
  };
  if (request.projectId) body.projectId = request.projectId;
  return body;
}

export async function createCanvasTask(request: CanvasTaskRequest): Promise<{ status: number; body: any }> {
  const result = await rawCanvasApi("POST", "/api/tasks", buildCanvasTaskBody(request));
  return result;
}

const RESOURCE_FILE = /^\/api\/resources\/([^/]+)\/file/;

/** 把画布的任务输出压成宿主媒体 Provider 能消费的形状。 */
export function normalizeCanvasTask(raw: unknown): CanvasTaskView {
  const record = asRecord(raw);
  const task = asRecord(record.data) && Object.keys(asRecord(record.data)).length > 0 ? asRecord(record.data) : record;
  const previewUrl = text(task.previewUrl) || text(task.previewURL);
  const previewKind = text(task.previewKind) || "image";
  const artifacts: CanvasTaskArtifact[] = [];
  if (previewUrl) {
    const match = previewUrl.match(RESOURCE_FILE);
    if (match) {
      artifacts.push({ resourceId: match[1], url: `/bridge/media/${match[1]}`, kind: previewKind });
    } else if (/^https?:\/\//.test(previewUrl)) {
      artifacts.push({ url: previewUrl, kind: previewKind });
    }
  }
  const progress = typeof task.progress === "number" ? task.progress : Number(text(task.progress)) || 0;
  return {
    id: text(task.id),
    kind: text(task.type).replace(/^canvas_/, ""),
    status: text(task.status).toLowerCase(),
    progress: Number.isFinite(progress) ? progress : 0,
    stage: text(task.stage),
    ...(text(task.error) ? { error: text(task.error) } : {}),
    artifacts,
  };
}

export async function readCanvasTask(taskId: string): Promise<{ status: number; body: any }> {
  const result = await rawCanvasApi("GET", `/api/tasks/${encodeURIComponent(taskId)}`);
  if (result.status !== 200) return result;
  return { status: 200, body: normalizeCanvasTask(result.body) };
}

/**
 * 把画布资源转给宿主。
 *
 * 画布的文件端点在会话保护下，宿主的主进程没有那个 Cookie，所以这里用自己的会话取流
 * 再原样转发；不签发外链、不把 Cookie 交出去。
 */
export function streamCanvasResource(resourceId: string, res: any): void {
  if (!SESSION_TOKEN || !goPort) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Canvas is not ready", code: "canvas-unreachable" } }));
    return;
  }
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: goPort,
      path: `/api/resources/${encodeURIComponent(resourceId)}/file`,
      method: "GET",
      headers: { Cookie: `open_ai_canvas_session=${SESSION_TOKEN}` },
    },
    (source) => {
      const headers: Record<string, string> = { "Content-Type": source.headers["content-type"] || "application/octet-stream" };
      for (const key of ["content-length", "etag", "last-modified"] as const) {
        const value = source.headers[key];
        if (typeof value === "string") headers[key] = value;
      }
      res.writeHead(source.statusCode || 502, headers);
      source.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Canvas resource unavailable", code: "canvas-unreachable" } }));
  });
  res.on("close", () => upstream.destroy());
  upstream.end();
}
