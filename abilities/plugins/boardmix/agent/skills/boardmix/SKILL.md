---
name: boardmix
description: "Operate a real Boardmix board (boardmix.cn) from the conversation: open the panel, put a sentence into Boardmix's own AI, hand it a Mermaid diagram, or read the page and click through it with real input — then confirm with a screenshot. Use when the user mentions Boardmix, 白板, 看板, 思维导图, 流程图, 在线协作画布, wants something made on a board, wants the panel moved or fixed on login/blank, or wants a board shared or exported. Do NOT use for drawing inside the user's own project, or for Excalidraw or any other canvas app. Canvas shapes are pixels: read and describe them only from a boardmix_shot screenshot, never as data you parsed."
---

# Boardmix

Boardmix 是跑在它自己服务器上的 web 产品，插件是外壳：一个标签页，能登录、能导航、能读页面、能用真实
键鼠操作它、能截图。**这一页里的 AI 也是产品的一部分**——它就是那个"按一句话改画布"的 agent。

所以工作方式是三层，**从上往下选，不要一上来就点坐标**：

| 用户要的 | 走哪条 | 工具 |
| --- | --- | --- |
| 「让 AI 做一份演示 / 文档 / 图 / 插画」「让 AI 改这块板」 | 产品自己的 AI | `boardmix_ai_prompt` |
| 「把这段内容画成流程图 / 时序图 / ER 图」 | 产品自己的 Mermaid 导入 | `boardmix_diagram` |
| 「点那个按钮」「在输入框里填这个」「把面板挪到某页」 | 这一页的 DOM | `boardmix_read` + `boardmix_act` |

一句话判据：**谁生成**。产品生成 → 第一条；我写源、产品渲染 → 第二条；产品不生成、只是被点 → 第三条。

## 十二个工具

**导航（只搬页面，不改内容）**

| Tool | Call it when | Read back |
| --- | --- | --- |
| `boardmix_open` | 每个 Boardmix 任务的第一步；也是"打开白板" | `open`, `phase`, `seedLevel`, `url`, `next` |
| `boardmix_goto` | 用户给了链接，或目的地已知 | `ok` 或 `reason`，以及 `url` / `phase` |
| `boardmix_new` | 要新建一块板（送进创建入口） | 永远 `needsUserAction: true` |
| `boardmix_ai` | 只想把页面送到 AI 入口，不打算写 prompt | 永远 `needsUserAction: true` |
| `boardmix_tab_status` | 只想知道状态，不打开任何东西 | `open`, `url`, `phase` |
| `boardmix_open_in_browser` | 面板渲染不了，用户要接着干 | `ok` + 地址文本 |

**页面（这一页的眼睛和手）**

| Tool | Call it when | Read back |
| --- | --- | --- |
| `boardmix_read` | 任何点击之前；"屏幕上现在有什么""还在登录页吗" | `url`, `title`, `login`, `size`, `items[{label,x,y}]`, `text` |
| `boardmix_act` | 点 `boardmix_read` 给过的点、输入、按键、滚动 | `steps[{index,label,ok}]`, `stoppedAt`, 之后的 `url` |
| `boardmix_shot` | 要看**画出来的东西**：流程图、便签墙、演示画布 | `.boardmix/shots/` 里的 `path`，然后读那张 PNG |

**语义（把文本交给产品自己的能力）**

| Tool | Call it when | Read back |
| --- | --- | --- |
| `boardmix_diagram` | 你写好了 Mermaid。默认只落盘 `.mmd`，`apply: true` 才粘到画布 | `staged{path,kind,elements,overBudget}`, `applied`, `paste`, `shot` |
| `boardmix_ai_prompt` | 你写好了 prompt，要送进页内 AI | `delivered`, `sent`, `composer`, `shot` |
| `boardmix_automate` | 想一次跑完一串有顺序的步骤并拿到每步状态 | 运行记录（`steps`, `landing`） |

两种"没跑成"要分清：`needsUserAction: true` 是**交还给人**（下一步是用户点一下）；
`delivered: false` / `invoked: false` 是**真没送进去**（页面没渲染完、改版了、或名字不对），
这时把内容放进回复让用户粘，不要重放同一次。

## 工作法

1. `boardmix_open`。别在它之前 `boardmix_goto`——open 才建立标签页。
2. 读 `phase`。`login` 表示还停在产品自己的登录页：请用户在面板里登录，然后停。不重试、不代填、
   不要密码/验证码/cookie。
3. 按上面的三层选路，把活干完；需要域知识时唤起兄弟技能（见下表）。
4. 目的地不确定就别导航：这是个单页应用，几乎任何 `/app/...` 地址都会给一个壳。
5. 能点到的按钮就自己点（`boardmix_act`），点完再 `boardmix_read` 或 `boardmix_shot` 确认。
6. 收尾三件事：产物是什么、你在屏幕上确认了什么、还剩哪一步是用户的。

**失败阶梯**，不要发明第四步：

1. 看 `seedLevel`：1 是上次能用的地址，2 是 `/app/`，3 是站点根。
2. 再 `boardmix_open` 一次，阶梯会自己往下退。
3. 还不行 → `boardmix_open_in_browser`：既是出口，也是"这条路封了"的信号。

同一个动作两次同一结果 = 换技术，不是重试。

## 唤起哪个兄弟技能

| 用户要的 | 唤起 |
| --- | --- |
| 往画布上放东西：便签、思维导图、流程图、文档卡片、表格、图形、画笔、连线 | `boardmix-canvas` |
| 别人看/改：分享链接、权限、评论、投票、演示模式、分组讨论 | `boardmix-collaboration` |
| 产品自己的 AI：PPT、流程图、文档、图片、写作、SWOT、页内 agent | `boardmix-ai` |
| 文件进出：导入 PPT/PDF/Mermaid，导出 PNG/JPG/PDF/PPT | `boardmix-io` |
| 只是这一页：打开、登录、白屏、跑错页 | 留在这儿 |

## 完成的样子

五条都成立才算完，系统不会提醒你：

- 标签页开着，`phase` 和你说的一样；
- `url` 就是你告诉用户的那一页；
- 点过的东西都复核过：再 `boardmix_read`，或 `boardmix_shot` 拍一张你**真的读过**的图——不许"应该已经打开了"；
- 产物（Mermaid / Markdown / 提纲 / 表格 / prompt）**在回复里或工作目录里**，不是一句承诺；
- 回复里点明用户要按的那一步，用产品自己的说法。

**不算完成的说法**：「已为你创建」「已生成」「已帮你画好」、描述一张没看过的画布、没人产出过的分享链接、
没有对应会员却承诺无水印导出。

## 边界，直说

- **列不出用户的板**。没有公开列表接口。把人送到 `/app/recent-file`，那里有搜索框，让用户自己挑。
- **读不了画布结构**。`boardmix_read` 看到的是页面控件，不是绘图表面。思维导图、便签墙、流程图都是像素：
  `boardmix_shot` 拍下来看。要"理解这块板讲了什么"，用页内 AI（`boardmix_ai_prompt`），
  它才是能读板子的那一方。
- **不要凭像素猜着点图形**。真实输入（`boardmix_act`）能到页面，但一个图形在截图里没有可靠的点可瞄；
  按钮、菜单、对话框、表单才是可信目标。
- **不持有凭据**。没有 cookie、没有代登录、没有验证码。

## 参考（按需读）

相对 `$SKILL_DIR` 解析，不要一次全读。

| 文件 | 什么时候读 |
| --- | --- |
| `references/tool-envelope.md` | 需要确切字段、seed 阶梯、某个 `reason` 的含义 |
| `references/page-map.md` | 选目的地，或页面不在你以为的地方 |
