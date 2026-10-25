# ADR-0007：让宿主 Agent 直接编排画布工作流——声明式 `apply_workflow`

## 状态

已接受（2026-10-25）。**扩充 ADR-0002 的工具集（16 → 18）**，不推翻其鉴权与操作契约。

## 背景

ADR-0002 已经确立了操控通道：MCP 工具 → shim → 画布 REST（`PATCH /api/canvas-projects/:id/operations`），并落地了 16 个工具（`server/boot.mjs:1425` 起）。实测 `tools/list` 返回的就是这 16 个。

但「自动搭一条完整工作流」用这 16 个工具去拼，会有三个具体问题：

1. **一次工作流 = 十几次工具调用**。每个节点一次 `add_node`、每条连线一次 `connect_nodes`。中间任何一步失败，画布上是半成品图，而 Agent 已经不知道自己在哪一步了。
2. **坐标得由 Agent 编**。`add_node` 要求 `position`，Agent 只能猜，出来的图节点重叠在一起，用户还得手动摆。
3. **每个节点的 `metadata` 形状不同**。18 种内置类型 + 动态插件节点，schema 各异；错一个字段就是后端 400，错误信息对 Agent 不可读。

## 决策

### 1. 编排入口仍然是 MCP，不新增 IPC

插件在 `plugin.json` 里已经声明了 `mcp` 服务（`open-ai-canvas`，`path: /mcp`），宿主 Agent 原生可见。新增能力就加工具，不引入第二套调用协议。这样「宿主控制已打开的画布」天然成立——不需要知道浏览器开了哪个页面，工具打到的是同一个服务实例。

### 2. 新增 `apply_workflow`：一次声明整张图

```jsonc
{
  "project_id": "<可选，默认当前项目>",
  "base_revision": 42,
  "workflow": {
    "nodes": [
      { "key": "prompt", "type": "text", "title": "剧本",
        "metadata": { "text": "…" } },
      { "key": "img", "type": "image", "title": "分镜 1",
        "metadata": { "model": "…" }, "depends_on": ["prompt"] }
    ],
    "edges": [
      { "from": "prompt", "to": "img", "kind": "data" }
    ]
  },
  "run": false
}
```

语义：

- **单请求、单 revision**。服务端内部把整张图编译成一个 `operations` 数组（`create_node`… / `create_connection`…），一次 `PATCH …/operations` 提交。要么整张图成立，要么一次都没落盘。
- **幂等**：`key` 与画布上已有节点的 `metadata.__key` 对齐。重复调用同一份 workflow，行为是 `patch_node` 而不是再建一份；这也是「同一个 Agent 重试」不会把画布塞满重复节点的原因。
- **自动布局**：`position` 缺省时按 `depends_on` 的拓扑层级做分层排布（列 = 深度，行 = 同层序号，间距按节点默认尺寸算）。Agent 不该为人眼对齐负责。
- **提交前校验**：工具内部先对每个 `type` 跑一次 schema 检查（来自 `list_node_types` 的注册表），未知类型或缺失必填字段直接返回可读错误（`unknown_node_type: "video-gen"`），不发请求。
- **`run` 默认 false**。生成是要花钱的动作。即使 `run: true`，也只执行节点上显式标 `"run": true` 的那些——避免一句「搭一条 20 镜的分镜」就把 20 次付费生成打出去。

### 3. 新增 `export_workflow`：把画布读成同一份结构

`export_workflow(project_id)` 返回与 `apply_workflow` 入参**同构**的 `workflow`，于是「把这个画布的结构照搬到新画布」「Agent 先读现成模板再改」都成立，不需要另造一套表示。

### 4. 冲突与一致性

沿用 ADR-0002：写操作可带 `base_revision`，`get_canvas_state` 给当前 revision。`apply_workflow` 在 revision 不匹配时返回 `revision_conflict` 并附当前 revision，让 Agent 重新读一遍再提交——不静默覆盖用户正在编辑的图。

### 5. 可见性：Agent 做的每一步用户都能看见

- 工具返回值统一附 `canvas_url`（ADR-0002 已有 `withCanvasUrl`），用户点开就看到结果；
- 插件视图里保留一份「最近一次 `apply_workflow`」摘要（节点数/连线数/耗时/是否执行生成），失败时给后端原始 message；
- 不因为 Agent 操作而改动用户的视图状态（不抢焦点、不自动跳转）。

## 工具集全景（18 个）

| 组 | 工具 |
| --- | --- |
| 画布项目 | `list_canvas_projects` / `get_canvas_project` / `create_canvas_project` / `delete_canvas_project` |
| 节点 | `add_node` / `update_node` / `delete_node` / `list_node_types` / `get_node_schema` |
| 连线 | `connect_nodes` / `delete_connection` / `list_connections` |
| 生成与资源 | `run_generation` / `list_assets` / `get_canvas_state` |
| **编排** | **`apply_workflow`** / **`export_workflow`** |
| 逃生口 | `apply_operations` |

`apply_operations` 保留：上游加新节点类型、新操作时，插件不必跟着发版。

## 兼容和迁移

- 纯新增工具，不改变既有 16 个工具的入参/出参。
- 节点上的 `metadata.__key` 是本插件写入的标记；用户手动改节点不会清掉它，`export_workflow` 在缺失时按 `id` 生成临时 key。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 只用现有 `add_node` + `connect_nodes` 硬拼 | 十几次往返、半成品图、坐标靠猜（就是背景里的三个问题） |
| 在插件里内置固定模板（「三步分镜」之类） | 模板会过期，且把编排能力固定在插件作者想象里的几种 |
| 让 Agent 直接打画布 REST | 需要管理员会话与 CORS，Agent 拿不到；且绕过 MCP 就绕过了 ADR-0002 的鉴权收敛 |

## 验证

```bash
cd abilities/plugins/open-ai-canvas
node scripts/verify-workflow.mjs   # 18/18 通过（Observed）
npm run check                      # tsc
```

脚本不 import `compileWorkflow`——`server/boot.mjs` 是**单一自包含制品**（`plugin.json` 里就它一个文件），不能拆模块。因此它从源码里按括号配平取出 `BUILTIN_NODE_TYPES` / `codedError` / `compileWorkflow`，在 `vm` 里跑：测的是即将发布的那份字节，不是复制品。

| 断言 | 结果 |
| --- | --- |
| 三步线性 workflow 一次编译成 `create_node`×3 + `create_connection`×2 | Observed |
| 深度布局 0/1/2 且 x 单调（0 → 400 → 800） | Observed |
| 每个节点都盖 `metadata.__key`，返回 `key→id` 映射 | Observed |
| 未知类型 → `unknown_node_type`（不发请求） | Observed |
| 成环 → `workflow-cycle`；悬空边 → `workflow-invalid-edge`；空 → `workflow-empty`；重复 key → `workflow-invalid-node` | Observed |
| 同一 workflow 再 apply：只有 `patch_node`，连线不重复，id 稳定，标题可改 | Observed |
| 显式 `position` 不被自动布局覆盖 | Observed |
| 执行侧只认 `node.run === true`；工具数 18 | Observed（源码断言） |

插件视图也补了一处落点（决策 5 的可见性）：shim 在 `stateSnapshot().workflow` 里带出最近一次应用的节点数 / 连线数 / revision / 是否「按 key 重放」/ 触发了几次生成，视图渲染成「最近一次工作流」卡片。没有这一步，用户只能靠读会话记录判断 agent 到底做了什么。

**NOT RUN**：真实画布后端的接受度（节点 schema、`kind` 取值、`base_revision` 的真实冲突行为）只能在真实实例上确认；本地验证跑的是编译器本身与按 ADR-0002 契约写的断言。`revision_conflict` 的映射逻辑（409 → `revision_conflict`）属 **Assumed**，未被端到端触发过。
