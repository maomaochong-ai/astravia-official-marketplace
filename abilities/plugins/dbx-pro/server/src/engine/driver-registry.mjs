/**
 * driver-registry.mjs — 从 dbx agents 清单解析驱动产物的真实下载地址。
 *
 * 背景（这就是驱动「安装」点了没反应的原因）：
 *   dbx 曾经把驱动二进制直接挂在 `agents-latest` tag 下，文件名形如
 *   `dbx-agent-duckdb-macos-x64`。现在 `agents-latest` 只有一个资产
 *   `agent-registry.json`，真正的产物被拆到**版本化 tag**（如 `agents-v0.2.134`）
 *   下、以 `.tar.zst` 归档分发，并附带 sha256 与体积。
 *   继续按老命名拼 URL 只会拿到 HTTP 404 —— 而 404 又只写进状态文件、不到 UI，
 *   所以用户看到的就是「点了安装，什么都没发生」。
 *
 * 这里只做一件事：清单 → { url, sha256, size, format, version }。
 */

import { FORMAT_RAW, FORMAT_TAR_ZSTD } from "./driver-archive.mjs";
import { engineError } from "./protocol.mjs";

export const AGENTS_REGISTRY_URL =
  "https://github.com/t8y2/dbx/releases/download/agents-latest/agent-registry.json";

/** 清单地址可被环境变量接管（内网镜像 / 联调指向本地清单），默认走官方 Release。 */
export const DRIVERS_REGISTRY_URL_ENV = "DBX_DRIVERS_REGISTRY_URL";

/** 当前生效的清单地址（环境变量覆盖时以覆盖为准）。 */
function defaultRegistryUrl() {
  return process.env[DRIVERS_REGISTRY_URL_ENV]?.trim() || AGENTS_REGISTRY_URL;
}

/** 对外只宣传**实际会用**的地址：配了镜像却显示官方 URL 会把人带偏。 */
export function registryUrl() {
  return defaultRegistryUrl();
}

/** 允许的产物来源。与 plugin.json 的 network.allowedHosts 一致：清单是可信输入，但下载地址是网络数据，不能让上游把请求引到任意主机。 */
const ALLOWED_ARTIFACT_HOSTS = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);

const REGISTRY_TIMEOUT_MS = 20_000;
const REGISTRY_CACHE_MS = 10 * 60 * 1000;

let registryCache = null;

/** 测试用：清掉清单缓存。 */
export function resetAgentRegistryCache() {
  registryCache = null;
}

/** 产物形态：`.tar.zst` 归档，还是裸的可执行文件。 */
export function artifactFormatOf(url) {
  return /\.(tar\.zst|tar\.zstd|tzst)(\?.*)?$/i.test(String(url ?? "")) ? FORMAT_TAR_ZSTD : FORMAT_RAW;
}

export function assertAllowedArtifactUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw engineError("DRIVER_REGISTRY_INVALID", `清单里的产物地址不是合法 URL：${url}`);
  }
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "[::1]";
  if (parsed.protocol === "http:" && loopback) return parsed; // 本机联调/测试
  if (parsed.protocol !== "https:" || !ALLOWED_ARTIFACT_HOSTS.has(parsed.hostname)) {
    throw engineError(
      "DRIVER_REGISTRY_INVALID",
      `清单里的产物地址不在允许范围内：${url}（只接受 ${[...ALLOWED_ARTIFACT_HOSTS].join(" / ")} 的 https 地址）`,
    );
  }
  return parsed;
}

/** 拉取并解析 agents 清单（内存缓存，进程内复用；清单本身只有几十 KB）。 */
export async function fetchAgentRegistry({
  fetchImpl = globalThis.fetch,
  registryUrl = defaultRegistryUrl(),
  timeoutMs = REGISTRY_TIMEOUT_MS,
  cacheMs = REGISTRY_CACHE_MS,
} = {}) {
  if (registryCache && registryCache.url === registryUrl && Date.now() - registryCache.at < cacheMs) return registryCache.value;

  let response;
  try {
    response = await fetchImpl(registryUrl, {
      redirect: "follow",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    throw engineError(
      "DRIVER_REGISTRY_UNAVAILABLE",
      `无法获取驱动清单（${registryUrl}）：${error?.message ?? error}${code ? `（${code}）` : ""}`,
    );
  }
  if (!response.ok) {
    throw engineError("DRIVER_REGISTRY_UNAVAILABLE", `无法获取驱动清单（${registryUrl}）：HTTP ${response.status} ${response.statusText ?? ""}`.trim());
  }

  let value;
  try {
    value = await response.json();
  } catch (error) {
    throw engineError("DRIVER_REGISTRY_INVALID", `驱动清单不是合法 JSON：${error.message}`);
  }
  registryCache = { at: Date.now(), url: registryUrl, value };
  return value;
}

/** 清单 → 指定平台的原生产物条目。 */
export function pickNativeArtifact(registry, { driverKey, platformTag }) {
  const driver = registry?.drivers?.[driverKey];
  if (!driver) {
    const known = Object.keys(registry?.drivers ?? {}).join(", ") || "（空）";
    throw engineError("DRIVER_UNSUPPORTED", `驱动清单里没有 ${driverKey}（清单里有：${known}）`);
  }
  const native = driver.native?.[platformTag];
  if (!native) {
    const known = Object.keys(driver.native ?? {}).join(", ") || "（空）";
    throw engineError("DRIVER_UNSUPPORTED", `驱动清单里没有 ${driverKey} 的 ${platformTag} 产物（清单里有：${known}）`);
  }
  if (!native.url) {
    throw engineError("DRIVER_REGISTRY_INVALID", `驱动清单里 ${driverKey}/${platformTag} 缺少 url`);
  }
  if (!native.sha256) {
    throw engineError("DRIVER_REGISTRY_INVALID", `驱动清单里 ${driverKey}/${platformTag} 缺少 sha256，拒绝安装（无法校验完整性）`);
  }
  assertAllowedArtifactUrl(native.url);
  return {
    url: native.url,
    sha256: String(native.sha256).toLowerCase(),
    size: Number(native.size ?? 0) || 0,
    format: native.format ? String(native.format) : artifactFormatOf(native.url),
    version: driver.version ? String(driver.version) : undefined,
  };
}

/** 一步到位：驱动 key + 平台标签 → 可下载产物。 */
export async function resolveDriverArtifact({ driverKey, platformTag, fetchImpl, timeoutMs, registryUrl } = {}) {
  const registry = await fetchAgentRegistry({ fetchImpl, timeoutMs, registryUrl });
  return pickNativeArtifact(registry, { driverKey, platformTag });
}
