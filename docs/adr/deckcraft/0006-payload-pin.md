# 0008 · deckcraft 钉在哪一版，以及为什么不改它

- 状态：已采纳
- 日期：2026-11-03
- 相关：[craft-0003](craft-0003-first-open-is-a-preparation-not-a-failure.md)、[craft-0007](craft-0007-chinese-comes-from-the-shell.md)

## 背景

DeckCraft 在本市场里以插件形式出现，但插件不实现演示文稿——它把上游的官方 web 构建
放进活动面板的 iframe 里跑。这带来第一个必须写下来的决定：跑哪一份字节。

## 决定

`payload/manifest.json` 钉住上游 release 里的一份制品，并把 `sha256` 当作唯一信任锚：

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/deckcraft |
| 制品 | `deckcraft-web-0.15.0.zip` |
| 版本 | `0.15.0` |
| 大小 | 11,642,045 B（12 MB） |
| sha256 | `b617413b27514cc7f037877a1414a02bd4d4810a1b3f8d18cf7ab59cf97d5769` |

下载来的字节对不上这个摘要就拒绝使用，不降级、不猜测。`server/hub.mjs` 由
`scripts/build-hub.mjs` 从 `hub.src.mjs` 生成，摘要同时写进 `plugin.json` 的五个平台条目，
`tests/craft-manifest.test.mjs` 会核对它们指的是不是仓库里那份 hub。

## 为什么不是别的做法

- **不重新编译上游。** 重编译过一次（早期 `tools/craft/i18n/` 管线），代价是每一次上游更新
  都要重放一遍构建，而且产物不再等于上游发布的东西。见 craft-0007。
- **不做镜像。** 制品直接从上游 release 取，另配一个代理源只用于网络受限的情况；镜像会成为
  第二个真相来源，出问题时无法判断是谁改了字节。
- **不跟随 `latest`。** 上游每次发版都可能改文件格式。钉住版本意味着用户拿到的行为是可复现的；
  升级是一次显式的版本提升，而不是某天打开面板发现界面变了。

## 后果

- 上游发新版时，本插件不自动跟进；升级要改这一份 manifest、抬插件版本、重建 hub。
- 本插件固定 DeckCraft 0.15.0，不含任何幻灯片代码，所以上游缺的功能在这里也缺——这一点在详情页和 SKILL.md 里都写明了，
  不让用户误以为插件补齐了上游的短板。
- 上游的早期状态（DeckCraft 还很年轻：PowerPoint 的部分特性缺失、文件格式仍在变）会原样传到用户面前，这是刻意的：
  如实转述比包装成成熟产品更负责。
