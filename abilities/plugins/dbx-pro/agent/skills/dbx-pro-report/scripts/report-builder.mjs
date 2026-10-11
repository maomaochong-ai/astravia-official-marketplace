#!/usr/bin/env node
/**
 * report-builder —— dbx-pro report SQL → 行列表 + 分组合计
 *
 * 用法：
 *   node scripts/report-builder.mjs --connection <name> --sql "SELECT ..." [--groupBy a,b] [--format csv|table]
 *
 * 与 jimureport 的 26 个 Python 脚本同构，但用 dbx MCP 直连而非 JeecgBoot API。
 */

const DEFAULT_PORT = parseInt(process.env.DBX_PRO_PORT ?? "38123", 10);

function parseArgs(argv) {
  const args = { connectionName: null, sql: null, groupBy: [], format: "table", maxRows: 1000, port: DEFAULT_PORT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--connection") args.connectionName = argv[++i];
    else if (a === "--sql") args.sql = argv[++i];
    else if (a === "--groupBy") args.groupBy = argv[++i].split(",").map(s => s.trim());
    else if (a === "--format") args.format = argv[++i];
    else if (a === "--maxRows") args.maxRows = parseInt(argv[++i], 10);
    else if (a === "--port") args.port = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

async function apiCall(port, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function formatTable(columns, rows) {
  if (rows.length === 0) return "(空结果)";
  const colWidths = columns.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? "").length)));
  const header = columns.map((c, i) => c.padEnd(colWidths[i])).join(" | ");
  const sep = colWidths.map(w => "-".repeat(w)).join("-+-");
  const lines = [header, sep];
  for (const row of rows) {
    const isSub = row._isSubtotal;
    const isGrand = row._isGrandTotal;
    const cells = columns.map((c, i) => String(row[c] ?? "").padEnd(colWidths[i]));
    lines.push(cells.join(" | ") + (isSub ? "  (小计)" : isGrand ? "  (合计)" : ""));
  }
  return lines.join("\n");
}

function formatCsv(columns, rows) {
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.map(esc).join(",")];
  for (const row of rows) {
    if (row._isSubtotal || row._isGrandTotal) continue;
    lines.push(columns.map(c => esc(row[c])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`dbx-pro report builder
  --connection <name>   dbx-pro 连接名称（dbx_list_connections 列出）
  --sql <sql>           SELECT SQL
  --groupBy <a,b>       分组字段（逗号分隔），会自动算小计/合计
  --format <table|csv>  输出格式（默认 table）
  --maxRows <n>         最大行数（默认 1000）`);
    return;
  }
  if (!args.connectionName || !args.sql) { console.error("需要 --connection + --sql"); process.exit(1); }

  const token = process.env.DBX_PRO_TOKEN ?? "";
  try {
    const resp = await apiCall(args.port, "/api/report/exec", {
      connectionName: args.connectionName, sql: args.sql, maxRows: args.maxRows,
      options: { groupBy: args.groupBy },
    }, token || undefined);
    if (!resp.ok) { console.error("API error:", resp.error); process.exit(2); }
    const { columns, rows } = resp.data;

    if (args.format === "csv") process.stdout.write(formatCsv(columns, rows));
    else process.stdout.write(formatTable(columns, rows));
    console.error(`\n📊 共 ${rows.length} 行（含小计/合计）`);
  } catch (e) {
    console.error("❌ 报告执行失败:", e.message);
    process.exit(3);
  }
}

main();
