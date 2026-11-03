---
name: vectorcraft
alias: VectorCraft 矢量插画
description: Draw vector artwork in VectorCraft inside Astravia: paths, bezier handles, fills, strokes and SVG output. Use when the task is a logo, an icon, a diagram or any illustration that has to stay sharp at every size.
---

# VectorCraft

VectorCraft 是开源矢量插画工具。插件里的标签页跑的是上游自己的 Web 构建，
没有改过渲染与导出；插件补的是门口那一段：工作区里的文件进得去，导出的 SVG 原路回到同一个路径。

图形构成、曲线走向、配色这些判断由你和用户共同决定。你能做的是把它打开、把文件递进去、
在画布上按下去、再把结果拍下来看。

## 工具清单

八个工具，名字都带 `vectorcraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `vectorcraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `vectorcraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `vectorcraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `vectorcraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `vectorcraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `vectorcraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `vectorcraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `vectorcraft_press_key` | 参数 `key`，如 `p`（钢笔）、`v`（选择）、`Escape`、`ctrl+z` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中。
先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `vectorcraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. `vectorcraft_editor_status`，记下 `canvas` 尺寸，后面换算坐标要用。
3. 要改的文件在工作区里：`vectorcraft_open_workspace_file` 把字节递进去，
   然后**告诉用户去按打开**——这个工具只是暂存，没有替用户打开任何东西。
4. 要在界面上做事（选工具、拉贝塞尔手柄、改填充、调描边）：先 `capture_canvas` 看一眼现在的画面，
   想出像素位置，换算成分数，`click` 或 `type` / `press_key`，然后**再 `capture_canvas` 一次**确认结果。
5. 导出交给编辑器本身：要么用户在界面里点，要么你用同一套点击把菜单走完，
   无论哪种，最终以截图或 `editor_status` 为证。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。视图缩放、画布平移都会变，
  上一张截图里的坐标对下一秒不一定还成立——尤其在拖过贝塞尔手柄之后。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 拖拽不保证可用：`click` 投的是按下即抬起。真要拖，拆成「按下—移动—抬起」不在工具能力内，
  改用数值面板输入（`click` 定位到输入框，`type` 填常数），或者让用户来拖。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  中文标注先让用户粘贴，或者写进 SVG 再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **导出属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是 SVG；
  不要声称自己导出了矢量文件，除非截图或界面状态能看到导出完成。
- 画布是矢量，但截图是位图：像素级对齐、0.5px 级的描边差异在截图里看不出来。
  需要精确数值时，让用户在属性面板里读，或者直接改文件。
- 浏览器入口（`vectorcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/` 里是上游 `storytold/vectorcraft` 自带的文档，随插件一起发布。先看清楚它属于哪一类，再决定读不读：

| 文件 | 性质 |
| --- | --- |
| `typography-lettering.md`、`type-parity.md` | 文字与字形处理，做带字图形时读 |
| `image-trace-quality.md`、`image-trace-adjustments.md` | 位图描摹的参数与取舍 |
| `print-tiling.md`、`dimensions.md` | 印刷拼版、尺寸与单位 |
| `architecture.md`、`control-protocol.md`、`shaper.md` | 上游实现说明，回答「它是怎么做到的」 |
| `*-parity.md`、`gaps.md`、`roadmap.md`、`releasing.md`、`development.md` | 上游自己的开发笔记，与在 Astravia 里怎么操作无关 |

这些文档是英文的，且偏工程口径。用户问「上游某个功能怎么设计」时读它，
问「在 Astravia 里怎么操作」时看上面那几节就够了。
