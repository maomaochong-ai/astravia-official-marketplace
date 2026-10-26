# ADR-0002：画布 MCP 工具集、鉴权与操控能力边界

## 状态

已接受。在 [ADR-0001](./0001-open-ai-canvas-as-plugin.md) 确定的「Node wrapper 暴露 MCP Server」架构之上，细化 MCP 工具集的覆盖范围、鉴权生命周期、节点操作模型与生成任务触发方式。

> 落实核对（2026-10-26）：决策 1/3/5/7 早已实现；决策 2、4、6 的实现与文本有出入，已在各决策下补「落实」块；工具集从 16 增到 18（ADR-0007 增 `apply_workflow` / `export_workflow`）、再到 20（本次补 `list_workspace_projects` / `get_task`）。工具契约现在有脚本守住：`scripts/verify-mcp-tools.mjs`。

## 背景

ADR-0001 决策 7 确定了通过 `boot.mjs` 内的 MCP Server 封装画布 REST API，但未定义工具集的具体粒度、鉴权如何处理用户 session、节点 metadata 如何表达、生成任务如何异步返回。这些问题直接决定宿主智能体能在多大程度上「操控画布」而非仅「查看画布」。

经拷问对齐，确定以下事实与决策：

1. 画布项目通过 `PATCH /canvas-projects/:id/operations` 接受操作数组，操作类型包括 `create_canvas`、`create_node`、`patch_node`、`remove_node`、`create_connection`、`update_connection`、`remove_connection`、`set_field`。画布 ID 由客户端生成（UUID），首次 operations 请求中若第一个操作是 `create_canvas`，后端自动创建该画布项目。
2. 画布项目 API 路径为 `/api/canvas-projects`（不是 `/api/canvases`），独立于工作区项目 `/api/projects`。
3. 画布内置 18 种节点类型：`image`、`text`、`drawing`、`script`、`skill`、`config`、`video`、`audio`、`frame`、`markdown`、`svg`、`html`、`panorama`、`compare`、`chart`、`colorgrade`、`media-conversion`、`batch-table`，另支持插件动态注册节点。
4. 节点结构：`{ id, type, title, position:{x,y}, width, height, metadata }`，其中 `metadata` 因节点类型而异。
5. 生成任务通过 `POST /api/tasks` 提交，参数 `{ type, operation, prompt, provider, model, input }`，其中 `input` 由节点 config、provider channel、workflow、reference media 等复杂逻辑构造。
6. 画布所有业务 API 通过 `open_ai_canvas_session` cookie 鉴权。

## 决策

### 1. 操控能力边界：创作全控制（A 方案）

宿主智能体获得画布的完整操控能力，覆盖从项目管理到节点/连接 CRUD 到生成任务触发的闭环。工具集共 16 个，分五组：

**画布项目管理（4）**
- `list_canvas_projects` — 列出画布项目（`GET /api/canvas-projects`）
- `get_canvas_project` — 获取画布项目详情，含 nodes/connections payload（`GET /api/canvas-projects/:id`）
- `create_canvas_project` — 创建画布项目，canvas_id 可选（服务端默认生成 UUID），内部发送 `create_canvas` 操作
- `delete_canvas_project` — 删除画布项目（`DELETE /api/canvas-projects/:id`）

**节点操作（5）**
- `add_node` — 添加节点（`create_node` 操作），metadata 为自由 JSON
- `update_node` — 更新节点（`patch_node` 操作）
- `delete_node` — 删除节点（`remove_node` 操作）
- `list_node_types` — 列出可用节点类型（内置 18 种 + 运行时插件节点）
- `get_node_schema` — 获取某节点类型的 metadata 字段说明（运行时从画布后端或前端注册表提取）

**连接操作（3）**
- `connect_nodes` — 创建连接（`create_connection` 操作）
- `delete_connection` — 删除连接（`remove_connection` 操作）
- `list_connections` — 列出画布所有连接（从 `get_canvas_project` 返回的 payload 中提取）

**生成与资源（3）**
- `run_generation` — 触发节点生成，提交 `POST /api/tasks` 并轮询至完成或超时
- `list_assets` — 列出用户素材库资源
- `get_canvas_state` — 获取画布完整状态（revision + nodes + connections，便于智能体做冲突检测）

**批量操作（1）**
- `apply_operations` — 批量发送 `CanvasOperation[]`（高级逃生舱口，支持画布未来新增操作类型）

不采用「仅只读 + 创建项目」——那无法满足「操控画布」的核心诉求。也不采用为每种节点类型生成独立 MCP 工具（`add_image_node`、`add_text_node`…）——节点类型随画布版本变化，工具数量会膨胀且难以维护。

### 2. 节点 metadata：自由 JSON + 运行时 schema 发现

`add_node` 的 `metadata` 参数为任意 JSON 对象，不做强类型约束。智能体在调用前应先 `get_node_schema` 了解该节点类型所需字段。

理由：画布节点类型会随版本变化，插件节点是动态注册的，硬编码所有 metadata schema 到 MCP 层会导致每次画布升级都要同步 MCP 代码。`get_node_schema` 运行时从画布后端的节点注册表读取 schema，MCP 核心逻辑保持稳定。

> 落实（2026-10-26，0.1.4）：上游 `GET /api/agent/capabilities` 只回 `nodeTypes` 名单（`CloudAgentCapabilitySet{Nodes []string}`），**没有 per-type schema 接口**。所以 `list_node_types` 改成「内置清单 ∪ 后端自报清单」，并回 `discovered` 标记；`get_node_schema` 对内建类型给 `source: "builtin"`，对运行时节点诚实回 `available: false, registered: true, source: "runtime"`——“运行时发现”落实成了“运行时发现**存在**”，不是凭空造 schema。旧实现只读内置表却把 note 写成“运行时发现”，是自相矛盾的。

### 3. 画布 ID 生成：服务端默认 + 智能体可指定

`create_canvas_project` 接受可选 `canvas_id` 参数。若不指定，服务端用 `crypto.randomUUID()` 生成。智能体后续操作都用此 ID。

理由：画布 ID 是后续所有操作的 key，智能体需要明确知道它。默认服务端生成覆盖常见场景，可选指定支持确定性场景（如智能体想复用自己生成的 ID 做幂等）。

### 4. MCP 鉴权：session 捕获 + 过期自动引导

画布 session 通过 `open_ai_canvas_session` cookie 传递，由反向代理在登录响应的 `Set-Cookie` 中捕获并加密存储到 `ASTRAVIA_SERVICE_DATA_DIR/session.json`。MCP 调用时自动注入该 cookie。

**session 生命周期：**
- 用户首次打开画布（外部浏览器或内置 webview）并登录后，session 被捕获；
- 若 MCP 调用返回 401，清除本地 session，并在响应中提示「请先在浏览器中登录画布」；
- 插件 UI 同步显示「需要重新登录」状态，并自动打开画布登录页（方案 B：主动引导，而非仅被动提示）；
- session 过期后无 refresh token 机制（画布是 session cookie 模式），只能重新登录。

**用户切换：** 支持多用户/多 session。session 文件按用户 ID 分档存储，插件 UI 提供切换入口。切换用户时加载对应用户的 session，MCP 调用随之切换数据归属。

> 落实（2026-10-26，0.1.4）：加密这一半落地了，分档这一半**未做**。密钥走宿主的服务凭据机制（`plugin.json#providers.services[0].credentials: [{ id: "session-key", bytes: 32 }]` → 宿主生成 key 并以 `${ASTRAVIA_SERVICE_SECRET_SESSION_KEY}` 注入），`session.json` 用 AES-256-GCM 写（`{v:2, alg, iv, tag, data}`，0600），旧 `{v:1, token}` 明文读到就就地升级；没有密钥时（手工直跑 shim、验证脚本）退回 0600 明文，并在 `/__canvas/state` 的 `session.storage` 里如实标成 `plaintext`。401 会清 session，视图出现“需要登录画布 + 打开画布登录”一块。**多用户分档与切换入口有意未做**：上游是单 session cookie 模型，按用户分档需要产品决策（多账号在同一台机器上共享一个 SQLite，数据归属会变）。

### 5. 生成任务：同步等待 + 双结果返回

`run_generation` 工具内部轮询任务状态，默认超时 120 秒（可配置）。完成或超时后返回结果。

**返回形式：** 同时返回 `task_id`、`status`、`result_url`（可直接在对话中展示的资源 URL）和 `resource_id`。智能体可直接用 `result_url` 展示生成内容，也可用 `resource_id` 做后续引用。

**实现深度（A 方案）：** `run_generation` 读取目标节点的 config（model、parameters），构造最小化的 `CreateTaskRequest`：
```json
{
  "type": "canvas_<mode>",
  "operation": "<mode>",
  "prompt": "<prompt>",
  "model": "<node.config.model>",
  "input": { "mode": "<mode>", "prompt": "<prompt>", "config": "<node.config>" }
}
```
其中 `<mode>` 从节点类型推断（image 节点 → `image`，text 节点 → `text`，video 节点 → `video`）。不支持 reference media 的复杂场景——此类场景由用户在浏览器中操作，或通过 `apply_operations` + 手动构造 `/api/tasks` 请求实现。

不采用「完整复刻前端 `backendGenerationTaskInput` 逻辑」——该逻辑涉及 provider channel、workflow、cost calculation 等，复制到 boot.mjs 成本过高且易随上游变化失效。

> 落实（2026-10-26，0.1.4）：超时分支以前让调用方 “Use get_task to check later”，而那个工具根本不存在；现在补上了 `get_task`（`GET /api/tasks/:id`，缺 `task_id` 直接拒）。`run_generation` 默认 120s、`timeout_seconds` 可配，其余同本文。

### 6. API 路径修正

画布项目 API 路径为 `/api/canvas-projects`，不是 `/api/canvases`。`list_canvases`（原指向 `/api/projects/:id/canvases`）不存在——画布项目是独立实体，不隶属于工作区项目。修正后：
- `list_canvas_projects` → `GET /api/canvas-projects`
- `get_canvas_project` → `GET /api/canvas-projects/:id`
- `create_canvas_project` → `PATCH /api/canvas-projects/:id/operations`（首操作 `create_canvas`）
- `delete_canvas_project` → `DELETE /api/canvas-projects/:id`

原 `list_projects`/`get_project`/`create_project` 指向工作区项目（`/api/projects`），与画布项目是两个独立概念，保留但重命名为 `list_workspace_projects` 等以避免混淆。

> 落实（2026-10-26，0.1.4）：只落了 `list_workspace_projects`（`GET /api/projects`）。上游没有单条项目详情路由（`project_core_routes.go` 只有 `GET /api/projects` 与 `POST /api/projects`），所以没有 `get_workspace_project`；也不造 `create_project`——建项目在当前交互里始终发生在画布内。

### 7. MCP 工具的冲突检测

画布操作接口支持 `baseRevision` 冲突检测。`get_canvas_state` 返回当前 revision，智能体在写操作时传入 `base_revision` 参数。若画布已被其他客户端修改（revision 不匹配），后端返回冲突错误，MCP 工具返回 `isError: true` 并提示智能体重新读取画布状态。

## 兼容和迁移

- 本 ADR 不修改 ADR-0001 的运行时架构，仅细化 MCP 层；
- MCP 工具名称与路径在插件版本内保持稳定，新增工具不影响已有工具；
- `get_node_schema` 的 schema 来源依赖画布后端的节点注册表端点；若后端未提供该端点，MCP 层内置 18 种内置节点的静态 schema 作为 fallback，插件节点的 schema 标注为「运行时发现不可用」。

## 备选方案

- **仅只读 + 创建项目（C 方案）**：无法满足「操控画布」核心诉求，不采用。
- **项目+画布+生成任务管理（B 方案，~10-12 工具）**：粒度适中但缺少节点/连接的细粒度操作，智能体无法精确构建画布结构，不采用。
- **为每种节点类型生成独立 MCP 工具**：工具数量随节点类型膨胀，维护成本高，不采用。
- **`run_generation` 完整复刻前端生成逻辑**：涉及 provider channel、workflow、cost calculation 等复杂逻辑，复制成本高且易失效，不采用。
- **生成任务立即返回 task_id 由智能体轮询（B 方案）**：浪费 token 且智能体易忘记轮询，不采用——用 `wait_for_task` 内部轮询替代。

## 验证

- 工具契约验证：**已经脚本化**为 `scripts/verify-mcp-tools.mjs`（41 条断言，接入 `npm test`；把 `CANVAS_SHIM_UNDER_TEST` 指向旧 shim，它会 23/41 红而不是崩）：`initialize` 握手、`tools/list` 形状（20 个、名字唯一、`inputSchema.type === "object"`、`required` 键必须在 `properties` 里）、**每个工具都有 dispatch 分支**（空参数会死在真实校验上，但只要出现 `Unknown tool` 就说明清单和 switch 脱节）、未知工具/未知方法（-32601）/坏 JSON（-32700）的失败形状、无会话时工具拒绝调上游、v1 明文 session 升级为 v2 且解出的 token 真的进了上游 Cookie；
- 端到端验证：宿主智能体通过 MCP 工具完成「创建画布项目 → 添加 image 节点 → 连接 config 节点 → 触发生成 → 查询结果」闭环；
- 鉴权验证：未登录时 MCP 调用返回明确提示，登录后 session 被捕获，过期后自动引导重新登录；
- 冲突检测验证：并发修改同一画布时，revision 不匹配的操作返回冲突错误。
