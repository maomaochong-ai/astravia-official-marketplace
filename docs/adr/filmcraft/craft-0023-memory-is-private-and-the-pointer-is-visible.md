# 0023 — 记忆属于自己，指针要看得见

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** craft 系列 0.0.21 → 0.0.22
- **Related:** [0022](craft-0022-a-document-outlives-its-tab.md) — 被这条决定改写的那份记忆、
  [0019](craft-0019-the-agent-looks-at-the-picture.md) — 截图通道

## The situation

四件事，一起暴露了同一个问题：**插件的状态写在了不属于它的地方。**

1. **串产物。** 同一会话里先用 wordcraft 写一份文档，再切到别的 craft 用右键把面板交给 AI，
   输入框里却带着上一个插件刚刚打开的文档路径。用户读到的是一份错的文件名。
2. **第二个标签页读不到。** 宿主的 `fs` 是项目级的，十五支插件共用同一个 `.craft/`；截图
   文件名只按时间戳，两支插件在同一分钟各拍一张，后拍的把先拍的盖掉。
3. **看不见手。** 自动化在跑的时候只有一行 HUD 文字说明「正在点 (0.42, 0.61)」，画面上什么
   都没动。用户能读到坐标，但读不出模型到底点在哪儿。
4. **卡在「渲染失败」。** wasm 编译期 OOM 报的是
   `WebAssembly.instantiate(): Out of memory`，而 `isBootFailure` 只认
   `failed to start` 与 `boot-timeout`，于是这次失败既不触发降级阶梯（auto → webgl → cpu），
   也不留下一句可读的原因——面板停在一张空画面上。

## The decision

- **记忆走 `ctx.storage`。** `last-document.json` 从项目目录搬到插件私有存储
  （`storage.read` / `storage.write`），并额外记下 `cwd`：只有在**同一个项目**里才恢复。
  跨插件串产物的根因不是提示附件（module federation 下各插件的 `src/` 是独立 module
  graph），而是共享的那份 JSON。
- **截图按插件分目录。** `SHOT_DIR = .craft/<APP.id>/shots`，一支插件一块地；文件名的
  时间戳继续保留，它现在只负责同一支插件内的排序。
- **指针画在页面自己的坐标系里。** `host-bridge.js` 里新增 `mark(point)`：一个
  `position: fixed` 的 30 px 圆环加 6 px 圆心，`clickAt` 与 `dragPath` 的起点/终点各调用
  一次。它用的是 `pointAt()` 算出的 viewport 坐标，与真正派发的 `pointerdown` 同空间，
  所以不会随画布平移漂移。HUD 继续负责叙事文字，圆环负责地点。
- **把整页交给 AI 时带上图。** `askAgent()` 在原来那几行状态之后追加一行
  `Screenshot — <path>`（`strings.activityCapture`，中英各一份）。路径是 agent 能直接打开的
  东西，比任何形容词都更有用；它仍然走 `insertText`，用户按回车才发出去。

## What this does not do

- **它不修字形。** 字体仍在 wasm 里烘焙，见 [0022](craft-0022-a-document-outlives-its-tab.md)。
- **它不让跨插件的 `cwd` 判断变成权限。** `cwd` 只是「同一项目」的判据；两个插件在同一个
  项目里各自记得自己的文档，本来就不会互相覆盖——分的是存储位置，不是项目。
- **它不缓存 iframe。** 宿主把冷标签页卸载掉，DOM 就没了，wasm 得重新编译。这一轮缓存的是
  **文档字符串**（`site-document.ts`，按 `mode:uiLang` 记忆，`reload()` 清空），省掉的是
  读包 + 拼 `<base>`/seed/bridge 的那一遍，省不掉引擎自己的启动。
- **它不保证圆环在真实面板里一定可见。** 未在运行中的宿主里验证；`mark()` 整体
  `try/catch`，画不出来也不算这一步失败。

## The cost

- 冷启动的第一次仍然要等 wasm；第二次打开省下的只是文档构建。
- `mark()` 会给每次点击加一个 DOM 节点和一个 900 ms 的淡出计时器；同一次 `dragPath` 里三个
  节点共用 `RING_ID`，所以永远只有一个圆环。
- `askAgent()` 多一行文本，输入框里的草稿比之前长一行。
