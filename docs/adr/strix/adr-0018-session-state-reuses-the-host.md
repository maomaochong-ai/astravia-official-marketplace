# ADR 0018：会话与状态：预算、统计、历史、新鲜度各管什么

- **状态：** 已接受
- **日期：** 2026-11-15
- **背景：** 上游 `llm/compaction.py`、`interface/cloud/billing + budget`、`telemetry/`、
  `interface/update_check.py` 四项能力在插件里都缺；用户要求范围内能力做到 100%
- **关联：** [ADR 0003](adr-0003-panel-reuses-host-session-and-model.md)（一个 AI）、
  [ADR 0015](adr-0015-ledgers-are-per-conversation.md)（台账按会话）

## 四条能力，四种成本模型

上游这四项都建立在"它自己跑模型、自己联网"之上。本插件两条都不成立，所以不能照抄，
也不该假装照抄。逐个把**它问的问题**翻译成**我们能回答的问题**：

| 上游 | 它回答的问题 | 我们的等价问题 | 落点 |
|---|---|---|---|
| compaction | 上下文太长时怎么压？ | 压缩**发生了**，面板要让人看见 | hook 识别 `role: "compaction"` → 轨迹一行 |
| budget/billing | 这次花了多少钱？ | 这一轮**允许做多少事**，超了要拒 | `strix_budget` + `/api/tool` 前置拦截 |
| telemetry | 厂商怎么知道功能有没有被用？ | 同样的问题，但答案**只留在本机** | `telemetry.json` + 面板「本机统计」 |
| update_check | 有没有新版本？ | 我们跑的组件**是不是当前的** | `strix_update_check`：服务摘要/技能来源/镜像日期 |

## 术语

- **额度（budget）**：一轮评估的三条上限——工具调用次数、墙钟分钟、发现条数。`0` = 不限。
- **本机统计（local stats）**：只写本机数据目录的计数：工具名 → 调用次数、评估次数、发现数、
  最长一次评估时长。**不含内容**（目标、命令、标题一律不记），**不外发**。
- **历史评估（history）**：从磁盘上的台账文件推导出的评估清单（键、时间、发现数、目标、有没有报告）。
  只读，没有写入路径。
- **新鲜度（freshness）**：三件能本地判断的事——服务产物与盖章是否一致、技能库来自哪一版、
  沙箱镜像本地是哪天的。
- **压缩可见（compaction visible）**：宿主压缩上下文时，轨迹里出现一行说明；它不是错误，是状态。

## 决定

1. **预算在服务侧拦，不在面板提示**：agent 才是花额度的人（它调 `strix_exec`），只有服务能在
   调用前拒绝。拒绝的回复带 `budget` 快照与一句原因，模型据此收尾而不是重试。
2. **计量哪些工具**：`strix_exec` / `strix_browser` / `strix_proxy` / `strix_patch` / `strix_file_finding`。
   查询类（`strix_budget`、`strix_history`、`strix_team_roster`、`strix_update_check`、`strix_environment`、
   `strix_mcp`、`strix_*_skills`、`strix_sandbox_status`）不计量——否则"查一下还剩多少"会耗尽额度。
3. **额度存服务端**（`preferences.json` 的 `budget`），重启后与用户看到的一致。
4. **统计不采内容、不外发、无关闭开关**：它没有外部副作用，删 `telemetry.json` 即可清空。
5. **历史只推导**：不给"删整轮"，删除仍然走删文件或 `strix_delete_finding`——静默丢证据比清单脏更糟。
6. **新鲜度不猜远端**：镜像只说"本地是哪天的"，是否要拉由用户点「拉取镜像」决定。

## 拒绝的做法

- **不让面板自己数调用次数**：两边各算一遍就会有两个真相（这正是 1.0.7 会话串数据的教训）。
- **不做"剩余 token"估算**：拿不到 token 计数，估出来的数字会被当真。
- **不发遥测**：`plugin.json` 没有网络权限，偷偷加一个通道就是背弃安装时给用户的承诺。
- **不做"有新版本可用"的假提示**：不联网就不知道；声称知道就是编。

## 验证

`test/session-state.test.ts`（9 项）：额度计数与拒绝、`0` 视为不限、统计文件不含内容、
历史从文件推导且空目录不抛、新鲜度读盖章并**不**出现"有新版本"这类它无法知道的措辞。
`test/team-roster.test.ts`（7 项）覆盖花名册与署名对账。
