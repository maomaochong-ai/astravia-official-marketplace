#!/usr/bin/env node
/**
 * 文案目录门禁。
 *
 * 为什么需要它：SDK 的 `t()` 在缺 key 时**原样返回 key**，所以漏译在界面上表现为
 * 一行 `diag.upstream` 这样的原文——它不会报错，只会一直难看地留在那里（本文件
 * 就是因为它才存在）。手工比对两份 185 行的目录不可靠，让 `npm test` 比对。
 *
 * 检查四件事：
 *   1. 源码里写死的 key（`t("x.y")` 与 `t(`x.${v}`)` 的前缀）在两份目录里都存在；
 *   2. en / zh 键集合完全相同——任一侧多写等于另一侧缺译；
 *   3. 每个 MCP 工具都有 `tool.<name>.description`。工具名来自插件自己的
 *      `server/src/mcp-tool-catalog.ts`，新增工具忘了写文案就是这里失败；
 *   4. en 目录里不许出现中文。`defaultLocale` 是 zh，en 缺键会回退到中文，
 *      所以「只写 zh」的方案不成立；反过来中文写进默认语言会漏给英文界面。
 *
 * 动态 key（`tab.${item}`）不做穷举，只要求该前缀至少有一条存在——穷举需要解析
 * 枚举值，那是 `tab.` 与 `tools.group.` 这类前缀自己的事，写错时前缀检查仍会失败。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(root, "locales/en.json"), "utf8")),
  zh: JSON.parse(fs.readFileSync(path.join(root, "locales/zh.json"), "utf8")),
};
const failures = [];
const checks = [];

/** 源码里出现 `t(` 的地方。只读 src/：server 侧的 shim 不参与界面文案。 */
function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

const CJK = /[\u4e00-\u9fff]/;
const used = new Map();
const prefixes = new Map();

for (const file of walk(path.join(root, "src"))) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  // 字面量：t("diag.upstream") / t('diag.upstream')
  for (const match of text.matchAll(/\bt\(\s*(["'])([^"'`$]+)\1/g)) {
    used.set(match[2], relative);
  }
  // 模板前缀：t(`tab.${item}`) → tab.
  for (const match of text.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) {
    prefixes.set(match[1], relative);
  }
}

for (const [key, where] of used) {
  for (const [locale, catalog] of Object.entries(locales)) {
    if (!(key in catalog)) failures.push(`${where}：${locale} 缺少键 ${key}`);
  }
}
checks.push(`源码写死的键 ${used.size} 个，全部命中两份目录`);

for (const [prefix, where] of prefixes) {
  const hits = Object.keys(locales.en).filter((key) => key.startsWith(prefix));
  if (hits.length === 0) failures.push(`${where}：动态前缀 ${prefix} 在两份目录里都没有条目`);
}
checks.push(`动态前缀 ${prefixes.size} 个，均有可用条目`);

const enKeys = Object.keys(locales.en).sort();
const zhKeys = Object.keys(locales.zh).sort();
const onlyEn = enKeys.filter((key) => !(key in locales.zh));
const onlyZh = zhKeys.filter((key) => !(key in locales.en));
for (const key of onlyEn) failures.push(`zh 缺少键 ${key}（en 有）`);
for (const key of onlyZh) failures.push(`en 缺少键 ${key}（zh 有）`);
checks.push(`键集合对齐：en ${enKeys.length} / zh ${zhKeys.length}`);

const toolCatalog = fs.readFileSync(path.join(root, "server/src/mcp-tool-catalog.ts"), "utf8");
const toolNames = [...toolCatalog.matchAll(/^\s{4}name:\s*"([a-z0-9_]+)"/gm)].map((match) => match[1]);
if (toolNames.length === 0) failures.push("server/src/mcp-tool-catalog.ts：没有解析到任何工具名");
for (const name of toolNames) {
  const key = `tool.${name}.description`;
  for (const [locale, catalog] of Object.entries(locales)) {
    if (!catalog[key]) failures.push(`${locale} 缺少工具描述 ${key}`);
  }
}
checks.push(`MCP 工具 ${toolNames.length} 个，描述齐全`);

for (const [key, value] of Object.entries(locales.en)) {
  if (value === "") failures.push(`en：${key} 是空字符串`);
  // 上游专有名词（如「知乎」）没有英文写法时才允许例外，加进白名单而不是放宽整条规则。
  else if (CJK.test(value)) failures.push(`en：${key} 含中文（默认语言必须是英文）`);
}
for (const [key, value] of Object.entries(locales.zh)) {
  if (value === "") failures.push(`zh：${key} 是空字符串`);
}
checks.push("默认语言（en）无中文，无空值");

for (const check of checks) console.log(`  · ${check}`);

if (failures.length > 0) {
  console.error(`\n文案门禁未通过（${failures.length} 项）：`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`文案门禁通过（${enKeys.length} 个键，${toolNames.length} 个工具）`);
