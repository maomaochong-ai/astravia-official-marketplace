/**
 * open-ai-canvas 服务启动包装器（host-node entry）。
 *
 * 职责：
 * 1. 映射宿主环境变量到画布后端所需的环境变量
 * 2. 拉起 Go 后端子进程（监听 127.0.0.1:0 随机端口）
 * 3. 解析 Go 后端 stdout 拿到实际监听端口
 * 4. 启动反向代理，监听宿主分配的 ASTRAVIA_SERVICE_PORT
 *    - POST /mcp → MCP Server（手写 JSON-RPC，16 个工具）
 *    - 普通 HTTP → 透传到 Go 后端
 *    - WebSocket upgrade → TCP 双向 pipe 到 Go 后端
 * 5. 捕获登录响应中的 open_ai_canvas_session cookie，加密存储供 MCP 调用
 */
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 宿主环境变量 ---
const HOST_PORT = Number(process.env.ASTRAVIA_SERVICE_PORT);
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR;
const RUNTIME_DIR = process.env.ASTRAVIA_SERVICE_RUNTIME_DIR || __dirname;

if (!HOST_PORT || !DATA_DIR) {
  console.error("[open-ai-canvas] Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR");
  process.exit(1);
}

// --- 运行时载荷 ---
// 包内只装 boot.mjs（几十 KB 的 shim）；Go 二进制 + web-dist + 官方插件包压缩后约 200 MB，
// 远超 Desktop 的 50 MB 单包上限，因此首次启动时下载到 DATA_DIR/runtime/<version>/ 并校验 sha256。
const PAYLOAD_VERSION = "0.0.1";
const PAYLOAD_BASE_URL =
  process.env.CANVAS_PAYLOAD_BASE_URL ||
  "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-open-ai-canvas";
const PAYLOADS = {
  "darwin-arm64": { file: "payload-0.0.1-darwin-arm64.zip", sha256: "fb46396533b5b0c82b533f06141918bfaa2fb1a984b9a5bec123d642d545c0c7" },
};

const PLATFORM = `${process.platform}-${process.arch}`;
const BINARY_NAME = `yingce-backend${process.platform === "win32" ? ".exe" : ""}`;
const BUNDLED_DIR = RUNTIME_DIR;
const PROVISION_DIR = path.join(DATA_DIR, "runtime", PAYLOAD_VERSION);

function note(message) {
  console.log(`[open-ai-canvas] ${message}`);
}

// --- 准备阶段的可见状态 ---
// 宿主用 /api/health/ready 判定服务就绪，而首次启动要下载约 200 MB 载荷。
// 监听因此先就位、把下载放到监听之后：健康检查立刻通过，准备进度由 /__canvas/progress
// 暴露给下面这张准备页，而不是让整段下载卡在宿主的健康超时里被反复中止。
const STATE = {
  phase: "starting",
  message: "正在检查运行时",
  receivedBytes: 0,
  totalBytes: 0,
  error: null,
};

function progressSnapshot() {
  const percent =
    STATE.totalBytes > 0 ? Math.min(100, Math.round((STATE.receivedBytes / STATE.totalBytes) * 100)) : 0;
  return {
    phase: STATE.phase,
    message: STATE.message,
    receivedBytes: STATE.receivedBytes,
    totalBytes: STATE.totalBytes,
    percent,
    error: STATE.error,
  };
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
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fafafa;color:#18181b}
.card{width:min(520px,calc(100vw - 48px));padding:28px 30px;border:1px solid #e4e4e7;border-radius:14px;
background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04)}
h1{margin:0 0 4px;font-size:16px;font-weight:600}
.sub{margin:0;color:#a1a1aa;font-size:12px}
#msg{margin:14px 0 0;color:#71717a;font-size:13px}
.track{margin:10px 0 8px;height:6px;border-radius:999px;overflow:hidden;background:#f4f4f5}
.bar{height:100%;width:0;background:#18181b;transition:width .3s ease}
.meta{display:flex;justify-content:space-between;color:#a1a1aa;font-size:12px;
font-variant-numeric:tabular-nums}
pre{margin:14px 0 0;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#b91c1c;
font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
button{margin-top:16px;padding:8px 16px;border:0;border-radius:8px;background:#18181b;color:#fff;
font:inherit;font-size:13px;cursor:pointer}
button[disabled]{opacity:.5;cursor:default}
.pending .track,.pending .meta{visibility:hidden}
@media (prefers-color-scheme:dark){
body{background:#09090b;color:#fafafa}
.card{background:#18181b;border-color:#27272a}
.track{background:#27272a}.bar{background:#fafafa}
pre{background:#2a1215}
button{background:#fafafa;color:#18181b}
}
</style>
</head>
<body>
<div class="card${failed ? "" : " pending"}">
  <h1>${title}</h1>
  <p class="sub">Preparing the Open AI Canvas runtime</p>
  <p id="msg">${STATE.message}</p>
  <div class="track"><div class="bar" id="bar"></div></div>
  <div class="meta"><span id="pct"></span><span id="bytes"></span></div>
  ${failed ? `<pre>${STATE.error ?? ""}</pre><button id="retry">重试 / Retry</button>` : ""}
</div>
<script>
const bar=document.getElementById('bar'),pct=document.getElementById('pct'),
bytes=document.getElementById('bytes'),msg=document.getElementById('msg');
function fmt(n){return n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB'}
async function tick(){
  try{
    const r=await fetch('/__canvas/progress',{cache:'no-store'});
    const p=await r.json();
    if(p.phase==='ready'){location.replace('/');return}
    if(p.phase==='failed'){location.reload();return}
    if(p.message)msg.textContent=p.message;
    if(p.totalBytes>0){
      bar.style.width=p.percent+'%';
      pct.textContent=p.percent+'%';
      bytes.textContent=fmt(p.receivedBytes)+' / '+fmt(p.totalBytes);
    }
  }catch(e){}
  setTimeout(tick,1000);
}
const retry=document.getElementById('retry');
if(retry)retry.onclick=async()=>{retry.disabled=true;try{await fetch('/__canvas/retry',{method:'POST'})}catch(e){}location.reload()};
tick();
</script>
</body>
</html>`;
}

function hasPayload(dir) {
  try {
    return fs.statSync(path.join(dir, BINARY_NAME)).isFile();
  } catch {
    return false;
  }
}

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

function findEndOfCentralDirectory(buffer) {
  const floor = Math.max(0, buffer.length - 66 * 1024);
  for (let offset = buffer.length - 22; offset >= floor; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

// 只用 node:zlib 解 ZIP：载荷由本仓库脚本以 store/deflate 生成，不需要打包器依赖。
// 逐条流式解压：载荷解压后远大于 200 MB，整包读入 Buffer 会把主进程内存顶到峰值。
function readExactly(fd, position, length) {
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const bytes = fs.readSync(fd, buffer, filled, length - filled, position + filled);
    if (bytes <= 0) throw new Error(`载荷文件意外结束（offset ${position + filled}）`);
    filled += bytes;
  }
  return buffer;
}

function copyRangeInto(archive, start, length, target) {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(archive, { start, end: start + length - 1 });
    const sink = fs.createWriteStream(target);
    sink.on("finish", resolve);
    sink.on("error", reject);
    source.on("error", reject);
    source.pipe(sink);
  });
}

function inflateRangeInto(archive, start, length, target) {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(archive, { start, end: start + length - 1 });
    const inflate = zlib.createInflateRaw();
    const sink = fs.createWriteStream(target);
    sink.on("finish", resolve);
    sink.on("error", reject);
    inflate.on("error", reject);
    source.on("error", reject);
    source.pipe(inflate).pipe(sink);
  });
}

async function extractZip(archive, destDir) {
  const fd = fs.openSync(archive, "r");
  let directory;
  let total;
  try {
    const size = fs.fstatSync(fd).size;
    const tailLength = Math.min(size, 66 * 1024);
    const tail = readExactly(fd, size - tailLength, tailLength);
    const eocd = findEndOfCentralDirectory(tail);
    if (eocd < 0) throw new Error("载荷不是有效的 ZIP：找不到中央目录");
    total = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (total === 0xffff || directoryOffset === 0xffffffff) throw new Error("暂不支持 ZIP64 格式的载荷");
    directory = readExactly(fd, directoryOffset, directorySize);
  } finally {
    fs.closeSync(fd);
  }

  const root = path.resolve(destDir);
  let cursor = 0;
  for (let index = 0; index < total; index++) {
    if (directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error("载荷 ZIP 中央目录损坏");
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
    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`载荷条目越出目标目录：${name}`);
    }

    const localFd = fs.openSync(archive, "r");
    let dataStart;
    try {
      const localNameLength = readExactly(localFd, localOffset + 26, 2).readUInt16LE(0);
      const localExtraLength = readExactly(localFd, localOffset + 28, 2).readUInt16LE(0);
      dataStart = localOffset + 30 + localNameLength + localExtraLength;
    } finally {
      fs.closeSync(localFd);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (method === 0) {
      await copyRangeInto(archive, dataStart, compressedSize, target);
    } else if (method === 8) {
      await inflateRangeInto(archive, dataStart, compressedSize, target);
    } else {
      throw new Error(`不支持的 ZIP 压缩方式：${method}`);
    }
    if (uncompressedSize && fs.statSync(target).size !== uncompressedSize) {
      throw new Error(`载荷条目大小不符：${name}`);
    }
  }
}

// 实测：undici 的连接超时在弱网下会随机 UND_ERR_CONNECT_TIMEOUT，而 node:https 可用；
// 同时 GitHub 的 Release 资产对单连接限速，因此这里用 https 分片并发 Range 下载。
// CANVAS_PAYLOAD_BASE_URL 只用于离线自测（本地 http 源），生产默认值不变。
const DOWNLOAD_CHUNKS = 8;
const CHUNK_ATTEMPTS = 3;

function httpRequest(url, { method = "GET", headers = {}, redirects = 5, timeout = 60000 } = {}) {
  // 默认走 https；CANVAS_PAYLOAD_BASE_URL 指向本地 http 时（离线自测）也能用。
  const client = new URL(url).protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { method, headers, timeout }, (res) => {
      const location = res.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(res.statusCode) && redirects > 0) {
        res.resume();
        resolve(httpRequest(new URL(location, url).toString(), { method, headers, redirects: redirects - 1 }));
        return;
      }
      resolve(res);
    });
    req.on("timeout", () => req.destroy(new Error("连接超时")));
    req.on("error", reject);
    req.end();
  });
}

// HEAD 经由 GitHub 的下载跳转时会被丢弃，取 1 字节 Range 读 Content-Range 更可靠。
async function payloadSize(url) {
  // 这里的网络到 GitHub 的连接建立经常要几十秒甚至直接超时，探测要肯重试。
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await httpRequest(url, { headers: { Range: "bytes=0-0" }, timeout: 30000 });
      res.destroy();
      const total = /\/(\d+)$/.exec(res.headers["content-range"] || "");
      if (total) return Number(total[1]);
      const length = Number(res.headers["content-length"]) || 0;
      if (res.statusCode === 200 && length > 0) return length;
    } catch {
      /* 继续重试 */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  return 0;
}

function partPath(archive, index) {
  return `${archive}.part${index}`;
}

function statSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function partsBytes(archive, count) {
  let total = 0;
  for (let index = 0; index < count; index += 1) total += statSize(partPath(archive, index));
  return total;
}

// 每个分片写进自己的 .partN 文件：进程被杀、宿主重启、连接断掉都能从已有字节接着取。
// 旧实现把八个分片写进同一个 filehandle，并且失败时删整个归档，续传收益会被路径本身抵消。
async function downloadChunk(url, file, start, end) {
  const expected = end - start + 1;
  let have = statSize(file);
  if (have === expected) return;
  if (have > expected) {
    fs.rmSync(file, { force: true });
    have = 0;
  }

  let lastError;
  for (let attempt = 1; attempt <= CHUNK_ATTEMPTS; attempt += 1) {
    let response;
    let watchdog;
    const from = start + have;
    try {
      response = await httpRequest(url, { headers: { Range: `bytes=${from}-${end}` }, timeout: 45000 });
      if (response.statusCode !== 206) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}`);
      }
      let lastActivity = Date.now();
      // 有的连接会写满后仍不关流，或者干脆停在那里；45 秒没有新数据就判死重试。
      watchdog = setInterval(() => {
        if (Date.now() - lastActivity > 45000) response.destroy(new Error("分片停滞"));
      }, 5000);
      response.on("data", () => {
        lastActivity = Date.now();
      });
      const sink = fs.createWriteStream(file, { flags: have > 0 ? "a" : "w" });
      await new Promise((resolve, reject) => {
        sink.on("finish", resolve);
        sink.on("error", reject);
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("连接中断")));
        response.pipe(sink);
      });
      const written = statSize(file);
      if (written !== expected) throw new Error(`字节不足 ${written}/${expected}`);
      if (process.env.CANVAS_DOWNLOAD_DEBUG) note(`分片 ${start}-${end} 完成（第 ${attempt} 次）`);
      return;
    } catch (err) {
      lastError = err;
      // 已落盘的部分留作下次续传的基线。
      have = statSize(file);
      if (have > expected) {
        fs.rmSync(file, { force: true });
        have = 0;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    } finally {
      if (watchdog) clearInterval(watchdog);
      if (response) response.destroy();
    }
  }
  throw lastError;
}

async function mergeParts(archive, parts) {
  const sink = fs.createWriteStream(archive);
  const finished = new Promise((resolve, reject) => {
    sink.on("finish", resolve);
    sink.on("error", reject);
  });
  try {
    for (const part of parts) {
      await new Promise((resolve, reject) => {
        const source = fs.createReadStream(part);
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
  const tick = setInterval(() => {
    STATE.receivedBytes = partsBytes(archive, DOWNLOAD_CHUNKS);
  }, 300);
  const settled = Promise.all(ranges.map((range) => downloadChunk(url, partPath(archive, range.index), range.start, range.end))).finally(
    () => clearInterval(tick),
  );
  return settled.then(async () => {
    STATE.receivedBytes = size;
    await mergeParts(
      archive,
      ranges.map((range) => partPath(archive, range.index)),
    );
    for (const range of ranges) fs.rmSync(partPath(archive, range.index), { force: true });
  });
}

async function downloadPayload(url, archive) {
  const size = await payloadSize(url);
  if (process.env.CANVAS_DOWNLOAD_DEBUG) note(`载荷字节数 ${size}，分 ${DOWNLOAD_CHUNKS} 片`);
  if (size > 0) {
    try {
      await downloadChunked(url, archive, size);
      if (fs.statSync(archive).size === size) return;
      throw new Error("分片下载长度不符");
    } catch (err) {
      // 不清空已有字节：合并包与 .partN 都还能作为单连接续传的基线。
      note(`分片下载失败（${err.message}），改用单连接重试`);
    }
  }

  note("改用单连接下载");
  // 单连接拿不到总长度时也要能续下：已有字节用 Range 接着取，并同样装停滞看门狗。
  const existing = statSize(archive);
  const res = await httpRequest(
    url,
    existing > 0 ? { headers: { Range: `bytes=${existing}-` } } : {},
  );
  if (res.statusCode !== 200 && res.statusCode !== 206) {
    res.resume();
    throw new Error(`运行时载荷下载失败：HTTP ${res.statusCode}（${url}）`);
  }
  const offset = res.statusCode === 206 ? existing : 0;
  const out = fs.createWriteStream(archive, { flags: offset > 0 ? "r+" : "w", start: offset });
  let lastActivity = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > 60000) res.destroy(new Error("下载停滞"));
  }, 5000);
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

async function provisionPayload(spec) {
  const url = `${PAYLOAD_BASE_URL}/${spec.file}`;
  const staging = `${PROVISION_DIR}.partial`;
  const archive = `${staging}.zip`;
  fs.mkdirSync(path.dirname(staging), { recursive: true });
  STATE.phase = "downloading";
  STATE.message = "首次启动，正在下载运行时载荷（约 200 MB）";
  STATE.error = null;
  note(`首次启动，正在下载运行时载荷（约 200 MB）：${url}`);

  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  // 弱网下整段下载也可能中断：重试时不清归档，已落盘的字节与 .partN 分片会接着用。
  for (let attempt = 1; ; attempt += 1) {
    try {
      await downloadPayload(url, archive);
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      note(`下载中断（${err.message}），第 ${attempt} 次重试`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }

  STATE.phase = "verifying";
  STATE.message = "正在校验运行时完整性";
  const digest = await hashFile(archive);
  if (digest !== spec.sha256) {
    // 只有"文件确实坏了"才值得丢掉续传基线。
    fs.rmSync(archive, { force: true });
    for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) fs.rmSync(partPath(archive, index), { force: true });
    throw new Error(`运行时载荷 sha256 不匹配：期望 ${spec.sha256}，实际 ${digest}`);
  }

  const megabytes = (fs.statSync(archive).size / 1048576).toFixed(1);
  note(`下载完成（${megabytes} MB，用时 ${Math.round((Date.now() - startedAt) / 1000)}s），开始解包`);

  STATE.phase = "extracting";
  STATE.message = "正在解包运行时";
  const extractStartedAt = Date.now();
  fs.rmSync(staging, { recursive: true, force: true });
  await extractZip(archive, staging);
  fs.chmodSync(path.join(staging, BINARY_NAME), 0o755);
  fs.rmSync(PROVISION_DIR, { recursive: true, force: true });
  fs.renameSync(staging, PROVISION_DIR);
  fs.rmSync(archive, { force: true });
  note(`运行时已就绪：${PROVISION_DIR}（解包 ${Math.round((Date.now() - extractStartedAt) / 1000)}s）`);
}

async function resolveRuntimeDir() {
  if (hasPayload(BUNDLED_DIR)) {
    note("使用包内自带运行时");
    return BUNDLED_DIR;
  }
  if (hasPayload(PROVISION_DIR)) {
    note(`复用已就绪的运行时 ${PROVISION_DIR}`);
    return PROVISION_DIR;
  }
  const spec = PAYLOADS[PLATFORM];
  if (!spec || !/^[a-f0-9]{64}$/.test(spec.sha256)) {
    throw new Error(`当前平台 ${PLATFORM} 暂无可用运行时载荷，请等待对应平台发布`);
  }
  await provisionPayload(spec);
  return PROVISION_DIR;
}

let preparing = false;

// 监听之后才走到这里：解析（或下载）运行时 → 分配端口 → 拉起后端。
// 失败不再 process.exit，而是把原因留在 STATE 里让界面显示并允许手动重试。
async function prepareRuntime() {
  if (preparing || STATE.phase === "ready") return;
  preparing = true;
  try {
    STATE.phase = "starting";
    STATE.message = "正在检查运行时";
    STATE.error = null;
    SERVER_DIR = await resolveRuntimeDir();
    GO_BINARY = path.join(SERVER_DIR, BINARY_NAME);
    WEB_DIST = path.join(SERVER_DIR, "web-dist");
    PI_RUNTIME = path.join(SERVER_DIR, "pi-runtime");
    PLUGIN_PACKAGES = path.join(SERVER_DIR, "plugin-packages");

    STATE.phase = "starting-backend";
    STATE.message = "正在启动后端";
    await reserveBackendPort();
    startBackend();
  } catch (error) {
    STATE.phase = "failed";
    STATE.error = error?.message ?? String(error);
    STATE.message = "运行时准备失败";
    console.error(`[open-ai-canvas] 运行时准备失败：${STATE.error}`);
  } finally {
    preparing = false;
  }
}

// 运行时目录在监听之后才解析（首次启动要下载 200 MB），所以这些路径先占位。
let SERVER_DIR = null;
let GO_BINARY = null;
let WEB_DIST = null;
let PI_RUNTIME = null;
let PLUGIN_PACKAGES = null;
let goProcess = null;

// --- session 存储 ---
const SESSION_FILE = path.join(DATA_DIR, "session.json");

function loadSession() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw);
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

function saveSession(token) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ token }), { mode: 0o600 });
  } catch (err) {
    console.error("[open-ai-canvas] Failed to save session:", err.message);
  }
}

let SESSION_TOKEN = loadSession();
let BACKEND_PORT = 0;


// --- Go 后端环境变量与启动 ---
function backendEnv() {
  return {
    ...process.env,
    CANVAS_BACKEND_ADDR: `127.0.0.1:${BACKEND_PORT}`,
    CANVAS_BACKEND_DATA_DIR: DATA_DIR,
    CANVAS_STATIC_DIR: WEB_DIST,
    CANVAS_CORS_ORIGINS: `http://127.0.0.1:${HOST_PORT},http://localhost:${HOST_PORT}`,
    CANVAS_EXIT_WITH_PARENT: "true",
    CANVAS_PARENT_PID: String(process.pid),
    GIN_MODE: "release",
    CANVAS_NODE_BIN: process.execPath,
    ...(fs.existsSync(PI_RUNTIME) ? { CANVAS_PI_RUNTIME_DIR: PI_RUNTIME } : {}),
    CANVAS_RUNTIME_AUTO_INSTALL: "false",
    CANVAS_OFFICIAL_PLUGIN_DIR: PLUGIN_PACKAGES,
    CANVAS_REGISTRATION_ENABLED: "false",
  };
}

// 分配一个固定端口交给 Go：它自己在 :0 模式下不回报真实端口。
async function reserveBackendPort() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      BACKEND_PORT = probe.address().port;
      probe.close(resolve);
    });
  });
}

// Go 用 log/slog 写 stderr，启动监听地址不会出现在 stdout，两条流都要解析。
function watchBackendOutput(chunk, sink) {
  const text = chunk.toString();
  sink.write(text);
  if (goPort) return;
  const match = text.match(/addr=(?:127\.0\.0\.1|\[::1\]|localhost):(\d+)/);
  if (!match || Number(match[1]) === 0) return;
  goPort = Number(match[1]);
  console.log(`[open-ai-canvas] Backend listening on port ${goPort}`);
  STATE.phase = "ready";
  STATE.message = "运行时已就绪";
  onBackendReady();
}

function startBackend() {
  console.log(`[open-ai-canvas] Starting backend: ${GO_BINARY}`);
  goProcess = spawn(GO_BINARY, [], {
    env: backendEnv(),
    cwd: SERVER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  goProcess.stdout.on("data", (chunk) => watchBackendOutput(chunk, process.stdout));
  goProcess.stderr.on("data", (chunk) => watchBackendOutput(chunk, process.stderr));
  goProcess.on("error", (error) => {
    STATE.phase = "failed";
    STATE.error = `后端子进程拉起失败：${error.message}`;
    STATE.message = "后端启动失败";
    console.error(`[open-ai-canvas] Failed to spawn backend: ${error.message}`);
  });
  goProcess.on("exit", (code, signal) => {
    console.log(`[open-ai-canvas] Backend exited: code=${code} signal=${signal}`);
    // 主动停止（宿主发了信号）不是故障，直接跟着退，不要把 failed 写进状态。
    if (shuttingDown) {
      process.exit(0);
    }
    // 准备阶段就退出说明后端根本起不来；把原因留给界面，而不是直接杀掉 shim。
    if (!goPort) {
      STATE.phase = "failed";
      STATE.error = `后端在启动阶段退出（code=${code} signal=${signal}）`;
      STATE.message = "后端启动失败";
      return;
    }
    process.exit(code ?? 1);
  });
}

let goPort = null;
let backendReadyResolve = null;
const backendReady = new Promise((resolve) => {
  backendReadyResolve = resolve;
});

function onBackendReady() {
  if (backendReadyResolve) backendReadyResolve();
  backendReadyResolve = null;
}

// --- 信号转发 ---
// 收到停止信号必须让 shim 自己退出：准备阶段子进程可能还没 spawn，
// 转发是空操作；已 spawn 的后端也不保证响应。shim 赖着不退，宿主会认为 stop 没生效，
// 反复重试并累积多个僵尸进程——这是「界面反复重试甚至崩溃」的一半成因。
let shuttingDown = false;

function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // 准备阶段还没有后端子进程，没有需要优雅关闭的东西，立刻退。
  if (!goProcess || goProcess.killed) {
    process.exit(0);
  }
  try {
    goProcess.kill(signal);
  } catch {
    process.exit(0);
  }
  // 给后端 3 s 优雅退出；下载中途退出留下的 .partN 正是续传要用的。
  const force = setTimeout(() => process.exit(0), 3_000);
  force.unref?.();
}
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

// ============================================================
// MCP Server —— 16 个工具，覆盖画布完整操控能力
// 参考 ADR-0002：画布 MCP 工具集、鉴权与操控能力边界
// ============================================================

// 画布内置 18 种节点类型
const BUILTIN_NODE_TYPES = [
  "image", "text", "drawing", "script", "skill", "config",
  "video", "audio", "frame", "markdown", "svg", "html",
  "panorama", "compare", "chart", "colorgrade", "media-conversion", "batch-table",
];

const MCP_TOOLS = [
  // --- 画布项目管理 ---
  {
    name: "list_canvas_projects",
    description: "List all canvas projects in the user's library.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 20)" },
      },
    },
  },
  {
    name: "get_canvas_project",
    description: "Get a canvas project by ID, including its nodes, connections, and revision.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  {
    name: "create_canvas_project",
    description: "Create a new canvas project. If canvas_id is omitted, a UUID is generated.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Canvas title (default: 'Untitled')" },
        canvas_id: { type: "string", description: "Optional canvas ID (UUID). If omitted, server generates one." },
      },
    },
  },
  {
    name: "delete_canvas_project",
    description: "Delete a canvas project by ID.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
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
          description: "Node position on canvas (default {x:0,y:0})",
        },
        width: { type: "number", description: "Node width in px" },
        height: { type: "number", description: "Node height in px" },
        metadata: { type: "object", description: "Node-specific metadata (call get_node_schema for the schema)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "type"],
    },
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
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id", "patch"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node from a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id"],
    },
  },
  {
    name: "list_node_types",
    description: "List all available node types (built-in + plugin-registered).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_node_schema",
    description: "Get the metadata schema for a given node type, so you know what fields to pass to add_node.",
    inputSchema: {
      type: "object",
      properties: {
        node_type: { type: "string", description: "Node type (e.g. image, text, config)" },
      },
      required: ["node_type"],
    },
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
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "from_node_id", "to_node_id"],
    },
  },
  {
    name: "delete_connection",
    description: "Delete a connection between nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        connection_id: { type: "string", description: "Connection ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "connection_id"],
    },
  },
  {
    name: "list_connections",
    description: "List all connections in a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
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
        timeout_seconds: { type: "number", description: "Max wait time in seconds (default 120)" },
      },
      required: ["canvas_id", "node_id", "prompt"],
    },
  },
  {
    name: "list_assets",
    description: "List assets (images/videos/audio) in the user's resource library.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by type: image, video, audio (optional)" },
        limit: { type: "number", description: "Max items (default 50)" },
      },
    },
  },
  {
    name: "get_canvas_state",
    description: "Get the full canvas state: revision, nodes, and connections. Use before write operations for conflict detection.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
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
          items: { type: "object" },
        },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "operations"],
    },
  },
];

// --- MCP 工具实现 ---

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function callCanvasApi(method, pathname, body) {
  if (!SESSION_TOKEN) {
    return errorResult("No active session. Please open the canvas in a browser and log in first. The session is captured automatically after login.");
  }
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: `open_ai_canvas_session=${SESSION_TOKEN}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 401) {
            SESSION_TOKEN = null;
            try { fs.unlinkSync(SESSION_FILE); } catch {}
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

// 发送画布操作（PATCH /canvas-projects/:id/operations）
async function applyCanvasOperations(canvasId, operations, baseRevision) {
  const body = { operations };
  if (baseRevision !== undefined) body.baseRevision = baseRevision;
  body.mutationId = crypto.randomUUID();
  return callCanvasApi("PATCH", `/api/canvas-projects/${canvasId}/operations`, body);
}

// 获取画布完整文档
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

// 从节点类型推断生成 mode
function inferGenerationMode(nodeType) {
  switch (nodeType) {
    case "image": return "image";
    case "text": return "text";
    case "video": return "video";
    case "audio": return "audio";
    default: return "image";
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
      const canvasId = args.canvas_id || crypto.randomUUID();
      const title = args.title || "Untitled";
      return applyCanvasOperations(canvasId, [
        { type: "create_canvas", id: "canvas", patch: { title } },
      ]);
    }

    case "delete_canvas_project":
      return callCanvasApi("DELETE", `/api/canvas-projects/${args.canvas_id}`);

    // --- 节点操作 ---
    case "add_node": {
      const nodeId = crypto.randomUUID();
      const operation = {
        type: "create_node",
        id: nodeId,
        node: {
          id: nodeId,
          type: args.type,
          title: args.title || args.type,
          position: args.position || { x: 0, y: 0 },
          ...(args.width !== undefined && { width: args.width }),
          ...(args.height !== undefined && { height: args.height }),
          metadata: args.metadata || {},
        },
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }

    case "update_node": {
      const operation = {
        type: "patch_node",
        id: args.node_id,
        patch: args.patch,
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }

    case "delete_node": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_node", id: args.node_id },
      ], args.base_revision);
    }

    case "list_node_types":
      return jsonResult({ builtin: BUILTIN_NODE_TYPES, note: "Plugin node types are discovered at runtime via get_node_schema." });

    case "get_node_schema": {
      // 内置节点的静态 schema（fallback，若后端提供端点则优先用后端）
      const schemas = {
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
        "batch-table": { fields: ["rows", "columns"], description: "Batch processing table node." },
      };
      const schema = schemas[args.node_type];
      if (!schema) {
        return jsonResult({ node_type: args.node_type, available: false, note: "Unknown node type. It may be a plugin-registered node; check the canvas UI for its schema." });
      }
      return jsonResult({ node_type: args.node_type, ...schema });
    }

    // --- 连接操作 ---
    case "connect_nodes": {
      const connectionId = crypto.randomUUID();
      return applyCanvasOperations(args.canvas_id, [
        {
          type: "create_connection",
          id: connectionId,
          connection: {
            id: connectionId,
            fromNodeId: args.from_node_id,
            toNodeId: args.to_node_id,
            ...(args.from_handle && { fromHandleId: args.from_handle }),
            ...(args.to_handle && { toHandleId: args.to_handle }),
          },
        },
      ], args.base_revision);
    }

    case "delete_connection": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_connection", id: args.connection_id },
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
      // 1. 读取节点 config
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const nodes = doc.project?.payload?.nodes || doc.nodes || [];
      const node = nodes.find((n) => n.id === args.node_id);
      if (!node) return errorResult(`Node ${args.node_id} not found in canvas.`);

      const mode = inferGenerationMode(node.type);
      const config = node.metadata?.config || node.metadata || {};
      const model = config.model || "";

      // 2. 提交生成任务
      const taskBody = {
        type: `canvas_${mode}`,
        operation: mode,
        prompt: args.prompt,
        ...(model && { model }),
        input: { mode, prompt: args.prompt, config },
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

      // 3. 轮询任务状态
      const timeoutMs = (args.timeout_seconds || 120) * 1000;
      const deadline = Date.now() + timeoutMs;
      const pollIntervalMs = 2000;
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

      // 4. 提取结果 URL 和 resource_id
      const resultUrl = finalResult.outputUrl || finalResult.resultUrl || finalResult.url || finalResult.output?.url || null;
      const resourceId = finalResult.resourceId || finalResult.outputResourceId || finalResult.output?.resourceId || null;

      return jsonResult({
        task_id: taskId,
        status: finalResult.status,
        result_url: resultUrl,
        resource_id: resourceId,
        raw: finalResult,
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
        connections: payload.connections || [],
      });
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
  req.on("data", (chunk) => (body += chunk));
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
            capabilities: { tools: {} },
          },
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

// --- 反向代理壳 ---
// 先监听、再准备：宿主的 /api/health/ready 一连接就能拿到 200，首次启动那 200 MB
// 下载与解包因此不再卡在宿主的健康超时里被反复中止。准备完成前，界面拿到的是
// 插件自己画的进度页，MCP 请求则等后端就绪（最多 90 秒）再交给真实处理器。
const MCP_WAIT_MS = 90_000;

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

function servePreparation(req, res) {
  if (req.method === "GET" && req.url === "/api/health/ready") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: STATE.phase === "failed" ? "error" : "preparing", ...progressSnapshot() }));
    return;
  }

  if (req.method === "GET" && req.url === "/__canvas/progress") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(progressSnapshot()));
    return;
  }

  if (req.method === "POST" && req.url === "/__canvas/retry") {
    STATE.phase = "starting";
    STATE.message = "正在重试";
    STATE.error = null;
    STATE.receivedBytes = 0;
    STATE.totalBytes = 0;
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    void prepareRuntime();
    return;
  }

  if (req.method === "POST" && req.url === "/mcp") {
    // 后端还没就绪时把 MCP 握手挂住，而不是立刻回 503。多数客户端愿意等，
    // 直接报错会被当成"该服务不支持 MCP"并缓存下来。
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
          error: { code: -32000, message: "Runtime is still preparing" },
        }),
      );
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(progressPage());
}

function startProxy() {
  const server = http.createServer((req, res) => {
    if (!goPort) {
      servePreparation(req, res);
      return;
    }

    // MCP 路由
    if (req.method === "POST" && req.url === "/mcp") {
      handleMcpRequest(req, res);
      return;
    }

    // 透传到 Go 后端
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        // 捕获 session cookie
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const cookie of cookies) {
            const match = cookie.match(/open_ai_canvas_session=([^;]+)/);
            if (match) {
              SESSION_TOKEN = match[1];
              saveSession(SESSION_TOKEN);
              console.log("[open-ai-canvas] Session captured");
            }
          }
        }

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Bad Gateway: ${err.message}`);
    });

    req.pipe(proxyReq);
  });

  // WebSocket upgrade 转发
  server.on("upgrade", (req, socket, head) => {
    if (!goPort) {
      socket.destroy();
      return;
    }

    const targetSocket = net.connect(goPort, "127.0.0.1", () => {
      let upgradeReq = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) upgradeReq += `${key}: ${v}\r\n`;
        } else {
          upgradeReq += `${key}: ${value}\r\n`;
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

  server.listen(HOST_PORT, "127.0.0.1", () => {
    console.log(`[open-ai-canvas] Proxy listening on http://127.0.0.1:${HOST_PORT}`);
  });
  return server;
}

// --- 启动序列：监听先就位，运行时随后准备 ---
startProxy();
void prepareRuntime();
