/**
 * 载荷更新：检查新版本、切换运行时、失败回滚
 *
 * 回答的是「插件开着的时候上游出了新版画布，用户能不能拿到」。
 * 现状：完整 stop→start 会重新取清单（新 payloadVersion 落在新目录），所以是对的；
 * 但 shim 进程活着时不会——prepareRuntime 在 ready 后早退，清单也被缓存。
 * 本模块补的就是这一段：显式检查 + 显式升级 + 就地重启，并且只读探测不污染运行态（ADR-0017）。
 */
import { BUNDLED_DIR, MANIFEST, PLATFORM, TARGET_PLATFORMS } from "./service-config.ts";
import { STATE, clearFailure, fail, note, setStage } from "./preparation-state.ts";
import { hasPayload } from "./http-transport.ts";
import {
  PROVISION_DIR,
  applyManifest,
  codedError,
  peekManifest,
  unsupportedPlatformError,
} from "./payload-source-resolution.ts";
import {
  provisionPayload,
  readPayloadMarker,
  resolveAgentDir,
  resolveNodeBin,
} from "./payload-installation.ts";
import { pointRuntimeAt } from "./runtime-pointing.ts";
import { restartBackend, waitForBackendPort } from "./backend-process.ts";
import { setRuntimePaths } from "./runtime-paths.ts";
import path from "node:path";

/** 升级后等新后端报端口的上限。载荷已在本地，只需进程启动，给足冷启动时间即可。 */
const UPGRADE_READY_TIMEOUT_MS = 120_000;
/** 回滚后等旧后端回来的上限：它一定能起来过，所以这里不需要同样的余量。 */
const ROLLBACK_READY_TIMEOUT_MS = 60_000;
/**
 * 升级是唯一会当场换后端进程的操作。两重防护：
 * - 同一时刻只能有一轮（双击、页面重试、两个客户端都会重发请求）；
 * - 运行时正在安装或启动时拒绝——那时 MANIFEST 与 PROVISION_DIR 正被别人改写。
 * 两者都抛带 code 的错误，由路由回 200 + ok:false 让界面自己说清楚。
 */
let upgrading = false;

function assertIdleForUpgrade() {
  if (upgrading) throw codedError("payload-upgrade-busy", "已有一轮升级在进行，等它结束再试");
  if (STATE.phase === "installing" || STATE.phase === "starting" || STATE.phase === "starting-backend") {
    throw codedError("payload-upgrade-busy", "运行时正在准备，稍后再试");
  }
}

function installedDir() {
  return PROVISION_DIR && hasPayload(PROVISION_DIR) ? PROVISION_DIR : null;
}

/**
 * 只读探测：取清单、比对版本，不改 MANIFEST / PROVISION_DIR。
 *
 * 「已经是最新」的判断必须比 payloadVersion，而不是只比目录存在——清单可以因为上游 tag
 * 前进而换版本，同一个版本号的目录也可能只是上次残留。
 */
export async function checkPayloadUpdate() {
  const bundled = hasPayload(BUNDLED_DIR);
  const installed = readPayloadMarker(installedDir()) ?? readPayloadMarker(BUNDLED_DIR);
  const base = {
    bundled,
    platform: PLATFORM,
    current: MANIFEST.payloadVersion || "",
    installed,
    checkedAt: Date.now(),
  };

  if (bundled) {
    return {
      ...base,
      available: base.current,
      upstream: { current: MANIFEST.upstream?.tag ?? null, available: MANIFEST.upstream?.tag ?? null },
      upgradeAvailable: false,
      note: "运行时随插件发布，更新插件即更新画布",
    };
  }
  if (!TARGET_PLATFORMS.includes(PLATFORM)) throw unsupportedPlatformError();

  const peeked = await peekManifest();
  const spec = peeked.platforms[PLATFORM]?.payload;
  const available = spec ? peeked.payloadVersion : "";
  const running = installedDir();
  return {
    ...base,
    available,
    upstream: { current: MANIFEST.upstream?.tag ?? null, available: peeked.upstream?.tag ?? null },
    // 版本号不同要升；版本号相同但目录不在（上次没装成）也要升，否则会一直停在「可更新」之外。
    upgradeAvailable: Boolean(available) && (available !== base.current || !running),
    note: spec ? undefined : `发布清单里没有 ${PLATFORM} 的载荷`,
  };
}

/**
 * 下载并切到清单里的版本，再就地重启后端。
 *
 * 顺序不能反：先落盘并校验通过，才改 MANIFEST；先改路径、重启成功，才算升级完成。
 * 任何一步失败都退回旧版本目录重起一次——旧目录全程没被碰过，这是回滚能成立的前提。
 */
async function runUpgradePayload() {
  if (hasPayload(BUNDLED_DIR)) {
    throw codedError("payload-bundled", "运行时随插件发布，请更新插件后再试");
  }
  if (!TARGET_PLATFORMS.includes(PLATFORM)) throw unsupportedPlatformError();

  const peeked = await peekManifest();
  const spec = peeked.platforms[PLATFORM]?.payload;
  if (!spec) throw unsupportedPlatformError();

  const previous = {
    payloadVersion: MANIFEST.payloadVersion,
    upstream: MANIFEST.upstream ?? null,
    platforms: MANIFEST.platforms,
    source: MANIFEST.source,
    dir: installedDir(),
  };
  if (peeked.payloadVersion === previous.payloadVersion && previous.dir) {
    return { upgraded: false, payloadVersion: previous.payloadVersion, note: "当前已是最新版本" };
  }

  clearFailure();
  setStage("downloading", "更新运行时", `发现新运行时 ${peeked.payloadVersion}，正在准备`);
  note(`检查到新运行时 ${peeked.payloadVersion}（当前 ${previous.payloadVersion || "未安装"}）`);
  applyManifest(peeked, peeked.source);

  let restarted = false;
  try {
    if (!hasPayload(PROVISION_DIR)) await provisionPayload(spec);
    pointRuntimeAt(PROVISION_DIR);

    // 创作 Agent 是独立载荷，可降级：拉不到就沿用旧的 pi 运行时，不让整次升级失败。
    const agentDir = await resolveAgentDir();
    if (agentDir) {
      setRuntimePaths({ piRuntime: path.join(agentDir, "pi-runtime"), nodeBin: resolveNodeBin(agentDir) });
    }

    restarted = true;
    await restartBackend();
    if (!(await waitForBackendPort(UPGRADE_READY_TIMEOUT_MS))) {
      throw codedError("payload-upgrade-timeout", `新运行时后端未在 ${UPGRADE_READY_TIMEOUT_MS / 1000} 秒内就绪`);
    }
    note(`运行时已切换到 ${peeked.payloadVersion}${peeked.upstream?.tag ? `（上游 ${peeked.upstream.tag}）` : ""}`);
    return {
      upgraded: true,
      from: previous.payloadVersion,
      to: peeked.payloadVersion,
      upstream: peeked.upstream?.tag ?? null,
      payloadVersion: peeked.payloadVersion,
    };
  } catch (error) {
    const code = error?.code ?? "payload-upgrade-failed";
    const detail = error?.message ?? String(error);
    note(`运行时升级失败：${detail}`);

    if (!previous.payloadVersion) {
      // 从来没装成过，没有可回滚的版本；把真实原因留给界面。
      fail(code, detail, "运行时升级");
      throw error;
    }
    applyManifest(
      { payloadVersion: previous.payloadVersion, upstream: previous.upstream, platforms: previous.platforms },
      previous.source,
    );
    if (!previous.dir) {
      fail(code, detail, "运行时升级");
      throw error;
    }
    // 后端已经动过了：指回旧目录再起一次，成功就算回滚完成。
    pointRuntimeAt(previous.dir);
    let rolledBack = false;
    if (restarted) {
      try {
        await restartBackend();
        rolledBack = await waitForBackendPort(ROLLBACK_READY_TIMEOUT_MS);
      } catch (rollbackError) {
        note(`回滚重启失败：${rollbackError?.message ?? String(rollbackError)}`);
      }
    }
    if (!rolledBack) fail(code, detail, "运行时升级");
    return {
      upgraded: false,
      rolledBack,
      code,
      error: detail,
      payloadVersion: previous.payloadVersion,
    };
  }
}
/** 带并发与时机守卫的入口（理由见 assertIdleForUpgrade）。 */
export async function upgradePayload() {
  assertIdleForUpgrade();
  upgrading = true;
  try {
    return await runUpgradePayload();
  } finally {
    upgrading = false;
  }
}
