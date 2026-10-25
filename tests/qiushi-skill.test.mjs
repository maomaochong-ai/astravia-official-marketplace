// 图文页只存在一份：在技能包里，由使用者直接打开。详情页不得再内嵌它的截图。
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const skillDir = resolve(root, "abilities/skills/qiushi-skill");
const skillPage = resolve(skillDir, "assets/preview/index.html");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

test("图文页随包分发，正文完整且不依赖外部资源", () => {
  assert.ok(existsSync(skillPage), "缺 assets/preview/index.html");
  assert.ok(statSync(skillPage).size > 60_000, "页面太小，可能被截断了");

  const page = readFileSync(skillPage, "utf8");
  assert.ok(page.includes("求是方法论"), "页面里没有正文");
  assert.ok(!/<script[^>]+src=/i.test(page), "页面不应外链脚本，否则离线打开会缺东西");
  assert.ok(!/<img[^>]+src=["'](?!#|data:)/i.test(page), "图片应内联，外链图片离线打不开");
});

test("技能详情页不再内嵌截图，两种语言都指向页面文件", () => {
  for (const file of ["detail.json", "detail.zh.json"]) {
    const detail = readJson(resolve(skillDir, file));
    const blocks = JSON.stringify(detail);
    assert.ok(!blocks.includes("preview-hero.png"), `${file} 仍在嵌截图`);
    assert.ok(blocks.includes("assets/preview/index.html"), `${file} 没有说明那页在哪`);
  }
});

// 命令区、技能胶囊与能力页统一读 SKILL.md 的 metadata.astravia.presentation.icon；
// 只写 ability.json 的 icon 不会让已安装的技能显示出品牌图。
test("SKILL.md 声明了图标，且指向包内真实图片", () => {
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

test("市场索引登记了这一条，版本与包内三份声明一致", () => {
  const catalog = readJson(resolve(root, ".astravia/marketplace.source.json"));
  const entry = catalog.abilities.find((ability) => ability.slug === "qiushi-skill");
  assert.ok(entry, "市场索引缺少 qiushi-skill");

  const ability = readJson(resolve(skillDir, "ability.json"));
  assert.equal(entry.version, ability.version, "索引与 ability.json 版本不一致");
  assert.equal(entry.slug, ability.slug);

  const frontmatter = readFileSync(resolve(skillDir, "SKILL.md"), "utf8").split(/^---$/m)[1];
  assert.match(frontmatter, new RegExp(`^version:\\s*${entry.version.replaceAll(".", "\\.")}\\s*$`, "m"), "SKILL.md 的 version 与索引不一致");
});
