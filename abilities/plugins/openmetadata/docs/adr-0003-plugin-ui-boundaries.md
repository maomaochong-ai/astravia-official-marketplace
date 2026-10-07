# ADR-0003: 插件 UI 边界与组件设计

## 状态
已决策

## 背景
OpenMetadata 自带完整的 Web UI（`openmetadata-ui` Maven 模块 + React 前端），包含导航、仪表板、数据资产浏览、血缘图谱、Governance 工作流、摄取管线管理、Settings 等数十个页面。但用户的核心诉求是：**把 OM 做成插件 ≠ 重新实现 OM 原生 UI**。

本 ADR 定义插件侧 UI 的边界——做什么、不做什么，以及如何嵌入宿主 UI 框架。

## 约束
- **不得复刻 OpenMetadata 原生 UI**（导航、仪表板、Connectors、Governance Workflow 等一律不做）
- 插件 UI 必须使用宿主提供的 UI 组件库/设计 token，不引入新的设计风格
- 插件 UI 通过宿主的 Activity Tab 和 Workspace View 插槽嵌入
- 血缘可视化如果从零实现成本过高，考虑引入轻量图谱库（reactflow 或 d3）
- 所有插件 UI 必须适配宿主浅色/深色主题

## 现状分析

### dbx-pro UI 结构（参考基线）
```
activity-tab "数据库"           → 连接浏览 + @ 选择器
workspace-view "数据库工作台"    → SQL 编辑器 + 查询网格 + 表信息 + 可视化
input-action "数据库"            → 快速打开 activity tab
```
dbx-pro 的 UI 重且深（包含完整 SQL 编辑器、查询执行、表结构详情），因为它替代了独立数据库客户端的功能。

### OM 原生 UI 规模
```
openmetadata-ui/
  src/components/  → 数百个组件
  src/pages/       → 20+ 个页面
  核心页面：
    - Landing Page (仪表板)
    - Explore (数据资产浏览)
    - Lineage (血缘图谱)
    - Glossary/Terms (术语管理)
    - Domains (数据域)
    - Data Quality (质量监控)
    - Connections/Ingestion (连接与摄取)
    - Settings (设置)
```
OM UI 代码量巨大，且包含大量业务逻辑（Connector 配置向导、Airflow DAG 管理、SSO 配置等），这些**完全不适合放进插件**。

### 插件 UI vs OM 原生 UI 定位差异

| 维度 | OpenMetadata 原生 UI | openmetadata 插件 UI |
|------|---------------------|---------------------|
| **定位** | 完整数据目录管理平台 | 宿主 AI Agent 的元数据上下文助手 |
| **使用者** | 数据工程师、数据治理团队日常工作 | AI Agent 辅助数据发现、理解、分析 |
| **核心场景** | 配置 Connector、运行摄取管线、审批 Governance Workflow | Agent 搜索表、看血缘、查数据质量 |
| **复杂度** | 高（完整 CRUD + 工作流） | 低（只读为主 + 轻量 CRUD） |

## 决策

### 1. 插件 UI 范围（做什么）

#### Activity Tab: 元数据浏览器（核心）
注册 activity tab `om-metadata-browser`，提供：

| 区域 | 功能 | 复杂度 |
|------|------|--------|
| **连接切换器** | 多 OM 实例列表 + 当前活跃连接 | 低 |
| **搜索栏** | 支持关键词搜索（search_metadata）和语义搜索（semantic_search） | 中 |
| **实体列表** | 搜索结果卡片网格，展示 name/type/owner/tier/tags | 低 |
| **实体详情面板** | 展示选中实体的完整详情（get_entity_details），包含列、主键、外键等 | 中 |
| **@ 注入按钮** | 点击表名后注入 `@om:table_fqn` 到宿主输入框 | 低 |

#### Activity Tab: 血缘查看器（辅助）
注册 activity tab `om-lineage-viewer`，提供：

| 功能 | 说明 |
|------|------|
| 血缘图谱 | 使用 reactflow 渲染表级血缘（上游 3 层 + 下游 3 层） |
| 节点交互 | 点击节点跳转到实体详情、拖拽调整布局 |
| 深度控制 | 滑块调整上游/下游遍历深度（1-10 层） |
| 列级血缘开关 | 高级模式展开列级映射 |
| 变换 SQL 查看 | 点击边展示 lineage 关联的 transformation SQL |

#### Activity Tab: 数据质量概览（辅助）
注册 activity tab `om-quality-overview`，提供：

| 功能 | 说明 |
|------|------|
| 失败测试列表 | 聚合展示当前用户关注资产的失败测试用例 |
| 测试状态筛选 | 按 Success/Failed/Aborted/Never Run 过滤 |
| 测试详情 | 点击查看测试定义、参数、最新运行结果 |
| 根因分析入口 | 一键触发 Agent 执行 root_cause_analysis |

#### Workspace View: 连接配置（设置）
注册 workspace-view `om-settings`，提供：

| 功能 | 说明 |
|------|------|
| OM 连接列表 | 已配置实例卡片列表 |
| 新增连接 | Server URL + API Token 表单 |
| 连接测试 | 配置保存前验证 URL 可达性和 Token 有效性 |
| 编辑/删除 | 修改已有连接、删除连接 |
| RDF 状态检测 | 显示 OM 实例的 RDF 服务是否启用（影响 L3 工具是否可用） |

#### Input Action
注册输入栏按钮 `om-at-picker-toggle`：
- 图标：OpenMetadata 风格的元数据标志
- 作用：快速打开 `om-metadata-browser` activity tab

### 2. 插件 UI 明确不做什么

| 功能 | 不做的原因 |
|------|-----------|
| **OM 导航栏 / 完整布局** | 宿主已有自己的导航系统，插件只嵌入 Activity Tab |
| **Connectors 配置向导** | 用户在 OM 原生 UI 配置 Connector，插件只管消费摄取后的元数据 |
| **摄取管线管理（Airflow DAG）** | 属于 OM 运维范畴，插件不涉及 |
| **Governance Workflow 审批** | 需要完整工作流引擎，插件无法承载 |
| **数据域（Domain）树形管理 UI** | 太复杂，Agent 通过工具即可创建和查询 |
| **Glossary/Term 管理 UI** | 同上，Agent 通过 om_create_entity + om_patch_entity 操作 |
| **仪表板 Landing Page** | OM 原生已有，插件不重复 |
| **Settings/SSO 配置** | 完全在 OM 原生 UI 完成 |
| **Profile/用户管理** | 宿主已有用户系统，不与 OM 用户系统耦合 |

### 3. UI 组件设计原则

#### 轻量组合式
- 每个 Activity Tab 是一个独立的、可卸载的组件
- 连接配置面板可以嵌入任何 tab 的右上角
- 实体详情面板可以从搜索结果或血缘图谱中独立打开

#### 宿主主题适配
- 所有颜色使用宿主 CSS 变量（`var(--background)`、`var(--foreground)` 等）
- 不引入自定义 CSS 主题变量
- 不导入 Tailwind preflight（避免全局样式污染）

#### 无自定义设计系统
- 尽量使用宿主提供的 UI 组件库（shadcn/ui 或类似）
- 只在血缘图谱可视化时引入 reactflow（dependencies 中的唯一额外 UI 库）
- 图标使用宿主图标集或内联 SVG

### 4. 目录结构

```
src/
  domain/
    om-connection.ts              // 连接配置类型定义
    om-connection-store.ts        // 连接存储（宿主托管）
    om-rest-client.ts             // REST API 基础客户端（fetch + auth）
    om-entity-types.ts            // OM 实体类型枚举和常量
  features/
    connection-config/
      components/
        connection-list.tsx
        connection-form.tsx
        connection-test-button.tsx
    metadata-browser/
      components/
        metadata-search-bar.tsx   // 搜索入口
        metadata-result-list.tsx  // 搜索结果网格
        entity-detail-panel.tsx   // 实体详情
        om-connection-switcher.tsx // 连接切换下拉
      hooks/
        use-om-search.ts          // 搜索 hook（关键词 + 语义）
        use-om-entity-detail.ts   // 详情 hook
    lineage-viewer/
      components/
        lineage-graph.tsx         // reactflow 图谱组件
        lineage-controls.tsx      // 深度/方向控制
        lineage-edge-sql-dialog.tsx // 变换 SQL 查看弹窗
    quality-overview/
      components/
        quality-summary-card.tsx  // 质量汇总卡片
        failing-test-list.tsx     // 失败测试列表
  shared/
    om-auth.ts                    // Token 管理
    om-errors.ts                  // 错误类型
```

## 后果

### 正面
- **范围收敛**：不做原生 UI → 开发量可控（估计 ~20 个组件，远少于复刻 OM UI 的 200+ 组件）
- **符合插件定位**：插件是宿主 AI Agent 的辅助工具，不是独立应用
- **不与 OM 原生 UI 竞争**：用户该用 OM UI 的场景继续用 OM UI，插件补足 AI 辅助场景
- **维护成本低**：OM 升级 UI 不影响插件，插件只关心稳定的 REST API

### 负面
- **体验不如原生 UI 完整**：复杂治理场景（Domain 审批、Glossary 术语树管理）需要跳回 OM 原生 UI
- **血缘图谱实现成本**：reactflow 虽然轻量，但要实现 OM 原生的交互式血缘体验仍需不少工作

### 风险
- OM REST API 的某些字段可能只在 UI 侧使用，API 返回的裁剪版本可能不足以渲染完整详情——需要逐个验证
- 血缘图谱如果实现过于简化，可能无法满足"二次编辑"场景（如 Agent 发现血缘缺失后需要手动补）

## 参考
- OpenMetadata UI 仓库: `/Users/zhugeyue/Desktop/project/bigdate/source-code/OpenMetadata-main/openmetadata-ui/`
- dbx-pro UI 目录: `abilities/plugins/dbx-pro/src/features/database-workspace/components/` — Activity Tab 模式参考
- xiaohongshu UI 目录: `abilities/plugins/xiaohongshu/src/features/` — 多 feature 组织方式参考
- reactflow 图谱库: https://reactflow.dev/
