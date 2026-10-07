/**
 * OpenMetadata 插件本地代理进程。
 *
 * 职责边界：HTTP Server + 鉴权 + 连接配置热加载 + fetch 转发。
 * 前端通过 ctx.services.request("/om/*") 调用 → 代理 fetch {OM_URL}/v1/* → 返回结果。
 * 业务逻辑全部在插件前端（MCP 工具定义、错误处理、结果裁剪），代理进程只做请求转发。
 *
 * 命令行（宿主 process.args 注入）：
 *   --port <n>              监听端口（宿主分配；本机验证用 0 取随机端口）
 *   --connections-dir <dir> 连接配置目录（宿主服务私有数据目录）
 *   --auth-disabled         显式关闭鉴权（仅本机联调用）
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const HOST = "127.0.0.1";
const SECRET_KEY_ENV = "ASTRAVIA_SERVICE_SECRET_ENGINE_KEY";
const PROXY_VERSION = "0.1.0";
const MAX_BODY_BYTES = 1024 * 1024; // 1MB
const PROXY_TIMEOUT_MS = 30_000;

function emit(event, payload = {}) {
  process.stdout.write(
    `${JSON.stringify({ event, version: PROXY_VERSION, ts: new Date().toISOString(), ...payload })}\n`,
  );
}

function parseArgs(argv) {
  const args = { port: 0, connectionsDir: null, authDisabled: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--port") args.port = Number(argv[(i += 1)]);
    else if (token === "--connections-dir") args.connectionsDir = argv[(i += 1)] ?? null;
    else if (token === "--auth-disabled") args.authDisabled = true;
    else if (token === "--help" || token === "-h") args.help = true;
  }
  return args;
}

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function createAuth({ token, disabled = false } = {}) {
  const enabled = !disabled && typeof token === "string" && token.length > 0;
  const expected = enabled ? digest(token) : null;
  return {
    enabled,
    verify(headers = {}) {
      if (!enabled) return;
      const header = headers.authorization ?? headers.Authorization ?? "";
      const bearer = /^bearer\s+(.+)$/i.exec(String(header));
      const presented = bearer ? bearer[1].trim() : String(headers["x-om-token"] ?? "").trim();
      if (!presented || !timingSafeEqual(digest(presented), expected)) {
        throw { code: "UNAUTHORIZED", message: "缺少或无效的代理访问令牌" };
      }
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject({ code: "PAYLOAD_TOO_LARGE", message: `请求体超过 ${MAX_BODY_BYTES} 字节` });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw.length === 0) return resolve(null);
      try { resolve(JSON.parse(raw)); }
      catch (error) { reject({ code: "BAD_REQUEST", message: `请求体不是合法 JSON：${error.message}` }); }
    });
    req.on("error", (error) => {
      if (!failed) reject({ code: "BAD_REQUEST", message: error.message });
    });
  });
}

/**
 * 每次请求时重新读取 connections.json——简单热加载策略，
 * 前端（连接配置面板）写入后立即生效，不需要进程重启或 file watch。
 */
function loadActiveConnection(connectionsDir, connectionId = null) {
  if (!connectionsDir) return null;
  const connPath = join(connectionsDir, "connections.json");
  if (!existsSync(connPath)) return null;
  let all;
  try {
    all = JSON.parse(readFileSync(connPath, "utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(all) || all.length === 0) return null;
  if (!connectionId) return all[0]; // 无指定 ID 时用第一个（默认活跃连接）
  return all.find((c) => c.id === connectionId) ?? all[0];
}

function buildOmApiUrl(serverUrl, pathname) {
  // 代理路由：/om/api/* → {OM_URL}/v1/*
  // 例如 /om/api/search/query → https://metadata.company.com/v1/search/query
  const apiMatch = pathname.match(/^\/om\/api(\/.*)$/);
  if (apiMatch) {
    const omPath = apiMatch[1]; // /search/query
    // 确保 serverUrl 不以 / 结尾，omPath 以 / 开头
    const base = serverUrl.replace(/\/$/, "");
    return `${base}/v1${omPath}`;
  }
  // 透传路由：/om/raw/* → {OM_URL}/* （保留原始路径，用于非 /v1 的端点如 /health）
  const rawMatch = pathname.match(/^\/om\/raw(\/.*)$/);
  if (rawMatch) {
    const base = serverUrl.replace(/\/$/, "");
    return `${base}${rawMatch[1]}`;
  }
  return null;
}

/**
 * fetch 转发 + Bearer Token 注入。超时 PROXY_TIMEOUT_MS。
 * OM 返回的 JSON 原样返回；错误时附加 status_code 和 om_error 字段。
 */
async function proxyToOm({ method, omUrl, token, headers, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const fetchHeaders = {
      "accept": "application/json",
      "content-type": "application/json",
      "user-agent": "om-proxy/" + PROXY_VERSION,
    };
    if (token) fetchHeaders["authorization"] = `Bearer ${token}`;

    // 透传一些常见的客户端头（content-type 已覆盖）
    if (headers["x-request-id"]) fetchHeaders["x-request-id"] = headers["x-request-id"];

    const init = {
      method,
      headers: fetchHeaders,
      signal: controller.signal,
      redirect: "follow",
    };
    if (body !== null && body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(omUrl, init);
    const contentType = response.headers.get("content-type") ?? "";

    let data;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { text: await response.text() };
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        ok: false,
        statusCode: null,
        headers: {},
        data: {
          proxy_error: true,
          code: "TIMEOUT",
          message: `OpenMetadata 服务端未响应（超时 ${PROXY_TIMEOUT_MS}ms）`,
        },
      };
    }
    return {
      ok: false,
      statusCode: null,
      headers: {},
      data: {
        proxy_error: true,
        code: "NETWORK_ERROR",
        message: error.message ?? String(error),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function createProxyServer({ auth, connectionsDir } = {}) {
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      if (res.writableEnded) return;
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload),
        "cache-control": "no-store",
      });
      res.end(payload);
    };

    let url;
    try {
      url = new URL(req.url ?? "/", `http://${HOST}`);
    } catch {
      return send(400, { ok: false, error: { code: "BAD_REQUEST", message: `非法请求路径：${req.url}` } });
    }

    try {
      // === /health（宿主启动探测，不开鉴权）===
      if (req.method === "GET" && url.pathname === "/health") {
        return send(200, {
          status: "ok",
          service: "om-proxy",
          version: PROXY_VERSION,
          pid: process.pid,
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          auth: auth?.enabled ? "enabled" : "disabled",
          connectionsDir: connectionsDir ?? null,
          omConnections: loadActiveConnection(connectionsDir) ? "configured" : "none",
        });
      }

      // === /connections（列出已配置的连接，不开鉴权，前端面板用）===
      if (req.method === "GET" && url.pathname === "/connections") {
        let all = [];
        if (connectionsDir) {
          const connPath = join(connectionsDir, "connections.json");
          if (existsSync(connPath)) {
            try { all = JSON.parse(readFileSync(connPath, "utf8")); } catch {}
          }
        }
        // 脱敏：不返回 token
        const sanitized = all.map((c) => ({ ...c, token: undefined }));
        return send(200, { connections: sanitized });
      }

      // === /om/* 代理路由 ===
      if (url.pathname.startsWith("/om/")) {
        auth?.verify(req.headers);

        // 从 query 参数取 connectionId（可选，默认用第一个连接）
        const connectionId = url.searchParams.get("connection");
        const conn = loadActiveConnection(connectionsDir, connectionId);
        if (!conn) {
          return send(503, {
            ok: false,
            error: { code: "NO_CONNECTION", message: "未配置 OpenMetadata 连接，请在插件设置中添加" },
          });
        }

        const omUrl = buildOmApiUrl(conn.serverUrl, url.pathname);
        if (!omUrl) {
          return send(404, { ok: false, error: { code: "NOT_FOUND", message: `未知代理路径：${url.pathname}` } });
        }

        const body = req.method === "POST" || req.method === "PUT" || req.method === "PATCH"
          ? await readJsonBody(req)
          : null;

        const result = await proxyToOm({
          method: req.method,
          omUrl,
          token: conn.token,
          headers: req.headers,
          body,
        });

        // OM 返回的 401 需要特别提示 Token 过期
        if (result.statusCode === 401) {
          return send(200, {
            ok: false,
            error: {
              code: "AUTH_EXPIRED",
              message: "OpenMetadata API Token 已过期或无效，请在插件设置中更新",
              om_response: result.data,
            },
            proxy_meta: { omUrl, statusCode: 401 },
          });
        }

        // OM 返回的其他错误（403、404、500 等）原样透传，附加元信息
        if (!result.ok) {
          return send(200, {
            ok: false,
            error: {
              code: result.data?.proxy_error ? result.data.code : "OM_ERROR",
              message: result.data?.proxy_error ? result.data.message : (result.data?.message ?? "OpenMetadata 返回错误"),
              om_response: result.data,
              om_status_code: result.statusCode,
            },
            proxy_meta: { omUrl, statusCode: result.statusCode },
          });
        }

        // 成功
        return send(200, {
          ok: true,
          data: result.data,
          proxy_meta: { omUrl, statusCode: result.statusCode },
        });
      }

      // === 未匹配 ===
      return send(404, { ok: false, error: { code: "NOT_FOUND", message: `未知路径：${url.pathname}` } });
    } catch (error) {
      const code = error?.code ?? "INTERNAL";
      const status = code === "UNAUTHORIZED" ? 401 : code === "PAYLOAD_TOO_LARGE" ? 413 : code === "BAD_REQUEST" ? 400 : 500;
      emit("proxy-error", { path: url.pathname, code, message: error?.message ?? String(error) });
      return send(status, { ok: false, error: { code, message: error?.message ?? String(error) } });
    }
  });

  server.on("clientError", (error, socket) => {
    emit("proxy-error", { path: null, code: "CLIENT_ERROR", message: error.message });
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  return { server, auth };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "openmetadata proxy\n" +
      "  --port <n>               listen port (0 = random)\n" +
      "  --connections-dir <dir>  connection config directory\n" +
      "  --auth-disabled          disable token auth (local dev only)\n",
    );
    return;
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    emit("server-error", { code: "BAD_PORT", message: `非法端口：${args.port}` });
    process.exit(1);
  }

  // 确保 connections-dir 存在
  if (args.connectionsDir) {
    try { mkdirSync(args.connectionsDir, { recursive: true }); } catch {}
  }

  const token = process.env[SECRET_KEY_ENV];
  if ((typeof token !== "string" || token.length === 0) && !args.authDisabled) {
    emit("server-error", {
      code: "NO_SECRET",
      message: `缺少代理访问令牌（环境变量 ${SECRET_KEY_ENV} 未设置）；本地调试请显式传 --auth-disabled`,
    });
    process.exit(1);
  }

  const { server, auth } = createProxyServer({
    auth: createAuth({ token, disabled: args.authDisabled }),
    connectionsDir: args.connectionsDir,
  });

  if (!auth?.enabled) emit("auth-disabled", { reason: args.authDisabled ? "flag" : "no-secret" });

  await new Promise((resolve) => {
    server.on("error", (error) => {
      emit("server-error", { code: error.code ?? "SERVER_ERROR", message: error.message });
      process.exit(1);
    });
    server.listen(args.port, HOST, () => resolve());
  });

  const address = server.address();
  emit("listening", {
    host: HOST,
    port: typeof address === "object" && address ? address.port : args.port,
    pid: process.pid,
    node: process.version,
    version: PROXY_VERSION,
    auth: auth?.enabled ? "enabled" : "disabled",
    connectionsDir: args.connectionsDir,
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(() => resolve()));
    emit("shutdown", { signal });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

function isDirectRun() {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectRun()) main();
