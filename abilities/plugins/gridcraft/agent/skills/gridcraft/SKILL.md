---
name: gridcraft
alias: GridCraft 电子表格
description: Work through spreadsheets inside Astravia — the upstream GridCraft editor, with formulas, number formats, charts, pivot tables and .xlsx round-tripping.
---

# GridCraft

GridCraft 是开源的电子表格工具。插件里的标签页跑的是上游自己的 Web 构建，没有改过一行渲染代码；
插件补的是门口那一段：工作区里的文件进得去，导出的字节原路回到同一个路径。

所以**这个能力的上限就是 GridCraft 本身**。你能做的是把它打开、把文件递进去、在画布上按下去、
再把结果拍下来看；电子表格的判断和取舍仍然由你和用户共同决定。

## 这个应用能做什么

| 方面 | 内容 |
| --- | --- |
| 单元格与格式 | 录入、区域选择、数字格式、边框与配色 |
| 公式 | 相对/绝对引用、常用函数、错误值传播 |
| 汇总 | 图表与透视表 |
| 文件 | `.xlsx` 打开与导出，经 Astravia 桥回工作区 |
| 对话侧 | 截图核对当前区域，状态查询确认是否就绪 |

## 工具清单

八个工具，名字都带 `gridcraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `gridcraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `gridcraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `gridcraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `gridcraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `gridcraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `gridcraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `gridcraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `gridcraft_press_key` | 参数 `key`，如 `Enter`、`Escape`、`ctrl+s` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中，
不管用户的窗口是 900 px 还是 2400 px。先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `capture_canvas` 找到目标单元格的像素位置，换算成分数坐标点进去，`type` 输入内容，`press_key` 回车，再截图确认值落在正确的格子里。
2. 点第一个格子后按住 Shift 用方向键扩选，比连续点两个角更不容易错位。
3. 写完公式用截图确认算出来的是数值而不是错误值；`#REF!`/`#VALUE!` 直接告诉用户，不要绕过。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。界面状态、缩放、滚动都会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 这个应用独有的注意点

- 输入内容以 `=` 开头就是公式，想写字面文本得先让单元格进入文本状态。
- 滚动会让所有旧坐标失效：每次滚动后重新截图再点。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **保存属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是工程文件；
  不要声称自己保存了文档，除非截图里能看到保存后的状态。
- 浏览器入口（`gridcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/upstream.md` 里是上游 `storytold/gridcraft` 的文档入口和它们各自讲什么。按任务去读，
不要凭记忆描述上游功能；这些文档是英文的、偏工程口径，问「在 Astravia 里怎么操作」时看上面几节就够了。
