---
name: novel-craft
description: Chinese long-form fiction craft — scene construction, dramatic shape, character voice (cognitive-bias packs), foreshadowing, banned-word hygiene, genre arc templates, dialogue and hooks. Use when planning an arc, planning or drafting a chapter, fixing weak scenes or flat dialogue, choosing genre conventions, or auditing a draft before review. 中文长篇的画面、结构、人物、伏笔与文风手艺。
---

# 写作手艺

这一层管「怎么写得好」。要管「写到哪了、下一步该干嘛」，用 `$longform-continuity`。

## 什么时候进来

- 用户给了题材/一句话需求，要出大纲或卷弧结构；
- 要写或改一章正文，需要场景设计与对话判断；
- 评审说「节奏慢」「人物扁平」「没钩子」，要找出具体改法；
- 要选文风、定禁用词、定人物声音。

## 顺序

1. 定结构：[plot-structures.md](references/plot-structures.md) 选骨架，[dramaturgy.md](references/dramaturgy.md) 校比例。
2. 定章纲：`mahua_plan_chapter`，goal / conflict / hook 三句话；场景安排看
   [scene-writing.md](references/scene-writing.md)。模板见 [outline-template.md](references/outline-template.md)、
   [chapter-template.md](references/chapter-template.md)。
3. 定人物：档案看 [character-building.md](references/character-building.md) 与
   [character-template.md](references/character-template.md)；把每个人分开靠
   [cognitive-bias.md](references/cognitive-bias.md) 的五个槽位。
4. 写正文：对话看 [dialogue-writing.md](references/dialogue-writing.md) 与
   [differentiation.md](references/differentiation.md)；语气与叙述看 [anti-ai-tone.md](references/anti-ai-tone.md)；
   传统笔法看 [classic-writing-books.md](references/classic-writing-books.md)。
5. 埋/收线索：[foreshadowing.md](references/foreshadowing.md)，并用 `mahua_flag_thread` 记账。
6. 交章前：[banned-words.md](references/banned-words.md) 的十项自检 +
   [quality-checklist.md](references/quality-checklist.md)。
7. 章末钩子：[hook-techniques.md](references/hook-techniques.md)；字数不够不要灌景，看
   [content-expansion.md](references/content-expansion.md)。

写不动的时候先回第 1 步，不要在第 4 步硬磨句子。

## 题材

按已选的题材读 `references/genres/<genre>/`：`arc-templates.md` 给这一类的弧结构，
`style-references.md` 给语感与常见意象。没有对应目录时用通用骨架，不要硬套别的题材。

## 硬规矩

- 领域层只出 `reason.*` / `checkpoint.*` key，不产出任何成段文字建议；把方法讲成文字是这一层的职责。
- 交章前 `mahua_check_rules` 与 `mahua_check_consistency` 必须无 error 级结果，
  再调 `mahua_save_review`。评审的每个维度都要引用原文，见
  `$longform-continuity` 的 [quantum-auditor.md](../longform-continuity/references/quantum-auditor.md)。
- 不替路由做决定：下一步是什么以 `mahua_next_instruction` 为准。

方法论来源：本项目自有写作规范，部分条目改编自 novel-master（MIT-0）与 ainovel-cli（MIT）。见
[../../references/ATTRIBUTION.md](../../references/ATTRIBUTION.md)。
