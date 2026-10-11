---
name: dbx-pro
description: >-
  dbx-pro 插件主入口 skill —— 路由到 13 个功能子 skill。
  触发：用户提 BI/大屏/报表/图表/表单/代码生成/工作流/AI 编排等需求时，
  先判断属于哪个子域，再 delegate 到对应 dbx-pro-* skill。
version: 0.4.6
---

# dbx-pro —— 路由层（Router）

> **你正在读的是总入口。每个功能域有独立 skill，见下方路由表。**
> 本文件只做触发条件 + 子 skill 路由指引 + 工具清单 + 安全准则。
> 详细的组件列表 / API 签名 / pitfall 清单 / 行业模板等，请到对应子 skill 目录读它自己的 SKILL.md。

## 触发条件

凡是 dbx-pro 插件能做的事：大屏、报表、图表、仪表盘、数据列表、表单、代码生成、工作流、AI 编排、门户、字典查询、插件开发。

## 子 Skill 路由表

| 用户说 | → 子 Skill |
|---|---|
| "大屏/数据大屏/展厅/监控大屏" | **dbx-pro-bigscreen** |
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

| 端点 | 功能 | 鉴权 |
|---|---|---|
| POST /api/bigscreen/generate | spec → 完整 HTML 大屏 | ❌ 否 |
| POST /api/bigscreen/compile | spec → ECharts option（不生成 HTML）| ❌ 否 |
| GET /api/bigscreen/templates | 列出 6 个行业模板 | ❌ 否 |
| POST /api/report/exec | SQL → 行列表 + 分组合计 | ✅ 是 |
| POST /api/report/headers | columns + groupBy → 多级表头树 | ❌ 否 |
| GET /api/chart/graphTypes | 列出 12+ ECharts graphType | ❌ 否 |

## 工具清单（Astravia Agent 注册）

| 工具名 | 内部实现 | 用途 |
|---|---|---|
| `dbx_query_full` | dbx MCP | 执行 SQL 查询（零提权）|
| `dbx_chart_collection` | src/tools/dbx-chart-collection.ts | chartItem → ECharts option |
| `dbx_bigscreen_builder` | → server /api/bigscreen/generate | spec → HTML 大屏 |
| `dbx_report_builder` | → server /api/report/exec | SQL → 报表 |

## 安全准则（所有子 skill 通用）

1. **先确认数据源**：用户未指定时必须先问（mock / 数据库 / SQL），禁止编造虚假数据
2. **SQL 安全**：执行 SQL 必须走 dbx MCP + sql-safety.mjs 检查
3. **执行前 show tables**：确认表名正确，禁止幻觉表名
4. **写操作显式确认**：DDL / DML 需要用户显式确认（`allowWrite=true`）
5. **敏感数据脱敏**：返回给前端的 SQL 结果中若含 password / token / secret 列，必须标记

## 架构层次

```
Agent 调用 dbx-pro skill
  ↓ (路由到子 skill)
agent/skills/dbx-pro-*/scripts/*.mjs  ← Agent 侧 CLI（纯 Node.js + fetch）
  ↓ HTTP fetch
server/src/api/*.mjs                  ← HTTP API 路由
  ↓ import
server/src/engine/*.mjs               ← 核心业务逻辑（spec 编译 / SQL 执行 / mock 生成）
  ↓ dbx MCP stdio
dbx CLI 子进程                         ← 直连 60+ 种数据库
```

## 目录结构

```
agent/skills/
├── dbx-pro/                      ← 你正在读的入口（只做路由）
├── dbx-pro-bigscreen/            ← 大屏生成（完整执行层）
├── dbx-pro-dashboard/            ← 仪表盘（共享 bigscreen 编译链，亮色）
├── dbx-pro-report/               ← 报表（执行层：SQL + 分组）
├── dbx-pro-chart/                ← 图表类型注册表（轻量）
├── dbx-pro-datalist/             ← 数据列表（复用 report-executor）
├── dbx-pro-form/                 ← 表单设计（知识层）
├── dbx-pro-codegen/              ← SQL 脚手架（知识层）
├── dbx-pro-bpmn/                 ← 工作流（知识层）
├── dbx-pro-aiflow/               ← AI 编排（知识层）
├── dbx-pro-system/               ← 字典/角色（知识层）
├── dbx-pro-portal/               ← 门户布局（执行层，bigscreen 子集）
└── dbx-pro-dev/                  ← 插件开发工具（面向内部）

server/src/
├── engine/
│   ├── bigscreen-compiler.mjs    ← 28 handler + 6 palettes + 15 pitfall
│   ├── report-executor.mjs       ← 分组聚合 + 多级表头推断
│   ├── mock-data-generator.mjs   ← 6 种 mock 数据生成器
│   ├── dbx-mcp-client.mjs        ← dbx CLI 子进程管理
│   ├── sql-safety.mjs            ← SQL 安全检查
│   ├── templates/*.json          ← 6 个行业大屏模板
│   └── request-router.mjs        ← 统一路由（含 /api/bigscreen/* /api/report/*）
└── api/
    └── bigscreen-api.mjs         ← 独立 API 模块（可选，与 request-router 互补）
```
