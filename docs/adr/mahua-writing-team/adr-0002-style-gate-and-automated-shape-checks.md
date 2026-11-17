# ADR 0002：机器腔从「建议」变成门禁，A7–A10 由代码判

- **状态：** 已接受
- **日期：** 2026-11-17
- **插件：** mahua-writing-team 0.6.0
- **前置：** [ADR 0001](adr-0001-ai-flavour-is-data-and-a-procedure.md)（判据是数据，改法是程序）
- **取代：** ADR 0001「已知边界」里的三条：`style.*` 不阻断提交、`timeOpening` / `punchlineEnding` 只是 info、没有按书阈值覆盖

## 问题

0.5.1 把机器腔变成了可计算的 finding，但剩下四处仍然要靠人：

1. `style.*` 只是 warning，提交照样通过 —— 发现问题和阻止问题之间没有连接。
2. `style.timeOpening` / `style.punchlineEnding` 永远是 `info`：单章证不了重复，而"重复"才是它们想说的。
3. 阈值全局一份：写实验文体的书没法放宽，类型小说也没法收紧。
4. **A7–A10 完全靠 editor 主观判断**：三连排比、情绪贴标签、千人一腔、信息倾倒。作者要的是"解放人类"，
   而这四项恰好是 editor 最费力、最容易前后不一致的部分。

## 调研（开源小说与协作写作项目）

| 项目 | 做法 | 我们取什么 |
| --- | --- | --- |
| [novelWriter](https://github.com/vkbo/novelWriter)（GPL-3.0） | 只有拼写/重复词统计与"每章字数"硬指标，风格检查交给外部工具 | 确认"机械可查的才硬拦"这条边界；它不做的正是我们做的 |
| [Manuskript](https://github.com/olivierkes/manuskript)（GPL-3.0） | 频率分析（词、短语）、可读性指标 | 短语频率我们已经用离散度替掉；"重复短语"仍留在 `style_stats` 里做诊断 |
| [bibisco](https://github.com/andreafeccomandi/bibisco)（AGPL-3.0） | 场景/人物结构校验 + 写作目标 | 结构校验与文风校验分离，我们照此分层（`rule.*` / `style.*` / 跨章） |
| [Plottr 的开源替代 · Story Architect 社区版](https://github.com/story-apps) | 大纲与场景卡一致性强校验 | 同上：结构问题进 `check_consistency`，文风进 `style.*` |
| [writetogether / etherpad 系协作](https://github.com/ether) | 版本对比、逐段修订历史 | 不做：会话与版本在宿主手里（ADR 0018），插件只推导 |
| [proselint](https://github.com/amperser/proselint)（BSD） | **规则库 = 数据**，每条规则一个检查函数 + 文档 | 与我们 0.5.0 的词表路线一致，继续把新判据也放进数据 |
| [textlint](https://github.com/textlint/textlint)（MIT） | 规则可配置严重级别（`info`/`warning`/`error`）、按项目覆盖 | **按书覆盖 + 可配置阻断**：本 ADR 的直接来源 |
| [Vale](https://github.com/errata-ai/vale)（MIT） | 风格指南即配置，`level` 决定是否失败（CI 退出码） | **门禁**：finding 的级别决定"过不过"，而不是只提示 |

三个共同点被采纳：**规则即数据**、**级别决定门禁**、**按项目覆盖**。
一个共同点被拒绝：**都只做词与句这一层**。我们多走一步——把结构（排比、对白长度、说明句连续长度）
也变成可算的量，因为有回归语料可以证明它们能分开两类文本。

## 决定

### 1. `style.*` 阻断提交，默认全拦

- `WritingRules.styleBlocking`：本书哪些代码阻断。默认 `STYLE_BLOCKING_DEFAULT`（全部 warning 级）。
- `styleGate(findings, blocking)` 在领域层判；`info` 永不阻断（写错进名单也不拦）。
- 服务层 `commitChapter` 在提交前体检：非空则 `failure("style-blocking", "code(count) …")`。
  已提交章只修指针，不再体检。
- `mahua_check_rules` 返回 `blocking`，writer 拿到的是"会拦住你的那几条"，不是"建议看看"。

### 2. 跨章重复可判：`forms` + 上一章

- `style-shapes.ts` 把开篇/收尾归成有限形式：
  opening `dialogue|time|action|question|statement`，closing `dialogue|action|question|summary|echo`。
- 服务层取**上一已提交章**的正文算形式，与本章比对；相同则报 `style.repeatOpening` / `style.repeatClosing`
  （warning，进 `blocking`）。
- 于是 `timeOpening` / `punchlineEnding` 保持 `info`（"这一章用了这种形式"），
  重复这件事由新的两条 warning 负责 —— 分工明确，不再靠人去比两章。

### 3. 按书覆盖阈值

- `WritingRules.styleLimits: Partial<AiLimits>`，`mergeLimits` 与全局合并。
- 只接受词表里已有的键、有限正数；未知键与 0/负数丢弃（把阈值调 0 不该悄悄关掉检查）。
- 可覆盖键从词表本身派生（`Object.keys(AI_LEXICON.limits)`），新增阈值不必再改第二处。

### 4. A7–A10 交给代码

| 代码 | 判据（全部数据驱动） | 为什么这样判 |
| --- | --- | --- |
| `style.parallelTriplet` | 一句里连续三个分句：同标记起头（前 3 字内）、或长度相差 ≤1 且同字收尾；一章允许 1 组 | 排比是可枚举的结构，不是词；留 1 组是给修辞 |
| `style.emotionLabel` | 情绪名前 4 字内出现强度词（非常/感到/有些…），命中 ≥2 | "感到委屈"与"她委屈地"不同：后者是行为，前者是标签 |
| `style.uniformDialogue` | 引号内句子数 ≥6，且这些句子长度的离散度 <0.25 | 人写对白长短悬殊；去掉引号分不出谁在说就是千人一腔 |
| `style.sermon` | 一句对白里 ≥2 个说教标记（你应该/你必须/做人…） | 说教的改法是删，不是拆，所以单列 |
| `style.expositionDump` | 同一段里连续 ≥4 句「无对白 + 含设定标记（位于/分为/据说/意味着…）」 | 单句交代是必要；连续四句是念设定集 |

阈值全部进词表（`parallelTriplets` / `emotionLabels` / `dialogueFloor` / `dialogueDispersion` / `expositionRun`）。

## 已知边界

- **仍是启发式。** 四条都只报 warning 且可被本书关掉；误报的代价是"改一句"，漏报的代价是"人再读一遍"。
  两者都低于"完全靠人"。
- **`style.sermon` 会误判争论戏**：有人物真的在讲道理时不报（只数标记共现），但一段说理对白会被报。可接受。
- **`style.expositionDump` 依赖标记表**：架空设定的自造名词不在表里时不会报。加词是数据改动，不是代码改动。
- **形式分类只有五种**：混合开篇（先对话再描写）归到第一个匹配项；够用，但不追求完备。
- **没有做"跨章短语复读"**：`style_stats.topPhrases` 只展示，不判定。

## 验证

- `test/ai-flavor-regression.test.ts`：语料 14 篇（machine 11 / human 3）+ 1 对改前改后。
  新增 5 篇针对 A7–A10 的样本、1 对跨章样本；人腔三篇仍为零 finding（含 info）。
- 覆盖率守卫扩到新代码：`writing-rules.ts` 里每条 warning 必须在语料里有对应样本。
- 门禁本身三条用例：默认集合拦住 `style.stockPhrase`；`[]` 放行；`info` 代码列入也不拦。
- `studio-service` 生命周期用例显式退出风格门禁——它的样本是刻意等长的英文，被拦是正确行为。
