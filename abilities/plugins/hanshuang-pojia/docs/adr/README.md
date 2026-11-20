# ADR 索引

决策记录。一篇一个决定，写完不再改结论；要改就新写一篇并交叉引用。

## 编号规则

四位数 + 短横线 + 语义化文件名：`0003-panel-to-host-send-before-edit.md`。四位不省略前导零，编号连续、不复用。

## 清单

| 编号 | 文件 | 一句话 |
|---|---|---|
| 0001 | [injection-modes-effective-surface](./0001-injection-modes-effective-surface.md) | 四种注入模式的真实生效面；目标改为「识别 / 降级 / 不崩」 |
| 0002 | [host-capability-parity-in-retry](./0002-host-capability-parity-in-retry.md) | 续跑决策不持有能力；能力失败回退缓存而非关闭 |
| 0003 | [panel-to-host-send-before-edit](./0003-panel-to-host-send-before-edit.md) | 预览即发送内容；草稿三个出口都必须显式 |
| 0004 | [session-scoped-artifacts-and-storage-usage](./0004-session-scoped-artifacts-and-storage-usage.md) | 三作用域隔离；占用如实报，不估算 |
| 0005 | [deposit-useful-output-into-my-cases](./0005-deposit-useful-output-into-my-cases.md) | 沉淀条目结构、去重口径、「有用」的判据 |
| 0006 | [case-library-test-matrix](./0006-case-library-test-matrix.md) | 6 × 3 测试矩阵；跨模块用例集中一处 |
| 0007 | [plugin-layout-normalization](./0007-plugin-layout-normalization.md) | 目录归属、命名红线、无 mcp.json / runtime-lock.json 的理由 |
| 0008 | [refusal-triggered-requestioning](./0008-refusal-triggered-requestioning.md) | 拒答后只查本工作区「我的案例」选档；与跨模型重试划清界线 |
| 0009 | [startup-and-per-turn-budget](./0009-startup-and-per-turn-budget.md) | 入口分块与每轮预算：语料移出入口、工具表随 lab 收窄 |
| 0011 | [field-precedent-and-hit-rate](./0011-field-precedent-and-hit-rate.md) | field 级先例的落成条件；判断层命中率的度量口径 |
| 0012 | [layout-scroll-and-height-contract](./0012-layout-scroll-and-height-contract.md) | 谁滚、谁不缩、上限多高：三条布局硬契约与对应门禁 |
| 0013 | [activity-stream-correctness](./0013-activity-stream-correctness.md) | 一次调用一行；轮次用分组；状态不上工具名 |
| 0014 | [prompt-library-single-truth](./0014-prompt-library-single-truth.md) | activeId 唯一真相；破坏性动作只留行内武装 |
| 0015 | [selfcheck-settings-reports-audit](./0015-selfcheck-settings-reports-audit.md) | 状态过 t()、索引先建、删除要武装、图标语义一致 |
| 0016 | [forensics-pages-readability](./0016-forensics-pages-readability.md) | 容器性质决定可用属性；统计卡跟着数据走；两种空态 |
| 0017 | [cross-sidebar-consistency](./0017-cross-sidebar-consistency.md) | 七档字号、一种统计列宽、一种焦点色；超长正文只截渲染 |
| 0018 | [probe-actionability](./0018-probe-actionability.md) | 建议必须可执行；重测要能对比；页头只留一个主动作 |
| 0019 | [probe-first-class-and-real-cost](./0019-probe-first-class-and-real-cost.md) | 拒答梯度升为一等公民；卡顿的真实成本在工具表 schema |

## 引用边界

**代码与工程文档不引用决策记录。** 这条是硬约束，理由是两边生命周期不同：

- 契约（`docs/contract/`）与事实表（`docs/reference/`）必须能单独读通 —— 读者不该为了确认「现在是什么样」再跳一份决策；
- 决策会改、会取代、会重写；一旦契约里写「见 0006 第 4 条」，改写决策就等于悄悄改写契约。

因此：决策只在本目录内互相引用；出去的方向不建立。代码注释同理 —— 注释解释**代码为什么这样写**，不把理由寄存到另一个文档里。

## 0008 的检索边界（重点）

「拒答 → 换问法」这件事上，**检索源只有一个**：本工作区的「我的案例」（`workbench/workspaces/<key>/cases.json`）。

| 来源 | 用不用 | 为什么 |
|---|---|---|
| 本工作区「我的案例」 | **用** | 它记录的是这台机器上真实的「这类拒答被哪一档拧过来过」，带 `seen` 与 `lastSeenAt` |
| 随包 `cases/` 先例库 | 不用 | 那是**方法论语料**：回答「这件事怎么做」，不记录成功率，拿来排序等于按主题相近度猜 |
| 别的会话的草稿 | 不用 | `session` 作用域跨会话不可见（0004），能跨会话的只有用户显式沉淀 |
| 别的机器 / 远端 | 不用 | 不做跨机器共享 |

读不到、读坏了都当「没有候选」，退回按次数轮换 —— 检索是纯增益，不是续跑的前提。

## 写作约定

```markdown
# NNNN：一句话结论

- **状态：** 已接受 | 草稿 | 被 NNNN 取代
- **日期：** YYYY-MM-DD
- **背景：** 为什么现在需要这个决定（一句）
- **适用：** 具体文件

## 问题     现象 + 证据（表格优先，数字要能对上代码）
## 决定     D1 / D2 …，每条可单独否决
## 不做什么  反向清单（比正面清单更能防止走偏）
## 验证     现有用例文件名 + 已知缺口
## 关联     上下游 ADR
```

硬要求：

- 每个数字都要能追到代码里的常量，不写「大约」「较多」。
- 「不做什么」不得省略。一篇只有正面清单的 ADR，半年后会被当成「还没做完」。
- 验证节必须区分**已有**与**待补**；把缺口写成缺口，不写成计划。
- 版本号不写进正文当锚点（会漂），需要时引用 `package.json`。
