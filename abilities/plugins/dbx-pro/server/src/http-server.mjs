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

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
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

export function createEngineServer({ token, dataDir = null, authDisabled = false } = {}) {
  const auth = createAuth({ token, disabled: authDisabled });
  // 用宿主分配的数据目录预热引擎客户端；否则 --data 会被忽略、连接数据落到默认 home 目录。
  getDbxMcpClient(dataDir ? { dataDir } : undefined);
  const router = createRouter({ auth });

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

  return { server, auth, router, dataDir };
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

main();
