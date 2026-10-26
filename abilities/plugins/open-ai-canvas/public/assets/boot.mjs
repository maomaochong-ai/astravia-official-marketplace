// 生成物：不要直接编辑。源在 server/src/，构建命令 `npm run build:boot`。
// 单文件是硬约束——宿主只下载并执行这一个 entry（见 docs/adr/open-ai-canvas/0012-service-module-layout.md）。

// server/src/stable-origin-binding.ts
import http4 from "node:http";
import net3 from "node:net";
import fs12 from "node:fs";
import path12 from "node:path";

// server/src/service-config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var HOST_PORT = Number(process.env.ASTRAVIA_SERVICE_PORT);
var DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR;
var RUNTIME_DIR = process.env.ASTRAVIA_SERVICE_RUNTIME_DIR || __dirname;
if (!HOST_PORT || !DATA_DIR) {
  console.error("[open-ai-canvas] Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR");
  process.exit(1);
}
var STABLE_ORIGIN_PORTS = [47810, 47811, 47812, 47813];
var ORIGIN_FILE = path.join(DATA_DIR, "browser-origin.json");
var OFFICIAL_BASE = "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-open-ai-canvas-payloads";
var DEFAULT_MIRROR_PREFIXES = ["https://ghfast.top/", "https://gh-proxy.com/"];
var PAYLOAD_BASE_URL = process.env.CANVAS_PAYLOAD_BASE_URL || OFFICIAL_BASE;
var GITHUB_REPO = "maomaochong-ai/astravia-official-marketplace";
var RELEASE_TAG = "plugin-open-ai-canvas-payloads";
var MANIFEST_ASSET = "payload-manifest.json";
var TARGET_PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];
var PLATFORM = `${process.platform}-${process.arch}`;
var BINARY_NAME = `yingce-backend${process.platform === "win32" ? ".exe" : ""}`;
var NODE_BINARY_NAME = process.platform === "win32" ? "node.exe" : "node";
var BUNDLED_DIR = RUNTIME_DIR;
var MANIFEST = { payloadVersion: "", upstream: null, platforms: {}, source: "" };
function supportedPlatforms() {
  const fromManifest = Object.keys(MANIFEST.platforms);
  return (fromManifest.length > 0 ? fromManifest : TARGET_PLATFORMS).sort();
}

// server/src/canvas-session-store.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path2 from "node:path";
var SESSION_FILE = path2.join(DATA_DIR, "session.json");
var SESSION_KEY = (() => {
  const raw = process.env.ASTRAVIA_SERVICE_SECRET_SESSION_KEY;
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64url");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
})();
function sealSession(token) {
  if (!SESSION_KEY) return JSON.stringify({ v: 1, token });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SESSION_KEY, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 2,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64")
  });
}
function openSession(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data?.token === "string") return data.token;
  if (data?.v !== 2 || !SESSION_KEY) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", SESSION_KEY, Buffer.from(data.iv, "base64"));
    decipher.setAuthTag(Buffer.from(data.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data.data, "base64")), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("[open-ai-canvas] Failed to decrypt session:", err.message);
    return null;
  }
}
function loadSession() {
  try {
    const token = openSession(fs.readFileSync(SESSION_FILE, "utf8"));
    if (token && SESSION_KEY) saveSession(token);
    return token;
  } catch {
    return null;
  }
}
function saveSession(token) {
  try {
    fs.writeFileSync(SESSION_FILE, sealSession(token), { mode: 384 });
  } catch (err) {
    console.error("[open-ai-canvas] Failed to save session:", err.message);
  }
}
var SESSION_TOKEN = loadSession();
function setSessionToken(token) {
  SESSION_TOKEN = token;
}

// server/src/backend-process.ts
import net2 from "node:net";
import fs3 from "node:fs";
import { spawn as spawn2 } from "node:child_process";

// server/src/http-transport.ts
import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import fs2 from "node:fs";
import path3 from "node:path";
import { execFileSync } from "node:child_process";
import { PassThrough } from "node:stream";
function hasPayload(dir) {
  try {
    return fs2.statSync(path3.join(dir, BINARY_NAME)).isFile();
  } catch {
    return false;
  }
}
var DOWNLOAD_CHUNKS = 8;
var CHUNK_ATTEMPTS = 3;
var PLUGIN_USER_AGENT = "open-ai-canvas-plugin";
var REDIRECT_CODES = [301, 302, 303, 307, 308];
function parseProxySpec(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    const port = Number(url.port) || 8080;
    return url.hostname && port ? { host: url.hostname, port } : null;
  } catch {
    return null;
  }
}
function detectSystemProxy() {
  const fromEnv = parseProxySpec(process.env.HTTPS_PROXY) || parseProxySpec(process.env.https_proxy) || parseProxySpec(process.env.HTTP_PROXY) || parseProxySpec(process.env.http_proxy) || parseProxySpec(process.env.ALL_PROXY) || parseProxySpec(process.env.all_proxy);
  if (fromEnv) return { ...fromEnv, source: "env" };
  if (process.platform === "darwin") {
    try {
      const out = execFileSync("scutil", ["--proxy"], { encoding: "utf8", timeout: 3e3 });
      const host = /HTTPSProxy\s*:\s*(\S+)/.exec(out)?.[1];
      const port = Number(/HTTPSPort\s*:\s*(\d+)/.exec(out)?.[1] || 0);
      if (/HTTPSEnable\s*:\s*1/.test(out) && host && port) return { host, port, source: "scutil" };
    } catch {
    }
  }
  if (process.platform === "win32") {
    try {
      const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const out = execFileSync("reg", ["query", key], { encoding: "utf8", timeout: 3e3 });
      if (/ProxyEnable\s+REG_DWORD\s+0x1/.test(out)) {
        const server = /ProxyServer\s+REG_SZ\s+(\S+)/.exec(out)?.[1] || "";
        const parsed = parseProxySpec(/https=([^;\s]+)/.exec(server)?.[1] || server);
        if (parsed) return { ...parsed, source: "registry" };
      }
    } catch {
    }
  }
  return null;
}
var PROXY_RESOLVED = false;
var ACTIVE_PROXY = null;
function systemProxy() {
  if (!PROXY_RESOLVED) {
    PROXY_RESOLVED = true;
    ACTIVE_PROXY = detectSystemProxy();
    if (ACTIVE_PROXY) note(`检测到系统代理 ${ACTIVE_PROXY.host}:${ACTIVE_PROXY.port}（来源 ${ACTIVE_PROXY.source}）`);
    else note("未检测到系统代理，下载直连");
  }
  return ACTIVE_PROXY;
}
function dropProxy(reason) {
  if (!ACTIVE_PROXY) return;
  note(`系统代理不可用（${reason}），改为直连`);
  ACTIVE_PROXY = null;
}
function connectDirect(hostname, port, isTls) {
  return new Promise((resolve, reject) => {
    const socket = isTls ? tls.connect({ host: hostname, port, servername: hostname, ALPNProtocols: ["http/1.1"] }) : net.connect({ host: hostname, port });
    socket.setTimeout(12e3, () => socket.destroy(new Error("连接超时")));
    socket.once(isTls ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
  });
}
function connectTunnel(proxy, hostname, port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: `${hostname}:${port}`,
      timeout: 12e3
    });
    req.on("connect", (res, socket, head) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        dropProxy(`CONNECT ${res.statusCode}`);
        reject(new Error(`代理 CONNECT ${res.statusCode}`));
        return;
      }
      if (head && head.length) socket.unshift(head);
      const secure = tls.connect({ socket, servername: hostname, ALPNProtocols: ["http/1.1"] });
      secure.setTimeout(2e4, () => secure.destroy(new Error("TLS 握手超时")));
      secure.once("secureConnect", () => resolve(secure));
      secure.once("error", reject);
    });
    req.on("timeout", () => {
      req.destroy();
      dropProxy("连接超时");
      reject(new Error("代理连接超时"));
    });
    req.on("error", (err) => {
      dropProxy(err.message);
      reject(err);
    });
    req.end();
  });
}
function openSocket(hostname, port, isTls) {
  const proxy = isTls ? systemProxy() : null;
  return proxy ? connectTunnel(proxy, hostname, port) : connectDirect(hostname, port, isTls);
}
function readHead(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const finish = () => {
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) {
        if (buffer.length > 65536) reject(new Error("响应头过长"));
        return false;
      }
      const lines = buffer.subarray(0, end).toString("latin1").split("\r\n");
      const status = Number(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines[0])?.[1] || 0);
      const headers = {};
      for (const line of lines.slice(1)) {
        const at = line.indexOf(":");
        if (at > 0) headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
      }
      cleanup();
      resolve({ statusCode: status, headers, rest: buffer.subarray(end + 4) });
      return true;
    };
    const onData = (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      finish();
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}
function pumpBody(socket, head) {
  const body = new PassThrough();
  const originalDestroy = body.destroy.bind(body);
  body.statusCode = head.statusCode;
  body.headers = head.headers;
  body.bytesRead = 0;
  body.destroy = (err) => {
    socket.destroy();
    originalDestroy(err);
    return body;
  };
  const originalPush = body.push.bind(body);
  body.push = (chunk, encoding) => {
    if (chunk) body.bytesRead += chunk.length;
    return originalPush(chunk, encoding);
  };
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    body.end();
    socket.destroy();
  };
  socket.on("close", () => {
    if (finished) return;
    finished = true;
    if (Number.isFinite(declared) && body.bytesRead < declared) body.emit("aborted");
    body.end();
  });
  socket.on("error", () => {
    if (finished) return;
    finished = true;
    body.destroy();
  });
  const declared = Number(head.headers["content-length"]);
  const chunked = /chunked/i.test(head.headers["transfer-encoding"] || "");
  if (chunked) {
    let buffer = head.rest;
    let remaining = null;
    socket.on("data", (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      for (; ; ) {
        if (remaining === null) {
          const lineEnd = buffer.indexOf("\r\n");
          if (lineEnd === -1) return;
          const size = parseInt(buffer.subarray(0, lineEnd).toString("latin1").split(";")[0], 16);
          buffer = buffer.subarray(lineEnd + 2);
          if (!Number.isFinite(size)) {
            body.emit("aborted");
            done();
            return;
          }
          if (size === 0) {
            done();
            return;
          }
          remaining = size;
        }
        if (buffer.length < remaining + 2) return;
        body.write(buffer.subarray(0, remaining));
        buffer = buffer.subarray(remaining + 2);
        remaining = null;
      }
    });
    return body;
  }
  if (Number.isFinite(declared) && declared >= 0) {
    let sent = 0;
    const push = (chunk) => {
      if (finished) return;
      const room = declared - sent;
      if (room <= 0) return;
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
      sent += slice.length;
      if (!body.write(slice)) socket.pause();
      if (sent >= declared) done();
    };
    body.on("drain", () => socket.resume());
    if (head.rest.length) push(head.rest);
    socket.on("data", push);
    return body;
  }
  if (head.rest.length) body.write(head.rest);
  body.on("drain", () => socket.resume());
  socket.on("data", (chunk) => {
    if (finished) return;
    if (!body.write(chunk)) socket.pause();
  });
  return body;
}
async function requestStream(url, { headers = {}, timeout = 45e3 } = {}) {
  const target = new URL(url);
  const isTls = target.protocol !== "http:";
  const port = Number(target.port) || (isTls ? 443 : 80);
  const socket = await openSocket(target.hostname, port, isTls);
  const merged = {
    Host: target.host,
    "User-Agent": PLUGIN_USER_AGENT,
    Accept: "*/*",
    "Accept-Encoding": "identity",
    Connection: "close",
    ...headers
  };
  const lines = [`GET ${target.pathname}${target.search} HTTP/1.1`];
  for (const [key, value] of Object.entries(merged)) lines.push(`${key}: ${value}`);
  socket.write(`${lines.join("\r\n")}\r
\r
`);
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`请求超时（${timeout} ms）`));
    }, timeout);
  });
  try {
    const head = await Promise.race([readHead(socket), guard]);
    return pumpBody(socket, head);
  } finally {
    clearTimeout(timer);
  }
}
async function httpRequest(url, { headers = {}, redirects = 5, timeout = 6e4 } = {}) {
  let current = url;
  let response = await requestStream(current, { headers, timeout });
  for (let hop = 0; hop < redirects; hop += 1) {
    const location = response.headers.location;
    if (!REDIRECT_CODES.includes(response.statusCode) || !location) break;
    response.destroy();
    current = new URL(location, current).toString();
    response = await requestStream(current, { headers, timeout });
  }
  return response;
}
async function payloadSize(url, { attempts = 2, timeout = 1e4 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await httpRequest(url, {
        headers: { Range: "bytes=0-0", Accept: "application/octet-stream" },
        timeout
      });
      const total = /\/(\d+)$/.exec(res.headers["content-range"] || "");
      const length = Number(res.headers["content-length"]) || 0;
      const status = res.statusCode;
      res.destroy();
      if (total) return Number(total[1]);
      if (status === 200 && length > 0) return length;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3 * attempt));
  }
  return 0;
}
function partPath(archive, index) {
  return `${archive}.part${index}`;
}
function statSize(file) {
  try {
    return fs2.statSync(file).size;
  } catch {
    return 0;
  }
}

// server/src/preparation-state.ts
function note(message) {
  console.log(`[open-ai-canvas] ${message}`);
  pushLog(message);
}
var STATE_LOG_LIMIT = 10;
var STATE = {
  phase: "starting",
  stage: "启动",
  message: "正在检查运行时",
  fileName: "",
  source: "",
  endpoint: "",
  receivedBytes: 0,
  totalBytes: 0,
  speed: 0,
  attempts: 0,
  retries: 0,
  startedAt: Date.now(),
  sampledAt: 0,
  sampledBytes: 0,
  log: [],
  // 逐片进度（ADR-0011）：卡住时要能定位到具体分片，而不是只看到一个总百分比。
  chunks: [],
  error: null,
  // 机器可读的失败原因（/__canvas/state 的 code）。文案会变，code 不变：
  // 界面据此选提示、构建期据此断言，不要靠中文子串匹配。
  code: null
};
function pushLog(text2) {
  const trimmed = String(text2 ?? "").trim();
  if (!trimmed) return;
  if (STATE.log[STATE.log.length - 1]?.text === trimmed) return;
  STATE.log.push({ at: Date.now(), text: trimmed });
  if (STATE.log.length > STATE_LOG_LIMIT) STATE.log.splice(0, STATE.log.length - STATE_LOG_LIMIT);
}
function setStage(phase, stage, message) {
  STATE.phase = phase;
  STATE.stage = stage;
  if (message) STATE.message = message;
  pushLog(message || stage);
}
function fail(code, message, stage = "启动") {
  STATE.phase = "failed";
  STATE.code = code;
  STATE.stage = stage;
  STATE.message = message;
  STATE.error = message;
  pushLog(message);
}
function clearFailure() {
  STATE.code = null;
  STATE.error = null;
}
function resetTransfer(fileName, approximateBytes) {
  STATE.fileName = fileName;
  STATE.receivedBytes = 0;
  STATE.totalBytes = approximateBytes || 0;
  STATE.speed = 0;
  STATE.sampledAt = 0;
  STATE.sampledBytes = 0;
  STATE.attempts = 0;
  STATE.chunks = [];
}
function transferSpeed() {
  const now = Date.now();
  if (!STATE.sampledAt) {
    STATE.sampledAt = now;
    STATE.sampledBytes = STATE.receivedBytes;
    return STATE.speed;
  }
  const seconds = (now - STATE.sampledAt) / 1e3;
  if (seconds < 0.5) return STATE.speed;
  const delta = STATE.receivedBytes - STATE.sampledBytes;
  if (delta >= 0) STATE.speed = delta / seconds;
  STATE.sampledAt = now;
  STATE.sampledBytes = STATE.receivedBytes;
  return STATE.speed;
}
function progressSnapshot() {
  transferSpeed();
  const percent = STATE.totalBytes > 0 ? Math.min(100, STATE.receivedBytes / STATE.totalBytes * 100) : 0;
  const remaining = STATE.totalBytes > 0 ? Math.max(0, STATE.totalBytes - STATE.receivedBytes) : 0;
  return {
    phase: STATE.phase,
    code: STATE.code,
    platform: PLATFORM,
    supported: supportedPlatforms(),
    payloadVersion: MANIFEST.payloadVersion || null,
    upstream: MANIFEST.upstream?.tag ?? null,
    stage: STATE.stage,
    message: STATE.message,
    fileName: STATE.fileName,
    source: ACTIVE_PROXY ? `${ACTIVE_PROXY.host}:${ACTIVE_PROXY.port}` : "直连",
    endpoint: STATE.endpoint,
    receivedBytes: STATE.receivedBytes,
    totalBytes: STATE.totalBytes,
    percent: Math.round(percent * 10) / 10,
    speed: Math.round(STATE.speed),
    etaSeconds: STATE.speed > 0 ? Math.round(remaining / STATE.speed) : 0,
    elapsedSeconds: Math.max(0, Math.round((Date.now() - STATE.startedAt) / 1e3)),
    attempts: STATE.attempts,
    retries: STATE.retries,
    log: STATE.log.map((entry) => ({ at: entry.at, text: entry.text })),
    chunks: STATE.chunks.map((item) => ({ index: item.index, received: item.received, expected: item.expected })),
    error: STATE.error
  };
}

// server/src/runtime-paths.ts
var SERVER_DIR = null;
var GO_BINARY = null;
var WEB_DIST = null;
var PI_RUNTIME = null;
var NODE_BIN = "";
var PLUGIN_PACKAGES = null;
function setRuntimePaths(next) {
  if (next.serverDir !== void 0) SERVER_DIR = next.serverDir;
  if (next.goBinary !== void 0) GO_BINARY = next.goBinary;
  if (next.webDist !== void 0) WEB_DIST = next.webDist;
  if (next.piRuntime !== void 0) PI_RUNTIME = next.piRuntime;
  if (next.nodeBin !== void 0) NODE_BIN = next.nodeBin;
  if (next.pluginPackages !== void 0) PLUGIN_PACKAGES = next.pluginPackages;
}

// server/src/backend-process.ts
var BACKEND_PORT = 0;
var goProcess = null;
function corsOrigins() {
  const ports = [.../* @__PURE__ */ new Set([STABLE_PORT || HOST_PORT, HOST_PORT])];
  return [...new Set(ports.flatMap((port) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`]))].join(",");
}
function backendEnv() {
  return {
    ...process.env,
    CANVAS_BACKEND_ADDR: `127.0.0.1:${BACKEND_PORT}`,
    CANVAS_BACKEND_DATA_DIR: DATA_DIR,
    // 上游发布 tag 的后端没有静态承载代码，这个变量会被忽略；留着是为了将来载荷换成
    // 带 CANVAS_STATIC_DIR 支持的构建时不用再改这里。静态文件始终由 shim 先服务（ADR-0008）。
    CANVAS_STATIC_DIR: WEB_DIST,
    // 两个 origin 都要放行：稳定 origin 是页面真正的来源，宿主端口留给探针与旧标签页（ADR-0010）。
    CANVAS_CORS_ORIGINS: corsOrigins(),
    CANVAS_EXIT_WITH_PARENT: "true",
    CANVAS_PARENT_PID: String(process.pid),
    GIN_MODE: "release",
    // 公开资源基址：上传到本地存储的文件要拼出一个浏览器能取回的绝对地址，
    // 后端在它为空时直接拒绝（资源接口返回「尚未配置服务器访问地址」）。
    // ADR-0010 之前这里写的是宿主端口，于是落库的图片地址在下次启动就全部失活；
    // 现在用固定 origin，旧资源地址也不会跟着端口漂。
    CANVAS_PUBLIC_BASE_URL: PUBLIC_ORIGIN,
    ...NODE_BIN ? { CANVAS_NODE_BIN: NODE_BIN } : {},
    ...fs3.existsSync(PI_RUNTIME) ? { CANVAS_PI_RUNTIME_DIR: PI_RUNTIME } : {},
    CANVAS_RUNTIME_AUTO_INSTALL: "false",
    // ADR-0006 决策 2：画布渠道要指回本机回环上的模型桥（/bridge/v1），而后端默认把
    // 回环/私网地址当作 SSRF 风险拒掉。只放行回环字面量，不放宽成整段私网。
    CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS: "127.0.0.1,localhost",
    CANVAS_OFFICIAL_PLUGIN_DIR: PLUGIN_PACKAGES,
    CANVAS_REGISTRATION_ENABLED: "false"
  };
}
async function reserveBackendPort() {
  await new Promise((resolve, reject) => {
    const probe = net2.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      BACKEND_PORT = probe.address().port;
      probe.close(resolve);
    });
  });
}
function watchBackendOutput(chunk, sink) {
  const text2 = chunk.toString();
  sink.write(text2);
  if (goPort) return;
  const match = text2.match(/addr=(?:127\.0\.0\.1|\[::1\]|localhost):(\d+)/);
  if (!match || Number(match[1]) === 0) return;
  goPort = Number(match[1]);
  console.log(`[open-ai-canvas] Backend listening on port ${goPort}`);
  STATE.phase = "ready";
  clearFailure();
  STATE.message = "运行时已就绪";
  onBackendReady();
}
function startBackend() {
  console.log(`[open-ai-canvas] Starting backend: ${GO_BINARY}`);
  goProcess = spawn2(GO_BINARY, [], {
    env: backendEnv(),
    cwd: SERVER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  goProcess.stdout.on("data", (chunk) => watchBackendOutput(chunk, process.stdout));
  goProcess.stderr.on("data", (chunk) => watchBackendOutput(chunk, process.stderr));
  goProcess.on("error", (error) => {
    fail("backend-spawn-failed", `后端子进程拉起失败：${error.message}`, "后端启动");
    console.error(`[open-ai-canvas] Failed to spawn backend: ${error.message}`);
  });
  goProcess.on("exit", (code, signal) => {
    console.log(`[open-ai-canvas] Backend exited: code=${code} signal=${signal}`);
    if (shuttingDown) {
      process.exit(0);
    }
    if (!goPort) {
      fail("backend-exited", `后端在启动阶段退出（code=${code} signal=${signal}）`, "后端启动");
      return;
    }
    process.exit(code ?? 1);
  });
}
var goPort = null;
var backendReadyResolve = null;
var backendReady = new Promise((resolve) => {
  backendReadyResolve = resolve;
});
function onBackendReady() {
  if (backendReadyResolve) backendReadyResolve();
  backendReadyResolve = null;
}
var shuttingDown = false;
function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!goProcess || goProcess.killed) {
    process.exit(0);
  }
  try {
    goProcess.kill(signal);
  } catch {
    process.exit(0);
  }
  const force = setTimeout(() => process.exit(0), 3e3);
  force.unref?.();
}
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

// server/src/mcp-protocol-server.ts
import http2 from "node:http";
import crypto3 from "node:crypto";
import fs6 from "node:fs";

// server/src/workflow-compiler.ts
import crypto2 from "node:crypto";

// server/src/payload-source-resolution.ts
import fs5 from "node:fs";
import path5 from "node:path";

// server/src/payload-download.ts
import fs4 from "node:fs";
import path4 from "node:path";
var CHUNK_STALL_MS = 3e4;
var TRANSFER_DEADLINE_MS = 20 * 6e4;
async function downloadChunk(url, file, start, end) {
  const expected = end - start + 1;
  let have = statSize(file);
  if (have === expected) return;
  if (have > expected) {
    fs4.rmSync(file, { force: true });
    have = 0;
  }
  let lastError;
  let stalled = false;
  for (let attempt = 1; attempt <= CHUNK_ATTEMPTS; attempt += 1) {
    let response;
    let sink;
    let stallTimer;
    const from = start + have;
    try {
      response = await httpRequest(url, {
        headers: { Range: `bytes=${from}-${end}`, Accept: "application/octet-stream" },
        timeout: 45e3
      });
      if (response.statusCode !== 206) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}（不支持分段或链接已失效）`);
      }
      sink = fs4.createWriteStream(file, { flags: have > 0 ? "a" : "w" });
      await new Promise((resolve, reject) => {
        const arm = () => {
          if (stallTimer) clearTimeout(stallTimer);
          stallTimer = setTimeout(() => {
            stalled = true;
            reject(new Error(`分片停滞 ${CHUNK_STALL_MS / 1e3}s（已落盘 ${statSize(file)}/${expected}）`));
          }, CHUNK_STALL_MS);
        };
        arm();
        sink.on("finish", resolve);
        sink.on("error", reject);
        response.on("data", arm);
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("连接中断")));
        response.on("end", () => {
          if (sink) sink.end();
        });
        response.pipe(sink);
      });
      const written = statSize(file);
      if (written !== expected) throw new Error(`字节不足 ${written}/${expected}`);
      return;
    } catch (err) {
      lastError = err;
      if (sink && !sink.closed) sink.destroy();
      have = statSize(file);
      if (have > expected) {
        fs4.rmSync(file, { force: true });
        have = 0;
      }
      note(`分片 ${start}-${end} 失败：${err.message}（已落盘 ${have}/${expected}）`);
      STATE.retries += 1;
      if (stalled) throw new Error(`分片下载反复停滞，放弃分片模式：${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1e3 * attempt));
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      if (response) response.destroy();
    }
  }
  throw lastError;
}
async function mergeParts(archive, parts) {
  const sink = fs4.createWriteStream(archive);
  const finished = new Promise((resolve, reject) => {
    sink.on("finish", resolve);
    sink.on("error", reject);
  });
  try {
    for (const part of parts) {
      await new Promise((resolve, reject) => {
        const source = fs4.createReadStream(part);
        source.on("error", reject);
        source.on("end", resolve);
        source.pipe(sink, { end: false });
      });
    }
  } finally {
    sink.end();
  }
  await finished;
}
function downloadChunked(url, archive, size) {
  const chunk = Math.ceil(size / DOWNLOAD_CHUNKS);
  const ranges = [];
  for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) {
    const start = index * chunk;
    const end = Math.min(size - 1, start + chunk - 1);
    if (start <= end) ranges.push({ index, start, end });
  }
  STATE.totalBytes = size;
  setStage("downloading", "下载中", `正在下载 ${STATE.fileName}（${(size / 1048576).toFixed(0)} MB，${ranges.length} 片）`);
  STATE.chunks = ranges.map((range) => ({ index: range.index, received: statSize(partPath(archive, range.index)), expected: range.end - range.start + 1 }));
  const tick = setInterval(() => {
    let total = 0;
    for (const item of STATE.chunks) {
      item.received = statSize(partPath(archive, item.index));
      total += item.received;
    }
    STATE.receivedBytes = total;
  }, 300);
  let deadlineTimer;
  const deadline = new Promise((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      const stuck = STATE.chunks.filter((item) => item.received < item.expected).map((item) => `#${item.index} ${item.received}/${item.expected}`);
      reject(new Error(`下载超过 ${Math.round(TRANSFER_DEADLINE_MS / 6e4)} 分钟未完成，卡在：${stuck.join("、") || "未知分片"}`));
    }, TRANSFER_DEADLINE_MS);
  });
  const settled = Promise.race(
    [
      Promise.all(ranges.map((range) => downloadChunk(url, partPath(archive, range.index), range.start, range.end))),
      deadline
    ]
  ).finally(() => {
    clearInterval(tick);
    clearTimeout(deadlineTimer);
  });
  return settled.then(async () => {
    STATE.receivedBytes = size;
    await mergeParts(
      archive,
      ranges.map((range) => partPath(archive, range.index))
    );
    for (const range of ranges) fs4.rmSync(partPath(archive, range.index), { force: true });
  });
}
async function downloadPayload(url, archive) {
  STATE.attempts += 1;
  setStage("connecting", "连接下载源", `正在查询 ${STATE.fileName || path4.basename(archive)} 的大小（第 ${STATE.attempts} 次）`);
  const size = await payloadSize(url);
  if (size > 0 && statSize(archive) === size) {
    note(`归档已在本地（${size} 字节），跳过下载`);
    STATE.receivedBytes = size;
    return;
  }
  if (process.env.CANVAS_DOWNLOAD_DEBUG) note(`载荷字节数 ${size}，分 ${DOWNLOAD_CHUNKS} 片`);
  if (size > 0) {
    try {
      await downloadChunked(url, archive, size);
      if (fs4.statSync(archive).size === size) return;
      throw new Error("分片下载长度不符");
    } catch (err) {
      note(`分片下载失败（${err.message}），改用单连接重试`);
    }
  }
  note("改用单连接下载");
  const existing = statSize(archive);
  const res = await httpRequest(
    url,
    existing > 0 ? { headers: { Range: `bytes=${existing}-` } } : {}
  );
  if (res.statusCode !== 200 && res.statusCode !== 206) {
    res.resume();
    throw new Error(`运行时载荷下载失败：HTTP ${res.statusCode}（${url}）`);
  }
  const offset = res.statusCode === 206 ? existing : 0;
  const out = fs4.createWriteStream(archive, { flags: offset > 0 ? "r+" : "w", start: offset });
  let lastActivity = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > 6e4) res.destroy(new Error("下载停滞"));
  }, 5e3);
  res.on("data", () => {
    lastActivity = Date.now();
    if (size > 0) STATE.receivedBytes = Math.min(size, offset + res.bytesRead);
  });
  try {
    res.pipe(out);
    await new Promise((resolve, reject) => {
      out.on("finish", resolve);
      out.on("error", reject);
      res.on("error", reject);
      res.on("aborted", () => reject(new Error("连接中断")));
    });
  } finally {
    clearInterval(watchdog);
    res.destroy();
  }
}

// server/src/payload-source-resolution.ts
var PREFERRED_BASE = null;
var PROVISION_DIR = null;
var AGENT_DIR = null;
var ASSET_CACHE = /* @__PURE__ */ new Map();
var NETWORK_FAILURE = /超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up|TLS|停滞|连接中断/i;
function endpointOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
function readTextResponse(res, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let text2 = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(text2);
    };
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      text2 += chunk;
      if (text2.length > limit) {
        res.destroy();
        finish();
      }
    });
    res.on("end", finish);
    res.on("close", finish);
    res.on("error", reject);
    res.on("aborted", finish);
  });
}
async function resolveAssetUrl(fileName) {
  if (ASSET_CACHE.has(fileName)) return ASSET_CACHE.get(fileName);
  let resolved = null;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`;
  try {
    const res = await httpRequest(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      timeout: 12e3
    });
    if (res.statusCode === 200) {
      const payload = JSON.parse(await readTextResponse(res));
      const asset = (payload.assets || []).find((item) => item?.name === fileName);
      if (asset?.id) {
        resolved = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`;
      } else {
        note(`Release ${RELEASE_TAG} 中没有 ${fileName}`);
      }
    } else {
      res.destroy();
      note(`解析下载地址失败：HTTP ${res.statusCode}`);
    }
  } catch (err) {
    note(`解析下载地址失败：${err.message}`);
  }
  ASSET_CACHE.set(fileName, resolved);
  return resolved;
}
function mirrorPrefixes() {
  const raw = process.env.CANVAS_PAYLOAD_MIRRORS;
  if (raw === void 0) return DEFAULT_MIRROR_PREFIXES;
  const text2 = raw.trim();
  if (!text2 || /^(none|off|0|false)$/i.test(text2)) return [];
  return text2.split(",").map((item) => item.trim()).filter(Boolean).map((item) => item.endsWith("/") ? item : `${item}/`);
}
function localPayloadDirs() {
  const dirs = [];
  const explicit = (process.env.CANVAS_PAYLOAD_DIR || "").trim();
  if (explicit) dirs.push(explicit);
  dirs.push(path5.join(DATA_DIR, "payload"));
  dirs.push(path5.join(BUNDLED_DIR, "payload"));
  return dirs;
}
function findLocalFile(fileName) {
  for (const dir of localPayloadDirs()) {
    const file = path5.join(dir, fileName);
    if (statSize(file) > 0) return file;
  }
  return null;
}
function payloadBases(preferred) {
  const bases = [];
  const push = (base) => {
    const clean = String(base || "").replace(/\/+$/, "");
    if (clean && !bases.includes(clean)) bases.push(clean);
  };
  push(preferred);
  for (const prefix of mirrorPrefixes()) push(`${prefix}${PAYLOAD_BASE_URL}`);
  push(PAYLOAD_BASE_URL);
  return bases;
}
function apiFallbackAllowed() {
  return !process.env.CANVAS_PAYLOAD_BASE_URL;
}
function probeFirst(urls, { timeout = 12e3 } = {}) {
  return new Promise((resolve, reject) => {
    if (!urls.length) {
      reject(new Error("没有可用的来源"));
      return;
    }
    let pending = urls.length;
    let lastError = null;
    let settled = false;
    const fail3 = (url) => (err) => {
      if (settled) return;
      lastError = new Error(`${endpointOf(url)}：${err.message}`);
      pending -= 1;
      if (pending === 0) reject(lastError);
    };
    for (const url of urls) {
      httpRequest(url, { headers: { Accept: "application/vnd.github+json" }, timeout }).then(async (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          throw new Error(`HTTP ${res.statusCode}`);
        }
        const text2 = await readTextResponse(res);
        if (settled) return;
        settled = true;
        resolve({ url, text: text2 });
      }).catch(fail3(url));
    }
  });
}
function candidateUrls(fileName) {
  return payloadBases(PREFERRED_BASE).map((base) => `${base}/${fileName}`);
}
function describeFailure(err) {
  const text2 = err?.message || String(err);
  if (!NETWORK_FAILURE.test(text2)) return err instanceof Error ? err : new Error(text2);
  const prefixes = mirrorPrefixes();
  const tried = prefixes.length ? `镜像（${prefixes.map((prefix) => endpointOf(prefix)).join("、")}）与 ${endpointOf(PAYLOAD_BASE_URL)}` : endpointOf(PAYLOAD_BASE_URL);
  const wrapped = new Error(
    `${text2}
已尝试的来源都不可用：${tried}。以下任一方式可以继续：
  1. 点「重试」——下载支持续传，已落盘的字节不会丢；
  2. 把载荷文件放到 ${localPayloadDirs()[0]}（本地构建/离线搬运，放好后点「重试」）；
  3. 设置 CANVAS_PAYLOAD_MIRRORS 指向你自己的镜像前缀。`
  );
  wrapped.cause = err;
  return wrapped;
}
var SHA256_RE = /^[a-f0-9]{64}$/;
var manifestPromise = null;
function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function unsupportedPlatformError() {
  const published = supportedPlatforms();
  const upstream = MANIFEST.upstream?.tag ? `（对应上游 ${MANIFEST.upstream.tag}）` : "";
  return codedError(
    "platform-unsupported",
    `当前平台 ${PLATFORM} 暂无可用运行时载荷${upstream}。已发布：${published.join(", ")}。这不是安装出错，是该平台还没构建：请在已发布平台上使用，或设置 CANVAS_PAYLOAD_MANIFEST 指向自建清单。`
  );
}
async function fetchManifestText() {
  const override = (process.env.CANVAS_PAYLOAD_MANIFEST || "").trim();
  if (override) {
    const local = !/^https?:\/\//i.test(override);
    try {
      const text2 = local ? fs5.readFileSync(override, "utf8") : await readTextResponse(await httpRequest(override, { timeout: 2e4 }));
      note(`清单来自 CANVAS_PAYLOAD_MANIFEST：${override}`);
      return { text: text2, url: override };
    } catch (err) {
      const wrapped2 = describeFailure(err);
      wrapped2.code = "payload-manifest-unreadable";
      wrapped2.message = `CANVAS_PAYLOAD_MANIFEST 不可读（${override}）：${err.message}`;
      throw wrapped2;
    }
  }
  const localManifest = findLocalFile(MANIFEST_ASSET);
  if (localManifest) {
    note(`清单来自本地目录：${localManifest}`);
    return { text: fs5.readFileSync(localManifest, "utf8"), url: localManifest };
  }
  const candidates = candidateUrls(MANIFEST_ASSET);
  note(`清单来源 ${candidates.length} 个（并发探测）：${candidates.map(endpointOf).join("、")}`);
  let lastError;
  try {
    const { url, text: text2 } = await probeFirst(candidates);
    STATE.endpoint = endpointOf(url);
    PREFERRED_BASE = url.slice(0, -(MANIFEST_ASSET.length + 1));
    note(`清单来自 ${STATE.endpoint}`);
    return { text: text2, url };
  } catch (err) {
    lastError = err;
    note(`清单探测全部失败：${err.message}`);
  }
  const asset = apiFallbackAllowed() ? await resolveAssetUrl(MANIFEST_ASSET) : null;
  if (asset) {
    try {
      const res = await httpRequest(asset, {
        headers: { Accept: "application/vnd.github+json" },
        timeout: 2e4
      });
      if (res.statusCode !== 200) {
        res.resume();
        throw new Error(`HTTP ${res.statusCode}`);
      }
      STATE.endpoint = "api.github.com";
      note("清单来自 api.github.com 资产地址");
      return { text: await readTextResponse(res), url: asset };
    } catch (err) {
      lastError = err;
      note(`API 资产地址不可用：${err.message}`);
    }
  }
  const wrapped = describeFailure(lastError ?? new Error("没有可用的清单来源"));
  wrapped.code = "payload-unreachable";
  throw wrapped;
}
function parseManifest(text2) {
  let data;
  try {
    data = JSON.parse(text2);
  } catch {
    throw codedError("payload-manifest-invalid", "发布清单不是合法 JSON");
  }
  if (data?.schemaVersion !== 1) {
    throw codedError("payload-manifest-invalid", `发布清单 schemaVersion 应为 1，实际 ${data?.schemaVersion}`);
  }
  const payloadVersion = String(data.payloadVersion ?? "");
  if (!/^[0-9A-Za-z._-]{1,32}$/.test(payloadVersion)) {
    throw codedError("payload-manifest-invalid", `发布清单 payloadVersion 非法：${payloadVersion || "（空）"}`);
  }
  const platforms = {};
  for (const [platform, entry] of Object.entries(data.platforms ?? {})) {
    if (!TARGET_PLATFORMS.includes(platform)) {
      note(`清单里的平台 ${platform} 不在申报集合内，忽略`);
      continue;
    }
    const read = (kind, required) => {
      const spec = entry?.[kind];
      if (!spec) {
        if (required) throw codedError("payload-manifest-invalid", `${platform} 缺少 ${kind} 条目`);
        return null;
      }
      const file = String(spec.file ?? "");
      const sha256 = String(spec.sha256 ?? "");
      if (!file || file.includes("/") || file.includes("\\")) {
        throw codedError("payload-manifest-invalid", `${platform}.${kind}.file 必须是纯文件名：${file}`);
      }
      if (!SHA256_RE.test(sha256)) {
        throw codedError("payload-manifest-invalid", `${platform}.${kind}.sha256 不是 64 位小写十六进制`);
      }
      return { file, sha256, bytes: Number(spec.bytes) || 0 };
    };
    platforms[platform] = { payload: read("payload", true), agent: read("agent", false) };
  }
  return { payloadVersion, upstream: data.upstream ?? null, platforms, source: MANIFEST.source };
}
async function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    const { text: text2, url } = await fetchManifestText();
    const parsed = parseManifest(text2);
    MANIFEST.payloadVersion = parsed.payloadVersion;
    MANIFEST.upstream = parsed.upstream;
    MANIFEST.platforms = parsed.platforms;
    MANIFEST.source = endpointOf(url);
    PROVISION_DIR = path5.join(DATA_DIR, "runtime", MANIFEST.payloadVersion);
    AGENT_DIR = path5.join(DATA_DIR, "runtime", `agent-${MANIFEST.payloadVersion}`);
    const upstream = MANIFEST.upstream?.tag ? `，上游 ${MANIFEST.upstream.tag}` : "";
    note(`发布清单 ${MANIFEST.payloadVersion}${upstream}，平台 ${Object.keys(MANIFEST.platforms).join(", ")}`);
    return MANIFEST;
  })();
  try {
    return await manifestPromise;
  } catch (err) {
    manifestPromise = null;
    throw err;
  }
}
async function downloadFromCandidates(candidates, archive) {
  let lastError;
  for (const [index, candidate] of candidates.entries()) {
    STATE.endpoint = endpointOf(candidate);
    note(`下载来源 ${index + 1}/${candidates.length}：${STATE.endpoint}`);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await downloadPayload(candidate, archive);
        return void 0;
      } catch (err) {
        lastError = err;
        STATE.retries += 1;
        note(`下载中断（${err.message}），第 ${attempt}/2 次`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1e3 * attempt));
      }
    }
  }
  return lastError ?? new Error("没有可用的下载来源");
}

// server/src/canvas-node-contract.ts
var BUILTIN_NODE_TYPES = [
  "image",
  "text",
  "drawing",
  "script",
  "skill",
  "config",
  "video",
  "audio",
  "frame",
  "markdown",
  "svg",
  "html",
  "panorama",
  "compare",
  "chart",
  "colorgrade",
  "media-conversion",
  "batch-table"
];
var NODE_SCHEMAS = {
  image: { fields: ["content", "storageKey", "prompt", "model", "parameters", "generationTaskId"], description: "Image generation node." },
  text: { fields: ["content", "prompt", "model"], description: "Text generation node." },
  config: { fields: ["model", "parameters", "provider"], description: "Generation configuration node. Connect to image/text/video nodes to set their model." },
  video: { fields: ["content", "storageKey", "prompt", "model", "referenceImages"], description: "Video generation node." },
  audio: { fields: ["content", "storageKey", "prompt", "model"], description: "Audio generation node." },
  script: { fields: ["shots", "title"], description: "Storyboard script node." },
  frame: { fields: ["image", "duration"], description: "Timeline frame node." },
  markdown: { fields: ["content"], description: "Markdown text node." },
  svg: { fields: ["content"], description: "SVG vector node." },
  html: { fields: ["content"], description: "HTML embed node." },
  drawing: { fields: ["content", "storageKey"], description: "Drawing canvas node." },
  skill: { fields: ["skillId", "config"], description: "Skill node." },
  panorama: { fields: ["content", "storageKey"], description: "Panorama image node." },
  compare: { fields: ["images"], description: "Image comparison node." },
  chart: { fields: ["config", "data"], description: "Chart node." },
  colorgrade: { fields: ["lut", "intensity"], description: "Color grading node." },
  "media-conversion": { fields: ["format", "input"], description: "Media format conversion node." },
  "batch-table": { fields: ["rows", "columns"], description: "Batch processing table node." }
};
var LAYOUT_STEP_X = 400;
var LAYOUT_STEP_Y = 280;

// server/src/workflow-compiler.ts
var LAST_WORKFLOW = null;
function setLastWorkflow(value) {
  LAST_WORKFLOW = value;
}
function compileWorkflow(workflow, existing) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  if (nodes.length === 0) throw codedError("workflow-empty", "workflow.nodes 不能为空");
  const byKey = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const key = String(node?.key ?? "");
    if (!key) throw codedError("workflow-invalid-node", "每个节点都需要 key（用于连线与幂等）");
    if (byKey.has(key)) throw codedError("workflow-invalid-node", `节点 key 重复：${key}`);
    if (!BUILTIN_NODE_TYPES.includes(node.type)) {
      throw codedError(
        "unknown_node_type",
        `unknown_node_type: ${node.type}（内置类型：${BUILTIN_NODE_TYPES.join(", ")}；插件节点请先用 add_node 确认）`
      );
    }
    byKey.set(key, node);
  }
  const parents = new Map(
    nodes.map((node) => [node.key, [...node.depends_on ?? []]])
  );
  for (const edge of workflow?.edges ?? []) {
    if (!byKey.has(edge?.from) || !byKey.has(edge?.to)) {
      throw codedError("workflow-invalid-edge", `连线引用了不存在的节点：${edge?.from} → ${edge?.to}`);
    }
    if (edge.to === edge.from) throw codedError("workflow-cycle", "节点不能连自己");
    parents.get(edge.to).push(edge.from);
  }
  const depth = /* @__PURE__ */ new Map();
  const visiting = /* @__PURE__ */ new Set();
  const depthOf = (key) => {
    if (depth.has(key)) return depth.get(key);
    if (visiting.has(key)) throw codedError("workflow-cycle", `依赖成环：${[...visiting, key].join(" → ")}`);
    visiting.add(key);
    let value = 0;
    for (const parent of parents.get(key) ?? []) value = Math.max(value, depthOf(parent) + 1);
    visiting.delete(key);
    depth.set(key, value);
    return value;
  };
  const existingNodes = Array.isArray(existing?.nodes) ? existing.nodes : [];
  const priorByKey = new Map(
    existingNodes.filter((node) => node?.metadata?.__key).map((node) => [node.metadata.__key, node])
  );
  const priorEdges = new Set(
    (existing?.connections ?? []).map((conn) => `${conn.fromNodeId}->${conn.toNodeId}`)
  );
  const rows = /* @__PURE__ */ new Map();
  const operations = [];
  const mapping = {};
  for (const node of nodes) {
    const column = depthOf(node.key);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    const position = node.position ?? { x: column * LAYOUT_STEP_X, y: row * LAYOUT_STEP_Y };
    const metadata = { ...node.metadata ?? {}, __key: node.key };
    const prior = priorByKey.get(node.key);
    if (prior) {
      mapping[node.key] = prior.id;
      operations.push({
        type: "patch_node",
        id: prior.id,
        patch: { title: node.title ?? prior.title, position, metadata }
      });
      continue;
    }
    const id = crypto2.randomUUID();
    mapping[node.key] = id;
    operations.push({
      type: "create_node",
      id,
      node: {
        id,
        type: node.type,
        title: node.title || node.type,
        position,
        ...node.width !== void 0 && { width: node.width },
        ...node.height !== void 0 && { height: node.height },
        metadata
      }
    });
  }
  for (const edge of workflow?.edges ?? []) {
    const signature = `${mapping[edge.from]}->${mapping[edge.to]}`;
    if (priorEdges.has(signature)) continue;
    const id = crypto2.randomUUID();
    operations.push({
      type: "create_connection",
      id,
      connection: { id, fromNodeId: mapping[edge.from], toNodeId: mapping[edge.to] }
    });
  }
  return { operations, mapping, depth: Object.fromEntries(depth) };
}

// server/src/mcp-tool-catalog.ts
var MCP_TOOLS = [
  // --- 画布项目管理 ---
  {
    name: "list_canvas_projects",
    description: "List all canvas projects in the user's library.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 20)" }
      }
    }
  },
  {
    name: "get_canvas_project",
    description: "Get a canvas project by ID, including its nodes, connections, and revision.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" }
      },
      required: ["canvas_id"]
    }
  },
  {
    name: "create_canvas_project",
    description: "Create a new canvas project and return its id, title, revision and the browser URL to open it. Requires a captured browser session: open the canvas in a browser and log in once first. If canvas_id is omitted, a UUID is generated.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Canvas title (default: 'Untitled')" },
        canvas_id: { type: "string", description: "Optional canvas ID (UUID). If omitted, server generates one." }
      }
    }
  },
  {
    name: "delete_canvas_project",
    description: "Delete a canvas project by ID.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" }
      },
      required: ["canvas_id"]
    }
  },
  // --- 节点操作 ---
  {
    name: "add_node",
    description: "Add a node to a canvas project. metadata is a free-form JSON object; call get_node_schema first to know which fields the node type expects.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        type: { type: "string", description: "Node type (e.g. image, text, config, video)" },
        title: { type: "string", description: "Node display title" },
        position: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          description: "Node position on canvas (default {x:0,y:0})"
        },
        width: { type: "number", description: "Node width in px" },
        height: { type: "number", description: "Node height in px" },
        metadata: { type: "object", description: "Node-specific metadata (call get_node_schema for the schema)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" }
      },
      required: ["canvas_id", "type"]
    }
  },
  {
    name: "update_node",
    description: "Update an existing node's fields (patch operation).",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to update" },
        patch: { type: "object", description: "Fields to patch (title, position, width, height, metadata, etc.)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" }
      },
      required: ["canvas_id", "node_id", "patch"]
    }
  },
  {
    name: "delete_node",
    description: "Delete a node from a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" }
      },
      required: ["canvas_id", "node_id"]
    }
  },
  {
    name: "list_node_types",
    description: "List all available node types (built-in + plugin-registered).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_node_schema",
    description: "Get the metadata schema for a given node type, so you know what fields to pass to add_node.",
    inputSchema: {
      type: "object",
      properties: {
        node_type: { type: "string", description: "Node type (e.g. image, text, config)" }
      },
      required: ["node_type"]
    }
  },
  // --- 连接操作 ---
  {
    name: "connect_nodes",
    description: "Create a connection between two nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        from_node_id: { type: "string", description: "Source node ID" },
        to_node_id: { type: "string", description: "Target node ID" },
        from_handle: { type: "string", description: "Source handle ID (optional)" },
        to_handle: { type: "string", description: "Target handle ID (optional)" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" }
      },
      required: ["canvas_id", "from_node_id", "to_node_id"]
    }
  },
  {
    name: "delete_connection",
    description: "Delete a connection between nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        connection_id: { type: "string", description: "Connection ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" }
      },
      required: ["canvas_id", "connection_id"]
    }
  },
  {
    name: "list_connections",
    description: "List all connections in a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" }
      },
      required: ["canvas_id"]
    }
  },
  // --- 生成与资源 ---
  {
    name: "run_generation",
    description: "Trigger a generation task on a node (image/text/video/audio). Polls until completion or timeout. Returns task_id, status, result_url and resource_id.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to generate from" },
        prompt: { type: "string", description: "Generation prompt" },
        timeout_seconds: { type: "number", description: "Max wait time in seconds (default 120)" }
      },
      required: ["canvas_id", "node_id", "prompt"]
    }
  },
  {
    name: "list_assets",
    description: "List assets (images/videos/audio) in the user's resource library.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by type: image, video, audio (optional)" },
        limit: { type: "number", description: "Max items (default 50)" }
      }
    }
  },
  {
    name: "get_canvas_state",
    description: "Get the full canvas state: revision, nodes, and connections. Use before write operations for conflict detection.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" }
      },
      required: ["canvas_id"]
    }
  },
  // --- 批量操作 ---
  {
    name: "apply_operations",
    description: "Apply a batch of canvas operations directly. Escape hatch for advanced use cases or operation types not covered by dedicated tools.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        operations: {
          type: "array",
          description: "Array of CanvasOperation objects (create_node, patch_node, remove_node, create_connection, remove_connection, set_field, etc.)",
          items: { type: "object" }
        },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" }
      },
      required: ["canvas_id", "operations"]
    }
  },
  // --- 声明式编排（ADR-0007）---
  {
    name: "apply_workflow",
    description: 'Apply a whole workflow in ONE request: nodes + edges described declaratively, laid out automatically, validated before submit, and idempotent by node key. Use this instead of many add_node/connect_nodes calls when building a multi-step workflow. Returns the key→node_id mapping and the canvas URL. Generation does NOT run unless run is true, and even then only for nodes marked {"run": true}.',
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        base_revision: { type: "number", description: "Expected canvas revision; mismatches return revision_conflict instead of overwriting" },
        run: { type: "boolean", description: "Run generation for nodes marked {run:true} after applying (default false — generating costs money)" },
        workflow: {
          type: "object",
          description: "{ nodes: [{key, type, title?, position?, width?, height?, metadata?, depends_on?, run?}], edges: [{from, to, kind?}] }",
          properties: {
            nodes: { type: "array", items: { type: "object" } },
            edges: { type: "array", items: { type: "object" } }
          },
          required: ["nodes"]
        }
      },
      required: ["canvas_id", "workflow"]
    }
  },
  {
    name: "export_workflow",
    description: "Read a canvas back as the same declarative structure apply_workflow accepts, so an existing layout can be reused as a template.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" }
      },
      required: ["canvas_id"]
    }
  },
  {
    name: "list_workspace_projects",
    description: "List the workspace-level projects (GET /api/projects) — the container a canvas can belong to, distinct from the canvas list itself.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 50)" }
      }
    }
  },
  {
    name: "get_task",
    description: "Read one generation task by ID: status, progress and result URL. Use it to continue polling after run_generation times out.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID returned by run_generation" }
      },
      required: ["task_id"]
    }
  }
];
var MCP_TOOL_GROUPS = {
  list_canvas_projects: "projects",
  get_canvas_project: "projects",
  create_canvas_project: "projects",
  delete_canvas_project: "projects",
  add_node: "nodes",
  update_node: "nodes",
  delete_node: "nodes",
  list_node_types: "nodes",
  get_node_schema: "nodes",
  connect_nodes: "connections",
  delete_connection: "connections",
  list_connections: "connections",
  run_generation: "generation",
  list_assets: "generation",
  get_canvas_state: "generation",
  apply_operations: "batch",
  apply_workflow: "batch",
  export_workflow: "batch",
  list_workspace_projects: "workspace",
  get_task: "workspace"
};

// server/src/mcp-protocol-server.ts
function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function errorResult(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}
function canvasUrl(canvasId) {
  return `${PUBLIC_ORIGIN}/canvas/${canvasId}`;
}
function withCanvasUrl(result, canvasId) {
  if (!result || result.isError) return result;
  const raw = result.content?.[0]?.text;
  if (typeof raw !== "string") return result;
  try {
    const parsed = JSON.parse(raw);
    const payload = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
    payload.url = canvasUrl(canvasId);
    return jsonResult(parsed.data ? parsed : payload);
  } catch {
    return result;
  }
}
async function callCanvasApi(method, pathname, body) {
  if (!SESSION_TOKEN) {
    return errorResult("No active session. Please open the canvas in a browser and log in first. The session is captured automatically after login.");
  }
  return new Promise((resolve) => {
    const req = http2.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: `open_ai_canvas_session=${SESSION_TOKEN}`
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          if (res.statusCode === 401) {
            setSessionToken(null);
            try {
              fs6.unlinkSync(SESSION_FILE);
            } catch {
            }
            resolve(errorResult("Session expired. Please open the canvas in a browser and log in again."));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            resolve(errorResult(`API ${res.statusCode}: ${data || "request failed"}`));
            return;
          }
          resolve({ content: [{ type: "text", text: data || `Status: ${res.statusCode}` }] });
        });
      }
    );
    req.on("error", (err) => {
      resolve(errorResult(`API error: ${err.message}`));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function rawCanvasApi(method, pathname, body) {
  if (!SESSION_TOKEN) return { status: 401, body: { code: "canvas-login-required" } };
  return new Promise((resolve) => {
    const req = http2.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: { "Content-Type": "application/json", Cookie: `open_ai_canvas_session=${SESSION_TOKEN}` }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          if (res.statusCode === 401) {
            setSessionToken(null);
            try {
              fs6.unlinkSync(SESSION_FILE);
            } catch {
            }
            resolve({ status: 401, body: { code: "canvas-login-required" } });
            return;
          }
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on("error", (err) => resolve({ status: 502, body: { code: "canvas-unreachable", message: err.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function runtimeNodeTypes() {
  const { status, body } = await rawCanvasApi("GET", "/api/agent/capabilities");
  if (status !== 200) return null;
  const types = body?.nodeTypes;
  if (!Array.isArray(types)) return null;
  return types.filter((name) => typeof name === "string" && name);
}
async function bridgeAdminChannels(method, channelId, payload) {
  if (method === "GET") {
    const result = await rawCanvasApi("GET", "/api/admin/channels?page=1&limit=100");
    return { status: result.status, body: result.body };
  }
  if (method === "POST") {
    return rawCanvasApi("POST", "/api/admin/channels", payload);
  }
  if (method === "PATCH" && channelId) {
    return rawCanvasApi("PATCH", `/api/admin/channels/${channelId}`, payload);
  }
  return { status: 400, body: { code: "bridge-bad-request", message: "unsupported channel operation" } };
}
async function applyCanvasOperations(canvasId, operations, baseRevision) {
  const body = { operations };
  if (baseRevision !== void 0) body.baseRevision = baseRevision;
  body.mutationId = crypto3.randomUUID();
  return callCanvasApi("PATCH", `/api/canvas-projects/${canvasId}/operations`, body);
}
async function fetchCanvasDocument(canvasId) {
  const result = await callCanvasApi("GET", `/api/canvas-projects/${canvasId}`);
  if (result.isError) return result;
  try {
    const parsed = JSON.parse(result.content[0].text);
    return parsed;
  } catch {
    return errorResult("Failed to parse canvas project response.");
  }
}
function inferGenerationMode(nodeType) {
  switch (nodeType) {
    case "image":
      return "image";
    case "text":
      return "text";
    case "video":
      return "video";
    case "audio":
      return "audio";
    default:
      return "image";
  }
}
async function handleMcpToolCall(name, args) {
  switch (name) {
    // --- 画布项目管理 ---
    case "list_canvas_projects": {
      const params = new URLSearchParams();
      if (args.page) params.set("page", String(args.page));
      if (args.page_size) params.set("pageSize", String(args.page_size));
      return callCanvasApi("GET", `/api/canvas-projects?${params.toString()}`);
    }
    case "get_canvas_project":
      return callCanvasApi("GET", `/api/canvas-projects/${args.canvas_id}`);
    case "create_canvas_project": {
      const canvasId = args.canvas_id || crypto3.randomUUID();
      const title = args.title || "Untitled";
      const created = await applyCanvasOperations(canvasId, [
        { type: "create_canvas", id: canvasId, patch: { title } }
      ]);
      return withCanvasUrl(created, canvasId);
    }
    case "delete_canvas_project":
      return callCanvasApi("DELETE", `/api/canvas-projects/${args.canvas_id}`);
    // --- 节点操作 ---
    case "add_node": {
      const nodeId = crypto3.randomUUID();
      const operation = {
        type: "create_node",
        id: nodeId,
        node: {
          id: nodeId,
          type: args.type,
          title: args.title || args.type,
          position: args.position || { x: 0, y: 0 },
          ...args.width !== void 0 && { width: args.width },
          ...args.height !== void 0 && { height: args.height },
          metadata: args.metadata || {}
        }
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }
    case "update_node": {
      const operation = {
        type: "patch_node",
        id: args.node_id,
        patch: args.patch
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }
    case "delete_node": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_node", id: args.node_id }
      ], args.base_revision);
    }
    case "list_node_types": {
      const runtime = await runtimeNodeTypes();
      const merged = [.../* @__PURE__ */ new Set([...BUILTIN_NODE_TYPES, ...runtime ?? []])];
      return jsonResult({
        // builtin 是插件能给出字段 schema 的那批；runtime 是后端本次自报的完整清单。
        builtin: BUILTIN_NODE_TYPES,
        runtime: runtime ?? [],
        all: merged,
        discovered: runtime !== null,
        note: runtime === null ? "The canvas backend did not expose /api/agent/capabilities, so only the builtin list is shown. Node types added by the running canvas are missing here." : "`runtime` is the canvas backend's own node-type list; `builtin` is the subset this plugin can describe with a field schema."
      });
    }
    case "get_node_schema": {
      const schema = NODE_SCHEMAS[args.node_type];
      if (schema) return jsonResult({ node_type: args.node_type, source: "builtin", available: true, ...schema });
      const runtime = await runtimeNodeTypes();
      const registered = Array.isArray(runtime) && runtime.includes(args.node_type);
      return jsonResult({
        node_type: args.node_type,
        available: false,
        registered,
        source: registered ? "runtime" : "none",
        note: registered ? "This node type is registered by the canvas runtime, but the backend exposes no per-type field schema. Read an existing node of this type (get_canvas_project) to see its shape." : "Unknown node type: neither in the builtin schema set nor reported by the canvas backend."
      });
    }
    // --- 声明式编排（ADR-0007）---
    case "apply_workflow": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      const existing = { nodes: payload.nodes || [], connections: payload.connections || [] };
      let compiled;
      try {
        compiled = compileWorkflow(args.workflow, existing);
      } catch (err) {
        return errorResult(`${err.code || "workflow-invalid"}: ${err.message}`);
      }
      if (compiled.operations.length === 0) {
        return jsonResult({ applied: false, reason: "nothing-to-do", mapping: compiled.mapping, depth: compiled.depth });
      }
      const baseRevision = args.base_revision ?? payload.revision;
      const applied = await applyCanvasOperations(args.canvas_id, compiled.operations, baseRevision);
      if (applied.isError) {
        const text2 = applied.content?.[0]?.text ?? "";
        if (/\b409\b|revision/i.test(text2)) {
          return errorResult(`revision_conflict: ${text2}（当前 revision ${payload.revision}，请重新读取后再提交）`);
        }
        return applied;
      }
      const runTargets = args.run ? (args.workflow.nodes ?? []).filter((node) => node?.run === true) : [];
      const results = [];
      for (const node of runTargets) {
        const nodeId = compiled.mapping[node.key];
        if (!nodeId) continue;
        const result = await handleMcpToolCall("run_generation", {
          canvas_id: args.canvas_id,
          node_id: nodeId,
          prompt: node.metadata?.prompt || node.metadata?.content || node.title || ""
        });
        results.push({ key: node.key, node_id: nodeId, ...result.isError ? { error: result.content[0].text } : {} });
      }
      setLastWorkflow({
        at: Date.now(),
        canvasId: args.canvas_id,
        revision: baseRevision + 1,
        nodes: (args.workflow.nodes ?? []).length,
        edges: (args.workflow.edges ?? []).length,
        operations: compiled.operations.length,
        generationCount: results.length,
        idempotent: compiled.operations.every((operation) => operation.type !== "create_node")
      });
      return withCanvasUrl(
        jsonResult({
          applied: true,
          revision: baseRevision + 1,
          nodes: (args.workflow.nodes ?? []).length,
          edges: (args.workflow.edges ?? []).length,
          operations: compiled.operations.length,
          mapping: compiled.mapping,
          depth: compiled.depth,
          ...results.length > 0 && { generations: results }
        }),
        args.canvas_id
      );
    }
    case "export_workflow": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      const nodes = payload.nodes || [];
      const connections = payload.connections || [];
      const keyOf = (node) => node?.metadata?.__key || node.id;
      const workflow = {
        nodes: nodes.map((node) => ({
          key: keyOf(node),
          type: node.type,
          title: node.title,
          position: node.position,
          ...node.width !== void 0 && { width: node.width },
          ...node.height !== void 0 && { height: node.height },
          metadata: Object.fromEntries(Object.entries(node.metadata ?? {}).filter(([name2]) => name2 !== "__key"))
        })),
        edges: connections.map((conn) => ({
          from: keyOf(nodes.find((node) => node.id === conn.fromNodeId) ?? { id: conn.fromNodeId }),
          to: keyOf(nodes.find((node) => node.id === conn.toNodeId) ?? { id: conn.toNodeId })
        }))
      };
      return jsonResult({ revision: payload.revision, workflow });
    }
    // --- 连接操作 ---
    case "connect_nodes": {
      const connectionId = crypto3.randomUUID();
      return applyCanvasOperations(args.canvas_id, [
        {
          type: "create_connection",
          id: connectionId,
          connection: {
            id: connectionId,
            fromNodeId: args.from_node_id,
            toNodeId: args.to_node_id,
            ...args.from_handle && { fromHandleId: args.from_handle },
            ...args.to_handle && { toHandleId: args.to_handle }
          }
        }
      ], args.base_revision);
    }
    case "delete_connection": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_connection", id: args.connection_id }
      ], args.base_revision);
    }
    case "list_connections": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const connections = doc.project?.payload?.connections || doc.connections || [];
      return jsonResult({ connections });
    }
    // --- 生成与资源 ---
    case "run_generation": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const nodes = doc.project?.payload?.nodes || doc.nodes || [];
      const node = nodes.find((n) => n.id === args.node_id);
      if (!node) return errorResult(`Node ${args.node_id} not found in canvas.`);
      const mode = inferGenerationMode(node.type);
      const config = node.metadata?.config || node.metadata || {};
      const model = config.model || "";
      const taskBody = {
        type: `canvas_${mode}`,
        operation: mode,
        prompt: args.prompt,
        ...model && { model },
        input: { mode, prompt: args.prompt, config }
      };
      const taskResult = await callCanvasApi("POST", "/api/tasks", taskBody);
      if (taskResult.isError) return taskResult;
      let task;
      try {
        task = JSON.parse(taskResult.content[0].text);
      } catch {
        return errorResult("Failed to parse task creation response.");
      }
      const taskId = task.id;
      if (!taskId) return errorResult("Task creation did not return an id.");
      const timeoutMs = (args.timeout_seconds || 120) * 1e3;
      const deadline = Date.now() + timeoutMs;
      const pollIntervalMs = 2e3;
      let finalResult = null;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const statusResult = await callCanvasApi("GET", `/api/tasks/${taskId}`);
        if (statusResult.isError) return statusResult;
        let status;
        try {
          status = JSON.parse(statusResult.content[0].text);
        } catch {
          continue;
        }
        finalResult = status;
        const statusLower = String(status.status || "").toLowerCase();
        if (["succeeded", "completed", "success", "failed", "cancelled", "canceled"].includes(statusLower)) {
          break;
        }
      }
      if (!finalResult) {
        return jsonResult({ task_id: taskId, status: "timeout", note: "Task did not complete within the timeout. Use get_task to check later." });
      }
      const resultUrl = finalResult.outputUrl || finalResult.resultUrl || finalResult.url || finalResult.output?.url || null;
      const resourceId = finalResult.resourceId || finalResult.outputResourceId || finalResult.output?.resourceId || null;
      return jsonResult({
        task_id: taskId,
        status: finalResult.status,
        result_url: resultUrl,
        resource_id: resourceId,
        raw: finalResult
      });
    }
    case "list_assets": {
      const params = new URLSearchParams();
      if (args.type) params.set("type", args.type);
      if (args.limit) params.set("limit", String(args.limit));
      return callCanvasApi("GET", `/api/resources?${params.toString()}`);
    }
    case "get_canvas_state": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      return jsonResult({
        revision: payload.revision ?? doc.project?.revision,
        nodes: payload.nodes || [],
        connections: payload.connections || []
      });
    }
    // --- 工作区与任务（ADR-0002 决策 6、ADR-0001 决策 7）---
    case "list_workspace_projects": {
      const query = new URLSearchParams();
      query.set("page", String(args.page ?? 1));
      query.set("pageSize", String(args.page_size ?? 50));
      return callCanvasApi("GET", `/api/projects?${query.toString()}`);
    }
    case "get_task": {
      if (!args.task_id) return errorResult("task_id is required");
      return callCanvasApi("GET", `/api/tasks/${encodeURIComponent(args.task_id)}`);
    }
    // --- 批量操作 ---
    case "apply_operations":
      return applyCanvasOperations(args.canvas_id, args.operations, args.base_revision);
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}
function handleMcpRequest(req, res) {
  let body = "";
  req.on("data", (chunk) => body += chunk);
  req.on("end", async () => {
    let rpc;
    try {
      rpc = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }
    const { method, id, params } = rpc;
    if (method === "initialize") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "open-ai-canvas", version: "0.1.0" },
            capabilities: { tools: {} }
          }
        })
      );
      return;
    }
    if (method === "tools/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } }));
      return;
    }
    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params || {};
      const result = await handleMcpToolCall(name, toolArgs || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }));
  });
}
var MCP_WAIT_MS = 9e4;
function waitForBackend(timeoutMs) {
  if (goPort) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    backendReady.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// server/src/service-routes.ts
import fs11 from "node:fs";
import path11 from "node:path";

// server/src/preparation-progress-page.ts
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function progressPage() {
  const failed = STATE.phase === "failed";
  const title = failed ? "运行时准备失败" : "正在准备 Open AI Canvas";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#fafafa;color:#18181b;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{width:min(560px,calc(100vw - 64px))}
h1{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.sub{margin:0;color:#a1a1aa;font-size:12.5px;line-height:1.5}
.status{margin:28px 0 0;display:flex;align-items:baseline;justify-content:space-between;
font-size:12px;color:#52525b;gap:16px}
#stage{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{margin:9px 0 0;height:4px;border-radius:999px;background:#ececee;overflow:hidden}
.bar{height:100%;width:0;background:#18181b;transition:width .4s cubic-bezier(.4,0,.2,1)}
.bar.idle{animation:breathe 1.8s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.2}50%{opacity:.65}}
.facts{margin:11px 0 0;display:flex;flex-wrap:wrap;gap:18px;color:#a1a1aa;font-size:12px;
font-variant-numeric:tabular-nums}
.facts span:empty{display:none}
.msg{margin:7px 0 0;color:#52525b;font-size:12px;line-height:1.55;word-break:break-word}
.actions{margin:24px 0 0;display:flex;gap:10px}
.log{margin:32px 0 0;color:#a1a1aa;font:11.5px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;
max-height:160px;overflow:hidden}
.log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.err{margin:28px 0 0;color:#b91c1c;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;
white-space:pre-wrap;word-break:break-word}
button{margin:0;padding:8px 18px;border:0;border-radius:8px;background:#18181b;color:#fff;
font:inherit;font-size:13px;cursor:pointer}
button.ghost{background:transparent;color:#71717a;box-shadow:inset 0 0 0 1px #e4e4e7}
button[disabled]{opacity:.45;cursor:default}
@media (prefers-color-scheme:dark){
body{background:#09090b;color:#fafafa}
.track{background:#27272a}.bar{background:#fafafa}
button{background:#fafafa;color:#18181b}
button.ghost{background:transparent;color:#a1a1aa;box-shadow:inset 0 0 0 1px #3f3f46}
.err{color:#f87171}
}
</style>
</head>
<body>
<div class="wrap">
  <h1 id="title">${title}</h1>
  <p class="sub" id="sub">首次启动需要下载运行时载荷，完成后自动打开画布</p>
  <div class="status"><span id="stage">${escapeHtml(STATE.stage)}</span><span id="pct"></span></div>
  <div class="track"><div class="bar${STATE.totalBytes > 0 ? "" : " idle"}" id="bar"></div></div>
  <p class="msg" id="msg">${escapeHtml(STATE.message)}</p>
  <div class="facts">
    <span id="file"></span><span id="bytes"></span><span id="speed"></span>
    <span id="eta"></span><span id="elapsed"></span><span id="retries"></span><span id="host"></span>
  </div>
  <div class="log" id="log"></div>
  <pre class="err" id="err"${failed ? "" : " hidden"}>${escapeHtml(STATE.error ?? "")}</pre>
  <div class="actions"><button id="retry"${failed ? "" : " hidden"}>重试 / Retry</button><button id="copy" class="ghost">复制诊断信息</button></div>
</div>
<script>
const bar=document.getElementById('bar'),pct=document.getElementById('pct'),
stageEl=document.getElementById('stage'),bytesEl=document.getElementById('bytes'),
speedEl=document.getElementById('speed'),etaEl=document.getElementById('eta'),
fileEl=document.getElementById('file'),elapsedEl=document.getElementById('elapsed'),
retriesEl=document.getElementById('retries'),hostEl=document.getElementById('host'),
msgEl=document.getElementById('msg'),subEl=document.getElementById('sub'),
logEl=document.getElementById('log'),errEl=document.getElementById('err'),
titleEl=document.getElementById('title'),retry=document.getElementById('retry'),
copy=document.getElementById('copy');
let last=null;
function fmt(n){if(!n)return '0 B';if(n<1024)return n+' B';
if(n<1048576)return (n/1024).toFixed(0)+' KB';
if(n<1073741824)return (n/1048576).toFixed(1)+' MB';
return (n/1073741824).toFixed(2)+' GB'}
function dur(s){if(!s||s<1)return '';if(s<60)return s+' 秒';
const m=Math.floor(s/60),r=s%60;return r?m+' 分 '+r+' 秒':m+' 分'}
function render(p){
  last=p;
  stageEl.textContent=p.stage||'';
  msgEl.textContent=p.message||'';
  fileEl.textContent=p.fileName||'';
  if(p.totalBytes>0){
    bar.classList.remove('idle');
    bar.style.width=p.percent+'%';
    pct.textContent=Math.round(p.percent)+'%';
    bytesEl.textContent=fmt(p.receivedBytes)+' / '+fmt(p.totalBytes);
  }else{
    // 总长度还不知道时也不能看着像死机：条动起来，右侧给出已收到的字节。
    bar.classList.add('idle');bar.style.width='100%';
    pct.textContent=p.receivedBytes?fmt(p.receivedBytes):'';
    bytesEl.textContent=p.receivedBytes?fmt(p.receivedBytes)+' 已接收':'';
  }
  speedEl.textContent=p.speed>0?fmt(p.speed)+'/s':'';
  etaEl.textContent=p.etaSeconds>0?'剩余约 '+dur(p.etaSeconds):'';
  elapsedEl.textContent=p.elapsedSeconds?'已用 '+dur(p.elapsedSeconds):'';
  retriesEl.textContent=p.attempts>1||p.retries?'尝试 '+p.attempts+' 次 / 重试 '+p.retries+' 次':'';
  hostEl.textContent=p.endpoint?(p.endpoint+(p.source&&p.source!=='直连'?' · '+p.source:'')):'';
  logEl.innerHTML='';
  (p.log||[]).forEach(function(e){const d=document.createElement('div');d.textContent=e.text;logEl.appendChild(d)});
}
async function tick(){
  try{
    const r=await fetch('/__canvas/progress',{cache:'no-store'});
    // 就绪那一刻代理会把所有路径交给上游应用，这里再拿到的是 HTML 而不是进度 JSON：
    // 这本身就是「可以进画布了」的信号，直接跳转，别把人留在进度页上。
    const type=r.headers.get('content-type')||'';
    if(!r.ok||!type.includes('json')){location.replace('/');return}
    const p=await r.json();
    if(p.phase==='ready'){location.replace('/');return}
    render(p);
    if(p.phase==='failed'){
      titleEl.textContent='运行时准备失败';
      errEl.hidden=false;errEl.textContent=p.error||'未知错误';
      retry.hidden=false;retry.disabled=false;
      return;
    }
    retry.hidden=true;
  }catch(e){}
  setTimeout(tick,1000);
}
retry.onclick=async function(){
  retry.disabled=true;
  try{await fetch('/__canvas/retry',{method:'POST'})}catch(e){}
  location.reload();
};
copy.onclick=async function(){
  const text=JSON.stringify(last||{},null,2);
  try{await navigator.clipboard.writeText(text);copy.textContent='已复制'}catch(e){copy.textContent='复制失败'}
  setTimeout(function(){copy.textContent='复制诊断信息'},1600);
};
tick();
</script>
</body>
</html>`;
}

// server/src/preparation-orchestrator.ts
import path9 from "node:path";

// server/src/payload-installation.ts
import fs8 from "node:fs";
import path7 from "node:path";

// server/src/payload-archive.ts
import fs7 from "node:fs";
import path6 from "node:path";
import zlib from "node:zlib";
import crypto4 from "node:crypto";
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto4.createHash("sha256");
    fs7.createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}
function findEndOfCentralDirectory(buffer) {
  const floor = Math.max(0, buffer.length - 66 * 1024);
  for (let offset = buffer.length - 22; offset >= floor; offset--) {
    if (buffer.readUInt32LE(offset) === 101010256) return offset;
  }
  return -1;
}
function readExactly(fd, position, length) {
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const bytes = fs7.readSync(fd, buffer, filled, length - filled, position + filled);
    if (bytes <= 0) throw new Error(`载荷文件意外结束（offset ${position + filled}）`);
    filled += bytes;
  }
  return buffer;
}
function copyRangeInto(archive, start, length, target) {
  return new Promise((resolve, reject) => {
    const source = fs7.createReadStream(archive, { start, end: start + length - 1 });
    const sink = fs7.createWriteStream(target);
    sink.on("finish", () => resolve());
    sink.on("error", reject);
    source.on("error", reject);
    source.pipe(sink);
  });
}
function inflateRangeInto(archive, start, length, target) {
  return new Promise((resolve, reject) => {
    const source = fs7.createReadStream(archive, { start, end: start + length - 1 });
    const inflate = zlib.createInflateRaw();
    const sink = fs7.createWriteStream(target);
    sink.on("finish", () => resolve());
    sink.on("error", reject);
    inflate.on("error", reject);
    source.on("error", reject);
    source.pipe(inflate).pipe(sink);
  });
}
async function extractZip(archive, destDir) {
  const fd = fs7.openSync(archive, "r");
  let directory;
  let total;
  try {
    const size = fs7.fstatSync(fd).size;
    const tailLength = Math.min(size, 66 * 1024);
    const tail = readExactly(fd, size - tailLength, tailLength);
    const eocd = findEndOfCentralDirectory(tail);
    if (eocd < 0) throw new Error("载荷不是有效的 ZIP：找不到中央目录");
    total = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (total === 65535 || directoryOffset === 4294967295) throw new Error("暂不支持 ZIP64 格式的载荷");
    directory = readExactly(fd, directoryOffset, directorySize);
  } finally {
    fs7.closeSync(fd);
  }
  const root = path6.resolve(destDir);
  const archiveFd = fs7.openSync(archive, "r");
  let cursor = 0;
  try {
    for (let index = 0; index < total; index++) {
      if (directory.readUInt32LE(cursor) !== 33639248) throw new Error("载荷 ZIP 中央目录损坏");
      const method = directory.readUInt16LE(cursor + 10);
      const compressedSize = directory.readUInt32LE(cursor + 20);
      const uncompressedSize = directory.readUInt32LE(cursor + 24);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const localOffset = directory.readUInt32LE(cursor + 42);
      const name = directory.toString("utf8", cursor + 46, cursor + 46 + nameLength);
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith("/")) continue;
      const target = path6.resolve(root, name);
      if (target !== root && !target.startsWith(root + path6.sep)) {
        throw new Error(`载荷条目越出目标目录：${name}`);
      }
      const localNameLength = readExactly(archiveFd, localOffset + 26, 2).readUInt16LE(0);
      const localExtraLength = readExactly(archiveFd, localOffset + 28, 2).readUInt16LE(0);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      fs7.mkdirSync(path6.dirname(target), { recursive: true });
      if (compressedSize === 0) {
        fs7.writeFileSync(target, Buffer.alloc(0));
      } else if (method === 0) {
        await copyRangeInto(archive, dataStart, compressedSize, target);
      } else if (method === 8) {
        await inflateRangeInto(archive, dataStart, compressedSize, target);
      } else {
        throw new Error(`不支持的 ZIP 压缩方式：${method}`);
      }
      if (uncompressedSize && fs7.statSync(target).size !== uncompressedSize) {
        throw new Error(`载荷条目大小不符：${name}`);
      }
    }
  } finally {
    fs7.closeSync(archiveFd);
  }
}

// server/src/payload-installation.ts
async function stageArchive(spec, staging, label, approximateMB) {
  const archive = `${staging}.zip`;
  fs8.mkdirSync(path7.dirname(staging), { recursive: true });
  resetTransfer(spec.file, approximateMB * 1024 * 1024);
  STATE.error = null;
  STATE.retries = 0;
  const local = findLocalFile(spec.file);
  let localReady = false;
  if (local) {
    setStage("verifying", `使用本地${label}`, `正在校验本地${label}完整性`);
    note(`发现本地${label}：${local}`);
    fs8.copyFileSync(local, archive);
    STATE.receivedBytes = statSize(archive);
    STATE.totalBytes = STATE.receivedBytes;
    if (await hashFile(archive) === spec.sha256) {
      note(`本地${label}校验通过，不再联网`);
      localReady = true;
    } else {
      fs8.rmSync(archive, { force: true });
      note(`本地${label} sha256 不匹配，改为从远程来源下载`);
    }
  }
  const startedAt = Date.now();
  if (!localReady) {
    const candidates = candidateUrls(spec.file);
    setStage("downloading", `下载${label}`, `首次启动，正在下载${label}（约 ${approximateMB} MB）`);
    note(`候选下载来源 ${candidates.length} 个`);
    let lastError = await downloadFromCandidates(candidates, archive);
    if (lastError && apiFallbackAllowed()) {
      const asset = await resolveAssetUrl(spec.file);
      if (asset) lastError = await downloadFromCandidates([asset], archive);
    }
    if (lastError) {
      const wrapped = describeFailure(lastError);
      wrapped.code = "payload-unreachable";
      throw wrapped;
    }
  }
  setStage("verifying", "校验完整性", `正在校验${label}完整性`);
  const digest = await hashFile(archive);
  if (digest !== spec.sha256) {
    fs8.rmSync(archive, { force: true });
    for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) fs8.rmSync(partPath(archive, index), { force: true });
    const mismatch = new Error(`${label} sha256 不匹配：期望 ${spec.sha256}，实际 ${digest}`);
    mismatch.code = "payload-checksum-mismatch";
    throw mismatch;
  }
  const megabytes = (fs8.statSync(archive).size / 1048576).toFixed(1);
  note(`下载完成（${megabytes} MB，用时 ${Math.round((Date.now() - startedAt) / 1e3)}s），开始解包`);
  setStage("extracting", `解包${label}`, `正在解包${label}（${megabytes} MB）`);
  const extractStartedAt = Date.now();
  fs8.rmSync(staging, { recursive: true, force: true });
  try {
    await extractZip(archive, staging);
  } catch (err) {
    err.code = "payload-extract-failed";
    throw err;
  }
  fs8.rmSync(archive, { force: true });
  note(`${label}已解包到 ${staging}（${Math.round((Date.now() - extractStartedAt) / 1e3)}s）`);
}
function megabytesOf(spec, fallback) {
  return spec.bytes > 0 ? Math.round(spec.bytes / (1024 * 1024)) : fallback;
}
async function provisionPayload(spec) {
  const staging = `${PROVISION_DIR}.partial`;
  await stageArchive(spec, staging, "运行时载荷", megabytesOf(spec, 200));
  const binary = path7.join(staging, BINARY_NAME);
  if (!fs8.existsSync(binary)) {
    throw codedError("payload-extract-failed", `载荷里没有后端可执行文件 ${BINARY_NAME}`);
  }
  fs8.chmodSync(binary, 493);
  fs8.rmSync(PROVISION_DIR, { recursive: true, force: true });
  fs8.renameSync(staging, PROVISION_DIR);
  note(`运行时已就绪：${PROVISION_DIR}`);
}
function hasAgentRuntime(dir) {
  return fs8.existsSync(path7.join(dir, "pi-runtime", "agent-runtime.mjs"));
}
async function provisionAgentRuntime(spec) {
  const staging = `${AGENT_DIR}.partial`;
  await stageArchive(spec, staging, "创作 Agent 运行时", megabytesOf(spec, 80));
  const nodeBin = path7.join(staging, "node", "bin", NODE_BINARY_NAME);
  if (fs8.existsSync(nodeBin)) fs8.chmodSync(nodeBin, 493);
  fs8.rmSync(AGENT_DIR, { recursive: true, force: true });
  fs8.renameSync(staging, AGENT_DIR);
  note(`创作 Agent 运行时已就绪：${AGENT_DIR}`);
}
async function resolveAgentDir() {
  if (AGENT_DIR && hasAgentRuntime(AGENT_DIR)) {
    note(`复用已就绪的创作 Agent 运行时 ${AGENT_DIR}`);
    return AGENT_DIR;
  }
  if (Object.keys(MANIFEST.platforms).length === 0) {
    try {
      await loadManifest();
    } catch (err) {
      note(`发布清单不可用，创作 Agent 功能不可用：${err.message}`);
      return null;
    }
  }
  const spec = MANIFEST.platforms[PLATFORM]?.agent;
  if (!spec || !SHA256_RE.test(spec.sha256)) {
    note(`当前平台 ${PLATFORM} 暂无创作 Agent 载荷，Agent 功能不可用`);
    return null;
  }
  try {
    await provisionAgentRuntime(spec);
    return AGENT_DIR;
  } catch (err) {
    note(`创作 Agent 运行时准备失败（Agent 功能将不可用）：${err.message}`);
    return null;
  }
}
function resolveNodeBin(agentDir) {
  const bundled = path7.join(agentDir, "node", "bin", NODE_BINARY_NAME);
  if (fs8.existsSync(bundled)) return bundled;
  const version = process.versions.node ?? "0.0.0";
  const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  if (major > 22 || major === 22 && minor >= 19) return process.execPath;
  note(`宿主 node ${version} 低于 pi 要求的 22.19.0，载荷又未提供 node；Agent 任务可能起不来`);
  return "";
}
async function resolveRuntimeDir() {
  if (hasPayload(BUNDLED_DIR)) {
    note("使用包内自带运行时");
    return BUNDLED_DIR;
  }
  if (!TARGET_PLATFORMS.includes(PLATFORM)) throw unsupportedPlatformError();
  await loadManifest();
  const spec = MANIFEST.platforms[PLATFORM]?.payload;
  if (!spec) throw unsupportedPlatformError();
  if (hasPayload(PROVISION_DIR)) {
    note(`复用已就绪的运行时 ${PROVISION_DIR}`);
    return PROVISION_DIR;
  }
  await provisionPayload(spec);
  return PROVISION_DIR;
}

// server/src/web-dist-hosting.ts
import fs9 from "node:fs";
import path8 from "node:path";
var WEB_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf"
};
function webIndexPath() {
  return WEB_DIST ? path8.join(WEB_DIST, "index.html") : null;
}
function hasWebBundle() {
  const index = webIndexPath();
  return Boolean(index) && fs9.existsSync(index);
}
function webCacheControl(relativePath) {
  return /^\/assets\//.test(relativePath) ? "public, max-age=31536000, immutable" : "no-cache";
}
function contentTypeOf(filePath) {
  return WEB_MIME[path8.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
function sendWebFile(req, res, filePath, relativePath) {
  let stat = null;
  try {
    stat = fs9.statSync(filePath);
  } catch {
    stat = null;
  }
  if (!stat || !stat.isFile()) {
    sendWebNotFound(res, relativePath);
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentTypeOf(filePath),
    "Content-Length": stat.size,
    "Cache-Control": webCacheControl(relativePath),
    "X-Content-Type-Options": "nosniff"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs9.createReadStream(filePath);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
function sendWebNotFound(res, pathname) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(`Not found: ${pathname}`);
}
function resolveWebAsset(pathname) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  if (decoded.includes("\0") || decoded.includes("\\")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  if (decoded.split(/[\\/]+/).some((segment) => segment === "..")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const normalized = path8.posix.normalize(decoded);
  if (normalized.includes("..")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const root = path8.resolve(WEB_DIST);
  const target = path8.resolve(root, `.${normalized}`);
  if (target !== root && !target.startsWith(root + path8.sep)) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const candidate = fs9.existsSync(target) && fs9.statSync(target).isDirectory() ? path8.join(target, "index.html") : target;
  if (!fs9.existsSync(candidate)) {
    return { file: null, relative: normalized, reason: "missing" };
  }
  return { file: candidate, relative: candidate === target ? normalized : `${normalized.replace(/\/$/, "")}/index.html` };
}
function isNavigationRequest(req, pathname) {
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("text/html")) return true;
  return path8.posix.extname(pathname) === "";
}
function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}
function serveWebAsset(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!hasWebBundle()) return false;
  const resolved = resolveWebAsset(pathname);
  if (resolved.reason === "bad-path") {
    sendWebNotFound(res, pathname);
    return true;
  }
  if (resolved.file) {
    sendWebFile(req, res, resolved.file, resolved.relative);
    return true;
  }
  if (isNavigationRequest(req, pathname)) {
    sendWebFile(req, res, webIndexPath(), "/index.html");
    return true;
  }
  sendWebNotFound(res, pathname);
  return true;
}

// server/src/preparation-orchestrator.ts
var preparing = false;
async function prepareRuntime() {
  if (preparing || STATE.phase === "ready") return;
  preparing = true;
  try {
    STATE.phase = "starting";
    STATE.message = "正在检查运行时";
    clearFailure();
    const serverDir = await resolveRuntimeDir();
    setRuntimePaths({
      serverDir,
      goBinary: path9.join(serverDir, BINARY_NAME),
      webDist: path9.join(serverDir, "web-dist")
    });
    if (!hasWebBundle()) {
      throw codedError("web-bundle-missing", `载荷里没有前端产物 ${path9.join(serverDir, "web-dist", "index.html")}`);
    }
    setRuntimePaths({
      piRuntime: path9.join(serverDir, "pi-runtime"),
      pluginPackages: path9.join(serverDir, "plugin-packages")
    });
    const agentDir = await resolveAgentDir();
    if (agentDir) {
      setRuntimePaths({ piRuntime: path9.join(agentDir, "pi-runtime"), nodeBin: resolveNodeBin(agentDir) });
    }
    STATE.phase = "starting-backend";
    STATE.message = "正在启动后端";
    await reserveBackendPort();
    startBackend();
  } catch (error) {
    fail(error?.code ?? "prepare-failed", error?.message ?? String(error), "运行时准备");
    console.error(`[open-ai-canvas] 运行时准备失败（${STATE.code}）：${STATE.error}`);
  } finally {
    preparing = false;
  }
}

// server/src/host-model-bridge.ts
import crypto5 from "node:crypto";
import fs10 from "node:fs";
import path10 from "node:path";

// server/src/canvas-catalog.ts
import http3 from "node:http";
var KINDS = ["text", "image", "video", "audio"];
var RATIO = /^\d+\s*:\s*\d+$/;
var TASK_TYPE = {
  text: "canvas_text",
  image: "canvas_image",
  video: "canvas_video",
  audio: "canvas_audio"
};
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of ["data", "items", "models", "list"]) {
      if (Array.isArray(record[key])) return record[key];
    }
  }
  return [];
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function stringList(value) {
  return asArray(value).map((item) => typeof item === "string" ? item.trim() : "").filter((item) => item.length > 0);
}
function numberList(value) {
  return asArray(value).map((item) => typeof item === "number" ? item : Number(text(item))).filter((item) => Number.isFinite(item) && item > 0);
}
function uniq(items) {
  return [...new Set(items)];
}
function kindOf(raw) {
  const capability = text(raw.capability).toLowerCase();
  if (capability === "chat") return "text";
  return KINDS.includes(capability) ? capability : null;
}
function optionValues(spec, name) {
  const options = asRecord(spec.options);
  return stringList(asRecord(options[name]).values);
}
function normalizeCanvasCatalog(raw) {
  const models = [];
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
    const resolutions = uniq([
      ...selectors.flatMap((selector) => [
        text(selector.quality),
        text(selector.vquality),
        text(selector.imageResolution),
        text(selector.resolution)
      ]),
      ...optionValues(spec, "quality"),
      ...optionValues(spec, "vquality"),
      ...optionValues(spec, "imageResolution")
    ]).filter((value) => value && value !== "auto" && value !== "any");
    const aspectRatios = uniq([
      ...selectors.map((selector) => text(selector.aspectRatio)),
      ...selectors.map((selector) => text(selector.size)),
      ...optionValues(spec, "aspectRatio"),
      ...optionValues(spec, "size")
    ]).filter((value) => RATIO.test(value));
    const videoSeconds = uniq([
      ...tiers.map((tier) => typeof tier.videoSeconds === "number" ? tier.videoSeconds : Number(text(tier.videoSeconds))),
      ...selectors.map((selector) => Number(text(selector.videoSeconds))),
      ...numberList(asRecord(asRecord(spec.options).videoSeconds).values)
    ]).filter((seconds) => Number.isFinite(seconds) && seconds > 0).sort((a, b) => a - b);
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
      aspectRatios
    });
  }
  models.sort((a, b) => a.name.localeCompare(b.name));
  const counts = { text: 0, image: 0, video: 0, audio: 0 };
  for (const model of models) counts[model.kind] += 1;
  return { models, counts };
}
async function readCanvasCatalog() {
  const result = await rawCanvasApi("GET", "/api/models");
  if (result.status !== 200) return result;
  return { status: 200, body: normalizeCanvasCatalog(result.body) };
}
function buildCanvasTaskBody(request) {
  const options = request.options && typeof request.options === "object" ? request.options : {};
  const body = {
    type: TASK_TYPE[request.kind],
    operation: request.operation,
    prompt: request.prompt,
    logicalModelId: request.logicalModelId,
    input: { mode: request.kind, prompt: request.prompt, config: options }
  };
  if (request.projectId) body.projectId = request.projectId;
  return body;
}
async function createCanvasTask(request) {
  const result = await rawCanvasApi("POST", "/api/tasks", buildCanvasTaskBody(request));
  return result;
}
var RESOURCE_FILE = /^\/api\/resources\/([^/]+)\/file/;
function normalizeCanvasTask(raw) {
  const record = asRecord(raw);
  const task = asRecord(record.data) && Object.keys(asRecord(record.data)).length > 0 ? asRecord(record.data) : record;
  const previewUrl = text(task.previewUrl) || text(task.previewURL);
  const previewKind = text(task.previewKind) || "image";
  const artifacts = [];
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
    ...text(task.error) ? { error: text(task.error) } : {},
    artifacts
  };
}
async function readCanvasTask(taskId) {
  const result = await rawCanvasApi("GET", `/api/tasks/${encodeURIComponent(taskId)}`);
  if (result.status !== 200) return result;
  return { status: 200, body: normalizeCanvasTask(result.body) };
}
function streamCanvasResource(resourceId, res) {
  if (!SESSION_TOKEN || !goPort) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Canvas is not ready", code: "canvas-unreachable" } }));
    return;
  }
  const upstream = http3.request(
    {
      hostname: "127.0.0.1",
      port: goPort,
      path: `/api/resources/${encodeURIComponent(resourceId)}/file`,
      method: "GET",
      headers: { Cookie: `open_ai_canvas_session=${SESSION_TOKEN}` }
    },
    (source) => {
      const headers = { "Content-Type": source.headers["content-type"] || "application/octet-stream" };
      for (const key of ["content-length", "etag", "last-modified"]) {
        const value = source.headers[key];
        if (typeof value === "string") headers[key] = value;
      }
      res.writeHead(source.statusCode || 502, headers);
      source.pipe(res);
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Canvas resource unavailable", code: "canvas-unreachable" } }));
  });
  res.on("close", () => upstream.destroy());
  upstream.end();
}

// server/src/host-model-bridge.ts
var BRIDGE_FILE = path10.join(DATA_DIR, "bridge.json");
var BRIDGE_JOB_TTL_MS = 5 * 6e4;
var BRIDGE_IDLE_MS = 18e4;
var BRIDGE_LONGPOLL_MS = 25e3;
var BRIDGE_EXECUTOR_STALE_MS = 45e3;
function loadBridgeState() {
  try {
    return JSON.parse(fs10.readFileSync(BRIDGE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveBridgeState(state) {
  fs10.mkdirSync(DATA_DIR, { recursive: true });
  fs10.writeFileSync(BRIDGE_FILE, JSON.stringify(state, null, 2), { mode: 384 });
}
function bridgeToken() {
  const state = loadBridgeState();
  if (typeof state.token === "string" && state.token.length >= 32) return state.token;
  const token = crypto5.randomBytes(24).toString("hex");
  saveBridgeState({ ...state, token, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return token;
}
var BRIDGE = {
  models: [],
  modelsAt: 0,
  lastPollAt: 0,
  jobs: /* @__PURE__ */ new Map(),
  waiters: []
};
function bridgeExecutorOnline() {
  return BRIDGE.lastPollAt > 0 && Date.now() - BRIDGE.lastPollAt < BRIDGE_EXECUTOR_STALE_MS;
}
function bridgeJson(res, status, body) {
  sendJson(res, body, status);
}
function bridgeUnauthorized(res) {
  res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
  res.end(JSON.stringify({ error: { message: "Invalid bridge token", code: "bridge-unauthorized" } }));
}
function bridgeAuthorized(req) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === bridgeToken();
}
function readJsonBody(req) {
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
function sweepBridgeJobs() {
  const now = Date.now();
  for (const [id, job] of BRIDGE.jobs) {
    if (now - job.createdAt < BRIDGE_JOB_TTL_MS) continue;
    job.finished = true;
    BRIDGE.jobs.delete(id);
    try {
      job.res.destroy();
    } catch {
    }
  }
}
function bridgeWriteChunk(job, delta) {
  if (job.finished) return;
  if (!job.headersSent) {
    job.res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
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
      choices: [{ index: 0, delta: { content: delta }, finish_reason: null }]
    })}

`
  );
}
function bridgeFinishJob(job, error) {
  if (job.finished) return;
  job.finished = true;
  BRIDGE.jobs.delete(job.id);
  clearTimeout(job.idleTimer);
  if (error) {
    if (!job.headersSent) {
      bridgeJson(job.res, 502, {
        error: { message: error.message || String(error), code: error.code || "bridge-executor-error" }
      });
      return;
    }
    job.res.write(
      `data: ${JSON.stringify({ error: { message: error.message || String(error), code: error.code || "bridge-executor-error" } })}

`
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
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
      })}

`
    );
    job.res.write("data: [DONE]\n\n");
    job.res.end();
    return;
  }
  bridgeJson(job.res, 200, {
    id: job.id,
    object: "chat.completion",
    created: Math.floor(job.created / 1e3),
    model: job.model || "astravia-host",
    choices: [{ index: 0, message: { role: "assistant", content: job.text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  });
}
function bridgeWakeWaiter() {
  const waiter = BRIDGE.waiters.shift();
  if (!waiter) return;
  clearTimeout(waiter.timer);
  const jobs = [...BRIDGE.jobs.values()].filter((job) => !job.assigned).slice(0, 4);
  for (const job of jobs) job.assigned = true;
  bridgeJson(waiter.res, 200, { jobs: jobs.map(bridgeJobEnvelope) });
}
function bridgeJobEnvelope(job) {
  return {
    id: job.id,
    kind: "chat",
    stream: job.stream,
    model: job.model,
    messages: job.messages,
    ...job.temperature !== void 0 && { temperature: job.temperature },
    ...job.max_tokens !== void 0 && { max_tokens: job.max_tokens }
  };
}
function bridgeCollectJobs(res) {
  const jobs = [...BRIDGE.jobs.values()].filter((job) => !job.assigned).slice(0, 4);
  for (const job of jobs) job.assigned = true;
  bridgeJson(res, 200, { jobs: jobs.map(bridgeJobEnvelope) });
}
function bridgeServeModels(res) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Bridge-Executor": bridgeExecutorOnline() ? "online" : "offline",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(
    JSON.stringify({
      object: "list",
      data: BRIDGE.models.map((model) => ({ id: model.id, object: "model", owned_by: "astravia" }))
    })
  );
}
function bridgeServeChat(req, res) {
  void readJsonBody(req).then((body) => {
    if (!bridgeExecutorOnline()) {
      bridgeJson(res, 503, {
        error: {
          message: "Astravia is not currently relaying model calls. Open the Open AI Canvas view in Astravia and try again.",
          code: "bridge-executor-offline"
        }
      });
      return;
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      bridgeJson(res, 400, { error: { message: "messages is required", code: "bridge-bad-request" } });
      return;
    }
    if (messages.some((message) => Array.isArray(message?.content))) {
      bridgeJson(res, 422, {
        error: {
          message: "Image input is not bridged: the host text API accepts text only. Remove the image parts or configure a vision channel inside the canvas.",
          code: "bridge-vision-unsupported"
        }
      });
      return;
    }
    sweepBridgeJobs();
    const job = {
      id: `job_${crypto5.randomUUID()}`,
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
      res
    };
    job.idleTimer = setTimeout(() => {
      bridgeFinishJob(job, Object.assign(new Error("Bridge job timed out"), { code: "bridge-timeout" }));
    }, BRIDGE_IDLE_MS);
    job.idleTimer.unref?.();
    BRIDGE.jobs.set(job.id, job);
    req.on("close", () => {
      if (!job.finished) {
        job.finished = true;
        BRIDGE.jobs.delete(job.id);
        clearTimeout(job.idleTimer);
      }
    });
    bridgeWakeWaiter();
  }).catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
}
function bridgeServeMedia(res) {
  bridgeJson(res, 501, {
    error: {
      message: "Text is bridged to Astravia. Image and video generation are not: the host does not expose key-level media generation to plugins. Configure an image/video channel inside the canvas instead.",
      code: "host-media-not-exposed"
    }
  });
}
function bridgeCanvasFailure(res, status, body) {
  const canvasMessage = body && (body.msg || body.message || body.error?.message) || `Canvas returned ${status}`;
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
var CANVAS_KINDS = ["text", "image", "video", "audio"];
function readCanvasTaskRequest(body) {
  const logicalModelId = typeof body?.logicalModelId === "string" ? body.logicalModelId.trim() : "";
  const kind = typeof body?.kind === "string" ? body.kind.trim().toLowerCase() : "";
  const operation = typeof body?.operation === "string" ? body.operation.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!logicalModelId) return { message: "logicalModelId is required" };
  if (!prompt) return { message: "prompt is required" };
  if (!CANVAS_KINDS.includes(kind)) return { message: `Unsupported kind ${kind}` };
  if (!operation) return { message: "operation is required" };
  const options = body?.options && typeof body.options === "object" && !Array.isArray(body.options) ? body.options : {};
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  return {
    request: { logicalModelId, kind, operation, prompt, options, ...projectId ? { projectId } : {} }
  };
}
function serveBridge(req, res, pathname) {
  if (!pathname.startsWith("/bridge/")) return false;
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
    void readJsonBody(req).then((body) => {
      if (action === "chunk") {
        if (typeof body.delta === "string" && body.delta.length > 0) bridgeWriteChunk(job, body.delta);
      } else {
        const error = body.error ? Object.assign(new Error(body.error), { code: "bridge-executor-error" }) : null;
        bridgeFinishJob(job, error);
      }
      bridgeJson(res, 200, { ok: true });
    }).catch((err) => bridgeJson(res, 400, { error: { message: err.message } }));
    return true;
  }
  if (req.method === "POST" && pathname === "/bridge/models") {
    void readJsonBody(req).then((body) => {
      const models = Array.isArray(body.models) ? body.models : [];
      BRIDGE.models = models.filter((model) => model && typeof model.id === "string");
      BRIDGE.modelsAt = Date.now();
      bridgeJson(res, 200, { ok: true, count: BRIDGE.models.length });
    }).catch((err) => bridgeJson(res, 400, { error: { message: err.message } }));
    return true;
  }
  if (req.method === "GET" && pathname === "/bridge/status") {
    bridgeJson(res, 200, {
      executorOnline: bridgeExecutorOnline(),
      models: BRIDGE.models.length,
      pending: BRIDGE.jobs.size,
      tokenConfigured: Boolean(loadBridgeState().token)
    });
    return true;
  }
  if (req.method === "GET" && pathname === "/bridge/admin/channels") {
    void bridgeAdminChannels("GET", null, null).then((result) => bridgeJson(res, result.status, result.body));
    return true;
  }
  if (req.method === "POST" && pathname === "/bridge/admin/channels") {
    void readJsonBody(req).then((body) => bridgeAdminChannels("POST", null, body)).then((result) => bridgeJson(res, result.status, result.body)).catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
    return true;
  }
  const adminChannelMatch = pathname.match(/^\/bridge\/admin\/channels\/([^/]+)$/);
  if (req.method === "PATCH" && adminChannelMatch) {
    void readJsonBody(req).then((body) => bridgeAdminChannels("PATCH", adminChannelMatch[1], body)).then((result) => bridgeJson(res, result.status, result.body)).catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
    return true;
  }
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
    void readJsonBody(req).then((body) => {
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
    }).catch((err) => bridgeJson(res, 400, { error: { message: err.message, code: "bridge-bad-request" } }));
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
  const mediaMatch = pathname.match(/^\/bridge\/media\/([^/]+)$/);
  if (req.method === "GET" && mediaMatch) {
    streamCanvasResource(decodeURIComponent(mediaMatch[1]), res);
    return true;
  }
  bridgeJson(res, 404, { error: { message: `Unknown bridge route ${pathname}`, code: "bridge-not-found" } });
  return true;
}

// server/src/service-routes.ts
function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body));
}
function handlePayloadReset(res) {
  const removed = [];
  let freedBytes = 0;
  const roots = [PROVISION_DIR, AGENT_DIR].filter((dir) => typeof dir === "string" && dir.length > 0);
  for (const dir of roots) {
    let entries = [];
    try {
      entries = fs11.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(partial\.zip|zip\.tmp)(\.part\d+)?$/.test(entry.name)) continue;
      const target = path11.join(dir, entry.name);
      try {
        freedBytes += statSize(target);
        fs11.rmSync(target, { force: true });
        removed.push(entry.name);
      } catch {
      }
    }
  }
  if (removed.length > 0) {
    STATE.receivedBytes = 0;
    STATE.totalBytes = 0;
    STATE.chunks = [];
    note(`已清理下载残留 ${removed.length} 个文件（${(freedBytes / 1048576).toFixed(1)} MB）`);
  }
  sendJson(res, {
    ok: true,
    removed,
    freedBytes,
    message: removed.length > 0 ? `已清理 ${(freedBytes / 1048576).toFixed(1)} MB 下载残留` : "没有需要清理的分片"
  });
}
function stateSnapshot(runtime = {}) {
  return {
    ...progressSnapshot(),
    ready: Boolean(goPort) && STATE.phase === "ready",
    backend: Boolean(goPort),
    // 插件视图用它显示「桥在线 / 离线」，没这个字段就只能猜。
    bridge: { executorOnline: bridgeExecutorOnline(), models: BRIDGE.models.length },
    workflow: LAST_WORKFLOW,
    // 地址栏该用的 origin（ADR-0010）。插件据此打开画布，两个端口不一致时才不用依赖 302。
    origin: runtime.origin ?? null,
    originPinned: Boolean(runtime.originPinned),
    // ADR-0001 兼容节：画布上游版本。载荷里没有 VERSION 文件，发布清单里倒是一直带着
    // upstream.tag/commit，所以说真话的成本为零（MANIFEST 在 resolveRuntimeDir 里总会取一次）。
    canvasVersion: MANIFEST.upstream?.tag || null,
    canvasCommit: MANIFEST.upstream?.commit || null,
    payloadVersion: MANIFEST.payloadVersion || null,
    // ADR-0002 决策 4：登录态。required 给视图提示「要重新登录」，storage 让「是否真的加密」可验证。
    session: { present: Boolean(SESSION_TOKEN), storage: SESSION_KEY ? "aes-256-gcm" : "plaintext" }
  };
}
function servePreparation(req, res) {
  if (req.method === "GET" && req.url === "/api/health/ready") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: STATE.phase === "failed" ? "error" : "preparing", ...progressSnapshot() }));
    return;
  }
  if (req.method === "GET" && req.url === "/__canvas/progress") {
    sendJson(res, progressSnapshot());
    return;
  }
  if (req.method === "GET" && req.url === "/__canvas/tools") {
    sendJson(res, {
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: MCP_TOOL_GROUPS[tool.name] ?? "other"
      }))
    });
    return;
  }
  if (req.method === "POST" && req.url === "/__canvas/retry") {
    STATE.phase = "starting";
    STATE.message = "正在重试";
    clearFailure();
    STATE.receivedBytes = 0;
    STATE.totalBytes = 0;
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    void prepareRuntime();
    return;
  }
  if (req.method === "POST" && req.url === "/mcp") {
    void waitForBackend(MCP_WAIT_MS).then((ready) => {
      if (ready) {
        handleMcpRequest(req, res);
        return;
      }
      res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "10" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32e3, message: "Runtime is still preparing" }
        })
      );
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(progressPage());
}

// server/src/stable-origin-binding.ts
var PUBLIC_ORIGIN = `http://127.0.0.1:${HOST_PORT}`;
var STABLE_PORT = 0;
var STABLE_SERVER = null;
var REQUEST_HANDLER = null;
function loadRememberedPort() {
  try {
    const port = Number(JSON.parse(fs12.readFileSync(ORIGIN_FILE, "utf8"))?.port);
    return Number.isInteger(port) && port > 0 ? port : 0;
  } catch {
    return 0;
  }
}
function rememberPort(port) {
  try {
    fs12.mkdirSync(DATA_DIR, { recursive: true });
    const body = { port, origin: `http://127.0.0.1:${port}`, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
    fs12.writeFileSync(ORIGIN_FILE, `${JSON.stringify(body, null, 2)}
`);
  } catch (err) {
    console.error("[open-ai-canvas] Failed to remember browser origin:", err.message);
  }
}
function stablePortCandidates() {
  const raw = process.env.CANVAS_STABLE_PORTS;
  const override = typeof raw === "string" ? raw.trim() : "";
  if (/^(off|none|false|0)$/i.test(override)) return [];
  const explicit = override ? override.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0) : [];
  const remembered = loadRememberedPort();
  const list = explicit.length ? [...explicit, remembered] : [...remembered ? [remembered] : [], ...STABLE_ORIGIN_PORTS];
  return [...new Set(list)].filter((port) => port > 0 && port !== HOST_PORT && port < 65536);
}
function listenStable(port) {
  return new Promise((resolve) => {
    const server = http4.createServer((req, res) => {
      if (!REQUEST_HANDLER) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("starting");
        return;
      }
      REQUEST_HANDLER(req, res);
    });
    server.once("error", (err) => resolve({ server: null, error: err }));
    server.listen(port, "127.0.0.1", () => resolve({ server, error: null }));
  });
}
async function bindStableOrigin() {
  if (fs12.existsSync(path12.join(DATA_DIR, "no-stable-origin"))) {
    console.log("[open-ai-canvas] no-stable-origin present; keeping the host port as browser origin");
    return;
  }
  for (const port of stablePortCandidates()) {
    const { server, error } = await listenStable(port);
    if (!server) {
      console.error(`[open-ai-canvas] Port ${port} unavailable (${error?.code || error?.message}); trying next`);
      continue;
    }
    STABLE_SERVER = server;
    STABLE_PORT = port;
    PUBLIC_ORIGIN = `http://127.0.0.1:${port}`;
    rememberPort(port);
    console.log(`[open-ai-canvas] Browser origin ${PUBLIC_ORIGIN}`);
    return;
  }
  console.error("[open-ai-canvas] No stable origin port available; browser state will not survive a restart");
}
function shouldPinOrigin(req, pathname) {
  if (!STABLE_PORT) return false;
  if (req.socket?.localPort !== HOST_PORT) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (/^\/(api|bridge|__canvas|mcp)(\/|$)/.test(pathname)) return false;
  return String(req.headers.accept || "").includes("text/html");
}
function redirectToPinnedOrigin(req, res) {
  res.writeHead(302, { Location: `${PUBLIC_ORIGIN}${req.url || "/"}`, "Cache-Control": "no-store" });
  res.end();
}
function startProxy() {
  try {
    bridgeToken();
  } catch (err) {
    console.error("[open-ai-canvas] Failed to initialise bridge token:", err.message);
  }
  const server = http4.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    if (shouldPinOrigin(req, pathname)) {
      redirectToPinnedOrigin(req, res);
      return;
    }
    if (req.method === "GET" && pathname === "/__canvas/state") {
      sendJson(res, stateSnapshot({ origin: PUBLIC_ORIGIN, originPinned: Boolean(STABLE_PORT) }));
      return;
    }
    if (req.method === "POST" && pathname === "/__canvas/payload/reset") {
      handlePayloadReset(res);
      return;
    }
    if (serveBridge(req, res, pathname)) return;
    if (!goPort) {
      servePreparation(req, res);
      return;
    }
    if (req.method === "POST" && pathname === "/mcp") {
      handleMcpRequest(req, res);
      return;
    }
    if (pathname === "/mcp") {
      res.writeHead(405, { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }
    if (!isApiPath(pathname) && serveWebAsset(req, res, pathname)) return;
    const proxyReq = http4.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: req.url,
        method: req.method,
        headers: req.headers
      },
      (proxyRes) => {
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const cookie of cookies) {
            const match = cookie.match(/open_ai_canvas_session=([^;]+)/);
            if (match) {
              setSessionToken(match[1]);
              saveSession(match[1]);
              console.log("[open-ai-canvas] Session captured");
            }
          }
        }
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Bad Gateway: ${err.message}`);
    });
    req.pipe(proxyReq);
  });
  REQUEST_HANDLER = (req, res) => server.emit("request", req, res);
  server.on("upgrade", (req, socket, head) => {
    if (!goPort) {
      socket.destroy();
      return;
    }
    const targetSocket = net3.connect(goPort, "127.0.0.1", () => {
      let upgradeReq = `${req.method} ${req.url} HTTP/${req.httpVersion}\r
`;
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) upgradeReq += `${key}: ${v}\r
`;
        } else {
          upgradeReq += `${key}: ${value}\r
`;
        }
      }
      upgradeReq += "\r\n";
      targetSocket.write(upgradeReq);
      if (head && head.length) targetSocket.write(head);
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });
    targetSocket.on("error", () => socket.destroy());
    socket.on("error", () => targetSocket.destroy());
  });
  if (STABLE_SERVER) {
    STABLE_SERVER.on("upgrade", (req, socket, head) => server.emit("upgrade", req, socket, head));
  }
  server.listen(HOST_PORT, "127.0.0.1", () => {
    console.log(`[open-ai-canvas] Proxy listening on http://127.0.0.1:${HOST_PORT}`);
  });
  return server;
}

// server/src/boot.ts
await bindStableOrigin();
startProxy();
void prepareRuntime();
