/**
 * 引擎进程入口（会被 scripts/build-engine.mjs 打成 service/main.mjs）。
 *
 * 职责边界：只做「绑定回环端口 + 读鉴权 + 读请求体 + 交给 router + 写响应 + 优雅退出」。
 * 任何数据库语义都在 drivers/ 与 engine/ 里，本文件不碰 SQL。
 *
 * 命令行（宿主 process.args 注入）：
 *   --port <n>       监听端口（宿主分配；本机验证用 0 取随机端口）
 *   --data <dir>     宿主的服务私有数据目录（沿用，D1 不主动写）
 *   --auth-disabled  显式关闭鉴权（仅本机联调用）
 *
 * 鉴权密钥来自宿主注入的环境变量，凭据 id `engine-key` →
 * ASTRAVIA_SERVICE_SECRET_ENGINE_KEY（宿主按 id 大写、非字母数字转下划线）。
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { ConnectionPool } from "./engine/connection-pool.mjs";
import { createRouter } from "./engine/request-router.mjs";
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

export function createEngineServer({ token, dataDir = null, authDisabled = false, idleTtlMs } = {}) {
  const pool = new ConnectionPool(idleTtlMs ? { idleTtlMs } : {});
  const auth = createAuth({ token, disabled: authDisabled });
  const router = createRouter({ pool, auth });

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
      const body = req.method === "POST" ? await readJsonBody(req) : null;
      const outcome = await router.handle({
        method: req.method,
        pathname: url.pathname,
        headers: req.headers,
        body,
      });
      send(outcome.status, outcome.body);
    } catch (error) {
      // 读体失败（超限 / 非法 JSON）走这里：状态码交给协议表。
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

  const reaper = setInterval(() => {
    pool.reap().catch(() => {});
  }, 60_000);
  reaper.unref?.();

  return { server, pool, auth, router, dataDir, reaper };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "dbx-pro engine\n  --port <n>        listen port (0 = random)\n  --data <dir>      service data directory\n  --auth-disabled   disable token auth (local dev only)\n",
    );
    return;
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    emit("server-error", { code: "BAD_PORT", message: `非法端口：${args.port}` });
    process.exit(1);
  }

  // B3 修复：密钥缺失/为空时**拒绝启动**（fail-closed），绝不静默关闭鉴权。
  // 此前 token 为空会让 createAuth 得到 enabled:false，未带令牌的 /query 可直接执行到 SQL 层；
  // 本机回环也可能被其它进程访问，所以本地调试必须显式传 --auth-disabled。
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

  const { server, pool, auth, reaper } = createEngineServer({
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
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    clearInterval(reaper);
    await new Promise((resolve) => server.close(() => resolve()));
    try {
      await pool.closeAll();
    } catch {
      // 关停期的清理失败不改变退出码。
    }
    emit("shutdown", { signal });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main();
