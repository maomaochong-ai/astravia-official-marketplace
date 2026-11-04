# Excalidraw 的决策记录

这个目录只属于 `abilities/plugins/excalidraw` 这一支插件，与 craft 家族（`docs/adr/craft-anything/`
等）没有逐字节约束关系：它从 craft 外壳起步，但站点来源、构建方式和语言机制都不同。

| 编号 | 决定的 |
| --- | --- |
| [0001](0001-the-tab-runs-upstreams-web-build.md) | 标签页里跑的是上游自己的 web 构建，不自研内核 |
| [0002](0002-bytes-move-through-the-host.md) | 字节只从宿主过一次；桥不持有路径、不认 origin、只认 `event.source` |
| [0004](0004-icons-only-and-a-fullscreen-that-returns.md) | 状态条 28 px 只有图标（语言切换是两字母例外）；全屏被拒绝时壳自己铺满且能退出 |
| [0005](0005-the-agent-drives-the-canvas.md) | Agent 驱动真实页面：结构走上游自己的 API，界面走真实事件；只回文字与读回的结果 |
| [0009](0009-one-batch-instead-of-one-click.md) | 一个 `act` 携带一批有序步骤，带 `before`/`after` 可测量的变化 |

想看"站点从哪来"，读 [0001](0001-the-tab-runs-upstreams-web-build.md)。它的 pin 在
`abilities/plugins/excalidraw/payload/manifest.json`，构建配方在插件自己的目录里：
`abilities/plugins/excalidraw/scripts/build-excalidraw-web.mjs`。

## 与 craft 家族的差异

| | craft 家族 | excalidraw |
| --- | --- | --- |
| 站点来源 | 上游发布的 `<app>-web-<version>.zip` | 从钉住的 commit 自己构建 `excalidraw-app` |
| 构建工具链 | Rust / wasm / trunk | Node / vite（纯前端） |
| 版本标识 | `release` + `sha256` | 40 位 `commit` + `recipeVersion` |
| 一致性测试 | `tests/craft-parity.test.mjs` 逐字节 | `tests/excalidraw-plugin.test.mjs` 只校验本插件 |
| 语言 | 壳自己的 locales 决定界面 | 上游 i18next：首屏 `?lng=`，运行时写 `appLangCodeAtom` |

站点构建这一条是唯一必须不同的：Excalidraw 没有发布 web 包，官方只发 Docker 镜像与 npm 包，
而 npm 包是不含外壳的组件库（见 0001「为什么不是 `src` 直接引上游包」）。
