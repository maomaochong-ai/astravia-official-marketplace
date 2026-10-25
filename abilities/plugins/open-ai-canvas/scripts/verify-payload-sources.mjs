#!/usr/bin/env node
/**
 * 用真实 shim 进程验证载荷来源（ADR-0009）。
 *
 * 为什么需要这个脚本：改造前只剩一条「直连 github.com」的路。受限网络里它必然失败，
 * 而失败文案把用户推向「开代理」——可用户没有代理。ADR-0009 把来源改成一条链
 * （本地目录 → 镜像前缀 → 配置基址），这个脚本就负责把三种情形都跑一遍：
 *
 *  A. 本地载荷目录：完全不联网，清单与归档都从磁盘取；
 *  B. 镜像前缀：请求路径必须是 `<镜像前缀><基址>/<文件名>`，证明包一层就能回源；
 *  C. 全部不可用：状态必须停在 payload-unreachable，且文案给出可操作项。
 *
 * 做法与 verify-bridge / verify-web-hosting 一致，不假装外部环境：
 * - 起真进程，不 import（boot.mjs 尾部会立即监听）；
 * - `ASTRAVIA_SERVICE_RUNTIME_DIR` 指向空目录，逼 shim 真的走「准备运行时」这条路；
 * - 归档、清单、假后端全部由本脚本现场生成，sha256 现场计算；
 * - 场景 A/C 用 `CANVAS_PAYLOAD_BASE_URL` 指向 127.0.0.1:1 并关掉镜像，确保不碰外网。
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// 与另外两个验证脚本一致：可指向另一份 shim，用来做改前/改后对照。
const SHIM = process.env.CANVAS_SHIM_UNDER_TEST
  ? path.resolve(process.env.CANVAS_SHIM_UNDER_TEST)
  : join(ROOT, "server", "boot.mjs");
const READY_TIMEOUT_MS = 90_000;
const PAYLOAD_VERSION = "verify-payload-sources";
// 清单里的平台键必须与本机一致：这里校验的是来源解析，不是跨平台载荷的可用性。
const PLATFORM = `${process.platform}-${process.arch}`;
const ARCHIVE_NAME = `payload-${PAYLOAD_VERSION}-${PLATFORM}.zip`;

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

async function waitFor(predicate, label, timeoutMs = READY_TIMEOUT_MS) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timeout waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

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

// --- 现场造一个真 ZIP（stored，无压缩）---

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function makeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(0, 10);
    record.writeUInt16LE(0, 12);
    record.writeUInt16LE(0x21, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);

    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, eocd]);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const ARCHIVE = makeZip([
  { name: "yingce-backend", data: FAKE_BACKEND },
  { name: "web-dist/index.html", data: "<!doctype html><title>canvas</title><div id=root></div>\n" },
]);
const ARCHIVE_SHA = sha256(ARCHIVE);

function manifestText() {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      payloadVersion: PAYLOAD_VERSION,
      upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0", commit: "0".repeat(40) },
      platforms: {
        [PLATFORM]: {
          payload: { file: ARCHIVE_NAME, sha256: ARCHIVE_SHA, bytes: ARCHIVE.length },
        },
      },
    },
    null,
    2,
  )}\n`;
}

// --- 假镜像：按路径后缀命中文件，支持 Range（分片下载要求 206）---

function startMirror() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    requests.push(pathname);
    const body = pathname.endsWith("/payload-manifest.json")
      ? Buffer.from(manifestText())
      : pathname.endsWith(ARCHIVE_NAME)
        ? ARCHIVE
        : null;
    if (!body) {
      res.writeHead(404).end("not found");
      return;
    }
    const type = pathname.endsWith(".json") ? "application/json" : "application/octet-stream";
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${body.length}`,
        "Accept-Ranges": "bytes",
      });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": body.length, "Accept-Ranges": "bytes" });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({ base, requests, close: () => new Promise((done) => server.close(done)) });
    });
  });
}

// --- 起真实 shim ---

async function runShim(env) {
  const dir = mkdtempSync(join(tmpdir(), "verify-payload-sources-"));
  const dataDir = join(dir, "data");
  const runtimeDir = join(dir, "runtime");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });
  const port = await freePort();
  const child = spawn(process.execPath, [SHIM], {
    env: {
      ...process.env,
      // 先清空，再让场景覆盖：否则开发机上残留的 CANVAS_PAYLOAD_* 会让结果不可解释。
      CANVAS_PAYLOAD_MANIFEST: "",
      CANVAS_PAYLOAD_DIR: "",
      CANVAS_PAYLOAD_MIRRORS: "",
      CANVAS_PAYLOAD_BASE_URL: "",
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: dataDir,
      ASTRAVIA_SERVICE_RUNTIME_DIR: runtimeDir,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => chunks.push(chunk));

  const base = `http://127.0.0.1:${port}`;
  const read = async () => {
    const res = await fetch(`${base}/__canvas/state`);
    return res.ok ? res.json() : null;
  };
  await waitFor(read, "shim state endpoint");
  return {
    base,
    read,
    logs: () => chunks.join(""),
    async stop() {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

async function settle(shim, label) {
  return waitFor(async () => {
    const state = await shim.read();
    return state && (state.phase === "ready" || state.phase === "failed") ? state : null;
  }, label);
}

async function main() {
  // 场景 A：本地载荷目录，全程零网络。
  const payloadDir = mkdtempSync(join(tmpdir(), "payload-local-"));
  writeFileSync(join(payloadDir, ARCHIVE_NAME), ARCHIVE);
  writeFileSync(join(payloadDir, "payload-manifest.json"), manifestText());
  const local = await runShim({
    CANVAS_PAYLOAD_DIR: payloadDir,
    CANVAS_PAYLOAD_MIRRORS: "none",
    CANVAS_PAYLOAD_BASE_URL: "http://127.0.0.1:1/unreachable",
  });
  try {
    const state = await settle(local, "local payload ready");
    const log = local.logs();
    check("本地载荷目录能启动到 ready", state.ready === true, `phase=${state.phase} code=${state.code}`);
    check("清单取自本地目录", log.includes("清单来自本地目录"));
    check("本地归档校验通过后不再联网", log.includes(`本地运行时载荷校验通过`));
    check("没有尝试任何远程下载来源", !log.includes("下载来源"), `attempts=${state.attempts}`);
    const home = await fetch(`${local.base}/`);
    const html = await home.text();
    check(
      "本地载荷解出的前端产物可访问",
      home.status === 200 && html.includes("<!doctype html"),
      `status=${home.status}`,
    );
  } finally {
    await local.stop();
  }

  // 场景 B：镜像前缀包住配置基址。
  const mirror = await startMirror();
  const viaMirror = await runShim({
    CANVAS_PAYLOAD_BASE_URL: `${mirror.base}/origin`,
    CANVAS_PAYLOAD_MIRRORS: `${mirror.base}/mirror/`,
    CANVAS_PAYLOAD_DIR: "",
  });
  try {
    const state = await settle(viaMirror, "mirror payload ready");
    const log = viaMirror.logs();
    check("镜像可用时能启动到 ready", state.ready === true, `phase=${state.phase} code=${state.code}`);
    check(
      "清单请求走镜像前缀（前缀 + 基址 + 文件名）",
      mirror.requests.some((item) => item === `/mirror/${mirror.base}/origin/payload-manifest.json`),
      mirror.requests[0] || "无请求",
    );
    check(
      "归档同样从镜像前缀下载",
      mirror.requests.some((item) => item === `/mirror/${mirror.base}/origin/${ARCHIVE_NAME}`),
      `请求数 ${mirror.requests.length}`,
    );
    check("状态里记录的是镜像主机", String(state.endpoint).startsWith("127.0.0.1"), `endpoint=${state.endpoint}`);
    check("日志里没有回落到 github.com", !log.includes("github.com"));
  } finally {
    await viaMirror.stop();
    await mirror.close();
  }

  // 场景 C：所有来源都不可用，且显式基址下不去碰 GitHub API。
  const broken = await runShim({
    CANVAS_PAYLOAD_BASE_URL: "http://127.0.0.1:1/unreachable",
    CANVAS_PAYLOAD_MIRRORS: "none",
    CANVAS_PAYLOAD_DIR: "",
  });
  try {
    const state = await settle(broken, "payload-unreachable");
    const log = broken.logs();
    check("所有来源不可用时以 payload-unreachable 失败", state.code === "payload-unreachable", `code=${state.code}`);
    check(
      "失败文案给出本地目录 / 镜像 / 重试，而不是只让人开代理",
      /本地|镜像/.test(state.message || "") && /重试/.test(state.message || ""),
      (state.message || "").split("\n")[1] || "",
    );
    check("显式基址下不请求 api.github.com", !log.includes("api.github.com"));
    check("失败时不谎报就绪", state.ready === false && state.backend === false);
  } finally {
    await broken.stop();
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
