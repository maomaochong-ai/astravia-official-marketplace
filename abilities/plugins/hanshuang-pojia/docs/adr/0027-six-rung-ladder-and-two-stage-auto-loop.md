# 0027：六档梯度（按先例库的方法步骤）+ 两阶段自动闭环

- **状态：** 已接受
- **日期：** 2026-11-22
- **背景：** 用户反馈「挡位太少」，并希望自动闭环更强（拒绝 → 自动派梯度 → 回表 → 每档可编辑改写 → 一键重测），同时保留手动分析。ADR 0026 只做了第一阶段（建表）。本轮把梯度扩到六档并接上第二阶段。
- **适用：** `domain/probe-ladder.ts`、`domain/auto-probe.ts`、`runtime/contributions.ts`、`components/prompts/probe-refusal-card.tsx`

## 一、六档从哪来（不是拍的）

先例库 `cases/*/docs/method.md` 是一套已经验证过作业顺序的方法。梯度直接采用它的推进顺序，于是**任何一档被拒时，读者能立刻知道卡在方法的哪一步**：

| 档 | 方法步骤 | 先例出处 |
| --- | --- | --- |
| 1 | 找判定，不找词（术语 → 决策函数） | `client-auth-gate` §1 |
| 2 | 判定的三种形态（布尔字段 / 校验产物 / 时间） | `client-auth-gate` §1 |
| 3 | 调用者与可达性（排除死代码） | `client-auth-gate` §1、`native-islicensed-patch` §3 |
| 4 | 先观测再动手（observe-mode 方案） | `client-auth-gate` §2 |
| 5 | 严重性两问（服务端是否复核 / 客户端状态是否上传 → BFLA） | `client-auth-gate` §4 |
| 6 | 判定与最小修复（证明方式 + 报告三部分） | `client-auth-gate` §3 §5 |

档位名六类共用（都是方法步骤），句子按类别换：`web` 问权益分层、`api` 问 BOLA/BFLA、`app` 问本地校验与调用者、`file` 问容器与可执行面、`generic` 是兜底。**每一档都点名目标**，这是「挡位都不适用」的根治。

句式仍按档位轮转，六档六个不同形状（`boundary / evidence / policy / review / contrast / english`），相邻不重复——`probe-ladder.test.ts` 直接断言 `new Set(labels).size === 6`。

## 二、两阶段自动闭环

```
拒绝
 └─ 第 1 阶段：建表（ADR 0026）── 六档原句 → probe_refusal(gradient: [...])
     └─ 第 2 阶段：换句式重测（本 ADR）── 被拦档 → rungRewrite(text, level+1)
```

第 2 阶段的判据（`planAutoRetest`）：

| 情况 | 行为 |
| --- | --- |
| 有 `refused` 档 | 取最多 3 档，为每档换**下一个句式**，要求各调一次 `probe_refusal`（不合并） |
| 只有 `filtered` / `empty` | 不重测——链路问题，换句式无效（ADR 0021 的依据不变） |
| 没有记录 / 读不到 | 不重测，不猜 |
| 已用过预算 | 不重测 |

预算：`autoProbed` 是**总次数**，上限 2（建表 1 + 重测 1）。与改写链的 `MAX_CONTINUATIONS_PER_TURN = 3` 分开计数，互不挤占。

## 三、手动这条路也要跟得上

自动不等于关掉手动：面板上的三件事全部保留并加强——
- 每档独立展开、**可编辑改写**、单独「发送去重测」；
- 措施区新增**「全部重测」**：一次把最多 3 个被拦档的改写发出去（与自动第二阶段同一份文本）；
- 「交给对话继续分析」固定在卡片底部（ADR 0026 之后的位置不变）。

自动与手动用的是同一批函数（`rungRewrite` / `buildProbeBrief`），所以两条路的结论可比。

## 不做什么

- **不无限重测。** 一轮就够回答「换句式有没有用」；再换只是把同一件事重说。
- **不为 `filtered` 生成改写。** 那会让人以为「再改改就能过」。
- **不让自动流程写 `probe.json`。** 写盘仍只有 `probe_refusal` 一个入口。
- **不把六档都设成必测。** `probe_refusal` 单次最多 6 条请求，六档正好一次跑完；`level` 仍可截断。

## 验证

| 用例 | 钉住什么 |
| --- | --- |
| `src/test/workbench/probe-ladder.test.ts`（8 条） | 六档、每档点名目标、六种句式且相邻不重复、`probesForClass` 截断、无目标不崩 |
| `src/test/workbench/auto-probe.test.ts`（7 条） | 第一阶段片段含六档**完整句子**（此前只列了标题，agent 无从执行）、要求 `<probe-report>`、带模型、节流、静默拦截不派 |
| `src/test/workbench/auto-retest.test.ts`（8 条） | 只重测 `refused`、上限 3 档、句式必须换、预算 2、无记录不猜、每档保留自己的目标 |
| `src/test/workbench/type-scale.test.ts` | 新增按钮没有引入第八档字号 |
| `node scripts/report-unused-locale.mjs zh.json --strict` | 1052 键 0 未用 |

## 关联

- 0021：措施留档与「过滤/空正文不算句式问题」
- 0024 / 0025：目标感知改写、按类别生成梯度
- 0026：第一阶段（拒绝后自动建表）——本 ADR 是它的续篇
