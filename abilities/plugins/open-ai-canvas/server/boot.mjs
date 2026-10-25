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
import { spawn, execFileSync } from "node:child_process";
import tls from "node:tls";
import { PassThrough } from "node:stream";
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
// 包内只装 boot.mjs（几十 KB 的 shim）；原生后端 + web-dist + 官方插件包压缩后约 200 MB，
// 远超 Desktop 的单包上限，所以首次启动时下载到 DATA_DIR/runtime/<payloadVersion>/ 并校验 sha256。
//
// ADR-0005 决策 4：sha256 不再写死在本文件里。插件包一旦发布就不可变，而载荷随上游版本变化——
// 把 5 个平台、2 类载荷的 sha256 抄进源码，等于每发一次上游都要重发一次插件。改为启动时取
// payload-manifest.json，由它决定「下哪个文件、校验什么值」。
const PAYLOAD_BASE_URL =
  process.env.CANVAS_PAYLOAD_BASE_URL ||
  "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-open-ai-canvas-payloads";
// 部分网络里 github.com 的 TCP 连接直接超时，但 api.github.com 与它 302 到的
// release-assets.githubusercontent.com 都可达。所以下载前先用 API 把资产名解析成
// https://api.github.com/repos/<repo>/releases/assets/<id>，由它重定向到真实对象存储。
const GITHUB_REPO = "maomaochong-ai/astravia-official-marketplace";
const RELEASE_TAG = "plugin-open-ai-canvas-payloads";
const MANIFEST_ASSET = "payload-manifest.json";

// 申报平台集合（ADR-0005 决策 7）。宿主按 `${platform}-${arch}` 精确查
// plugin.json#providers.services[0].runtime.platforms，查不到就等于该平台没有运行时，
// 所以这份键集必须与清单一致：scripts/check-service-platforms.mjs 在构建期比对两处。
// 真正的载荷差异在清单里——这里只回答「这个平台有没有被发布」。
const TARGET_PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];

const PLATFORM = `${process.platform}-${process.arch}`;
const BINARY_NAME = `yingce-backend${process.platform === "win32" ? ".exe" : ""}`;
const NODE_BINARY_NAME = process.platform === "win32" ? "node.exe" : "node";
const BUNDLED_DIR = RUNTIME_DIR;

// 清单解析结果。落盘目录由清单里的 payloadVersion 决定，所以这三个量要等 loadManifest 之后才有值。
const MANIFEST = { payloadVersion: "", upstream: null, platforms: {}, source: "" };
let PROVISION_DIR = null;
let AGENT_DIR = null;

function supportedPlatforms() {
  const fromManifest = Object.keys(MANIFEST.platforms);
  return (fromManifest.length > 0 ? fromManifest : TARGET_PLATFORMS).sort();
}

function note(message) {
  console.log(`[open-ai-canvas] ${message}`);
  pushLog(message);
}

// --- 准备阶段的可见状态 ---
// 宿主用 /api/health/ready 判定服务就绪，而首次启动要下载约 200 MB 载荷。
// 监听因此先就位、把下载放到监听之后：健康检查立刻通过，准备进度由 /__canvas/progress
// 暴露给下面这张准备页，而不是让整段下载卡在宿主的健康超时里被反复中止。
const STATE_LOG_LIMIT = 10;
const STATE = {
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
  error: null,
  // 机器可读的失败原因（/__canvas/state 的 code）。文案会变，code 不变：
  // 界面据此选提示、构建期据此断言，不要靠中文子串匹配。
  code: null,
};

function pushLog(text) {
  const trimmed = String(text ?? "").trim();
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

// 失败统一走这里：phase + code + 一句可复制的话。code 是契约，文案只是展示。
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

// 每次开始传新的文件就把计数清零，避免主载荷的 216 MB 和 Agent 载荷的 90 MB 混在一起。
function resetTransfer(fileName, approximateBytes) {
  STATE.fileName = fileName;
  STATE.receivedBytes = 0;
  STATE.totalBytes = approximateBytes || 0;
  STATE.speed = 0;
  STATE.sampledAt = 0;
  STATE.sampledBytes = 0;
  STATE.attempts = 0;
}

function transferSpeed() {
  const now = Date.now();
  if (!STATE.sampledAt) {
    STATE.sampledAt = now;
    STATE.sampledBytes = STATE.receivedBytes;
    return STATE.speed;
  }
  const seconds = (now - STATE.sampledAt) / 1000;
  if (seconds < 0.5) return STATE.speed;
  const delta = STATE.receivedBytes - STATE.sampledBytes;
  if (delta >= 0) STATE.speed = delta / seconds;
  STATE.sampledAt = now;
  STATE.sampledBytes = STATE.receivedBytes;
  return STATE.speed;
}

function progressSnapshot() {
  transferSpeed();
  const percent = STATE.totalBytes > 0 ? Math.min(100, (STATE.receivedBytes / STATE.totalBytes) * 100) : 0;
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
    elapsedSeconds: Math.max(0, Math.round((Date.now() - STATE.startedAt) / 1000)),
    attempts: STATE.attempts,
    retries: STATE.retries,
    log: STATE.log.map((entry) => ({ at: entry.at, text: entry.text })),
    error: STATE.error,
  };
}

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
  hostEl.textContent=p.endpoint?(p.endpoint+(p.source&&p.source!=='直连'?' · 代理 '+p.source:'')):'';
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
  // 创作 Agent 载荷有 2.5 万条目。逐条 open/close 归档读本地头会多出十几万次系统调用，
  // 在机械盘或文件监控开机时会明显变慢，所以全部条目复用一个只读 fd。
  const archiveFd = fs.openSync(archive, "r");
  let cursor = 0;
  try {
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

    const localNameLength = readExactly(archiveFd, localOffset + 26, 2).readUInt16LE(0);
    const localExtraLength = readExactly(archiveFd, localOffset + 28, 2).readUInt16LE(0);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;

    fs.mkdirSync(path.dirname(target), { recursive: true });
    // 空文件（node 的 include/ 里有几个）压缩后长度为 0，createReadStream 的 end 会小于 start，
    // 直接落一个空文件即可。
    if (compressedSize === 0) {
      fs.writeFileSync(target, Buffer.alloc(0));
    } else if (method === 0) {
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
  } finally {
    fs.closeSync(archiveFd);
  }
}

// 宿主不向插件进程注入任何代理变量。实测直连 github.com:443 会在 30 秒连接超时后失败，
// 而本机系统代理是通的：所以这里自己探测系统代理并走 CONNECT 隧道，探测不到或隧道不可用
// 时回退直连，行为与旧版一致。CANVAS_PAYLOAD_BASE_URL 指向本地 http 源（离线自测）时直连。
const DOWNLOAD_CHUNKS = 8;
const CHUNK_ATTEMPTS = 3;
const PLUGIN_USER_AGENT = "open-ai-canvas-plugin";
const REDIRECT_CODES = [301, 302, 303, 307, 308];

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

// macOS 的代理只存在于 scutil，Windows 在注册表，Linux 一般只有环境变量。
function detectSystemProxy() {
  const fromEnv =
    parseProxySpec(process.env.HTTPS_PROXY) ||
    parseProxySpec(process.env.https_proxy) ||
    parseProxySpec(process.env.HTTP_PROXY) ||
    parseProxySpec(process.env.http_proxy) ||
    parseProxySpec(process.env.ALL_PROXY) ||
    parseProxySpec(process.env.all_proxy);
  if (fromEnv) return { ...fromEnv, source: "env" };

  if (process.platform === "darwin") {
    try {
      const out = execFileSync("scutil", ["--proxy"], { encoding: "utf8", timeout: 3000 });
      const host = /HTTPSProxy\s*:\s*(\S+)/.exec(out)?.[1];
      const port = Number(/HTTPSPort\s*:\s*(\d+)/.exec(out)?.[1] || 0);
      if (/HTTPSEnable\s*:\s*1/.test(out) && host && port) return { host, port, source: "scutil" };
    } catch {
      /* 没有 scutil 或超时：当作无代理 */
    }
  }

  if (process.platform === "win32") {
    try {
      const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const out = execFileSync("reg", ["query", key], { encoding: "utf8", timeout: 3000 });
      if (/ProxyEnable\s+REG_DWORD\s+0x1/.test(out)) {
        const server = /ProxyServer\s+REG_SZ\s+(\S+)/.exec(out)?.[1] || "";
        const parsed = parseProxySpec(/https=([^;\s]+)/.exec(server)?.[1] || server);
        if (parsed) return { ...parsed, source: "registry" };
      }
    } catch {
      /* 读不到注册表就直连 */
    }
  }

  return null;
}

let PROXY_RESOLVED = false;
let ACTIVE_PROXY = null;

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
    const socket = isTls
      ? tls.connect({ host: hostname, port, servername: hostname, ALPNProtocols: ["http/1.1"] })
      : net.connect({ host: hostname, port });
    // 12 秒足够完成 DNS + TCP + TLS；不可达的域名不应该让首启页面干等 20 秒。
    socket.setTimeout(12000, () => socket.destroy(new Error("连接超时")));
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
      timeout: 12000,
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
      secure.setTimeout(20000, () => secure.destroy(new Error("TLS 握手超时")));
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

// 读到 \\r\\n\\r\\n 为止（含），返回 { statusCode, headers, rest }。
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

// 把响应体泵进一个 PassThrough，并让它的 destroy() 连带断开底层 socket。
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
  // 计数不能靠 body.on("data")：那会把 PassThrough 切到 flowing 模式，在读正文的调用方
  // 挂上监听之前就把前几块冲掉（API 返回的 JSON 就是这么被截头导致解析失败的）。
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
    // 只在「声明了长度却没读满」时算中断；无长度响应以读到 EOF 为准，不是异常。
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
      for (;;) {
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

  // 没有长度也没有分块：读到哪里算哪里。
  if (head.rest.length) body.write(head.rest);
  body.on("drain", () => socket.resume());
  socket.on("data", (chunk) => {
    if (finished) return;
    if (!body.write(chunk)) socket.pause();
  });
  return body;
}

// 一次请求：负责建连、写请求行、解析响应头，返回带 statusCode/headers 的可读流。
async function requestStream(url, { headers = {}, timeout = 45000 } = {}) {
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
    ...headers,
  };
  const lines = [`GET ${target.pathname}${target.search} HTTP/1.1`];
  for (const [key, value] of Object.entries(merged)) lines.push(`${key}: ${value}`);
  socket.write(`${lines.join("\r\n")}\r\n\r\n`);

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

// 旧签名保留：调用方只关心状态码、头和可读流。
async function httpRequest(url, { headers = {}, redirects = 5, timeout = 60000 } = {}) {
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

// 取载荷总字节：HEAD 会被 GitHub 的下载跳转丢掉，用 1 字节 Range 读 Content-Range 更可靠。
// 只试两次、每次 10 秒：下载源不可达时要尽快失败并给出可读提示，不能让人对着 0% 干等。
async function payloadSize(url, { attempts = 2, timeout = 10000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await httpRequest(url, {
        headers: { Range: "bytes=0-0", Accept: "application/octet-stream" },
        timeout,
      });
      const total = /\/(\d+)$/.exec(res.headers["content-range"] || "");
      const length = Number(res.headers["content-length"]) || 0;
      const status = res.statusCode;
      res.destroy();
      if (total) return Number(total[1]);
      if (status === 200 && length > 0) return length;
    } catch {
      /* 继续重试 */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
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
      response = await httpRequest(url, {
        headers: { Range: `bytes=${from}-${end}`, Accept: "application/octet-stream" },
        timeout: 45000,
      });
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
  setStage("downloading", "下载中", `正在下载 ${STATE.fileName}（${(size / 1048576).toFixed(0)} MB）`);
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
  STATE.attempts += 1;
  setStage("connecting", "连接下载源", `正在查询 ${STATE.fileName || path.basename(archive)} 的大小（第 ${STATE.attempts} 次）`);
  const size = await payloadSize(url);
  // 上一次在「校验/解包」阶段断掉时归档已经在盘上且长度正确：不必再花一个 200 MB 的下载。
  // 若内容其实已损坏，校验会失败并删档，下一次重试就会重新下载。
  if (size > 0 && statSize(archive) === size) {
    note(`归档已在本地（${size} 字节），跳过下载`);
    STATE.receivedBytes = size;
    return;
  }
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

// --- 下载来源解析 ---
// Releases 的固定下载链接会 302 到 objects.githubusercontent.com，而在部分网络里连
// github.com 的 TCP 都建不起来。api.github.com 与它 302 到的
// release-assets.githubusercontent.com 通常可达，所以先问 API 要资产地址，作为首选来源。
const ASSET_CACHE = new Map();

const NETWORK_FAILURE = /超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up|TLS|停滞|连接中断/i;

function endpointOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function readTextResponse(res, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(text);
    };
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      text += chunk;
      if (text.length > limit) {
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
      timeout: 12000,
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

// 候选顺序：显式镜像（CANVAS_PAYLOAD_BASE_URL）→ API 解析出的资产地址 → Release 固定链接。
// 前一个失败就换下一个；全都失败时把最后一次错误连同可操作提示交给页面。
async function candidateUrls(fileName) {
  const urls = [];
  const override = process.env.CANVAS_PAYLOAD_BASE_URL;
  if (override) urls.push(`${override.replace(/\/+$/, "")}/${fileName}`);
  const asset = await resolveAssetUrl(fileName);
  if (asset) urls.push(asset);
  const direct = `${PAYLOAD_BASE_URL.replace(/\/+$/, "")}/${fileName}`;
  if (!urls.includes(direct)) urls.push(direct);
  return urls;
}

function describeFailure(err) {
  const text = err?.message || String(err);
  if (!NETWORK_FAILURE.test(text)) return err instanceof Error ? err : new Error(text);
  const wrapped = new Error(
    `${text}\n所有下载来源都不可用。请确认当前网络能访问 GitHub；如果使用代理，` +
      `请在系统设置里开启后点「重试」。也可以设置 CANVAS_PAYLOAD_BASE_URL 指向可达的镜像目录。`,
  );
  wrapped.cause = err;
  return wrapped;
}

// 载荷下载只在首次安装后发生一次：校验通过就解到 staging，由调用方决定最终落点。

// --- 发布清单（ADR-0005 决策 4）---
// 清单是载荷的唯一事实源：平台 → 文件名 → sha256。它本身不做签名校验——
// 能改我们 release 的攻击者早就能改载荷本体，签名只多一套密钥管理，不增加实质阻力。
const SHA256_RE = /^[a-f0-9]{64}$/;
let manifestPromise = null;

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** 平台没有载荷时统一走这里：文案给用户，code 给界面（ADR-0004 决策 2）。 */
function unsupportedPlatformError() {
  const published = supportedPlatforms();
  const upstream = MANIFEST.upstream?.tag ? `（对应上游 ${MANIFEST.upstream.tag}）` : "";
  return codedError(
    "platform-unsupported",
    `当前平台 ${PLATFORM} 暂无可用运行时载荷${upstream}。已发布：${published.join(", ")}。` +
      `这不是安装出错，是该平台还没构建：请在已发布平台上使用，或设置 CANVAS_PAYLOAD_MANIFEST 指向自建清单。`,
  );
}

async function fetchManifestText() {
  // 显式清单优先（决策 3 的顺序）：本地文件路径或 http(s) 直链。自建镜像与离线自测
  // 靠它，也让「这个平台的载荷坏了」能在不发布新插件的情况下用一个清单切回去。
  const override = (process.env.CANVAS_PAYLOAD_MANIFEST || "").trim();
  if (override) {
    const local = !/^https?:\/\//i.test(override);
    try {
      const text = local ? fs.readFileSync(override, "utf8") : await readTextResponse(await httpRequest(override, { timeout: 20000 }));
      note(`清单来自 CANVAS_PAYLOAD_MANIFEST：${override}`);
      return { text, url: override };
    } catch (err) {
      const wrapped = describeFailure(err);
      wrapped.code = "payload-manifest-unreadable";
      wrapped.message = `CANVAS_PAYLOAD_MANIFEST 不可读（${override}）：${err.message}`;
      throw wrapped;
    }
  }
  const candidates = await candidateUrls(MANIFEST_ASSET);
  let lastError;
  for (const [index, candidate] of candidates.entries()) {
    STATE.endpoint = endpointOf(candidate);
    try {
      note(`清单来源 ${index + 1}/${candidates.length}：${STATE.endpoint}`);
      const res = await httpRequest(candidate, {
        headers: { Accept: "application/vnd.github+json" },
        timeout: 20000,
      });
      if (res.statusCode !== 200) {
        res.resume();
        throw new Error(`HTTP ${res.statusCode}`);
      }
      return { text: await readTextResponse(res), url: candidate };
    } catch (err) {
      lastError = err;
      note(`清单来源不可用：${err.message}`);
    }
  }
  const wrapped = describeFailure(lastError ?? new Error("没有可用的清单来源"));
  wrapped.code = "payload-unreachable";
  throw wrapped;
}

/** 把发布清单压成内部形态；任何一处不合规都带 code 失败，绝不猜。 */
function parseManifest(text) {
  let data;
  try {
    data = JSON.parse(text);
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
    // 每类载荷都必须有 file + sha256；agent 可缺（可降级），payload 不可缺。
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
    const { text, url } = await fetchManifestText();
    const parsed = parseManifest(text);
    MANIFEST.payloadVersion = parsed.payloadVersion;
    MANIFEST.upstream = parsed.upstream;
    MANIFEST.platforms = parsed.platforms;
    MANIFEST.source = endpointOf(url);
    PROVISION_DIR = path.join(DATA_DIR, "runtime", MANIFEST.payloadVersion);
    AGENT_DIR = path.join(DATA_DIR, "runtime", `agent-${MANIFEST.payloadVersion}`);
    const upstream = MANIFEST.upstream?.tag ? `，上游 ${MANIFEST.upstream.tag}` : "";
    note(`发布清单 ${MANIFEST.payloadVersion}${upstream}，平台 ${Object.keys(MANIFEST.platforms).join(", ")}`);
    return MANIFEST;
  })();
  // 失败不缓存：用户点「重试」时要能重新取。
  try {
    return await manifestPromise;
  } catch (err) {
    manifestPromise = null;
    throw err;
  }
}

// 两个载荷共用这一段，区别只在 label 与文案里的体积。
async function stageArchive(spec, staging, label, approximateMB) {
  const candidates = await candidateUrls(spec.file);
  const archive = `${staging}.zip`;
  fs.mkdirSync(path.dirname(staging), { recursive: true });
  resetTransfer(spec.file, approximateMB * 1024 * 1024);
  STATE.error = null;
  STATE.retries = 0;
  setStage("downloading", `下载${label}`, `首次启动，正在下载${label}（约 ${approximateMB} MB）`);
  note(`候选下载来源 ${candidates.length} 个`);

  const startedAt = Date.now();
  // 弱网下整段下载也可能中断：重试时不清归档，已落盘的字节与 .partN 分片会接着用。
  let lastError;
  for (const [index, candidate] of candidates.entries()) {
    STATE.endpoint = endpointOf(candidate);
    note(`下载来源 ${index + 1}/${candidates.length}：${STATE.endpoint}`);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await downloadPayload(candidate, archive);
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err;
        STATE.retries += 1;
        note(`下载中断（${err.message}），第 ${attempt}/2 次`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    if (!lastError) break;
  }

  if (lastError) {
    const wrapped = describeFailure(lastError);
    // 所有候选源都失败：网络/代理/镜像问题，与机器平台无关。
    wrapped.code = "payload-unreachable";
    throw wrapped;
  }

  setStage("verifying", "校验完整性", `正在校验${label}完整性`);
  const digest = await hashFile(archive);
  if (digest !== spec.sha256) {
    // 只有"文件确实坏了"才值得丢掉续传基线。
    fs.rmSync(archive, { force: true });
    for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) fs.rmSync(partPath(archive, index), { force: true });
    const mismatch = new Error(`${label} sha256 不匹配：期望 ${spec.sha256}，实际 ${digest}`);
    mismatch.code = "payload-checksum-mismatch";
    throw mismatch;
  }

  const megabytes = (fs.statSync(archive).size / 1048576).toFixed(1);
  note(`下载完成（${megabytes} MB，用时 ${Math.round((Date.now() - startedAt) / 1000)}s），开始解包`);

  setStage("extracting", `解包${label}`, `正在解包${label}（${megabytes} MB）`);
  const extractStartedAt = Date.now();
  fs.rmSync(staging, { recursive: true, force: true });
  try {
    await extractZip(archive, staging);
  } catch (err) {
    err.code = "payload-extract-failed";
    throw err;
  }
  fs.rmSync(archive, { force: true });
  note(`${label}已解包到 ${staging}（${Math.round((Date.now() - extractStartedAt) / 1000)}s）`);
}

// 体积用清单里的 bytes 提示进度条；缺失时按 200 MB 估，只影响“剩余时间”的展示。
function megabytesOf(spec, fallback) {
  return spec.bytes > 0 ? Math.round(spec.bytes / (1024 * 1024)) : fallback;
}

async function provisionPayload(spec) {
  const staging = `${PROVISION_DIR}.partial`;
  await stageArchive(spec, staging, "运行时载荷", megabytesOf(spec, 200));
  const binary = path.join(staging, BINARY_NAME);
  if (!fs.existsSync(binary)) {
    throw codedError("payload-extract-failed", `载荷里没有后端可执行文件 ${BINARY_NAME}`);
  }
  fs.chmodSync(binary, 0o755);
  fs.rmSync(PROVISION_DIR, { recursive: true, force: true });
  fs.renameSync(staging, PROVISION_DIR);
  note(`运行时已就绪：${PROVISION_DIR}`);
}

function hasAgentRuntime(dir) {
  return fs.existsSync(path.join(dir, "pi-runtime", "agent-runtime.mjs"));
}

// 创作 Agent 是可降级的：它缺席只会让 Agent 任务起不来，不该拦住整个画布，
// 所以准备失败在 resolveAgentDir 里就地吞掉，不往上抛。
async function provisionAgentRuntime(spec) {
  const staging = `${AGENT_DIR}.partial`;
  await stageArchive(spec, staging, "创作 Agent 运行时", megabytesOf(spec, 80));
  const nodeBin = path.join(staging, "node", "bin", NODE_BINARY_NAME);
  if (fs.existsSync(nodeBin)) fs.chmodSync(nodeBin, 0o755);
  fs.rmSync(AGENT_DIR, { recursive: true, force: true });
  fs.renameSync(staging, AGENT_DIR);
  note(`创作 Agent 运行时已就绪：${AGENT_DIR}`);
}

async function resolveAgentDir() {
  if (AGENT_DIR && hasAgentRuntime(AGENT_DIR)) {
    note(`复用已就绪的创作 Agent 运行时 ${AGENT_DIR}`);
    return AGENT_DIR;
  }
  // 包自带运行时（BUNDLED_DIR）时不经过 resolveRuntimeDir，清单还没取；Agent 载荷在清单里，补取一次。
  // 取不到就降级：创作 Agent 缺席不该拦住画布。
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

// pi 用到了 node 22 才有的 node:fs globSync，而宿主可能用 Electron 内置的 20.x 启动本进程，
// 那个 node 跑 pi 会直接 SyntaxError。所以优先用载荷自带的 node，其次才看宿主进程。
function resolveNodeBin(agentDir) {
  const bundled = path.join(agentDir, "node", "bin", NODE_BINARY_NAME);
  if (fs.existsSync(bundled)) return bundled;
  const version = process.versions.node ?? "0.0.0";
  const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  if (major > 22 || (major === 22 && minor >= 19)) return process.execPath;
  note(`宿主 node ${version} 低于 pi 要求的 22.19.0，载荷又未提供 node；Agent 任务可能起不来`);
  return "";
}

async function resolveRuntimeDir() {
  if (hasPayload(BUNDLED_DIR)) {
    note("使用包内自带运行时");
    return BUNDLED_DIR;
  }
  // 平台门禁先离线判一次：未申报的平台不该跑一趟网络请求才失败（ADR-0004 决策 2）。
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

let preparing = false;

// 监听之后才走到这里：解析（或下载）运行时 → 分配端口 → 拉起后端。
// 失败不再 process.exit，而是把原因留在 STATE 里让界面显示并允许手动重试。
async function prepareRuntime() {
  if (preparing || STATE.phase === "ready") return;
  preparing = true;
  try {
    STATE.phase = "starting";
    STATE.message = "正在检查运行时";
    clearFailure();
    SERVER_DIR = await resolveRuntimeDir();
    GO_BINARY = path.join(SERVER_DIR, BINARY_NAME);
    WEB_DIST = path.join(SERVER_DIR, "web-dist");
    PI_RUNTIME = path.join(SERVER_DIR, "pi-runtime");
    PLUGIN_PACKAGES = path.join(SERVER_DIR, "plugin-packages");

    // 创作 Agent 与它要用的 node 是独立载荷。上游把 pi 打包给后端自行解包；我们多做一步，
    // 把 node 也一并发，因为宿主进程的 node 可能不满足 pi 的 22.19.0 下限。
    const agentDir = await resolveAgentDir();
    if (agentDir) {
      PI_RUNTIME = path.join(agentDir, "pi-runtime");
      NODE_BIN = resolveNodeBin(agentDir);
    }

    STATE.phase = "starting-backend";
    STATE.message = "正在启动后端";
    await reserveBackendPort();
    startBackend();
  } catch (error) {
    // code 是契约：解析/下载/解包/守卫各自带过来，缺失时退到 prepare-failed。
    fail(error?.code ?? "prepare-failed", error?.message ?? String(error), "运行时准备");
    console.error(`[open-ai-canvas] 运行时准备失败（${STATE.code}）：${STATE.error}`);
  } finally {
    preparing = false;
  }
}

// 运行时目录在监听之后才解析（首次启动要下载 200 MB），所以这些路径先占位。
let SERVER_DIR = null;
let GO_BINARY = null;
let WEB_DIST = null;
let PI_RUNTIME = null;
let NODE_BIN = "";
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
    // 公开资源基址：上传到本地存储的文件要拼出一个浏览器能取回的绝对地址，
    // 后端在它为空时直接拒绝（资源接口返回「尚未配置服务器访问地址」）。端口由宿主分配、
    // 每次启动都可能变，所以只能在这里算，不能写成固定配置。
    CANVAS_PUBLIC_BASE_URL: `http://127.0.0.1:${HOST_PORT}`,
    ...(NODE_BIN ? { CANVAS_NODE_BIN: NODE_BIN } : {}),
    ...(fs.existsSync(PI_RUNTIME) ? { CANVAS_PI_RUNTIME_DIR: PI_RUNTIME } : {}),
    CANVAS_RUNTIME_AUTO_INSTALL: "false",
    // ADR-0006 决策 2：画布渠道要指回本机回环上的模型桥（/bridge/v1），而后端默认把
    // 回环/私网地址当作 SSRF 风险拒掉。只放行回环字面量，不放宽成整段私网。
    CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS: "127.0.0.1,localhost",
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
  clearFailure();
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
    fail("backend-spawn-failed", `后端子进程拉起失败：${error.message}`, "后端启动");
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
      fail("backend-exited", `后端在启动阶段退出（code=${code} signal=${signal}）`, "后端启动");
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
// MCP Server —— 18 个工具，覆盖画布完整操控能力
// 参考 ADR-0002（工具集与鉴权）与 ADR-0007（声明式编排）
// ============================================================

// 画布内置 18 种节点类型
const BUILTIN_NODE_TYPES = [
  "image", "text", "drawing", "script", "skill", "config",
  "video", "audio", "frame", "markdown", "svg", "html",
  "panorama", "compare", "chart", "colorgrade", "media-conversion", "batch-table",
];


// 节点 metadata 的已知字段。只用来在提交前拦住「类型不存在」这类一眼能看出的错误，
// 不做严格校验：插件节点与上游新增字段都在这里之外，后端才是权威。
const NODE_SCHEMAS = {
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

// ADR-0007：自动布局的网格尺寸。改这里只影响没给 position 的节点。
let LAST_WORKFLOW = null;

const LAYOUT_STEP_X = 400;
const LAYOUT_STEP_Y = 280;

/**
 * 把声明式 workflow 编译成一批 operations（ADR-0007 决策 2）。
 * 不做的事：不猜节点语义、不补默认 metadata、不代跑生成。
 * 做的事：校验类型、按依赖分层布局、按 __key 幂等。
 *
 * @param workflow    { nodes, edges }
 * @param existing    { nodes, connections }，来自当前画布（可为空）
 */
function compileWorkflow(workflow, existing) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  if (nodes.length === 0) throw codedError("workflow-empty", "workflow.nodes 不能为空");

  const byKey = new Map();
  for (const node of nodes) {
    const key = String(node?.key ?? "");
    if (!key) throw codedError("workflow-invalid-node", "每个节点都需要 key（用于连线与幂等）");
    if (byKey.has(key)) throw codedError("workflow-invalid-node", `节点 key 重复：${key}`);
    if (!BUILTIN_NODE_TYPES.includes(node.type)) {
      throw codedError(
        "unknown_node_type",
        `unknown_node_type: ${node.type}（内置类型：${BUILTIN_NODE_TYPES.join(", ")}；插件节点请先用 add_node 确认）`,
      );
    }
    byKey.set(key, node);
  }

  // 深度 = 依赖链长度。edges 里的两端必须在 nodes 里，否则拼出来的图是断的。
  const parents = new Map(nodes.map((node) => [node.key, [...(node.depends_on ?? [])]]));
  for (const edge of workflow?.edges ?? []) {
    if (!byKey.has(edge?.from) || !byKey.has(edge?.to)) {
      throw codedError("workflow-invalid-edge", `连线引用了不存在的节点：${edge?.from} → ${edge?.to}`);
    }
    if (edge.to === edge.from) throw codedError("workflow-cycle", "节点不能连自己");
    parents.get(edge.to).push(edge.from);
  }

  const depth = new Map();
  const visiting = new Set();
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
    existingNodes.filter((node) => node?.metadata?.__key).map((node) => [node.metadata.__key, node]),
  );
  // 已存在的连线按「起点→终点节点 id」去重，否则重试一次就会多一层重复连线。
  const priorEdges = new Set(
    (existing?.connections ?? []).map((conn) => `${conn.fromNodeId}->${conn.toNodeId}`),
  );

  const rows = new Map();
  const operations = [];
  const mapping = {};

  for (const node of nodes) {
    const column = depthOf(node.key);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    const position = node.position ?? { x: column * LAYOUT_STEP_X, y: row * LAYOUT_STEP_Y };
    const metadata = { ...(node.metadata ?? {}), __key: node.key };
    const prior = priorByKey.get(node.key);

    if (prior) {
      // 幂等：同一个 key 再来一次是改，不是再造一份。
      mapping[node.key] = prior.id;
      operations.push({
        type: "patch_node",
        id: prior.id,
        patch: { title: node.title ?? prior.title, position, metadata },
      });
      continue;
    }

    const id = crypto.randomUUID();
    mapping[node.key] = id;
    operations.push({
      type: "create_node",
      id,
      node: {
        id,
        type: node.type,
        title: node.title || node.type,
        position,
        ...(node.width !== undefined && { width: node.width }),
        ...(node.height !== undefined && { height: node.height }),
        metadata,
      },
    });
  }

  for (const edge of workflow?.edges ?? []) {
    const signature = `${mapping[edge.from]}->${mapping[edge.to]}`;
    if (priorEdges.has(signature)) continue;
    const id = crypto.randomUUID();
    operations.push({
      type: "create_connection",
      id,
      connection: { id, fromNodeId: mapping[edge.from], toNodeId: mapping[edge.to] },
    });
  }

  return { operations, mapping, depth: Object.fromEntries(depth) };
}
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
    description: "Create a new canvas project and return its id, title, revision and the browser URL to open it. Requires a captured browser session: open the canvas in a browser and log in once first. If canvas_id is omitted, a UUID is generated.",
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
  // --- 声明式编排（ADR-0007）---
  {
    name: "apply_workflow",
    description:
      "Apply a whole workflow in ONE request: nodes + edges described declaratively, laid out automatically, validated before submit, and idempotent by node key. Use this instead of many add_node/connect_nodes calls when building a multi-step workflow. Returns the key→node_id mapping and the canvas URL. Generation does NOT run unless run is true, and even then only for nodes marked {\"run\": true}.",
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
            edges: { type: "array", items: { type: "object" } },
          },
          required: ["nodes"],
        },
      },
      required: ["canvas_id", "workflow"],
    },
  },
  {
    name: "export_workflow",
    description:
      "Read a canvas back as the same declarative structure apply_workflow accepts, so an existing layout can be reused as a template.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
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

// 画布在浏览器里的地址。端口由宿主每次启动分配，所以只能运行时拼；
// 新建成功后直接把它返回给调用方，省得人在端口号上打转。
function canvasUrl(canvasId) {
  return `http://127.0.0.1:${HOST_PORT}/canvas/${canvasId}`;
}

// 把后端返回的 {"code":0,"data":{...},"msg":"ok"} 展开，并把画布地址一并给出。
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
/**
 * 和 callCanvasApi 同样带会话，但把状态码原样交回来。
 *
 * 渠道管理要区分「没登录」和「写失败」：前者该引导用户登录，后者该把画布的原话
 * 报给用户。callCanvasApi 把所有错误压成一句话，这里不够用。
 */
async function rawCanvasApi(method, pathname, body) {
  if (!SESSION_TOKEN) return { status: 401, body: { code: "canvas-login-required" } };
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: { "Content-Type": "application/json", Cookie: `open_ai_canvas_session=${SESSION_TOKEN}` },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 401) {
            SESSION_TOKEN = null;
            try { fs.unlinkSync(SESSION_FILE); } catch {}
            resolve({ status: 401, body: { code: "canvas-login-required" } });
            return;
          }
          let parsed;
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on("error", (err) => resolve({ status: 502, body: { code: "canvas-unreachable", message: err.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 画布渠道的创建/更新（ADR-0006 决策 2）。
 *
 * 渠道是 system scope，密钥入库后不可再读回（publicChannel 对 system scope 只返回
 * "system" 占位），所以更新时把同一个 token 再写一次——它本来就是本地随机串，重写无害。
 */
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
      // create_canvas 操作的 id 必须等于 URL 里的画布 id，后端会做一致性校验
      // （写成固定的 "canvas" 会被拒绝：画布创建操作的 ID 与请求路径不一致）。
      const created = await applyCanvasOperations(canvasId, [
        { type: "create_canvas", id: canvasId, patch: { title } },
      ]);
      return withCanvasUrl(created, canvasId);
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
      const schema = NODE_SCHEMAS[args.node_type];
      if (!schema) {
        return jsonResult({ node_type: args.node_type, available: false, note: "Unknown node type. It may be a plugin-registered node; check the canvas UI for its schema." });
      }
      return jsonResult({ node_type: args.node_type, ...schema });
    }

    // --- 声明式编排（ADR-0007）---
    case "apply_workflow": {
      // 先读当前图：幂等（按 __key）与连线去重都依赖它。读不到就直报错——
      // 在不知道现有节点的情况下提交 create_node 会把节点再造一份。
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
        // 409 是 revision 冲突：把当前 revision 一起告诉调用方，方便它读完重试。
        const text = applied.content?.[0]?.text ?? "";
        if (/\b409\b|revision/i.test(text)) {
          return errorResult(`revision_conflict: ${text}（当前 revision ${payload.revision}，请重新读取后再提交）`);
        }
        return applied;
      }

      // 生成需要显式开启：一句「搭 20 镜分镜」不该把 20 次付费生成打出去。
      const runTargets = args.run
        ? (args.workflow.nodes ?? []).filter((node) => node?.run === true)
        : [];
      const results = [];
      for (const node of runTargets) {
        const nodeId = compiled.mapping[node.key];
        if (!nodeId) continue;
        const result = await handleMcpToolCall("run_generation", {
          canvas_id: args.canvas_id,
          node_id: nodeId,
          prompt: node.metadata?.prompt || node.metadata?.content || node.title || "",
        });
        results.push({ key: node.key, node_id: nodeId, ...(result.isError ? { error: result.content[0].text } : {}) });
      }

      // 记一笔最近一次应用，供插件视图显示（ADR-0007 决策 5）：用户点不点、agent 做了什么，
      // 应当在界面里能看到，而不是只能靠读会话记录。
      LAST_WORKFLOW = {
        at: Date.now(),
        canvasId: args.canvas_id,
        revision: baseRevision + 1,
        nodes: (args.workflow.nodes ?? []).length,
        edges: (args.workflow.edges ?? []).length,
        operations: compiled.operations.length,
        generationCount: results.length,
        idempotent: compiled.operations.every((operation) => operation.type !== "create_node"),
      };

      return withCanvasUrl(
        jsonResult({
          applied: true,
          revision: baseRevision + 1,
          nodes: (args.workflow.nodes ?? []).length,
          edges: (args.workflow.edges ?? []).length,
          operations: compiled.operations.length,
          mapping: compiled.mapping,
          depth: compiled.depth,
          ...(results.length > 0 && { generations: results }),
        }),
        args.canvas_id,
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
          ...(node.width !== undefined && { width: node.width }),
          ...(node.height !== undefined && { height: node.height }),
          metadata: Object.fromEntries(Object.entries(node.metadata ?? {}).filter(([name]) => name !== "__key")),
        })),
        edges: connections.map((conn) => ({
          from: keyOf(nodes.find((node) => node.id === conn.fromNodeId) ?? { id: conn.fromNodeId }),
          to: keyOf(nodes.find((node) => node.id === conn.toNodeId) ?? { id: conn.toNodeId }),
        })),
      };
      return jsonResult({ revision: payload.revision, workflow });
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

// 本机运维状态都用同一份响应头：不缓存，且允许宿主渲染进程（另一个 origin）读。
// 里面只有准备进度与失败原因，不含会话 token。
function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

// /__canvas/state 是插件侧真正的就绪判据：ready 只在后端子进程已报告监听地址时为真。
// 宿主看到的 /api/health/ready 恒 200（ADR-0003 决策 5），不能用来判断画布能不能用。
function stateSnapshot() {
  return {
    ...progressSnapshot(),
    ready: Boolean(goPort) && STATE.phase === "ready",
    backend: Boolean(goPort),
    // 插件视图用它显示「桥在线 / 离线」，没这个字段就只能猜。
    bridge: { executorOnline: bridgeExecutorOnline(), models: BRIDGE.models.length },
    workflow: LAST_WORKFLOW,
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

// --- 模型桥（ADR-0006）---
// 画布只看见一个 OpenAI 兼容端点；真正的推理在插件运行时里用 ctx.ai 执行。
// 为什么是接力而不是直连：这个 shim 能监听端口但没有 ctx，插件运行时反过来。
// 两端各缺一半，队列拼起来才成立。宿主密钥始终不进这个文件、也不进画布配置。
const BRIDGE_FILE = path.join(DATA_DIR, "bridge.json");
const BRIDGE_JOB_TTL_MS = 5 * 60_000;
const BRIDGE_IDLE_MS = 180_000;
const BRIDGE_LONGPOLL_MS = 25_000;
const BRIDGE_EXECUTOR_STALE_MS = 45_000;

function loadBridgeState() {
  try {
    return JSON.parse(fs.readFileSync(BRIDGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveBridgeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

// token 只存在本机数据目录，画布渠道里那一份是它自己的渠道密钥，两边不共用。
function bridgeToken() {
  const state = loadBridgeState();
  if (typeof state.token === "string" && state.token.length >= 32) return state.token;
  const token = crypto.randomBytes(24).toString("hex");
  saveBridgeState({ ...state, token, createdAt: new Date().toISOString() });
  return token;
}

const BRIDGE = {
  models: [],
  modelsAt: 0,
  lastPollAt: 0,
  jobs: new Map(),
  waiters: [],
};

// 「执行者在线」= 最近一次长轮询还在窗口内。插件视图被关掉时它会自然过期，
// 于是画布拿到的是明确的 503 而不是无限等下去。
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
    } catch {}
  }
}

/** 把一条排队中的 chat 请求转成 SSE；首次写之前不锁状态码，错能报成 502。 */
function bridgeWriteChunk(job, delta) {
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

function bridgeFinishJob(job, error) {
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
    ...(job.temperature !== undefined && { temperature: job.temperature }),
    ...(job.max_tokens !== undefined && { max_tokens: job.max_tokens }),
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
    "Access-Control-Allow-Origin": "*",
  });
  res.end(
    JSON.stringify({
      object: "list",
      data: BRIDGE.models.map((model) => ({ id: model.id, object: "model", owned_by: "astravia" })),
    }),
  );
}

function bridgeServeChat(req, res) {
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
      const job = {
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
function bridgeServeMedia(res) {
  bridgeJson(res, 501, {
    error: {
      message:
      "Text is bridged to Astravia. Image and video generation are not: the host does not expose " +
        "key-level media generation to plugins. Configure an image/video channel inside the canvas instead.",
      code: "host-media-not-exposed",
    },
  });
}

/** 桥的全部分流。返回 true 表示这个请求已经处理完。 */
function serveBridge(req, res, pathname) {
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

  bridgeJson(res, 404, { error: { message: `Unknown bridge route ${pathname}`, code: "bridge-not-found" } });
  return true;
}

function startProxy() {
  // 一开始就把 token 落盘：插件运行时靠它才能长轮询取任务，晚创建就代表
  // 桥在启动后头几秒是哑的。（bridge.json 里只有本地随机串，不含任何密钥。）
  try {
    bridgeToken();
  } catch (err) {
    console.error("[open-ai-canvas] Failed to initialise bridge token:", err.message);
  }
  const server = http.createServer((req, res) => {
    // 准备中、失败后、就绪后都要能回答：这个端点永远由 shim 自己处理，不经 Go。
    if (req.method === "GET" && req.url === "/__canvas/state") {
      sendJson(res, stateSnapshot());
      return;
    }

    // 模型桥不依赖 Go 后端：它得与后端就绪状态解耦，才能在重试/重启后接着用。
    {
      const pathname = (req.url || "/").split("?")[0];
      if (serveBridge(req, res, pathname)) return;
    }

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
