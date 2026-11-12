---
name: texturecraft
alias: TextureCraft
description: "Operate TextureCraft from the conversation: run its commands by name or shortcut, follow a named recipe for the chores (open, save, save-as, export, import, undo, redo), aim the canvas by fractions when a task is spatial, and prove every step with a measured reading before claiming it worked. 材质：通道、贴图、程序化图层与导出. Use whenever the user wants TextureCraft material created, changed or exported without doing the clicking themselves."
---
# TextureCraft
这个技能只做一件事：**让用户说一句话，编辑器里的功能真的被执行，执行结果可核对。**
材质：通道、贴图、程序化图层与导出。

顺序永远是一条：**先按名字执行**（`texturecraft_recipe` / `texturecraft_menu`）→ **再按坐标改画面**（`texturecraft_act`）
→ **最后用读数判对错**（`change` / `assert`）。反过来——先猜坐标再猜结果——就是"还是得人工操作"的那种失败。

## 八个工具

工具名都带 `texturecraft_` 前缀，全部打到正在运行的那个页面上，**标签页必须先开着**。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开编辑器 / 载入工作区里的文件 | `texturecraft_open_editor` | `{open, url, ready, canvas, file, opened, attempts, probe}` |
| 只看状态 | `texturecraft_editor_status` | 同上，或 `{open:false}` |
| **跑一条成套动作**（保存、导出、撤销…） | `texturecraft_recipe` | `{ok, invoked, id, steps[], change, probe, journal}` |
| **按名字执行一个功能** | `texturecraft_menu` | `{ok, invoked, step, attempts, change, probe, journal}` |
| 一次做完一串指针与键盘动作 | `texturecraft_act` | `{ok, steps[], elapsedMs, change, assert, probe, shot, previewed, journal}` |
| 读画布（可存/比基线） | `texturecraft_probe` | `{cells, cols, rows, mean, meanRgb, contrast, assert, baseline, shot, journal}` |
| 等画面稳定 | `texturecraft_wait` | `{settled, elapsedMs, looks, maxDrift, maxDistance, change, probe, journal}` |
| 把文件真正打开 | `texturecraft_open_document` | `{opened, step, attempts, staged, probe}` |

## 成套动作：一句话做完一件事

`texturecraft_recipe` 收一个 `id`，执行的是这条插件自带的一串动作（不猜坐标）：

| id | 什么时候用 |
| --- | --- |
| `open` | 文件已经在项目里，要进编辑器 |
| `save` | 用户说「保存一下」 |
| `save-as` | 要一份叫别的名字的副本 |
| `export` | 用户要一份能拿走的文件 |
| `import` | 素材还在工作区里 |
| `undo` | 刚做错了一步 |
| `redo` | 撤错了，要恢复 |

```json
{ "id": "save" }
```

- `invoked: true` 才说明这一串跑通了；`steps` 里每一步都有结果。
- 想先知道有哪些：`{ "list": true }`，返回 `ids` 与每条的中文说明。
- 失败不是崩溃：`attempts` 里能看到哪一步没跑起来，换 `menu` 的单步调用，或者退回 `act`。

## 按名字执行单个功能

`references/commands.md` 是这张插件自己的命令索引，两列直接就是参数：

```json
{ "shortcut": "ctrl+s" }
```
```json
{ "path": ["File", "Export", "Save for Web…"] }
```

- **快捷键优先**：一次按键、没有时序问题。
- **菜单路径次之**：`Alt` + 菜单首字母打开，再逐字母往下，最后 `Enter`；名字里的省略号原样保留。
- **两个都给**：先快捷键，失败再走路径，`attempts` 里逐步可见。

## 按坐标改画面

`texturecraft_act` 的 `steps` 是数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` / `ready` / `capture` / `label`。
`x`、`y` 是 `0..1` 的**分数坐标**：`0.5, 0.5` 永远是画布正中。地图 32 列 × 18 行，
第 c 列第 r 行是 `x=(c+0.5)/32`、`y=(r+0.5)/18`。

- 每步带 `label`（用户的语言），它会显示在画布 HUD 上，用户能看见你在做什么。
- 一次 3–8 步最合适；不确定的地方插一步 `probe` 或 `wait`。
- **打字只有 ASCII**：上游收到的是按键，不是文本；中文让用户粘贴，或写进文件用 `texturecraft_open_document` 递进去。

## 等它画完，再判对错

三个词，三件事：

| 问的 | 看什么 |
| --- | --- |
| 画面安静下来了没有 | `texturecraft_wait` 的 `settled` |
| 期间发生过什么 | `change.changed` / `change.distance` |
| **我期望的那件事发生了没有** | `assert.ok` |

"安静"是量出来的：平均色差 ≤ 6、变字的格子 ≤ 2% 才算这一步没动——与 `change.changed` 同一组数。

知道结果该是什么样时，把 `expect` 传给 `act`、`probe` 或 `menu` 之后再看：

```json
{ "expect": { "meanRgb": [235, 235, 235], "text": "画布底色换成浅灰" } }
```

- `against: "baseline"` 比的是**存下来的读数**：先在正确时刻用 `probe` 带 `remember_as: "current"` 存一次
  （`.craft/texturecraft/baseline/<name>.json`），以后拿它当基准；
- 基线不存在、格栅或区域对不上，`assert` 一律 fail，不会默默通过；
- `assert.ok` 为 `false`：换路径、换快捷键、换坐标，**不要重放同一批动作**。

## 失败怎么读

| 返回值 | 意思 | 下一步 |
| --- | --- | --- |
| `recipe` 的 `invoked: false` | 这条成套动作没跑通 | 看 `attempts` 是哪一步，改用 `menu` 单步 |
| `menu` 的 `invoked: false` | 命令没跑：名字不对、没有助记符、被对话框挡住 | 查 `references/commands.md` 换写法，先 `Escape` 关对话框 |
| `change.changed: false` | 事件到了，应用没接受 | 换方法，不要同一点试第三次 |
| `changed: true` 但 `assert.ok: false` | 做了别的事 | 先 `probe` 看现状，再决定是否撤销 |
| `settled: false` | 画面一直在动（默认 20 s 超时） | 看 `maxDrift`：大是动画，小是抽搐；如实告诉用户 |
| `editor-not-open` | 标签页没开 | 先 `texturecraft_open_editor` |

## 两双眼睛

`probe` / `act` / `menu` 之后都有两个读数：**文字地图**给你（`cells`、`mean`、`contrast`），
**PNG** 给两个人（写进 `.craft/texturecraft/shots/`，只留 6 张，路径在 `shot`，同时用宿主预览器打开）。

判"变没变"看 `change`；判"对不对"看 `assert`；判"好不好看"——对齐、字距、渐带——`Read` 那个 `shot`。

## 硬规则

- **保存属于用户。** `probe` 存的是画面 PNG，不是工程文件；看不到保存后的状态就不要说"已保存"。
- **中文显示成方块或日文字形，不是文件坏了。** 这个 Web 构建只烘了 Latin + 一款日文字体；
  `_open_document` 成功时带的 `glyphs` 说明就是这个意思。不要为了"修乱码"重写文件。
- **不要把 `%key%` 写进给编辑器的文字里**：那是宿主 UI 的占位符，进了画布会原样显示。
- **每次动作都留一行轨迹**：`.craft/texturecraft/runs/<日期>.jsonl`（只留 7 天），返回里的 `journal` 就是它。
- 基线与轨迹都住在项目里（`.craft/texturecraft/`）：换个项目就没有了。
