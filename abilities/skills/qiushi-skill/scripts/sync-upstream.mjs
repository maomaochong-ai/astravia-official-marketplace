#!/usr/bin/env node
// 上游台账的执行端：把 scripts/upstream.json 里的「本地文件 -> 上游文件」映射拿去核对或同步。
//
//   node scripts/sync-upstream.mjs --print
//   node scripts/sync-upstream.mjs --verify                     # 默认：从上游按固定 commit 取文件
//   node scripts/sync-upstream.mjs --sync                       # 同上，但写回本地
//   node scripts/sync-upstream.mjs --verify --upstream <本地检出>  # 离线：用已有检出
//
// --verify  逐字节比对，报告 same / diff / missing，有差异时退出码 1
// --sync    用上游原文覆盖本地文件；入口 SKILL.md 默认跳过（它是被改造过的那一份），加 --include-entry 才覆盖
// --print   打印映射表
//
// 默认不要求 git、不克隆整个仓库：按台账里的 revision（不可变 commit）逐个取 raw 文件。
// 上游是公开仓库时唯一需要的是网络；完全离线或上游非 GitHub 时用 --upstream 指一个现成检出。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);

const ENTRY = "SKILL.md";
const CONCURRENCY = 6;

function usage() {
  console.log(`用法：
  node scripts/sync-upstream.mjs --print
  node scripts/sync-upstream.mjs --verify [--revision <commit>]
  node scripts/sync-upstream.mjs --sync   [--revision <commit>] [--include-entry]
  node scripts/sync-upstream.mjs --verify --upstream <上游检出目录>

选项：
  --verify         逐字节比对（默认动作）
  --sync           从上游复制到本地
  --print          只打印映射表
  --revision <sha> 覆盖台账记录的 commit（默认用 scripts/upstream.json 的 revision）
  --upstream <dir> 改用已有本地检出，不联网（为空网环境或非 GitHub 上游准备）
  --repository <url> 覆盖台账里的仓库地址（核对镜像或 fork）
  --include-entry  连入口 SKILL.md 一起覆盖（会丢掉本包的改造）`);
}

const args = process.argv.slice(2);
const options = {
  mode: args.includes("--print") ? "print" : args.includes("--sync") ? "sync" : "verify",
  includeEntry: args.includes("--include-entry"),
  upstream: null,
  revision: null,
  repository: null,
};

for (const flag of ["--upstream", "--revision", "--repository"]) {
  const index = args.indexOf(flag);
  if (index !== -1) options[flag.slice(2)] = args[index + 1];
}

if (args.includes("-h") || args.includes("--help")) {
  usage();
  process.exit(0);
}

const ledgerPath = path.join(root, "scripts", "upstream.json");
if (!existsSync(ledgerPath)) {
  console.error(`找不到台账：${ledgerPath}`);
  process.exit(1);
}

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const mappings = Object.entries(ledger.files ?? {});
// adapted / reimplemented 只登记出处，不比字节：它们本来就与上游不同。
const adapted = Object.entries(ledger.adapted ?? {});
const reimplemented = Object.entries(ledger.reimplemented ?? {});
const revision = options.revision ?? ledger.revision;

// 从 repository 取出 owner/repo；非 github.com 直接拒绝，让人走 --upstream。
const repository = options.repository ?? ledger.repository;

function repoCoords() {
  const match = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(repository ?? "");
  if (!match) return null;
  const [, owner, repo] = match;
  return { owner, repo };
}

const coords = options.upstream ? null : repoCoords();

// 两种取字节的路子，都不需要克隆：
//   api —— api.github.com 的 contents 接口，带 raw accept 直接返回字节
//   raw —— raw.githubusercontent.com，同一条路径的镜像；有的网络只放行其中一个
function endpoints(upstreamPath) {
  const encoded = upstreamPath.split("/").map(encodeURIComponent).join("/");
  return {
    api: `https://api.github.com/repos/${coords.owner}/${coords.repo}/contents/${encoded}?ref=${revision}`,
    raw: `https://raw.githubusercontent.com/${coords.owner}/${coords.repo}/${revision}/${encoded}`,
  };
}

const sourceLabel = options.upstream
  ? `本地检出 ${path.resolve(options.upstream)}`
  : coords
    ? `GitHub ${coords.owner}/${coords.repo} @ ${revision.slice(0, 12)}（不克隆）`
    : "未指定来源";

if (options.mode === "print") {
  console.log(`上游：${repository} @ ${revision}（${ledger.version}，${ledger.license}）`);
  console.log(`取文件：${sourceLabel}`);
  console.log(`映射 ${mappings.length} 条：`);
  for (const [local, upstream] of mappings) console.log(`  ${upstream}  ->  ${local}`);
  if (adapted.length) {
    console.log(`\n已改造、不比对字节 ${adapted.length} 条：`);
    for (const [local, upstream] of adapted) console.log(`  ${upstream}  ->  ${local}（改造过）`);
  }
  if (reimplemented.length) {
    console.log(`\n重新实现 ${reimplemented.length} 条：`);
    for (const [local, upstream] of reimplemented) console.log(`  ${upstream}  ->  ${local}（行为重写）`);
  }
  console.log(`\n改造声明 ${(ledger.adaptations ?? []).length} 条，见 scripts/upstream.json 的 adaptations。`);
  process.exit(0);
}

// ---- 取上游字节：优先本地检出，其次按固定 commit 走 HTTPS ----

let fetchUpstream;

if (options.upstream) {
  const upstreamRoot = path.resolve(options.upstream);
  if (!existsSync(upstreamRoot)) {
    console.error(`上游目录不存在：${upstreamRoot}`);
    process.exit(1);
  }
  // 本地检出顺带核对 HEAD；对不上只提示，因为可能只是想比某个历史版本。
  try {
    const head = execFileSync("git", ["-C", upstreamRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (head !== revision) {
      console.warn(`注意：检出的 HEAD ${head} 与台账记录 ${revision} 不同，比对结果可能包含上游自身的改动。`);
    }
  } catch {
    console.warn("注意：拿不到检出目录的 git 信息，跳过 commit 核对。");
  }
  fetchUpstream = async (upstreamPath) => {
    const file = path.join(upstreamRoot, upstreamPath);
    if (!existsSync(file)) return { status: "missing" };
    return { status: "ok", bytes: await readFile(file) };
  };
} else {
  if (!coords) {
    console.error(`repository 不是 github.com 地址（${repository}），无法按仓库路径取文件。`);
    console.error("请改用 --upstream <上游检出目录>。");
    process.exit(1);
  }
  if (!/^[0-9a-f]{40}$/i.test(revision)) {
    console.error(`revision 必须是 40 位 commit（当前：${revision}）。`);
    console.error("分支名或 tag 会随上游改动而漂移，会让『逐字节比对』变成假比较。");
    process.exit(1);
  }
  if (typeof fetch !== "function") {
    console.error("当前 Node.js 没有全局 fetch（需要 18+）。请升级，或改用 --upstream <本地检出>。");
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    "user-agent": "qiushi-skill-sync",
    accept: "application/vnd.github.raw",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  async function pull(url) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (response.status === 404) return { status: "missing" };
    if (response.status === 403 || response.status === 429) {
      return { status: "ratelimit", detail: `HTTP ${response.status}` };
    }
    if (!response.ok) return { status: "retry", detail: `HTTP ${response.status}` };
    return { status: "ok", bytes: Buffer.from(await response.arrayBuffer()) };
  }

  fetchUpstream = async (upstreamPath) => {
    const url = endpoints(upstreamPath);
    try {
      const first = await pull(url.api);
      if (first.status === "ok" || first.status === "missing") return first;
      if (first.status === "ratelimit") {
        return {
          status: "error",
          detail: `GitHub API 限流（${first.detail}）。设 GITHUB_TOKEN 可提高额度，或用 --upstream <本地检出>。`,
        };
      }
      const second = await pull(url.raw);
      if (second.status === "ok" || second.status === "missing") return second;
      return { status: "error", detail: `${first.detail} / ${second.detail}（api 与 raw 均失败）` };
    } catch (error) {
      return {
        status: "error",
        detail: `${error.name === "TimeoutError" ? "请求超时" : error.message}（${url.api}）`,
      };
    }
  };
}

const identical = [];
const different = [];
const missing = [];
const failed = [];
const skipped = [];

const targets = mappings.filter(([local]) => {
  if (local === ENTRY && !options.includeEntry) {
    skipped.push(local);
    return false;
  }
  return true;
});

// 小并发跑，避免打了 CDN 又被限流。
let cursor = 0;
async function worker() {
  while (cursor < targets.length) {
    const [local, upstream] = targets[cursor++];
    const targetFile = path.join(root, local);
    const source = await fetchUpstream(upstream);

    if (source.status === "error") {
      failed.push(`${local}：${source.detail}`);
      continue;
    }
    if (source.status === "missing") {
      missing.push(`${local}（上游缺 ${upstream}）`);
      continue;
    }

    if (options.mode === "sync") {
      await mkdir(path.dirname(targetFile), { recursive: true });
      await writeFile(targetFile, source.bytes);
      identical.push(local);
      continue;
    }

    if (!existsSync(targetFile)) {
      missing.push(`${local}（本地缺文件）`);
      continue;
    }
    const localBytes = await readFile(targetFile);
    if (localBytes.equals(source.bytes)) identical.push(local);
    else different.push(local);
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length || 1) }, worker));

const where = sourceLabel;

if (options.mode === "sync") {
  console.log(`从 ${where} 同步了 ${identical.length} 个文件。`);
  for (const local of identical) console.log(`  ✓ ${local}`);
  for (const local of skipped) console.log(`  - 跳过 ${local}（本包改造过的入口，加 --include-entry 可覆盖）`);
  for (const item of missing) console.log(`  ! ${item}`);
  for (const item of failed) console.log(`  ! ${item}`);
  process.exit(missing.length === 0 && failed.length === 0 ? 0 : 1);
}

console.log(`来源：${where}`);
// 改造过的文件只核对「还在不在」，不存在同样是问题：台账声称有这个文件。
const adaptedMissing = [];
for (const [local] of adapted) {
  if (!existsSync(path.join(root, local))) adaptedMissing.push(`${local}（已改造的文件不存在）`);
}

console.log(`逐字节比对 ${targets.length} 条映射：`);
console.log(`  skipped ${skipped.length}（本包改造过的入口，加 --include-entry 一并比对）`);
console.log(`  same    ${identical.length}`);
console.log(`  diff    ${different.length}`);
console.log(`  missing ${missing.length}`);
console.log(`  failed  ${failed.length}`);
console.log(`  已改造不比对 ${adapted.length} 条；重新实现 ${reimplemented.length} 条`);
for (const item of adaptedMissing) console.log(`  ✕ missing ${item}`);
for (const local of different) console.log(`  ✕ diff    ${local}`);
for (const item of missing) console.log(`  ✕ missing ${item}`);
for (const item of failed) console.log(`  ✕ failed  ${item}`);

if (!different.length && !missing.length && !failed.length && !adaptedMissing.length) {
  console.log("结果：与上游一致。");
  process.exit(0);
}
process.exit(1);
