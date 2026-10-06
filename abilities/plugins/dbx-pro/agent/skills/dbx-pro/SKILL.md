---
name: dbx-pro
alias: 数据库工作台
description: 企业级数据可视化 — 从数据库表生成看板和大屏。支持 3 套看板模板（KPI 总览/趋势分析/数据画像）和 3 套大屏模板（指挥中心/商业智能/系统监控）。基础数据库操作由 dbx MCP 提供。
version: 0.0.72
---

# 数据库工作台 — dbx-pro

通过 dbx-pro 数据库工作台实现企业级数据可视化。基础数据库操作（查询、表结构、执行计划）由 dbx MCP 提供，本技能专注高阶可视化能力。

## 核心能力

### 1. 企业看板（dbx_dashboard）

根据数据库表生成企业级看板，预设 3 套模板：

**kpi_overview — KPI 总览**
- 核心指标卡片（总数/新增/日均/最近更新）
- 趋势图（日/周/月）
- 分布图（TOP 20 分布）
- 最新数据表

**trend_analysis — 趋势分析**
- 多维度时间序列（日/周/月趋势）
- 同比环比对比
- 增长率分析

**data_profile — 数据画像**
- 统计摘要（行数/去重/重复率）
- 列统计分析
- 样本数据预览

### 2. 数据大屏（dbx_screen）

根据数据库表生成全屏可视化大屏，预设 3 套模板：

**data_command — 数据指挥中心**
- 深色主题，适合投屏/会议室
- 核心指标 + 趋势 + 分布 + 实时滚动
- 60 秒自动刷新

**business_intel — 商业智能大屏**
- 多维度业务分析
- 月度对比 + TOP 10 排行 + 趋势分析
- 120 秒自动刷新

**monitoring — 系统监控大屏**
- 系统健康度仪表盘
- 性能指标 + 告警统计 + 事件时间线
- 30 秒自动刷新

## 工作流程

### 从连接树生成可视化

1. **用户在连接树选择表** — 单选或多选
2. **发送到 AI 对话框** — 右键 → "发送到 AI" 或拖拽到输入框
3. **AI 分析表结构** — 使用 dbx MCP 的 `dbx_describe_table` 获取列信息
4. **选择模板** — AI 根据数据特征推荐模板，或用户指定
5. **生成可视化** — 调用 `dbx_dashboard` 或 `dbx_screen` 获取布局配置
6. **执行 SQL** — 使用 dbx MCP 的 `dbx_execute_query` 执行每个图表的 SQL
7. **渲染展示** — 组装为看板或大屏展示给用户

### 自然语言生成可视化

当用户说"帮我生成一个销售数据看板"时：

1. **确认数据源** — 询问使用哪个连接和表
2. **分析结构** — 使用 `dbx_describe_table` 了解列名和类型
3. **推荐模板** — 根据数据特征推荐合适的模板
4. **生成配置** — 调用 `dbx_dashboard` 生成看板配置
5. **执行查询** — 逐个执行 SQL 获取数据
6. **展示结果** — 渲染为交互式看板

## 工具调用示例

### 生成 KPI 看板

```
用户：帮我看看 orders 表的核心指标
AI：
1. dbx_describe_table(connection_name="mydb", operation="describe_table", table_name="orders")
2. dbx_dashboard(connection_name="mydb", tables=["orders"], template="kpi_overview", date_column="order_date")
3. 对每个 chart 执行 dbx_execute_query
4. 组装看板展示
```

### 生成数据大屏

```
用户：把 sales 表做成大屏展示
AI：
1. dbx_describe_table(connection_name="mydb", operation="describe_table", table_name="sales")
2. dbx_screen(connection_name="mydb", tables=["sales"], template="data_command", date_column="sale_date")
3. 对每个 widget 执行 dbx_execute_query
4. 渲染为全屏大屏
```

## 与 dbx MCP 的协作

本技能依赖 dbx MCP 提供的基础能力：

| 能力 | 工具 | 说明 |
|------|------|------|
| 执行 SQL | `dbx_execute_query` | 执行看板/大屏的每个图表 SQL |
| 列出表 | `dbx_list_tables` | 获取连接下的表列表 |
| 查看结构 | `dbx_describe_table` | 获取表的列定义，用于生成合适的 SQL |
| 列出 schema | `dbx_list_schemas` | 获取 schema 列表 |

本技能提供的高阶能力：

| 能力 | 工具 | 说明 |
|------|------|------|
| 企业看板 | `dbx_dashboard` | 生成看板布局和 SQL 计划 |
| 数据大屏 | `dbx_screen` | 生成大屏布局和 SQL 计划 |

## 安全准则

- **只读优先** — 看板/大屏只生成 SELECT 查询，不执行写操作
- **结果限制** — 每个图表 SQL 默认限制行数，避免大数据量卡顿
- **敏感信息** — 不在可视化中暴露密码、连接字符串等
- **生产环境** — 如果连接标记为生产环境，提醒用户注意查询性能

## 输出格式

- **看板** — 网格布局，包含 KPI 卡片、折线图、柱状图、饼图、表格
- **大屏** — 全屏深色主题，包含数字统计、仪表盘、滚动表格、动态图表
- **SQL 计划** — 每个图表对应的 SQL 查询，可由 AI 根据实际 dialect 调整
