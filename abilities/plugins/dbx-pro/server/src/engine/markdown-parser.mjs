/**
 * dbx 返回的 Markdown 文本 → 结构化数据解析。
 *
 * dbx-mcp 所有工具返回 content[].text 都是 Markdown 格式：
 * - 表格：`| col1 | col2 |\n| --- | --- |\n| v1 | v2 |`
 * - 列表：`- users (BASE TABLE)`
 * - 纯文本：连接新增确认等
 *
 * 这些是纯函数，无副作用，可直接移植。
 */

/** 从 dbx 工具 result.content 数组提取纯文本。 */
export function textOf(result) {
  return result?.content?.map((c) => c.text ?? "").join("\n") ?? "";
}

/**
 * 解析 Markdown 表格 → 列名 + 行。
 *
 * dbx 所有查询 / 列表工具返回表格格式，含分隔线 `| --- | --- |`。
 * 兼容空表（只有表头 + 分隔线 → 返回空 rows）。
 */
export function parseMarkdownTable(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  if (lines.length < 2) return { columns: [], rows: [] };

  const split = (line) => {
    // dbx-mcp 会把单元格内的 | 转义成 \|（escape_markdown_cell）。
    // 先用占位符保护转义管道，切分后再还原，否则含 | 的数据值会被切碎。
    const PLACEHOLDER = "\u0000";
    return line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .replace(/\\\|/g, PLACEHOLDER)
      .split("|")
      .map((cell) => cell.trim().replaceAll(PLACEHOLDER, "\\|"));
  };

  const columns = split(lines[0]);
  // 第二行是分隔线，跳过；之后每行是数据
  const rows = lines.slice(2).map((line) => {
    const cells = split(line);
    const row = {};
    columns.forEach((col, i) => {
      row[col] = cells[i] ?? "";
    });
    return row;
  });
  return { columns, rows };
}

/** 从行里按候选列名取第一个非空值。 */
export function pick(row, names) {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

/** 解析 Markdown 无序列表（`- name (kind)`）。 */
export function parseBulletList(text) {
  const items = [];
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^[-*]\s*(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

/**
 * 解析 dbx_list_tables 返回的表清单。
 *
 * 兼容两种实际格式：
 * 1. 无序列表：`- users (BASE TABLE)`；PostgreSQL 会带表注释后缀：`- dwd_xxx (BASE TABLE) -- 物业费`；
 * 2. 个别版本返回 Markdown 表格（兜底解析）。
 */
export function parseTableList(text) {
  const tables = [];
  for (const item of parseBulletList(text)) {
    const m = item.match(/^(.+?)\s*\(([^)]+)\)(?:\s*--.*)?$/);
    if (m) {
      tables.push({ name: m[1].trim(), kind: m[2].trim() });
    } else {
      tables.push({ name: item.replace(/\s+--.*$/, "").trim(), kind: "" });
    }
  }
  if (tables.length === 0) {
    const { rows } = parseMarkdownTable(text);
    for (const row of rows) {
      const name = pick(row, ["Name", "name", "Table", "table", "Table Name", "表名"]);
      if (name) tables.push({ name, kind: pick(row, ["Type", "type", "Kind", "kind", "Table Type", "类型"]) });
    }
  }
  return tables;
}

/** 主键标记检测：任一处出现 (PK) / 独立 PK / PRI / PRIMARY KEY 即视为主键列。 */
function isPkMarker(cells) {
  const hay = cells.join(" ").toUpperCase();
  return hay.includes("(PK)") || /\bPK\b/.test(hay) || /\bPRI\b/.test(hay) || /\bPRIMARY KEY\b/.test(hay);
}

/**
 * 解析 dbx_describe_table 返回的行 → 列结构列表。
 *
 * 主键检测多格式兼容：
 * 1. 列名单元格带 `id (PK)`（SQLite 格式）；
 * 2. 独立 Key 列（MySQL `PRI` / `PRIMARY KEY`）；
 * 3. Comment 里的 `PRIMARY KEY` / `PK` 标记。
 */
export function parseDescribeColumns(rows) {
  return rows.map((row) => {
    const nameCell = pick(row, ["Column", "Name", "name"]);
    const keyCell = pick(row, ["Key", "KeyType", "Key type", "keys"]);
    const commentCell = pick(row, ["Comment", "comment"]);
    const isPrimaryKey = isPkMarker([nameCell, keyCell, commentCell]);
    const name = nameCell.replace(/\s*\((?:PK|PRIMARY KEY)\)\s*/gi, "").trim();
    const defaultCell = pick(row, ["Default", "default"]);
    return {
      name,
      type: pick(row, ["Type", "type"]),
      nullable: (pick(row, ["Nullable", "nullable"]) || "YES").toUpperCase() !== "NO",
      hasDefault: defaultCell.length > 0,
      defaultValue: defaultCell,
      comment: commentCell,
      isPrimaryKey,
    };
  });
}

/**
 * 连接列表去重。
 *
 * 引擎返回的连接清单可能带重复行（同一连接被列多次，或同名连接持有不同 id）。
 * 按 id 优先、name 兜底双键去重：首次出现的行胜出。
 */
export function dedupeConnections(connections) {
  const seenIds = new Set();
  const seenNames = new Set();
  const unique = [];
  for (const connection of connections) {
    const id = (connection.id ?? "").trim();
    const name = (connection.name ?? "").trim();
    if (!id && !name) { unique.push(connection); continue; }
    if ((id && seenIds.has(id)) || (name && seenNames.has(name))) continue;
    if (id) seenIds.add(id);
    if (name) seenNames.add(name);
    unique.push(connection);
  }
  return unique;
}

/**
 * 解析 dbx_list_connections 返回的 Markdown 表格 → 连接对象数组。
 *
 * 兼容多种列名变体（大小写 / 不同名称）。返回的连接对象是稳定结构，
 * 上层 UI / 安全闸只依赖这里的字段名。
 */
export function parseConnections(text) {
  const { rows } = parseMarkdownTable(text);
  return rows.map((row) => ({
    id: pick(row, ["ID", "Id", "id"]),
    name: pick(row, ["Name", "name"]),
    groupPath: pick(row, ["Group Path", "GroupPath", "group"]),
    type: pick(row, ["Type", "type", "DB Type"]),
    host: pick(row, ["Host", "host"]),
    port: Number(pick(row, ["Port", "port"])) || 0,
    database: pick(row, ["Database", "database", "DB"]),
  }));
}

/** 把 dbx 工具原始错误文本归类为稳定的错误码。 */
export function classifyError(raw) {
  if (!raw) return { code: "UNKNOWN", detail: "" };
  if (raw.includes("SQL_BLOCKED")) return { code: "SQL_BLOCKED", detail: raw };
  if (raw.includes("DBX_NOT_RUNNING")) return { code: "DBX_NOT_RUNNING", detail: raw };
  if (/connection.*not.*found|ConnectionNotFound/i.test(raw)) return { code: "CONNECTION_NOT_FOUND", detail: raw };
  if (/MCP_READ_ONLY|read-only mode/i.test(raw)) return { code: "READ_ONLY", detail: raw };
  if (/already exists/i.test(raw)) return { code: "CONNECTION_EXISTS", detail: raw };
  if (/INVALID_CONNECTION_TYPE|Unsupported database type|INVALID_CONNECTION|Port is required/i.test(raw))
    return { code: "INVALID_PARAMS", detail: raw };
  if (/timed?\s*out|timeout/i.test(raw)) return { code: "TIMEOUT", detail: raw };
  if (/connection|failed|refused|ECONN|TABLE_LIST_ERROR|CONNECTION_LOAD_ERROR|CONNECTION_SAVE_ERROR/i.test(raw))
    return { code: "CONNECTION_FAILED", detail: raw };
  return { code: "UNKNOWN", detail: raw };
}

/**
 * 判断一个查询错误是否表示「该库没有 ANSI 目录视图」（而不是连接坏了）。
 *
 * 只在这一种情况下允许调用方退回扁平表结构；权限不足、连接失败、超时都必须
 * 当作真故障抛出去。判错的代价不对称：把真故障当「不支持」会让用户面对一棵
 * 空树并误判库里没有表；反过来只是多出一层 schema 节点。
 */
export function isMissingCatalogView(raw) {
  if (!raw) return false;
  const text = String(raw);
  // 明确提到 information_schema / schemata 本身不存在。
  if (/information_schema|schemata/i.test(text) && /does not exist|no such|not found|unknown|not exist/i.test(text)) {
    return true;
  }
  // 方言层信号：SQLite 的 no such table、ClickHouse 的 UNKNOWN_IDENTIFIER、语法不支持。
  if (/no such table|SQLITE_ERROR|UNKNOWN_IDENTIFIER|UNKNOWN_TABLE/i.test(text)) return true;
  if (/syntax error|not implemented|unsupported/i.test(text)) return true;
  return false;
}

/** 从 dbx_execute_query 返回文本提取耗时（如 "1ms" 或 "0.5s"）。 */
export function extractDuration(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(ms|s)\b/i);
  return m ? m[0] : "";
}
