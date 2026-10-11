#!/usr/bin/env node
/**
 * dashboard-builder —— dbx-pro dashboard spec → HTML 仪表盘
 *
 * 与 bigscreen 共享 spec_builder 编译链，只是默认 palette=biz（亮色主题）。
 * 用法同 spec-builder.mjs。
 */

const DEFAULT_PORT = parseInt(process.env.DBX_PRO_PORT ?? "38123", 10);

function parseArgs(argv) {
  const args = { spec: null, port: DEFAULT_PORT, output: null, palette: "biz", theme: "light" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spec") args.spec = argv[++i];
    else if (a === "--port") args.port = parseInt(argv[++i], 10);
    else if (a === "--output" || a === "-o") args.output = argv[++i];
    else if (a === "--palette") args.palette = argv[++i];
    else if (a === "--theme") args.theme = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log("dbx-pro dashboard builder —— 同 spec-builder，默认亮色主题 biz"); return; }
  if (!args.spec) { console.error("需要 --spec <path>"); process.exit(1); }

  const spec = (await import("node:fs")).promises.readFile(args.spec, "utf-8").then(t => JSON.parse(t));
  // 强制应用 dashboard 默认值
  spec.page = { ...(spec.page ?? {}), theme: args.theme };
  spec.palette = spec.palette ?? args.palette;

  const res = await fetch(`http://127.0.0.1:${args.port}/api/bigscreen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec, engine: "echarts" }),
  });
  if (!res.ok) { console.error("HTTP", res.status, await res.text()); process.exit(2); }
  const resp = await res.json();
  if (!resp.ok) { console.error("API error:", resp.error); process.exit(3); }

  const html = resp.data.html;
  if (args.output) {
    const fs = await import("node:fs");
    await fs.promises.writeFile(args.output, html, "utf-8");
    console.log(`✅ Dashboard HTML 已写入 ${args.output}`);
  } else process.stdout.write(html);
}

main();
