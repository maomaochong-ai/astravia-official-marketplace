/**
 * 引擎构建脚本（Python runtime 版）：stage server/*.py 源码 + 拉取 dbx-mcp 二进制 + 回填 plugin.json sha256。
 *
 *   node scripts/build-engine.mjs            # 校验：磁盘产物 ↔ plugin.json 声明
 *   node scripts/build-engine.mjs --write    # 下载二进制 + 回填 sha256 / runtime.version / artifacts
 *
 * 产物布局（运行时）：
 *   server/main.py                    ← 入口（executable）
 *   server/engine/*.py                ← 内部包
 *   server/pyproject.toml             ← 依赖声明（Phase 1 零依赖占位）
 *   server/bin/dbx-mcp-darwin-arm64   ← Rust 预编译
 *   server/bin/dbx-mcp-darwin-x64
 *   server/bin/dbx-mcp-win-x64.exe
 *
 * 与旧 Node 版差异：
 *   - 不再 esbuild bundle：Python 是解释型，直接 stage 源码
 *   - artifacts 数组不再单一 main.mjs，而是 server/*.py + engine/*.py + pyproject.toml + bin/*
 *   - 从 server/engine/protocol.py 正则提 ENGINE_VERSION（不 import，避免 node→python 依赖链）
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync, statSync, writeFileSync, chmodSync, existsSync, statSync as _stat } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SERVER_DIR = join(ROOT, "server");
const PY_ENGINE_DIR = join(SERVER_DIR, "engine");
const BIN_DIR = join(SERVER_DIR, "bin");
const MANIFEST_PATH = join(ROOT, "plugin.json");
const RUNTIME_LOCK_PATH = join(ROOT, "runtime-lock.json");
const SERVICE_ID = "dbx-engine";

// === dbx-mcp 二进制来源（硬编码 fork release） ===
const DBX_FORK_REPO = "maomaochong-ai/dbx";
const DBX_RELEASE_TAG = "dbx-mcp-astravia-v0.4.106";
const DBX_RELEASE_BASE = `https://github.com/${DBX_FORK_REPO}/releases/download/${DBX_RELEASE_TAG}`;

/** 平台 → fork release asset 名 + 本地目标名 + 本地权限（executable） */
const DBX_BINARIES = [
  { platform: "darwin-arm64", asset: "dbx-mcp-0.4.106-astravia-darwin-arm64",   dest: "dbx-mcp-darwin-arm64",   exec: true },
  { platform: "darwin-x64",   asset: "dbx-mcp-0.4.106-astravia-darwin-x64",     dest: "dbx-mcp-darwin-x64",     exec: true },
  { platform: "win32-x64",    asset: "dbx-mcp-0.4.106-astravia-win-x64.exe",    dest: "dbx-mcp-win-x64.exe",    exec: false },
];

const PLATFORMS = ["darwin-arm64", "darwin-x64", "win32-x64"];

const write = process.argv.includes("--write");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** 递归收集 server/ 下所有 .py + .mjs + pyproject.toml（不含 bin/ 和 __pycache__/） */
function collectServerArtifacts() {
  const out = [];
  function walk(dir, rel) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const relPath = rel ? join(rel, name) : name;
      if (name === "__pycache__") continue;
      if (name === "bin") continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, relPath);
      else if (
        name.endsWith(".py") ||
        name.endsWith(".mjs") ||
        name === "pyproject.toml"
      ) out.push(relPath);
    }
  }
  walk(SERVER_DIR, "server");
  return out.sort();
}

/** 从 protocol.py 提 ENGINE_VERSION（正则，不 import） */
function readEngineVersion() {
  const path = join(PY_ENGINE_DIR, "protocol.py");
  const content = readFileSync(path, "utf8");
  const m = content.match(/ENGINE_VERSION\s*=\s*"([^"]+)"/);
  if (!m) throw new Error(`无法从 ${path} 提 ENGINE_VERSION`);
  return m[1];
}

async function ensureDbxBinary(platform, asset, dest, exec) {
  const destPath = join(BIN_DIR, dest);
  mkdirSync(BIN_DIR, { recursive: true });
  if (existsSync(destPath) && statSync(destPath).size > 1_000_000) {
    const sizeMB = (statSync(destPath).size / 1_048_576).toFixed(1);
    console.log(`  [local] ${platform} ${dest} (${sizeMB}MB, sha256=${sha256(readFileSync(destPath)).slice(0, 16)}...)`);
    return destPath;
  }
  const url = `${DBX_RELEASE_BASE}/${asset}`;
  console.log(`  [fetch] ${platform} ${asset} ← ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed ${asset}: ${resp.status} (local fallback not available)`);
  const buf = Buffer.from(await resp.arrayBuffer());
  writeFileSync(destPath, buf);
  if (exec) chmodSync(destPath, 0o755);
  const sizeMB = (buf.length / 1_048_576).toFixed(1);
  console.log(`  [ok] ${platform} ${dest} (${sizeMB}MB, sha256=${sha256(buf).slice(0, 16)}...)`);
  return destPath;
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function serviceOf(manifest) {
  const services = manifest.providers?.services ?? [];
  const service = services.find((entry) => entry.id === SERVICE_ID);
  if (!service) throw new Error(`plugin.json 缺少 providers.services[${SERVICE_ID}]`);
  return service;
}

async function main() {
  if (write) {
    // 1. 确保 Python 源码存在（不再 bundle）
    const pyArtifacts = collectServerArtifacts();
    if (pyArtifacts.length === 0) throw new Error("server/ 下找不到 .py 文件，Phase 1 未完成？");
    console.log(`[build] ${pyArtifacts.length} 个 Python 源文件将被 stage`);

    // 2. 下载 dbx-mcp binaries
    console.log(`[download] fetching dbx-mcp binaries from fork release ${DBX_RELEASE_TAG}...`);
    await Promise.all(DBX_BINARIES.map(b => ensureDbxBinary(b.platform, b.asset, b.dest, b.exec)));

    // 3. 计算所有产物 sha256
    const allArtifacts = [
      ...pyArtifacts,
      ...DBX_BINARIES.map(b => `server/bin/${b.dest}`),
    ];
    const shaMap = {};
    for (const a of allArtifacts) {
      const buf = readFileSync(join(ROOT, a));
      shaMap[a] = sha256(buf);
    }

    // 4. 重写 plugin.json artifacts（所有平台共享同样的 Python 源码 artifact 列表）
    const manifest = readManifest();
    const svc = serviceOf(manifest);

    // 构建通用 Python 源码 artifact 列表（跨平台共享）
    const pyArtifactList = pyArtifacts.map((p) => ({
      sha256: shaMap[p],
      archive: "file",
      destination: p,
    }));

    for (const [platformKey, platformCfg] of Object.entries(svc.runtime.platforms || {})) {
      // 先放 Python 源码 artifacts
      const artifacts = [...pyArtifactList];
      // 再放该平台专属的 dbx-mcp 二进制
      const binEntry = DBX_BINARIES.find(b => b.platform === platformKey);
      if (binEntry) {
        const binDest = `server/bin/${binEntry.dest}`;
        artifacts.push({
          sha256: shaMap[binDest],
          archive: "file",
          destination: binDest,
        });
      }
      platformCfg.artifacts = artifacts;
    }

    // 5. runtime.version 从 Python protocol.py 读
    const engineVersion = readEngineVersion();
    const prevVersion = svc.runtime.version;
    svc.runtime.version = engineVersion;

    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

    // 6. 同步 runtime-lock.json
    const mcpVersion = DBX_RELEASE_TAG.match(/v([\d.]+)$/)?.[1];
    if (!mcpVersion) throw new Error(`无法从 release tag 解析引擎版本：${DBX_RELEASE_TAG}`);
    const runtimeLock = existsSync(RUNTIME_LOCK_PATH)
      ? JSON.parse(readFileSync(RUNTIME_LOCK_PATH, "utf8"))
      : {};
    runtimeLock.version = mcpVersion;
    runtimeLock.platforms = Object.fromEntries(
      DBX_BINARIES.map((b) => {
        const dest = `server/bin/${b.dest}`;
        return [b.platform, [{ destination: dest, url: `${DBX_RELEASE_BASE}/${b.asset}`, sha256: shaMap[dest] }]];
      }),
    );
    writeFileSync(RUNTIME_LOCK_PATH, `${JSON.stringify(runtimeLock, null, 2)}\n`);
    console.log(`[build] runtime-lock.json 已同步（dbx-mcp ${mcpVersion}）`);

    const summary = allArtifacts.map((p) => ({
      destination: p,
      sha256: shaMap[p].slice(0, 32) + "...",
      bytes: statSync(join(ROOT, p)).size,
    }));
    console.log(JSON.stringify({ mode: "write", runtimeVersion: `${prevVersion} → ${engineVersion}`, artifacts: pyArtifacts.length + " server src + " + DBX_BINARIES.length + " bin", outputs: summary }, null, 2));
    return;
  }

  // === 校验模式 ===
  const manifest = readManifest();
  const svc = serviceOf(manifest);
  const firstPlatform = Object.values(svc.runtime.platforms || {})[0];
  if (!firstPlatform) throw new Error("plugin.json 缺少 runtime.platforms");

  const summary = [];
  let mismatch = 0;

  // Python 源码 artifacts（所有平台共享同一份声明）
  for (const pyRel of collectServerArtifacts()) {
    const full = join(ROOT, pyRel);
    const declared = firstPlatform.artifacts?.find((a) => a.destination === pyRel)?.sha256;
    if (!existsSync(full)) {
      summary.push({ destination: pyRel, status: "MISSING" }); mismatch++; continue;
    }
    const actual = sha256(readFileSync(full));
    summary.push({
      destination: pyRel,
      bytes: statSync(full).size,
      sha256: actual.slice(0, 32) + "...",
      status: actual === declared ? "ok" : "SHA256_MISMATCH",
    });
    if (actual !== declared) mismatch++;
  }

  // dbx-mcp 二进制（只检查当前平台）
  const platform = PLATFORMS.find(p => {
    const pf = process.platform; const arch = process.arch;
    if (pf === "darwin" && arch === "arm64") return p === "darwin-arm64";
    if (pf === "darwin" && arch === "x64") return p === "darwin-x64";
    if (pf === "win32" && arch === "x64") return p === "win32-x64";
    return false;
  });
  if (platform) {
    const binEntry = DBX_BINARIES.find(b => b.platform === platform);
    const dest = `server/bin/${binEntry.dest}`;
    const full = join(ROOT, dest);
    const declared = svc.runtime.platforms[platform].artifacts?.find((a) => a.destination === dest)?.sha256;
    if (!existsSync(full)) {
      summary.push({ destination: dest, status: "MISSING" }); mismatch++;
    } else {
      const actual = sha256(readFileSync(full));
      summary.push({ destination: dest, bytes: statSync(full).size, sha256: actual.slice(0, 32) + "...", status: actual === declared ? "ok" : "SHA256_MISMATCH" });
      if (actual !== declared) mismatch++;
    }
  }

  console.log(JSON.stringify({ mode: "check", platform, artifacts: summary }, null, 2));
  if (mismatch > 0) {
    console.error(`[build-engine] ${mismatch} 项与 plugin.json 不一致，请运行 node scripts/build-engine.mjs --write`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[build-engine] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
