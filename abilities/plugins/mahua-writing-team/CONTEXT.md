# 麻花小说网（Mahua Novels）领域词汇表

本文件是 `mahua-writing-team` 插件唯一通用的领域语言。代码、ADR、工具描述、界面文案都以下表为准；
ADR 只引用这里的词，不再各自定义（见 ADR 0001 §3）。

写法约定：**中文正名在前，英文别名在括号内**。代码里的类型名与字段名一律用英文别名，
避免中文标识符与拼音混用。

| 词 | 定义 | 不使用 |
| --- | --- | --- |
| **作品** Book | 一本书的根实体：题材、目标章数、风格样本、基础设定、卷弧计划与全部章节 | Project、Novel |
| **基础设定** Foundation | 开写前必须定下的六项：题材定位、核心冲突、主角目标、终局方向、写作禁区、差异化卖点。缺项由 `audit_foundation` 报出 | Premise（premise 只指一句话前提） |
| **前情** Premise | 一句话前提（logline），作品的身份而非结构 | Summary |
| **演员表** Cast | 作品允许出场的角色名清单。章节事实里的角色只在此表内匹配 | Character（那是智能体角色） |
| **卷** Volume | 宏观单元，一本 3–8 卷，每卷有卷目标与卷末钩子 | Part、Book |
| **弧** Arc | 卷内的戏剧单元，3–8 章，带弧目标与章区间 `from`/`to` | Chapter group |
| **章** Chapter | 最小交付单元，唯一带 `planned → drafting → reviewed → committed` 状态机 | Section |
| **章纲** Chapter outline | 一章的标题与所属弧。只改标题，不改正文 | Plan（那是章前计划） |
| **章前计划** Chapter plan | 写正文前的一页意图：本章目标、冲突、结尾钩子。写完即历史，不参与路由 | Outline |
| **阶段** Phase | 作品级状态机：`briefing → planning → drafting → revising → arc_close → completed` | Status |
| **指令** Instruction | 路由输出 `{ worker, task, chapter, reasonKey }`。只有它说"下一步做什么" | Command、Job |
| **评审** Review | 七维评分 + 必改项，是修订的唯一输入；72 分为通过线 | Score、Grade |
| **必改项** Must-fix | 评审里必须逐条消耗的条目。非空即 `blocked`，不允许提交 | Issue、Comment |
| **断点** Checkpoint | step 级推进记录，只存 `noteKey` + 参数，不存句子 | Snapshot |
| **裁定** Arbitration | 语义判断的结构化落盘记录：场景封闭枚举，一次一裁 | Decision（decision 是裁定的内容） |
| **大纲反馈** Outline feedback | 读者/作者对已落章纲的意见池，`open → resolved`，处置只有接受/改纲/驳回 | Comment |
| **修订影响面** Revision impact | 改了某章之后，哪些弧摘要与卷摘要失效、需要重建 | Invalidation |
| **风格统计** Style stats | 句长、对话占比、段落数、高频短语。用于给 Writer 一个可对齐的语感基线 | Style score |
| **写作规则** Writing rules | 可执行的硬约束：禁用词、人称、单章字数区间。与"评审标准"不同，它不需要模型判断 | Lint config |
| **一致性** Consistency | 跨章事实的自洽：角色是否在演员表、章节号是否连续、弧区间是否重叠、伏笔是否超期 | Validation |
| **上下文包** Context pack | 一次交给 Writer 的事实集合：现状、当前弧目标、上一章事实、未回收反馈、未回收伏笔、相关旧章、已收的弧/卷摘要 | Prompt |
| **伏笔台账** Story thread | 一条已埋未收的线索：埋点章、承诺回收章、轻重（浅/中/重）、状态。与作品同一次提交写入，独立文件 `threads/<id>.json` | Foreshadowing（那是手法，不是记录） |
| **相关旧章** Related chapters | 近 40 章内、与当前章共享伏笔/角色/弧的旧章，最多 6 条，按伏笔 > 角色 > 弧的优先级挑 | Recall、History |
| **工作台** Studio | 插件的侧边栏工作区视图：书架、书库、书页与阅读器四层同在一个视图内 | Dashboard |
| **书架** Shelf | 工作台第一层：作品封面网格 + 最近更新行表，点封面进书页 | Library |
| **书库** Library | 工作台第二层：横版长条卡列表 + 题材/状态/篇幅筛选 + 最近更新/章节数/书名排序，每页 9 张 | Catalog、Shelf |
| **阅读页** Reader | 工作台第四层：整幅正文 + 上一章/下一章 + 五档字号，只显示正文与评审 | Reader |
| **对话桥** Conversation bridge | 工作台把"下一步"交给宿主对话的那一步：建会话 → 发 prompt → 宿主智能体界面接手 | Launcher |
