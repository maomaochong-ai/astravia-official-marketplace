/**
 * The upstream ledger and its consumer script. Everything here is offline:
 * no clone, no network, no git.
 *   node --test tests/*.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "sync-upstream.mjs");
const ledger = JSON.parse(readFileSync(path.join(ROOT, "scripts", "upstream.json"), "utf8"));

const run = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8", timeout: 20_000 });

test("台账把入口指向上游的 arming-thought", () => {
  assert.equal(ledger.files["SKILL.md"], "skills/arming-thought/SKILL.md");
  assert.equal(ledger.sourcePath, "skills");
  assert.equal(ledger.license, "MIT");
});

// 逐字节收录的范围：入口、十份规程、十二份参考、LICENSE，加上未改动的
// hooks.json / run-hook.cmd / 案例文章。改造过的不在这里，登记在 adapted。
const VERBATIM_PREFIXES = ["skills/", "hooks/", "docs/assets/"];

test("逐字节收录的上游路径都在已知范围内", () => {
  for (const [local, upstream] of Object.entries(ledger.files)) {
    const ok = upstream === "LICENSE" || VERBATIM_PREFIXES.some((prefix) => upstream.startsWith(prefix));
    assert.ok(ok, `${local} 的上游路径不在预期范围：${upstream}`);
  }
});

test("改造过的文件不参与逐字节比对，但必须有本地落点", () => {
  const adapted = Object.entries(ledger.adapted ?? {});
  assert.ok(adapted.length >= 14, "hooks 与 commands 都应登记为改造过");
  for (const [local, upstream] of adapted) {
    assert.ok(upstream && !upstream.startsWith("/"), `${local} 缺少上游出处`);
    assert.ok(
      !Object.hasOwn(ledger.files, local),
      `${local} 同时出现在 files 与 adapted：改造过的文件不能要求逐字节一致`,
    );
  }
  for (const name of ["hooks/session-start", "hooks/session-start.ps1"]) {
    assert.ok(ledger.adapted[name], `${name} 改了注入路径，必须登记为 adapted`);
  }
});

test("安装器行为是重新实现的，只登记出处", () => {
  const reimplemented = Object.entries(ledger.reimplemented ?? {});
  assert.deepEqual(
    reimplemented.map(([local]) => local).sort(),
    ["scripts/install-platforms.mjs", "scripts/platforms.json"],
  );
  for (const [local, upstream] of reimplemented) {
    assert.ok(upstream.startsWith("bin/"), `${local} 应指向上游 bin/ 下的实现`);
  }
});

test("--print 列出全部映射，且不需要本地检出", () => {
  const result = run("--print");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /映射 27 条/);
  assert.match(result.stdout, /不克隆/);
  assert.match(result.stdout, /skills\/arming-thought\/SKILL\.md\s+->\s+SKILL\.md/);
  assert.match(result.stdout, /已改造、不比对字节/);
});

test("分支名会破坏逐字节比对，必须被拒绝", () => {
  for (const bogus of ["main", "v2.0.0", "HEAD"]) {
    const result = run("--verify", "--revision", bogus);
    assert.equal(result.status, 1, `${bogus} 应当被拒绝`);
    assert.match(result.stderr, /40 位 commit/);
  }
});

test("非 GitHub 仓库地址要求改用本地检出", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--verify", "--repository", "https://gitlab.com/someone/qiushi-skill"],
    { cwd: ROOT, encoding: "utf8", timeout: 20_000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--upstream/);
});

test("脚本自身不依赖克隆，也没有第三方依赖", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.ok(!/from\s+"(?!node:)/.test(source), "只允许 node: 内置模块");
  assert.ok(!/clone/.test(source), "不应再出现 clone 路径");
});
