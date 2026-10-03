/**
 * SQL 只读 / 写 / DDL 语句分类与写保护拦截。
 *
 * 保守语义：无法明确判定为只读的语句一律视为写操作。
 */

const READ_LEADERS = new Set(["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "USE", "VALUES"]);
const DDL_KEYWORDS = ["CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME"];
const DDL_LEADERS = new Set(DDL_KEYWORDS);
const DDL_KEYWORD_RE = new RegExp("\\b(?:" + DDL_KEYWORDS.join("|") + ")\\b");

const WRITE_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE", "UPSERT",
  "TRUNCATE", "CREATE", "ALTER", "DROP",
  "GRANT", "REVOKE", "COMMENT",
  "CALL", "EXEC", "EXECUTE", "DO",
  "VACUUM", "REINDEX", "COPY", "LOAD",
  "LOCK", "ATTACH", "DETACH",
  "RENAME", "ANALYZE", "SET",
];
const WRITE_KEYWORD_RE = new RegExp("\\b(?:" + WRITE_KEYWORDS.join("|") + ")\\b");

export function stripSqlComments(sql) {
  let out = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (!inLine && !inBlock && ch === "-" && next === "-") { inLine = true; i += 2; continue; }
    if (!inLine && !inBlock && ch === "/" && next === "*") { inBlock = true; i += 2; continue; }
    if (inLine) { if (ch === "\n") inLine = false; else { i += 1; continue; } }
    if (inBlock) { if (ch === "*" && next === "/") { inBlock = false; i += 2; continue; } i += 1; continue; }
    out += ch; i += 1;
  }
  return out;
}

function firstKeyword(sql) {
  const m = sql.trim().match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
  return m ? m[0].toUpperCase() : "";
}

export function isWriteStatement(sql) {
  const cleaned = stripSqlComments(sql).trim();
  if (!cleaned) return false;
  const first = firstKeyword(cleaned);
  if (READ_LEADERS.has(first)) {
    if (first === "EXPLAIN") {
      const rest = cleaned.slice(first.length).trim();
      if (rest.toUpperCase().startsWith("ANALYZE")) {
        const body = rest.slice(7).trim();
        const bodyFirst = firstKeyword(body);
        if (bodyFirst && !READ_LEADERS.has(bodyFirst)) return true;
        return WRITE_KEYWORD_RE.test(body.toUpperCase());
      }
    }
    return false;
  }
  if (first === "WITH") return WRITE_KEYWORD_RE.test(cleaned.toUpperCase());
  return true;
}

export function isDdlStatement(sql) {
  const cleaned = stripSqlComments(sql).trim();
  if (!cleaned) return false;
  const first = firstKeyword(cleaned);
  if (DDL_LEADERS.has(first)) return true;
  if (first === "WITH") return DDL_KEYWORD_RE.test(cleaned.toUpperCase());
  return false;
}

export function splitStatements(sql) {
  return stripSqlComments(sql).split(";").map((s) => s.trim()).filter((s) => s.length > 0);
}

export function classifyQuery(sql) {
  const statements = splitStatements(sql);
  const kinds = statements.map((s) => {
    if (isDdlStatement(s)) return "ddl";
    return isWriteStatement(s) ? "write" : "read";
  });
  let kind = "read";
  for (const k of kinds) {
    if (k === "ddl") kind = "ddl";
    else if (k === "write" && kind !== "ddl") kind = "write";
  }
  const requiresConfirmation = kind !== "read";
  return { kind, kinds, statements, requiresConfirmation };
}

export function maybeBlockWrite(opts) {
  const { env = "dev", writeApproved = false, confirmedWrite = false, safetyMode = "strict", sql } = opts;
  const classified = classifyQuery(sql);
  if (classified.statements.length === 0) return null;
  const hasApproval = writeApproved || confirmedWrite;
  if (classified.kind === "ddl") {
    if (env === "prod" && !writeApproved) return { code: "PROD_WRITE_BLOCKED", detail: "DDL on production connection requires explicit approval" };
    if (safetyMode === "strict" && !hasApproval) return { code: "DDL_BLOCKED", detail: "DDL statements require confirmation before execution" };
    return null;
  }
  if (classified.kind === "write") {
    if (safetyMode === "strict" && !hasApproval) return { code: "WRITE_BLOCKED", detail: "Write statement requires confirmation in strict safety mode" };
    if (env === "prod" && !writeApproved) return { code: "PROD_WRITE_BLOCKED", detail: "Write statement on production connection requires explicit approval" };
  }
  return null;
}
