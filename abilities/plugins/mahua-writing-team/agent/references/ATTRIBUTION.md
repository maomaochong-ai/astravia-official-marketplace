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

## 默认封面底版（图片素材）

`src/features/library/covers.generated.ts` 里的 6 张底版来自 **Cleveland Museum of Art Open Access**，
全部标记为 **CC0 1.0（公有领域贡献）**，不需要署名，此处仍记录出处以便复核：

| # | 馆藏号 | 标题 | 年代 | 许可 |
| --- | --- | --- | --- | --- |
| 1 | 1955.36 | Landscape after Guo Zhongshu | c. 1680–1705 | CC0 |
| 2 | 1976.59 | Haboku (Flung-ink) Landscape | c. 1510 | CC0 |
| 3 | 1955.302.2 | Album of Seasonal Landscapes | 1668 | CC0 |
| 4 | 1955.302.7 | Album of Seasonal Landscapes | 1668 | CC0 |
| 5 | 1999.216.1 | Herdboys and Buffalo in Landscape | 1200s | CC0 |
| 6 | 1954.583 | Landscape after Ni Zan | 1707 | CC0 |

取图与加工方式：`https://openaccess-cdn.clevelandart.org/<馆藏号>/<馆藏号>_web.jpg`
（`_print.jpg` 全部 404）→ `sips` 缩到 240×312（10:13）→ JPEG q55 → base64 内联进模块。
除裁切与压缩外没有改动画面；运行时的灰度与 `multiply` 是 CSS 效果，不改素材本身。

更换底版时：按同一顺序替换数组元素、保持 `COVER_PLATES.length` 与 `coverVariant` 的 `plate` 模数一致，
`test/library.test.ts` 断言 plate 覆盖 `0..length-1`，漏改会直接红。


## 提示词通道与上游对照

上游 `assets/prompts/` 是 **CLI 运行时的 Worker 提示词**：它们直接绑定 `novel_context` 这一个产品里唯一的上下文工具,
并且假定输出会被 Go 侧的 Engine 消费。本插件的提示词绑定的是宿主的四条 manifest 通道与 `mahua_*` 工具面,
所以不能按文件 1:1 平移，只能按**角色与所有权**对齐：

| 上游文件（字符数） | 本插件 | 差异 |
| --- | --- | --- |
| `architect-long.md` (10149) | `agents/architect.md` | 卷 2–4 弧 / 弧 3–8 章与章纲字段是本插件的合同，不是上游的 |
| `architect-short.md` (3740) | `agents/architect.md` | 短篇不单开文件：由 `mahua_create_book#targetChapters` 与卷弧数量决定形状 |
| `writer.md` (2631) | `agents/writer.md` + `prompts/briefs/writer.md` | 上游一篇兼管方法与调用顺序；这里拆成「角色人格」与「团队任务简报」 |
| `editor.md` (5708) | `agents/editor.md` + `prompts/briefs/editor.md` | 七维与权重进系统提示词，交付纪律进简报 |
| `arbiter-failure.md` (790) | `prompts/team-workflow.md` 的升级段 + `agents/arbiter.md` | 失败两次的上报路径属于工作流，裁定本身属于仲裁 |
| `arbiter-intervention.md` (3136) | `mahua_arbitrate` 的 `user-intervention` 场景 | 干预是一个封闭枚举参数，不是一篇独立提示词 |
| `arbiter-plan-start.md` (498) | `mahua_create_book#targetChapters` | 「选短篇还是长篇」变成作者给的章数，不消耗一次裁定 |
| `revision-analyze.md` (467) | `mahua_edit_chapter`（部分） | 只有规则型章节事实重算，没有摘要 / 时间线 / 关系 / 状态记忆的模型重建 |
| `simulation-source.md` (118) / `simulation-merge.md` (158) | `mahua_create_book#styleSample` + `styles/**` + `voice.md` | 一段样本 + 静态文风库，没有语料画像，也没有画像文件 |
| `import-segment.md` / `import-analyze.md` / `import-range.md` / `import-synthesize.md` | 无 | 没有导入管线（ADR 0022），不提供占位文件 |

目前不搬的四篇 `import-*` 与只搬了一半的 `revision-analyze` 都写在 README 的「这些事本插件不做」里，
以免读者把「没有这个文件」误读成「这个功能坏了」。
