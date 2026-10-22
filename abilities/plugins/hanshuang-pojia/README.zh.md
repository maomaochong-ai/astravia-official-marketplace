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
| `generate_hook` | 为命中的 Dalvik 方法生成 Frida **观测**脚本（绝不改写返回值） |
| `triage_directory` | 目录下所有二进制的风险表，最差的排最前 |
| `search_docs` | 在 309 篇随包文档里按标题 / id / 主题检索 |
| `read_doc` | 读一篇文档正文（Markdown），超预算时明确标识截断位置 |
| `probe_environment` | 探测已声明的可执行文件是否真能跑，给出各自版本横幅，并区分「宿主拒绝」与「未安装」 |
| `run_radare` | r2 / rabin2 / radiff2 / rasm2：头信息、字符串、函数表、反汇编、伪 C、交叉引用、汇编、差分，以及只读 `cmd` |
| `decompile_android` | 用 jadx / apktool 输出到相邻目录，再对整个目录做 `smali_search` |
| `init_task` | 单个目标的案件目录：`samples/`、`exports/`、`reports/`、README 与报告模板 |

十八个工具都显式声明 `scope_use`（fail-closed），并且只通过宿主 `fs` 访问工作区。样本用 `fs.readBinaryFile` 读取，上限对齐宿主自己的 32 MiB 二进制读取天花板。更大或位于项目外的样本交给对话里的 Agent，它用的是应用自身的文件权限。

四个新工具都明确写出了自己不是什么：伪代码没有类型恢复、没有 SSA、不做变量合并；函数级比对是
指令形状指纹，不是等价性证明；hook 模板只观测并原样返回原值 —— 在它上面写绕过是人的决定，不是插件
产出的东西。

四个工具链工具遵循同一条规则：`plugin.json#commands` 里逐字声明它们可以启动的八个可执行文件，宿主在授予
`agent.command.run` 前会问用户，每次调用都是带参数数组的 `execFile`，不经过 shell。`run_radare` 的 `cmd`
拒绝写、shell、调试器、打开文件、脚本执行、工程、挂载与 `=` 远程族命令（`w`、`!`、`oo`、`o`、`d`、`P`、`R`、
`m`、`.`、`=`），只放行 `dr` 这类只读族；凡是会离开 r2 自身解析器的写法也一律拒绝 —— 管道 `|`、重定向 `>`/`<`、
`$()`、反引号与 `=!`。

`decompile_android` 只写到 APK 旁边的目录，从不改原文件，全局也没有 `patches/` 目录。`probe_environment`
跑八次短 `--version`，结果缓存一分钟，并把两种失败分清楚：被拒绝是设置问题，找不到才是装的问题。

同一套引擎可以在终端里跑，不经过插件沙箱：

```bash
node scripts/analyze.mjs triage sample.apk --json
node scripts/analyze.mjs decompile libfoo.so --symbol check_license
node scripts/analyze.mjs diff v1.elf v2.elf
node scripts/analyze.mjs hook app.apk --query license --package com.example.app
node scripts/analyze.mjs docs frida --group kb
```

`scripts/analyze.mjs` 用 esbuild 打包 `src/cli/analyze.ts`，只 import `src/domain`，因此能读进程能读的
任何路径 —— 不涉及插件 fs 授权。子命令：`triage`、`strings`、`symbols`、`disasm`、`decompile`、`diff`、
`hook`、`docs`。退出码：`0` 正常、`1` 用法错误、`2` 分析失败。

## 权限

| 权限 | 原因 |
| --- | --- |
| `ui.slot.activity-tab` | 工作台面板 |
| `agent.tools.register`、`agent.toolHandler.execute` | 十八个工具 |
| `agent.command.run` | `probe_environment`、`run_radare`、`decompile_android`：使用 `commands` 里声明的八个可执行文件，每个都需用户授权 |
| `agent.session.write` | 工具结果写回对话、面板的「发给对话」按钮 |
| `agent.session.read` | 面板显示对话实时状态（本轮是否在跑、哪个工具在跑） |
| `storage.read`、`storage.write` | 样本架与设置能跨重启保留；没有授权时面板退化为会话内存 |
| `fs.read` | 列目录与读取样本 |
| `fs.write` | `fs.saveAs` 导出报告（路径由用户选择） |
| `agent.systemPrompt.write` | 运行时生成的 kernel 块：实验室开关、用户正在看的页面、可用工具表 |

## 规则放在哪里

本包**不再向系统提示注入常驻块**。每一轮都必须生效的规则住在技能里
（`agent/skills/hanshuang-pojia/SKILL.md`），而宿主为一个技能付的代价只有它的索引项——`name`
加 `description`，约 380 字符；97 KB 正文只在智能体真正为当前任务调用它时才进上下文。

插件唯一每轮注入的是 `src/domain/kernel.ts` 在运行时拼出的 kernel 块（`agent.systemPrompt.write`）：
实验室开没开、用户在看面板的哪一页、哪些工具可达。那是状态，不是文案，所以它不可能是静态文件。

2.3.2 之前包根还有一份 `AGENTS.md`，由 `agent.systemPrompt.promptPaths` 追加到每个会话，外加
`scripts/sync-agent-doc.mjs` 把同一段文字复制进 `<agentDir>/AGENTS.md` 当作用户级指令文件。
两份都已删除：它们在每一轮开头放大约 3.5k token 的同一段文字，而且第一次同步之后，同一份契约
会经由两条互不相关的注入路径到达模型两次。如果早前版本在本机写过那份用户级副本，
`<agentDir>/AGENTS.md` 里会残留 `<!-- hanshuang-pojia:begin -->` 到
`<!-- hanshuang-pojia:end -->` 之间的块——删掉该块；文件里没有别的内容就把文件一并删除。

市场仓库的 `tests/prompt-budget.test.mjs` 仍会在任何插件声明 `promptPaths` 且注入块超过 12 KB 时
失败，所以这条常驻通道不会被悄悄恢复。

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

2.1 起，工具包的**技能库直接随包发出**：`agent/docs/skill-library/` 是 `seep-kit/Tool/skill/` 的
逐字节副本——165 个文件、2.4 MB，含 `softseep`（总控）、`apkseep`（112 个文件、55 个可运行脚本）、
`ida-reverse`、`client-license-validation-bypass`，以及五个 `safe-skills/*` 技术包。一个字都没改。
清单与来源在 `agent/docs/SKILL-LIBRARY.md`，逐文件哈希在 `agent/docs/skill-library.sha256`，
`src/test/skill-library.test.ts` 会重算清单，防止构建时静默丢失。它们按路径路由（`PART V.6`），
没有注册成 `skillPaths`：上游 frontmatter 用了 YAML 块标量、描述超上限，而且 `ida-reverse` 重名。

提示词本体不该背的细节放在 `agent/skills/hanshuang-pojia/references/plugin-handbook.md`：实测的工具包目录结构、
MCP 工具全表、十篇手册索引、宿主安装矩阵、校验基线、中继与记忆机制。每轮付费的只有技能索引项，
所以正文可以写全。

## 目录

```text
agent/
└── skills/hanshuang-pojia/          # 宿主在对话区列出的技能
    ├── SKILL.md                     # 智能体文档全文（PART I–V，含工具包协议）
    └── references/plugin-handbook.md  # 实测目录结构、MCP 工具全表、手册索引、宿主安装矩阵
agent/docs/
├── SKILL-LIBRARY.md                 # 随包技能库：清单、来源、为何不注册成技能
├── skill-library.sha256             # 165 条逐文件哈希；测试会重算它
└── skill-library/                   # seep-kit/Tool/skill 的逐字节副本（165 文件 / 2.4 MB）
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
│   └── triage.ts                    # 入口：识别 → 解析 → 审计 → 报告
├── domain/toolchain/                # 外部可执行文件：这层自己不启动进程
│   ├── catalog.ts                   # TOOLCHAIN / COMMANDS，必须与 plugin.json#commands 一致
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
│       └── pages/                   # 十二个页面
└── test/                            # 夹具与测试
```

`src/domain/` 不依赖 `@astravia-org/plugin-sdk`，可以直接在 Node 里跑。

## 工作台面板

活动栏标签卡现在是一个十四页的工作台，而不是单页报告：工作台、使用指南、文档、样本、发现、字符串、
反汇编、清单、熵分布、签名、对比、自检、报告、设置。只有在样本被读进来之后才会出现分析结果，
每个页面读的都是同一份报告 —— 除了那两个不需要报告的页。

反汇编页是唯一不读报告的一页：它直接走样本自己的字节，扫可执行节区、给候选函数排序（入口 >
符号 > 调用目标），再逐个展开成带控制流的清单，分摘要 / 仅分支 / 全部三档，并按字符预算截断。
更深的二次核验仍然交给 `disassemble_range` 工具；这一页的意义是不用花一个回合就能看到清单。

文档页把工具包自带的实战资料直接放进面板：随插件逐字节发布的 292 篇知识库文章、10 篇手册和 7 篇
工具文档，标题检索在内存里即时完成，正文检索按需跨 309 篇文件扫描。每篇正文都是一个独立的构建
chunk，所以打开文档页的代价是一篇，而不是 4 MB。同一批文档在对话里也能通过 `search_docs` 与
`read_doc` 拿到 —— Agent 引用的那一篇和屏幕上显示的那一篇是同一个文件。

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

`src/content/docs/` 下 309 篇实战文档的索引由 `scripts/sync-docs.mjs` 生成：新增或修改文档后不带 `--check` 跑一次，CI 里则保留 `--check`。文档按需切成独立 chunk，没点开的文章不产生下载。

## 需要知道的边界

- 安卓签名只读取 v1 文件与 APK Signing Block 中的方案和摘要，**不做密码学验签**。
- 工具链工具只会借用已装的二进制，不会下载或安装。`probe_environment` 报告实际存在什么；通道被宿主拒绝时，该改的是插件声明或设置，不是 `PATH`。
- `run_radare` 每次只跑一条 r2 命令（`decompile` 的 `output_mode=summary` 是三条），单次上限 120 秒，白名单之外一律拒绝；`decompile_android` 给 jadx 与 apktool 各 10 分钟，只回日志开头，不回源码。
- `smali_search` 只读扩展名过滤后的文件，单文件 2 MiB、最多 8 000 个；命中上限时会明说，不假装已经搜完。
- 加壳/加密代码只报告，不脱壳；`native.packed` 是启发式判断（熵 + 导入数量，或 `UPX!` 标记）。
- DEX 字符串扫描上限 6 个 dex、24 MiB；体检内字符串提取上限 400 条，独立工具上限 500 条。
- Mach-O fat 二进制只分析第一个切片；IPA 最多尝试三个 `Payload/*.app/*` 候选定位主二进制。
- `disassemble_range` 是带文件偏移的线性扫描，不是控制流分析：无法解码的字节输出 `db 0xNN` 并前进一个字节，
  所以未知指令之后的清单可能失步；分支目标写作 `file+0x…`，不证明可达性。没有伪 C、没有汇编器、不做 Java/smali 反编译。
- 符号表完全取决文件自身：被 strip 的二进制只会有导入，工具会明说，不会编造函数名。
- 不执行、不打补丁、不重签、不重打包，也不生成 Frida hook、keygen 输入或授权绕过补丁。按设计只读。
