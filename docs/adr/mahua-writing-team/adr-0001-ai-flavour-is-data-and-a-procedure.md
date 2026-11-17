# 机器腔的判据是数据，不是代码；改法是流程，不是形容词

- **状态：** 已接受
- **日期：** 2026-11-17
- **背景：** 插件 mahua-writing-team 0.4.35；作者反馈「写小说的 AI 味道比较浓」，并要求「禁止硬编码」
- **取代：** 0.4.35 之前把词表与阈值写在 `src/domain/style-analysis.ts` 的做法

## 问题一：词表写在代码里

0.4.35 把 26 条套句、8 条软词、6 个解释开头、12 个时间起手写成 `\uXXXX` 转义塞在领域层。理由是领域层守卫
禁止源码出现中日韩字符——**这条守卫被绕过了，而不是被满足了**。代价是：

- 改一个词要发一次版；
- 要改词的人得先把码点翻译成人话；
- 同一句话在代码、提示词、工艺文档三处各写一遍，迟早不一致。

## 决定一：词表与阈值是一份数据

```
agent/lexicon/ai-tells.json                      ← 唯一来源（作者可直接改）
  └─ src/reference/lexicon.generated.ts           ← 构建期生成，AI_LEXICON
       └─ analyzeAiProfile(texts, lexicon)         ← 领域层只解释数据
          lintStyle({ profile, words, limits })
```

- `src/domain/ai-lexicon.ts` 只放**形状**与编译（JSON 的 pattern → RegExp），不含任何词与数。
- 阈值全部进 `limits`：短/长句分界、均质带、段尾刹车比、四个报告阈值、两个样本下限。代码里没有魔法数。
- `scripts/build-reference-library.mjs` 逐条校验正则能编译——写错的词**在构建时**失败，而不是在作者写完
  一章、点发布时静默少报一条。
- `test/lexicon-source.test.ts` 守四件事：词条不出现在代码里（含 `\uXXXX` 反转义后比对）、生成物与 JSON
  同步、阈值同源、换一份词表检测结果跟着变。

## 问题二：agent 层面只有形容词

0.4.35 把「节奏要有快慢」写进 `voice.md`，但 `voice.md` 只在有人 `mahua_reference voice` 时才读到。而
writer 的**系统提示**（`agent/agents/writer.md`，每次都在上下文里）当时只说「跑 check_rules 并修掉它」。
所以模型看得见告警，看不见怎么改；也看不见写之前该定什么。

## 决定二：写前定节奏，写后按六遍改

| 层 | 文件 | 加了什么 | 为什么在这一层 |
| --- | --- | --- | --- |
| writer 系统提示 | `agent/agents/writer.md` | 「Plan the rhythm before you write」：章的段落形状、两句长句与三句短句的位置、非时间起手、这一章最容易落到哪个套句 | 每次都在上下文里，是唯一不靠自觉去读的位置 |
| 团队指令 | `agent/prompts/briefs/writer.md` | 写前定节奏；**不重复上一章的开头形状**；`style.*` 未清不得交 editor | 团队会话里真正约束产出的那一层 |
| 插件级 | `agent/prompts/routing.md` | 一句硬规则：带 `style.*` 的章到 editor 手里属未完成，程序是 `revision-pass` | 所有会话都加载 |
| 队长流程 | `agent/prompts/team-workflow.md` | `draft-chapter` 打回 writer 而不是送 editor | 打回次序决定返工次数 |
| editor | `agent/agents/editor.md` | 有 `style.*` 就 `blocked`，代码与引用句进 `mustFix`；不许绕开评分 | 把「能自己改的形状」与「品味分歧」分开 |
| 工艺库 | `references/revision-pass.md`（新） | 六遍：删 → 换观察 → 拆合并 → 改段落 → 换起手收尾 → 读出声；每遍对应一个 code | 诊断（anti-ai-tone）与程序（revision-pass）分开 |
| 题材 | `references/genres/*/style-references.md` | 奇幻/言情/悬疑各一节「机器腔重灾区」 | 三类被写坏的方式不同：奇幻坏在形容，言情坏在贴标签，悬疑坏在解释 |
| 词表本身 | `agent/lexicon/README.md` | 加词的判断标准（替读者做事 → `stock`；好文章也用 → `soft`） | 词表会不会变成噪音源，取决于这条标准 |

## 已知边界

- **`style.*` 仍不阻断提交**：它是 warning，与 `rule.tooLong` 同级。改成阻断会改变既有书的行为，需要单独决策。
- **`style.timeOpening` / `style.punchlineEnding` 永远只是 `info`**：单章无法证明重复，跨章对比目前靠人读上两章；
  没有"最近三章起手形式"的台账，这是下一步。
- **A7–A10 仍只能人工判**：三连排比、情绪贴标签、千人一腔、信息倾倒不是词形，硬编码只会制造误报。
- **没有按书的阈值覆盖**：`limits` 是全局一份。不同题材对节奏的容忍度不同，按书覆盖要动 `userRules` 的嵌套
  形状（tool schema → service → domain → 持久化），本轮不做。

## 验证

- `npx vitest run`：23 文件 / 250 项通过。
  - `test/lexicon-source.test.ts`（5 项）：代码里无词条（含转义）、生成物同步、阈值同源、换词表结果随变、
    坏正则只丢一条。
  - `test/ai-flavor.test.ts`（11 项）：机器腔样本全中、人腔样本不中、样本不足不给节奏结论、
    段尾刹车与节奏窄道分别可报。
- 经典散文不误报（阈值两侧夹）：《孔乙己》均质 0.29、《受戒》均质 0.27，findings 均为空。
- `npm run references`：35 篇工艺文档（新增 `revision-pass`）。
