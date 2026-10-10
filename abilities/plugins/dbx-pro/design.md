# dbx-pro 插件设计文档

## 概述

dbx-pro 是一个数据库工作台插件，为 Astravia 平台提供完整的数据库管理能力。支持 100+ 种数据库类型，包括关系型数据库、NoSQL 数据库、分析型数据库等。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Astravia 宿主                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  dbx-pro 插件                          │   │
│  │  ┌────────────┐  ────────────┐  ┌────────────┐     │   │
│  │  │   UI 层    │  │  状态管理层  │  │  服务层    │     │   │
│  │  │  (React)   │  │ (Reducer)  │  │ (Engine)   │     │   │
│  │  └────────────┘  └────────────  └────────────┘     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │              领域层 (Domain)                  │   │   │
│  │  │  - 连接配置  - 查询历史  - 工作台设置         │   │   │
│  │  ──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    引擎服务 (Service)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HTTP Server → Router → MCP Client → dbx-engine      │   │
│  ──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
abilities/plugins/dbx-pro/
├── plugin.json              # 插件身份、权限、服务声明
├── ability.json             # 市场展示元数据
├── package.json             # 依赖管理
├── vite.config.ts           # 构建配置
├── src/
│   ├── index.tsx            # 插件装配入口
│   ├── runtime.ts           # 引擎生命周期管理
│   ├── runtime-contract.ts  # 宿主能力类型边界
│   ├── style.css            # 全局样式入口
│   ├── domain/              # 领域模型
│   │   ├── connection-config.ts    # 连接配置模型
│   │   ├── database-icons.ts       # 数据库图标映射
│   │   ├── database-type-visual.ts # 类型视觉标识
│   │   ├── dbx-storage.ts          # 连接配置仓储
│   │   ├── driver-tiers.ts         # 驱动档位
│   │   ├── query-history.ts        # 查询历史模型
│   │   ├── query-history-store.ts  # 历史持久化
│   │   ├── tree-node-key.ts        # 树节点身份
│   │   ├── workbench-session.ts    # 会话持久化
│   │   ├── workbench-settings.ts   # 设置模型
│   │   └── workbench-settings-store.ts # 设置持久化
│   ├── features/            # 功能模块
│   │   ├── database-workspace/     # 数据库工作台
│   │   │   ├── components/         # UI 组件
│   │   │   ├── hooks/              # 状态管理
│   │   │   ├── services/           # 服务适配
│   │   │   ├── state/              # 状态类型
│   │   │   └── styles/             # 功能样式
│   │   └── query-history/          # 查询历史
│   │       └── components/
│   ├── shared/              # 共享内容
│   │   ├── ai/              # AI 交互
│   │   ├── components/      # 通用组件
│   │   ├── services/        # 引擎客户端
│   │   └── styles/          # 通用样式
│   └── test/                # 测试文件
├── server/                  # 引擎服务
│   ├── main.mjs             # 服务入口
│   ├── src/                 # 服务源码
│   └── bin/                 # 平台二进制
── assets/                  # 静态资源
└── locales/                 # 国际化
```

## 核心功能

### 1. 连接管理

**功能描述**：管理数据库连接，支持 100+ 种数据库类型。

**实现要点**：
- 三步流程：选择类型 → 填写配置 → 测试连接
- 密码加密存储（宿主加密凭据库）
- 连接配置本地镜像（快速加载）
- 支持 schema 多选过滤

**关键文件**：
- `connection-editor-flow.tsx` - 连接编辑流程
- `connection-fields.tsx` - 连接字段表单
- `dbx-storage.ts` - 连接配置仓储

### 2. 查询工作台

**功能描述**：三栏式数据库工作台，提供 SQL 编辑、结果展示、连接树浏览。

**实现要点**：
- 左栏：连接树（懒加载、多选、拖拽）
- 中栏：SQL 编辑器 + 结果网格
- 右栏：查询历史 / 表属性

**关键文件**：
- `database-workspace.tsx` - 工作台主容器
- `split-layout.tsx` - 三栏布局
- `sql-editor.tsx` - SQL 编辑器
- `result-grid.tsx` - 结果网格

### 3. SQL 编辑器

**功能描述**：基于 CodeMirror 6 的 SQL 编辑器，支持语法高亮、自动补全、快捷键。

**实现要点**：
- 按数据库类型选择方言（PostgreSQL/MySQL/MSSQL/SQLite）
- 快捷键：Mod+Enter 执行、Mod+Z 撤销、Shift+Mod+Z 重做
- 多 tab 支持，每个 tab 独立编辑器实例

**关键文件**：
- `sql-editor.tsx` - 编辑器组件
- `tab-bar.tsx` - tab 栏

### 4. 结果网格

**功能描述**：查询结果展示，支持分页、排序、导出、单元格编辑。

**实现要点**：
- 双排工具栏：上排操作按钮 + 下排过滤控件
- 服务端分页（LIMIT/OFFSET）+ 客户端分页
- 多种导出格式：CSV、JSON、JSONL、Markdown、HTML
- 单元格双击编辑（内联/大文本编辑器）
- 表属性抽屉（列、索引、外键、触发器、约束、分区）

**关键文件**：
- `result-grid.tsx` - 结果网格
- `result-panel.tsx` - 结果面板
- `cell-editor.tsx` - 单元格编辑器
- `table-info-panel.tsx` - 表属性面板

### 5. 连接树

**功能描述**：树形结构展示数据库对象，支持懒加载、右键菜单、拖拽。

**实现要点**：
- 层级：连接 → Schema → 表 → 列
- 右键菜单：预览、生成 SQL、添加到 AI、复制等
- 拖拽支持：拖拽节点到宿主对话框
- 多选模式：批量选择作为 AI 上下文

**关键文件**：
- `connection-tree.tsx` - 连接树
- `connection-node.tsx` - 树节点

### 6. AI 集成

**功能描述**：与宿主 AI 能力集成，支持自然语言查询、智能分析。

**实现要点**：
- 添加到 AI：右键菜单快速发送上下文
- 提示词模板：数据分析领域常用模板
- AI 协助连接：自然语言描述生成连接配置

**关键文件**：
- `send-to-ai-dialog.tsx` - AI 对话框
- `ai-prompt-templates.ts` - 提示词模板
- `ai-assistant-panel.tsx` - AI 协助面板

### 7. 查询历史

**功能描述**：记录查询历史，支持重载、编辑、删除。

**实现要点**：
- 历史记录：SQL、耗时、行数、状态
- 操作：载入编辑器、重跑、编辑、删除、发送到 AI
- 上限管理：可配置历史条数上限

**关键文件**：
- `history-panel.tsx` - 历史面板
- `query-history.ts` - 历史模型
- `query-history-store.ts` - 历史持久化

### 8. 设置面板

**功能描述**：工作台配置，50+ 功能项，7 个分类。

**实现要点**：
- 编辑器基础设置
- SQL 执行设置
- 数据网格设置
- 结果集设置
- 侧边栏设置
- 导出设置
- 关于/数据管理

**关键文件**：
- `settings-panel.tsx` - 设置面板
- `workbench-settings.ts` - 设置模型

## 技术栈

### 前端
- **框架**：React 19
- **语言**：TypeScript
- **样式**：Tailwind CSS 4
- **图标**：Lucide Icons
- **编辑器**：CodeMirror 6
- **构建**：Vite 7 + Module Federation

### 后端（引擎服务）
- **运行时**：Node.js
- **协议**：HTTP + MCP (Model Context Protocol)
- **二进制**：Rust 编译的 dbx-engine

### 宿主集成
- **SDK**：@astravia-org/plugin-sdk
- **权限**：storage.read/write, agent.mcp.control, ui.slot.*
- **服务**：providers.services (引擎托管)

## 数据流

### 查询执行流程

```
用户输入 SQL
    ↓
SQL 编辑器 (sql-editor.tsx)
    ↓
runTabSql (use-workbench-execution.ts)
    ↓
engineExecuteByName (engine-client.ts)
    ↓
HTTP POST /query
    ↓
request-router.mjs
    ↓
dbx-mcp-client.mjs (MCP 调用)
    ↓
dbx-engine 二进制
    ↓
数据库驱动执行
    ↓
结果返回 → 结果网格展示
```

### 连接管理流程

```
用户新建连接
    ↓
连接编辑器 (connection-editor-flow.tsx)
    ↓
writeConfig (dbx-storage.ts)
    ↓
engineAddConnection (engine-client.ts)
    ↓
HTTP POST /connections
    ↓
dbx-engine 保存连接
    ↓
密码存入宿主加密凭据库
    ↓
本地镜像更新
```

## 性能优化

### 1. 懒加载
- 连接树节点按需加载
- 表属性面板按需展开
- 历史面板虚拟滚动

### 2. 缓存策略
- 树节点缓存（treeChildren Map）
- 列信息缓存（tabColumnsMap）
- 会话持久化（防抖 400ms）

### 3. 内存管理
- 编辑器实例按 tab 创建/销毁
- 结果网格分页加载
- 历史记录上限裁剪

### 4. 构建优化
- Module Federation 代码分割
- Vite ?url 资源内联
- Tree-shaking 未使用代码

## 安全设计

### 1. 密码管理
- 密码不存明文 JSON
- 使用宿主加密凭据库
- 历史镜像自动迁移

### 2. 写操作保护
- 只读连接硬拒绝写操作
- 写/DDL 需弹窗确认
- 生产连接额外强提示

### 3. 引擎隔离
- 引擎子进程零提权
- 写操作走自研驱动
- 网络请求白名单限制

## 测试策略

### 单元测试
- 领域模型测试（纯逻辑）
- 状态 reducer 测试
- 工具函数测试

### 集成测试
- 引擎服务端到端测试
- 插件激活/销毁测试
- 市场发布流程测试

### 测试命令
```bash
npm run check    # TypeScript 检查
npm run build    # 生产构建
npm test         # 运行测试
```

## 版本管理

### 语义化版本
- **Major**：破坏性变更（配置结构、API 契约）
- **Minor**：新功能（向后兼容）
- **Patch**：Bug 修复（向后兼容）

### 发布流程
1. 修改版本号（plugin.json、package.json、ability.json、marketplace.source.json）
2. 运行测试和构建
3. 提交代码
4. CI 自动发布到 GitHub Releases
5. gh-pages 自动更新市场索引

## 未来规划

### 短期（1-2 个月）
- [ ] 完善连接树层级（不同数据库显示不同层级）
- [ ] 添加更多 MCP 工具（索引、外键、触发器、约束、分区）
- [ ] 优化移动端适配

### 中期（3-6 个月）
- [ ] 支持更多数据库类型
- [x] 数据可视化（图表打包 + 看板/大屏）—— 见 ADR-0005、ADR-0007
- [x] BI 数据资产：数据集 / 筛选 / 重新取数 已在 `0.2.0` 交付；图表表现力 —— 漏斗 / 箱形图 / 指标卡 —— 已在 `0.3.0` 交付（桑基 / 词云 / 地图类评估后不实现）；轻量血缘（产物 → 源连接/表/SQL/生成时间 + 「谁还读了这张表」反查）已在 `0.4.0` 交付 —— 见 ADR-0009 与其实施方案
- [ ] 实现协作编辑功能

### 长期（6-12 个月）
- [ ] AI 智能查询优化
- [ ] 自动化数据治理
- [ ] 企业级权限管理

## 附录

### A. 支持的数据库类型

**关系型**：MySQL、PostgreSQL、MariaDB、SQLite、SQL Server、Oracle、DB2 等

**NoSQL**：MongoDB、Redis、Elasticsearch、Cassandra、Neo4j 等

**分析型**：ClickHouse、Snowflake、BigQuery、Doris、StarRocks 等

**云数据库**：Aurora、Redshift、BigQuery、Snowflake、Databricks 等

**国产数据库**：Kingbase、Dameng、GaussDB、OceanBase 等

### B. 快捷键列表

| 快捷键 | 功能 |
|--------|------|
| Mod+Enter | 执行 SQL |
| Mod+Z | 撤销 |
| Shift+Mod+Z / Ctrl+Y | 重做 |
| Enter | 编辑单元格 |
| 方向键 | 导航单元格 |
| Mod+C | 复制单元格 |
| Escape | 关闭弹窗 |

### C. 配置项列表

详见 `workbench-settings.ts` 和 `settings-panel.tsx`。

---

**文档版本**：1.0  
**最后更新**：2026-10-05  
**维护者**：dbx-pro 开发团队
