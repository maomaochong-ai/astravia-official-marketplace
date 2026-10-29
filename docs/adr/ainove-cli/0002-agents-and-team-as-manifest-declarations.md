# ADR 0002：多智能体用清单声明（agent.agents / agent.teams），不在运行时动态注册

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright/plugin.json`
- 依据：[plugin-sdk manifest.md → 贡献智能体与团队](../../../../../open-astravia/packages/plugins/plugin-sdk/docs/manifest.md)

## 1. 背景

需求是「多智能体小说写作」。宿主有两条看起来都能走的路：

1. **运行时**：`ctx.agent.registerTool` 注册工具，自己写一套 agent 循环（每个 Worker 一个
   prompt、自己调模型、自己串流程）。
2. **清单**：`plugin.json#agent.agents` 声明智能体、`agent.teams` 声明团队，由宿主铺进用户的
   智能体库与团队列表。

第 1 条要自己解决模型调用、上下文拼装、工具转发与错误恢复——等于在插件里重建一个 agent 运行时，
而这正是宿主已经有的东西。第 2 条把「人设」交给宿主，插件只负责**领域状态**与**确定性路由**。

## 2. 决策

用清单声明 **4 个智能体 + 1 支团队**，全部为本插件自有智能体（不用跨插件实体引用）：

| 智能体 id | 名称 | 对应上游 | 职责 | roles |
| --- | --- | --- | --- | --- |
| `novelwright-architect` | 架构师 | Architect | 定题、卷弧规划、章纲；产出 `plan` 产物 | `planner` |
| `novelwright-writer` | 执笔 | Writer | 按章纲写正文，受风格样本与既定事实约束 | `writer` |
| `novelwright-editor` | 主编 | Editor | 七维评审出必改项，判定章节能否提交 | `auditor` |
| `novelwright-arbiter` | 编纂 | Arbiter | 三次裁定：选题分歧、僵局出路、用户干预分诊 | `steward` |

团队 `novelwright-studio`，**队长是架构师**：宿主没有单独的 `captain` 字段，队长就是 `members[0]`
（且给了 `workflowPath` 时 `members[0].instructions` 必须留空，否则清单校验失败）。因此成员顺序
是接口的一部分，不能重排。writer / editor 的任务书用 `instructionsPath` 指向 `agent/briefs/*.md`，
与上游 `architect_context.go` / `editor_context.go` 里的角色约束逐条对齐；四名成员都用 `agent`
实体引用（缺省 `optional: false`），引用错了显式失败，而不是悄悄少一个角色。

由此 `pluginApiVersion` 必须为 `^2.3.0`（`members[].instructions` 的最低版本）——旧宿主会给出
「版本不支持」这种指向明确的错误，而不是静默少一项贡献。

## 3. 为什么不把 Worker 做成动态注册的「子 agent」

- 宿主已经提供 `@` 提及、团队会话、能力绑定与只读档案铺发。自己再实现一套，用户在界面上会看到
  两套并行的人格体系，改一处不生效另一处。
- 清单是**唯一真相源**：改人设 = 改 Markdown + bump 版本，升级后用户自动拿到。动态注册的
  prompt 藏在 `dist/` 里，用户既看不到也 diff 不了。
- 但**领域状态**绝不放进人设：智能体只拿「怎么想」，`NovelState` 一律通过工具读，避免两份事实。

## 4. 后果

- 用户在智能体中心会看到「著书匠」的四人阵容，可直接单聊架构师，也可进团队会话。
- 上游的「Worker 之间通过工具与事实通信」在本插件里变成「Worker 通过 `novelwright_*` 工具读写
  同一份作品状态」——通信介质从内存变成持久化事实，因此天然可续跑。
- 撤掉某个智能体等于从用户那里收回它；阵容调整随版本升级整体重铺，不需要迁移脚本。
