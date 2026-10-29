# 0022 — 第三轮能力对齐：逐包对账与三项补口

- 状态：已接受（2026-10-29）
- 相关：ADR 0009（第一轮对齐）、ADR 0015（第二轮）、ADR 0021（本轮补的三处缺口）

## 背景

用户要求「再审查一次 `ainovel-cli` 的能力是否都对齐到了插件」。前两轮的对齐是**按功能名**做的
（工具面有没有、领域函数有没有），这一轮改成**按上游包**逐一过：
`ainovel-cli/internal/` 有 24 个包，逐个回答「它的职责在本插件落到哪里，或者为什么不该落」。

## 对账表

| 上游包 | 职责 | 本插件落点 | 判定 |
| --- | --- | --- | --- |
| `flow` | 确定性路由 + 状态迁移 + 穷举测试 | `domain/novel-flow.ts`、`test/novel-flow.test.ts`、`test/instruction-drivability.test.ts` | 已对齐（本轮还修了三条不可执行指令，ADR 0017 §2.5） |
| `domain` | 章/弧/评审/检查点/提交 | `domain/novel-types.ts`、`novel-progress.ts` | 已对齐 |
| `chapterfacts` | 章级事实抽取 | `domain/chapter-facts.ts` | 已对齐（改为确定性抽取，无 LLM） |
| `ctxpack` | 写作上下文包 | `domain/context-pack.ts` | 本轮补齐：伏笔、相关章节、弧/卷摘要（ADR 0021） |
| `rules` + `userrules` | 写作规则装载与检查 | `domain/writing-rules.ts`、`mahua_set_user_rules`、`mahua_check_rules` | 已对齐 |
| `stylestat` | 文风统计 | `domain/style-analysis.ts`、`mahua_style_stats` | 已对齐 |
| `arbiter` | 语义裁定 + 落盘 | `mahua_arbitrate`、`ArbitrationRecord`、`decisions/*.jsonl` | 已对齐 |
| `agents` | 三个 Worker 的上下文组装 | `agent/agents/*.md` + `mahua_context` | 已对齐（上下文组装在领域层，提示词在 agent 层） |
| `host#advance_gate` | 章节推进门禁 | `PASS_SCORE = 72` + `saveChapterReview` 的 mustFix/分数判定 | 已对齐 |
| `store` | 文件账本 | `repository/manuscript-repository.ts` | 已对齐（外加 `threads/`，ADR 0021） |
| `revision` | 修订分析/投影/迁移 | `pendingRewrite`、`mahua_edit_chapter`、`migrate()` | 部分对齐：没有「修订投影器」（见下） |
| `flow`+`host#book_lock` | 单书锁 | 单会话单写者 + 全局 `revision` 乐观并发 | 以另一种方式满足 |
| `diag` | 诊断导出、规则上下文、脱敏 | 无 | **本轮不做**，理由见 §2 |
| `eval` | 评测用例、采集、评分 | 无 | **本轮不做** |
| `llmcontract` / `llmretry` | 模型输出契约与重试 | 无 | 不适用：模型调用在宿主，工具输入是类型化参数 |
| `models` / `pricing` | 模型注册与计价 | 无 | 不适用 |
| `bootstrap` | 配置与模型选择 | 无 | 不适用 |
| `notify` | 桌面通知 | 无 | 不适用：没有通知权限，状态在侧栏可见 |
| `logger` | 日志 | 宿主日志 | 不适用 |
| `entry`（tui/headless） | 双入口 | 宿主侧栏 + 对话 | 不适用 |
| `errs` / `utils` | 错误类型与工具函数 | `ServiceResult` + `failure()` | 已对齐 |

上游 `docs/` 10 篇对应关系：`architecture` → ADR 0001；`chapter-advance-gate` → 门禁；`context-management` →
本轮补的三项；`engine-arbiter` → 0001/0002；`engine-rfc` → 0001；`user-rules-runtime` → 0008 与 `set_user_rules`；
`voice-layer` → `agent/voice.md` + `styles/`；`import-pipeline` → 不做（ADR 0015 §2.4）；
`evaluation-system` / `observability` → 不做（下节）。

## §2 三项明确不做与理由

1. **评测系统（`eval`）**：上游用它回归「引擎跑 30 章有没有变差」，需要真实模型调用与人工评分。
   插件侧已有 `test/instruction-drivability.test.ts` 覆盖「路由发出的指令能被执行」这一层，
   再往上是模型质量问题，不是插件能测的。要做得先有可复现的模型。
2. **诊断导出（`diag`）**：上游 `diag export` 生成一份脱敏的运行报告给作者排查。
   插件的事实层已经全在 `books/<id>/` 下（book.json + chapters + reviews + decisions + threads），
   用户直接可读；再做一份「报告」只是把这些文件拼起来，收益低于维护成本。
3. **修订投影器（`revision/projector`）**：上游能在章节被重写后把引用它的摘要、角色状态一起重投影。
   我们的 `pendingRewrite` 只标「这章要重写」，摘要由作者/编辑自己更新。做投影器要引入依赖图，
   当前工具面没有足够信息判断「谁引用了这一章」。

## §3 本轮实际补的三项

| 缺口 | 证据 | 处置 |
| --- | --- | --- |
| 伏笔台账 | `ainovel` Writer 每章按四维推荐相关章节，其中一维是伏笔；`novel-master` 五个阶段之一是伏笔管理 | 新增 `threads/<bookId>.json` + `mahua_flag_thread` / `mahua_check_threads`（ADR 0021 §1–2） |
| 相关章节推荐 | 同上；本插件 `buildContext` 只给前一章 | `related-chapters.ts` 纯函数 + `ContextPack.relatedChapters`（ADR 0021 §3） |
| 分层摘要没用上 | `summaries.arcs/volumes` 只写不读 | `ContextPack.summaries` 透传（ADR 0021 §3） |

## 后果

- 工具面 33 → 36；`GATED_TOOL_IDS` 22 → 24（台账三个：`flag`/`close` 写、`check` 读）。
- 对账表进 ADR 之后，"对齐"的判据变成「表里每一行都有落点或理由」，不再靠回忆。
- 下一轮若要动 `eval` 或 `diag`，先在这张表里把「不做」改成「做」，并写清验收条件。
