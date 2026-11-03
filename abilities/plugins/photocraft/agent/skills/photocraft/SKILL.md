---
name: photocraft
alias: Photocraft 图片编辑
description: Work on raster images in Photocraft inside Astravia: layers, masks, selections, type, adjustment layers and PSD files. Use when the task is editing a photo or a layered image, opening or saving a .psd, or handing an image from the workspace to the editor and back.
---

# Photocraft

Photocraft 是光栅图片编辑器。插件里的标签页跑的是上游自己的 Web 构建，没有改过一行渲染代码；
插件补的是门口那一段：工作区里的文件进得去，存下来的字节原路回到同一个路径。

所以**这个能力的上限就是 Photocraft 本身**。你能做的是把它打开、把文件递进去、
在画布上按下去、再把结果拍下来看；修图判断、蒙版怎么用、色彩怎么调仍然由你和用户共同决定。

## 工具清单

八个工具，名字都带 `photocraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `photocraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `photocraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `photocraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `photocraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `photocraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `photocraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `photocraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `photocraft_press_key` | 参数 `key`，如 `Enter`、`Escape`、`ctrl+s` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中，
不管用户的窗口是 900 px 还是 2400 px。先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `photocraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. `photocraft_editor_status`，记下 `canvas` 尺寸，后面换算坐标要用。
3. 用户说的图片在工作区里：`photocraft_open_workspace_file` 把字节递进去，
   然后**告诉用户去按打开**——这个工具只是暂存，没有替用户打开任何东西。
4. 要在界面上做事（切图层、拉蒙版、改数值、确认对话框）：先 `capture_canvas` 看一眼现在的画面，
   想出像素位置，换算成分数，`click` 或 `type` / `press_key`，然后**再 `capture_canvas` 一次**确认结果。
5. 保存、导出这些动作交给编辑器本身：要么用户在界面里点，要么你用同一套点击把菜单走完，
   无论哪种，最终以截图或 `editor_status` 为证。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。界面状态、缩放、滚动都会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **保存属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是工程文件（`.pcraft` / `.psd`）；
  不要声称自己保存了文档，除非截图里能看到保存后的状态。
- 浏览器入口（`photocraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/` 里是上游 `storytold/photocraft` 自带的文档，随插件一起发布。按任务去读，不要凭记忆描述上游功能：

| 目录 | 什么时候读 |
| --- | --- |
| `references/getting-started/` | 用户第一次装、问怎么构建 |
| `references/formats/` | 要处理 PSD/PSB、`.pcraft`、SVG 或别的光栅格式 |
| `references/automation/` | 用户问脚本化、命令行、控制协议或 MCP |
| `references/architecture/` | 想弄清渲染、命令引擎、crate 分层 |
| `references/security/` | 问威胁模型、解析器加固、漏洞上报 |
| `references/development/` | 想自己改上游、跑测试 |

这些文档是英文的，且偏工程口径；`architecture/` 一类描述的是上游自己的实现和路线，不是这个插件的用法。
用户问「这个功能在上游叫什么、怎么用」时读它，问「在 Astravia 里怎么操作」时看上面那几节就够了。
