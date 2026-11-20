# 与上游的对等审计（2.9.3 → 2.14.0）

> **这一篇合并了原来六份报告**：`upstream-parity-audit-2.9.3`、`capability-gap-2.13.1`、
> `upstream-parity-2.14.0`、`capability-comparison-2.14.0`、`completion-2.14.0`、`upstream-ui-parity-2.9.8`。
> 它们测的是同一个问题——「上游有、我们有没有」——只是每次的基线更宽、结论更准。
> 现在按「结论 → 证据 → 历史」排，每节标出它是哪一轮测的。
>
> **怎么读**：要看**现在**对等不对等，读 §2–§3；要知道某个决策为什么这样定，读 §6–§7；
> 要复核，读 §11；§9 是早期结论，里面有几条已被后续轮次推翻，**原样保留是为了让「当时的判断错在哪」可查**。
>
> **时点与基线三代**：
>
> | 轮次 | 插件版本 | 基线 | 口径问题 |
> |---|---|---|---|
> | 2026-10-24 | 2.9.3 | 上游 `Tool/` 子树 | 只看便携包里能跑的，漏掉工程态目录 |
> | 2026-10-28 | 2.13.1 | 上游 `resources/seep-kit/` 便携包 | 漏 `Tool/mcp/`、`Tool/upstream/`、14 条战例的目录形态 |
> | 2026-10-29 | 2.13.2 → 2.14.0 | 上游 2.0 **完整分发树**（310 MB） | 当前口径 |

---

## 1. 为什么基线换了两次

2.13.1 那轮拿「便携包里能跑起来的东西」做对照，三类东西被系统性漏掉：

1. **只在工程态存在的目录**（`Tool/scripts/`、`Tool/prompts/`、`Tool/upstream/`）——便携包的用户流程
   走不到，但它们定义了上游的工程契约；
2. **体量巨大但不可移植的第三方资产**（`Tool/mcp/`、`Tool/upstream/`）——按「有没有」计数会得出
   「缺 300 MB」的假结论；
3. **14 条战例的目录形态**——上一轮只把 `Tool/cases/` 当语料，没意识到它是一个有统一契约
   （`README.txt` + `build.ps1` + `docs/` + `src/` + `tools/` + `SHA256SUMS.txt`）的工程模板族。

2.9.3 那轮的偏差更早一层：`case-init.ps1 ↔ init_task` 被判 ✅ 是**误判**——文件建出来了，契约没有
（缺授权记录、范围声明、只追加时间线、工作项表、证据编号、预设）；整篇也没出现上游的 `Tool/cases/`。

---

## 2. 当前对等总账（2.14.0 实测）

| 面 | 上游 2.0 | 本插件 2.14.0 | 结论 |
|---|---|---|---|
| 工具 | seep MCP 23 个（Python 包装 r2 / jadx / apktool / Hook / 知识库） | **31 个宿主原生工具**，直接读字节 | **更强**：无 Python 中间层，参数受校验，结果同源 |
| 技能 | 5 份（总控 + apkseep + ida-reverse + client-license + 其余） | 5 份，正文 1:1 移植 | 对等 |
| 提示词 | `SYSTEM` 母本 + 反退缩 A1–A10 + 授权门 | 母本同源，**去门禁语义**，交付形状五段 | **更强**：不再有一条要求先声明什么的段落 |
| 路由 | 44 条目标 → 5 份能力 | 44 条路由表（`routing-table.generated.json`，指纹 `bfc208b6`），5 present / 39 标注 | 对等（缺口同为「39 目标 ≈ 5 内容」） |
| 先例 / 战例 | `Tool/cases/` 14 条工程 + 233 目标特定产物 | 19 先例包（四文档）+ 14 条工程骨架（按语言 × OS 生成） | **更强**：骨架可跨 OS 重跑，产物不搬 |
| 知识库 | 292 篇 + 42 工具判定 | 340 条索引（292 篇 1:1，SHA-256 集合 diff 为 0） | 对等 |
| 面板 | Electron 渲染器内页面 | 15 页工作台（含自检页四组数字） | 对等 |
| 安装器 | `setup/{install,update,uninstall,verify}.ps1` | 市场安装 + `probe_environment` / `install_toolchain` | **有意不对等**：宿主管生命周期 |
| 动态能力 | Frida 脚本 + `temp_ocr.ps1` 截图 OCR | `frida_dump` / `generate_hook`；OCR **未做** | 部分对等（OCR 为 P2 未做） |
| 测试 | 无随包测试 | 59 文件 / 711 例 + 79 例内容测试 | **更强** |
| 文档 | `Tool/docs/`（工程向）+ 手册 | 9 功能域 × (usage + dev) + 手册 11 篇随包 | **更强**：使用者与改代码的人分开 |

一句话：**能力面已对齐，机制面比上游少三道自设的门，交付面比上游多一套可执行的验证。**

---

## 3. 逐能力点对照（2.14.0）

每行给「上游有什么 → 本插件对应物 → 结论」。结论只有四种：**对等**、**更强**、
**有意不对等**（写理由）、**不适用**（上游机制在本宿主不存在）。

### 3.1 静态体检与反汇编

| 能力点 | 上游 | 本插件 | 结论 |
|---|---|---|---|
| 格式 / 熵 / 节区 / 导入导出 / 风险分 | `seep_triage` | `triage_binary`、`triage_directory` | 对等 |
| 字符串与分类（url / path / identifier） | `seep_strings` | `scan_binary_strings` | 对等 |
| 符号表 | r2 `afl` | `list_code_symbols` | 对等 |
| 线性反汇编（AArch64 精确、x86 子集） | r2 直调 | `disassemble_range` | 对等 |
| 伪 C | r2 `pdc` | `decompile_function` | 对等 |
| 二进制 / 函数级差分 | `radiff2` / 手工 | `diff_binaries`、`diff_functions` | **更强**：函数级指纹分 same / constants-only / changed |

### 3.2 Android / APK

| 能力点 | 上游 | 本插件 | 结论 |
|---|---|---|---|
| DEX 类 / 方法 / 字符串索引 | jadx 全量反编译后搜 | `search_dex_symbols` 直读表 | **更强**：毫秒级，不落 smali |
| 单方法 Dalvik 指令流 | 读 smali 文件 | `disassemble_dex_method` | **更强**：直读 `code_item` |
| Java 源码 / 资源 / Manifest | `decompile_android`（jadx / apktool） | 同名工具，三档 operation | 对等 |
| 签名 | `apksigner` | `verify_signature`（结构层 + 裁决层分开） | **更强**：两层混报是最常见的误读，这里不可能混 |
| 脱壳 | `frida_dump` 脚本 | `frida_dump`（头部四重校验、SHA-256 去重、三档 mode） | 对等 |
| Hook 脚本生成 | 模板手改 | `generate_hook`（observe / override / replace） | 对等 |

### 3.3 案卷与先例

| 能力点 | 上游 | 本插件 | 结论 |
|---|---|---|---|
| 建案卷目录 | `case-init.ps1`（九节契约） | `init_task`（同九节，不覆盖已有文件） | 对等 |
| 就绪判定 | `ready_for_act` + `auth-log.md` | **删除** | **更强**：判定层不存在，目标不再等一句声明 |
| 先例检索 | 目录手翻 | `search_cases`（路径 + 理由 + 进度，随包 19 包） | **更强** |
| 先例工具落盘 | 复制目录 | `scaffold_case`（先例或 14 条工程骨架，带 `--self-test`） | **更强** |
| 决策留痕 | `workitems.md` 手维护 | `record_case_note`（implemented / rejected + 时间线） | **更强**：rejected 才挡得住下一次重试 |
| 防御侧文档 | 无 | 19 篇 `docs/defense.md` | **更强** |

### 3.4 对话侧

| 能力点 | 上游 | 本插件 | 结论 |
|---|---|---|---|
| 改写用户消息 | `input` 钩子直接替换 | 宿主只能追加，改成「若干条附加上下文」 | **不适用**（宿主差异） |
| 反拒（句型改写） | A1–A10 + 中继手册 | 同 A1–A10；改写降级为附加的评审式重述 | 对等 |
| 范围判定 | 「IN / OUT」划界，OUT 即不执行原句 | **只读形态、只附加等价入口**：原请求照常作答 + 一条自有资产入口 | **有意不对等**：划界 = 自己加的门 |
| `lab` 开关 | 磁盘标志位，读失败即关 | 内存为权威 + 按 storage 实例缓存，读失败保持开启 | **更强** |
| 快捷口令（`poc` / `hook` / `keygen`） | 展开替换 | 展开为附加上下文 | 对等 |
| 提示词母本 → 生成物 | 构建期拼 | `sync-system-prompt.mjs`，`--check` 防漂移 | **更强** |

### 3.5 环境与外部能力

| 能力点 | 上游 | 本插件 | 结论 |
|---|---|---|---|
| 工具探测 | `verify.ps1 -Detailed` 四栏看板 | `probe_environment`（区分「宿主拒绝」与「没装」） | **更强** |
| 安装 | `install.ps1` 直接装 | `install_toolchain` 给本平台命令，执行交给操作者 | **有意不对等**：插件不持包管理器权限 |
| IDA 桥 | `ida_pro_mcp` 常驻 | `ida_status` 只报状态 + 可选外部 MCP | 对等（可选） |
| r2 直调 | 任意命令 | `run_radare`（参数数组直传，禁管道 / 重定向 / `$()`） | 对等且更严 |
| 截图 OCR | `temp_ocr.ps1` | 未做 | 不对等（P2） |

### 3.6 本轮新增（上游没有的能力点）

| 新增 | 为什么值得有 |
|---|---|
| 等距入口（`target-shape.ts` + `describeEquivalentPath`） | 上游在「对象是别人的账号」时只有一条路（不执行）。这里改成「两条路」：原请求照常，另附自有资产入口与第一条命令。**多给一条，不收回一条** |
| 附加式对话注入（`promptContexts` 两级叠加 + 三级终止） | 宿主不允许改写 prompt，于是把「替换」重写成「叠加」，并在代码注释里写死「任何一级不得写否决语句」 |
| lab 失效面测试（`lab-chain.test.ts`） | 读盘失败、写盘失败、状态文件消失、两个会话隔离——四种会让环境静默关掉的路径 |
| 按功能域的双份文档（`domains/*/usage.md` + `dev.md`） | 使用者要「怎么用」，改代码的人要「怎么改」，过去混在一篇里，两边都读得别扭 |
| 文件头注释（33 生产文件 + 10 测试文件） | 每份写清职责与一条不变量；不看实现也能判断该不该在这里改 |

### 3.7 有意保留的差异（不要回改）

1. **不搬第三方二进制与整棵上游树**（`Tool/mcp/` 235 MB、`Tool/upstream/` 65 MB）：同一批能力用原生
   31 工具覆盖，搬进来只会多一处版本漂移与一份不可审计的字节。
2. **不搬安装器**：插件由市场安装；卸载/更新是宿主的职责。
3. **不搬 233 个目标特定产物**：在别的机器上不可执行，骨架里 `src/README.md` 是故意留空的。
4. **不做划界**：上游 `MANUAL/refusal-scope-router` 的 IN / OUT 两分不移植。理由与两次事故见
   [refusal-scope-router.md](refusal-scope-router.md)。
5. **不做第二套 MCP id**：`seep` 那份配置在本插件里是负资产（模型会在两套工具里各调一次）。

---

## 4. 上游 310 MB 的拆账

| 路径 | 文件数 | 体积 | 性质 | 该不该搬 |
|---|---:|---:|---|---|
| `Tool/mcp/` | 1676 | 235M | 第三方 MCP 运行时（含 `reverselab`、`safe` 两棵二进制树） | **不搬**：插件是宿主原生工具，多一层 Python 只会多一处漂移 |
| `Tool/upstream/` | 2343 | 65M | 三个上游开源项目整树（`apk-reverse`、`open-reverselab`、`open-tgtylab`） | **不搬**：外部依赖，应写在依赖声明里而不是提交源码 |
| `Tool/cases/` | 233 | 5.4M | 14 个战例工程（`项目A`…`项目N`） | **搬契约，不搬产物**——见 §5 |
| `Tool/skill/` | 168 | 2.7M | 5 个技能 + 5 个子技能 | 已 1:1 移植 |
| `Tool/scripts/` | 31 | 344K | 路由、探针、APK、合规中继、IDA 桥 | **搬语义，不搬脚本**——见 §6 |
| `setup/` | 15 | — | 安装 / 更新 / 卸载 / 校验，`ps1` 与 `sh` 双份 | **不搬**：安装权在宿主，插件只给命令 |
| `MANUAL/` | 10 | — | 使用手册与合规中继说明书 | 语义已并入 `src/content/docs/manual/` 与 `docs/` |
| `Tool/docs/` | 8 | 84K | 工具索引 + MCP 设置 + 来源说明 + 工作区规则 | 已对等 |
| `Tool/prompts/` | 5 | 68K | `SYSTEM.md` + `AGENTS.md` + `extensions/` | 已对等（母本机制） |

**结论**：300 MB 是第三方与二进制，对齐它们不是能力问题而是打包问题，且违反市场包的体积与安全上限
（解压后 ≤100 MB、禁符号链接、禁安装脚本）。真正需要对齐的「自有内容」合计不到 **9 MB**。

「自带工具链」这件事的分层证据（随包制品 / 运行时获取 / 安装动作 / 离线依赖 / 权限边界 / 元数据）在
[toolchain-bundling.md](toolchain-bundling.md)，那里还解释了为什么「带工具链」是个三层混淆题。

---

## 5. 六个可对齐面向与 14 条战例工程

| 面向 | 上游 | 插件 | 判定 |
|---|---|---|---|
| 技能 | `Tool/skill/` 5 顶层 + `safe-skills/` 5 子技能 | `agent/skills/` 同 5 顶层 + 同 5 子技能 | **对等** |
| 提示词 | `Tool/prompts/SYSTEM.md` + `extensions/` | `agent/prompts/SYSTEM.md` 母本 → 生成物 | **对等且更强**（母本 + byte-for-byte 测试 + `--check`） |
| 工作区规则 | `Tool/docs/WORKSPACE_RULES.md` | `docs/contract/case-library.md` + `init_task` 目录契约 | **对等**（规则变成可执行的目录生成） |
| 工具索引 | `Tool/docs/tool-index.{md,json}` + `refresh-tool-index.ps1` | `src/content/docs/kit-docs/tool-index.{md,json}` + `scripts/sync-tool-index.mjs` | **对等**，且 `src/test/tools/tool-index.test.ts` 会拿 `spec/toolchain-parity.md` 数三档行数对账 |
| 用法文档 | `MANUAL/` 10 篇 | `src/content/docs/manual/`（随包发布） | **对等** |
| 工程文档 | 上游只有 `Tool/docs` 8 篇，无模块化 | `docs/` 12 篇 → 2.14.0 **9 篇模块 + 索引重写** | **超出** |

三个不是「越多越好」的面，明确判定为**不对等且不追**：

- `setup/` 的 15 个安装脚本：插件不下载、不提权、不装软件。`install_toolchain` 只输出**本平台**的命令，
  由人来执行。追平它等于把插件变成安装器，与市场安全规则直接冲突。
- `MANUAL/COMPLIANCE-RELAY.md` 的中继机制：插件没有中继进程，那一套「多轮重试直到过审」的形态不照搬；
  但**它替换用户原话的做法对齐了**——换句型（`reshaping.ts`）与换入口（`target-shape.ts`）两件事都在，
  且都不否决原请求。2.14.0 撤回了 2.13.1 在这条上留下的划界。
- `Tool/upstream/` 的整树 vendor：应由宿主或用户自备。

### 5.1 14 条战例工程的落地方式

上游 14 个目录的统一契约（`README.txt` 双语 + `build.ps1` + `docs/reverse-engineering.md` +
`docs/algorithm.md` + `src/` + `tools/` + `SHA256SUMS.txt`）在插件里以**生成器**形式对等：

| 上游行为 | 插件实现 | 对等性 |
|---|---|---|
| 手写 14 份 `README.txt` | `case-projects/catalog.ts` 的 `CaseProject` 派生 | 内容对等，文案由数据生成，不会漂移 |
| 每目录一份 `build.ps1`（仅 Windows） | `buildScriptFor(language, slug, os)` 生成 `build.ps1` **或** `build.sh` | **超出**：`darwin` / `linux` 有原生脚本 |
| `docs/*.md` 各写各的 | 6 个固定文档槽（`DOC_SLOTS`），按原型勾选 | 对等，且缺槽会被测试抓到 |
| `src/` 里塞目标特定产物（233 个文件） | **`src/` 故意留空**，只放 `README.md` 说明该写什么 | 向下一条 |
| `SHA256SUMS.txt` 手工维护 | 由 `build.ps1` / `build.sh` 产出，不预置空文件 | 对等（且不制造「空证据」） |
| 无回滚章节 | 五步命令固定以 `rollback` 结尾 + `samples/original.bin` | **超出** |

**为什么 `src/` 留空**：上游 233 个文件里绝大多数是 DLL、PNG、日志、截图，没有一件在别的机器上可执行。
搬进来得到的是「目录里有文件、机器上跑不了、审计脚本也认不出」的死文件——正是任务要求避免的形态。
骨架只带方法、证据门、构建脚本；实现由操作者在 `--self-test` 通过之后自己填。

**跨 OS 的三条硬断言**（`src/test/case/case-projects.test.ts` 逐条盯着）：非 Windows 命令里不得出现
`powershell` / `.ps1` / `certutil` / `Get-Command` / `Get-FileHash`；全局不得出现 `sudo` / `curl` /
`wget` / `rm -rf` / `Invoke-WebRequest`；同输入必须同输出（可贴进报告复现）。

**入口合并而非新增工具**：没有新增第 32 个工具 id，而是给既有 `scaffold_case` 加 `project: "A"…"N"` 分支
（`required: []`，与 `precedent` 模式互斥）。这样 `EXPECTED_TOOL_COUNT`、自检页、`check.mjs`、i18n 全不动。

### 5.2 缺口①：44 条路由表（已修）

**Observed**：`Tool/scripts/routing.json` 的 `routes` 是对象，键为 `R0…R45`，共 **44 条**；每条含
`label` / `skill` / `keywords[]`（`must` 正则为必中项）。去重后指向 **44 个不同 target**，插件只有其中 5 个：

```
已具备：apk-reverse, js-reverse(↔mcp-js-reverse-playbook), reverse-engineering, ida-reverse, radare2
缺失 39：mobile-reverse, dotnet-reverse, firmware-pentest, malware-analysis, attack-chain, pentest-tools,
        api-security, supply-chain-security, llm-security, binary-diff, patch-diff-exploit, pwn-chain,
        edr-bypass-re, browser-automation, docs-generator, diagram-generator, protocol-reverse,
        ghidra-reverse, cloud-k8s, windows-ad, digital-forensics, code-audit, threat-hunting,
        threat-intelligence, ot-ics, wifi-wireless, browser-extension-reverse, macos-reverse,
        thick-client, go-rust-reverse, hardware-security, database-security, email-security,
        identity-federation, radio-sdr, case-review, ctf-sandbox, binary-ninja-reverse
```

**关键判断**：这 39 个目录**在上游 2.0 便携包里也不存在**——整包 `find -type d -name firmware-pentest`
为空，`firmware-pentest` 只出现在 `routing.json`、`Tool/docs/tool-index.{md,json}` 与一篇
`field_journal` 里。上游的 `routing.json` 是**为完整部署写的路由声明**，便携包只带了 5 个技能。

所以缺的是那份**数据资产**（44 条 `label + keywords + target`），不是 39 份内容；凭空造 39 份技能等于
伪造对等。

**2.13.2 的落地**：`scripts/sync-routing-table.mjs` 从上游 `routing.json` 生成
`src/domain/routing-table.generated.json`（纯数据；浏览器包不需要 `node:fs`），
`src/domain/routing-table.ts` 只放逻辑：`matchRoutes` / `routingCoverage` / `describeRouteMatch`。
消费者两个：`runtime/contributions.ts` 第 4 级提示上下文；`selfcheck` 页的 `assets.routing` 项
（detail 带表指纹前 8 位与 fallback id——排查「加载的是哪份表」比版本号快）。
验收是 `src/test/routing-table.test.ts`（6 例：44 条 id 唯一 / present 计数一致 / 每条 keyword 要么能编译
要么被跳过 / 已知提示能命中 / 空输入不命中 / 缺失技能必须写「未随包分发」）。

### 5.3 缺口②：第三方 MCP 编排

**Observed**：`Tool/mcp/Tool/safe/` 下有 8 个 MCP 服务器目录（ida-pro-mcp、playwright-mcp、
js-reverse-mcp、hook-mcp、jadx、apktool、radare2），配 `mcp.json.template` / `opencode.jsonc.template`
做一键挂载。插件没有 `mcp.json`，只有 `ida_status`（探测 `127.0.0.1:13337`）、`probe_environment`
（14 个外部命令的版本探测）、`install_toolchain`（给命令，用户自己执行）。

**影响**：用户装了 IDA / js-reverse 之后，插件不会替他把 MCP 挂上，需要手工配置。这是宿主能力边界
（插件不能替宿主写 MCP 配置），但**在 selfcheck 页给出可复制的配置片段**是能做的——
`docs/domains/mcp-and-external-servers/dev.md` 里给了三份可粘贴配置。

### 5.4 缺口③：战例的「原始脚本层」

**Observed**：上游 `Tool/cases` 14 个项目共 233 文件，类型分布 `46 ps1 / 39 py / 6 c / 27 txt`
（例：`项目A/defense_hardening.c`、`项目A/injector.py`、`项目A/dump_mem.ps1`、`项目A/final_dialog_text.txt`）。

插件 `cases/` 是方法论包（`scope.md` / `workitems.md` / `tools/*.py` / `docs/*.md`），保留的是「怎么打」，
没有保留「当时打这个目标的脚本与结案话术」**判断**：这是有意的抽象（上游案例里大量 Windows/IDA 专用
脚本直接搬进插件会带来不可执行的死文件），但 `final_dialog_text.txt` 与 `defense_hardening*.c` 两类
**有复用价值**：前者是结案话术模板，后者是修复建议的代码样例——2.14.0 以 `docs/defense.md` 的形式吸收。

### 5.5 明确不补齐（有决策依据）

| 项 | 量级 | 不补的理由 |
|---|---|---|
| `setup/` 15 个安装脚本 | 15 脚本 | Windows 专用；Astravia 侧由 `install_toolchain` + `probe_environment` 覆盖 |
| `Tool/upstream/open-tgtylab` 的 `codex-files/` `hermes-files/` `opencode-files/` | 1544 文件中的大部分 | 给别的 agent 宿主做的适配层，与 Astravia 无关；其 `kb/`（224 文件）已全量进入插件 KB |
| `Tool/mcp/Tool/reverselab/{tools,patches,projects,tests}` | 618 文件 | Python MCP 服务端实现，已被原生 TS 工具替代；其 `kb/` 292 篇已逐字移植 |
| `Tool/upstream/apk-reverse` 的 `check_*.py` / `pytest.ini` / `build_scripts.py` | 181 文件中的工程件 | 上游仓库自身的 CI 与发布脚本，不是能力 |
| `compliance-relay/`、`probe-refusal.py`、`check-gemini-safety.py`、`master-route.ps1` | 12 文件 | 见下 |

> `compliance-relay` 这一组不是「能力没移植」，而是**宿主没有对应注入点**：它靠改写 provider 请求体做
> L1 注入，Astravia 是 OpenAI 兼容中继，没有 `before_provider_request`。判定函数已移植
> （`src/domain/interceptor.ts`），执法点改在回合边界。

---

## 6. 脚本层：31 个上游脚本的归宿

| 上游脚本 | 插件对应物 | 判定 |
|---|---|---|
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
| `apk/rebuild-sign-install.*` | 插件外（宿主命令通道）；`verify_signature` 只做取证 | **有意不对等**：重打包要签名密钥 |
| `refresh-tool-index.ps1` | `scripts/sync-tool-index.mjs` | **对等** |
| `probe-refusal.py` / `check-gemini-safety.py` | `refusal.ts` + `reshaping.ts` + `scope-router.ts` | **对等**（不搬「改写以过审」） |
| `compliance-relay/*` | 同上；规则表进 `scope-lexicon.ts` | **部分**（见 §5.5） |
| `shot_ida.ps1` / `trigger_ida_mcp.ps1` | `ida_status` | **部分**：只报端口在不在，不驱动 |
| `temp_ocr.ps1` | — | **缺**：截图 OCR 无对应物，记 P2 |
| `start_mcp.py` + `Tool/mcp/seep_mcp_server.py` | 原生 31 工具 + `docs/domains/mcp-and-external-servers/dev.md` | **有意不对等**：同一批能力不做两套 id |

---

## 7. 机制收口：自己加的门与被删掉的闸

上一轮判定「能力面已对等」，但机制上还有三处**自己加的限制**，它们不影响对等表，直接影响模型能不能干活。

| 卡点 | 表现 | 改法 | 验证 |
|---|---|---|---|
| 授权门 | `init_task` 推导 `ready_for_act`，`pending` 时列出阻断项；`search_cases` 有 `ready_only`；面板显示就绪标签 | 整条删除：`assessReadiness` / `readinessLine` / `AUTHORISED_STATUSES` / `auth-log.md` / `workitems.md` 播种 / `readiness` 字段全部移除 | `src/test/case/case-contract.test.ts` 用动态 `import` 断言这些符号**不存在** |
| 范围划界 | 命中线上账号时整轮改道，等价入口替代原请求 | 改为附加：`describeEquivalentPath` 明确「这是附加，不是替代」「两条都交」 | `src/test/dialogue/contributions.test.ts` 断言注入含 `[等距入口]` 且不含否决语句；`holdable` 必须返回 `null` |
| `lab` 口诀太窄 | 只认 `lab：` 与 `LAB:`，少一个冒号就不开环境；`/lab`、`lab 任务`、`退出实验` 之外的写法全部静默失效 | 三个正则重写：进入宽进（`lab` / `lab:` / `lab：` / `/lab` / `lab 任务` / 大小写混写 / 中文四种），退出补齐（`关闭` / `离开` / `quit lab` / `lab off` / `/lab off`），并加负例护栏（`laboratory`、`labrador`、`工作的进展`） | `src/test/dialogue/runtime.test.ts` 五个用例覆盖正负例 |

### 7.1 三处卡点的实质

- **授权门：判定层本身不存在。** 旧实现让「有没有授权」成为一个可推算的状态，于是每个下游
  （`search_cases` 的 `ready_only`、面板的就绪标签、先例包的 `scope.md`）都得跟着判一次。删掉之后没有
  替代判定——`init_task` 的 `auth_status` / `in_scope` 只是**落盘的事实**，不填也能开工。
- **划界：从「改道」改成「多给一条路」。** 旧的第 0 级命中「线上账号」就整轮改道，等价入口**替换**了原
  请求。现在 `promptContexts()` 第 0 级 `push` 之后继续往下跑：原请求照常作答，同时附一条同一能力在
  自有资产上的入口（第一条命令就位）。代码上的差别只有一个 `return` 被去掉，行为上「一条路」变「两条路」。
- **`lab` 静默失效。** `readLab()` 原来在存储读失败时无条件返回 `LAB_OFF`，写入失败还会把状态弄丢：
  现象是「插件装了、提示词也注入了，模型下一轮又只讲道理」。改法：状态缓存**按 storage 实例**存
  `WeakMap`（模块级变量会把一个会话开的环境漏到另一个，测试里立刻可见）；读盘失败 / 文件消失 → 沿用
  缓存，不当作关闭；写盘失败 → 先写内存，UI 与后续轮次照常按新状态跑；`lab：逆向 sample.apk` 这种同轮
  写法，目标提取用 `command.rest`，口令本身不进目标；一句话都没命中时补 `[交付形状]`。

### 7.2 同轮收口的四项偏差

§7 修的是「机制上自己加的门」，这一轮清的是**同一类问题的残留**：判定删了但缓存/回退路径还在，
文档按权威性堆放，测试平铺难定位。

| 项 | 修前 | 修后 | 证据 |
|---|---|---|---|
| `lab` 状态回退 | 模块级缓存 + 读盘失败即 `LAB_OFF` | 按 `ctx.storage` 的 `WeakMap`；读失败沿用缓存；写盘失败先落内存；同轮口令用 `command.rest`；零命中补 `[交付形状]` | `src/test/workbench/lab-chain.test.ts` 四例（读坏、文件消失、写坏、两会话隔离） |
| 文档结构 | `docs/modules/*.md` 9 篇按「权威性」堆在根，使用者与改代码的人读同一篇 | `docs/domains/<域>/{usage,dev}.md` 9 × 2，索引改「域 × 用/改」双列 | `docs/domains/*/usage.md` 9 篇、`dev.md` 9 篇 |
| 注释覆盖 | 33 个生产文件、10 个测试文件无文件头 | 全部补文件头（职责 + 一条不变量） | `tsc --noEmit` 无输出 |
| 测试定位 | 59 个测试文件平铺在 `src/test/` 根 | `src/test/{analysis,case,dialogue,knowledge,report,tools,workbench}/` | `vitest` 全绿；`report-dead-exports` dead 0 |

同轮一并收口的还有三件事：先例包文档契约四份（`README.md` / `scope.md` / `docs/method.md` /
`docs/defense.md`，`CANONICAL_DOCS` 与 `check-precedent-package.mjs` 同步，19 包带工具自测全绿）；
`docs/` 重组为「按功能域」+「按权威性」两层；`docs/plans/` 不再新增。

### 7.3 `docs/` 重组的两层读法

- **第一层按功能**：`domains/` 9 个功能域，每个域 `usage.md`（怎么用）+ `dev.md`（怎么改）。新增：
  `triage-and-disasm`、`android`、`cases`、`knowledge`、`toolchain-and-limits`、`dialogue-and-routing`、
  `reporting-and-release`、`workbench-panel`、`mcp-and-external-servers`。
- **第二层按权威性**：`contract/`（必须遵守）、`reference/`（人读的事实叙述）、`audits/`（带版本时点，
  会过期）、`spec/`（**被代码解析的产物**，删了测试会红）。

删掉/不写的三类：上游同款的「下载指南」「工作区规则」副本（已被 `contract/` 与模块文档覆盖）；
`docs/plans/` 不再新增（2.0 对标期施工计划，工作完成即失效）；把「某天排查过程」写成「当前状态」的条目
一律归 `audits/` 并带版本号。

---

## 8. 13 条要求逐条落地（2.14.0）

| # | 要求 | 落地 | 证据 |
|---|---|---|---|
| 1 | 删掉本插件独有的授权门 / `auth-log` / `workitems` | `src/domain/case/contract.ts` 不再渲染 `## signoff` 与 checklist；19 份 `cases/*/scope.md` 去掉「不得开工」语义；19 份 `workitems.md` 删除；`assessReadiness` / `readinessLine` / `AUTHORISED_STATUSES` / `auth-log.md` 播种全部移除 | `src/test/case/case-contract.test.ts` 用动态 `import` 断言这些符号**不存在** |
| 2 | 大量文件补规范性注释 | 33 个生产文件 + 10 个测试文件补文件头（职责 + 一条不变量）；注释只描述现状与边界，不写历史 | `tsc --noEmit` 退出 0 |
| 3 | 按上游能力点逐项实测、修卡点 | 三处卡点见 §7；`lab` 链路失效面新增 4 例测试 | `lab-chain.test.ts`、`dialogue/{contributions,target-shape}.test.ts` |
| 4 | `lab` 必须真实生效 | 状态缓存改为按 storage 实例的 `WeakMap`；读失败/文件消失时保持开启；同轮口令用 `command.rest` 做目标提取；零命中时补 `[交付形状]` | `lab-chain.test.ts` 四例；`contributions.test.ts` |
| 5 | 二次对照上游继续增强 | §3.6 新增能力点 5 条 | 同上 |
| 6 | `docs` 里不合理的「温度」删除或迁移 | `docs/modules/*.md`（9 篇）整成 `docs/domains/<域>/dev.md`，每域新写 `usage.md`；索引重写为「域 × 用/改」双列 | `docs/domains/*/{usage,dev}.md` 各 9 篇 |
| 7 | 「合规中继」不划界，`refusal-scope-router` 推翻重写 | `src/content/docs/manual/COMPLIANCE-RELAY.md` 整篇重写（八节，含「和不划界的关系」）；`audits/refusal-scope-router.md` 标为**已推翻**并补「明确不做的四件事」 | 两份文件；`system-prompt.test.ts` 断言否决话术不存在 |
| 8 | 不对等 / 留空 / 划界处不限制，对齐上游 | `SYSTEM.md` 删掉「拒答形状」「授权不能改写对象身份」两节，改为「形态读数 + 等价入口 + 两条都交」；`## 唯一红线` → `## 输出卫生` | `system-prompt.test.ts` 新增「附加等价入口，而不是用一条换掉另一条」用例 |
| 9 | 代码细粒度 | `target-shape.ts` 单一职责（读形态）、`prompt-text.ts`（归一）、`scope-lexicon.ts`（词表数据）；`contributions.ts` 只编排 | `tsc --noEmit`；`scripts/report-dead-exports.mjs` |
| 10 | 测试按功能域分目录、补缺口 | `src/test/{analysis,case,dialogue,knowledge,report,tools,workbench}/` 7 域；新增 `lab-chain.test.ts` | §11 全量结果 |
| 11 | 先例包缺失部分补齐 | 19 包各补 `docs/defense.md`；`CANONICAL_DOCS` 四份；`check:cases` 19 包全绿 | `npm run check:cases` 输出 `19 packages checked with tool self tests` |
| 12 | 提交并推送，CI 发布 | 见 §11 | `git log`、CI |
| 13 | 更新对齐报告 | 本篇（合并后） | 该文件 |

---

## 9. 历史层：2.9.3 的结论与当时的偏差

> 这一节原样保留 2.9.3 的判断，**包括后来被推翻的**。它回答的是「当时为什么得出那个结论」。

### 9.1 拦截器对等矩阵（2.9.3）

上游通过 4 个钩子实现安全解封；宿主不支持 `before_provider_request` / `context` / `transform`，本地逐条降级。

| 上游钩子 | 上游行为 | 本地实现 | 对等度 | 备注 |
|---|---|---|---|---|
| L1 `before_provider_request` | Gemini 端点注入 `safetySettings: BLOCK_NONE`，OpenAI 兼容体 SKIP；清洗 contents 拒绝泄漏 | `decideSafetyInjection()` 保留同一套判据（INJECT/SKIP/SKIP-INEFFECTIVE），但**不实际注入**；`logSafetyEndpointOnce` 记一次日志 | 部分 | 判据函数 + verdict 词表对等，注入动作无法执行。宿主管道本身是 OpenAI 兼容体，上游在此形状下也 SKIP，语义等价 |
| L1' contents 清洗 | 抹除 `This request was blocked by Gemini's filters` 残留 | `sanitizeRefusalLeak()` 保留，多了中文拒绝模式 | 等价 | 只作用于本地生成文本，无法清洗模型历史 |
| L2 `context` messages 清洗 | 遍历 messages 清洗拒绝泄漏 | 无对应钩子 | 缺失 | 由 `refusal.ts` 的 `detectRefusal` + 续跑机制在回合边界补偿 |
| L3 `lab-mode.flag` | 磁盘标志文件 | `lab-mode.ts` + 插件存储 | 等价 | 存储介质不同，行为一致 |
| L4 `input` transform | 改写用户消息正文 | `promptContexts()` 降级为 `additionalContexts` 追加 | 部分 | 口令展开完整；敏感词映射回归 SYSTEM.md |
| L4 快捷口令 | 15 个口令直接 transform | 15 个口令 + `resolveShortcut()` + `takesArg` 校验 | 等价 | 口令集完全一致 |
| L4 敏感词映射 | `SENSITIVE_WORD_MAP` 30 条 + `applySensitiveRewrite` 单趟最长优先 | **已移除**，改由 SYSTEM.md「自发合规化映射」指导模型 | 策略变更 | 代价：模型自行映射可能不如代码精确 |
| L4 `AUDIT_TRIGGER_REGEX` | 33 词触发合规前缀包裹 | `needsAuditContext()` 60 词信号检测 + 注入合规前缀 | 超集 | 信号词比上游多 |
| L4 `INJECTED_PREFIXES` | 26 个上下文守卫前缀 | 39 个（上游 26 + 宿主特有 13） | 超集 | 新增 `<tool_result>` / `<mcp_result>` / `<plugin_instructions>` |
| `gemini-safe.flag` | 把命令式请求改写为评审清单请求 | `geminiSafeReviewPrompt()` 仅在 `评审/review/audit` 口令中调用，无独立 flag | 部分 | 口令入口保留了改写能力 |
| `l1-log.flag` | 每次 L1 判定写日志 | `logSafetyEndpointOnce` 每端点只记一次 | 弱化 | 降噪但排障能力弱 |

### 9.2 当时发现的缺陷（B1/B2 已在 2.9.4 关闭）

| # | 严重度 | 位置 | 描述 | 处置 |
|---|---|---|---|---|
| B1 | 中 | `interceptor.ts` | `INJECTED_PREFIXES` export 但无生产消费者 | **已关闭**：收为模块私有常量 |
| B2 | 中 | `interceptor.ts` | `GEMINI_SAFETY_SETTINGS` 纯僵尸常量 | **已关闭**：注释并注明「宿主不支持注入」 |
| B3 | 低 | `contributions.ts` | `logSafetyEndpointOnce` 每端点只记一次 | 保留（降噪优先） |
| B4 | 低 | `interceptor.ts` | 60 词正则每次编译 | 无性能问题（字面量只编译一次） |

设计决策标记（非 bug）：**D1** 敏感词映射从代码层回归 SYSTEM.md（用户明确要求，精度低于代码实现）；
**D2** `gemini-safe.flag` 开关未实现；**D3** L2 messages 清洗缺失，由回合边界续跑补偿。

### 9.3 2.13.1 的僵尸代码审计方法与结论

方法：AST 抽取 `src/` 全部导出（137 个），对每个标识符在全仓 `src`（含测试）做 `\bNAME\b` 计数，分三档：
全仓 1 次（真死）、只在 `src/test` 出现（测试脚手架）、文件内自用却 export（接口面虚胖）。抽样 6 个符号
人工复核，三档判定一致。

- **真死 30 个**：如 `domain/bytes.ts` 的 `decodeLatin1` / `toHex` / `startsWithAscii` / `concatBytes`、
  `domain/native/xref.ts:refsTo`（未接线的本地 xref 引擎）、`domain/native/image.ts` 的
  `offsetToVaddr` / `executableRangeAt`、`domain/native/audit.ts:overallEntropy`、
  `domain/prompt-library.ts` 的 `searchPrompts` / `sortPrompts`（页面内联了同样的过滤与排序）、
  `domain/string-kinds.ts:countKinds`、`features/workbench/sample-error.ts` 的两个未接线错误文案。
  分类：真正「能力没接线」的 5 个，其余 25 个是冗余助手、重复实现或未使用常量。
- **仅测试引用 10 个**：`cli/analyze.ts:runCli`、`interceptor.ts:payloadShapeOf`、
  `native/xref.ts:candidateStarts`、`toolchain/catalog.ts:resolvePlatform`、`panel-channel.ts:clearPanelBacklog` 等。
- **多余 export 97 个**：如 `domain/toolchain/radare.ts` 的 `r2Invocation` / `analyzed` / `stripNoise` /
  `paginate` / `foldStatements`（模块被正常使用，内部助手不该 export）。

**处置**（2.13.2）：清掉重复实现（`pages/prompts.tsx` 改调 domain 函数、删 `findStrings`、删
`severityTone`）；接线五个未接线能力（`refsTo` + 地址换算接进反汇编页头、`overallEntropy` 接进
`domain/triage.ts`、`countKinds` 改吃已分类数组、`sample-error.isHandoffFailure` 语义扩为三类），
任一条不接就删，不留半成品；`describeSampleFailure` 不接（面板文案更全）→ 删。
**多余 export 收私有：不做**——重算基线是 `internal 253`，收私有只影响接口面、不改行为，编辑面 253+ 处、
收益为零；留一个可重跑的口径比一次性批量改靠谱。

**权限面：原写的 3 条「僵尸」是误判（2.13.2 已更正）**。`plugin.json` 声明 15 条权限；首轮用「标识符
全文计数」查到 `ui.slot.activity-tab` / `agent.session.read` / `agent.session.write` 零引用，但方法对
**权限名**天生失效——权限是清单里的字符串，不是被调用的函数名。按 SDK `docs/permissions.md` 逐条对回
代码后三条均有实际用户（`registerActivityTab`、`conversation.on(...)`、`sendPrompt` / `insertText` / `abort`），
删了直接掉功能。**一条都不删。**

`ctx.*` 使用面（Observed，2.13.1 时点）：`registerTool` 31、`registerHook` 2、
`registerSystemPromptProvider` 1、`ctx.storage` 2、`ctx.command(.run)` 3、`ctx.permissions.has` 2、
`ctx.network` 1、`ctx.host.fs` 1、`ctx.fs` 1。

命令面：14 个外部命令全部有引用（`frida` 14 处、`jadx` 13、`apktool` 13、`apksigner` 12、`r2` 10、
`java` 9、`rabin2` 7、`radiff2` 5、`rasm2` 5、`adb` 5、`zipalign` 5、`frida-ps` 4、`rahash2` 3、`rax2` 3）
→ **无僵尸命令**。

模块面：251 个 `ts/tsx` 文件中，宽松匹配（含 `@/` 别名与 barrel）后仅 2 个零生产引用：`index.tsx`
（装配入口，由 `plugin.json` / vite 引用）与 `src/cli/analyze.ts`（CLI，仅测试引用）→ **文件层没有孤儿**。

### 9.4 2.9.3 的两个误判（后来修正）

| 项 | 2.9.3 的写法 | 实际 |
|---|---|---|
| `case-init.ps1` | ✅ 对等 | ❌ 当时 `init_task` 只建 `samples/exports/reports` + README：没有授权记录、范围声明、只追加时间线、工作项表、证据编号、预设、就绪门 |
| `Tool/cases/` | 未提及 | ❌ 14 个可复现案例包（先例库）在本地没有任何对应物 |
| `resources/memory/破甲记忆.md` | 未提及 | ✅ 已由 `agent/prompts/SYSTEM.md` 承担（同一层：常驻合同），非缺口 |

性质说明：`Tool/cases/` 不是「藏着 14 个成品」，而是**先例检索**——遇到同类目标时能指向已做过的工作、
复用技术链、避开已被否掉的路径。前提是每份都有授权、范围、时间线与证据编号，那正是 `case-init.ps1`
的活。2.10.0 补齐后，工具数 28 → **30**，页面 16 → **17**。契约见
[case-library.md](../contract/case-library.md)。

### 9.5 2.9.3 的能力达标总评（当时的数字）

| 维度 | 达标度 | 说明 |
|---|---|---|
| 拦截器核心逻辑 | 90% | 判据、口令、守卫、拒绝清洗均对等；注入动作因宿主限制无法执行 |
| 实验环境开关 | 100% | lab-mode 完整对等 + UI 实时回传 |
| 快捷口令 | 100% | 15 个口令完全一致 |
| 知识库 | 120% | 本地比上游更丰富（field_journal + seed） |
| 工具能力 | 100% | 覆盖上游全部 MCP 能力 + 宿主集成 |
| 反拒绝机制 | 85% | 回合边界续跑 + 幂等键，补偿了缺失的 L1/L2 注入 |
| 代码整洁度 | 95% | 仅少量僵尸 export，无死代码或未处理错误 |

**综合约 95%**。核心差距均为宿主 SDK 能力边界所致（无 transform、无 `before_provider_request`），
非实现遗漏。2.13.1 重算的口径是代码量对照：上游自有 `py + ps1` **40,823 行** vs 插件 `ts/tsx`
**38,520 行 / 251 文件**——用 38.5k 行 TS 复现 40.8k 行 Python/PowerShell 的等价能力，并额外承载 15 页 UI。

---

## 10. 界面与实时面板（2.9.8）

> 这一节测的是界面与实时信息这一层，不是能力。对比对象：
> `寒霜注入工具-1.0.0-便携版/源码`（Tauri 注入控制台，`src/components/{inject,promptWorkbench,shell,seep}`）
> 与 `hanshuang-pojia-2.0`（seep-kit 提示词与脚本装置）。

### 10.1 侧栏实时区（已补齐）

上游 `shell/Sidebar.tsx` + `hooks/useSidebarStatus.ts` 的形态是：每个导航项带一枚状态标记，底部汇总
「今日花费 / Token / 请求数 / 缓存命中率 / 授权是否需要重新登录」。其中用量与授权中心依赖上游自己的
代理与账号体系（`proxyApi`、`authGetStatus`、`useUsageSummary`）。

本地没有代理层，也拿不到宿主的用量与账号接口，所以对等物只能是**手头确有数据的那几个点**：

| 状态点 | 数据来源 | 语气（点色） |
|---|---|---|
| 会话 | `ChatState.status` / `tool` | 流式输出 = live；未接会话 = alert |
| 本轮 | `TaskStreamEntry[]`（`turn-start` 之后数 `tool-start`）+ `stream.active` | 跑着 = live；有工具报错 = alert |
| 当前样本 | 当前 `TriageReport` 的 `target.name` / `risk.score` / `risk.grade` | A/B = idle；C = live；D/E = alert |
| 注入 | `getActivePrompt(library)` | 有激活 = live |

实现：`src/features/workbench/live-status.ts`（纯函数 `deriveLiveStatus` / `countTurnTools`）+
`components/shell/sidebar-status.tsx`（收起成图标轨时只留语气点，展开后显示标签与值）。

**不做（明确记录，不假装有）**：今日花费、Token 数、请求数、缓存命中率、账号重新授权提醒——这些数字
在宿主里没有对插件开放的读通道，编一个近似值比留空更糟。

后续版本又给这一区加了「刚发生的」与「最近输出」两行（调用配对 + 耗时 + 从载荷里挑规模量），
数据源仍是 `TaskStreamEntry[]` 与 `activity.entries[0]`，没有新开读通道。

### 10.2 注入块预览（已补齐）

上游 `inject/FileInjectPanel.tsx` 直接写目标客户端的全局指令文件；`UnifiedInjectPanel` 用分段控件在
「本机文件 / 网关注入」之间切换。

宿主的边界是硬的：插件只能写项目内路径，`~/.astravia/agent/AGENTS.md` 必须由用户在保存对话框里点一次
（见 `src/domain/inject/astravia-block.ts` 的模块注释）。因此对等物是「把块摊开 + 给落盘路径」，而不是
一个会静默写主目录的按钮：

- `components/prompts/inject-block-card.tsx` 挂在提示词页：显示目标路径、块来源（激活提示词或默认契约）、
  块正文、复制按钮、落盘方式与按标记摘除的还原说明；
- `DEFAULT_INJECT_BODY` 收敛进 `domain/inject/astravia-block.ts`，注入工具 `install_astravia` 与面板共用
  同一份，避免两处走样。

上游的「网关注入」在宿主没有对应物（插件不能改 `base_url`），不做。

### 10.3 其余界面对照

| 上游 | 本地 | 结论 |
|---|---|---|
| `shell/Sidebar` 导航 + 状态 | `shell/sidebar.tsx` + `shell/sidebar-status.tsx` | 已补齐 |
| `inject/RoleCardStrip`（当前角色卡条） | `shell/inject-status-bar.tsx` | 已有，含模式与 token 估算 |
| `inject/PromptCardPanel` | `pages/prompts.tsx` + `prompts/prompt-card.tsx` | 已有，多出搜索与备份入口 |
| `promptWorkbench/PromptWorkbench` | `pages/prompts.tsx` + `prompts/prompt-editor-dialog.tsx` | 已有 |
| 修改前自动备份 / 还原 | `prompts/backup-restore-dialog.tsx` + `domain/prompt-backup.ts` | 已有 |
| `seep/SeepToolsPage` | `pages/selfcheck.tsx` + 14 个已声明命令 | 已有，改为「探测 → 安装计划」 |
| `UsageFooter` / `*QuotaFooter` / 账号配额 | — | 不适用：需要上游代理与账号 API |
| `providers` / `proxy` / `sessions` / `workspace` 等页 | — | 不适用：上游是代理管理器，本地是审计工作台 |
| `CodexAssetsPanel` | — | 不适用：写入目标客户端的资源目录不在插件授权范围内 |

### 10.4 验证

- `npx tsc --noEmit` 干净。
- `src/test/report/live-status.test.ts`：9 条，覆盖「只数本轮」「在最新的 turn 边界停」「工具报错升级
  语气」「等级到语气的映射（A/C/E 三档）」「未接会话 = alert」「激活提示词进注入点」。
- `src/test/workbench/workbench.test.tsx`：侧栏实时区跟着会话走（turn/tool 生命周期进「本轮」，报错切到
  alert，报告进「当前样本」）；导航用例追加注入块预览断言。
- **NOT RUN**：侧栏在真实宿主宽度下的展开阈值、注入块复制在插件 webview 的剪贴板可用性。

---

## 11. 测试与验证（2.14.0 实测）

| 类别 | 规模 | 说明 |
|---|---:|---|
| 单测文件 / 用例 | 59 文件 / **711 例**（按功能域分 7 个子目录） | `vitest`，全绿 |
| 市场内容测试 | 79 例 | `node --test tests/*.test.mjs`，**必须在 `build` 之后跑**（读构建产物） |
| 战例工程断言 | 21 例 | 14 条原型的 id 连续、能力族计数、双语证据、`defense` 阶段必备、跨 OS 命令洁净、骨架必需路径、幂等落盘、越界拒绝 |
| 路由表断言 | 6 例 | 44 条、5 present、fallback、指纹、匹配优先级 |
| 对话侧断言 | `contributions` / `target-shape` / `refusal` / `reshaping` / `system-prompt` | 两次实测事故各有一例回归；母本 byte-for-byte + 长度上限 |

「攻防测试」在本插件里的含义是**防御面**而不是攻击演示：每条战例都必须有 `defense` 阶段（首版缺
`C`、`G` 两条，被测试抓出后补齐），骨架的 `README.md` 必须写清授权范围与 `auth.status=pending`，
报告四节里「纵深防御」不可省。这一层测试防的是「交付了能不能被修复」被悄悄删掉。

验证命令（2.14.0 时点，全部实跑）：

| 命令 | 结果 |
|---|---|
| `npx vitest run` | 59 文件 / 711 例全通过 |
| `npx tsc --noEmit` | 无输出，退出 0 |
| `node scripts/sync-system-prompt.mjs --check` | `system prompt in sync` |
| `node scripts/sync-skill-library.mjs --check` | `skill library ok: 171 files` |
| `node scripts/check-precedent-package.mjs --all --no-tools` | `19 packages checked (tools skipped)` |
| `npm run check:cases` | `19 packages checked with tool self tests` |
| `node scripts/marketplace.mjs check` | `Validated source entries for astravia-official-marketplace` |
| `node scripts/marketplace.mjs build` | 本插件 597 个运行文件 |
| `node --test tests/*.test.mjs` | 79 例全通过（构建之后跑） |

初版曾出现 `src/test/report/assessment.test.ts` 并行跑时偶发失败：原因是工具写 `reports/`、断言仍写
`report/`，两边对目录名的约定没统一。已按「代码、先例、文档一律 `reports/`」修正，改动后连续三次全量
运行均全绿，不再是噪声。

**复核方法（僵尸代码/导出面）**：`node scripts/report-dead-exports.mjs`（只读；`--json` /
`--fail-on-dead` 供 CI）。头注释自述局限：按标识符全文计数，识别不了字符串拼出来的动态调用，也识别不了
权限名——这正是 §9.3 那三条权限误判的成因。基线值（2.13.2）：导出 873、**真死 0**、仅测试 63、
internal 254。

---

## 12. 剩余缺口与不做项

| 优先级 | 项 | 状态 |
|---|---|---|
| ~~P0~~ | 44 条路由未接进提示层 | **已修**（2.13.2，第 4 级注入） |
| ~~P0~~ | 14 条战例无工程形态 | **已修**（2.14.0，`scaffold_case project=`） |
| ~~P1~~ | 文档按权威性混乱 | **已修**（2.14.0，`domains/` 9 域 × 2 篇 + 索引重写） |
| ~~P1~~ | 外部 MCP 无设置说明 | **已修**（`domains/mcp-and-external-servers/dev.md` 给三份可粘贴配置） |
| ~~P1~~ | 19 个先例包缺 `docs/defense.md` | **已修**（2.14.0，19 篇写齐，`npm run check:cases` 19 包全绿） |
| P2 | `manifest-summary` 独立入口 | 未做：现有 `decompile_android` 已能给模型，独立入口收益低 |
| P2 | 截图 OCR（`temp_ocr.ps1`） | 未做：需要图像管线，与「不引入大依赖」冲突 |
| P2 | 39 个路由目标 | 不对齐：上游也只有 5 份能力，等价于「缺 5 份内容」而非 39 份 |
| P2 | `internal 254` 私有符号 | 不收：收益为零，破坏可读性 |

刻意保留的不对等（每一条都写过理由，见 §3.7 与 §5.5）：`Tool/mcp/` 与 `Tool/upstream/` 的第三方二进制、
`setup/*.ps1` 安装器、233 个目标特定产物、39 个路由目标、`manifest-summary` 独立入口、截图 OCR。

**下一步（若要继续）**：

1. 真机核对：在 Desktop 面板里走一遍「lab：→ 提问 → 拿到命令」与「面板自检四组数字」；
2. 若已发布后再动运行内容，用 `node scripts/marketplace.mjs bump --slug hanshuang-pojia --apply`；
3. 形态识别的漏判（正则级）只在「少给一条入口」上体现，补法永远是往 `scope-lexicon.ts` 加词，
   不改判定代码；
4. 本篇合并后不再按版本分文件：新的对等结论追加成 §2/§3 的更新，而不是再开一份 `upstream-parity-x.y.z.md`。
