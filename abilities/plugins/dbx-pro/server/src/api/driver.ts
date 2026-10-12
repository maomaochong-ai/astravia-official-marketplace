/**
 * driver.mjs — 托管驱动（DuckDB Native Driver）的安装/状态路由。
 *
 * 路由（无 /api 前缀，由 request-router 统一聚合）：
 *   POST /driver/status           列出所有托管驱动的安装状态（前端轮询入口）
 *   POST /driver/install          下载安装指定驱动（异步，前端轮询 /driver/status 看进度）
 *   GET  /driver/install-status   查询单驱动安装状态（轮询专用，需要 ?driverKey=）
 *   POST /driver/set-path         手动指定驱动路径（复制到标准驱动目录）
 *   POST /driver/reset-status     清除安装状态
 *
 * DuckDB 驱动背景：
 *   dbx-mcp 执行 API 数据源查询时需要 `duckdb_worker`（dbx 从 agents release CI 产出的
 *   Rust binary）。上游现在的分发方式是：`agents-latest` 只放一份 agent-registry.json，
 *   真正的产物在**版本化 tag** 下以 `.tar.zst` 归档提供（附 sha256/size）。
 *   产物地址解析见 driver-registry.mjs —— 不要再按文件名拼 URL，那是 404 的来源。
 *
 * 驱动落盘位置：<引擎 dataDir>/drivers/<key>/<platform>/<binary>
 *   必须与 engine/dbx-mcp-client.mjs 的 collectDriverEnv() 扫描路径**逐字一致**。
 *   dataDir 是宿主传给引擎的 --data（生产上是 …/plugin-services/dbx-pro/dbx-engine/data），
 *   不是 homedir() —— 按 homedir() 装出来的驱动，dbx-mcp 永远扫不到。
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { extractDriverPayload, FORMAT_TAR_ZSTD } from "../engine/driver-archive.ts";
import { downloadToFile } from "../engine/driver-download.ts";
import { artifactFormatOf, registryUrl, resolveDriverArtifact } from "../engine/driver-registry.ts";
import { engineError } from "../engine/protocol.ts";

/** 测试/高级用法：直接指定驱动根目录（默认由 ctx.dataDir 推导）。 */
export const DRIVER_ROOT_ENV = "DBX_DRIVERS_ROOT";

/** 安装进度超过这个时长没有任何更新 → 视为中断，允许重试（避免永久卡在「安装中」）。 */
export const STALE_INSTALL_MS = 15 * 60 * 1000;
/** 进度落盘节流。 */
const STATUS_PERSIST_INTERVAL_MS = 500;

// ─── 平台映射（与 dbx-mcp-client.detectPlatform 保持一致：都以运行引擎的 node 进程为准） ───

export function platformKey() {
  const { platform, arch } = process;
  if (platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (platform === "win32") return arch === "arm64" ? "win32-arm64" : "win32-x64";
  if (platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux-x64";
  return "unknown";
}

export function releasePlatformTag() {
  const { platform, arch } = process;
  if (platform === "darwin") return arch === "arm64" ? "macos-aarch64" : "macos-x64";
  if (platform === "win32") return arch === "arm64" ? "windows-aarch64" : "windows-x64";
  if (platform === "linux") return arch === "arm64" ? "linux-aarch64" : "linux-x64";
  return null;
}

// ─── 驱动清单 ───

const DRIVERS = [
  {
    key: "duckdb",
    label: "DuckDB Native Driver（API 数据源本机查询通道）",
    description: "dbx API 数据源的本地 SQL 执行引擎。执行 SELECT 等查询时由 dbx-mcp spawn 为 sidecar 进程。",
    envVar: "DBX_DUCKDB_DRIVER_PATH",
    // 文件名必须与 dbx-mcp-client.DRIVER_MAP 里的 binary 完全一致（win32 带 .exe）。
    binaryName: process.platform === "win32" ? "duckdb_worker.exe" : "duckdb_worker",
  },
];

function findDriver(key) {
  return DRIVERS.find((driver) => driver.key === key);
}

/** 驱动根目录：优先 DBX_DRIVERS_ROOT（测试），否则 <dataDir>/drivers。 */
export function driversRoot(ctx) {
  const override = process.env[DRIVER_ROOT_ENV];
  if (override) return override;
  const dataDir = ctx?.dataDir ?? join(homedir(), ".astravia-dbx-data");
  return join(dataDir, "drivers");
}

export function driverTargetDir(ctx, driverKey) {
  return join(driversRoot(ctx), driverKey, platformKey());
}

export function driverBinaryPath(ctx, driverKey) {
  const driver = findDriver(driverKey);
  if (!driver) throw engineError("BAD_REQUEST", `未知驱动: ${driverKey}`);
  return join(driverTargetDir(ctx, driverKey), driver.binaryName);
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// ─── 进度状态 ───
// 安装是异步的，进度必须落盘：插件热重载/宿主机重启后前端再来看，
// 得看到「上次装到哪了 / 上次为什么失败」，而不是又回到什么都不说的初始态。

function createStatusStore(root) {
  const file = join(root, ".install-status.json");
  const map = new Map();
  try {
    if (existsSync(file)) {
      for (const [key, value] of Object.entries(JSON.parse(readFileSync(file, "utf-8")))) map.set(key, value);
    }
  } catch {
    /* 状态文件坏了不影响安装，只是丢掉历史进度 */
  }
  const persist = () => {
    try {
      ensureDir(root);
      writeFileSync(file, JSON.stringify(Object.fromEntries(map), null, 2));
    } catch {
      /* 磁盘写不进去就算了，内存状态仍然正确 */
    }
  };
  return {
    file,
    get: (key) => map.get(key) ?? { status: "idle", downloaded: 0, total: 0 },
    raw: (key) => map.get(key),
    /** 只更新内存（高频进度用）。 */
    touch: (key, value) => map.set(key, value),
    /** 更新并落盘。 */
    set: (key, value) => {
      map.set(key, value);
      persist();
    },
    remove: (key) => {
      if (key) map.delete(key);
      else map.clear();
      persist();
    },
  };
}

/**
 * 进度写入器：内存每次都更新，落盘按 500ms / 状态变化节流。
 * 落盘太频繁会把 7MB 的下载变成几千次 JSON 写；落盘太少则重启后进度失真。
 */
function createStatusWriter(store, driverKey, startedAt) {
  let lastPersistAt = 0;
  return function write(patch, { force = false } = {}) {
    const previous = store.raw(driverKey) ?? {};
    const next = { ...previous, ...patch, startedAt: previous.startedAt ?? startedAt };
    if (Number(next.total) > 0) {
      next.percent = Math.max(0, Math.min(100, Math.round((Number(next.downloaded ?? 0) / Number(next.total)) * 100)));
    }
    const now = Date.now();
    if (force || next.status !== previous.status || now - lastPersistAt >= STATUS_PERSIST_INTERVAL_MS) {
      lastPersistAt = now;
      store.set(driverKey, next);
    } else {
      store.touch(driverKey, next);
    }
    return next;
  };
}

/** 状态文件里代表「安装正在进行」的几个阶段。 */
const ACTIVE_INSTALL_STATES = new Set(["resolving", "downloading", "extracting"]);

/** 安装中且没有过期 → 不允许并发安装。 */
function isActiveInstall(status) {
  if (!ACTIVE_INSTALL_STATES.has(status.status)) return false;
  return Date.now() - Number(status.startedAt ?? 0) < STALE_INSTALL_MS;
}

/**
 * 还标着「安装中」、但已经超过 STALE_INSTALL_MS 没有进展 → 上一次安装其实死了
 * （进程被杀、宿主退出）。这种状态必须转成可见的错误，否则 UI 会永远显示「安装中」。
 */
function isStaleInstall(status) {
  return ACTIVE_INSTALL_STATES.has(status.status) && !isActiveInstall(status);
}

/**
 * 驱动装好后必须重启 dbx-mcp 子进程：
 * DBX_DUCKDB_DRIVER_PATH 只在 spawn 时由 collectDriverEnv() 注入一次，
 * 不重启的话「安装成功」要等到下次宿主重启才生效 —— 用户会认为根本没装上。
 */
async function restartBridge(ctx) {
  try {
    await ctx?.disposeDbxMcpClient?.();
    return true;
  } catch {
    return false;
  }
}

// ─── 安装 ───

async function runInstall({ ctx, store, driver, urlOverride, startedAt }) {
  const target = driverBinaryPath(ctx, driver.key);
  const dir = driverTargetDir(ctx, driver.key);
  const partPath = `${target}.part`;
  const write = createStatusWriter(store, driver.key, startedAt);

  try {
    ensureDir(dir);

    let artifact;
    if (urlOverride) {
      artifact = { url: urlOverride, sha256: null, size: 0, format: artifactFormatOf(urlOverride), version: undefined };
    } else {
      const platformTag = releasePlatformTag();
      if (!platformTag) throw engineError("DRIVER_UNSUPPORTED", `不支持的平台: ${process.platform}-${process.arch}`);
      write({ status: "resolving", downloaded: 0, total: 0, error: undefined }, { force: true });
      artifact = await resolveDriverArtifact({ driverKey: driver.key, platformTag });
    }

    write(
      {
        status: "downloading",
        downloaded: 0,
        total: artifact.size ?? 0,
        error: undefined,
        version: artifact.version,
        sourceUrl: artifact.url,
      },
      { force: true },
    );

    const { bytes } = await downloadToFile({
      url: artifact.url,
      destPath: partPath,
      expectedSha256: artifact.sha256,
      declaredTotal: artifact.size ?? 0,
      onProgress: ({ downloaded, total }) => write({ status: "downloading", downloaded, total }),
    });

    let installedBytes = bytes;
    if (artifact.format === FORMAT_TAR_ZSTD) {
      write({ status: "extracting", downloaded: bytes, total: bytes }, { force: true });
      const payload = extractDriverPayload(readFileSync(partPath));
      // 先写临时文件再改名：任何一步失败都不会留下半个可执行文件冒充已安装。
      const stagedPath = `${target}.staged-${process.pid}`;
      rmSync(stagedPath, { force: true });
      writeFileSync(stagedPath, payload.data, { mode: 0o755 });
      chmodSync(stagedPath, 0o755);
      renameSync(stagedPath, target);
      rmSync(partPath, { force: true });
      installedBytes = payload.data.length;
    } else {
      chmodSync(partPath, 0o755);
      renameSync(partPath, target);
    }

    write(
      {
        status: "done",
        downloaded: installedBytes,
        total: installedBytes,
        installedPath: target,
        finishedAt: Date.now(),
        bridgeRestarted: true,
        error: undefined,
      },
      { force: true },
    );

    if (!(await restartBridge(ctx))) {
      write({ bridgeRestarted: false }, { force: true });
    }
  } catch (error) {
    rmSync(partPath, { force: true });
    rmSync(`${target}.staged-${process.pid}`, { force: true });
    write({ status: "error", error: error?.message ?? String(error), finishedAt: Date.now() }, { force: true });
  }
}

// ─── 路由 ───

export function driverRoutes(ctx = {}) {
  const store = createStatusStore(driversRoot(ctx));
  /** 进程内单飞：磁盘状态可能被并发请求同时读到「未安装」，内存集合是最后一道闸。 */
  const inflight = new Set();

  /** /driver/status 用：把「装上了但状态还停在安装中」修正为 done。 */
  function reconcile(driver) {
    const binary = driverBinaryPath(ctx, driver.key);
    const installed = existsSync(binary);
    const status = store.get(driver.key);

    if (installed) {
      let sizeBytes;
      try {
        sizeBytes = statSync(binary).size;
      } catch {
        /* 读不到大小不影响已安装的事实 */
      }
      if (status.status !== "done" || status.downloaded !== sizeBytes) {
        store.set(driver.key, {
          ...status,
          status: "done",
          downloaded: sizeBytes ?? 0,
          total: sizeBytes ?? 0,
          percent: 100,
          installedPath: binary,
        });
      }
      inflight.delete(driver.key);
      return { binary, installed, status: store.get(driver.key), sizeBytes };
    }

    // 没装成、状态还停在安装中且已经过期 → 明确报「中断」，并允许重试。
    if (isStaleInstall(status) && !inflight.has(driver.key)) {
      store.set(driver.key, {
        ...status,
        status: "error",
        error: "安装中断：超过 15 分钟没有进展，请重试",
        finishedAt: Date.now(),
      });
    }
    return { binary, installed, status: store.get(driver.key), sizeBytes: undefined };
  }

  return [
    [
      "/driver/status",
      "POST",
      true,
      async () => {
        const platformTag = releasePlatformTag();
        return {
          drivers: DRIVERS.map((driver) => {
            const { binary, installed, status, sizeBytes } = reconcile(driver);
            return {
              key: driver.key,
              label: driver.label,
              description: driver.description,
              envVar: driver.envVar,
              installed,
              installedPath: installed ? binary : undefined,
              sizeBytes,
              expectedPath: binary,
              platform: platformKey(),
              registryUrl: registryUrl(),
              downloadSource: platformTag ? "dbx agents release" : `不支持的平台: ${process.platform}-${process.arch}`,
              reason: installed ? undefined : "未检测到驱动可执行文件，点击「安装」从 dbx agents release 下载",
              installStatus: status,
            };
          }),
        };
      },
    ],

    [
      "/driver/install",
      "POST",
      true,
      async ({ body }) => {
        const { driverKey, url: urlOverride } = body || {};
        const driver = findDriver(driverKey);
        if (!driver) {
          throw engineError("BAD_REQUEST", `未知驱动: ${driverKey}（可用：${DRIVERS.map((d) => d.key).join(", ")}）`);
        }
        if (!urlOverride && !releasePlatformTag()) {
          throw engineError("DRIVER_UNSUPPORTED", `不支持的平台: ${process.platform}-${process.arch}`);
        }

        const target = driverBinaryPath(ctx, driver.key);
        if (existsSync(target)) {
          let sizeBytes = 0;
          try {
            sizeBytes = statSync(target).size;
          } catch {
            /* ignore */
          }
          const done = { status: "done", downloaded: sizeBytes, total: sizeBytes, percent: 100, installedPath: target };
          store.set(driver.key, { ...store.raw(driver.key), ...done });
          return { ok: true, driverKey: driver.key, installedPath: target, note: "驱动已存在", installStatus: store.get(driver.key) };
        }

        const status = store.get(driver.key);
        if (inflight.has(driver.key) || isActiveInstall(status)) {
          return { ok: true, driverKey: driver.key, note: "已在安装中", installStatus: status };
        }

        const startedAt = Date.now();
        inflight.add(driver.key);
        seedInstallStatus(store, driver.key, startedAt, urlOverride);

        // 异步执行：HTTP 立刻返回，前端轮询 /driver/status 看进度。
        void runInstall({ ctx, store, driver, urlOverride, startedAt }).finally(() => {
          inflight.delete(driver.key);
        });

        return {
          ok: true,
          driverKey: driver.key,
          note: "下载已开始，轮询 /driver/status 查看进度",
          installStatus: store.get(driver.key),
        };
      },
    ],

    [
      "/driver/install-status",
      "GET",
      true,
      async ({ query }) => {
        const key = query?.driverKey ?? DRIVERS[0]?.key;
        if (!findDriver(key)) {
          throw engineError("BAD_REQUEST", `未知驱动: ${key}（可用：${DRIVERS.map((d) => d.key).join(", ")}）`);
        }
        return { driverKey: key, installStatus: store.get(key) };
      },
    ],

    [
      "/driver/set-path",
      "POST",
      true,
      async ({ body }) => {
        const { driverKey, path } = body || {};
        const driver = findDriver(driverKey);
        if (!driver) throw engineError("BAD_REQUEST", `未知驱动: ${driverKey}`);
        if (!path) throw engineError("BAD_REQUEST", "缺少 path 参数");
        if (!existsSync(path)) throw engineError("BAD_REQUEST", `文件不存在: ${path}`);

        const dest = driverBinaryPath(ctx, driver.key);
        ensureDir(driverTargetDir(ctx, driver.key));
        try {
          copyFileSync(path, dest);
          chmodSync(dest, 0o755);
        } catch (error) {
          throw engineError(
            "DRIVER_ERROR",
            `复制驱动失败: ${error.message}。可手动设置环境变量 ${driver.envVar}=${path}`,
          );
        }
        const sizeBytes = statSync(dest).size;
        store.set(driver.key, { status: "done", downloaded: sizeBytes, total: sizeBytes, percent: 100, installedPath: dest });
        const bridgeRestarted = await restartBridge(ctx);
        return { ok: true, driverKey: driver.key, path: dest, installedPath: dest, bridgeRestarted };
      },
    ],

    [
      "/driver/reset-status",
      "POST",
      true,
      async ({ body }) => {
        store.remove(body?.driverKey);
        return { ok: true };
      },
    ],
  ];
}

/** 安装刚受理时的初始状态。 */
function seedInstallStatus(store, driverKey, startedAt, urlOverride) {
  store.set(driverKey, {
    status: "resolving",
    downloaded: 0,
    total: 0,
    startedAt,
    sourceUrl: urlOverride,
  });
}
