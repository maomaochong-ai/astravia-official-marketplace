# 0021 — 补三处能力缺口：伏笔台账、相关章节推荐、自适应上下文

- 状态：已接受（2026-10-29）
- 相关：ADR 0005（存储布局）、ADR 0007（工具面与门禁）、ADR 0022（对齐总表）

## 背景

把 `ainovel-cli` 的包与 `novel-master` 的阶段逐一对照本插件之后，剩三处是真缺口，不是「还没轮到」：

1. **伏笔没有台账**。`ainovel-cli` 的 Writer 每章都从「伏笔」维度推荐相关章节，
   `novel-master` 把伏笔管理列为五阶段之一（登记、轻重分级、回收检查、未回收率预警）。
   本插件的 `ChapterFacts` 只记「谁出场 / 首句 / 末句」，`Chapter` 上没有「埋了什么、该在哪收」。
   七维评审里的「continuity」维度因此只能靠模型记忆，越写越飘。
2. **上下文只给前一章**。`buildContext()` 给 Writer 的是：基础设定、演员表、当前弧、**最后一章**的收尾句、
   未关闭的反馈、文风样本。写到第 60 章时，第 12 章埋的东西不在它眼前。
3. **弧/卷摘要写了没人读**。`saveArcSummary` / `saveVolumeSummary` 把摘要存进 `book.summaries`，
   但 `buildContext()` 不读它们——长篇的「分层摘要」等于只写不用。

## 决策

### 1. 伏笔台账：独立文件，不改 `NovelBook` 的 schema

新文件 `threads/<bookId>.json`，与 `decisions/<bookId>.jsonl` 同级：

```json
[
  { "id": "t1", "content": "父亲留下的怀表从未走针", "plantedIn": 3, "dueIn": 18,
    "weight": "heavy", "status": "open", "closedIn": null }
]
```

- `weight` 分 `light` / `medium` / `heavy` 三档，与 novel-master 的浅/中/重三层伏笔一一对应（层数不只是命名：
  它决定一个伏笔该被提到几次、能不能用日常细节隐藏）；
- `status` 只有 `open` / `closed`，
- `id` 由服务层按 `t<n>` 递增分配，不由模型编。

**为什么不放进 `book.json`**：那要改 `schemaVersion` 并写迁移；台账是「写的时候才看的账本」，
与作品本体（阶段、进度、章状态）不是一类事实。放在 `decisions/` 旁边，读写边界清楚，
旧书没有这个文件就是空台账，不需要迁移。

### 2. 三个工具（工具面 33 → 36，门禁 22 → 24）

| 工具 | 类别 | 输入 | 输出 |
| --- | --- | --- | --- |
| `mahua_flag_thread` | 写（进门禁） | `bookId?`, `content`, `plantedIn`, `dueIn`, `weight` | `{ thread, threads }` |
| `mahua_check_threads` | 读（无门禁） | `bookId?` | `{ findings, open, overdue, unresolvedRate }` |
| `mahua_close_thread` | 写（进门禁） | `bookId?`, `id`, `chapter` | `{ thread, threads }` |

回收必须是独立的一次写：埋点与回收往往相隔几十章、在不同会话里发生，让作者拿一份整台账回写
等于每次都要重传全量，也多一次覆盖别人改动的机会。`closeThread` 只换一笔的 `status`/`closedIn`，
找不到报 `thread.not-found`、已关报 `thread.already-closed`（ADR 0021 §2 的错误码也在领域层）。

`check_threads` 的每条 finding 只给 code + detail（领域层不出自然语言）：

| code | 判据 |
| --- | --- |
| `thread.plantedInFuture` | `plantedIn` 大于已提交的最大章号——埋点还没写到，记账记早了 |
| `thread.dueBeforePlanted` | `dueIn <= plantedIn` |
| `thread.overdue` | 仍 open，且 `dueIn` 小于已提交的最大章号（到期未收） |
| `thread.closedWithoutChapter` | `status: closed` 但 `closedIn` 为空或大于已提交最大章号 |
| `thread.duplicateContent` | 同一本书里两笔台账 `content` 相同（去掉首尾空白后比较） |

未回收率 = `open` 数 / 总数，返回一个 0–1 的数，**不在领域层做「>5% 就报警」的判断**——
阈值是产品策略，由工具描述与技能文本告诉模型怎么看这个数。

### 3. 上下文包扩三项

`ContextPack` 增加：

```ts
openThreads: Thread[];                       // 只给 open，按 dueIn 升序
relatedChapters: { n: number; title: string; reason: "character" | "thread" | "arc" }[];
summaries: { arcs: ArcSummary[]; volumes: VolumeSummary[] };
```

`relatedChapters` 是纯函数（`related-chapters.ts`）：取最近 40 章内的已提交章，
按三条可判定的理由排序，**同一理由只取最靠后的两章**，总共最多 6 条：

1. `character`：该章 `facts.characters` 与当前章出场角色（`book.cast` 里出现在当前章纲/前情中的名字）有交集；
2. `thread`：该章是某条 open 台账的 `plantedIn`；
3. `arc`：该章与当前章同弧且是最靠后的两章。

「相关」不等于「相似」：只给理由标签与章号，让模型自己决定要不要回读（回读走 `mahua_read_chapter`）。

`summaries` 直接透传已有数据，不生成新摘要——生成摘要要有模型参与，那是工具调用方的事。

### 4. 门禁与守卫

- `mahua_flag_thread` 必须加进 `GATED_TOOL_IDS`（22 → 23），`test/manifest-guards.test.ts` 的
  「每个写工具都在 gated 集合里」断言会盯着；
- 台账写入走 `StudioService`（`flagThread`），与其余写操作同一条路径、同一个 `revision`；
- `thread.*` 五个 code 只出现在源码里，不进 locales（与 `consistency.*` 一致：findings 以 code 交给模型）。

## 后果

- `manuscript-repository.ts` 增 `readThreads` / `writeThreads`，`SaveBundle` 增可选的 `threads`；
  写台账与写书在**同一次 commit** 里，不会出现「书推进了、台账没跟上」。
- `mahua_context` 的返回体变大：多三条数组。旧调用方只读它认识的字段，不会破。
- 相关章节推荐不做向量、不做 LLM：只有三条判据，写错了能一眼看出来，这是刻意的。
- 明确不做：角色档案（`cast` 仍只是名字列表）、伏笔的「暗示次数」统计、跨书伏笔。
  前两项需要新增章节级标注或模型抽句，成本高于收益；第三项超出单书模型。
