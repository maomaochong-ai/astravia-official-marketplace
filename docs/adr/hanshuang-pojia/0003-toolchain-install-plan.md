# ADR 0003：按目标补齐工具链——插件出计划，agent 执行

- 状态：已接受（2026-10-23）
- 决策对象：`abilities/plugins/hanshuang-pojia`（2.4.5 → 2.5.0；当前 2.11.0，见文末「实现核对」）
- 参照对象：`hanshuang-pojia` 2.0 便携版的 `seep-kit/setup/repair-tools.ps1` + `Tool/docs/tool-index.json`（42 项工具）
- 关联文档：[ADR 0002](./0002-external-process-bridge.md)、[工具链对照表](../../../abilities/plugins/hanshuang-pojia/docs/reference/toolchain-parity.md)

## 1. 问题

2.4.x 的工具链是这样工作的：`catalog.ts` 声明 8 个可执行文件，`probe_environment` 逐个跑 `--version`，
报告里给一行人类可读的 `install` 提示（`brew install radare2 | winget install radare.radare2`）。用户拿到的是
"缺什么"，不是"怎么补"。

2.0 便携版有完整的三件套：42 项工具的索引（`tool-index.json`）、内置离线二进制、以及 `repair-tools.ps1`
按需从 GitHub Release 重下并带三个镜像回退。它的"安装"是一次性部署脚本 —— 装完 300 MB 才能在 Electron 里
启动 —— 而不是对话中的按需补齐。

用户的诉求是后者：**对话过程中，根据目标自动安装必要的工具**。

## 2. 为什么插件不自己装

四条约束，逐条都足以否决"插件直接跑安装器"：

1. **`plugin.json#commands` 是静态白名单。** 宿主 `command-runner.ts` 依次校验 `declaredCommands.includes(file)`
   与 `grantedCommandNames.includes(file)`。要装工具就得声明 `brew` / `apt-get` / `winget` / `pipx` / `scoop`
   各一个授权位 —— 五个"什么都能干"的权限，换一个"装个 jadx"的能力，权限面换得不划算。
2. **安装需要交互。** `sudo` 要密码，winget 要 UAC，Homebrew 首次装 cask 要 `--cask` 确认。`ctx.command.run`
   是 `execFile` 语义：无 shell、无 TTY，跑 `sudo apt-get install` 只会挂到超时。
3. **平台差异无法统一。** 同一个 jadx 在三个平台是三个包名、三种命令、三种失败形态（§3 的 recipe 表就是证据）。
   插件里的分支越细，越容易在某台机器上跑出半成品状态。
4. **不可审计。** 一段自动执行的安装脚本，用户看不到它装了什么、从哪来。2.0 的 `repair-tools.ps1` 恰恰把
   来源写死在脚本里并要求 `-Force` —— 那是脚本该有的样子，不是插件的。

对照 ADR 0002 已确立的 `agent.command.run` 模型：**每个能力配一个语义化工具，不设通用执行器**。装工具不是
插件的能力，是 agent 已经有 shell 之后的本职工作。

## 3. 决定：计划即交付物

新增工具 `install_toolchain`，签名：

```
install_toolchain({ goal?: "apk" | "native" | "firmware" | "dynamic" | "full", sample?: string, refresh?: boolean })
```

handler 做三件事，然后返回文本：

1. **探。** 有 `agent.command.run` 授权就复用 `probeOnce`（带一分钟缓存，`refresh` 绕过）；没有授权就把报告
   当作"全部缺失" —— 这仍然是有用的答案，因为计划本身不依赖探测结果。
2. **筛。** `goal` 决定候选集（`spec.goals` 含该 goal 的工具）；`sample` 的扩展名在省略 `goal` 时推断目标。
   APK-only 的任务不会看到反汇编器 —— 少一次密码提示，多一次信任。
3. **映射平台。** `detectPlatform(navigator.userAgent)` → `darwin` / `linux` / `windows`，取 `spec.recipe[platform]`。
   SDK 不暴露平台字段，`build-apple-apps` 已有同样的做法。

返回的是编号命令列表，末尾固定一句：跑完 `probe_environment { refresh: true }` 复核。

**执行链路（更新）：** 工具自身不 spawn 包管理器（不变），但本插件的对话指示（`install` prompt 动作，见
`src/features/workbench/prompts.ts`）会明确要求 Agent 逐条运行返回的命令、经宿主授权门放行、并逐条报进度；
面板自检页的「经对话一键安装」入口触发该动作。这样“从缺工具到装上”的整条链路在宿主对话里完成，
用户只做一次确认，和上游「面板点一下即装」在体验上对等——但权限面仍是收紧的（插件无权直装）。

关键区分被写进输出而不仅是注释：**`blocked` 不是 `missing`**。宿主拒绝调用（命令被用户禁用、或没授
`agent.command.run`）时，计划只写一条说明让用户去设置里开权限，**不打印安装命令** —— 否则用户会为一个
已经装好的工具反复跑包管理器，然后对下一次建议失去信任。

## 4. 工具面：探什么，建议什么

`catalog.ts` 分成两张表：

- `TOOLCHAIN`（14 项，进 `plugin.json#commands`）：r2 / rabin2 / radiff2 / rasm2 / rahash2 / rax2 / jadx /
  apktool / java / adb / apksigner / zipalign / frida / frida-ps。每一项都真的会被探测或驱动。
- `COMPANIONS`（11 项，不进 commands，零权限）：python3 / node / binwalk / yara / nmap / ida / binaryninja /
  jeb-pro / analyzeHeadless / pip / pwntools。它们只出现在安装计划的建议段，因为插件从不 spawn 它们。
  一笔声明换一个用户永远点不到的勾选框，不值得。

2.0 的 42 项里，MCP 类（`ida-pro-mcp` / `r2mcp` / `jshookmcp` / `reqable-mcp` / `xquik-mcp` / `pentestswarm` /
`agent-browser` / `playwright`）不在插件的能力范围内：它们要 MCP 注册，不是可执行文件。逐项对照见
[工具链对照表](../../../abilities/plugins/hanshuang-pojia/docs/reference/toolchain-parity.md)。

`TOOLCHAIN` 一扩，`COMMANDS` 自动跟着变，`plugin.json#commands` 由 `toolchain.test.ts:56` 的
`expect(manifest.commands).toEqual([...COMMANDS])` 强制同步 —— 这是扩表的唯一"代价"，也是护住声明与使用
不漂移的唯一手段。

## 5. 代价与已知限制

- **升级要多勾权限。** `commands` 从 8 项增到 14 项，`agent.command.run` 的细粒度勾选界面会多出 6 行；
  老用户升级后需要在设置里逐项启用新命令（`plugin-package.ts:170-177` 的旧授权与新声明取交集，不会自动授予）。
- **`goal` 的正确性依赖调用方。** 传 `full` 会列出全部 14 项；这是给"用户说要全套"准备的，不该是默认。
- **recipe 是写死的知识，不是探测结果。** 包名会随上游改名而失效（winget 的 `skylot.jadx` 尤其可能）。
  失败由 `probe_environment` 兜底：装完没生效，报告立刻说没有，不会假装成功。
- **没做的：** 不做镜像回退（2.0 的 `ghproxy.net` / `gh-proxy.com`）—— 那需要插件自己下载文件，正是本文
  第 2 节否决的路径。国内网络下用户可能要自己换源。

## 实现核对（2026-10-27，版本 2.11.0）

“插件出计划、agent 执行”的边界在 2.11.0 原封未动：插件仍不下载、不解包、不起安装进程，`install_toolchain`
只回命令表。

重跑：

```bash
cd abilities/plugins/hanshuang-pojia
npm run test                                       # 含 src/test/toolchain.test.ts
npm run check
grep -n "export const TOOLCHAIN\|export const COMPANIONS\|export const COMMANDS" src/domain/toolchain/catalog.ts
node -e "console.log(require('./plugin.json').commands.length)"   # 14
```

| 决策 | 当前落点（Observed） | 结论 |
| --- | --- | --- |
| §2 四条否决（插件自己下载 / 自己解包 / 自己起安装器 / 拿镜像回退） | `src/tools/env/install-toolchain.ts` 只返回 `commands` 字符串数组；仓库内无 download / unzip / `spawn` 安装路径 | 成立 |
| 三步：探 → 筛 → 映射平台 | `probe_environment`（`refresh` 绕一分钟缓存，见 `src/domain/toolchain/probe.ts`）→ `TOOLCHAIN` 按 `goal` 筛 → 每条 `recipe` 给三平台命令 | 成立 |
| `blocked ≠ missing` | `probe.ts:105` `BLOCKED_PATTERN.test(msg) && !NOT_FOUND_PATTERN.test(msg)`；两个正则分别在 `:50` / `:52` | 成立，且把 `ENOENT` 归回“未安装” |
| `TOOLCHAIN` **14 项**进 `commands` | `src/domain/toolchain/catalog.ts:119` 起，14 个条目：`r2`/`rabin2`/`radiff2`/`rasm2`/`rahash2`/`rax2`/`jadx`/`apktool`/`java`/`adb`/`apksigner`/`zipalign`/`frida`/`frida-ps` | 成立，与本文一致 |
| `install_toolchain({ goal, sample, refresh })` 入参 | `Goal = "apk" \| "native" \| "firmware" \| "dynamic" \| "full"`（`catalog.ts:66`），`sample` 只用于推导 `goal` | 成立 |
| `commands` 由 `TOOLCHAIN` 派生 | `catalog.ts:415` `TOOLCHAIN.map(spec => spec.binary)`；`src/test/toolchain.test.ts:57` 与 `plugin.json` 对账 | 成立 |
| 对话侧 “install” 动作把执行责任交给 agent | `src/features/workbench/prompts.ts:133` 起的 install 文案：逐条跑、遇 sudo 先问、装完用 `refresh=true` 复探 | 成立 |
| 42 项上游工具、8 个 MCP 类不在范围 | `docs/reference/toolchain-parity.md` 仍在（5 KB）；42 这个数字属于上游工具目录，可直接对照 `agent/prompts` 下的 `tool-index.json`（`verify:generated` 报 `tool index ok: 42 entries`） | 成立 |
| §5 “老用户需逐项勾权限” | 引的是宿主侧 `plugin-package.ts:170-177`（不在本仓库，**未核**） | Assumed，保留原文 |
| §5 “不做镜像回退” | 仓库内无 `ghproxy` / 镜像源常量 | 成立 |

补充一个从代码读出的入参细节：`goal` 与 `sample` 两个都是可选，`input.goal ?? inferGoal(input.sample)`（`src/tools/env/install-toolchain.ts:52`），
所以“只给样本路径”也能出计划；两个都不给时 `inferGoal` 返回 `"full"`（`src/domain/toolchain/install.ts:73`），即列全 14 项。

