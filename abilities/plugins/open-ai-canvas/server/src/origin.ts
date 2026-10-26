/**
 * 稳定浏览器 origin 绑定与跳转（ADR-0010）
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, HOST_PORT, ORIGIN_FILE, STABLE_ORIGIN_PORTS } from "./config.ts";
import { SESSION_TOKEN, saveSession, setSessionToken } from "./session.ts";
import { goPort } from "./backend.ts";
import { handleMcpRequest } from "./mcp.ts";
import { handlePayloadReset, sendJson, servePreparation, stateSnapshot } from "./routes.ts";

// 稳定 origin 的产物：只有本模块写，其他模块只读。
export let PUBLIC_ORIGIN = `http://127.0.0.1:${HOST_PORT}`;
export let STABLE_PORT = 0;
export let STABLE_SERVER = null;
// 两个 server 共用一个 handler；startProxy 接管前先回 503。
export let REQUEST_HANDLER = null;

export function setRequestHandler(handler) {
  REQUEST_HANDLER = handler;
}

export function setPublicOrigin(origin) {
  PUBLIC_ORIGIN = origin;
}
import { bridgeToken, serveBridge } from "./bridge.ts";
import { isApiPath, serveWebAsset } from "./web.ts";


// --- 浏览器 origin 绑定（ADR-0010）---
export function loadRememberedPort() {
  try {
    const port = Number(JSON.parse(fs.readFileSync(ORIGIN_FILE, "utf8"))?.port);
    return Number.isInteger(port) && port > 0 ? port : 0;
  } catch {
    return 0;
  }
}

export function rememberPort(port) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const body = { port, origin: `http://127.0.0.1:${port}`, savedAt: new Date().toISOString() };
    fs.writeFileSync(ORIGIN_FILE, `${JSON.stringify(body, null, 2)}\n`);
  } catch (err) {
    console.error("[open-ai-canvas] Failed to remember browser origin:", err.message);
  }
}

// 顺序：显式给定的优先（人既然写了就是意图），否则先试上次抢到的那个，最后才是默认区间。
// 上次那个放前面的理由：同时装两个 Astravia、或同一台机器有两套配置时，两边各自稳定。
export function stablePortCandidates() {
  const raw = process.env.CANVAS_STABLE_PORTS;
  const override = typeof raw === "string" ? raw.trim() : "";
  if (/^(off|none|false|0)$/i.test(override)) return [];
  const explicit = override
    ? override
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const remembered = loadRememberedPort();
  const list = explicit.length
    ? [...explicit, remembered]
    : [...(remembered ? [remembered] : []), ...STABLE_ORIGIN_PORTS];
  // 宿主端口不能当稳定端口（它每次启动都变）；0 也要滤掉——listen(0) 会让 OS 再分配一个
  // 临时端口，那恰好是本次要避免的事。
  return [...new Set(list)].filter((port) => port > 0 && port !== HOST_PORT && port < 65536);
}

type StableListenResult =
  | { server: http.Server; error: null }
  | { server: null; error: NodeJS.ErrnoException };

export function listenStable(port: number): Promise<StableListenResult> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
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

/** 抢一个固定回环端口当浏览器 origin；抢不到就退回宿主端口。 */
export async function bindStableOrigin() {
  // ADR-0010 修订：宿主不继承任意环境变量（ADR-0003 决策 7 只放行 INHERITED_ENV_KEYS
  // 与 plugin.json 的 ${ASTRAVIA_SERVICE_*} 模板），所以 CANVAS_STABLE_PORTS=off
  // 只在手工直跑时有效。运行期真正可达的逃生门改成数据目录里的哨兵文件：
  // 用户在界面里报「端口被占 / 固定 origin 出问题」时，建一个空文件就能退回随机端口。
  if (fs.existsSync(path.join(DATA_DIR, "no-stable-origin"))) {
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

/**
 * 只把「地址栏里打开页面」这类请求送到稳定 origin。
 *
 * `/api`、`/bridge`、`/__canvas`、`/mcp` 一律不跳：它们是宿主健康检查、模型桥与 MCP 的通道，
 * 跳了会让宿主拿到 302 并判成服务没起来。fetch/XHR 的 Accept 默认是通配（星号斜杠星号），
 * 因此也不会被跳走——只有真的声明要 HTML 的请求才算导航。
 */
export function shouldPinOrigin(req, pathname) {
  if (!STABLE_PORT) return false;
  if (req.socket?.localPort !== HOST_PORT) return false; // 已经在稳定 origin 上了
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (/^\/(api|bridge|__canvas|mcp)(\/|$)/.test(pathname)) return false;
  return String(req.headers.accept || "").includes("text/html");
}

export function redirectToPinnedOrigin(req, res) {
  res.writeHead(302, { Location: `${PUBLIC_ORIGIN}${req.url || "/"}`, "Cache-Control": "no-store" });
  res.end();
}
export function startProxy() {
  // 一开始就把 token 落盘：插件运行时靠它才能长轮询取任务，晚创建就代表
  // 桥在启动后头几秒是哑的。（bridge.json 里只有本地随机串，不含任何密钥。）
  try {
    bridgeToken();
  } catch (err) {
    console.error("[open-ai-canvas] Failed to initialise bridge token:", err.message);
  }
  const server = http.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];

    // ADR-0010：先把页面请求钉到稳定 origin，再谈路由。它必须排在 /__canvas/state 之前
    // 也没关系——那条路径在 shouldPinOrigin 里已被排除，探针永远拿到 JSON 而不是 302。
    if (shouldPinOrigin(req, pathname)) {
      redirectToPinnedOrigin(req, res);
      return;
    }

    // 准备中、失败后、就绪后都要能回答：这个端点永远由 shim 自己处理，不经 Go。
    if (req.method === "GET" && pathname === "/__canvas/state") {
      sendJson(res, stateSnapshot({ origin: PUBLIC_ORIGIN, originPinned: Boolean(STABLE_PORT) }));
      return;
    }

    // 残留分片清理（ADR-0011）：下载失败后 .partN 会留在 data/runtime 里，
    // 上百 MB 的孤儿没人扫。用户点“清理”时要知道清掉的是哪些字节。
    if (req.method === "POST" && pathname === "/__canvas/payload/reset") {
      handlePayloadReset(res);
      return;
    }

    // 模型桥不依赖 Go 后端：它得与后端就绪状态解耦，才能在重试/重启后接着用。
    if (serveBridge(req, res, pathname)) return;

    if (!goPort) {
      servePreparation(req, res);
      return;
    }

    // MCP 路由
    if (req.method === "POST" && pathname === "/mcp") {
      handleMcpRequest(req, res);
      return;
    }

    // /mcp 归 MCP 层所有：GET 不该被静态层回退成 index.html，否则一个路径写错的
    // MCP 客户端拿到的是前端页面，而不是一个说得清楚的方法不允许。
    if (pathname === "/mcp") {
      res.writeHead(405, { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    // 前端产物（ADR-0008）。/api 是后端自己的路由空间，一律透传——shim 不猜路由。
    if (!isApiPath(pathname) && serveWebAsset(req, res, pathname)) return;

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
              setSessionToken(match[1]);
              saveSession(match[1]);
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

  // 稳定 origin 的 server 复用同一个 handler：直接转发到宿主端口 server 上，
  // 两边路由、状态、会话捕捉只有一份实现（ADR-0010）。必须在 listen 之前就位。
  REQUEST_HANDLER = (req, res) => server.emit("request", req, res);

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

  // 稳定 origin 上也可能开 WebSocket（实时协作类能力），同样转给宿主端口那份实现。
  if (STABLE_SERVER) {
    STABLE_SERVER.on("upgrade", (req, socket, head) => server.emit("upgrade", req, socket, head));
  }

  server.listen(HOST_PORT, "127.0.0.1", () => {
    console.log(`[open-ai-canvas] Proxy listening on http://127.0.0.1:${HOST_PORT}`);
  });
  return server;
}
