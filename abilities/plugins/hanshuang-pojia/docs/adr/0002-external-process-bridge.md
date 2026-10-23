# ADR 0002：外部进程桥——用 `commands` + `ctx.command.run` 对等 kit 的 MCP 工具

- 状态：已接受（2026-10-23）
- 决策对象：`abilities/plugins/hanshuang-pojia`（2.4.1 → 2.4.2）
- 参照对象：`seep-kit` 1.6.0 的 `Tool/mcp/seep_mcp_server.py`（23 个 MCP 工具）
- 关联文档：[ADR 0001](./0001-seep-kit-capability-parity.md)、[实施方案 0001](../plans/0001-capability-parity-phases.md)

## 1. 背景

ADR 0001 的前提是"面板不能调用 MCP、插件不能起子进程"，因此把 `seep_r2_*` / `seep_apk_*` 一族
外部工具判为"拒绝"或"规划"。这个前提需要修正：宿主的插件契约里**确有一条被授权的**外部进程
通道，已经在市场里被别的官方插件使用。

真正的约束不是"不能起进程"，而是：

1. 可执行文件必须写进 `plugin.json#commands`，并且当前被用户启用；否则宿主拒绝并提示用户。
2. 调用方必须持有 `agent.command.run`（`run`）或 `agent.command.spawn`（`spawn`）。
3. `ctx.command.run` 是 `execFile` 语义：无 shell、`args` 数组、`cwd` 必须落在宿主允许的根内、超时由
   宿主钳制；`spawn` 分配独立进程组，停用/卸载时整树 kill。

因此"能不能跑 r2/jadx"不再是设计问题，只剩"走哪条通道"。

## 2. 三条通道的评估

### 通道 A：自建 `host-node` 服务 + `agent.mcpServers type:"service"`（否决）

`video-downloader` 是这个范式的范本：`providers.services[]` 声明 `runtime.kind: "host-node"`、
`entry: "service/dist/main.js"`、六个平台各一条 `artifacts[]`，面板经 `ctx.services.request` 调
`/api/v1/*`，agent 经 `POST /mcp` 走 JSON-RPC 2.0。`dbx-pro`、`xiaohongshu` 同构。

否决理由（三处独立证据）：

1. `manifest-schema.d.ts` 里 `platforms[].artifacts` 必填，`entry` 注释是"relative to the installed
   runtime"——运行时不落地，entry 就不存在。
2. 运行时来自 `runtime-lock.json` 里钉住的 GitHub Release 资产（`xiaohongshu-1.1.27/xiaohongshu-service.zip`
   之类），而本仓库 CI（`publish-marketplace.yml`）只做 `marketplace.mjs check/build/verify` +
   `publish-marketplace.mjs`，`static-marketplace.mjs` / `publish-marketplace.mjs` / `marketplace.mjs`
   里没有任何 service 构建或资产上传逻辑。
3. `release/video-downloader-2.0.1.astraviapkg` 里根本没有 `service/`，只有 `scripts/package-service.mjs`；
   即"打包不含服务，服务靠 Release"。没有 Release 资产时安装会走 `error.runtimeMissing`（按设计不重试），
   服务永远起不来。

结论：在本仓库流水线不产 service 资产之前，通道 A 是装不上的死路——与 kit 的能力对等无关。

### 通道 B：`npx -y <pkg>@latest mcp` 的 stdio MCP（否决）

`rea` 用的就是这条：`mcpServers["rea"] = { command: "npx", args: ["-y","rea-agents@latest","mcp"] }`。
它要求我们自己发布并维护一个 npm 包，把整套 r2/jadx 逻辑搬进 Node 进程。成本高于收益：多一个
发布物、多一层版本漂移、还要在 npm 上承担同样的"产物无法验证"问题。否决。

### 通道 C：`plugin.json#commands` + `ctx.command.run`（选定）

与参照对象的做法**语义等价**：kit 是 Python 进程 `subprocess.run(["rabin2", …])`，我们让宿主以
`execFile` 语义跑同一个 `rabin2`。差别只在谁来扮演"父进程"，而这正是宿主希望保留的控制点
（用户可逐条命令授权/收回）。

`rea` 是现成范式：`commands: ["node","java","frida","adb","apktool", …]`（19 条）、`minAppVersion 0.5.60`，
`rea/src/index.tsx:88` 就是 `ctx.command.run(file, [...args], { timeoutMs: 10 * 60_000 })`。
本插件 `minAppVersion` 已是 `0.5.60`，无需提升。

## 3. 决策

**D13** 采用通道 C。`plugin.json` 增加：

```json
"commands": ["r2", "rabin2", "radiff2", "rasm2", "jadx", "apktool", "java", "frida"],
"permissions": [ …, "agent.command.run" ]
```

`src/domain/toolchain/catalog.ts#COMMANDS` 是这份清单的唯一来源，`toolchain.test.ts` 逐字节比对
`plugin.json#commands`：声明了却不用等于白要权限，用了却没声明等于被宿主拒绝，两种都是缺陷。

**D14** 工具 handler 拿不到 `ctx.command`。`PluginAgentToolApi` 只有 `{ fs, conversation }`，所以
命令通道必须在 `activate(ctx)` 时闭包捕获，经 `src/features/workbench/services/toolchain.ts` 适配成
领域层的 `CommandRunner`。领域层不 import SDK，全部逻辑可在无 r2 环境下用假 runner 测试。

**D15** 上游 23 个工具映射到本插件的注册项，合并口径（首版 18 项；2.5.0 加 `install_toolchain`，2.9.0 因
`seep_ida_status` / `seep_kb_checklist` / `seep_kb_payloads` 不再合并而拆出，现为 23 项）：

| 上游 | 本插件 | 说明 |
|---|---|---|
| `seep_status` | `probe_environment` | 只报 r2/rabin2/radiff2/rasm2/jadx/apktool/java/frida |
| `seep_ida_status` | `ida_status`（2.9.0） | 一次 `127.0.0.1:13337` 的 GET；无授权 / 无监听 / 无 network API 三态分开报。已装的 `probe_environment` 不探 IDA —— 它没有可靠 CLI |
| `seep_r2_info` `_strings` `_functions` `_disasm` `_decompile` `_xrefs` `_asm` `_diff` `_cmd` | `run_radare` | 一个 `operation` 枚举，`output_mode: full/fold/summary` |
| `seep_apk_decompile` `_unpack` `_smali_search` | `decompile_android` | jadx / apktool / fs 搜索 |
| `seep_task_init` | `init_task` | 工作区骨架（`samples/` `exports/` `reports/`）+ 报告骨架 |
| `seep_gen_security_report` | `write_assessment_report`（D19，2.4.5） | 四段式模板填充；未提供的段落写「未提供」，不虚构结论、不引 `patches/` |
| `seep_kb_search` `_read` | 既有 `search_docs` / `read_doc` | 随包 309 篇文档，无需进程 |
| `seep_kb_checklist` | `kb_checklist`（2.9.0） | 六类同名映射到随包那六篇；未知类型回菜单，不静默改用默认项 |
| `seep_auto_triage` | 既有 `triage_directory` | 纯字节，无进程 |
| `seep_kb_payloads` | `kb_payloads`（2.9.0，原 D7 拒绝） | 按类别切片，`all` 全文，未命中列真实章节；与上游差异：不回退前 60 行。切片不生成新载荷（见 ADR 0001 row 20 的决策反转） |

**D16**（已反转，2.9.0）`run_radare` 的 `cmd` 原先走只读守卫 `assertReadOnly`（拒绝写/打开/调试/工程/重启/挂载/网络族
与管道、重定向、`$(`、反引号、`=!` 等）。**决策反转**：`cmd` 改为对等上游零限制直通，`aaa; {command}` 拼接进 `r2 -q -c`，
任意 r2 命令词一律接受，移除了 `assertReadOnly` 及全部守卫正则/函数。保留的仅是一项 UX 检查：空命令报错，
不执行裸 `r2`。命令通道仍是 `execFile` 语义 + 参数数组，管道、重定向、`$()`、反引号不会经由 shell 执行，而是作为
r2 命令语法原文传给 `-c`。写字节等操作（`wx`）现可在 `cmd` 里直发（对等上游，由 lab 授权操作者决策反转）。

**D17** `init_task` 不建 `patches/`。上游该目录的说明是"验证 PoC 代码、代理 DLL 跳板工程、热补丁"，
属于制品产出；本插件只产证据与报告（`samples/` `exports/` `reports/`）。

**D18** 探针必须区分"未安装"与"宿主拒绝"。判据是宿主拒绝话术的正则
`BLOCKED_PATTERN = /permission|not (?:declared|allowed|enabled)|denied|disabled|unauthori[sz]ed/i`，
比初稿多了 `not allowed` / `not enabled` / `not declared` 的同构变体——宿主实际的拒绝文案不止一种写法。
命中即 `blocked: true`，不显示安装提示——否则会让用户去装一个其实已经装好的工具；
反之 `spawn … ENOENT` 才是"没装"，此时才给安装提示。

**D18a** `frida` 之所以在 `commands` 里，是因为 `probe_environment` 会真跑 `frida --version`。
插件自己从不启动 frida 会话（`generate_hook` 只产出脚本与命令行提示，观测由用户在自己的终端做）。
若将来去掉这一项探测，`commands` 里的 `frida` 必须同时删除——声明却不执行等于白要权限。

**D19** `write_assessment_report` 移植 `seep_gen_security_report` 的**契约**，不移植它的**默认文案**。
上游在缺参时仍会写出「存在 CWE-602 客户端信任缺陷」并用 `TEST EAX,EAX / JZ` 举例，还会引用 `patches/`
目录；这三处在本插件里都去掉，改为：未提供的段落渲染为显式的"未提供"、不印任何未观察到的汇编、不引用制品目录。
理由与 D17 同源：插件只产证据与报告，而"默认给出一个结论"会让一份空报告读起来像一次评估结果。
文件名取 `reports/<target>_security_assessment_report.md`，`target` 的路径分隔符一律替换，已存在则不覆盖（除非
`overwrite=true`）；`case_dir` 复用 `isOutsideProject` / `resolveSamplePath`，越出项目根直接拒绝。
语言默认 `en`，`zh` 需显式传入（仓库约定默认语言为英文）。

## 4. 后果

- 工具数 14 → 19（2.4.2 的 4 个 → 2.4.5 再 +1；2.5.0 → 20；2.9.0 → 23）；中文双语标签同步。
- 2.9.0 新增 `network.fetch`（`allowedHosts: ["127.0.0.1"]`）只供 `ida_status`；同样是配置契约变更，
  已装用户升级时会看到重新授权提示 —— 这一点必须在发布说明里写明，不能静默变化。
- 新增权限 `agent.command.run` 属于配置契约变更 → `configVersion` +1，版本 2.4.1 → 2.4.2。
- 用户会看到"命令授权"提示；拒绝时工具返回明确说明而不是崩。面板离线能力不受影响。
- 未安装工具时，`probe_environment` 给出逐项安装提示（`brew install radare2` / `winget …` /
  `pipx install frida-tools`），而不是让 `run_radare` 抛 ENOENT。
- ADR 0001 §2.1 里标"拒绝/规划"的外部工具行，以本 ADR 为准；`seep_kb_payloads` 的拒绝**已于 2.9.0
  撤回**（见 row 20 的决策反转）；D7 的其它拒绝项（防拒中继、拒答探测、keygen、补丁字节生成）**不变**。
- 依旧不做：IDB/IDA 会话（只做端口探测）、把 r2/jadx 打进安装包、"自动安装依赖"（宿主无此能力，插件不假装有）。

## 5. 验证

- `src/test/toolchain.test.ts`：`COMMANDS` ↔ `plugin.json` 一致、探针版本解析、拒绝/缺失区分、
  `cmd` 无界直通、fold/branch/summary/截断文案、jadx/apktool 参数、smali 搜索与工作区骨架。
- `tsc --noEmit`、`vitest run`、`vite build`、`sync-docs.mjs --check`、根 `marketplace.mjs check`。
- 真机（本机实跑一次探针，runner 用 `execFile` 并复刻宿主「spawn 失败即抛错」的语义）：
  `frida ✓ 17.24.1`；`r2` / `rabin2` / `radiff2` / `rasm2` / `jadx` / `apktool` 均为
  `✗ spawn <bin> ENOENT`；`java ✗ exited with 1: Unable to locate a Java Runtime`（有二进制、无 JRE）。
  「没装」与「装了但起不来」的区分因此是被真实输出验证过的。同一份输出也说明了**依赖 radare2 的
  验收项在本机仍未验证**：不装 r2 就报不出 `info`/`functions`/`disasm`，而插件不会替用户装。
- 待验：装好 radare2（并给 jadx/apktool 配一个可用 JRE）后，`run_radare` 对自编 aarch64 样本取
  `info`/`functions`/`disasm`，`decompile_android` 对真实 APK 出 smali。
