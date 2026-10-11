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

## references/

| 文件 | 内容 |
|---|---|
| references/cell-config.md | 单元格格式化与类型完整参考（format.js + 属性面板两套配置）|
| references/chart-canonical-configs.md | 各图表类型 Canonical 结构速查（避免 AI 生成错误结构）|
| references/chart-components.md | 图表与组件配置参考（imgList / barcodeList / qrcodeList / displayConfig / chartList 结构）|
| references/chart-echarts-props.md | ECharts 常用属性速查（UI 面板字段映射 / label / tooltip / 快速生成函数）|
| references/chart-echarts-templates.md | ECharts 配置模板（简化最小配置）|
| references/chart-types-quickref.md | 图表类型速查（系统名称 → chartType）|
| references/dataset-advanced-datasource.md | 数据集进阶：数据源管理 / JavaBean 数据集 / 查询已有数据集 |
| references/dataset-advanced-file.md | 数据集进阶：文件数据集（用户未提供文件时自动创建）|
| references/dataset-advanced-shared.md | 数据集进阶：主子表联动 + 共享数据集 |
| references/dataset-advanced.md | 数据集进阶参考（低频使用）|
| references/dataset-core.md | 数据集核心参考（高频：SQL / API / JSON 数据集完整参考）|
| references/dataset-types.md | 数据集类型与字段解析方式速查 |
| references/expressions.md | 积木报表表达式函数索引（Aviator 引擎，单元格公式）|
| references/fillform.md | 数据填报（fillForm）完整参考 |
| references/horizontal-grouping.md | 横向分组配置（groupRight 动态分组 + customGroup 自定义分组）|
| references/import-export.md | 报表导出接口（流程：按名称查报表 → 拿 id → 导出）|
| references/json-dataset-cells.md | JSON 数据集与单元格绑定完整参考 |
| references/loopblock-grouping.md | 分组合计与循环报表（loopBlockList）配置 |
| references/mastersub-report.md | 主子报表两种实现模式（套打式单条翻页 / 循环块式全量展开）|
| references/misc-config.md | 背景图（background）配置完整参考 |
| references/mock-apis.md | 官方示例 Mock API 数据集（http://api.jeecg.com/mock/26/）|
| references/multi-sheet.md | 多 Sheet 接口（最多 11 个）|
| references/pitfalls.md | 已知坑点速查（症状速查，先查症状再定位）|
| references/query-controls.md | 查询控件参考（类型 / 默认值 / 时间控件 / 下拉树 / 范围查询）|
| references/query-params.md | 查询条件配置（fieldList / paramList）和 jsonStr 顶层字段 |
| references/quick-ref.md | 速查手册（已迁移到 SKILL.md 常用配置速查节）|
| references/report-drilling.md | 报表钻取与联动（超链接配置 + 联动重渲染）|
| references/report-group.md | 报表组合（group API）：多报表聚合为组合报表 |
| references/styling.md | 样式规范（所有表格/图表必须带 border + 左侧留白）|
| references/troubleshooting.md | 报错排查流程（先检查模板 JSON）|
