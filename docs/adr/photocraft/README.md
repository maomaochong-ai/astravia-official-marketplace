# Photocraft 插件 · 技术路线

> 一句话结论：**插件自带一个本地 hub，把上游 Photocraft 的 web 构建原样供在 `127.0.0.1` 上，
> 宿主标签页、宿主内置浏览器、系统浏览器三个入口打开的是同一个地址**。编辑器一行 Rust 都没改；
> 文件字节只在标签页那条路径上经过宿主。

- 插件目录：`abilities/plugins/photocraft`
- 决策日期：2026-11-03（`0001`–`0006` 修订，新增 `0007`、`0008`、`0009`；同日根据 Astravia 0.5.86 取证回填证据）
- 当前插件版本：`0.0.3`（`release/photocraft-0.0.3.astraviapkg`）
- 上游：Photocraft `v0.2.0`，`apps/photocraft-web` + `packaging/web/package.sh`
- 宿主：`open-astravia` 的 `ui.slot.activity-tab`、`ctx.browser`、`ctx.ui.openExternal`

## 决策表

| # | 决策 | 一句话 |
| --- | --- | --- |
| [0001](./0001-the-tab-runs-upstreams-web-build.md) | 形态 | 标签页的 iframe 加载上游官方 web 包；否决窗口嵌入、重写界面 |
| [0002](./0002-bytes-move-through-the-host.md) | 字节通路 | 注入 `host-bridge.js` 接管 rfd 的 `<input type=file>` 与 `<a download>`；宿主是路径权威；独立页里桥自己退位 |
| [0003](./0003-only-input-and-save-are-visible.md) | 可观察性 | 编辑器内部状态读不到；只观察「输入」与「保存」，关闭/重载一律确认 |
| [0004](./0004-no-agent-surface-in-the-tab.md) | Agent 面 | 不给 Agent 面向编辑器的工具；它能读绑定的文件路径，不能驱动 UI |
| [0005](./0005-payload-provenance-and-runtime-gate.md) | 来源与版本门 | 上游 Release 的 zip + `SHA256SUMS.txt` 校验；版本门是运行期能力探测 |
| [0006](./0006-tab-shell-not-a-second-app.md) | 外壳 | iframe 之外只有一条 28 px 信息条，且**只在标签页里存在** |
| [0007](./0007-one-loopback-hub-three-entries.md) | 载体 | 一个 host-node 服务供三个入口共用一个 loopback URL |
| [0008](./0008-payload-never-depends-on-one-host.md) | 来源解耦 | payload 取自有序列的 `sources[]` 加本地投放；sha256 是唯一信任锚 |
| [0009](./0009-fullscreen-belongs-to-the-frame.md) | 全屏 | 全屏是标签外壳容器的 `requestFullscreen()`，不是把面板拉到最大 |

术语见 [CONTEXT.md](./CONTEXT.md)。自定义协议那一路的探针见 [probe-embed.mjs](./probe-embed.mjs)。

## 落实与偏差

| # | 要求 | 设计上怎么落 | 现状 |
| --- | --- | --- | --- |
| 1 | 在标签页里用 Photocraft | `ui.slot.activity-tab` + `retention:"pinned"` + 自挂 iframe | 已实现（`src/index.tsx`） |
| 2 | 原汁原味，不重写编辑器 | hub 供的是 zip 里的字节，`.wasm`/`.js` 逐字节不变 | 已实现，本机验过 wasm 字节相等 |
| 3 | 打开工作区文件 | 资源管理器选区 → 桥接管 rfd 的 `<input type=file>` → 编辑器 文件›打开… | 已实现，接缝未在真实 Electron 里验过 |
| 4 | 通过宿主保存 | 拦截 `<a download>` → `ctx.fs.writeFile` 覆盖 / `saveAs` | 已实现，同上 |
| 5 | 不改上游 Rust | 只在响应 `index.html` 时插一行 `<script>` | 已实现 |
| 6 | 不信任未验证的二进制 | 每一份字节都过钉住的 sha256，不符即弃 | 已实现（`v0.2.0` 钉值；缓存/投放/镜像同一道闸） |
| 7 | 别让用户白屏 | 未就绪/失败/降级各有一屏；启动失败自动 `?webgl` → `?cpu` | 已实现 |
| 8 | 别丢用户的修改 | 重载前确认；残留待确认机制（0003） | 部分实现：仅本会话保存过时提示 |
| 9 | 宿主内置浏览器也能用 | `ctx.browser.open(hubUrl)` | 已实现；主机白名单只比主机名，`127.0.0.1` 已声明（策略代码确认，实机待验） |
| 10 | 系统浏览器也能用 | `ctx.ui.openExternal(hubUrl)` | 已实现（`http/https/mailto/tel` 已被宿主放行） |
| 11 | 外部浏览器也能保存回工作区 | **不做**：那里没有 `ctx.fs` | 硬边界，见 0007 D3 |
| 12 | 国内无代理网络也能用 | 缓存 → 投放 → `payload.json` 的 `localFile`/`sources[]` → 内置 `sources[]` | 已实现（0008 D2），回环侧逐项实测过 |
| 13 | 失败时知道下一步做什么 | 等待页列源与错误、印绝对投放路径；落位即 `ready`，不重启 | 已实现（0008 D4） |
| 14 | 换版本后不会继续跑旧 hub | `SERVICE_VERSION` 与 `runtime.version` 不一致就重装 | 已实现（`src/runtime.ts`） |
| 15 | tab 打开后能全屏 | 对标签外壳容器 `requestFullscreen()`，状态条保留退出按钮 | 已实现（0009），本机类型检查通过，实机未验 |
| 16 | 用户能自己指定 zip 或镜像 | 数据目录 `payload.json`（首启自写空壳，等待页印路径） | 已实现并实测（含非法源报错） |

## 为什么不是看上去那样

**1. 「SDK 没有承载 web 应用的容器」——错的。**
插件 UI 就是宿主 React 树里的组件，`<iframe>` 是普通 DOM。`ui.slot.activity-tab` 是现成槽位
（`packages/plugins/plugin-sdk/src/ui.ts`）。缺的从来不是 API，是没找对槽位。

**2. 「应用 → 宿主没有通道，所以只能轮询」——结论对，理由换了。**
这一版形态里根本没有控制通道，所以「读状态」不是难，是不可能（0003）。跨 iframe 边界只有
`postMessage`。

**3. 「保存会被浏览器下载接管」——只有在我们不管的时候。**
上游 `web.rs::download()` 走 `blob:` + `<a download>` + `click()`，而这段代码在**我们同一个文档**里，
所以能在 `prototype` 上截住（0002）。截不住时降级为浏览器下载，**可见地**降级。

**4. 「Electron 可以拦下载」——插件够不到。**
`session.on("will-download")` 在主进程；插件跑在渲染进程的 shim 里。接管落点只能靠 0002 的注入。

**5. 「需要 COOP/COEP 才能跑 wasm 应用」——不需要。**
上游不使用 SharedArrayBuffer，HOSTING 明确写「No special isolation headers」。

**6. 「插件不能带 20 MB 的二进制」——我们不带 wasm，只带 31 KB 服务脚本。**
市场包里是几百行 React 加一份内联的 `hub.mjs`（31 KB，`import … ?raw`，因为打包器不收集 `runtime.entry`；
见 0007 D1a）；10.76 MB 的 zip 与 25.8 MiB 的 wasm 始终留在上游 Release 与用户数据目录里。

**7. 「Agent 能不能让 AI 修图」——不能，且卡片文案不许暗示能。**
0004：没有面向编辑器的工具面。

**8. 「上游改版会不会静默损坏文件」——不会，只会降级。**
桥脚本先判形状再拦截（`input.type==="file"`、`a.download` 且 `href` 以 `blob:` 开头），判不上就放行。

**9. 「为什么标签页也走 HTTP，而不是宿主的 `astravia-file://`」——因为三个入口必须同源。**
系统浏览器解析不了自定义协议，所以 HTTP 源无论如何都得有；有了之后让标签页继续走另一条协议，
只会把「自定义协议下 WebGPU 是否可用、wasm 是否流式编译」这些未知数留在必经路径上（0007 §1）。
`http://127.0.0.1` 按规范就是 secure context。

**10. 「外部浏览器里为什么不能保存回项目」——因为那里没有宿主。**
`ctx.fs` 属于渲染进程；系统浏览器里跑的是普通网页。工作区权限只留在有权限的一侧，这是设计而不是缺口。

**11. 「全屏就是把面板调到最大」——不是同一件事。**

`setActivityPanelWidth("max")` 只是把侧边面板拉宽，标题栏、标签栏和侧栏还在，且无法用 Esc 退出。
真正全屏只能对 DOM 元素 `requestFullscreen()`，而落点必须是标签外壳容器：对 iframe 本身全屏，退出按钮就跟它一起消失（0009）。

## 证据清单

| 证据 | 位置 | 支撑哪条 |
| --- | --- | --- |
| web 构建跑的是同一个 `PhotocraftApp` | `apps/photocraft-web/src/{main,web}.rs` | 0001 D1 |
| 官方 web 包与体积闸门 | `packaging/web/package.sh` | 0001 §4、0005 |
| zip 真实身世：`v0.2.0` 清单里的 sha256 | 上游 `releases/download/v0.2.0/SHA256SUMS.txt`（200，1,535 B） | 0005 D1 |
| 打开走 rfd 的 DOM 覆盖层 | `rfd-0.16.0/src/backend/wasm.rs` | 0002 §2 C |
| 保存走 `blob:` + `<a download>` | `apps/photocraft-web/src/web.rs::download` | 0002 §2 C |
| 活动面板槽位与 `width:"max"`/`retention:"pinned"` | `plugin-sdk/src/ui.ts` | 0001 D4、0006 D3 |
| host-node 服务的声明与制品形状 | `open-ai-canvas/plugin.json`、`service-provider.d.ts` | 0007 D1 |
| `browser.open` 是 display-only | `plugin-sdk/src/browser.ts` | 0007 D6 |
| `ui.openExternal` 只收 http/https | `plugin-sdk/src/ui.ts` | 0007 D6 |
| `PLUGIN_PERMISSIONS` 里的权限名 | `plugin-sdk/src/permissions.ts` | 0007 D6 |
| `fs.read`/`fs.write`/`saveAs` 契约 | `plugin-sdk/src/fs.ts` | 0002 D2 |
| 上游启动成功才移除 `#photocraft_loading`、失败改写它 | `apps/photocraft-web/src/web.rs`、`index.html` | 0005 降级梯子 |
| `?webgl` / `?cpu` 是上游自带的开关，不传就只试 WebGPU | `web.rs` 的 `query()` 分支 | 0005 降级梯子 |
| 打包器不收集 `runtime.entry` | `plugin-vite/dist/pack.js`、`plugin-sdk/src/manifest.ts::listPluginManifestResources` | 0007 D1a |
| 内联字节与文件逐字节相同 | `server/hub.mjs` 31,202 B，`sha256 7905655e…4a6d`；反转义后重算 sha 相等 | 0007 D1a |
| hub 本机实测 | `/health` 200、`/..%2f..%2fetc/passwd` 404、`POST /` 405、wasm 200 `application/wasm` 27,072,762 B | 0007 D2、D5 |
| 多源与投放逐项行为 | 缓存命中零网络、只放 `localFile` 即 `ready`、截断文件被 `sha256-mismatch` 拒、全源失败后投放自愈 | 0008 D2–D4 |
| 镜像可用性与续传 | `ghproxy.net` / `gh-proxy.com` / `ghfast.top` 的 `SHA256SUMS.txt` 均 200、1,535 B；`ghproxy.net` 对 zip 回 `206` | 0008 D3、D6 |
| 主窗口没有 CSP；唯一 CSP 属 markdown 预览隔离窗（自带 `frame-src 'none'`） | `renderer/index.html`、`main/main-Ces8nWEj.js`、`markdown/isolated-window.ts` | 0007 §5、0009 |
| 活动标签是同渲染进程的 React 组件 | `renderer/assets/RootOverlayViews-*.js`（`registerActivityTab`/`openActivityTab`/`setActivityPanelWidth`） | 0007 §5、0009 |
| 权限处理器除 `media` 外一律放行 | `main/main-Ces8nWEj.js::setPermissionRequestHandler` | 0007 §5、0009 D3 |
| host-node 服务的 env 是白名单 + 四个模板令牌 | `main/main-Ces8nWEj.js`（`INHERITED_ENV_KEYS`、`createPluginCommandEnvironment`、`TOKEN_PATTERN`）；运行中子进程 `ps -Eww` | 0007 D1b、0008 D2-4 |
| 内置浏览器是主窗口里的 `<webview>`，主窗口 `webviewTag: true` | `window-manager.ts:76`、`BrowserPanel.tsx`、`browser-open-policy.ts` | 0007 D6 |
| `payload.json` 首次启动自写、可指定 `localFile` 与额外镜像 | 实测：空数据目录生成空壳；填 `localFile: /tmp/pc-web.zip` → `ready/source:local`；`ftp://` 源报 `config-source-invalid` | 0008 D2-4 |

## 未验证清单

已由宿主取证消解：

- 内置浏览器面板允许 loopback —— 白名单只比主机名，忽略端口；`127.0.0.1` 已在 `browser.allowedHosts` 里；
- 渲染进程不限制 `frame-src` —— 主窗口没有 CSP；
- `PHOTOCRAFT_PAYLOAD_*` **不透传** —— 宿主只给白名单环境，用户可配面改为 `payload.json`。

仍未验证：
1. host-node 服务进程的出站网络是否被宿主策略限制（拉 payload 依赖它）。
2. `http://127.0.0.1` 在宿主 Electron 里是否真被当作 secure context（`isSecureContext` + `navigator.gpu`）。
3. 给 `<input type=file>.files` 赋值并派发 `change` 能否让 rfd 的 promise 正常 resolve。
4. 覆盖 `HTMLAnchorElement.prototype.click` 能否拦住 `web.rs::download`。
5. `ctx.fs.writeFile` 的 base64 单次上限（1/8/32/64 MB），决定 Save 的体积阈值与降级点。
6. 27 MB 的 `.wasm` 从 hub 首次响应到浏览器流式编译完成的耗时（本地回环响应已实测 0.137 s，编译未测）。
7. `rfd 0.17` 是否与 0.16 同构（本机只有 0.16 源码）。
8. 容器级全屏在真实 macOS 窗口下的观感，以及 Esc 退出后 iframe 不重载。

## 下一步

1. 在 Desktop 里「能力 → 添加市场源」装本插件，依次验证三个入口各开一次页面。
2. 回填上面「仍未验证」那 7 项（服务出站网络、secure context、`<input type=file>` 赋值、`<a download>` 拦截、
   `ctx.fs.writeFile` 单次上限、27 MB wasm 编译耗时、`rfd 0.17`）；第 1 项若被墙，把 zip 投到等待页印出的路径
   或在 `payload.json` 里写 `localFile`（0008 D2-2/D2-4），不需改任何配置。
3. 数位板压感在 web 构建里不存在（`photocraft-tablet` 仅原生），这是已知能力差距，不列在待办里。
