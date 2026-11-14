# strix-0006 — 与上游的工具面差异，以及每一项为什么这么定

- **Status:** Accepted
- **Date:** 2026-11-14
- **Context:** 插件 strix 0.7.0，工具 33 个；上游 `D:/open-source-projects/strix`（Python + `agents` SDK）
- **Related:** [0003](strix-0003-panel-reuses-host-and-subagents.md) — 一个 AI：宿主会话即循环

## The situation

上游的工具面来自三处：自己的 `strix/tools/*`、SDK 的沙箱能力（`exec_command` / `write_stdin` /
`apply_patch` / `view_image`）、以及给子智能体用的 `agents_graph`。插件早期只搬了第一处的
一部分，于是有几个能力看起来「上游有、这里没有」，而其中原因并不相同。

这一条把每一项都摊开：哪些已经补齐、哪些是有意不补、以及不补的理由。

## 已补齐（0.7.0）

| 上游 | 本插件 | 说明 |
|---|---|---|
| `exec_command(background, tty)` | `strix_exec({ background, tty })` | 长任务返回 `sessionId`，不再靠加大超时 |
| `write_stdin(session_id, chars)` | `strix_write_stdin` | stdin 直写；`tty: true` 时 REPL / ssh / nc 可用 |
| —— | `strix_shell_sessions` / `strix_kill_session` | 列出与收尾；上限 8 个并发会话，退出时全部回收 |
| `patch`（`ApplyPatchTool`） | `strix_patch` | `*** Begin Patch` 协议；解析与应用是纯函数，`@@` 锚点不唯一时**报错而不是猜** |
| `view_image` | `strix_view_image` | 读沙箱里的图，MCP 层返回真正的 `image` content block（不是 base64 文本） |
| `think` | `strix_think` | 无副作用，只进轨迹 |
| `scope_*` | `strix_scope` | 声明范围；报告带 Scope 节；`strix_exec` 给 `outOfScope` 提示 |
| `finish_scan` 的结构 | `strix_report` | 报告含范围与结论；SARIF 导出保留 |

`strix_patch` 与 `strix_scope` 的两个决定值得单独记：

- **补丁锚点歧义就失败。** 取第一个匹配去改「看起来像」的那处，是补丁改错函数的标准成因。
- **范围不做强制拦截。** 用正则去判断一条 shell 命令会碰到哪些主机，注定可被变量、管道、
  `printf` 绕过；给出「已声明范围之外」的提示、并把范围写进报告，比一个假的强制层诚实。

## 有意不补

| 上游 | 为什么不补 |
|---|---|
| `create_agent` / `send_message_to_agent` / `wait_for_agents` / `view_agent_graph` / `agent_finish` / `stop_agent` | 子智能体需要有人跑模型循环。插件的模型是宿主的（ADR 0003），没有第二处可以跑循环的地方；照搬工具名只会承诺一个不存在的编排。需要并行分工时用宿主自己的 subagent，共享同一沙箱与台账。 |
| `web_search` / `web_get_contents` | 上游要 Exa/Perplexity 的 key；宿主已经有联网检索。插件的立身之本是「不要第二份凭据」。 |
| `wait_for_user` | 宿主 agent 说出结论就结束了，用户在对话框里回话。再塞一个「等待用户」工具，等于两个地方等人。 |
| Caido 的 `list_requests` / `repeat_request` / `sitemap` 等专用工具 | 这些依赖 Caido 的客户端状态；这里通过容器里的 `caido_api` 走一个通用 `strix_proxy(action)`，少一层会在两处漂移的状态。 |
| `view_sitemap_entry` 之类的细分读取 | 同上：`strix_proxy` 的一个 action 覆盖，不为每个读法造一个工具。 |

## What this does not do

- 不承诺与上游工具**名字**逐一相同：`strix_` 前缀是本插件的命名空间，宿主侧会再加一层
  `mcp__…` 前缀，名字从来不是稳定契约，行为才是。
- 不做工具级的权限细分：MCP 服务整体由 `agent.mcp.control` 授予。

## The cost

- 多智能体是真实的功能缺口，写在能力页里，不让用户去找一个不存在的按钮。
- `strix_proxy` 的通用性换来的是：模型必须知道 Caido 的 action 名，而不是被工具签名引导。
  技能文档（`agent/skills/strix/tooling/`）里已经写明。
