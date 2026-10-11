#!/usr/bin/env node
/**
 * spec-builder —— dbx-pro bigscreen spec → HTML 大屏
 *
 * 用法：
 *   node scripts/spec-builder.mjs --spec ./spec.json [--port 38123] [--dry] [--output out.html]
 *
 * 与 jeecgboot jimubi-bigscreen 的 Python spec_builder.py 同构：
 *   - jeecgboot: 读 .py 脚本 → POST /jmreport/bigscreen/page/save → 返回 JimuBI 组件 JSON
 *   - dbx-pro:   读 .mjs 脚本 → POST /api/bigscreen/generate → 返回完整 HTML 大屏
 *
 * 为什么是 .mjs 纯 Node.js：Agent 在任何有 Node.js 18+ 的环境都能跑，
 * 不依赖 dbx-pro 插件运行时（只需要一个 localhost HTTP endpoint）。
 */

const DEFAULT_PORT = parseInt(process.env.DBX_PRO_PORT ?? "38123", 10);

function parseArgs(argv) {
  const args = { spec: null, port: DEFAULT_PORT, dry: false, output: null, engine: "echarts" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spec") args.spec = argv[++i];
    else if (a === "--port") args.port = parseInt(argv[++i], 10);
    else if (a === "--dry") args.dry = true;
    else if (a === "--output" || a === "-o") args.output = argv[++i];
    else if (a === "--engine") args.engine = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

async function readSpec(path) {
  const fs = await import("node:fs");
  const text = await fs.promises.readFile(path, "utf-8");
  return JSON.parse(text);
}

async function apiCall(base, path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`dbx-pro bigscreen spec builder
  --spec <path>     spec JSON 文件路径
  --port <n>        dbx-pro server 端口（默认 38123）
  --dry             只编译组件 option，不生成 HTML
  --output <path>   输出 HTML 文件（默认 stdout）
  --engine <name>   echarts（默认）| chartjs`);
    return;
  }
  if (!args.spec) { console.error("需要 --spec <path>"); process.exit(1); }

  const spec = await readSpec(args.spec);
  // 主流程：compile（返回 JimuBI 组件 JSON）；--render 返回 HTML（调试预览）
  const endpoint = args.render ? "/api/bigscreen/render" : "/api/bigscreen/compile";
  const base = `http://127.0.0.1:${args.port}`;

  try {
    const resp = await apiCall(base, endpoint, { spec, engine: args.engine });
    if (!resp.ok) { console.error("API error:", resp.error); process.exit(2); }
    const data = resp.data;

    if (args.render) {
      // render 端点直接返回 { html: string }
      const html = data.html;
      if (args.output) {
        const fs = await import("node:fs");
        await fs.promises.writeFile(args.output, html, "utf-8");
        console.log(`✅ HTML 预览已写入 ${args.output}（${html.length.toLocaleString()} 字节）`);
      } else {
        process.stdout.write(html);
      }
      return;
    }

    if (args.dry) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      // compile 端点返回完整编译结果：{ page, components, palette, warnings }
      console.log(`📊 大屏: ${data.page?.name ?? "untitled"} (${data.page?.width}×${data.page?.height}, ${data.palette?.name})`);
      console.log(`📦 组件数: ${data.components?.length ?? 0}`);
      for (const c of data.components ?? []) {
        if (c.error) console.log(`  ❌ ${c.type}: ${c.error}`);
        else console.log(`  ✅ ${c.type.padEnd(22)} w=${c.cfg?.w} h=${c.cfg?.h} dataType=${c.cfg?.dataType}`);
      }
      if (data.warnings?.length) {
        console.log(`\n⚠️  警告 ${data.warnings.length} 条:`);
        for (const w of data.warnings) console.log(`  ${w}`);
      }
      // 组件 JSON 数组输出到文件（dbx-pro storage 主流程）
      if (args.output) {
        const fs = await import("node:fs");
        const json = JSON.stringify(data.components?.map(c => ({ type: c.type, title: c.title, cfg: c.cfg })), null, 2);
        await fs.promises.writeFile(args.output, json, "utf-8");
        console.log(`\n✅ 组件 JSON 已写入 ${args.output}`);
      }
    }
  } catch (e) {
    console.error("❌ 构建失败:", e.message);
    process.exit(3);
  }
}

main();
