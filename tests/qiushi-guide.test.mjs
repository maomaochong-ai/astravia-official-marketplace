// The illustrated page exists twice: once inside the skill (where a human opens it by
// hand) and once inside the guide plugin (where the detail slot renders it). They must
// stay byte-identical, and the skill must not go back to embedding a screenshot.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const skillPage = resolve(root, "abilities/skills/qiushi-skill/assets/preview/index.html");
const pluginPage = resolve(root, "abilities/plugins/qiushi-guide/src/assets/preview-page.html");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("图文页在技能包与导览插件里是同一份字节", () => {
  assert.ok(existsSync(skillPage), "缺 assets/preview/index.html");
  assert.ok(existsSync(pluginPage), "缺插件内的页面副本，跑 npm run sync:preview");
  assert.equal(digest(pluginPage), digest(skillPage), "两份页面不一致：重新跑 sync-preview-page.mjs");
  assert.ok(statSync(skillPage).size > 60_000, "页面太小，可能被截断了");
});

test("插件把页面打进构建产物，而不是运行时去读技能目录", () => {
  const page = readFileSync(pluginPage, "utf8");
  assert.ok(page.includes("求是方法论"), "副本里没有正文");
  assert.ok(!/<script[^>]+src=/i.test(page), "页面不应外链脚本，否则离线打开会缺东西");

  const importer = readFileSync(
    resolve(root, "abilities/plugins/qiushi-guide/src/features/illustrated-guide/preview-page.ts"),
    "utf8",
  );
  assert.ok(importer.includes("?raw"), "页面应以 ?raw 字符串导入并随包分发");
});

test("技能详情页不再内嵌截图，两种语言都指向导览入口", () => {
  for (const file of ["detail.json", "detail.zh.json"]) {
    const detail = readJson(resolve(root, "abilities/skills/qiushi-skill", file));
    const blocks = JSON.stringify(detail);
    assert.ok(!blocks.includes("preview-hero.png"), `${file} 仍在嵌截图`);
    assert.ok(blocks.includes("assets/preview/index.html"), `${file} 没有说明那页在哪`);
  }
});

// 命令区、技能胶囊与能力页统一读 SKILL.md 的 metadata.astravia.presentation.icon；
// 只写 ability.json 的 icon 不会让已安装的技能显示出品牌图。
test("SKILL.md 声明了图标，且指向包内真实图片", () => {
  const skillDir = resolve(root, "abilities/skills/qiushi-skill");
  const text = readFileSync(resolve(skillDir, "SKILL.md"), "utf8");
  const frontmatter = text.split(/^---$/m)[1];
  assert.ok(frontmatter, "SKILL.md 缺少 frontmatter");

  const match = frontmatter.match(/^\s+icon:\s*(\S+)\s*$/m);
  assert.ok(match, "缺少 metadata.astravia.presentation.icon，宿主只能显示默认方块图");
  assert.ok(/^metadata:[\s\S]*^\s+astravia:[\s\S]*^\s+presentation:/m.test(frontmatter), "icon 必须挂在 metadata.astravia.presentation 下");

  const iconPath = resolve(skillDir, match[1]);
  assert.ok(existsSync(iconPath), `图标文件不存在：${match[1]}`);
  assert.ok(/^\.[a-z]+$/i.test(iconPath.slice(iconPath.lastIndexOf("."))), "图标需要带扩展名");
  assert.ok(statSync(iconPath).size <= 8 * 1024 * 1024, "图标超过 8 MB 上限");
});

// scripts/marketplace.mjs 的本地构建会临时把 @astravia-org/* 改写成 file: 路径再还原。
// 还原这一步在构建抛错时会被跳过，于是 file: 路径会留在源码里被一起提交——
// 那不是插件该有的声明形态，也会让任何没有 .tooling 的环境 npm ci 直接失败。
test("插件依赖一律写版本号，不能留下构建期的 file: 路径", () => {
  const dir = resolve(root, "abilities/plugins/qiushi-guide");
  for (const file of ["package.json", "package-lock.json"]) {
    const manifest = readJson(resolve(dir, file));
    const declared =
      file === "package.json" ? manifest.devDependencies ?? {} : manifest.packages?.[""]?.devDependencies ?? {};
    for (const [name, range] of Object.entries(declared)) {
      if (!name.startsWith("@astravia-org/")) continue;
      assert.ok(
        !String(range).startsWith("file:"),
        `${file} 里 ${name} 写成了 ${range}；构建副作用泄漏进了源码，改回带版本号的范围`,
      );
    }
  }
});

test("市场索引里两件能力各自登记，版本与包内清单一致", () => {
  const catalog = readJson(resolve(root, ".astravia/marketplace.source.json"));
  const bySlug = new Map(catalog.abilities.map((ability) => [ability.slug, ability]));

  const skill = bySlug.get("qiushi-skill");
  const guide = bySlug.get("qiushi-guide");
  assert.ok(skill && guide, "市场索引缺少 qiushi-skill 或 qiushi-guide");

  for (const [entry, path] of [
    [skill, "abilities/skills/qiushi-skill/ability.json"],
    [guide, "abilities/plugins/qiushi-guide/ability.json"],
  ]) {
    const manifest = readJson(resolve(root, path));
    assert.equal(entry.version, manifest.version, `${entry.slug} 的版本与包内不一致`);
    assert.equal(entry.slug, manifest.slug);
  }

  const pluginJson = readJson(resolve(root, "abilities/plugins/qiushi-guide/plugin.json"));
  assert.equal(pluginJson.version, guide.version, "plugin.json 与索引版本不一致");
  assert.ok(pluginJson.permissions.includes("ui.slot.ability-detail"), "插槽权限缺失，详情页不会出现入口");
});
