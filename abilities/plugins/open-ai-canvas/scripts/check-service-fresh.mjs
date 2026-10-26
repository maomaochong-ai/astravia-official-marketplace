#!/usr/bin/env node
/**
 * 断言 server/boot.mjs 与 server/src/*.ts 同源。
 *
 * 这个检查存在的唯一理由：产物进版本控制，而宿主执行的是产物。
 * 有人改了 src 却没重新构建，服务就会跑上一版代码，而所有 verify-* 仍然通过——
 * 那种失败最贵。用 esbuild 在内存里重打一遍，逐字节比对。
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const entry = path.join(root, "server/src/boot.ts");
const target = path.join(root, "server/boot.mjs");

const failures = [];
if (!fs.existsSync(target)) {
  failures.push("server/boot.mjs 不存在；先跑 npm run build:boot");
} else {
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
    write: false,
    logLevel: "silent",
    banner: {
      js: [
        "// 生成物：不要直接编辑。源在 server/src/，构建命令 `npm run build:boot`。",
        "// 单文件是硬约束——宿主只下载并执行这一个 entry（见 docs/adr/open-ai-canvas/0012-service-module-layout.md）。",
      ].join("\n"),
    },
  });
  const expected = result.outputFiles?.[0]?.text ?? "";
  const actual = fs.readFileSync(target, "utf8");
  if (expected !== actual) {
    failures.push(
      `server/boot.mjs 与 server/src 不同源（磁盘 ${actual.length} 字节 / 期望 ${expected.length} 字节）。跑 npm run build:boot 重新生成。`,
    );
  }
}

if (failures.length) {
  for (const line of failures) console.log(`  ✗ ${line}`);
  console.log(`FAIL ${failures.length} 项`);
  process.exit(1);
}
console.log("OK server/boot.mjs 与 server/src 同源");
