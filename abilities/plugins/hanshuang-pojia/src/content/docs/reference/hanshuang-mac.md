# hanshuang-mac · 九目标的注入器

> 出处：`D:\open-source-projects\hanshuang-mac`（Electron 33 + 随包 PowerShell 7.6.6 + 移植后的 `install*.ps1`）。
> 本文是能力清单与整合映射，不是上游文档的副本。

## 它解决的是什么问题

把一段常驻指令装进**别人家的 AI 客户端**，并且能干净地卸掉。这件事的难点不在写文件，在三点：

1. 每个客户端的注入点不同（`AGENTS.md`、`CLAUDE.md`、规则目录、agent 定义、配置键、云端记忆）；
2. 装完要能还原成**安装前的字节**，用户自己的内容一个字符都不能动；
3. 九个目标里有一条（豆包）根本走不了文件，只能驱动进程。

## 它的九个目标与三种机制

| 目标 | 机制 | 注入点 |
|---|---|---|
| Codex | 文件 + 配置键 | `~/.codex/AGENTS.md` + `config.toml` 的 `model_instructions_file` |
| Claude | 文件 | `~/.claude/CLAUDE.md` |
| OpenCode | **系统层** | `~/.config/opencode/agent/hanshuang.md`（正文即系统提示词）+ `default_agent` |
| Cursor | 文件 | `~/.cursor/rules/寒霜注入.mdc` + 项目级 `.cursor/rules` |
| ZCode | 文件 + 应用包内改写 | `~/.zcode/AGENTS.md`；系统提示词在 `zcode.cjs` 里，需整份备份 |
| DSH | 文件 | `~/.dsh/AGENTS.md` |
| WorkBuddy（国际 / 国内） | 文件 + 云端档案 | `MEMORY.md` 与 `memoryBlock` 两处 |
| 豆包 | **CDP** | 走调试端口改云端全局记忆；macOS 上目标重写命令行，端口不监听 → 不可用 |

关键实测结论（决定我们的分层设计）：

- 只往 `AGENTS.md` 写提示词，OpenCode 上**仍然会被驳回** —— 模型把它归类成「本机偏好」；
- 真正生效的是 `agent/<名>.md`：那份文件的正文就是系统提示词，内置模板不再注入；
- 内核写成**契约型**（首字节交付 / 缺参占位 / few-shot 锚点），通篇不要求模型「破例」，
  因此没有可驳回的对象。

## 我们的整合映射

| 上游机制 | 我们落在哪 | 形态差异 |
|---|---|---|
| 九目标清单 | `src/domain/inject/targets.ts` 的 `INJECT_TARGETS` | 按「怎么装」重分类为四种形态；豆包标 `unavailable` 并写原因 |
| 标记块 `<!-- 寒霜破甲注入开始 … 结束 -->` | `targets.ts` 的 `INJECT_MARKER_{BEGIN,END}`，与上游互认 | 同一对标记，两套装置可互相摘除 |
| `install*.ps1` | `src/domain/inject/script.ts` 的 `renderInstaller` | 不搬脚本，改为**生成**脚本：PowerShell 与 POSIX 两版，固定四步 |
| `install-state.json` | `src/domain/inject/state.ts` | 同一份清单语义；坏 JSON 返回空状态而非抛错 |
| 随包 pwsh 执行 | `src/domain/inject/apply.ts` 的 R1 路由 | 用宿主命令通道跑，不打包运行时 |
| OpenCode 内核正文 | `src/content/packs/execution-kernel.md` | 结构重写，不做原文搬运 |

## 我们没搬的

- **Electron 壳**：宿主是 Astravia，多一个桌面应用只多一份维护。
- **随包 PowerShell 运行时**（约 70 MB）：宿主已有命令通道，装运行时是重复投资。
- **`codex-skills-v5` 的 106 个技能目录**：体积与授权都不清；插件自带 9 个安全技能已覆盖同类工作。
- **豆包的 CDP 驱动**：目标自身封死了入口，做了也不生效，只记录原因。
