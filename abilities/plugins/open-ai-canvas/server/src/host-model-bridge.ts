/**
 * 宿主智能体 ↔ 画布的作业通道
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./service-config.ts";
import { bridgeAdminChannels } from "./mcp-protocol-server.ts";
import {
  createCanvasTask,
  readCanvasCatalog,
  readCanvasTask,
  streamCanvasResource,
  type CanvasModelKind,
} from "./canvas-catalog.ts";
import { sendJson } from "./service-routes.ts";

export const BRIDGE_FILE = path.join(DATA_DIR, "bridge.json");
export const BRIDGE_JOB_TTL_MS = 5 * 60_000;
export const BRIDGE_IDLE_MS = 180_000;
export const BRIDGE_LONGPOLL_MS = 25_000;
export const BRIDGE_EXECUTOR_STALE_MS = 45_000;

export function loadBridgeState() {
  try {
    return JSON.parse(fs.readFileSync(BRIDGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveBridgeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

// token 只存在本机数据目录，画布渠道里那一份是它自己的渠道密钥，两边不共用。
export function bridgeToken() {
  const state = loadBridgeState();
  if (typeof state.token === "string" && state.token.length >= 32) return state.token;
  const token = crypto.randomBytes(24).toString("hex");
  saveBridgeState({ ...state, token, createdAt: new Date().toISOString() });
  return token;
}

/**
 * 一条桥接任务：画布发起的补全请求在这里排队，插件视图里的执行者长轮询取走之后回填。
 */
export type BridgeJob = {
  id: string;
  createdAt: number;
  created: number;
  model: any;
  messages: any[];
  temperature: any;
  max_tokens: any;
  stream: boolean;
  text: string;
  headersSent: boolean;
  finished: boolean;
  assigned: boolean;
  res: any;
  idleTimer?: any;
  [key: string]: any;
};

export const BRIDGE = {
  models: [],
  modelsAt: 0,
  lastPollAt: 0,
  jobs: new Map(),
  waiters: [],
};

// 「执行者在线」= 最近一次长轮询还在窗口内。插件视图被关掉时它会自然过期，
// 于是画布拿到的是明确的 503 而不是无限等下去。
export function bridgeExecutorOnline() {
  return BRIDGE.lastPollAt > 0 && Date.now() - BRIDGE.lastPollAt < BRIDGE_EXECUTOR_STALE_MS;
}

export function bridgeJson(res, status, body) {
  sendJson(res, body, status);
}

export function bridgeUnauthorized(res) {
  res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
  res.end(JSON.stringify({ error: { message: "Invalid bridge token", code: "bridge-unauthorized" } }));
}

export function bridgeAuthorized(req) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === bridgeToken();
}

// 返回 any：请求体是外部输入，字段形状由调用点各自校验（不在这里造假类型）。
export function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4 * 1024 * 1024) reject(new Error("request body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function sweepBridgeJobs() {
  const now = Date.now();
  for (const [id, job] of BRIDGE.jobs) {
    if (now - job.createdAt < BRIDGE_JOB_TTL_MS) continue;
    job.finished = true;
    BRIDGE.jobs.delete(id);
    try {
      job.res.destroy();
    } catch {}
  }
}

/** 把一条排队中的 chat 请求转成 SSE；首次写之前不锁状态码，错能报成 502。 */
export function bridgeWriteChunk(job, delta) {
  if (job.finished) return;
  if (!job.headersSent) {
    job.res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    job.headersSent = true;
  }
  job.text += delta;
  job.res.write(
    `data: ${JSON.stringify({
      id: job.id,
      object: "chat.completion.chunk",
      created: job.created,
      model: job.model || "astravia-host",
      choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
    })}\n\n`,
  );
}

export function bridgeFinishJob(job, error) {
  if (job.finished) return;
  job.finished = true;
  BRIDGE.jobs.delete(job.id);
  clearTimeout(job.idleTimer);
  if (error) {
    if (!job.headersSent) {
      bridgeJson(job.res, 502, {
        error: { message: error.message || String(error), code: error.code || "bridge-executor-error" },
      });
      return;
    }
    job.res.write(
      `data: ${JSON.stringify({ error: { message: error.message || String(error), code: error.code || "bridge-executor-error" } })}\n\n`,
    );
    job.res.write("data: [DONE]\n\n");
    job.res.end();
    return;
  }

  if (job.stream) {
    if (!job.headersSent) {
      job.res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" });
      job.headersSent = true;
    }
    job.res.write(
      `data: ${JSON.stringify({
        id: job.id,
        object: "chat.completion.chunk",
        created: job.created,
        model: job.model || "astravia-host",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`,
    );
    job.res.write("data: [DONE]\n\n");
    job.res.end();
    return;
  }

  bridgeJson(job.res, 200, {
    id: job.id,
    object: "chat.completion",
    created: Math.floor(job.created / 1000),
    model: job.model || "astravia-host",
    choices: [{ index: 0, message: { role: "assistant", content: job.text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

/** 给最近一条长轮询立刻回话；没有挂在里面的请求就只能等下一次轮询。 */
export function bridgeWakeWaiter() {
  const waiter = BRIDGE.waiters.shift();
  if (!waiter) return;
  clearTimeout(waiter.timer);
  const jobs = [...BRIDGE.jobs.values()].filter((job) => !job.assigned).slice(0, 4);
  for (const job of jobs) job.assigned = true;
  bridgeJson(waiter.res, 200, { jobs: jobs.map(bridgeJobEnvelope) });
}

export function bridgeJobEnvelope(job) {
  return {
    id: job.id,
    kind: "chat",
    stream: job.stream,
    model: job.model,
    messages: job.messages,
    ...(job.temperature !== undefined && { temperature: job.temperature }),
    ...(job.max_tokens !== undefined && { max_tokens: job.max_tokens }),
  };
}

export function bridgeCollectJobs(res) {
  const jobs = [...BRIDGE.jobs.values()].filter((job) => !job.assigned).slice(0, 4);
  for (const job of jobs) job.assigned = true;
  bridgeJson(res, 200, { jobs: jobs.map(bridgeJobEnvelope) });
}

export function bridgeServeModels(res) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Bridge-Executor": bridgeExecutorOnline() ? "online" : "offline",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(
    JSON.stringify({
      object: "list",
      data: BRIDGE.models.map((model) => ({ id: model.id, object: "model", owned_by: "astravia" })),
    }),
  );
}

export function bridgeServeChat(req, res) {
  void readJsonBody(req)
    .then((body) => {
      if (!bridgeExecutorOnline()) {
        // 明确告诉画布「执行者不在」，别让它把这当成模型推理失败。
        bridgeJson(res, 503, {
          error: {
            message:
              "Astravia is not currently relaying model calls. Open the Open AI Canvas view in Astravia and try again.",
            code: "bridge-executor-offline",
          },
        });
        return;
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) {
        bridgeJson(res, 400, { error: { message: "messages is required", code: "bridge-bad-request" } });
        return;
      }
      // 视觉输入没有接口可用：`ctx.ai` 的请求体只接受文本。画布带图过来时直接告知
      // 不支持，不默默截断——截断后模型会以为自己看过了图。
      if (messages.some((message) => Array.isArray(message?.content))) {
        bridgeJson(res, 422, {
          error: {
            message:
              "Image input is not bridged: the host text API accepts text only. Remove the image parts or configure a vision channel inside the canvas.",
            code: "bridge-vision-unsupported",
          },
        });
        return;
      }
      sweepBridgeJobs();
      // idleTimer 是运行期挂上去的看门狗句柄，不在字面量里，所以单独声明形状。
      const job: BridgeJob = {
        id: `job_${crypto.randomUUID()}`,
        createdAt: Date.now(),
        created: Date.now(),
        model: body.model,
        messages,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        stream: body.stream !== false,
        text: "",
        headersSent: false,
        finished: false,
        assigned: false,
        res,
      };
      job.idleTimer = setTimeout(() => {
        bridgeFinishJob(job, Object.assign(new Error("Bridge job timed out"), { code: "bridge-timeout" }));
      }, BRIDGE_IDLE_MS);
      job.idleTimer.unref?.();
      BRIDGE.jobs.set(job.id, job);
      // 画布那头断开了就丢掉这条任务，不要让插件运行时去跑一个没人听的结果。
      req.on("close", () => {
        if (!job.finished) {
          job.finished = true;
          BRIDGE.jobs.delete(job.id);
          clearTimeout(job.idleTimer);
        }
      });
      bridgeWakeWaiter();
    })
    .catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
}

/** 媒体：宿主不开放密钥级生成接口，只能回一个可读的 501（ADR-0006 决策 4）。 */
export function bridgeServeMedia(res) {
  bridgeJson(res, 501, {
    error: {
      message:
      "Text is bridged to Astravia. Image and video generation are not: the host does not expose " +
        "key-level media generation to plugins. Configure an image/video channel inside the canvas instead.",
      code: "host-media-not-exposed",
    },
  });
}

/**
 * 画布侧失败码的统一出口（ADR-0013）。
 *
 * 画布把「没登录」「后端没起」「参数被拒」放在不同状态码上，插件侧不该靠猜状态码分支，
 * 所以这里压成四个稳定 code：会话失效、连不上、上游拒绝、任务不存在。
 */
export function bridgeCanvasFailure(res, status, body) {
  const canvasMessage =
    (body && (body.msg || body.message || body.error?.message)) || `Canvas returned ${status}`;
  if (status === 401) {
    bridgeJson(res, 401, { error: { message: "Canvas session expired. Log in to the canvas again.", code: "canvas-login-required" } });
    return;
  }
  if (status === 502) {
    bridgeJson(res, 502, { error: { message: String(canvasMessage), code: "canvas-unreachable" } });
    return;
  }
  if (status === 404) {
    bridgeJson(res, 404, { error: { message: String(canvasMessage), code: "canvas-task-missing" } });
    return;
  }
  bridgeJson(res, 422, { error: { message: String(canvasMessage), code: "canvas-task-rejected" } });
}

const CANVAS_KINDS: CanvasModelKind[] = ["text", "image", "video", "audio"];

/**
 * `POST /bridge/canvas/tasks` 的入参校验；语义判定（能力/参数是否支持）留给画布。
 *
 * 用可选字段而不是 `ok` 判别式：server 的 tsconfig 是 `strict: false`，没有
 * strictNullChecks 时布尔字面量判别式不参与收窄，`if (!checked.ok)` 拿不到 `message`。
 */
function readCanvasTaskRequest(body: any): { request?: any; message?: string } {
  const logicalModelId = typeof body?.logicalModelId === "string" ? body.logicalModelId.trim() : "";
  const kind = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "";
  const operation = typeof body?.operation === "string" ? body.operation.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!logicalModelId) return { message: "logicalModelId is required" };
  if (!prompt) return { message: "prompt is required" };
  if (!CANVAS_KINDS.includes(kind as CanvasModelKind)) return { message: `Unsupported kind ${kind}` };
  if (!operation) return { message: "operation is required" };
  const options = body?.options && typeof body.options === "object" && !Array.isArray(body.options) ? body.options : {};
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  return {
    request: { logicalModelId, kind: kind as CanvasModelKind, operation, prompt, options, ...(projectId ? { projectId } : {}) },
  };
}

/** 桥的全部分流。返回 true 表示这个请求已经处理完。 */
export function serveBridge(req, res, pathname) {
  if (!pathname.startsWith("/bridge/")) return false;

  // 模型清单是唯一允许匿名读的：画布加载渠道时会先探测，而探测失败会被显示成
  // 「渠道不可用」，比把这个端点锁起来更难排查。它只含模型 id，不含密钥。
  if (req.method === "GET" && pathname === "/bridge/v1/models") {
    bridgeServeModels(res);
    return true;
  }

  if (!bridgeAuthorized(req)) {
    bridgeUnauthorized(res);
    return true;
  }

  if (req.method === "POST" && pathname === "/bridge/v1/chat/completions") {
    bridgeServeChat(req, res);
    return true;
  }
  if (req.method === "POST" && /^\/bridge\/v1\/(images|videos)\/generations$/.test(pathname)) {
    bridgeServeMedia(res);
    return true;
  }

  // --- 以下给插件运行时用 ---
  if (req.method === "GET" && pathname === "/bridge/jobs") {
    BRIDGE.lastPollAt = Date.now();
    const hasPending = [...BRIDGE.jobs.values()].some((job) => !job.assigned);
    if (hasPending) {
      bridgeCollectJobs(res);
      return true;
    }
    const waiter = { res, timer: null };
    waiter.timer = setTimeout(() => {
      const index = BRIDGE.waiters.indexOf(waiter);
      if (index >= 0) BRIDGE.waiters.splice(index, 1);
      bridgeJson(res, 200, { jobs: [] });
    }, BRIDGE_LONGPOLL_MS);
    waiter.timer.unref?.();
    BRIDGE.waiters.push(waiter);
    req.on("close", () => {
      const index = BRIDGE.waiters.indexOf(waiter);
      if (index >= 0) BRIDGE.waiters.splice(index, 1);
      clearTimeout(waiter.timer);
    });
    return true;
  }

  const chunkMatch = pathname.match(/^\/bridge\/jobs\/([^/]+)\/(chunk|done)$/);
  if (req.method === "POST" && chunkMatch) {
    const [, jobId, action] = chunkMatch;
    const job = BRIDGE.jobs.get(jobId);
    if (!job) {
      bridgeJson(res, 404, { error: { message: "Unknown job", code: "bridge-job-missing" } });
      return true;
    }
    void readJsonBody(req)
      .then((body) => {
        if (action === "chunk") {
          if (typeof body.delta === "string" && body.delta.length > 0) bridgeWriteChunk(job, body.delta);
        } else {
          const error = body.error ? Object.assign(new Error(body.error), { code: "bridge-executor-error" }) : null;
          bridgeFinishJob(job, error);
        }
        bridgeJson(res, 200, { ok: true });
      })
      .catch((err) => bridgeJson(res, 400, { error: { message: err.message } }));
    return true;
  }

  if (req.method === "POST" && pathname === "/bridge/models") {
    void readJsonBody(req)
      .then((body) => {
        const models = Array.isArray(body.models) ? body.models : [];
        BRIDGE.models = models.filter((model) => model && typeof model.id === "string");
        BRIDGE.modelsAt = Date.now();
        bridgeJson(res, 200, { ok: true, count: BRIDGE.models.length });
      })
      .catch((err) => bridgeJson(res, 400, { error: { message: err.message } }));
    return true;
  }

  if (req.method === "GET" && pathname === "/bridge/status") {
    bridgeJson(res, 200, {
      executorOnline: bridgeExecutorOnline(),
      models: BRIDGE.models.length,
      pending: BRIDGE.jobs.size,
      tokenConfigured: Boolean(loadBridgeState().token),
    });
    return true;
  }

  // --- 以下给插件运行时管理画布渠道用（ADR-0006 决策 2）---
  if (req.method === "GET" && pathname === "/bridge/admin/channels") {
    void bridgeAdminChannels("GET", null, null).then((result) => bridgeJson(res, result.status, result.body));
    return true;
  }
  if (req.method === "POST" && pathname === "/bridge/admin/channels") {
    void readJsonBody(req)
      .then((body) => bridgeAdminChannels("POST", null, body))
      .then((result) => bridgeJson(res, result.status, result.body))
      .catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
    return true;
  }
  const adminChannelMatch = pathname.match(/^\/bridge\/admin\/channels\/([^/]+)$/);
  if (req.method === "PATCH" && adminChannelMatch) {
    void readJsonBody(req)
      .then((body) => bridgeAdminChannels("PATCH", adminChannelMatch[1], body))
      .then((result) => bridgeJson(res, result.status, result.body))
      .catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
    return true;
  }

  // --- 以下给画布模型目录与媒体任务用（ADR-0013）---
  if (req.method === "GET" && pathname === "/bridge/canvas/models") {
    void readCanvasCatalog().then((result) => {
      if (result.status !== 200) {
        bridgeCanvasFailure(res, result.status, result.body);
        return;
      }
      bridgeJson(res, 200, result.body);
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/bridge/canvas/tasks") {
    void readJsonBody(req)
      .then((body) => {
        const checked = readCanvasTaskRequest(body);
        if (!checked.request) {
          bridgeJson(res, 400, { error: { message: checked.message ?? "bad request", code: "bridge-bad-request" } });
          return;
        }
        return createCanvasTask(checked.request).then((result) => {
          if (result.status < 200 || result.status >= 300) {
            bridgeCanvasFailure(res, result.status, result.body);
            return;
          }
          bridgeJson(res, 200, result.body);
        });
      })
      .catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
    return true;
  }

  const canvasTaskMatch = pathname.match(/^\/bridge\/canvas\/tasks\/([^/]+)$/);
  if (req.method === "GET" && canvasTaskMatch) {
    void readCanvasTask(canvasTaskMatch[1]).then((result) => {
      if (result.status !== 200) {
        bridgeCanvasFailure(res, result.status, result.body);
        return;
      }
      bridgeJson(res, 200, result.body);
    });
    return true;
  }

  // 画布资源取件：宿主主进程没有画布会话 Cookie，所以由 shim 带着会话转发。
  const mediaMatch = pathname.match(/^\/bridge\/media\/([^/]+)$/);
  if (req.method === "GET" && mediaMatch) {
    streamCanvasResource(decodeURIComponent(mediaMatch[1]), res);
    return true;
  }

  bridgeJson(res, 404, { error: { message: `Unknown bridge route ${pathname}`, code: "bridge-not-found" } });
  return true;
}

// --- 前端产物承载（ADR-0008）---
// 为什么静态文件由 shim 发，而不是交给后端：构建农场钉的是上游发布 tag，而那些 tag 的
// NoRoute 只有 SystemProxyNoRouteHandler——任何非 /api 路径都回 404「请求不存在」
// （backend/internal/handler/auth.go 的 fail 信封）。载荷里的 web-dist 于是没人服务，
// 宿主的健康门照样通过，用户点开画布只看见一段 404 JSON。
//
// 在 shim 里补这一层是成本最低的正确位置：它本来就把载荷解到本地、本来就站在对外端口上、
// 且与平台无关。换成让后端支持 CANVAS_STATIC_DIR，就得把载荷重新钉到一个 fork 分支并重发
// 五个平台各约 200 MB，还丢掉「跟随上游 tag」这条自动化。
