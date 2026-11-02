# ADR 0003：编辑器内部状态对宿主不可见，能看到的只有输入与保存

- 状态：提议（2026-11-02，取代同一编号的「App → Host 靠观察」草案）
- 关联文档：[0002](./0002-bytes-move-through-the-host.md)、[0006](./0006-tab-shell-not-a-second-app.md)

## 1. 背景

前稿的 App → Host 方向靠 1 Hz `document.inspect` 轮询 + `revision` 差分，因为原生进程有控制通道。
这一版**没有控制通道**：编辑器是一个 wasm 实例，界面整块画在 `<canvas id="photocraft_canvas">` 上，
宿主既没有它的 IPC，也没有它的对象。`postMessage` 是我们自己加的，能传什么完全取决于我们在桥里写什么。

于是问题变成：**在不改上游 Rust 的前提下，宿主到底能看见什么？**

## 2. 能看见的（Observed 的接缝）

| 可观察 | 接缝 | 可靠性 |
| --- | --- | --- |
| 用户是否动过手 | iframe 文档上的 `pointerdown`/`keydown`（同文档，能监听） | 高；但「动过手」≠「改过像素」 |
| 是否有保存动作 | 拦截 `<a download>` 的 `click`（见 0002） | 高；保存成功与否由宿主写盘结果决定 |
| 启动是否成功 | `eframe::WebRunner::start` 失败时上游把 `#photocraft_loading` 换成错误文案 | 中；文案依赖上游措辞 |
| 画布尺寸 | `<canvas>` 的 `width`/`height` 属性 | 高 |
| 崩溃 | `pc:error`（`window.onerror` / `unhandledrejection`） | 中；wasm trap 不一定冒泡到 DOM |

## 3. 看不见的

`dirty`（是否有未保存修改）、`revision`、图层树与选中图层、当前工具、撤销栈深度、文档数、
外部文件是否被改过、导出进度。这些都在 `PhotocraftApp` 的内存里，DOM 与 DOM 事件都不泄露它们。

**这条不是「暂时没做」，是这个形态的边界。** 前稿的 `Snapshot` 概念在 0001 的 D 方案里没有来源，
因此从词表里删掉了（见 [CONTEXT.md](./CONTEXT.md)）。

## 4. 决策

**D1 不伪造状态。** 标签页不显示「已保存 / 未保存」这类断言。它显示的是**事实**：
绑定的文件名、最近一次保存的时间戳、以及「此后有输入」——三者都是我们真的观察到的。

**D2 关闭与重载一律确认，不靠猜测。** 用户关闭标签页、或点「重新载入」时，只要
`inputSinceSave === true`，就弹一次确认：「离开后编辑器里未保存的修改会丢失」。没有输入过则静默通过。
确认文案说「会丢失」，不说「你有 N 处未保存的修改」——后者我们不知道。

**D3 外部改动只做提醒，不做合并。** 宿主可以对绑定的路径 `watchDirectory`；若 mtime 晚于 `savedAt`，
在标签页顶部提示「这个文件在磁盘上被改过。重新载入会丢弃编辑器里的内容」。不自动重载、不试图三方合并。

**D4 不做自动保存。** 自动保存需要知道 dirty，我们不知道；以「每次保存都是一次覆盖写」为前提，
无 dirty 判定的自动保存会周期性地把用户没打算保存的中间状态写进工作区文件。宁可让用户按保存。

**D5 不向上游提「加 dirty 事件」作为近期工作。** 它属于 0002 的 B 方案（改 Rust），已被否决为默认；
若将来上游自己提供 `postMessage` 事件，这条决策连同 0002 的注入层一起撤掉即可——这也说明本决策是
**可逆**的，只是反转成本是一次上游发版。

## 5. 一条可能翻盘的路（未验证，先记下来）

`apps/photocraft-web/Cargo.toml` 给 eframe 开了 `accesskit` feature。accesskit 在 web 上会往 DOM 里
挂一棵隐藏的可访问性树，如果它真的存在，`document.querySelector` 就可能读到菜单项、状态栏文字乃至
「未保存」标记——那 0003 的结论就要从「不可见」改成「经 a11y 树部分可见」。

未验证到什么程度：**完全没有实测**。`probe-embed.mjs` 里有一条 `a11y` 用例专门数
`[data-accesskit-id]` 节点数与可见文本，跑一次就知道。若成立，另开 ADR 记「用 a11y 树读状态」；
若不成立，本节作为死路留档，省得下一个人再翻一遍 Cargo.toml。

## 6. 证据与未验证

Observed：`apps/photocraft-web/Cargo.toml` 的 eframe features（含 `accesskit`）；`web.rs` 的
`#photocraft_loading` 错误替换；`<canvas id="photocraft_canvas">`；`web.rs` 里没有任何把文档状态
暴露给 DOM 的代码：`grep -nE "set_attribute|dataset|dispatch_event|CustomEvent|title" apps/photocraft-web/src/{web,main}.rs apps/photocraft-web/index.html`
只命中 `index.html:6:<title>PhotoCraft</title>`（静态，不随文档变），`.rs` 侧零命中。

未验证：accesskit 树在 web 上是否真的可见、内容是否可读；wasm trap 是否会触发 `window.onerror`。
