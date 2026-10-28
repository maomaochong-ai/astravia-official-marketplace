# 能力对比报告：上游 2.0 便携版 ↔ 本插件 2.14.0

> **时点**：2026-10-29　**上游**：`hanshuang-pojia-2.0`（Electron 便携包，核心在 `resources/seep-kit/`，4597 个文件）
> **本插件**：`abilities/plugins/hanshuang-pojia` 2.14.0（31 原生工具 + 5 技能 + 19 先例包 + 340 篇随包文档）
> **怎么读**：每行给「上游有什么 → 本插件对应物 → 结论」。结论只有四种：**对等**、**更强**、
> **有意不对等**（写理由）、**不适用**（上游机制在本宿主不存在）。逐条对等的历史结论另见
> [upstream-parity-2.14.0.md](upstream-parity-2.14.0.md)。

## 1. 总账

| 面 | 上游 2.0 | 本插件 2.14.0 | 结论 |
| --- | --- | --- | --- |
| 工具 | seep MCP 23 个（Python 包装 r2 / jadx / apktool / Hook / 知识库） | **31 个宿主原生工具**，直接读字节 | **更强**：无 Python 中间层，参数受校验，结果同源 |
| 技能 | 5 份（总控 + apkseep + ida-reverse + client-license + 其余） | 5 份，正文 1:1 移植 | 对等 |
| 提示词 | `SYSTEM` 母本 + 反退缩 A1–A10 + 授权门 | 母本同源，**去门禁语义**，交付形状五段 | **更强**：不再有一条要求先声明什么的段落 |
| 路由 | 44 条目标 → 5 份能力 | 44 条路由表（`routing-table.generated.json`，指纹 `bfc208b6`），5 present / 39 标注 | 对等（缺口同为「39 目标 ≈ 5 内容」） |
| 先例 / 战例 | `Tool/cases/` 14 条工程 + 233 目标特定产物 | 19 先例包（四文档）+ 14 条工程骨架（按语言 × OS 生成） | **更强**：骨架可跨 OS 重跑，产物不搬 |
| 知识库 | 292 篇 + 42 工具判定 | 340 条索引（292 篇 1:1，SHA-256 集合 diff 为 0） | 对等 |
| 面板 | Electron 渲染器内页面 | 17 页工作台（含自检页四组数字） | 对等 |
| 安装器 | `setup/{install,update,uninstall,verify}.ps1` | 市场安装 + `probe_environment` / `install_toolchain` | **有意不对等**：宿主管生命周期 |
| 动态能力 | Frida 脚本 + `temp_ocr.ps1` 截图 OCR | `frida_dump` / `generate_hook`；OCR **未做** | 部分对等（OCR 为 P2 未做） |
| 测试 | 无随包测试 | 59 文件 / 711 例 + 79 例内容测试 | **更强** |
| 文档 | `Tool/docs/`（工程向）+ 手册 | 9 功能域 × (usage + dev) + 手册 11 篇随包 | **更强**：使用者与改代码的人分开 |

## 2. 逐能力点对照

### 2.1 静态体检与反汇编

| 能力点 | 上游 | 本插件 | 结论 |
| --- | --- | --- | --- |
| 格式 / 熵 / 节区 / 导入导出 / 风险分 | `seep_triage` | `triage_binary`、`triage_directory` | 对等 |
| 字符串与分类（url / path / identifier） | `seep_strings` | `scan_binary_strings` | 对等 |
| 符号表 | r2 `afl` | `list_code_symbols` | 对等 |
| 线性反汇编（AArch64 精确、x86 子集） | r2 直调 | `disassemble_range` | 对等 |
| 伪 C | r2 `pdc` | `decompile_function` | 对等 |
| 二进制 / 函数级差分 | `radiff2` / 手工 | `diff_binaries`、`diff_functions` | **更强**：函数级指纹分 same / constants-only / changed |

### 2.2 Android / APK

| 能力点 | 上游 | 本插件 | 结论 |
| --- | --- | --- | --- |
| DEX 类 / 方法 / 字符串索引 | jadx 全量反编译后搜 | `search_dex_symbols` 直读表 | **更强**：毫秒级，不落 smali |
| 单方法 Dalvik 指令流 | 读 smali 文件 | `disassemble_dex_method` | **更强**：直读 `code_item` |
| Java 源码 / 资源 / Manifest | `decompile_android`（jadx / apktool） | 同名工具，三档 operation | 对等 |
| 签名 | `apksigner` | `verify_signature`（结构层 + 裁决层分开） | **更强**：两层混报是最常见的误读，这里不可能混 |
| 脱壳 | `frida_dump` 脚本 | `frida_dump`（头部四重校验、SHA-256 去重、三档 mode） | 对等 |
| Hook 脚本生成 | 模板手改 | `generate_hook`（observe / override / replace） | 对等 |

### 2.3 案卷与先例

| 能力点 | 上游 | 本插件 | 结论 |
| --- | --- | --- | --- |
| 建案卷目录 | `case-init.ps1`（九节契约） | `init_task`（同九节，不覆盖已有文件） | 对等 |
| 就绪判定 | `ready_for_act` + `auth-log.md` | **删除** | **更强**：判定层不存在，目标不再等一句声明 |
| 先例检索 | 目录手翻 | `search_cases`（路径 + 理由 + 进度，随包 19 包） | **更强** |
| 先例工具落盘 | 复制目录 | `scaffold_case`（先例或 14 条工程骨架，带 `--self-test`） | **更强** |
| 决策留痕 | `workitems.md` 手维护 | `record_case_note`（implemented / rejected + 时间线） | **更强**：rejected 才挡得住下一次重试 |
| 防御侧文档 | 无 | 19 篇 `docs/defense.md` | **更强** |

### 2.4 对话侧

| 能力点 | 上游 | 本插件 | 结论 |
| --- | --- | --- | --- |
| 改写用户消息 | `input` 钩子直接替换 | 宿主只能追加，改成「若干条附加上下文」 | **不适用**（宿主差异，见 §3） |
| 反拒（句型改写） | A1–A10 + 中继手册 | 同 A1–A10；改写降级为附加的评审式重述 | 对等 |
| 范围判定 | 「IN / OUT」划界，OUT 即不执行原句 | **只读形态、只附加等价入口**：原请求照常作答 + 一条自有资产入口 | **有意不对等**：划界 = 自己加的门 |
| `lab` 开关 | 磁盘标志位，读失败即关 | 内存为权威 + 按 storage 实例缓存，读失败保持开启 | **更强** |
| 快捷口令（`poc` / `hook` / `keygen`） | 展开替换 | 展开为附加上下文 | 对等 |
| 提示词母本 → 生成物 | 构建期拼 | `sync-system-prompt.mjs`，`--check` 防漂移 | **更强** |

### 2.5 环境与外部能力

| 能力点 | 上游 | 本插件 | 结论 |
| --- | --- | --- | --- |
| 工具探测 | `verify.ps1 -Detailed` 四栏看板 | `probe_environment`（区分「宿主拒绝」与「没装」） | **更强** |
| 安装 | `install.ps1` 直接装 | `install_toolchain` 给本平台命令，执行交给操作者 | **有意不对等**：插件不持包管理器权限 |
| IDA 桥 | `ida_pro_mcp` 常驻 | `ida_status` 只报状态 + 可选外部 MCP | 对等（可选） |
| r2 直调 | 任意命令 | `run_radare`（参数数组直传，禁管道 / 重定向 / `$()`） | 对等且更严 |
| 截图 OCR | `temp_ocr.ps1` | 未做 | 不对等（P2） |

## 3. 本轮新增（上游没有的能力点）

| 新增 | 为什么值得有 |
| --- | --- |
| 等距入口（`target-shape.ts` + `describeEquivalentPath`） | 上游在「对象是别人的账号」时只有一条路（不执行）。这里改成「两条路」：原请求照常，另附自有资产入口与第一条命令。**多给一条，不收回一条** |
| 附加式对话注入（`promptContexts` 两级叠加 + 三级终止） | 宿主不允许改写 prompt，于是把「替换」重写成「叠加」，并在代码注释里写死「任何一级不得写否决语句」 |
| lab 失效面测试（`lab-chain.test.ts`） | 读盘失败、写盘失败、状态文件消失、两个会话隔离——四种会让环境静默关掉的路径 |
| 按功能域的双份文档（`domains/*/usage.md` + `dev.md`） | 使用者要「怎么用」，改代码的人要「怎么改」，过去混在一篇里，两边都读得别扭 |
| 文件头注释（33 生产文件 + 10 测试文件） | 每份写清职责与一条不变量；不看实现也能判断该不该在这里改 |

## 4. 有意保留的差异（不要回改）

1. **不搬第三方二进制与整棵上游树**（`Tool/mcp/` 235 MB、`Tool/upstream/` 65 MB）：
   同一批能力用原生 31 工具覆盖，搬进来只会多一处版本漂移与一份不可审计的字节。
2. **不搬安装器**：插件由市场安装；卸载/更新是宿主的职责。
3. **不搬 233 个目标特定产物**：在别的机器上不可执行，骨架里 `src/README.md` 是故意留空的。
4. **不做划界**：上游 `MANUAL/refusal-scope-router` 的 IN / OUT 两分不移植。理由与两次事故见
   [refusal-scope-router.md](refusal-scope-router.md)。
5. **不做第二套 MCP id**：`seep` 那份配置在本插件里是负资产（模型会在两套工具里各调一次）。

## 5. 结论

- **能力面**：能做的与上游一致，且在三处更强（工具无中间层、签名两层不混报、先例带防御侧文档）。
- **机制面**：上游三道「自己加的门」在这里一道都没有；`lab` 从「可能静默失效」变成「读失败也开着」。
- **交付面**：测试 711 + 79 例、文档 9 域 × 2 篇、每条不对等都写了理由与验证方式——
  下一次改动不会靠猜来判断「这里为什么和上游不一样」。
