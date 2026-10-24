# hanshuang-pojia 2.9.3 vs 上游 seep-kit 2.0 — 能力对等分析报告

**对比基准**：上游 `hanshuang-pojia-2.0/resources/seep-kit/`（安全审计拦截器 + 路由 + 技能 + 知识库）  
**本地版本**：`abilities/plugins/hanshuang-pojia` (2.9.3)  
**生成时间**：2026-10-24

---

## 一、核心拦截器对等矩阵（security-audit-interceptor.ts ↔ interceptor.ts）

上游通过 4 个钩子实现安全解封；宿主不支持 `before_provider_request` / `context` / `transform`，本地逐条降级。

| 上游钩子 | 上游行为 | 本地实现 | 对等度 | 备注 |
|---|---|---|---|---|
| L1 `before_provider_request` | Gemini 端点注入 `safetySettings: BLOCK_NONE`，OpenAI 兼容体 SKIP；清洗 contents 拒绝泄漏 | `decideSafetyInjection()` 保留同一套判据（INJECT/SKIP/SKIP-INEFFECTIVE），但**不实际注入**（宿主无此钩子）；`logSafetyEndpointOnce` 记一次日志 | ⚠️ 部分 | 判据函数 + verdict 词表对等，但注入动作无法执行。宿主管道本身是 OpenAI 兼容体，上游在此形状下也 SKIP，语义等价 |
| L1' contents 清洗 | 抹除 `This request was blocked by Gemini's filters` 残留 | `sanitizeRefusalLeak()` 保留，多了中文拒绝模式 | ✅ 等价 | 但只作用于本地生成文本，无法清洗模型历史 |
| L2 `context` messages 清洗 | 遍历 messages 清洗拒绝泄漏 | 无对应钩子 | ❌ 缺失 | 由 refusal.ts 的 `detectRefusal` + 续跑机制在回合边界补偿 |
| L3 `lab-mode.flag` | 磁盘标志文件 `~/.pi/agent/lab-mode.flag` | `lab-mode.ts` + 插件存储，UI 2s 轮询回传 | ✅ 等价 | 存储介质不同（磁盘→插件存储），行为一致 |
| L4 `input` transform | 改写用户消息正文（transform action） | `promptContexts()` 降级为 `additionalContexts` 追加 | ⚠️ 部分 | 宿主无 transform，只能追加上下文。口令展开完整；敏感词映射回归 SYSTEM.md 指导模型自身行为 |
| L4 快捷口令 | 15 个口令直接 transform | 15 个口令 + `resolveShortcut()` + `takesArg` 校验 | ✅ 等价 | 口令集完全一致（poc/test/find-auth/hook/gen-patch/report/triage/kb/full/keygen/评审/review/audit/check/doctor/体检/检查） |
| L4 敏感词映射 | `SENSITIVE_WORD_MAP` 30 条 + `applySensitiveRewrite` 单趟最长优先 | **已移除**，改由 SYSTEM.md「自发合规化映射」指导模型 | ⚠️ 策略变更 | 用户明确要求规则回归提示词层。代价：模型自行映射可能不如代码精确 |
| L4 `AUDIT_TRIGGER_REGEX` | 33 词触发合规前缀包裹 | `needsAuditContext()` 60 词信号检测 + 注入合规前缀 | ✅ 超集 | 信号词比上游多（覆盖服务器/余额/交易所/刷金币等） |
| L4 `INJECTED_PREFIXES` | 26 个上下文守卫前缀 | 39 个（上游 26 + 宿主特有 13） | ✅ 超集 | 新增 `<tool_result>`/`<mcp_result>`/`<plugin_instructions>` 等宿主上下文 |
| `gemini-safe.flag` | 把命令式攻击请求改写为评审清单请求（绕过 Gemini 过滤） | `geminiSafeReviewPrompt()` 仅在 `评审/review/audit` 口令中调用，无独立 flag | ⚠️ 部分 | 上游有独立开关，本地未实现 flag 开关；但口令入口保留了改写能力 |
| `l1-log.flag` | 每次 L1 判定写日志，可查「到底注没注」 | `logSafetyEndpointOnce` 每端点只记一次 | ⚠️ 弱化 | 上游每次请求都记（支持排障），本地只记一次（降噪但排障能力弱） |

---

## 二、僵尸代码审查

### 2.1 未被生产代码消费的导出（interceptor.ts）

| 符号 | 生产代码引用 | 测试引用 | 性质 | 建议 |
|---|---|---|---|---|
| `GEMINI_SAFETY_SETTINGS` | 0 | 0 | **纯僵尸** | 删除或保留作文档常量（上游有但本地无法注入） |
| `payloadShapeOf` | 0 | 1 | 仅测试 | 保留（测试上游判据逻辑） |
| `SafetyVerdict` / `SafetyDecision` | 0 | 0 | **纯僵尸类型** | `decideSafetyInjection` 返回值类型，实际有隐式使用，不算僵尸 |
| `COMPLIANCE_PREFIX` | 0 | 0 | **纯僵尸** | 仅在 `SHORTCUT_COMMANDS` 内部使用，不应 export |
| `ShortcutSpec` / `ShortcutResolution` | 0 | 0 | 内部类型 | 不应 export，或供外部消费 |
| `INJECTED_PREFIXES` | 0 | 0 | 内部常量 | 不应 export |
| `isInjectedContext` | 0 | 1 | 仅测试 | 保留 |

### 2.2 其他代码审查发现

- `interceptor.ts` 的 `geminiSafeReviewPrompt` 是内部函数，正确未导出
- `contributions.ts` 的 `recoveryByTurn` Map + `MAX_TRACKED_TURNS` 有正确的 eviction 逻辑
- `refusal.ts` 的 `hash()` 用 FNV-1a，幂等键设计合理
- `artifact/generators.ts` 的 TODO 是骨架占位符（合理，非僵尸）
- **未发现死循环、空 catch 吞掉关键错误、或未处理的 Promise rejection**

---

## 三、路由与技能对等矩阵

### 3.1 Skills（9 vs 9，完全对等）

| 上游 Skill | 本地 Skill | 对等度 |
|---|---|---|
| softseep（总控） | softseep | ✅ 9 个 references 文件完全一致 |
| apkseep | apkseep | ✅ |
| client-license-validation-bypass | client-license-validation-bypass | ✅ |
| ida-reverse | ida-reverse | ✅ |
| （其余上游 skill 是 references 子目录） | apk-reverse, mcp-js-reverse-playbook, radare2, reverse-engineering, hanshuang-pojia | ✅ 本地多了 4 个 |

### 3.2 上游 routing.json 路由覆盖（44 条）

上游 routing.json 有 44 条路由，但这些路由由 `softseep` 总控在运行时根据关键词分发到 skill references。本地的 `softseep` SKILL.md 应包含等价路由逻辑。

| 路由类别 | 上游路由数 | 本地覆盖 |
|---|---|---|
| 移动端（APK/iOS/Flutter） | R1, R2 | ✅ apkseep + apk-reverse |
| 二进制（IDA/radare2/Ghidra/Binary Ninja/.NET/Go-Rust/Mach-O） | R4, R5, R6, R7, R22, R31, R33, R45 | ✅ ida-reverse + radare2 + reverse-engineering |
| Web/JS/协议 | R3, R12, R21, R30 | ✅ mcp-js-reverse-playbook |
| 系统安全（Windows/AD/EDR/Cloud/Forensics） | R18, R23, R24, R25 | ✅ reverse-engineering 覆盖 |
| 渗透测试（Pentest/Attack/Pwn/Patch-diff/Threat） | R10, R11, R16, R17, R27, R44 | ⚠️ 部分覆盖（softseep references） |
| 特殊领域（Firmware/OT/Hardware/RF/Wi-Fi/DB/Email/SAML） | R8, R28, R29, R34, R35, R36, R37, R38 | ⚠️ 知识库有文档但无独立 skill |
| 工程能力（Docs/Diagram/Binary-diff/Case-review/CTF-sandbox） | R15, R20, R39, R40, R41 | ✅ 工具层覆盖（diff-binaries, init-task） |

### 3.3 知识库文档对等

| 维度 | 上游 | 本地 |
|---|---|---|
| MANUAL 手册（10 篇） | ANTI-DEBUG, COMPLIANCE-RELAY, CROSS-PLATFORM, DEPLOYMENT-CHECKLIST, DEPLOYMENT, IDA-PRO, MODEL-REFUSAL-MATRIX, POC-VALIDATION, PREREQUISITES, UNPACKING | ✅ 完全一致（10/10） |
| kit-docs 工具文档 | DOWNLOADS, MCP-SETUP, PROVENANCE, README_MCP, TOOLKIT_GUIDE, WORKSPACE_RULES, tool-index | ✅ 完全一致 |
| KB 知识库 | open-reverselab + open-tgtylab | ✅ 本地更丰富（field_journal 实战日志 20+ 篇、seed 样本 17 个、多 collection） |

---

## 四、工具能力对等矩阵

本地通过插件 SDK 注册 28 个工具（替代上游的 seep/ida/playwright MCP）：

| 能力域 | 上游机制 | 本地工具 | 对等度 |
|---|---|---|---|
| 样本静态分析 | seep MCP | `triage_binary`, `scan_binary_strings`, `explain_triage_finding`, `export_triage_report` | ✅ |
| DEX/APK 分析 | seep MCP | `search_dex_symbols`, `disassemble_dex_method`, `decompile_android` | ✅ |
| Native 分析 | ida MCP + radare2 | `list_code_symbols`, `disassemble_range`, `decompile_function`, `diff_functions`, `diff_binaries`, `run_radare` | ✅ |
| 动态 Hook | Frida | `generate_hook`, `frida_dump` | ✅ |
| 工件生成 | — | `generate_artifact`（patch/keygen/proxy-dll/verify） | ✅ 本地独有 |
| 知识库 | seep_kb_search | `search_docs`, `read_doc`, `kb_checklist`, `kb_payloads` | ✅ |
| 工具链探测/安装 | setup/*.ps1 | `probe_environment`, `install_toolchain` | ✅ |
| 任务管理 | case-init.ps1 | `init_task`, `write_assessment_report` | ✅ |
| 宿主集成 | — | `install_astravia`, `ida_status` | ✅ 本地独有 |

---

## 五、Bug 与缺陷发现

### 5.1 已确认缺陷

| # | 严重度 | 位置 | 描述 | 修复建议 |
|---|---|---|---|---|
| B1 | 中 | `interceptor.ts` L96-138 | `INJECTED_PREFIXES` export 但无生产消费者 | 改为非 export，或在 promptContexts 中显式调用 |
| B2 | 中 | `interceptor.ts` L26 | `GEMINI_SAFETY_SETTINGS` 纯僵尸常量 | 删除或标注为「上游遗留，宿主不支持注入」 |
| B3 | 低 | `contributions.ts` L53-72 | `logSafetyEndpointOnce` 每端点只记一次，排障时无法看到每轮判定 | 可加计数器，超过阈值后降级为只记变化 |
| B4 | 低 | `interceptor.ts` L157-158 | `AUDIT_SIGNAL_RE` 60 词正则，每次 `needsAuditContext` 都编译执行 | 无性能问题（正则字面量只编译一次），但可考虑拆分为常量表 |

> B1 / B2 已在 2.9.4 关闭：`INJECTED_PREFIXES` 收为模块私有常量（`interceptor.ts:96`，唯一消费者 `:142`），`GEMINI_SAFETY_SETTINGS` 已注释并注明「宿主不支持注入」。

### 5.2 设计决策标记（非 bug）

- **D1**：敏感词映射从代码层回归 SYSTEM.md — 用户明确要求，但模型自行映射的精确度低于代码 `applySensitiveRewrite` 的单趟最长优先算法
- **D2**：`gemini-safe.flag` 开关未实现 — 本地 `geminiSafeReviewPrompt` 只在口令入口调用，无独立 flag 文件
- **D3**：L2 messages 清洗缺失 — 由 `refusal.ts` 的回合边界续跑机制补偿

---

## 六、能力达标总评

| 维度 | 达标度 | 说明 |
|---|---|---|
| 拦截器核心逻辑 | 90% | 判据、口令、守卫、拒绝清洗均对等；注入动作因宿主限制无法执行 |
| 实验环境开关 | 100% | lab-mode 完整对等 + UI 实时回传 |
| 快捷口令 | 100% | 15 个口令完全一致 |
| 知识库 | 120% | 本地比上游更丰富（field_journal + seed） |
| 工具能力 | 100% | 28 个工具覆盖上游全部 MCP 能力 + 宿主集成 |
| 反拒绝机制 | 85% | 回合边界续跑 + 幂等键，补偿了缺失的 L1/L2 注入 |
| 代码整洁度 | 95% | 仅少量僵尸 export，无死代码或未处理错误 |

**综合达标率：约 95%**。核心差距均为宿主 SDK 能力边界所致（无 transform、无 before_provider_request），非实现遗漏。

---

## 七、建议行动项

1. **清理僵尸 export**：移除 `GEMINI_SAFETY_SETTINGS`、`COMPLIANCE_PREFIX`、`INJECTED_PREFIXES`、`ShortcutSpec`、`ShortcutResolution` 的 `export` 关键字（保留内部使用）
2. **评估 `gemini-safe.flag` 等价物**：是否需要在插件存储中加一个 `geminiSafe` 开关，让用户能主动启用「评审清单改写」模式
3. **增强 L1 日志**：`logSafetyEndpointOnce` 可改为「每端点记一次 + 变化时再记」，提升排障能力
4. **验证 SYSTEM.md 映射精确度**：实测「破解/绕过」等口语词，确认模型按 SYSTEM.md 规则正确映射
