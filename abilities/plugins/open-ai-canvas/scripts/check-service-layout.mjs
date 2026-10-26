#!/usr/bin/env node
/**
 * 服务端目录与命名门禁。
 *
 * 为什么需要它：`server/src` 的模块名是给人看的导航。`net.ts`、`payload.ts`
 * 一眼看不出边界，久了就会有人把新逻辑塞进"看着最像"的那个文件。命名规则靠
 * 约定守不住，靠一次 `npm test` 可以。
 *
 * 同时确认「手写源码只有 .ts」：产物 `server/boot.mjs` 是唯一的例外，它不是源，
 * 是 esbuild 的输出，宿主只能跑它（见 docs/adr/open-ai-canvas/0012）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "server/src");

/** 与产物同名的装配入口：横线规则对它不适用，因为它必须叫 boot。 */
const ENTRY = "boot.ts";
/** 只表达"放到别处"、不表达职责的名字，一旦出现就说明切分失败了。 */
const BANNED = ["utils.ts", "helpers.ts", "misc.ts", "common.ts", "shared.ts", "primitives.ts", "index.ts", "types.ts"];
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.ts$/;

const failures = [];
const checks = [];

const names = fs.readdirSync(srcDir).sort();
checks.push(`server/src 共 ${names.length} 个文件`);

for (const name of names) {
  if (!name.endsWith(".ts")) {
    failures.push(`${name}：server/src 只允许 .ts`);
  } else if (name !== ENTRY && !KEBAB.test(name)) {
    failures.push(`${name}：不是 kebab-case（横线连接的小写文件名）`);
  }
  if (BANNED.includes(name)) failures.push(`${name}：文件名不表达职责`);
}

if (!names.includes(ENTRY)) failures.push(`缺少装配入口 ${ENTRY}`);

// server/ 根只放产物、tsconfig 与 src/
for (const entry of fs.readdirSync(path.join(root, "server"))) {
  if (entry === "src" || entry === "boot.mjs" || entry === "tsconfig.json") continue;
  failures.push(`server/${entry}：根目录只允许 boot.mjs、tsconfig.json、src/`);
}

// 手写代码里不允许再出现 @ts-nocheck（迁移期用过，已清零）
for (const name of names) {
  const text = fs.readFileSync(path.join(srcDir, name), "utf8");
  if (/^\s*\/\/\s*@ts-nocheck/m.test(text)) failures.push(`${name}：含 @ts-nocheck`);
}

// 相对引用必须指向真实存在的模块（重命名最容易漏这个）
for (const name of names) {
  const text = fs.readFileSync(path.join(srcDir, name), "utf8");
  for (const match of text.matchAll(/from "\.\/([^"]+)"/g)) {
    const specifier = match[1];
    if (!specifier.endsWith(".ts")) {
      failures.push(`${name}：相对引用 "${specifier}" 缺少 .ts 扩展名`);
      continue;
    }
    if (!names.includes(specifier)) failures.push(`${name}：引用不存在的模块 ${specifier}`);
  }
}

// 产物头部的生成物标记：打开文件的人第一眼就该知道不该手改
const bundle = fs.readFileSync(path.join(root, "server/boot.mjs"), "utf8");
if (!bundle.startsWith("// 生成物")) failures.push("server/boot.mjs：缺少「生成物」头注");

for (const check of checks) console.log(`  · ${check}`);

if (failures.length > 0) {
  console.error(`\n服务端目录门禁未通过（${failures.length} 项）：`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`服务端目录门禁通过（${names.length} 个模块，全部 kebab-case 且为 .ts）`);
