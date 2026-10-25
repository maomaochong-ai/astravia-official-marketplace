# ADR-0001：以 Astravia 插件形式托管 open-ai-canvas 本地服务

## 状态

已接受（草案）。为将开源画布项目 open-ai-canvas 接入 Astravia 桌面端宿主制定技术路线。

> 部分修订：决策 1（运行时制品形态）与决策 8（产物打包与版本钉住）已由 [ADR-0003](./0003-service-runtime-distribution-and-cross-platform.md) 更新——shim 改为 `archive: "file"` 直接分发、全平台共用一份、载荷下载补断点续传。架构与 MCP 部分不变。

## 背景

open-ai-canvas（影策）是面向 AI 影视与短剧创作的工作台，由两部分组成：

- 后端：Go 1.25 + Gin + GORM，单进程可同时提供 API 与前端静态资源（通过 `CANVAS_STATIC_DIR` 环境变量），默认 SQLite 存储，健康端点 `/api/health/ready`，内置 `watchParentProcess` 孤儿看门狗。
  > 更正（2026-10-25）：静态承载只存在于 fork 分支，上游发布 tag 里没有。实际构建载荷用的是 tag，所以前端产物一直由 shim 自己发。见 [0008](./0008-frontend-hosting-in-shim.md)。
- 前端：Vite + React 19 SPA，构建产物为静态文件。

参考同仓库 `abilities/plugins/free-model-gateway` 的「自包含外置插件」模式：插件将上游服务运行时打包进 `public/*.zip`，通过 `plugin.json` 的 `providers.services[0]` 声明为 `host-node` 运行时；宿主以托管 Node 拉起服务，注入 `ASTRAVIA_SERVICE_PORT` 与 `ASTRAVIA_SERVICE_DATA_DIR`，健康检查通过即 ready；插件通过 `ctx.services.connection(SERVICE_ID)` 获取服务地址，再用 `ctx.ui.openExternal(baseUrl)` 在外部浏览器打开。

目标是把 open-ai-canvas 用同样的方式做成 Astravia 插件，使用户安装插件后即可在浏览器中打开本地画布，并能通过宿主智能体的 AI 能力与画布交互（搭建工作流、调用模型、管理项目等）。

## 决策

### 1. 运行时与启动契约：host-node + Node wrapper 拉起 Go 二进制

宿主当前插件服务运行时只支持 `kind: "host-node"`（仓库内四个有服务的插件均使用此类型），不支持直接声明原生可执行文件。画布后端是 Go 二进制，不能由 Node 直接运行。因此采用 **Node wrapper 模式**：

- 将各平台编译好的 `yingce-backend` 二进制随插件分发，作为 `host-node` service 的 artifact；
- service entry 是一个 `boot.mjs`，承担三件事：
  1. 用 `child_process.spawn` 拉起同目录下的 Go 二进制，把宿主注入的 `ASTRAVIA_SERVICE_PORT`、`ASTRAVIA_SERVICE_DATA_DIR` 映射为画布后端识别的环境变量：
     - `CANVAS_BACKEND_ADDR` = `:${ASTRAVIA_SERVICE_PORT}`
     - `CANVAS_BACKEND_DATA_DIR` = `${ASTRAVIA_SERVICE_DATA_DIR}`
     - `CANVAS_DATABASE_DRIVER` = `sqlite`（默认）
     - `CANVAS_CORS_ORIGINS` = `http://127.0.0.1:${ASTRAVIA_SERVICE_PORT},http://localhost:${ASTRAVIA_SERVICE_PORT}`
     - `CANVAS_EXIT_WITH_PARENT` = `true`，`CANVAS_PARENT_PID` = `process.pid`（复用画布已有的孤儿看门狗，宿主杀 Node 时 Go 进程随之退出）
     - `GIN_MODE` = `release`
  2. **承载 MCP Server**：`boot.mjs` 在另一个路径（如 `/mcp`）上启动一个轻量 MCP over HTTP 服务，把画布后端的 REST API 封装为 MCP tools（详见决策 5）。MCP 服务与 Go 后端共享同一个宿主分配的端口——通过在 `boot.mjs` 内起一个反向代理，把 `/mcp` 路由到 MCP handler、其余请求透传给 Go 后端；或者 MCP 服务监听独立端口，由 `boot.mjs` 协调。前者对 CORS 更友好，后者实现更简单，二选一，在实现阶段确定。
  3. 透传 Go 子进程的 stdout/stderr 到宿主服务日志，并在子进程退出时自身退出（宿主据此判定服务停止）。

不采用「用 Node 重写后端」或「把 Go 编译为 wasm 在 Node 里跑」——前者工作量巨大且失去上游同步能力，后者性能与兼容性不可控。也不采用「在 Go 后端新增 /mcp 路由」——那需要修改上游仓库并维护一个 Go MCP 库，而 Node 生态的 MCP SDK 更成熟，且 wrapper 本就是插件侧可控的代码，不依赖上游合入。

宿主当前插件服务运行时只支持 `kind: "host-node"`（仓库内四个有服务的插件均使用此类型），不支持直接声明原生可执行文件。画布后端是 Go 二进制，不能由 Node 直接运行。因此采用 **Node wrapper 模式**：

- 将各平台编译好的 `yingce-backend` 二进制随插件分发，作为 `host-node` service 的 artifact；
- service entry 是一个 `boot.mjs`，使用 `child_process.spawn` 拉起同目录下的 Go 二进制，并把宿主注入的 `ASTRAVIA_SERVICE_PORT`、`ASTRAVIA_SERVICE_DATA_DIR` 映射为画布后端识别的环境变量：
  - `CANVAS_BACKEND_ADDR` = `:${ASTRAVIA_SERVICE_PORT}`
  - `CANVAS_BACKEND_DATA_DIR` = `${ASTRAVIA_SERVICE_DATA_DIR}`
  - `CANVAS_DATABASE_DRIVER` = `sqlite`（默认）
  - `CANVAS_CORS_ORIGINS` = `http://127.0.0.1:${ASTRAVIA_SERVICE_PORT},http://localhost:${ASTRAVIA_SERVICE_PORT}`
  - `CANVAS_EXIT_WITH_PARENT` = `true`，`CANVAS_PARENT_PID` = `process.pid`（复用画布已有的孤儿看门狗，宿主杀 Node 时 Go 进程随之退出）
  - `GIN_MODE` = `release`
  - `CANVAS_NODE_BIN` = `process.execPath`（复用宿主的 Node.js，画布后端的 agent-runtime 需要 Node 进程，不重复下载）
  - `CANVAS_PI_RUNTIME_DIR` = 解压后的 `pi-runtime/` 绝对路径（pi 运行时随插件分发，见决策 3）
  - `CANVAS_RUNTIME_AUTO_INSTALL` = `false`（禁止后端自动下载 Node 或运行时，所有依赖随包分发）
  - `CANVAS_OFFICIAL_PLUGIN_DIR` = 解压后的 `plugin-packages/` 绝对路径（官方模型渠道插件包随插件分发，见决策 8）
  - `CANVAS_REGISTRATION_ENABLED` = `false`（注册由「首用户」机制控制，普通注册关闭）
  - `CANVAS_RUNTIME_AUTO_INSTALL` = `false`（禁止后端自动下载 Node 或运行时，所有依赖随包分发）
- `boot.mjs` 透传 Go 子进程的 stdout/stderr 到宿主服务日志，并在子进程退出时自身退出（宿主据此判定服务停止）。

不采用「用 Node 重写后端」或「把 Go 编译为 wasm 在 Node 里跑」——前者工作量巨大且失去上游同步能力，后者性能与兼容性不可控。

### 2. 前端静态资源：随包分发，由 Go 后端直接托管

画布后端已内置 `StaticSite` 能力（`CANVAS_STATIC_DIR`），可在同一端口同时承载 API 与前端 SPA，无需额外的 nginx/Vite dev server。因此：

- 插件构建时把 `web/dist/` 产物也打进 service zip（放在 `server/web-dist/` 目录）；
- `boot.mjs` 设置 `CANVAS_STATIC_DIR` 指向解压后的 `web-dist/` 绝对路径；
- 这样浏览器访问 `http://127.0.0.1:<port>/` 即拿到画布前端，所有 `/api/*` 请求同进程处理，无跨域、无反向代理。

不采用「Vite preview 单独起一个端口」或「前端由宿主内嵌 WebView 渲染」——前者需要两个服务进程与端口协调，后者需要改造前端以适配宿主沙箱且会丢失浏览器原生能力。

### 3. 画布内置 Agent 运行时（pi）：随包分发，复用宿主 Node

画布后端内置了一个 agent-runtime（`backend/agent-runtime/pi/`，入口 `agent-runtime.mjs`，约 242MB），用于画布内的 AI Agent 功能。后端有完整的供给机制，找不到 pi 运行时会直接报错。

- **pi 运行时随包分发**：插件构建时把 `backend/agent-runtime/pi/` 整个目录打进 service zip（`server/pi-runtime/`），`boot.mjs` 设置 `CANVAS_PI_RUNTIME_DIR` 指向解压后的路径；
- **Node.js 复用宿主**：`boot.mjs` 设置 `CANVAS_NODE_BIN = process.execPath`，画布后端直接用宿主的 Node 启动 agent-runtime，不重复下载；
- **禁止自动安装**：`CANVAS_RUNTIME_AUTO_INSTALL=false`，确保所有运行时依赖都随包分发，不依赖网络。

不采用「让后端按需下载 pi 运行时」——后端没有网络下载 pi 运行时的逻辑，且违背自包含理念。

### 4. 数据库与数据目录：SQLite，宿主数据目录隔离

画布后端默认 SQLite（CGO_ENABLED=1）。插件服务使用宿主分配的 `ASTRAVIA_SERVICE_DATA_DIR` 作为 `CANVAS_BACKEND_DATA_DIR`，数据库文件落在该目录内，与宿主其他数据隔离。

- 不使用 PostgreSQL/Redis：插件场景是单用户本地画布，SQLite 足够，且无需额外依赖；
- CGO 构建要求：Go 二进制必须带 cgo 构建（SQLite 驱动依赖），跨平台构建需要各自原生工具链（macOS 需要 Xcode CLT，Linux 需要 gcc，Windows 需要 MinGW 或 MSVC）。这是构建侧约束，不影响运行时契约。

### 5. 插件 UI 与生命周期：工作区视图 + autoStart

沿用 free-model-gateway 的控制器模式：

- 插件注册一个工作区视图（`ui.slot.workspace-view` 权限），展示服务状态、地址、启停按钮、日志；
- 默认 `autoStart: true`，激活后自动 `install → start → 等健康检查`；
- ready 后通过 `ctx.services.connection(SERVICE_ID).baseUrl` 拿到真实地址，在视图中展示「在浏览器中打开画布」按钮，调用 `ctx.ui.openExternal(baseUrl)`；
- 生命周期处理与 free-model-gateway 一致：模块级 `activeController` 防热重载误杀，`deactivate()` 空实现，cleanup 逐 activation 释放。

需要的权限：`ui.slot.workspace-view`、`storage.read`、`storage.write`、`shell.openExternal`。若后续要让宿主智能体直接调用画布 API，再加 `agent.mcp.control` 或注册 Agent 工具。

### 6. 画布的打开方式：外部浏览器与内置 webview 并存


画布启动后，插件提供两种打开方式，用户可在工作区视图中切换：

**外部浏览器**：调用 `ctx.ui.openExternal(baseUrl)`，需要 `shell.openExternal` 权限。用户获得原生浏览器的全部能力（扩展、开发者工具、File System Access API、WebCodecs 等），适合需要完整浏览器特性的场景。

**内置 webview**：在插件工作区视图内嵌入 Electron `<webview>` 标签，加载 `baseUrl`。参考同仓库 `build-apple-apps` 插件的 `SimulatorWebview.tsx` 实现模式：
- `src="about:blank"`，在 `dom-ready` 事件后通过 `loadURL(baseUrl)` 导航；
- 使用 `partition="persist:astravia-<plugin-slug>"` 持久化分区，记住用户在画布内的登录态与本地偏好；
- 站内导航不强制拉回首页，交给用户自由操作。

内置 webview 的价值是减少窗口切换——用户可以在 Astravia 宿主内直接操作画布，同时与对话中的智能体协作。两种方式共享同一个后端服务，数据实时同步（同一 SQLite 数据库）。

不采用 iframe——画布后端可能下发 `Content-Security-Policy: frame-ancestors 'none'`，且 iframe 不是独立顶层浏览上下文，部分浏览器原生 API（如 File System Access）不可用。webview 的 guest 是独立顶层上下文，不受这些限制。

两种打开方式的选择由用户在视图中显式触发（两个按钮），插件不自动决定。默认行为可在插件设置中配置（首次默认为内置 webview，因为减少切换是更常见的需求）。

### 7. 宿主智能体与画布的交互：通过 Node wrapper 暴露 MCP Server

用户希望「通过宿主智能体自身的 AI 能力和画布交互」。画布后端有完整的 REST API（项目、画布、节点、生成任务、模型渠道等）。交互能力分三层，按优先级递进：

**第 1 层（MVP）：浏览器打开画布 + 用户手动操作**

插件仅负责拉起服务并在浏览器打开。用户在浏览器中使用画布的全部功能。这与 free-model-gateway 的「打开管理界面」一致，是最低风险、最快落地的形态。宿主智能体不直接操作画布，但用户可以在画布内使用画布自己的 AI 能力（模型渠道、Agent 等）。

**第 2 层（推荐路径）：插件通过 Node wrapper 暴露 MCP Server**

由 `boot.mjs` 内的 MCP Server（决策 1 中 wrapper 的职责之一）把画布后端的 REST API 封装为 MCP tools，宿主智能体通过 MCP 协议调用画布：列出项目、创建画布、添加节点、提交生成任务等。这样用户可以在对话中说「帮我在画布里建一个新画布并放一个文生图节点」，智能体通过 MCP 工具完成。

**为什么走 Node wrapper 而不是在 Go 后端实现 MCP**：
- wrapper 是插件侧完全可控的代码，不依赖上游仓库合入 MCP 路由；
- MCP 工具的输入输出 schema 需要频繁迭代，用 TypeScript 维护比 Go 更敏捷；
- wrapper 可以在转发请求前做权限校验、请求合并、结果缓存，不侵入上游业务逻辑。

**MCP 实现方式：手写 JSON-RPC over HTTP，不引入 SDK**。参考同仓库更成熟的 `xiaohongshu` 与 `dbx-pro` 插件的实现——两者都没有用 `@modelcontextprotocol/sdk`，而是直接在服务的 HTTP 路由中实现 MCP 协议：
- 仅处理三个方法：`initialize`（返回 protocolVersion + capabilities）、`tools/list`（返回工具 schema 数组）、`tools/call`（分发到具体工具实现）；
- 工具 schema 用 TypeScript 类型 `{ name, description, inputSchema: { type: "object", properties, required? } }` 描述，与画布 REST API 的请求体一一对应；
- 工具级失败返回 `result: { isError: true, content: [{ type: "text", text: error.message }] }`，协议级失败（initialize / tools/list 抛错）才用 JSON-RPC error；
- 零依赖，避免把 SDK 及其依赖树打进 service zip。

不引入 SDK 的原因：宿主的 `agent.mcpServers` 配置（`type: "service"` + `serviceId` + `path: "/mcp"`）只需要简单的 JSON-RPC POST 响应，不需要 SSE / Streamable HTTP。画布的生成任务进度可以通过轮询 `get_generation_task` 工具实现，不一定需要流式推送。如果后续确实需要流式输出，再单独升级。
- Node 生态有成熟的 MCP SDK（`@modelcontextprotocol/sdk`），Go 侧缺乏同等成熟的官方实现；
- wrapper 是插件侧完全可控的代码，不依赖上游仓库合入 MCP 路由；
- MCP 工具的输入输出 schema 需要频繁迭代，用 TypeScript 维护比 Go 更敏捷；
- wrapper 可以在转发请求前做权限校验、请求合并、结果缓存，不侵入上游业务逻辑。

MCP 端点与 Go 后端共享同一个宿主分配的端口：在 `boot.mjs` 内起一个 HTTP 反向代理，承担三层路由：
1. `POST /mcp` → MCP JSON-RPC handler（手写，见上）；
2. 普通 HTTP 请求（`GET`/`POST`/`PUT`/`DELETE` 等，包括 SSE 的 `text/event-stream` 响应）→ 透传给 Go 后端；
3. WebSocket `Upgrade` 请求（画布实时协作 `/api/canvas-projects/:id/realtime`）→ 通过 `server.on('upgrade')` 拦截，用 `net` 模块建立到 Go 后端的 TCP 连接并双向 pipe，转发 upgrade 头和后续帧。

这样宿主只需连接一个端口，CORS 只需在 Go 后端配置一次，WebSocket 与 SSE 均可正常工作。Go 后端监听 `127.0.0.1:0`（系统分配随机端口），启动后输出 `backend listening addr=127.0.0.1:<port>` 到 stdout；`boot.mjs` 解析该行拿到端口，再启动反向代理转发。无竞态，端口一定可用。
- 宿主通过 `plugin.json` 的 `agent.mcpServers` 配置发现并连接 MCP：`{ "type": "service", "serviceId": "<service-id>", "path": "/mcp" }`，工具列表自动出现在智能体可用工具中，无需插件额外注册。

**MCP 工具的鉴权：反向代理捕获用户 session，MCP 调用时注入 cookie**

画布后端的所有业务 API 都通过 `open_ai_canvas_session` cookie 鉴权（`currentUser` → `sessionCookie`）。MCP 工具在 Node wrapper 中调用画布 REST API 时没有浏览器上下文，不会自动携带 cookie。

鉴权方案：
1. 用户首次打开画布（外部浏览器或内置 webview），在画布内完成注册/登录；画布有「首用户」机制（用户数为 0 时自动允许注册，不受 `CANVAS_REGISTRATION_ENABLED` 限制）；
2. 插件的反向代理在转发登录响应时，检测 `Set-Cookie: open_ai_canvas_session=<token>` 响应头，把 token 提取出来，加密存储到 `ASTRAVIA_SERVICE_DATA_DIR/session.json`；
3. MCP 工具调用画布 API 时，自动在请求头带上 `Cookie: open_ai_canvas_session=<token>`；
4. 若 API 返回 401（session 过期），MCP 工具返回 `isError: true` 并提示用户重新登录画布，插件视图同步显示「需要重新登录」状态。

这样数据归属正确（智能体操作用户的画布），且不需要用户手动复制 cookie。不采用服务账户方案（数据隔离，违背协作诉求），也不采用 API Token 方案（需要上游合入）。

MCP 工具的覆盖范围（按优先级）：
1. 画布 CRUD：列出项目、创建画布、获取画布内容、保存画布；
2. 节点操作：添加节点、删除节点、修改节点参数、连接节点；
3. 生成任务：提交文生图/图生视频等任务、查询任务状态、获取生成结果；
4. 模型渠道：列出可用模型、配置渠道密钥（仅本地存储，不外发）。


- 优点：复用宿主 MCP 基础设施，工具列表自动出现在智能体可用工具中，插件无需逐个注册；
- 代价：需要在 Node wrapper 中为画布 REST API 编写 MCP 适配层（工具数量取决于 API 粒度）。

**第 3 层（按需）：插件注册原生 Agent 工具**

插件通过 `ctx.agent.registerTool()` 直接注册工具，工具内部调用画布后端 API。比 MCP 更灵活（可组合多步操作、可访问插件状态），但与宿主 Agent 工具系统耦合更深。

本 ADR 决定：**第 1 层（浏览器打开画布）作为首发版本必须交付，同时提供内置 webview 选项**；**第 2 层（MCP Server via Node wrapper）作为首发版本的核心交互能力同步交付**——因为用户的核心诉求就是「通过宿主智能体与画布交互」，没有 MCP 这一诉求无法满足；第 3 层仅在 MCP 无法满足特定交互需求时才引入。

### 8. 产物打包与版本钉住

参考 free-model-gateway 的确定性 zip 机制：

- 插件构建脚本把以下内容打成确定性 zip（固定时间戳，sha256 可复现）：
  1. 各平台的 Go 后端二进制（`yingce-backend`，带 cgo 构建）
  2. 前端构建产物 `web/dist/`（由 Go 后端通过 `CANVAS_STATIC_DIR` 托管）
  3. 画布内置 agent-runtime（`backend/agent-runtime/pi/`，约 242MB）
  4. 官方模型渠道插件包（`plugin-packages/*.yingce-plugin`，共 107 个，约 294MB，画布调用外部模型 API 的实现，缺它画布不可用）
  5. `boot.mjs`（Node wrapper，反向代理 + MCP Server）
- `plugin.json` 的 `providers.services[0].runtime.platforms.*.artifacts[0].sha256` 与 zip 实际 sha256 严格一致，构建脚本带 `--check` 模式校验；
- 按平台分别打包：每个平台条目引用对应平台的 artifact，各自 sha256。Go 二进制是平台相关的，前端、pi 运行时和官方插件包是平台无关的但随每个平台 zip 分发（简化构建逻辑）。
- `boot.mjs` 额外设置 `CANVAS_OFFICIAL_PLUGIN_DIR` 指向解压后的 `plugin-packages/` 路径。


### 9. 安全与边界

- 服务只监听 `127.0.0.1`（`CANVAS_BACKEND_ADDR=:${PORT}` 实际绑定到宿主分配的回环端口），不暴露到局域网；
- CORS 只允许 `http://127.0.0.1:${PORT}` 与 `http://localhost:${PORT}`；
- 画布后端的 SSRF 防护（`CANVAS_ALLOW_PRIVATE_UPSTREAMS` 默认 false）保持开启；
- 注册默认关闭（`CANVAS_REGISTRATION_ENABLED=false`），首用户需通过本地初始化流程创建；
- 服务密钥、API Key 等敏感信息由画布后端自行管理在数据目录，插件不读取、不日志化；
- 不向外部网络发送任何数据（模型渠道调用除外，由用户在画布内配置）。

## 兼容和迁移

- 本插件是 open-ai-canvas 的新分发形态，不修改上游仓库的任何代码。MCP 适配层完全在插件侧的 Node wrapper 中实现，不向上游 Go 后端添加路由；
- 画布数据目录格式与上游完全一致，用户可以在插件模式与独立部署模式之间迁移（复制 `data/` 目录）；
- 插件版本与画布上游版本解耦：`plugin.json` 的 `version` 是插件自身版本，画布上游版本通过 zip 内的 `VERSION` 文件记录并在视图中展示；
- 宿主停止服务时发 SIGTERM 给 `boot.mjs`，`boot.mjs` 转发给 Go 子进程（`child.kill('SIGTERM')`），不设额外超时；Go 执行优雅关闭（HTTP Shutdown 30s + worker 等待 `CANVAS_SHUTDOWN_TIMEOUT`，生成任务中断后由持久化对账恢复）。Go 退出后 `boot.mjs` 随之退出。若宿主有自身的停止超时并强杀 `boot.mjs`，Go 进程因 `CANVAS_EXIT_WITH_PARENT` 检测到父进程死亡而自行退出，agent-runtime 由 Go 清理。

## 备选方案

- **用 Docker Compose 拉起画布**：要求用户本机安装 Docker，与 free-model-gateway 的「装完即用」体验相悖，且宿主无法管理容器生命周期；不采用。
- **前端内嵌到宿主 WebView（iframe）**：画布后端可能下发 `CSP: frame-ancestors 'none'`，且 iframe 不是独立顶层浏览上下文，部分浏览器原生 API 不可用；采用 `<webview>` 而非 iframe（见决策 5）。
- **只分发后端，前端走 CDN**：需要用户联网才能用画布，且前端与后端版本必须严格对齐；不采用（自包含是核心价值）。
- **把整个画布后端移植到 Node.js**：失去上游同步能力，工作量不可接受；不采用。
- **在 Go 后端实现 MCP 而非 Node wrapper**：Go 生态缺乏成熟的 MCP SDK，且需要向上游仓库提交 MCP 路由代码，维护与合入成本高；不采用。
- **第 3 层（原生 Agent 工具）作为首发**：与宿主 Agent 工具 API 深度耦合，且画布 API 数量多，首发维护成本高；仅作为后续增强。

## 验证

- 构建验证：各平台 Go 二进制带 cgo 构建成功，`web/dist/` 构建成功，`boot.mjs` + MCP server 模块通过 TypeScript 编译，zip 的 sha256 与 `plugin.json` 声明一致；
- 启动验证：插件激活后服务在 120s 内通过 `/api/health/ready` 健康检查（pi 运行时解压 + 数据库迁移 + Node 就绪），外部浏览器与内置 webview 两种方式打开 `http://127.0.0.1:<port>/` 均能正常加载画布 UI；
- 功能验证：在画布中创建项目、添加文生图节点、配置模型渠道并触发生成，确认后端 API、Worker、数据库均正常；
- 生命周期验证：停用插件后服务进程退出（无孤儿），重启宿主后服务能恢复并复用数据目录；
- MCP 验证：宿主智能体通过 MCP 工具成功列出画布项目、创建画布、添加节点、提交生成任务并查询结果；MCP 工具的输入输出 schema 符合画布 REST API 的实际契约；
