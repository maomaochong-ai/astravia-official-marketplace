/**
 * SQLite 驱动（D1 唯一的一等实现）。
 *
 * 用 Node 22 内置的 `node:sqlite`（DatabaseSync）——**零原生模块**，
 * 已在托管 Node 22.22.2 与本地 Node v22.22.2 上实测可用（无需 flag）。
 *
 * 三处关键取舍（都在报告里标注）：
 * 1. `setReadBigInts(true)` 常开 + 逐值归一化：避免超范围整数直接抛
 *    `ERR_OUT_OF_RANGE` 把整次查询打掉；安全范围内还原为 Number，超范围给十进制字符串。
 * 2. 只读结果集的列名：有行时取首行键；零行时回退 `StatementSync.columns()`
 *    （实测对零行 SELECT 仍返回列元数据）——修掉旧版「空结果集没有表头」的问题。
 * 3. 读取用 `iterate()` 并在 rowLimit+1 行处 break，避免大表把宿主 16MB 响应打爆。
 *
 * 明确的**做不到**：node:sqlite 是同步 API，单条语句执行期间无法被 HTTP 层打断。
 * 超时只在「语句之间」生效（见 request-router 的 deadline 检查）。
 */

import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_ROW_LIMIT,
  MAX_ROW_LIMIT,
  engineError,
  isEngineError,
} from "../engine/protocol.mjs";
import { isWriteStatement } from "../engine/query-guard.mjs";

export const descriptor = {
  id: "sqlite",
  label: "SQLite",
  family: "sqlite",
  tier: "first-class",
  defaultPort: 0,
  fileBased: true,
};

/** 标识符引用：SQLite 用双引号，内部双引号翻倍。表名/库名一律走这里，绝不裸拼。 */
function quoteIdent(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

const SQLITE_MAGIC = Buffer.from("SQLite format 3\u0000", "latin1");

/**
 * 打开前的头部校验（B2 修复）。
 *
 * `node:sqlite` 对「存在但不是数据库」的文件会**永久挂住**：实测
 * `new DatabaseSync("/etc/passwd")` ≥150s 不返回也不抛错；而 DatabaseSync 是**同步** API，
 * 一挂就把整个引擎进程（含 /health）一起卡死，SIGTERM 也不生效（只能 SIGKILL）。
 * 所以先读 16 字节文件头，非 `SQLite format 3\0` 直接拒绝。
 * 0 字节文件是 SQLite 语义下合法的新库，放行。
 */
function assertOpenableSqliteFile(file) {
  let stats;
  try {
    stats = statSync(file);
  } catch {
    throw engineError("CONNECTION_ERROR", `无法读取数据库文件：${file}`, { file });
  }
  if (!stats.isFile()) {
    throw engineError("CONNECTION_ERROR", `不是普通文件：${file}`, { file });
  }
  if (stats.size === 0) return;
  let descriptor;
  let header;
  try {
    descriptor = openSync(file, "r");
    header = Buffer.alloc(16);
    const read = readSync(descriptor, header, 0, 16, 0);
    header = header.subarray(0, read);
  } catch {
    throw engineError("CONNECTION_ERROR", `无法读取数据库文件：${file}`, { file });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (header.length !== SQLITE_MAGIC.length || !header.equals(SQLITE_MAGIC)) {
    throw engineError("CONNECTION_ERROR", `不是有效的 SQLite 数据库文件：${file}`, { file });
  }
}

function sqliteFilePath(spec) {
  const candidate = [spec.file, spec.database, spec.host].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (!candidate) {
    throw engineError("BAD_REQUEST", "SQLite 连接缺少数据库文件路径（file/database）");
  }
  return candidate.trim();
}

function normalizeValue(value) {
  if (typeof value === "bigint") {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    return value <= max && value >= min ? Number(value) : value.toString();
  }
  if (value instanceof Uint8Array) {
    return { __type: "blob", bytes: value.byteLength, base64: Buffer.from(value).toString("base64") };
  }
  return value;
}

function normalizeRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row)) output[key] = normalizeValue(value);
  return output;
}

function clampRowLimit(rowLimit) {
  const value = Number.isFinite(rowLimit) ? Math.trunc(rowLimit) : DEFAULT_ROW_LIMIT;
  return Math.min(Math.max(value, 1), MAX_ROW_LIMIT);
}


function runStatement(db, sql, { rowLimit, shouldAbort }) {
  if (shouldAbort?.()) throw engineError("TIMEOUT", "查询超时（在语句之间中断）");

  const statement = db.prepare(sql);
  // 「执行方式」不看分类器，而看这条语句到底有没有结果集：
  //   columns() 非空（SELECT / PRAGMA xxx / INSERT..RETURNING）→ 读路径（iterate）
  //   columns() 抛错或为空（INSERT/UPDATE/DDL 等）→ 写路径（run）
  // 闸门仍用保守的分类器（PRAGMA 归入写，需 allowWrites），两者职责分开。
  let declared = null;
  try {
    declared = statement.columns();
  } catch {
    declared = null;
  }
  const readsRows = declared ? declared.length > 0 : !isWriteStatement(sql);

  if (!readsRows) {
    const result = statement.run();
    return {
      sql,
      kind: "write",
      columns: [],
      rows: [],
      row_count: 0,
      affected_rows: Number(result.changes ?? 0),
      last_insert_rowid:
        typeof result.lastInsertRowid === "bigint" ? Number(result.lastInsertRowid) : result.lastInsertRowid,
      truncated: false,
    };
  }

  statement.setReadBigInts(true);
  const rows = [];
  let truncated = false;
  for (const row of statement.iterate()) {
    if (shouldAbort?.()) throw engineError("TIMEOUT", "查询超时（在语句之间中断）");
    if (rows.length >= rowLimit) {
      truncated = true;
      break;
    }
    rows.push(normalizeRow(row));
  }
  const columns =
    rows.length > 0 ? Object.keys(rows[0]) : (declared ?? []).map((column) => column.name);
  return { sql, kind: "read", columns, rows, row_count: rows.length, affected_rows: 0, truncated };
}

export function createDriver() {
  return {
    descriptor,
    /** 打开一个连接句柄。生命周期由 ConnectionPool 管理。 */
    acquire(spec) {
      const file = sqliteFilePath(spec);
      if (file !== ":memory:" && !existsSync(file)) {
        // 不做「静默建库」：旧版把不存在的库文件建成 0 字节再报 ✅，属于假阳性。
        throw engineError("CONNECTION_ERROR", `数据库文件不存在：${file}`, { file });
      }
      // 先验头再打开：避免非数据库文件把同步的 DatabaseSync 永久挂住（B2）。
      if (file !== ":memory:") assertOpenableSqliteFile(file);
      let db;
      try {
        // 注意：node:sqlite 不接 `undefined` 作为第二参（报 "The options argument must be an object."），
        // 所以按分支调用，别写成 new DatabaseSync(file, cond ? {…} : undefined)。
        db = spec.readOnly === true ? new DatabaseSync(file, { readOnly: true }) : new DatabaseSync(file);
      } catch (error) {
        if (isEngineError(error)) throw error;
        throw engineError("CONNECTION_ERROR", error instanceof Error ? error.message : String(error), { file });
      }
      return {
        file,
        native: db,
        test() {
          const started = Date.now();
          const row = db.prepare("select sqlite_version() as version").get();
          return {
            serverVersion: String(row?.version ?? "unknown"),
            database: file,
            latencyMs: Date.now() - started,
            readOnly: spec.readOnly === true,
          };
        },
        catalog() {
          const namespaces = db
            .prepare("PRAGMA database_list")
            .all()
            .map((row) => ({ name: String(row.name), file: row.file ? String(row.file) : null, default: row.name === "main" }));
          const objects = [];
          for (const namespace of namespaces) {
            const sql = `select name, type from ${quoteIdent(namespace.name)}.sqlite_master where type in ('table','view') order by name`;
            for (const row of db.prepare(sql).all()) {
              const name = String(row.name);
              objects.push({
                schema: namespace.name,
                name,
                kind: String(row.type),
                system: name.startsWith("sqlite_"),
              });
            }
          }
          return { namespaces, objects };
        },
        describe({ schema = "main", table } = {}) {
          if (typeof table !== "string" || table.trim().length === 0) {
            throw engineError("BAD_REQUEST", "describe 需要 table");
          }
          const name = table.trim();
          const meta = `select sql from ${quoteIdent(schema)}.sqlite_master where name = ?`;
          const metaRow = db.prepare(meta).get(name);
          if (!metaRow) {
            throw engineError("NOT_FOUND", `对象不存在：${schema}.${name}`, { schema, table: name });
          }
          let rows = db.prepare(`PRAGMA ${quoteIdent(schema)}.table_info(${quoteIdent(name)})`).all();
          let hidden = false;
          if (rows.length === 0) {
            rows = db.prepare(`PRAGMA ${quoteIdent(schema)}.table_xinfo(${quoteIdent(name)})`).all();
            hidden = true;
          }
          return {
            schema,
            table: name,
            hidden,
            sql: metaRow.sql ? String(metaRow.sql) : null,
            columns: rows.map((row) => ({
              name: String(row.name),
              type: String(row.type ?? ""),
              nullable: Number(row.notnull ?? 0) === 0,
              primaryKey: Number(row.pk ?? 0) > 0,
              defaultValue: row.dflt_value === null || row.dflt_value === undefined ? null : String(row.dflt_value),
            })),
          };
        },
        /** 执行**单条**语句（多语句由 request-router 切分后逐条调用，便于回报每条的分类与结果）。 */
        query({ sql, rowLimit, shouldAbort } = {}) {
          if (typeof sql !== "string" || sql.trim().length === 0) {
            throw engineError("BAD_REQUEST", "query 需要 sql");
          }
          return runStatement(db, sql, { rowLimit: clampRowLimit(rowLimit), shouldAbort });
        },
        close() {
          db.close();
        },
      };
    },
  };
}
