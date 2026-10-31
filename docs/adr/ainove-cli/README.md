# 麻花小说网（`mahua-writing-team`）决策记录

现行结论是 **十篇**，在 [`current/`](./current/) 下。`0001`–`0029` 原样保留，作为历史档案——不删除、不改名、不重新编号。

## 怎么读

1. **想知道"现在是什么规矩"**：只读 `current/` 的十篇。每篇开头写了归并了哪几篇旧 ADR。
2. **想查"当年为什么这么定"**：按下面的表翻历史原文。历史里写的数字（工具数、locale 键数、像素值）是**当时的**事实，不是现在的。
3. **代码里看到 `ADR 00NN`**：那是历史编号，指向 `000N-*.md`。它的现行结论看表里「现在看这篇」那一列。
4. **想复现文档里的断言**：注意基线。正文描述的代码落点属于成文当时的版本；路径变了就看文末「旧路径与旧 ID 的映射」，要查当时的内容用 `git show <当时的提交>:<path>`。
5. **改了东西要留痕**：见文末「新增决策怎么加」。

## 现行决策（十篇）

| # | 文档 | 一句话 | 主要代码 |
| --- | --- | --- | --- |
| 01 | [引擎与路由](./current/01-engine-and-routing.md) | 进度只由 `routeNovel` 算，写操作只有一个入口 | `domain/novel-flow.ts`、`domain/novel-progress.ts`、`application/studio-service.ts` |
| 02 | [智能体与团队](./current/02-agents-and-team.md) | 四个角色和一支团队都是清单声明，不是代码分支 | `plugin.json`（`agent` 段）、`src/studio-members.ts`、`agent/**` |
| 03 | [工具面与能力对照](./current/03-tool-surface-and-parity.md) | 36 个工具，24 个过门禁；对照关系由 `PARITY` 表守 | `tools/**`、`application/tool-{schemas,output}.ts`、`test/manifest-guards.test.ts` |
| 04 | [对话侧与活动流](./current/04-conversation-bridge-and-feed.md) | 不造聊天界面，只做行内行、上下文区与只读事件流 | `studio-view.ts`、`hooks/use-team-reveal.ts`、`hooks/register-console-feed.ts` |
| 05 | [事实层与存储](./current/05-fact-layer-and-storage.md) | 书是文件，一次提交同批发布，`revision` 是并发基线 | `repository/**`、`domain/novel-progress.ts` |
| 06 | [长篇滚动与上下文](./current/06-rolling-plan-and-context.md) | 上下文包是滚动的锚，伏笔台账只报告不自动改 | `domain/{threads,context-pack,related-chapters}.ts` |
| 07 | [门禁与凭证](./current/07-entitlement.md) | 离线验签，读永不挡，写全挡 | `entitlement/**` |
| 08 | [入口与界面结构](./current/08-surfaces-and-entry.md) | 入口按版本变，界面结构稳定：六层 surface + 左栏降级 | `studio-tab.ts`、`studio-view.ts`、`features/workbench/**` |
| 09 | [视觉语言](./current/09-visual-language.md) | 纸：靠阴影分层，朱砂即 `primary`，墨底按钮 | `style.css`、`features/**` 的类名 |
| 10 | [包、内容与发布](./current/10-package-content-and-release.md) | 自足、身份一套、发布顺序固定 | `plugin.json`、`package.json`、`agent/**`、`scripts/**` |

十篇的分界是**一件事的完整边界**，不是目录：谁能推进进度（01）、谁在做（02）、拿什么做（03）、怎么说给人听（04）、事实存哪（05）、长篇怎么滚（06）、什么时候挡人（07）、人从哪进来（08）、看起来什么样（09）、怎么发出去（10）。

## 旧编号对照（29 篇，一篇都没删）

状态词：**现行** = 结论仍然成立；**部分现行** = 主体成立，若干细节已被后续覆盖；**已被取代** = 不要再按它做；**非目标** = 明确不做的事。

| ADR | 主题 | 状态 | 现在看这篇 |
| --- | --- | --- | --- |
| [0001](./0001-port-deterministic-engine-as-plugin-domain.md) | 移植确定性引擎 | 现行 | 01 |
| [0002](./0002-agents-and-team-as-manifest-declarations.md) | 角色与团队走清单 | 现行 | 02 |
| [0003](./0003-workspace-view-as-primary-surface.md) | 工作区视图为主面 | 已被取代 | 08（0025 起是双入口） |
| [0004](./0004-offline-entitlement-gate.md) | 离线门禁 | 现行 | 07 |
| [0005](./0005-storage-as-manuscript-ledger.md) | 存储即台账 | 现行 | 05 |
| [0006](./0006-host-tokens-only-visual-language.md) | 只用宿主令牌 | 现行 | 09 |
| [0007](./0007-tool-surface-split-and-scope-use.md) | 工具面拆分与 `scope_use` | 现行 | 03（工具数已变） |
| [0008](./0008-sidebar-agent-surface-and-conversation-bridge.md) | 侧栏界面 + 会话桥 | 部分现行 | 04（会话桥）+ 08（侧栏已废） |
| [0009](./0009-capability-parity-with-ainovel-cli.md) | 与参照项目对齐 | 现行 | 03（对照表已进测试） |
| [0010](./0010-plugin-self-containment.md) | 插件自足 | 现行 | 10 |
| [0011](./0011-workspace-anatomy-matches-host-agent-panel.md) | 与宿主面板同构 | 部分现行 | 08（结构）+ 09（样式） |
| [0012](./0012-craft-library-shipped-as-data.md) | 手艺库作为数据 | 现行 | 10 |
| [0013](./0013-bookshelf-and-reader-surfaces.md) | 书架与阅读页 | 现行 | 08 |
| [0014](./0014-rename-to-mahua-novel.md) | 改名麻花小说 | 已被取代 | 10（0018 定稿身份） |
| [0015](./0015-capability-parity-round-two.md) | 第二轮对齐 | 现行 | 03 |
| [0016](./0016-empty-shelf-and-reader-type-scale.md) | 空书架与字号 | 部分现行 | 08（空态）+ 09（字号） |
| [0017](./0017-review-round-one-global-revision-and-total-verify.md) | 全局 revision 与总验收 | 现行 | 01（并发基线）+ 07（凭证解码） |
| [0018](./0018-project-identity-mahua-writing-team.md) | 工程身份 | 现行 | 10 |
| [0019](./0019-agent-directory-and-novel-master-skills.md) | agent 目录工程化 | 现行 | 02（清单与权限）+ 10（目录规模） |
| [0020](./0020-library-surface-and-default-cover.md) | 书库层与默认封面 | 部分现行 | 08（`words`、层级）+ 09（封面） |
| [0021](./0021-thread-ledger-related-chapters-context.md) | 伏笔台账与上下文包 | 现行 | 06 |
| [0022](./0022-parity-round-three-and-explicit-non-goals.md) | 第三轮对齐与非目标 | 现行（非目标） | 03 |
| [0023](./0023-dependency-hygiene-readme-and-release-verification.md) | 依赖与发布验证 | 现行 | 10 |
| [0024](./0024-ui-round-reader-library-covers-and-activation-facts.md) | 阅读字号、封面、激活事实 | 部分现行 | 07（激活事实）+ 09（界面） |
| [0025](./0025-continue-reads-and-studio-as-activity-tab.md) | 标签页入口 | 现行（含四次补注，最后一次推翻补注三） | 08 |
| [0026](./0026-design-round-five-surfaces-and-host-tokens.md) | 五层 surface 与令牌 | 部分现行 | 09（令牌）+ 08（层数已变） |
| [0027](./0027-shell-layer-console-and-rail-degradation.md) | 外壳层与运行台 | 现行 | 08（布局与降级）+ 04（事件流） |
| [0028](./0028-cards-roster-and-activation-design-language.md) | 卡片与成员行语言 | 现行 | 09 |
| [0029](./0029-paper-language-no-hairlines.md) | 纸面语言，不描边 | 现行 | 09 |

只有两篇跨两个现行文档：`0024`（激活事实进 07、界面进 09）与 `0027`（布局进 08、事件流进 04）。它们本来就是"一次提交里两件不相关的事"，硬塞进一篇会让读者以为激活页和事件流有关系。

## 落实与偏差

文档说的和代码做的不一样时，**以代码为准**，并记在这里。基线：**已发布版本 0.4.12**（2026-10-31）。

| 文档说 | 代码做 | 证据 |
| --- | --- | --- |
| 0003：工作区视图是唯一主面 | 0.4.12 起双注册：标签页 + 整页视图（0025 补注四） | `src/studio-tab.ts`、`src/studio-view.ts`、`src/index.tsx` |
| 0025 §2：`initiallyVisible: false`，入口交给「+」可添加池 | 0.4.7 起 `true` | `src/studio-tab.ts` |
| 0026 §5：五层 surface，到 `ledger` 为止 | 六层（多 `console`，运行台接真事件流） | `src/features/workbench/workbench-pages.ts` |
| 0026 §5：阅读纸面 `max-w-[672px]` | `max-w-[648px]` | `ReaderPage.tsx` |
| 0028 §2：卡片 `border-border/60` + `shadow-sm` | 无描边 + `shadow-raise`（0029 的决定），`shadow-sm` 零命中 | `grep -rn shadow-sm src/features` → 0 |
| 0028 §6：lucide 离线不可解析，不采用 | 0.4.10 起采用：`@iconify-json/{lucide,solar}` + `@iconify/tailwind4`，类名 `icon-[lucide--*]` | `package.json`、`src/style.css` |
| 0029 §4：主按钮墨底，`bg-primary` 已收口 | `bg-ink text-surface`，`bg-primary` 零命中 | `grep -rn "bg-primary" src/features` → 0 |
| 0006 的「令牌是唯一来源」 | 0.4.10 起 `@theme inline` 纸面令牌 + 字号/圆角/投影阶梯（0006 补注） | `src/style.css` |
| 0024 §2：六张封面底版是封面主体 | 底版降为 `opacity-[0.18]` + `multiply`，五档 `CoverSize` | `shell/Cover.tsx` |
| 0027 §3 / §9：事件流只能拿五个 hook 事件 | 已接真 `model` / `ms`（`toolUseId` 配对）；上下文占用量不渲染；筛 3 页签 | `console-timeline/**`、`hooks/register-console-feed.ts` |

## 旧路径与旧 ID 的映射

`0001`–`0017` 里的代码落点、工具 ID、智能体 ID 写成它们当时的样子。0018 改名之后，这些字面量只存在于本目录的档案里——
`grep -rn novelwright abilities .astravia scripts tests` **0 命中**，活代码里没有旧名。

按 0014 §2.3 与「旧 ADR 一个字都不改」的规矩，档案不回填；读的时候按下表换算：

| 档案里写的 | 现在的位置 |
| --- | --- |
| `abilities/plugins/novelwright/` | `abilities/plugins/mahua-writing-team/` |
| `novelwright_*` | `mahua_*` |
| `novelwright-architect` / `-writer` / `-editor` / `-arbiter` | `mahua-architect` / `-writer` / `-editor` / `-arbiter` |
| `novelwright-studio` | `mahua-studio` |
| `src/features/{library,studio,shared}/**` | `src/features/workbench/**` |
| `src/studio-surfaces.ts`、`src/studio-workspace-view.ts`、`src/live-feed-hooks.ts` | `src/studio-tab.ts`、`src/studio-view.ts`、`features/workbench/hooks/register-console-feed.ts` |
| `src/application/live-feed/`、`src/features/studio/live-feed/` | `src/application/console-log/`、`features/workbench/console-timeline/` |
| `Shell` + `WindowChrome` + `SyncBar` 两层横带 | 单条 `shell/StudioMasthead.tsx`（0027 §8） |

## 这版界面重写已经发布

0.4.10 → 0.4.12 三轮把界面层整体换掉了（`docs/adr/ainove-cli/0025`–`0029` 的补注与本节一致）：

- **规模**：旧 `src/features/{library,studio,shared}/**` 删除，`src/features/workbench/**` 成为唯一界面层——`components/pages/{Shelf,Library,Book,Reader,Ledger,Console,Activation}Page.tsx` 七帧 + `components/shell/**` 外壳 + `workbench-{model,pages,feed}.ts`。
- **入口两个**：标签页 `registerStudioTab`（`studio`）+ 整页视图 `registerStudioView`（`workbench`）。`plugin.json` 的 `ui.slot.*` 权限为 `ui.slot.activity-tab` 与 `ui.slot.workspace-view` 两条。
- **视觉换底**：`src/style.css` 用 `@theme inline`（纸面 21 色、13 档字号、6 档圆角、3 档投影），`.mahua-cover[data-layer]` 切换纸色。
- **locale 473 键**（en/zh 各）。
- **状态**：`npx tsc --noEmit` 0 错，`vitest run` 11 文件 180 例全过（0.4.13 两条版面守卫，0.4.14 七条组件接线）。
- **发行**：0.4.12 `2026.10.31-3`（`20bd6f0d…fbda9768`）→ 0.4.13 `2026.10.31-4`（`240c4025…13623390`）
  → 0.4.14 `2026.10.31-5`（`474c125a…4cacc3c61a`），均为 CI 构建的 `mahua-writing-team-<版本>.astraviapkg`。


## 守住这些

```bash
cd abilities/plugins/mahua-writing-team
npm run check                        # tsc --noEmit
npm test                             # vitest run（11 个测试文件 / 180 例）
npm run build                        # 生成手艺库 + vite build
npm run validate                     # astravia-plugin validate
```

结构守卫（改代码前先看这几条会不会红）：

```bash
grep -rn "bg-accent" src/features | wc -l          # 期望 0
grep -rn "shadow-sm" src/features | wc -l          # 期望 0
node -e "const p=require('./plugin.json');console.log(p.version)"
```

域层不许有 IO、路由分支不许漏测、指令不许指向不存在的工具——这三件事分别由 `test/novel-flow.test.ts`、`test/instruction-drivability.test.ts`、`test/manifest-guards.test.ts` 守。

## 几个「不是看上去那样」

- **原 29 篇不是草稿**。它们是决策的时间序列，写的时候都对。收成十篇只是为了让"现在的规矩"读一遍就能拿到，不是宣布旧文档错了。所以旧文件一个字都没改。
- **编号不能重排**。`README.md`、`AGENTS.md`、`test/*.test.ts` 与 `src/**` 里散着几十处 `ADR 00NN` 的引用。重排编号会让这些引用指向错误的决定，而这类错误在 review 里几乎看不出来。新文档用 `01`–`10` 这个独立序列，就是为了和 `00NN` 不复用。
- **`current/` 不是快照，是现行文本**。代码变了要改它；旧 ADR 不跟着改。
- **十篇不是十个模块**。`current/08` 覆盖七篇旧 ADR，是因为这七篇讲的是同一件事（人从哪个门进来、进来看到几层），不是因为它们讲的模块相同。
- **"工作树里的 0.4.10"不在结论里**。它没合入，随时可能变；把它写进正文会让文档描述一个不存在的版本。所以它在上面单独留一节，只记录实测数字。

## 证据等级

每篇文档里的断言都标了三档之一：

- **Observed** — 跑了命令、读了源码，看得见。
- **Inferred** — 从看见的东西推出来的，没直接验证。
- **Assumed** — 两者皆无，只是设计意图。视觉尺寸与层次在应用内的真实表现属于这一档：`vitest.config.ts` 固定 `environment: "node"`，工程里没有 jsdom / testing-library，没有组件级渲染验证。

## 新增决策怎么加

| 情况 | 怎么做 |
| --- | --- |
| 只是把现行约定写清楚、或修正措辞与数字 | 直接改对应 `current/NN`，在文件头补一行改动日期与依据 |
| 换了一个做法（会推翻现有结论） | 新开 `docs/adr/ainove-cli/0030-<slug>.md`，从 `0030` 起往后编，**不复用旧号** |
| 旧 ADR 被新 ADR 取代 | 在新 ADR 里写清取代谁；把本 README 的状态表改成「已被取代」并指向新文档 |

新 ADR 只写四件事：**当时的事实、决定了什么、代价是什么、怎么验证**。不要复述实现细节——那些会过期，代码不会骗人。
