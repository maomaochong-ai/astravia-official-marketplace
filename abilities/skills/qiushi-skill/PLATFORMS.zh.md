# 在其他宿主里使用

包里的内容就是三样纯文本：十份技能目录、十份命令模板、一个 hook。没有任何一处绑死 Astravia。任何能读 Markdown 技能的宿主都能用这些规程；这一页只说每个宿主把文件放在哪。

```text
SKILL.md              入口：总原则 + 路由表 + 别名对照
references/skills/    十份规程，每份是一个自带 SKILL.md 的目录
commands/             十份斜杠命令模板（给有斜杠命令的宿主）
agents/               两份角色简报
hooks/                会话启动注入（hooks.json + session-start）
```

## 用脚本复制

```bash
node scripts/install-platforms.mjs --list                        # 探测宿主，打印路径
node scripts/install-platforms.mjs --target codex                # 复制到 ~/.codex/skills/qiushi-skill
node scripts/install-platforms.mjs --target opencode --scope project
node scripts/install-platforms.mjs --uninstall --target codex
node scripts/install-platforms.mjs --target all --dry-run        # 只打印计划，不落盘
```

| `--target` | 复制内容 | 用户级落点 |
|---|---|---|
| `claude-code` | 入口、规程、命令、角色简报、hook | `~/.claude/plugins/qiushi-skill` |
| `cursor` | 入口、规程、命令、角色简报、hook | `~/.cursor/plugins/qiushi-skill` |
| `codex` | 入口、规程、命令 | `~/.codex/skills/qiushi-skill`（认 `$CODEX_HOME`） |
| `opencode` | 入口、规程、命令 | `~/.config/opencode/skills/qiushi-skill` + `~/.config/opencode/commands` |
| `openclaw` | 入口、规程 | `~/.openclaw/skills/qiushi-skill` |
| `hermes` | 入口、规程 | `~/.hermes/skills/qiushi-skill` |
| `nanobot` | 入口、规程 | `~/.nanobot/workspace/skills/qiushi-skill` |
| `astravia` | 入口、规程、命令 | `~/.astravia/skills/qiushi-skill`（通常不需要，市场安装已经做了这件事） |

`--scope project` 改为写到当前目录下（`.claude/`、`.cursor/`、`.codex/`、`.opencode/`、`.hermes/`、`.nanobot/`、`skills/`）。

每次写入都会在目标根目录留一份 `.qiushi-skill-install.json`。因此有两条行为要先知道：

- **它不会覆盖不是自己写的文件。** 已存在且不在清单里的路径会被跳过并打印 `keep`；要覆盖得显式加 `--force`。
- **卸载只删自己写进去的条目**，再删清单，目录里的其他东西不动。

复制十份规程意味着：会递归扫描技能目录的宿主（包括 Astravia）会看到十个技能，除非它同时读 `references/skills/.ignore`——这个文件会随复制一起过去，规则 `*/SKILL.md` 就是让面板只留一条的东西。

## 各宿主补充

- **Claude Code** —— bundle 自带 `hooks/hooks.json`，会话启动注入是原生的：第一轮对话前入口正文就在上下文里。`commands/` 里的文件成为斜杠命令，不需要额外配置。
- **Cursor** —— 同样的 bundle 布局，用自己的插件目录。若你把插件目录改到了别处，用 `--dest` 指过去。
- **Codex** —— 递归读技能目录，所以 `~/.codex/skills/qiushi-skill/` 会被识别成一组。但 hook **不**从技能目录读：Codex 认配置旁边的 `hooks.json`，想要注入就自己把 `hooks/hooks.json` 复制过去，并把 `${CLAUDE_PLUGIN_ROOT}` 改成实际安装路径。
- **OpenCode** —— 规程加 Markdown 命令；命令落在共享的 `commands/` 目录，清单也写在那里。
- **OpenClaw / Hermes / nanobot** —— 只放规程。Hermes 的 project 级复制需要在配置里加 `external_dirs` 才会被扫到。

## 没有 Node.js 时

手动复制：

```bash
cp -R references/skills/* <宿主 skills 目录>/
cp -R commands/*         <宿主 commands 目录>/      # 仅当宿主有斜杠命令
```

如果宿主会递归扫 `SKILL.md` 而你想只留一条，记得把 `references/skills/.ignore` 一起放过去。

## 关于 hook

`hooks/hooks.json` 声明了一个匹配 `startup|clear|compact` 的 `SessionStart` hook，执行 `hooks/run-hook.cmd session-start`，后者从包根读 `SKILL.md`，按 `additional_context`（Claude Code 下是 `hookSpecificOutput.additionalContext`）输出。

- Windows 上 `.cmd` 会优先用 `pwsh` 跑 `session-start.ps1`，再退到 `powershell`，最后退到 `bash`/`sh`，不需要 Git Bash 或 WSL。
- 注入的是**入口**，不是十份规程。入口给出路由表和纪律，规程按需读取。
- `hooks/run-hook.cmd` 与 `hooks/session-start` 随包带可执行位（`0755`）。手动复制到 POSIX 系统后若权限丢了，`chmod +x` 补一下。

## 全程不联网

没有 `npx`，没有包仓库，没有 GitHub API。脚本只复制手上的文件、记下复制了什么、然后退出。上游的 `bin/` 安装器不在本包里，因为它要解析 npm 包名与 GitHub 坐标，而这两个东西在这里都不存在。
