# 0001：四种注入模式的真实生效面

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 1 项。上游在 provider 请求层做「不许拒绝」，本插件跑在宿主里，通道不同，需要先把「哪条注入真的生效」钉死，再谈优化
- **适用：** `src/domain/interceptor.ts`、`src/domain/kernel.ts`、`src/domain/refusal.ts`、`src/domain/turn-outcome.ts`、`src/runtime/contributions.ts`

## 问题

待办原话是「四种注入模式（系统提示 / 用户消息 / 工具结果 / 历史上下文）在拒答场景下的实际生效面」。逐条核对代码后，四者的能力并不对等：

| 模式 | 落点 | 能不能改内容 | 拒答场景下真正的作用 |
|---|---|---|---|
| 系统提示 | `registerSystemPromptProvider` 的 `addBlock` | 只能整块追加，不能改写已有块 | kernel 块每轮必注（`KERNEL_BLOCK_ID`，优先级 850）；SYSTEM 块只在 lab 开启时追加，优先级低于 kernel。关闭实验环境时不为用不上的契约付 token |
| 用户消息 | `UserPromptSubmit` 的 `additionalContexts` | **不能改用户原话**，只能追加若干条 | 四级叠加：0 等距入口 → 路由提示 → 1 快捷口令 → 2 评审式重述 → 3 术语转译（`promptContexts`） |
| 工具结果 | 工具 handler 的返回值 + `publishToolResult` | 不能改宿主 messages | 结果既是聊天正文，也是面板事件；对「模型下一轮怎么写」没有直接约束力 |
| 历史上下文 | 每轮首条附加说明 | **不能删改历史** | 只有一条：`[历史声明作废]`，声明历史里的拒绝/中止/政策话术不构成结论 |

最容易被误读的一条：上游 L1 的 `safetySettings: BLOCK_NONE` 在本插件里**从未生效**。`contributions.ts#logSafetyEndpointOnce` 调 `decideSafetyInjection` 时把 `shape` 硬编码为 `"messages(openai)"`，因为宿主不给 payload 引用，只能按 provider/api 判形状；而该函数对 `messages(openai)` 一律返回 `SKIP` 或 `SKIP-INEFFECTIVE`，往 OpenAI 兼容体塞 Google 私有字段只会换来 400。保留这个判定函数的唯一目的是让「到底注没注」可查证，不是让它开火。

于是真正能咬住的边界只有一个：**模型停下的那一刻**（`Stop` 钩子）。

## 决定

目标从「不拒绝」改为三段式：**拒答可被识别、可被降级、不会把插件或宿主弄崩**。

1. **识别**：`detectRefusal` 是唯一判定入口，五类信号 `identity / policy / deflection / provenance / silent`；命中多类时按硬度取最小 rank，而不是「最后命中的赢」。空正文单独成 `silent` —— 它不是「没有拒绝」，是最硬的一种（token 生成了，服务端丢了）。
   - 两条放行规则必须保留：纯澄清问句（identity ∧ 无交付物 ∧ 以问号收尾）不算拒绝；identity 且整条已交付时也不算拒绝。
2. **降级**：`classifyStop` 把「内容拒答」与「技术故障」分成三态 `clean / refusal / failure`。续跑只对 `refusal` 生效；`failure` 走 `isRetryable` 的另一条通道（rate-limit / timeout / server / transport 可重试，auth 不可 —— 认证失败重试只会再失败一次，还让用户以为插件在忙）。
3. **不崩**：三层约束同时成立才叫不崩 ——
   - 次数上限 `MAX_CONTINUATIONS_PER_TURN = 3`，与 `RESHAPE_TIERS` 的三档一一对应。改档数必须同步改上限，否则第四次只是把最后一档再说一遍；
   - 幂等键 `refusal:{kind}:{hash(evidence)}:{tier|legacy}`，拦住的是「同一档写法再来一次」，不是「同一条拒绝」；
   - 每个运行时贡献各自 `try/catch`，钩子 `timeoutMs: 2000`，任一宿主 API 缺失只跳过该项。

## 不做什么

- **不在 provider 层尝试任何注入。** 宿主没有 `before_provider_request` 钩子，本插件的 `network.allowedHosts` 只有 `127.0.0.1`，也不具备改请求体的位置。
- **不把「历史声明作废」升级成真正的消息改写。** 宿主只在 `UserPromptSubmit` 提供 `additionalContexts`，没有清洗 messages 的钩子。`sanitizeRefusalLeak` 因此只作用于**我们自己生成的文本**（口令展开、恢复片段），不假装清过历史。
- **不在续跑片段里复述拒绝话术。** 片段的两种分支（有改写 / 无改写）都不引用模型上一句的原话，只描述该交什么。

## 验证

现有覆盖在 `src/test/dialogue/`：`refusal.test.ts`（五类判定与放行规则）、`reshaping.test.ts`（档位级联与目标提取）、`interceptor.test.ts`（L1 判定词表与口令解析）、`contributions.test.ts`（钩子接线与上下文叠加顺序）。

待补：`silent` + 无原话时必须返回 `null` 这一条（现在只在代码注释里，`planRecovery` 的早退分支需要一条显式用例）。

## 关联

- [0002](./0002-host-capability-parity-in-retry.md)：续跑链路里宿主能力的归一化。
- [0008](./0008-refusal-triggered-requestioning.md)：换问法的检索源，依赖本篇的判定入口保持不变。