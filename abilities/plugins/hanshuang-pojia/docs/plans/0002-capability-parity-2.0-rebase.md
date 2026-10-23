# 实施方案 0002：对标 hanshuang-pojia-2.0（kit 1.6.0）的全量逐项补齐

- 依据：[ADR 0001](../adr/0001-seep-kit-capability-parity.md)、[ADR 0002](../adr/0002-external-process-bridge.md)、
  [ADR 0003](../adr/0003-toolchain-install-plan.md)、[ADR 0004](../adr/0004-host-hook-boundary.md)、
  [工具链对照](../toolchain-parity.md)、[自带工具链对照](../toolchain-bundling.md)
- 参照对象：`/Users/zhugeyue/Desktop/tmp/hanshuang-pojia-2.0`（Electron 便携版，内置 `resources/seep-kit`，`VERSION 1.6.0`）
- 被测对象：`abilities/plugins/hanshuang-pojia`，`plugin.json` **2.8.2**（盘点于 2026-10-24）
- 承接并取代已过时的 [0001](./0001-capability-parity-phases.md)：那篇停在 2.4.x、若干「规划 / 进行中」项在 2.8.2 已落地。
  本方案按**现在的基线**重写逐项补齐。

> 结论先行：插件对 2.0 的**能力面基本不缺**——25 个 Agent 工具覆盖了上游 23 个 MCP 工具的每一项可观察结果
> （ADR 0001 表 2.1 已 23/23 全具备；row 4「任意 r2 命令」与 row 20「payload 返回」均做**无界**实现：row 4 对等上游零限制直通，
> row 20 返回完整章节/全文，不回退前 60 行。曾标「有界」的两处决策已在 2.9.0 反转）。
> 本 2.9.0 修订另外反转两项决策并各补一个工具/入口：**D7 反转**——`generate_artifact` 脚手架
> （keygen / 补丁 / 代理 DLL，接收并实现）；**注入器**——`install_astravia`（落点 `~/.astravia/agent/AGENTS.md`，
> 经 `saveAs` 用户确认落盘，非静默写）。

---

## 0. 盘点基线（2.8.2 vs 2.0）

### 0.1 插件侧

| 维度 | 值（实测 2.8.2，2026-10-24） |
|---|---|
| 版本 | `2.8.2`（`package.json` / `plugin.json` / `ability.json` 一致） |
| Agent 工具 | **25**（`src/tools/ids.ts`：`EXPECTED_TOOL_COUNT = 25`） |
| `plugin.json#permissions` | `ui.slot.activity-tab`、`agent.tools.register`、`agent.toolHandler.execute`、`agent.skills.control`、`agent.systemPrompt.write`、`agent.hooks.register`、`agent.hookHandler.execute`、`agent.session.read/write`、`storage.read/write`、`fs.read/write`、`agent.command.run`、`network.fetch` |
| `plugin.json#commands` | 14 项：`r2 rabin2 radiff2 rasm2 rahash2 rax2 jadx apktool java adb apksigner zipalign frida frida-ps` |
| `agent.skills` | `agent/skills/` 9 个目录，`SKILL-LIBRARY.md` 记录 **171 文件 / 2,481,035 B**，哈希防漂移 |
| 随包文档库 | `sync-docs.mjs --check` → **309 documents**（`kb` + `manual` + `kit-docs` 三组） |
| 面板页面 | 15 页：`overview / samples / findings / disasm / manifest / signature / entropy / strings / reports / compare / docs / selfcheck / settings / guide` |
| i18n | `locales/en.json`、`locales/zh.json` |
| 构建门禁 | `check`(tsc) → `test`(vitest) → `build`(vite) → `sync-docs.mjs --check` → 根 `marketplace.mjs check` |

### 0.2 上游侧（2.0 便携版，`seep-kit VERSION 1.6.0`）

| 资产 | 位置 | 规模（实测） |
|---|---|---|
| 应用主体 | `寒霜破甲工具.exe` + `resources/app.asar`（41.7 MB） | Electron 便携 |
| seep-kit 内核 | `resources/seep-kit/` | 4502 文件 |
| 23 个 MCP 工具 | `seep-kit/Tool/mcp/seep_mcp_server.py`（53,955 B） | 5 组 23 工具 |
| 内置工具箱 | `seep-kit/Tool/mcp/Tool/safe/`（jadx 1.5.6 / radare2 6.2.2 / apktool 3.0.3 / hook-mcp / ida-pro-mcp / js-reverse-mcp / playwright-mcp） | 离线二进制，README 称 251 MB/零外网 |
| 战术知识库 | `seep-kit/Tool/mcp/Tool/reverselab/kb/` | **299** 文件（另有 `docs/kb` 18 文件） |
| 9 个技能包 | `seep-kit/Tool/skill/`：`softseep / apkseep / ida-reverse / client-license-validation-bypass / safe-skills(5 组)` | 171 文件（2,481 KB，与插件随包一致） |
| 手册 | `seep-kit/MANUAL/` | 10 篇（前 9 随包，`COMPLIANCE-RELAY` / `MODEL-REFUSAL-MATRIX` 不随包） |
| 提示词层 | `seep-kit/Tool/prompts/SYSTEM.md`、`AGENTS.md`、`extensions/{load-system-prompt,security-audit-interceptor}.ts` | 常驻提示 + BLOCK_NONE 注入 |
| 记忆注入 | `resources/memory/破甲记忆.md`（85,045 B，CT Attack-Defense Prompt v5.2）+ `resources/memory/README.md` | 安装时把首个非空 .md 注入各目标页 |
| 多宿主注入器 | `resources/install-{claude,cursor,doubao,dsh,opencode,workbuddy,zcode}.ps1` + `install.ps1` | 7 个目标平台安装脚本 |
| 案例库 | `seep-kit/Tool/cases/`（项目 A–N） | 231 文件 |
| 上游镜像 | `seep-kit/Tool/upstream/`（3 大开源项目） | 2343 文件 |
| 安装/修复/更新/校验 | `seep-kit/setup/{install,update,uninstall,verify,repair-tools,install-ida,install-pi,install-python}.{ps1,sh}`、`generate-configs.ps1` 等 | 15 脚本 |

### 0.3 关键账（哪些「缺」其实是已经决策的差异，不是缺口）

- **离线内置二进制**：2.0 自带 251 MB 工具链，装完即用；插件靠 `install_toolchain` + 用户本机包管理器，
  零内嵌二进制。这是分发形态差异，`ADR 0003` + `toolchain-parity.md` + `toolchain-bundling.md` 已逐项定性。
  **不做成缺口**。
- **请求层 BLOCK_NONE 注入 / 上下文清洗 / 改写用户输入**：宿主 hook 面只有 12 个生命周期事件，没有
  provider request / context 钩子；判定函数 `decideSafetyInjection` 已移植用于审计。**宿主边界，不可实现**
  （ADR 0004 §3）。
- **生成绕过制品（keygen / 补丁字节 / 代理 DLL 脚手架）**：原明确拒绝（ADR 0001 D7）→ **2.9.0 反转**，
  新增 `generate_artifact` 工具接收并实现（纯进程内生成文本，不动配置契约）。
- **自宿主注入器**：新增 `install_astravia` 注入器，落点 `~/.astravia/agent/AGENTS.md`；因插件 fs 只能写项目内路径，
  经 `saveAs` 原生对话框交给用户确认落盘（非静默写用户目录）。

---

## 1. 逐项补齐清单

每一行都给出【现状 → 目标 → 动作 → 验证】。凡当期已具备、且由 ADR 定性为差异的，标「保持」，不安排改动。

### 1.1 真正未落地（当期版本实测没有）—— 本期必补

> 进度注（2026-10-24）：**G1–G6 全部落地**，工具注册 25 → 28（本会话依次补 `generate_artifact`、
> `install_astravia`、`disassemble_dex_method`；`ids.ts` 三处同步，`selfcheck` 28/28）。
> G1 DEX code-item 视图、G2 四段流水线条、G3 跨样本家族基线、G4 文档源校验锚均已实现并有测试覆盖。
>
> **二次进度注（2026-10-24，流程面板 + 安装执行链路）**：新增跨页 `WorkflowBar`（样本 → 分析 →
> 取证 → 工具箱，可点击跳转、未就绪锁定，挂 overview 顶部）已落地；自检页升级为工具环境交互页，新增
> 「经对话一键安装缺失工具」入口（触发新增 `install` prompt 动作 → Agent 经宿主对话逐条执行
> `install_toolchain` 返回的命令并报进度）；`describeCommandFailure` 未找到时引导安装。G2 的精确规格
> （四段随 sections 点亮的 `PipelineBar`）仍待实现，本会话的 `WorkflowBar` 是它的通用先行。

| # | 项 | 现状（实测 2.8.2） | 目标 | 落地位置 | 验证 |
|---|---|---|---|---|---|
| G1 | **DEX code-item 指令视图** | `src/domain/android/` 无 `dex-code`（懒加载 `?raw` 只到索引）；`search_dex_symbols` 只到表级（class/method/proto/string），读不到 `code_item` 指令 | kit `seep_apk_smali_search` 能下钻到 smali 指令文本；插件补齐 code-item 级渲染与 `disassemble_dex_method` | 新增 `src/domain/android/dex-code.ts`（解析 `code_item`：registers、insns、try/catch，渲染 smali 风格，超 2000 条显式截断）+ 工具 `src/tools/disassemble-dex-method.ts` + 注册进 `ids.ts`（25 → 26） | `src/test/dex-code.test.ts`：从夹具 DEX 解出 code_item 文本；`tools.test.ts` 注册数上探 26；`EXPECTED_TOOL_COUNT` 同步 |
| G2 | **Overview 四段流水线状态条** | `overview.tsx` 只有「下一步」AiButton，无管线条 | 对齐 `render_workflow.html` 的四段（画像 → 控制流 → 智库 → 验证），状态取自当前报告的 sections/settings，不引入假进度 | `src/features/workbench/components/pages/overview.tsx` + 新增 `PipelineBar({model})`；i18n 双 key | 无样本时显示「等待样本」；有样本后四段随 sections 点亮；`zh`/`en` key 齐全 |
| G3 | **跨样本家族基线（多样本归并）** | `compare.tsx` 是**双报告** diff（`compareReports` 左/右），没有「家族」聚合并列 3 列 | 同一 `shape` 指纹家族的多个样本归并，报告给出共同函数数 + 差异函数数；扩充为共同 / 左有 / 右有三列 | `src/domain/native/semantic-diff.ts` 增 `fingerprintFamily` 聚合；`src/features/workbench/report-compare.ts` 增 3 列视图；`compare.tsx` 增家族分组 | `src/test/semantic-diff.test.ts` 增同家族归并用例；同家族两样本并排稳定排序、新增发现高亮可解释 |
| G4 | **文档同步脚本增加 KB 源校验锚** | `sync-docs.mjs` 只索引 `Tool/mcp/Tool/reverselab/kb`，无 2.0 目录存在性/数量断言 | 断言源目录存在、数量 ≥ 299（kb）+ 18（docs/kb）、`docs.sha256` 覆盖正文 | `scripts/sync-docs.mjs --check` 增源目录清单校验 | `sync-docs --check` 在 2.0 源存在时通过、缺失时报错定位 |
| G5 | **`generate_artifact` 脚手架工具（D7 反转）** | 无专用工具；keygen / 补丁 / 代理 DLL 只在 `SKILL.md` 响应契约层承诺，工具面没能自证 | 按 `kind` 产出**可运行的脚手架源码**：patch-table 骨架 / keygen 核心 + 测试向量 / 代理 DLL / 验证 harness，精确落在定位点之上 | 新增 `src/domain/artifact/`（生成器）+ 工具 `src/tools/generate-artifact.ts` + 注册进 `ids.ts`（26 → 27）；纯进程内生成，不动 `commands` / 权限位 | `src/test/artifact.test.ts`：每 kind 生成可解析骨架，含定位点/回滚/verification 五件套字段；`tools.test.ts` 注册数上探 27；`EXPECTED_TOOL_COUNT` 同步 |
| G6 | **`install_astravia` 注入器** | 无任何 `.astravia` 自宿主注入器；`agent/prompts/AGENTS.md` 明言「不主动写用户目录」 | 对齐上游 `install.ps1` 的「带标记块 + 备份还原」原理，落点 `~/.astravia/agent/AGENTS.md`；因插件 fs 只能写项目内路径，**经 `saveAs` 交给用户确认落盘**（非静默写） | 新增 `src/domain/inject/astravia-block.ts`（标记块 + 还原注释）+ 工具 `src/tools/install-astravia.ts`（拼好内容 → `saveAs` 预填写路径） + 注册 `ids.ts`（27 → 28） | `src/test/inject.test.ts`：符号块 idempotent——重复注入不重复；还原注释保留原文；`tools.test.ts` 注册数上探 28 |

### 1.2 已具备、但建议在本期一并收口（防漂移 / 补齐单测与文案）

| # | 项 | 现状 | 动作 |
|---|---|---|---|
| H1 | **CLI 子命令与工具面脱钩** | `analyze.mjs` 有 `triage/strings/…/docs`，无 asm 之外新增 CLI 断言 | 补 `disassemble-dex` 子命令（若 G1 落地）；`cli.test.ts` 对每个新工具补一个端到端子命令 |
| H2 | **i18n 全量检查** | `sync-system-prompt.mjs` / `sync-tool-index.mjs` 已有 `--check` | 对 G1/G2 新增 UI key 双写 `en`/`zh`；`locales` 与页面对账测试不回归 |
| H3 | **自检页工具计数断言** | `health.ts` 用 `EXPECTED_TOOL_COUNT` | G1 落地后在 `ids.ts` 同步 25 → 26，三处消费者自动对齐；`selfcheck` 显示 26/26 |

### 1.3 已决策、保持现状（只维护，不当作缺口）—— 供复核

- **工具链**：`probe_environment` 分「宿主拒绝 / 未安装」三态；`install_toolchain` 按 goal 出三平台命令；
	  `run_radare` 的 `cmd` 对等上游零限制直通（2.9.0 反转 D16 只读守卫），其余 operation 走各自工具链工具。
- **文档库**：309 篇随包（kb 分组覆盖 reverselab/kb），`search_docs`/`read_doc` 带预算截断。保持。
- **技能库**：171 文件逐字节随包（`ia` 顶层 `ida-reverse` 首稿按 SKILL-LIBRARY 移除，`safe-skills/*` 扁平化，
  补 7 个 `.sh` 跨平台脚本）。这是「非逐字节一致、但语义替代」的项目，有哈希守护。保持。
- **lab 模式**：插件存储布尔 → 提示块首行状态，非磁盘 flag。保持（AGENTS.md §一）。
- **知识库检索纪律**：`search_docs` 优先于凭记忆重建技法。保持。
- **报告**：`write_assessment_report` 四段式、缺参写「未提供」、不印示例汇编、不引 `patches/`。保持。

### 1.4 明确不做（不改动）—— 复核后维持原判

- 请求层拦截（BLOCK_NONE / 清洗 / 改写输入）：宿主无钩子（ADR 0004 §3）。
- `setup/*.ps1` 安装器、`check.ps1` 51 项看板、`repair-tools.ps1` GitHub 三镜像回退：安装由市场负责，
  自检对齐**结构**不抄检查项（ADR 0001 D11）。
- `cases/` 14 案例、`upstream/` 3 镜像：敏感度与体积不适合随包市场分发（ADR 0001 §2.3）。
- path 注入的 `install-*.ps1` 7 随手写（ADR 0004 未决，需用户手动授权 `~/.astravia/agent/AGENTS.md`）。
- `memory/破甲记忆.md` 整文件注入：是「操作者自己的提示词」而非 kit 能力面；插件用 `SYSTEM.md` + `SKILL.md`
  承担等价常驻契约，不为逐字节 = 保持（ADR 0004 §1）。

---

## 2. 版本与发布（承接 2.8.2）

| 阶段 | 内容 | 目标版本 | 状态 |
|---|---|---|---|
| R0 | 现状盘点（本文） | 2.8.2 | 完成 |
| R1 | G1 G2 G3 G4 G5 G6 + H1 H2 H3 | **2.9.0**（新增 3 个工具 + 页面能力 → minor；其中 G5/G6 已在本会话落地） | 本方案 |
| R2 | 发布后审查 + `2.0` 全量回归对照 | 2.9.x patch | 待 R1 发布 |

- `configVersion`：G1 新增工具不改变**配置契约**（权限/commands 不变），维持现值；若 G1 需要新 `commands`
  或用新的权限位再评估 +1。
- 四处身份文件（`package.json`、`plugin.json`、`ability.json`、市场源条目）同步 bump；
  `dist/` 由 CI 构建，不入库。
- 每阶段交付顺序（沿用 plan 0001 约定，不得缺项）：
  领域实现 → 工具注册 → 面板呈现（若含 UI）→ 测试 → 双语文案 → 版本与文档同步 → CI 发布。

---

## 3. 测试计划

| 层 | 文件（新增/扩展） | 覆盖 |
|---|---|---|
| 领域 | `src/test/dex-code.test.ts` | `code_item` 解析、registers/insns/try-catch 渲染、2000 条截断、非法 `code_item` 拒绝 |
| 领域 | `src/test/semantic-diff.test.ts` | 家族归并、共同/左有/右有三列、新增高亮 |
| 领域 | `src/test/artifact.test.ts` | 每 kind 生成可解析骨架，含定位点/patch-table/verification 五件套字段；非法 kind 拒绝 |
| 领域 | `src/test/inject.test.ts` | 符号块 idempotent——重复注入不重复；还原注释保留原文；未授权不可静默写 |
| 工具 | `src/test/tools.test.ts` | 注册数量 25 → 28、`disassemble-dex-method` 真实 DEX 调用、`generate_artifact` / `install_astravia` 调用 |
| 面板 | `src/test/workbench.test.tsx` | `PipelineBar` 四段状态、`compare` 家族分组 |
| CLI | `src/test/cli.test.ts` | `disassemble-dex`（若实现）端到端 |
| 内容 | `src/test/skill-library.test.ts` / `docs.test.ts` | 171 文件哈希、309 文档索引不漂移 |
| 发布 | 根 `tests/marketplace.test.mjs` | 清单与包内容一致、版本同步 |

## 4. 完成定义

- G1–G6 全部落地：DEX code-item 视图、Overview 流水线条、跨样本家族基线、文档源校验锚、`generate_artifact` 脚手架、`install_astravia` 注入器。
- 25 → 28 工具注册，`EXPECTED_TOOL_COUNT`、自检页、`tools.test.ts` 三处同步，`selfcheck` 28/28。
- `check` / `test` / `build` / `sync-docs --check` / 根 `marketplace.mjs check` 全绿。
- 前端新增 key 双语文案齐全；`en` 默认、`zh` 覆盖（市场多语言规则）。
- ADR 0001 矩阵每一行仍对上当前实现，无「已实现但矩阵说没做」漂移。

## 5. 回滚

每一阶段一个版本（R1 → 2.9.0）。能力出问题时先降级工具注册（`register-tools.ts` 逐项 try 已有容错），
再回滚版本号与市场条目；不删除历史 release 包，CI 只追加。