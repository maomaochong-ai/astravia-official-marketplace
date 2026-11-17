# 词表：机器腔的判据住在这里

`ai-tells.json` 是**唯一来源**。`src/reference/lexicon.generated.ts` 由 `scripts/build-reference-library.mjs`
从这里生成，代码只做解释：

```
agent/lexicon/ai-tells.json
  └─→ src/reference/lexicon.generated.ts   （AI_LEXICON，构建期生成）
        └─→ analyzeAiProfile(texts, lexicon) / lintStyle({ profile, words, limits })
```

改一个词、改一个阈值，都改这个 JSON，然后：

```bash
npm run references      # 重新生成 src/reference/*
npm run check && npm test
```

`test/lexicon-source.test.ts` 会守住四件事：词条不出现在代码里（含 `\uXXXX` 转义）、生成物与 JSON
同步、阈值同源、换一份词表检测结果跟着变。

## 字段

| 字段 | 作用 |
| --- | --- |
| `limits` | 全部阈值：短句/长句分界、均质带、段尾刹车比、报告阈值、样本下限。代码里没有魔法数 |
| `stock` | 出现即算问题：套句、情绪代称、定型比喻。`phrase` 给人看，`pattern` 是正则源码 |
| `soft` | 好文章也会用，只在密度过高时算问题（忽然、微微、缓缓…） |
| `explainHeads` | 句首替读者总结（他知道、这意味着、换句话说） |
| `timeHeads` | 时间/天气起手（清晨、黄昏、夜里…） |

`pattern` 不带斜杠与 flags。构建脚本会逐条编译校验：写错正则在**构建时**失败，不会等到作者写完
一章才静默少报一条。

## 加一个词的判断标准

1. **它在替读者做事**吗？不由得抹平意愿，仿佛换掉新鲜比喻，一丝把情绪量词化。是 → `stock`。
2. **好文章也会用**吗？忽然、微微、缓缓是正常词，只是密度会出卖作者。是 → `soft`。
3. **它是不是某一类的专有说法**？奇幻的古风套句、言情的身体反应套句，放 `stock`，并在
   `agent/skills/novel-craft/references/genres/<genre>/style-references.md` 里写清替代方式。

只有 1 成立才进 `stock`；2 和 3 混进来会让检测器变成噪音源。

## 阈值怎么定

现在的数是从两处夹出来的：机器腔样本必须报警，鲁迅《孔乙己》与汪曾祺《受戒》必须不报警
（见 `test/ai-flavor.test.ts`）。要调就往中间调，并补一个样本证明它还站在两边。
