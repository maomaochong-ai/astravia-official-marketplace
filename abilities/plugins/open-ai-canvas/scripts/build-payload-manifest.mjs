#!/usr/bin/env node
/**
 * 生成 payload-manifest.json（ADR-0005）。
 *
 * 这个清单是插件与载荷之间唯一的版本契约：shim 先读它，再按平台下载对应 zip。
 * 好处是补一个平台或跟一次上游，不必再发一次插件版本——代价是清单本身必须自证
 * 完整，所以这里对每个目标平台都要求一个主载荷，缺一个就失败。
 *
 * 用法（CI，一次发满 5 个平台）：
 *   node scripts/build-payload-manifest.mjs \
 *     --payload-version 1.6.9.2.1 \
 *     --upstream-tag v1.6.9.2 --upstream-commit <40 位 sha> \
 *     --dir .payload --out .payload/payload-manifest.json
 *
 * 用法（本机增量，只能原生编 darwin-arm64）：
 *   node scripts/build-payload-manifest.mjs \
 *     --published <已发布清单路径或 URL> \
 *     --payload-version 1.7.3.4 \
 *     --upstream-tag v1.7.3.4 --upstream-commit <40 位 sha> \
 *     --dir .payload --out .payload/payload-manifest.json
 *
 * `--published` 的语义是「其余平台沿用已发布条目，只有 --dir 里有的平台被替换」。
 * 这是本机补一个平台时唯一能守住完整性的方式：清单必须 5 个平台齐全，而本机只编得出一个。
 *
 * 入参文件名按后缀认平台：payload-<anything>-<platform>.zip 与 agent-runtime-<anything>-<platform>.zip。
 * 平台键只有 win32|darwin|linux 与 x64|arm64 的组合——产物名必须写成 `payload-1.7.3.4-win32-x64.zip`
 * 这种形式，不能出现 `windows`、`mac`、`amd64` 之类同义写法。
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
  const args = {
    dir: join(ROOT, ".payload"),
    out: "",
    payloadVersion: "",
    upstreamTag: "",
    upstreamCommit: "",
    upstreamRepository: "ddcat-ai/open-ai-canvas",
    published: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--dir") args.dir = value;
    else if (key === "--out") args.out = value;
    else if (key === "--payload-version") args.payloadVersion = value;
    else if (key === "--upstream-tag") args.upstreamTag = value;
    else if (key === "--upstream-commit") args.upstreamCommit = value;
    else if (key === "--upstream-repository") args.upstreamRepository = value;
    else if (key === "--published") args.published = value;
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

/** 已发布清单可以给本地文件，也可以给 URL：增量发布时前者是 CI 产物，后者是线上资产。 */
async function readPublished(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: "follow" });
    if (!response.ok) throw new Error(`下载已发布清单失败：HTTP ${response.status} ${source}`);
    return JSON.parse(await response.text());
  }
  return JSON.parse(readFileSync(source, "utf8"));
}

const args = parseArgs(process.argv.slice(2));

const problems = [];
if (!/^[0-9A-Za-z._-]{1,32}$/.test(args.payloadVersion)) {
  problems.push("--payload-version 只允许字母数字与 . _ -，长度 1-32");
}
if (!args.upstreamTag) problems.push("--upstream-tag 必填（例如 v1.6.9.2）");
if (!/^[0-9a-f]{40}$/.test(args.upstreamCommit)) problems.push("--upstream-commit 必须是 40 位小写十六进制");
if (!/^[0-9A-Za-z._-]+\/[0-9A-Za-z._-]+$/.test(args.upstreamRepository)) {
  problems.push("--upstream-repository 必须是 owner/repo 形式");
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

let base = null;
if (args.published) {
  try {
    base = await readPublished(args.published);
  } catch (error) {
    console.error(`无法读取已发布清单 ${args.published}：${error.message}`);
    process.exit(1);
  }
  if (base?.schemaVersion !== 1 || typeof base.platforms !== "object" || base.platforms === null) {
    console.error(`已发布清单 ${args.published} 不是 schemaVersion 1 的载荷清单`);
    process.exit(1);
  }
}

let entries = [];
try {
  entries = readdirSync(args.dir);
} catch (error) {
  // 打给定的绝对路径：相对路径在 CI 里会变成 `../../../../dist`，看不出是哪个目录。
  console.error(`无法读取 ${args.dir}：${error.message}`);
  console.error(`（--dir 指向下载下来的 zip 所在目录；本地手动跑时要先手动放 10 个 zip 进去）`);
  process.exit(1);
}

const platforms = {};
for (const platform of PLATFORMS) {
  platforms[platform] = {};
}

/** 同平台同类型只允许一个文件：靠文件名排序决定用哪份，等于让 555 字节的占位包顶掉真载荷。 */
const seen = new Map();
const ignored = [];

for (const name of entries.sort()) {
  const full = join(args.dir, name);
  if (!statSync(full).isFile()) continue;
  if (!name.endsWith(".zip")) continue;
  const payloadMatch = name.match(PAYLOAD_PATTERN);
  const agentMatch = payloadMatch ? null : name.match(AGENT_PATTERN);
  if (!payloadMatch && !agentMatch) {
    ignored.push(name);
    continue;
  }
  const kind = payloadMatch ? "payload" : "agent";
  const platform = (payloadMatch ?? agentMatch)[1];
  const key = `${kind}:${platform}`;
  if (seen.has(key)) {
    problems.push(`${platform} 有多个 ${kind} 包：${seen.get(key)} 与 ${name}（保留哪一份不该由文件名排序决定）`);
  }
  seen.set(key, name);
  platforms[platform][kind] = describe(args.dir, name);
}

for (const name of ignored) {
  problems.push(
    `${name} 不符合产物命名规范：载荷用 payload-<payloadVersion>-<platform>.zip，` +
      `Agent 用 agent-runtime-<version>-<platform>.zip，platform 取 win32|darwin|linux 与 x64|arm64 的组合`,
  );
}

const merged = {};
for (const platform of PLATFORMS) {
  // 已发布条目整体保留（file/sha/bytes 都不动），本地有产物才覆盖。
  merged[platform] = { ...(base?.platforms?.[platform] ?? {}), ...platforms[platform] };
}

for (const platform of PLATFORMS) {
  if (!merged[platform].payload) {
    problems.push(
      `${platform} 缺少主载荷 payload-*.zip${base ? `（已发布清单里也没有，需要先补这个平台）` : ""}`,
    );
  }
}
for (const [platform, spec] of Object.entries(merged)) {
  if (Object.keys(spec).length === 0) delete merged[platform];
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const manifest = {
  schemaVersion: 1,
  payloadVersion: args.payloadVersion,
  upstream: { repository: args.upstreamRepository, tag: args.upstreamTag, commit: args.upstreamCommit },
  builtAt: new Date().toISOString(),
  platforms: merged,
};

writeFileSync(args.out, `${JSON.stringify(manifest, null, 2)}\n`);
const fresh = PLATFORMS.filter((platform) => platforms[platform].payload).join(",") || "（无）";
console.log(
  `payload-manifest: ${args.payloadVersion} (${args.upstreamTag}) → ${relative(ROOT, args.out)} ` +
    `platforms=${Object.keys(merged).length} local=${fresh}`,
);
for (const platform of PLATFORMS) {
  const spec = merged[platform];
  const origin = platforms[platform].payload ? "local" : "published";
  console.log(`  ${platform}: ${spec.payload.file} (${origin})${spec.agent ? ` + ${spec.agent.file}` : ""}`);
}
