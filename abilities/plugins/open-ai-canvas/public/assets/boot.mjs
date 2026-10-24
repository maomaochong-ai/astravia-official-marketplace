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
// 包内只装 boot.mjs（几十 KB 的 shim）；Go 二进制 + web-dist + 官方插件包压缩后约 200 MB，
// 远超 Desktop 的 50 MB 单包上限，因此首次启动时下载到 DATA_DIR/runtime/<version>/ 并校验 sha256。
const PAYLOAD_VERSION = "0.0.1";
const PAYLOAD_BASE_URL =
  process.env.CANVAS_PAYLOAD_BASE_URL ||
  "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-open-ai-canvas";
// 部分网络里 github.com 的 TCP 连接直接超时，但 api.github.com 与它 302 到的
// release-assets.githubusercontent.com 都可达。所以下载前先用 API 把资产名解析成
// https://api.github.com/repos/<repo>/releases/assets/<id>，由它重定向到真实对象存储。
const GITHUB_REPO = "maomaochong-ai/astravia-official-marketplace";
const RELEASE_TAG = "plugin-open-ai-canvas";
const PAYLOADS = {
  "darwin-arm64": { file: "payload-0.0.1-darwin-arm64.zip", sha256: "fb46396533b5b0c82b533f06141918bfaa2fb1a984b9a5bec123d642d545c0c7" },
};

// 创作 Agent（pi）与它要用的 node 是第二个载荷。上游把它单独打成 pi-runtime.tar.gz 交给
// 后端解包，我们照做：242 MB / 2.5 万文件塞进主载荷会让每次升级都重下整包。
// node 也从这里发：宿主进程的 node 可能是 Electron 内置的 20.x，而 pi 用到了 22 才有的
// node:fs globSync，跑在 20 上会直接 SyntaxError。
const AGENT_PAYLOAD_VERSION = "0.0.1";
const AGENT_PAYLOADS = {
  "darwin-arm64": { file: "agent-runtime-0.0.1-darwin-arm64.zip", sha256: "06e62d951cf711a0489adde5303c2cfd3448868dbfabc6ed1a7d1671daa93ad6" },
};

const PLATFORM = `${process.platform}-${process.arch}`;
const BINARY_NAME = `yingce-backend${process.platform === "win32" ? ".exe" : ""}`;
const NODE_BINARY_NAME = process.platform === "win32" ? "node.exe" : "node";
const BUNDLED_DIR = RUNTIME_DIR;
const PROVISION_DIR = path.join(DATA_DIR, "runtime", PAYLOAD_VERSION);
const AGENT_DIR = path.join(DATA_DIR, "runtime", `agent-${AGENT_PAYLOAD_VERSION}`);

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

  if (lastError) throw describeFailure(lastError);

  setStage("verifying", "校验完整性", `正在校验${label}完整性`);
  const digest = await hashFile(archive);
  if (digest !== spec.sha256) {
    // 只有"文件确实坏了"才值得丢掉续传基线。
    fs.rmSync(archive, { force: true });
    for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) fs.rmSync(partPath(archive, index), { force: true });
    throw new Error(`${label} sha256 不匹配：期望 ${spec.sha256}，实际 ${digest}`);
  }

  const megabytes = (fs.statSync(archive).size / 1048576).toFixed(1);
  note(`下载完成（${megabytes} MB，用时 ${Math.round((Date.now() - startedAt) / 1000)}s），开始解包`);

  setStage("extracting", `解包${label}`, `正在解包${label}（${megabytes} MB）`);
  const extractStartedAt = Date.now();
  fs.rmSync(staging, { recursive: true, force: true });
  await extractZip(archive, staging);
  fs.rmSync(archive, { force: true });
  note(`${label}已解包到 ${staging}（${Math.round((Date.now() - extractStartedAt) / 1000)}s）`);
}

async function provisionPayload(spec) {
  const staging = `${PROVISION_DIR}.partial`;
  await stageArchive(spec, staging, "运行时载荷", 200);
  fs.chmodSync(path.join(staging, BINARY_NAME), 0o755);
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
  await stageArchive(spec, staging, "创作 Agent 运行时", 80);
  const nodeBin = path.join(staging, "node", "bin", NODE_BINARY_NAME);
  if (fs.existsSync(nodeBin)) fs.chmodSync(nodeBin, 0o755);
  fs.rmSync(AGENT_DIR, { recursive: true, force: true });
  fs.renameSync(staging, AGENT_DIR);
  note(`创作 Agent 运行时已就绪：${AGENT_DIR}`);
}

async function resolveAgentDir() {
  if (hasAgentRuntime(AGENT_DIR)) {
    note(`复用已就绪的创作 Agent 运行时 ${AGENT_DIR}`);
    return AGENT_DIR;
  }
  const spec = AGENT_PAYLOADS[PLATFORM];
  if (!spec || !/^[a-f0-9]{64}$/.test(spec.sha256)) {
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
