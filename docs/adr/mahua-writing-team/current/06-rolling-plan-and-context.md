# 06 · 长篇滚动与上下文

> 现行文本。归并自 [0021](../0021-thread-ledger-related-chapters-context.md)。

## 一句话

写第 N 章时只喂真正需要的：本弧目标、上一章末句、开着的伏笔、相关旧章；其余靠压缩摘要。

## 现行规矩

1. **上下文包是算出来的，不是攒出来的**。`mahua_context` 每次现算：阶段、地基、卡司、
   当前弧目标、上一章末句、未处理反馈。不维护「对话记忆」。
2. **伏笔有台账**：`threads/<id>.json`，每条记「埋在哪章、该在哪章回收、轻重三级」。
   `weight` 决定它多频繁地浮上来，`dueIn` 决定什么时候算逾期。
3. **体检是纯函数**：`checkThreads` 报逾期未收、埋在未写章、收了没闭合、措辞重复，
   并给出未回收率。不猜，不排名。
4. **相关章节推荐**从伏笔与人物交集算，不做向量检索。可解释比召回率重要——
   作者要能看懂「为什么给我看这一章」。
5. **摘要分层**：章有评审、弧有小结、卷有小结。跨卷续写先读卷小结，再读当前弧，
   不重读全书。
6. **一致性检查只在能确证时报警**：章落在所有弧之外、人物不在卡司里、弧范围重叠、
   对已提交章再改。四条都可枚举，因此不引入模糊判断。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 台账与体检 | `src/domain/thread-ledger.ts`、`src/tools/ledger-tools.ts` |
| 上下文包 | `src/domain/context-pack.ts`、`studio-service.ts` 的 `contextPack` |
| 一致性 | `src/domain/consistency-checks.ts` |
| 风格基线 | `src/domain/style-analysis.ts` |
| 弧 / 卷小结 | `src/tools/outline-tools.ts` 的 `save_arc_summary` / `save_volume_summary` |

## 代价与边界

- 不做向量库：长到几百章时「相关章节」召回不如检索，但**可解释**优先。
  真需要时再谈，不提前引依赖。
- 未回收率是个数字，不是判决。它提醒作者，不阻断提交。
- 摘要由智能体写、落盘存储，不由代码生成——代码生成摘要会变成模板。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run   # 台账与一致性用例在整套里，关键词 threads / consistency
```
