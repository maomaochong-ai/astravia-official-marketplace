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

**D15** 上游 23 个工具压成 18 个注册项，合并口径：

| 上游 | 本插件 | 说明 |
|---|---|---|
| `seep_status` + `seep_ida_status` | `probe_environment` | 只报 r2/rabin2/radiff2/rasm2/jadx/apktool/java/frida；IDA 无可靠 CLI 探测 |
| `seep_r2_info` `_strings` `_functions` `_disasm` `_decompile` `_xrefs` `_asm` `_diff` `_cmd` | `run_radare` | 一个 `operation` 枚举，`output_mode: full/fold/summary` |
| `seep_apk_decompile` `_unpack` `_smali_search` | `decompile_android` | jadx / apktool / fs 搜索 |
| `seep_task_init` + `seep_gen_security_report` | `init_task` | 工作区骨架 + 报告骨架 |
| `seep_kb_search` `_read` `_checklist` | 既有 `search_docs` / `read_doc` | 随包 309 篇文档，无需进程；六类清单按 `read_doc` id 直取（id 映射见 `plugin-handbook` §7.5.1） |
| `seep_auto_triage` | 既有 `triage_directory` | 纯字节，无进程 |
| `seep_kb_payloads` | **不做** | 见 ADR 0001 D7：不做 `category` 切片、不拼装面向目标的载荷；种子清单原文本身随包，可当阅读材料 |

**D16** `run_radare` 的 `cmd` 走只读守卫 `assertReadOnly`：拒绝 `w*`（写字节/写内存）、`!`/`#!`（shell）、
`oo*`、`o`（打开另一个文件：命令通道不过宿主 fs，`o /etc/passwd` 会绕出项目根）、`d*`（调试，`dr` 只读寄存器除外）、
`P`（工程保存）、`R`（重启）、`m`（挂载）、`.`（执行脚本文件）、`=` 族（远程连接与 `=h` 的 r2 控制台服务 —— 网络暴露，不属于对文件的分析）。
此外拒绝所有“离开 r2 自身解析器”的写法：管道 `|`、重定向 `>`/`<`、`$(`、反引号、`=!`（`~!` 是取反过滤，仍放行）。
`P` 必须只匹配大写：小写 `p` 是打印族（`pdf` / `pdc` / `px`），大小写不敏感会误杀它们；
`dr` 由 `ALLOWED_COMMAND` 先于黑名单放行。保住 `seep_r2_cmd` 的表达力，同时不给“改样本、掉 shell、开任意文件、起调试器”留口子。

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

## 4. 后果

- 工具数 14 → 18；`EXPECTED_TOOL_COUNT = 18`；新增工具的中英双语标签同步。
- 新增权限 `agent.command.run` 属于配置契约变更 → `configVersion` +1，版本 2.4.1 → 2.4.2。
- 用户会看到"命令授权"提示；拒绝时工具返回明确说明而不是崩。面板离线能力不受影响。
- 未安装工具时，`probe_environment` 给出逐项安装提示（`brew install radare2` / `winget …` /
  `pipx install frida-tools`），而不是让 `run_radare` 抛 ENOENT。
- ADR 0001 §2.1 里标"拒绝/规划"的外部工具行，以本 ADR 为准；`seep_kb_payloads` 的拒绝与 D7 的其它
  拒绝项（防拒中继、拒答探测、keygen、补丁字节生成）**不变**。
- 依旧不做：IDB/IDA 会话、把 r2/jadx 打进安装包、"自动安装依赖"（宿主无此能力，插件不假装有）。

## 5. 验证

- `src/test/toolchain.test.ts`：`COMMANDS` ↔ `plugin.json` 一致、探针版本解析、拒绝/缺失区分、
  只读守卫、fold/branch/summary/截断文案、jadx/apktool 参数、smali 搜索与工作区骨架。
- `tsc --noEmit`、`vitest run`、`vite build`、`sync-docs.mjs --check`、根 `marketplace.mjs check`。
- 真机（本机实跑一次探针，runner 用 `execFile` 并复刻宿主「spawn 失败即抛错」的语义）：
  `frida ✓ 17.24.1`；`r2` / `rabin2` / `radiff2` / `rasm2` / `jadx` / `apktool` 均为
  `✗ spawn <bin> ENOENT`；`java ✗ exited with 1: Unable to locate a Java Runtime`（有二进制、无 JRE）。
  「没装」与「装了但起不来」的区分因此是被真实输出验证过的。同一份输出也说明了**依赖 radare2 的
  验收项在本机仍未验证**：不装 r2 就报不出 `info`/`functions`/`disasm`，而插件不会替用户装。
- 待验：装好 radare2（并给 jadx/apktool 配一个可用 JRE）后，`run_radare` 对自编 aarch64 样本取
  `info`/`functions`/`disasm`，`decompile_android` 对真实 APK 出 smali。
