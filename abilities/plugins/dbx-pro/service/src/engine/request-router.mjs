/**
 * 请求路由：把 HTTP 请求映射到驱动能力。
 *
 * 五条路径（D1 冻结）：
 *   GET  /health    不开鉴权；返回进程、驱动能力矩阵与连接池状态
 *   POST /test      连通性探测
 *   POST /catalog   命名空间 / 对象清单
 *   POST /describe  对象结构
 *   POST /query     执行 SQL（含写闸门）
 *
 * 约定：handler 只返回**数据**，信封与 HTTP 状态码由本层统一生成；
 * 抛出 EngineError 会被映射为 {ok:false,error:{code,message,detail?}} + 对应状态码。
 */

import { createHash } from "node:crypto";
import {
  DEFAULT_ROW_LIMIT,
  ENGINE_VERSION,
  MAX_ROW_LIMIT,
  MAX_TIMEOUT_MS,
  PROTOCOL_VERSION,
  engineError,
  fail,
  httpStatusForCode,
  normalizeThrown,
  ok,
} from "./protocol.mjs";
import { guardQuery } from "./query-guard.mjs";
import { listDriverDescriptors, loadDriver, normalizeDriverId } from "../driver-registry.mjs";

function pick(source, ...keys) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function normalizePort(value) {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw engineError("BAD_REQUEST", `端口不合法：${value}`);
  }
  return port;
}

/** 连接描述归一化：同时接受 camelCase 与 snake_case（面板历史字段不统一）。 */
export function normalizeSpec(raw) {
  const dbType = normalizeDriverId(pick(raw, "dbType", "db_type", "type"));
  if (dbType.length === 0) throw engineError("BAD_REQUEST", "缺少连接类型（dbType）");
  const asString = (value) => (typeof value === "string" && value.length > 0 ? value : undefined);
  return {
    id: asString(pick(raw, "id")),
    name: asString(pick(raw, "name")),
    dbType,
    host: asString(pick(raw, "host")),
    port: normalizePort(pick(raw, "port")),
    username: asString(pick(raw, "username", "user")),
    password: typeof raw.password === "string" ? raw.password : undefined,
    database: asString(pick(raw, "database", "db")),
    file: asString(pick(raw, "file", "filePath", "file_path")),
    readOnly: pick(raw, "readOnly", "read_only") === true,
  };
}

/**
 * 连接身份 key。含口令摘要（8 位）但不含明文口令：
 * 同一台库换口令必须拿到新句柄，否则会用旧凭据继续跑。
 */
export function poolKeyFor(spec) {
  const identity = [
    spec.dbType,
    spec.host ?? "",
    spec.port ?? "",
    spec.database ?? "",
    spec.file ?? "",
    spec.username ?? "",
    spec.readOnly === true ? "ro" : "rw",
  ].join("|");
  const credential =
    typeof spec.password === "string" && spec.password.length > 0
      ? createHash("sha256").update(spec.password).digest("hex").slice(0, 8)
      : "";
  return `${identity}|${credential}`;
}

function clampRowLimit(rowLimit) {
  const value = Number.isFinite(rowLimit) ? Math.trunc(rowLimit) : DEFAULT_ROW_LIMIT;
  return Math.min(Math.max(value, 1), MAX_ROW_LIMIT);
}

function clampTimeout(timeoutMs) {
  const value = Number.isFinite(timeoutMs) ? Math.trunc(timeoutMs) : 30_000;
  return Math.min(Math.max(value, 1_000), MAX_TIMEOUT_MS);
}

function requireConnection(body) {
  const raw = body?.connection ?? body?.conn;
  if (!raw || typeof raw !== "object") throw engineError("BAD_REQUEST", "缺少 connection");
  return normalizeSpec(raw);
}

export function createRouter({ pool, auth, now = () => Date.now() } = {}) {
  if (!pool) throw new Error("createRouter 需要 pool");

  const resolveDriver = async (spec) => {
    const module = await loadDriver(spec.dbType);
    return { module, driver: module.createDriver() };
  };

  const routes = new Map([
    [
      "/health",
      {
        method: "GET",
        auth: false,
        handler: () => ({
          status: "ok",
          version: ENGINE_VERSION,
          protocol: PROTOCOL_VERSION,
          pid: process.pid,
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          uptimeMs: Math.round(process.uptime() * 1000),
          auth: auth?.enabled ? "enabled" : "disabled",
          pool: pool.stats(),
          drivers: listDriverDescriptors(),
        }),
      },
    ],
    [
      "/test",
      {
        method: "POST",
        auth: true,
        handler: async ({ body, pool: connectionPool }) => {
          const spec = requireConnection(body);
          const { module, driver } = await resolveDriver(spec);
          const outcome = await connectionPool.withConnection(
            poolKeyFor(spec),
            () => driver.acquire(spec),
            (handle) => handle.test(),
          );
          return { connection: spec.name ?? spec.id ?? null, ...outcome, driver: { id: module.descriptor.id, tier: module.descriptor.tier } };
        },
      },
    ],
    [
      "/catalog",
      {
        method: "POST",
        auth: true,
        handler: async ({ body, pool: connectionPool }) => {
          const spec = requireConnection(body);
          const { driver } = await resolveDriver(spec);
          const result = await connectionPool.withConnection(
            poolKeyFor(spec),
            () => driver.acquire(spec),
            (handle) => handle.catalog(body?.scope ?? {}),
          );
          return { connection: spec.name ?? spec.id ?? null, ...result };
        },
      },
    ],
    [
      "/describe",
      {
        method: "POST",
        auth: true,
        handler: async ({ body, pool: connectionPool }) => {
          const spec = requireConnection(body);
          const target = body?.target ?? { schema: body?.schema, table: body?.table };
          const { driver } = await resolveDriver(spec);
          const result = await connectionPool.withConnection(
            poolKeyFor(spec),
            () => driver.acquire(spec),
            (handle) => handle.describe({ schema: target?.schema ?? "main", table: target?.table }),
          );
          return { connection: spec.name ?? spec.id ?? null, ...result };
        },
      },
    ],
    [
      "/query",
      {
        method: "POST",
        auth: true,
        handler: async ({ body, pool: connectionPool }) => {
          const spec = requireConnection(body);
          const allowWrites = body?.allowWrites === true;
          const confirmedWriteSql =
            typeof body?.confirmedWriteSql === "string" ? body.confirmedWriteSql : undefined;
          // 闸门先于任何 IO：拦截时不会打开连接、更不会执行。
          const classified = guardQuery({ sql: body?.sql, allowWrites, confirmedWriteSql });
          const { driver } = await resolveDriver(spec);
          const timeoutMs = clampTimeout(body?.timeoutMs);
          const rowLimit = clampRowLimit(body?.rowLimit);
          const deadline = now() + timeoutMs;
          const shouldAbort = () => now() > deadline;
          const key = poolKeyFor(spec);
          const started = now();
          const statements = [];
          for (const statement of classified.statements) {
            statements.push(
              await connectionPool.withConnection(
                key,
                () => driver.acquire(spec),
                (handle) => handle.query({ sql: statement, rowLimit, shouldAbort }),
              ),
            );
          }
          const last = statements[statements.length - 1];
          return {
            connection: spec.name ?? spec.id ?? null,
            kind: classified.kind,
            statement_count: statements.length,
            statements,
            truncated: statements.some((entry) => entry.truncated),
            row_limit: rowLimit,
            timeout_ms: timeoutMs,
            duration_ms: now() - started,
            // 顶层镜像最后一条结果集：旧版 UI 就是「只展示最后一个结果集」的语义。
            columns: last.columns,
            rows: last.rows,
            row_count: last.row_count,
            affected_rows: last.affected_rows,
          };
        },
      },
    ],
  ]);

  async function handle(request) {
    const { method = "GET", pathname, headers = {}, body = null } = request ?? {};
    const route = routes.get(pathname);
    if (!route) {
      const error = engineError("NOT_FOUND", `未知路径：${pathname}`);
      return { status: httpStatusForCode(error.code), body: fail(error) };
    }
    if (method !== route.method) {
      const error = engineError("METHOD_NOT_ALLOWED", `${pathname} 只接受 ${route.method}`);
      return { status: httpStatusForCode(error.code), body: fail(error) };
    }
    try {
      if (route.auth) auth.verify(headers);
      const data = await route.handler({ body, headers, pool });
      return { status: 200, body: ok(data) };
    } catch (error) {
      const normalized = normalizeThrown(error);
      return { status: httpStatusForCode(normalized.code), body: fail(normalized) };
    }
  }

  return { handle, routes };
}
