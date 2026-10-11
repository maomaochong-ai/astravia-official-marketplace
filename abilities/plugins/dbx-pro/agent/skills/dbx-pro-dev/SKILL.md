---
name: dbx-pro-dev
description: >-
  dbx-pro 插件开发工具 —— jeecg-dev 对等，面向内部开发者的插件 SDK + API 契约。
  触发：用户说"dbx-pro 开发/插件开发/server 开发/MCP 工具"。
---

# dbx-pro-dev —— 插件开发 SDK（jeecg-dev 对等）

> **面向 dbx-pro 内部开发者的 skill，不暴露给最终用户。**
> 指导如何扩展 dbx-pro server、注册新 MCP 工具、开发新 skills。

## 触发条件（内部）

dbx-pro 开发 / 插件开发 / server 开发 / MCP 工具注册 / skill 开发 / bigscreen-compiler 扩展 / report-executor 扩展。

## 核心流程

```
开发者描述扩展需求
  ↓
① 确定扩展点：new skill / new MCP tool / new bigscreen handler / new report feature
  ↓
② 按 plugin-sdk.md 规范编写
  ↓
③ 按 api-contract.md 定义 HTTP API / MCP tool 输入输出
  ↓
④ 本地测试 → 提交 PR
```

## 目录结构规范

```
dbx-pro/
├── server/
│   ├── src/
│   │   ├── api/            # HTTP API 路由
│   │   ├── engine/         # 核心编译/执行引擎
│   │   │   ├── bigscreen-compiler.mjs
│   │   │   ├── report-executor.mjs
│   │   │   ├── sql-safety.mjs
│   │   │   └── mock-data-generator.mjs
│   │   ├── mcp/            # MCP Server 工具
│   │   │   ├── tools/      # dbx_execute_query / dbx_describe_table / ...
│   │   │   └── server.mjs  # MCP server 入口
│   │   └── config.mjs
│   └── package.json
├── agent/
│   ├── skills/             # AI agent skills（本 skill 所在）
│   │   ├── dbx-pro/SKILL.md
│   │   ├── dbx-pro-bigscreen/SKILL.md
│   │   ├── dbx-pro-report/SKILL.md
│   │   ├── dbx-pro-datalist/SKILL.md        # 新增
│   │   ├── dbx-pro-form/SKILL.md            # 新增
│   │   ├── dbx-pro-codegen/SKILL.md         # 新增
│   │   ├── dbx-pro-bpmn/SKILL.md            # 新增
│   │   ├── dbx-pro-aiflow/SKILL.md          # 新增
│   │   ├── dbx-pro-system/SKILL.md          # 新增
│   │   ├── dbx-pro-portal/SKILL.md          # 新增
│   │   └── dbx-pro-dev/SKILL.md             # 本 skill
│   └── scripts/
└── package.json
```

## 新 Skill 开发规范

1. **目录**：`agent/skills/<skill-name>/SKILL.md`
2. **frontmatter**：`name` + `description`（含触发关键词）
3. **正文结构**：触发条件 → 核心流程 → HTTP API → 差异表 → 服务端代码 → references
4. **注册**：自动发现，放在 `agent/skills/` 下即可

## 新 MCP Tool 开发规范

```javascript
// server/src/mcp/tools/new-tool.mjs
export const newTool = {
  name: "dbx_new_tool",
  description: "工具描述",
  parameters: { /* JSON Schema */ },
  handler: async ({ args }) => {
    // 实现
    return { content: [{ type: "text", text: "结果" }] };
  }
};
```

## 新 Bigscreen Handler 扩展

```javascript
// server/src/engine/bigscreen-compiler.mjs
handlers['JNewComponent'] = (spec, palette) => {
  // spec: { type, title, data, ... }
  // palette: 命名色板（tech/gov/biz/...）
  return {
    kind: 'echarts' | 'html',
    echartsOption?: object,
    html?: string,
    warnings?: string[]
  };
};
```

## API 契约速查

| API | 方法 | 功能 |
|---|---|---|
| `/api/report/exec` | POST | 执行参数化 SQL + 分页 + 分组 |
| `/api/report/headers` | POST | 多级表头推断（纯函数）|
| `/api/bigscreen/compile` | POST | spec → JimuBI 组件 JSON（零 HTML）|
| `/api/bigscreen/render` | POST | spec → 完整 HTML 大屏 |
| `/api/bigscreen/templates` | GET | 列出所有内联模板（含完整 spec）|
| `/api/bigscreen/templates/:id` | GET | 按 id 查单模板 |
| MCP: dbx_execute_query | tool | 执行 SQL 查询 |
| MCP: dbx_describe_table | tool | 获取表结构 |
| MCP: dbx_list_tables | tool | 列出所有表 |
| MCP: dbx_query_full | tool | 完整查询（describe + safety + execute）|

## 与 jeecg-dev 的差异

| 维度 | jeecg-dev | dbx-pro-dev |
|---|---|---|
| 语言 | Java / Vue | Node.js / MJS |
| 框架 | Spring Boot | 原生 Node + MCP |
| 扩展机制 | SPI + 动态编译 | 模块加载 + skills 自动发现 |
| 运行时 | JVM | Node 20+ |

## references/

| 文件 | 内容 |
|---|---|
| references/plugin-sdk.md | 新 MCP Tool / 新 Skill / 新 Bigscreen Handler 开发完整规范 |
| references/api-contract.md | 所有 HTTP API + MCP Tool 输入输出 schema |
| references/testing-guide.md | 本地测试 / 模拟数据 / 验收 checklist |
| references/adr/ | 架构决策记录（ADR-0010b ECharts 替换等）|
