# 字节只从宿主过一遍：桥不是文件系统

- 状态：已采纳（2026-11-04）
- 相关：[0001](0001-the-tab-runs-upstreams-web-build.md)、[0005](0005-the-agent-drives-the-canvas.md)

## 问题

编辑器在 iframe 里，工作区的文件在宿主里。两边都要读写 `.excalidraw` 文件，但 iframe 拿不到
工作区路径，宿主也不该知道 Excalidraw 的磁盘格式。最省事的两种做法都有毒：

- 把工作区路径塞进 iframe，让它自己 `fetch` / `showSaveFilePicker`：`astravia-plugin://`
  下没有这条通路，且会把"文件权限"这件事从宿主的安全边界里漏出去。
- 让面板代理所有文件操作：那面板就得理解 `.excalidraw` 的 JSON，格式一变就得跟着改，
  而格式是上游的。

## 决定

一条单向职责的桥，**字节只从宿主过一次**：

- 页面里 `host-bridge.js` 说"我要打开"（`craft:pickOpen`）/"我要保存"（`craft:save`），
  它只知道 `mime` 和一段字节，不知道路径从哪来、存到哪去。
- 面板（`use-editor-session.ts`）拿到这些请求，调 `ctx.workspace` / `ctx.fs` 去选文件、
  读字节、写字节，把它们回灌给页面（`craft:open` / `craft:stage` / `craft:fallback`）。
- 页面里只有 `window.__excalidrawBridge` 一个出口；它拿不到任何路径，也不持有句柄。

握手顺序也是确定的：页面加载完发 `craft:ready`（带 `href`、`secure`），面板确认后才允许
`craft:open`；保存时页面先 `craft:save` 把字节递出来，面板写盘成功再回 `craft:reply`。
页面从不假设"写成功了"，标记脏状态靠的是它自己的 store。

## 为什么桥要认 `event.source`

```js
if (event.source !== parentWindow) return;   // parentWindow = window.parent
```

不要放宽成"看 `event.origin`"或"看消息里有没有 `type`"：文档是 `srcDoc`，同源，
`event.origin` 在 `about:srcdoc` 下是 `"null"`——按 origin 判断等于把闸门拆了。

## 保存/打开为什么必须走 anchor 与 hidden input

上游 `fileSave` / `fileOpen` 都调 `browser-fs-access` 的 `legacy: false` 那侧：只要 `self` 上
有 `showOpenFilePicker`，模块加载时算出的 `supported` 就是 `true`，之后 JS 直接
`await window.showSaveFilePicker({…})`。这两条都会绕过桥（帧里根本弹不出原生选择器），
所以站点在**构建期**把 `browser-fs-access` 别名到一个三行桩：
`browser-fs-access-legacy.ts` 导出 `fileOpenLegacy` / `fileSaveLegacy` 与
`supported = false`。于是上游走它给 Firefox 准备的那条路——`<a download>` 与
`<input type="file">`——正好是桥拦截的两个接缝。

打开那条还得拦两处，不是一处：`fileOpenLegacy` 写的是
`"showPicker" in HTMLInputElement.prototype ? input.showPicker() : input.click()`，
Chromium 有 `showPicker`，所以它从来不走 `click()`。桥因此同时覆写
`showPicker` 与 `click`（非 `type=file` 的输入原样放行）。只拦 `click` 时实测
`showPicker` 1 次、`click` 0 次——原生对话框弹出或被沙箱拒绝，应用卡在等文件。

还有一个更隐蔽的点：`accept`。桥在把暂存文件投给输入框前会用 `input.accept` 判一下类型，
“逗号列表、每个 token 都为空”看起来像“什么都不要”，实际上是“什么都接受”。上游
`loadFromJSON` 调的是 `fileOpen({})`（`extensions` 那行被注释掉了），落到输入框上的
`accept` 是 `","`。按“没有匹配项就拒绝”处理时，暂存文件永远不会被投进去，应用会一遍遍
重新要文件。实测就是这一步卡住的：`craft:stage` 成功、`craft:pickOpen` 发了一次、
暂存名仍在。修法是把“零个有效 token”当无过滤。

**运行时删 API 走不通**，实测记录在这里，免得有人再试一遍：把
`window.showSaveFilePicker` 赋成 `undefined` 会让 `supported` 仍然是 `true`（它用的是
`"showOpenFilePicker" in self`，看属性存在而不是值），于是上游还是走 modern 分支，
在 `await window.showSaveFilePicker(…)` 处抛 `TypeError`，保存直接失败；而 `delete`
对原型上的属性又是空操作。构建期换实现是唯一确定的做法。

代价：`nativeFileSystemSupported` 为 `false`，上游的「Save as」菜单项因此不显示；
`Ctrl/Cmd+S` 与菜单里的保存仍然可用，字节从 anchor 出来交给宿主。

打开同样是「按应用自己的快捷键」：`excalidraw_open_document` 先把字节 `craft:stage` 进去，
再发一个 `key` 步骤。那个快捷键不能写死成 `ctrl+o`——上游判的是
`KEYS.CTRL_OR_CMD`，在 macOS 上是 `metaKey`——所以 `editor-tools.ts` 按平台拼主修饰键
（`meta+o` / `ctrl+o`），调用方仍可以用 `shortcut` 参数覆盖。

## 界面语言也走这里

Excalidraw 通过 `i18next-browser-languagedetector` 解析语言，查询参数 `?lng=` 是它的第一优先级。
所以壳在拼文档时直接写 `?lng=zh-CN|en`（`site-document.ts` 的 `documentQuery()`），
`navigator.language` 的改写只作为兜底（`replaceState` 被拒绝时）。不去动
`localStorage` 里的 i18next 键——那是上游内部状态，版本一换就失效。

## 代价

- 大文件（几百 MB 的 `.excalidraw`）要靠结构化克隆过一遍 `postMessage`，这是同步拷贝。
  实际用法里这类文件是几 MB 量级，可以接受；真要更大，得改成 `MessagePort` 分块，那是另一个决定。
- 桥里保留了一小段手势注入（`craft:pointer` / `craft:key` / `craft:act`），它是给 Agent 用的，
  不是给文件用的；两者共用一条通道，但**回复里从不声称应用做了什么**，只说桥派发了什么
  （见 [0005](0005-the-agent-drives-the-canvas.md)）。

## 名字里的 `craft`

消息名（`craft:ready` / `craft:pickOpen` / `craft:save` / `craft:act` …）与面板侧的几个 `CraftFrame` /
`CraftProgress` 类型是这套外壳自带的，不是这个插件发明的。改名要同时动桥、会话、工具层和
已跑过的探针证据，而两端总在同一个包里发布、外部没有人按这些名字对接 —— 所以保留，代价只是读代码
时多一层转译。

## 不做的事

- 不让 iframe 持有文件路径或句柄。
- 不在面板里解析或重写 `.excalidraw` 的内容；面板只搬字节。
- 不把桥放宽成"接受任意窗口的消息"。
