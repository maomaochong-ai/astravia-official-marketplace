# ADR 0001：标签页里跑的是上游自己的 web 构建，不是自研编辑器

- 状态：提议（2026-11-02，取代 2026-11-01 的同一编号草案）
- 决策对象：`abilities/plugins/photocraft`（尚未创建，本 ADR 定其形态）
- 关联文档：[CONTEXT.md](./CONTEXT.md)、[0002](./0002-bytes-move-through-the-host.md)、[0005](./0005-payload-provenance-and-runtime-gate.md)

## 1. 背景

Photocraft 是 Rust + egui/wgpu 的图像编辑器，`crates/` 下 23 个 crate（`engine`、`compose`、
`gpu`、`paint`、`ops`、`algo`、`raw`、`psd`、`cms`、`tablet`…）。它有两个前端：

| 前端 | 形态 | 跑的是什么 |
| --- | --- | --- |
| `apps/photocraft` | 原生窗口（eframe 桌面后端） | `photocraft_ui_egui::PhotocraftApp` |
| `apps/photocraft-web` | Trunk → `dist/web`（wasm32） | **同一个** `photocraft_ui_egui::PhotocraftApp` |

`apps/photocraft-web/src/main.rs` 在 wasm 下只调 `web::start()`，而 `web.rs` 用
`eframe::WebRunner` 把 `PhotocraftApp` 挂到 `<canvas id="photocraft_canvas">` 上——**web 构建不是
另一套实现，是同一套 UI 换了个窗口后端**（Observed：`apps/photocraft-web/src/{main,web}.rs`）。

前稿（2026-11-01）判「宿主没有承载第三方 web 应用的容器」，因此选了「插件只做控制面」。
这条判断**是错的**，错在把「SDK 没有 iframe slot API」当成了「插件不能渲染 iframe」：插件 UI 就是
宿主 React 树里的组件，`<iframe>` 只是普通 DOM；`ui.slot.activity-tab` 是现成的标签页槽位
（Observed：`packages/plugins/plugin-sdk/src/ui.ts:PluginActivityTabContribution`），而
`mobile-ui-preview` 已在生产代码里用 `<iframe src="astravia-file://local<path>">` 渲染本地静态页面
（Observed：`packages/plugins/externals/mobile-ui-preview/src/MobilePreviewPanel.tsx:17,253`）。

## 2. 候选

### A. 原生窗口嵌进宿主（否决）

Electron 的 `webContents.sendInputEvent` 只能发给自己进程内的 webContents，没有对外部窗口合成输入的
能力；DOM 里的标签页也无法裁切一个系统级窗口，把两者叠在一起的窗口在拖动、缩放、跨屏、多个显示器
DPI 不同的情况下都会露馅。要真做到得写每平台原生模块（`NSView` 重挂载 / `SetParent`），那是研究项目
不是插件（理由与前一稿相同，未变）。

### B. 用宿主 React 重写编辑界面（否决）

等于重做像素引擎、GPU 合成、PSD/RAW/色彩管理、画笔/数位板、撤销历史、格式编解码——跨越 23 个 crate
且上游仍在 alpha 期高频演进。这正是用户明确排除的「重复造轮子」。

### C. 只做驾驶舱，像素留在外部窗口（降级选项，不选）

能跑通（控制通道是真的，见 [0005](./0005-payload-provenance-and-runtime-gate.md) 的可选轨道），但
宿主里永远看不到画布，用户每改一笔都要在两个窗口之间来回。用户要的是「在标签页里用」，这不是它。

### D. 标签页里嵌上游 web 构建（选定）

```
┌─ Host (Astravia) ──────────────────────────────────────────┐
│  活动面板标签页  ▸ PhotoCraft                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ <iframe sandbox="allow-scripts allow-same-origin …">  │  │
│  │   http://127.0.0.1:<port>/index.html (hub)           │  │
│  │     ├─ 上游 dist/web（未改一行 Rust）                 │  │
│  │     └─ host-bridge.js（我们注入的同文档脚本）         │  │
│  └──────────────────────────────────────────────────────┘  │
│        ▲ postMessage（字节）        │ postMessage（事件）  │
│        └──── 插件 React 组件 ───────┘                     │
│                   │ ctx.fs.readBinaryFile / writeFile     │
└───────────────────┼───────────────────────────────────────┘
                    ▼
              工作区文件（宿主权威）
```

## 3. 决策

**D1** 选 D。标签页里加载的是**上游官方发布的 `photocraft-web-<version>.zip`**（由
`packaging/web/package.sh` 产出、随 GitHub Release 发布）。这个 zip 由插件自带的
[loopback hub](./0007-one-loopback-hub-three-entries.md) 解出并在 `http://127.0.0.1:<port>/` 上供给，
标签页只是它的第一个消费者。渲染的是上游的 `PhotocraftApp`，因此「原汁原味」是**同一个编辑器**，
不是仿制品。

**D2** 插件不实现任何图像处理，也不 fork UI。补丁面只允许存在于**我们自己的两个文件**
（`index.html` 里新增一行 `<script>`、`host-bridge.js` 本体），上游 `.wasm` 与 `.js` 胶水逐字节不变，
归档 sha256 在解包前校验。

**D3** 不带原生二进制，不需要 `--control`、不需要 Token、不需要 Roots、不需要用户再装一个 App。
前稿的控制通道与 MCP 面降为**可选轨道**，不属于这一版形态（见 [0004](./0004-no-agent-surface-in-the-tab.md)）。

**D4** 槽位取 `ui.slot.activity-tab`（活动面板标签页），不用 `ui.slot.workspace-view`：后者是侧边栏
导航条目、占满整块内容区，拿不到会话 cwd 的绑定，而活动面板标签页天然按会话作用域出现。
打开参数 `{ width: "max" }`（编辑画布不能只有 420 px）与 `retention: "pinned"`（切走再回来不能把
整个编辑器实例从 LRU 里淘汰掉、丢掉撤销历史）。

## 4. 后果

- **好处**：插件体积极小（只有桥脚本与几十行 React），上游升级＝换一个 zip 的版本号；用户看到的是
  Photocraft 自己的界面，没有一个我们发明的按钮。
- **代价一**：编辑器的全部状态在 iframe 里，宿主读不到（见 [0003](./0003-only-input-and-save-are-visible.md)）。
- **代价二**：文件进出必须经过 `postMessage` 与 `ctx.fs`，大文档有编码开销与未测上限
  （见 [0002](./0002-bytes-move-through-the-host.md) §4）。
- **代价三**：首次启用要下载 10,755,523 B 的 zip（约 10.3 MiB），其中 wasm 单文件 27,072,762 B（约 25.8 MiB，
  Observed：`v0.2.0` 的 `photocraft-web-0.2.0.zip` 实测清单）。它必须在首次打开时经回环地址
  `application/wasm` 送达 iframe 并流式编译；落盘位置与校验见 [0005](./0005-payload-provenance-and-runtime-gate.md)。
- **代价四**：iframe 的 WebGPU 可用性取决于宿主的 Chromium 与显卡，不是我们能保证的；必须有
  `?webgl` / `?cpu` 降级梯子，且降级是**性能损失而非功能损失**。

## 5. 证据与未验证

Observed：`apps/photocraft-web/src/web.rs` 的 `WebRunner` 启动与 `services()` 接线；
`packaging/web/package.sh` 的产物名与 24 MiB 闸门；`.github/workflows/release.yml` 的 `web` job 上传
`dist/release/*` 并在 release job 里 `sha256sum -- *` 计入 `SHA256SUMS.txt`；宿主
`ui.slot.activity-tab` 契约、`width:"max"`、`retention:"pinned"`；`mobile-ui-preview` 的
`astravia-file://local…` iframe；`assertPathReadableForPreview` 允许家目录与项目根。

未验证（第一条是这一版的生死题；自定义协议那一路的测法留在 [probe-embed.mjs](./probe-embed.mjs)，
换成 hub 之后的测法见 [0007](./0007-one-loopback-hub-three-entries.md) §5）：
1. `http://127.0.0.1:<port>` 在宿主 Electron 里是否真是 secure context、能否拿到 WebGPU；拿不到时
   `?webgl` 是否可用、帧率是否够编辑。
2. 25.8 MiB 的 `.wasm` 从首次 inflate 到浏览器流式编译完成的总耗时：本地回环实测响应 0.137 s、
   字节与原文件逐字节一致（Observed），浏览器侧编译与本机首次下载耗时仍未测。
3. 宿主 Chromium 是否在某平台上禁用了 WebGPU（Electron 版本差异，未核对）。

## 6. 修订（2026-11-03）

D1 的传输从 `astravia-file://` 改为插件自带的 loopback hub，三个入口的完整形态见
[0007](./0007-one-loopback-hub-three-entries.md)。原因有两条：系统浏览器无法解析自定义协议，所以
「在外部浏览器里用」这一条本来就必须有 HTTP 源；而一旦这个源存在，让标签页继续走自定义协议只是把
「custom scheme 下能否拿到 WebGPU、25.8 MiB 的 wasm 是否流式编译、`content-length`/Range 是否齐备」
这些未知数留在了必经路径上。

§2 的候选比较、§3 的 D2（补丁面只有我们自己的文件）与 D4（槽位、`width:"max"`、`retention:"pinned"`）
不变。D3 的「不带原生二进制」仍然成立：hub 是一个 Node 单文件，由宿主既有的 host-node 运行时拉起，
不是任何平台的二进制。
