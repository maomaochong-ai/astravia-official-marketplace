# ADR 0001：把 ainovel-cli 的「确定性 Engine + 三 Worker + 按需 Arbiter」移植为插件领域层

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright`（插件 0.0.1）
- 参照对象：[`ainovel-cli`](../../../../../github-source-code/ainovel-cli)（Go CLI，`docs/architecture.md`）
- 工程参照：[`open-astravia/packages/agent-team`](../../../../../open-astravia/packages/agent-team)

## 1. 背景

`ainovel-cli` 的控制面是一条三分法纪律：**可枚举的状态迁移交给代码**（`flow.Route` 纯函数 +
穷举规格测试），**边界清晰的语义判断交给 LLM 函数**（Arbiter，事实进、结构化决策出、落盘可回放），
**开放式创作交给 LLM 循环**（Architect / Writer / Editor 三个 Worker）。三者之上是一个串行
确定性 Engine，它每轮从 Store 读事实、路由、程序化运行 Worker。

插件运行在宿主渲染进程里，没有 Go runtime、没有长驻进程、也不允许自己起子进程。直接搬运
Engine 的循环体是不可能的。但**三分法本身与运行时无关**：它区分的是「决策的性质」，不是
「代码跑在哪里」。

## 2. 决策

Novelwright 只移植三分法的**形状**，不移植 Engine 的**循环**：

| 上游概念 | 插件落点 | 谁在跑这个循环 |
| --- | --- | --- |
| `flow.LoadState` / `flow.Route` | `src/domain/novel-flow.ts` 的纯函数 `routeNovel(state)` | 代码。输入是自 Plugin Storage 读出的 `NovelState`，输出 `Instruction \| null`；无 IO、无时钟、无随机 |
| Engine 的「读状态 → 路由 → 运行 Worker」 | `novelwright_next_instruction` 与写章 / 评章 / 收章三个工具 | 宿主 agent 对话循环。一次工具调用推进一格，人随时可插话 |
| Architect / Writer / Editor 三个 Worker | `plugin.json#agent.agents` 三个智能体 + 一支团队（见 ADR 0002） | 宿主的智能体运行时 |
| `arbiter.Decide*` | `novelwright_arbitrate`（枚举化的三个裁定场景） | 显式调用，一次一裁；裁定记录写进作品的 `decisions.jsonl` 等价结构 |
| `Progress` / `Checkpoint` / `Artifact` | 单一 `books/<bookId>.json` 的 `progress` / `checkpoints` / `chapters` 段（见 ADR 0005） | 插件自己的仓储层 |

三条硬规则：

1. **路由必须是纯函数。** `routeNovel` 不读文件、不取当前时间、不调模型。全部事实由调用方组装
   成入参，因此可以像上游一样用组合穷举测试钉死（`test/novel-flow.test.ts`）。
2. **工具只返事实，不返回跨调度指令。** 与上游「铁律一」一致：`novelwright_commit_chapter` 返回
   `{ committed, arcClosed, nextPhase }` 这类结构化字段，绝不夹带「接下来请调用 X」的字符串。
   下一步永远由 `routeNovel` 算出，而不是由上一个工具口述。
3. **不引入工作流引擎。** 不用 XState、不用自造 Task/WorkflowInstance 抽象。阶段是一个
   `Phase` 联合类型加一张转移表；过度建模的代价是每加一个阶段都要动三处。

## 3. 领域语言

词汇表不放 ADR，放插件包根：[`abilities/plugins/novelwright/CONTEXT.md`](../../../abilities/plugins/novelwright/CONTEXT.md)。

理由有两条，都与「ADR 记决策」的定位有关：

1. **它是随代码演进的工作约定，不是一次性的决策。** 加一个字段就可能改一个词的边界，改词不该每次都新开
   一份 ADR；而 `CONTEXT.md` 跟着包走，谁改领域层谁顺手改它。
2. **它是这个能力私有的。** 本源是**多能力仓库**，13 个插件各有自己的语言；根级或 ADR 级词汇表会把
   「章」「弧」写成全仓通用词，反而制造歧义。宿主读取插件包时也只认包内文件。

`CONTEXT.md` 用中英双语列词、定义和**不使用的同义词**（`Book` 不用 Project、`Arc` 不用 Chapter group 一类），
目的很具体：让 `src/domain/*.ts` 的标识符、工具描述和评审文案共用一套词，避免同一个东西在三个地方三个叫法。

唯一需要写进本 ADR 的语言决策是**阶段里没有 `reviewing`**：评审是 `drafting` 内的一次写（`save_review`），
结论直接决定下一相（通过留 `drafting`，不通过转 `revising`）。独立成相会造出一个「没有下一步可路由」的空档，
反而让路由函数需要额外分支，与「可枚举迁移」的初衷相反。

## 4. 后果

- 路由与阶段转移是**可测的**：不需要模型、不需要磁盘，1 秒内跑完全部组合。
- 与上游行为对等的部分有明确边界：**上游有、插件没有**的是「一次启动跑完 500 章」的自主循环。
  插件里每次推进是一轮对话内的一次工具调用，人可以看到每一步并中途改主意。这是刻意的取舍：
  在插件形态下，可中断比全自动更值钱。
- 上游新增阶段时，本插件不会自动跟进。迁移成本集中在一张转移表 + 一份组合测试，是有界的。
