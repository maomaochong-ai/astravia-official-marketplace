---
name: effectcraft
alias: EffectCraft 动态图形
description: Animate compositions in EffectCraft inside Astravia: layers, keyframes, 3D camera and lights, effects and the render queue. Use when the task is motion graphics, an animated title, a visual effect, or rendering a frame range.
---

# EffectCraft

EffectCraft 是开源动态图形工具，思路接近 After Effects。插件里的标签页跑的是上游自己的 Web 构建，
没有改过渲染代码；插件补的是门口那一段：工作区里的合成进得去，渲染产物原路回到同一个路径。

合成设计、关键帧节奏、缓动曲线这些判断仍然由你和用户共同决定。你能做的是把它打开、把文件递进去、
在画布上按下去、再把结果拍下来看。

## 工具清单

八个工具，名字都带 `effectcraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `effectcraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `effectcraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `effectcraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `effectcraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `effectcraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `effectcraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `effectcraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `effectcraft_press_key` | 参数 `key`，如 `Enter`、`Escape`、`ctrl+s` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中。
先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `effectcraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. `effectcraft_editor_status`，记下 `canvas` 尺寸，后面换算坐标要用。
3. 用户说的工程在工作区里：`effectcraft_open_workspace_file` 把字节递进去，
   然后**告诉用户去按打开**——这个工具只是暂存，没有替用户打开任何东西。
4. 要在界面上做事（选图层、拖关键帧、改数值、确认对话框）：先 `capture_canvas` 看一眼现在的画面，
   想出像素位置，换算成分数，`click` 或 `type` / `press_key`，然后**再 `capture_canvas` 一次**确认结果。
5. 渲染和保存交给编辑器本身：要么用户在界面里点，要么你用同一套点击把菜单走完，
   无论哪种，最终以截图或 `editor_status` 为证。渲染队列是异步的——它跑起来之后不要一直轮询截图，
   等到用户说好了，或者隔一段时间看一次。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。时间线会滚动、缩放会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文图层名或文案时，让用户粘贴，或者写进文件再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **渲染与保存属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是工程文件；
  不要声称自己渲染完成了，除非截图或界面状态能看到成品。
- 浏览器入口（`effectcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/` 里是上游 `storytold/effectcraft` 自带的文档，随插件一起发布。按任务去读，不要凭记忆描述上游功能：

| 目录 | 什么时候读 |
| --- | --- |
| `references/getting-started/` | 用户第一次装、问支持什么系统 |
| `references/guides/` | 建合成、做关键帧、加特效、渲染 |
| `references/faq/` | 是否免费、能开什么格式 |
| `references/troubleshooting/` | 启动即退、渲染失败 |

这些文档是英文的，且偏工程口径；描述上游实现和路线的部分不是这个插件的用法。
用户问「这个功能在上游叫什么、怎么用」时读它，问「在 Astravia 里怎么操作」时看上面那几节就够了。
