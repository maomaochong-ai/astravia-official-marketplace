---
name: excalidraw
alias: Excalidraw 白板绘图
description: Sketch flowcharts, diagrams and whiteboards in Excalidraw inside Astravia: boxes, arrows, text, libraries and export to PNG, SVG or .excalidraw. Use when the task is a diagram, flowchart, architecture sketch, mind map or quick wireframe, or when an .excalidraw file has to be opened, edited and saved.
---
# Excalidraw 白板绘图

`excalidraw` 跑的是上游自己的 Web 构建，插件没有改过一行绘图代码。插件补的是门口那一段：工作区里的文件递得进去，
导出的字节原路回到同一个路径，以及**让这块白板能被对话驱动**——你说要做的事，画布里跟着做，
做完能用一份可测量的证据核对。

所以**这个能力的上限就是 Excalidraw 本身**。插件只负责把动作送进去、把画面读回来；画成什么样，仍然由你和用户共同决定。

## 五个工具

名字都带 `excalidraw_` 前缀，全部打到正在运行的那个页面上，所以**标签页必须先开着**。工具少是有意的：一次批量胜过十次往返。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开白板 / 载入工作区里的文件 | `excalidraw_open_editor` | `{open, url, ready, canvas, secure, staged, probe}` |
| 只想看状态，不打开任何东西 | `excalidraw_editor_status` | 同上，或 `{open:false}` |
| 一次做完一串指针与键盘动作 | `excalidraw_act` | `{ok, steps[], elapsedMs, change, probe}` |
| 读画布：文字地图 + 平均色 | `excalidraw_probe` | `{cells, cols, rows, mean, meanRgb, contrast}` |
| 把文件真正打开（暂存 + 应用自己的打开快捷键 + 等载入） | `excalidraw_open_document` | `{opened, probe, change}` |

`excalidraw_act` 的 `steps` 是一个数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` /
`ready` / `capture` / `label`。`x`、`y` 是 `0..1` 的**分数坐标**，不是像素——`0.5, 0.5` 永远是画布正中，
用户窗口是 900 px 还是 2400 px 都一样。`act` 自己会先探一次画布，做完再探一次，所以 `change` 里同时有
`meanBefore` / `meanAfter` / `rgbDelta` / `distance` / `changed`；`probe` 是做完之后的那一张文字地图。
`change.distance` 大于 6 就说明画面真的变了（0–441 的 RGB 距离）。

## 怎么"看见"画布

工具结果只能以文本回到你这里，图片到不了。所以 `excalidraw_probe` 回的是**一张文字地图**：默认 32 列 × 18 行，
每格一个字母。`K` 近黑、`W` 很亮、`w` 中亮、`k` 中暗、`R O Y G C B P M` 分别是红橙黄绿青蓝紫，
小写表示偏暗。配合 `mean`（平均色的十六进制）、`meanRgb` 与 `contrast`（对比度），足够回答三个问题：

- 画布是空白还是已经有内容？（整片 `W` + `contrast` ≈ 0 说明还空着）
- 我的动作起作用了吗？（前后两次 `cells` 差异 / `change.distance`）
- 大体长什么样？（色块分布、主要色相、明暗层次）

它不替代眼睛：手绘线条的走向、细小控件的位置、字体与字距都看不出来。要精确到像素的判断，让用户看屏幕，
或者 `excalidraw_probe` 时把 `region` 收窄到那一块、把 `columns` / `rows` 调大到 64 × 36 再读。

## 一次完整的任务长什么样

用户说「照着这个流程画一张图，存到工作区」，实际走的是这条路：

1. `excalidraw_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. 已有 `.excalidraw` 文件在工作区：`excalidraw_open_document` 一步到位（暂存 → 应用自己的打开快捷键 → 等载入 → 探一次画布）。
   返回 `opened: false` 说明编辑器不认这个文件或载入超时，**如实说**，不要假装打开了。
3. `excalidraw_probe` 先看一眼现在的画面，确立基线。
4. 想好动作序列，一次 `excalidraw_act` 提交：选矩形工具、在画布上拖出方框、双击输入文字……
   每一步带 `label`，用户在画布上会看到「自动操作 3/8 · 输入节点名」这样的提示条。
5. 读 `act` 返回的 `change`：`changed: true` 才算改动落地；`false` 说明点空了或工具没切过去，
   回到第 4 步换一条路径。需要更细的视角时再单独 `excalidraw_probe` 一次。
6. 交付文件走编辑器自己的导出（菜单 → Save / Export image），字节会沿保存通道回到工作区；
   只要截图时用 `excalidraw_probe` 带 `save: true`，它会把当前画面存成 PNG 让用户选路径。

## 用坐标驱动界面的规矩

- **批量，但别赌。** 一次 `act` 提交 3–8 步是合适的；几十步连发等于把一次错误放大几十倍。
  不确定的地方插一步 `probe` 或 `wait`。
- **先切工具，再画。** 快捷键 `v` 选择、`r` 矩形、`d` 菱形、`o` 椭圆、`a` 箭头、`l` 线、`t` 文字、`x` 画笔。
  按完键再 `wait` 一小会儿，等工具栏状态跟上。
- **方框靠拖，不靠点。** `drag` 从左上拖到右下，`moves` 保持默认 8 就够；一次只画一个形状。
- **文字要双击进去。** 选中形状后 `double: true` 的 `click` 才进入编辑，随后 `type` 输入，`key` 按 `Escape` 收尾。
- **滚轮缩放会改变坐标系。** 动作序列里不要随手 `scroll`；真要缩放，缩放后重新 `probe` 取基线。

## 边界

- 语音、协作房间、Excalidraw+ 库同步需要上游自己的服务与账号，**不要承诺**这些能力。
- 上游界面语言跟随面板语言（`?lng=`），不要为了"看得懂菜单"去改语言；照当前界面语言描述步骤即可。
- 文件格式就是 `.excalidraw`（JSON）。想交付 PNG/SVG 就走编辑器自己的导出，不要另写转换。
