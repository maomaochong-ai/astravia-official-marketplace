---
name: filmcraft
alias: FilmCraft 视频剪辑
description: Edit video in FilmCraft inside Astravia: a non-linear timeline, clips, colour, and sound. Use when the task is cutting, trimming or assembling video, or when a project has to be opened from the workspace and rendered back.
---

# FilmCraft

FilmCraft 是开源非线性视频剪辑工具。插件里的标签页跑的是上游自己的 Web 构建，
没有改过解码和合成；插件补的是门口那一段：工作区里的素材和工程进得去，导出的成片原路回到同一个路径。

剪辑节奏、镜头取舍、音频混音这些判断由你和用户共同决定。你能做的是把它打开、把文件递进去、
在画布上按下去、再把结果拍下来看。

## 工具清单

八个工具，名字都带 `filmcraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `filmcraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `filmcraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `filmcraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `filmcraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `filmcraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `filmcraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `filmcraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `filmcraft_press_key` | 参数 `key`，如 `Space`（播放/暂停）、`i`、`o`、`ctrl+z` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中。
先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `filmcraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. `filmcraft_editor_status`，记下 `canvas` 尺寸，后面换算坐标要用。
3. 素材或工程在工作区里：`filmcraft_open_workspace_file` 把字节递进去，
   然后**告诉用户去按打开**——这个工具只是暂存，没有替用户打开任何东西。
4. 要在界面上做事（导入素材、拖片段入轨、切点、加调色）：先 `capture_canvas` 看一眼现在的画面，
   想出像素位置，换算成分数，`click` 或 `type` / `press_key`，然后**再 `capture_canvas` 一次**确认结果。
5. 导出交给编辑器本身，而且它慢：导出一个片子可能要几分钟到十几分钟。
   启动导出之后告诉用户「在跑」，不要连着截十几张图去等；等用户说完了，或者隔一两分钟看一次。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。时间线会滚动、走带位置会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文标题、字幕时，写进 `.srt` / 工程文件再用 `open_workspace_file` 递进去，或者让用户粘贴。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **导出属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是视频；
  不要声称自己导出了成片，除非截图或界面状态能看到导出完成。
- 解码和播放依赖浏览器能力，长片可能掉帧——截图里看到的那一帧，不等于时间线上的那一帧。
  需要在某一帧上停住判断时，用键盘定位（`Space` 暂停、方向键逐帧）再截图。
- 浏览器入口（`filmcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰工程文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/` 里是上游 `storytold/filmcraft` 自带的文档，随插件一起发布。先看清楚它属于哪一类，再决定读不读：

| 文件 | 性质 |
| --- | --- |
| `keyboard.md` | 快捷键表——驱动界面时最常用的一篇 |
| `project-files.md` | 工程文件格式，判断能不能直接改文件而不是点界面 |
| `captions.md`、`transcripts.md` | 字幕与转写的工作方式 |
| `architecture.md`、`web.md`、`control-protocol.md` | 上游实现说明，回答「它是怎么做到的」 |
| `*-parity.md`、`gaps.md`、`roadmap.md`、`releasing.md` | 上游自己的开发笔记，与在 Astravia 里怎么操作无关 |

这些文档是英文的，且偏工程口径。用户问「上游某个功能怎么设计」时读它，
问「在 Astravia 里怎么操作」时看上面那几节就够了。
