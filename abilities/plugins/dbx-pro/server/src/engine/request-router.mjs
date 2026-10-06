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
 *   POST   /tables           列出连接下全部表（dbx_list_tables，支持 schema/database scope）
 *   POST   /describe         查看表结构（dbx_describe_table）
 *   POST   /query            执行 SQL（dbx_execute_query，含写闸门）
 *   POST   /schema-context   获取连接 schema 上下文（dbx_get_schema_context）
 *   POST   /schemas          列举 schema（information_schema，供连接树 schema 层）
 *   POST   /reveal           在系统文件管理器中定位导出文件（open -R / explorer /select）
 *
 * 写 / DDL 的分路（安全模型）：
 *   - 读 → 常驻 dbx-mcp 子进程，零提权；
 *   - 写 / DDL → 自研写驱动（direct-write）。dbx-mcp 的写开关来自它自己的持久化
 *     MCP settings，进程级 env 只能收紧不能放宽，所以引擎子进程在任何路径下都不提权。
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
import { classifyQuery } from "./sql-safety.mjs";
import {
  buildCountSql,
  buildPagedSql,
  canPaginate,
  supportsPagination,
} from "./sql-pagination.mjs";
import { executeWrite } from "../write/direct-write.mjs";
import {
  textOf,
  parseMarkdownTable,
  parseTableList,
  parseDescribeColumns,
  parseConnections,
  dedupeConnections,
  classifyError,
  extractDuration,
  isMissingCatalogView,
  pick,
} from "./markdown-parser.mjs";
import { selectRevealCommand, runRevealCommand } from "./reveal-item.mjs";

/**
 * dbx_execute_query 的 max_rows 参数上限（crates/dbx-core/src/ai/agent_tools.rs
 * 的 MAX_EXECUTE_QUERY_ROWS）。引擎对超限值做 clamp 而非报错，所以这里先夹一次，
 * 避免 UI 以为拿到了 5000 行、实际只有 1000 行。
 */
const DBX_MAX_ROWS = 1000;

function clampRowLimit(rowLimit) {
  const value = Number.isFinite(rowLimit) ? Math.trunc(rowLimit) : DEFAULT_ROW_LIMIT;
  return Math.min(Math.max(value, 1), MAX_ROW_LIMIT);
}

/** 已随包二进制（dbx 0.4.106）实测的真实结果上限。 */
const DBX_EFFECTIVE_ROW_CAP = 1000;

/** 传给 dbx_execute_query 的行数上限（同时受引擎声明上限与制品实测上限约束）。 */
function dbxMaxRows(rowLimit) {
  return Math.min(Math.max(rowLimit, 1), DBX_MAX_ROWS, DBX_EFFECTIVE_ROW_CAP);
}

/**
 * 列举 schema 的目录查询（按方言）。
 *
 * - PostgreSQL：直查 pg_catalog.pg_namespace，不经过 information_schema.schemata ——
 *   后者只返回当前用户有 USAGE 权限的 schema，非超级用户连接时会漏掉其他 schema。
 *   默认隐藏系统 schema（与 dbx 桌面端一致）。
 * - SQL Server：查 sys.schemas，排除内置 / db_* 角色 schema，dbo 排最前。
 * - MySQL 及其他：ANSI information_schema.schemata（MySQL 的 schema 即数据库，
 *   无权限的库本就无法访问，服务端过滤是合理的）。
 */
const SCHEMA_QUERIES = {
  postgres: `SELECT n.nspname AS schema_name
FROM pg_catalog.pg_namespace n
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
  AND n.nspname NOT LIKE 'pg_temp_%'
ORDER BY n.nspname`,
  sqlserver: `SELECT s.name AS schema_name
FROM sys.schemas s
WHERE s.name NOT IN (
  'guest', 'INFORMATION_SCHEMA', 'sys',
  'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin',
  'db_backupoperator', 'db_datareader', 'db_datawriter',
  'db_denydatareader', 'db_denydatawriter'
)
ORDER BY CASE WHEN s.name = 'dbo' THEN 0 ELSE 1 END, s.name`,
  default: "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
};

/** 按 dbType 选 schema 查询；未知类型回落到 ANSI。 */
function schemaQueryFor(dbType) {
  const type = String(dbType ?? "").toLowerCase();
  if (/postgres|redshift/.test(type)) return SCHEMA_QUERIES.postgres;
  if (/mssql|sqlserver/.test(type)) return SCHEMA_QUERIES.sqlserver;
  return SCHEMA_QUERIES.default;
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

/**
 * 把 UI 侧的产品别名归一为 dbx-mcp 接受的 db_type。
 * dbx-mcp 未为这些协议兼容产品提供独立类型：Aurora PostgreSQL 走 postgres，
 * MariaDB 走 mysql，UDS（PostgreSQL 兼容）走 postgres。
 */
function normalizeDbType(dbType) {
  const value = String(dbType ?? "").toLowerCase();
  if (value === "aurora-postgresql") return "postgres";
  if (value === "mariadb") return "mysql";
  if (value === "uds") return "postgres";
  return value;
}

/** dbx_add_connection 参数名映射（UI 用 camelCase，dbx 期望 snake_case）。 */
function toDbxAddParams(body) {
  const args = { name: body.name, db_type: normalizeDbType(body.dbType), host: body.host };
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

  /**
   * 用引擎里持久化的权威连接元数据补全写配置（database/host/port/db_type）。
   *
   * 为什么必须补 database：PostgreSQL 启动协议在客户端不指定 database 时，
   * 默认用 username 作为库名。前端传入的 connection 若因 state 同步问题缺 database，
   * 写 DDL 会报 `database "<username>" does not exist`（实测：pgadmin）。
   * 用户名 / 密码仍以前端（加密 vault）为准，dbx_list_connections 也不含这些敏感字段。
   */
  async function resolveWriteConnSpec(connectionName, connSpec) {
    const base = { ...connSpec, db_type: connSpec.db_type ?? connSpec.dbType };
    let authoritative = null;
    try {
      const result = await mcpClient().callTool("dbx_list_connections", {});
      authoritative =
        parseConnections(textOf(result)).find((c) => c.name === connectionName) ?? null;
    } catch {
      authoritative = null; // 清单不可用时仅用前端值
    }
    if (!authoritative) return base;
    return {
      ...base,
      db_type: base.db_type || authoritative.type,
      host: base.host || authoritative.host,
      port: base.port || authoritative.port,
      database: base.database || authoritative.database,
    };
  }

  // === 路由表（两级 Map：pathname → method → handler）===
  const routeDefs = [
    // === 健康检查 ===
    // 只读子进程当前 phase，绝不 await/触发握手：健康检查是宿主高频轮询点，
    // 曾因在热路径等待子进程导致连锁超时（引擎启动超时）。
    ["/health", "GET", false, async () => {
      const c = mcpClient();
      let dbxInfo;
      if (c.phase === "ready") dbxInfo = { status: "connected" };
      else if (c.phase === "connecting") dbxInfo = { status: "connecting" };
      else if (c.phase === "error") dbxInfo = { status: "error", message: c.lastError?.message };
      else dbxInfo = { status: "idle" };
      return {
        status: "ok",
        version: ENGINE_VERSION,
        protocol: PROTOCOL_VERSION,
        // 制品真实读上限。前端设置项用它当 max，避免 UI 允许设一个拿不到的值
        // （src/domain/workbench-settings.ts 的 ENGINE_ROW_CAP 必须与这里一致，
        //  由 src/test/engine-service.test.js 的断言守住）。
        row_cap: DBX_EFFECTIVE_ROW_CAP,
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

      // 引擎对同名连接返回「成功文本」而非错误（server.rs：text，非 tool_error）。
      // 保存必须幂等：识别该情况并取回已存连接的真实 id，绝不重复创建。
      const alreadyExists = /already exists/i.test(text);
      if (alreadyExists) {
        const existingList = await mcpClient().callTool("dbx_list_connections", {});
        const existingText = textOf(existingList);
        const existing = parseConnections(existingText).find(
          (c) => c.name.toLowerCase() === body.name.toLowerCase(),
        );
        return {
          id: existing?.id ?? "",
          name: body.name,
          detail: text,
          existing: true,
        };
      }

      const idMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return { id: idMatch?.[0] ?? "", name: body.name, detail: text, existing: false };
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
      const maxRows = dbxMaxRows(rowLimit);

      /**
       * 把 dbx_execute_query 的 Markdown 结果转成引擎响应体（读 / 写共用）。
       *
       * SQL 原样透传、不强制加 LIMIT。0.4.106 制品尊重 max_rows（实测
       * 200/500/1000 均按值返回）：
       * - 常规读最多取 DBX_EFFECTIVE_ROW_CAP 行，达到即标 truncated；
       * - 服务端分页（表预览）本页行数由 pageLimit 决定。
       */
      let pageLimit = null;

      const toOutcome = (text, extra = {}) => {
        const lim = pageLimit ?? DBX_EFFECTIVE_ROW_CAP;
        const { columns, rows: allRows } = parseMarkdownTable(text);
        const rows = allRows.length > lim ? allRows.slice(0, lim) : allRows;
        // 常规读达到单次上限才标截断；分页只看本页，不标。
        const truncated = pageLimit === null && allRows.length >= DBX_EFFECTIVE_ROW_CAP;
        const affected = text.match(/(\d+)\s*row(?:s)?\s*(?:affected|inserted|updated|deleted)/i);
        return {
          connection: connectionName,
          kind: classified.kind,
          statement_count: classified.statements.length,
          columns,
          rows,
          row_count: rows.length,
          truncated,
          row_limit: rowLimit,
          max_rows: maxRows,
          /** 引擎实际返回的行数（可能多于 row_limit，已被裁剪）。 */
          engine_row_count: allRows.length,
          duration_ms: now() - started,
          duration_hint: extractDuration(text),
          raw_text: text,
          affected_rows: affected ? parseInt(affected[1], 10) : null,
          ...extra,
        };
      };

      // --- 路径 1：写 / DDL → 自研写驱动 ---
      // dbx-mcp 的写权限来自它自己的持久化 MCP settings，进程级 env 只能收紧不能放宽
      // （见 dbx crates/dbx-mcp/src/backend.rs 的 effective_mcp_policy_with_legacy_allow_writes：
      //  DBX_MCP_ALLOW_WRITES=1 不解锁，=0 才强制只读）。所以插件不能靠 env 打开写，
      // 写操作统一由自研驱动执行 —— 常驻 / 一次性 dbx-mcp 子进程始终零提权。
      if (classified.requiresConfirmation) {
        if (body?.allowWrite !== true) {
          // 未确认：交给 UI 弹写确认框（UI 拿到 SQL_BLOCKED 后带 allowWrite 重试）。
          throw engineError("SQL_BLOCKED", "写 / DDL 需要显式确认");
        }
        if (body.confirmedWriteSql !== sql) {
          throw engineError("CONFIRM_MISMATCH", "写确认文本与待执行 SQL 不一致");
        }
        const connSpec = body?.connection;
        if (!connSpec?.host) {
          throw engineError("BAD_REQUEST", "写操作需要连接配置（connection）");
        }
        if (connSpec.read_only === true) {
          throw engineError("WRITE_BLOCKED", "连接已设为只读，写操作被拒绝");
        }
        let writeResult;
        try {
          const resolvedSpec = await resolveWriteConnSpec(connectionName, connSpec);
          writeResult = await executeWrite(resolvedSpec, sql);
        } catch (e) {
          if (e?.engineError) throw e;
          throw engineError(e?.code ?? "WRITE_FAILED", `写操作执行失败: ${e?.message ?? String(e)}`);
        }
        return {
          connection: connectionName,
          kind: classified.kind,
          statement_count: classified.statements.length,
          columns: writeResult.columns,
          rows: writeResult.rows,
          row_count: writeResult.rows.length,
          truncated: false,
          row_limit: rowLimit,
          max_rows: maxRows,
          duration_ms: now() - started,
          duration_hint: "self-write",
          raw_text: null,
          command: writeResult.command,
          affected_rows: writeResult.affectedRows,
          write_executed: true,
        };
      }

      // --- 读路径分页：countOnly / page 指定时把原 SQL 包成派生表 ---
      // canPaginate 仅对单条 SELECT/WITH 且无自带分页子句成立，写路径不会进入。
      const dbType = body?.dbType ?? body?.connection?.db_type ?? body?.connection?.dbType;
      const countOnly = body?.countOnly === true;
      const pageReq = body?.page;
      let effectiveSql = sql;
      const pageable = canPaginate(sql);
      if (pageable && countOnly) {
        if (!supportsPagination(dbType)) throw engineError("BAD_REQUEST", "当前数据库类型不支持分页统计");
        effectiveSql = buildCountSql(sql);
      } else if (
        pageable && pageReq && Number.isFinite(pageReq.offset) && Number.isFinite(pageReq.limit)
      ) {
        if (!supportsPagination(dbType)) throw engineError("BAD_REQUEST", "当前数据库类型不支持分页");
        const limit = Math.min(Math.max(Math.trunc(pageReq.limit), 1), DBX_EFFECTIVE_ROW_CAP);
        const offset = Math.max(Math.trunc(pageReq.offset), 0);
        pageLimit = limit;
        effectiveSql = buildPagedSql(sql, dbType, limit, offset);
      }

      // --- 路径 2：读 → 常驻零提权子进程 ---
      let result;
      try {
        result = await mcpClient().callTool(
          "dbx_execute_query",
          {
            connection_name: connectionName,
            sql: effectiveSql,
            // 翻页时本页行数就是页大小：不能用用户设置的去夹，否则「每页 200 行」会被截成 50。
            max_rows: pageLimit ?? maxRows,
          },
          timeoutMs,
        );
      } catch (e) {
        // dbx-mcp 进程挂了等 transport 级错误 — 直接抛，不 fallback
        const msg = e?.message ?? String(e);
        throw engineError("DBX_MCP_ERROR", `dbx-mcp 调用失败: ${msg}`);
      }

      if (!result.isError) {
        const outcome = toOutcome(textOf(result));
        if (countOnly) {
          // COUNT 包装：唯一列 _dbx_total，直接返回总数，不走结果网格
          const total = Number.parseInt(String(outcome.rows[0]?._dbx_total ?? "0"), 10);
          return { kind: "count", connection: connectionName, total_count: Number.isFinite(total) ? total : 0 };
        }
        // 分页响应必须同时带 pageable：客户端一律首请求即分页，靠它判断本页是否真的由服务端切的。
        if (pageLimit) return { ...outcome, paged: true, pageable: true };
        return { ...outcome, pageable };
      }

      const errorText = textOf(result);
      const err = classifyError(errorText);
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

    // === Schema 列举（连接树 schema 层节点的数据源）===
    // dbx-mcp 没有独立的 list_schemas 工具，这里按方言走目录/系统视图查询。
    // 只有「这个库没有该目录视图」才回 supported=false 让前端退回扁平表树；
    // 连接坏了 / 没权限这类真故障必须原样抛出，否则用户会看到一棵空树，
    // 误以为库里没有表（比报错难排查得多）。
    ["/schemas", "POST", true, async ({ body }) => {
      const connectionName = body?.connectionName ?? body?.connection?.name;
      if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
      const result = await mcpClient().callTool("dbx_execute_query", {
        connection_name: connectionName,
        sql: schemaQueryFor(body?.dbType),
        max_rows: DBX_EFFECTIVE_ROW_CAP,
      });
      if (result.isError) {
        const err = classifyError(textOf(result));
        if (!isMissingCatalogView(err)) throw engineError(err.code, err.detail, textOf(result));
        return { connection: connectionName, schemas: [], supported: false };
      }
      const { rows } = parseMarkdownTable(textOf(result));
      const schemas = rows
        .map((row) => String(pick(row, ["schema_name", "SCHEMA_NAME", "Schema", "schema"])).trim())
        .filter((name) => name.length > 0);
      return { connection: connectionName, schemas, supported: true };
    }],

    // === 打开所在文件夹（导出完成态的真实入口）===
    // community 插件拿不到宿主 official shell 能力，由本服务（本地回环 + token 鉴权）
    // 以 spawn 参数数组方式执行平台原生命令；路径限定为绝对路径、无空字节。
    ["/reveal", "POST", true, async ({ body }) => {
      let spec;
      try {
        spec = selectRevealCommand(process.platform, body?.path);
      } catch (e) {
        // 路径非法属于请求问题（400），不能落成 500。
        throw engineError("BAD_REQUEST", e?.message ?? String(e));
      }
      await runRevealCommand(spec);
      return { revealed: true, platform: process.platform };
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
