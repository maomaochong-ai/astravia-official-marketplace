// Cross-host install: the script must place files where each host looks, write the
// marketplace manifest Claude Code needs, honour CODEX_HOME, and clean up after itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");

function run(args, env = {}) {
  return execFileSync(process.execPath, [path.join(SCRIPTS, "install-platforms.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function listing(env = {}) {
  return JSON.parse(run(["--list", "--json"], env));
}

// The installer refuses to write outside home / the project, so the probe lives under home.
function scratch() {
  const dir = mkdtempSync(path.join(homedir(), ".qiushi-install-test-"));
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("每个目标都同时登记了落点文档里写的资产", () => {
  const catalog = JSON.parse(readFileSync(path.join(SCRIPTS, "platforms.json"), "utf8"));
  const doc = readFileSync(path.join(SCRIPTS, "..", "PLATFORMS.md"), "utf8");

  for (const target of catalog.targets) {
    assert.ok(target.root.user, `${target.id} 没有用户级落点`);
    assert.ok(doc.includes(`\`${target.id}\``), `PLATFORMS.md 没写 ${target.id}`);
    for (const asset of target.assets) {
      assert.ok(catalog.assets[asset], `${target.id} 引用了未定义资产 ${asset}`);
    }
    assert.ok(target.assets.includes("cases"), `${target.id} 没带上 references/cases`);
  }
});

test("CODEX_HOME 在时落点跟着走，不在时回落到 ~/.codex", () => {
  const withHome = listing({ CODEX_HOME: "/tmp/qiushi-codex-probe" }).targets.find((t) => t.id === "codex");
  assert.equal(withHome.root, path.resolve("/tmp/qiushi-codex-probe/skills/qiushi-skill"));

  const bare = listing({ CODEX_HOME: "" }).targets.find((t) => t.id === "codex");
  assert.equal(bare.root, path.join(process.env.HOME, ".codex/skills/qiushi-skill"));
});

test("Claude Code 拿到 marketplace.json 与两条收尾命令，卸载后目录清空", () => {
  const { dir, done } = scratch();
  try {
    const out = run(["--target", "claude-code", "--dest", dir]);
    const marketplacePath = path.join(dir, ".claude-plugin", "marketplace.json");
    assert.ok(existsSync(marketplacePath), "缺 .claude-plugin/marketplace.json");

    const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
    assert.equal(marketplace.name, "qiushi-skill");
    assert.deepEqual(marketplace.plugins.map((plugin) => plugin.name), ["qiushi-skill"]);
    assert.equal(marketplace.plugins[0].source, "./");

    assert.ok(out.includes("/plugin marketplace add"), "没有打印 marketplace add");
    assert.ok(out.includes("/plugin install qiushi-skill@qiushi-skill"), "没有打印 plugin install");
    assert.ok(existsSync(path.join(dir, "references", "cases", "tangping-editorial-perspective.md")));

    run(["--uninstall", "--target", "claude-code", "--dest", dir]);
    assert.equal(existsSync(dir), false, "卸载后还留着目录");
  } finally {
    done();
  }
});

test("不覆盖不是自己写的文件", () => {
  const { dir, done } = scratch();
  try {
    const foreign = path.join(dir, "SKILL.md");
    execFileSync("mkdir", ["-p", dir]);
    execFileSync("sh", ["-c", `printf 'mine' > "${foreign}"`]);

    const out = run(["--target", "claude-code", "--dest", dir]);
    assert.equal(readFileSync(foreign, "utf8"), "mine");
    assert.ok(out.includes("keep"), "没有报 keep");
  } finally {
    done();
  }
});
