#!/usr/bin/env node
/**
 * 生成 payload-manifest.json（ADR-0005）。
 *
 * 这个清单是插件与载荷之间唯一的版本契约：shim 先读它，再按平台下载对应 zip。
 * 好处是补一个平台或跟一次上游，不必再发一次插件版本——代价是清单本身必须自证
 * 完整，所以这里对每个目标平台都要求一个主载荷，缺一个就失败。
 *
 * 用法（CI）：
 *   node scripts/build-payload-manifest.mjs \
 *     --payload-version 1.6.9.2.1 \
 *     --upstream-tag v1.6.9.2 --upstream-commit <40 位 sha> \
 *     --dir .payload --out .payload/payload-manifest.json
 *
 * 入参文件名按后缀认平台：payload-<anything>-<platform>.zip 与 agent-runtime-<anything>-<platform>.zip。
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];
const PAYLOAD_PATTERN = /^payload-.+-((?:win32|darwin|linux)-(?:x64|arm64))\.zip$/;
const AGENT_PATTERN = /^agent-runtime-.+-((?:win32|darwin|linux)-(?:x64|arm64))\.zip$/;

function parseArgs(argv) {
  const args = { dir: join(ROOT, ".payload"), out: "", payloadVersion: "", upstreamTag: "", upstreamCommit: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--dir") args.dir = value;
    else if (key === "--out") args.out = value;
    else if (key === "--payload-version") args.payloadVersion = value;
    else if (key === "--upstream-tag") args.upstreamTag = value;
    else if (key === "--upstream-commit") args.upstreamCommit = value;
    else continue;
    index += 1;
  }
  args.out ||= join(args.dir, "payload-manifest.json");
  return args;
}

function describe(dir, name) {
  const bytes = readFileSync(join(dir, name));
  return { file: name, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

const args = parseArgs(process.argv.slice(2));

const problems = [];
if (!/^[0-9A-Za-z._-]{1,32}$/.test(args.payloadVersion)) {
  problems.push("--payload-version 只允许字母数字与 . _ -，长度 1-32");
}
if (!args.upstreamTag) problems.push("--upstream-tag 必填（例如 v1.6.9.2）");
if (!/^[0-9a-f]{40}$/.test(args.upstreamCommit)) problems.push("--upstream-commit 必须是 40 位小写十六进制");
if (problems.length > 0) {
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

let entries = [];
try {
  entries = readdirSync(args.dir);
} catch (error) {
  console.error(`无法读取 ${relative(ROOT, args.dir)}：${error.message}`);
  process.exit(1);
}

const platforms = {};
for (const platform of PLATFORMS) {
  platforms[platform] = {};
}

for (const name of entries.sort()) {
  const full = join(args.dir, name);
  if (!statSync(full).isFile()) continue;
  const payloadMatch = name.match(PAYLOAD_PATTERN);
  if (payloadMatch) {
    platforms[payloadMatch[1]].payload = describe(args.dir, name);
    continue;
  }
  const agentMatch = name.match(AGENT_PATTERN);
  if (agentMatch) {
    platforms[agentMatch[1]].agent = describe(args.dir, name);
  }
}

for (const platform of PLATFORMS) {
  if (!platforms[platform].payload) problems.push(`${platform} 缺少主载荷 payload-*.zip`);
}
for (const [platform, spec] of Object.entries(platforms)) {
  if (Object.keys(spec).length === 0) delete platforms[platform];
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const manifest = {
  schemaVersion: 1,
  payloadVersion: args.payloadVersion,
  upstream: { repository: "ddcat-ai/open-ai-canvas", tag: args.upstreamTag, commit: args.upstreamCommit },
  builtAt: new Date().toISOString(),
  platforms,
};

writeFileSync(args.out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `payload-manifest: ${args.payloadVersion} (${args.upstreamTag}) → ${relative(ROOT, args.out)} ` +
    `platforms=${Object.keys(platforms).length}`,
);
