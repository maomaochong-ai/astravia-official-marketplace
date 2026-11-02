# ADR 0009：全屏是 iframe 元素的事，不是面板宽度的事

- 状态：已接受（2026-11-03）
- 关联文档：[0006](./0006-tab-shell-not-a-second-app.md)、[0007](./0007-one-loopback-hub-three-entries.md)、[CONTEXT.md](./CONTEXT.md)

## 1. 背景

编辑图片需要屏幕。标签页默认只占活动面板的宽度，Photocraft 的工具栏、画布与图层面板在那个宽度里会被挤。

宿主有两条看起来都能「变大」的接口：

- `ctx.ui.setActivityPanelWidth(width | "max")` —— 活动面板宽度；
- 元素级 Fullscreen API —— `element.requestFullscreen()`。

宿主自己没有任何标签页级全屏控件（Observed：0.5.86 的全库 `requestFullscreen` 只在一份无关的第三方 chunk 里
出现一次），所以这件事必须由插件决定。

## 2. 候选

### A. 只调 `setActivityPanelWidth("max")`（否决）

面板到底还是面板：`"max"` 只是把它拉到宿主允许的最大宽度，聊天区仍留在旁边，窗口标题栏、标签栏、侧边栏都还在。
更麻烦的是它**是持久状态**，插件没法知道用户原来的宽度是多少，退出时无法还原——「点一下全屏」变成「永久改布局」。

### B. 让 iframe 里的页面自己 `document.documentElement.requestFullscreen()`（否决）

跨源 iframe 里的 `requestFullscreen` 需要父文档给 `allow="fullscreen"`，而且**退出只能由内层文档发起**：用户按 Esc
会被浏览器截获，父文档收不到「我要退出」的意图；我们的状态条也看不见自己处于全屏。控制权被拆到两边。

### C. 父文档对**标签页容器**调 `requestFullscreen()`（选定）

全屏的元素是插件自己的容器 `<div>`（里面是状态条 + iframe）。它属于宿主文档，所以：

- 进入/退出都是我们自己的一个动作，`fullscreenchange` 在父文档上就能听到；
- 全屏时状态条仍在，退出按钮不会消失（Esc 也照常有效）；
- iframe 内容不需要任何配合，跨源无关，也不需要 `allow="fullscreen"`（保留它只为不挡住内层自己的全屏请求）；
- 不动面板宽度，不动宿主的布局状态。

## 3. 决策

**D1 全屏元素是容器，不是 iframe，也不是面板。** `containerRef.requestFullscreen({ navigationUI: "hide" })`；
不用 `setActivityPanelWidth("max")` 代替它，也不把它当作进入全屏的副作用。

**D2 状态来自 `fullscreenchange`，不来自按钮点击。** 用户按 Esc 时按钮必须跟着复位，所以
`isFullscreen = document.fullscreenElement === containerRef.current`，在 `fullscreenchange` 里同步。

**D3 失败要说话。** `requestFullscreen()` 返回 Promise：被拒（`NotAllowedError`）时在状态条给出提示，不静默。
宿主主 session 的权限处理器只对 `media` 做判断、其余 `callback(true)`（Observed），所以拒绝只可能来自
「非用户手势」这类调用错误，而不是权限策略。

**D4 按钮只在页面就绪后可用。** 与另外三个按钮同一条件（`iframeSrc !== null`），避免在全屏里看加载失败的空白。

**D5 不引入第二套快捷键。** 退出走浏览器原生的 Esc，不注册 `ctx.ui.shortcuts`——那会与宿主的键位争夺，
而且全屏本来就有系统级退出语义。

## 4. 后果

- **好处一**：真正的全屏画布，工具栏不再被面板宽度挤压。
- **好处二**：进入/退出是一次可逆操作，不污染宿主的布局状态。
- **代价一**：全屏时看不到聊天区，这与「在对话旁边修图」的心智有摩擦——所以按钮文案写「全屏」，不写「最大化」。
- **代价二**：多一个 `fullscreenchange` 监听与一份失败文案；这是元素级全屏的最小成本。

## 5. 证据与未验证

Observed：

- 宿主没有标签页级全屏：`requestFullscreen` 在全库只有 1 处命中，属无关模块（`renderer/assets/coffee-*.js`）；
- 面板宽度是宿主的持久状态：`setActivityPanelWidthAtom`（`activity-atoms.ts:161`），内置浏览器与文件预览都用
  `"max"` 打开（`browser-atoms.ts:38`、`file-preview-atoms.ts:115`），退出时并不还原；
- 活动标签是同渲染进程里的 React 组件（0007 §5），所以插件能对宿主文档里的元素调 Fullscreen API；
- 主 session 的 `setPermissionRequestHandler` 除 `media` 外一律放行（`main/main-Ces8nWEj.js`）。

未验证：

1. 真实桌面窗口里元素级全屏的实际观感（macOS 全屏会切换 Space，与「面板内放大」不是一回事）；
2. 全屏状态下 iframe 内页面重新 `reload()`（`iframeKey` 变化）是否会让全屏元素被替换——本实现把 key 放在
   iframe 上、全屏元素是外层容器，理论上不受影响，但未在真机验证。
