/**
 * 写闸门（write guard）。
 *
 * 规则集**逐条移植**自旧项目主进程的
 * `astravia/packages/desktop-app/src/main/database/sql-safety.ts`（213 行，已通读），
 * 因引擎是独立 bundle，这里重写为 ESM 并补上引擎自己的判定入口
 * classifySql() / classifyQuery() / guardQuery()。
 *
 * 与上游的四处**有意差异**（报告里单列）：
 * 1. 上游 maybeBlockWrite 有 env（prod/dev）维度；插件的连接模型没有 env 字段，
 *    因此引擎只保留 allowWrites + confirmedWriteSql 两个输入，prod 语义由 UI 侧承担。
 * 2. 上游把「未知首关键字」默认判为写（default-deny）；这里完全保留该保守语义。
 * 3. 新增 destructive 判定（requiresConfirmation），用于危险语句的逐字确认，
 *    对应旧项目「危险操作二次确认」的产品行为。
 * 4. READ_LEADERS 增加 VALUES（SQLite 的 `VALUES (1),(2)` 是只读表达式）；
 *    PRAGMA 仍刻意不算只读，落入 default-deny 的写分支。
 */

import { engineError } from "./protocol.mjs";

/** 只读语句的首关键字。注意 PRAGMA **不在**这里（见上游 P4-6：PRAGMA journal_mode=WAL 真的会写盘）。 */
const READ_LEADERS = new Set(["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "USE", "VALUES"]);

const DDL_KEYWORDS = ["CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME"];
const DDL_LEADERS = new Set(DDL_KEYWORDS);
const DDL_KEYWORD_RE = new RegExp(`\\b(${DDL_KEYWORDS.join("|")})\\b`);

const TRANSACTION_LEADERS = new Set(["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "START"]);

const WRITE_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE", "UPSERT", "TRUNCATE", "CREATE", "ALTER",
  "DROP", "GRANT", "REVOKE", "COMMENT", "CALL", "EXEC", "EXECUTE", "DO", "VACUUM", "REINDEX",
  "COPY", "LOAD", "LOCK", "ATTACH", "DETACH", "RENAME", "ANALYZE", "SET",
];
const WRITE_KEYWORD_RE = new RegExp(`\\b(${WRITE_KEYWORDS.join("|")})\\b`);

/** 需要用户逐字确认的危险语句首关键字（比「写」更严的一档）。 */
const DESTRUCTIVE_LEADERS = new Set([
  "DELETE", "UPDATE", "TRUNCATE", "DROP", "ALTER", "VACUUM", "REINDEX", "GRANT", "REVOKE",
  "ATTACH", "DETACH", "REPLACE", "MERGE",
]);

/**
 * 字符串字面量感知的注释剥离（只用于**判定**）。
 *
 * B1 修复：此前用正则直接 replace，字符串里的注释标记（两个连字符、或斜杠加星号）
 * 会被当成真注释切掉，而 executor 用的正是剥离后的文本 ⇒ 写入被静默改坏、
 * 带注释标记的字符串字面量直接 502。具体复现见 src/test/engine-service.test.js 的 B1 用例。
 * 现在只在字符串字面量之外剥离注释；单/双引号、反引号与方括号内一律是数据。
 * 注意判定方向仍是保守的：`WITH` 分支对全文扫写关键字时，字符串内容同样会命中
 * （宁可误拦不可放过），这是与上游一致的行为。
 */
const QUOTE_CLOSERS = { "'": "'", '"': '"', "`": "`", "[": "]" };

/** 按「字符串外 / 字符串内」分段遍历；注释在 onCode 侧已被替换为空格。 */
function scanSql(sql, { onCode, onLiteral }) {
  const text = String(sql ?? "");
  const length = text.length;
  let index = 0;
  let code = "";
  const flushCode = () => {
    if (code.length > 0) {
      onCode(code);
      code = "";
    }
  };
  while (index < length) {
    const char = text[index];
    const closer = QUOTE_CLOSERS[char];
    if (closer !== undefined) {
      flushCode();
      let literal = char;
      index += 1;
      while (index < length) {
        const inner = text[index];
        literal += inner;
        if (inner === closer) {
          // 引号自身翻倍是转义（`''` / `""` / `` `` ``）；方括号没有转义形式。
          if (closer !== "]" && text[index + 1] === closer) {
            literal += text[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      onLiteral(literal);
      continue;
    }
    if (char === "-" && text[index + 1] === "-") {
      while (index < length && text[index] !== "\n" && text[index] !== "\r") index += 1;
      code += " ";
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      index += 2;
      while (index < length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index = Math.min(index + 2, length);
      code += " ";
      continue;
    }
    code += char;
    index += 1;
  }
  flushCode();
}

export function stripSqlComments(sql) {
  let stripped = "";
  scanSql(sql, {
    onCode: (chunk) => {
      stripped += chunk;
    },
    onLiteral: (literal) => {
      stripped += literal;
    },
  });
  return stripped.trim();
}

function keywords(sql) {
  return stripSqlComments(sql)
    .toUpperCase()
    .split(/[^A-Z0-9_$]+/)
    .filter((token) => token.length > 0);
}

export function firstKeyword(sql) {
  const tokens = keywords(sql);
  return tokens.length > 0 ? tokens[0] : "";
}

/**
 * 是否写语句。语义与上游一致：
 * - 空/纯注释 → false
 * - `EXPLAIN ANALYZE <stmt>` → 递归判定内部语句（纯 EXPLAIN 保持只读）
 * - `WITH`（CTE）→ 无法判定 CTE body，退化为全文扫描写关键字
 * - 只读首关键字 → false（不对 SELECT 做全文扫描）
 * - 其余（含未知首关键字、PRAGMA）→ **true（default-deny）**
 */
export function isWriteStatement(sql) {
  const cleaned = stripSqlComments(sql);
  if (cleaned.length === 0) return false;
  const tokens = keywords(sql);
  if (tokens.length === 0) return false;
  const [first, second] = tokens;
  if (first === "EXPLAIN" && second === "ANALYZE") {
    return isWriteStatement(cleaned.slice(cleaned.toUpperCase().indexOf("ANALYZE") + "ANALYZE".length));
  }
  if (first === "WITH") {
    return WRITE_KEYWORD_RE.test(cleaned.toUpperCase());
  }
  if (READ_LEADERS.has(first)) return false;
  return true;
}

/** 是否 DDL。 */
export function isDdlStatement(sql) {
  const cleaned = stripSqlComments(sql);
  if (cleaned.length === 0) return false;
  const first = firstKeyword(cleaned);
  if (DDL_LEADERS.has(first)) return true;
  if (first === "WITH") return DDL_KEYWORD_RE.test(cleaned.toUpperCase());
  return false;
}

export function isTransactionStatement(sql) {
  return TRANSACTION_LEADERS.has(firstKeyword(sql));
}

/** 是否危险语句（需要逐字确认）。 */
export function isDestructiveStatement(sql) {
  if (isDdlStatement(sql)) return true;
  return DESTRUCTIVE_LEADERS.has(firstKeyword(sql));
}

/**
 * 切分多语句：字符串字面量里的 `;` 不再切开。
 * B1 同源缺陷：此前 `SELECT 'a;b'` 会被误切成两条语句并判为写（误 403/DDL_BLOCKED）。
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) statements.push(trimmed);
    current = "";
  };
  scanSql(sql, {
    onCode: (chunk) => {
      for (const char of chunk) {
        if (char === ";") flush();
        else current += char;
      }
    },
    onLiteral: (literal) => {
      current += literal;
    },
  });
  flush();
  return statements;
}

/** 单语句分类。 */
export function classifySql(sql) {
  if (isDdlStatement(sql)) return "ddl";
  if (!isWriteStatement(sql)) return "read";
  return isDestructiveStatement(sql) ? "destructive" : "write";
}

/**
 * 整批分类（只判定，不抛错）。kind 取整批最高档：read < write < destructive < ddl。
 */
export function classifyQuery(sql) {
  const statements = splitStatements(sql);
  const kinds = statements.map(classifySql);
  const requiresConfirmation = kinds.includes("ddl") || kinds.includes("destructive");
  let kind = "read";
  for (const current of kinds) {
    if (current === "ddl") kind = "ddl";
    else if (current === "destructive" && kind !== "ddl") kind = "destructive";
    else if (current === "write" && kind === "read") kind = "write";
  }
  return { kind, kinds, statements, requiresConfirmation };
}

/**
 * 执行前的闸门。通过则返回分类结果，拦截则抛出带码的 EngineError。
 * 判定顺序与上游一致：先 DDL 后写。
 */
export function guardQuery({ sql, allowWrites = false, confirmedWriteSql } = {}) {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw engineError("BAD_REQUEST", "SQL 不能为空");
  }
  const classified = classifyQuery(sql);
  if (classified.statements.length === 0) {
    throw engineError("BAD_REQUEST", "没有可执行的 SQL 语句（可能只有注释）");
  }
  if (classified.kind === "read") return classified;

  if (!allowWrites) {
    if (classified.kind === "ddl") {
      throw engineError("DDL_BLOCKED", "当前连接未开启写权限，DDL 语句已被拦截", {
        statementCount: classified.statements.length,
        kind: classified.kind,
      });
    }
    throw engineError("WRITE_BLOCKED", "当前连接未开启写权限，写语句已被拦截", {
      statementCount: classified.statements.length,
      kind: classified.kind,
    });
  }

  if (classified.requiresConfirmation && confirmedWriteSql !== sql) {
    throw engineError(
      "CONFIRM_MISMATCH",
      "危险语句需要按原文确认后才可执行（确认文本与实际 SQL 不一致）",
      { statementCount: classified.statements.length, kind: classified.kind },
    );
  }
  return classified;
}
