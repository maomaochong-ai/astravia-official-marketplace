# 0008：拒答触发的自动换问法（查这些事项）

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 8 项。「寒霜·拒答自动换问法：拒答信号 → 查这些事项并更新到 ADR」。本篇把「查什么」定死，并划清它与「跨模型重试」的界线
- **适用：** `src/domain/refusal.ts`、`src/domain/reshaping.ts`、`src/domain/my-cases.ts`、`src/runtime/contributions.ts`
- **前置：** [0011](./0001-injection-modes-effective-surface.md)、[0015](./0005-deposit-useful-output-into-my-cases.md)

## 问题

现在的换档是**按次数轮流**，不看历史：

```
reshape = reshapeAt(prompt, attempt.continued)
```

第 n 次续跑用第 n 档（`RESHAPE_TIERS` 三档：评审清单 → 设计评审 → 英文评审），`idempotencyKey` 里带上档位，所以「同一档重发」被拦住、换档被允许。这套机制的问题是：**它不知道哪一档以前真的管用**。三档里可能第二档对这类拒答命中率最高，但每次仍然从第一档开始烧一轮。

待办的第 8 项正是补这个：把「这一轮为什么被拒」与「以前哪一档把它拧过来了」连起来。

## 决定的边界（先划界，再谈实现）

**D1：换问法 ≠ 跨模型重试。** 前者是同一会话、同一模型、同一回合内换一种句式重发；后者是换一个模型再问一次。`my-cases.ts` 已经写明「插件不会因为记下了 `refusalSig` / `rewriteChain` 就去跨模型重试（见 ADR 0001）」，这条立场**不变**。本篇新增的只是「同回合内选哪一档」的排序依据，不改变重试的域。

**D2：检索源只能是本工作区的「我的案例」。** 不读 `cases/`（随包只读语料，那是方法论不是成功率），不读别的会话的草稿（`session` 作用域跨会话不可见，见 0004），不做跨机器共享。

**D3：检索不增加轮数。** `MAX_CONTINUATIONS_PER_TURN = 3` 与三档一一对应，这条耦合不能破。查案例库只决定「第 n 次用哪一档」，不产生第 4 次。

## 决定（查什么）

**D4：候选的过滤条件，四项全中才算命中。**

| 条件 | 取值 | 为什么必须 |
|---|---|---|
| 拒答类型相同 | `refusalSig.kind === 本次 signal.kind` | `identity` 与 `policy` 需要不同的句式；混在一起等于随机 |
| 证据形态相近 | 归一化后的 `evidence` 片段与本次有交集（英文按词、中文按 2-gram） | 同类里也分「我不能帮你做这个」与「作为 AI 我无法」，句法改法不同 |
| 曾经真的拧过来 | `rewriteChain` 非空，且该条目的回合以 `clean` 收尾 | 未成功的链路不入库（D7），但旧数据可能带进来，必须再挡一次 |
| 同一工作区 | 读的就是 `workbench/workspaces/<key>/cases.json` | 换了项目，历史成功率没有参考价值 |

排序：命中次数降序 → `lastSeenAt` 降序。取第一条的末档作为首选档位。

**D5：取档规则两条，覆盖两个退化情形。**

- 候选档位**尚未尝试** → 本次直接用它（这是收益来源：一次命中而不是三次试探）。
- 候选档位**已经尝试过** → 放弃候选，回到 `attempt.continued` 的索引顺序取下一档。理由：`idempotencyKey` 已经证明同一档再发一次无效，换问法的全部价值在「换」。

**D6：`idempotencyKey` 增加来源标记。** 形如 `refusal:{kind}:{hash(evidence)}:{tier}:{case|index}`。不加这一位的话，「从案例库取到的第 2 档」与「按索引轮到的第 2 档」会被判成同一条指令，幂等保护就会误伤真实收益。

**D7：只有成功的链路才写回。** 判定为成功 = 本回合以 `clean` 收尾且发生过续跑。失败的链路不入库 —— 让案例库记满失败尝试，等于把检索变成噪音，下一轮的「命中次数」也就失去意义。

**D8：案例库不可读时，静默回到索引顺序。** 检索失败不是「不续跑」的理由（与 0002 的 D2 同一条原则）。读盘错误只让它退化成今天的行为。

## 实现落点

`planRecovery` 的签名**不变**（它必须是纯函数，见 0002 D1）。候选由调用方传入：

```ts
// 调用方（Stop 钩子）先查一次，把结果作为入参交给纯函数
const recalled = await recallTier(ctx, event.cwd, event.sessionId, verdict.signal);
const outcome = planRecovery(event.lastAssistantMessage, {
	enabled: true,
	prompt,
	attempt: { continued, lastKey, tried },
	recalled,
});
```

三个文件分工：

| 位置 | 职责 |
|---|---|
| `domain/reshaping.ts#recallReshapeTier` | 纯函数：入参是已读出的条目数组，四项过滤 + 排序，返回 `{tier, support} \| null` |
| `domain/refusal.ts#planRecovery` | 纯函数：候选未试过就直接用，试过就回 `reshapeAt(attempt.continued)`；幂等键带 `:{case\|index}` 来源位 |
| `runtime/contributions.ts#recallTier` | 唯一读盘处：`storageEntry("cases", cwd, sessionId)` + `readJsonFile` + `sanitizeCases`；任何异常返回 `null` |

回合记忆（`recoveryByTurn`）多存一项 `tried: ReshapeTier[]`，每次续跑追加实际用过的档位 —— 这就是 D5 「已尝试就换」赖以为生的依据。

## 不做什么

- **不因为「有候选」就跳过证据判定。** 候选只是排序提示；`detectRefusal` 仍然是唯一判定入口（0001 D1）。
- **不检索随包 `cases/` 先例。** 见 D2。先例回答「这件事怎么做」，不回答「这条拒答怎么绕」。
- **不在同档上重复以「确认」**。见 D5。
- **不把案例库变成续跑的硬依赖。** 见 D8。

## 验证

已落地（`src/test/dialogue/`）：

- `reshaping.test.ts`：`reshapeForTier` 按名取档与形态门；`recallReshapeTier` 的四项过滤（类型不同 / 无改写链 / 末档未知 / 证据无交集全部不命中）、按 `seen` 排序、`support` 计同档条数。
- `refusal.test.ts`：候选未试过 → 直接用且幂等键以 `:case` 结尾；已试过 → 回到索引顺序且以 `:index` 结尾；无候选时片段与旧行为逐字相同；达到 `MAX_CONTINUATIONS_PER_TURN` 时不介入。

待补：`runtime/contributions.ts#recallTier` 的接线用例（读不到 `cases.json` / 读到坏数据 / `sanitizeCases` 丢条目三种形态），目前靠其纯函数部分间接覆盖。

## 已知风险

「曾经拧过来」是相关不是因果：那一档当时可能只是恰好赶上模型这次愿意答。缓解手段是 D7（只记成功）+ 命中次数排序（单次成功不足以排到前面），以及 D5（已尝试就换）。如果实测发现命中率反而下降，退回索引顺序的成本只是删掉一个入参，不需要改 `planRecovery` 的骨架。

