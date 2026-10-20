# 寒霜破甲

在 Astravia 内离线静态体检安卓安装包、iOS 应用、原生二进制与压缩包，不依赖任何外部工具链，也从不运行样本。

插件只回答一个问题：**这是什么文件，评审应该先看哪里？**

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

八个工具都显式声明 `scope_use`（fail-closed），并且只通过宿主 `fs` 访问工作区。样本用 `fs.readBinaryFile` 读取，上限对齐宿主自己的 32 MiB 二进制读取天花板。更大或位于项目外的样本交给对话里的 Agent，它用的是应用自身的文件权限。

## 权限

| 权限 | 原因 |
| --- | --- |
| `ui.slot.activity-tab` | 工作台面板 |
| `agent.tools.register`、`agent.toolHandler.execute` | 八个工具 |
| `agent.session.write` | 工具结果写回对话 |
| `fs.read` | 列目录与读取样本 |
| `fs.write` | `fs.saveAs` 导出报告（路径由用户选择） |

## 目录

```text
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

活动栏标签卡现在是一个十二页的工作台，而不是单页报告：工作台、使用指南、样本、发现、字符串、
清单、熵分布、签名、对比、自检、报告、设置。只有在样本被读进来之后才会出现分析结果，
每个页面读的都是同一份报告。

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
cd abilities/plugins/frostbreak
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
