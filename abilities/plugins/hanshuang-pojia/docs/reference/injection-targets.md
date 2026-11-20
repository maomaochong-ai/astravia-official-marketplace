# 注入目标与提示词包（事实表）

这页只写「现在是什么样」。原因与权衡不在正文，代码在 `src/domain/inject/`。

## 目标矩阵

九个目标，四种形态。`unavailable` 表示该目标自身把入口封死了，不是待实现。

| id | 目标 | 形态 | 层级 | 写入点 | 备注 |
|---|---|---|---|---|---|
| `codex` | Codex | marker-block | payload | `~/.codex/AGENTS.md` | 另需 `config.toml` 的 `model_instructions_file` 指向它 |
| `claude` | Claude | marker-block | payload | `~/.claude/CLAUDE.md` | 技能目录 `~/.claude/skills` |
| `opencode` | OpenCode | system-layer | system | `~/.config/opencode/agent/hanshuang.md` | `default_agent` 需指向它；只写 AGENTS.md 会被驳回 |
| `cursor` | Cursor | marker-block | payload | `~/.cursor/rules/hanshuang.mdc` | 项目级规则要每个项目各放一次 |
| `zcode` | ZCode | marker-block | payload | `~/.zcode/AGENTS.md` | 系统提示词在应用包内，标记块只覆盖记忆层 |
| `dsh` | DeepSeek Harness | marker-block | payload | `~/.dsh/AGENTS.md` | 技能目录 `~/.dsh/skills` |
| `workbuddy-intl` | WorkBuddy（国际版） | marker-block | payload | `~/.workbuddy-ai/MEMORY.md` | 记忆档案与 MEMORY.md 两处都要写 |
| `workbuddy-cn` | WorkBuddy（国内版） | marker-block | payload | `~/.workbuddy/MEMORY.md` | 与国际版同一套脚本，靠配置根区分 |
| `doubao` | 豆包 | unavailable | config | （云端记忆，CDP） | macOS 客户端重写自身命令行，调试端口不监听 |

计数：marker-block 7、system-layer 1、unavailable 1；`cdp` 形态已定义但当前没有目标使用它。

## 提示词包

正文在 `src/content/packs/<id>.md`，索引在 `src/domain/inject/packs.generated.ts`（只有元数据）。
正文随包发到 `dist/assets/packs/`，运行时按需读取。

| id | 标题 | 注入模式 | 出处 |
|---|---|---|---|
| `execution-kernel` | 执行内核 · 契约骨架 | prepend | hanshuang-mac `resources/opencode-kernel.md`（结构重写） |
| `inject-ladder` | 注入层阶梯 | append | hanshuang-mac 9 目标实测表 + `docs/RESEARCH-opencode.md` |
| `jailbreak-research` | 破甲研究流水线 | append | dsh-jailbreak-workflow「破甲制作」工作流 |
| `persona-redteam` | 红队角色 · 破甲与逆向 | append | deva 内置角色「小码酱」 |

四个包都是结构重写，不是原文搬运；每份文件的 front matter 里记着出处。

## 三条执行路由

同一份脚本，差别只在谁按下回车。

| 路由 | 谁执行 | 前置条件 | 证据 |
|---|---|---|---|
| **R1 command** | 插件自己，`inject_target { apply: true }` | `agent.command.run` 已授予 + `pwsh`（或 `powershell`）已声明且放行 | stdout 里 `backup ->` / `state ->` / `done:` 三行 |
| **R2 agent** | 对话里的 Agent | 无（Agent 有自己的 shell 与文件工具） | Agent 回读目标文件后逐条报告 |
| **R3 save** | 用户 | 调用时传 `save: true` | 用户执行后的回读输出 |

- 脚本落盘：`.hanshuang/inject/<target>.ps1|.sh`（工作区内，宿主 `fs.write` 放行）。
- 命令形态：`pwsh -NoProfile -ExecutionPolicy Bypass -File <script>`；探测不到 `pwsh` 时回退 `powershell`（Windows 5.1），
  posix 直接 `sh <script>`。
- 两条 PowerShell 可执行文件都在 `plugin.json#commands` 里声明，但**不在** `TOOLCHAIN` 版本表里 ——
  它们不是逆向引擎，不进 `probe_environment` 的返回。

## 标记与状态文件

- 标记：`<!-- 寒霜破甲注入开始 … <!-- 寒霜破甲注入结束 -->`，与上游注入器互认。
- 状态：`workbench/install-state.json`，`{ version, entries[{ target, files[], backups[], markerBlock, packLabel, installedAt }] }`。
- 备份命名：`<目标文件>.hanshuang-backup-<yyyyMMdd-HHmmss>`。

## 边界

插件不写主目录。它能写工作区（脚本）、能在用户授权后执行命令（R1）、也能把命令交给 Agent（R2）——
但「装好了」只在拿到证据后才成立：R1 看 stdout，R2 看回读，R3 看用户回报。
