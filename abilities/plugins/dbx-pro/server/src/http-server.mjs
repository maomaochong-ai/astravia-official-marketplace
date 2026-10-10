/**
 * 引擎进程入口（会被 scripts/build-engine.mjs 打成 service/main.mjs）。
 *
 * 职责边界：只做「绑定回环端口 + 读鉴权 + 读请求体 + 交给 router + 写响应 + 优雅退出」。
 * 数据库语义全部在 engine/ 里，通过 dbx-mcp 子进程走 MCP stdio JSON-RPC。
 *
 * 命令行（宿主 process.args 注入）：
 *   --port <n>       监听端口（宿主分配；本机验证用 0 取随机端口）
 *   --data <dir>     宿主的服务私有数据目录（dbx-mcp 用它存 dbx.db）
 *   --auth-disabled  显式关闭鉴权（仅本机联调用）
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createRouter } from "./engine/request-router.mjs";
import { disposeDbxMcpClient, getDbxMcpClient } from "./engine/dbx-mcp-client.mjs";
import {
  ENGINE_VERSION,
  MAX_BODY_BYTES,
  PROTOCOL_VERSION,
  engineError,
  stringifyJson,
} from "./engine/protocol.mjs";

const HOST = "127.0.0.1";
const SECRET_KEY_ENV = "ASTRAVIA_SERVICE_SECRET_ENGINE_KEY";

function emit(event, payload = {}) {
  process.stdout.write(
    `${JSON.stringify({ event, version: ENGINE_VERSION, ts: new Date().toISOString(), ...payload })}\n`,
  );
}

function parseArgs(argv) {
  const args = { port: 0, dataDir: null, authDisabled: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--port") args.port = Number(argv[(index += 1)]);
    else if (token === "--data") args.dataDir = argv[(index += 1)] ?? null;
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
      const presented = bearer ? bearer[1].trim() : String(headers["x-dbx-token"] ?? "").trim();
      if (!presented || !timingSafeEqual(digest(presented), expected)) {
        throw engineError("UNAUTHORIZED", "缺少或无效的引擎访问令牌");
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
        reject(engineError("PAYLOAD_TOO_LARGE", `请求体超过 ${MAX_BODY_BYTES} 字节`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw.length === 0) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(engineError("BAD_REQUEST", `请求体不是合法 JSON：${error instanceof Error ? error.message : error}`));
      }
    });
    req.on("error", (error) => {
      if (!failed) reject(engineError("BAD_REQUEST", error instanceof Error ? error.message : String(error)));
    });
  });
}

/**
 * 供给 dbx-mcp 数据加密密钥。
 *
 * 0.4.106 的默认密钥策略是 OS keychain，headless 子进程读不到会抛
 * SECRET_KEY_UNAVAILABLE；这里在服务数据目录维护 service-secrets.json
 * （0600），首次启动生成 32 字节随机密钥，并经 DBX_SECRET_KEY 注入子进程。
 * 已有部署沿用既有密钥，保证 dbx.db 可解密。
 */
function ensureEngineKey(dataDir) {
  const dir = dataDir ?? join(homedir(), ".astravia-dbx-data");
  mkdirSync(dir, { recursive: true });
  try { chmodSync(dir, 0o700); } catch {}

  const secretPath = join(dir, "service-secrets.json");
  let doc = { schemaVersion: 1, values: {} };
  if (existsSync(secretPath)) {
    try { doc = JSON.parse(readFileSync(secretPath, "utf8")); } catch {}
  }
  let key = doc.values?.["engine-key"];
  if (typeof key !== "string" || key.length === 0) {
    key = randomBytes(32).toString("base64url");
    const next = { ...doc, values: { ...(doc.values ?? {}), "engine-key": key } };
    writeFileSync(secretPath, JSON.stringify(next), { mode: 0o600 });
    chmodSync(secretPath, 0o600);
  }
  return { key, dataDir: dir };
}

/**
 * 旧版 dbx.db（0.4.61 明文库）与新二进制不兼容，且新二进制要求由
 * DBX Desktop 执行迁移。检测到 DATA_MIGRATION_REQUIRED 时把旧库备份为
 * dbx.db.legacy-<时间戳> 并重建客户端：新库按新密钥加密，用户重新添加连接
 * （密码仍保留在宿主加密凭据库，旧库文件不删除）。
 */
async function resetLegacyDatabaseIfNeeded(client, dataDir) {
  const result = await client.callTool("dbx_list_connections", {});
  const text = result.isError ? result.content.map((c) => c.text).join("") : "";
  if (!/DATA_MIGRATION_REQUIRED/.test(text)) return false;

  await client.dispose();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dbPath = join(dataDir, "dbx.db");
  if (existsSync(dbPath)) renameSync(dbPath, join(dataDir, `dbx.db.legacy-${stamp}`));
  return true;
}

/** 给 promise 加超时：超时后以 fallback 解决（不抛错），用于不阻塞主流程的预检。 */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    if (timer.unref) timer.unref();
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

export function createEngineServer({ token, dataDir = null, authDisabled = false } = {}) {
  const auth = createAuth({ token, disabled: authDisabled });
  const { key, dataDir: resolvedDataDir } = ensureEngineKey(dataDir);
  // 预热引擎客户端：数据目录与加密密钥在此注入。
  const client = getDbxMcpClient({ dataDir: resolvedDataDir, extraEnv: { DBX_SECRET_KEY: key } });
  // 立即在后台发起子进程连接（不等 listen、不阻塞任何东西）。
  client.connect().catch(() => {});
  // 旧库检测在后台完成（可能备份旧 dbx.db 并重建客户端）。
  // 关键：不得让它阻塞端口监听 —— 该检测要 spawn dbx-mcp 子进程，机器高负载
  // （多个插件同时激活）时子进程握手 / list_connections 会变慢；曾经在 listen 前
  // await 它，导致 /health 长时间不响应、宿主 120s 判定「引擎启动超时」。
  // 给预检加 8s 上限：超时也不影响 HTTP 接流量，首次查询按正常错误处理。
  const ready = withTimeout(
    resetLegacyDatabaseIfNeeded(client, resolvedDataDir).then((reset) => {
      if (reset) getDbxMcpClient();
    }),
    8_000,
    false,
  ).catch(() => {});
  // dataDir 传给 router：API 接入的连接配置与取数快照存在插件本地，不经引擎注册表。
  const router = createRouter({ auth, dataDir: resolvedDataDir });

  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      if (res.writableEnded) return;
      const payload = stringifyJson(body);
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
      const error = engineError("BAD_REQUEST", `非法请求路径：${req.url}`);
      return send(400, { ok: false, error: { code: error.code, message: error.message } });
    }

    try {
      const body = req.method === "POST" || req.method === "DELETE" ? await readJsonBody(req) : null;

      // === MCP endpoint（宿主 AI 通过 agent.mcpServers 发现并调用）===
      if (req.method === "POST" && url.pathname === "/mcp") {
        auth.verify(req.headers);
        const rpc = body ?? {};
        const id = rpc.id ?? null;
        const client = getDbxMcpClient();
        try {
          if (rpc.method === "initialize") {
            await client.ensureInitialized();
            return send(200, { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "dbx-pro", version: ENGINE_VERSION } } });
          }
          if (rpc.method === "tools/list") {
            const list = await client.listTools();
            return send(200, { jsonrpc: "2.0", id, result: { tools: list } });
          }
          if (rpc.method === "tools/call") {
            const params = rpc.params ?? {};
            const name = params.name;
            const args = params.arguments ?? {};
            if (!name) return send(200, { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
            // MCP 规定工具级失败用 result.isError 表达，而不是 JSON-RPC error：
            // 宿主 Agent 需要读到「SQL_BLOCKED / 连接不存在」这类可读原因并据此改写 SQL，
            // 变成协议错误后这些原因就丢了，Agent 只会看到一次调用失败。
            try {
              const callResult = await client.callTool(name, args);
              return send(200, { jsonrpc: "2.0", id, result: callResult });
            } catch (e) {
              emit("mcp-error", { method: rpc.method, tool: name, message: e.message });
              return send(200, {
                jsonrpc: "2.0",
                id,
                result: { isError: true, content: [{ type: "text", text: e.message }] },
              });
            }
          }
          return send(200, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unsupported MCP method: ${rpc.method}` } });
        } catch (e) {
          emit("mcp-error", { method: rpc.method, message: e.message });
          // 协议层失败（initialize / tools/list 抛错）必须回 JSON-RPC error：
          // 这些响应的 result 形状由协议规定，塞工具结果形状会让客户端校验失败。
          // tools/call 的工具级失败由下方显式转成 isError 结果，不进这里。
          return send(200, { jsonrpc: "2.0", id, error: { code: -32603, message: e.message } });
        }
      }

      const outcome = await router.handle({
        method: req.method,
        pathname: url.pathname,
        headers: req.headers,
        body,
      });
      send(outcome.status, outcome.body);
    } catch (error) {
      const code = error?.code ?? "INTERNAL";
      const status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "BAD_REQUEST" ? 400 : 500;
      emit("request-error", { path: url.pathname, code });
      send(status, { ok: false, error: { code, message: error?.message ?? String(error) } });
    }
  });

  server.on("clientError", (error, socket) => {
    emit("request-error", { path: null, code: "CLIENT_ERROR", message: error.message });
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  return { server, auth, router, dataDir, ready };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "dbx-pro engine (dbx-mcp bridge)\n  --port <n>        listen port (0 = random)\n  --data <dir>      service data directory (dbx-mcp stores dbx.db here)\n  --auth-disabled   disable token auth (local dev only)\n",
    );
    return;
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    emit("server-error", { code: "BAD_PORT", message: `非法端口：${args.port}` });
    process.exit(1);
  }

  const token = process.env[SECRET_KEY_ENV];
  if (typeof token !== "string" || token.length === 0) {
    if (!args.authDisabled) {
      emit("server-error", {
        code: "NO_SECRET",
        message: `缺少引擎访问令牌（环境变量 ${SECRET_KEY_ENV} 未设置或为空）；本地调试请显式传 --auth-disabled`,
      });
      process.exit(1);
    }
  }

  const { server, auth } = createEngineServer({
    token,
    dataDir: args.dataDir,
    authDisabled: args.authDisabled,
  });
  // 不在 listen 前等待旧库检测：服务必须进程一起就响应 /health（预检已在后台跑）。

  if (!auth.enabled) emit("auth-disabled", { reason: args.authDisabled ? "flag" : "no-secret" });

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
    protocol: PROTOCOL_VERSION,
    auth: auth.enabled ? "enabled" : "disabled",
    dataDir: args.dataDir,
    backend: "dbx-mcp",
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(() => resolve()));
    try { await disposeDbxMcpClient(); } catch {}
    emit("shutdown", { signal });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/**
 * 入口保护：只有被宿主直接 spawn 时才启动服务；作为模块被 import（测试）不启动。
 */
function isDirectRun() {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectRun()) main();
