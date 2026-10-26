#!/usr/bin/env node
/**
 * 把 shim 同步成宿主能安装的工件声明。
 *
 * 宿主只认 plugin.json 里的 sha256，而 shim 是源码文件，一改就漂。这个脚本做两件事：
 * 拷一份到 public/assets/boot.mjs（vite 原样搬进 dist/assets/，打包器从那里取），
 * 再按五平台重写摘要。
 *
 * 五个平台的字节必须一致：shim 是平台无关的，平台差异全在它运行时下载的 payload 里
 * （ADR-0005）。让每个平台各带一份不同字节的 shim，只会让摘要校验多出四种失败方式。
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "server", "boot.mjs");
const TARGET = join(ROOT, "public", "assets", "boot.mjs");
const MANIFEST = join(ROOT, "plugin.json");
const DESTINATION = "server/boot.mjs";
const PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];

/**
 * runtime.version 是宿主的**目录键**（plugin-services/<id>/<service>/runtime/versions/<version>/），
 * 不是给人看的版本号：宿主的 isReadyRuntime 拿 .runtime.json 与 plugin.json 逐字段比对，
 * 摘要变了而键没变，旧目录就永远对不上新声明，服务再也起不来（ADR-0014）。
 * 所以字节一变就换键——这件事交给脚本做，比要求每个改 shim 的人记得手动 bump 可靠。
 */
function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(typeof version === "string" ? version : "");
  if (!match) {
    console.error(`plugin.json 的 runtime.version 不是 <major>.<minor>.<patch>：${JSON.stringify(version)}`);
    process.exit(1);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

/**
 * @param {{ check?: boolean }} [options]
 * @returns {{ sha256: string, synced: boolean }}
 */
export function syncShim({ check = false } = {}) {
  const bytes = readFileSync(SOURCE);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = (() => {
    try {
      return readFileSync(TARGET);
    } catch {
      return null;
    }
  })();

  if (check) {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    const platforms = manifest.providers?.services?.[0]?.runtime?.platforms ?? {};
    const stale = Object.keys(platforms).filter(
      (platform) => !PLATFORMS.includes(platform) || platforms[platform]?.artifacts?.[0]?.sha256 !== sha256,
    );
    const missing = PLATFORMS.filter((platform) => !platforms[platform]);
    const mirrored = readFileSync(TARGET, { flag: "r" });
    if (stale.length > 0 || missing.length > 0 || !mirrored.equals(bytes)) {
      console.error(
        `sync-shim --check failed: stale=[${stale.join(", ")}] missing=[${missing.join(", ")}] ` +
          `mirror=${mirrored.equals(bytes) ? "ok" : "out-of-date"}`,
      );
      console.error(`  expected sha256 ${sha256} in plugin.json for all five platforms`);
      process.exit(1);
    }
    console.log(`sync-shim ok: ${relative(ROOT, TARGET)} matches ${relative(ROOT, SOURCE)} (${sha256.slice(0, 12)})`);
    return { sha256, synced: false };
  }

  if (existing === null || !existing.equals(bytes)) {
    mkdirSync(dirname(TARGET), { recursive: true });
    copyFileSync(SOURCE, TARGET);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const runtime = manifest.providers?.services?.[0]?.runtime;
  if (!runtime) {
    console.error("plugin.json has no providers.services[0].runtime to update");
    process.exit(1);
  }
  // 只在摘要真的变了时换目录键：同一次构建重跑不该无限涨版本。
  const recorded = Object.values(runtime.platforms ?? {})[0]?.artifacts?.[0]?.sha256;
  const previousVersion = runtime.version;
  if (recorded !== undefined && recorded !== sha256) {
    runtime.version = bumpPatch(previousVersion);
  }

  runtime.platforms = Object.fromEntries(
    PLATFORMS.map((platform) => [
      platform,
      { executable: DESTINATION, artifacts: [{ sha256, archive: "file", destination: DESTINATION }] },
    ]),
  );
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  if (runtime.version !== previousVersion) {
    console.log(`sync-shim: runtime.version ${previousVersion} → ${runtime.version}（shim 字节已变）`);
  }
  console.log(`sync-shim: ${sha256} → ${PLATFORMS.length} platforms`);
  return { sha256, synced: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncShim({ check: process.argv.includes("--check") });
}
