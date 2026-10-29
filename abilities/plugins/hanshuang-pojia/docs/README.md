# 工程文档目录

> 这份索引回答两件事：**要改某处该读哪篇**、**一份文档该放哪**。
> 使用者读的手册不在这里——它们随包发布，见下文「不在 `docs/` 里的东西」。

## 按功能域找（先看这张表）

每个功能域一个目录，目录里固定两份：`usage.md`（怎么用：什么时候用它、会拿到什么、分寸在哪、坑在哪）
和 `dev.md`（怎么改：代码入口、实现约定、失败怎么读、测试在哪）。

| 功能域 | 一句话 | 用 | 改 |
| --- | --- | --- | --- |
| 静态体检 / 反汇编 | 这是什么、里面有什么、这个函数在干什么 | [usage](domains/triage-and-disasm/usage.md) | [dev](domains/triage-and-disasm/dev.md) |
| Android / APK | DEX 索引、反编译、签名、动态脱壳 | [usage](domains/android/usage.md) | [dev](domains/android/dev.md) |
| 案卷 / 先例 / 战例工程 | 一次评估怎么立项、留证、交付 | [usage](domains/cases/usage.md) | [dev](domains/cases/dev.md) |
| 知识库与检索 | 292 篇随包文档、清单、payload 种子 | [usage](domains/knowledge/usage.md) | [dev](domains/knowledge/dev.md) |
| 工具链 / 权限 / 宿主边界 | 探测、装什么、哪些事要宿主批准 | [usage](domains/toolchain-and-limits/usage.md) | [dev](domains/toolchain-and-limits/dev.md) |
| 对话侧注入 | 路由、形态读数、等价入口、提示词母本 | [usage](domains/dialogue-and-routing/usage.md) | [dev](domains/dialogue-and-routing/dev.md) |
| 报告 / 版本 / 发布 | 四节报告、bump、市场构建 | [usage](domains/reporting-and-release/usage.md) | [dev](domains/reporting-and-release/dev.md) |
| 工作台面板 | 17 页界面、状态、自检页 | [usage](domains/workbench-panel/usage.md) | [dev](domains/workbench-panel/dev.md) |
| 外部 MCP 服务器 | 插件不需要 MCP；IDA / 浏览器 / JS 逆向要不要装 | [usage](domains/mcp-and-external-servers/usage.md) | [dev](domains/mcp-and-external-servers/dev.md) |

`usage.md` 面向「装了插件要拿它干活的人」，讲触发方式、产出形状、什么时候够用什么时候不够。
`dev.md` 面向「改这个域的人」，讲代码入口、约定与测试。两份都**不含版本号**，也不记某一天的排查过程。

## 按权威性找（第二根轴）

模块是「按功能」；下面这张表是「按能不能被信任」——两者不冲突，一篇文档同时属于一个模块和一类权威。

| 目录 | 收什么 | 谁读 | 会不会过期 |
|---|---|---|---|
| `domains/` | 按功能域的两份：`usage.md` 怎么用 / `dev.md` 怎么改 | 使用者 + 改代码的人 | 功能变了就改 |
| `contract/` | 必须遵守的规则 | 改代码、写案例的人 | 改规则时同步改 |
| `reference/` | 当前事实的权威表 | **代码与测试直接读** | 事实变了就必须改 |
| `audits/` | 带版本与时点的一次性报告 | 人 | 会，标题里写着版本 |
| 仓库根 `docs/adr/hanshuang-pojia/` | 已采纳的决策 | 改代码的人 | 正文不改写；现状由文末「实现核对」节追加 |

分类轴是**拿它干什么**，不是主题。「工具链」一个主题就横跨三类：`reference/toolchain-parity.md` 是当前
事实表（测试读它），`audits/toolchain-bundling.md` 是 2.8.0 那天的观察，ADR 0003 是当时怎么决定的。
三者过期方式不同，混在一起就会在改代码时误信旧报告。

## `contract/` — 必须遵守的

- [case-library.md](contract/case-library.md) — 案件契约与战例库。上游 `case-init.ps1` 的九节契约怎么由
  `init_task` 逐节产出、先例机制的三个来源怎么分工、`search_cases` 怎么排序。**改案件相关代码前读这一篇。**
- [case-corpus.md](contract/case-corpus.md) — 案例语料编写契约。新增一个先例包要交哪些文件、哪些东西
  不能进语料、`signals` 怎么写、自检命令是什么。**写案例的人读这一篇，不用读代码。**

## `reference/` — 当前事实

- [toolchain-parity.md](reference/toolchain-parity.md) — 42 项工具逐条判定：探测（占一个授权位）、建议
  （零权限）、不做（写明原因）。**唯一被测试当数据读的文档**：`src/test/tool-index.test.ts` 打开它数
  三档行数，跟 `tool-index.json` 对账。改这里要同时改 catalog 与 json，三者不一致会红。
- [prompt-templates.md](reference/prompt-templates.md) — 可直接粘贴的提问模板（lab 前缀、占位符规则、
  哪些问法不改变判定）。

## `audits/` — 写在那一天的结论

读之前先看标题里的版本号：它们记录的是当时的对照结果，之后版本前进了，结论可能已经不成立。

- [toolchain-bundling.md](audits/toolchain-bundling.md) — 2.8.0：插件到底带不带工具链，与 2.0 便携版逐项对照。
- [upstream-parity-audit-2.9.3.md](audits/upstream-parity-audit-2.9.3.md) — 2.9.3：能力对等全量审计。
  部分结论已被 [ADR 0006](../../../../docs/adr/hanshuang-pojia/0006-case-contract-v2-and-precedent-library.md) 补正。
- [upstream-ui-parity-2.9.8.md](audits/upstream-ui-parity-2.9.8.md) — 2.9.8：界面与实时面板对等审计。
- [win-defender-triage-2.9.8.md](audits/win-defender-triage-2.9.8.md) — 2.9.8：Defender 报毒的定性排查，
  顺带记了 2.9.6 文档加载机制的返工（`import.meta.glob` → 纯文本静态资源）。
- [skill-registration-2.13.md](audits/skill-registration-2.13.md) — 2.13：技能「未注册」排查，
  结论是注册正常、运行的是旧版本。
- [refusal-scope-router.md](audits/refusal-scope-router.md) — 2.13.1：「范围路由」写成划界的一次错误设计，**已推翻**，
  取代者是 `src/domain/target-shape.ts`（只读形态、只附加入口）。
- [capability-gap-2.13.1.md](audits/capability-gap-2.13.1.md) — 2.13.1：便携包基线下的能力缺口、僵尸代码处置、
  路由覆盖 44/39。**基线口径已被下一篇取代，结论仍有效。**
- [upstream-parity-2.14.0.md](audits/upstream-parity-2.14.0.md) — 2.14.0：改用**上游整体项目**（310MB 分发树）作基线，
  拆账 300MB 第三方资产、31 个脚本逐个归宿、14 条战例工程的跨 OS 落地方式。当前的主对等报告。
- [capability-comparison-2.14.0.md](audits/capability-comparison-2.14.0.md) — 2.14.0：上游逐能力点对等表，
  每行只有「对等 / 更强 / 有意不对等 / 不适用」四种结论，不对等的都写了理由。
- [completion-2.14.0.md](audits/completion-2.14.0.md) — 2.14.0：13 条要求的落点、三处卡点的改法、
  验证矩阵与仍保留的差异。**要判断「这次到底改完了没有」看这一篇。**

新增一篇照同样写法：**文件名或首行带版本，正文第一段写清时点、被测对象、对比对象**。别写成「当前状态」——
那种东西属于 `domains/*/dev.md` 或 `reference/`。

## ADR 与 `plans/`

ADR **不在这个目录里**：2026-10-27 起统一放在仓库根 `docs/adr/hanshuang-pojia/`，与 `open-ai-canvas`、
`qiushi-skill` 的 ADR 并列，一个插件一个子目录。一条决策一个文件，编号递增，已采纳的**正文不改写**；
要推翻就新写一条并注明取代关系。与当前实现对齐的部分写在每篇文末的「实现核对」节，带核对版本与可重跑
命令——这样「当时怎么定的」和「现在是什么样」不会互相冒充。

索引在 [`docs/adr/hanshuang-pojia/README.md`](../../../../docs/adr/hanshuang-pojia/README.md)：九篇的主题、
状态、落实与偏差都在那里，别靠编号猜。2026-10-27 已按 **2.11.0** 逐篇核过一轮，其中 ADR 0001 的 D4、D9
被实现反转且尚无新 ADR，看那两篇时以文末核对节为准；同日新增 ADR 0009（授权晚到与门禁落盘）。

`plans/` 是 2.0 对标时期的施工计划，工作完成即失效，保留只为追溯当时怎么排的；**不要在这里加新计划**。

## 不在 `docs/` 里的东西

- **使用者手册**：`src/content/docs/manual/`（含 [PANEL-HANDBOOK.md](../src/content/docs/manual/PANEL-HANDBOOK.md)
  面板 17 页逐页说明，以及部署、反调试、IDA、合规中继等）。它们随 `.astraviapkg` 发布，面板「文档」页
  按需 fetch。`docs/` 下的工程文档**不进包**——随包只发 `dist/`，所以给使用者看的东西必须放在
  `src/content/docs/` 下才有机会被读到。
- **知识库 / 工具文档 / 案例原文**：`src/content/docs/{kb,kit-docs,cases}/`，由 `scripts/sync-docs.mjs`
  建索引、`src/features/workbench/services/docs.ts` 在运行期读取。
- **含绝对用户路径的排查记录**：一律留在 `docs/`。`scripts/lib/precedent-package.mjs` 的 `ABSOLUTE_PATH`
  会把 `src/content/docs/` 下带 `/Users/…` 或 `C:\Users\…` 的正文判为不合格，迁过去就直接失败。

## 新增一篇时怎么放

1. 它讲的是**某个功能现在怎么用 / 怎么做**？→ `domains/<域>/` 的 `usage.md` 或 `dev.md`，并在上面的域表里挂一行。
2. 它是**必须遵守的规则**，还是**在某个版本上观察到的结果**？规则 → `contract/`；观察 → `audits/`（带版本号）。
3. **代码或测试会读它吗？** 会 → `reference/`，必须贴着解析它的那段代码写，改动一起改。
4. 只有**做决定的时候**才需要看？→ 仓库根 `docs/adr/hanshuang-pojia/`（不在本目录）。
5. 都不像，而且读者是「装了插件不知道怎么用」的人 → `src/content/docs/manual/`，不属于这里。

## 迁移记录

2026-10 按权威性重排过一次；2026-10-29 加了一层「按功能域」的导览；同日把 `modules/*.md` 整成
`domains/<域>/dev.md`，并给每个域补了 `usage.md`。

| 旧路径 | 新路径 |
|---|---|
| `docs/case-library.md` | `docs/contract/case-library.md` |
| `docs/case-corpus.md` | `docs/contract/case-corpus.md` |
| `docs/toolchain-parity.md` | `docs/reference/toolchain-parity.md` |
| `docs/toolchain-bundling.md` | `docs/audits/toolchain-bundling.md` |
| `docs/upstream-parity-audit-2.9.3.md` | `docs/audits/upstream-parity-audit-2.9.3.md` |
| `docs/upstream-ui-parity-2.9.8.md` | `docs/audits/upstream-ui-parity-2.9.8.md` |
| `docs/win-defender-triage-2.9.8.md` | `docs/audits/win-defender-triage-2.9.8.md` |
| `docs/ui-handbook.md` | `src/content/docs/manual/PANEL-HANDBOOK.md`（随包发布） |
| `docs/adr/0001…0007-*.md` | `docs/adr/hanshuang-pojia/0001…0007-*.md`（仓库根，2026-10-27 搬家） |
| （插件内无对应文件） | `docs/adr/hanshuang-pojia/0008-runnable-case-corpus.md`（初拟编号 ADR 001，搬家时统一为 0008） |
| `docs/modules/<域>.md`（9 篇） | `docs/domains/<域>/dev.md`，并新增 `docs/domains/<域>/usage.md` |
