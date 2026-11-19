# 0006：案例库测试矩阵

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 6 项。案例库要单测 + 端到端：去重、签名匹配、rewrite 生成、隔离读写；E2E 走全链路
- **适用：** `src/test/cases/`、`src/test/workbench/`、`src/test/dialogue/`、`src/domain/my-cases.ts`、`src/domain/refusal.ts`、`src/domain/reshaping.ts`、`src/domain/storage-layout.ts`

## 问题

现状是「单测够用、跨模块为零」。四类断言目前分散在互不相连的文件里，没有任何用例证明它们串起来是对的：

| 待办点名的能力 | 现有覆盖 | 缺口 |
|---|---|---|
| 去重 | `cases/my-cases.test.ts`：同 id 累加、超上限丢最旧、坏数据丢弃 | 草稿去重（`draft-<fnv>`）无断言 |
| 签名匹配 | `dialogue/refusal.test.ts`：五类判定与 rank | 「拒答信号 → 案例条目」的匹配无断言（两边各自测过，没见过面） |
| rewrite 生成 | `dialogue/reshaping.test.ts`：三档级联、目标提取 | 从案例库取档位无断言（该能力尚未实现，见 0008） |
| 隔离读写 | `workbench/storage-layout.test.ts`：workspace / plugin / 清理 | **`session` 作用域零覆盖** |
| E2E 全链路 | 无 | 无 |

## 决定

**D1：矩阵固定为 6 × 3，文件名固定。** 一行一项能力，一列一层（纯函数 / 接线 / 跨模块）。

| 能力 | 纯函数 | 接线（hook 或组件） | 跨模块 |
|---|---|---|---|
| 去重 | `cases/my-cases.test.ts` | `workbench/workbench.test.tsx` | `cases/case-library-chain.test.ts` |
| 签名匹配 | `dialogue/refusal.test.ts` | `dialogue/contributions.test.ts` | 同上 |
| rewrite 生成 | `dialogue/reshaping.test.ts` | `dialogue/contributions.test.ts` | 同上 |
| 隔离读写 | `workbench/storage-layout.test.ts` | `workbench/workbench.test.tsx` | 同上 |
| 沉淀 | `cases/my-cases.test.ts` | `workbench/send-prompt-dialog.test.tsx` | 同上 |
| 全链路 | —— | —— | `cases/case-library-chain.test.ts`（唯一一条） |

**D2：跨模块用例集中到一个文件，不许拆。** 理由是它断言的是「串起来还对」，一旦按能力拆开，任何一处改动都能让某一段变绿而全链已断。这个文件里允许一个 `describe` 覆盖一条完整链路：

`面板拼话术 → 投递 → 拒答命中 → 取档改写 → 干净收尾 → 沉淀为案例（带 refusalSig / rewriteChain） → 换会话后读回（只读工作区那份）`

**D3：只 mock 外部，不 mock 纯函数。** 网络、宿主进程、`ctx.fs` 用假实现（`memoryHarness` 一类）；`detectRefusal` / `reshapeAt` / `upsertCase` 必须真跑。mock 掉纯函数等于把被测对象删了。

**D4：断言功能结果，不断言调用次数。** 「沉淀了一次」要表现为 `cases.json` 里有这条且 `seen === 1`，而不是「`record` 被调用了一次」。前者在重构后仍然有效，后者会锁死实现。

**D5：先补 session 隔离，再写 E2E。** 顺序不能反：全链路用例里「换会话后读回」这一步，依赖的正是当前零覆盖的那条路径；先写 E2E 只会把同一个 bug 测两遍而都测不出来。

## 不做什么

- 不为测试新增生产用开关或测试专用分支。
- 不做快照测试：案例条目里含时间戳与哈希，快照只会制造无意义的 diff 噪音。
- 不把 E2E 写成「跑一遍真实模型」。宿主对话层用假 `chat`，拒答用真实文案样本（取自 `refusal.ts` 的 pattern 命中例）。

## 验证

执行：`bun run test`（`package.json` 里是 `vitest run`）、`bun run check`。

完成判据（按顺序）：

1. `session` 作用域三条用例落地并通过（见 0004 的验证节）；
2. 跨模块文件落地，覆盖 D2 那条链路，且**先故意破坏一次**（例如把 `sessionKey` 改成常量）确认它会红；
3. 全量 `vitest run` 无新增失败。

