---
name: dbx-pro
alias: 数据库工作台
description: 企业级数据库工作台 — 连接 PostgreSQL/MySQL/SQLite/ClickHouse 等 60+ 数据库，SQL 编辑器 + 结果网格 + AI 可视化（看板/大屏）。
version: 0.0.107
---

# 数据库工作台 — dbx-pro

企业级数据库连接管理 + SQL 编辑器 + AI 驱动的可视化生成。

## 核心能力

### 1. 数据库操作（dbx MCP 提供）

| 工具 | 说明 |
|------|------|
| `dbx_execute_query` | 执行 SQL 查询 |
| `dbx_describe_table` | 查看表结构（列/类型/主键） |
| `dbx_list_tables` | 列出连接下的表 |
| `dbx_list_connections` | 列出已配置的连接 |

### 2. 可视化生成（dbx-pro 插件工具 + 宿主 chart-renderer）

看板/大屏生成采用**两阶段工作流**：

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

### 3. 聚合 SQL 最佳实践

引擎单次查询硬上限 1000 行，**明细查询会被截断**。必须写聚合 SQL：

```sql
✅ 正确（聚合查询，天然少行不截断）：
SELECT category, SUM(amount) AS total FROM orders GROUP BY category;
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt FROM orders GROUP BY month;
SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status;

❌ 错误（明细查询，只返回前 1000 行）：
SELECT * FROM orders;
SELECT * FROM orders LIMIT 1000;
```

### 4. 完整工作流示例

用户："帮我看看各渠道月度销售趋势，生成一个看板"

```
Agent 工作流：
1. dbx_describe_table(connection="prod", table="orders")  → 了解列结构
2. dbx_execute_query("SELECT DATE_TRUNC('month', created_at) AS month, channel, SUM(amount) AS total FROM orders WHERE created_at BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY month, channel ORDER BY month")
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

## 与 v0.0.102 的架构区别（重要）

**本技能已重构**，不再使用旧的模板系统（dbx_dashboard / dbx_screen 工具 + 内联 SQL 模板 + Canvas 规则引擎）。新架构：

| 维度 | 旧架构（已删） | 新架构（当前） |
|------|---------------|---------------|
| SQL 执行 | 插件内部执行 | **宿主 Agent 自己写 + dbx MCP** |
| 图表渲染 | 插件 Canvas + recharts | **宿主 Chart.js（chart-renderer）+ 插件打包 HTML** |
| 模板 | 6 套预设模板 | **无模板 — 全由 Agent 自行编排** |
| 持久化 | 插件 store | **插件 store（不变）** |
| 二次编辑 | Canvas 规则引擎 | **chartItems 暴露给 Agent 重跑** |

## 安全准则

- **只读优先** — 看板/大屏生成只读，不产生写操作
- **聚合查询** — 必须 GROUP BY，避免明细行截断
- **结果上限** — 单次查询 1000 行上限，聚合查询通常远小于此
- **敏感信息** — SQL 中不暴露密码、连接字符串
