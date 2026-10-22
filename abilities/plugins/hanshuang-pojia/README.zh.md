# 寒霜破甲

在 Astravia 内离线静态体检安卓安装包、iOS 应用、原生二进制与压缩包，不依赖任何外部工具链，也从不运行样本。

插件只回答一个问题：**这是什么文件，评审应该先看哪里？**

从 2.0 起，随包智能体文档多了一层 **工作台工具包协议**（`PART V`）——实验模式开关、部署与校验看板、
先查知识库的侦察顺序，以及 `seep` / `ida` 的 MCP 工具矩阵。这层是指挥智能体配合桌面工具包干活的文档；
面板本身仍然零外部依赖、从不运行样本。

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
| `search_docs` | 在 309 篇随包文档里按标题 / id / 主题检索 |
| `read_doc` | 读一篇文档正文（Markdown），超预算时明确标识截断位置 |

十个工具都显式声明 `scope_use`（fail-closed），并且只通过宿主 `fs` 访问工作区。样本用 `fs.readBinaryFile` 读取，上限对齐宿主自己的 32 MiB 二进制读取天花板。更大或位于项目外的样本交给对话里的 Agent，它用的是应用自身的文件权限。

## 权限

| 权限 | 原因 |
| --- | --- |
| `ui.slot.activity-tab` | 工作台面板 |
| `agent.tools.register`、`agent.toolHandler.execute` | 十个工具 |
| `agent.session.write` | 工具结果写回对话、面板的「发给对话」按钮 |
| `agent.session.read` | 面板显示对话实时状态（本轮是否在跑、哪个工具在跑） |
| `storage.read`、`storage.write` | 样本架与设置能跨重启保留；没有授权时面板退化为会话内存 |
| `fs.read` | 列目录与读取样本 |
| `fs.write` | `fs.saveAs` 导出报告（路径由用户选择） |
| `agent.systemPrompt.write` | 把插件根目录的 `AGENTS.md` 注入每个会话的系统提示 |

## 智能体文档

插件根目录的 `AGENTS.md` 是智能体在被提问之前先看到的那段话。`plugin.json` 用
`agent.systemPrompt.promptPaths` 声明它，宿主会把它作为一个系统提示块，对**所有项目**的
每个会话生效——作用面等同于用户级的 `~/.claude/CLAUDE.md`，只是范围限定在这个插件内。
它刻意写得很短：这一段每一轮对话都要付 token。

## 提示体积预算

常驻块只放「每一轮都必须生效」的规则：身份与授权、artifact-first 开场、证据三态、copy-first
与四件套、路由表、回执格式、激活词、压缩后的反退缩清单。长文全部搬进技能
（`agent/skills/hanshuang-pojia/SKILL.md`），由宿主按需加载——逐轨交付模板、few-shot 回归集、
JIT 五阶段、PART V 与 MCP 工具矩阵都在那里。

这条拆不是为了好看：96 KB 的常驻块约等于 30k token，用户还没开口就先占满上下文，普通任务
一两轮就撞上 `context compaction`，而压缩卡片会把 20k–72k 字符的 markdown 摘要重新走一遍流式
渲染——宿主正是这条路径上反复抛 `React error #185`（Maximum update depth exceeded）并弹回重试
界面。市场仓库的 `tests/prompt-budget.test.mjs` 会在任一插件的注入块超过 12 KB 时失败，所以这条
拆分不会被悄悄改回去。

字面意义上的用户级副本在 `<agentDir>/AGENTS.md`。**插件自己写不进去**：它发出的每一次 `fs` 调用
都要先过“打开的项目根”白名单，而宿主没有提供“包裹落地时执行代码”的安装钩子。智能体的 shell
没有这层限制，所以 `AGENTS.md` 末尾只留一条命令，请智能体在每台机器上写一次用户级副本：

```bash
node scripts/sync-agent-doc.mjs                      # 写 <agentDir>/AGENTS.md
node scripts/sync-agent-doc.mjs --print              # 两份副本分别在哪
node scripts/sync-agent-doc.mjs --check              # 任一份不新鲜就 exit 1
node scripts/sync-agent-doc.mjs --from README.md     # 用另一个 md 替换包内的 AGENTS.md
node scripts/sync-agent-doc.mjs --remove             # 再把托管的块删掉
```

脚本随包分发（放在 `scripts/` 下），所以跑的就是安装后的那一份。它只**编辑**不覆盖：文本夹在
`<!-- hanshuang-pojia:begin -->` 与 `<!-- hanshuang-pojia:end -->` 之间，用户自己写过的 `AGENTS.md`
上下文全部保留，第二次执行会打印 `unchanged`。它解析 `<agentDir>` 的顺序与宿主一致——先是
`ASTRAVIA_CODING_AGENT_DIR`，然后是 `ASTRAVIA_HOME` / `ASTRAVIA_CONFIG_DIR`，最后才是
`~/.astravia/agent`。

为什么两份都要：清单声明那条路不依赖磁盘上任何文件、也不依赖智能体配合，即使副本从未写成功，
插件依然被认识；用户级那份是给人看的、可编辑的副本，权限被收回后也仍然有效。

升级到本版本时，宿主**不会自动授予**新增的 `agent.systemPrompt.write` 权限（旧授权与新声明
取交集），需要在确认界面勾选一次；不勾选时插件的其余功能照常，只是这段文档不会被注入。

## 工作台工具包 2.0

2.0 给智能体文档添了第五部分，绑定「寒霜破甲工具」桌面包（`seep-kit` 1.6.0）：

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

提示词本体不该背的细节放在 `agent/skills/hanshuang-pojia/references/workbench-2.0.md`：实测的工具包目录结构、
MCP 工具全表、十篇手册索引、宿主安装矩阵、校验基线、中继与记忆机制。提示词每一轮都要付费，所以保持精简。

## 目录

```text
AGENTS.md                             # 经 promptPaths 注入每个会话
agent/
└── skills/hanshuang-pojia/          # 宿主在对话区列出的技能
    ├── SKILL.md                     # 智能体文档正文 + 工具包协议
    └── references/workbench-2.0.md  # 实测目录结构、MCP 工具全表、手册索引、宿主安装矩阵
agent/docs/
├── SKILL-LIBRARY.md                 # 随包技能库：清单、来源、为何不注册成技能
├── skill-library.sha256             # 165 条逐文件哈希；测试会重算它
└── skill-library/                   # seep-kit/Tool/skill 的逐字节副本（165 文件 / 2.4 MB）
scripts/
└── sync-agent-doc.mjs               # 用本包内容写用户级副本
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
  处理面板够不到的部分（项目外路径、超过宿主读取上限的文件、jadx/apktool/radare2、全量字符串扫描）。
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
```

本仓库里 SDK 通过开发 tooling 解析（`../../../.tooling/open-astravia/packages/plugins/plugin-sdk`），因此 `package-lock.json` 里是 `link: true` 条目。完整市场构建会重新生成：

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

## 需要知道的边界

- 安卓签名只读取 v1 文件与 APK Signing Block 中的方案和摘要，**不做密码学验签**。
- 加壳/加密代码只报告，不脱壳；`native.packed` 是启发式判断（熵 + 导入数量，或 `UPX!` 标记）。
- DEX 字符串扫描上限 6 个 dex、24 MiB；体检内字符串提取上限 400 条，独立工具上限 500 条。
- Mach-O fat 二进制只分析第一个切片；IPA 最多尝试三个 `Payload/*.app/*` 候选定位主二进制。
- `disassemble_range` 是带文件偏移的线性扫描，不是控制流分析：无法解码的字节输出 `db 0xNN` 并前进一个字节，
  所以未知指令之后的清单可能失步；分支目标写作 `file+0x…`，不证明可达性。没有伪 C、没有汇编器、不做 Java/smali 反编译。
- 符号表完全取决文件自身：被 strip 的二进制只会有导入，工具会明说，不会编造函数名。
- 不执行、不打补丁、不重签、不重打包，也不生成 Frida hook、keygen 输入或授权绕过补丁。按设计只读。
