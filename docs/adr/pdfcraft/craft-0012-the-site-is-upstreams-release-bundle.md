# 站点就用上游发布的那份 web 包：不自己编，也不动它一个字节

- 状态：已采纳（2026-11-04）。取代 [craft-0011](craft-0011-the-site-ships-in-the-package.md) 的
  "站点由 CI 用上游源码构建"一段；其余各节（srcdoc 注入、`?nosw`、渲染降级、没有常驻进程）仍然有效。
- 相关：[craft-0001](craft-0001-seven-copies-and-a-parity-test.md)、
  [craft-0007](craft-0007-chinese-comes-from-the-shell.md)、[craft-0008](craft-0008-one-container-per-app.md)

## 问题

craft-0011 解决的是真问题（自研内核不是上游），但把成本压到了 CI 上：十五支都是 egui/wgpu 的 Rust
wasm **发布**构建，每支一次 `trunk build --release` / `cargo xtask web`。

实测（Observed，2026-11-04）：最小的一支 cadcraft，在 8 核 + 12 GB 热缓存的开发机上，编译段 12 分钟、
出站点 17 分钟。GitHub 的 `ubuntu-24.04` 是 2–4 核、冷缓存，单支 30–60 分钟；十五支顺序跑必然撞
单 job 6 小时上限。结局不是"慢"，是**一支都发不出去**。

同时，"原汁原味"并不要求我们自己编：上游每次发版都跑自己的 `packaging/web/package.sh`，把结果挂成
`<app>-web-<version>.zip`，并把摘要写进同一版的 `SHA256SUMS.txt`。十五支钉住的那一版全部具备
（Observed，逐个 `releases/tags/v<release>` 核对过）。

## 决定

`payload/manifest.json` 升到 schemaVersion 4：

```json
{
  "schemaVersion": 4,
  "slug": "designcraft",
  "site": "web",
  "upstream": "https://github.com/storytold/designcraft",
  "release": "0.16.0",
  "commit": "81cca513ba31…",
  "asset": "designcraft-web-0.16.0.zip",
  "sha256": "1e74074b32d5…",
  "builtBy": "scripts/build-craft-web.mjs"
}
```

`scripts/build-craft-web.mjs` 只做四件事：

1. 按 pin 下载 `<upstream>/releases/download/v<release>/<asset>`；
2. 校验两遍——下载内容的 sha256 必须等于 `pin.sha256`，上游 `SHA256SUMS.txt` 里该资产那一行也必须等于它；
3. 剥掉压缩包里唯一那层 `<app>-web-<version>/` 目录，其他文件一律不筛（上游的 `_headers`、LICENSE、
   README 都是他们产物的一部分，留着）；
4. 落到 `abilities/plugins/<slug>/web/`，然后校验 `index.html` 没有根绝对路径、站点里没有符号链接。

不再 checkout 源码、不再装 rustup/trunk/wasm-bindgen/wasm-opt、不再有 1–3 GB 的 cargo target。
整轮打包从"数小时且大概率失败"降到分钟级。

因此进包的字节**就是上游发布的那一份**，连 `index.html` 里给自己脚本写的 `integrity` 都是他们的；
我们没有重编、没有重写、也没有重新拼装。

## 实测留痕

Observed（2026-11-04，本机，三支已钉的包）：

| 应用 | 下载 | 解压后 `web/` | 摘要 |
| --- | --- | --- | --- |
| cadcraft | 10.3 MiB | 27.8 MiB | `161e9ca6…` 与 pin、上游 sums 三者一致 |
| materialcraft | 4.0 MiB | 11.3 MiB | `b9362c39…` 一致 |
| craft-anything | 2.6 MiB | 6.0 MiB | `58af01db…` 一致 |

包内文件就是上游清单：`cadcraft/web/` 里是 `index.html`、`cadcraft-web-a6eb94f994f1d060.js`、
同名 `_bg.wasm`、`snippets/`、`_headers`、`LICENSE-MIT`、`LICENSE-APACHE`、`NOTICE`、`ATTRIBUTION.md`、
`HOSTING.md`、`README.md`；`index.html` 里是 `./cadcraft-web-…js` 这样的相对路径，正是 iframe
`srcdoc` 需要的形状。

本机到 GitHub release 资产的带宽只有 10 KB/s 左右，所以验证走 `CRAFT_WEB_CACHE=<dir>`：脚本从
`<dir>/<slug>/<asset>` 与 `<dir>/<slug>/SHA256SUMS.txt` 读字节，**两道校验照旧执行**，缓存里被动过或过期
照样失败。CI 不设这个变量，正常走网络。

打包实例（Observed，`scripts/stage-plugin-release.py cadcraft --min-app-version 0.5.49`）：
`cadcraft-0.0.5.astraviapkg` **10.9 MB**，内含 12 个 `web/` 条目（`index.html`、`_headers`、`snippets/` 与 wasm/JS），
`web/index.html` 与暂存文件逐字节相同（`ec608f03…`）。wasm 在包里会被重新 DEFLATE 一次，所以 27.8 MiB 的站点
只占包体 10.9 MB——50 MB 上限是按包体积算的，不是按解压后体积。

lightcraft 是唯一可能撞上限的一支，所以单独查了它的中央目录（Observed，Range 请求只取尾部 200 KB）：
`lightcraft-web-0.17.0.zip` 73,311,887 B、40 个条目、解压后 **94.1 MiB**；其中 10 个是预压缩孪生文件
（`lightcraft_web.js.gz/.br`、`index.html.gz/.br`、`worker.js.gz/.br`、`lightcraft_web_bg.wasm.gz/.br`、
`lightcraft_zh_hans.otf.gz/.br`）。删掉这 10 个后剩 **49.6 MiB**，主要是 wasm（33.6 MiB）与中文字体
`lightcraft_zh_hans.otf`（15.7 MiB）——后者必须留，中文界面靠它。

## 代价与边界

- **50 MB 制品上限不变**（`scripts/stage-plugin-release.py:25`）。lightcraft 是唯一需要特殊处理的一支：
  那十个 `*.gz` / `*.br` 孪生文件对插件协议没用（它发原始字节，页面直接 fetch 模块），留着只会白占包体；
  manifest 里 `skipPrecompressed` 让脚本把 `web/` 下所有 `.gz` / `.br` 删干净（含嵌套目录）。
- **只能跟已发版**：pin 只能指向有 Release 的版本，上游 main 上还没发版的东西拿不到。这与仓库
  "能力版本随发布抬升"的节奏一致。
- **重发同一个 tag**：上游若把资产换掉，`pin.sha256` 会先失败并中止打包。这是刻意的——宁可人工确认换
  pin，也不静默接受新字节。
- **上游没打包的产物**：某些桌面产物（dmg/AppImage 等）与本仓库无关，不取。

## 不做的事

- 不在 CI 里重编上游（craft-0011 的做法；回退原因见上文实测）。
- 不在包里修改上游任何一个字节，也不把上游文件"重新拼装成同构形状"。
- 不因为上游慢就退回自研内核（craft-0001 的理由仍然成立）。
