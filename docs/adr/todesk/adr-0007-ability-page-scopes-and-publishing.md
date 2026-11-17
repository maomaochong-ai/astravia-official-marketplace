# ADR 0007：能力页为什么看不到它，以及怎么让它出现在「发现」里

- **状态：** 已接受（**已发布**：gh-pages `b0f6ac02`，索引 0.4.88 → `todesk 0.4.8`）
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.4.7；Astravia Desktop 0.5.97
- **问题：** 「能力页面我看不到这个新增的插件。」

## 一、先给结论

**它已经出现在能力页里，但在「我的」这个分段，不在「发现」。**

| 能力页分段 | 过滤函数（宿主渲染层实测） | 本插件 |
| --- | --- | --- |
| 发现 `discover` | `oe(item) = item.fromMarket && (!item.market || item.market.listed !== false) \|\| item.isBuiltin` | `fromMarket = false`（本地安装，无目录条目）→ **不显示** |
| 我的 `mine` | `ie(item) = ee(item) \|\| ne(item)`；`ne` 对插件要求 `isCustom === true`，即 `plugin.source ∈ {"archive","npm"}` | `source = "archive"` → `isCustom = true` → **显示** |

取证位置：`Astravia/resources/app.asar` → `renderer/assets/build-ability-items-*.js` 的 `se/oe/ie/ne` 与 `AbilitiesPage-*.js` 的分段控件（`{key:"discover"}` / `{key:"mine"}`）。

所以这不是代码缺陷，而是「目录归属」问题：**发现页是目录的镜像，不是已安装列表**。

## 二、为什么它没有目录条目

能力页的目录来自**市场源**（`~/.astravia/open-marketplaces/sources.json`），当前只有一个内置源：

```json
{ "id": "astravia-official", "type": "github",
  "repository": "https://github.com/maomaochong-ai/astravia-official-marketplace",
  "ref": "gh-pages", "builtin": true }
```

源只支持 GitHub（仓库 + ref + archiveUrl）。而仓库的 `gh-pages` 分支里没有 `todesk` —— 本插件只写进了源码分支的 `.astravia/marketplace.source.json`，**从未发布**。因此 `~/.astravia/abilities.json` 里它只有：

```json
"plugin:todesk": { "origin": { "kind": "server" }, "version": "0.4.7" }   // 无 catalogId
```

而通过市场安装的邻居长这样：

```json
"plugin:magpie": { "origin": { "kind": "github-marketplace", "sourceId": "astravia-official", … },
                   "catalogId": "github:astravia-official:plugin:magpie" }
```

## 三、决定

1. **不伪造目录条目。** 往 `abilities.json` 塞一个假的 `github-marketplace`/`catalogId` 能让卡片出现，但它是谎报来源：升级、校验、卸载都会按那个来源去取制品。不做。
2. **本地能做到的事写清楚，让用户一眼找到它：** 能力页 → 切到「我的」。`+` 菜单里还有「导入插件」，可以直接选 `release/todesk-*.astraviapkg`，装完同样落在「我的」。
3. **进入「发现」的唯一正路是发布。** 仓库是 Helm 静态市场模型：`.astravia/marketplace.source.json` 是事实源，CI 在 `gh-pages` 生成 `.astravia/marketplace.json`。发布后：
   - 源码 PR 合入 `main` → CI 构建并推进 `gh-pages`；
   - 客户端「能力 → 市场源 → 刷新」即可在**发现**里看到 `ToDesk` 卡片（带图标、简介、双语详情）。
4. **不接受「本地静态市场」作为补救。** 该版本的源表单只收 GitHub 仓库地址（`sources.form.repositoryPlaceholder`），`http://127.0.0.1` 之类的地址没有入口。

## 四、发布需要什么（可执行清单）

```bash
# 1) 确认版本与索引一致（已通过）
node scripts/marketplace.mjs check

# 2) 本地跑一遍发布产物（不写 gh-pages，只校验）
node scripts/marketplace.mjs build --output .marketplace-build

# 3) 提交源码改动，走 PR（仓库规则：不能直接推 main）
git add abilities/plugins/todesk docs/adr/todesk .astravia/marketplace.source.json
git commit -m "feat(todesk): 0.4.7 remote-control plugin"
git switch -c feat/todesk-plugin && git push -u origin feat/todesk-plugin

# 4) 合入后由 publish-marketplace.yml 生成 gh-pages 索引；
#    之后在客户端「能力 → 市场源」点刷新即可看到。
```

这一步需要仓库推送权限，属于用户授权范围。

**执行记录（2026-11-18）**：源码提交 `10673c75` 推到 `main`，`publish-marketplace.yml` 成功，gh-pages 新提交 `b0f6ac02 chore(marketplace): 发布 2026.11.17-8`；发布的索引里已有：

```json
{ "slug": "todesk", "version": "0.4.8", "category": "Productivity",
  "releases": [{ "version": "0.4.8",
    "artifact": { "url": "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-todesk/todesk-0.4.8.astraviapkg",
                  "sha256": "6a34dc63…9a1b" } }] }
```

客户端「能力 → 市场源 → 刷新」后，`ToDesk` 会出现在**发现**里；从那里安装会一次性批准权限与 `ToDesk.exe` 命令（比 `install-from-path` 更省事）。

## 五、代价

- 「我的」里的卡片没有市场统计（下载量）、没有「更新」提示，因为 `needsUpdate` 依赖目录版本；版本判断退化为客户端自己的 `pendingVersion`。
- 卸载/重装走「我的」，与市场安装的插件体验略有差异。
- 若将来想让本插件独立存在于「发现」，也可以另建一个 GitHub 仓库专放它的 `gh-pages` 索引，但这是新的源，不属于本 ADR 的范围。
