#!/usr/bin/env node
// 离线自检：路由表是否都指向真实文件、正文里的相对链接是否悬空、
// 展示层引用的图片是否齐全、scripts/upstream.json 记录的文件是否还在。
//
//   node scripts/verify-package.mjs
//
// 只读本地文件，不联网、不依赖任何 npm 包。发现问题时退出码为 1。

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);

const failures = [];
const notes = [];

function fail(where, message) {
  failures.push(`${where}: ${message}`);
}

async function readJson(relative) {
  const file = path.join(root, relative);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(relative, `无法解析 JSON（${error.message}）`);
    return null;
  }
}

function isExternal(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference);
}

function toLocalPath(reference) {
  const clean = reference.split("#")[0].split("?")[0];
  return clean;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function resolveInside(baseDir, reference) {
  const target = path.resolve(baseDir, toLocalPath(reference));
  if (!target.startsWith(root + path.sep) && target !== root) return null;
  return target;
}

// 1. 入口 SKILL.md 的路由表
const skillFile = path.join(root, "SKILL.md");
let skillBody = "";
try {
  skillBody = await readFile(skillFile, "utf8");
} catch (error) {
  fail("SKILL.md", `读不到入口正文（${error.message}）`);
}

const routeTargets = [...skillBody.matchAll(/\]\((references\/skills\/[^)\s]+\.md)\)/g)].map((m) => m[1]);
if (routeTargets.length === 0) {
  fail("SKILL.md", "路由表里没有识别到任何 references/skills/*/SKILL.md 目标");
}
for (const target of routeTargets) {
  if (!existsSync(path.join(root, target))) fail("SKILL.md", `路由目标不存在：${target}`);
}
notes.push(`路由目标 ${routeTargets.length} 条`);

// 2. 包内 Markdown 的相对链接与 .md 引用
//
// 只有运行时会真正跟随的文档才算严格：SKILL.md、references/、agents/。
// README / NOTICE 里的仓库路径（docs/adr/...）是写给源码读者的，安装后不落地，仅作提示。
const strictPrefixes = ["references/", "agents/"];
const markdownFiles = (await walk(root)).filter((file) => file.endsWith(".md"));
let docOnlyReferences = 0;

for (const file of markdownFiles) {
  const where = path.relative(root, file).split(path.sep).join("/");
  const strict = where === "SKILL.md" || strictPrefixes.some((prefix) => where.startsWith(prefix));
  const body = await readFile(file, "utf8");
  const references = new Set();

  for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) references.add(match[1]);
  // 行内代码只在看着像路径（带 /）时才算引用，避免把正文提到的文件名当链接。
  for (const match of body.matchAll(/`([A-Za-z0-9_./-]+\/[A-Za-z0-9_./-]*\.md)`/g)) references.add(match[1]);

  // agents/ 下的路径约定相对技能根目录，其余相对文件自身目录。
  const baseDir = where.startsWith("agents/") ? root : path.dirname(file);

  for (const reference of references) {
    if (isExternal(reference)) continue;
    const target = resolveInside(baseDir, reference);
    if (!target) {
      if (strict) fail(where, `引用逃出技能包：${reference}`);
      continue;
    }
    if (existsSync(target)) continue;
    if (strict) fail(where, `悬空引用：${reference}`);
    else docOnlyReferences += 1;
  }
}

if (docOnlyReferences > 0) {
  notes.push(`顶层文档中的仓库路径 ${docOnlyReferences} 处（安装后不落地，不计为错误）`);
}

// 3. 展示层：detail / detail.zh / ability.json 引用的本地资源
const presentationFiles = ["ability.json", "detail.json", "detail.zh.json"];
for (const relative of presentationFiles) {
  const data = await readJson(relative);
  if (!data) continue;
  const candidates = [];

  if (typeof data.icon === "string" && !data.icon.startsWith("solar:") && !/^https?:/i.test(data.icon)) {
    candidates.push(data.icon);
  }

  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && (key === "src" || key === "icon") && !value.startsWith("solar:") && !/^https?:/i.test(value)) {
        candidates.push(value);
      } else if (typeof value === "string" && key === "path" && /\.(?:json|md)$/.test(value)) {
        candidates.push(value);
      } else {
        visit(value);
      }
    }
  };
  visit(data.blocks);
  visit(data.detail);

  for (const candidate of candidates) {
    if (!existsSync(path.join(root, candidate))) fail(relative, `引用的文件不存在：${candidate}`);
  }
}

// 4. scripts/upstream.json 记录的文件是否都还在（记录本地路径 -> 上游路径）
const upstream = await readJson(path.join("scripts", "upstream.json"));
if (upstream) {
  const recorded = Object.keys(upstream.files ?? {});
  for (const local of recorded) {
    if (!existsSync(path.join(root, local))) fail("scripts/upstream.json", `台账记录的文件已不存在：${local}`);
  }
  // 改造过 / 重新实现的条目也要有落点：台账声称包里有这个文件。
  const derived = [...Object.keys(upstream.adapted ?? {}), ...Object.keys(upstream.reimplemented ?? {})];
  for (const local of derived) {
    if (!existsSync(path.join(root, local))) fail("scripts/upstream.json", `台账登记的改造文件不存在：${local}`);
    if (recorded.includes(local)) fail("scripts/upstream.json", `${local} 同时出现在 files 与 adapted/reimplemented`);
  }
  notes.push(`台账 ${recorded.length} 条逐字节 + ${derived.length} 条已改造`);
}

// 5. 介绍页的本地资源
const previewHtml = path.join(root, "assets/preview/index.html");
if (!existsSync(previewHtml)) {
  fail("assets/preview/index.html", "介绍页缺失");
} else {
  const html = await readFile(previewHtml, "utf8");
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const asset of assets) {
    if (/^data:/i.test(asset)) continue;
    if (isExternal(asset)) fail("assets/preview/index.html", `残留外部引用：${asset.slice(0, 60)}`);
  }

  // 内联图：不依赖任何旁边文件，但必须真的是非空 PNG，否则页面会静默空白。
  const inline = [...html.matchAll(/src="data:image\/(png|jpeg|svg\+xml);base64,([^"]+)"/g)];
  for (const [, kind, payload] of inline) {
    const bytes = Buffer.from(payload, "base64");
    if (bytes.length < 256) fail("assets/preview/index.html", `内联图过小或损坏（${kind}，${bytes.length} 字节）`);
    if (kind === "png" && bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      fail("assets/preview/index.html", "内联图声明为 PNG，实际不是 PNG 签名");
    }
  }

  const locals = new Set([...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]));
  for (const local of locals) {
    if (!existsSync(path.join(path.dirname(previewHtml), toLocalPath(local)))) {
      fail("assets/preview/index.html", `本地资源不存在：${local}`);
    }
  }

  if (locals.size === 0 && inline.length === 0) {
    fail("assets/preview/index.html", "既没有本地资源引用，也没有内联图");
  }
  notes.push(`介绍页：内联图 ${inline.length} 张、同目录资源 ${locals.size} 处`);
}

// 6. 必备脚本
for (const required of ["scripts/open-preview.sh", "scripts/open-preview.ps1", "scripts/sync-upstream.mjs"]) {
  if (!existsSync(path.join(root, required))) fail(required, "脚本缺失");
  else {
    const info = await stat(path.join(root, required));
    if (info.size === 0) fail(required, "脚本为空");
  }
}

// 6.5 内层 SKILL.md 的隔离清单。宿主递归扫目录，凡见到 SKILL.md 就当一条独立技能；
// 十份规程与上游同名，就必须有忽略清单把它们挡在发现之外。
const innerSkills = [];
const walkInner = async (relative) => {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await walkInner(child);
    else if (entry.name === "SKILL.md") innerSkills.push(child);
  }
};
await walkInner("references");

if (innerSkills.length > 0) {
  const ignorePath = path.join(root, "references/skills/.ignore");
  if (!existsSync(ignorePath)) {
    fail("references/skills/.ignore", `缺失：${innerSkills.length} 份正文 SKILL.md 会被再注册成独立技能`);
  } else {
    const patterns = (await readFile(ignorePath, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => `references/skills/${line.replace(/^\//, "")}`);
    const matchers = patterns.map(
      (glob) =>
        new RegExp(
          `^${glob
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, "\u0000")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, "[^/]")
            .replace(/\u0000/g, ".*")}$`,
        ),
    );
    const exposed = innerSkills.filter((file) => !matchers.some((re) => re.test(file)));
    for (const file of exposed) fail("references/skills/.ignore", `未覆盖：${file}（宿主会把它当一条独立技能）`);
    if (exposed.length === 0) notes.push(`内层正文 ${innerSkills.length} 份，均被忽略清单隔离`);
  }
}

// 7. agents 简报
const agentsDir = path.join(root, "agents");
if (!existsSync(agentsDir)) {
  fail("agents/", "目录缺失");
} else {
  const agents = (await readdir(agentsDir)).filter((name) => name.endsWith(".md"));
  if (agents.length === 0) fail("agents/", "没有任何角色简报");
  notes.push(`角色简报 ${agents.length} 份`);
}

// 8. 跨平台接入：hooks、commands、落点表
//
// 这三样不是 Astravia 的运行依赖，但它们会被复制到别的宿主并真的执行，
// 所以断链、路径没改、命令指向不存在的规程都算错误。
const hooksDir = path.join(root, "hooks");
const hooksJsonPath = path.join(hooksDir, "hooks.json");

if (!existsSync(hooksJsonPath)) {
  fail("hooks/hooks.json", "缺失：会话启动注入没有配置入口");
} else {
  const hooksConfig = await readJson(path.join("hooks", "hooks.json"));
  const declared = hooksConfig?.hooks?.SessionStart?.[0]?.hooks?.[0];

  if (hooksConfig && !declared) {
    fail("hooks/hooks.json", "没有声明 SessionStart 命令");
  } else if (declared) {
    if (declared.type !== "command") fail("hooks/hooks.json", `hook 类型应为 command，实际 ${declared.type}`);
    if (!String(declared.command ?? "").includes("run-hook.cmd")) {
      fail("hooks/hooks.json", "命令没有经过 run-hook.cmd 的跨平台外壳");
    }
    const matcher = hooksConfig.hooks.SessionStart[0].matcher ?? "";
    if (!/startup/.test(matcher)) fail("hooks/hooks.json", `matcher 未覆盖 startup：${matcher}`);
  }

  for (const required of ["run-hook.cmd", "session-start", "session-start.ps1"]) {
    if (!existsSync(path.join(hooksDir, required))) fail(`hooks/${required}`, "脚本缺失");
  }

  for (const script of ["session-start", "session-start.ps1"]) {
    const file = path.join(hooksDir, script);
    if (!existsSync(file)) continue;
    const body = await readFile(file, "utf8");
    if (!/references\/skills/.test(body) && !/SKILL\.md/.test(body)) {
      fail(`hooks/${script}`, "没有指向任何 SKILL.md");
    }
    // 入口就是 arming-thought 的替代品；指向一个不存在的内层目录是最容易犯的错。
    if (/references[\\/]skills[\\/]arming-thought/.test(body)) {
      fail(`hooks/${script}`, "注入路径指向 references/skills/arming-thought，该目录不存在（入口是本包根 SKILL.md）");
    }
  }

  const skillPath = path.join(root, "SKILL.md");
  if (!existsSync(skillPath)) fail("SKILL.md", "入口缺失：hook 注入源不存在");
  else notes.push(`hooks：SessionStart 注入 ${(await stat(skillPath)).size} 字节的入口正文`);

  // 真跑一次，确认输出是可解析的 JSON 且带上了路由表。没有 bash 的平台跳过。
  try {
    const { execFileSync } = await import("node:child_process");
    const output = execFileSync("bash", [path.join(hooksDir, "session-start")], { encoding: "utf8" });
    const parsed = JSON.parse(output);
    const context = parsed.additional_context ?? parsed.hookSpecificOutput?.additionalContext ?? "";
    if (!context.includes("references/skills/")) fail("hooks/session-start", "注入内容里没有路由表");
    else notes.push(`hooks/session-start 实跑通过（注入 ${context.length} 字符）`);
  } catch (error) {
    if (error.code !== "ENOENT") fail("hooks/session-start", `实跑失败：${error.message.split("\n")[0]}`);
    else notes.push("hooks/session-start 未实跑（无 bash）");
  }
}

const commandsDir = path.join(root, "commands");
if (!existsSync(commandsDir)) {
  fail("commands/", "目录缺失");
} else {
  const commands = (await readdir(commandsDir)).filter((name) => name.endsWith(".md"));

  if (commands.length !== 10) fail("commands/", `应为十份斜杠命令模板，实际 ${commands.length} 份`);

  for (const name of commands) {
    const body = await readFile(path.join(commandsDir, name), "utf8");
    const declared = body.match(/^name:\s*(\S+)\s*$/m)?.[1];

    if (declared && declared !== name.replace(/\.md$/, "")) {
      fail(`commands/${name}`, `frontmatter name 与文件名不一致：${declared}`);
    }

    const targets = [...body.matchAll(/`(references\/skills\/[a-z-]+\/SKILL\.md)`/g)].map((match) => match[1]);
    if (targets.length === 0) fail(`commands/${name}`, "没有指向 references/skills/<name>/SKILL.md");

    for (const target of targets) {
      if (!existsSync(path.join(root, target))) fail(`commands/${name}`, `指向不存在的规程：${target}`);
    }
  }

  notes.push(`斜杠命令模板 ${commands.length} 份，路径均已改指包内规程`);
}

const catalogPath = path.join(root, "scripts", "platforms.json");
if (!existsSync(catalogPath)) {
  fail("scripts/platforms.json", "缺失：跨平台落点表");
} else {
  const catalog = await readJson(path.join("scripts", "platforms.json"));

  for (const [name, spec] of Object.entries(catalog?.assets ?? {})) {
    if (!existsSync(path.join(root, spec.from))) {
      fail("scripts/platforms.json", `资产 ${name} 的来源不存在：${spec.from}`);
    }
  }

  for (const target of catalog?.targets ?? []) {
    for (const asset of target.assets ?? []) {
      if (!catalog.assets?.[asset]) fail("scripts/platforms.json", `${target.id} 引用了未定义的资产 ${asset}`);
    }
    if (!target.root?.user) fail("scripts/platforms.json", `${target.id} 没有用户级落点`);
    if (target.id === "astravia" && !(target.assets ?? []).includes("skills")) {
      fail("scripts/platforms.json", "astravia 目标必须带上 skills/，否则 .ignore 不会随复制过去");
    }
  }

  // 文档与落点表必须互相认账：声称认某个环境变量，就得真在 rootFor 里实现；
  // 实现了就得写进文档，否则用户不知道那个变量可以把包装到别处。
  const platformDocs = (
    await Promise.all(
      ["PLATFORMS.md", "PLATFORMS.zh.md"].map((doc) =>
        existsSync(path.join(root, doc)) ? readFile(path.join(root, doc), "utf8") : "",
      ),
    )
  ).join("\n");

  const declaredEnvRoots = new Set();

  for (const target of catalog?.targets ?? []) {
    const envRoot = target.root?.envRoot;
    if (!envRoot) continue;
    if (typeof envRoot !== "object" || Array.isArray(envRoot)) {
      fail("scripts/platforms.json", `${target.id} 的 root.envRoot 必须是 { 变量名: 后缀 }`);
      continue;
    }

    for (const [name, suffix] of Object.entries(envRoot)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        fail("scripts/platforms.json", `${target.id} 的 envRoot 键 ${name} 不是环境变量名`);
      }
      if (typeof suffix !== "string" || !suffix || path.isAbsolute(suffix) || suffix.includes("..")) {
        fail("scripts/platforms.json", `${target.id} 的 envRoot.${name} 必须是包内相对后缀`);
      }
      declaredEnvRoots.add(name);
      if (!platformDocs.includes(name)) {
        fail("PLATFORMS.md", `${target.id} 认 ${name}，但两份落点文档都没写`);
      }
    }
  }

  // 宿主自己提供的变量（写进 hook 脚本里用的），不是落点表该实现的。
  const hostProvided = new Set(["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR"]);

  for (const [, name] of platformDocs.matchAll(/\$\{?([A-Z][A-Z0-9_]{2,})\}?/g)) {
    if (hostProvided.has(name) || declaredEnvRoots.has(name)) continue;
    fail("PLATFORMS.md", `文档声称认 $${name}，但落点表没有任何 envRoot 实现它`);
  }

  if (!existsSync(path.join(root, "scripts", "install-platforms.mjs"))) {
    fail("scripts/install-platforms.mjs", "缺失：落点表没有执行者");
  }

  notes.push(`落点表 ${(catalog?.targets ?? []).length} 个宿主目标`);
}

// 9. 案例与结构图：README 直接引用的本地图片必须存在
for (const doc of ["README.md", "README.zh.md", "PLATFORMS.md", "PLATFORMS.zh.md"]) {
  const file = path.join(root, doc);
  if (!existsSync(file)) {
    fail(doc, "缺失");
    continue;
  }

  const body = await readFile(file, "utf8");
  const images = [...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);

  for (const image of images) {
    if (isExternal(image) || image.startsWith("data:")) continue;
    if (!existsSync(path.join(root, toLocalPath(image)))) fail(doc, `图片不存在：${image}`);
  }
}

for (const svg of ["method-structure.svg", "method-structure.zh.svg"]) {
  const file = path.join(root, "assets", "diagram", svg);
  if (!existsSync(file)) {
    fail(`assets/diagram/${svg}`, "缺失");
    continue;
  }
  const body = await readFile(file, "utf8");
  if (!/^\s*<svg[\s>]/.test(body) || !body.trimEnd().endsWith("</svg>")) {
    fail(`assets/diagram/${svg}`, "不是完整的 SVG 文档");
  }
  if (!/viewBox="/.test(body)) fail(`assets/diagram/${svg}`, "缺少 viewBox，缩放会失真");
}

const casesDir = path.join(root, "references", "cases");
if (!existsSync(path.join(casesDir, "README.md"))) {
  fail("references/cases/README.md", "缺失：第三方案例没有声明");
} else if (!existsSync(path.join(casesDir, "tangping-editorial-perspective.md"))) {
  fail("references/cases/tangping-editorial-perspective.md", "缺失");
} else {
  notes.push("案例：1 份第三方文本 + 声明");
}

// 测试目录：只报状态。分发产物按仓库规则排除 tests/，所以缺失不算错误。
const testsDir = path.join(root, "tests");
if (!existsSync(testsDir)) {
  notes.push("未附带 tests/（分发产物按仓库规则排除该目录）");
} else {
  const suites = (await readdir(testsDir)).filter((name) => name.endsWith(".test.mjs"));
  if (suites.length === 0) fail("tests/", "没有 *.test.mjs 文件");
  notes.push(`包内测试 ${suites.length} 份`);
}

// 输出
console.log(`检查目录：${root}`);
for (const note of notes) console.log(`  · ${note}`);

if (failures.length === 0) {
  console.log("结果：全部通过（0 处问题）");
  process.exit(0);
}

console.log(`结果：${failures.length} 处问题`);
for (const item of failures) console.log(`  ✕ ${item}`);
process.exit(1);
