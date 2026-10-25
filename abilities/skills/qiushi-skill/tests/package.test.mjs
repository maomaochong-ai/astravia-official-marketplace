/**
 * Package structure tests for the qiushi-skill market entry.
 *
 * These run against the source tree only — no network, no install, no host.
 *   node --test tests/*.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel) => existsSync(path.join(ROOT, rel));

const SLUG = "qiushi-skill";

/** Ten downstream playbooks: the routing surface the entry promises. */
const PLAYBOOKS = [
  "contradiction-analysis",
  "practice-cognition",
  "investigation-first",
  "mass-line",
  "criticism-self-criticism",
  "protracted-strategy",
  "concentrate-forces",
  "spark-prairie-fire",
  "overall-planning",
  "workflows",
];

/**
 * Sibling reference files that must ship next to their playbook.
 * Upstream has no original-texts.md for `workflows`, so it is not expected here either.
 */
const WITH_SOURCE_TEXTS = PLAYBOOKS.filter((slug) => slug !== "workflows");
const REFERENCES = [
  "contradiction-analysis/contradiction-types-reference.md",
  "criticism-self-criticism/review-checklist.md",
  "protracted-strategy/phase-assessment-guide.md",
  ...WITH_SOURCE_TEXTS.map((slug) => `${slug}/original-texts.md`),
];

function frontmatter(file) {
  const text = read(file);
  assert.ok(text.startsWith("---\n"), `${file} 缺少 frontmatter`);
  const end = text.indexOf("\n---", 4);
  assert.ok(end > 0, `${file} 的 frontmatter 没有闭合`);
  const lines = text.slice(4, end).split("\n");
  const fields = {};
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^([a-zA-Z_]+):\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, inline] = match;
    if (inline === "|" || inline === ">") {
      // 块标量：把后续缩进行收进来，否则 description 会被读成 "|"
      const block = [];
      while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1] === "")) {
        block.push(lines[i + 1].trim());
        i += 1;
      }
      fields[key] = block.join(" ").trim();
    } else {
      fields[key] = inline.trim();
    }
  }
  return { fields, rest: text.slice(end + 4) };
}

function walk(rel, out = []) {
  const abs = path.join(ROOT, rel);
  for (const name of readdirSync(abs)) {
    const child = path.join(rel, name);
    if (statSync(path.join(ROOT, child)).isDirectory()) walk(child, out);
    else out.push(child);
  }
  return out;
}

const ability = JSON.parse(read("ability.json"));
const ledger = JSON.parse(read("scripts/upstream.json"));

test("入口 SKILL.md 的身份与包一致", () => {
  const { fields } = frontmatter("SKILL.md");
  assert.equal(fields.name, SLUG, "frontmatter name 必须等于包 slug");
  assert.equal(fields.version, ability.version, "frontmatter version 必须等于 ability.json 的 version");
  assert.ok(fields.description && fields.description.length > 20, "description 不能空");
  // 命令面板与技能胶囊显示的是 alias；缺省时用户看到的是英文 slug 或市场英文名。
  assert.ok(fields.alias && fields.alias.trim().length > 0, "frontmatter 必须声明 alias，否则命令区显示英文名");
  assert.ok(
    read("SKILL.md").includes("metadata:\n  astravia:\n    presentation:\n      icon:"),
    "必须声明 metadata.astravia.presentation.icon，否则宿主显示默认方块图",
  );
});

test("ability.json 身份与展示字段自洽", () => {
  assert.equal(ability.type, "skill");
  assert.equal(ability.slug, SLUG);
  assert.match(ability.version, /^\d+\.\d+\.\d+$/);
  assert.ok(ability.icon, "缺少卡片图标");
  assert.ok(has(ability.icon), `图标文件不存在：${ability.icon}`);
  assert.equal(ability.category, "Productivity");
  assert.equal(ability.categoryI18n.zh, "效率");
  assert.equal(ability.categoryI18n.en, "Productivity");
});

test("展示名称不带能力类型后缀", () => {
  const banned = /\b(?:mcp|skill|plugin|bundle)\b|技能|插件|套装/iu;
  const names = [ability.name, ...Object.values(ability.detail?.i18n ?? {}).map((v) => v.name)];
  for (const name of names.filter(Boolean)) assert.ok(!banned.test(name), `名称含类型后缀：${name}`);
});

test("十份规程都在，且入口路由表逐条指向它们", () => {
  const entry = read("SKILL.md");
  for (const slug of PLAYBOOKS) {
    const rel = `references/skills/${slug}/SKILL.md`;
    assert.ok(has(rel), `缺少规程：${rel}`);
    assert.ok(entry.includes(rel), `入口路由表没有指向 ${rel}`);
    const { fields } = frontmatter(rel);
    assert.ok(fields.name, `${rel} 缺少 frontmatter name`);
  }
});

test("内层 SKILL.md 与上游同名，但被忽略清单挡在技能发现之外", () => {
  const playbooks = walk("references").filter((p) => path.basename(p) === "SKILL.md");
  assert.equal(playbooks.length, PLAYBOOKS.length, "十份规程都应以 SKILL.md 命名，与上游一致");

  const ignoreFile = "references/skills/.ignore";
  assert.ok(has(ignoreFile), `缺少 ${ignoreFile}：没有它宿主会把十份正文各注册成一条技能`);
  const patterns = read(ignoreFile)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(patterns, ["*/SKILL.md"], "忽略清单只挡正文文件，不要连目录一起挡");

  // 宿主把每层忽略文件的规则整体加上该目录前缀，等价于 references/skills/*/SKILL.md
  const re = /^references\/skills\/[^/]+\/SKILL\.md$/;
  const missed = playbooks.filter((rel) => !re.test(rel));
  assert.deepEqual(missed, [], "这些正文没有被忽略清单覆盖，会被再注册成独立技能");
});

test("十二份参考文件与各自规程同目录", () => {
  for (const rel of REFERENCES) {
    const full = `references/skills/${rel}`;
    assert.ok(has(full), `缺少参考文件：${full}`);
    assert.ok(statSync(path.join(ROOT, full)).size > 0, `${full} 是空文件`);
  }
});

test("上游台账的每条映射都指向真实文件", () => {
  assert.match(ledger.revision, /^[0-9a-f]{40}$/, "revision 必须是 40 位 commit");
  assert.match(ledger.repository, /^https:\/\/github\.com\//);
  const entries = Object.entries(ledger.files);
  assert.equal(entries.length, 27, "台账应有 27 条映射（入口 1 + 规程 10 + 参考 12 + LICENSE + hooks 2 + 案例 1）");
  for (const [local, upstream] of entries) {
    assert.ok(has(local), `台账里的本地文件不存在：${local}`);
    assert.ok(upstream && !upstream.startsWith("/"), `上游路径不合法：${upstream}`);
  }
  assert.ok(ledger.adaptations.length >= 14, "改造清单过短，无法追溯与上游的差异");
});

// 本仓库新增、上游没有对应物的文件，不要求台账条目。
const LOCAL_ONLY = new Set(["references/skills/.ignore", "references/cases/README.md"]);

test("references/ 里每个文件都有台账条目（本仓库新增的忽略清单除外）", () => {
  const tracked = new Set(Object.keys(ledger.files));
  const missing = walk("references").filter((p) => !tracked.has(p) && !LOCAL_ONLY.has(p));
  assert.deepEqual(missing, [], "这些文件没有上游出处记录");
  assert.equal(ledger.files["references/skills/.ignore"], undefined, "忽略清单是本仓库新增的，不应被记成上游文件");
});

test("detail 文件可解析，区块类型与链接合法", () => {
  const allowed = new Set([
    "hero", "feature-grid", "steps", "showcase", "image", "callout", "markdown", "links",
  ]);
  for (const file of ["detail.json", "detail.zh.json"]) {
    const detail = JSON.parse(read(file));
    assert.ok(Array.isArray(detail.blocks) && detail.blocks.length > 0, `${file} 没有区块`);
    for (const block of detail.blocks) {
      assert.ok(allowed.has(block.type), `${file} 用了不支持的区块类型：${block.type}`);
      for (const link of block.items ?? []) {
        if (link.href) assert.match(link.href, /^https?:\/\//, `${file} 的链接不是 http(s)：${link.href}`);
      }
    }
  }
});

// showcase 模板是 h-44 + overflow-hidden + line-clamp-3，超出的文字会被圆角容器裁掉。
// 这里按容器的实际容量上限卡住文案，避免再次出现「字看不全」。
test("showcase 文案不超过 chat-thread 容器的可见高度", () => {
  const limits = { "detail.json": 170, "detail.zh.json": 80 };
  for (const [file, limit] of Object.entries(limits)) {
    const detail = JSON.parse(read(file));
    const showcase = detail.blocks.find((block) => block.type === "showcase");
    assert.ok(showcase, `${file} 没有 showcase 区块`);
    const reply = showcase.showcase.assistant_reply ?? "";
    const prompt = showcase.showcase.user_prompt ?? "";
    assert.ok(reply.length > 0 && reply.length <= limit, `${file} 的 assistant_reply ${reply.length} 字符，超过 ${limit}（会被裁切）`);
    assert.ok(prompt.length <= limit, `${file} 的 user_prompt ${prompt.length} 字符，超过 ${limit}（会被裁切）`);
  }
});

test("详情页不再内嵌宣传页截图，只说明页面文件本身", () => {
  // 截图会随页面改版变旧，也让详情页把一份 76 KB 的页面压缩成一张首屏图。
  // 页面文件随包分发，详情只交代怎么打开它。
  const page = path.join(ROOT, "assets/preview/index.html");
  assert.ok(statSync(page).size > 1024, "assets/preview/index.html 不存在或过小");

  for (const file of ["detail.json", "detail.zh.json"]) {
    const detail = JSON.parse(read(file));
    const screenshots = detail.blocks.filter(
      (block) => block.type === "image" && (block.src ?? "").includes("preview"),
    );
    assert.deepStrictEqual(screenshots, [], `${file} 又把宣传页截图放回详情了`);

    const steps = detail.blocks.filter((block) => block.type === "steps").flatMap((block) => block.items ?? []);
    assert.ok(
      steps.some((item) => (item.description ?? "").includes("assets/preview/index.html")),
      `${file} 没有说明怎么打开 assets/preview/index.html`,
    );
  }
});

test("许可证与出处文件齐备", () => {
  assert.ok(has("LICENSE"), "缺少上游 LICENSE");
  assert.match(read("LICENSE"), /MIT License/);
  const notice = read("NOTICE.md");
  assert.match(notice, /qiushi-skill/, "NOTICE 应写明上游项目");
  assert.match(notice, /MIT/);
});

// ---- hooks / commands / 跨宿主落点 ---------------------------------------------------------------

const HOOK_FILES = ["hooks/hooks.json", "hooks/run-hook.cmd", "hooks/session-start", "hooks/session-start.ps1"];

test("hooks 四件齐备，注入路径指向包根入口", () => {
  for (const file of HOOK_FILES) assert.ok(has(file), `缺少 ${file}`);

  const def = JSON.parse(read("hooks/hooks.json"));
  const sessionStart = def.hooks?.SessionStart;
  assert.ok(Array.isArray(sessionStart) && sessionStart.length > 0, "hooks.json 没有 SessionStart 段");
  const command = sessionStart[0].hooks?.[0]?.command ?? "";
  assert.match(command, /run-hook\.cmd/, "SessionStart 应经 run-hook.cmd 派发");

  for (const script of ["hooks/session-start", "hooks/session-start.ps1"]) {
    const text = read(script);
    assert.ok(!text.includes("references/skills/arming-thought"), `${script} 仍指向不存在的内层入口`);
    assert.match(text, /SKILL\.md/, `${script} 没有指向包根 SKILL.md`);
  }
});

test("commands 与十份规程一一对应，路径指向 references/", () => {
  const files = readdirSync(path.join(ROOT, "commands")).filter((name) => name.endsWith(".md"));
  assert.deepEqual(files.map((n) => n.replace(/\.md$/, "")).sort(), [...PLAYBOOKS].sort());
  for (const slug of PLAYBOOKS) {
    const text = read(`commands/${slug}.md`);
    assert.ok(text.startsWith("---\n"), `commands/${slug}.md 缺少 frontmatter`);
    assert.ok(text.includes(`references/skills/${slug}/SKILL.md`), `commands/${slug}.md 没有指向 references/skills/${slug}/SKILL.md`);
    const stripped = text.replace(/references\/skills\//g, "");
    assert.ok(!/skills\//.test(stripped), `commands/${slug}.md 残留上游 skills/ 路径`);
  }
});

test("platforms.json 的每个目标只引用包里已有的资产", () => {
  const table = JSON.parse(read("scripts/platforms.json"));
  const targets = table.targets ?? [];
  assert.ok(targets.length >= 7, "宿主目标过少，应覆盖 claude-code / cursor / codex / opencode 等");

  for (const [key, asset] of Object.entries(table.assets ?? {})) {
    assert.ok(has(asset.from), `资产 ${key} 的来源不存在：${asset.from}`);
  }
  for (const target of targets) {
    assert.ok(target.id, "目标缺少 id");
    assert.ok(target.root?.user, `${target.id} 缺少 user 级落点`);
    assert.ok(Array.isArray(target.assets) && target.assets.length > 0, `${target.id} 没有要复制的资产`);
    for (const key of target.assets) {
      assert.ok(table.assets[key], `${target.id} 引用了未定义的资产：${key}`);
    }
  }
  assert.ok(!table.targets.some((t) => t.assets.includes("hooks") && t.kind === "skills"),
    "钩子只能落在能读 hooks/ 的宿主里，普通 skills 目录不留 hooks");
});

test("第三方文章随包分发，并带出处声明", () => {
  const article = "references/cases/tangping-editorial-perspective.md";
  assert.ok(has(article), `缺少 ${article}`);
  assert.ok(statSync(path.join(ROOT, article)).size > 8000, `${article} 内容不完整`);
  const notice = read("references/cases/README.md");
  assert.match(notice, /tangping|躺平/i, "声明应说明这篇文章讲什么");
});

test("README 的插图与结构图都在包里", () => {
  for (const file of ["README.md", "README.zh.md"]) {
    const text = read(file);
    const images = [...text.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(images.length >= 2, `${file} 头部缺少插图`);
    for (const src of images) {
      if (/^https?:/.test(src)) continue;
      assert.ok(has(src), `${file} 引用了包里不存在的图：${src}`);
    }
    assert.ok(images.some((src) => src.includes("assets/logo")), `${file} 缺少字标`);
    assert.match(text, /assets\/preview\/index\.html/, `${file} 没有进入介绍页的入口`);
    assert.ok(text.includes("assets/diagram/method-structure"), `${file} 的结构图没有改成矢量图`);
  }
});
