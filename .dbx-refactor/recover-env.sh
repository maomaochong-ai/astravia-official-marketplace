#!/usr/bin/env bash
# dbx-pro 构建环境恢复脚本（幂等，可重复执行）
#
# 背景：2026-10-02 23:03 插件目录被外部进程整体删除，node_modules 一并丢失。
# 本脚本按 BUILD.md 的约定重建 node_modules：
#   1. 临时摘掉 registry 上不存在的 @astravia-org/* 私有包再安装（否则 bun install 整体失败）
#   2. 恢复 package.json 原文（私有依赖声明保留在清单里，靠 symlink 解析）
#   3. 按 BUILD.md 建立 @astravia-org/* -> open-astravia monorepo 的 symlink
#   4. 校验 iconify 依赖（图标类 icon-[lucide--*] / icon-[solar--*] 需要，随步骤 1 安装）
#   5. 补齐 x64 原生包（本机 Node 只有 x64，跑在 arm64 Mac 上）
set -euo pipefail

B=/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace
O=/Users/zhugeyue/Desktop/project/bigdate/source-code/open-astravia
P="$B/abilities/plugins/dbx-pro"

cd "$P"

echo "[1/5] 摘掉私有包声明后安装依赖"
cp package.json /tmp/dbx-pro-package.json.bak
node -e '
const fs = require("node:fs");
const j = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const k of Object.keys(j.devDependencies ?? {})) {
  if (k.startsWith("@astravia-org/")) delete j.devDependencies[k];
}
fs.writeFileSync("package.json", JSON.stringify(j, null, "\t") + "\n");
'
bun install 2>&1 | tail -4 || true

echo "[2/5] 恢复 package.json 原文"
cp /tmp/dbx-pro-package.json.bak package.json

echo "[3/5] 建立 @astravia-org/* symlink"
mkdir -p node_modules/@astravia-org
for n in plugin-sdk plugin-vite plugin-cli; do
  if [ -d "$O/packages/plugins/$n" ]; then
    ln -sfn "$O/packages/plugins/$n" "node_modules/@astravia-org/$n"
  else
    echo "  !! 缺少 $O/packages/plugins/$n" >&2
  fi
done

echo "[4/5] 校验 iconify 依赖"
missing=0
for p in "@iconify/tailwind4" "@iconify-json/lucide" "@iconify-json/solar"; do
  if [ -d "node_modules/$p" ]; then
    echo "  ok  $p"
  else
    echo "  !!  缺少 $p" >&2
    missing=1
  fi
done
[ "$missing" = 0 ] || echo "  -> 检查 package.json 的 devDependencies 与网络/缓存后重跑" >&2

echo "[5/5] 补齐 x64 原生包"
node "$B/.dbx-refactor/fix-native-toolchain.mjs" 2>&1 | tail -2

echo "完成。核对 dbx-pro 侧原生包："
ls -d node_modules/@rollup/rollup-darwin-* node_modules/@esbuild/darwin-* \
       node_modules/@tailwindcss/oxide-darwin-* node_modules/lightningcss-darwin-* 2>/dev/null
