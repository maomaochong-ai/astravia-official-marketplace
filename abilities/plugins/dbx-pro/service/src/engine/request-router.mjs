/**
 * 请求路由：把 HTTP 请求映射到 dbx-mcp 工具调用。
 *
 * 架构：service/main.mjs 仍是 HTTP server（UI 层 engine-client.ts 不变），
 * 但内部不再驱动原生 driver，而是 spawn dbx-mcp 子进程走 MCP stdio JSON-RPC。
 *
 * 路径（扩展旧版，新增连接管理）：
 *   GET    /health           不开鉴权；返回进程信息 + dbx-mcp 状态
 *   GET    /connections      列出所有已保存连接（dbx_list_connections）
 *   POST   /connections      新增连接（dbx_add_connection）
 *   DELETE /connections      删除连接（按 name）
 *   POST   /connections/test 测试连接（已存或草稿）
 *   POST   /tables           列出连接下全部表（dbx_list_tables）
 *   POST   /describe         查看表结构（dbx_describe_table）
 *   POST   /query            执行 SQL（dbx_execute_query，含写闸门）
 *   POST   /schema-context   获取连接 schema 上下文（dbx_get_schema_context）
 *
 * dbx-mcp 连接自管（dbx.db），不需要 Node.js 连接池 —— 每次直接 spawn + callTool。
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
import { getDbxMcpClient } from "./dbx-mcp-client.mjs";
import { maybeBlockWrite, classifyQuery, splitStatements } from "./sql-safety.mjs";
import { executeDirect, isSqlBlocked, DRIVER_FAMILY } from "./direct-driver.mjs";
import {
  textOf,
  parseMarkdownTable,
  parseTableList,
  parseDescribeColumns,
  parseConnections,
  dedupeConnections,
  classifyError,
  extractDuration,
} from "./markdown-parser.mjs";

function clampRowLimit(rowLimit) {
  const value = Number.isFinite(rowLimit) ? Math.trunc(rowLimit) : DEFAULT_ROW_LIMIT;
  return Math.min(Math.max(value, 1), MAX_ROW_LIMIT);
}

function clampTimeout(timeoutMs) {
  const value = Number.isFinite(timeoutMs) ? Math.trunc(timeoutMs) : 30_000;
  return Math.min(Math.max(value, 1000), MAX_TIMEOUT_MS);
}

/** 从 dbx 工具调用结果提取结构化数据或抛 EngineError。 */
function extractText(result, toolName) {
  const text = textOf(result);
  if (result.isError) {
    const err = classifyError(text);
    throw engineError(err.code, `${toolName} failed: ${err.detail}`, text);
  }
  return text;
}

/** dbx_add_connection 参数名映射（UI 用 camelCase，dbx 期望 snake_case）。 */
function toDbxAddParams(body) {
  const args = { name: body.name, db_type: body.dbType, host: body.host };
  if (body.port) args.port = body.port;
  if (body.username) args.username = body.username;
  if (body.password) args.password = body.password;
  if (body.database) args.database = body.database;
  if (body.ssl !== undefined) args.ssl = body.ssl === true;
  // dbx 支持 file-based 连接（sqlite），host 是文件路径
  if (!args.host && body.file) args.host = body.file;
  return args;
}

export function createRouter({ auth, now = () => Date.now() } = {}) {
  if (!auth) throw new Error("createRouter 需要 auth");

  const mcpClient = () => getDbxMcpClient();

  // === 路由表（两级 Map：pathname → method → route）===
  const routeDefs = [
    // === 健康检查 ===
    ["/health", "GET", false, async () => {
      let dbxInfo = { status: "unknown" };
      try {
        await mcpClient().ensureInitialized();
        dbxInfo = { status: "connected" };
      } catch (e) {
        dbxInfo = { status: "error", message: e.message };
      }
      return {
        status: "ok",
        version: ENGINE_VERSION,
        protocol: PROTOCOL_VERSION,
        pid: process.pid,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        uptimeMs: Math.round(process.uptime() * 1000),
        auth: auth?.enabled ? "enabled" : "disabled",
        dbx: dbxInfo,
        drivers: [{ id: "dbx-cli", label: "dbx CLI (100+ databases)", tier: "first-class", ready: true }],
      };
    }],

    // === 连接管理 ===
    ["/connections", "GET", true, async () => {
      const result = await mcpClient().callTool("dbx_list_connections", {});
      const text = extractText(result, "dbx_list_connections");
      const raw = parseConnections(text);
      return { connections: dedupeConnections(raw) };
    }],
    ["/connections", "POST", true, async ({ body }) => {
      if (!body?.name || !body?.dbType) throw engineError("BAD_REQUEST", "缺少 name / dbType");
      const dbxArgs = toDbxAddParams(body);
      const result = await mcpClient().callTool("dbx_add_connection", dbxArgs);
      const text = extractText(result, "dbx_add_connection");
      const idMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return { id: idMatch?.[0] ?? "", name: body.name, detail: text };
    }],
    ["/connections", "DELETE", true, async ({ body }) => {
      const name = body?.name;
      if (!name) throw engineError("BAD_REQUEST", "缺少 connection name");
      const result = await mcpClient().callTool("dbx_remove_connection", { connection_name: name });
      extractText(result, "dbx_remove_connection");
      return { deleted: name };
    }],
    ["/connections/test", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName;
      let tempName = null;
      let actualName = connectionName;
      if (!connectionName && body?.draft) {
        tempName = `astravia-test-${Date.now().toString(36)}`;
        const addResult = await mcpClient().callTool("dbx_add_connection", toDbxAddParams({ ...body.draft, name: tempName }));
        extractText(addResult, "dbx_add_connection");
        actualName = tempName;
      }
      if (!actualName) throw engineError("BAD_REQUEST", "缺少 connectionName 或 draft");
      try {
        const testResult = await mcpClient().callTool("dbx_list_tables", { connection_name: actualName });
        const text = extractText(testResult, "dbx_list_tables");
        const tableCount = parseTableList(text).length;
        return { tableCount, detail: text };
      } finally {
        if (tempName) {
          try { await mcpClient().callTool("dbx_remove_connection", { connection_name: tempName }); } catch {}
        }
      }
    }],

    // === 查询执行 ===
    ["/query", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName ?? body?.connection?.name;
      if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
      const sql = body?.sql;
      if (typeof sql !== "string" || sql.trim().length === 0) throw engineError("BAD_REQUEST", "SQL 不能为空");

      // classifyQuery 标记 DDL/DML/kind，用于 UI 展示和分流决策
      const classified = classifyQuery(sql);

      const timeoutMs = clampTimeout(body?.timeoutMs);
      const rowLimit = clampRowLimit(body?.rowLimit);
      const started = now();

      // --- 路径 1：dbx-mcp 优先（SELECT 等安全查询 + DDL/DML 首次尝试） ---
      let result;
      try {
        result = await mcpClient().callTool(
          "dbx_execute_query",
          { connection_name: connectionName, sql },
          timeoutMs,
        );
      } catch (e) {
        // dbx-mcp 进程挂了等 transport 级错误 — 直接抛，不 fallback
        const msg = e?.message ?? String(e);
        throw engineError("DBX_MCP_ERROR", `dbx-mcp 调用失败: ${msg}`);
      }

      // dbx-mcp 成功（包括 DDL/DML）→ 正常 parse markdown 返回
      if (!result.isError) {
        const text = extractText(result, "dbx_execute_query");
        const { columns, rows } = parseMarkdownTable(text);
        const rowCount = rows.length;
        const truncated = rowLimit > 0 && rowCount > rowLimit;
        const visibleRows = truncated ? rows.slice(0, rowLimit) : rows;

        return {
          connection: connectionName,
          kind: classified.kind,
          statement_count: classified.statements.length,
          columns,
          rows: visibleRows,
          row_count: rowCount,
          truncated,
          row_limit: rowLimit,
          duration_ms: now() - started,
          duration_hint: extractDuration(text),
          raw_text: text,
          affected_rows: (() => {
            const m = text.match(/(\d+)\s*row(?:s)?\s*(?:affected|inserted|updated|deleted)/i);
            return m ? parseInt(m[1], 10) : null;
          })(),
        };
      }

      // --- 路径 2：dbx-mcp 返回错误 ---
      const errorText = textOf(result);
      const err = classifyError(errorText);

      // 触发 direct-driver fallback 的条件：
      //   dbx-mcp 原生支持 SQLite、PostgreSQL、MySQL 等绝大多数数据库，
      //   只有硬编码的 SQL_BLOCKED（McpGlobalPolicy 拦截 DDL/DML）才 fallback。
      //   连接失败、协议错误等其他情况，dbx-mcp 和 direct-driver 都会失败，
      //   不再盲目 fallback，让真实错误透传给调用方。
      const conn = body?.connection;
      const dbType = (conn?.dbType ?? conn?.db_type ?? "").toLowerCase();
      const supportedByDirect = DRIVER_FAMILY[dbType] != null;
      const shouldFallback = (err.code === "SQL_BLOCKED" || isSqlBlocked(result)) && supportedByDirect;

      if (conn && dbType && shouldFallback) {
        try {
          const direct = await executeDirect({
            dbType,
            host: conn.host,
            port: conn.port,
            username: conn.username ?? conn.user,
            password: conn.password,
            database: conn.database,
            ssl: conn.ssl,
            sql,
            timeoutMs,
          });

          // 直连成功：统一成与 dbx-mcp 兼容的返回格式
          const rowCount = direct.rows?.length ?? direct.rowCount ?? 0;
          const truncated = rowLimit > 0 && rowCount > rowLimit;
          const visibleRows = truncated ? direct.rows.slice(0, rowLimit) : direct.rows;

          return {
            connection: connectionName,
            kind: classified.kind,
            statement_count: classified.statements.length,
            columns: direct.columns ?? [],
            rows: visibleRows,
            row_count: rowCount,
            truncated,
            row_limit: rowLimit,
            duration_ms: direct.elapsedMs ?? (now() - started),
            duration_hint: "direct-driver",
            raw_text: null,
            affected_rows: direct.rowCount ?? null,
            direct_executed: true,
          };
        } catch (directErr) {
          // direct-driver 也失败了 — 报告 dbx-mcp 原始错误 + direct-driver 原因
          const directMsg = directErr?.message ?? String(directErr);
          const combinedErr = engineError(
            directErr?.code ?? "DIRECT_DRIVER_ERROR",
            `dbx-mcp 执行失败 + 直连回退也失败：${directMsg}`,
            `${errorText}\n--- direct-driver ---\n${directMsg}`,
          );
          throw combinedErr;
        }
      }

      // 非 direct-driver 支持的错误 — 原样返回
      throw engineError(err.code, `dbx_execute_query failed: ${err.detail}`, errorText);
    }],

    // === 对象浏览 ===
    ["/tables", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName ?? body?.connection?.name;
      if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
      const scope = body?.scope ?? {};
      const args = { connection_name: connectionName };
      if (scope.schema) args.schema = scope.schema;
      if (scope.database) args.database = scope.database;
      const result = await mcpClient().callTool("dbx_list_tables", args);
      const text = extractText(result, "dbx_list_tables");
      return { connection: connectionName, tables: parseTableList(text) };
    }],
    ["/describe", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName ?? body?.connection?.name;
      const target = body?.target ?? { schema: body?.schema, table: body?.table };
      if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
      if (!target?.table) throw engineError("BAD_REQUEST", "缺少 table");
      const args = { connection_name: connectionName, table: target.table };
      if (target.schema) args.schema = target.schema;
      const result = await mcpClient().callTool("dbx_describe_table", args);
      const text = extractText(result, "dbx_describe_table");
      const { rows } = parseMarkdownTable(text);
      return { connection: connectionName, table: target.table, columns: parseDescribeColumns(rows) };
    }],
    ["/schema-context", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName;
      if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
      const result = await mcpClient().callTool("dbx_get_schema_context", { connection_name: connectionName });
      const text = extractText(result, "dbx_get_schema_context");
      return { connection: connectionName, schema: text };
    }],
  ];

  // 构建两级 Map：pathname → method → { auth, handler }
  const routes = new Map();
  for (const [pathname, method, auth, handler] of routeDefs) {
    if (!routes.has(pathname)) routes.set(pathname, new Map());
    routes.get(pathname).set(method, { auth, handler });
  }

  // === 统一请求处理 ===
  async function handle(request) {
    const { method = "GET", pathname, headers = {}, body = null } = request ?? {};
    const methodMap = routes.get(pathname);
    if (!methodMap) {
      const error = engineError("NOT_FOUND", `未知路径：${pathname}`);
      return { status: httpStatusForCode(error.code), body: fail(error) };
    }
    const route = methodMap.get(method);
    if (!route) {
      const allowed = [...methodMap.keys()].join(", ");
      const error = engineError("METHOD_NOT_ALLOWED", `${pathname} 只接受 ${allowed}`);
      return { status: httpStatusForCode(error.code), body: fail(error) };
    }
    try {
      if (route.auth) auth.verify(headers);
      const data = await route.handler({ body, headers });
      return { status: 200, body: ok(data) };
    } catch (error) {
      const normalized = normalizeThrown(error);
      return { status: httpStatusForCode(normalized.code), body: fail(normalized) };
    }
  }

  return { handle, routes };
}
