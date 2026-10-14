# ADR-0002: 问数（智能问数）—— 插件内 AI loop + 真取数后才落画布

## 状态

已接受。2026-10-15 确立。这是 dbx-pro 在 BI 首屏工作台（ADR-0001）之后的第二个决策文档，
落地「按阿里云 Quick BI Pro 智能问数优化 BI 工作流」这一需求。

---

## §1 背景与问题

改造前的工作台右栏第二条入口「让 AI 生成」是一个**空壳**：

- 弹窗只收两件事：一段自由文本 + 一个图型下拉（`bi-workspace.tsx` 的 `AiDialog`）。
- 点确认后走 `presetAi(chartKind)`：写死一条示例 SQL（`SELECT d, sum(gmv) ... FROM orders`），
  拼出 `source-sql` + 图表两个节点，**不连任何数据源**。
- 用户看到的两处文案自己承认了这点：「AI 后端未接入，已为你生成骨架节点」/「后端 AI 端点未接入，
  点确认会在画布预置数据源 + 图表节点骨架」。

也就是说：入口的名字承诺了「AI 生成」，实际交付的是一个看起来能跑、跑起来必然失败的骨架。
Quick BI 的智能问数（小Q问数）在这个位置交付的是另一件事：选数据集 → 说一句话 → 它自己去取数
→ 把 SQL、数据、图表、结论一起摆出来 → 结果可以接着往下用。

## §2 决策

把「让 AI 生成」改造成**问数面板**，链路如下：

```
选数据集(连接) → 自然语言提问 → 插件内 AI loop（ctx.ai.chat）
  → 模型调 run_sql（插件私有工具）→ 插件用 engineExecuteByName 真跑 SQL
  → 取数结果回灌给模型 → 模型给出：SQL + 一句解读 + 建议图型
  → 面板展示（SQL / 数据表 / 图表 / 解读，可换图、可追问）
  → 「加入画布」→ presetAsk(draft) → source-sql 节点 + 图表节点 + 一条连线
```

四条不可让步的约束：

1. **不编数据**：SQL 没真跑成功，就不给图表、不给结论。取数失败时面板显示错误原因，而非占位图。
2. **真 SQL 可见**：用户能看到最终执行的那条 SQL，并知道它命中了哪个数据集。
3. **落画布的 SQL 是真的**：`presetAsk` 写进节点的是这次真跑过的 SQL 与真实连接，不是示例语句。
4. **只改插件侧**：全部能力通过宿主已有插件契约获得，不改 `open-astravia` 宿主代码。

## §3 接口点

| 依赖 | 来源 | 说明 |
| --- | --- | --- |
| `ctx.ai.chat` | 宿主 renderer 插件上下文（无条件注入） | 按 `plugin.json` 的 `ai.complete` 权限在调用时校验 |
| `ai.complete` | `packages/plugins/plugin-sdk/src/permissions.ts` | 声明在 `plugin.json`；**属分发内容变更，必须递增插件版本**（`scripts/static-marketplace.mjs:171`） |
| `getAi()` | 本插件 `src/runtime-contract.ts` | 门面；无权限/宿主过旧时返回 `null`，调用方给明确提示而非抛权限异常 |
| `engineExecuteByName` | 本插件 `src/shared/services/engine-client.ts` | 唯一取数通道，只读参数（不传 `allowWrite`） |
| `engineListConnections` | 同上 | 面板的连接下拉数据源 |
| `resolveConnectionName` | `canvas/lib/connection-ref.ts` | 画布执行侧把节点里存的连接 id 解成引擎要的连接名 |
| `toCanvasKind` | `features/ask/ask-chart.ts` | 图型 → 画布节点 kind 的唯一映射点 |
| `handleCreateWithPreset` | `bi-workspace.tsx` | 与另外两条入口共用同一套「建页 → 预置 → 跳编辑器」 |

## §4 与 ADR-0001 §4「❌ 新增 Agent 工具」的关系（必须显式说明）

ADR-0001 §4 把「新增 Agent 工具」列为非目标。本决策**不违反**它，理由：

- `run_sql` 只是随 `ctx.ai.chat` 一起发给模型的**工具声明**，由插件内部的 loop
  （`features/ask/ask-loop.ts`）自己接收、自己执行、自己回灌 `role: "toolResult"`。
- 它**不注册进宿主工具名册**，宿主 Agent 看不到它，也不经过宿主的工具审批链路。
- 这套写法沿用宿主插件 `chinese-chess` 已验证的模式（插件私有 `make_move` 工具 + 内部 loop）。

因此 §4 的非目标仍然成立：**本插件没有向宿主新增任何 Agent 工具**。
若将来要把问数做成宿主可调用的工具，那是另一份 ADR，必须重新讨论 §4。

## §5 图型映射的坑（实测）

画布 `NODE_TEMPLATES` 有 `chart-line / chart-bar / chart-donut / chart-kpi / chart-funnel / chart-pie ...`，
但**没有 `chart-table`**；而 `node-graph.tsx` 的图表渲染器在不认识 kind 时会落到「默认画折线」分支。
所以把 `chart-table` 直接同名透传给节点，会把一张明细表画成一条**凭空的趋势线** ——
这正是本插件反复强调的「不能编」的反面案例。

处理：`toCanvasKind(chartKind)` 作为唯一映射点，`chart-table` 返回 `null`；
`presetAsk` 对 `null` 只落 `source-sql` 数据源节点（形态同 `presetSql`），不硬凑图表节点。
`src/test/ask/ask-canvas-kind.test.ts` 把两张表对起来跑，任一侧漂移都会红。

## §6 非目标

- ❌ 不做图表类型的自由 drag-to-configure（Quick BI 的图表配置面板不在本轮）。
- ❌ 不做同义词 / 业务口径的知识库（Quick BI 的「问数配置」），本轮只把表清单与字段喂进提示词。
- ❌ 不做结果落库（`visualization-store` 的 20 条上限不受影响）。
- ❌ 不给问数接入宿主 Agent，不新增宿主工具（见 §4）。
- ❌ 不改 `DatasetDialog` 既有的 `connectionId: ds?.name` 写法（历史包袱，单独一轮处理）。

## §7 验证

- `npx tsc --noEmit` 全插件通过。
- 问数模块单元测试 `src/test/ask/*.test.ts` 全绿（纯函数；`ctx.ai.chat` 用假 chat port 注入，
  不需要真实模型凭据，与 `chinese-chess` 的测试做法一致）。
- 跨模块契约测试 `ask-canvas-kind.test.ts`：问数落画布的 kind 必须存在于 `NODE_TEMPLATES`。

## §8 遗留

- 插件版本因 `ai.complete` 权限变更必须递增（分发内容变化），发布需用户授权。
- 面板与画布执行的两套连接引用语义不同（面板写 name、属性面板写 id），
  目前在 `AskDraft.connectionId` 一处汇合；后续可考虑统一。
