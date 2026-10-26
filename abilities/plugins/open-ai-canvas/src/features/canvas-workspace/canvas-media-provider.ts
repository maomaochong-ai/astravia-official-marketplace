/**
 * 把画布里已经配好的图片/视频模型接进宿主的媒体 Provider（ADR-0013）。
 *
 * 这一层刻意不复制密钥：画布后端不向客户端下发渠道密钥（`ModelChannel.APIKey` 是
 * `json:"-"`），所以「抄密钥」这条路本来就只能是空清单。真正的交接面是模型目录
 * ——`GET /api/models` 按登录用户返回他有权的逻辑模型，插件把它登记成一个媒体
 * Provider：宿主选模型、插件持凭据、画布执行，密钥始终留在画布一侧。
 *
 * 只声明桥真的能跑完的模式：画布的任务输入要引用上传后的资源 id，而 shim 目前不转发
 * 上传，所以 `image-to-image` / `image-to-video` 这类需要参考图的模式不登记。声明了却
 * 跑不通比不声明更糟——宿主会把它当成可用模型推荐给用户。
 */
import type {
  PluginContext,
  PluginMediaCapability,
  PluginMediaErrorCode,
  PluginMediaGenerationMode,
  PluginMediaProviderArtifact,
  PluginMediaProviderJob,
  PluginMediaProviderSubmitRequest,
} from "@astravia-org/plugin-sdk";
import { bridgeAuthHeaders, BridgeError, bridgeRequest, serviceBaseUrl } from "./bridge-client";

export const CANVAS_MEDIA_PROVIDER_ID = "open-ai-canvas";
/** 桥当前能完整跑通的模式；其余模式在目录里可见但不可调用。 */
export const BRIDGED_MODES: PluginMediaGenerationMode[] = ["text-to-image", "text-to-video"];

/** 宿主模式 → 画布的 operation 名（`validateTaskType` 之外的另一半契约）。 */
const MODE_OPERATION: Partial<Record<PluginMediaGenerationMode, string>> = {
  "text-to-image": "text_to_image",
  "image-to-image": "image_to_image",
  "text-to-video": "text_to_video",
  "image-to-video": "image_to_video",
  "video-to-video": "video_to_video",
  "reference-to-video": "reference_to_video",
};

export interface CanvasCatalogEntry {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: "text" | "image" | "video" | "audio";
  operations: string[];
  available: boolean;
  resolutions: string[];
  videoSeconds: number[];
  aspectRatios: string[];
}

export interface CanvasCatalogView {
  models: CanvasCatalogEntry[];
  counts: { text: number; image: number; video: number; audio: number };
}

export interface CanvasMediaJobView {
  id: string;
  /** 画布任务类型（`canvas_image` / `canvas_video`），用来决定产物 kind。 */
  kind: string;
  status: string;
  progress: number;
  stage: string;
  error?: string;
  artifacts: Array<{ url: string; kind: string; resourceId?: string }>;
}

/** 一个模型能接哪几种宿主模式：只看它自己声明的 operation。 */
export function modesOf(model: CanvasCatalogEntry): PluginMediaGenerationMode[] {
  return BRIDGED_MODES.filter((mode) => model.operations.includes(MODE_OPERATION[mode] as string));
}

/**
 * 目录 → 媒体能力。
 *
 * 按 kind 分组成两条能力（image / video），每条把可调用模型列进 `models[]`；探测不到
 * operation 的模型不进能力表，但会作为 `unsupported` 报回界面，用户能看见「为什么少了」。
 */
export function buildMediaCapabilities(catalog: CanvasCatalogView): {
  capabilities: PluginMediaCapability[];
  supported: number;
  unsupported: CanvasCatalogEntry[];
} {
  const capabilities: PluginMediaCapability[] = [];
  const unsupported: CanvasCatalogEntry[] = [];
  let supported = 0;

  for (const kind of ["image", "video"] as const) {
    const group = catalog.models.filter((model) => model.kind === kind);
    if (group.length === 0) continue;

    const descriptors: NonNullable<Extract<PluginMediaCapability, { operation: "generate" }>["models"]>[number][] = [];
    const modes = new Set<PluginMediaGenerationMode>();
    const resolutions = new Set<string>();
    const aspectRatios = new Set<string>();
    const durations = new Set<number>();
    let defaultModelId: string | undefined;

    for (const model of group) {
      const modelModes = modesOf(model);
      if (modelModes.length === 0) {
        unsupported.push(model);
        continue;
      }
      supported += 1;
      for (const mode of modelModes) modes.add(mode);
      for (const value of model.resolutions) resolutions.add(value);
      for (const value of model.aspectRatios) aspectRatios.add(value);
      for (const value of model.videoSeconds) durations.add(value);
      if (!defaultModelId && model.available) defaultModelId = model.id;
      descriptors.push({
        id: model.id,
        displayName: model.name,
        modes: modelModes,
        ...(model.resolutions.length > 0 ? { resolutions: model.resolutions } : {}),
        ...(model.aspectRatios.length > 0 ? { aspectRatios: model.aspectRatios } : {}),
      });
    }

    if (descriptors.length === 0) continue;
    const sortedDurations = [...durations].sort((a, b) => a - b);
    capabilities.push({
      operation: "generate",
      kind,
      modes: [...modes],
      ...(resolutions.size > 0 ? { resolutions: [...resolutions] } : {}),
      ...(aspectRatios.size > 0 ? { aspectRatios: [...aspectRatios] } : {}),
      ...(kind === "video" && sortedDurations.length > 0 ? { durationsSeconds: sortedDurations } : {}),
      models: descriptors,
      defaultModelId: defaultModelId ?? descriptors[0].id,
    });
  }

  return { capabilities, supported, unsupported };
}

/**
 * 宿主只认 `PluginMediaErrorCode`；桥自己的错误码（token 缺失、画布没起、画布拒参数）
 * 在这里翻成宿主能理解的失败语义，别让宿主收到一个它不认识的 code。
 */
export function asMediaFailure(error: unknown): unknown {
  if (!(error instanceof BridgeError)) return error;
  switch (error.code) {
    case "bridge-token-missing":
    case "canvas-unreachable":
      return mediaError("provider-unavailable", error.message, true);
    case "canvas-login-required":
      return mediaError("unauthenticated", error.message);
    case "canvas-task-rejected":
      return mediaError("invalid-request", error.message);
    default:
      return mediaError("provider-failed", error.message);
  }
}

function failure(code: PluginMediaErrorCode, message: string, retryable = false) {
  return { code, message, retryable };
}

function mediaError(code: PluginMediaErrorCode, message: string, retryable = false) {
  const error = new Error(message) as Error & { code: PluginMediaErrorCode; retryable: boolean };
  error.code = code;
  error.retryable = retryable;
  return error;
}

export function readCanvasCatalog(ctx: PluginContext): Promise<CanvasCatalogView> {
  return bridgeRequest<CanvasCatalogView>(ctx, { path: "/bridge/canvas/models", method: "GET" });
}

function readCanvasMediaJob(ctx: PluginContext, taskId: string): Promise<CanvasMediaJobView> {
  return bridgeRequest<CanvasMediaJobView>(ctx, {
    path: `/bridge/canvas/tasks/${encodeURIComponent(taskId)}`,
    method: "GET",
  });
}

/** 画布状态 → 宿主作业状态；没见过的状态按运行中处理，不提前判死。 */
function jobStatusOf(status: string): PluginMediaProviderJob["status"] {
  switch (status) {
    case "succeeded":
    case "failed":
    case "cancelled":
      return status;
    case "queued":
      return "queued";
    default:
      return "running";
  }
}

/** 产物类型以模型的 kind 为准；画布自报的 previewKind 只在有明确线索时覆盖。 */
function artifactKindOf(modelKind: "image" | "video", artifact: { kind?: string } | undefined): "image" | "video" {
  const reported = artifact?.kind?.toLowerCase() ?? "";
  if (reported.includes("video") || /\.(mp4|webm|mov)(\?|$)/.test(reported)) return "video";
  if (reported.includes("image")) return "image";
  return modelKind;
}

async function jobFromTask(
  ctx: PluginContext,
  view: CanvasMediaJobView,
  modelKind: "image" | "video",
): Promise<PluginMediaProviderJob> {
  const baseUrl = await serviceBaseUrl(ctx);
  const status = jobStatusOf(view.status);
  const artifacts: PluginMediaProviderArtifact[] = [];
  for (const artifact of view.artifacts) {
    const local = artifact.url.startsWith("/bridge/");
    artifacts.push({
      kind: artifactKindOf(modelKind, artifact),
      source: {
        type: "remote-url",
        url: local ? `${baseUrl ?? ""}${artifact.url}` : artifact.url,
        // `/bridge/media/:id` 在桥的 Bearer 保护下；外链画布地址则不带我们的 token。
        ...(local ? { headers: await bridgeAuthHeaders(ctx) } : {}),
      },
    });
  }
  const progress = typeof view.progress === "number" ? (view.progress > 1 ? view.progress / 100 : view.progress) : undefined;
  return {
    id: view.id,
    status,
    ...(progress !== undefined ? { progress: Math.max(0, Math.min(1, progress)) } : {}),
    ...(artifacts.length > 0 ? { artifacts } : {}),
    ...(status === "failed"
      ? { error: failure("provider-failed", view.error ?? "canvas task failed", true) }
      : {}),
  };
}

/** 宿主请求 → 画布的任务参数：分辨率/比例/时长换成画布认的 canonical 名字。 */
export function taskOptionsOf(
  kind: "image" | "video",
  request: { resolution?: string; aspectRatio?: string; durationSeconds?: number },
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (request.aspectRatio) options.size = request.aspectRatio;
  if (request.resolution) {
    if (kind === "video") options.vquality = request.resolution;
    else options.quality = request.resolution;
  }
  if (kind === "video" && typeof request.durationSeconds === "number" && request.durationSeconds > 0) {
    options.videoSeconds = String(Math.round(request.durationSeconds));
  }
  return options;
}

export interface RegisterCanvasMediaResult {
  supported: number;
  unsupported: number;
  counts: CanvasCatalogView["counts"];
}

/**
 * 显式注册（由面板按钮触发，不在插件加载时静默发生）。
 *
 * `ctx.media.registerProvider` 返回 Disposable：调用方在重新注册前必须 dispose，否则
 * 重复点击会在宿主侧留下多份同名 Provider。
 */
export async function registerCanvasMediaProvider(
  ctx: PluginContext,
): Promise<{ result: RegisterCanvasMediaResult; dispose: () => void; view: CanvasCatalogView }> {
  const view = await readCanvasCatalog(ctx);
  const { capabilities, supported, unsupported } = buildMediaCapabilities(view);
  if (capabilities.length === 0) {
    throw new BridgeError("no-media-models", "the canvas has no bridged image/video model");
  }

  const byId = new Map(view.models.map((model) => [model.id, model]));
  const defaultModelOf = (kind: "image" | "video") => {
    const capability = capabilities.find((item) => item.operation === "generate" && item.kind === kind);
    return capability?.operation === "generate" ? capability.defaultModelId : undefined;
  };

  const registration = ctx.media.registerProvider({
    id: CANVAS_MEDIA_PROVIDER_ID,
    displayName: "Open AI Canvas",
    capabilities,
    async submit(request: PluginMediaProviderSubmitRequest): Promise<PluginMediaProviderJob> {
      if (request.operation !== "generate") {
        throw mediaError("operation-unsupported", `canvas bridge does not expose ${request.operation}`);
      }
      const kind = request.kind;
      const modelId = request.modelId || defaultModelOf(kind);
      const model = modelId ? byId.get(modelId) : undefined;
      if (!modelId || !model) throw mediaError("invalid-request", `unknown canvas model ${modelId ?? "(none)"}`);
      const operation = MODE_OPERATION[request.mode];
      if (!operation || !model.operations.includes(operation)) {
        throw mediaError("operation-unsupported", `${model.name} does not declare ${request.mode}`);
      }
      if (request.inputs && request.inputs.length > 0) {
        throw mediaError("operation-unsupported", "reference images are not bridged yet");
      }
      try {
        const created = await bridgeRequest<{ id?: string }>(ctx, {
          path: "/bridge/canvas/tasks",
          method: "POST",
          body: {
            logicalModelId: modelId,
            kind,
            operation,
            prompt: request.prompt,
            options: taskOptionsOf(kind, request),
          },
        });
        if (!created?.id) throw mediaError("provider-failed", "canvas did not return a task id");
        return { id: created.id, status: "queued" };
      } catch (error) {
        throw asMediaFailure(error);
      }
    },
    async getJob(jobId: string): Promise<PluginMediaProviderJob> {
      try {
        const view = await readCanvasMediaJob(ctx, jobId);
        return await jobFromTask(ctx, view, view.kind === "video" ? "video" : "image");
      } catch (error) {
        throw asMediaFailure(error);
      }
    },
  });

  return {
    result: { supported, unsupported: unsupported.length, counts: view.counts },
    dispose: () => registration.dispose(),
    view,
  };
}
