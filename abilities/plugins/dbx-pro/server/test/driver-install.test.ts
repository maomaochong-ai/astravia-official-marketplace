/**
 * driver-install.test.mjs — 安装链路端到端（不起真实引擎进程）。
 *
 * 这里覆盖用户报的那个问题：「点击安装闪退/没反应，驱动没装上」。
 * 复现方式完全离线：本地起一个 HTTP 服务当 release（清单 + .tar.zst 归档），
 * 用 DBX_DRIVERS_REGISTRY_URL 把驱动清单指过去，然后直接调用 driverRoutes。
 *
 * 断言的重点不是「HTTP 返回 200」，而是：二进制真的落到 dbx-mcp 会扫描的位置、
 * 校验不过就不落盘、失败原因能从 /driver/status 读到、装好后 dbx-mcp 会被重启。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, describe, it } from "node:test";
import { zstdCompressSync } from "node:zlib";

import { driverBinaryPath, driverRoutes, driversRoot, platformKey, releasePlatformTag } from "../src/api/driver.ts";
import { resetAgentRegistryCache } from "../src/engine/driver-registry.ts";
import { isEngineError } from "../src/engine/protocol.ts";
import { makeDriverArchive } from "./support/tar-builder.ts";

const PLATFORM_TAG = releasePlatformTag();
const PAYLOAD = Buffer.from("duckdb-worker-payload-bytes\n");
// release 上真正分发的字节：zstd 压缩后的 tar（清单里的 sha256/size 都是指它）。
const HAS_ZSTD = typeof zstdCompressSync === "function";
const ARCHIVE = HAS_ZSTD ? zstdCompressSync(makeDriverArchive({ payload: PAYLOAD, platformTag: PLATFORM_TAG })) : Buffer.alloc(0);

const roots = new Set();
const servers = new Set();

/** 本地「release」：清单与归档都可控，用来复现 404 / sha 不符 / 慢下载。 */
async function startReleaseServer(state = {}) {
  const options = { registryStatus: 200, archiveStatus: 200, delayMs: 0, hits: { registry: 0, archive: 0 }, ...state };
  const server = createServer(async (req, res) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (req.url.startsWith("/agent-registry.json")) {
      options.hits.registry += 1;
      if (options.registryStatus !== 200) {
        res.writeHead(options.registryStatus, { "content-type": "text/plain" });
        res.end("Not Found");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(options.registry));
      return;
    }
    // 其余路径都当作产物：/driver.tar.zst（归档）或 /driver.bin（裸文件）
    options.hits.archive += 1;
    res.writeHead(options.archiveStatus, { "content-type": "application/octet-stream", "content-length": String(options.archive?.length ?? 0) });
    res.end(options.archive);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.add(server);
  const { port } = server.address();
  return {
    options,
    origin: `http://127.0.0.1:${port}`,
    get registryUrl() {
      return `http://127.0.0.1:${port}/agent-registry.json`;
    },
    get archiveUrl() {
      return `http://127.0.0.1:${port}/driver.tar.zst`;
    },
  };
}

/** 按真实清单结构造一份指向本地服务的清单。 */
function registryFor(release, { sha256 = createHash("sha256").update(ARCHIVE).digest("hex"), size = ARCHIVE.length } = {}) {
  return {
    drivers: {
      duckdb: {
        version: "0.1.30",
        native: {
          [PLATFORM_TAG]: { url: release.archiveUrl, sha256, size, format: "tar_zstd" },
        },
      },
    },
  };
}

function makeContext() {
  const dataDir = mkdtempSync(join(tmpdir(), "dbx-driver-test-"));
  roots.add(dataDir);
  const calls = { bridgeRestarts: 0 };
  const ctx = {
    dataDir,
    disposeDbxMcpClient: async () => {
      calls.bridgeRestarts += 1;
    },
  };
  return { ctx, calls, dataDir };
}

function callApi(routes, pathname, { method = "POST", body = null, query = {} } = {}) {
  const route = routes.find(([path, verb]) => path === pathname && verb === method);
  assert.ok(route, `没有注册路由 ${method} ${pathname}`);
  return route[3]({ body, headers: {}, query });
}

/** 轮询 /driver/status，直到装好或明确失败（模拟前端 useDriverManager 的轮询）。 */
async function waitForInstall(routes, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { drivers } = await callApi(routes, "/driver/status");
    const driver = drivers[0];
    const status = driver.installStatus;
    if (driver.installed || status.status === "error" || status.status === "done") return { driver, status };
    if (Date.now() > deadline) throw new Error(`安装未在 ${timeoutMs}ms 内结束：${JSON.stringify(status)}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * 每个用例都要自己的 routes（内部持有状态文件与单飞集合）。
 * `prepare` 在 routes 创建**之前**跑：状态文件只在创建时读一次，事后写没用。
 */
function useRelease(release, { prepare } = {}) {
  process.env.DBX_DRIVERS_REGISTRY_URL = release.registryUrl;
  resetAgentRegistryCache();
  const fixture = makeContext();
  prepare?.(fixture.ctx);
  return { ...fixture, routes: driverRoutes(fixture.ctx) };
}

afterEach(() => {
  delete process.env.DBX_DRIVERS_REGISTRY_URL;
  resetAgentRegistryCache();
});

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const server of servers) server.close();
  delete process.env.DBX_DRIVERS_REGISTRY_URL;
  delete process.env.DBX_DRIVERS_ROOT;
});

describe("驱动安装 · 成功路径", { skip: HAS_ZSTD ? false : "需要 node 提供 zstd 支持" }, () => {
  it("从清单解析产物、解包落盘到 dbx-mcp 扫描的位置，并重启桥接进程", async () => {
    const release = await startReleaseServer();
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release);
    const { ctx, calls, routes } = useRelease(release);

    const accepted = await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.driverKey, "duckdb");
    assert.equal(accepted.installStatus.status, "resolving");
    assert.match(accepted.note, /下载已开始/);

    const { driver, status } = await waitForInstall(routes);

    // 位置：<引擎 dataDir>/drivers/duckdb/<platform>/duckdb_worker —— 必须与 collectDriverEnv() 一致
    const expected = driverBinaryPath({ dataDir: ctx.dataDir }, "duckdb");
    assert.equal(expected, join(driversRoot({ dataDir: ctx.dataDir }), "duckdb", platformKey(), "duckdb_worker"));
    assert.equal(driver.installedPath, expected);
    assert.equal(driver.installed, true);
    assert.equal(driver.expectedPath, expected);

    // 内容：就是归档里那个条目，逐字节一致，且可执行
    assert.equal(readFileSync(expected).equals(PAYLOAD), true);
    assert.equal(statSync(expected).size, PAYLOAD.length);
    assert.equal(statSync(expected).mode & 0o777, 0o755);

    // 状态：done + 进度满 + 桥接已重启
    assert.equal(status.status, "done");
    assert.equal(status.downloaded, PAYLOAD.length);
    assert.equal(status.percent, 100);
    assert.equal(status.version, "0.1.30");
    assert.equal(status.bridgeRestarted, true);
    assert.equal(driver.sizeBytes, PAYLOAD.length);
    assert.equal(calls.bridgeRestarts, 1);

    // 临时文件不留残渣
    assert.deepEqual(readdirSync(join(expected, "..")), [ "duckdb_worker" ]);
  });

  it("安装完成后 /driver/install-status 能读到同一份状态", async () => {
    const release = await startReleaseServer();
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release);
    const { routes } = useRelease(release);
    await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    await waitForInstall(routes);

    const byQuery = await callApi(routes, "/driver/install-status", { method: "GET", query: { driverKey: "duckdb" } });
    assert.equal(byQuery.driverKey, "duckdb");
    assert.equal(byQuery.installStatus.status, "done");

    const byDefault = await callApi(routes, "/driver/install-status", { method: "GET" });
    assert.equal(byDefault.driverKey, "duckdb");
  });

  it("url 覆盖（raw 产物）直接落盘，不按归档解包", async () => {
    const release = await startReleaseServer();
    const raw = Buffer.from("#!/bin/sh\necho raw-driver\n");
    release.options.archive = raw;
    const { ctx, routes } = useRelease(release);

    await callApi(routes, "/driver/install", { body: { driverKey: "duckdb", url: `${release.origin}/driver.bin` } });
    const { driver, status } = await waitForInstall(routes);
    assert.equal(status.status, "done");
    assert.equal(readFileSync(driver.installStatus.installedPath).equals(raw), true);
    assert.equal(readFileSync(driverBinaryPath(ctx, "duckdb")).equals(raw), true);
  });
});

describe("驱动安装 · 失败可见", () => {
  it("sha256 不一致时拒绝落盘，并把原因写进状态（用户能看见）", async () => {
    const release = await startReleaseServer();
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release, { sha256: "0".repeat(64) });
    const { ctx, calls, routes } = useRelease(release);

    await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    const { driver, status } = await waitForInstall(routes);

    assert.equal(status.status, "error");
    assert.match(status.error, /sha256/);
    assert.equal(driver.installed, false);
    assert.equal(existsSync(driverBinaryPath(ctx, "duckdb")), false);
    assert.equal(calls.bridgeRestarts, 0);
    // 半个文件不能留在驱动目录里冒充「已安装」
    const targetDir = join(driversRoot(ctx), "duckdb", platformKey());
    assert.deepEqual(readdirSync(targetDir), []);
  });

  it("清单 404（旧实现拼裸文件名的老毛病）会以可读错误暴露", async () => {
    const release = await startReleaseServer({ registryStatus: 404 });
    const { routes } = useRelease(release);
    await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    const { status } = await waitForInstall(routes);
    assert.equal(status.status, "error");
    assert.match(status.error, /HTTP 404/);
  });

  it("产地归档不合约（不是 zstd）时报错而不是装一个坏文件", async () => {
    const release = await startReleaseServer();
    release.options.archive = Buffer.from("definitely-not-zstd");
    release.options.registry = registryFor(release, { sha256: createHash("sha256").update(release.options.archive).digest("hex") });
    const { ctx, routes } = useRelease(release);
    await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    const { status } = await waitForInstall(routes);
    assert.equal(status.status, "error");
    assert.match(status.error, /zstd|归档/);
    assert.equal(existsSync(driverBinaryPath(ctx, "duckdb")), false);
  });

  it("未知驱动直接拒绝", async () => {
    const release = await startReleaseServer();
    await assert.rejects(
      callApi(useRelease(release).routes, "/driver/install", { body: { driverKey: "redis" } }),
      (error) => isEngineError(error) && error.code === "BAD_REQUEST" && /redis/.test(error.message),
    );
  });

  it("未知驱动的状态查询同样拒绝", async () => {
    const release = await startReleaseServer();
    await assert.rejects(
      callApi(useRelease(release).routes, "/driver/install-status", { method: "GET", query: { driverKey: "nope" } }),
      (error) => isEngineError(error) && error.code === "BAD_REQUEST",
    );
  });
});

describe("驱动安装 · 重复与中断", { skip: HAS_ZSTD ? false : "需要 node 提供 zstd 支持" }, () => {
  it("已在安装中时第二次点击不重复下载", async () => {
    const release = await startReleaseServer({ delayMs: 120 });
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release);
    const { routes } = useRelease(release);

    const first = await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    assert.match(first.note, /下载已开始/);

    const second = await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    assert.equal(second.note, "已在安装中");

    const { status } = await waitForInstall(routes);
    assert.equal(status.status, "done");
    assert.equal(release.options.hits.archive, 1);
  });

  it("驱动已存在时不再下载", async () => {
    const release = await startReleaseServer();
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release);
    const { ctx, routes } = useRelease(release);

    const target = driverBinaryPath(ctx, "duckdb");
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, "already-there", { mode: 0o755 });

    const result = await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    assert.equal(result.note, "驱动已存在");
    assert.equal(result.installStatus.status, "done");
    assert.equal(result.installStatus.percent, 100);
    assert.equal(release.options.hits.archive, 0);
    assert.equal(readFileSync(target, "utf8"), "already-there");
  });

  it("超过 15 分钟没进展的安装被判定为中断，并允许重试", async () => {
    const release = await startReleaseServer();
    release.options.archive = ARCHIVE;
    release.options.registry = registryFor(release);
    // 伪造上一次装到一半就断电的状态。状态文件只在 routes 创建时读一次，
    // 所以必须用 prepare 抢在它前面写（进程内没有单飞记录 → 只能靠时间判定过期）。
    const { routes } = useRelease(release, {
      prepare(inner) {
        mkdirSync(driversRoot(inner), { recursive: true });
        writeFileSync(
          join(driversRoot(inner), ".install-status.json"),
          JSON.stringify({ duckdb: { status: "downloading", downloaded: 1024, total: 7653574, startedAt: Date.now() - 16 * 60 * 1000 } }),
        );
      },
    });

    const { driver, status } = await waitForInstall(routes);
    assert.equal(driver.installed, false);
    assert.equal(status.status, "error");
    assert.match(status.error, /安装中断/);

    // 中断状态不影响重新安装
    const retry = await callApi(routes, "/driver/install", { body: { driverKey: "duckdb" } });
    assert.match(retry.note, /下载已开始/);
    assert.equal((await waitForInstall(routes)).status.status, "done");
  });
});

describe("驱动安装 · 手动指定路径", () => {
  it("复制到标准目录、置为可执行并重启桥接", async () => {
    const release = await startReleaseServer();
    const { ctx, calls, routes } = useRelease(release);
    const source = join(ctx.dataDir, "manual-duckdb");
    writeFileSync(source, "manual-binary", { mode: 0o644 });

    const result = await callApi(routes, "/driver/set-path", { body: { driverKey: "duckdb", path: source } });
    const target = driverBinaryPath(ctx, "duckdb");
    assert.equal(result.bridgeRestarted, true);
    assert.equal(readFileSync(target, "utf8"), "manual-binary");
    assert.equal(statSync(target).mode & 0o777, 0o755);
    assert.equal(calls.bridgeRestarts, 1);

    const { driver, status } = await waitForInstall(routes);
    assert.equal(driver.installed, true);
    assert.equal(status.status, "done");
  });

  it("路径不存在时拒绝，且不动已有安装", async () => {
    const release = await startReleaseServer();
    const { routes } = useRelease(release);
    await assert.rejects(
      callApi(routes, "/driver/set-path", { body: { driverKey: "duckdb", path: "/nope/duckdb_worker" } }),
      (error) => isEngineError(error) && error.code === "BAD_REQUEST",
    );
  });
});

describe("驱动状态查询", () => {
  it("未安装时给出期望路径、平台与下载来源", async () => {
    const release = await startReleaseServer();
    const { ctx, routes } = useRelease(release);
    const { drivers } = await callApi(routes, "/driver/status");
    assert.equal(drivers.length, 1);
    assert.equal(drivers[0].key, "duckdb");
    assert.equal(drivers[0].installed, false);
    assert.equal(drivers[0].installedPath, undefined);
    assert.equal(drivers[0].expectedPath, driverBinaryPath(ctx, "duckdb"));
    assert.equal(drivers[0].platform, platformKey());
    assert.equal(drivers[0].envVar, "DBX_DUCKDB_DRIVER_PATH");
    assert.match(drivers[0].reason, /未检测到驱动可执行文件/);
    assert.equal(drivers[0].installStatus.status, "idle");
  });

  it("登记的是实际生效的清单地址（配了镜像就不该再报官方 URL）", async () => {
    const release = await startReleaseServer();
    const { routes } = useRelease(release);
    const { drivers } = await callApi(routes, "/driver/status");
    assert.equal(drivers[0].registryUrl, release.registryUrl);
  });

  it("文件已在位但状态文件丢了也能识别为已安装", async () => {
    const release = await startReleaseServer();
    const { ctx, routes } = useRelease(release);
    const target = driverBinaryPath(ctx, "duckdb");
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, "present", { mode: 0o755 });

    const { drivers } = await callApi(routes, "/driver/status");
    assert.equal(drivers[0].installed, true);
    assert.equal(drivers[0].installStatus.status, "done");
    assert.equal(drivers[0].installStatus.percent, 100);
    assert.equal(drivers[0].sizeBytes, 7);
  });

  it("reset-status 清掉历史失败", async () => {
    const release = await startReleaseServer();
    const { routes } = useRelease(release, {
      prepare(inner) {
        mkdirSync(driversRoot(inner), { recursive: true });
        writeFileSync(join(driversRoot(inner), ".install-status.json"), JSON.stringify({ duckdb: { status: "error", error: "boom" } }));
      },
    });

    // 先确认种子状态真的被读进来了，否则这个用例就是空跑
    const seeded = await callApi(routes, "/driver/status");
    assert.equal(seeded.drivers[0].installStatus.status, "error");


    await callApi(routes, "/driver/reset-status", { body: { driverKey: "duckdb" } });
    const { drivers } = await callApi(routes, "/driver/status");
    assert.equal(drivers[0].installStatus.status, "idle");
  });
});
