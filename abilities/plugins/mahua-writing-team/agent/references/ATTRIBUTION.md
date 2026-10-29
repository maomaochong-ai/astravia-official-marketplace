# 工艺文档来源

`agent/skills/*/references/**`、`agent/styles/**`、`agent/voice.md` 三处内容移植自两个上游项目，
作为本插件自带的写作工艺库随包分发：

## ainovel-cli（Apache License 2.0）

- `skills/novel-craft/references/` —— 章节写法、钩子、对白、情节结构、去 AI 味、质量清单，
  以及 `genres/` 下悬疑 / 言情 / 奇幻三类题材的弧线模板与风格样本。
- `skills/longform-continuity/references/consistency.md`、`longform-planning.md` —— 长篇一致性检查与滚动规划。
- `styles/` —— 四套文风预设（默认 / 悬疑 / 言情 / 奇幻）。
- `voice.md` —— 叙述声音的统一口径。

## novel-master（MIT / MIT-0，`_meta.json` version 2.0.0）

- `skills/novel-craft/references/{scene-writing,dramaturgy,classic-writing-books,banned-words,cognitive-bias,foreshadowing}.md`
- `skills/longform-continuity/references/{process-per-character,node-compressed-graph,quantum-auditor}.md`

这几篇是按本插件的工具面重写的改编版：原文里调用外部脚本的步骤已换成 `mahua_*` 工具调用，
Python 辅助脚本没有移植（插件不执行外部脚本，见 ADR 0010）。方法本身与术语沿用原文。

## 改动约定

这些都是**数据**，不是代码。内容调整直接改 Markdown，然后跑 `npm run references`
重新生成 `src/reference/library.generated.ts`；忘了重跑，测试里的条目数断言会红。

原始项目版权归各自作者所有，分别依 Apache License 2.0 与 MIT 使用；本插件对其内容有改动时以本目录为准。
