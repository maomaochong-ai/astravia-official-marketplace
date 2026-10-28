/**
 * 清单解析、镜像前缀、本地命中、候选 URL 探测
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_DIR, DATA_DIR, DEFAULT_MIRROR_PREFIXES, GITHUB_REPO, MANIFEST, MANIFEST_ASSET, PAYLOAD_BASE_URL, PLATFORM, RELEASE_TAG, TARGET_PLATFORMS, supportedPlatforms } from "./service-config.ts";
import { STATE, fail, note } from "./preparation-state.ts";
import { httpRequest, statSize } from "./http-transport.ts";
import type { Sink } from "./http-transport.ts";
import { downloadPayload } from "./payload-download.ts";

// 清单探测成功后记住这条基址，归档优先从同一条来源取。只有本模块回写。
export let PREFERRED_BASE = null;
// 落盘目录由清单里的 payloadVersion 决定，所以这两个量要等清单解析完才有值。
export let PROVISION_DIR = null;
export let AGENT_DIR = null;

export const ASSET_CACHE = new Map();

export const NETWORK_FAILURE = /超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up|TLS|停滞|连接中断/i;

export function endpointOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function readTextResponse(res: Sink, limit = 512 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(text);
    };
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      text += chunk;
      if (text.length > limit) {
        res.destroy();
        finish();
      }
    });
    res.on("end", finish);
    res.on("close", finish);
    res.on("error", reject);
    res.on("aborted", finish);
  });
}

export async function resolveAssetUrl(fileName) {
  if (ASSET_CACHE.has(fileName)) return ASSET_CACHE.get(fileName);
  let resolved = null;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`;
  try {
    const res = await httpRequest(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      timeout: 12000,
    });
    if (res.statusCode === 200) {
      const payload = JSON.parse(await readTextResponse(res));
      const asset = (payload.assets || []).find((item) => item?.name === fileName);
      if (asset?.id) {
        resolved = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`;
      } else {
        note(`Release ${RELEASE_TAG} 中没有 ${fileName}`);
      }
    } else {
      res.destroy();
      note(`解析下载地址失败：HTTP ${res.statusCode}`);
    }
  } catch (err) {
    note(`解析下载地址失败：${err.message}`);
  }
  ASSET_CACHE.set(fileName, resolved);
  return resolved;
}

// 镜像前缀：默认两个境内可公共镜像；`CANVAS_PAYLOAD_MIRRORS` 整体替换（逗号分隔，
// 写 none/off 关掉）。前缀只接在 github.com 链接前面，文件名与清单格式都不变。
export function mirrorPrefixes() {
  const raw = process.env.CANVAS_PAYLOAD_MIRRORS;
  if (raw === undefined) return DEFAULT_MIRROR_PREFIXES;
  const text = raw.trim();
  if (!text || /^(none|off|0|false)$/i.test(text)) return [];
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.endsWith("/") ? item : `${item}/`));
}

// 本地载荷目录：本地构建的归档放这里就完全不联网（ADR-0009 决策 2）。
// 顺序是「显式指定 → 数据目录 → 插件安装目录」，便于把包与载荷放在一起分发。
export function localPayloadDirs() {
  const dirs = [];
  const explicit = (process.env.CANVAS_PAYLOAD_DIR || "").trim();
  if (explicit) dirs.push(explicit);
  dirs.push(path.join(DATA_DIR, "payload"));
  dirs.push(path.join(BUNDLED_DIR, "payload"));
  return dirs;
}

export function findLocalFile(fileName) {
  for (const dir of localPayloadDirs()) {
    const file = path.join(dir, fileName);
    if (statSize(file) > 0) return file;
  }
  return null;
}

// 基址候选：清单探测胜出的那条 → 镜像前缀 × 当前基址 → 当前基址。
// 镜像包的是「当前基址」而不是写死的 github.com，于是把 CANVAS_PAYLOAD_BASE_URL 指到
// 自建目录（或测试里的本地 http 服务）时，镜像行为可以完整验证而不依赖外网。
// 同时：显式基址一旦给定，就不再回落到 api.github.com（见 apiFallbackAllowed）。
export function payloadBases(preferred) {
  const bases = [];
  const push = (base) => {
    const clean = String(base || "").replace(/\/+$/, "");
    if (clean && !bases.includes(clean)) bases.push(clean);
  };
  push(preferred);
  for (const prefix of mirrorPrefixes()) push(`${prefix}${PAYLOAD_BASE_URL}`);
  push(PAYLOAD_BASE_URL);
  return bases;
}

// 显式基址意味着「只用我指定的来源」：不再去碰 GitHub 的 API，否则离线/内网部署会
// 因为一次隐形的 api.github.com 请求而变慢或直接失败。
export function apiFallbackAllowed() {
  return !process.env.CANVAS_PAYLOAD_BASE_URL;
}

// 并发探测：谁先回 200 用谁。逐个串行试在弱网里等于「来源数 × 超时」，用户只能干等进度条。
export function probeFirst(
  urls: string[],
  { timeout = 12000 }: { timeout?: number } = {},
): Promise<{ url: string; text: string }> {
  return new Promise((resolve, reject) => {
    if (!urls.length) {
      reject(new Error("没有可用的来源"));
      return;
    }
    let pending = urls.length;
    let lastError = null;
    let settled = false;
    const fail = (url) => (err) => {
      if (settled) return;
      lastError = new Error(`${endpointOf(url)}：${err.message}`);
      pending -= 1;
      if (pending === 0) reject(lastError);
    };
    for (const url of urls) {
      httpRequest(url, { headers: { Accept: "application/vnd.github+json" }, timeout })
        .then(async (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            throw new Error(`HTTP ${res.statusCode}`);
          }
          const text = await readTextResponse(res);
          if (settled) return;
          settled = true;
          resolve({ url, text });
        })
        .catch(fail(url));
    }
  });
}

// 归档来源：清单胜出的基址在前，其次镜像、官方；API 解析放到最后一搏（见 stageArchive）。
export function candidateUrls(fileName) {
  return payloadBases(PREFERRED_BASE).map((base) => `${base}/${fileName}`);
}

export function describeFailure(err) {
  const text = err?.message || String(err);
  if (!NETWORK_FAILURE.test(text)) return err instanceof Error ? err : new Error(text);
  // 文案只说真的试过的来源：镜像被关掉时写「镜像（已关闭）」，用户会以为自己漏配了什么。
  const prefixes = mirrorPrefixes();
  const tried = prefixes.length
    ? `镜像（${prefixes.map((prefix) => endpointOf(prefix)).join("、")}）与 ${endpointOf(PAYLOAD_BASE_URL)}`
    : endpointOf(PAYLOAD_BASE_URL);
  const wrapped = new Error(
    `${text}\n` +
      `已尝试的来源都不可用：${tried}。以下任一方式可以继续：\n` +
      `  1. 点「重试」——下载支持续传，已落盘的字节不会丢；\n` +
      `  2. 把载荷文件放到 ${localPayloadDirs()[0]}（本地构建/离线搬运，放好后点「重试」）；\n` +
      `  3. 设置 CANVAS_PAYLOAD_MIRRORS 指向你自己的镜像前缀。`,
  );
  wrapped.cause = err;
  return wrapped;
}

// 载荷下载只在首次安装后发生一次：校验通过就解到 staging，由调用方决定最终落点。

// --- 发布清单（ADR-0005 决策 4）---
// 清单是载荷的唯一事实源：平台 → 文件名 → sha256。它本身不做签名校验——
// 能改我们 release 的攻击者早就能改载荷本体，签名只多一套密钥管理，不增加实质阻力。
export const SHA256_RE = /^[a-f0-9]{64}$/;
export let manifestPromise = null;

// 带 code 的错误是本服务对外契约的一部分（界面据此分流文案）。
export type CodedError = Error & { code?: string };

export function codedError(code: string, message: string): CodedError {
  const error: CodedError = new Error(message);
  error.code = code;
  return error;
}

/** 平台没有载荷时统一走这里：文案给用户，code 给界面（ADR-0004 决策 2）。 */
export function unsupportedPlatformError() {
  const published = supportedPlatforms();
  const upstream = MANIFEST.upstream?.tag ? `（对应上游 ${MANIFEST.upstream.tag}）` : "";
  return codedError(
    "platform-unsupported",
    `当前平台 ${PLATFORM} 暂无可用运行时载荷${upstream}。已发布：${published.join(", ")}。` +
      `这不是安装出错，是该平台还没构建：请在已发布平台上使用，或设置 CANVAS_PAYLOAD_MANIFEST 指向自建清单。`,
  );
}

export async function fetchManifestText() {
  // 显式清单优先（决策 3 的顺序）：本地文件路径或 http(s) 直链。自建镜像与离线自测
  // 靠它，也让「这个平台的载荷坏了」能在不发布新插件的情况下用一个清单切回去。
  const override = (process.env.CANVAS_PAYLOAD_MANIFEST || "").trim();
  if (override) {
    const local = !/^https?:\/\//i.test(override);
    try {
      const text = local ? fs.readFileSync(override, "utf8") : await readTextResponse(await httpRequest(override, { timeout: 20000 }));
      note(`清单来自 CANVAS_PAYLOAD_MANIFEST：${override}`);
      return { text, url: override };
    } catch (err) {
      const wrapped = describeFailure(err);
      (wrapped as CodedError).code = "payload-manifest-unreadable";
      wrapped.message = `CANVAS_PAYLOAD_MANIFEST 不可读（${override}）：${err.message}`;
      throw wrapped;
    }
  }
  // 本地目录里的清单次之：本地构建把清单与载荷一起放进去，就能完全不联网。
  const localManifest = findLocalFile(MANIFEST_ASSET);
  if (localManifest) {
    note(`清单来自本地目录：${localManifest}`);
    return { text: fs.readFileSync(localManifest, "utf8"), url: localManifest };
  }

  // 远程来源并发探测：镜像通常 1-3 秒就回，官方在受限网络里 12 秒也未必建得起连接。
  // 串行会让一个不可达的高优先级来源拖死全部后续尝试，这正是旧版在 Windows 上慢的原因。
  const candidates = candidateUrls(MANIFEST_ASSET);
  note(`清单来源 ${candidates.length} 个（并发探测）：${candidates.map(endpointOf).join("、")}`);
  let lastError;
  try {
    const { url, text } = await probeFirst(candidates);
    STATE.endpoint = endpointOf(url);
    PREFERRED_BASE = url.slice(0, -(MANIFEST_ASSET.length + 1));
    note(`清单来自 ${STATE.endpoint}`);
    return { text, url };
  } catch (err) {
    lastError = err;
    note(`清单探测全部失败：${err.message}`);
  }

  // 兜底：部分网络里只有 api.github.com 可达，用它把资产名换成重定向地址。
  // 显式基址下不碰 GitHub（apiFallbackAllowed）。
  const asset = apiFallbackAllowed() ? await resolveAssetUrl(MANIFEST_ASSET) : null;
  if (asset) {
    try {
      const res = await httpRequest(asset, {
        headers: { Accept: "application/vnd.github+json" },
        timeout: 20000,
      });
      if (res.statusCode !== 200) {
        res.resume();
        throw new Error(`HTTP ${res.statusCode}`);
      }
      STATE.endpoint = "api.github.com";
      note("清单来自 api.github.com 资产地址");
      return { text: await readTextResponse(res), url: asset };
    } catch (err) {
      lastError = err;
      note(`API 资产地址不可用：${err.message}`);
    }
  }
  const wrapped = describeFailure(lastError ?? new Error("没有可用的清单来源"));
  (wrapped as CodedError).code = "payload-unreachable";
  throw wrapped;
}

/** 把发布清单压成内部形态；任何一处不合规都带 code 失败，绝不猜。 */
export function parseManifest(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw codedError("payload-manifest-invalid", "发布清单不是合法 JSON");
  }
  if (data?.schemaVersion !== 1) {
    throw codedError("payload-manifest-invalid", `发布清单 schemaVersion 应为 1，实际 ${data?.schemaVersion}`);
  }
  const payloadVersion = String(data.payloadVersion ?? "");
  if (!/^[0-9A-Za-z._-]{1,32}$/.test(payloadVersion)) {
    throw codedError("payload-manifest-invalid", `发布清单 payloadVersion 非法：${payloadVersion || "（空）"}`);
  }

  const platforms = {};
  for (const [platform, entry] of Object.entries(data.platforms ?? {})) {
    if (!TARGET_PLATFORMS.includes(platform)) {
      note(`清单里的平台 ${platform} 不在申报集合内，忽略`);
      continue;
    }
    // 每类载荷都必须有 file + sha256；agent 可缺（可降级），payload 不可缺。
    const read = (kind, required) => {
      const spec = entry?.[kind];
      if (!spec) {
        if (required) throw codedError("payload-manifest-invalid", `${platform} 缺少 ${kind} 条目`);
        return null;
      }
      const file = String(spec.file ?? "");
      const sha256 = String(spec.sha256 ?? "");
      if (!file || file.includes("/") || file.includes("\\")) {
        throw codedError("payload-manifest-invalid", `${platform}.${kind}.file 必须是纯文件名：${file}`);
      }
      if (!SHA256_RE.test(sha256)) {
        throw codedError("payload-manifest-invalid", `${platform}.${kind}.sha256 不是 64 位小写十六进制`);
      }
      return { file, sha256, bytes: Number(spec.bytes) || 0 };
    };
    platforms[platform] = { payload: read("payload", true), agent: read("agent", false) };
  }

  return { payloadVersion, upstream: data.upstream ?? null, platforms, source: MANIFEST.source };
}

/**
 * 把一份解析好的清单设为生效清单，并按它重算两个落盘目录。
 *
 * 全仓库只有本模块写这三个量：探测（peekManifest）不改任何全局状态，
 * 只有真要把新版本装上时才 applyManifest，否则「检查更新」会连带改掉当前运行的版本。
 */
export function applyManifest(parsed, source) {
  MANIFEST.payloadVersion = parsed.payloadVersion;
  MANIFEST.upstream = parsed.upstream ?? null;
  MANIFEST.platforms = parsed.platforms;
  MANIFEST.source = source;
  PROVISION_DIR = path.join(DATA_DIR, "runtime", parsed.payloadVersion);
  AGENT_DIR = path.join(DATA_DIR, "runtime", `agent-${parsed.payloadVersion}`);
  return MANIFEST;
}

/** 取一份清单并解析，但不让它生效。检查更新用：失败就是失败，当前运行的版本不受影响。 */
export async function peekManifest() {
  const { text, url } = await fetchManifestText();
  const parsed = parseManifest(text);
  return { ...parsed, source: endpointOf(url) };
}

export async function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    const parsed = await peekManifest();
    applyManifest(parsed, parsed.source);
    const upstream = MANIFEST.upstream?.tag ? `，上游 ${MANIFEST.upstream.tag}` : "";
    note(`发布清单 ${MANIFEST.payloadVersion}${upstream}，平台 ${Object.keys(MANIFEST.platforms).join(", ")}`);
    return MANIFEST;
  })();
  // 失败不缓存：用户点「重试」时要能重新取。
  try {
    return await manifestPromise;
  } catch (err) {
    manifestPromise = null;
    throw err;
  }
}

// 逐个候选来源下载，每个给两次机会（弱网下第一次常断在 TLS 或半途）。返回最后一次错误。
export async function downloadFromCandidates(candidates, archive) {
  let lastError;
  for (const [index, candidate] of candidates.entries()) {
    STATE.endpoint = endpointOf(candidate);
    note(`下载来源 ${index + 1}/${candidates.length}：${STATE.endpoint}`);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await downloadPayload(candidate, archive);
        return undefined;
      } catch (err) {
        lastError = err;
        STATE.retries += 1;
        note(`下载中断（${err.message}），第 ${attempt}/2 次`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return lastError ?? new Error("没有可用的下载来源");
}

// 两个载荷共用这一段，区别只在 label 与文案里的体积。
