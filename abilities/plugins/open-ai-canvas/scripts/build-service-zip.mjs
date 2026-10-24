// open-ai-canvas 服务制品构建脚本（两层产物）
//
// 为什么分两层：
//   微型 shim（public/open-ai-canvas-<platform>.zip，仅含 boot.mjs）随 .astraviapkg 分发，
//   满足 plugin.json 的 artifacts 声明；重型载荷（Go 二进制 + web-dist + 官方插件包）压缩后
//   远超 Desktop 的 50 MB 单包上限，因此改为首次启动时由 boot.mjs 下载、校验、解包。
//
// 用法：
//   node scripts/build-service-zip.mjs --shim [--platform <platform>] [--check]
//       产物：public/open-ai-canvas-<platform>.zip（vite build 会把它拷进 dist/）
//       --check 会核对 plugin.json 里声明的 sha256，不一致即失败
//   node scripts/build-service-zip.mjs --payload --canvas-dir <path> [--platform <platform>]
//       产物：.payload/payload-<version>-<platform>.zip（上传到 GitHub Release，不进仓库）
//
// 载荷内容：yingce-backend（Go）+ web-dist/ + plugin-packages/*.yingce-plugin
// 刻意不含 pi-runtime：上游 provision.go 按「显式指定 → 已解包 → 随包压缩资源」解析本地文件，
// 不联网下载，因此画布内的本地 copilot 会提示缺失；宿主侧 MCP 操控不受影响。

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shimOutputDir = path.join(pluginRoot, "public");
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
  const args = { canvasDir: "", platform: "", check: false, payload: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--canvas-dir") args.canvasDir = argv[++i];
    else if (argv[i] === "--platform") args.platform = argv[++i];
    else if (argv[i] === "--check") args.check = true;
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

// --- shim：包内唯一制品，只装 boot.mjs ---
async function buildShim({ platform, check }) {
  const bootPath = path.join(pluginRoot, "server", "boot.mjs");
  await stat(bootPath);
  const files = [{ rel: "boot.mjs", full: bootPath, buffer: await readFile(bootPath) }];

  await mkdir(shimOutputDir, { recursive: true });
  const outputFile = path.join(shimOutputDir, `open-ai-canvas-${platform}.zip`);
  const buffer = zipFrom(files);
  await writeFile(outputFile, buffer);
  const digest = sha256(buffer);
  console.log(
    `[shim] ${path.relative(pluginRoot, outputFile)}  entries=${files.length}  bytes=${buffer.length}  sha256=${digest}`,
  );

  const manifest = await readManifest();
  const platformEntry = manifest.providers?.services?.[0]?.runtime?.platforms?.[platform];
  const declared = (platformEntry?.artifacts ?? []).map((artifact) => artifact.sha256);

  if (check) {
    if (declared.length !== 1 || declared[0] !== digest) {
      console.error(
        `plugin.json platforms.${platform}.artifacts[0].sha256 = ${declared.join(",") || "(none)"}\n` +
          `实际产物 = ${digest}\n请更新 plugin.json 后重新构建。`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(`[shim] sha256 与 plugin.json 一致`);
  } else if (declared.length === 1 && declared[0] !== digest) {
    console.log(`[shim] 提示：plugin.json 记录的 sha256 已过期，请改为 ${digest}`);
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
  if (mode === "payload") await buildPayload({ canvasDir: args.canvasDir, platform });
  else await buildShim({ platform, check: args.check });
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
