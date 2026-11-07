# 国内网络下「刷新市场」「安装插件」为什么慢，慢在哪一段

对象：本仓库（官方市场源）+ 两个宿主实现（`open-vetta` 与本机 `open-astravia`）。
结论先行：**两边客户端的网络路径逐字相同，差别只在要搬多少字节。**

- 刷新：官方源一次刷新要下 **5.54 MiB** 的整条 `gh-pages` 分支归档；vetta 官方源是 **1.97 MiB**。
- 安装：本仓库 30 个插件条目里最新版本的制品合计 **295.24 MiB**，中位数 **11.16 MiB**；
  vetta 的 6 支插件是 **44 KiB – 177 KiB**。
- 同一台机器、同一时段实测链路速率 21–26 KiB/s（个别制品取样到 55 KiB/s，抖动很大）。折算下来：
  本仓库刷新约 **3.6 min**，装一支 craft 插件约 **6–16 min**，装 `dbx-pro` 约 **14 min**；
  vetta 刷新约 **1.6 min**、装一支插件 **2–8 s**。

最后一行就是全部差异：**0.12 MiB 与 11 MiB 走同一条慢链路，倍数关系不会因为协议优化而消失。**

## 一、客户端路径：两边只有命名空间不同

`apps/desktop/src/main/abilities/open-marketplace/` 是同一份代码，`diff` 后只剩三类替换：

| 差异 | vetta | astravia |
| --- | --- | --- |
| 索引路径 | `.vetta/marketplace.json` | `.astravia/marketplace.json` |
| 环境变量 | `VETTA_OPEN_MARKETPLACE_*` | `ASTRAVIA_OPEN_MARKETPLACE_*` |
| User-Agent | `Vetta-Desktop` | `Astravia-Desktop` |

`open-marketplace-installer.ts` 两边字节完全相同（sha256 前 12 位 `0dbf217ef8a4`）。
也就是说：本仓库没有任何「客户端侧」的劣势可以优化，这条对比里客户端是常量。

## 二、刷新的真实开销：一定是整条分支归档

取证（`open-marketplace-service.ts`）：

| 位置 | 事实 |
| --- | --- |
| `:384` `refresh()` | 用户点「刷新」→ `syncOnce()` |
| `:861` `syncOnce()` | 直接进 `sync()`，不做 manifest 预检 |
| `:870-875` `sync()` | **无条件** `await this.downloadArchive()` |
| `:792-796` `refreshInBackgroundIfChanged()` | 只有后台轮询会先下 manifest（`~56 KiB`），版本没变就跳过 |

后果：

1. 手动刷新每次都要下整条 `gh-pages` 的 zip，没有 `Range`、没有条件请求、没有增量；
2. 归档 URL 由宿主拼出来 —— `<repo>/archive/refs/heads/gh-pages.zip`，仓库侧无法改写；
3. 归档内容 = 市场里所有能力的展示层与技能包本体，所以「市场越大，刷新越慢」，
   与我们发不发版无关。

2026-11-07 实测（`node scripts/measure-marketplace-network.mjs`）：

```
索引      56 KiB   46 个条目   2026.11.07-3
归档      5.54 MiB   26 KiB/s   ≈ 3.6 min 每次刷新
```

同一条链路下 vetta 官方源：`2,061,706 B`（1.97 MiB），速率 21.6 KiB/s，约 1.6 min。
**刷新这一段的差距是 2.8 倍，来源只有一个：分支里躺着的字节数。**

## 三、安装的真实开销：制品体积

`releases[].artifact.url` 指向 GitHub Release 上的单个 `.astraviapkg`，安装只下最新那一版。
2026-11-07 全量量了一遍（`--limit 30`）：

| 量级 | 条目 |
| --- | --- |
| 合计 | **295.24 MiB / 30 项** |
| 最重 | `dbx-pro` 45.87 MiB、`vectorcraft` 31.84、`designcraft` 25.68、`lightcraft` 25.62、`effectcraft` 20.72 |
| 中位 | `deckcraft` 11.16 MiB（15 支 craft 合计 223.99 MiB） |
| 最轻 | `astravia-tihu` 50 KiB、`web-element-picker` 64 KiB、`feishu` 82 KiB、`boardmix` 91 KiB |

体积构成（本机工作区实测）：

| 插件 | 包里的大件 |
| --- | --- |
| `deckcraft` | `web/` 31 MiB，其中 `deckcraft-web-*.wasm` **30.87 MiB**（32,371,391 B），其余是 200 KiB 的胶水 JS |
| `filmcraft` | `web/` 46 MiB，`filmcraft_web_bg.wasm` **45.68 MiB**（47,896,219 B），deflate 后成品 14.78 MiB |
| `dbx-pro` | `dist/assets` 101 MiB，其中三个平台二进制 **93 MiB**：`dbx-mcp-darwin-x64` 33.4、`dbx-mcp-win-x64.exe` 31.7、`dbx-mcp-darwin-arm64` 28.1 |

对照组：vetta 的 6 支插件是纯 JS 外壳，**44 KiB – 177 KiB**。它们不带 wasm 编辑器，
所以「刷新 + 装一支」全程不到 10 秒；我们装一支 craft 插件要搬的是上游整个 egui/wasm 站点。

## 四、我们这边还能动的三件事（按字节收益排序）

### 1. `dbx-pro` 按平台拆包 —— 单支用户少下 30 MiB

现状把 darwin-x64 / win-x64 / darwin-arm64 三份服务端二进制打进同一个包，任何用户只用到一份。
按平台拆成三份制品（索引侧 `releases[]` 仍是一条，安装时按 `process.platform` 取对应资产）能把
最重条目从 45.87 MiB 降到约 15 MiB 量级。估算依据：三份二进制共 93 MiB 原始字节，占 `dist/assets` 的 92%。

> 注意：这需要改 `dbx-pro` 的打包与运行时取值，属于它自己的交付范围；本仓库只记录数字，不动它。

### 2. 刷新归档 —— 已经砍过一轮图标，剩余空间有限

`c4ec6041` 已把 15 个图标从 5.77 MiB 压到 2.15 MiB（`baizhi` 722 KiB → 52 KiB、`designcraft` 302 KiB → 120 KiB，
**合计省下 3.62 MiB** 的 gh-pages 原始字节）。2026-11-07 剩余构成（gh-pages 全量 8.74 MiB / 1416 文件）：

| 类型 | 字节 | 文件数 |
| --- | --- | --- |
| `.md` | 3.71 MiB | 909 |
| 图片（png/jpg/svg/ico/webp） | 3.07 MiB | 50 png + 94 svg |
| `.json` | 0.85 MiB | 242 |
| `.xml` | 0.79 MiB | 20 |

`.md` 在 zip 里能压到三分之一左右，图片几乎不压。所以 5.54 MiB 的刷新包里约 3 MiB 是图片。
再把剩下的最大几张（`qiushi-skill/assets/logo.png` 0.87 MiB、`preview-hero.png` 0.16 MiB、各支 16–126 KiB 的图标）
降一档，量级上能再省 1–2 MiB ⇒ 刷新约 3 min。再往下就只剩 `.md` 正文，删不得。

代价要说清：`assets/` 属于运行内容，改它按仓库规则要抬版本并重新发布，为了 1 MiB 去抬
30 个条目的版本不划算。**除非顺带做别的发布，不建议单独为它发一轮。**

### 3. craft 15 支 —— 已经到底了

- 打包脚本用的是 `zipfile.ZIP_DEFLATED` + `compresslevel=9`（`scripts/stage-plugin-release.py:133-136`），
  deflate 这一侧没有剩余空间；
- 包内没有 `.map`、没有 `.br`/`.gz`、没有测试与源码目录（`SKIP_DIRS` 已排除），
  扫了 15 支的 `web/`，无一份可删的冗余文件；
- 也就是说：**11–32 MiB 就是「离线自带上游 wasm 站点」这个决定的物理下限。**
  要接近 vetta 的安装速度，只能不随包发站点（改为在线加载或共用一份运行时），
  这与既有决策「站点随包分发、离线可用、原汁原味」直接冲突 —— 属于产品取舍，不是网络优化。

## 五、明确不做的（避免被当成承诺）

| 想法 | 为什么不做 |
| --- | --- |
| 换 CDN / 镜像域名 | 归档 URL 与索引 URL 都由宿主用「仓库地址 + 分支」拼出来（`open-marketplace-service.ts:190-194`、`:322`），仓库侧没有改写入口；改宿主属于禁止项 |
| 把制品塞进 `gh-pages` 用 jsDelivr 分发 | 分支归档就是刷新包本身，295 MiB 制品进去会把每次刷新从 5.54 MiB 抬到几百 MiB；且 jsDelivr 单文件上限 20 MiB，`dbx-pro`/`vectorcraft`/`designcraft`/`lightcraft`/`effectcraft`/`wordcraft`/`pdfcraft` 全部超标 |
| 用 jsDelivr 托管索引 | 实测 `cdn.jsdelivr.net` 36 KiB/s 对 GitHub 26 KiB/s，量级相同；索引本身只有 56 KiB，不是瓶颈 |
| 断点续传 / 并发下载 | 下载器在宿主主进程里，不在本仓库可改范围 |
| 让 30 MiB 传输「感觉像」0.1 MiB | 这是字节数问题，不是协议问题；任何插件侧改动都不能缩短这条链路 |

## 六、复测方法

```bash
node scripts/measure-marketplace-network.mjs                 # 全量 30 项，约 2–4 分钟
node scripts/measure-marketplace-network.mjs --limit 5       # 只看最重的 5 项
node scripts/measure-marketplace-network.mjs --only deckcraft,excalidraw
```

脚本只做取样：归档与制品各读到 2 MiB 就断开（`--sample-bytes` 可调），
用实测字节数除以耗时折算等待时间；拿不到体积的项输出 `n/a`，不用估算值填。
换网络、换时段各跑一次，就能看出来慢在链路还是慢在体积。
