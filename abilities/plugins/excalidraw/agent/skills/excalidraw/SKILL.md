---
name: excalidraw
alias: Excalidraw 白板
description: Draw and edit diagrams in the Excalidraw whiteboard inside Astravia — flowcharts, boxes and arrows, sticky notes, text, frames — by writing scene elements through the editor's own API rather than by dragging pixels, then read the result back and export PNG, SVG or .excalidraw. Use when the task is a diagram, flowchart, architecture sketch, mind map, wireframe or whiteboard, or when an existing .excalidraw file has to be opened, changed and saved.
---

# Excalidraw 白板
页面是上游 Excalidraw 自己的 Web 构建（`excalidraw-app`），插件没有改过一行绘图代码。插件只补两件事：把工作区
里的文件递进去、把导出的字节送回来；以及**把编辑器自己的命令式 API 接到对话上**。

所以：**画图走 `excalidraw_scene`，不要用鼠标去拖方框。** 拖拽的几何误差会随步数累积，而编辑器本来就能直接
接收元素。只有当操作对象不在场景里（菜单、面板、工具栏、导出对话框）时才用 `excalidraw_act`。

## 六个工具

全部打到正在打开的那个标签页上，**标签页必须开着**（`excalidraw_open_editor` 负责这件事）。

| 要做的事 | 工具 | 返回 |
| --- | --- | --- |
| 打开白板 / 载入工作区文件 | `excalidraw_open_editor` | `{open, url, ready, canvas, secure, staged, probe}` |
| 只看状态，不动任何东西 | `excalidraw_editor_status` | 同上，或 `{open:false}` |
| **读 / 写 / 导出场景** | `excalidraw_scene` | `{ok, scene}` 或 `{ok, applied, scene}` 或 `{ok, path, name, mime}` |
| 一串指针与键盘动作 | `excalidraw_act` | `{ok, steps[], elapsedMs, change, probe}` |
| 读画布：文字地图 + 平均色 | `excalidraw_probe` | `{cells, cols, rows, mean, meanRgb, contrast}` |
| 用文件选择器真正打开文件 | `excalidraw_open_document` | `{opened, probe, change}` |

## 写场景：元素骨架格式

细节在 `references/` 里：`references/scene-format.md`（元素骨架与 `.excalidraw` 事实）、
`references/tools.md`（六个工具的参数与返回）、`references/shortcuts.md`（快捷键表）。

`excalidraw_scene` 的 `operation: "apply"` 收的是上游文档里的 **`ExcalidrawElementSkeleton`**，插件原样交给
`convertToExcalidrawElements`（`packages/element/src/transform.ts:680`）。这份格式的规矩都以
`dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx` 为准：

- **矩形 / 椭圆 / 菱形**：`type` + `x` + `y` 就够；`width`/`height` 缺省按默认尺寸。
- **文字**：`type: "text"` + `x` + `y` + `text`。**不要自己量宽高**——`transform.ts:753-773` 用 `measureText`
  算出来；手填的 `width`/`height` 反而会被覆盖。
- **带文字的容器**：给 `label: { text }`。容器没给尺寸时按 label 的尺寸反推（`transform.ts:707-714`），所以
  「一个装着『开始』的方框」就是 `{"type":"rectangle","x":0,"y":0,"label":{"text":"开始"}}`。可选
  `label.textAlign`（`left`/`center`/`right`）、`label.verticalAlign`（`top`/`middle`）、`label.fontSize`。
- **箭头 / 线**：`type` + `x` + `y`，`width`/`height` 决定终点方向；`points` 会被自动补成
  `[(0,0),(w,h)]`（`transform.ts:735-751`）。箭头默认 `endArrowhead: "arrow"`。
- **箭头绑定**：`start: {"id":"box-1"}` / `end: {"id":"box-2"}`，也可以只给 `start.type` 让上游自己找。
  被引用的元素必须有 `id`，而且**必须在同一批里同时给出**（`mode: "insert"` 时不会重生成 id，所以也能指向
  画布上已有的元素）。
  箭头的起点要真落在形状上——上游会把绑定点投影到边缘，起点离太远那端绑定就丢了（实测：起点放在形状外时
  `startBinding` 为 `null`，`endBinding` 正常）。
- **frame**：`{"type":"frame","children":["1","2"],"name":"第 1 步"}`，`children` 是元素 id。
- **sticky note**：`{"type":"stickynote","x":0,"y":0,"label":{"text":"..."}}`，默认 250×250、永远有底色。
- 其余可渲染属性（`backgroundColor`、`strokeColor`、`strokeStyle`、`fillStyle`、`strokeWidth`、`opacity`、
  `roughness`、`fontSize`、`roundness`）都可以直接写。
- **id 默认会被重生成**（`transform.ts:699`），批内互相引用仍然成立；想让 id 保持你给的值，就得 `mode: "insert"`。
- `skeleton: false` 表示 `elements` 是完整元素（例如上一次 `read` 的结果）：那条路走 `restoreElements`，
  **文字必须自带 `width`/`height`**，否则会得到 0 尺寸。

`operation: "read"` 回来的每个元素都去掉了 `seed`/`version`/`versionNonce`/`updated`/`index`，坐标保留一位
小数，单次最多 300 个（`truncated: true` 说明还有）。这份输出可以原样喂回 `apply`（配 `skeleton: false`）。

`operation: "export"` 用 `exportScene` 渲染：`format` 取 `png`（默认）/`svg`/`excalidraw`，`scale` 管清晰度，
`background: false` 出透明底，`file_name` 定文件名。字节回到插件后走「另存为」对话框，返回落盘路径。
导出**不会**占用文档自己的保存路径——这张 PNG 不是那张图。

## 用动作驱动界面（`excalidraw_act`）

`steps` 是数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` / `ready` / `capture` / `label`。
`x`、`y` 是 `0..1` 的**分数坐标**，`0.5, 0.5` 永远是画布正中，与窗口像素无关。`drag` 要 `from`/`to`。

`act` 自己会先探一次画布、做完再探一次：`change` 里有 `meanBefore`/`meanAfter`/`rgbDelta`/`distance`/`changed`。
`change.distance` 超过 6 才算画面真的变了（0–441 的 RGB 距离）；`false` 就说明点空了或工具没切过去。

工具快捷键（`packages/excalidraw/components/Tools.tsx:69-160`）：`v` 选择、`r` 矩形、`d` 菱形、`o` 椭圆、
`a` 箭头、`l` 线、`p`/`x` 画笔、`t` 文字、`n` 便签、`e` 橡皮、`f` frame、`h` 手形、`k` 激光笔、`b` 油漆桶、
`Shift+X` 智能形状；数字 `1`–`9`、`0` 是对应的另一套键。

常用动作键（`packages/excalidraw/actions/shortcuts.ts:60-115`）：`Ctrl/Cmd+Z` 撤销、`Ctrl/Cmd+Shift+Z` 重做、
`Ctrl/Cmd+A` 全选、`Delete` 删除、`Ctrl/Cmd+D` 复制、`Ctrl/Cmd+G` / `Shift+Ctrl/Cmd+G` 分组/解组、
`Ctrl/Cmd+0` 复位缩放、`Shift+1` 缩放至全部、`Shift+2` 缩放至选区、`Alt+Z` 禅模式、`?` 快捷键帮助。
macOS 上 `CtrlOrCmd` 就是 `Cmd`；插件侧统一把 `ctrl` 翻成 `cmd`。

规矩：

- **批量，但别赌。** 一次 3–8 步合适；几十步连发等于把一次错误放大几十倍。不确定就插一步 `probe` 或 `wait`。
- **先切工具，再画。** 按完键先 `wait` 一小会儿，等工具栏状态跟上。
- **文字靠双击进入编辑**（`double: true` 的 `click`），`type` 输入，`Escape` 收尾。
- **不要随手 `scroll`。** 滚轮缩放会改变坐标系；真缩了要重新 `probe` 取基线。

## 怎么"看见"画布

工具结果只能以文本回到模型，图片到不了。`excalidraw_probe` 回的是**文字地图**：默认 32 列 × 18 行，每格一个
字母。`K` 近黑、`W` 很亮、`w` 中亮、`k` 中暗，`R O Y G C B P M` 是红橙黄绿青蓝紫，小写偏暗。配合 `mean`
（平均色十六进制）、`meanRgb` 与 `contrast`，足够回答：画布空不空、动作有没有生效、大体是什么色调。
精读时收窄 `region`、把 `columns`/`rows` 提到 64×36。

它替代不了眼睛：手绘线条的走向、细小控件位置、字距都看不出来。要像素级判断，让用户看屏幕。

## 一次完整任务

用户说「把这套流程画成图，导一张 PNG 存到工作区」：

1. `excalidraw_open_editor`，等 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户。
2. 已有 `.excalidraw` 文件：`excalidraw_open_document` 一步到位（暂存 → 应用自己的打开快捷键 → 等载入 → 探一次）。
   `opened: false` 就如实说没打开。
3. `excalidraw_scene` 读一次，确认起点（空画布还是有内容）。
4. 规划坐标，一次 `excalidraw_scene` 写进去：节点用 `label` 装文字，箭头用 `start`/`end` 绑到节点 id 上。
   容器和箭头放在**同一批**里，绑定才不会断。用户说不清的排布先按栅格摆（节点 180×90，间距 80）。
5. 读回 `applied` 与 `scene`：元素数对不对、位置有没有重叠。不对就再 `apply` 一次 `mode: "replace"` 重排。
6. 要看效果或它长得偏不偏，`excalidraw_probe` 取文字地图；需要改样式再用 `excalidraw_act`。
7. 交付：`excalidraw_scene` 的 `operation: "export"`。要可再编辑的文件就导 `excalidraw`，要图片就 `png`/`svg`。

## 边界

- 语音、协作房间、Excalidraw+ 库同步需要上游自己的服务与账号，**不要承诺**。
- 界面默认中文，状态栏的「中文 / EN」切的是编辑器自己的语言（走 `appLangCodeAtom`，不重载页面、不丢场景）。
- 文件格式就是 `.excalidraw`（JSON）：`{type:"excalidraw", version:2, source, elements, appState, files}`
  （`packages/excalidraw/data/json.ts:52-72`、`packages/common/src/constants.ts:420`）。不要另写转换器。
- 这个能力的上限就是 Excalidraw 本身。画成什么样由你与用户共同决定，插件只负责把动作送进去、把结果读回来。
