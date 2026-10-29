# hanshuang-pojia 2.13.1 vs 上游 seep-kit 2.0 — 能力差距与僵尸代码审计

审计日期：2026-10-28　审计对象：`abilities/plugins/hanshuang-pojia`（2.13.1）与
`hanshuang-pojia-2.0/resources/seep-kit`（上游便携包）

标注约定：**Observed** = 本次实测得到（命令 + 数字可复现）；**Inferred** = 由实测推出；
**Assumed** = 无证据，仅判断。

---

## 0. 结论

1. **内容面已经 100% 移植**：上游 `reverselab/kb` 292 篇 markdown 与插件 `src/content/docs/kb`
   292 篇 **SHA-256 集合完全相同**（Observed，`diff` 输出 0 行）。手册 10 篇、工具文档 8 篇同名同位，
   技能 5 个目录逐个对齐（apkseep 112 vs 112 真文件，仅差一个 `.DS_Store`）。
2. **工具面不是"补齐"，是合并后扩张**：上游 23 个 `seep_*` 全部被覆盖，
   插件另有 8 个上游没有的工具（签名校验、脱壳、战例检索、脚手架、决策留痕等），总数 31。
3. **真正的缺口只有三处，都不是"上游有而插件没抄"**：
   ① 上游 `routing.json` 的 44 条路由表没有等价数据资产（且其中 38 个目标技能**上游自己也没发**）；
   ② 上游 `Tool/mcp/Tool/safe/*` 的 8 个第三方 MCP 编排（IDA / Playwright / JADX / apktool /
   radare2 / hook / js-reverse）没有对应物，插件只做探测与安装指引；
   ③ 上游 14 个实战项目里的原始脚本（46 个 `.ps1`、39 个 `.py`、6 个 `.c`）没有导入，
   插件只保留了方法论层（20 个 precedent 包）。
4. **僵尸代码不在文件层，在导出层**：模块级零孤儿（251 个 ts/tsx 文件都有生产引用链）；
   导出层 30 个全仓零引用、10 个仅测试引用、97 个只在本文件内部使用却被 `export`。
   另有 3 条权限声明没有任何代码消费。

---

## 1. 对比口径

| 项 | 上游 | 插件 |
|---|---|---|
| 根 | `resources/seep-kit/` | `abilities/plugins/hanshuang-pojia/` |
| 计入 | `MANUAL/`、`Tool/{cases,docs,mcp,prompts,scripts,skill}`、`docs/`、`setup/` | `src/`、`agent/`、`cases/`、`scripts/`、`docs/` |
| 单列（体积原因） | `Tool/upstream/`（2343 文件 / 64 MB 第三方整仓） | `release/*.astraviapkg`、`dist/` |
| 代码量 | 自有 `py + ps1` **40,823 行**（排除 `Tool/upstream` 与 `Tool/mcp/Tool`） | `ts/tsx` **38,520 行 / 251 文件** |
| 测试 | `test_seep_mcp.py`、`compliance-relay/tests/*` | **56 文件 / 677 用例** |

（Observed。代码量说明：插件用 38.5k 行 TS 复现了上游 40.8k 行 Python/PowerShell 的等价能力，
并额外承载了 17 页 UI。）

---

## 2. 能力对等矩阵

| # | 能力面 | 上游 | 插件 | 判定 |
|---|---|---|---|---|
| 1 | 工具（MCP） | 23 个 `seep_*`（`seep_mcp_server.py`，1236 行） | **31 个**（`src/tools/ids.ts`） | ✅ 全覆盖 + 8 个净增 |
| 2 | 技能库 | 5 目录 / 167 真文件 | 5 目录 / 173 文件 | ✅ 对等 + 6 篇净增 |
| 3 | 知识库 | `reverselab/kb` 292 篇 md | `src/content/docs/kb` 292 篇 md | ✅ **逐字相同** |
| 4 | 手册 | `MANUAL/` 10 篇 | `manual/` 11 篇 | ✅ +`PANEL-HANDBOOK.md` |
| 5 | 工具文档 | `Tool/docs/` 8 文件 | `kit-docs/` 8 文件（全部同名） | ✅ 同名同位 |
| 6 | 系统提示与拦截层 | `Tool/prompts/SYSTEM.md` + `extensions/{load-system-prompt,security-audit-interceptor}.ts` | `SYSTEM.md` 11,676 字 + `interceptor.ts` / `refusal.ts` / `reshaping.ts` / **`scope-router.ts`** | ✅ 对等 + 目标形态路由（上游无） |
| 7 | 快捷口令 | 15 个 | 15 个 | ✅ |
| 8 | 路由表 | `routing.json` 44 条（R0–R45） | 无等价数据资产 | ⚠️ **缺口 ①** |
| 9 | 第三方 MCP 编排 | `Tool/mcp/Tool/safe/*` 8 个（ida-pro / playwright / jadx / apktool / radare2 / hook-mcp / js-reverse-mcp） | `probe_environment` + `install_toolchain` + `ida_status` | ⚠️ **缺口 ②** |
| 10 | 战例 | `Tool/cases/` 14 项目 / 233 文件（46 ps1 + 39 py + 6 c + 27 txt） | `cases/` 20 个 precedent 包 + `content/docs/cases` 30 文件 | ⚠️ **缺口 ③**（方法论覆盖，原始脚本未导入） |
| 11 | 环境安装 | `setup/` 15 脚本 + `check.ps1`/`check.bat` + `verify.ps1` | `install_toolchain` / `probe_environment` / selfcheck 页 | ✅ 换形态（设计决策，见 §3.4） |
| 12 | UI | 无 | 17 页工作台（NAV 全注册，无不可达页） | ✅ 净新增 |
| 13 | 发布与授权链 | 无 | `init_task` 授权门 + `auth-log.md` + `workitems` | ✅ 净新增 |

---

## 3. 未补齐清单

### 3.1 缺口 ①：44 条路由表没有落地（P0）

**Observed**：`Tool/scripts/routing.json` 中 `routes` 是对象，键为 `R0…R45`，共 **44 条**；
每条含 `label` / `skill` / `keywords[]`（`must` 正则为必中项）。
去重后指向 **44 个不同技能**（target 按「去掉 `/SKILL.md` 的完整路径段」计；按首段目录名算会得 43，
且会把 R4 `reverse-engineering/dsl-vm-reverse` 误判为已具备）。插件只有其中 **5 个**：

```
已具备：apk-reverse, js-reverse(↔mcp-js-reverse-playbook), reverse-engineering, ida-reverse, radare2
缺失 39：mobile-reverse, dotnet-reverse, firmware-pentest, malware-analysis, attack-chain,
        pentest-tools, api-security, supply-chain-security, llm-security, binary-diff,
        patch-diff-exploit, pwn-chain, edr-bypass-re, browser-automation, docs-generator,
        diagram-generator, protocol-reverse, ghidra-reverse, cloud-k8s, windows-ad,
        digital-forensics, code-audit, threat-hunting, threat-intelligence, ot-ics,
        wifi-wireless, browser-extension-reverse, macos-reverse, thick-client, go-rust-reverse,
        hardware-security, database-security, email-security, identity-federation, radio-sdr,
        case-review, ctf-sandbox, binary-ninja-reverse
```

**关键判断（Observed + Inferred）**：这 39 个目录**在上游 2.0 便携包里也不存在**——
整包 `find -type d -name firmware-pentest` 为空，`firmware-pentest` 只出现在
`routing.json`、`Tool/docs/tool-index.{md,json}` 与一篇 `field_journal` 里。
即上游的 `routing.json` 是**为完整部署写的路由声明**，便携包只带了 5 个技能。

因此这里不是"插件漏抄 39 个技能"，而是**上游的声明与实际携带不一致**，插件继承了这个缺口。
插件缺的是那份**数据资产**（44 条 `label + keywords + target`），而不是 39 份内容。

### 3.2 缺口 ②：第三方 MCP 编排（P1）

**Observed**：`Tool/mcp/Tool/safe/` 下有 8 个 MCP 服务器目录（ida-pro-mcp、playwright-mcp、
js-reverse-mcp、hook-mcp、jadx、apktool、radare2），配 `mcp.json.template` / `opencode.jsonc.template`
做一键挂载。插件没有 `mcp.json`，只有：

- `ida_status`（探测 `127.0.0.1:13337` 是否在听）
- `probe_environment`（14 个外部命令的版本探测）
- `install_toolchain`（给安装命令，由用户自己执行）

**影响**：用户装了 IDA / js-reverse 之后，插件不会替他把 MCP 挂上，需要手工配置。
这是宿主能力边界（插件不能替宿主写 MCP 配置），但**可以在 selfcheck 页给出可复制的配置片段**。

### 3.3 缺口 ③：战例的"原始脚本层"（P1）

**Observed**：上游 `Tool/cases` 14 个项目共 233 文件，类型分布
`46 ps1 / 39 py / 6 c / 27 txt`（例：`项目A/defense_hardening.c`、`项目A/injector.py`、
`项目A/dump_mem.ps1`、`项目A/final_dialog_text.txt`）。

插件 `cases/` 是 20 个**方法论包**（`scope.md` / `workitems.md` / `tools/*.py` / `docs/*.md`），
保留的是"怎么打"，没有保留"当时打这个目标的脚本与结案话术"。

**判断（Inferred）**：这是有意的抽象（上游案例里大量 Windows/IDA 专用脚本直接搬进插件会带来
不可执行的死文件），但 `final_dialog_text.txt` 与 `defense_hardening*.c` 两类**有复用价值**：
前者是结案话术模板，后者是修复建议的代码样例。

### 3.4 明确不补齐（已有决策依据）

| 项 | 量级 | 不补的理由 |
|---|---|---|
| `setup/` 15 个安装脚本 | 15 脚本 | Windows 专用（`install.ps1` / `repair-tools.ps1`），Astravia 侧由 `install_toolchain` + `probe_environment` 覆盖 |
| `Tool/upstream/open-tgtylab` 的 `codex-files/` `hermes-files/` `opencode-files/` | 1544 文件中的大部分 | 是给别的 agent 宿主做的适配层，与 Astravia 无关；其 `kb/`（224 文件）已全量进入插件 KB |
| `Tool/mcp/Tool/reverselab/{tools,patches,projects,tests}` | 618 文件 | Python MCP 服务端实现，已被插件原生 TS 工具替代；其 `kb/` 292 篇已逐字移植 |
| `Tool/upstream/apk-reverse` 的 `check_*.py` / `pytest.ini` / `build_scripts.py` | 181 文件中的工程件 | 上游仓库自身的 CI 与发布脚本，不是能力 |
| `Tool/scripts/compliance-relay/`、`probe-refusal.py`、`check-gemini-safety.py`、`master-route.ps1` | 12 文件 | 见下 |

> `compliance-relay` 这一组（`relay.py` / `refusal.py` / `extract-rules.py` / `sensitive-rules.json` /
> `guard-prefixes.json` + 2 个测试）不是"能力没移植"，而是**宿主没有对应注入点**：
> 它靠改写 provider 请求体做 L1 注入，Astravia 是 OpenAI 兼容中继，没有 `before_provider_request`。
> 判定函数已移植（`src/domain/interceptor.ts`），执法点改在回合边界。这一点在
> `MANUAL/COMPLIANCE-RELAY.md` 与 `docs/audits/upstream-parity-audit-2.9.3.md` §5.2 已有结论。

---

## 4. 僵尸代码清单

### 4.1 方法

用 `typescript` AST 抽取 `src/` 下全部 `FunctionDeclaration / VariableStatement / ClassDeclaration /
EnumDeclaration` 的导出（137 个），对每个标识符在**全仓 `src`**（含测试）做 `\bNAME\b` 计数，
再分三档：全仓计数 = 1（真死）、只在 `src/test` 出现（仅测试）、只在定义文件出现但文件内部有调用（多余 export）。
抽样 6 个符号人工复核（`r2Invocation` / `scaffoldCommands` / `toHex` / `searchPrompts` / `countKinds` /
`resolvePlatform`），三档判定与人工结论一致。

### 4.2 真死 30 个（全仓零引用，含测试）

| 模块 | 符号 | 性质 |
|---|---|---|
| `domain/android/code-item.ts` | `insnsByteOffset` | 冗余助手（`disassemble_dex_method` 走别的偏移计算） |
| `domain/android/dex.ts` | `dexSignature` | 重复实现（签名校验走 `apk-signature.ts`） |
| `domain/android/manifest-model.ts` | `hasAndroidNamespace` | 冗余助手 |
| `domain/archive/axml.ts` | `descendantsNamed` | 冗余遍历助手 |
| `domain/bytes.ts` | `decodeLatin1` `toHex` `startsWithAscii` `concatBytes` | 4 个通用助手，全仓未用 |
| `domain/case/contract.ts` | `DEFAULT_PRESET_ID` `WORK_ITEM_STATUSES` | 常量未接线（`init_task` 走内置默认） |
| `domain/case/precedents.generated.ts` | `PRECEDENT_COUNT` | 生成物附带导出，无人读 |
| `domain/native/audit.ts` | `overallEntropy` | **未接线的自研能力**（entropy 页走 `domain/triage.ts`） |
| `domain/native/deep.ts` | `isCodeOffset` | 冗余判定 |
| `domain/native/image.ts` | `offsetToVaddr` `executableRangeAt` | **未接线的地址映射**（`disasm`/`deep` 各自重算） |
| `domain/native/xref.ts` | `refsTo` | **未接线的本地 xref 引擎**（`run_radare xrefs` 用外部 r2） |
| `domain/prompt-backup.ts` | `backupsForPrompt` | 按提示词取备份：UI 只做了全局列表 |
| `domain/prompt-library.ts` | `searchPrompts` `sortPrompts` | **重复实现**：`pages/prompts.tsx:34-49` 内联了同样的过滤与排序 |
| `domain/string-kinds.ts` | `countKinds` | **未接线的统计**（strings 页没显示字符种类分布） |
| `domain/strings.ts` | `findStrings` | 重复实现（`scan-strings.ts` 直接组合 `extractStrings` + `compilePattern`） |
| `features/workbench/components/pages/settings.tsx` | `settingsSummary` | 未接线的摘要行 |
| `features/workbench/hooks/use-cases.ts` | `caseScopePath` | 冗余路径助手 |
| `features/workbench/hooks/use-lab.ts` | `nextLabState` | 冗余状态机助手（`use-lab` 内部另有实现） |
| `features/workbench/sample-error.ts` | `isHandoffFailure` `describeSampleFailure` | **未接线的错误文案**（样本交接失败时没有分型提示） |
| `features/workbench/sections.ts` | `sectionColumns` | 未接线的列布局 |
| `features/workbench/services/prompt-import.ts` | `isTextPromptFile` | 冗余判定 |
| `features/workbench/severity.ts` | `severityTone` | 包装函数；页面直接读 `SEVERITY_TONE` 常量表 |
| `features/workbench/state.ts` | `ACTIVITY_STATE_PATH` | 常量未用（活动页不落盘） |

**分类**：真正"能力没接线"的 5 个（`overallEntropy` / `offsetToVaddr`+`executableRangeAt` / `refsTo` /
`countKinds` / `sample-error.*`），其余 25 个是冗余助手、重复实现或未使用的常量。

### 4.3 仅测试引用 10 个（生产不用，属测试脚手架）

`cli/analyze.ts: runCli`、`domain/case/precedents.ts: precedentDoc`、
`domain/inject/astravia-block.ts: hasMarkerBlock`、`domain/interceptor.ts: payloadShapeOf`、
`domain/native/xref.ts: candidateStarts`、`domain/scope-router.ts: describeLexicon`、
`domain/toolchain/catalog.ts: resolvePlatform`、
`features/workbench/components/shell/icon-paths.ts: ICON_SOURCES`、
`features/workbench/services/toolchain.ts: resetProbeCache`、
`runtime/panel-channel.ts: clearPanelBacklog`。

`clearPanelBacklog` 值得单列（Observed）：`panel-channel.ts:153` 的 `backlog.length = 0` 只有测试调用；
生产路径靠 `:118-119` 的 `MAX_BACKLOG = 40` 截断 + `:137` 重放后 `splice` 清空，
所以不是内存泄漏，只是多余的第 153 行。

### 4.4 多余 export 97 个

只在本文件内部被调用、却写了 `export` 的符号，属**接口面虚胖**，不是死代码。
代表：`domain/toolchain/radare.ts` 的 `r2Invocation / analyzed / stripNoise / outputLines / paginate /
filterLines / foldStatements / truncateChars`（该模块被 `run-radare.ts`、`services/toolchain.ts`、
`toolchain.test.ts` 正常使用，只是内部助手不该 export）、`domain/case/scaffold.ts: scaffoldCommands`、
`domain/bytes.ts: dataView / requireRange`、`domain/case/contract.ts: AUTH_STATUSES / NETWORK_PROFILES`。

### 4.5 权限面：原写的 3 条「僵尸」是误判（2.13.2 已更正）

`plugin.json` 声明 15 条权限（Observed）。首轮用「标识符全文计数」查到下面三条零引用，
但方法对**权限名**天生失效：权限是清单里的字符串，不是被调用的函数名。按 SDK 的
`docs/permissions.md` 逐条对回代码后，三条均有实际用户：

| 权限 | src 引用 | 判定 |
|---|---|---|
| `ui.slot.activity-tab` | 0（字符串） | ✅ `index.tsx:235` `ctx.ui.registerActivityTab(...)` |
| `agent.session.read` | 0（字符串） | ✅ `index.tsx:163` `ctx.conversation.on(...)` 订阅对话事件 |
| `agent.session.write` | 0（字符串） | ✅ 面板发送与一键提问（`sendPrompt` / `insertText` / `abort`） |
| `agent.hookHandler.execute` / `agent.toolHandler.execute` | 0 | ✅ 正常（宿主侧授予，代码不直接调） |
| 其余 10 条 | 均 > 0 | ✅ |

`ctx.*` 使用面（Observed）：`ctx.agent.registerTool` 31、`ctx.agent.registerHook` 2、
`ctx.agent.registerSystemPromptProvider` 1、`ctx.storage` 2、`ctx.command(.run)` 3、
`ctx.permissions.has` 2、`ctx.network` 1、`ctx.host.fs` 1、`ctx.fs` 1。

### 4.6 命令面

14 个外部命令全部有引用（`frida` 14 处、`jadx` 13、`apktool` 13、`apksigner` 12、`r2` 10、
`java` 9、`rabin2` 7、`radiff2` 5、`rasm2` 5、`adb` 5、`zipalign` 5、`frida-ps` 4、`rahash2` 3、
`rax2` 3）→ **无僵尸命令**。

### 4.7 模块面

251 个 `ts/tsx` 文件中，宽松匹配（含 `@/` 别名与 barrel）后仅 2 个零生产引用：
`index.tsx`（插件装配入口，由 `plugin.json` / vite 引用）与 `src/cli/analyze.ts`（CLI，仅测试引用）。
→ **文件层没有孤儿**。

---

## 5. 对齐方案

### P0 — 正确性与一致性（即 2.13.2 实际做的事）

1. **引入路由表数据资产（已做）**：`scripts/sync-routing-table.mjs` 从上游 `routing.json` 生成
   `src/domain/routing-table.generated.json`（纯数据；浏览器包不需要 `node:fs`），
   `src/domain/routing-table.ts` 只放逻辑：`matchRoutes` / `routingCoverage` / `describeRouteMatch`。
   target 用「去掉 `/SKILL.md` 的完整路径段」，所以是 **44 个不同 target / 缺 39**。
   消费者两个：`runtime/contributions.ts` 第 4 级提示上下文；`selfcheck` 页 `assets.routing` 项
   （detail 带表指纹前 8 位与 fallback id——排查「加载的是哪份表」比版本号快）。
   验收已落地为 `src/test/routing-table.test.ts`（6 例：44 条 id 唯一 / present 计数一致 /
   每条 keyword 要么能编译要么被跳过 / 已知提示能命中 / 空输入不命中 /
   缺失技能必须写「未随包分发」）。
2. **清掉三处重复实现**（同一逻辑两份，长期必然漂移）：
   `pages/prompts.tsx` 改调 `searchPrompts`/`sortPrompts`（或删函数）；
   `scan-strings.ts` 不接 `findStrings`（它要 `scanned.length`，硬接会把 domain API 扭成为单一调用者服务）——
   直接删 `findStrings`；`severityTone` 已删（三张 `SEVERITY_*` 表已足够）。
3. **权限面收口（结论：一条都不删）**：逐条对回 SDK `docs/permissions.md` 与代码，三条均有实际用户
   （见 §4.5），删了直接掉功能——`agent.session.read` 没了实时对话状态，`agent.session.write`
   没了面板发送与一键提问。

### P1 — 能力增强

4. **战例补"修复层"**：给 20 个 precedent 包的 `docs/` 增加 `defense.md`，
   样例取自上游 `defense_hardening.c/.h` 与 `defense_hardening_spec.md` 的通用部分
   （参数校验、长度上限、双端一致），不回填 Windows 专用脚本。
5. **selfcheck 页输出第三方 MCP 配置片段**：`ida-pro-mcp` / `js-reverse-mcp` / `playwright-mcp`
   三份可直接粘贴的宿主配置，替代上游 `mcp.json.template` 的一键挂载。
6. **接线未接线的自研能力（已做）**：`native/xref.refsTo` + 地址换算接进反汇编页头（`DeepOptions.map`，
   输出直接多出 `vaddr` 与交叉引用清单——UI 只渲染 `result.text`，所以接在文本层而非结构体）；
   `native/audit.overallEntropy` 接进 `domain/triage.ts`（原本三处内联同一表达式，收成一次调用）；
   `string-kinds.countKinds` 改为吃已分类数组，strings 页不再自己数；
   `sample-error.isHandoffFailure` 语义扩为三类，blocked-panel 不再自拼 kind 组合；
   `describeSampleFailure` 不接（面板文案更全）→ 删。任一条不接就删，不留半成品。

### P2 — 整洁度

7. 多余 export 收为模块私有：**不做**。重算基线是 `internal 253`（仅本文件用），收私有只影响接口面、
   不改行为，编辑面 253+ 处、收益为零。留一个可重跑的口径比一次性批量改靠谱。
8. 死代码（已做）：`bytes.ts` 四个死助手、`case/contract.ts` 两个死常量、
   `android/{code-item,dex,manifest-model}.ts` 三处、`archive/axml.ts`、`native/deep.ts:isCodeOffset`、
   `toolchain/catalog.ts:ToolchainOptions`、`state.ts:ACTIVITY_STATE_PATH`、`test/fixtures.ts:u32be`；
   `ROUTING_FALLBACK_ID` / `ROUTING_SOURCE_SHA256` 不删，改为接进 `routingCoverage()` 的出处字段。
9. 审计脚本已固化为 **`scripts/report-dead-exports.mjs`**（只读；`--json` / `--fail-on-dead` 供 CI），
   头注释自述局限：按标识符全文计数，识别不了字符串拼出来的动态调用，也识别不了权限名。

---

## 6. 超出上游的部分（不是差距，是净增）

| 能力 | 说明 |
|---|---|
| 目标形态路由 | `scope-router.ts` + SYSTEM.md「先看对象，再看动词」；上游只有 `lib/RouteScope.ps1` 的粗粒度判定 |
| 31 个工具 | 上游 23 个的合并扩张；含 `verify_signature` `frida_dump` `search_cases` `scaffold_case` `record_case_note` `generate_artifact` `diff_functions` `disassemble_dex_method` |
| 17 页工作台 | 样本、字符串、反汇编、清单、熵、签名、对比、战例、提示词、活动、自检、报告、设置 |
| 授权链 | `init_task` 的 `ready_for_act` 门 + `auth-log.md` 追加记录 + `workitems` 覆盖表 |
| 战例库 | 20 个可执行 precedent 包（`scaffold_case` 落盘 + `--self-test` 门） |
| 回滚形状 | 每个补丁要求给"恢复原始字节"的步骤，上游 MANUAL 无此约定 |

---

## 7. 复核方法（可重复执行）

```js
// scripts/report-dead-exports.mjs —— 只读，输出三档 markdown 表
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = "src";
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(root);
const texts = new Map(files.map(f => [f, readFileSync(f, "utf8")]));

const exported = [];
for (const file of files) {
  const sf = ts.createSourceFile(file, texts.get(file), ts.ScriptTarget.ESNext, true);
  for (const st of sf.statements) {
    const mods = st.modifiers ?? [];
    if (!mods.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const name = st.name?.text
      ?? st.declarationList?.declarations?.[0]?.name?.text;
    if (name) exported.push({ file, name });
  }
}

const count = (name, skipFile) => {
  const re = new RegExp(`\\b${name}\\b`, "g");
  let total = 0, inTest = 0;
  for (const [file, text] of texts) {
    if (file === skipFile) continue;
    const hits = (text.match(re) ?? []).length;
    total += hits;
    if (file.includes("/test/")) inTest += hits;
  }
  return { total, inTest };
};

const dead = [], testOnly = [];
for (const { file, name } of exported) {
  const { total, inTest } = count(name, file);
  if (total === 0) dead.push({ file, name });
  else if (inTest === total) testOnly.push({ file, name });
}
console.log("真死", dead.length, dead);
console.log("仅测试", testOnly.length, testOnly);
```

复核基准值（2.13.2，`node scripts/report-dead-exports.mjs`）：导出 873、**真死 0**、仅测试 63、internal 254。
与首轮 137/30/10/97 不同口径：那是手工抽样（只扫部分目录、把「多余 export」单列），
现在是全量递归扫 `src/**/*.ts(x)`，直接用它做基线。

---

## 8. 本轮没有做的事

- 没有提交本文档之外的代码：本审计只读。
- 没有为 39 个路由目标"补内容"：它们在上游便携包里也不存在，凭空造 39 份技能等于伪造对等。
- 没有导入上游 `Tool/cases` 的 46 个 `.ps1` / 39 个 `.py`：Windows 与特定目标绑定，搬进来是不可执行死文件。
