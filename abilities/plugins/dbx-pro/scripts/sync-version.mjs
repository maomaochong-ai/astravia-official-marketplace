/**
 * 版本号同步脚本：以 src/domain/plugin-version.ts 为 source of truth，
 * 自动对齐 package.json / plugin.json / ability.json / marketplace.source.json / runtime-lock.json。
 *
 *   node scripts/sync-version.mjs             # 只检查不同步，不改文件（exit 0=同步，1=有漂移）
 *   node scripts/sync-version.mjs --write     # 同步修改所有漂移项（幂等）
 *   node scripts/sync-version.mjs --from 0.4.17 --to 0.4.18  # 显式指定升级
 *
 * 为什么需要这个脚本：
 *   plugin.json / ability.json / package.json / marketplace.source.json / plugin-version.ts
 *   理论上应该始终相同，但每次发布手动改容易漏。脚本保证一次成功。
 *
 * 不变更 runtime.version（引擎内部版本，由 build-engine.mjs 从 Python protocol.py 读）。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

// 版本号来源清单（target → 当前值 → 更新规则）
const SOURCES = [
  { path: join(ROOT, "src", "domain", "plugin-version.ts"),           // source of truth
    match: /PLUGIN_VERSION\s*=\s*"([^"]+)"/,
    key: "ts", isSot: true },
  { path: join(ROOT, "package.json"),
    jsonKey: "version",
    key: "pkg" },
  { path: join(ROOT, "plugin.json"),
    jsonKey: "version",
    key: "plugin" },
  { path: join(ROOT, "ability.json"),
    jsonKey: "version",
    key: "ability" },
  { path: join(ROOT, "..", "..", "..", ".astravia", "marketplace.source.json"),
    dbxProVersion: true,
    key: "marketplace" },
  { path: join(ROOT, "runtime-lock.json"),
    jsonKey: "version",
    key: "runtimeLock" },
];

const writeMode = process.argv.includes("--write");
const fromArg = process.argv.indexOf("--from");
const toArg = process.argv.indexOf("--to");
const explicitFrom = fromArg >= 0 && toArg >= 0 ? process.argv[fromArg + 1] : null;
const explicitTo   = fromArg >= 0 && toArg >= 0 ? process.argv[toArg + 1]   : null;

function readVersion(path) {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf8");
  // ts 正则匹配
  const m = content.match(/PLUGIN_VERSION\s*=\s*"([^"]+)"/);
  if (m) return m[1];
  // json 文件
  try { return JSON.parse(content).version ?? null; }
  catch { return null; }
}

function setVersion(path, targetVersion) {
  const content = readFileSync(path, "utf8");

  // ts 文件（正则替换）
  if (path.endsWith(".ts")) {
    const updated = content.replace(/(PLUGIN_VERSION\s*=\s*")[^"]+(")/, `$1${targetVersion}$2`);
    if (updated === content) return false;
    writeFileSync(path, updated);
    return true;
  }

  // marketplace.source.json（dbx-pro 条目在 abilities[] 里）
  if (path.includes("marketplace.source.json")) {
    const doc = JSON.parse(content);
    const abilities = doc.abilities || [];
    const updated = abilities.map((entry) =>
      entry.slug === "dbx-pro" && entry.type === "plugin"
        ? { ...entry, version: targetVersion }
        : entry
    );
    doc.abilities = updated;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    return true;
  }

  // 普通 json 文件
  const doc = JSON.parse(content);
  if (doc.version === targetVersion) return false;
  doc.version = targetVersion;
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  return true;
}

function main() {
  // 1. 决定 targetVersion
  let targetVersion;
  if (explicitFrom && explicitTo) {
    targetVersion = explicitTo;
    console.log(`[sync-version] 显式指定：${explicitFrom} → ${targetVersion}`);
  } else {
    const sot = SOURCES.find((s) => s.isSot);
    if (!sot) throw new Error("没有 source of truth");
    targetVersion = readVersion(sot.path);
    if (!targetVersion) throw new Error(`无法从 ${sot.path} 读版本`);
    console.log(`[sync-version] source of truth: ${targetVersion}`);
  }

  // 2. 扫描所有源
  const diffs = [];
  for (const s of SOURCES) {
    const cur = readVersion(s.path);
    if (cur === targetVersion) continue;
    diffs.push({ ...s, cur });
  }

  if (diffs.length === 0) {
    console.log("[sync-version] ✓ 全部同步，无漂移");
    return 0;
  }

  console.log(`[sync-version] 发现 ${diffs.length} 处漂移：`);
  for (const d of diffs) {
    console.log(`  ${d.path.replace(ROOT + "/", "")}: ${d.cur} → ${targetVersion}`);
  }

  if (!writeMode) {
    console.log("[sync-version] （未写盘，加 --write 执行同步）");
    return 1;
  }

  // 3. 写盘
  let ok = 0, fail = 0;
  for (const d of diffs) {
    try {
      const changed = setVersion(d.path, targetVersion);
      if (changed) { console.log(`  ✓ ${d.path.replace(ROOT + "/", "")}`); ok++; }
      else { console.log(`  - 已同步 ${d.path.replace(ROOT + "/", "")}`); ok++; }
    } catch (err) {
      console.error(`  ✗ ${d.path.replace(ROOT + "/", "")}: ${err.message}`);
      fail++;
    }
  }

  console.log(`[sync-version] 完成：${ok} 已同步, ${fail} 失败`);
  return fail > 0 ? 2 : 0;
}

const code = main();
process.exit(code ?? 0);
