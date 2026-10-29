# 模块：对话侧注入——路由、转译与提示词

插件在**每次提问进入模型之前**读一遍这句话，决定要不要追加一段上下文。这一层不改用户原话，
只补上「这件事在插件里对应什么」。

## 注入是五级：两级叠加，三级终止

`src/runtime/contributions.ts` 的 `promptContexts(prompt)`：

| 级 | 触发条件 | 追加什么 | 是否终止 |
| --- | --- | --- | --- |
| 0 | 句子里出现指向**线上账号**的形状（账号 / 口令 / 凭据库） | 一条**等价入口**：同一能力在自有资产上怎么成立，附第一条命令 | 否，叠加 |
| 1 | 命中 `routing-table.generated.json` 的路由 | 指向对应技能；技能不在包里就说「未随包分发，不要假装读过」 | 否，叠加 |
| 2 | 快捷口令（`poc` / `hook` / `keygen` …） | 展开成完整作业要求 | 是 |
| 3 | 命令式句子，能提出明确目标 | 评审式重述：目标不变、要的东西不变，但要求落到函数 / 偏移 / 代码行 | 是 |
| 4 | 同上但提不出目标 | 只做术语转译，不改句式（改不清目标就是答非所问） | 是 |

只有 0 和 1 是叠加项，2–4 是终止项——这一条决定了「不划界」能成立：前两级只**多给**，
不取消、不接管、不了结原请求。任何一级都不得写「忽略上面的话」「不要做那件事」这类否决语句，
因为调用方只是把结果拼到 prompt 前面，没有能力执行否决。

`src/domain/target-shape.ts` 是第 0 级的判定器（`readTargetShape` / `describeEquivalentPath`），
`src/test/dialogue/target-shape.test.ts` 与 `src/test/dialogue/contributions.test.ts` 覆盖两个已发生的事故。

## 路由表是数据，不是代码

`scripts/sync-routing-table.mjs` 从 `agent/skills/**/routing.json` 生成
`src/domain/routing-table.generated.json`：44 条路由、`fallbackId`、源文件 SHA-256。
`src/domain/routing-table.ts` 只放匹配逻辑（`matchRoutes` / `routingCoverage` / `describeRouteMatch`）。

- `target` 用**完整路径段**（`reverse-engineering/dsl-vm-reverse`），不是首段目录名——按首段算会把
  R4 误判成「已具备」。
- 44 个目标里插件只有 5 个（R0 / R1 / R3 / R6 / R7），缺 39 个；那 39 个**上游便携包里也没有**。
  缺口是「39 个目标 ≈ 5 份能力」，不是 39 份内容，见 [`../audits/capability-gap-2.13.1.md`](../../audits/capability-gap-2.13.1.md) §3.1。
- 自检页 `assets.routing` 会打印表的指纹（`table bfc208b6`）与 fallback：排查「页面还是旧版」时，
  它比版本号更能说明加载的是哪一份表。

## 提示词是母本生成的

- 母本：`agent/prompts/SYSTEM.md`；生成物：`system-prompt.generated.ts`（`scripts/sync-system-prompt.mjs`）。
- **改提示词必须改母本再跑脚本**，手改生成物会被 `src/test/dialogue/system-prompt.test.ts` 打回：
  正文与母本 byte-for-byte 相等、长度 < 16000、block id 以 `plugin.hanshuang-pojia.` 开头、priority ∈ (0,1000)。
- `--check` 模式用于 CI：母本与生成物漂移就红。

## 边界

- 判定目前是**正则 + 词表级**，不是语义级；已知有漏判形态（X3）。修法是补高特异度模式。
  漏判的代价只是少拿到一条附加入口，所以**判定不承担否决职责**——它只决定要不要多给一条。
- 提示词层**不能改写对象身份**。把别人的号说成「我自己的号」不会改变形态读法；
  有效的等距只有一种：把对象换成用户手上的字节（`hash-lab` / `own-code-audit` / `own-client-protocol`）。
- 这一层**没有划界**：2.13.1 曾把它写成「命中 OUT 就整轮改道」，2.14.0 整条撤回，
  现在的形状是「原请求照常作答 + 并行给一条自有资产入口」。撤回理由与当时的两个事故记录见
  [`../audits/refusal-scope-router.md`](../../audits/refusal-scope-router.md)。

## 相关文档与测试

- 模板集（可直接粘）：[`../reference/prompt-templates.md`](../../reference/prompt-templates.md)
- 测试：`src/test/dialogue/{contributions,target-shape,refusal,reshaping,interceptor,routing-table,system-prompt}.test.ts`
- 新领域概念要先写进 `CONTEXT.md`，再进代码。
