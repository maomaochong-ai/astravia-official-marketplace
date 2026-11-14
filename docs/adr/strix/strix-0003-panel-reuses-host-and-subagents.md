# strix-0003 — 一个 AI：宿主会话即循环，插件只做窗口与操作面

- **Status:** Accepted（2026-11-14 定稿：自带循环已删除，不再是并存的第二套）
- **Date:** 2026-11-13，2026-11-14 修订
- **Context:** 插件 strix 0.6.0；宿主已有 `conversation.*`、`agent.mcp.control`（MCP 工具贡献）
- **Related:** [0002](strix-0002-capability-parity-with-upstream.md) — 能力对照，上游模型矩阵与 CLI 明确不补

## The situation

插件里曾经有两套东西在跑同一个循环：

1. **面板自己的循环**（`use-strix-session` + `agent/strix-agent.ts` + `agent/system-prompt.ts`）：
   自己写系统提示词、自己调 `ctx.ai.chat`、自己维护 messages 数组、自己判 `finish`，
   还派生 `strix_spawn_agent` 的私有 worker，约四百行。
2. **宿主会话**：用户在同一台机器上换模型、发消息、调用工具；宿主已经通过
   `agent.mcpServers` 把本插件的 26 个 `strix_*` 工具挂进了它自己的 agent。

两套并存的结果，用户能看到：面板与对话框各自推理、各自计费；面板里的 worker
不在宿主的子智能体面板里；同一句话在两个窗口里得到两套结论。更糟的是，面板那套
循环在特权/离线校验态下不可用，于是「插件不能用」就成了结论。

这不是功能缺失，是**所有权的重叠**。一个插件只能有一个 AI，而这个 AI 是宿主的。

## The decision

**插件不持有模型调用。宿主会话是唯一的循环；插件是它的窗口与操作面。**

具体到代码：

1. **没有 `ctx.ai.chat`，也没有第二份系统提示词。**
   `agent/strix-agent.ts`、`agent/system-prompt.ts` 已删除，`agent/strix-tools.ts`
   只剩 MCP 工具目录。工具的方法论（先取证、后结论、不手搓替代）改由
   `locales/*.json#prompt.instructions` 随每一轮发出——这是提示词，不是模型。

2. **输入：面板说的每一句话都交给宿主会话。**
   `start()` / `send()` 只有两条路径：`sendPrompt(text)`；没有活跃会话时先
   `createSession(cwd)` 再发。发不出去就在启动日志里如实说（`log.sendFailed` /
   `log.noWorkspace`），绝不另起一轮假装在跑。

3. **输出：面板渲染宿主这一轮的产物，来自两个见证方。**
   - 会话事件（`turn-start` / `message-added` / `message-updated` / `tool-call-*`）：
     谁在什么时候调了哪个 `strix_*` 工具，模型的回答正在流式到达；
   - 服务事件（`/api/events` 的 `tool_start` / `tool_end`）：命令原文、退出码、耗时、
     输出尾巴——只有持有容器的一侧知道。
   `domain/conversation-projection.ts` 是唯一的切分规则：带证据的命令从服务画，
   其余工具从会话画，`isServiceNarrated()` 让两边都不重复。评估自身的事实
   （findings / 计划 / 覆盖 / 笔记 / 会话）在每次工具结束后从服务重读。

4. **子智能体不再是插件的东西。**
   上一版曾保留 `strix_spawn_agent` / `wait` / `view` 作为「沙箱 worker」。既然插件
   不再持有模型，它就无法跑一个子循环——那些工具名保留下来只会承诺不存在的编排。
   需要并行分工时，用宿主自己的 subagent 能力，共享同一个沙箱与 findings 台账。
   侧栏里那个永远填不满的「agents」面板同时删除。

5. **面板信息层级照上游，但不移植上游前端。**
   目标与模式 → 运行状态（环境、沙箱、模式）→ 实时轨迹 + 流式回答 → findings /
   覆盖 / 报告。排布用宿主的组件体系。

## Considered options

- **保留自带循环，只把模型换成宿主的**：改动最小，但两套会话状态仍在，轮次互不感知，
  用户换会话时面板会指着一个已经不存在的运行。**否。**
- **把面板做成纯只读展示**：彻底消除重叠，但「启动扫描」这类操作就还得回对话框敲命令，
  面板失去意义。**否。**
- **移植上游 viewer**：视觉最接近上游，但要重建主题与快捷键体系，且在宿主的 iframe 里
  再套一层应用。**否。**

## What this does not do

- **不再有「面板自己的模型」**，因此也不再有面板级模型设置；一切跟随当前会话。
  面板连 `ai.models.list` 都不再调用——`conversation.model` 的 `provider/id` 就够做标签。
- **权限随之收窄**：`ai.complete` / `ai.models.list` / `shell.openExternal` 全部移除，
  只留 `agent.session.read` / `agent.session.write` / `agent.skills.control` /
  `agent.mcp.control` 与三个 UI 槽位。
- **不保证与上游 TUI 的键位一致**；面板用宿主的交互习惯。

## The cost

- 删掉自带循环是净删除，但**面板的行为会变**：以前面板独立于对话，现在它与对话是同一轮。
  没有活跃会话时，面板不能自己开工——它需要用户先在一个工作目录里开一轮对话。
  这条限制写进启动日志（`log.noWorkspace`），而不是替用户猜一个目录。
- 实时性依赖宿主事件流；事件有延迟时轨迹会慢半拍，因此状态带区分
  「宿主在跑」（`scan.running`）与「评估还开着但这一轮结束了」（`scan.idle`），
  而不是把两者都说成 running。
- 命令的证据来自服务事件：宿主若绕过 `strix_exec`（例如直接用宿主自己的 shell 工具），
  那条命令不会出现在本面板——它不是本评估的一部分，画上来才是撒谎。
