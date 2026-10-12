/**
 * driver-registry.test.mjs — 清单 → 产物地址。
 *
 * 这是「点击安装没反应」的直接病灶：旧代码拼的是 `agents-latest` 下的裸文件名，
 * 而 agents-latest 只有一个清单资产，于是每次安装都拿到 HTTP 404。这里断言
 * 新路径（清单 → 版本化 tag 的 .tar.zst + sha256）的选择与拒绝规则。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  artifactFormatOf,
  fetchAgentRegistry,
  pickNativeArtifact,
  resetAgentRegistryCache,
  resolveDriverArtifact,
} from "../src/engine/driver-registry.mjs";
import { isEngineError } from "../src/engine/protocol.mjs";

const REAL_ARTIFACT_URL =
  "https://github.com/t8y2/dbx/releases/download/agents-v0.2.134/dbx-agent-duckdb-0.1.29-macos-x64.tar.zst";

function registryFixture(overrides = {}) {
  return {
    drivers: {
      duckdb: {
        version: "0.1.29",
        native: {
          "macos-x64": {
            url: REAL_ARTIFACT_URL,
            sha256: "F2920859388C464E4C317DA3612598458BE1AD67CC4E1561385C69CAC60038C7",
            size: 7653574,
            format: "tar_zstd",
          },
          "macos-aarch64": { url: REAL_ARTIFACT_URL.replace("macos-x64", "macos-aarch64"), sha256: "aa", size: 1 },
        },
        ...overrides.driver,
      },
      ...overrides.drivers,
    },
  };
}

function stubFetch({ body, status = 200, statusText = "OK", failWith = null, onCall } = {}) {
  return async (url) => {
    onCall?.(url);
    if (failWith) throw failWith;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: async () => body,
    };
  };
}

afterEach(() => resetAgentRegistryCache());

function assertCode(error, code) {
  assert.equal(isEngineError(error), true, `期望 EngineError，实际：${error}`);
  assert.equal(error.code, code);
}

describe("driver-registry · 产物形态", () => {
  it("按扩展名识别 .tar.zst 归档", () => {
    assert.equal(artifactFormatOf("https://x/y.tar.zst"), "tar_zstd");
    assert.equal(artifactFormatOf("https://x/y.tar.zstd?v=2"), "tar_zstd");
    assert.equal(artifactFormatOf("https://x/dbx-agent-duckdb-macos-x64"), "raw");
  });
});

describe("driver-registry · 清单解析", () => {
  it("取到版本化 tag 的归档地址与 sha256，并统一小写", () => {
    const artifact = pickNativeArtifact(registryFixture(), { driverKey: "duckdb", platformTag: "macos-x64" });
    assert.equal(artifact.url, REAL_ARTIFACT_URL);
    assert.equal(artifact.sha256, "f2920859388c464e4c317da3612598458be1ad67cc4e1561385c69cac60038c7");
    assert.equal(artifact.size, 7653574);
    assert.equal(artifact.format, "tar_zstd");
    assert.equal(artifact.version, "0.1.29");
  });

  it("清单里没有的驱动报 DRIVER_UNSUPPORTED 并列出实际可用项", () => {
    try {
      pickNativeArtifact(registryFixture(), { driverKey: "redis", platformTag: "macos-x64" });
      assert.fail("应当抛出 DRIVER_UNSUPPORTED");
    } catch (error) {
      assertCode(error, "DRIVER_UNSUPPORTED");
      assert.match(error.message, /duckdb/);
    }
  });

  it("清单里没有当前平台时报 DRIVER_UNSUPPORTED 并列出可用平台", () => {
    try {
      pickNativeArtifact(registryFixture(), { driverKey: "duckdb", platformTag: "linux-riscv" });
      assert.fail("应当抛出 DRIVER_UNSUPPORTED");
    } catch (error) {
      assertCode(error, "DRIVER_UNSUPPORTED");
      assert.match(error.message, /macos-x64/);
    }
  });

  it("缺 sha256 时拒绝安装（无法校验完整性）", () => {
    const registry = registryFixture({ driver: { native: { "macos-x64": { url: REAL_ARTIFACT_URL } } } });
    try {
      pickNativeArtifact(registry, { driverKey: "duckdb", platformTag: "macos-x64" });
      assert.fail("应当抛出 DRIVER_REGISTRY_INVALID");
    } catch (error) {
      assertCode(error, "DRIVER_REGISTRY_INVALID");
      assert.match(error.message, /sha256/);
    }
  });

  it("拒绝被引到非白名单主机的 https 地址", () => {
    const registry = registryFixture({ driver: { native: { "macos-x64": { url: "https://evil.example/d.tar.zst", sha256: "ab" } } } });
    try {
      pickNativeArtifact(registry, { driverKey: "duckdb", platformTag: "macos-x64" });
      assert.fail("应当抛出 DRIVER_REGISTRY_INVALID");
    } catch (error) {
      assertCode(error, "DRIVER_REGISTRY_INVALID");
      assert.match(error.message, /evil\.example/);
    }
  });

  it("拒绝非 https（本机回环除外）地址", () => {
    const registry = registryFixture({ driver: { native: { "macos-x64": { url: "http://github.com/d.tar.zst", sha256: "ab" } } } });
    assert.throws(
      () => pickNativeArtifact(registry, { driverKey: "duckdb", platformTag: "macos-x64" }),
      (error) => isEngineError(error) && error.code === "DRIVER_REGISTRY_INVALID",
    );
  });
});

describe("driver-registry · 清单拉取", () => {
  it("拉取失败（网络不可达）报 DRIVER_REGISTRY_UNAVAILABLE 且带上地址", async () => {
    const cause = Object.assign(new Error("connect ETIMEDOUT"), { code: "UND_ERR_CONNECT_TIMEOUT" });
    const fetchImpl = stubFetch({ failWith: Object.assign(new Error("fetch failed"), { cause }) });
    try {
      await fetchAgentRegistry({ fetchImpl });
      assert.fail("应当抛出 DRIVER_REGISTRY_UNAVAILABLE");
    } catch (error) {
      assertCode(error, "DRIVER_REGISTRY_UNAVAILABLE");
      assert.match(error.message, /agent-registry\.json/);
      assert.match(error.message, /UND_ERR_CONNECT_TIMEOUT/);
    }
  });

  it("HTTP 404（旧的裸文件名路径）会以可读错误暴露出来", async () => {
    const fetchImpl = stubFetch({ status: 404, statusText: "Not Found" });
    try {
      await fetchAgentRegistry({ fetchImpl });
      assert.fail("应当抛出 DRIVER_REGISTRY_UNAVAILABLE");
    } catch (error) {
      assertCode(error, "DRIVER_REGISTRY_UNAVAILABLE");
      assert.match(error.message, /HTTP 404/);
    }
  });

  it("清单不是合法 JSON 时报 DRIVER_REGISTRY_INVALID", async () => {
    const badJson = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new Error("Unexpected token <");
      },
    });
    await assert.rejects(
      fetchAgentRegistry({ fetchImpl: badJson }),
      (error) => isEngineError(error) && error.code === "DRIVER_REGISTRY_INVALID",
    );
  });

  it("进程内缓存清单，避免每次安装都打一次网络", async () => {
    let calls = 0;
    const fetchImpl = stubFetch({ body: registryFixture(), onCall: () => { calls += 1; } });
    await fetchAgentRegistry({ fetchImpl });
    await fetchAgentRegistry({ fetchImpl });
    assert.equal(calls, 1);

    resetAgentRegistryCache();
    await fetchAgentRegistry({ fetchImpl });
    assert.equal(calls, 2);
  });

  it("清单地址变化时不复用旧缓存", async () => {
    let calls = 0;
    const fetchImpl = stubFetch({ body: registryFixture(), onCall: () => { calls += 1; } });
    await fetchAgentRegistry({ fetchImpl, registryUrl: "https://github.com/a/agent-registry.json" });
    await fetchAgentRegistry({ fetchImpl, registryUrl: "https://github.com/b/agent-registry.json" });
    assert.equal(calls, 2);
  });
});

describe("driver-registry · 一步解析", () => {
  it("resolveDriverArtifact = 清单拉取 + 平台选择", async () => {
    const fetchImpl = stubFetch({ body: registryFixture() });
    const artifact = await resolveDriverArtifact({ driverKey: "duckdb", platformTag: "macos-x64", fetchImpl });
    assert.equal(artifact.url, REAL_ARTIFACT_URL);
    assert.equal(artifact.format, "tar_zstd");
  });
});
