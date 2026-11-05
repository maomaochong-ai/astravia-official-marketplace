# Prompt recipes

A prompt worth pasting has four parts: **topic, audience, structure, length**. Two of them are
routinely missing, and those are the two that force the user into three rounds of regeneration.

## PPT

```text
主题：Q3 产品路线复盘
受众：公司管理层，10 分钟汇报
结构：目标 → 关键结果 → 偏差原因 → 下季度取舍 → 需要的支持
长度：8 页，每页不超过 4 条要点，不要满屏文字
语气：结论先行，不要营销腔
```

Why each line earns its place:

- **主题** alone produces a generic deck. The audience line is what changes the abstraction level.
- **结构** is the single highest-value line: it is the difference between a deck the user edits and a
  deck the user throws away.
- **长度** keeps text density sane. Without it, every AI deck fills slides with paragraphs.
- **语气** only when it matters. Two adjectives, not a paragraph.

If the user has an outline already, hand it over verbatim as the structure — never re-summarise it
into something more "presentable".

## Flowchart

```text
把这个流程画成流程图：
客户提交需求 → 售前评估（可做/不可做）→ 报价 → 客户确认 → 合同审批 → 立项
分支：评估为不可做时回到客户并结束；报价被拒时回到售前评估（最多两轮）
角色：客户、售前、法务、项目经理
```

- Name the **decision points** explicitly with their labels. An AI asked to "make it a flowchart" with
  no branch described will invent branches.
- Give the roles if the diagram should be partitioned.
- Say the loop limit. Unbounded loops render as arrows pointing nowhere.

## Mind map

Goes through the chat entry, not a dedicated one.

```text
用思维导图展开「远程团队协作」：
一级分支固定为 沟通、节奏、工具、信任
每个一级分支下给 3–5 个具体做法，不要抽象口号
再在每个做法下补一个可落地的第一步
```

Fixing the first level is what makes an AI mind map usable; left free, every branch drifts into the
same three generic virtues.

## Doc / writing

```text
写一份项目复盘：
背景（3 句）→ 做对了什么（3 条，每条带证据）→ 做错了什么（3 条，每条带代价）→ 下次改什么（2 条，可执行）
读者是团队内部，不要客套话，不要"总而言之"
```

## Estimating points before a batch

There is no published per-operation price table, so do not quote one. What you can say honestly:

- the AI membership includes **10,000 points per month**;
- a single deck or diagram is a small fraction of that;
- a batch of ten or more generations is where the quota visibly moves.

When the user asks "how many points will this cost", the answer is "以页面提示为准" plus the monthly
figure — never a fabricated per-item number.

## Hand-off sentence

Close with something the user can act on immediately:

> 需求已经拆到可以直接粘的程度。点「生成」，余额和消耗页面会自己显示；出来之后要改结构就告诉我，
> 我改提示词，你重新生成。

That is the honest shape: you did the thinking, they press the button, and the next iteration is still
yours.
