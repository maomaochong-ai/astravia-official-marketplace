# 寒霜破甲

在 Astravia 内离线静态体检安卓安装包、iOS 应用、原生二进制与压缩包。样本从不运行，包内也不自带引擎：radare2 / jadx / apktool 只在你的机器上已经装好时才会被借用。

插件只回答一个问题：**这是什么文件，评审应该先看哪里？**

从 2.0 起，插件还带一层 **工作台工具包协议**——实验模式开关、部署与校验看板、先查知识库的侦察顺序，以及 `seep` / `ida` 的 MCP 工具矩阵。这份内容现在放在技能里（`agent/skills/hanshuang-pojia/SKILL.md`），由宿主按需加载，不占用每轮注入的那段系统提示。它是指挥智能体配合桌面工具包干活的文档。

不装工具包也有两层能跑：面板自己的 TypeScript 引擎，只要一个文件就能出结果；以及四个通过宿主命令通道调用本机 `r2` / `rabin2` / `radiff2` / `rasm2` / `jadx` / `apktool` / `java` 的工具。两者都不执行样本；二进制缺失或被宿主拒绝，都会如实报出来，不会伪造结果。

## 能分析什么

| 输入 | 识别依据 | 收集的事实 |
| --- | --- | --- |
| `.apk` | `AndroidManifest.xml` + `classes*.dex` | 清单模型、权限、组件、签名方案、DEX 字符串 |
| `.aab` | `BundleConfig.pb` 或 `base/manifest/…` | 清单模型、DEX 列表、各 ABI 原生库 |
| `.ipa` | `Payload/*.app/` | 主二进制的 Mach-O 头、切片与加固标志 |
| `.jar` | `META-INF/MANIFEST.MF` | 归档布局、内嵌可执行文件 |
| `.zip` | 中央目录结束记录 | 条目数、压缩比、越界或重名条目 |
| ELF / PE / Mach-O | 魔数 | 架构、入口点、节区、加固标志、导入表 |
| `.dex` | `dex\n` | 字符串/类型/方法计数与字符串样例 |
| 其它 | — | 熵分布与字符串抽样 |

报告结构（`schemaVersion: 1`）：`target`、`risk`（分数 + A–E 等级 + 主因）、`summary`、`findings`、`facts`、`sections`、`limits`。

## 规则目录

五大类共 37 条规则：`manifest`、`code`、`native`、`package`、`format`。每条规则有稳定 id、严重度、权重与英文建议：

- `src/domain/audit/rules.ts` —— 注册表与权重（`critical` 45、`high` 22、`medium` 10、`low` 4、`info` 0，封顶 100）
- `locales/en.json`、`locales/zh.json` —— 面板用的 `rule.<id>.title`；有测试保证注册表与两份 catalog 始终对齐

领域层只产出 `ruleId` 与证据。Agent 路径的标题来自注册表，面板通过插件 catalog 解析 `rule.<id>.title`。

## Agent 工具

统一从 `src/tools/register-tools.ts` 注册，一个工具一个文件：

| 工具 | 用途 |
| --- | --- |
| `triage_binary` | 完整体检，返回有预算上限的 markdown（摘要约 4.5k 字符，完整约 24k） |
| `scan_binary_strings` | 带文件偏移的字符串提取与过滤 |
| `explain_triage_finding` | 规则参考：严重度、分类、为什么重要 |
| `export_triage_report` | 完整体检结果交给系统保存对话框，导出 markdown 或 JSON |
| `list_code_symbols` | ELF `.symtab`/`.dynsym`、PE 导出表、Mach-O `LC_SYMTAB`，并合并导入函数 |
| `disassemble_range` | 对 AArch64 / x86 / x86-64 字节区间做线性扫描反汇编 |
| `search_dex_symbols` | 在 `.dex` 或 APK 里检索类、方法签名与字符串池 |
| `diff_binaries` | 两个样本之间的字节级差异块 |
| `decompile_function` | 单个函数的寄存器级伪 C，并列出它引用的字符串 |
| `diff_functions` | 两个版本之间哪些函数改了形状、哪些只改了常量 |
| `generate_hook` | 为命中的 Dalvik 方法生成 Frida 脚本：`observe` 只打日志（默认）、`override` 跑完原方法再返回 `return_value`、`replace` 不跑原方法 |
| `frida_dump` | 加壳样本的运行时 dex 抽取：出扫描脚本、真机跑、或把日志拼回 `.dex` 文件 |
| `triage_directory` | 目录下所有二进制的风险表，最差的排最前 |
| `search_docs` | 在 340 篇随包文档里按标题 / id / 主题检索 |
| `read_doc` | 读一篇文档正文（Markdown），超预算时明确标识截断位置 |
| `probe_environment` | 探测已声明的可执行文件是否真能跑，给出各自版本横幅，并区分「宿主拒绝」与「未安装」 |
| `install_toolchain` | 按目标筛出真正要装的那几个工具，给出本平台的准确安装命令 |
| `kb_checklist` | 按名字直接打开 kit 的六份战术清单之一，如 `web_first_30_min` 或 `pe_ioc` |
| `kb_payloads` | kit 的 payload 种子，按漏洞类别取；类别不存在时列出真实存在的章节 |
| `ida_status` | `127.0.0.1:13337` 上的 IDA 桥接是否在应答，并把「没授权」与「没监听」分开 |
| `verify_signature` | 签名方案与签名人证书：结构事实来自 APK 自身，宿主有 `apksigner` 时再跑 `verify --print-certs` |
| `run_radare` | r2 / rabin2 / radiff2 / rasm2：头信息、字符串、函数表、反汇编、伪 C、交叉引用、汇编、差分，以及只读 `cmd` |
| `decompile_android` | 用 jadx / apktool 输出到相邻目录，再对整个目录做 `smali_search` |
| `disassemble_dex_method` | 单个 Dalvik 方法的 `code_item`，解成 `offset: op operands` 清单 |
| `init_task` | 单个目标的案件目录：`samples/`、`exports/`、`reports/`、README 与报告模板 |
| `search_cases` | 19 个随包先例包与你自己的案例，两条道分开排名：可以复制的方法，不是可以继承的授权 |
| `record_case_note` | 往当前案件追加决策、blocker 或交付物记录 |
| `scaffold_case` | 把先例包的 `tools/` 与共享 `hpkit` 落盘到项目里，并给出确切命令行——只写文件，不执行 |
| `write_assessment_report` | 把四段式评估报告填进 `reports/<目标>_security_assessment_report.md`；没给的段落就写「未提供」 |
| `generate_artifact` | 针对你定位到的裁决点，出补丁 / keygen / 代理 DLL / 验证工装的骨架 |
| `install_astravia` | 生成注入全局 `AGENTS.md` 的指令块，交给保存对话框 |

三十一个工具都显式声明 `scope_use`（fail-closed），并且只通过宿主 `fs` 访问工作区。样本用 `fs.readBinaryFile` 读取，上限对齐宿主自己的 32 MiB 二进制读取天花板。更大或位于项目外的样本交给对话里的 Agent，它用的是应用自身的文件权限。

几个分析工具把「返回什么」说清楚：伪代码没有类型恢复、没有 SSA、不做变量合并；函数级比对是指令形状
指纹，不是等价性证明；hook 模板默认只观测并原样返回。最后一条是默认值而不是天花板 —— `mode`
选 `override` / `replace` 并给 `return_value` 就是改写档，跑的还是技能里那条 `frida-run`。`frida_dump` 也一样：
`run` 档需要真机与 frida-server，`script` 与 `assemble` 不需要设备就能用。

六个工具会启动外部二进制，遵循同一条规则：`plugin.json#commands` 里逐字声明它们可以启动的十四个可执行文件，宿主在授予
`agent.command.run` 前会问用户，每次调用都是带参数数组的 `execFile`，不经过 shell。`run_radare` 的 `cmd`
拒绝写、shell、调试器、打开文件、脚本执行、工程、挂载与 `=` 远程族命令（`w`/`W`、`!`、`o`/`O`、`d`/`D`、
`P`、`R`/`r`、`m`/`M`、`.`、`=`），只放行 `dr` 这类只读族；凡是会离开 r2 自身解析器的写法也一律拒绝 —— 管道 `|`、
重定向 `>`/`<`、`$()`、反引号与 `=!`。这道阀护的是参数数组，不是你的选择：真要写字节，就用 `command.run`
跑 `r2 -w`，命令看得见、也留得下记录。

`decompile_android` 只写到 APK 旁边的目录，从不改原文件，而且只接受尚不存在的目录：已存在的 `output_dir`
直接拒绝而不是合并进去；`apktool` 也不再带 `-f`，重跑不可能抹掉你自己的文件夹。重建产物放在案件旁的 `exports/` 下：
补丁是你那次修改的产出，不会有一个 `patches/` 目录提前替你留位。
`probe_environment` 每个工具跑一次短 `--version`，结果缓存一分钟，并把两种失败分清楚：被拒绝是设置问题，找不到才是装的问题。`install_toolchain` 把后者变成你真要敲的命令：按目标（`apk` / `native` / `firmware` / `dynamic` / `full`）筛掉用不上的工具，取本平台的配方（brew / apt / winget / scoop / pipx），到此为止——插件不跑安装器，每条命令你先看到再决定。商业套件（IDA、Binary Ninja、JEB）只作为上下文列出，不给命令；可选工具不占任何权限位，因为插件从不启动它们。与 2.0 的全量对照见 [docs/reference/toolchain-parity.md](docs/reference/toolchain-parity.md)。

同一套引擎可以在终端里跑，不经过插件沙箱：

```bash
node scripts/analyze.mjs triage sample.apk --json
node scripts/analyze.mjs decompile libfoo.so --symbol check_license
node scripts/analyze.mjs diff v1.elf v2.elf
node scripts/analyze.mjs hook app.apk --query license --package com.example.app
node scripts/analyze.mjs docs frida --group kb
node scripts/analyze.mjs asm x86-64 "mov rax, rbx" "ret" --address 0x1000
```

`scripts/analyze.mjs` 用 esbuild 打包 `src/cli/analyze.ts`，只 import `src/domain`，因此能读进程能读的
任何路径 —— 不涉及插件 fs 授权。子命令：`triage`、`strings`、`symbols`、`disasm`、`asm`、`decompile`、
`diff`、`hook`、`docs`。退出码：`0` 正常、`1` 用法错误、`2` 分析失败。

`asm` 是唯一反方向写字节的子命令：x86 / x86-64 / AArch64 的九条助记符（`nop`、`ret`、`mov`、`add`、
`sub`、`xor`、`cmp`、`jmp`、`call`），判据是插件自己的解码器。每一行编完都会放回它自己的地址解码一次，
屏幕上那行规范文本就是解码结果 —— 复现不出来的一行会带着提示报错，而不是当「大概对」返回。解码器
拿不准的写法（x86 的 8/16 位操作数、scale 索引、标签、伪指令、需要两条指令才能落地的立即数）
一律拒绕。

## 权限

| 权限 | 原因 |
| --- | --- |
| `ui.slot.activity-tab` | 工作台面板 |
| `agent.tools.register`、`agent.toolHandler.execute` | 三十一个工具 |
| `agent.command.run` | `probe_environment`、`install_toolchain`、`run_radare`、`decompile_android`、`verify_signature`、`frida_dump`：使用 `commands` 里声明的十四个可执行文件，每个都需用户授权 |
| `agent.session.write` | 工具结果写回对话、面板的「发给对话」按钮 |
| `agent.session.read` | 面板显示对话实时状态（本轮是否在跑、哪个工具在跑） |
| `storage.read`、`storage.write` | 样本架与设置能跨重启保留；没有授权时面板退化为会话内存 |
| `fs.read` | 列目录与读取样本 |
| `fs.write` | `fs.saveAs` 导出报告（路径由用户选择） |
| `agent.systemPrompt.write` | 运行时生成的 kernel 块：实验室开关、用户正在看的页面、可用工具表 |
| `network.fetch` | 只给 `ida_status` 用，且只向 `network.allowedHosts` 里声明的 `127.0.0.1` 发一次 GET，探 13337 端口上有没有 IDA 桥接在听 |

## 规则放在哪里

2.6.0 起分两处：

- **每轮都注入的 kernel 块**（`src/domain/kernel.ts`，priority 850）—— 实验室开没开、用户在看面板哪一页、哪些工具可达。那是状态，不是文案，所以它不可能是静态文件。
- **lab 开启时才注入的 system 块**（`agent/prompts/SYSTEM.md`，priority 840，约 7.6 KB）—— 授权门、交付形状、卡住时的处理、工具链引导、todo 纪律。关闭实验环境时这一块不注入：kernel 块已经声明了 OFF 状态与 `lab：` 口令，没必要为一个用不上的契约付 token。

静态母本是 `agent/prompts/SYSTEM.md`。`scripts/sync-system-prompt.mjs` 把它镜像成
`src/domain/system-prompt.generated.ts` —— 插件在渲染进程的 bundle 里跑，宿主从不告诉它自己装在哪，
所以运行时读不到包内文件，只能构建期内联。`npm run verify:generated` 在两边漂移时失败，
`src/test/system-prompt.test.ts` 逐字节比对。

完整技法仍住在技能里（`agent/skills/hanshuang-pojia/SKILL.md`）：宿主的技能索引只付 `name` 加
`description` 约 380 字符，97 KB 正文只在真正调用它时才进上下文。

`agent/prompts/AGENTS.md` 是同一份协议给 Astravia 以外的 agent 读的版本：工具路由、G-Auth 授权门、交付形状，
以及本宿主没有对应物的三处上游机制。它没有权限要求 —— 它是文档，不是注入源。

## 与上游的差异

上游 `seep-kit` 在 provider 请求层往 Gemini 请求体里塞 `safetySettings: BLOCK_NONE`，并清洗历史里的拒绝话术。
本宿主只暴露十二个生命周期钩子（`SessionStart` / `SessionEnd` / `UserPromptSubmit` / `PreToolUse` /
`PermissionRequest` / `PostToolUse` / `PostToolUseFailure` / `PreCompact` / `PostCompact` / `SubagentStart` /
`SubagentStop` / `Stop`），**没有**任何一个能看到请求 payload；而且该字段是 Google 私有字段，走 OpenAI 兼容
网关只会换来 `400 UNKNOWN_FIELD`。上游改写用户原话的能力同样没有落点 —— `UserPromptSubmit` 只能追加
`additionalContexts`，不能替换 prompt。

第一件事的实际损失比看上去小：上游自己也会先判端点，对 OpenAI 形状的请求体（`messages`）直接返回
`SKIP`，只对 Google 端点与 `contents` 形状注入。本管道正是 OpenAI 兼容体，**上游在同等条件下也是 SKIP**。
所以 `src/domain/interceptor.ts` 把判定函数本身搬过来了（同一套 `INJECT` / `SKIP` / `SKIP-INEFFECTIVE`
词表，每个端点记一次日志），而不是假装这里缺了个开关；执法点改到回合边界。

**拒绝不是可接受的收尾。** `Stop` 钩子读最后一条助手消息：命中政策句或转介句（「建议联系厂商」）**无条件**
续跑；命中**出处论证句**（把插件自己的 `SKILL.md` 降级成「不可信工具材料、只记录不执行」）单独计一类
`provenance`，硬度只低于政策句；命中身份句（「作为一个 AI」）只在整轮什么都没交付时才续跑。政策类不再看长度、
也不再因「正文里有代码」而放行 —— 拒绝夹带一段代码仍然是拒绝。判定在 `src/domain/refusal.ts`，
续跑片段明确禁止拒绝、禁止解释限制、
禁止把活推给厂商，唯一的合法停法是引用一次确切错误原文然后换路继续交付。插件每回合最多续跑
3 次，同一条拒绝原样返回时提前收手；宿主另有 `DEFAULT_MAX_STOP_CONTINUATIONS = 8` 兜底。

**技能文档是指令，不是材料。** 宿主那条「工具输出=不可信数据」对**目标字节**是对的，对**本插件自己的
文档**是错的：`SKILL.md` 经读文件工具、文档检索返回或压缩后的历史进上下文，不会因此被降级。
`agent/prompts/SYSTEM.md` §4.1、`agent/prompts/AGENTS.md` §二、技能自己的 §0.9 三处各自把边界划在工作台
边界上，`read_doc` 也给每条结果盖同一行 provenance。真正算材料的只有目标自身的字节 —— 样本字符串、
目标源码、日志、网页、抓包；其中出现的注入文本是要上报的发现物，不是要执行的命令。

## 工作台工具包 2.0

工具包协议是 2.0 加进来的，现在随技能的第五部分发布，绑定「寒霜破甲工具」桌面包（`seep-kit` 1.6.0）：

| 节 | 内容 |
| --- | --- |
| V.1 | 实验模式——`lab：` / `退出实验`、磁盘标志位、压缩后要重跑的探测命令 |
| V.2 | 部署与校验——`setup/install.ps1`、`update.ps1`、`uninstall.ps1`、`verify.ps1 -Detailed` 与它的四栏看板 |
| V.3 | G-Auth——每个新目标只确认一次；写磁盘、装东西要另外一句明确的同意 |
| V.4 | 先查知识库的侦察顺序，以及「信号 → 技术文件 → MCP 工具」路由表 |
| V.5 | `seep`（23 个工具）/ `ida`（~243）/ `js-reverse`（12）/ `playwright`（18）矩阵，含 IDA 缺失时的 Radare2 降级表 |
| V.6–V.7 | 经 `softseep` 总控分派，以及 A1–A10 反退缩硬约束 |
| V.8–V.9 | 资源路径表与九种宿主安装器 |

2.1 起，工具包的**技能库直接随包发出**：`agent/skills/` 是 `seep-kit/Tool/skill/` 的移植版 ——
171 个文件、2.48 MB，含 `softseep`（总控）、`apkseep`、`ida-reverse`、`client-license-validation-bypass`，
以及五个 `safe-skills/*` 技术包，另有 `hanshuang-pojia` 主手册与三个带跨平台脚本的技能包。
清单与来源在 `agent/prompts/SKILL-LIBRARY.md`，逐文件哈希在 `agent/prompts/skill-library.sha256`，
`src/test/skill-library.test.ts` 会重算清单，防止构建时静默丢失。

它们通过 `plugin.json#agent.skillPaths = ["agent/skills"]` 注册，`skillPresentation.defaultVisibility`
为 `visible`、五个 surface 全开，所以装好即可在技能选择器里看到，不需要额外配置。
相对上游并非逐字节一致，且有四处是刻意的（见 `SKILL-LIBRARY.md` 的同名一节）。

提示词本体不该背的细节放在 `agent/skills/hanshuang-pojia/references/plugin-handbook.md`：实测的工具包目录结构、
MCP 工具全表、十篇手册索引、宿主安装矩阵、校验基线、中继与记忆机制。每轮付费的只有技能索引项，
所以正文可以写全。

## 案例与先例

`Cases` 页与 `search_cases` 共用一个前提：案例是可以复制的方法，不是可以继承的授权。`scope.md` 永远
从 `status: pending` / `ready_for_act: false` 开头，文件里写什么都撑不了就绪状态——就绪度由范围、blocker
和工作项算出来。

| 层 | 位置 | 是什么 |
| --- | --- | --- |
| 你自己的案例 | 工作区 `cases/<slug>/`，由 `init_task` 建 | 一个目标的样本、导出、报告，加上决策日记 |
| 随包先例 | 本仓库 `cases/<slug>/`，构建期内联 | 19 个方法级包：闸门在哪、怎么确认、什么被证伪 |
| 完整战例 | `src/content/docs/cases/<slug>/` | 30 篇长文：补丁表、RVA 地图、协议字段布局 |

一个先例包是四份规范文档加可选补充：`scope.md`（范围内外）、`workitems.md`（8–12 项，第一项恒为
“Establish scope and auth”）、`docs/method.md`（手法）、`README.md`。`docs/patches.md` 这类补充文档装
那些会把 method 撑爆的表。`scripts/sync-precedents.mjs` 把全部内容内联进
`src/domain/case/precedents.generated.ts`，所以 `.astraviapkg` 不带 `cases/` 源码目录——只带发布出去的
工具文件（`dist/assets/cases/`）——挡在构建前的是 `npm run check:cases`。

每个包还带一个 `tools/`：`manifest.json` 加若干 Python 脚本，把当时機检得出来的环节真的再算一遍。
脚本不在磁盘上就跑不了，所以它们以真实文件发布（而非内联），`scaffold_case` 把一个包的 `tools/`
连同共享 `hpkit` 拷进你的工作区并给出命令行。每个工具都能 `--self-test`：用内存里现造的合成样本来
自证，退出码 0 之后才值得指上真样本。

语料派生自上游 `seep-kit` 2.0 的 `Tool/cases/`。过线的是：偏移、RVA、AOB 特征码、补丁字节、协议
字段、算法常量；不过线的是：样本字节、二进制、密钥、盐、端点、真实产品名。规则与理由在 ADR 0006 与
0007。

## 目录

```text
cases/                             # 19 个先例包：只有源码，构建期内联，从不随包
docs/                              # 工程文档：README.md 索引 + contract/ reference/ audits/ plans/
                                   # ADR 在仓库根：docs/adr/hanshuang-pojia/
agent/
├── skills/                          # 九个 SKILL.md 目录，经 skillPaths 注册
│   ├── hanshuang-pojia/             # 宿主在对话区列出的主技能，含 references/
│   ├── apk-reverse/  ida-reverse/  radare2/     # 各自 scripts/*.ps1 与 *.sh 成对
│   └── apkseep/  softseep/  reverse-engineering/  …  # safe-skills 移植
└── docs/                            # 整目录入包（打包器唯一收集的 agent/ 子树）
    ├── SYSTEM.md                    # 常驻作战契约，lab 开启时作为提示块注入
    ├── AGENTS.md                    # 同一份协议给 Astravia 以外的 agent
    ├── SKILL-LIBRARY.md             # 随包技能库：清单、来源、四处刻意差异
    └── skill-library.sha256         # 171 条逐文件哈希；测试会重算它
src/
├── index.tsx                        # 只做装配：bridge、标签卡、工具、清理
├── runtime-contract.ts              # 标签卡读取的 PluginContext 句柄
├── domain/                          # 不含 React、不依赖宿主 API
│   ├── bytes.ts digest.ts entropy.ts strings.ts base64.ts
│   ├── sample-path.ts               # 路径解析与项目边界判定
│   ├── sample-scope.ts              # 引擎可读性：项目范围 + 32 MiB 上限
│   ├── archive/   zip.ts axml.ts archive-facts.ts
│   ├── diff.ts                     # 字节级差异块与预算
│   ├── android/   manifest-model.ts dex.ts dex-index.ts audit.ts
│   ├── native/    types.ts elf.ts pe.ts macho.ts audit.ts
│   │               symbols.ts disasm.ts detect.ts
│   ├── audit/     rules.ts findings.ts secrets.ts
│   ├── report/    report.ts
│   ├── case/      contract.ts journal.ts library.ts precedents.ts（含生成表）
│   ├── interceptor.ts               # 上游 L1/L4 的移植：注入判定、术语表、快捷口令
│   ├── refusal.ts                   # 回合边界的恢复判定：检测器 + 续跑追问片段
│   ├── playbooks.ts                 # 清单类型与 payload 章节：只点名随包文档，不复制正文
│   ├── system-prompt.generated.ts   # 由 agent/prompts/SYSTEM.md 生成，勿手改
│   └── triage.ts                    # 入口：识别 → 解析 → 审计 → 报告
├── domain/toolchain/                # 外部可执行文件：这层自己不启动进程
│   ├── catalog.ts                   # TOOLCHAIN / COMPANIONS / COMMANDS，必须与 plugin.json#commands 一致
│   ├── install.ts                   # 目标 → 本平台安装命令（只出计划，不执行）
│   ├── probe.ts                     # 逐个工具探测版本，区分拒绝与缺失
│   ├── radare.ts                    # r2/rabin2/radiff2/rasm2 计划与只读守卫
│   ├── android.ts                   # jadx/apktool 计划，以及 smali 目录检索
│   ├── workspace.ts                 # 案件目录布局（没有 patches/）
│   └── paths.ts
├── tools/                           # 一个 Agent 工具一个文件
├── runtime/panel-channel.ts         # Agent → 面板的报告回程通道
├── features/workbench/              # 面板本体
│   ├── bridge.ts state.ts prompts.ts
│   ├── report-compare.ts sections.ts severity.ts sample-error.ts
│   ├── hooks/                       # use-workbench、use-library、use-chat
│   └── components/
│       ├── workbench-screen.tsx     # 导航与外壳
│       ├── shell/                   # 侧栏、顶栏、表格、标签、图标
│       ├── workbench/               # 投放区、风险环、发现行、拦截页
│       └── pages/                   # 十七个页面
└── test/                            # 夹具与测试
```

`src/domain/` 不依赖 `@astravia-org/plugin-sdk`，可以直接在 Node 里跑。

## 工作台面板

活动栏标签卡现在是一个十七页的工作台，而不是单页报告：工作台、动态、提示词、使用指南、样本、发现、
字符串、反汇编、文档、案例、清单、熵分布、签名、对比、自检、报告、设置。只有在样本被读进来之后
才会出现分析结果，每个页面读的都是同一份报告 —— 除了不需要报告的那几个页。

反汇编页是唯一不读报告的一页：它直接走样本自己的字节，扫可执行节区、给候选函数排序（入口 >
符号 > 调用目标），再逐个展开成带控制流的清单，分摘要 / 仅分支 / 全部三档，并按字符预算截断。
更深的二次核验仍然交给 `disassemble_range` 工具；这一页的意义是不用花一个回合就能看到清单。

文档页把工具包自带的实战资料直接放进面板：随插件逐字节发布的 292 篇知识库文章、11 篇手册、
7 篇工具文档和 30 篇案例原文，标题检索在内存里即时完成，正文检索按需跨 340 篇文件扫描。每篇正文
都是一个独立的构建 chunk，所以打开文档页的代价是一篇，而不是 4 MB。同一批文档在对话里也能通过
`search_docs` 与 `read_doc` 拿到 —— Agent 引用的那一篇和屏幕上显示的那一篇是同一个文件。

案例页是 `init_task` 的只读对照：上面一张是你自己 `cases/` 与 `work/` 里的案例（目标、预设、授权状态、
就绪度、资产与证据条数、工作项进度），下面一张是 19 个随包先例，每行标「范围待定」。复制一行重新跑
`init_task`，是让先例变成你案例的唯一途径 —— 包替代不了你去做授权。

刻意分成两条车道：

- **面板内** —— 内置引擎，处理项目目录内、32 MiB 以下的文件。摘要、格式、清单、权限、组件、
  节区、熵、字符串、签名结构与两份报告之间的差分都在本地完成。
- **对话里** —— 紫色按钮经 `ctx.conversation` 发出一条英文指令，由 Agent 调用同一套工具
  处理面板够不到的部分（项目外路径、超过宿主读取上限的文件、真正的 jadx/apktool/radare2 活、全量字符串扫描）。
  没有可用的会话时如实报「未连接」，不会静默丢弃。

`triage_binary` 会把报告经 `src/runtime/panel-channel.ts` 推回面板，因此在对话里分析过的样本
会带着「来自对话」标记进入报告库。

## 开发

```bash
cd abilities/plugins/hanshuang-pojia
npm install
npm run check     # tsc --noEmit
npm run test      # vitest（领域夹具 + 面板接线）
npm run build     # vite build → dist/
node scripts/sync-docs.mjs --check   # 内置文档索引与磁盘 markdown 仍然一致
```

本仓库里 SDK 通过开发 tooling 解析（`../../../.tooling/open-astravia/packages/plugins/plugin-sdk`），因此 `package-lock.json` 里是 `link: true` 条目。完整市场构建会重新生成：

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

`src/content/docs/` 下 340 篇随包文档的索引由 `scripts/sync-docs.mjs` 生成：新增或修改文档后不带 `--check` 跑一次，CI 里则保留 `--check`。文档按需切成独立 chunk，没点开的文章不产生下载。

## 实现深度

- 安卓签名把 v1 文件与 APK Signing Block 里的方案和摘要当作结构化字段读出来。需要定论时，在你自己的
  终端里跑 `apksigner verify --print-certs` 或 `keytool -printcert -jarfile`（两者都在 `install_toolchain`
  报的那份工具链里），再拿结果比对 —— 插件只记文件自己声称了什么，不把那个当成验签结果。
- 工具链工具只会借用已装的二进制，没有一个会去下载或安装。`probe_environment` 报告实际存在什么，`install_toolchain` 只把命令打出来不执行；通道被宿主拒绝时，该改的是插件声明或设置，不是 `PATH`。
- `run_radare` 每次只跑一条 r2 命令（`decompile` 的 `output_mode=summary` 是三条），单次上限 120 秒，白名单之外一律拒绝；`decompile_android` 给 jadx 与 apktool 各 10 分钟，只回日志开头，不回源码。
- `smali_search` 只读扩展名过滤后的文件，单文件 2 MiB、最多 8 000 个；命中上限时会明说，不假装已经搜完。
- 加壳/加密由 `native.packed` 标出来（熵 + 导入数量，或 `UPX!` 标记），让你早点知道前面站着壳。
  脱壳是下一步而不是禁区，在你自己终端里跑：UPX 系 `upx -d`，运行时 dex / `.so` 走 Frida 内存 dump，
  拿到产物后再用 `decompile_android` 与 `smali_search`。完整流程在
  `agent/skills/apkseep/references/advanced-unpacking.md`，包括「dump 看着完整、方法体却是空的」那一段怎么往下走。
- DEX 字符串扫描上限 6 个 dex、24 MiB；体检内字符串提取上限 400 条，独立工具上限 500 条。
- Mach-O fat 二进制只分析第一个切片；IPA 最多尝试三个 `Payload/*.app/*` 候选定位主二进制。
- `disassemble_range` 是带文件偏移的线性扫描，不是控制流分析：无法解码的字节输出 `db 0xNN` 并前进一个字节，
  所以未知指令之后的清单可能失步；分支目标写作 `file+0x…`，不证明可达性。要伪 C 用 `run_radare decompile`，
  要 Java/smali 用 `decompile_android`。
- 符号表完全取决文件自身：被 strip 的二进制只会有导入，工具会明说，不会编造函数名。
- 工具自己停在「读」这一侧：不执行样本、不就地改写样本。读之后的一切 —— 补丁、重签、重打包、把返回值改掉的
  hook —— 走 `command.run`（限 `plugin.json#commands` 里那十四个二进制）或技能脚本
  （`agent/skills/apk-reverse/scripts/rebuild-sign-install.sh`、`frida-run.sh`），也可以直接写进你自己终端；
  每一步都看得见、能复跑。在「打补丁」与「写 keygen」之间要选路线时，
  `agent/skills/softseep/references/project-paradigms.md` 按架构型给出判据。
