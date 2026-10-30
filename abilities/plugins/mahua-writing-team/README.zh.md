# 麻花小说网

[English](README.md) · 中文

Astravia 里的多智能体写作工作区插件。对话留在宿主，书留在插件里。

它和「让模型直接写一本小说」的区别只有一条：**进度是算出来的**。一个纯函数路由读作品当前状态，
返回下一步归谁、做什么、为什么。智能体执行这条指令，没有人能自己宣布「这章写完了」。

## 装完怎么开始

在 Astravia 的**能力 → 市场**里装 **麻花小说网**，然后打开一次激活页。书不是在表单里建的，是在
对话里起的：说清想写什么，和团队把一句话简介定下来，架构师从那里铺卷与弧。

## 装完看到什么

侧栏不新增任何入口。工作台是**活动面板里的一枚标签**：打开面板的 **+** 菜单，在「可添加插件面板」
里选 **麻花小说网**，它就停成一张标签页。标签一直在——凭证无效时它显示激活面板而不是书架，
所以同一枚标签既是入口也是回退。

工作区有五层，全部在面板内，没有一层是聊天框：

| 层 | 是什么 |
| --- | --- |
| 书架 | 封面网格 + 最近更新行；空架时说明这是什么、接下来怎么开始 |
| 书库 | 目录页是文字台账：一行一本书（书名、阶段、题材、已完稿 / 目标、字数、更新时间、进度条）；可按题材 / 状态 / 篇幅筛选，按最近更新 / 章节数 / 书名排序，每页 9 行。面板变窄时列逐根收起，书名与整行点击区永远在 |
| 书页 | 页头是书名、阶段与路由出的下一步；左栏是当前弧的进度条带、指令卡、最近发生；右栏是目录、账本入口与四人成员条 |
| 阅读页 | 工具条（返回、章号、字数、宋体 / 黑体、目录）、672px 正文列、宽面板下右侧七维评审栏、底栏上一章 / 下一章与五档字号 |
| 伏笔账本 | 未回收 / 逾期 / 未回收率与总数、一行一笔伏笔、体检问题、只追加的决策日志、一致性体检 |

书页上的**继续阅读**只翻页：打开阅读页、跳到路由指出的那一章，没有任何副作用。要进对话的那步
是旁边单独一颗**在对话里继续**——那一页只有它会发 prompt。两颗都在页头；**复制稿件**在目录栏底部
与成员条并排，因为标签没有宿主页头可挂。

每本书都有一张真正的默认封面，不是占位符：随包内联六张公有领域水墨山水（克利夫兰艺术博物馆，CC0）
的 base64 位图，每本书按 id 选一张底版加一档墨色浓淡，所以同一本书每次看到的一样、不同的书看起来不一样。
底版先转灰度再 `multiply` 到宿主的 `accent` 上，封面只用主题自己的主色：不引入第二种颜色、不发网络请求。

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

## 一章是怎么走完的

`mahua_next_instruction` 由存储的事实算出来，不由上一句话决定。存的是两层：作品的**阶段**与每章
的**状态**。

| 阶段 | 谁推进到这一步 | 什么时候离开 |
| --- | --- | --- |
| `briefing` | `mahua_create_book` | 简介被接受 |
| `planning` | `mahua_accept_brief` | 有了带弧的卷 |
| `drafting` | 书页上的开始按钮（`mahua_start_drafting`） | 评审打回 → `revising`；提交撞上目标或正好收弧 |
| `revising` | 分数没过线、或必改项非空的评审 | 章节被提交 |
| `arc_close` | 一弧的最后一章提交了 | 弧摘要落盘并 `mahua_close_arc` |
| `completed` | 已提交章数到达目标 | 只有 `mahua_reopen_book` 能重开 |

章节自身是 `planned → drafting → reviewed → committed`，判定不可提交时落在 `blocked`。

一章是九次调用，顺序固定：`mahua_context` → `mahua_read_chapter`（上一章）→ `mahua_plan_chapter`
→ `mahua_save_chapter` → `mahua_check_consistency` + `mahua_check_rules` + `mahua_flag_thread` →
`mahua_save_review` → `mahua_commit_chapter`。

及格线是契约不是心情：七维加权 72 分**且**必改清单为空。低于它这一章就是 `blocked`，
`mahua_commit_chapter` 会拒绝——正文存在不等于章已提交，只有 `committedCount` 会动。

阶段还停在 `planning`、章纲已覆盖目标时，路由返回 `null`。那是书在等作者，不是出错：开第一章是
人做的决定。

## 上下文包里有什么

`mahua_context` 是智能体在读书之前唯一要调的一次。它按固定顺序给出事实包，这个顺序就是建议的
阅读顺序：

| 部分 | 为什么在这 |
| --- | --- |
| `phase`、`foundation` | 这本书已经许下的承诺：前提、终局、禁忌 |
| `cast` | 一致性检查真正依凭的名单 |
| `arc` | 当前弧的目标：这一章必须动什么 |
| `previous` | 上一已提交章的收尾句：语气要接得上 |
| `openThreads` | 已埋未收，以及当初承诺在第几章收 |
| `relatedChapters` | 最多六条值得回读的旧章，每条带理由 |
| `summaries` | 弧 / 卷摘要，只在写跨越边界的章时读 |
| `openFeedback`、`styleSample` | 未处理的章纲异议，与文风样本 |

只有 `relatedChapters` 与 `summaries` 允许「这次不读」。伏笔、收尾句、弧目标缺任何一项，就是在等
一个事实错误发生。

上游分四级压缩长篇对话，因为它拥有整个会话；本插件不拥有会话，会话在宿主手里。所以它只负责把
事实包按该读的顺序排好，压缩交给宿主。

## 滚动规划与伏笔台账

一卷 2–4 弧，一弧 3–8 章；只有近处几弧带逐章章纲，计划用完时由 `mahua_expand_next_arc` 追加下一
弧。书往哪走，写在 `foundation.ending` 与每卷的 `goal`、`hook` 里。上游把这组字段叫指南针，并在
每个卷边界重写；这里是三个只有架构师会写的字段。

伏笔是台账，不是备注。`mahua_flag_thread` 记下埋在哪一章、承诺在第几章回收、轻重哪一档；
`mahua_close_thread` 是唯一结清方式，而且刻意做成独立的一次写——一次夹在正文修改里悄悄完成的
回收，是记账造假。`mahua_check_threads` 只报到期未收与未收率，域层不内置阀值。

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

## 提示词在哪，为什么分四处

四处文本、四种生命周期。把它们混在一起是弄壪这个插件最快的方式，所以一直分开：

| 文件 | manifest 通道 | 谁读 | 何时 |
| --- | --- | --- | --- |
| `agent/prompts/routing.md` | `agent.systemPrompt.promptPaths` | 每个会话 | 常驻，对所有项目生效——所以有 12 KB 预算守卫 |
| `agent/agents/*.md` | `agents[].systemPromptPath` | 那一个智能体 | 它活跃时，在不在团队里都一样 |
| `agent/prompts/team-workflow.md` | `teams[].workflowPath` | 团队 | 只在团队内 |
| `agent/prompts/briefs/*.md` | `teams[].members[].instructionsPath` | 那一个成员 | 只在团队内 |

`agent/agents/writer.md` 与 `agent/prompts/briefs/writer.md` 不是重复。前者是写手的系统提示词：
声音、方法、绝对不能做什么；后者只在这个团队里存在：先调哪个工具后调哪个、交接行怎么写、出事怎么
上报。编辑同样分两层。

`agent/skills/**` 是第五处（`skillPaths`），只在任务需要时按需加载。`agent/styles/*.md` 与
`agent/voice.md` 根本不是提示词：`scripts/build-reference-library.mjs` 把它们和技能参考一起编进
`src/reference/library.generated.ts`，也就是 `mahua_reference` 返回的东西。
`agent/references/ATTRIBUTION.md` 没有任何地方加载，它只是出处说明，也带着上游提示词到这四个文件
的对照表。

## 开发

```bash
npm install
npm run references # 从 agent/ 重新生成 src/reference/library.generated.ts
npm run check      # tsc --noEmit
npm test           # vitest：路由、状态机、凭证、服务层、书库、台账、守卫
npm run build      # dist/ + release/mahua-writing-team-0.4.3.astraviapkg
npm run validate   # 用宿主自己的 manifest 解析器校验 plugin.json
```

`@astravia-org/*` 这套 SDK 没有发布到公开 registry。`package.json` 声明版本范围；本机的锁文件把它
解析到 `.tooling/` 下的本地检出，构建期间由 `scripts/marketplace.mjs` 临时改写。两处都不要手改。

## 凭证

`nw1.<base64url(claims)>.<base64url(ed25519 sig)>`，用 `src/entitlement/trusted-keys.ts` 里的公钥
离线验签。随包附带社区凭证，装完即可用。门禁保护的是本插件自己的写工具，不是版权执法——激活页
上也是这么写的。

激活页还会说清**现在用的是谁的凭证**：你贴的那份过期或格式不对时，它显示拒绝原因并注明正在使用
随包社区凭证，而不是只报一句「已激活」；「移除我的凭证」会丢掉你那份、显式回落到社区凭证。

## 这些事本插件不做

上游 CLI 与本插件共享设计，不共享功能表。下列各项在这里没有对应物，假装有才是更有害的选择：

| 上游 | 这里 |
| --- | --- |
| `/import` 把一本已完成的小说导入（四段提示词管线） | 没有。书从简介开始，没有任何工具带导入路径 |
| `/sync` 接纳手改正文，并由模型重建摘要与事实 | `mahua_edit_chapter` 只对**未提交**章做一处替换或追加，并重算规则型章节事实；已提交章直接拒绝 |
| `/simulate` 用一批语料合成仿写画像 | `mahua_create_book` 只收一段 `styleSample`，随每个上下文包带上；没有语料分析，也没有画像文件 |
| `/diag` 诊断报告 | `mahua_style_stats`、`mahua_check_consistency`、`mahua_check_threads` 只给事实，不写报告 |
| 按角色配专属模型与 Provider | 模型归宿主。manifest 里四个智能体没有 `model` 字段，插件也从不接触密钥 |
| `curl … install.sh` 一键安装 | 分发就是市场包 |
| 导出为其它格式 | 稿件就是插件存储里的 Markdown，没有导出器 |

## 许可与来源

MIT。`agent/` 下的工艺库移植自 [ainovel-cli](https://github.com/voocel/ainovel-cli)（Apache-2.0），并改编自
novel-master（MIT）；逐文件的归属与改动见 `agent/references/ATTRIBUTION.md`。架构上的每个决定都在
`../../docs/adr/ainove-cli/` 里逐条记录。
