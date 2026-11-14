# strix-0009 — 以上游 TUI 为界面基线：家族化渲染器与三处不做

- **Status:** Accepted
- **Date:** 2026-11-14
- **Context:** 插件 strix 0.7.6；界面相似度 69.7% → 85.4%；用户要求「以上游界面为基线再优化一次」
- **Related:** [0004](strix-0004-panel-is-a-workbench.md)（工作台）、[0007](strix-0007-panel-is-a-dashboard.md)（仪表盘）、[0008](strix-0008-three-roles-of-the-panel.md)（三种职责）

## 上游启动后长什么样（基线，供对照）

读 `strix/interface/tui/internal/app/view.go` 与 `internal/render/*` 得到的事实：

**启动屏（splash）**：黑底正中一块**绿色圆角边框**面板（`Border(Rounded)`, `Padding(1,6)`），
内容自上而下是 ASCII wordmark、`Welcome to ` + 绿色粗体 `Strix` + `!`、暗色 `v<版本>`、
暗色标语 `Open-source AI hackers for your apps`、空行、一行**扫光动画**的
`Starting Strix Agent`（按距离分四档亮度 `#525252 → #a3a3a3 → white → bright white`）、
绿色粗体 `strix.ai`。

**主界面**：左右两栏。
- 左栏自上而下：**对话历史**（圆角边框，空闲近黑 `#0a0a0a`，聚焦转绿）→ **状态行**（左：
  6 个方块组成的绿色扫光 + `esc stop` 或 `Initializing`；右：`ctrl-q quit`）→ **输入框**
  （圆角边框，暗色/聚焦绿，左侧 1 格内边距）。
- 右栏：侧栏，自上而下 `targets`、`stats`（模型、订阅、tokens、cost）、`vulnerabilities`、
  `mcp connections`、`agents tree`；每块可折叠/放大，字形 `▾ ▸ ⤢ ⤡ » «`；同一次只有一块
  展开，聚焦块边框转绿。

**轨迹里的四种形状**（`internal/render`）：
- 用户消息：蓝色竖条 `▍` + 粗体 `You:`，每行都带竖条；
- agent 回复：markdown 渲染；
- 工具调用：`→ Using tool <名字加粗蓝>`，参数每行缩进两格 `key: value`，末行状态
  `● In progress...`（琥珀）/ `✓ Done`（绿）/ `✗ Failed`（红）；
- **24 种工具有各自的画法**（`registry.go` 分派）：`◇ patch`、`◇ view image`、
  `✎ note (category)`、`→ <surface>` 按结果着色、`via MCP server <name>` 等；未登记的回落到
  上面那套 generic。

## The decision

**界面对齐以「能读出同一件事」为准，不以「形状一样」为准。** 具体三条：

1. **逐工具渲染改成家族化**（14 个家族覆盖 35 个工具 + generic）。上游 24 个渲染器的价值在
   于「一眼看出这是补丁 / 覆盖 / 发现 / 会话」，而不是 24 份各自为政的排版。家族表在
   `features/scan-console/tool-presentation.ts`：字形取自上游（`◇` `✎` `▤` `⚑` `☰` `⇄`），
   色调取上游语义（emerald 成功线 / amber 变更 / red 发现 / blue 执行 / slate 中性）。
   **只有带证据的家族可展开**（exec / patch / browser / proxy / report）；台账类不展开，
   因为它们的正文在侧栏，展开只会复制一遍。
2. **输入框与状态行保持「一栏到底」**：上游是「对话 → 状态 → 输入」垂直排列且同宽；面板沿用
   （轨迹 → 状态带 → composer），不把状态做成独立浮层。
3. **面板不复制上游的三种形态**：splash 的扫光动画、`agents tree`、`viewer` 网页端历史浏览。
   前两个在前面的 ADR 已有结论（0003 无插件侧循环、0006 不做多智能体）；viewer 需要另起一个
   HTTP 服务去读 run 目录，与「面板是窗口」相冲突——要回看历史，聊天区与报告文件都在。

## Capacity ledger（本次复算，`tools/capability-parity.mjs`）

| 口径 | 结果 |
|---|---|
| 原始能力覆盖率（40 项加权） | 65/83 = **78.3%** |
| 在范围内（剔除模型路由 / 多智能体 / 云端） | 61/72 = **84.7%** |
| 界面相似度（`tools/ui-parity.mjs`） | 76/89 = **85.4%**（本次前 69.7%） |

剩下来的差距只有四处，且都写了理由：逐工具一对一渲染器（家族化已覆盖语义，抹平同族差异）、
子智能体图（0006）、viewer（本节）、转写内图片与 markdown（0007：文字归对话，图给模型看
`strix_view_image`）。

## Considered options

- **照抄 24 个渲染器**：最像，但每个都是一次复制；家族表已经把「读得出是什么」这件事做到，
  再拆 24 份只会让新增工具时漏一处。**否。**
- **完全不改，只调颜色**：相似度停在 69.7%，而用户看到的问题恰恰是「工具行长得都一样」。**否。**
- **把状态行做成浮动条**：更像网页应用，但与上游「同宽一栏」的阅读节奏相反。**否。**

## What this does not do

- 不做启动屏扫光动画：面板的启动列已经有 wordmark 与桥接状态，加动画只增加闪烁。
- 不做 `agents tree`（无子智能体）与 viewer（见上）。
- 不把 markdown 渲染搬进面板：`strix_report` 的正文走展开，渲染留给聊天区（0007）。

## The cost

- 家族化会抹平同族内差异：`strix_note_list` 与 `strix_note_get` 长得一样，靠标题后缀
  （`note` / `note updated`）区分。上游是两套排版。
- 新增工具必须同时在 `tool-presentation.ts` 登记，否则落到 generic——这是刻意的：
  没定制是可见的。`tool-presentation.test.ts` 守着「35 个工具都有落点」。
