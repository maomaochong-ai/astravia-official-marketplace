#!/usr/bin/env node
/**
 * 用真实 shim 进程验证前端产物承载（ADR-0008）。
 *
 * 为什么需要这个脚本：上游发布 tag 的后端只有 `/api` 路由，`NoRoute` 是
 * `SystemProxyNoRouteHandler`，任何非 `/api` 路径都回 404「请求不存在」。这正是
 * 「服务 ready、画布窗口却只显示一段 404 JSON」的成因，而它只在浏览器里看得见——
 * 宿主的健康门、`/__canvas/state` 全都正常。所以断言必须落在真实 HTTP 响应上。
 *
 * 做法与 verify-bridge 一致：不假装外部环境。
 * - `ASTRAVIA_SERVICE_RUNTIME_DIR` 指向一个临时目录，里面放假的 `web-dist/` 与一个
 *   真的监听端口的 `yingce-backend`，于是 `resolveRuntimeDir()` 直接命中「包内自带运行时」，
 *   不下载 200 MB 载荷；
 * - `CANVAS_PAYLOAD_MANIFEST` 指向只声明 linux-x64 的清单，Agent 载荷因此确定缺席，
 *   不会去碰网络。
 *
 * 覆盖：首页、带 hash 的资源、SPA 深链、缺失脚本的真实 404、/api 透传、目录逃逸、
 * HEAD、以及 web-dist 缺失时的失败码。
 */
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 30_000;
// 允许指向另一份 shim，用来做改前/改后的对比：同一套断言跑在原版上应该全部变红，
// 那才是真的修好了，而不是断言恰好能过。
const SHIM = process.env.CANVAS_SHIM_UNDER_TEST
  ? path.resolve(process.env.CANVAS_SHIM_UNDER_TEST)
  : join(ROOT, "server", "boot.mjs");

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

/** 假后端：真监听宿主分配的端口，并按 Go 的 slog 文案把 addr 打到 stdout。 */
const FAKE_BACKEND = `#!/usr/bin/env node
const http = require("node:http");
const addr = process.env.CANVAS_BACKEND_ADDR || "127.0.0.1:0";
const port = Number(addr.split(":").pop());
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ fakeBackend: true, path: req.url }));
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write('time=2026-01-01T00:00:00Z level=INFO msg="backend listening" addr=127.0.0.1:' + server.address().port + "\\n");
});
`;

function writeManifest(dir) {
  const manifestPath = join(dir, "payload-manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        payloadVersion: "verify-web-hosting",
        upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0", commit: "0".repeat(40) },
        platforms: {
          "linux-x64": {
            payload: { file: "payload-verify-web-hosting-linux-x64.zip", sha256: "0".repeat(64), bytes: 1 },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return manifestPath;
}

/** withWeb=false 时故意不放 web-dist，用来验证失败码。 */
function buildRuntime(withWeb = true) {
  const dir = mkdtempSync(join(tmpdir(), "verify-web-hosting-"));
  const runtimeDir = join(dir, "runtime");
  const dataDir = join(dir, "data");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });

  const binary = join(runtimeDir, "yingce-backend");
  writeFileSync(binary, FAKE_BACKEND);
  chmodSync(binary, 0o755);

  if (withWeb) {
    const webDir = join(runtimeDir, "web-dist");
    mkdirSync(join(webDir, "assets"), { recursive: true });
    writeFileSync(join(webDir, "index.html"), "<!doctype html><title>canvas</title><div id=root></div>\n");
    writeFileSync(join(webDir, "assets", "app-abc123.js"), "console.log('canvas bundle');\n");
  }

  return { dir, runtimeDir, dataDir, manifestPath: writeManifest(dir) };
}

async function startShim({ withWeb = true } = {}) {
  const layout = buildRuntime(withWeb);
  const port = await freePort();
  const child = spawn(process.execPath, [SHIM], {
    env: {
      ...process.env,
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: layout.dataDir,
      ASTRAVIA_SERVICE_RUNTIME_DIR: layout.runtimeDir,
      CANVAS_PAYLOAD_MANIFEST: layout.manifestPath,
      CANVAS_PAYLOAD_BASE_URL: "",
      // 本脚本验的是「静态文件能不能从宿主端口取到」（ADR-0008）；
      // 固定 origin 重定向是 ADR-0010 的事，关掉它，断言才只指向一个变量。
      CANVAS_STABLE_PORTS: "off",
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

  return { ...layout, port, base, child, log, state };
}

/** 走 fetch：路径会被规范化，所以目录逃逸单独用 rawRequest。 */
async function get(base, path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

/** 原样送出 path，不经 URL 规范化——目录逃逸必须这样测。 */
function rawRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const shim = await startShim();
  try {
    await waitFor(async () => (await get(shim.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const ready = JSON.parse((await get(shim.base, "/__canvas/state")).text);
    check("后端就绪后 /__canvas/state.ready 为真", ready.ready === true, `phase=${ready.phase}`);

    const index = await get(shim.base, "/", { Accept: "text/html" });
    check("GET / 返回 index.html", index.status === 200 && index.text.includes("<!doctype html"), `status=${index.status}`);
    check(
      "index.html 的 Content-Type 是 HTML",
      String(index.headers.get("content-type")).startsWith("text/html"),
      String(index.headers.get("content-type")),
    );
    check("index.html 不缓存", index.headers.get("cache-control") === "no-cache", String(index.headers.get("cache-control")));

    const asset = await get(shim.base, "/assets/app-abc123.js");
    check("GET /assets/<hash>.js 返回脚本", asset.status === 200 && asset.text.includes("canvas bundle"), `status=${asset.status}`);
    check(
      "带 hash 的资源长缓存",
      String(asset.headers.get("cache-control")).includes("immutable"),
      String(asset.headers.get("cache-control")),
    );
    check(
      "JS 的 Content-Type 是 text/javascript",
      String(asset.headers.get("content-type")).startsWith("text/javascript"),
      String(asset.headers.get("content-type")),
    );

    const deepLink = await get(shim.base, "/projects/42", { Accept: "text/html" });
    check(
      "SPA 深链回退到 index.html",
      deepLink.status === 200 && deepLink.text.includes("<!doctype html"),
      `status=${deepLink.status}`,
    );

    const missingAsset = await get(shim.base, "/assets/missing.js");
    check(
      "缺失脚本是真实的 404，不是 Go 的 404 信封",
      missingAsset.status === 404 && !missingAsset.text.includes("请求不存在"),
      `status=${missingAsset.status} body=${missingAsset.text.slice(0, 60)}`,
    );

    const api = await get(shim.base, "/api/health/ready");
    check("GET /api/* 仍然透传给后端", api.status === 200 && api.text.includes("fakeBackend"), `status=${api.status}`);

    const deepApi = await get(shim.base, "/api/canvas-projects/xyz");
    check(
      "/api 下的深路径不被静态层吞掉",
      deepApi.status === 200 && deepApi.text.includes('"path":"/api/canvas-projects/xyz"'),
      `status=${deepApi.status}`,
    );

    const traversal = await rawRequest(shim.port, "/assets/../../../../etc/passwd");
    check(
      "目录逃逸被拒绝",
      traversal.status === 404 && !traversal.text.includes("root:"),
      `status=${traversal.status} body=${traversal.text.slice(0, 40)}`,
    );

    const head = await fetch(`${shim.base}/`, { method: "HEAD" });
    check("HEAD / 返回 200 且无正文", head.status === 200, `status=${head.status}`);

    const mcpGet = await get(shim.base, "/mcp");
    check(
      "GET /mcp 回 405 而不是前端页面",
      mcpGet.status === 405 && !mcpGet.text.toLowerCase().includes("<!doctype html"),
      `status=${mcpGet.status}`,
    );
  } finally {
    shim.child.kill("SIGTERM");
    await new Promise((resolve) => shim.child.once("exit", resolve));
  }

  const broken = await startShim({ withWeb: false });
  try {
    const state = await waitFor(async () => {
      const res = JSON.parse((await get(broken.base, "/__canvas/state")).text);
      return res.phase === "failed" ? res : null;
    }, "web-bundle-missing failure");
    check("web-dist 缺失时准备阶段直接失败", state.code === "web-bundle-missing", `code=${state.code}`);
    check("失败时不谎报就绪", state.ready === false && state.backend === false, `ready=${state.ready} backend=${state.backend}`);
    const home = await get(broken.base, "/", { Accept: "text/html" });
    check(
      "失败态首页是准备页而不是 404 JSON",
      home.status === 200 && home.text.toLowerCase().includes("<!doctype html") && !home.text.includes("请求不存在"),
      `status=${home.status}`,
    );
  } finally {
    broken.child.kill("SIGTERM");
    await new Promise((resolve) => broken.child.once("exit", resolve));
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.error(`failed: ${failed.map((result) => result.name).join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
