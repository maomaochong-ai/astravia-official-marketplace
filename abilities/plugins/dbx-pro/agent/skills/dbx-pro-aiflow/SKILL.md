---
name: dbx-pro-aiflow
description: >-
  AI 编排知识库 —— jeecg-aiflow 对等，28 种节点模板 + 编排模式 + 错误处理策略。
  触发：用户说"AI 流程/编排/节点/工作流编排/agent workflow"。
---

# dbx-pro-aiflow —— AI 编排知识库（jeecg-aiflow 对等）

> **dbx-pro 没有 AI 编排运行时。本 skill 提供 jeecg-aiflow 知识层：
> 28 种节点模板 + 编排模式，Agent 按此组织多步工作流，由宿主 Astravia Agent 执行。**

## 触发条件

AI 流程 / 编排 / 节点 / 工作流编排 / agent workflow / 多步 agent / pipeline。

## 核心流程（知识层指导）

```
用户描述编排需求（如"分析销售数据 → 生成大屏 → 发送飞书"）
  ↓
① 选择节点类型（28 种中挑选）
  ↓
② 确定节点间数据传递（上一步输出 → 下一步输入）
  ↓
③ 定义错误处理策略（retry / fallback / skip）
  ↓
④ 输出编排 spec（JSON）
  ↓
（由宿主 Agent 按 spec 执行 —— dbx-pro 不运行）
```

## 28 种编排节点类型

| 分类 | 节点 | 说明 |
|---|---|---|
| **控制流** | start / end | 起点 / 终点 |
| | switch | 条件分支 |
| | loop_for / loop_while | 循环 |
| | parallel | 并行执行 |
| | join | 汇聚并行 |
| **AI** | llm | 大模型调用 |
| | embeddings | 向量化 |
| | rag_retrieve | RAG 检索 |
| | image_gen | 图像生成 |
| **数据** | sql | 执行 SQL（dbx_execute_query）|
| | http | 调外部 HTTP |
| | csv_read / csv_write | CSV 读写 |
| | json_parse / json_path | JSON 处理 |
| | regex | 正则提取 |
| **变换** | map | 字段映射 |
| | filter | 数据过滤 |
| | aggregate | 聚合统计 |
| | merge | 多源合并 |
| **输出** | report | 生成报表（dbx_report_builder）|
| | bigscreen | 生成大屏（dbx_bigscreen_builder）|
| | chart | 生成图表（dbx_chart_collection）|
| | notify | 通知（飞书/邮件/Webhook）|
| | file_write | 文件输出 |
| **变量** | var_set / var_get | 内存变量 |
| | context | 上下文注入 |
| **错误** | try_catch | 异常捕获 |
| | retry | 重试（3 次指数退避）|

## 编排模式示例

```json
{
  "name": "销售日报编排",
  "nodes": [
    { "id": "n1", "type": "sql",
      "sql": "SELECT date, SUM(amt) FROM sales WHERE date = ? GROUP BY 1",
      "params": ["{{context.today}}"],
      "retry": 2 },
    { "id": "n2", "type": "llm",
      "prompt": "分析以下数据趋势并给出 3 条洞察：{{n1.output}}" },
    { "id": "n3", "type": "bigscreen",
      "spec": { "components": [{"type":"JLine","data":"{{n1.output}}"}] } },
    { "id": "n4", "type": "notify",
      "channel": "feishu",
      "message": "销售日报：{{n2.output}}\n{{n3.html}}" }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n1", "to": "n3" },
    { "from": "n2", "to": "n4" },
    { "from": "n3", "to": "n4" }
  ]
}
```

## 与 jeecg-aiflow 的差异

| 维度 | jeecg-aiflow | dbx-pro-aiflow |
|---|---|---|
| 运行时 | Java 执行引擎（Spring Boot）| 宿主 Astravia Agent 执行 |
| 存储 | 数据库表 aiflow_definition | JSON 文本输出 |
| SQL 节点 | JeecgBoot 数据源 | dbx MCP 直连 60+ 数据库 |
| 节点数 | 28 种（Java SPI）| 28 种知识层模板 |

## 服务端代码

无独立 server 模块。知识层 + 编排 spec 模板输出。

## references/

| 文件 | 内容 |
|---|---|
| references/aiflow-operations.md | 除创建流程外的所有操作指南 |
| references/node-reference.md | 每种节点的完整配置（options、inputParams/outputParams、校验规则、特殊行为与使用要点）|
| references/sync-guide.md | 同步节点配置 / 更新节点 / 同步前后端变更指南（按需阅读）|
