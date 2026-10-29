# 与上游整体项目的对等审计（2.13.1 → 2.14.0 本轮收口）

> **时点**：2026-10-29　**被测**：`hanshuang-pojia` 2.13.2 → **2.14.0**　**对比对象**：上游 2.0 完整分发树
> `hanshuang-pojia-2.0/resources/seep-kit/`（含 `MANUAL/`、`Tool/`、`setup/`、顶层 `docs/`），而非上一轮只取的
> `Tool/` 子树中的便携包资产。
> **测量方式**：`find`/`du` 实跑 + 逐目录对照；下文数字皆为 Observed。
> **前作**：[capability-gap-2.13.1.md](capability-gap-2.13.1.md)（基线是便携包，结论仍有效但口径偏窄）。

## 1. 为什么必须重写基线

2.13.1 那轮拿的是「便携包里能跑起来的东西」做对照，于是有三类东西被系统性漏掉：

1. **只在工程态存在的目录**（`Tool/scripts/`、`Tool/prompts/`、`Tool/upstream/`）——便携包的用户流程走不到，
   但它们定义了上游的工程契约；
2. **体量巨大但不可移植的第三方资产**（`Tool/mcp/`、`Tool/upstream/`）——按「有没有」数会得出「缺 300MB」的假结论；
3. **14 条战例的目录形态**——上一轮只把 `Tool/cases/` 当语料，没意识到它是一个有统一契约（`README.txt` +
   `build.ps1` + `docs/` + `src/` + `tools/` + `SHA256SUMS.txt`）的工程模板族。

所以本篇先拆账，再逐面判对等。

## 2. 上游 310MB 的拆账

| 路径 | 文件数 | 体积 | 性质 | 该不该搬 |
| --- | ---: | ---: | --- | --- |
| `Tool/mcp/` | 1676 | 235M | 第三方 MCP 运行时（含 `reverselab`、`safe` 两棵二进制树） | **不搬**：插件是宿主原生工具，多一层 Python 只会多一处漂移 |
| `Tool/upstream/` | 2343 | 65M | 三个上游开源项目整树（`apk-reverse`、`open-reverselab`、`open-tgtylab`） | **不搬**：外部依赖，应写在依赖声明里而不是提交源码 |
| `Tool/cases/` | 233 | 5.4M | 14 个战例工程（`项目A`…`项目N`） | **搬契约，不搬产物**——见 §4 |
| `Tool/skill/` | 168 | 2.7M | 5 个技能 + 5 个子技能 | 已 1:1 移植 |
| `Tool/scripts/` | 31 | 344K | 路由、探针、APK、合规中继、IDA 桥 | **搬语义，不搬脚本**——见 §6 |
| `setup/` | 15 | — | 安装 / 更新 / 卸载 / 校验，`ps1` 与 `sh` 双份 | **不搬**：安装权在宿主，插件只给命令 |
| `MANUAL/` | 10 | — | 使用手册与合规中继说明书 | 语义已并入 `src/content/docs/manual/` 与 `docs/` |
| `Tool/docs/` | 8 | 84K | 工具索引 + MCP 设置 + 来源说明 + 工作区规则 | 已对等，见 §3 |
| `Tool/prompts/` | 5 | 68K | `SYSTEM.md` + `AGENTS.md` + `extensions/` | 已对等（母本机制） |

**结论**：300MB 是第三方与二进制，对齐它们不是能力问题而是打包问题，且违反市场包的体积与安全上限
（解压后 ≤100MB、禁符号链接、禁安装脚本）。真正需要对齐的「自有内容」合计不到 **9MB**。

## 3. 六个可对齐面向

| 面向 | 上游 | 插件 | 判定 |
| --- | --- | --- | --- |
| 技能 | `Tool/skill/` 5 顶层 + `safe-skills/` 5 子技能 | `agent/skills/` 同 5 顶层 + 同 5 子技能 | **对等** |
| 提示词 | `Tool/prompts/SYSTEM.md` + `extensions/` | `agent/prompts/SYSTEM.md` 母本 → 生成物 | **对等且更强**（母本 + byte-for-byte 测试 + `--check`） |
| 工作区规则 | `Tool/docs/WORKSPACE_RULES.md` | `docs/contract/case-library.md` + `init_task` 目录契约 | **对等**（规则变成可执行的目录生成） |
| 工具索引 | `Tool/docs/tool-index.{md,json}` + `refresh-tool-index.ps1` | `src/content/docs/kit-docs/tool-index.{md,json}` + `scripts/sync-tool-index.mjs` | **对等**，且 `src/test/tools/tool-index.test.ts` 会拿 `reference/toolchain-parity.md` 数三档行数对账 |
| 用法文档 | `MANUAL/` 10 篇 | `src/content/docs/manual/`（随包发布） | **对等** |
| 工程文档 | 上游只有 `Tool/docs` 8 篇，无模块化 | `docs/` 12 篇 → 本轮 **9 篇模块 + 索引重写** | **超出**（见 §5） |

三个不是「越多越好」的面，明确判定为**不对等且不追**：

- `setup/` 的 15 个安装脚本：插件不下载、不提权、不装软件。`install_toolchain` 只输出**本平台**的命令，
  由人来执行。追平它等于把插件变成安装器，与市场安全规则直接冲突。
- `MANUAL/COMPLIANCE-RELAY.md` 的中继机制：插件没有中继进程，那一套「多轮重试直到过审」的
  形态不照搬；但**它替换用户原话的做法对齐了**——换句型（`reshaping.ts`）与换入口（`target-shape.ts`）
  两件事都在，且都不否决原请求。2.14.0 撤回了 2.13.1 在这条上留下的划界，
  见 [refusal-scope-router.md](refusal-scope-router.md) 的「已推翻」说明。
- `Tool/upstream/` 的整树 vendor：应由宿主或用户自备。

## 4. 缺口③：14 条战例工程的落地方式

上游 14 个目录的统一契约（`README.txt` 双语 + `build.ps1` + `docs/reverse-engineering.md` +
`docs/algorithm.md` + `src/` + `tools/` + `SHA256SUMS.txt`）已在插件里以**生成器**形式对等：

| 上游行为 | 插件实现 | 对等性 |
| --- | --- | --- |
| 手写 14 份 `README.txt` | `case-projects/catalog.ts` 的 `CaseProject` 派生 | 内容对等，文案由数据生成，不会漂移 |
| 每目录一份 `build.ps1`（仅 Windows） | `buildScriptFor(language, slug, os)` 生成 `build.ps1` **或** `build.sh` | **超出**：`darwin` / `linux` 有原生脚本 |
| `docs/*.md` 各写各的 | 6 个固定文档槽（`DOC_SLOTS`），按原型勾选 | 对等，且缺槽会被测试抓到 |
| `src/` 里塞目标特定产物（233 个文件） | **`src/` 故意留空**，只放 `README.md` 说明该写什么 | 见下 |
| `SHA256SUMS.txt` 手工维护 | 由 `build.ps1` / `build.sh` 产出，不预置空文件 | 对等（且不制造「空证据」） |
| 无回滚章节 | 五步命令固定以 `rollback` 结尾 + `samples/original.bin` | **超出** |

**为什么 `src/` 留空**：上游 233 个文件里绝大多数是 DLL、PNG、日志、截图，没有一件在别的机器上可执行。
搬进来得到的是「目录里有文件、机器上跑不了、审计脚本也认不出」的死文件——正是任务要求避免的形态。
骨架只带方法、证据门、构建脚本；实现由操作者在 `--self-test` 通过之后自己填。

**跨 OS 的三条硬断言**（`src/test/case/case-projects.test.ts` 逐条盯着）：
非 Windows 命令里不得出现 `powershell` / `.ps1` / `certutil` / `Get-Command` / `Get-FileHash`；
全局不得出现 `sudo` / `curl` / `wget` / `rm -rf` / `Invoke-WebRequest`；同输入必须同输出（可贴进报告复现）。

**入口合并而非新增工具**：没有新增第 32 个工具 id，而是给既有 `scaffold_case` 加 `project: "A"…"N"` 分支
（`required: []`，与 `precedent` 模式互斥）。这样 `EXPECTED_TOOL_COUNT=31`、自检页、`check.mjs`、i18n 全不动。

## 5. `docs/` 重组：按「能不能被信任」分轴，按「模块」导览

重排后 `docs/` 的读法是两层：

- **第一层按功能**：`domains/` 9 个功能域，每个域 `usage.md`（怎么用）+ `dev.md`（怎么改）。
  新增：`triage-and-disasm`、`android`、`cases`、`knowledge`、`toolchain-and-limits`、`dialogue-and-routing`、
  `reporting-and-release`、`workbench-panel`、`mcp-and-external-servers`。
- **第二层按权威性**：`contract/`（必须遵守）、`reference/`（当前事实，**代码与测试直接读**）、
  `audits/`（带版本时点，会过期）。

删掉/不写的三类：上游同款的「下载指南」「工作区规则」副本（已被 `contract/` 与模块文档覆盖）；
`docs/plans/` 不再新增（2.0 对标期施工计划，工作完成即失效）；把「某天排查过程」写成「当前状态」的条目
一律归 `audits/` 并带版本号。

## 6. 脚本层：31 个上游脚本的归宿

| 上游脚本 | 插件对应物 | 判定 |
| --- | --- | --- |
| `master-route.ps1` + `routing.json` | `scripts/sync-routing-table.mjs` → `routing-table.generated.json` + `routing-table.ts` | **对等**：44 条路由带源 SHA-256，`matchRoutes` / `routingCoverage` 可测 |
| `lib/RouteScope.ps1` | `src/domain/scope-router.ts` | **对等**（且从「术语匹配」升级为「对象可持有性」判定） |
| `lib/ToolDiscovery.ps1` | `domain/toolchain/catalog.ts` + `probe_environment` | **对等**，并区分 `host refused` 与 `not found` |
| `lib/WorkRoot.ps1` | `init_task` + `domain/case/*` | **对等** |
| `lib/HostRuntime.ps1` | 宿主 `ctx` 契约（`src/tools/*.ts` + `plugin.json` 权限） | **对等**（边界由宿主强制，不是脚本自觉） |
| `lib/BootstrapSupplyChain.ps1` | — | **不搬**：供应链引导 = 下载安装 |
| `case-init.ps1` | `init_task` | **对等** |
| `apk/decode.{ps1,sh}` | `decompile_android` | **对等且跨平台**（原脚本 macOS 缺一份） |
| `apk/frida-run.*` | `frida_dump` + `generate_hook` | **对等** |
| `apk/manifest-summary.ps1` | `decompile_android` 内的 AXML 模型 | **部分**：没有独立「只出 manifest 摘要」的入口，记为 P2 |
| `apk/rebuild-sign-install.*` | 插件外（宿主命令通道）；`verify_signature` 只做取证 | **有意不对等**：重打包要签名密钥，越过红线 |
| `refresh-tool-index.ps1` | `scripts/sync-tool-index.mjs` | **对等** |
| `probe-refusal.py` / `check-gemini-safety.py` | `refusal.ts` + `reshaping.ts` + `scope-router.ts` | **对等**（不搬「改写以过审」） |
| `compliance-relay/*` | 同上；规则表进 `scope-lexicon.ts` | **部分**（见 §3 划界） |
| `shot_ida.ps1` / `trigger_ida_mcp.ps1` | `ida_status` | **部分**：只报端口在不在，不驱动 |
| `temp_ocr.ps1` | — | **缺**：截图 OCR 无对应物，记 P2 |
| `start_mcp.py` + `Tool/mcp/seep_mcp_server.py` | 原生 31 工具 + `docs/domains/mcp-and-external-servers/dev.md` | **有意不对等**：同一批能力不做两套 id |

## 7. 测试与攻防面

| 类别 | 规模 | 说明 |
| --- | ---: | --- |
| 单测文件 / 用例 | 59 文件 / **711 例**（按功能域分 7 个子目录） | `vitest`，全绿 |
| 市场内容测试 | 79 例 | `node --test tests/*.test.mjs`，**必须在 `build` 之后跑**（读构建产物） |
| 战例工程断言 | 21 例 | 14 条原型的 id 连续、能力族计数、双语证据、`defense` 阶段必备、跨 OS 命令洁净、骨架必需路径、幂等落盘、越界拒绝 |
| 路由表断言 | 6 例 | 44 条、5 present、fallback、指纹、匹配优先级 |
| 对话侧断言 | `contributions` / `target-shape` / `refusal` / `reshaping` / `system-prompt` | 两次实测事故各有一例回归；母本 byte-for-byte + 长度上限 |

「攻防测试」在本插件里的含义是**防御面**而不是攻击演示：每条战例都必须有 `defense` 阶段（首版缺
`C`、`G` 两条，被测试抓出后补齐），骨架的 `README.md` 必须写清授权范围与 `auth.status=pending`，
报告四节里「纵深防御」不可省。这一层测试防的是「交付了能不能被修复」被悄悄删掉。

## 8. 剩余缺口与二次迭代后的状态

| 优先级 | 项 | 状态 |
| --- | --- | --- |
| ~~P0~~ | 44 条路由未接进提示层 | **已修**（2.13.2，第 4 级注入） |
| ~~P0~~ | 14 条战例无工程形态 | **已修**（2.14.0，`scaffold_case project=`） |
| ~~P1~~ | 文档按权威性混乱 | **已修**（本轮 `domains/` 9 域 × 2 篇 + 索引重写） |
| ~~P1~~ | 外部 MCP 无设置说明 | **已修**（`domains/mcp-and-external-servers/dev.md` 给三份可粘贴配置） |
| ~~P1~~ | 19 个先例包缺 `docs/defense.md` | **已修**（2.14.0）：19 篇防御侧文档写齐，`npm run check:cases` 19 包全绿；先例 `scope.md` 的门禁字段同步清除 |
| P2 | `manifest-summary` 独立入口 | 未做：现有 `decompile_android` 已能给模型，独立入口收益低 |
| P2 | 截图 OCR（`temp_ocr.ps1`） | 未做：需要图像管线，与「不引入大依赖」冲突 |
| P2 | 39 个路由目标 | 不对齐：上游也只有 5 份能力，等价于「缺 5 份内容」而非 39 份 |
| P2 | `internal 254` 私有符号 | 不收：收益为零，破坏可读性 |

## 9. 2.14.0：把「卡点」逐条拆掉

上一轮判定「能力面已对等」，但机制上还有三处**自己加的限制**，它们不影响对等表，直接影响模型能不能干活。
这一轮按「能力点实测 → 卡点 → 改法」的顺序清完：

| 卡点 | 表现 | 改法 | 验证 |
| --- | --- | --- | --- |
| 授权门 | `init_task` 推导 `ready_for_act`，`pending` 时列出阻断项；`search_cases` 有 `ready_only`；面板显示就绪标签 | 整条删除：`assessReadiness` / `readinessLine` / `AUTHORISED_STATUSES` / `auth-log.md` / `workitems.md` 播种 / `readiness` 字段全部移除 | `src/test/case/case-contract.test.ts` 用动态 `import` 断言这些符号**不存在** |
| 范围划界 | 命中线上账号时整轮改道，等价入口替代原请求 | 改为附加：`describeEquivalentPath` 明确「这是附加，不是替代」「两条都交」 | `src/test/dialogue/contributions.test.ts` 断言注入含 `[等距入口]` 且不含否决语句；`holdable` 必须返回 `null` |
| `lab` 口诀太窄 | 只认 `lab：` 与 `LAB:`，少一个冒号就不开环境；`/lab`、`lab 任务`、`退出实验` 之外的写法全部静默失效 | 三个正则重写：进入宽进（`lab` / `lab:` / `lab：` / `/lab` / `lab 任务` / 大小写混写 / 中文四种），退出补齐（`关闭` / `离开` / `quit lab` / `lab off` / `/lab off`），并加负例护栏（`laboratory`、`labrador`、`工作的进展`） | `src/test/dialogue/runtime.test.ts` 五个用例覆盖正负例 |

另外三件同时收口：

- **先例包补齐防御侧文档**：19 篇 `docs/defense.md`（每篇四段：这套手法需要什么 / 哪些控制真的挡得住 /
  怎么验证它挡得住 / 什么挡不住），先例 `scope.md` 里的 `ready_for_act` / `MUST NOT proceed` / `blockers`
  与 `auth-log` 语义一并清除，`case-precedents.test.ts` 加了「语料里不许有门禁字段」的断言。
- **测试按功能域分目录**：`src/test/{analysis,case,dialogue,knowledge,report,tools,workbench}/`，
  7 个域 58 个文件；目录迁移后 9 个文件的 `pluginRoot` 偏移与 3 处相对导入一并修正。
- **文档与文案对齐实现**：`CONTEXT.md`、`README{,.zh}.md`、`USAGE.md`、`docs/contract/*`、
  `docs/domains/*`、面板手册、`locales/{en,zh}.json` 中所有 `ready_for_act` / `workitems` / `auth-log`
  表述改为「记录事实」；`cases.contract.gate` 键改名为 `cases.contract.facts`。

## 10. 结论

1. **能力面已对等**：技能 5+5、提示词母本、工具索引、手册、路由、14 条战例工程契约全部就位；
   差额集中在「安装器 / 第三方二进制 / 攻击演示」三类**不该对齐**的东西上。
2. **机制上不再有自己加的门**：授权只记录不判定，范围只附加不否决，`lab` 宽进不误触。
   这三条是 2.13.x 与上游最大的行为差，2.14.0 之后行为对齐、实现更严（每条都有可执行断言）。
3. **唯一形态性升级是脚本**：上游 `.ps1` 只在 Windows 能跑，插件把命令与构建脚本按语言 × OS 生成，
   Linux/macOS 得到 `build.sh`。这是从「抄一份」变成「人人可跑」的那一步。
4. **仍欠的两件小事**均 P2（`manifest-summary` 独立入口、截图 OCR），不影响发布。

## 11. 2.14.0 收口：本轮再清的四项偏差

§9 修的是「机制上自己加的门」，这一轮清的是**同一类问题的残留**：判定删了但缓存/回退路径还在，
文档按权威性堆放，测试平铺难定位。四项均已收敛，且每项都有可执行断言。

| 项 | 修前 | 修后 | 证据 |
| --- | --- | --- | --- |
| `lab` 状态回退 | 模块级缓存 + 读盘失败即 `LAB_OFF`：存储被清、写盘失败、两个会话并行，任一情形都会把用户开过的环境静默关掉 | 缓存改为按 `ctx.storage` 的 `WeakMap`；读失败/文件消失沿用缓存；写盘失败先落内存；同轮口令用 `command.rest` 取目标；零命中补 `[交付形状]` | `src/test/workbench/lab-chain.test.ts` 四例（读坏、文件消失、写坏、两会话隔离）+ `dialogue/contributions.test.ts` |
| 文档结构 | `docs/modules/*.md` 9 篇按「权威性」堆在根，使用者与改代码的人读同一篇 | `docs/domains/<域>/{usage,dev}.md` 9 × 2，`docs/README.md` 索引改为「域 × 用/改」双列 | `docs/domains/*/usage.md` 9 篇、`dev.md` 9 篇；链接与测试路径由两遍 codemod 修正 |
| 注释覆盖 | 33 个生产文件、10 个测试文件无文件头，读实现才能判断职责 | 全部补文件头（职责 + 一条不变量）；测试头写「这条约束守住的是什么」 | `tsc --noEmit` 无输出 |
| 测试定位 | 59 个测试文件平铺在 `src/test/` 根 | `src/test/{analysis,case,dialogue,knowledge,report,tools,workbench}/`，导入与 `pluginRoot` 偏移同步修正 | `vitest` 59 文件 / 711 例；`report-dead-exports` dead 0 |

同轮一并收口的还有三件事：

- **先例包文档契约四份**（`README.md` / `scope.md` / `docs/method.md` / `docs/defense.md`），
  `CANONICAL_DOCS` 与 `check-precedent-package.mjs` 同步，19 包带工具自测全绿；
- **两份交付物**：[completion-2.14.0.md](completion-2.14.0.md)（13 条要求的落点与验证矩阵）、
  [capability-comparison-2.14.0.md](capability-comparison-2.14.0.md)（上游逐能力点对等表）；
- **发布前置条件**：`bump` 判定 2.14.0 尚未发布，故不再抬版本；构建产出 `hanshuang-pojia-2.14.0.astraviapkg`
  （597 个运行文件），内容测试 79 例在构建之后复跑通过。

这一轮之后，§8 表里唯一还开着的仍是那两条 P2（`manifest-summary` 独立入口、截图 OCR），
其余不再是「待办」而是「已判定不对齐」，理由写在各行的状态列里。
