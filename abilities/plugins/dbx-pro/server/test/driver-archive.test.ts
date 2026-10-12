/**
 * driver-archive.test.mjs — 驱动 `.tar.zst` 解包。
 *
 * 覆盖的是「安装时把可执行体从归档里取出来」这一步：真实归档只有两个条目
 * （agent-registry.json + drivers/dbx-agent-<key>-<ver>-<plat>），取错条目就
 * 会把清单当驱动装出去，所以这里对选择规则和错误路径的断言要具体。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { zstdCompressSync } from "node:zlib";

import {
  extractDriverPayload,
  pickDriverEntry,
  readTarEntries,
} from "../src/engine/driver-archive.ts";
import { isEngineError } from "../src/engine/protocol.ts";
import { makeDriverArchive, makeTar, paxRecord } from "./support/tar-builder.ts";

const HAS_ZSTD = typeof zstdCompressSync === "function";

function zstd(buffer) {
  return zstdCompressSync(buffer);
}

function assertCode(error, code) {
  assert.equal(isEngineError(error), true, `期望 EngineError，实际：${error}`);
  assert.equal(error.code, code);
}

describe("driver-archive · tar 读取", () => {
  it("读出常规文件条目的名字、权限与内容", () => {
    const tar = makeTar([
      { name: "agent-registry.json", data: "{}\n" },
      { name: "drivers/dbx-agent-duckdb-0.1.30-macos-x64", data: "BINARY", mode: 0o755 },
    ]);
    const entries = readTarEntries(tar);
    assert.deepEqual(entries.map((entry) => entry.name), [
      "agent-registry.json",
      "drivers/dbx-agent-duckdb-0.1.30-macos-x64",
    ]);
    assert.equal(entries[1].data.toString("utf8"), "BINARY");
    assert.equal(entries[1].mode, 0o755);
  });

  it("跨块条目（>512 字节）的偏移对齐", () => {
    const payload = "x".repeat(1500);
    const entries = readTarEntries(makeTar([{ name: "drivers/big", data: payload }]));
    assert.equal(entries[0].size, 1500);
    assert.equal(entries[0].data.toString("utf8"), payload);
  });

  it("支持 ustar 前缀字段拼出的长路径", () => {
    const prefix = "drivers/" + "a".repeat(120);
    const entries = readTarEntries(makeTar([{ name: "dbx-agent-duckdb", prefix, data: "B" }]));
    assert.equal(entries[0].name, `${prefix}/dbx-agent-duckdb`);
  });

  it("支持 PAX 扩展头里的 path 与 mode", () => {
    const longName = `drivers/${"p".repeat(160)}`;
    const entries = readTarEntries(
      makeTar([
        { name: "PaxHeader/entry", type: "x", data: paxRecord("path", longName) + paxRecord("mode", "0000755") },
        { name: "drivers/truncated-name", data: "B" },
      ]),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, longName);
    assert.equal(entries[0].mode, 0o755);
  });

  it("支持 GNU 长文件名（typeflag L）", () => {
    const longName = `drivers/${"g".repeat(150)}`;
    const entries = readTarEntries(
      makeTar([
        { name: "././@LongLink", type: "L", data: `${longName}\0` },
        { name: "drivers/short", data: "B" },
      ]),
    );
    assert.equal(entries[0].name, longName);
  });

  it("归档被截断时明确报错，不静默返回半个条目", () => {
    const tar = makeTar([{ name: "drivers/x", data: "y".repeat(600) }]);
    const truncated = tar.subarray(0, 512 + 100);
    try {
      readTarEntries(truncated);
      assert.fail("应当抛出归档截断错误");
    } catch (error) {
      assertCode(error, "DRIVER_ARCHIVE_INVALID");
      assert.match(error.message, /截断/);
    }
  });

  it("生成的 tar 能被系统 tar 读取（fixture 与真实归档同构）", () => {
    try {
      execFileSync("tar", ["--version"], { stdio: "ignore" });
    } catch {
      return; // 没有 tar 就跳过互操作校验
    }
    const tar = makeDriverArchive({ payload: "BINARY" });
    const listing = execFileSync("tar", ["-tvf", "-"], { input: tar }).toString("utf8");
    assert.match(listing, /drivers\/dbx-agent-duckdb-0\.1\.30-macos-x64/);
    assert.match(listing, /agent-registry\.json/);
  });
});

describe("driver-archive · 条目选择", () => {
  const payloadEntry = { name: "drivers/dbx-agent-duckdb-0.1.30-macos-x64", mode: 0o755, size: 6, data: Buffer.from("BINARY") };

  it("优先 drivers/ 下的条目，而不是清单", () => {
    const chosen = pickDriverEntry([{ name: "agent-registry.json", mode: 0o644, size: 60, data: Buffer.alloc(60) }, payloadEntry]);
    assert.equal(chosen.name, payloadEntry.name);
  });

  it("drivers/ 下有多个时取最大的那个", () => {
    const bigger = { ...payloadEntry, name: "drivers/b", size: 10, data: Buffer.alloc(10) };
    assert.equal(pickDriverEntry([payloadEntry, bigger]).name, "drivers/b");
  });

  it("布局不认识时退化为最大常规文件（而不是报「找不到驱动」）", () => {
    const chosen = pickDriverEntry([
      { name: "meta.json", mode: 0o644, size: 2, data: Buffer.from("{}") },
      { name: "bin/agent", mode: 0o755, size: 5, data: Buffer.from("AGENT") },
    ]);
    assert.equal(chosen.name, "bin/agent");
  });

  it("没有常规文件时报错并列出实际条目名", () => {
    try {
      pickDriverEntry([{ name: "empty", mode: 0o644, size: 0, data: Buffer.alloc(0) }]);
      assert.fail("应当抛出无可用条目错误");
    } catch (error) {
      assertCode(error, "DRIVER_ARCHIVE_INVALID");
      assert.match(error.message, /empty/);
    }
  });
});

describe("driver-archive · .tar.zst 解包", () => {
  it("从 zstd 归档里取出驱动可执行体", { skip: !HAS_ZSTD }, () => {
    const payload = "duckdb-worker-bytes";
    const result = extractDriverPayload(zstd(makeDriverArchive({ payload })));
    assert.equal(result.name, "drivers/dbx-agent-duckdb-0.1.30-macos-x64");
    assert.equal(result.mode, 0o755);
    assert.equal(result.data.toString("utf8"), payload);
  });

  it("不是 zstd 数据时给出可读错误", { skip: !HAS_ZSTD }, () => {
    try {
      extractDriverPayload(Buffer.from("not-zstd-at-all"));
      assert.fail("应当抛出解压错误");
    } catch (error) {
      assertCode(error, "DRIVER_ARCHIVE_INVALID");
      assert.match(error.message, /zstd 解压失败/);
    }
  });

  it("归档里没有驱动条目时报错", { skip: !HAS_ZSTD }, () => {
    try {
      extractDriverPayload(zstd(makeTar([{ name: "agent-registry.json", data: "{}\n" }])));
      assert.fail("应当抛出无可用条目错误");
    } catch (error) {
      assertCode(error, "DRIVER_ARCHIVE_INVALID");
    }
  });
});
