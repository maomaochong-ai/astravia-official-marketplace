// open-ai-canvas 服务制品构建脚本（两层产物）
//
// 为什么分两层：
//   微型 shim（public/boot.mjs，就是 server/boot.mjs 的副本）随 .astraviapkg 分发，
//   满足 plugin.json 的 artifacts 声明；重型载荷（Go 二进制 + web-dist + 官方插件包）压缩后
//   远超 Desktop 的 50 MB 单包上限，因此改为首次启动时由 boot.mjs 下载、校验、解包。
//
// shim 用 archive: "file" 交付：宿主直接 writeFile 落地，不值得为一个 40 KB 的 .mjs
// 再造一层 zip，也因此不再需要平台后缀文件名。
//
// 用法：
//   node scripts/build-service-zip.mjs --shim [--check] [--clean]
//       产物：public/boot.mjs（vite build 会把它拷进 dist/）
//       --check 会核对 plugin.json 里声明的 sha256、archive 与 destination，不一致即失败
//       --clean 顺手删掉旧版留下的 public/open-ai-canvas-*.zip
//       产物：.payload/payload-<version>-<platform>.zip（上传到 GitHub Release，不进仓库）
//
// 载荷内容：yingce-backend（Go）+ web-dist/ + plugin-packages/*.yingce-plugin
// 刻意不含 pi-runtime：上游 provision.go 按「显式指定 → 已解包 → 随包压缩资源」解析本地文件，
// 不联网下载，因此画布内的本地 copilot 会提示缺失；宿主侧 MCP 操控不受影响。

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 必须落在 public/assets/：vite 把它原样拷到 dist/assets/，而 .astraviapkg 打包器
// 对 dist/assets/ 下的文件是全量收的（dist 根下只收 .css）。放错位置会让包装到
// 用户机器上时读不到 shim，install 直接 404。
const shimOutputDir = path.join(pluginRoot, "public", "assets");
const payloadOutputDir = path.join(pluginRoot, ".payload");

// 固定时间戳保证字节级确定性，sha256 才能钉在 plugin.json 里
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

const PLATFORM_MAP = {
  "win32-x64": { goos: "windows", goarch: "amd64", ext: ".exe" },
  "darwin-x64": { goos: "darwin", goarch: "amd64", ext: "" },
  "darwin-arm64": { goos: "darwin", goarch: "arm64", ext: "" },
  "linux-x64": { goos: "linux", goarch: "amd64", ext: "" },
  "linux-arm64": { goos: "linux", goarch: "arm64", ext: "" },
};

function parseArgs(argv) {
  const args = { canvasDir: "", platform: "", check: false, clean: false, payload: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--canvas-dir") args.canvasDir = argv[++i];
    else if (argv[i] === "--platform") args.platform = argv[++i];
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--clean") args.clean = true;
    else if (argv[i] === "--payload") args.payload = true;
  }
  return args;
}

function currentPlatform() {
  return `${process.platform}-${process.arch === "x64" ? "x64" : process.arch}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readManifest() {
  return JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
}

async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...(await collectFiles(full, rel)));
    else if (entry.isFile()) files.push({ rel, full });
  }
  return files;
}

function zipFrom(files) {
  const zip = new AdmZip();
  for (const file of files) zip.addFile(file.rel, file.buffer);
  for (const entry of zip.getEntries()) entry.header.time = FIXED_DATE;
  return zip.toBuffer();
}

// --- shim：包内唯一制品，就是 server/boot.mjs 本身 ---
// 产物直接取源文件字节，所以 plugin.json 里钉的 sha256 与仓库里的 boot.mjs 一一对应，
// 没有 zip 包装、没有平台后缀，也就不会再有"bag 里放着一个平台专属小包"的错位。
const SHIM_ARTIFACT_DESTINATION = "server/boot.mjs";

async function cleanLegacyShims() {
  let removed = 0;
  for (const dir of [shimOutputDir, path.join(pluginRoot, "public")]) {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isFile() || !/^open-ai-canvas-.+\.zip$/.test(entry.name)) continue;
      const target = path.join(dir, entry.name);
      await rm(target, { force: true });
      console.log(`[clean] 删除旧制品 ${path.relative(pluginRoot, target)}`);
      removed += 1;
    }
  }
  if (!removed) console.log("[clean] 没有需要清理的旧 zip 制品");
}

async function buildShim({ platform, check }) {
  const bootPath = path.join(pluginRoot, "server", "boot.mjs");
  await stat(bootPath);
  const buffer = await readFile(bootPath);

  await mkdir(shimOutputDir, { recursive: true });
  const outputFile = path.join(shimOutputDir, "boot.mjs");
  await writeFile(outputFile, buffer);
  const digest = sha256(buffer);
  console.log(
    `[shim] ${path.relative(pluginRoot, outputFile)}  bytes=${buffer.length}  sha256=${digest}`,
  );

  const manifest = await readManifest();
  const platformEntry = manifest.providers?.services?.[0]?.runtime?.platforms?.[platform];
  const declared = platformEntry?.artifacts ?? [];
  const [artifact] = declared;
  const problems = [];
  if (declared.length !== 1) problems.push(`artifacts 应为 1 项，实际 ${declared.length} 项`);
  if (artifact && artifact.sha256 !== digest) problems.push(`sha256 应为 ${digest}，实际 ${artifact.sha256}`);
  if (artifact && artifact.archive !== "file") problems.push(`archive 应为 file，实际 ${artifact.archive}`);
  if (artifact && artifact.destination !== SHIM_ARTIFACT_DESTINATION)
    problems.push(`destination 应为 ${SHIM_ARTIFACT_DESTINATION}，实际 ${artifact.destination}`);

  if (check) {
    if (problems.length > 0) {
      console.error(`plugin.json platforms.${platform} 与实际产物不一致：\n  ${problems.join("\n  ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[shim] plugin.json 声明与产物一致（sha256 / archive / destination）`);
  } else if (problems.length > 0) {
    console.log(`[shim] 提示：plugin.json 需要更新：\n  ${problems.join("\n  ")}`);
  }
}

// --- payload：上传到 Release 的重型载荷 ---
async function buildPayload({ canvasDir, platform }) {
  if (!canvasDir) {
    console.error("Error: --canvas-dir is required for --payload");
    process.exit(1);
  }
  const config = PLATFORM_MAP[platform];
  if (!config) {
    console.error(`Error: unsupported platform ${platform}`);
    process.exit(1);
  }

  const manifest = await readManifest();
  const version = manifest.version;
  const binaryName = `yingce-backend${config.ext}`;
  const binaryPath = path.join(canvasDir, "backend", binaryName);
  const webDistDir = path.join(canvasDir, "web", "dist");
  const pluginPackagesDir = path.join(canvasDir, "plugin-packages");

  await stat(binaryPath);
  await stat(webDistDir);

  console.log(`[payload] 收集 ${platform} 载荷：${binaryName} + web/dist + plugin-packages`);
  const files = [{ rel: binaryName, full: binaryPath, buffer: await readFile(binaryPath) }];
  files.push(...(await collectFiles(webDistDir, "web-dist")));
  for (const entry of await readdir(pluginPackagesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yingce-plugin")) continue;
    const full = path.join(pluginPackagesDir, entry.name);
    files.push({ rel: `plugin-packages/${entry.name}`, full, buffer: await readFile(full) });
  }
  for (const file of files) {
    if (!file.buffer) file.buffer = await readFile(file.full);
    delete file.full;
  }

  await mkdir(payloadOutputDir, { recursive: true });
  const outputFile = path.join(payloadOutputDir, `payload-${version}-${platform}.zip`);
  const buffer = zipFrom(files);
  await writeFile(outputFile, buffer);

  console.log(
    `[payload] ${path.relative(pluginRoot, outputFile)}  entries=${files.length}  bytes=${buffer.length}  sha256=${sha256(buffer)}`,
  );
  console.log(`[payload] 把上面的 sha256 写进 server/boot.mjs 的 PAYLOADS["${platform}"].sha256`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform || currentPlatform();
  const mode = args.payload ? "payload" : "shim";
  console.log(`[${mode}] platform=${platform}`);
  if (mode === "shim" && args.clean) await cleanLegacyShims();
  if (mode === "payload") await buildPayload({ canvasDir: args.canvasDir, platform });
  else await buildShim({ platform, check: args.check });
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
