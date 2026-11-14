# strix-0010 — 上游有 agents 面板，这里有什么：工作单元

- **Status:** Accepted
- **Date:** 2026-11-14
- **Context:** 插件 strix 0.9.0；用户问「上游 UI 有 agents，插件为什么没有；如果要同等实现，怎么定位」
- **Related:** [0003](strix-0003-panel-reuses-host-and-subagents.md)（一个 AI）、[0006](strix-0006-tool-surface-parity.md)（不做 agents_graph）、[0008](strix-0008-three-roles-of-the-panel.md)（三种职责）

## 上游那栏到底是什么

`strix/interface/tui/internal/app/agents.go` 与 `render/agents_graph.go` 里的 agents 树，每一行是
**Strix 自己派生的子智能体**：名字、状态（running / waiting / completed / failed / stopped）、
一句任务描述、它携带的技能。根 agent 用 `create_agent` 派生，用 `send_message_to_agent` 对话，
`wait_for_agents` 等它，`view_agent_graph` 看整棵树。

它成立的前提只有一个：**上游自己持有模型循环**。没有循环，就没有「派生了谁、谁在等谁」。

## 为什么插件没有

本插件的模型是宿主的（0003）。三轮里已经确认过两次：

- `agents_graph` 那 6 个工具**不实现**（0006）——插件无法跑子循环，照搬工具名只会承诺不存在的编排；
- 侧栏那个永远空的 agents 盒子**已删除**（0.6.0）——空盒子比没有更糟。

所以「插件为什么没有 agents 栏」的准确答案是：**不是漏做，是那一栏的语义在这里不存在。**

## The decision

**用「工作单元」替代「agents」，并把边界写在标题下面。**

工作单元 = 在同一个沙箱里**并行干活的东西**，当前只有一种来源：

| 行 | 来源 | 状态字段 |
|---|---|---|
| `nmap -sV ...` | agent 用 `strix_exec background: true` 留下的会话 | `running` / 已退出 + 退出码 |
| `msfconsole` · tty | 同上，带 `tty: true` | 同上，另标 `tty` |

数据来自 `/api/state` 的 `sessions`（`ShellSessions.list()`，上限 8 个并发，输出 64 KB 环形缓冲）。

三条约束：

1. **只读**。启动、写 stdin、停止都是工具（`strix_exec background` / `strix_write_stdin` /
   `strix_kill_session`）——那是 agent 的动作。面板加按钮就等于第二个地方决定「要并行跑什么」。
2. **不假装有父子关系**。上游的树是显式的（`parent_id`）；这里的会话是平的，所以不画树。
3. **宿主子智能体不在这里**。宿主有自己的子智能体面板，插件只能观察它们的启停（0003 的术语表）；
   把它们画进来会让人以为插件派生的。

## Considered options

- **照做一棵 agents 树，节点写「sandbox worker」**：能画出来，但它没有模型、不会思考，只有进程——
  叫 agent 是撒谎。0.6.0 已经删过一次这种空壳。**否。**
- **彻底不显示并行状态**：最省事，但 agent 起了 3 个扫描会话时，操作者在面板上看不到它们，
  只能去读轨迹里的 `session_start` 行。**否。**
- **显示宿主子智能体**（通过 conversation 事件推断）：宿主不向插件暴露子智能体清单，
  只能靠猜名字；猜错比不显示更糟。**否**（等宿主提供正式 API 再说）。

## What this does not do

- 不做 agent 之间的消息可视化（无子智能体，无消息）。
- 不做「点击某个会话看完整输出」：输出在轨迹里已可展开；面板列表只给命令、状态、时长。
- 不做并发上限的设置项：上限 8 是服务端常数，改它应该是代码决定，不是面板开关。

## The cost

- 与上游的界面相似度在那 4 分权重上仍然拿不到（`tools/ui-parity.mjs` 的「子智能体图」项保持 0）。
  这是**故意留白**：分数低是因为那一栏不存在，而不是没做。
- 工作单元只反映 shell 会话。agent 若用宿主自己的工具并行（不走 `strix_exec`），这里看不到——
  与 0007 的边界一致：不是本次运行的一部分，就不画。
