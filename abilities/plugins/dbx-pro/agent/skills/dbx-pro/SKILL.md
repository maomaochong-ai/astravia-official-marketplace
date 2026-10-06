---
name: dbx-pro
alias: 数据库工作台
description: 企业级数据可视化 — 从数据库表生成看板和大屏。支持 3 套看板模板（KPI 总览/趋势分析/数据画像）和 3 套大屏模板（指挥中心/商业智能/系统监控）。工具内部执行 SQL 并返回完整 HTML 页面，可直接保存并在浏览器打开。基础数据库操作由 dbx MCP 提供。
version: 0.0.77
---

# 数据库工作台 — dbx-pro

通过 dbx-pro 数据库工作台实现企业级数据可视化。基础数据库操作由 dbx MCP 提供，本技能专注高阶可视化能力。

## 核心能力

### 1. 企业看板（dbx_dashboard）

根据数据库表生成企业级看板，预设 3 套模板：

**kpi_overview — KPI 总览**
- 核心指标卡片（总数/近7天新增）
- 趋势图（近30天）
- TOP 10 分布
- 最新数据表

**trend_analysis — 趋势分析**
- 日趋势/周趋势/月趋势
- 多维度时间序列

**data_profile — 数据画像**
- 总行数统计
- 样本数据预览

### 2. 数据大屏（dbx_screen）

根据数据库表生成全屏可视化大屏，预设 3 套模板：

**data_command — 数据指挥中心**
- 深色主题，适合投屏/会议室
- 核心指标 + 趋势 + 实时滚动

**business_intel — 商业智能大屏**
- 多维度业务分析
- 月度对比 + TOP 10 + 趋势

**monitoring — 系统监控大屏**
- 系统健康度
- 小时分布 + 最近事件

## 工具输出

工具内部执行 SQL 查询，返回完整 HTML 页面（包含数据和样式）。AI 需要：

1. 调用 `dbx_dashboard` 或 `dbx_screen` 获取 HTML 内容
2. 将 HTML 保存到临时文件（如 `/tmp/dashboard.html`）
3. 使用 `shell.openExternal` 在浏览器中打开

## 工作流程

### 从连接树生成可视化

1. **用户在连接树选择表** — 单选或多选
2. **发送到 AI 对话框** — 右键 → "可视化" → "生成企业看板/数据大屏"
3. **AI 调用工具** — 使用 `dbx_dashboard` 或 `dbx_screen`
4. **工具执行查询** — 内部通过引擎执行 SQL 获取数据
5. **返回 HTML** — 工具返回完整的 HTML 页面
6. **保存并打开** — AI 保存 HTML 文件并在浏览器打开

### 自然语言生成可视化

当用户说"帮我生成一个销售数据看板"时：

1. **确认数据源** — 询问使用哪个连接和表
2. **调用工具** — `dbx_dashboard(connection_name="mydb", tables=["sales"], template="kpi_overview")`
3. **保存 HTML** — 将返回的 html 字段写入文件
4. **打开浏览器** — 使用 `shell.openExternal` 打开文件

## 工具调用示例

### 生成 KPI 看板

```
用户：帮我看看 orders 表的核心指标
AI：
1. 调用 dbx_dashboard(connection_name="mydb", tables=["orders"], template="kpi_overview", date_column="order_date")
2. 将返回的 html 保存到 /tmp/dashboard.html
3. 使用 shell.openExternal 打开文件
```

### 生成数据大屏

```
用户：把 sales 表做成大屏展示
AI：
1. 调用 dbx_screen(connection_name="mydb", tables=["sales"], template="data_command", date_column="sale_date")
2. 将返回的 html 保存到 /tmp/screen.html
3. 使用 shell.openExternal 打开文件
```

## 与 dbx MCP 的协作

本技能依赖 dbx MCP 提供的基础能力：

| 能力 | 工具 | 说明 |
|------|------|------|
| 执行 SQL | `dbx_execute_query` | 基础查询（工具内部已使用） |
| 列出表 | `dbx_list_tables` | 获取连接下的表列表 |
| 查看结构 | `dbx_describe_table` | 获取表的列定义（工具内部已使用） |

本技能提供的高阶能力：

| 能力 | 工具 | 说明 |
|------|------|------|
| 企业看板 | `dbx_dashboard` | 内部执行 SQL，返回完整 HTML 看板 |
| 数据大屏 | `dbx_screen` | 内部执行 SQL，返回完整 HTML 大屏 |

## 安全准则

- **只读优先** — 看板/大屏只生成 SELECT 查询
- **结果限制** — 每个查询默认限制 1000 行
- **敏感信息** — 不在可视化中暴露密码、连接字符串等

## 输出格式

- **看板** — 响应式网格布局，KPI 卡片 + 图表 + 表格，浅色/深色主题
- **大屏** — 全屏深色主题，数字统计 + 动态图表 + 滚动表格，带动画效果
