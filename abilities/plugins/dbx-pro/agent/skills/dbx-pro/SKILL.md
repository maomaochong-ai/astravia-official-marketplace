---
name: dbx-pro
alias: 数据库工作台
description: 企业级数据库工作台 — 连接 PostgreSQL/MySQL/SQLite/ClickHouse 等 60+ 数据库，SQL 编辑器 + 结果网格 + AI 可视化（看板/大屏）。
version: 0.0.110
---

# 数据库工作台 — dbx-pro

企业级数据库连接管理 + SQL 编辑器 + AI 驱动的可视化生成。

## 核心能力

### 1. 数据库操作（dbx MCP 提供）

| 工具 | 说明 |
|------|------|
| `dbx_execute_query` | 执行 SQL 查询（单次最多 1000 行，适合快速试探） |
| `dbx_describe_table` | 查看表结构（列/类型/主键） |
| `dbx_list_tables` | 列出连接下的表 |
| `dbx_list_connections` | 列出已配置的连接 |

### 2. 完整查询（dbx-pro 插件工具 — 复用工作台分页能力）

| 工具 | 说明 |
|------|------|
| `dbx_query_full` | 完整查询（自动分页拼页，绕过 1000 行截断） |

dbx_query_full vs dbx MCP execute_query：

| 维度 | dbx MCP execute_query | dbx_query_full |
|------|----------------------|----------------|
| 行数上限 | 单次硬截断 1000 行 | 自动分页拼页直到 maxRows（默认 2000，可按需增大） |
| 实现 | 引擎单次请求 | 复用工作台 executeServerPage 分块循环 |
| 返回截断提示 | truncated: true | note: "Result truncated: N/M rows shown" |
| 适合场景 | 快速试探、查看少量数据 | 完整聚合数据（图表渲染前） |

### 3. 可视化生成（插件工具 + 宿主 chart-renderer）

看板/大屏生成采用两阶段工作流：

#### 阶段 1：试草图（宿主 render_chart）

宿主 chart-renderer 工具 `render_chart`：
- 输入：Chart.js 格式 `{ type, data: {labels, datasets}, options?, title?, height? }`
- 输出：对话气泡里 inline 显示 ChartCard（最多 4 图/次）
- 用途：Agent 快速试错，迭代图表类型和数据格式

#### 阶段 2：打包成页（插件 dbx_chart_collection）

dbx-pro 插件工具 `dbx_chart_collection`：
- 输入：`charts: ChartItem[]`（最多 12 个）+ `title` + `type: "dashboard"|"screen"` + 可选 `layout`
- 输出：完整 HTML 页面（Chart.js CDN + 自动 Grid 布局 + 主题）
  - `type=dashboard` → 浅色 QuickBI 风格
  - `type=screen` → 深色 DataV 风格 + 入场动画
- 自动持久化到插件 store + 打开 iframe 预览 tab

### 4. 聚合 SQL + 完整查询最佳实践

引擎单次查询硬上限 1000 行，但 dbx_query_full 能自动分页拼页拿完整数据。

```sql
✅ 正确（聚合查询，天然少行不截断）：
SELECT category, SUM(amount) AS total FROM orders GROUP BY category;
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt FROM orders GROUP BY month;

❌ 错误（明细查询，即使 dbx_query_full 也会拉大量行）：
SELECT * FROM orders;
```

### 5. 完整工作流示例

用户："帮我看看各渠道月度销售趋势，生成一个看板"

```
Agent 工作流：
1. dbx_describe_table(connection="prod", table="orders")  → 了解列结构
2. dbx_query_full(connectionName="prod",
    sql="SELECT DATE_TRUNC('month', created_at) AS month,
              channel, SUM(amount) AS total
         FROM orders
         WHERE created_at BETWEEN '2025-01-01' AND '2025-12-31'
         GROUP BY month, channel
         ORDER BY month",
    maxRows=2000)
   → 返回完整聚合数据 ✅（自动分页拼页，绕过 1000 行截断）
   → 如果返回 note 说 truncated，增大 maxRows 重跑
3. render_chart({ type: "line", data: {labels: [...], datasets: [...]}, title: "月度销售趋势" })
   → ChartCard 出现在对话气泡 ✅
4. render_chart({ type: "bar", data: {...}, title: "渠道分布" })
   → 又一个 ChartCard ✅
5. （可多次调 render_chart，每次最多 4 图）
6. dbx_chart_collection({
     charts: [chart1, chart2, chart3, chart4],
     type: "dashboard",
     title: "2025 销售看板"
   })
   → 插件自动生成 HTML → 持久化 → iframe 预览 tab 打开 ✅
```

## Chart.js 图表类型

宿主 render_chart 和 dbx_chart_collection 均支持 8 种 Chart.js 类型：

| type | 用途 | 典型场景 |
|------|------|----------|
| `line` | 折线图 | 趋势、时间序列 |
| `bar` | 柱状图 | 分类分布、排名 |
| `pie` | 饼图 | 占比、份额 |
| `doughnut` | 环形图 | 占比（带中心文字） |
| `polarArea` | 极区图 | 多维度雷达 |
| `radar` | 雷达图 | 多指标对比 |
| `scatter` | 散点图 | 两变量相关性 |
| `bubble` | 气泡图 | 三变量（x/y/radius）|

## 架构说明

本技能已从旧模板系统重构。新架构：

| 维度 | 旧架构（已删） | 新架构（当前） |
|------|---------------|---------------|
| SQL 执行 | 插件内部执行 + 内联模板 | **宿主 Agent 自己写 + dbx_query_full 完整查询** |
| 图表渲染 | 插件 Canvas 规则引擎 | **宿主 Chart.js（chart-renderer）+ 插件打包 HTML** |
| 模板 | 6 套预设模板 | **无模板 — 全由 Agent 自行编排** |
| 持久化 | 插件 store | **插件 store（不变）** |
| 二次编辑 | Canvas 规则引擎 | **chartItems 暴露给 Agent 重跑** |
| 完整数据 | ❌ 旧架构无此能力 | **✅ dbx_query_full 复用工作台分页拼页** |

## 安全准则

- **只读优先** — dbx_query_full 和看板/大屏生成都是 SELECT-only，不产生写操作
- **聚合查询** — 写 GROUP BY 聚合而非 SELECT * 明细
- **自适应行数** — dbx_query_full 返回 note 提示截断时，Agent 应增大 maxRows 重跑
- **敏感信息** — SQL 中不暴露密码、连接字符串
