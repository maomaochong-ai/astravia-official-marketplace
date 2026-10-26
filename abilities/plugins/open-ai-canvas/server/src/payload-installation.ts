/**
 * 暂存、校验、解包、上游运行时与 agent 运行时落位
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import fs from "node:fs";
import path from "node:path";
import { BINARY_NAME, BUNDLED_DIR, MANIFEST, NODE_BINARY_NAME, PLATFORM, TARGET_PLATFORMS } from "./service-config.ts";
import { STATE, note, resetTransfer, setStage } from "./preparation-state.ts";
import { DOWNLOAD_CHUNKS, hasPayload, partPath, statSize } from "./http-transport.ts";
import { AGENT_DIR, PROVISION_DIR, SHA256_RE, apiFallbackAllowed, candidateUrls, codedError, describeFailure, downloadFromCandidates, findLocalFile, loadManifest, resolveAssetUrl, unsupportedPlatformError } from "./payload-source-resolution.ts";
import type { CodedError } from "./payload-source-resolution.ts";
import { extractZip, hashFile } from "./payload-archive.ts";

export async function stageArchive(spec, staging, label, approximateMB) {
  const archive = `${staging}.zip`;
  fs.mkdirSync(path.dirname(staging), { recursive: true });
  resetTransfer(spec.file, approximateMB * 1024 * 1024);
  STATE.error = null;
  STATE.retries = 0;

  // 本地归档最优先：本地构建或离线搬进来的 zip 直接校验，全程零网络（ADR-0009 决策 2）。
  const local = findLocalFile(spec.file);
  let localReady = false;
  if (local) {
    setStage("verifying", `使用本地${label}`, `正在校验本地${label}完整性`);
    note(`发现本地${label}：${local}`);
    fs.copyFileSync(local, archive);
    STATE.receivedBytes = statSize(archive);
    STATE.totalBytes = STATE.receivedBytes;
    if ((await hashFile(archive)) === spec.sha256) {
      // 校验通过不等于可用：解包、检查可执行文件都还在后面，所以这里只跳过下载。
      note(`本地${label}校验通过，不再联网`);
      localReady = true;
    } else {
      fs.rmSync(archive, { force: true });
      note(`本地${label} sha256 不匹配，改为从远程来源下载`);
    }
  }

  const startedAt = Date.now();
  if (!localReady) {
    const candidates = candidateUrls(spec.file);
    setStage("downloading", `下载${label}`, `首次启动，正在下载${label}（约 ${approximateMB} MB）`);
    note(`候选下载来源 ${candidates.length} 个`);

    // 弱网下整段下载也可能中断：重试时不清归档，已落盘的字节与 .partN 分片会接着用。
    let lastError = await downloadFromCandidates(candidates, archive);
    // API 资产地址放到最后一搏：它要多一次请求，只有直连与镜像全挂时才值得付。
    if (lastError && apiFallbackAllowed()) {
      const asset = await resolveAssetUrl(spec.file);
      if (asset) lastError = await downloadFromCandidates([asset], archive);
    }

    if (lastError) {
      const wrapped = describeFailure(lastError);
      // 所有候选源都失败：网络/镜像问题，与机器平台无关。
      (wrapped as CodedError).code = "payload-unreachable";
      throw wrapped;
    }
  }

  setStage("verifying", "校验完整性", `正在校验${label}完整性`);
  const digest = await hashFile(archive);
  if (digest !== spec.sha256) {
    // 只有"文件确实坏了"才值得丢掉续传基线。
    fs.rmSync(archive, { force: true });
    for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) fs.rmSync(partPath(archive, index), { force: true });
    const mismatch = new Error(`${label} sha256 不匹配：期望 ${spec.sha256}，实际 ${digest}`);
    (mismatch as CodedError).code = "payload-checksum-mismatch";
    throw mismatch;
  }

  const megabytes = (fs.statSync(archive).size / 1048576).toFixed(1);
  note(`下载完成（${megabytes} MB，用时 ${Math.round((Date.now() - startedAt) / 1000)}s），开始解包`);

  setStage("extracting", `解包${label}`, `正在解包${label}（${megabytes} MB）`);
  const extractStartedAt = Date.now();
  fs.rmSync(staging, { recursive: true, force: true });
  try {
    await extractZip(archive, staging);
  } catch (err) {
    err.code = "payload-extract-failed";
    throw err;
  }
  fs.rmSync(archive, { force: true });
  note(`${label}已解包到 ${staging}（${Math.round((Date.now() - extractStartedAt) / 1000)}s）`);
}

// 体积用清单里的 bytes 提示进度条；缺失时按 200 MB 估，只影响“剩余时间”的展示。
export function megabytesOf(spec, fallback) {
  return spec.bytes > 0 ? Math.round(spec.bytes / (1024 * 1024)) : fallback;
}

export async function provisionPayload(spec) {
  const staging = `${PROVISION_DIR}.partial`;
  await stageArchive(spec, staging, "运行时载荷", megabytesOf(spec, 200));
  const binary = path.join(staging, BINARY_NAME);
  if (!fs.existsSync(binary)) {
    throw codedError("payload-extract-failed", `载荷里没有后端可执行文件 ${BINARY_NAME}`);
  }
  fs.chmodSync(binary, 0o755);
  fs.rmSync(PROVISION_DIR, { recursive: true, force: true });
  fs.renameSync(staging, PROVISION_DIR);
  note(`运行时已就绪：${PROVISION_DIR}`);
}

export function hasAgentRuntime(dir) {
  return fs.existsSync(path.join(dir, "pi-runtime", "agent-runtime.mjs"));
}

// 创作 Agent 是可降级的：它缺席只会让 Agent 任务起不来，不该拦住整个画布，
// 所以准备失败在 resolveAgentDir 里就地吞掉，不往上抛。
export async function provisionAgentRuntime(spec) {
  const staging = `${AGENT_DIR}.partial`;
  await stageArchive(spec, staging, "创作 Agent 运行时", megabytesOf(spec, 80));
  const nodeBin = path.join(staging, "node", "bin", NODE_BINARY_NAME);
  if (fs.existsSync(nodeBin)) fs.chmodSync(nodeBin, 0o755);
  fs.rmSync(AGENT_DIR, { recursive: true, force: true });
  fs.renameSync(staging, AGENT_DIR);
  note(`创作 Agent 运行时已就绪：${AGENT_DIR}`);
}

export async function resolveAgentDir() {
  if (AGENT_DIR && hasAgentRuntime(AGENT_DIR)) {
    note(`复用已就绪的创作 Agent 运行时 ${AGENT_DIR}`);
    return AGENT_DIR;
  }
  // 包自带运行时（BUNDLED_DIR）时不经过 resolveRuntimeDir，清单还没取；Agent 载荷在清单里，补取一次。
  // 取不到就降级：创作 Agent 缺席不该拦住画布。
  if (Object.keys(MANIFEST.platforms).length === 0) {
    try {
      await loadManifest();
    } catch (err) {
      note(`发布清单不可用，创作 Agent 功能不可用：${err.message}`);
      return null;
    }
  }
  const spec = MANIFEST.platforms[PLATFORM]?.agent;
  if (!spec || !SHA256_RE.test(spec.sha256)) {
    note(`当前平台 ${PLATFORM} 暂无创作 Agent 载荷，Agent 功能不可用`);
    return null;
  }
  try {
    await provisionAgentRuntime(spec);
    return AGENT_DIR;
  } catch (err) {
    note(`创作 Agent 运行时准备失败（Agent 功能将不可用）：${err.message}`);
    return null;
  }
}

// pi 用到了 node 22 才有的 node:fs globSync，而宿主可能用 Electron 内置的 20.x 启动本进程，
// 那个 node 跑 pi 会直接 SyntaxError。所以优先用载荷自带的 node，其次才看宿主进程。
export function resolveNodeBin(agentDir) {
  const bundled = path.join(agentDir, "node", "bin", NODE_BINARY_NAME);
  if (fs.existsSync(bundled)) return bundled;
  const version = process.versions.node ?? "0.0.0";
  const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  if (major > 22 || (major === 22 && minor >= 19)) return process.execPath;
  note(`宿主 node ${version} 低于 pi 要求的 22.19.0，载荷又未提供 node；Agent 任务可能起不来`);
  return "";
}

export async function resolveRuntimeDir() {
  if (hasPayload(BUNDLED_DIR)) {
    note("使用包内自带运行时");
    return BUNDLED_DIR;
  }
  // 平台门禁先离线判一次：未申报的平台不该跑一趟网络请求才失败（ADR-0004 决策 2）。
  if (!TARGET_PLATFORMS.includes(PLATFORM)) throw unsupportedPlatformError();

  await loadManifest();
  const spec = MANIFEST.platforms[PLATFORM]?.payload;
  if (!spec) throw unsupportedPlatformError();
  if (hasPayload(PROVISION_DIR)) {
    note(`复用已就绪的运行时 ${PROVISION_DIR}`);
    return PROVISION_DIR;
  }
  await provisionPayload(spec);
  return PROVISION_DIR;
}
