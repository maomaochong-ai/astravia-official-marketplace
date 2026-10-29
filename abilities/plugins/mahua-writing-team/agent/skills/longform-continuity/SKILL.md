---
name: longform-continuity
description: Keep a hundred-plus-chapter novel coherent — layered summaries, character state cards, foreshadowing ledger health, related-chapter recall, consistency checking and evidence-based chapter review. Use when resuming work after a gap, writing across arcs or volumes, hunting a contradiction, or deciding what to read before drafting. 中文长篇的续写连续性：压缩摘要、人物状态、伏笔体检、事实一致性与证据式评审。
---

# 长篇连续性

这一层管「写到第 80 章还对不对」。管笔法用 `$novel-craft`。

## 每次开工的第一件事

调 `mahua_context`。它是唯一的事实入口，顺序就是阅读顺序：

1. `openThreads` — 到期未收的线索，本文任何写作都要先把它们处理掉或改期；
2. `previous` — 上一章的收尾句，决定语气衔接；
3. `arc` — 当前弧的目标与章号区间；
4. `relatedChapters` — 最多 6 条，带理由（`character` / `thread` / `arc`），按需 `mahua_read_chapter` 回读；
5. `summaries` — 弧/卷摘要，跨弧章节必读；
6. `styleSample` 与 `cast` — 始终在场。

1–4 项不能跳过；5 项只在跨弧/卷时读。

## 三层压缩

章级事实 → 弧摘要 → 卷摘要，只往上压事实，不压情绪。写法与失真的症状见
[node-compressed-graph.md](references/node-compressed-graph.md)。弧关闭时必须有弧摘要，
否则 `mahua_next_instruction` 会继续派 `close-arc`。

## 人物状态

把每个主要角色当子进程维护：欲望、恐惧、立场、账本、已知、位置。
出场必须改变其中至少两项。详见 [process-per-character.md](references/process-per-character.md)。

## 一致性与伏笔

- 事实冲突：`mahua_check_consistency`（确定性检查，只报 code + detail）。
- 伏笔健康：`mahua_check_threads`，五个 code 与处置见 `$novel-craft` 的
  [foreshadowing.md](../novel-craft/references/foreshadowing.md)。
- `unresolvedRate` 超过 0.4 时不要继续往前写，先收账。
- [consistency.md](references/consistency.md) 讲判定边界：
  什么算「同一事实」，什么算「可以不同」。

## 评审

[quantum-auditor.md](references/quantum-auditor.md)：六个复读问题 + 七维举证要求。
`mustFix` 不为空则章节不会被判为 reviewed，指针不前进。

## 硬规矩

- 不改已关闭的弧摘要：要改就在下一弧起点交代。
- 不为了「通关」把 `mustFix` 清空——`mahua_save_review` 的分数与 mustFix 是门禁的输入。
- 下一步以 `mahua_next_instruction` 为准；它返回 `null` 就是「停下来等人」。
