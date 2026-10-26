#!/usr/bin/env node
/**
 * 验证 ADR-0013 的两半：桥的新路由，与目录/任务的归一化。
 *
 * 第一半起真的 `server/boot.mjs`。清单只声明 linux-x64，所以它确定地停在
 * 「平台无运行时」；`rawCanvasApi` 因此永远拿不到 Go 后端，能断言的正是真实失败码
 * （`canvas-login-required` / `canvas-unreachable` / `bridge-bad-request`）。这不是
 * 妥协——这几条正是画布没启动时用户会看到的东西。
 *
 * 第二半把 `canvas-catalog.ts` 与 `canvas-media-provider.ts` 用 esbuild 打成临时 .mjs
 * 再 import，直接测纯函数：目录归一化、任务体构造、产物 URL 改写、能力表生成、参数映射。
 * 用 esbuild 而不是 `--experimental-strip-types`：esbuild 本来就在 devDependencies 里，
 * 且显式 .ts 后缀的 import 需要它来解析。
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 20_000;

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(predicate, label, timeoutMs = TIMEOUT_MS) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`timeout waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

/** 起 shim：清单里没有本机平台，准备阶段立刻失败，HTTP 代理照样监听。 */
async function startShim() {
  const dir = mkdtempSync(join(tmpdir(), "verify-canvas-catalog-"));
  const dataDir = join(dir, "data");
  mkdirSync(dataDir, { recursive: true });
  const manifestPath = join(dir, "payload-manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        payloadVersion: "verify-canvas-catalog",
        upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0", commit: "0".repeat(40) },
        platforms: {
          "linux-x64": {
            payload: { file: "payload-verify-linux-x64.zip", sha256: "0".repeat(64), bytes: 1 },
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  const port = await freePort();
  const child = spawn(process.execPath, [join(ROOT, "server", "boot.mjs")], {
    env: {
      ...process.env,
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: dataDir,
      CANVAS_PAYLOAD_MANIFEST: manifestPath,
      CANVAS_PAYLOAD_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => log.push(chunk));
  child.stderr.on("data", (chunk) => log.push(chunk));

  const base = `http://127.0.0.1:${port}`;
  const state = await waitFor(async () => {
    const res = await fetch(`${base}/__canvas/state`);
    return res.ok ? res.json() : null;
  }, "shim state endpoint");

  const bridgeFile = join(dataDir, "bridge.json");
  const { token } = await waitFor(() => {
    try {
      const parsed = JSON.parse(readFileSync(bridgeFile, "utf8"));
      return parsed.token ? parsed : null;
    } catch {
      return null;
    }
  }, "bridge.json");

  return { dir, port, base, token, child, log, state };
}

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

async function call(base, path, token, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: token ? auth(token) : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/**
 * 把服务端 TS 打成一个可 import 的临时模块（不碰仓库里的产物）。
 *
 * 必须先摆好宿主环境变量：`canvas-catalog.ts` → `mcp-protocol-server.ts` →
 * `service-config.ts` 在模块顶层校验这两个变量，缺了直接 `process.exit(1)`。
 * 注入的环境指向临时目录，不会碰真实数据。
 */
async function loadModule(entry, name) {
  const outdir = mkdtempSync(join(tmpdir(), `verify-${name}-`));
  const outfile = join(outdir, `${name}.mjs`);
  if (!process.env.ASTRAVIA_SERVICE_PORT) {
    process.env.ASTRAVIA_SERVICE_PORT = String(await freePort());
    const dataDir = join(outdir, "data");
    mkdirSync(dataDir, { recursive: true });
    process.env.ASTRAVIA_SERVICE_DATA_DIR = dataDir;
  }
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  return import(`file://${outfile}`);
}

/** 画布 `PublicLogicalModel` 的一个真实形状（字段名取自 backend/internal/app/logical_models.go）。 */
const MODEL_SAMPLES = [
  {
    id: "lm-flux",
    code: "flux-pro",
    name: "Flux Pro",
    description: "high fidelity image",
    capability: "image",
    available: true,
    capabilitySpec: {
      capability: "image",
      operations: ["text_to_image"],
      options: { quality: { values: ["1k", "2k"] }, size: { values: ["1:1", "16:9"] } },
    },
    priceTiers: [
      { selector: { operation: "text_to_image", quality: "2k" } },
      { selector: { operation: "text_to_image", quality: "1k" } },
    ],
  },
  {
    id: "lm-veo",
    code: "veo-3",
    name: "Veo 3",
    description: "video with audio",
    capability: "video",
    available: false,
    capabilityProfiles: [
      { capability: "video", operations: ["text_to_video", "image_to_video"] },
      { capability: "video", operations: ["text_to_video"] },
    ],
    priceTiers: [{ selector: { operation: "text_to_video", vquality: "720p", videoSeconds: "10" } }],
  },
  {
    id: "lm-gpt",
    code: "gpt-text",
    name: "GPT Text",
    description: "chat",
    capability: "chat",
    available: true,
    capabilitySpec: { capability: "chat", operations: [] },
  },
  {
    id: "lm-flux-kontext",
    code: "flux-kontext",
    name: "Flux Kontext",
    description: "edit without operations declared",
    capability: "image",
    available: true,
  },
  {
    id: "lm-tts",
    code: "voice",
    name: "Voice",
    description: "audio",
    capability: "audio",
    available: true,
    capabilitySpec: { capability: "audio", operations: ["text_to_speech"] },
  },
];

/** `GET /api/models` 的响应外壳：`asArray` 认 `data` / `items` / `models` / `list`。 */
function catalogSample() {
  return { data: MODEL_SAMPLES };
}

const sameSet = (actual, expected) =>
  actual.length === expected.length && [...expected].sort().join(",") === [...actual].sort().join(",");

async function main() {
  const catalogModule = await loadModule("server/src/canvas-catalog.ts", "canvas-catalog");

  {
    const catalog = catalogModule.normalizeCanvasCatalog(catalogSample());
    check("目录按 kind 归类（chat → text，未知能力丢弃）", catalog.models.length === 5, `models=${catalog.models.length}`);
    check(
      "计数按 kind 汇总",
      catalog.counts.image === 2 && catalog.counts.video === 1 && catalog.counts.text === 1 && catalog.counts.audio === 1,
      JSON.stringify(catalog.counts),
    );
    const flux = catalog.models.find((model) => model.id === "lm-flux");
    check("operations 来自 capabilitySpec", flux.operations.join(",") === "text_to_image", flux.operations.join(","));
    check("resolutions 从 priceTiers 的 quality 与 spec 选项去重合并", sameSet(flux.resolutions, ["1k", "2k"]), flux.resolutions.join(","));
    check("aspectRatios 只收 `数字:数字`", sameSet(flux.aspectRatios, ["1:1", "16:9"]), flux.aspectRatios.join(","));
    const veo = catalog.models.find((model) => model.id === "lm-veo");
    check(
      "operations 合并 capabilityProfiles",
      veo.operations.join(",") === "text_to_video,image_to_video",
      veo.operations.join(","),
    );
    check("videoSeconds 从 selector 取正整数", veo.videoSeconds.join(",") === "10", veo.videoSeconds.join(","));
    check("available 只在显式 true 时为真", veo.available === false && flux.available === true, `veo=${veo.available}`);
    {
      const expected = [...MODEL_SAMPLES]
        .map((model) => model.name)
        .sort((a, b) => a.localeCompare(b))
        .join(" | ");
      check("列表按 name 排序", catalog.models.map((model) => model.name).join(" | ") === expected, expected);
    }
  }

  {
    const body = catalogModule.buildCanvasTaskBody({
      logicalModelId: "lm-veo",
      kind: "video",
      operation: "text_to_video",
      prompt: "a kite over the sea",
      options: { vquality: "720p", videoSeconds: "10" },
    });
    check("任务 type 用 canvas_<kind>", body.type === "canvas_video", body.type);
    check("input.mode 与 type 一致", body.input.mode === "video", body.input.mode);
    check("参数落在 input.config", body.input.config.vquality === "720p", JSON.stringify(body.input.config));
    check("prompt 同时出现在顶层与 input", body.prompt === "a kite over the sea" && body.input.prompt === "a kite over the sea");
    check("没有 projectId 时不写这个键", !("projectId" in body), Object.keys(body).join(","));
  }

  {
    const view = catalogModule.normalizeCanvasTask({
      data: {
        id: "task-1",
        type: "canvas_image",
        status: "SUCCEEDED",
        progress: 100,
        previewUrl: "/api/resources/res-9/file?variant=thumb",
        previewKind: "image",
      },
    });
    check("状态归一成小写", view.status === "succeeded", view.status);
    check("任务类型归一成 kind", view.kind === "image", view.kind);
    check(
      "会话内资源路径改写成 /bridge/media/:id",
      view.artifacts[0]?.url === "/bridge/media/res-9",
      JSON.stringify(view.artifacts),
    );
    check("resourceId 保留以便排查", view.artifacts[0]?.resourceId === "res-9", view.artifacts[0]?.resourceId);
    check("progress 归一为百分数", view.progress === 100, String(view.progress));

    const remote = catalogModule.normalizeCanvasTask({
      id: "task-2",
      type: "canvas_video",
      status: "running",
      progress: 0.42,
      previewUrl: "https://cdn.example.com/a.mp4",
    });
    check("绝对 http(s) 产物原样保留", remote.artifacts[0]?.url === "https://cdn.example.com/a.mp4", remote.artifacts[0]?.url);
    check("running 的 progress 保留小数", remote.progress === 0.42, String(remote.progress));
    check("没有产物时 artifacts 为空数组", catalogModule.normalizeCanvasTask({ id: "t", status: "queued" }).artifacts.length === 0);
  }

  const mediaModule = await loadModule("src/features/canvas-workspace/canvas-media-provider.ts", "canvas-media-provider");
  const catalog = catalogModule.normalizeCanvasCatalog(catalogSample());

  {
    const { capabilities, supported, unsupported } = mediaModule.buildMediaCapabilities(catalog);
    check("生成两条能力（image / video）", capabilities.length === 2, capabilities.map((item) => item.kind).join(","));
    check("只登记能跑通的模型", supported === 2, `supported=${supported}`);
    check(
      "缺 operation 声明的模型被归到 unsupported",
      unsupported.length === 1 && unsupported[0].id === "lm-flux-kontext",
      unsupported.map((model) => model.id).join(","),
    );
    const video = capabilities.find((item) => item.kind === "video");
    check("视频能力只声明 text-to-video", video.modes.join(",") === "text-to-video", video.modes.join(","));
    check("视频能力带时长期望（升序）", video.durationsSeconds?.join(",") === "10", JSON.stringify(video.durationsSeconds));
    check("默认模型取第一个可用模型", video.defaultModelId === "lm-veo", video.defaultModelId);
    const image = capabilities.find((item) => item.kind === "image");
    check("图片能力带分辨率与比例", sameSet(image.resolutions ?? [], ["1k", "2k"]), JSON.stringify(image.resolutions));
    check("图片比例进能力表", sameSet(image.aspectRatios ?? [], ["1:1", "16:9"]), JSON.stringify(image.aspectRatios));
    check(
      "模型描述符只列自己支持的模式",
      image.models[0].modes.join(",") === "text-to-image",
      image.models[0].modes.join(","),
    );
  }

  {
    check("参考图模式不声明（上传未转发）", !mediaModule.BRIDGED_MODES.includes("image-to-video"), mediaModule.BRIDGED_MODES.join(","));
    const options = mediaModule.taskOptionsOf("video", { resolution: "720p", aspectRatio: "16:9", durationSeconds: 10.4 });
    check(
      "参数映射成画布 canonical 名",
      options.vquality === "720p" && options.size === "16:9" && options.videoSeconds === "10",
      JSON.stringify(options),
    );
    const imageOptions = mediaModule.taskOptionsOf("image", { resolution: "2k", aspectRatio: "1:1" });
    check("图片分辨率落到 quality", imageOptions.quality === "2k" && !("vquality" in imageOptions), JSON.stringify(imageOptions));
  }

  const shim = await startShim();
  const { base, token } = shim;
  try {
    check(
      "shim 在载荷不可用时仍然监听",
      shim.state.phase === "failed" && shim.state.code === "platform-unsupported",
      `phase=${shim.state.phase} code=${shim.state.code}`,
    );

    {
      const res = await call(base, "/bridge/canvas/models", null);
      check("GET /bridge/canvas/models 无 token 401", res.status === 401, `status=${res.status}`);
      check("401 的码是 bridge-unauthorized", res.json?.error?.code === "bridge-unauthorized", res.json?.error?.code);
    }
    {
      const res = await call(base, "/bridge/canvas/models", token);
      // 没有画布会话 ⇒ rawCanvasApi 直接返回 canvas-login-required，不是猜的。
      check("/bridge/canvas/models 无画布会话时 401", res.status === 401, `status=${res.status}`);
      check("失败码透传 canvas-login-required", res.json?.error?.code === "canvas-login-required", res.json?.error?.code);
    }
    {
      // ADR-0015 的四条渠道模型路由：能到 401 就说明路由存在（写错路径会被 shim 回 404）。
      const list = await call(base, "/bridge/admin/channels/ch-1/models", token);
      check("GET 渠道模型 无画布会话时 401", list.status === 401, `status=${list.status}`);
      check("渠道模型读失败码是 canvas-login-required", list.json?.error?.code === "canvas-login-required", list.json?.error?.code);
      const create = await call(base, "/bridge/admin/channels/ch-1/models", token, { method: "POST", body: { modelKey: "m" } });
      check("POST 渠道模型 无画布会话时 401", create.status === 401, `status=${create.status}`);
      const patch = await call(base, "/bridge/admin/channels/ch-1/models/m-1", token, { method: "PATCH", body: { modelKey: "m" } });
      check("PATCH 渠道模型 无画布会话时 401", patch.status === 401, `status=${patch.status}`);
      const remove = await call(base, "/bridge/admin/channels/ch-1/models/m-1", token, { method: "DELETE" });
      check("DELETE 渠道模型 无画布会话时 401", remove.status === 401, `status=${remove.status}`);
      const catalog = await call(base, "/bridge/canvas/model-catalog", token);
      check("GET 创作目录 无画布会话时 401", catalog.status === 401, `status=${catalog.status}`);
      check("创作目录读失败码是 canvas-login-required", catalog.json?.error?.code === "canvas-login-required", catalog.json?.error?.code);
    }
    {
      const res = await call(base, "/bridge/canvas/tasks", token, {
        method: "POST",
        body: { kind: "image", operation: "text_to_image" },
      });
      check("缺 logicalModelId/prompt → 400 bridge-bad-request", res.status === 400, `status=${res.status}`);
      check("400 的码是 bridge-bad-request", res.json?.error?.code === "bridge-bad-request", res.json?.error?.code);
    }
    {
      const res = await call(base, "/bridge/canvas/tasks", token, {
        method: "POST",
        body: { logicalModelId: "lm-flux", kind: "nope", operation: "text_to_image", prompt: "x" },
      });
      check("kind 不在白名单 → 400", res.status === 400, `status=${res.status}`);
    }
    {
      const res = await call(base, "/bridge/canvas/tasks", token, {
        method: "POST",
        body: { logicalModelId: "lm-flux", kind: "image", operation: "text_to_image", prompt: "a red fox" },
      });
      check("形状合法但无画布会话 → 401", res.status === 401, `status=${res.status}`);
      check("以 canvas-login-required 报出", res.json?.error?.code === "canvas-login-required", res.json?.error?.code);
    }
    {
      const res = await call(base, "/bridge/canvas/tasks/task-1", token);
      check("GET /bridge/canvas/tasks/:id 无会话 → 401", res.status === 401, `status=${res.status}`);
    }
    {
      const res = await call(base, "/bridge/media/res-1", token);
      // streamCanvasResource 没有会话时直接 503，不会去连一个不存在的端口。
      check("GET /bridge/media/:id 无会话 → 503", res.status === 503, `status=${res.status}`);
      check("失败码是 canvas-unreachable", res.json?.error?.code === "canvas-unreachable", res.json?.error?.code);
    }
    {
      const res = await call(base, "/bridge/media/res-1", null);
      check("GET /bridge/media/:id 无 token 401（产物不是公开链接）", res.status === 401, `status=${res.status}`);
    }
  } finally {
    shim.child.kill("SIGTERM");
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("\n--- shim log ---");
    console.log(shim.log.join("").slice(-4000));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
