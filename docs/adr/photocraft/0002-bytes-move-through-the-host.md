# ADR 0002：文件的字节由宿主搬运，编辑器只负责编辑

- 状态：提议（2026-11-02，取代同一编号的「控制通道归属」草案）
- 关联文档：[0001](./0001-the-tab-runs-upstreams-web-build.md)、[0003](./0003-only-input-and-save-are-visible.md)、[CONTEXT.md](./CONTEXT.md)

## 1. 背景

上游 web 构建的文件 I/O 是**面向独立网页**写的，不是面向宿主嵌的：

| 动作 | 上游实现（`apps/photocraft-web/src/web.rs`） | 在 iframe 里的后果 |
| --- | --- | --- |
| 打开 | `pick_open` → `rfd::AsyncFileDialog::pick_file()` | 弹的是 **iframe 自己的** rfd 覆盖层 / 系统选择器，宿主不知道用户选了什么 |
| 另存名 | `pick_save` → 直接返回建议名（注释：web 上没有保存对话框） | 无路径可言 |
| 写盘 | `write(path, bytes)` → `download()`：Blob + `URL.createObjectURL` + `<a download>` + `click()` | 浏览器下载，落默认下载目录，**不经过宿主** |

而用户的要求是「打开工作区文件、通过宿主保存导出」。两条硬约束：

- 跨源 / 沙箱的 iframe，父页面**不能**脚本化子页（读不到 DOM、调不到函数）。
- Electron 的下载拦截（`session.on("will-download")`、`item.setSavePath`）在**主进程**；插件跑在渲染
  进程的 shim 里，触达不到，因此不能靠拦截下载来接管落点。

能跨过这道墙的只有两条通道：`postMessage`（可传 ArrayBuffer/Transferable），以及一个 HTTP 请求
（页面向自己所在的源 `http://127.0.0.1:<port>` 发，见 [0007](./0007-one-loopback-hub-three-entries.md)。
标签页用前一条，因为只有它能拿到宿主的 `ctx.fs`；外部浏览器没有可以请求的对端。

## 2. 候选

### A. 不补丁，接受系统选择器 + 浏览器下载（否决为默认）

用户用 Photocraft 自己的 Open 选文件（rfd），保存落到 `~/Downloads` 再自己搬回项目。功能上「能用」，
但它把「通过宿主保存」这条要求直接交还给用户手动搬运，且在无 `allow-downloads` 的沙箱里连下载都会被
静默拦掉。留作**降级路径**，不作默认。

### B. 改上游 Rust：加 `postMessage` 桥（否决为默认）

约 40–50 行（启动时 `postMessage({ready})`、监听 `message` 灌 inbox、`write()` 改走宿主）。这是最干净的
形态，但要 Rust + wasm32 + trunk + wasm-opt 工具链自己构建 19.7 MB 的 wasm，产物从此是**我们的**构建而
不是上游的；市场 CI 没有 Rust，等于每次上游发版我们都要在自己机器上重建一次并自证可信。

### C. 在 iframe 的同文档里注入一段脚本，接管两个 DOM 接缝（选定）

关键观察：**我们的脚本和 wasm 应用在同一个文档里**（我们只是往 `index.html` 加一行 `<script>`），
所以同源、能读写 DOM、能改 `prototype`。两个接缝都在 DOM 上，不在 Rust 里：

- **打开**：rfd 的 wasm 后端不是系统对话框，而是自己建的覆盖层 `#rfd-overlay`，里面一个
  `<input type="file">`，promise 在 `input` 的 `change` 事件（或 OK 按钮）时 resolve，读取
  `input.files()`；当 `navigator.userActivation.isActive()` 为真时它会直接 `input.click()` 弹出选择器
  （Observed：`rfd-0.16.0/src/backend/wasm.rs`，本机 cargo registry；仓库钉的是 `rfd = "0.17"`，
  同一条实现路径为 **Inferred**）。
  → 我们覆盖 `HTMLInputElement.prototype.click`（仅 `type=file`）：不弹选择器，改向宿主请求文件；
  拿到字节后 `new File([bytes], name)` 塞进 `input.files`（`DataTransfer`）并派发 `change`，rfd 正常
  resolve，应用照自己的逻辑打开文档。
- **保存/导出**：`download()` 造一个带 `download` 属性的 `<a>` 并 `click()`。
  → 我们覆盖 `HTMLAnchorElement.prototype.click`（仅带 `download` 且 `href` 是 `blob:`）：不触发下载，
  而是 `fetch(href)` 取回字节，`postMessage` 给宿主，由宿主写盘。

## 3. 决策

**D1** 走 C。字节路径固定为：**宿主读 → postMessage → iframe 的 rfd 输入框 → 应用**，以及
**应用 → blob → postMessage → 宿主 `ctx.fs` 写盘**。任何时刻插件自己不解析图像格式。

**D2** 宿主是**路径唯一权威**。标签页维护一份 File Binding：`{ workspacePath, docName, savedAt }`。
保存时靠**文件名**分两路：上游 `pick_save` 在 web 上直接返回文档自己的名字（没有对话框），另存/导出才
返回一个新名字。所以 `download` 属性等于绑定文件名 → `ctx.fs.writeFile(workspacePath, base64, "base64")`
原地覆盖；不同名或尚无绑定 → `ctx.fs.saveAs(name, base64, "base64")` 让用户选位置。只有首次保存会把
返回值变成新绑定：导出不应偷走文档的保存目标。

**D3** 消息信封（`postMessage`，父窗口用 `event.source === iframe.contentWindow` 验身；子窗口的
targetOrigin 只能写 `"*"`——页面在 `http://127.0.0.1:<port>`，父窗口是宿主的自定义 origin，没有一个
双方都宜硬编码的字符串。因此**验身只认 `event.source`**，不认 `event.origin`）：

| 方向 | 消息 | 载荷 |
| --- | --- | --- |
| frame → host | `pc:ready` | `{backend, href, secure}`：`#photocraft_loading` 已消失，即编辑器真的起来了 |
| frame → host | `pc:pickOpen` | 应用请求打开（rfd 被拦截） |
| frame → host | `pc:save` | `{name, mime, bytes}`，`bytes` 为 ArrayBuffer（Transferable） |
| frame → host | `pc:error` | `{backend, message}`：启动失败文案或 30 s 超时（`boot-timeout`）；普通 `onerror` 也走这里，但宿主只把启动失败当降级信号 |
| host → frame | `pc:open` | `{name, mime, bytes}` |
| host → frame | `pc:cancel` | 用户在宿主侧取消选择 |

**D4** iframe 的 `sandbox` 由插件自己声明：
`sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"`。
`allow-downloads` 保留给降级路径 A；`allow-same-origin` 是 localStorage 偏好（`photocraft.preferences`）
与同文档注入的前提。**不需要 COOP/COEP**——上游不使用 SharedArrayBuffer（Observed：上游
`packaging/web/README.md`「No special isolation headers」）。

**D5** 大文档有明确上限，且上限要**测**不要猜：`writeFile` 传 base64 字符串（+33%），宿主侧对单次
IPC 载荷没有文档化的限制（Observed：`plugin-host-apis.ts` 直通 IPC，未见 size gate）。超过实测上限
时降级为 A（浏览器下载 + 提示用户自己放到项目里），并在标签页里明说降级了，不静默丢字节。

**D6 桥只在标签页里工作，外部浏览器里它自己退位**。同一个 `host-bridge.js` 在两处都被加载，进入时先
判断落在哪种形态：`window.parent !== window` → 标签页，装接缝；否则 → 独立页，**不装任何接缝**，
打开走浏览器自己的文件选择器、保存走浏览器下载——就是上游 web 版的原样行为。这条判断写在脚本第一行，
不在宿主侧做开关，因为同一个 URL 会被两种容器加载。

## 4. 失败语义

| 情形 | 用户看到 | 不做什么 |
| --- | --- | --- |
| Payload 未就绪 | 标签页显示「正在准备编辑器（约 20 MB）」+ 进度 | 不静默白屏 |
| WebGPU/WebGL2/CPU 全不可用 | 「这台机器的 Chromium 无法启动 Photocraft」+ 一个「用系统浏览器打开」链接 | 不假装加载成功 |
| 用户取消选择 | 应用侧表现为没选文件（rfd 的 `cancel` 事件） | 不写空文件 |
| `writeFile` 越权（不在项目根） | 「保存位置不在项目内，改用『另存为』」 | 不重试到用户家目录 |
| 保存载荷超上限 | 「这个文档太大，已改为浏览器下载」 | 不截断字节 |
| 桥脚本没跑起来（上游改了实现） | 打开走系统选择器、保存走浏览器下载——**功能降级但不失效** | 不静默改字节 |

最后一行是这个方案的安全阀：注入依赖上游的两个实现细节，我们只用「拦截前先判形状、不匹配就放行」的
写法，上游一变就**退回 A**，而不是产生损坏的文件。这条要在 `host-bridge.js` 顶部写死。

## 5. 证据与未验证

Observed：`web.rs` 的 `pick_open`/`pick_save`/`write`/`download` 实现与 `rfd` 的调用方式；
rfd 0.16 wasm 后端的覆盖层 + `input[type=file]` + `change` resolve 机制；宿主 `PluginFsApi`
（`readBinaryFile`、`writeFile(...,"base64")`、`saveAs`）与 `fs.read`/`fs.write` 权限；`astravia-file://`
的 `corsEnabled` 与 `Access-Control-Allow-Origin: *`；上游 HOSTING 的无 COOP/COEP 与 iframe 示例。

未验证（按顺序测）：
1. 在 iframe 内给 `input.files` 赋值并派发 `change` 能否让 rfd 的 promise 正常 resolve（`probe-embed.mjs`
   的 `rfd` 用例；探针页面自带一个最小复现）。
2. 覆盖 `HTMLAnchorElement.prototype.click` 能否拦住 `download()`（同一探针的 `anchor` 用例）。
3. `fs.writeFile` 的 base64 单次上限：1 / 8 / 32 / 64 MB 各写一次，记录失败点。
4. `rfd` 0.17 是否仍走 0.16 的实现路径（本机只有 0.16 源码）。
