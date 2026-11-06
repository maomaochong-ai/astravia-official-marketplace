---
name: texturecraft
alias: TextureCraft 贴图
description: "Paint 3D textures inside Astravia — the upstream TextureCraft editor, with layered PBR painting, bakes and smart materials."
---
# TextureCraft 贴图

`texturecraft` 跑的是上游自己的 Web 构建，插件没有改过一行渲染代码。插件补的是门口那一段：工作区里的文件递得进去，导出的字节原路回到同一个路径，
以及**让这个纹理生成器能被对话驱动**——你说要做的事，面板里跟着做，做完能用一份可测量的证据核对。

所以**这个能力的上限就是 TextureCraft 本身**。插件只负责把动作送进去、把画面读回来；做成什么样，仍然由你和用户共同决定。

## 六个工具

名字都带 `texturecraft_` 前缀，全部打到正在运行的那个页面上，所以**标签页必须先开着**。工具少是有意的：一次批量胜过十次往返。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开编辑器 / 载入工作区里的文件 | `texturecraft_open_editor` | `{open, url, ready, canvas, secure, staged, probe}` |
| 只想看状态，不打开任何东西 | `texturecraft_editor_status` | 同上，或 `{open:false}` |
| 一次做完一串指针与键盘动作 | `texturecraft_act` | `{ok, steps[], elapsedMs, before, after, change, shot, previewed}` |
| 读画布：文字地图 + 平均色 | `texturecraft_probe` | `{cells, cols, rows, mean, meanRgb, contrast, shot, previewed}` |
| 等画面稳定（滤镜、导出、重排这些不会立刻画完） | `texturecraft_wait` | `{settled, elapsedMs, looks, change, probe, shot, previewed}` |
| 把文件真正打开（暂存 + Ctrl+O + 等载入） | `texturecraft_open_document` | `{opened, probe, change}` |

`texturecraft_act` 的 `steps` 是一个数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` /
`ready` / `capture` / `label`。`x`、`y` 是 `0..1` 的**分数坐标**，不是像素——`0.5, 0.5` 永远是画布正中，
用户窗口是 900 px 还是 2400 px 都一样。`before` / `after` 是动作前后各探一次画布，`change.distance` 大于 6
就说明画面真的变了（0–441 的 RGB 距离）。

## 怎么"看见"画布

工具结果只能以文本回到你这里，画布不会自己变成一张图送到你眼前——但它会**存成文件并把路径还给你**，你 `Read` 那个路径就等于看见了画面（想让人也看见，见下面「两双眼睛」）。所以 `texturecraft_probe` 回的是**一张文字地图**：默认 32 列 × 18 行，
每格一个字母。`K` 近黑、`W` 很亮、`w` 中亮、`k` 中暗、`R O Y G C B P M` 分别是红橙黄绿青蓝紫，
小写表示偏暗。配合 `mean`（平均色的十六进制）、`meanRgb` 与 `contrast`（对比度），足够回答三个问题：

- 画面是空白还是已经有内容？（整片 `W` 或 `K` + `contrast` ≈ 0 说明还空着）
- 我的动作起作用了吗？（前后两次 `cells` 差异 / `change.distance`）
- 大体长什么样？（色块分布、主要色相、明暗层次）

它不替代眼睛：文字的排布细节、细小控件的位置、字体与字距都看不出来。要精确到像素的判断，让用户看屏幕，
或者 `texturecraft_probe` 时把 `region` 收窄到那一块、把 `columns` / `rows` 调大到 64 × 36 再读。

## 等它画完

`texturecraft_act` 在最后一步发出去时就返回了，页面还在继续画：滤镜在算、预览在渲染、页面在重排。这时候直接 `probe`
读到的是半成品，容易当成结果，也容易在同一个位置上再点一次。

`texturecraft_wait` 补的就是这一段：每 250 ms 读一次文字地图，`cells` 与 `mean` 连续 600 ms 不变就算落定，
回 `{settled, elapsedMs, looks, change}`。它**不动画面**——不发点击、不发按键。

- `settled: true` 才继续判断。`settled: false` 是超时（默认 20 s），说明画面一直在动：把这一点如实
  告诉用户，不要同一个形状试第三次。
- `change.changed` 才是"这一批到底有没有做事"的证据，比 `act` 的 `ok` 可靠。
- 一次导出、一次大滤镜、一次整页重排，都可以先 `_wait`，再决定是交付还是继续改。

## 两双眼睛

`_probe` 与 `_act` 每次同时服务两个读者：回**文字地图**给你，把同一帧存成 PNG 写进项目
`.craft/shots/`（只留最新 6 张），路径以 `shot` 回到工具结果里；再把那张图交给宿主预览器打开，
给**用户**看。

- 给你：`Read` 那个 `shot` 路径，看到的是真实像素。对齐、字距、渐变走向、留白比例——文字地图
  答不了的问题，它答得了。判颜色、判排版、判"像不像设计稿"，看图片；判"变没变"，看 `change`。
- 给用户：预览器里是同一张图。所以"我调好了"是可核对的，你们看的不是两样东西。
- `shot: false` 跳过写文件（只要地图，更快）；`preview: false` 不弹预览器。返回里的 `previewed`
  说明预览到底有没有弹出来——宿主太旧会是 `false`，**那不是失败**，别当错误报给用户。


## 一次完整的任务长什么样

用户说「打开 TextureCraft 并用 @素材/封面.png 把背景换成渐变蓝色」，实际走的是这条路：

1. `texturecraft_open_editor`，等到 `ready: true`。`ready: false` 就把返回里的 `error` 原样告诉用户，不要猜。
2. 文件在工作区里：`texturecraft_open_document` 一步到位（暂存 → Ctrl+O → 等载入 → 探一次画布）。
   返回 `opened: false` 说明编辑器不认这个文件或载入超时，**如实说**，不要假装打开了。
3. `texturecraft_probe` 先看一眼现在的画面，确立基线。
4. 想好动作序列，一次 `texturecraft_act` 提交：选中图层、打开背景色面板、把颜色调成渐变蓝……
   每一步带 `label`，用户在画布上会看到「自动操作 3/8 · 打开背景色面板」这样的提示条。
5. 再 `texturecraft_probe`（并且 `act` 自己已经带了 `after`）读 `change`：`changed: true` 才算改动落地；
   `false` 就说明点空了或面板没打开，回到第 4 步换一条路径。
6. 需要交付图片时 `texturecraft_probe` 带 `save: true`，它会把当前画面存成 PNG 让用户选路径。

## 用坐标驱动界面的规矩

- **批量，但别赌。** 一次 `act` 提交 3–8 步是合适的；几十步连发等于把一次错误放大几十倍。
  不确定的地方插一步 `probe` 或 `wait`。
- **`ok: true` 只表示事件发出去了**，不表示应用接受了它。唯一的证据是 `change.changed` 或下一次 `probe`。
- **打字只有 ASCII。** 上游直接读按键，没有输入法；中文、日文、带重音的字符到不了输入框。
  需要中文内容时，让用户粘贴，或者写进文件再用 `texturecraft_open_document` 递进去。
- **同一个位置两次没反应就换方法**：改用菜单、改用键盘、缩小 `region` 重探，或者直接问用户看到了什么。
  不要同一个坐标试第三次。
- **窗口可能不在前台。** 面板被切走时上游会停帧，动作仍然会发出去但慢一些；`act` 超时就把窗口切回来再试。

## 画布上的右键

编辑器是一整块 wasm 画布，插件不在它上面盖任何常驻按钮。刷新、全屏、以及「交给 AI」，全在**画布右键**里：

| 右键里的项 | 做什么 |
| --- | --- |
| 把这一块交给 AI | 进入框选：拖出矩形，`Esc` 取消。松手后这一块被裁成 PNG 存进 `.craft/shots/`，同时一行带尺寸与路径的话进输入框 |
| 整页交给 AI | 面板状态 + 当前整张画面的路径进输入框 |
| 刷新 / 全屏 | 同 `mod+shift+r` / `mod+shift+f` |

**要上游自己的右键菜单，按住 `Shift` 再右键。** 我们的菜单只接管普通右键。

局部只到**区域**这一级：画布是单个 wasm surface，页面里没有「元素」可选，所以「选中页内某个元素」在这里
办不到。想只读某一块，把归一化的 `region` 传给 `_probe` —— 同一件事的读侧。

## 关掉标签页再打开

关掉活动标签页会销毁 iframe，而文档原本住在里面。所以每次成功打开都会把路径记在
`.craft/last-document.json`，面板回来时自己把那个文件重新打开一次（不会覆盖资源管理器里当前选中的文件）。
这就是"产物关一次 tab 就消失"的解法：文件一直在项目里，缺的只是名字。

## 硬规则

- 标签页没开时所有动作工具都回 `editor-not-open`，这不是插件坏了，先 `texturecraft_open_editor`。
- **保存属于用户。** `probe` 存的是当前画面的 PNG 快照，不是工程文件。不要声称自己保存了文档，
  除非返回里能看到保存后的状态。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。
- **中文显示成方块或日文字形，不是文件坏了。** 上游的 Web 构建只把 Latin 和一款日文字体烘进 wasm，简体专属字形（测、图、层）没有字形可画，egui 只能画方块或用日文字形顶替。`_open_document` 成功时会带一条 `glyphs` 说明；**不要为了「修乱码」反复重写同一份文件**——字节是对的，重开也一样。
- 不要把 `%key%` 写进任何给编辑器的文字里：那是宿主 UI 的占位符，进了画布只会原样显示。

## 上游文档

`references/upstream.md` 是从上游 `texturecraft` 自己的 Rust 源码里导出的命令表：菜单路径、显示名、默认快捷键、
命令 id，加上上游对这个应用的一句话定位。判断「有没有这个功能」「它叫什么」「上游给它配了什么键」以它为准，
不要凭记忆描述上游功能。表里的名字取自上游菜单目录，所以在编辑器界面上真的存在。

网页构建没有命令总线，表里的命令 id 只能当索引：动作仍然通过 `act` 的指针与按键步骤落到界面上。
