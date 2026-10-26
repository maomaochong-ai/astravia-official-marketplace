#!/usr/bin/env node
/**
 * 把 server/src/*.ts 打成单个 server/boot.mjs。
 *
 * 为什么必须是单文件：宿主按 `providers.services[].runtime.entry` 直接 `node server/boot.mjs`
 * 拉起这个进程，装的时候只下载这一个文件（plugin.json 里 5 个平台的 artifacts 都指向它）。
 * 所以「按职责拆成一堆模块」和「运行时只有一个文件」必须同时成立——多入口打包是唯一解。
 *
 * 产物进版本控制：CI 构建 .astraviapkg 时读的就是仓库里的 server/boot.mjs，
 * 它的 sha256 也写进了 plugin.json。构建脚本因此要做两件事：写产物，并校验产物里没有
 * 残留的 `import ... from "./xxx.ts"`（bundle 失败的显式征兆）。
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const entry = path.join(root, "server/src/boot.ts");
const target = path.join(root, "server/boot.mjs");

const result = await build({
  entryPoints: [entry],
  outfile: target,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  charset: "utf8",
  legalComments: "none",
  sourcemap: false,
  logLevel: "warning",
  banner: {
    js: [
      "// 生成物：不要直接编辑。源在 server/src/，构建命令 `npm run build:boot`。",
      "// 单文件是硬约束——宿主只下载并执行这一个 entry（见 docs/adr/open-ai-canvas/0012-service-module-layout.md）。",
    ].join("\n"),
  },
  metafile: true,
});

const text = fs.readFileSync(target, "utf8");
if (/^\s*import\s[^;]*from\s+["']\.\//m.test(text)) {
  console.error("build-service: 产物里仍有相对 import，说明没有真正 bundle 成功");
  process.exit(1);
}
if (!text.includes("ASTRAVIA_SERVICE_PORT")) {
  console.error("build-service: 产物里找不到入口逻辑，entry 可能指错了文件");
  process.exit(1);
}

const inputs = Object.keys(result.metafile.inputs).filter((name) => name.startsWith("server/"));
const bytes = fs.statSync(target).size;
console.log(`server/boot.mjs ← ${inputs.length} modules, ${bytes} bytes`);
for (const name of inputs) console.log(`  ${name}`);
