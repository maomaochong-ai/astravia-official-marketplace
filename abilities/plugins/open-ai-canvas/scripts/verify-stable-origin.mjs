#!/usr/bin/env node
/**
 * 用真实 shim 进程验证「固定浏览器 origin」（ADR-0010）。
 *
 * 为什么需要这个脚本：宿主用 `listen(0)` 分配服务端口，所以插件每次启动的 origin
 * 都不一样；而画布把渠道、模型、apiKey 写在浏览器 localStorage（zustand persist），
 * localStorage 按 origin 隔离。症状是「重启后配置全没了」，但它只在浏览器里成立——
 * HTTP 层一切 200，`/__canvas/state` 也照常 ready。所以断言必须落在真实响应上：
 * 宿主端口上的导航请求要 302，稳定 origin 上的页面要 200，探针要拿到 JSON 而不是 302，
 * 并且**重启后origin 不变**。
 *
 * 做法与 verify-web-hosting 一致：不假装外部环境。
 * - `ASTRAVIA_SERVICE_RUNTIME_DIR` 指向临时目录，内放假的 `web-dist/` 与真的监听端口的
 *   `yingce-backend`，于是 `resolveRuntimeDir()` 直接命中「随包运行时」，不下载载荷；
 * - `CANVAS_PAYLOAD_MANIFEST` 指向只声明本机平台的清单，Agent 载荷确定缺席，不碰网络；
 * - `CANVAS_STABLE_PORTS` 显式给定临时空闲端口，不去抢用户机器上真实的 4781x。
 *
 * 覆盖：重定向、稳定端口承载、探针/API 不被重定向、`browser-origin.json` 落盘、
 * 重启后 origin 不变（核心）、端口被占时退到次选、`off` 时降级为旧行为。
 */
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 30_000;
const SHIM = process.env.CANVAS_SHIM_UNDER_TEST
  ? path.resolve(process.env.CANVAS_SHIM_UNDER_TEST)
  : join(ROOT, "server", "boot.mjs");
const PLATFORM = `${process.platform === "win32" ? "win32" : process.platform}-${process.arch}`;

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

/** 占住一个端口，模拟「上次那个端口这次被别的程序拿了」。 */
function occupy(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
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
        payloadVersion: "verify-stable-origin",
        upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0", commit: "0".repeat(40) },
        platforms: {
          [PLATFORM]: {
            payload: { file: "payload-verify-stable-origin.zip", sha256: "0".repeat(64), bytes: 1 },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return manifestPath;
}

function buildRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "verify-stable-origin-"));
  const runtimeDir = join(dir, "runtime");
  const dataDir = join(dir, "data");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });

  const binary = join(runtimeDir, "yingce-backend");
  writeFileSync(binary, FAKE_BACKEND);
  chmodSync(binary, 0o755);

  const webDir = join(runtimeDir, "web-dist");
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(join(webDir, "index.html"), "<!doctype html><title>canvas</title><div id=root></div>\n");
  writeFileSync(join(webDir, "assets", "app-abc123.js"), "console.log('canvas bundle');\n");

  return { dir, runtimeDir, dataDir, manifestPath: writeManifest(dir) };
}

async function startShim({ layout, stablePorts }) {
  const port = await freePort();
  const child = spawn(process.execPath, [SHIM], {
    env: {
      ...process.env,
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: layout.dataDir,
      ASTRAVIA_SERVICE_RUNTIME_DIR: layout.runtimeDir,
      CANVAS_PAYLOAD_MANIFEST: layout.manifestPath,
      CANVAS_PAYLOAD_BASE_URL: "",
      CANVAS_STABLE_PORTS: stablePorts,
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

  return { port, base, child, log, state };
}

async function stopShim(shim) {
  if (!shim) return;
  shim.child.kill("SIGTERM");
  await new Promise((resolve) => {
    shim.child.once("exit", resolve);
    setTimeout(resolve, 4000);
  });
}

async function get(base, path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

/** 同上：文件不存在就返回 null，让「落盘」那条断言自己变红。 */
function readOriginFile(dataDir) {
  try {
    return JSON.parse(readFileSync(join(dataDir, "browser-origin.json"), "utf8"));
  } catch {
    return null;
  }
}

/** 老 shim 的 state 里没有 origin；这时故意返回「拿不到」而不是抛错，
 *  让依赖它的断言自然地变红——改前/改后对比要看的是失败列表，不是一条异常。 */
function getOrNone(base, path, headers = {}) {
  if (typeof base !== "string" || !/^https?:\/\//.test(base)) {
    return Promise.resolve({ status: 0, headers: new Headers(), text: "" });
  }
  return get(base, path, headers);
}

async function main() {
  const layoutA = buildRuntime();
  const portsA = [await freePort(), await freePort()];
  const explicit = portsA.join(",");

  // --- 场景 A：首次启动，抢到固定 origin ---
  let shimA = await startShim({ layout: layoutA, stablePorts: explicit });
  let originA = "";
  try {
    await waitFor(async () => (await get(shimA.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const state = JSON.parse((await get(shimA.base, "/__canvas/state")).text);
    originA = state.origin;

    check("state.originPinned 为真", state.originPinned === true, JSON.stringify(state.originPinned));
    check(
      "state.origin 用的是显式给定的端口",
      originA === `http://127.0.0.1:${portsA[0]}`,
      `${originA} vs ${portsA[0]}`,
    );

    const nav = await get(shimA.base, "/", { Accept: "text/html,application/xhtml+xml" });
    check("宿主端口上的导航请求是 302", nav.status === 302, `status=${nav.status}`);
    check(
      "302 指到固定 origin",
      nav.headers.get("location") === `${originA}/`,
      String(nav.headers.get("location")),
    );
    check(
      "重定向不缓存",
      nav.headers.get("cache-control") === "no-store",
      String(nav.headers.get("cache-control")),
    );

    const deep = await getOrNone(shimA.base, "/canvas/abc?tab=chat", { Accept: "text/html" });
    check(
      "深链连 query 一起带过去",
      deep.status === 302 && deep.headers.get("location") === `${originA}/canvas/abc?tab=chat`,
      `${deep.status} ${deep.headers.get("location")}`,
    );

    const xhr = await get(shimA.base, "/", { Accept: "*/*" });
    check("Accept 是通配的请求不被跳走（XHR 直接拿页面）", xhr.status === 200, `status=${xhr.status}`);

    const probe = await get(shimA.base, "/__canvas/state", { Accept: "text/html" });
    check(
      "探针即使声称要 HTML 也拿 JSON，不是 302",
      probe.status === 200 && probe.text.includes('"phase"'),
      `status=${probe.status}`,
    );

    const api = await get(shimA.base, "/api/health/ready", { Accept: "text/html" });
    check(
      "/api 不被重定向（宿主的健康门）",
      api.status === 200 && api.text.includes("fakeBackend"),
      `status=${api.status}`,
    );

    const pinnedIndex = await getOrNone(originA, "/", { Accept: "text/html" });
    check(
      "固定 origin 上取得到画布首页",
      pinnedIndex.status === 200 && pinnedIndex.text.includes("<!doctype html"),
      `status=${pinnedIndex.status}`,
    );

    const pinnedAsset = await getOrNone(originA, "/assets/app-abc123.js");
    check(
      "固定 origin 上取得到带 hash 的资源",
      pinnedAsset.status === 200 && pinnedAsset.text.includes("canvas bundle"),
      `status=${pinnedAsset.status}`,
    );

    const pinnedApi = await getOrNone(originA, "/api/canvas-projects/xyz");
    check(
      "固定 origin 上的 /api 也透传给后端",
      pinnedApi.status === 200 && pinnedApi.text.includes('"path":"/api/canvas-projects/xyz"'),
      `status=${pinnedApi.status}`,
    );

    const file = readOriginFile(layoutA.dataDir);
    // （文件不存在 = 老 shim，不抛错，让断言直接变红。）
    check(
      "选中端口落到 browser-origin.json",
      file?.port === portsA[0] && file?.origin === originA,
      JSON.stringify(file?.port ?? null),
    );
  } finally {
    await stopShim(shimA);
  }

  // --- 场景 B：重启（宿主端口换了、数据目录不变）--- 这是用户报的核心问题 ---
  let shimB = await startShim({ layout: layoutA, stablePorts: explicit });
  try {
    await waitFor(async () => (await get(shimB.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const state = JSON.parse((await get(shimB.base, "/__canvas/state")).text);
    check("重启后宿主端口确实变了（前提成立）", shimB.port !== shimA.port, `${shimA.port} → ${shimB.port}`);
    check("重启后 origin 不变（localStorage 不丢）", state.origin === originA, `${state.origin} vs ${originA}`);

    const bookmark = await getOrNone(originA, "/", { Accept: "text/html" });
    check(
      "旧书签（上次的 origin）重启后仍打开画布",
      bookmark.status === 200 && bookmark.text.includes("<!doctype html"),
      `status=${bookmark.status}`,
    );
  } finally {
    await stopShim(shimB);
  }

  // --- 场景 C：首选端口被别的程序占了 ---
  const layoutC = buildRuntime();
  const portsC = [await freePort(), await freePort()];
  const blocker = await occupy(portsC[0]);
  let shimC = null;
  try {
    shimC = await startShim({ layout: layoutC, stablePorts: portsC.join(",") });
    await waitFor(async () => (await get(shimC.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const state = JSON.parse((await get(shimC.base, "/__canvas/state")).text);
    check(
      "首选端口被占时退到次选，而不是放弃",
      state.originPinned === true && state.origin === `http://127.0.0.1:${portsC[1]}`,
      `${state.origin} vs ${portsC[1]}`,
    );
    check(
      "退到次选后日志有说明",
      shimC.log.join("").includes("trying next"),
      shimC.log.join("").trim().split("\n").slice(0, 2).join(" | "),
    );
  } finally {
    await stopShim(shimC);
    blocker.close();
  }

  // --- 场景 D：关掉固定 origin，行为回到改造前（不 302）---
  const layoutD = buildRuntime();
  let shimD = await startShim({ layout: layoutD, stablePorts: "off" });
  try {
    await waitFor(async () => (await get(shimD.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const state = JSON.parse((await get(shimD.base, "/__canvas/state")).text);
    check("关闭后 originPinned 为假", state.originPinned === false, JSON.stringify(state.originPinned));
    check(
      "关闭后 origin 退回宿主端口",
      state.origin === `http://127.0.0.1:${shimD.port}`,
      `${state.origin} vs ${shimD.port}`,
    );
    const nav = await get(shimD.base, "/", { Accept: "text/html" });
    check(
      "关闭后导航直接 200，没有重定向",
      nav.status === 200 && nav.text.includes("<!doctype html"),
      `status=${nav.status}`,
    );
  } finally {
    await stopShim(shimD);
  }

  // --- 场景 E：候选端口全被占——必须降级而不是崩掉 ---
  const layoutE = buildRuntime();
  const portsE = [await freePort(), await freePort()];
  const blockers = [await occupy(portsE[0]), await occupy(portsE[1])];
  let shimE = null;
  try {
    shimE = await startShim({ layout: layoutE, stablePorts: portsE.join(",") });
    await waitFor(async () => (await get(shimE.base, "/__canvas/state")).text.includes('"ready":true'), "backend ready");
    const state = JSON.parse((await get(shimE.base, "/__canvas/state")).text);
    check("候选端口全被占时降级到宿主端口", state.originPinned === false && state.origin === `http://127.0.0.1:${shimE.port}`, state.origin);
    check(
      "降级会写明后果（状态不随重启保留）",
      shimE.log.join("").includes("No stable origin port"),
      shimE.log.join("").match(/No stable origin[^\n]*/)?.[0],
    );
    const nav = await get(shimE.base, "/", { Accept: "text/html" });
    check("降级后画布仍能用（导航 200）", nav.status === 200 && nav.text.includes("<!doctype html"), `status=${nav.status}`);
  } finally {
    await stopShim(shimE);
    for (const blocker of blockers) blocker.close();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("failed:", failed.map((item) => item.name).join(", "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
