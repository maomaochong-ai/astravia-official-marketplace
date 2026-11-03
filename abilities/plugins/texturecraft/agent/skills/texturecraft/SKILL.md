---
name: texturecraft
alias: TextureCraft 贴图
description: Paint 3D textures inside Astravia — the upstream TextureCraft editor, with layered PBR painting, bakes and smart materials.
---

# TextureCraft

TextureCraft 是开源的3D 贴图工具。插件里的标签页跑的是上游自己的 Web 构建，没有改过一行渲染代码；
插件补的是门口那一段：工作区里的文件进得去，导出的字节原路回到同一个路径。

所以**这个能力的上限就是 TextureCraft 本身**。你能做的是把它打开、把文件递进去、在画布上按下去、
再把结果拍下来看；贴图的判断和取舍仍然由你和用户共同决定。

## 这个应用能做什么

| 方面 | 内容 |
| --- | --- |
| 绘制 | 在模型表面分层绘制，笔刷设置与遮罩 |
| 通道 | PBR 各通道独立编辑 |
| 材质 | 智能材质与材质复用 |
| 产出 | 烘焙通道贴图、导出结果回工作区 |
| 对话侧 | 截图核对视图与笔触结果，状态查询确认是否就绪 |

## 工具清单

八个工具，名字都带 `texturecraft_` 前缀。全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 关键参数与返回 |
| --- | --- | --- |
| 打开编辑器，顺带拿到当前状态 | `texturecraft_open_editor` | 返回 `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `texturecraft_editor_status` | 返回同上，或 `{open:false}` |
| 把画布当前画面存成 PNG | `texturecraft_capture_canvas` | 弹保存对话框；用户取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `texturecraft_open_workspace_file` | 返回 `{ok, staged, bytes}`，之后在应用里按打开 |
| 把同一个页面放到浏览器里 | `texturecraft_open_in_browser` | 返回 `{url, where}` |
| 在画布上点一下 | `texturecraft_click` | 参数 `x`、`y` 是 `0..1` 的分数坐标，`double: true` 是双击 |
| 往当前焦点里打字 | `texturecraft_type` | 参数 `text`，仅 ASCII |
| 按一个键或组合键 | `texturecraft_press_key` | 参数 `key`，如 `Enter`、`Escape`、`ctrl+s` |

`x` / `y` 用的是画布宽高的比例，不是像素——`0.5, 0.5` 永远是正中，
不管用户的窗口是 900 px 还是 2400 px。先 `editor_status` 拿 `canvas` 拿到实际尺寸再换算。

## 一次完整的任务长什么样

1. `capture_canvas` 看当前视角，要画的面不在屏幕上就先转到能看见的角度，再决定坐标。
2. 每次只加一层或只改一个通道，画完截图核对；多层叠在一起出问题时无法判断是哪一层。
3. 烘焙后用截图或状态确认贴图真的写出来了，别把「点了烘焙」当成「烘焙成功」。

## 用坐标驱动界面的规矩

- **一次操作，一次回看。** 连点两三次就 `capture_canvas` 一次。界面状态、缩放、滚动都会变，
  上一张截图里的坐标对下一秒不一定还成立。
- **工具说 `ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一证据是下一张截图。
- 打字只有 ASCII：上游直接读按键，没有输入法，中文、带重音的字符都到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `open_workspace_file` 递进去。
- 同一个位置点了两次都没反应，换方法：改用菜单、改用键盘、或者直接问用户看到了什么。
  不要同一个坐标试第三次。

## 这个应用独有的注意点

- 在 3D 视图里点击坐标是屏幕比例，模型转动后同一分数坐标指向另一个面——转视角就重新截图。
- 输入框只吃 ASCII，材质名一类需要中文的文本让用户自己填。

## 硬规则

- 标签页没开时所有手势工具都回 `editor-not-open`，这不是插件坏了，先 `open_editor`。
- **保存属于用户。** `capture_canvas` 存的是当前画面的 PNG 快照，不是工程文件；
  不要声称自己保存了文档，除非截图里能看到保存后的状态。
- 浏览器入口（`texturecraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要碰项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 上游文档

`references/upstream.md` 里是上游 `storytold/texturecraft` 的文档入口和它们各自讲什么。按任务去读，
不要凭记忆描述上游功能；这些文档是英文的、偏工程口径，问「在 Astravia 里怎么操作」时看上面几节就够了。
