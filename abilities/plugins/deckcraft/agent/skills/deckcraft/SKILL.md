---
name: deckcraft
alias: DeckCraft 幻灯片
description: Draw in DeckCraft inside Astravia: shapes, text and images on one canvas, with snapping, alignment, undo and PNG or JSON export. Use when the task is a slide, storyboard or stage layout that the user wants laid out or edited, and when the conversation should make the edits instead of the pointer.
---
# DeckCraft 幻灯片

`deckcraft` 自带绘图内核，不加载任何外部应用：打开标签就是一块舞台，关掉就停。
插件补的是门口那一段——**让这块画布能被对话驱动**：你说要做的事，面板里跟着做，
做完能用一份可测量的证据核对。

## 五个工具

名字都带 `deckcraft_` 前缀，全部打到当前打开的标签页，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开编辑器 | `deckcraft_open_editor` | `{open, ready, page, probe}` |
| 只想看状态 | `deckcraft_editor_status` | 同上，或 `{open:false}` |
| 一次做完一串操作 | `deckcraft_act` | `{ok, steps[], elapsedMs, page, change, probe, saved}` |
| 读画布：文字地图 + 平均色 | `deckcraft_probe` | `{cells, columns, rows, mean, meanRgb, contrast}` |
| 把文件打开 | `deckcraft_open_document` | `{ok, path, page}` |

`deckcraft_act` 的 `steps` 是数组，`op` 取 `label` / `ready` / `wait` / `move` / `click` /
`drag` / `type` / `key` / `insert` / `set` / `delete` / `select` / `arrange` / `align` /
`save` / `capture`。

**优先用语义操作，不要用坐标。** `insert`（`kind` 取 `rect`/`ellipse`/`line`/`text`/`image`）、
`set`（改颜色、文字、尺寸）、`align`、`arrange`、`delete` 直接作用在文档模型上，
与用户窗口大小、缩放、滚动都无关。`click` / `drag` 的 `x`、`y` 才是 `0..1` 的分数坐标，
留给"选中或移动已经存在的对象"。

`before` / `after` 是动作前后各探一次画布，`change.distance` 大于 6 说明画面真的变了
（0–441 的 RGB 距离）。

## 怎么"看见"画布

工具结果只能以文本回到你这里，图片到不了。所以 `deckcraft_probe` 回的是一张文字地图：
默认 32 列 × 18 行，每格一个字母。`K` 近黑、`W` 很亮、`w` 中亮、`k` 中暗，
`R Y G C B M` 是红黄绿青蓝紫，小写表示偏暗。配合 `mean`（平均亮度）、
`meanRgb` 与 `contrast`，足够回答三个问题：

- 画面是空的还是已经有内容？
- 我的动作起作用了吗？（前后两次 `cells` 与 `change.distance`）
- 大体长什么样？（色块分布、主要色相、明暗层次）

它不替代眼睛：文字排布、字体字距、细小控件都看不出来。需要更细的判断就收窄 `region`、
把 `columns` / `rows` 调到 64 × 36 再读，或者让用户看屏幕。

## 一次完整的任务长什么样

用户说「开一块版面，画三个标题块，左对齐，导出 PNG」，实际走的是这条路：

1. `deckcraft_open_editor`，等到 `ready: true`。`ready: false` 就把 `error` 原样告诉用户。
2. `deckcraft_probe` 先看一眼现状，确立基线。
3. 一次 `deckcraft_act` 提交：三个 `insert`（`kind: "rect"`）+ 一个 `align`（`mode: "left"`），
   每步带 `label`，画布上会显示「自动操作 3/5 · …」。
4. 读回包里的 `change.changed` 与 `probe`：`false` 就说明没落地，换一条路径，别重试同一个值。
5. 要交付图片时 `deckcraft_probe` 带 `save: true`，它把当前画布存成 PNG 让用户选路径。

## 硬规则

- 标签页没开时所有动作工具都回 `editor-not-open`，这不是插件坏了，先 `deckcraft_open_editor`。
- **自动存档属于插件，导出属于用户。** 文档存在插件私有存储里（`document.json`）；
  只有 `save: true` 或用户按导出，才会写到他选的路径。不要说"我保存了你的文件"，
  除非返回里能看到那个路径。
- **同一个值两次没生效就换方法**：改用 `set` 而不是 `drag`，或者直接问用户看到了什么。
- 不要把 `%key%` 写进任何给画布的文字里：那是宿主 UI 的占位符，进了画布只会原样显示。
- 画布语言默认中文，文案来自内核；用户切到英文界面时才会变英文。
