/**
 * dbx-mcp 轻量 MCP stdio 客户端（ESM .mjs 版）。
 *
 * 职责：管理 dbx-mcp 子进程生命周期，完成 JSON-RPC 握手，
 * 并提供 tools/call 单发请求。不引入 @modelcontextprotocol/sdk 依赖
 * （只需单服务器、无流式需求）。
 *
 * dbx 工具返回统一是 Markdown 文本（content[].text），结构化解析
 * 由上层 markdown-parser 完成，本层只做协议传输。
 *
 * 用法：
 *   import { getDbxMcpClient } from "./dbx-mcp-client.mjs";
 *   const client = getDbxMcpClient();
 *   const result = await client.callTool("dbx_execute_query", { connection_name: "x", sql: "SELECT 1" });
 *   console.log(result.content[0].text);  // Markdown 表格
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// bundle 后 import.meta.url = server/main.mjs → dirname = server/
// 开发期 import.meta.url = server/src/engine/*.mjs → dirname = server/src/engine/
// 两种情况都要找到 server/ 目录
const _thisDir = join(fileURLToPath(import.meta.url), "..");
const _serverDir = _thisDir.endsWith("engine")
  ? join(_thisDir, "..", "..")   // 开发期：server/src/engine/ → server/
  : _thisDir;                    // bundle 后：server/ 直接用

/** dbx-mcp 二进制路径表（按平台映射到 server/bin/）。 */
const BIN_PATH_BY_PLATFORM = {
  "darwin-arm64": join(_serverDir, "bin", "dbx-mcp-darwin-arm64"),
  "darwin-x64":   join(_serverDir, "bin", "dbx-mcp-darwin-x64"),
  "win32-x64":    join(_serverDir, "bin", "dbx-mcp-win-x64.exe"),
};

/** DBX_DATA_DIR：与宿主 Open-astravia 隔离，使用服务数据目录或回退到 ~/.astravia-dbx-data */
function resolveDataDir(explicitDir) {
  const dir = explicitDir ?? join(homedir(), ".astravia-dbx-data");
  mkdirSync(dir, { recursive: true });
  return dir;
}

const HANDSHAKE_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 60_000;
const SHUTDOWN_GRACE_MS = 2_000;

function detectPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "win32" && arch === "x64") return "win32-x64";
  // Linux（用 darwin-arm64 同平台暂不可用 — fork release 没打 linux）
  return null;
}

function resolveBinaryPath() {
  const platform = detectPlatform();
  if (!platform) {
    throw new Error(`dbx-mcp: 不支持的平台 ${process.platform}-${process.arch}（需要 darwin-arm64 / darwin-x64 / win32-x64）`);
  }
  return BIN_PATH_BY_PLATFORM[platform];
}

class DbxMcpClient {
  constructor(options = {}) {
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
    this.callTimeoutMs = options.callTimeoutMs ?? CALL_TIMEOUT_MS;
    this.extraEnv = options.extraEnv ?? {};
    this.dataDir = options.dataDir ?? null;
    this.child = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.initialized = null;
  }

  ensureInitialized() {
    if (!this.initialized) {
      this.initialized = this.spawnAndHandshake().catch((err) => {
        // 握手失败后复位，下次调用重试
        this.initialized = null;
        this.reapCurrentChild();
        throw err;
      });
    }
    return this.initialized;
  }

  reapCurrentChild() {
    const child = this.child;
    this.child = null;
    if (!child || child.killed) return;
    child.kill();
    const force = setTimeout(() => {
      if (child && !child.killed) child.kill("SIGKILL");
    }, SHUTDOWN_GRACE_MS);
    if (force.unref) force.unref();
  }

  async callTool(name, args, timeoutMs) {
    await this.ensureInitialized();
    const id = this.nextId++;
    const result = await this.request(
      id,
      "tools/call",
      { name, arguments: args },
      timeoutMs ?? this.callTimeoutMs,
    );
    return result;
  }

  async dispose() {
    const child = this.child;
    this.child = null;
    this.initialized = null;
    for (const p of this.pending.values()) p.reject(new Error("dbx-mcp client disposed"));
    this.pending.clear();
    if (!child || child.killed) return;
    const exited = new Promise((resolve) => child.once("exit", () => resolve()));
    child.kill();
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS)),
    ]);
    if (!child.killed) child.kill("SIGKILL");
  }

  spawnAndHandshake() {
    const bin = resolveBinaryPath();
    const dbxDataDir = resolveDataDir(this.dataDir);
    const child = spawn(bin, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        DBX_DATA_DIR: dbxDataDir,
        ...this.extraEnv,
      },
    });
    this.child = child;
    const isCurrent = () => this.child === child;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.onData(chunk));
    child.stderr.on("data", (chunk) => {
      // dbx-mcp 在 stderr 打日志，调试时取消注释
      // process.stderr.write(`[dbx-mcp] ${chunk.toString()}`);
    });
    child.on("exit", (code, signal) => {
      if (!isCurrent()) return;
      const err = new Error(`dbx-mcp exited (code=${code}, signal=${signal})`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.child = null;
      this.initialized = null;
    });
    child.on("error", (err) => {
      if (!isCurrent()) return;
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.child = null;
      this.initialized = null;
    });

    return new Promise((resolve, reject) => {
      this.request(
        0,
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "dbx-pro-plugin", version: "0.1.1" },
        },
        this.handshakeTimeoutMs,
      )
        .then(() => {
          if (!isCurrent()) {
            reject(new Error("dbx-mcp client disposed during handshake"));
            return;
          }
          this.sendNotification("notifications/initialized", {});
          resolve();
        })
        .catch((err) => reject(err));
    });
  }

  request(id, method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`dbx-mcp request "${method}" timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.sendMessage({ jsonrpc: "2.0", id, method, params });
    });
  }

  sendNotification(method, params) {
    this.sendMessage({ jsonrpc: "2.0", method, params });
  }

  /** 列出 dbx-mcp 暴露的所有 MCP 工具。 */
  async listTools(timeoutMs = 30_000) {
    await this.ensureInitialized();
    const result = await this.request(this.nextId++, "tools/list", {}, timeoutMs);
    return result?.tools ?? [];
  }

  sendMessage(message) {
    if (!this.child) throw new Error("dbx-mcp client not started");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  onData(chunk) {
    this.buffer += chunk;
    let idx = this.buffer.indexOf("\n");
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      this.handleLine(line);
      idx = this.buffer.indexOf("\n");
    }
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // 非 JSON 行（日志）忽略
    }
    if (typeof message.id !== "number") return; // 服务端主动通知忽略
    const p = this.pending.get(message.id);
    if (!p) return;
    this.pending.delete(message.id);
    if (message.error) {
      const msg =
        typeof message.error === "object" && message.error !== null && "message" in message.error
          ? String(message.error.message)
          : "dbx-mcp request error";
      p.reject(new Error(msg));
    } else {
      p.resolve(message.result);
    }
  }
}

// 单例（每个 service 进程一个 dbx-mcp 子进程）
let client = null;

export function getDbxMcpClient(options) {
  if (!client) client = new DbxMcpClient(options);
  return client;
}

export async function disposeDbxMcpClient() {
  if (client) {
    await client.dispose();
    client = null;
  }
}

export { DbxMcpClient };
