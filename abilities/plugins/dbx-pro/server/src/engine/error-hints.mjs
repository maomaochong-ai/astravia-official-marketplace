/**
 * SQL 执行失败的补充诊断。
 *
 * 为什么需要：dbx-mcp 的错误回馈里不含 SQL（实测只回「SQL text omitted…」），
 * 用户因此只看到一句 `relation "x" does not exist` —— 既不知道引擎连的是哪个库、
 * 哪个账号，也不知道失败的是不是自己刚敲的那条语句。「新建的表查不到」「存储过程
 * 里的 role 不存在」这类问题，全靠这两条线索才能定位。
 *
 * 纪律：这里**只追加**提示，不改写原始错误文本（审计要求：错误要诚实）。
 * 原始文本原样留在 message 首行与 detail 里，调用方负责拼接。
 *
 * 纯函数，无副作用，可直接单测（MCP 目录查询由调用方发起）。
 */

import { parseMarkdownTable, pick } from "./markdown-parser.mjs";

/** 一条 SQL 太长会把错误信息淹掉，提示里只带开头。 */
const SQL_PREVIEW_LIMIT = 400;

/**
 * 各方言「对象不存在」的说法 → 提取对象名。
 * 只收「名字里带点即为限定名」的方言写法，别的一律不猜。
 */
const MISSING_OBJECT_PATTERNS = [
  /(?:relation|table|view|materialized view)\s+"([^"]+)"\s+does not exist/i, // PostgreSQL / Redshift
  /Table\s+'([^']+)'\s+doesn't exist/i, // MySQL / MariaDB
  /Invalid object name\s+'([^']+)'/i, // SQL Server
  /no such table:\s*(\S+)/i, // SQLite
  /Unknown table\s+'([^']+)'/i, // ClickHouse
];

/**
 * 从错误文本里认出「表 / 视图不存在」。
 * @returns `{ name, qualified }`；认不出返回 null。
 */
export function matchMissingObject(rawText) {
  const text = typeof rawText === "string" ? rawText : "";
  for (const pattern of MISSING_OBJECT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      return { name, qualified: name.includes(".") };
    }
  }
  return null;
}

/** 从错误文本里认出「角色不存在」（PostgreSQL 的 `role "x" does not exist`）。 */
export function matchMissingRole(rawText) {
  const match = String(rawText ?? "").match(/role\s+"([^"]+)"\s+does not exist/i);
  return match ? match[1].trim() : null;
}

/** 从错误文本里认出「数据库不存在」。 */
export function matchMissingDatabase(rawText) {
  const match = String(rawText ?? "").match(/database\s+"([^"]+)"\s+does not exist/i);
  return match ? match[1].trim() : null;
}

/**
 * 「同名表在哪个 schema」的目录查询。
 *
 * 只在有 pg_catalog 的方言上实现：pg_class 能一次性回答「这个名字出现在哪些
 * schema」，比让用户自己去猜 search_path 有用得多。名字来自数据库错误文本，
 * 必须转义后再进字面量 —— 不是安全问题，是不能让自己拼出的 SQL 语法错。
 *
 * @returns 可直接下发的 SQL；方言不支持时返回 null。
 */
export function tableLocationQuery(dbType, rawName) {
  const dialect = String(dbType ?? "").toLowerCase();
  if (dialect !== "postgres" && dialect !== "postgresql" && dialect !== "redshift") return null;
  const name = String(rawName ?? "").split(".").pop().trim();
  if (!name) return null;
  const literal = name.replaceAll("'", "''");
  return (
    `SELECT n.nspname AS schema_name FROM pg_catalog.pg_class c ` +
    `JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace ` +
    `WHERE c.relname = '${literal}' AND c.relkind IN ('r','p','v','m','f') ` +
    `AND n.nspname NOT IN ('information_schema','pg_catalog','pg_toast') ` +
    `AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%' ` +
    `ORDER BY n.nspname LIMIT 5`
  );
}

/** 解析 tableLocationQuery 的返回（Markdown 表）→ schema 名列表。 */
export function parseTableLocations(text) {
  const { rows } = parseMarkdownTable(String(text ?? ""));
  return rows
    .map((row) => pick(row, ["schema_name", "schema", "nspname"]).trim())
    .filter(Boolean);
}

/** 「库 kaiwu · 10.0.0.5:5432」这类目标描述；缺信息就不写，不猜。 */
function describeTarget(context = {}) {
  const parts = [];
  if (context.database) parts.push(`库 ${context.database}`);
  if (context.host) parts.push(`${context.host}${context.port ? `:${context.port}` : ""}`);
  return parts.length > 0 ? parts.join(" · ") : "连接配置";
}

/**
 * 本次查询到底连了哪、跑了什么 —— 语句级错误唯一可靠的锚点。
 * 多行文本；信息缺失时省略对应部分。
 *
 * `sql` 是用户写的原文（要改的是它），`effectiveSql` 是引擎分页改写后真正下发的
 * 语句 —— 只有两者不同才附加，否则只会让人以为自己的 SQL 被改了。
 */
export function describeQueryContext(context = {}) {
  const target = [];
  if (context.connection) target.push(`连接 ${context.connection}`);
  if (context.dbType) target.push(context.dbType);
  if (context.host) target.push(`${context.host}${context.port ? `:${context.port}` : ""}`);
  if (context.database) target.push(`库 ${context.database}`);

  const lines = [];
  if (target.length > 0) lines.push(`本次查询上下文：${target.join(" · ")}`);
  if (context.sql) lines.push(`实际执行的 SQL：\n${preview(context.sql)}`);
  if (context.effectiveSql && context.effectiveSql !== context.sql) {
    lines.push(`引擎分页改写后下发：\n${preview(context.effectiveSql)}`);
  }
  return lines.join("\n");
}

function preview(text) {
  const sql = String(text);
  return sql.length > SQL_PREVIEW_LIMIT
    ? `${sql.slice(0, SQL_PREVIEW_LIMIT)}…（已截断，原长 ${sql.length} 字）`
    : sql;
}

/**
 * 按错误文本给出可执行的下一步。认不出就返回空串 —— 宁可不提示，也不给误导。
 *
 * `context.tableLocation`：同名表的 schema 列表；`null` = 查过但没有；`undefined` = 未查。
 */
export function buildSqlErrorHint(rawText, context = {}) {
  const text = typeof rawText === "string" ? rawText : String(rawText ?? "");
  const lines = [];

  const missing = matchMissingObject(text);
  if (missing) {
    if (!missing.qualified) {
      lines.push(
        `表「${missing.name}」是不带 schema 的裸名：引擎按当前会话的 search_path 解析它，` +
          `而 search_path 未必包含这张表所在的 schema —— 用限定名重试（连接树里右键表可「复制限定名」，` +
          `例如 ods.${missing.name}），或把该 schema 加进连接配置。`,
      );
    } else {
      lines.push(
        `表「${missing.name}」带了限定名却不存在：确认 schema 名没写错，并确认这个连接（${describeTarget(context)}）` +
          `就是建表时那一个 —— 连接树里能看到的，才是当前连接可见的。`,
      );
    }
    if (Array.isArray(context.tableLocation) && context.tableLocation.length > 0) {
      lines.push(
        `目录里查到这个表名存在于 schema：${context.tableLocation.join("、")} —— ` +
          `改用限定名即可，例如 ${context.tableLocation[0]}.${missing.name.split(".").pop()}。`,
      );
    } else if (context.tableLocation === null) {
      lines.push(
        "当前连接下没查到同名表（也可能只是这个账号看不到）：优先怀疑这个连接指向的数据库不是建表时那个。",
      );
    }
  }

  const role = matchMissingRole(text);
  if (role) {
    lines.push(
      `角色「${role}」在目标库里不存在，这不是 SQL 语法问题。查两处：① 连接配置里的登录用户名 —— ` +
        `引擎用该账号连接（${describeTarget(context)}）；② SQL / 脚本里对角色名的引用` +
        `（SET ROLE、SET SESSION AUTHORIZATION、OWNER TO、GRANT … TO），从别处导出的脚本最容易带上原环境的角色名。`,
    );
  }

  const database = matchMissingDatabase(text);
  if (database) {
    lines.push(`数据库「${database}」不存在：检查连接配置里的库名，以及 SQL 里的 USE / 全限定库名。`);
  }

  if (/permission denied/i.test(text)) {
    lines.push("权限不足：当前连接账号对该对象没有所需权限，需要 DBA 授权，或换一个权限足够的连接账号。");
  }

  return lines.join("\n");
}
