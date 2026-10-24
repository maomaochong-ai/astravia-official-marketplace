// open-ai-canvas 插件服务构建脚本
//
// 用法：
//   node scripts/build-service-zip.mjs --canvas-dir <path> [--platform <platform>]
//
// 产物：public/open-ai-canvas-<platform>.zip
// 内容：
//   - yingce-backend（Go 二进制，平台相关）
//   - web-dist/（前端构建产物）
//   - pi-runtime/（画布内置 agent-runtime）
//   - plugin-packages/（官方模型渠道插件包）
//   - boot.mjs（Node wrapper）
//
// --canvas-dir: open-ai-canvas 上游仓库根目录
// --platform: 目标平台（win32-x64 / darwin-x64 / darwin-arm64 / linux-x64 / linux-arm64），
//             不指定则构建当前平台

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile, copyFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(pluginRoot, "public");

// 固定时间戳保证确定性
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

// 解析参数
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { canvasDir: "", platform: "", check: false, skipWebBuild: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--canvas-dir") result.canvasDir = args[++i];
    else if (args[i] === "--platform") result.platform = args[++i];
    else if (args[i] === "--check") result.check = true;
    else if (args[i] === "--skip-web-build") result.skipWebBuild = true;
  }
  return result;
}

// 平台映射
const PLATFORM_MAP = {
  "win32-x64": { goos: "windows", goarch: "amd64", ext: ".exe" },
  "darwin-x64": { goos: "darwin", goarch: "amd64", ext: "" },
  "darwin-arm64": { goos: "darwin", goarch: "arm64", ext: "" },
  "linux-x64": { goos: "linux", goarch: "amd64", ext: "" },
  "linux-arm64": { goos: "linux", goarch: "arm64", ext: "" },
};

function getCurrentPlatform() {
  const os = process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  return `${os}-${arch}`;
}

async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full, rel)));
    else if (entry.isFile()) files.push({ rel, full });
  }
  return files;
}

function sh(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

async function main() {
  const { canvasDir, platform: platformArg, check, skipWebBuild } = parseArgs();

  if (!canvasDir) {
    console.error("Error: --canvas-dir is required");
    process.exit(1);
  }

  const platform = platformArg || getCurrentPlatform();
  const platformConfig = PLATFORM_MAP[platform];
  if (!platformConfig) {
    console.error(`Error: unsupported platform ${platform}`);
    process.exit(1);
  }

  console.log(`Building for platform: ${platform}`);
  console.log(`Canvas dir: ${canvasDir}`);

  const backendDir = path.join(canvasDir, "backend");
  const webDir = path.join(canvasDir, "web");
  const piRuntimeDir = path.join(canvasDir, "backend", "agent-runtime", "pi");
  const pluginPackagesDir = path.join(canvasDir, "plugin-packages");

  // 1. 构建 Go 后端
  console.log("\n[1/5] Building Go backend...");
  const binaryName = `yingce-backend${platformConfig.ext}`;
  const binaryPath = path.join(backendDir, binaryName);
  sh(
    `cd ${backendDir} && CGO_ENABLED=1 GOOS=${platformConfig.goos} GOARCH=${platformConfig.goarch} go build -o ${binaryName} ./cmd/server`,
  );

  // 2. 构建前端
  if (!skipWebBuild) {
    console.log("\n[2/5] Building frontend...");
  // 优先用系统 arm64 node 跑 vite，避免 x64 node / arm64 bun 混合环境下原生包解析失败
  const nodeBin = process.env.CANVAS_BUILD_NODE || "/usr/local/bin/node";
  sh(`cd ${webDir} && bun install`);
  // 用 bunx vite build 跳过 tsc，避免 TypeScript 平台原生包在 x64 node / arm64 bun 混合环境下解析失败
  // 用 node 直接调 vite CLI，保证原生绑定（lightningcss / rolldown）以当前 CPU 架构加载
  sh(`cd ${webDir} && ${nodeBin} node_modules/vite/bin/vite.js build`);
  } else {
    console.log("\n[2/5] Skipping frontend build (--skip-web-build)");
  }
  const webDistDir = path.join(webDir, "dist");

  // 3. 收集文件
  console.log("\n[3/5] Collecting files...");
  const files = [];

  // Go 二进制
  files.push({ rel: binaryName, full: binaryPath });

  // boot.mjs
  files.push({ rel: "boot.mjs", full: path.join(pluginRoot, "server", "boot.mjs") });

  // 前端 dist
  const webDistFiles = await collectFiles(webDistDir, "web-dist");
  files.push(...webDistFiles);

  // pi 运行时
  const piFiles = await collectFiles(piRuntimeDir, "pi-runtime");
  files.push(...piFiles);

  // 官方插件包（只复制 .yingce-plugin 文件）
  const pluginEntries = await readdir(pluginPackagesDir, { withFileTypes: true });
  for (const entry of pluginEntries) {
    if (entry.isFile() && entry.name.endsWith(".yingce-plugin")) {
      files.push({
        rel: `plugin-packages/${entry.name}`,
        full: path.join(pluginPackagesDir, entry.name),
      });
    }
  }

  files.sort((a, b) => a.rel.localeCompare(b.rel));

  // 4. 打包确定性 zip
  console.log("\n[4/5] Creating deterministic zip...");
  const zip = new AdmZip();
  for (const file of files) {
    const data = await readFile(file.full);
    zip.addFile(file.rel, data);
  }
  for (const entry of zip.getEntries()) {
    entry.header.time = FIXED_DATE;
  }

  await mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `open-ai-canvas-${platform}.zip`);
  await writeFile(outputFile, zip.toBuffer());

  // 5. 计算 sha256
  console.log("\n[5/5] Computing sha256...");
  const buffer = await readFile(outputFile);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const buildResult = {
    file: outputFile,
    entries: files.length,
    zipBytes: buffer.length,
    sha256,
  };
  process.stdout.write(`${JSON.stringify(buildResult, null, 2)}\n`);

  // check 模式：校验 plugin.json 中的 sha256
  if (check) {
    const manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
    const service = manifest.providers?.services?.[0];
    const platformEntry = service?.runtime?.platforms?.[platform];
    const declaredSha = platformEntry?.artifacts?.[0]?.sha256;
    if (declaredSha !== sha256) {
      process.stderr.write(
        `plugin.json artifact sha256 ${declaredSha} != built ${sha256}\n` +
          `Please update plugin.json platforms.${platform}.artifacts[0].sha256\n`,
      );
      process.exitCode = 1;
    } else {
      console.log("sha256 matches plugin.json");
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
