# 工程文档目录

> 这份索引只回答两件事：**一份文档该放哪**、**要改某处该读哪篇**。
> 使用者读的手册不在这里——它们随包发布，见下文「不在 `docs/` 里的东西」。

## 为什么这样分

这里曾经平铺着 8 篇 Markdown，混了四类性质完全不同的东西：必须遵守的契约、测试会当数据读的权威表、
写在某一天的排查记录、给使用者看的操作手册。名字又都像「某主题的报告」，于是谁也不比谁显眼。

分类轴是**拿它干什么**，不是主题。「工具链」这一个主题就横跨三类：`toolchain-parity.md` 是当前事实表
（测试读它），`toolchain-bundling.md` 是 2.8.0 那个时点的观察，ADR 0003（仓库根 `docs/adr/hanshuang-pojia/`）是当时怎么决定的。
三者过期方式不同，混在一个目录里就会在改代码时误信旧报告。

| 目录 | 收什么 | 谁读 | 会不会过期 |
|---|---|---|---|
| `contract/` | 必须遵守的规则 | 改代码、写案例的人 | 改规则时同步改这里 |
| `reference/` | 当前事实的权威表 | **代码与测试直接读** | 事实变了就必须改 |
| `audits/` | 带版本与时点的一次性报告 | 人 | 会，标题里写着版本 |
| 仓库根 `docs/adr/hanshuang-pojia/` | 已采纳的决策 | 改代码的人 | 正文不改写；现状由文末「实现核对」节追加 |
| `plans/` | 历史施工计划 | 人 | 已被 ADR 取代，只作追溯 |

## `contract/` — 必须遵守的

- [case-library.md](contract/case-library.md) — 案件契约与战例库。上游 `case-init.ps1` 的九节契约怎么由
  `init_task` 逐节产出、先例机制的三个来源怎么分工、`search_cases` 怎么排序。**改案件相关代码前读这一篇。**
- [case-corpus.md](contract/case-corpus.md) — 案例语料编写契约。要新增一个先例包时交哪些文件、哪些东西
  不能进语料、`signals` 怎么写、自检命令是什么。**写案例的人读这一篇，不用读代码。**

## `reference/` — 当前事实

- [toolchain-parity.md](reference/toolchain-parity.md) — 42 项工具逐条判定：探测（占一个授权位）、建议
  （零权限）、不做（写明原因）。**唯一被测试当数据读的文档**：`src/test/tool-index.test.ts` 直接打开它数
  三档行数，跟 `tool-index.json` 对账。改这里要同时改 catalog 与 json，三者不一致会红。

## `audits/` — 写在那一天的结论

读之前先看标题里的版本号：它们记录的是当时的对照结果，之后版本前进了，结论可能已经不成立。

- [toolchain-bundling.md](audits/toolchain-bundling.md) — 2.8.0 时点：插件到底带不带工具链，与 2.0 便携版
  逐项对照（含体积、安装形态）。
- [upstream-parity-audit-2.9.3.md](audits/upstream-parity-audit-2.9.3.md) — 2.9.3 时点：能力对等的全量审计。
  部分结论已被 [ADR 0006](../../../../docs/adr/hanshuang-pojia/0006-case-contract-v2-and-precedent-library.md) 补正。
- [upstream-ui-parity-2.9.8.md](audits/upstream-ui-parity-2.9.8.md) — 2.9.8 时点：界面与实时面板对等审计。
- [win-defender-triage-2.9.8.md](audits/win-defender-triage-2.9.8.md) — 2.9.8 时点：Defender 报毒的定性排查。
  顺带记了 2.9.6 文档加载机制的返工（`import.meta.glob` → 纯文本静态资源）。

新增一篇照同样写法：**文件名或首行带版本，正文第一段写清时点、被测对象、对比对象**。别写成「当前状态」——
那种东西属于 `reference/`。

## ADR 与 `plans/`

ADR **不在这个目录里**：2026-10-27 起统一放在仓库根 `docs/adr/hanshuang-pojia/`，与 `open-ai-canvas`、`qiushi-skill` 的 ADR 并列，一个插件一个子目录。一条决策一个文件，编号递增，已采纳的**正文不改写**；要推翻就新写一条并注明取代关系。与当前实现对齐的部分写在每篇文末的「实现核对」节，带核对版本与可重跑命令——这样「当时怎么定的」和「现在是什么样」不会互相冒充。
索引在 [`docs/adr/hanshuang-pojia/README.md`](../../../../docs/adr/hanshuang-pojia/README.md)：九篇的主题、状态、落实与偏差都在那里，别靠编号猜。
2026-10-27 已按 **2.11.0** 逐篇核过一轮，偏差记在索引的「落实与偏差」表里；其中 ADR 0001 的 D4、D9
被实现反转且尚无新 ADR，看那两篇时以文末核对节为准。同日新增 ADR 0009（授权晚到与门禁落盘），已按 **2.12.0** 落实。
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

1. 它是**必须遵守的规则**，还是**在某个版本上观察到的结果**？规则 → `contract/`；观察 → `audits/`（带版本号）。
2. **代码或测试会读它吗？** 会 → `reference/`，并且必须贴着解析它的那段代码写，改动要一起改。
3. 只有**做决定的时候**才需要看？→ 仓库根 `docs/adr/hanshuang-pojia/`（不在本目录）。
4. 都不像，而且读者是「装了插件不知道怎么用」的人 → 它属于 `src/content/docs/manual/`，不属于这里。

## 迁移记录

2026-10 按上表重排过一次，旧链接对应关系：

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
