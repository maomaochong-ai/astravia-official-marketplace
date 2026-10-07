# OpenMetadata 插件 SKILL

> 本文档是 AI Agent 操作手册，帮助 Agent 理解 OpenMetadata 工具集的使用场景、参数规范和典型工作流。
> 详细设计见 `docs/adr-0004-agent-skill-and-interaction.md`。

## 总览

OpenMetadata 是统一元数据平台，本插件暴露其核心能力给宿主 AI Agent：
- **元数据搜索**（关键词 + 语义）
- **实体详情**（表/仪表板/管线/指标等）
- **血缘分析**（上游/下游依赖追踪）
- **数据质量**（测试用例/根因分析）
- **治理实体 CRUD**（Glossary/Term/Domain/Metric）

## 工具清单

### L0 — 核心只读工具（始终注册）

| 工具名 | 功能 | 参数要点 |
|--------|------|---------|
| `om_search_metadata` | 关键词搜索元数据资产 | `query` + 可选 `entityType`/`queryFilter` |
| `om_semantic_search` | 语义搜索（需要 OM 配置向量嵌入） | `query` (自然语言) + 可选 `filters` |
| `om_get_entity_details` | 获取实体完整详情 | `entityType` + `fqn`（用搜索结果中的值） |
| `om_get_entity_lineage` | 获取血缘关系 | `entityType` + `fqn` + 可选 `upstreamDepth`/`downstreamDepth` |
| `om_get_user_context` | 当前用户上下文 | 无必选参数 |
| `om_get_persona_context` | Persona AI 上下文 | 可选 `personaName`/`part` |
| `om_find_context` | 引导式上下文发现 | `query` (业务问题) |

### L1 — 写入治理工具（始终注册，需 write 权限）

| 工具名 | 功能 | 参数要点 |
|--------|------|---------|
| `om_create_entity` | 创建治理实体（glossary/domain/metric 等） | `entityType` + `name` + `attributes` |
| `om_patch_entity` | JSON Patch 更新实体 | `entityType` + `fqn` + `patch` (RFC 6902) |
| `om_create_lineage` | 创建血缘边 | `fromEntity` + `toEntity` (各含 `type` + `fqn`) |
| `om_create_test_case` | 创建数据质量测试用例 | `name` + `fqn` + `testDefinitionName` + `parameterValues` |
| `om_get_test_definitions` | 获取可用测试定义 | `entityType` (TABLE/COLUMN) |
| `om_describe_entity_type` | 返回 create_entity 可接受的 attributes | `entityType` |

### L2 — 分析诊断工具

| 工具名 | 功能 | 参数要点 |
|--------|------|---------|
| `om_root_cause_analysis` | 数据质量根因分析（遍历上游失败） | `fqn` + `entityType` + 可选 depth |

### L3 — RDF 知识图谱工具（条件启用，OM 未配置 RDF 时不注册）

| 工具名 | 功能 |
|--------|------|
| `om_sparql_query` | 执行 SPARQL 查询知识图谱 |
| `om_entity_neighborhood` | 获取实体 n-hop 邻域 |
| `om_find_by_tag` | 按标签/术语查找实体 |
| `om_shacl_validate` | SHACL 图谱验证 |
| `om_ontology_describe` | 描述本体类/属性 |

## 典型工作流

详见 `docs/adr-0004-agent-skill-and-interaction.md` 中的场景 1-5。

## @ 提及格式

| 格式 | 示例 |
|------|------|
| `@om:<entityType>:<fqn>` | `@om:table:sales.dim_customer` |
| `@om:<fqn>`（省略 type 自动搜索） | `@om:sales.dim_customer` |
| `@om:glossaryTerm:<fqn>` | `@om:glossaryTerm:Sales.CustomerID` |
| `@om:metric:<fqn>` | `@om:metric:DailyActiveUsers` |

## 错误处理指南

| 错误类型 | Agent 应对 |
|---------|-----------|
| Token 过期 (401) | 告知用户"API Token 已过期，请前往插件设置更新" |
| 权限不足 (403) | 透传 OM 权限错误消息 |
| 语义搜索不可用 | 自动降级到 `om_search_metadata` |
| RDF 未启用 | L3 工具不存在，用搜索工具替代 |
| 实体不存在 (404) | 建议用户先用 `om_search_metadata` 找到正确 FQN |

## References 指引

| 文档 | 内容 | 使用场景 |
|------|------|---------|
| ADR-0001 | 连接模型与认证架构 | 理解为什么插件不打包本地进程 |
| ADR-0002 | MCP 工具暴露策略 | 工具分层设计和错误处理策略 |
| ADR-0003 | 插件 UI 边界 | 了解什么能做什么不能做 |
| ADR-0004 | Agent Skill 详细设计 | 完整交互模式和工作流 |
