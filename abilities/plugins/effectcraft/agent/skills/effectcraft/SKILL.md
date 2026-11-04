---
name: effectcraft
alias: EffectCraft 动态图形
description: Animate compositions in EffectCraft inside Astravia: layers, keyframes, 3D camera and lights, effects and the render queue. Use when the task is motion graphics, an animated title, a visual effect, or rendering a frame range.
---
# EffectCraft 动态图形

`effectcraft` 跑的是上游自己的 Web 构建，插件没有改过一行渲染代码。插件补的是门口那一段：工作区里的文件递得进去，导出的字节原路回到同一个路径，
以及**让这个特效编辑器能被对话驱动**——你说要做的事，面板里跟着做，做完能用一份可测量的证据核对。

所以**这个能力的上限就是 EffectCraft 本身**。插件只负责把动作送进去、把画面读回来；做成什么样，仍然由你和用户共同决定。

## 五个工具

名字都带 `effectcraft_` 前缀，全部打到正在运行的那个页面上，所以**标签页必须先开着**。工具少是有意的：一次批量胜过十次往返。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开编辑器 / 载入工作区里的文件 | `effectcraft_open_editor` | `{open, url, ready, canvas, secure, staged, probe}` |
| 只想看状态，不打开任何东西 | `effectcraft_editor_status` | 同上，或 `{open:false}` |
| 一次做完一串指针与键盘动作 | `effectcraft_act` | `{ok, steps[], elapsedMs, before, after, change}` |
| 读画布：文字地图 + 平均色 | `effectcraft_probe` | `{cells, cols, rows, mean, meanRgb, contrast}` |
| 把文件真正打开（暂存 + Ctrl+O + 等载入） | `effectcraft_open_document` | `{opened, probe, change}` |

`effectcraft_act` 的 `steps` 是一个数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` /
`ready` / `capture` / `label`。`x`、`y` 是 `0..1` 的**分数坐标**，不是像素——`0.5, 0.5` 永远是画布正中，
用户窗口是 900 px 还是 2400 px 都一样。`before` / `after` 是动作前后各探一次画布，`change.distance` 大于 6
就说明画面真的变了（0–441 的 RGB 距离）。

## 怎么"看见"画布

工具结果只能以文本回到你这里，图片到不了。所以 `effectcraft_probe` 回的是**一张文字地图**：默认 32 列 × 18 行，
每格一个字母。`K` 近黑、`W` 很亮、`w` 中亮、`k` 中暗、`R O Y G C B P M` 分别是红橙黄绿青蓝紫，
小写表示偏暗。配合 `mean`（平均色的十六进制）、`meanRgb` 与 `contrast`（对比度），足够回答三个问题：

- 画面是空白还是已经有内容？（整片 `W` 或 `K` + `contrast` ≈ 0 说明还空着）
- 我的动作起作用了吗？（前后两次 `cells` 差异 / `change.distance`）
- 大体长什么样？（色块分布、主要色相、明暗层次）

它不替代眼睛：文字的排布细节、细小控件的位置、字体与字距都看不出来。要精确到像素的判断，让用户看屏幕，
或者 `effectcraft_probe` 时把 `region` 收窄到那一块、把 `columns` / `rows` 调大到 64 × 36 再读。

## 一次完整的任务长什么样

用户说「打开 EffectCraft 并用 @素材/封面.png 把背景换成渐变蓝色」，实际走的是这条路：

1. `effectcraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. 文件在工作区里：`effectcraft_open_document` 一步到位（暂存 → Ctrl+O → 等载入 → 探一次画布）。
   返回 `opened: false` 说明编辑器不认这个文件或载入超时，**如实说**，不要假装打开了。
3. `effectcraft_probe` 先看一眼现在的画面，确立基线。
4. 想好动作序列，一次 `effectcraft_act` 提交：选中图层、打开背景色面板、把颜色调成渐变蓝……
   每一步带 `label`，用户在画布上会看到「自动操作 3/8 · 打开背景色面板」这样的提示条。
5. 再 `effectcraft_probe`（并且 `act` 自己已经带了 `after`）读 `change`：`changed: true` 才算改动落地；
   `false` 就说明点空了或面板没打开，回到第 4 步换一条路径。
6. 需要交付图片时 `effectcraft_probe` 带 `save: true`，它会把当前画面存成 PNG 让用户选路径。

## 用坐标驱动界面的规矩

- **批量，但别赌。** 一次 `act` 提交 3–8 步是合适的；几十步连发等于把一次错误放大几十倍。
  不确定的地方插一步 `probe` 或 `wait`。
- **`ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一的证据是 `change.changed` 或下一次 `probe`。
- **打字只有 ASCII。** 上游直接读按键，没有输入法；中文、日文、带重音的字符到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `effectcraft_open_document` 递进去。
- **同一个位置两次没反应就换方法**：改用菜单、改用键盘、缩小 `region` 重探，或者直接问用户看到了什么。
  不要同一个坐标试第三次。
- **窗口可能不在前台。** 面板被切走时上游会停帧，动作仍然会发出去但慢一些；`act` 超时就把窗口切回来再试。

## 硬规则

- 标签页没开时所有动作工具都回 `editor-not-open`，这不是插件坏了，先 `effectcraft_open_editor`。
- **保存属于用户。** `probe` 存的是当前画面的 PNG 快照，不是工程文件。不要声称自己保存了文档，
  除非返回里能看到保存后的状态。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。
- 不要把 `%key%` 写进任何给编辑器的文字里：那是宿主 UI 的占位符，进了画布只会原样显示。

## 上游文档

`references/upstream.md` 是从上游 `effectcraft` 自己的 Rust 源码里导出的命令表：菜单路径、显示名、默认快捷键、命令 id。
要确认「有没有这个功能」「它叫什么」「上游给它配了什么键」，先读它，不要凭记忆描述上游功能。
`references/` 里另有上游自带的文档，按任务去读：

| 目录 | 什么时候读 |
| --- | --- |
| `references/getting-started/` | 用户第一次装、问支持什么系统 |
| `references/guides/` | 建文档、开文件、放素材、导出 |
| `references/faq/` | 是否免费、能开什么格式 |
| `references/troubleshooting/` | 启动即退、找不到入口 |

这些文档是英文的，且偏工程口径；描述实现与路线图的部分讲的是上游自己的计划，不是这个插件的用法。
用户问「这个功能在上游叫什么、怎么用」时读它，问「在 Astravia 里怎么操作」时看上面几节就够了。
