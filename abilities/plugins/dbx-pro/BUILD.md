# dbx-pro 构建指南

## 前置条件

- Node 22+（或 Bun）
- open-astravia monorepo 克隆在同级目录（提供 `@astravia-org/*` workspace 包）

## 符号链接（首次克隆必须设置）

```bash
cd abilities/plugins/dbx-pro
mkdir -p node_modules/@astravia-org
ln -sf <OPEN-ASTRA>/packages/plugins/plugin-sdk    node_modules/@astravia-org/plugin-sdk
ln -sf <OPEN-ASTRA>/packages/plugins/plugin-vite  node_modules/@astravia-org/plugin-vite
ln -sf <OPEN-ASTRA>/packages/plugins/plugin-cli   node_modules/@astravia-org/plugin-cli
```

`<OPEN-ASTRA>` 替换为实际路径，例如 `/Users/zhugeyue/Desktop/project/bigdate/source-code/open-astravia`。

## Module Federation idle timeout patch（必须）

`@module-federation/vite` 默认 10s idle timeout，dbx-pro 模块数（89+）会触发 MF 强制 resolve，导致 `mf-manifest.json` 缺失。

```bash
# 找 federation 库的实际路径（bun install 版本）
FED_FILE=$(ls -d <OPEN-ASTRA>/node_modules/.bun/@module-federation+vite@*/node_modules/@module-federation/vite/lib/index.js 2>/dev/null | head -1)

# patch 默认值 10s → 120s
sed -i '' 's/moduleParseTimeout: options.moduleParseTimeout ?? 10/moduleParseTimeout: options.moduleParseTimeout ?? 120/' "$FED_FILE"
```

**警告**：`bun install` 会重置这个 patch。每次 fresh install 后必须重新 patch。

## 构建

```bash
cd abilities/plugins/dbx-pro
rm -rf dist release
./node_modules/.bin/vite build
# 输出: release/dbx-pro-<VERSION>.astraviapkg
```

构建耗时 ~2 分钟（MF 模块解析慢）。

## 测试

```bash
node --test src/test/*.test.js
# src/test/catalog.test.js       — 13 测试
# src/test/connection-config.test.js — 12 测试
# 25/25 全绿, 76ms
```

## 版本同步（patch-level granularity）

必须同步 4 个文件：

```bash
VERSION=0.0.N
for f in plugin.json ability.json package.json .astravia/marketplace.source.json; do
  sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/g" "$f"
done
```

## 发布

```bash
# 1. commit + push
git add -A && git commit -m "feat(dbx-pro): v$VERSION — <summary>"
git push origin main

# 2. 创建 GitHub Release
gh release create plugin-dbx-pro-$VERSION \
  --repo maomaochong-ai/astravia-official-marketplace \
  --title "dbx-pro v$VERSION — <summary>" \
  --notes "<changelog>" \
  release/dbx-pro-$VERSION.astraviapkg
```
