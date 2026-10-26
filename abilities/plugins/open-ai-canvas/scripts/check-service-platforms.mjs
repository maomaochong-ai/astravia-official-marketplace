#!/usr/bin/env node
/**
 * 发布前的一致性检查（ADR-0005）。
 *
 * 三件事必须同时成立，否则安装会在用户机器上以「摘要不匹配」或「平台不支持」结束：
 *   1. plugin.json 的 runtime.platforms 恰好是五个目标平台，每个一项 file 制品；
 *   2. 五项摘要等于 server/boot.mjs 的实际字节，也等于镜像 public/assets/boot.mjs；
 *   3. shim 源码里的 TARGET_PLATFORMS 与之一致（它是运行时拒绝未知平台的依据）。
 *
 * 载荷清单（payload-manifest.json）在 Release 上，不在仓库里。本地没有就跳过，并明确
 * 说明跳过了什么——把「没检查」写成「通过」是这类脚本最容易撒的谎。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];
const PLATFORM_PATTERN = /^(win32|darwin|linux)-(x64|arm64)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DESTINATION = "server/boot.mjs";

const problems = [];
const notes = [];
const validated = [];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const shimBytes = readFileSync(join(ROOT, "server", "boot.mjs"));
const shimDigest = sha256(shimBytes);

let mirrorDigest = null;
try {
  mirrorDigest = sha256(readFileSync(join(ROOT, "public", "assets", "boot.mjs")));
} catch {
  problems.push("public/assets/boot.mjs 不存在：先跑 npm run shim");
}

const manifest = JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8"));
const runtime = manifest.providers?.services?.[0]?.runtime;
if (!runtime) problems.push("plugin.json 缺少 providers.services[0].runtime");

// runtime.version 是宿主的运行时目录键（ADR-0014）：宿主的 isReadyRuntime 拿
// .runtime.json 与 plugin.json 逐字段比对，字节变了却沿用旧键，旧目录永远对不上。
if (!/^\d+\.\d+\.\d+$/.test(runtime?.version ?? "")) {
  problems.push(`runtime.version 应为 <major>.<minor>.<patch>，实际 ${JSON.stringify(runtime?.version)}`);
}
if (runtime?.kind === "host-node" && runtime?.entry !== DESTINATION) {
  problems.push(`runtime.entry 应为 ${DESTINATION}，实际 ${runtime?.entry}`);
}

const declared = Object.keys(runtime?.platforms ?? {});
for (const platform of PLATFORMS) {
  if (!declared.includes(platform)) problems.push(`plugin.json 缺少平台 ${platform}`);
}
for (const platform of declared) {
  if (!PLATFORMS.includes(platform)) problems.push(`plugin.json 多出平台 ${platform}（不在目标矩阵内）`);
  if (!PLATFORM_PATTERN.test(platform)) problems.push(`平台键 ${platform} 不是 <os>-<arch> 形式`);
}

const digests = new Set();
for (const platform of declared) {
  const entry = runtime?.platforms?.[platform] ?? {};
  const artifacts = entry.artifacts ?? [];
  if (artifacts.length !== 1) {
    problems.push(`platforms.${platform}.artifacts 应为 1 项，实际 ${artifacts.length} 项`);
    continue;
  }
  const [artifact] = artifacts;
  if (entry.executable !== DESTINATION) {
    problems.push(`platforms.${platform}.executable 应为 ${DESTINATION}，实际 ${entry.executable}`);
  }
  if (artifact.archive !== "file") problems.push(`platforms.${platform}.archive 应为 file，实际 ${artifact.archive}`);
  if (artifact.destination !== DESTINATION) {
    problems.push(`platforms.${platform}.destination 应为 ${DESTINATION}，实际 ${artifact.destination}`);
  }
  if (!SHA256_PATTERN.test(artifact.sha256 ?? "")) {
    problems.push(`platforms.${platform}.sha256 不是 64 位小写十六进制`);
    continue;
  }
  digests.add(artifact.sha256);
  if (artifact.sha256 !== shimDigest) {
    problems.push(`platforms.${platform}.sha256 与 server/boot.mjs 不一致（应为 ${shimDigest}）`);
  }
}
if (digests.size > 1) {
  problems.push(`五个平台出现了 ${digests.size} 种不同的 shim 摘要：shim 与平台无关，摘要必须一致`);
}
if (mirrorDigest && mirrorDigest !== shimDigest) {
  problems.push("public/assets/boot.mjs 与 server/boot.mjs 字节不同（跑 npm run shim 重新镜像）");
}

// shim 源码里的平台矩阵：运行时用它拒绝未知平台，和 plugin.json 对不上就会出现
// 「宿主说支持、shim 说不支持」这种自相矛盾的组合。
const shimSource = shimBytes.toString("utf8");
// 容忍打包器：源里是 `const`，esbuild 会输出 `var`（ADR-0012 决策 3）。
const matrixMatch = shimSource.match(/(?:const|let|var) TARGET_PLATFORMS = \[([^\]]*)\]/);
if (!matrixMatch) {
  problems.push("server/boot.mjs 里找不到 TARGET_PLATFORMS 常量");
} else {
  const inSource = [...matrixMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const missing = PLATFORMS.filter((platform) => !inSource.includes(platform));
  const extra = inSource.filter((platform) => !PLATFORMS.includes(platform));
  if (missing.length > 0) problems.push(`boot.mjs 的 TARGET_PLATFORMS 缺少 ${missing.join(", ")}`);
  if (extra.length > 0) problems.push(`boot.mjs 的 TARGET_PLATFORMS 多出 ${extra.join(", ")}`);
}
for (const constant of ["payload-manifest.json", "CANVAS_PAYLOAD_BASE_URL"]) {
  if (!shimSource.includes(constant)) problems.push(`server/boot.mjs 不再引用 ${constant}（清单驱动的载荷解析被改回去了？）`);
}

// 载荷清单：只校验存在的那一份。CLI 传入 --payload-manifest <path> 可指定。
const manifestFlagIndex = process.argv.indexOf("--payload-manifest");
const payloadManifestPath =
  manifestFlagIndex > 0 ? process.argv[manifestFlagIndex + 1] : join(ROOT, ".payload", "payload-manifest.json");
try {
  const payloadManifest = JSON.parse(readFileSync(payloadManifestPath, "utf8"));
  if (payloadManifest.schemaVersion !== 1) problems.push("payload-manifest.schemaVersion 应为 1");
  if (!/^[0-9A-Za-z._-]{1,32}$/.test(payloadManifest.payloadVersion ?? "")) {
    problems.push("payload-manifest.payloadVersion 非法（只允许字母数字与 . _ -，最长 32）");
  }
  if (!/^[0-9a-f]{40}$/.test(payloadManifest.upstream?.commit ?? "")) {
    problems.push("payload-manifest.upstream.commit 应为 40 位十六进制");
  }
  for (const platform of PLATFORMS) {
    const entry = payloadManifest.platforms?.[platform];
    if (!entry?.payload) {
      problems.push(`payload-manifest 缺少 ${platform}.payload`);
      continue;
    }
    for (const [kind, spec] of Object.entries({ payload: entry.payload, agent: entry.agent })) {
      if (!spec) continue;
      if (typeof spec.file !== "string" || spec.file.includes("/") || spec.file.includes("\\")) {
        problems.push(`payload-manifest ${platform}.${kind}.file 必须是裸文件名`);
      }
      if (!SHA256_PATTERN.test(spec.sha256 ?? "")) {
        problems.push(`payload-manifest ${platform}.${kind}.sha256 非法`);
      }
    }
  }
  validated.push(`载荷清单已校验：${relative(ROOT, payloadManifestPath)} (${payloadManifest.payloadVersion})`);
} catch (error) {
  if (error.code === "ENOENT") {
    notes.push(`载荷清单未找到（${relative(ROOT, payloadManifestPath)}），跳过校验：它由 CI 发布到 Release，不进仓库`);
  } else {
    problems.push(`载荷清单解析失败：${error.message}`);
  }
}

for (const note of notes) console.log(`[skip] ${note}`);
for (const note of validated) console.log(`[manifest] ${note}`);
if (problems.length > 0) {
  console.error(`\n[check-service-platforms] ${problems.length} 个问题：`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `[check-service-platforms] ok: ${PLATFORMS.length} platforms, runtime ${runtime.version}, shim sha256 ${shimDigest.slice(0, 12)}, archive=file`,
);
