# ADR 0007：一个本地回环 hub 同时供三个入口使用

> **已两度改写**（2026-11-04）：本文的"首次打开时从上游 Release 下载、由回环 hub 发文件"链路先被
> [craft-0011](craft-0011-the-site-ships-in-the-package.md) 换成 CI 源码构建，又被
> [craft-0012](craft-0012-the-site-is-upstreams-release-bundle.md) 换成"打包时下载上游发布的那份 web 包"。
> 站点仍来自上游，只是下载时机从运行时挪到了打包时。以下是当时的判断留痕。


- 状态：已接受（2026-11-03；同日补记 Astravia 0.5.86 宿主取证，见 §5）
- 关联文档：[0001](./0001-the-tab-runs-upstreams-web-build.md)、[0002](./0002-bytes-move-through-the-host.md)、[0005](./0005-payload-provenance-and-runtime-gate.md)、[0006](./0006-tab-shell-not-a-second-app.md)、[CONTEXT.md](./CONTEXT.md)

## 1. 背景

要求是：插件装好之后，**既能在宿主里用 Photocraft，也能在系统浏览器里用它**，两处都是同一份上游构建。

`astravia-file://` 只在 Electron 内部存在。系统浏览器打开 `astravia-file://local/…` 会得到一个无法解析的
协议——这不是权限问题，是协议只注册在我们自己的进程里（Observed：该命令行的注册点在宿主主进程
`registerSchemesAsPrivileged` + `protocol.handle`）。所以「外部浏览器」这一条**必须有一个 HTTP 源**。

一旦这个 HTTP 源存在，第二件事就该被追问：标签页为什么还要走另一个协议？

0001 的 D1 原本让标签页走 `astravia-file://`，理由是「宿主已有这个静态协议，不必自带服务器」。但那条
理由的代价是一串**只有自定义协议才有的未知数**：自定义协议下是不是 secure context（WebGPU、剪贴板都要
它）、19.7 MB 的 `.wasm` 经 `protocol.handle` 是不是流式编译、`content-length` 与 Range 是否齐备、
iframe 内 `fetch` 自家资源算不算跨源。这些全部只能用探针一条条测（见 `probe-embed.mjs` 的设计动机）。

而 loopback HTTP 把这些未知数**结构性消掉**：`http://127.0.0.1:<port>` 按规范是 potentially trustworthy
origin（等于 secure context），静态服务由我们自己写、`application/wasm` 与 `content-length` 由我们自己发，
页面与它的 API 同源、不需要 CORS。

## 2. 候选

### A. 双路：标签页走 `astravia-file://`，外部浏览器走一个只做外链的小服务器（否决）

两条传输就是两套 bug 面：自定义协议那一路的全部未验证项（WebGPU、wasm 流式编译、Range）一个都没消失，
只是被限制在标签页里；而外部浏览器那一路又需要一个完整的静态服务。同一份 payload 被两段代码解释，
「在宿主里能开、在浏览器里打不开」会变成常态故障。

### B. 只做外部浏览器，宿主里只留一个按钮（否决）

用户要的是「在宿主里用」，把它降级成「点一下跳出去」就是 0001 §2 已经否决过的 C 方案换了个壳。

### C. 一个 host-node 服务，三个入口共用它（选定）

```
             ┌──────────────────── Photocraft Hub (host-node) ───────────┐
             │  GET /            → payload/index.html（注入一行 script） │
             │  GET /host-bridge.js、/p.craft.js、/*.wasm（application/wasm）
             │  GET /api/state   → { phase, version, sha8, backend? }    │
             │  GET /health      → 200 when the payload is servable      │
             └───────────────▲───────────────────────▲──────────────────┘
                             │ http://127.0.0.1:<port> │
   ┌─────────────────────────┴──────┐        ┌───────┴──────────────┐
   │ 标签页 <iframe>（宿主内）      │        │ 系统浏览器           │
   │ + postMessage 文件桥（0002）   │        │ 原生 input / 下载    │
   └────────────────────────────────┘        └──────────────────────┘
                             ▲
              ctx.browser.open(url)  ← 宿主内置浏览器面板
```

## 3. 决策

**D1 载体是宿主的 host-node 服务**，声明在 `plugin.json#providers.services`，`runtime.kind = "host-node"`，
单文件入口 `server/hub.mjs`，按 sha256 钉住；端口由宿主注入 `ASTRAVIA_SERVICE_PORT`，渲染进程从
`ctx.services.connection(serviceId)` 拿 `baseUrl`。

**D1b 服务能看到的进程环境是被筛过的，不是继承来的 shell。** 宿主只复制 23 个基础键（`PATH` / `HOME` /
`LANG` / `TMPDIR` / `npm_config_*` 等），再把 `plugin.json#providers.services[].process.env` 里声明的键展开后并入；
模板令牌只有四个——`${ASTRAVIA_SERVICE_PORT}`、`${ASTRAVIA_SERVICE_RUNTIME_DIR}`、
`${ASTRAVIA_SERVICE_DATA_DIR}`、`${ASTRAVIA_SERVICE_CACHE_DIR}`（另有 `${ASTRAVIA_SERVICE_SECRET_<NAME>}`）。因此
「用 shell 环境变量给服务传参」在这个宿主上不成立：父进程里 `export PHOTOCRAFT_PAYLOAD_URL=…` 不会出现在子进程
里（Observed：`INHERITED_ENV_KEYS`、`createPluginCommandEnvironment()`、`TOKEN_PATTERN`；运行中的 hub 子进程实测
只有那四个 `ASTRAVIA_SERVICE_*`）。服务的可配面因此只能是**数据目录里的文件**（0008 D2-4）。

**D1a 这个文件的字节是内联进渲染进程 bundle 的，不是用 `astravia-plugin://` 从包里取的**。理由是一条实测：
插件打包器的收集范围是 `plugin.json` / `manifest.entry` / `dist/assets/**` / `scripts/` / `locales/` 等白名单，
`providers.services[*].runtime.entry` 不在其中（`listPluginManifestResources()` 只登记 `templates[].source`）。
于是 `import hub from "../../server/hub.mjs?raw"` 把 22 KB 脚本编进 `dist/assets/*.js`，安装时作为
`install()` 的 payload 交给宿主；宿主仍然对着 `plugin.json` 的 sha256 校验，所以“包里的 hub 与声明不一致”
会当场安装失败，而不是静默跑起来。代价是 hub 改一次就要重构建一次渲染进程（`check:hub` 拦漂移）。

**D2 只听回环**。`server.listen(port, "127.0.0.1")`，不监听 `0.0.0.0`，不提供 `Access-Control-Allow-Origin`
——页面与 `/api/*` 同源，不需要 CORS；放开 CORS 只会让同机的任意网页也能读这个服务。

**D3 读接口不设令牌，因为没有可保护的东西**。服务提供的字节就是上游公开的发行包，同机的任何进程本来
就能从 GitHub 下到同一份；加一个令牌只是把「本机进程能读」变成「本机进程能读，但要先读另一个文件」。
服务**没有写接口**：它不碰工作区、不接受路径参数、不落盘解包（见 D4）。工作区的读写权威仍然只在渲染
进程的 `ctx.fs` 上（0002 D2 不变）。

由此得到一条**必须写进产品文案**的硬边界：**外部浏览器里没有工作区绑定**。那边没有宿主，也就没有
`ctx.fs`，打开走浏览器自己的文件选择器、保存走浏览器下载——这正是上游 web 版的原始行为。想要「保存回
工作区」只能在标签页里做。这不是缺功能，是把权限留在有权限的那一侧。

**D4 不落盘解包**。zip（v0.2.0 为 10,755,523 B）以整份文件缓存在数据目录，解析中央目录建一张 `name →
{offset, compressedSize, method}` 索引；请求到来时按需 `inflateRawSync` 并缓存，命中即回。好处有三条：没有解压
目录可被路径穿越（我们不把 zip 里的名字交给文件系统）、没有「解到一半」的中间状态、换版本只需换一个文件名。
代价是常驻约 10.8 MB（zip）+ 首次访问各文件时的一次 inflate。

**D5 注入仍在服务侧完成，且仍只有一处**。响应 `/index.html` 时，在 `</body>` 前插入
`<script src="./host-bridge.js"></script>`（找不到 `</body>` 就原样返回并由 `/api/state` 报 `inject-miss`）；
`/host-bridge.js` 由服务提供（内嵌在 `hub.mjs` 里，与 `src/bridge/host-bridge.js` 同源生成）。上游
`.wasm` 与 `.js` 胶水逐字节不变——0001 D2 的补丁面约束没有放宽。

**D6 三个入口共用一个 URL**：

| 入口 | 调用 | 权限 | 文件桥 |
| --- | --- | --- | --- |
| 标签页 | `registerActivityTab` → `<iframe src={url}>` | `ui.slot.activity-tab` | 有（postMessage） |
| 宿主内置浏览器 | `ctx.browser.open(url)` | `browser.open` | 无 |
| 系统浏览器 | `ctx.ui.openExternal(url)` | `shell.openExternal` | 无 |

`ctx.browser.open` 是**只读展示**语义（Observed：`PluginBrowserApi.open` 的注释明确写着 display-only，
不授予自动化或内容读取），因此它不会给插件额外的能力面，也不需要 `browser.read`。

`browser.open` 的实际路径是「归一化 URL → 写 `openUrlInBrowserAtom` → 活动面板里的单 `<webview>`」
（Observed：`plugin-host-apis.ts::createBrowserApi`、`browser-open-policy.ts`、`BrowserPanel.tsx`）。两处硬约束：
URL 必须是 `http:`/`https:` 且主机名命中 `plugin.json#browser.allowedHosts`（只比主机、不比端口，所以每次变化的
回环端口不影响）；且必须存在活动会话，否则抛 `Cannot open browser without an active session`。主窗口
`webviewTag: true`，全库唯一会拦 webview 的 `will-attach-webview` 属于 markdown 隔离窗——回环地址在面板里可达。

**D7 服务的生命周期与插件激活对齐，不与标签页对齐**。用户可能关了标签页却还开着系统浏览器，所以
「关闭标签页」不停服务；停服务只有两个来源：宿主停用/重载插件，或用户在插件面板里点「停止」。

**D8 端口是每次启动分配的，因此「外部链接」不可收藏**。这个 URL 随服务重启变化；需要长期入口的人应该
自建静态托管（上游 `HOSTING.md` 的用法），而不是记住这个端口。

## 4. 后果

- **好处一**：一份 payload、一段服务端代码、一个 URL。「在宿主里能开、在浏览器里打不开」这类故障不再
  可能由传输差异引起。
- **好处二**：`?webgl` / `?cpu` 的降级梯子（0005 D4）在三个入口上是同一套，不需要按入口分别测。
- **代价一**：多一个 Node 子进程（单文件、无依赖），以及宿主对 host-node 服务的既有约束——`health.timeoutMs`
  schema 上限 120000，首次下载 10.8 MB 必须在 health 就绪前完成或改为「就绪后再下」。本 ADR 选后者：
  `start()` 立刻 ready，payload 在后台拉，`/api/state` 报进度，`/` 在 payload 未就绪时返回一个等待页。
- **代价二**：标签页与父页面从此是**跨源**（`http://127.0.0.1:<port>` vs 宿主 origin），`postMessage` 的
  `targetOrigin` 只能写 `"*"`，安全靠接收侧的 `event.source === iframe.contentWindow` 校验（0002 D3 不变）。
- **代价三**：首次启用必须联网（或在设置里给一个本地 zip），这是 0005 §3 已有的代价，现在由服务进程承担，
  失败文案要出现在标签页与服务状态两处，不能只写日志。

## 5. 证据与未验证

Observed：
- `providers.services` 的 host-node 形态、`runtime.platforms[].artifacts[{sha256,archive,destination}]`、
  `process.env.ASTRAVIA_SERVICE_PORT`、`health.path/timeoutMs`：`abilities/plugins/open-ai-canvas/plugin.json`；
- `PluginServiceApi.connection/getStatus/install/start/stop` 与「绝对 URL 被拒绝」的说明：
  `@astravia-org/plugin-sdk/dist/service-provider.d.ts`；
- `PluginBrowserApi.open` 的 display-only 注释、`PluginUiApi.openExternal` 的 http/https 限制：
  `dist/browser.d.ts`、`dist/ui.d.ts`；
- 权限名 `ui.slot.activity-tab`、`browser.open`、`shell.openExternal`、`fs.read`、`fs.write`：
  `dist/permissions.d.ts` 的 `PLUGIN_PERMISSIONS`；
- 上游 web 包的真实身世：`photocraft-web-0.2.0.zip` 在 `SHA256SUMS.txt` 中记为
  `a03e6118beed115eac25e6f0d11d3a3b3a3624538bf8a77dbaebf2352bf48e5f`（`v0.2.0` 的 `SHA256SUMS.txt`，
  HTTP 200，1,535 B）；
- 插件包不含 `providers.services[*].runtime.entry`：先用 `unzip -l release/photocraft-0.0.2.astraviapkg`
  看到只有 14 个条目、没有 `server/hub.mjs`，再读 `@astravia-org/plugin-vite/dist/pack.js` 与
  `plugin-sdk/dist/manifest.js` 确认收集清单（这就是 D1a 的原因）；
- hub 已在本机跑通（`server/hub.mjs` 22,453 B / `sha256 236c714e…cab5`）：`.wasm` 得 200
  `application/wasm`、27,072,762 B、字节与 zip 内原件逐字节相同、耗 0.137 s；`/..%2f..%2fetc/passwd` 得 404；
  `POST /` 得 405。
- 宿主 0.5.86 的渲染入口没有 CSP（Observed：`renderer/index.html` 无 `<meta http-equiv="Content-Security-Policy">`；
  全库唯一一处 `Content-Security-Policy` 字符串属于 markdown 预览的隔离窗，那个窗口自带 `frame-src 'none'` 且
  `onBeforeRequest` 只放行 `data:`/`about:`）；
- 活动标签是**同一个渲染进程里的 React 组件**，不是宿主托管的 iframe（Observed：
  `renderer/assets/RootOverlayViews-*.js` 的 `registerActivityTab` / `openActivityTab` / `setActivityPanelWidth`）；
  iframe 的 `sandbox` 与 `allow` 因此由插件自己决定；
- 主 session 的权限处理器只对 `media` 做判断，其余一律 `callback(true)`（Observed：`setPermissionRequestHandler`），
  元素级全屏、剪贴板不会因权限被拒（见 0009）；
- 宿主没有标签页级全屏：全库 `requestFullscreen` 只在一份无关的第三方 chunk 里出现一次（Observed）。

已由宿主取证消解（2026-11-03）：

1. 内置浏览器面板允许 loopback —— 主机白名单只比主机名，`127.0.0.1` 已在 `browser.allowedHosts` 里（D6）。
2. 渲染进程不限制 `frame-src` —— 主窗口没有 CSP（§5 Observed）。

仍未验证：
3. host-node 服务进程的出站网络是否被宿主策略限制（下载 payload 依赖它）。
4. `http://127.0.0.1` 在宿主 Electron 里是否被当作 secure context（规范如此，但 Electron 的
   `registerSchemesAsPrivileged` 可能改变默认集合，需实测 `navigator.gpu` 与 `isSecureContext`）。
