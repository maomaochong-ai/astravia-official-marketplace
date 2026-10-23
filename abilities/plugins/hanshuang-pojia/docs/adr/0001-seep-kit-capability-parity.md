# ADR 0001：对标 seep-kit 的能力矩阵与取舍

- 状态：已接受（2026-10-22）
- 决策对象：`abilities/plugins/hanshuang-pojia`（插件，当前 2.4.0）
- 参照对象：`seep-kit` 1.6.0（外部工具箱，随 `寒霜破甲工具` 分发）
- 关联文档：[实施方案](../plans/0001-capability-parity-phases.md)、[ADR 0002](./0002-external-process-bridge.md)

> 后续变更：本 ADR 依据「插件不能起子进程」这一个当时未被核实的前提，把 `seep_r2_*` / `seep_apk_*`
> 一族判为拒绝或规划。宿主实际提供了被授权的 `plugin.json#commands` + `ctx.command.run` 通道，
> [ADR 0002](./0002-external-process-bridge.md) 推翻该前提并在 2.4.2 对等实现。本文保留原矩阵作为
> 历史记录；涉及外部进程的结论以 ADR 0002 为准，`seep_kb_payloads` 与规避策略类拒绝项不变。

## 1. 背景

插件与 kit 是两件不同的东西（详见 `references/plugin-handbook.md` §1）：插件是市场分发的
TypeScript 面板 + Agent 工具，运行在宿主渲染进程内；kit 是用户自行安装的外部工具箱，通过 MCP
暴露 23 个工具，另有 9 个技能包、10 篇手册、14 个脱敏案例工程与一批 PowerShell/Python 脚本。

用户要求"参考对象具备的能力都要集成过来"。这句话不能按字面执行，原因是三条硬约束：

1. **面板不能调用 MCP。** MCP 活在宿主的 agent 运行时里，不在插件渲染进程里。插件 `plugin.json`
   也不声明任何 MCP 客户端权限。
2. **插件不能起子进程。** 权限清单里没有 `process.spawn` 一类能力；`fs` 只授权项目根目录内、
   单文件 ≤ 32 MiB。因此依赖 `radare2` / `jadx` / `apktool` / `python` 的步骤无法在插件内执行。

所以本 ADR 的口径是：**凡是能从样本字节算出来的分析能力，插件自研补齐；凡是必须依赖外部进程
或规避策略的，明确降级并写清替代路径。** 矩阵里每一行都有结论，没有"以后再说"。

## 2. 能力矩阵

图例：`已具备` = 插件内可离线运行；`本期补齐` = 本 ADR 落地（P1）；`规划` = 后续阶段；
`文档化` = 只作为资料/说明，不在插件内执行；`拒绝` = 明确不做，附理由；`部分具备` = 只覆盖上游的一部分，
差额写明落在谁身上。P2（外部进程桥，ADR 0002）补齐的行在结论里标 `P2 补齐`。

### 2.1 MCP `seep` 23 个工具

| # | kit 工具 | kit 机制 | 插件现状 | 结论 |
|---|---|---|---|---|
| 1 | `seep_status` | 探测 r2/jadx/apktool 是否在 PATH | `probe_environment`：八条 `--version` 探针（r2/rabin2/radiff2/rasm2/jadx/apktool/java/frida），逐项区分「宿主拒绝」与「未安装」 | 已具备（P2 补齐） |
| 2 | `seep_ida_status` | 探测 IDA 授权与端口 | 无 | 文档化：面板不持有 IDA 会话 |
| 3 | `seep_r2_info` | `rabin2 -I/-S/-z` | `triage_binary` + Manifest / Entropy 页 | 已具备 |
| 4 | `seep_r2_cmd` | 任意 r2 命令（`aaa; {command}` 直接进 `-c`，零限制） | `run_radare operation=cmd`：同样进 `r2 -q -c`，但命令先过只读守卫（写/open/调试/工程/重启/挂载/网络族与管道、重定向、`$(`、反引号一律拒绝） | 已具备（P2 补齐，有界：不复刻零限制） |
| 5 | `seep_r2_strings` | 按节区抽字符串 | `scan_binary_strings`，带偏移与过滤 | 已具备 |
| 6 | `seep_r2_functions` | 函数列表 | `list_code_symbols` + CFG 视图 + 候选函数发现 | 已具备 |
| 7 | `seep_r2_disasm` | 反汇编区间 | `disassemble_range` + 三档深度视图（`deep.ts`） | 已具备 |
| 8 | `seep_r2_decompile` | r2 `pdc` 伪 C，`full/fold/summary` 三档 | 无（`handbook` 记为最大缺口） | **本期补齐**：`decompile_function` |
| 9 | `seep_r2_diff` | `radiff2 -C` 函数级语义 diff | `diff_binaries` 只有原始字节 hunk | **本期补齐**：`diff_functions` |
| 10 | `seep_r2_asm` | `rasm2`：asm ↔ hex 双向 | `encode.ts`：x86 / x86-64 / AArch64 九条助记符，编码后用插件自己的解码器回转校验，CLI 有 `asm` 子命令 | **本期补齐**：自研编码器（有界子集，不假装完整汇编器）；装了 r2 时 `rasm2` 仍是全量汇编的路径 |
| 11 | `seep_r2_xrefs` | 交叉引用、分页 | `xref.ts`：调用者/被调用者/引用者，面板内 | 已具备 |
| 12 | `seep_apk_info` | `aapt`/`apkanalyzer` 事实 | `triage_binary` 解析 AXML + DEX + 签名摘要 | 已具备 |
| 13 | `seep_apk_decompile` | jadx / apktool 产物落盘 | `decompile_android operation=decompile`（jadx，`--deobf` 默认开） | 已具备（P2 补齐；需用户自装 jadx） |
| 14 | `seep_apk_unpack` | apktool 解包 | `decompile_android operation=unpack`（apktool，**不带 `-f`**，输出目录已存在时先拒） | 已具备（P2 补齐；需用户自装 apktool） |
| 15 | `seep_apk_smali_search` | 在 smali 目录里 grep | `search_dex_symbols` 直接读 `class_defs` / `method_ids` / `string_ids` | 已具备（表级）；P3 增补 code-item 级指令视图 |
| 16 | `seep_apk_gen_hook` | 生成 Frida hook 模板 | 无 | **本期补齐**：`generate_hook`（只生成插桩模板，不生成绕过逻辑） |
| 17 | `seep_kb_search` | 289 篇战术笔记检索 | `search_docs`（309 篇，按标题/id/主题） | 已具备 |
| 18 | `seep_kb_read` | 读单篇，带预算 | `read_doc`（`maxChars` 可见截断） | 已具备 |
| 19 | `seep_kb_checklist` | 6 类清单，每次读 kit kb 里对应的一篇 | 那六篇原文全部随包，按 id 用 `read_doc` 读：`kb/ctf-website/checklists/{web-ctf-first-30-min,attack-matrix,evidence}`、`kb/pe-reverse/techniques/06-ioc-extraction/{01-ioc-extraction,02-persistence-startup-chain}`、`kb/pe-reverse/techniques/07-yara-sigma/01-yara-rule-writing` | 文档化：内容 1:1 齐备，无参数化 checklist 工具 |
| 20 | `seep_kb_payloads` | 结构化 payload 库，按 `jwt/ssrf/sqli/ssti/prototype` 分节 | 原文随包：`kb/ctf-website/payloads/web-payload-seeds`（`read_doc` 可读全文）；无按类别切片的工具 | 拒绝：按场景拼装攻击载荷超出本插件的「分析 + 授权验证」边界；原文仍可检索阅读 |
| 21 | `seep_task_init` | 建 case 目录骨架 | `init_task`：`<root>/<name>/{samples,exports,reports}` + `README.md`，`report=true` 时写 `reports/security-report.md` 骨架；**不建 `patches/`** | 已具备（P2 补齐） |
| 22 | `seep_auto_triage` | 遍历目录逐个分诊 | 单文件 `triage_binary` | **本期补齐**：`triage_directory` |
| 23 | `seep_gen_security_report` | 七参数白盒评估报告模板（`vuln_type`/`branch_location`/PoC/加固建议），直接落 `reports/` | `write_assessment_report`（2.4.5）：同一套四段式契约，落 `reports/<target>_security_assessment_report.md`；`init_task` 建骨架，`export_triage_report` 导出分诊结论 | **已具备**：参数化填充已实现；与上游的差异是有意为之 —— 未提供的段落写「未提供」而不虚构结论、不印示例汇编、不引用 `patches/`，支持 `zh`/`en` |

### 2.2 技能包（9 组件 / 165 文件）

| kit 单元 | 文件数 / 体积 | 插件处理 | 结论 |
|---|---|---|---|
| `softseep` | 9 / 123 KB | 已逐字节随包于 `agent/docs/skill-library/` | 文档化（不注册为 skill，理由见 ADR D9） |
| `apkseep` | 112 / 1.8 MB | 同上 | 文档化 |
| `ida-reverse` | 1 / 4 KB | 同上 | 文档化 |
| `client-license-validation-bypass` | 1 / 30 KB | 同上 | 文档化：阅读用；插件不生成绕过补丁 |
| `safe-skills/*` 5 组 | 42 / 419 KB | 同上 | 文档化 |

`SKILL.md` PART V.6 的路由表负责告诉 Agent 先打开哪一份；`src/test/skill-library.test.ts`
重算哈希，保证这棵树不会静默漂移。

### 2.3 手册、案例、脚本、图示

| kit 资产 | 内容 | 插件处理 | 结论 |
|---|---|---|---|
| `MANUAL/` 10 篇 | 部署、IDA、反调试、脱壳、PoC 验证、跨平台、合规中继、拒答矩阵 | 前 9 篇随包为 `manual` 分组；`COMPLIANCE-RELAY` / `MODEL-REFUSAL-MATRIX` 不随包 | 文档化 / 拒绝（后两篇） |
| `Tool/cases/` 14 个工程 | 脱敏实战范例（含脚本与结果） | 不随包 | 文档化：体积与敏感度都不适合市场分发 |
| `setup/install*.ps1`、`update.sh` 等 | 各宿主安装脚本 | 不执行、不随包 | 文档化：安装由市场负责 |
| `check.ps1` / `check.bat` | 51 项 / 9 组体检看板 | Self-check 页同构呈现（分组 + 逐项状态 + 结论条） | 已具备（呈现方式）；P1 补分组计数与结论条 |
| `scripts/compliance-relay`、`probe-refusal.py` | 防拒中继 | 无 | 拒绝：规避安全策略，不是逆向能力 |
| `docs/images/render_verifier.html` | 9 维体检看板视觉 | Self-check 页 | 已具备；P1 对齐分组徽标 |
| `docs/images/render_workflow.html` | G-Auth → 4 段流水线 → 指标页脚 | Overview 页 | 规划 P2：流水线状态条 |
| `Tool/prompts/SYSTEM.md`、`extensions/` | 常驻系统提示 + 拦截扩展 | 插件用 runtime kernel block 代替 | 拒绝常驻注入；等价能力已由 `kernel.ts` 提供 |

## 3. 决策

### D1 能力对标以"面板能从字节算出什么"为口径

同一个问题（"这个函数在做什么"）在 kit 里由 r2 回答，在插件里必须由 TypeScript 回答。矩阵按
**用户可观察结果**对齐，不按工具名对齐。由此得出的判定：23 个 seep 工具中 12 项已具备、4 项本期
补齐、3 项规划、2 项拒绝也要补齐、2 项文档化。

### D2 移植伪代码恢复，但明确它是什么

`src/domain/native/pseudo.ts` 在既有 `cfg.ts` 之上重建类 C 文本：基本块、`goto` 标签、条件分支、
调用、返回值、栈槽命名、字符串引用，三档详略（`full` / `fold` / `summary`）与字符预算。

**它不是反编译器**：不做类型恢复、不做 SSA、不做变量合并，输出以寄存器名为准。工具描述与页脚
必须写出这句，否则用户会把"寄存器级伪 C"当成 Hex-Rays 结果。这比不实现更危险。

### D3 语义 diff 用函数指纹，不用字节对齐

`src/domain/native/semantic-diff.ts` 为每个函数算两个哈希：`exact` = 原始指令字节流；`shape` =
助记符 + 操作数形状归一化后的序列（寄存器名、立即数、分支目标抹平）。两版之间按符号名 → 精确
哈希 → 形状哈希三级匹配，输出新增 / 删除 / 改动 / 仅位移四类。

`diff_binaries` 保留原始字节 hunk，两者并列而不是互相替代：字节 hunk 回答"改了哪里"，函数指纹
回答"动了哪个函数"。抹平立即数意味着**常量变化会被判为 shape 相同**，所以改动函数同时列出
`exact` 差异计数，避免把"改了判定常量"说成"没变"。

### D4 hook 模板只做观测，不做绕过

`src/domain/android/hook-template.ts` 从 DEX 索引命中生成 Frida 脚本：`Java.perform`、
`Java.use`、overload 选择、参数打印、可选 `backtrace`、可选返回值观测。生成物里不出现"强制返回
true / 改判定"这类语句 —— 那是把分析工具变成绕过生成器。需要验证判定结果时，让用户在自己授权
的环境里读观测日志。

### D5 目录级批量 triage 走宿主文件 API

`triage_directory` 用 `ctx.fs.listFilesRecursive`（宿主上限 10 000 文件）枚举，按扩展名过滤，逐个
调用既有 `triage()`，输出按风险排序的汇总表 + 计数。不递归越过项目根，不写盘，不并发轰炸
（顺序执行，单文件失败只记一行）。

### D6 增加一个真能跑的 CLI，作为同引擎的第二个入口

`scripts/analyze.mjs` 用 esbuild 把 `src/cli/analyze.ts` 打成临时 ESM 再执行，子命令：
`triage` / `strings` / `symbols` / `disasm` / `decompile` / `diff` / `hook` / `docs`。

理由有三条：kit 的能力是靠 `check.ps1`、`seep_mcp_server.py` 这类可执行物证明的，只有面板无法
自证；同一份领域代码有两个入口，测试才能覆盖"真实文件"而不只是夹具；用户在 CI/终端里复现问题
不需要装插件。CLI 只依赖 `src/domain`，不 import 插件 SDK。

### D7 拒绝：防拒中继、拒答探测、keygen / 补丁字节生成

前两项规避的是模型安全策略，与本插件的能力目标无关；第三项把"定位判定点"升级成"批量产出绕过
制品"，超出授权验证的边界。`SKILL.md` 里关于交付形状的既有表述不改（用户要求不删减），但插件
不新增任何自动化实现去生成绕过制品。工具面只到"指出判定点 + 给出可观测的插桩模板"。

### D8 不内置 jadx / apktool / IDA，改为声明式外挂（2.4.2 修订）

原决策的理由是“插件无权起进程”，于是把深度工作全推给 kit。2.4.2 改的是手段，不是目的：插件仍然
不分发任何第三方二进制，也不为缺失的引擎做代偿；区别在于它现在可以调用**用户自己已安装**的可执行文件。

- 声明：`plugin.json#commands` 逐字列出八个可执行文件（`r2`、`rabin2`、`radiff2`、`rasm2`、`jadx`、
  `apktool`、`java`、`frida`），`src/domain/toolchain/catalog.ts` 的 `COMMANDS` 与之逐字节一致，测试两边对账。
- 授权：另需 `agent.command.run`，由宿主在运行时问用户；没有权限时 `createCommandRunner` 返回 `null`，
  工具输出“不可用”而不是抛错。
- 形态：一律 `execFile` 语义 + 参数数组，不走 shell；`run_radare` 的 `cmd` 只放行只读族，写、shell、
  调试器、工程、挂载命令一律拒绝。
- 降级：`probe_environment` 把“宿主拒绝”与“未安装”分开报；缺引擎时 `run_radare` / `decompile_android`
  直接说需要哪个二进制、怎么装，不编造结果。

IDA 不在其中：它没有可脚本化的命令行契约，继续走 kit 的 MCP 矩阵（`plugin-handbook.md` §7 的降级表不变）。


### D9 技能库保持为文档资产

不注册进 `agent.skillPaths`：上游 frontmatter 用 YAML block scalar 且描述超长，`ida-reverse` 重复
出现两次。注册就得改上游文档，改了就不再是"逐字节一致的副本"。路由交给 `SKILL.md` V.6。

### D10 参考文档改名，`SKILL.md` 一字不删

`references/workbench-2.0.md` → `references/plugin-handbook.md`。理由：名字里的 `2.0` 是版本噪声，
内容其实是"插件与 kit 的全景手册"，新名字直接说明它是什么。`SKILL.md` 只改指向该文件的路径，
正文不删、不改语义。

### D11 工作台自检对齐 verifier 看板的**结构**，不抄它的检查项

上游 51 项检查的是 kit 的目录（`Tool/skill/`、`jadx`、`apktool`、`python`），插件无权也无法验证。
对齐的是呈现方式：分组卡片、组内逐项 PASS / OPT / FAIL、组头计数、顶部结论条
（READY / DEGRADED / BLOCKED）。检查项换成插件自己的四组：随包文档索引、解码引擎、工具注册表、
宿主桥接。kit 侧维度在页面上明确写"不归插件管"，不伪造绿灯。

### D12 版本按 0.0.1 递增，发布走 CI

每次对外可见的能力变化递增 patch：本次 2.4.1 → 2.4.2。四处身份文件（`plugin.json`、`ability.json`、
`package.json`、`.astravia/marketplace.source.json`）同步，`configVersion` 因新增权限与 `commands`
属于配置契约变更而同步 +1（1 → 2），`dist/` 由 CI 构建，不提交。

## 4. 后果

- **能力覆盖**：23 个 seep 工具的可观察结果里，17 项由插件自己在进程内给出；另有 4 项（`seep_reverse`、
  `seep_decompile_apk`、`seep_disasm`、`seep_list_functions` 对应的 radare2 / jadx / apktool 面）现在通过
  用户本机二进制补齐，前提是宿主授予命令通道。
- **新增工具面**：10 → 18 个 Agent 工具。`ids.ts`、`register-tools.ts`、locale 文案、工具计数断言四处
  同步，漏一处测试就红。
- **诚实性成本**：伪代码、语义 diff、hook 模板都必须带“这不是什么”的说明，文案与测试一起写；工具链工具
  同样要把“宿主拒绝”和“未安装”分开说。
- **不可移植项**：IDA 与任意 r2 命令仍永久缺席（后者只放行只读族），靠文档与降级路径兜住。
- **风险**：`triage_directory` 在小文件极多的目录会慢；靠扩展名白名单 + 顺序执行 + 上限收敛，
  并在输出里报告"跳过了多少、失败了几个"。外部命令的代价是“看起来有工具就有答案”：对未安装的引擎，
  输出必须保留安装提示而不是静默降级成插件自己的近似结果。

## 5. 验证

- `npm run check`（tsc）、`npm run test`（vitest，含 `src/test/toolchain.test.ts` 与 18 个工具的注册断言）、
  `npm run build`。`src/test/toolchain.test.ts` 同时校验 `plugin.json#commands` 与 `catalog.ts#COMMANDS`
  逐字一致，以及所有断言都只用假 runner（不会真的去起 r2 / jadx）。
- `node scripts/sync-docs.mjs --check`：文档索引与磁盘一致。
- `node scripts/analyze.mjs triage <真实样本>`：CLI 在终端跑通同一条链路。
- 安装到桌面端后，在对话里各调一次新工具，确认工具描述、参数 schema、输出形状符合预期；
  另需在没有安装 r2 / jadx 的机器上确认 `probe_environment` 给出的是安装提示，而不是泛化错误。
