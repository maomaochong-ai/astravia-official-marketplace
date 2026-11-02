# Photocraft

把上游 [Photocraft](https://github.com/storytold/photocraft) 的官方 **web** 构建装进 Astravia 的活动面板：
编辑器本体逐字节未改，插件只负责把它供出来、并在它的两个 DOM 接缝上接管文件的进出。

决策与证据在 [`docs/adr/photocraft/`](../../../docs/adr/photocraft/)，本文件只讲怎么改这份代码。

## 三个入口，同一份字节

| 入口 | 谁打开 | 有工作区绑定 | 保存落到哪 |
| --- | --- | --- | --- |
| 活动面板标签页 | `ui.slot.activity-tab` | 有 | `ctx.fs` → 项目里的原路径 |
| 内置浏览器面板 | `ctx.browser.open(hubUrl)` | 无 | 浏览器下载 |
| 系统浏览器 | `ctx.ui.openExternal(hubUrl)` | 无 | 浏览器下载 |

后两个入口直接开 `http://127.0.0.1:<port>`。回环地址在浏览器里算 secure context，所以 WebGPU 与剪贴板都还在。

## 运行结构

```
renderer (dist/assets/index-*.js)          host-node 服务 (server/hub.mjs)
  ├─ 内联的 hub 源码 (?raw)  ──install──▶  写入 <data>/runtime/server/hub.mjs，宿主校验 sha256
  ├─ ctx.services.start()     ─────────▶  node server/hub.mjs，端口由 ASTRAVIA_SERVICE_PORT 注入
  └─ <iframe src=baseUrl>     ─────────▶  GET /            改写 index.html，插一行 host-bridge.js
                                           GET /host-bridge.js
                                           GET /<zip 内任意条目>  按中央目录 inflate，wasm 用 application/wasm
                                           GET /app/snippets/*   官方包缺这个目录，回到根 snippets/ 同字节作答
```

hub 自己不落盘解包：zip 以整份文件缓存在数据目录（`payload-<sha12>.zip`），请求到了才对单个条目
`inflateRaw` 并缓存。改写过的响应只有 `index.html`（两处纯插入：`<head>` 后的语言种子、`</body>` 前的 bridge）。

## zip 从哪来（ADR 0008）

越本地越优先，每一步都过 `payload/manifest.json` 钉住的 sha256：

1. 缓存 `payload-<sha12>.zip`；
2. `payload.json` 里的 `localFile`（绝对路径，或数据目录内的文件名）；
3. 数据目录及其上一级的 `photocraft-web-0.19.0.zip` 或 `payload.zip`；
4. `PHOTOCRAFT_PAYLOAD_ZIP=<绝对路径>`（只在手动跑 `node server/hub.mjs` 时生效）；
5. `PHOTOCRAFT_PAYLOAD_URL=<url>`（同上；唯一允许 `http:` 的入口）；
6. `sources[]`：`payload.json` 里自己加的镜像，再是上游 Release 与内置代理镜像。

1–3 不触网。`payload.json` 由 hub 首次启动自己写一份带说明的空壳，等待页会印出它的绝对路径；
全失败时等待页列出每个源与错误，并印出可复制的投放路径；文件落位后下一次刷新即 `ready`，
不需要重启服务。网络重试由请求触发并限流 60 s，等待页的自动刷新不会反复下载。

## 两条 DOM 接缝

桥只动两处，都在 `src/bridge/host-bridge.js`：

1. **打开** — 覆写 `HTMLInputElement.prototype.click`。rfd 的 wasm 后端靠一个隐藏 `<input type=file>`
   收文件，应用请求打开时改成向宿主发 `pc:pickOpen`；宿主回了字节就 `new File([...])` 塞进
   `input.files` 并派发 `change`，rfd 的 promise 照常 resolve。60 s 没有应答就放行原生行为。
2. **保存** — 覆写 `HTMLAnchorElement.prototype.click`。`web.rs::download` 造一个 `blob:` +
   `download` 的 `<a>` 再 `click()`，这里把它 fetch 回字节后发 `pc:save`，宿主用 `ctx.fs` 写盘。

两处都是**先判形状再拦截**：不带 `download` 的 `<a>`、不是 `blob:` 的 href、非 file 类型的 input 一律
放行。判不上就退化成原版 Photocraft 的行为，宁可少接管也不要拦坏。

## 降级梯子

上游不带参数时只试 WebGPU，失败就把 `#photocraft_loading` 改写成
`PhotoCraft failed to start: … A browser with WebGPU or WebGL2 is required.`，自己不会重试。

因此「就绪」的判据是 `#photocraft_loading` **消失**，不是脚本跑完：

- 消失 → `pc:ready{backend}`；
- 文案含 "failed to start" 或 30 s 超时 → `pc:error`；
- 标签页收到启动失败就换 `?webgl` 重挂 iframe，再失败换 `?cpu`，到 CPU 还失败才把原文案给用户。

## 开发

```bash
npm install          # SDK / plugin-vite 走仓库内 file: 链接，不走公网 registry
npm run check        # tsc --noEmit + hub 漂移检查
npm run build        # 重建 hub → tsc → vite build → release/photocraft-0.0.4.astraviapkg
```

### 改了 hub 就要同步 sha256

`server/hub.mjs` 是生成物（`scripts/build-hub.mjs` 把 `payload/manifest.json`、`server/hub.src.mjs`、
`src/bridge/host-bridge.js` 拼进去）。宿主安装服务时用 `plugin.json` 里的 sha256 校验实际字节，
所以改完必须：

```bash
npm run build        # 重新生成 server/hub.mjs
shasum -a 256 server/hub.mjs
```

把新值写进 `plugin.json` 的 `providers.services[0].runtime.platforms.*.artifacts[0].sha256`（五个平台同值），
再 `npm run build` 一次。`npm run check:hub` 只拦「生成物与源不一致」，拦不住「sha 忘了回写」——
后者要到桌面端安装时才会以 `SHA-256 mismatch` 报出来。

### 为什么 hub 要内联进 bundle

打包器收集运行时文件的清单里**没有** `providers.services[*].runtime.entry`（见
`plugin-sdk/src/manifest.ts::listPluginManifestResources` 与 `plugin-vite/dist/pack.js`）。把 hub 当裸文件留在
包内，市场安装版本里它会静默缺失。

`src/tab/service.ts` 因此 `import hubSource from "../../server/hub.mjs?raw"`，base64 之后当作
`install()` 的 payload 交给宿主。字节保真由同一套 text loader 保证，装错则会当场 sha 校验失败——是硬失败，
不是悄悄跑起来。代价只有一个：改 hub 必须重建渲染进程。

## 包体约束

- 市场归档 ≤ 25 MB、解压 ≤ 100 MB。本插件不进 wasm：zip（13,433,636 B）与拆开的 wasm（分片 13,328,607 B +
  内核 102,668 B）都在上游 Release 与用户数据目录里。
- 品牌图标 `assets/icon.png` 取自上游 `assets/app-icon/photocraft-1024.png`，不自绘近似商标。
- 卡片与详情默认英文，中文在 `detail.zh.json`；分类译名在市场源条目里。
- 界面语言默认中文：hub 在 `<head>` 里给上游偏好写一个空值种子（0011）；用户仍可在 Preferences 改回英文。

## 已知简化

- **分不清「另存为」与「导出」**：web 上 `pick_save` 没有对话框、只回建议文件名，三者都汇到同一个
  `<a download>`。插件按文件名判：与绑定同名 → 原地覆盖；否则 → `ctx.fs.saveAs`。首次保存才会绑定路径，
  导出不会偷走文档的保存目标。
- **看不到未保存修改**：上游不暴露 dirty 状态，只有本会话保存过才在重载前提示。
- **浏览器入口没有工作区绑定**：那两个页面拿不到 `ctx.fs`，打开走浏览器选择框、保存走下载。
- **不做 `/api/state` 轮询**：渲染进程跨源 fetch hub 会被 CORS 拦，状态只由 `pc:ready` 驱动。
