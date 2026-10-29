# 麻花小说网

[English](README.md) · 中文

Astravia 里的多智能体写作工作区插件。对话留在宿主，书留在插件里。

它和「让模型直接写一本小说」的区别只有一条：**进度是算出来的**。一个纯函数路由读作品当前状态，
返回下一步归谁、做什么、为什么。智能体执行这条指令，没有人能自己宣布「这章写完了」。

## 装完看到什么

侧栏多一个入口 **麻花小说网**。它与激活页互斥：凭证有效时看到它，凭证无效时只有激活页，
任何时候都只有一个是可见的。

工作区有四层，全部在面板内，没有一层是聊天框：

| 层 | 是什么 |
| --- | --- |
| 书架 | 封面网格 + 最近更新行；空架时说明这是什么、接下来怎么开始 |
| 书库 | 目录页：横版长条卡（封面、题材、阶段、章数、字数、简介、更新时间）；可按题材 / 状态 / 篇幅筛选，按最近更新 / 章节数 / 书名排序，每页 9 张 |
| 书页 | 封面、阶段、四人成员条、路由出的下一步、章节目录 |
| 阅读页 | 通栏正文、上一章 / 下一章、五档字号 |

每本书都有一张真正的默认封面，不是占位符：内联 SVG，母题与深浅由书 id 推出来，所以同一本书每次
看到的一样、不同的书看起来不一样。不引位图、不发网络请求、不写死颜色。

## 团队

插件注册一个团队 **麻花写作团队**，四个成员：

| 角色 | 负责 | 不能做 |
| --- | --- | --- |
| 架构师 | 一句话简介、卷、弧、逐章一句话章纲 | 判定某一章是否过审 |
| 写手 | 章节正文、按必改项修订 | 提交、重编号、改动已提交的章 |
| 编辑 | 七维评分、必改清单、通过 / 打回 | 重写正文、调整及格线 |
| 仲裁 | 前提冲突、僵局、作者裁定的记录 | 规划、写作、发明第四种场景 |

第五个角色是引擎：提交、收弧、完本。这些步骤不需要模型。

团队还带两套技能：`novel-craft`（场景、钩子、对白、伏笔、行文清洁）与 `longform-continuity`
（滚动规划、一致性、摘要、按角色推进）。它们在 `agent/skills/` 里按需加载，由路由提示词决定
一个任务该用哪一套。

视图里没有输入框：工作区只回答「这本书现在在哪、下一步是什么」，写作发生在宿主自己的对话页，
因为智能体、流式输出与工具调用本来就在那里（ADR 0008）。

## 工具面

36 个工具，全部以 `mahua_` 开头。读工具不要凭证；24 个写工具永远要，而且门禁只在服务层判一次。

| 组 | 工具 |
| --- | --- |
| 读 | `list_books`、`book_status`、`next_instruction`、`read_chapter`、`audit_foundation`、`premise_structure`、`check_consistency`、`check_rules`、`check_threads`、`style_stats`、`context`、`reference` |
| 前提与规划 | `accept_brief`、`save_foundation`、`set_user_rules`、`save_plan`、`save_outline`、`revise_outline`、`plan_chapter`、`expand_next_arc`、`flag_outline_feedback`、`resolve_outline_feedback` |
| 起草 | `create_book`、`start_drafting`、`save_chapter`、`edit_chapter`、`save_arc_summary`、`save_volume_summary` |
| 伏笔 | `flag_thread`、`close_thread`（台账仅有的两个写入口） |
| 裁定 | `save_review`、`commit_chapter`、`close_arc`、`finalize`、`reopen_book`、`arbitrate` |

所有工具只返回事实：下一步永远来自 `mahua_next_instruction`，不来自上一次写操作。

## 数据放在哪

都在插件存储里，一个关注点一个位置：

```
books/index.json        书库页读的目录（不为每张卡片读一次文件）
books/<id>/book.json    作品本体：前提、卷弧、章节、摘要、进度
books/<id>/chapters/N.md
books/<id>/reviews/N.json
threads/<id>.json       伏笔台账：埋点章、承诺回收章、轻重、状态
decisions/<id>.jsonl    仲裁与反馈裁定，追加式
entitlement.json        已激活的凭证
```

一次推进就是一次提交：正文、章节状态、目录一起落地，不会出现「正文写了但状态没变」。台账与作品
在同一次提交里写，所以伏笔不会落在它所服务的稿件后面。

## 开发

```bash
npm install
npm run references # 从 agent/ 重新生成 src/reference/library.generated.ts
npm run check      # tsc --noEmit
npm test           # vitest：路由、状态机、凭证、服务层、书库、台账、守卫
npm run build      # dist/ + release/mahua-writing-team-0.2.0.astraviapkg
npm run validate   # 用宿主自己的 manifest 解析器校验 plugin.json
```

`@astravia-org/*` 这套 SDK 没有发布到公开 registry。`package.json` 声明版本范围；本机的锁文件把它
解析到 `.tooling/` 下的本地检出，构建期间由 `scripts/marketplace.mjs` 临时改写。两处都不要手改。

## 凭证

`nw1.<base64url(claims)>.<base64url(ed25519 sig)>`，用 `src/entitlement/trusted-keys.ts` 里的公钥
离线验签。随包附带社区凭证，装完即可用。门禁保护的是本插件自己的写工具，不是版权执法——激活页
上也是这么写的。

## 许可与来源

MIT。`agent/` 下的工艺库移植自 [ainovel-cli](https://github.com/)（Apache-2.0），并改编自
novel-master（MIT）；逐文件的归属与改动见 `agent/references/ATTRIBUTION.md`。架构上的每个决定都在
`../../docs/adr/ainove-cli/` 里逐条记录。
