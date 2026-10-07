# ADR-0001: 连接模型与认证架构

## 状态
已决策

## 背景
OpenMetadata 是一个重量级数据目录平台，包含 Java Dropwizard 服务、MySQL/PostgreSQL 元数据库、OpenSearch 搜索引擎、RDF 知识图谱和 MCP Server（OAuth 2.0 + 17 个工具）。其架构与 dbx-pro 的轻量 Node.js MCP 二进制截然不同——无法像 dbx-pro 那样将服务端打包进插件的 `providers.services` 中。

本 ADR 解决的核心问题是：**插件如何连接到用户已有的 OpenMetadata 实例**。

## 约束
- **不得修改宿主源码**（open-astravia）
- 仅通过插件 SDK 暴露的 `PluginContext` 门面交互
- OpenMetadata 实例由用户自行部署（Docker / Kubernetes），插件无法控制其版本和认证方式
- OpenMetadata MCP Server 已实现 OAuth 2.0 stateless transport，原生不支持 API Token 直连
- 插件需要支持同时连接多个 OpenMetadata 实例（类似 dbx-pro 多数据库连接）
- 连接凭据必须安全存储，不能明文写入 plugin.json 或前端代码

## 现状分析

### dbx-pro 连接模型（参考基线）
```
dbx-pro → providers.services.runtime (host-node 二进制)
       → 本地 HTTP Server → /mcp 端点
       → plugin.json agent.mcpServers.dbx-pro = { type: "service", serviceId }
```
dbx-pro 的 MCP 服务运行在插件进程内，无需网络连接和认证。

### 关键技术约束发现

**network.allowedHosts 是静态硬编码的**——所有现有插件（dbx-pro、cli-proxy-api、xiaohongshu）的 `plugin.json` 中 `allowedHosts` 只列 github.com 系列域名（用于下载 runtime 二进制），**不支持通配符或运行时动态添加**。用户的 OM 实例地址各不相同（`https://metadata.company.com`、`http://localhost:8585` 等），无法预声明。

**cli-proxy-api 和 dbx-pro 如何突破？** 它们都通过 `providers.services` 启动本地 Node.js 进程，该进程在宿主外独立运行，不受 plugin.json 的 `allowedHosts` 限制——可以自由 fetch 任何 URL。插件前端通过 `services.request`（而非 `network.fetch`）调用本地进程，由本地进程代发外部请求。

### OpenMetadata 可用连接方式

| 方式 | 描述 | 可行性 | 局限 |
|------|------|--------|------|
| **A. REST API + 本地代理进程** | 插件启动薄 Node.js HTTP Server（类似 dbx-pro 的 server/main.mjs），代理进程 fetch 用户 OM 实例 REST API | ✅ 可行 | 需要打包本地二进制，但体积小（仅 HTTP 代理层） |
| **B. 远程 MCP 客户端 + OAuth** | 插件直连 OM 的 `/mcp/*` 端点，走 OAuth 2.0 | ⚠️ 复杂 | OM MCP 仅支持 OAuth 2.0，API Token 场景不可行，且 allowedHosts 问题未解决 |
| **C. REST API 直连 + 宿主 fetch** | 假设宿主 `network.fetch` 不受 allowedHosts 硬限制 | ❌ 不确定 | 取决于宿主实现，风险高 |

### OAuth 2.0 vs API Token

| 维度 | OAuth 2.0 | API Token (JWT) |
|------|-----------|-----------------|
| OM MCP 原生支持 | ✅ 是（stateless transport） | ❌ 否（OM MCP 未实现 Bearer Token） |
| 用户配置复杂度 | 高（Authorization Code Flow 需要跳转） | 低（填 URL + Token 即可） |
| 适用场景 | 企业级 SSO 环境 | 个人/内部实例，Bot Token |
| 实现成本 | 需要插件内嵌 OAuth 回调处理 | 需要插件侧 MCP 代理层将 Bearer Token 转 OM REST 调用 |

## 决策

### 1. 连接模型：REST API + 薄本地代理进程

**插件启动一个薄 Node.js HTTP Server 作为网络代理层**，通过宿主 `providers.services` 启动（类似 dbx-pro 和 cli-proxy-api 的模式）。代理进程运行在宿主外独立进程中，**不受 `network.allowedHosts` 限制**，可以自由 fetch 任意 OM 实例 URL。

核心连接链路：
```
宿主 Agent → 插件注册的 MCP 工具 (om_*)
         → 插件侧 Tool Handler（运行在 renderer 进程）
         → ctx.services.request("/om-proxy/*", ...)
         → 本地 Node.js 代理进程
         → fetch 用户 OM 实例的 REST API /api/v1/* (Bearer Token)
         ← 结构化 JSON 响应
```

**为什么必须用本地代理？**
- 宿主 `network.fetch` 受 plugin.json 的 `allowedHosts` 硬限制，且 `allowedHosts` 不支持通配符或运行时动态添加
- 用户的 OM 实例地址不可预测（私有云、本地 Docker、公网 SaaS）
- 本地代理进程在 Node.js 环境中运行，可以自由发起到任何 URL 的 fetch 请求

代理进程职责**：
- 接收插件前端发来的 OM API 请求（路径映射、方法转发）
- 注入 Bearer Token 认证头
- 处理超时重试、错误格式化
- CORS 问题（代理进程发请求无浏览器 CORS 限制）
- **API 根路径修正**：OM REST API 使用 `/v1/*` 而非 `/api/v1/*`

**为什么选 REST API 而非 OM MCP 客户端？**
- OM 原生 MCP 仅支持 OAuth 2.0，API Token 场景下需要插件自己实现 MCP 客户端的 OAuth 流，复杂度高
- OM REST API (`/v1/*`) 覆盖了 MCP 暴露的所有 17 个工具能力，且原生支持 JWT/Bearer Token 认证
- 插件侧自行实现 MCP 工具 → REST API 的映射，更灵活（可以做参数校验、错误处理、结果裁剪）
- 代理进程非常薄（约 200-300 行代码），只做请求转发 + 认证注入，不做业务逻辑

### 2. 认证架构：API Token 为主 + 预留 OAuth 扩展

**P0（首版）：API Token / JWT 认证**
- 用户在插件 UI 中填写：Server URL + API Token（JWT）
- 插件将 Token 存入宿主托管的插件私有存储（`~/.astravia/plugin-data/openmetadata/connections.json`）
- 每次请求时在 HTTP Header 中携带 `Authorization: Bearer <token>`
- Token 过期时插件 UI 提示用户更新

**P1（后续）：OAuth 2.0 支持**
- 对于开启 SSO 的 OM 实例，支持 Authorization Code Flow
- 插件内嵌一个临时 HTTP Server 处理回调（类似 xiaohongshu 的 QR 登录模式）
- 从 OM 的 `.well-known/openid-configuration` 发现端点
- Token 刷新逻辑由插件侧维护

### 3. 多连接支持

参考 dbx-pro 的多数据库连接模式，支持配置多个 OM 实例：
```json
// connections.json (宿主托管存储)
[
  {
    "id": "prod-om",
    "name": "生产元数据中心",
    "serverUrl": "https://metadata.company.com",
    "authType": "api-token",
    "token": "eyJhbGci...（加密存储）",
    "version": "1.13.0"
  },
  {
    "id": "staging-om",
    "name": "测试环境",
    "serverUrl": "https://staging-metadata.company.com",
    "authType": "api-token",
    "token": "..."
  }
]
```

当前活跃连接由插件 UI 中的连接切换器决定，所有 MCP 工具调用均针对活跃连接。

### 4. plugin.json 声明

```json
{
  "permissions": [
    "agent.mcp.control",
    "agent.toolHandler.execute",
    "agent.skills.control",
    "storage.read",
    "storage.write",
    "network.fetch",
    "ui.slot.activity-tab",
    "ui.slot.workspace-view",
    "ui.slot.input-action"
  ],
  "network": {
    "allowedHosts": [
      "github.com",
      "release-assets.githubusercontent.com",
      "objects.githubusercontent.com"
    ]
  },
  "providers": {
    "services": [
      {
        "id": "om-proxy",
        "runtime": {
          "kind": "host-node",
          "version": "0.1.0",
          "entry": "server/main.mjs",
          "platforms": {
            "darwin-arm64": { "executable": "server/bin/om-proxy-darwin-arm64" },
            "darwin-x64":   { "executable": "server/bin/om-proxy-darwin-x64" },
            "win32-x64":    { "executable": "server/bin/om-proxy-win-x64.exe" }
          }
        },
        "process": {
          "args": [
            "--port", "${ASTRAVIA_SERVICE_PORT}",
            "--connections-dir", "${ASTRAVIA_SERVICE_DATA_DIR}/connections"
          ]
        },
        "health": { "path": "/health", "timeoutMs": 30000 }
      }
    ]
  },
  "agent": {
    "skillPaths": ["agent/skills/openmetadata"]
  }
}
```

**注意：**
- `network.allowedHosts` 仅列 github.com 相关域名（用于下载代理进程二进制）
- 代理进程通过 `providers.services` 声明，运行时由宿主自动启动
- 代理进程从 `${ASTRAVIA_SERVICE_DATA_DIR}/connections` 读取连接配置（前端写入后代理进程自动读取）
- 代理进程不受 allowedHosts 限制，可以 fetch 用户 OM 实例的任意 URL

### 5. 凭据安全

- Token 存储在宿主托管的插件私有存储中，不写入 plugin.json、detail.json 或前端 bundle
- 读取时通过 `ctx.storage.read()` API，写入时通过 `ctx.storage.write()` API
- 不在 console.log 或 UI 中暴露 Token 值（配置面板中 Token 字段使用 password 类型）

## 后果

### 正面
- **网络自由度高**：代理进程不受 allowedHosts 限制，用户可连接任意 OM 实例
- **架构与同类插件一致**：与 dbx-pro、cli-proxy-api 的 services 代理模式对齐
- **零 OAuth 复杂度（P0）**：API Token 模式覆盖大多数场景，OAuth 2.0 后续扩展不破坏现有架构
- **可做能力裁剪**：插件侧决定暴露哪些 OM REST API 能力给 Agent，不必全量透传
- **符合开源插件原则**：用户自己部署 OM，插件只是消费其 API，不打包或修改 OM 源码

### 负面
- **需要打包本地代理进程**：虽然很薄（~200-300 行），但仍需跨平台编译打包（darwin-arm64/darwin-x64/win32-x64）
- **REST API 版本漂移风险**：OM 升级后 REST API 字段可能变化，需要适配

### 风险
- CORS 问题被代理进程天然解决（Node.js fetch 无浏览器限制）
- OM REST API 的某些端点可能与 MCP 工具不完全 1:1 对应，需要逐个比对

### 与 dbx-pro 的架构差异

| 维度 | dbx-pro | openmetadata |
|------|---------|-------------|
| 服务端定位 | 完整数据库查询引擎（SQL 执行、连接管理） | 薄 HTTP 代理层（请求转发 + 认证注入） |
| 二进制体积 | 较大（含数据库驱动） | 较小（仅 fetch + 路由） |
| 业务逻辑位置 | 代理进程内（SQL 安全检查、分页） | 插件前端（MCP 工具定义、错误处理） |
| 外部依赖 | 需要数据库驱动二进制 | 需要 Node.js runtime（宿主提供） |

### 待宿主支持的扩展点
| 扩展点 | 期望能力 | 优先级 |
|--------|---------|--------|
| `network.fetch` 动态 allowedHosts | 允许插件在运行时向宿主注册新的允许域名（用户填了新的 OM URL 后动态添加） | P1 |

## 参考
- OpenMetadata MCP Server: `/Users/zhugeyue/Desktop/project/bigdate/source-code/OpenMetadata-main/openmetadata-mcp/`
- OpenMetadata REST API: `/Users/zhugeyue/Desktop/project/bigdate/source-code/OpenMetadata-main/openmetadata-service/src/main/java/`
- dbx-pro plugin.json: `abilities/plugins/dbx-pro/plugin.json` — providers.services 本地进程模式参考
- xiaohongshu OAuth: `abilities/plugins/xiaohongshu/` — QR 登录模式参考（OAuth 回调处理）
- OM REST API 文档: https://docs.open-metadata.org/v1.13.x/swagger-api-docs
