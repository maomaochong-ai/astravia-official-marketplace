---
name: figcraft
alias: FigCraft 界面设计
description: Design interfaces and prototypes inside Astravia — the upstream FigCraft editor, with frames, auto layout, components and variants, variables and click-through prototypes.
---

# FigCraft

FigCraft 是开源的界面设计工具。插件里的标签页跑的是上游自己的 Web 构建，没有改过一行渲染代码；
插件补的是门口那一段：工作区里的文件进得去，导出的字节原路回到同一个路径。

所以**这个能力的上限就是 FigCraft 本身**。你能做的是把它打开、把文件递进去、在画布上按下去、
再把结果拍下来看；界面设计的判断和取舍仍然由你和用户共同决定。

## 这个应用能做什么

| 方面 | 内容 |
| --- | --- |
| 画框与布局 | Frame、自动布局、约束、对齐与分布 |
| 组件体系 | 组件、变体、实例覆盖、样式与变量 |
| 矢量与文字 | 矢量网络、布尔运算、文字样式 |
| 原型 | 页面跳转、可点击区域、原型预览 |
| 文件与对话 | 打开与导出设计文件；截图核对画面、状态查询确认是否就绪 |

## 工具清单

八个工具，名字都带 `figcraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `figcraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `figcraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `figcraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `figcraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `figcraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `figcraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `figcraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `figcraft_press_key` | 参数 `key`，如 `Enter`、`Escape`、`ctrl+s` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中，
不管用户的窗口是 900 px 还是 2400 px。先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `capture_canvas` 看一眼当前页面，`editor_status` 拿 `canvas` 尺寸，按已有页面的间距和层级照做，别另起一套视觉。
2. 要加第二个相同的元素时先想组件：新建组件改一个实例，比复制两次再各自微调可靠。
3. 每次改完选中态或布局都回看一张图——自动布局会把相邻元素推开，肉眼不核对就发现不了。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。界面状态、缩放、滚动都会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 这个应用独有的注意点

- 点击落在图层上而不是图层的内容上：先确认选中框出现，再做修改，否则改的是下一层。
- 中文文本到不了输入框（只有 ASCII 按键），中文文案走文件或粘贴。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **保存属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是工程文件；
  不要声称自己保存了文档，除非截图里能看到保存后的状态。
- 浏览器入口（`figcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/upstream.md` 里是上游 `storytold/figcraft` 的文档入口和它们各自讲什么。按任务去读，
不要凭记忆描述上游功能；这些文档是英文的、偏工程口径，问「在 Astravia 里怎么操作」时看上面几节就够了。
