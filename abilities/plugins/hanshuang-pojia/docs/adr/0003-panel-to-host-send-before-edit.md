# 0003：面板 → 宿主对话的发送前二次编辑

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 3 项。面板上每个动作都会往宿主对话里投一段指令，投出去就收不回；用户需要发送前的最后一道手
- **适用：** `src/features/workbench/hooks/use-workbench.ts`、`src/features/workbench/prompts.ts`、`src/domain/my-cases.ts`、`src/domain/storage-layout.ts`

## 问题

面板发出的指令有两个来源：一是紫色按钮拼出来的固定话术（`buildPrompt`），二是用户在对话框里改过的文本。如果只做「按钮 → 直接发送」，用户没有任何机会在投递前修正目标、补上范围或删掉不适用的一段；而这段文本一旦进入宿主对话，就是模型下一轮的正式输入，解释成本远高于改一行字。

难点不在编辑框，而在**「预览的内容」必须就是「不编辑时发的内容」**。两处分别拼文本，迟早会漂。

## 决定

**D1：预览与发送共用同一个拼接函数。** `previewPrompt(action, extra)` 直接返回 `buildPrompt(action, { target, ...extra })`；`askText(text)` 把用户改完的文本原样交给 `chat.ask(text)`。中间不做二次加工、不做二次拼装、不再调用 `buildPrompt`。这样「对话框初值」与「直接发送」逐字节相同。

**D2：一份草稿只有三个出口，都必须显式。**

| 出口 | 落点 | 副作用 |
|---|---|---|
| 发送 | 宿主对话 | 进入对话历史，不可撤回 |
| 存为案例草稿 | 我的案例（`caseFromDraft`，id = `draft-<fnv>`） | 写 `workbench/workspaces/<key>/cases.json`，同一段文字只留一条 |
| 丢弃 | —— | **不写盘、不入对话** |

「丢弃」必须是零副作用。会话草稿的落点已经在 `storage-layout.ts` 定义好 —— `drafts` 键、`session` 作用域、`workbench/sessions/<key>/drafts.json`；`sessionKey(null)` 落到 `unsessioned` 独立分区，换一个会话看不见（见 0004）。

**但这条路径目前没有读写方。** `index.tsx` 只接到 `settings` / `library` / `cases` 三个键，`grep '"drafts"' src/` 除定义与类型外零命中。也就是说：今天的「存为案例草稿」写的是 workspace 作用域的 `cases.json`，`drafts.json` 是一个**已定义、未接线**的位置。会话级草稿要真正成立，得补一对读写（`bridge.readState` / `writeState` 到 `storageEntry("drafts", cwd, sessionId).path`），这是 0006 里「隔离读写」那一行的接线缺口。

**D3：案例草稿不要求先跑分析。** 用户写完一句发现「这条值得留着」，不该被迫先产出一份报告。`caseFromDraft` 因此只需要 `{prompt, at, tags?, model?}`，产出条目 `intent: "draft"`、`sha256` 为空、`size: 0`、`format: "prompt"`、`artifactRef: null`。上限仍受 `MAX_MY_CASES = 60` 约束。

**D4：指令语言一律英文，与工具描述同语言。** `buildPrompt` 的注释已经把理由写死：这段文字进入 Agent 上下文，和工具描述保持同一语言；并且明确要求 Agent 用插件工具取全量数据，而不是复述面板里已截断的摘要。翻译面板按钮的话术不受这条约束，翻译**投递内容**受。

## 不做什么

- 不做富文本编辑器。这是「改一句话」的位置，不是写作位置；打开一个带工具栏的编辑器会把「点一下就能干活」变成「先配置一个面板」。
- 不在编辑框里做合规化转译。转译属于 `promptContexts` 的第 3 级（追加说明），与用户手写的正文是两回事；混进来会让用户看不懂自己发出去的是什么。
- 不把草稿自动推进宿主对话。即使队列里积压了草稿，也必须由用户点发送。

## 验证

- `src/test/workbench/send-prompt-dialog.test.tsx`：对话框初值等于 `previewPrompt` 的结果；改完发送时用的是改后的文本。
- `src/test/workbench/prompts.test.ts`：每个 action 的话术形状与「要求用插件工具取全量」这一句不丢。
- 待补：三个出口的副作用矩阵（发送 → 对话；存草稿 → 只写 cases.json；丢弃 → 两处都不动）。

