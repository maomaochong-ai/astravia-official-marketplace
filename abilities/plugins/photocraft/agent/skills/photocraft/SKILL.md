---
name: photocraft
alias: Photocraft 图片编辑
description: "Drive Photocraft inside Astravia the way an operator would: address any of its commands by name or shortcut, aim the canvas by fractions, and prove every step with a measured reading — Image editing; an open-source, clean-room reimplementation of Adobe Photoshop. Layers, masks, adjustment layers, layer styles, type, vectors, brushes and real PSD files. Use when the user wants something made, changed or exported in Photocraft without doing the clicking by hand."
---
# Photocraft 图片编辑

Photocraft 图片编辑 是上游自己的 Web 构建，插件没有改过它一行代码。这个技能要解决的事情只有一件：
**让用户说一句话，编辑器里的功能真的被执行，而且执行结果可核对。**

能自动化到什么程度，取决于功能有没有名字。所以顺序永远是：**先按名字找功能**（`photocraft_menu`），
**再按坐标改画面**（`photocraft_act`），**最后用读数判对错**（`change` / `assert`）。
反过来做——先猜坐标再猜结果——就是"编辑器还得人工操作"的那种失败。

## 七个工具

工具名都带 `photocraft_` 前缀，全部打到正在运行的那个页面上，所以**标签页必须先开着**。

| 你要做的事 | 工具 | 返回什么 |
| --- | --- | --- |
| 打开编辑器 / 载入工作区里的文件 | `photocraft_open_editor` | `{open, url, ready, canvas, staged, file, opened, attempts, probe}` |
| 只看状态，不打开任何东西 | `photocraft_editor_status` | 同上，或 `{open:false}` |
| **按名字执行一个功能** | `photocraft_menu` | `{ok, invoked, step, attempts, change, probe, journal}` |
| 一次做完一串指针与键盘动作 | `photocraft_act` | `{ok, steps[], elapsedMs, change, assert, probe, shot, previewed, journal}` |
| 读画布：文字地图 + 平均色，可顺便存/比基线 | `photocraft_probe` | `{cells, cols, rows, mean, meanRgb, contrast, assert, baseline, shot, previewed, journal}` |
| 等画面稳定 | `photocraft_wait` | `{settled, elapsedMs, looks, maxDrift, maxDistance, change, probe, shot, previewed, journal}` |
| 把文件真正打开 | `photocraft_open_document` | `{opened, step, attempts, staged, probe}` |

## 先按名字执行功能

`photocraft_menu` 收两样东西，都能从 `references/commands.md` 里照抄：

```json
{ "shortcut": "ctrl+s" }
```
```json
{ "path": ["File", "Export", "Save for Web…"] }
```

- **快捷键优先**：一次按键、没有时序问题。表里 `快捷键` 一列就是这个应用自己的绑定。
- **菜单路径次之**：工具用 `Alt` + 菜单首字母打开，再逐字母往下走，最后 `Enter`。名字里的省略号可以原样保留。
- **两个都给**：先试快捷键，失败再走路径，`attempts` 里能看到每一步。
- `invoked: false` 不是崩溃，是"这条命令没跑起来"：查 `references/commands.md` 换个写法、关掉挡住的对话框，
  或者退回 `act` 用手势点。

| 要做的事 | 快捷键 | `path` |
| --- | --- | --- |
| 新建 | Cmd+N | `["File","New…"]` |
| 打开 | Cmd+O | `["File","Open…"]` |
| 保存 | Cmd+S | `["File","Save"]` |
| 另存 / 导出 | Cmd+Shift+S | `["File","Save As…"]` |
| 适合窗口 | — | `["View","Fit Layer(s) on Screen"]` |

## 按坐标改画面

`photocraft_act` 的 `steps` 是数组，`op` 取 `click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` / `ready` / `capture` / `label`。
`x`、`y` 是 `0..1` 的**分数坐标**，不是像素——`0.5, 0.5` 永远是画布正中，窗口 900 px 还是 2400 px 都一样。
每格对应的坐标：地图是 32 列 × 18 行，第 c 列第 r 行是 `x=(c+0.5)/32`、`y=(r+0.5)/18`。

- 每一步带 `label`（用户的语言），它会显示在画布 HUD 上，用户能看见你在做什么。
- 一次提交 3–8 步最合适；不确定的地方插一步 `probe` 或 `wait`，别把一次错误放大几十倍。
- **打字只有 ASCII**：上游直接读按键，没有输入法；中文请让用户粘贴，或写进文件再用 `photocraft_open_document` 递进去。

## 等它画完，再判对错

`photocraft_act` 在最后一步发出去时就返回了，页面还在继续画。三个词，三件事，不要混用：

| 问的 | 看什么 |
| --- | --- |
| 画面安静下来了没有 | `photocraft_wait` 的 `settled` |
| 期间发生过什么 | `change.changed` / `change.distance` |
| **我期望的那件事发生了没有** | `assert.ok` |

"安静"是量出来的，不是逐格相等：平均色差 ≤ 6、变字的格子 ≤ 2% 就算这一步没动——与 `change.changed`
同一组数。严格相等在这类画布上不可用（抗锯齿、抖动渐变、光标闪烁每帧都在改格子）。

知道结果该长什么样时，把 `expect` 一并传进 `act`、`probe` 或 `menu` 之后再看：

```json
{ "expect": { "meanRgb": [235, 235, 235], "text": "画布底色换成浅灰" } }
```

- `against: "baseline"` 比的是**存下来的读数**：先用 `probe` 带 `remember_as: "current"` 在正确时刻存一次
  （落到 `.craft/photocraft/baseline/<name>.json`），以后拿它当基准；
- 基线不存在、格栅或区域对不上，`assert` 一律 **fail**，不会默默当通过；
- `assert.ok` 为 `false` 时：换路径、换快捷键、换坐标，**不要重放同一批动作**。

## 失败怎么读

| 返回值 | 意思 | 下一步 |
| --- | --- | --- |
| `menu` 的 `invoked: false` | 命令没跑：名字不对、没有助记符、或被模态对话框挡住 | 查命令表换写法，或先 `Escape` 关掉对话框 |
| `change.changed: false` | 事件到了，应用没接受 | 换方法，不要同一点重试第三次 |
| `change.changed: true` 但 `assert.ok: false` | 做了别的事 | 先 `probe` 看现状，再决定是否 `menu` 撤销 |
| `settled: false` | 画面一直在动（默认 20 s 超时） | 看 `maxDrift`：很大是动画在跑，很小是它在抽搐；如实告诉用户 |
| `editor-not-open` | 标签页没开 | 先 `photocraft_open_editor` |

## 两双眼睛

`_probe` / `_act` / `_menu` 之后都能拿到两个读数：**文字地图**给你（`cells`、`mean`、`meanRgb`、`contrast`），
**PNG** 给两个人（写进 `.craft/photocraft/shots/`，只留最新 6 张，路径在 `shot`，同时用宿主预览器打开）。

- 判"变没变"看 `change`；判"对不对"看 `assert`；判"好不好看"——对齐、字距、渐带——`Read` 那个 `shot`。
- `shot: false` 跳过写文件，`preview: false` 不弹预览器；`previewed: false` 不是失败（宿主太旧会这样）。

## 关掉标签页再打开

关掉活动标签页会销毁 iframe，文档原本住在里面。所以每次成功打开都会把路径记进插件自己的存储
（`ctx.storage`，键 `last-document.json`），面板回来时自动重开那个文件——只在同一个项目里恢复。

## 硬规则

- **保存属于用户。** `probe` 存的是画面 PNG，不是工程文件；除非返回里看得到保存后的状态，不要说"已保存"。
- **中文显示成方块或日文字形，不是文件坏了。** 上游 Web 构建只烘了 Latin + 一款日文字体，
  简体专属字形没有字形可画；`_open_document` 成功时会带一条 `glyphs` 说明。不要为了"修乱码"重写文件。
- **不要把 `%key%` 写进给编辑器的文字里**：那是宿主 UI 的占位符，进了画布会原样显示。
- **每次动作都留一行轨迹**：`.craft/photocraft/runs/<日期>.jsonl`（只留 7 天），返回里的 `journal` 就是它。
  它的用途是以后回头数"哪一步点空了"，不要当产物交给用户。
- 基线与轨迹都住在项目里（`.craft/photocraft/`）：换个项目就没有了。

## 判断上游有没有这个功能

`references/commands.md` 是全量命令表，`references/upstream.md` 是它的原始来源（含上游自述与提取方式）。
问"有没有这个功能""它叫什么""上游给它配了什么键"，先查表。表里没有的，可能这一版没有，
也可能只是没进这张表——以编辑器里看得到的界面为准，不要凭记忆断言。

## 其他参考

按任务读，不要一次全读：

- `references/formats/affinity.md`
- `references/formats/overview.md`
- `references/formats/pcraft.md`
- `references/formats/psd-psb.md`
- `references/formats/raster-formats.md`
- `references/formats/svg.md`
