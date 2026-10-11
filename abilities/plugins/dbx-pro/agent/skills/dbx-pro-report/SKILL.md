---
name: dbx-pro-report
description: 数据报表生成器 —— 参数化 SQL → 行列表 + 分组小计/合计 + 多级表头推断。触发：用户说"报表/导出/打印/列表数据"。
---

# dbx-pro-report —— 数据报表（dbx-pro 品牌化 jimureport）

## 触发条件

报表 / 导出 / 打印 / 列表数据 / 明细 / 汇总表 / 多级表头。

## 核心流程

```
用户描述 → 确认数据源 → 写 SQL + 参数定义 → POST /api/report/exec → 返回 rows + 分组合计 → 渲染 HTML 表格
```

## HTTP API

### POST /api/report/exec

```json
{
  "connectionName": "香山数据库",
  "sql": "SELECT department, quarter, SUM(revenue) as revenue FROM sales GROUP BY department, quarter",
  "maxRows": 1000,
  "options": {
    "groupBy": ["department", "quarter"],
    "totals": true
  }
}
```

**响应**：
```json
{
  "columns": ["department", "quarter", "revenue"],
  "rows": [...],       // 含小计/合计行（_isSubtotal / _isGrandTotal 标记）
  "groups": [...],
  "rowCount": 42
}
```

### POST /api/report/headers

多级表头推断（纯函数，不需要数据库连接）：
```json
{
  "columns": ["部门", "季度", "销售额", "成本"],
  "groupBy": ["部门", "季度"]
}
```

## 服务端代码

| 文件 | 职责 |
|---|---|
| `server/src/engine/report-executor.mjs` | execReport（分组）+ inferHeaderTree（多级表头）+ executeReportSql（参数化 SQL 执行）|
| `server/src/engine/sql-safety.mjs` | SQL 安全检查（select 白名单）|
| `server/src/engine/markdown-parser.mjs` | dbx-mcp 返回的 Markdown → JSON rows |

## scripts/

- `scripts/report-builder.mjs` —— Agent 侧 CLI（fetch `/api/report/exec` + 渲染 HTML 表格）

## 与 jimureport 的差异

| 维度 | jimureport | dbx-pro-report |
|---|---|---|
| 存储 | 数据库表 cg_report | 运行时编译，不持久化 |
| API | `/jmreport/report/exec` | `/api/report/exec` |
| 数据源 | JeecgBoot 在线表（cgform）| dbx MCP 直连 60+ 数据库 |
| 导出 | Excel/PDF（后端）| CSV（前端原生）|
| 多级表头 | 数据库定义 | 运行时推断 |
