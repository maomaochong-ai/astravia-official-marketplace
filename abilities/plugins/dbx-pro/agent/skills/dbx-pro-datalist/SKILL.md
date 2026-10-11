---
name: dbx-pro-datalist
description: >-
  数据列表生成器 —— jeecg-onlreport 对等实现，SQL 列表 + 动态筛选条件 + 分页输出。
  触发：用户说"数据列表/列表明细/筛选/filter/列表查询/分页列表"。
---

# dbx-pro-datalist —— 数据列表与筛选（jeecg-onlreport 对等）

## 触发条件

数据列表 / 列表明细 / 筛选条件 / filter / 列表查询 / 分页列表 / 结果列表。

## 核心流程

```
用户描述列表需求
  ↓
① 确认数据源（dbx MCP 直连）
  ↓
② 写 SQL（SELECT + WHERE 占位符）
  ↓
③ 定义筛选器参数（filter 数组：列名 / 操作符 / 默认值）
  ↓
④ POST /api/report/exec（复用 report-executor）
  ↓
⑤ server 端：SQL 执行 + 分页截断 + 返回 rows + columns
  ↓
⑥ 渲染为带筛选面板的 HTML 列表
```

## HTTP API

### POST /api/report/exec（已实现，复用 report-executor.mjs）

```json
{
  "connectionName": "香山数据库",
  "sql": "SELECT name, type, level, ts FROM logs WHERE level = ? AND ts >= ?",
  "maxRows": 200,
  "filters": [
    { "name": "level", "column": "level", "operator": "=", "default": "ERROR",
      "options": ["INFO", "WARN", "ERROR", "FATAL"] },
    { "name": "ts_from", "column": "ts", "operator": ">=", "default": "2026-10-01" }
  ],
  "paging": { "pageSize": 20, "page": 1 }
}
```

**响应**：
```json
{
  "columns": ["name", "type", "level", "ts"],
  "rows": [...],
  "total": 1523,
  "page": 1,
  "pageSize": 20
}
```

## 与 jeecg-onlreport 的差异

| 维度 | jeecg-onlreport | dbx-pro-datalist |
|---|---|---|
| 数据源 | JeecgBoot 在线表（cgform）| dbx MCP 直连 60+ 数据库 |
| 筛选器 | 数据库定义的字段组件 | SQL 参数占位符 + filter 数组 |
| 分页 | 后端物理分页（MyBatis）| 运行时 LIMIT + 前端补总数 |
| API | `/sys/list/queryPageList` | `/api/report/exec` |
| 持久化 | 数据库表 cg_report_head | 运行时编译，不持久化 |

## 服务端代码

| 文件 | 职责 |
|---|---|
| `server/src/engine/report-executor.mjs` | execReport + executeReportSql（参数化 SQL 执行）|
| `server/src/engine/sql-safety.mjs` | SQL 安全检查（select 白名单）|

## references/

| 文件 | 内容 |
|---|---|
| references/sql-patterns.md | 时间聚合 / 窗口函数 / 分组合计（与 dbx-pro 主 skill 共享）|
