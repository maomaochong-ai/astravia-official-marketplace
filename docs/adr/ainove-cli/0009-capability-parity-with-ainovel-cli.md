# ADR 0009：与 ainovel-cli 的能力对齐矩阵

- 状态：已接受（2026-10-29，随 0.0.1）
- 决策对象：`abilities/plugins/novelwright`
- 参照对象：[`ainovel-cli`](../../../../../github-source-code/ainovel-cli) 的 `internal/tools`、`internal/rules`、
  `internal/revision`、`internal/stylestat`、`internal/chapterfacts`、`internal/userrules`

## 1. 背景

0.0.1 的第一版只移植了主线（写入库、卷弧计划、章纲、草稿、评审、提交、收弧、完本）。上游还有一批
**不推进主线但决定成品质量**的能力：基础设定审计、写作规则、风格统计、章内事实、一致性检查、上下文包、
大纲反馈闭环、扩弧、章级修补、重开。这些缺了，工具面就只够「把字写出来」，不够「写得住」。

对标时按能力**语义**对齐，不按函数名对齐：`save_book` 在本插件叫 `create_book`（它确实只创建），
`draft_chapter` 拆成 `start_drafting` + `save_chapter`（进入草稿相与落盘一次字数在状态机上是两件事）。

## 2. 决策

### 2.1 对齐矩阵（31 个工具）

| 上游能力 | 本插件工具 | 读/写 | 门禁 | 落点 |
| --- | --- | --- | --- | --- |
| `save_book` | `novelwright_create_book` | 写 | 要 | `novel-progress.createBook` |
| — | `novelwright_list_books` | 读 | 否 | `listBooks` |
| — | `novelwright_book_status` | 读 | 否 | `status`（只返事实，不含 `next`，ADR 0007） |
| — | `novelwright_next_instruction` | 读 | 否 | `routeNovel` |
| `read_chapter` | `novelwright_read_chapter` | 读 | 否 | `readChapter` |
| — | `novelwright_accept_brief` | 写 | 要 | `acceptBrief` |
| — | `novelwright_save_plan` | 写 | 要 | `saveVolumePlan` |
| — | `novelwright_save_outline` | 写 | 要 | `saveChapterOutline` |
| `plan_chapter` | `novelwright_plan_chapter` | 写 | 要 | `saveChapterPlan` |
| `draft_chapter` | `novelwright_start_drafting` + `novelwright_save_chapter` | 写 | 要 | `startDrafting` / `saveChapter`（同时抽章内事实） |
| `edit_chapter` | `novelwright_edit_chapter` | 写 | 要 | `editChapter`（整段替换或追加，回到 `drafting`） |
| `save_review` | `novelwright_save_review` | 写 | 要 | `saveChapterReview` |
| `commit_chapter` | `novelwright_commit_chapter` | 写 | 要 | `commitChapter` |
| — | `novelwright_close_arc` | 写 | 要 | `closeArc` |
| — | `novelwright_finalize` | 写 | 要 | `finalize` |
| `expand_next_arc` | `novelwright_expand_next_arc` | 写 | 要 | `expandArc` |
| `save_arc_summary` | `novelwright_save_arc_summary` | 写 | 要 | `saveArcSummary` |
| `save_volume_summary` | `novelwright_save_volume_summary` | 写 | 要 | `saveVolumeSummary` |
| `revise_outline` | `novelwright_flag_outline_feedback` + `novelwright_resolve_outline_feedback` | 写 | 要 | `recordFeedback` / `resolveFeedback` |
| `save_foundation` | `novelwright_save_foundation` | 写 | 要 | `saveFoundation` |
| `audit_foundation` | `novelwright_audit_foundation` | 读 | 否 | `auditFoundation` |
| `save_user_rules` | `novelwright_set_user_rules` | 写 | 要 | `normalizeRules` + `saveUserRules` |
| `check_consistency` | `novelwright_check_consistency` | 读 | 否 | `checkConsistency` |
| `internal/rules` lint | `novelwright_check_rules` | 读 | 否 | `lintChapter` |
| `stylestat` | `novelwright_style_stats` | 读 | 否 | `analyzeStyle` |
| `novel_context` | `novelwright_context` | 读 | 否 | `buildContext` |
| `reopen_book` | `novelwright_reopen_book` | 写 | 要 | `reopenBook` |
| `assets/references` · `assets/styles` · `voice.md` | `novelwright_reference` | 读 | 否 | `readReference` / `listReferences`（ADR 0012） |
| `arbiter.Decide*` | `novelwright_arbitrate` | 写 | 要 | `arbitrate`（ADR 0001） |

门禁清单 `GATED_TOOL_IDS` 只列**写**工具（21 个，读工具 10 个）；读工具不进门禁 —— 拦住读会让「先看看再决定」这件事变成死路。

### 2.2 新增五个纯函数领域模块

| 模块 | 职责 | 为什么不放应用层 |
| --- | --- | --- |
| `style-analysis.ts` | 句长、段数、对白比、重复短语 | 纯文本统计，输入 `string[]` 出结构体，可以在毫秒级穷举测试 |
| `chapter-facts.ts` | 从一章正文抽出出场人物与首末句 | 事实抽取，不写盘；抽出来的东西决定一致性检查的输入 |
| `writing-rules.ts` | 规则收敛 + 硬约束 lint | 规则是查表，不是判断；`normalizeRules` 丢弃未知字段，防止规则表长成自由形状 |
| `consistency.ts` | 跨章问题：弧外章节、名单外人物、重叠弧、已提交章上的改写反馈 | 只读整本书，输出 `Finding[]`，不修任何东西 |
| `context-pack.ts` | 给写手的事实包：阶段、基础设定、演员表、当前弧目标、上一章收尾句、未结反馈 | 组装而非检索；视图和工具共用同一份，避免「界面说的和模型看到的不一样」 |

### 2.3 纪律沿用

- **诊断类能力只报问题，不自动改。** `check_*` / `style_stats` / `context` 全是读工具；修还是写工具的活，
  由模型按其提示词决定。
- **诊断结果是 `Finding { code, severity, detail? }`，code 是 key 不是句子**（`foundation.missing`、
  `rule.banned`、`consistency.unknownCharacter` 一类）。工具把 code 原样给模型，界面按 `finding.*` 与
  具体 code 渲染文案。
- **不新增第八个阶段。** 扩弧、写摘要、改大纲、重开都发生在既有阶段内，由路由函数按事实决定下一步，
  不靠新增阶段表达（见 ADR 0001 的转移表纪律）。

### 2.4 能力面与界面的分工

工作台视图只显示**状态与下一步**（阶段、进度、章板、正文、评审、指令卡）；诊断、规则、风格、上下文包
留在对话侧用工具取。理由：这四类输出都是"读一次、看一眼、不一定用"，塞进固定面板会让主界面长期挂着
一堆与当前动作无关的信息，而模型按需调用时最省。

### 2.5 工艺文档按需取，不进提示词

上游 `assets/references`（14 篇）、`assets/styles`（4 篇）、`assets/voice.md` 是给 agent 读的**方法论文库**，
不是工具定义。照搬进提示词会让每轮上下文多三万字，所以做成随包数据 + 一个读工具：目录一次、正文按需
（ADR 0012）。这不算「新增上游没有的能力」——它是同一批文档的另一种投递方式，`PARITY` 表里占一行。

## 3. 后果

- 工具从 15 个扩到 31 个，`test/manifest-guards.test.ts` 用一张 `PARITY` 映射表钉住「上游每一面都有落点」，
  漏一个就红；同时钉住「工具 id 不重复」和「每个工具都写了 `scope_use`」（宿主 fail-closed）。
- 领域层多 5 个模块、约 400 行纯函数，`test/capabilities.test.ts` 覆盖其边界（空手稿、乱输入、跨章冲突）。
- 上游将来新增能力时，对齐动作是「往 `PARITY` 表加一行 + 一个工具 + 一条 `Finding` code」，有界。
