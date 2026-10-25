// open-ai-canvas 服务制品构建脚本（两层产物）
//
// 为什么分两层：
//   微型 shim（public/assets/boot.mjs，就是 server/boot.mjs 的副本）随 .astraviapkg 分发，
//   满足 plugin.json 的 artifacts 声明；重型载荷（Go 二进制 + web-dist + 官方插件包）压缩后
//   远超 Desktop 的 50 MB 单包上限，因此改为首次启动时由 boot.mjs 下载、校验、解包。
//
// shim 用 archive: "file" 交付：宿主直接 writeFile 落地，不值得为一个 40 KB 的 .mjs
// 再造一层 zip，也因此不再需要平台后缀文件名。
//
// 用法：
//   node scripts/build-service-zip.mjs --shim [--check] [--clean]   （实现委托给 sync-shim.mjs）
//       产物：public/assets/boot.mjs（vite build 会把它拷进 dist/assets/）
//       --check 交给 sync-shim.mjs：核对五平台摘要、archive 与 destination，不一致即失败
//       --clean 顺手删掉旧版留下的 public/open-ai-canvas-*.zip
//   node scripts/build-service-zip.mjs --payload --canvas-dir <上游仓库>
//       产物：.payload/payload-<version>-<platform>.zip（上传到 GitHub Release，不进仓库）
//   node scripts/build-service-zip.mjs --agent-runtime --canvas-dir <上游仓库> [--node-bin <node>]
//       产物：.payload/agent-runtime-<agentVersion>-<platform>.zip
//   node scripts/build-service-zip.mjs --web --canvas-dir <上游仓库>
//       产物：<canvas-dir>/web/dist（五平台共用同一份，CI 里只跑一次）
//   node scripts/build-service-zip.mjs --backend --canvas-dir <上游仓库> [--platform <p>] [--commit <sha>]
//       产物：<canvas-dir>/backend/yingce-backend[.exe]（CGO 必须开，编译器随 runner 走）
//
// 为什么 --web / --backend 也在这个脚本里，而不是写在 workflow 的 run: 里：
// 上游的目录布局（web/ 在根下一层、Go 模块叫 yingce/backend、二进制要带 .exe）是构建
// 配方，属于插件；写进 YAML 就会和这里的 PLATFORM_MAP、manifest 版本号各自演进。上一次
// 把 `working-directory: upstream` 写成了 `upstream`，报错是 "Bun could not find a
// package.json"，跟 web 一个字都不沾。YAML 现在只负责挑 runner、装工具链、调这几个模式。
//
// 主载荷内容：yingce-backend（Go）+ web-dist/ + plugin-packages/*.yingce-plugin
// Agent 载荷内容：pi-runtime/ + node/bin/node
// 两者分开是因为 pi 解压后 242 MB / 2.5 万文件：并进主载荷会让每次升级都重下整包，
// 而 node 必须随包发 —— 宿主进程可能跑在 Electron 内置的 node 20 上，pi 需要 22.19.0+。


import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncShim } from "./sync-shim.mjs";

const require = createRequire(import.meta.url);
// adm-zip 只在真正打 zip 时才加载：--web / --backend 只是调 bun 和 go，
// 不该因为还没装 node_modules 就先死在 import 上（CI 里这两步跑在装依赖之前）。
let AdmZipCtor = null;
function admZip() {
  if (!AdmZipCtor) AdmZipCtor = require("adm-zip");
  return AdmZipCtor;
}

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
  const args = { canvasDir: "", platform: "", binary: "", check: false, clean: false, payload: false, agentRuntime: false, web: false, backend: false, commit: "", nodeBin: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--canvas-dir") args.canvasDir = argv[++i];
    else if (argv[i] === "--platform") args.platform = argv[++i];
    else if (argv[i] === "--node-bin") args.nodeBin = argv[++i];
    else if (argv[i] === "--binary") args.binary = argv[++i];
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--clean") args.clean = true;
    else if (argv[i] === "--payload") args.payload = true;
    else if (argv[i] === "--agent-runtime") args.agentRuntime = true;
    else if (argv[i] === "--web") args.web = true;
    else if (argv[i] === "--backend") args.backend = true;
    else if (argv[i] === "--commit") args.commit = argv[++i];
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

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// 子进程输出直接接到当前 stdio：CI 日志里 go / bun 自己的报错比任何包装都清楚。
function runStep(command, argv, cwd, env = {}) {
  console.log(`[run] ${command} ${argv.join(" ")}`);
  console.log(`[run] cwd=${cwd}`);
  const result = spawnSync(command, argv, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.error) die(`无法执行 ${command}：${result.error.message}`);
  if (result.status !== 0) die(`${command} ${argv[0]} 退出码 ${result.status}`);
}

async function readVersion(canvasDir) {
  const versionFile = path.join(canvasDir, "VERSION");
  let version = "";
  try {
    version = (await readFile(versionFile, "utf8")).trim();
  } catch {
    die(`找不到 ${versionFile}：上游用这个文件给后端注入版本号，缺了就只能构建出 \"dev\"`);
  }
  if (!version) die(`${versionFile} 是空的`);
  return version;
}

// --- web：上游前端只构建一次，五个平台共用同一份 dist ---
// 目录布局的知识留在这里：上游把前端放在 <仓库>/web，锁文件是 bun.lock，packageManager 是 bun。
async function buildWeb({ canvasDir }) {
  if (!canvasDir) die("--web 需要 --canvas-dir（上游仓库根目录）");
  const webDir = path.join(canvasDir, "web");
  const pkgFile = path.join(webDir, "package.json");
  try {
    await stat(pkgFile);
  } catch {
    die(`找不到 ${pkgFile}。--web 认为前端在 <canvas-dir>/web；上游如果改了布局，改这里，不要改 YAML。`);
  }

  const pkg = JSON.parse(await readFile(pkgFile, "utf8"));
  const pm = String(pkg.packageManager || "").split("@")[0] || "npm";
  console.log(`[web] ${webDir}  包管理器=${pm}  构建命令=${pkg.scripts?.build ?? "(缺失)"}`);
  if (!pkg.scripts?.build) die(`${pkgFile} 里没有 build 脚本`);

  if (pm === "bun") runStep("bun", ["install", "--frozen-lockfile"], webDir);
  else runStep("npm", ["ci"], webDir);
  // 构建里带 tsc --noEmit，前台跑不到 --frozen-lockfile 的时候也只会在这一步就失败，不会拖到打包。
  runStep(pm, ["run", "build"], webDir);

  const distDir = path.join(webDir, "dist");
  try {
    await stat(path.join(distDir, "index.html"));
  } catch {
    die(`${distDir}/index.html 不存在：构建成功但产物不对，载荷里会缺前端入口`);
  }
  const files = await collectFiles(distDir, "web-dist");
  let bytes = 0;
  for (const file of files) bytes += (await stat(file.full)).size;
  console.log(`[web] ${distDir}  entries=${files.length}  bytes=${bytes}`);
}

// --- backend：每个平台在自己的 runner 上原生编译（CGO 必需，交叉编译已验证不可行）---
// 配方取自上游 backend/Dockerfile 的 backend-build 阶段：模块名 yingce/backend，
// 入口 ./cmd/server，版本号从仓库根的 VERSION 注入 buildinfo.Version。
async function buildBackend({ canvasDir, platform, commit }) {
  if (!canvasDir) die("--backend 需要 --canvas-dir（上游仓库根目录）");
  const config = PLATFORM_MAP[platform];
  if (!config) die(`unsupported platform ${platform}`);

  const backendDir = path.join(canvasDir, "backend");
  try {
    await stat(path.join(backendDir, "go.mod"));
  } catch {
    die(`找不到 ${backendDir}/go.mod。--backend 认为 Go 模块在 <canvas-dir>/backend。`);
  }
  const version = await readVersion(canvasDir);
  const output = path.join(backendDir, `yingce-backend${config.ext}`);

  const ldflags = [
    "-s",
    "-w",
    `-X yingce/backend/internal/buildinfo.Version=${version}`,
    commit ? `-X yingce/backend/internal/buildinfo.Commit=${commit}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // GOOS/GOARCH 显式写死：它们必须等于 runner 自己，写错的话 CGO 会当场报链接失败，
  // 而不是默默产出一个同架构之外跑不起来的二进制。
  runStep("go", ["build", "-trimpath", "-ldflags", ldflags, "-o", output, "./cmd/server"], backendDir, {
    CGO_ENABLED: "1",
    GOOS: config.goos,
    GOARCH: config.goarch,
  });

  const { size } = await stat(output);
  console.log(`[backend] ${output}  bytes=${size}  version=${version}  goos=${config.goos}  goarch=${config.goarch}`);
}

function zipFrom(files) {
  const zip = new (admZip())();
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

async function buildShim({ check }) {
  // 单一实现：sync-shim 负责「镜像到 public/assets + 五平台摘要」，这里只调用它，
  // 免得两处各算一遍 sha256 然后互相不一致。
  const { sha256: digest } = syncShim({ check });
  if (!check) console.log(`[shim] 五平台摘要已按 ${digest} 同步（plugin.json + public/assets/boot.mjs）`);
}

// --- payload：上传到 Release 的重型载荷 ---
async function buildPayload({ canvasDir, platform, binary }) {
  if (!canvasDir) {
    console.error("Error: --canvas-dir is required for --payload");
    process.exit(1);
  }
  const config = PLATFORM_MAP[platform];
  if (!config) {
    console.error(`Error: unsupported platform ${platform}`);
    process.exit(1);
  }

  // 载荷版本与插件版本解耦（ADR-0005 决策 5）：文件名跟 PAYLOAD_VERSION 走，
  // 不跟 plugin.json 走。否则插件每升一个小版本，同样的载荷就要换个名字重传一遍，
  // 用户的 300 MB 也就白下了。
  const manifest = await readManifest();
  const version = process.env.PAYLOAD_VERSION?.trim() || manifest.version;
  console.log(`[payload] payloadVersion=${version}${process.env.PAYLOAD_VERSION ? " (PAYLOAD_VERSION)" : " (plugin.json 兜底)"}`);
  const binaryName = `yingce-backend${config.ext}`;
  // 交叉编译时产物不在 backend/ 下（不能污染上游仓库），用 --binary 指过来。
  const binaryPath = binary || path.join(canvasDir, "backend", binaryName);
  const pluginPackagesDir = path.join(canvasDir, "plugin-packages");
  // web 只在上游 web/ 构一次（CI 里由 web job 产出并下发），这里只负责收进载荷。
  const webDistDir = path.join(canvasDir, "web", "dist");

  // 缺什么就说什么：这两个文件分别在 --backend 与 --web 里生成，报 ENOENT 而不说去哪拿，
  // 排查时只能去翻 workflow。
  try {
    await stat(binaryPath);
  } catch {
    die(`找不到 ${binaryPath}：先跑 --backend --platform ${platform}`);
  }
  try {
    await stat(webDistDir);
  } catch {
    die(`找不到 ${webDistDir}：先跑 --web（五个平台共用这一份 dist）`);
  }

  console.log(`[payload] 收集 ${platform} 载荷：${binaryName} + web/dist + plugin-packages`);
  const files = [{ rel: binaryName, full: binaryPath, buffer: await readFile(binaryPath) }];
  files.push(...(await collectFiles(webDistDir, "web-dist")));
  let paymentPackages = 0;
  for (const entry of await readdir(pluginPackagesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yingce-plugin")) continue;
    const full = path.join(pluginPackagesDir, entry.name);
    paymentPackages += 1;
    files.push({ rel: `plugin-packages/${entry.name}`, full, buffer: await readFile(full) });
  }
  // 零个支付插件包时，上游的 build-packages.sh 没能跑成功：载荷看着正常，后台却拿不到
  // 任何支付通道。宁可在这里失败。
  if (!paymentPackages) {
    die(`${pluginPackagesDir} 里没有任何 .yingce-plugin：先跑 sh ./plugin-packages/build-packages.sh --payments-only`);
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
  console.log(`[payload] 把上面的 sha256 写进 payload-manifest.json 的 platforms["${platform}"].payload`);

}
// --- agent payload：创作 Agent（pi）+ 它要用的 node ---
// 上游把 pi 打成 pi-runtime.tar.gz 交给 Go 后端自行解包；这里换成解压后的目录树，
// 因为 boot.mjs 只有 node:zlib，没有 tar 解析器，写一个不如不发压缩包。
const AGENT_PAYLOAD_VERSION = "0.0.1";
const NODE_MIN_MAJOR = 22;
const NODE_MIN_MINOR = 19;

// node 不随上游仓库走，得单独挑一个：宿主的 ~/.astravia/runtimes/node/<ver>/bin/node
// 就是官方分发包，版本对得上 pi 的 engines（>=22.19.0）。
async function pickNodeBin(explicit) {
  if (explicit) return explicit;
  const runtimes = path.join(os.homedir(), ".astravia", "runtimes", "node");
  let names = [];
  try {
    names = await readdir(runtimes);
  } catch {
    return "";
  }
  const versions = names
    .filter((name) => /^v?\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const pa = a.replace(/^v/, "").split(".").map(Number);
      const pb = b.replace(/^v/, "").split(".").map(Number);
      for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pb[i] - pa[i];
      return 0;
    });
  for (const name of versions) {
    const [major, minor] = name.replace(/^v/, "").split(".").map(Number);
    if (major < NODE_MIN_MAJOR || (major === NODE_MIN_MAJOR && minor < NODE_MIN_MINOR)) continue;
    const candidate = path.join(runtimes, name, "bin", process.platform === "win32" ? "node.exe" : "node");
    try {
      await stat(candidate);
      return candidate;
    } catch {
      /* 继续找下一个 */
    }
  }
  return "";
}

async function buildAgentPayload({ canvasDir, platform, nodeBin }) {
  if (!canvasDir) {
    console.error("Error: --canvas-dir is required for --agent-runtime");
    process.exit(1);
  }
  const config = PLATFORM_MAP[platform];
  if (!config) {
    console.error(`Error: unsupported platform ${platform}`);
    process.exit(1);
  }

  const piDir = path.join(canvasDir, "backend", "agent-runtime", "pi");
  await stat(path.join(piDir, "agent-runtime.mjs"));

  const chosenNode = await pickNodeBin(nodeBin);
  if (!chosenNode) {
    console.error(
      `Error: 找不到 node ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}+ ：用 --node-bin 指定，或先让 Astravia 下载官方 node 运行时`,
    );
    process.exit(1);
  }

  console.log(`[agent] 收集 pi 运行时（${piDir}）与 node（${chosenNode}）`);
  const files = await collectFiles(piDir, "pi-runtime");
  // 文件名跟目标平台走，不能跟构建机走：在 Apple Silicon 上打 win32 包时
  // process.platform 仍是 darwin，照它命名会把 node 写成 bin/node，Windows 上找不到 node.exe。
  files.push({ rel: `node/bin/${config.ext === ".exe" ? "node.exe" : "node"}`, full: chosenNode });
  for (const file of files) {
    if (!file.buffer) file.buffer = await readFile(file.full);
    delete file.full;
  }

  await mkdir(payloadOutputDir, { recursive: true });
  const outputFile = path.join(payloadOutputDir, `agent-runtime-${AGENT_PAYLOAD_VERSION}-${platform}.zip`);
  const buffer = zipFrom(files);
  await writeFile(outputFile, buffer);

  console.log(
    `[agent] ${path.relative(pluginRoot, outputFile)}  entries=${files.length}  bytes=${buffer.length}  sha256=${sha256(buffer)}`,
  );
  console.log(`[agent] 把上面的 sha256 写进 payload-manifest.json 的 platforms["${platform}"].agent`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform || currentPlatform();
  const mode = args.payload ? "payload" : args.agentRuntime ? "agent" : args.web ? "web" : args.backend ? "backend" : "shim";
  console.log(`[${mode}] platform=${platform}`);
  if (mode === "shim" && args.clean) await cleanLegacyShims();
  if (mode === "payload")
    await buildPayload({ canvasDir: args.canvasDir, platform, binary: args.binary });
  else if (mode === "agent") await buildAgentPayload({ canvasDir: args.canvasDir, platform, nodeBin: args.nodeBin });
  else if (mode === "web") await buildWeb({ canvasDir: args.canvasDir });
  else if (mode === "backend") await buildBackend({ canvasDir: args.canvasDir, platform, commit: args.commit });
  else await buildShim({ check: args.check });
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
