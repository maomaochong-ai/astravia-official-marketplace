# OpenMetadata

Astravia 桌面插件工程。**先读手册再写代码**——不要凭记忆写 SDK API，这套合同变化很快。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ 宿主 Agent                                                   │
│   → om_search_metadata / om_get_entity_details / ...        │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 插件前端 (renderer 进程)                                     │
│   ctx.agent.registerTool() 注册 13+ 个 MCP 工具              │
│   ctx.services.request() → 调用本地代理进程                   │
│   ctx.ui.registerActivityTab() / registerInputAction()       │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 本地代理进程 (Node.js)                                       │
│   HTTP Server: /om-proxy/* → fetch {OM_URL}/v1/*            │
│   从 ASTRAVIA_SERVICE_DATA_DIR 读取连接配置                    │
│   注入 Bearer Token，不受 allowedHosts 限制                   │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 用户的 OpenMetadata 实例                                     │
│   /v1/* REST API (JWT/Bearer Token)                         │
│   可选: RDF 知识图谱 (影响 L3 工具是否启用)                  │
└─────────────────────────────────────────────────────────────┘
```

## 第一步：读设计文档

本插件的架构决策全部记录在 `docs/` 目录的 ADR 中，开工前先读一遍：

| ADR | 内容 |
|-----|------|
| ADR-0001 | 连接模型与认证架构（为什么需要本地代理进程） |
| ADR-0002 | MCP 工具暴露策略（L0-L3 分层） |
| ADR-0003 | 插件 UI 边界（不复刻 OM 原生 UI） |
| ADR-0004 | Agent Skill 与交互模式 |

## 第二步：装依赖，然后找到手册

```bash
npm install
npx astravia-plugin-cli docs
```

手册目录绝对路径会被打印出来。打开它：

| 顺序 | 文件 | 何时读 |
| --- | --- | --- |
| 1 | `README.md` | 总是先读 |
| 2 | `manifest.md` | 写/改 `plugin.json` 之前 |
| 3 | `permissions.md` | 选定权限列表之前 |
| 4 | `conversation-and-agent.md` | 注册 MCP 工具之前 |
| 5 | `mcp.md` | 宿主 MCP 服务端对接 |
| 6 | `getting-started.md` | 首次构建调试 |

## 开发闭环

```bash
npm run dev                 # Vite + Module Federation 开发服务器
npm run build               # 产出 dist/ + server/
npm run install:astravia    # 打包并装进正在运行的 Astravia
npx astravia-plugin-cli watch  # 开热更新
```

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Module Federation
- **插件 UI**: 宿主 @astravia-org/ui 组件库
- **图谱可视化**: reactflow（仅血缘查看器）
- **本地代理**: Node.js fetch + HTTP Server（无外部依赖）
- **工具注册**: `ctx.agent.registerTool()`（参考 astravia-tihu）

## 目录结构

```
plugins/openmetadata/
├── docs/                    # ADR 设计文档
├── agent/skills/openmetadata/   # Agent SKILL.md + references
├── server/                  # 本地代理进程（与 dbx-pro/server 结构一致）
│   ├── main.mjs
│   └── bin/                 # 跨平台二进制
├── src/
│   ├── domain/              # 类型定义、连接存储、REST 客户端
│   ├── features/
│   │   ├── connection-config/    # 连接配置面板
│   │   ├── metadata-browser/     # 元数据搜索浏览
│   │   ├── lineage-viewer/       # 血缘图谱
│   │   └── quality-overview/     # 数据质量概览
│   └── shared/              # Auth、错误处理等
├── locales/                 # i18n 中文/英文
├── assets/                  # 图标
└── plugin.json              # 插件元数据 + services 声明
```

## 不可违反的几条

- **禁止复刻 OpenMetadata 原生 UI**：导航、仪表板、Connectors 配置等一律不做
- **代理进程要薄**：只做请求转发 + 认证注入，不做业务逻辑
- **样式只用 Tailwind className**：禁止新建全局 CSS、禁止 style.css 里写 `button`/`div` 这类选择器
- **权限按需最小声明**：构建期校验产物用到的能力与 `plugin.json` 声明是否匹配
- **Token 绝对不写死**：必须通过宿主 storage.read/write API 读写
- **RDF 工具条件注册**：启动时检测 OM 实例的 RDF 是否启用，未启用时不注册 L3 工具
