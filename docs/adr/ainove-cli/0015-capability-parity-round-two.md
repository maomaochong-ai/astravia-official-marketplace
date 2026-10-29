# ADR 0015：能力对齐第二轮——补 `premise_structure` 与 `revise_outline`，并把两类"需要模型分析"的缺口显式留下

- 状态：已接受（2026-10-29，随 0.1.0）
- 决策对象：`src/domain/premise.ts`（新增）、`src/domain/premise-vocabulary.ts`（新增，见 §2.3）、
  `src/domain/novel-progress.ts`（新增一个纯函数）、
  `src/application/studio-service.ts`、`src/tools/novel-tools.ts`、`src/entitlement/entitlement-gate.ts`
- 修订：ADR 0009 的对齐矩阵（工具 31 → 33，门禁 21 → 22）
- 相关：ADR 0001（确定性引擎、工具只返事实）、ADR 0007（读/写/路由三分）、ADR 0010（自足）

## 1. 背景

ADR 0009 以 `ainovel-cli/internal/tools/` 为基准做过一轮对齐，31 个工具覆盖了 17 组上游能力。
第二轮逐文件重比后，剩下两个**纯确定性**的上游工具没有对应物：

| 上游 | 做什么 | 我们缺的理由 |
| --- | --- | --- |
| `internal/tools/premise_structure.go` | 把一段结构化的故事前提按小标题切成节，逐节归位到基础设定 | 0.0.1 只做了 `audit_foundation`（查已成书的六项是否为空），没有"从一段文本里抽出这六项"的能力 |
| `internal/tools/revise_outline.go` | 从某一章起整段替换后续章纲，已完成/正在写的章不许动 | 现有 `save_outline` 只能一章一章改，改不完"后半本重做"这种意图 |

两者都是**读一段字符串、写一段已存状态**的确定性动作，不调模型，符合 ADR 0001 的
"确定性平面"边界，可以移植。同一轮比对里另外两组缺口不具备这个性质，见 §2.3。

## 2. 决策

### 2.1 `premise_structure`：解析给作者看，不替作者判断

新增 `src/domain/premise.ts`，两个纯函数：

- `parsePremise(text)` → `{ sections, foundation, cast, unknownHeadings }`；
- `auditPremise(text)` → `Finding[]`（沿用 `Finding` 的 `code` + `severity`，**不出自然语言**）。

标题别名表来自上游 `premiseHeadingAliases`（`题材定位` / `题材和基调` / `核心冲突` / `主角目标` /
`结局方向` / `终局方向` / `终局命题` / `写作禁区` / `差异化卖点` / `差异化钩子` / `核心兑现承诺` /
`故事引擎` / `关系·成长主线` / `升级路径` / `中段转折` / `中期转向` / `短篇适配性`），
英文侧补齐 `theme / conflict / protagonist / ending / taboo / hook / cast`。

识别三种标题写法：Markdown 的 `#`–`###`、加粗整行 `**标题**`、以及 `标题：内容` 的行首冒号式。
其余带标题的行归入 `unknownHeadings` 原样返回——**不猜**。

映射结果只填 `Foundation` 的六项 + `cast`。上游把「升级路径 / 中段转折 / 短篇适配性」当作
规划提示，这里不做二次解释，只作为 `sections` 原样交出。

体检三项，全部是 code：

| code | severity | 判据 |
| --- | --- | --- |
| `premise.noSections` | error | 一个标题都没识别出来（多半是整段流水句） |
| `premise.missing` | error | `theme` / `conflict` / `protagonist` / `ending` 任一没抽到，`detail` 写字段名 |
| `premise.noCast` | warning | 没抽到演员表 |

工具 `novelwright_premise_structure`：**读工具，无门禁**（ADR 0007）。入参 `text` 必填，
只返回解析结果与体检项，不返回"建议你补充……"。

### 2.2 `revise_outline`：只改"还没发生"的尾段

新增纯函数 `reviseOutlineTail(book, fromChapter, replacement, now)`，语义对齐上游：
「从 `from_chapter` 起用 `replacement` 完整替换后续计划」。

拦下五种情况，全部 `fail(error)`：

1. `fromChapter` 不是正整数，或大于 `targetChapters`；
2. `fromChapter` 之前没有已规划的弧覆盖它（新章拿不到 `arcId`）；
3. `≥ fromChapter` 的章里存在 `drafting` / `reviewed` / `committed` / `blocked` 的章
   ——对应上游"已完成或正在写作的章节不可移动"，这里取最保守的一档：**有正文就不许动**；
4. `replacement` 为空，或章号不连续（必须从 `fromChapter` 开始逐章递增）；
5. 任一 replacement 章超出 `targetChapters` 或落在弧之外。

允许删除尾段（`replacement` 覆盖到比原来更早的章），被删章的 `plans` 一并清理；
被替换章若原本有 `plan`（章前计划），也一并清理——计划是照着旧章纲写的。

阶段限制在 `planning` / `drafting`：`briefing` 还没有弧，`arc_close` 说明弧刚收，
`completed` 已定稿。`revising` 时尾段理论可改，但此时作者注意力在当前章的返工上，
放开只会制造两条并发意图，故一并拒绝。

服务层 `reviseOutline()` 把 `reason` 写成一条 `decisions` 记录，与 `arbitrate` 同一条账本
（ADR 0005）：**改了大纲必须留得住理由**。工具 `novelwright_revise_outline` 是写工具，
进 `GATED_TOOL_IDS`，只返 `{ from, to, replaced, dropped }` 四个事实。

与上游的一处**有意收窄**：上游 `replacement[]` 每项要 `title` / `core_event` / `hook` / `scenes`，
本插件的章纲是一行标题（ADR 0001 的扁平事实层，`Chapter` 只有 `title`），因此只收
`{ chapter, title }`。多出来的字段没有落点，收进来就是假装存了。

### 2.3 词表单独成文件，守卫按文件名单一豁免

落码时发现一个真实冲突：`test/manifest-guards.test.ts` 的"领域层不含自然语言"守卫会扫
`src/domain` 里所有非注释的 CJK 字符，而标题别名表必然是中文——它是**输入词表**，不是输出文案。

处理方式：

- 别名表、`normalize()`、`keyOf()` 搬到 `src/domain/premise-vocabulary.ts`，`premise.ts` 只留
  `parsePremise` / `auditPremise` 两个纯函数，类型 `PremiseSectionKey` 也定义在词表文件里再由
  `premise.ts` 转出（`import type`，不产生运行时环）。
- 守卫里**精确点名**这一个文件豁免（`const VOCABULARY = "src/domain/premise-vocabulary.ts"`），
  不改成通配。将来再有输入词表，必须自己改那一行——豁免应该显眼。
- `splitCast` 的分隔符与标题正则改用 `\u3001` / `\uFF1A` 转义写法：源码里不出现实际全角字符，
  守卫不需要为此再放宽。

同时把 `auditPremise` 的 `premise.noSections` 定义钉死：判据是"**没有任何一节被识别出来**"
（包括空文本与全是流水句两种），而不是 `sections.length === 0`——后者在纯散文输入下永远不成立，
因为散行会被归入一个无标题小节，那条 code 就是死分支。

### 2.4 两类缺口显式不做，并写清理由

| 缺口 | 上游位置 | 不做的理由 |
| --- | --- | --- |
| 导入管道 | `docs/import-pipeline.md`（import-analyze / range / segment / synthesize）、`internal/tools/` 的导入族 | 四段全部以 LLM 分析契约为核心：先把整本切段、再逐段抽取事实与章界、最后合成章纲。它还需要一个**与已提交章冲突时怎么办**的策略，那是产品决策不是移植。留在 Desktop 侧的长任务里做 |
| 已提交章修订 | `internal/revision/analyze.go` 的 `chapter_revision_analysis`（`change_summary` / `story_changed` / `facts` / `style_delta` / `impact`） | 本质是"改完已提交章之后，重建这一章的事实并评估对后续的影响"，靠一次 LLM 结构化调用产出。插件现有 `edit_chapter` 已拒绝改 `committed` 章，放开它必须先有事实重建，顺序不能倒 |
| `eval` / `diag` / `notify` / `logger` / `host` / `entry` | `internal/` 同名包 | CLI 基础设施，Desktop 侧由宿主承担 |

## 3. 后果

- 工具面 31 → 33；`GATED_TOOL_IDS` 21 → 22；`test/manifest-guards.test.ts` 的 `PARITY` 表 +2 行。
- 新增两处需要双语的**界面**文案（工具行的 label 与描述走英文 `label` 字段，不进 locales）；
  解析与体检结果都是 code，不新增 locale key。
- `premise_structure` 与 `audit_foundation` 的分工要写进智能体提示：前者看**一段文本**，
  后者看**已存的书**。两者判据相同（缺项 = 不通过），但输入不同，不能互相替代。
- 上游"改大纲"的语义比我们宽（可以带 core_event / hook / scenes）；本插件收窄成一行标题后，
  "整段重写"的表达力仍然在，只是每章只有一句话。

## 4. 不做什么

1. **不在 `revise_outline` 里顺手改已存在的章纲**：它就是尾段替换，单章细改走 `save_outline`。
2. **不让 `premise_structure` 直接写 `foundation`**：解析是读，落库要走 `save_foundation`，
   否则作者看不见自己"被采纳了哪几项"。
3. **不引入第五个智能体**：解析是确定性步骤，归引擎，不占角色位（ADR 0002 的四人边界不变）。
