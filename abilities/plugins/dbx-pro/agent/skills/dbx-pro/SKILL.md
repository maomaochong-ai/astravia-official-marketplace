---
name: dbx-pro
description: >-
  dbx-pro 插件主入口 skill —— 路由到 13 个功能子 skill。
  触发：用户提 BI/大屏/报表/图表/表单/代码生成/工作流/AI 编排等需求时，
  先判断属于哪个子域，再 delegate 到对应 dbx-pro-* skill。
version: 0.4.15
---

# dbx-pro —— 路由层（Router）

> **你正在读的是总入口。每个功能域有独立 skill，见下方路由表。**
> 本文件只做触发条件 + 子 skill 路由指引 + 工具清单 + 安全准则。
> 详细的组件列表 / API 签名 / pitfall 清单 / 行业模板等，请到对应子 skill 目录读它自己的 SKILL.md。

## 触发条件

凡是 dbx-pro 插件能做的事：报表、图表、仪表盘、数据列表、表单、代码生成、工作流、AI 编排、门户、字典查询、插件开发。

## 子 Skill 路由表

| 用户说 | → 子 Skill |
|---|---|
| "大屏展示" | 看板编辑器（无独立子 skill）|
| "仪表盘/dashboard/工作台/看板" | **dbx-pro-dashboard** |
| "报表/导出/打印/多级表头" | **dbx-pro-report** |
| "图表/支持什么图/graphType" | **dbx-pro-chart** |
| "数据列表/明细/筛选条件" | **dbx-pro-datalist** |
| "表单/录入/控件/主从表" | **dbx-pro-form**（知识层）|
| "建表/生成 DDL/SQL 脚手架" | **dbx-pro-codegen**（知识层）|
| "流程/工作流/BPMN/审批" | **dbx-pro-bpmn**（知识层）|
| "AI 流程/编排/节点" | **dbx-pro-aiflow**（知识层）|
| "字典/角色/权限/系统配置" | **dbx-pro-system**（知识层）|
| "门户/首页布局" | **dbx-pro-portal** |
| "dbx-pro 开发/插件开发" | **dbx-pro-dev** |

## HTTP API 清单（server/src/api/ + request-router.mjs）

所有 API 端点都走 `POST /api/...` 或 `GET /api/...`，dbx-pro server 运行在 localhost。
⚠️ 旧的 `/api/bigscreen/generate` 已废弃，拆为 compile（返回 JSON）+ render（返回 HTML）。

| 端点 | 功能 | 鉴权 |
|---|---|---|
| POST /api/bigscreen/compile | 紧凑 spec → JimuBI 组件 JSON | ❌ 否 |
| POST /api/bigscreen/render | 紧凑 spec → 完整 HTML 大屏 | ❌ 否 |
| GET  /api/bigscreen/templates | 列出 6 个内联模板（含完整 spec）| ❌ 否 |
| GET  /api/bigscreen/templates/:id | 按 id 查单模板 | ❌ 否 |
| POST /api/report/exec | SQL → 行列表 + 分组合计 | ✅ 是 |
| POST /api/report/headers | columns + groupBy → 多级表头树 | ❌ 否 |
| GET  /api/chart/graphTypes | 列出 12+ ECharts graphType | ❌ 否 |
| POST /api/form/{save,query,list,delete} | 表单 CRUD | ✅ 是 |
| POST /api/portal/{save,query,list,delete} | 门户布局 CRUD | ✅ 是 |
| POST /api/bpmn/{save,query,list,delete} | BPMN 工作流 CRUD | ✅ 是 |
| POST /api/codegen/{generate,list,save} | SQL 脚手架生成 | ✅ 是 |
| POST /api/system/{save,query,list,delete} | 字典/角色 CRUD | ✅ 是 |

## 工具清单（Astravia Agent 注册）

| 工具名 | 内部实现 | 用途 |
|---|---|---|
| `dbx_query_full` | dbx MCP | 执行 SQL 查询（零提权）|
| `dbx_chart_collection` | src/tools/dbx-chart-collection.ts | chartItem → ECharts option |

> ⚠️ `dbx_bigscreen_builder` / `dbx_report_builder` **不是 Agent 注册工具**，是子 skill 的 Python CLI 脚本（`scripts/spec_builder.py` → `fetch /api/bigscreen/compile`）。
> Agent 侧只调 MCP tool（查询），大屏/报表生成靠 skill Python 脚本走 HTTP 直连。

## 目录结构

```
agent/skills/
├── dbx-pro/                      ← 你正在读的入口（只做路由）
├── dbx-pro-bigscreen/            ← 大屏生成（完整执行层 + 19 Python 脚本 + 模板）
│   ├── scripts/spec_builder.py       ← 调 /api/bigscreen/compile|render
│   ├── scripts/comp_ops.py           ← 组件增删改
│   ├── scripts/dataset_ops.py        ← 数据集绑定
│   ├── scripts/datasource_ops.py     ← 数据源管理
│   ├── scripts/template_ops.py       ← 模板复制创建
│   └── references/
│       ├── templates/bigScreen/      ← 10 个上游 JimuBI 完整大屏（Python 用）
│       ├── templates/spec-templates/  ← 6 个引擎紧凑 spec 模板（server 内联用）
│       └── defaults/_defaults-bundle.json ← 125 个组件 defaults（server 内联用）
├── dbx-pro-dashboard/            ← 仪表盘（共享 bigscreen compile，亮色）
│   └── scripts/dashboard_builder.py  ← 调 /api/bigscreen/compile|render
├── dbx-pro-report/               ← 报表
├── dbx-pro-chart/                ← 图表类型注册表
├── dbx-pro-datalist/             ← 数据列表
├── dbx-pro-form/                 ← 表单设计（知识层）
├── dbx-pro-codegen/              ← SQL 脚手架（知识层）
├── dbx-pro-bpmn/                 ← 工作流（知识层）
├── dbx-pro-aiflow/               ← AI 编排（知识层）
├── dbx-pro-system/               ← 字典/角色（知识层）
├── dbx-pro-portal/               ← 门户布局（执行层）
└── dbx-pro-dev/                  ← 插件开发工具

server/src/
├── engine/
│   ├── bigscreen-compiler.mjs    ← 28 handler + 6 palettes + defaults bundle 内联
│   ├── report-executor.mjs       ← 分组聚合 + 多级表头推断
│   ├── mock-data-generator.mjs   ← 6 种 mock 数据生成器
│   ├── dbx-mcp-client.mjs        ← dbx CLI 子进程管理
│   ├── sql-safety.mjs            ← SQL 安全检查
│   └── request-router.mjs        ← 统一路由（13 组 /api/*）
└── api/
    ├── bigscreen.mjs             ← /api/bigscreen/{compile,render,templates,templates/:id}
    ├── report.mjs                ← /api/report/{exec,headers}
    ├── chart.mjs                 ← /api/chart/graphTypes
    ├── form/portal/bpmn/codegen/system.mjs ← CRUD 组
    └── ...
```
