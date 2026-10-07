# Tools Usage Reference

OpenMetadata 插件暴露的 MCP 工具详细参数、示例和注意事项。

## 工具总览

| 工具 | 分层 | 只读 | 写入 | 需要 RDF |
|------|------|------|------|----------|
| om_search_metadata | L0 | ✅ | - | - |
| om_semantic_search | L0 | ✅ | - | - |
| om_get_entity_details | L0 | ✅ | - | - |
| om_get_entity_lineage | L0 | ✅ | - | - |
| om_get_user_context | L0 | ✅ | - | - |
| om_get_persona_context | L0 | ✅ | - | - |
| om_find_context | L0 | ✅ | - | - |
| om_create_entity | L1 | - | ✅ | - |
| om_patch_entity | L1 | - | ✅ | - |
| om_create_lineage | L1 | - | ✅ | - |
| om_create_test_case | L1 | - | ✅ | - |
| om_get_test_definitions | L1 | ✅ | - | - |
| om_describe_entity_type | L1 | ✅ | - | - |
| om_root_cause_analysis | L2 | ✅ | - | - |
| om_sparql_query | L3 | ✅ | - | ✅ |
| om_entity_neighborhood | L3 | ✅ | - | ✅ |
| om_find_by_tag | L3 | ✅ | - | ✅ |
| om_shacl_validate | L3 | ✅ | - | ✅ |
| om_ontology_describe | L3 | ✅ | - | ✅ |

## 各工具详解

### om_search_metadata

关键词搜索。OM REST API: `GET /v1/search/query`

**参数**:
- `query` (string): 关键词搜索文本（注意：是关键词不是自然语言）
- `entityType` (string, optional): 过滤实体类型（table/dashboard/pipeline 等）
- `queryFilter` (string, optional): OpenSearch DSL JSON，覆盖 query
- `size` (int, default 10): 结果数量（max 50）
- `from` (int, default 0): 偏移（用 cursor 更好）
- `cursor` (string, optional): 分页 token
- `fields` (string, optional): 额外字段（如 columns, aiContext）

**注意**:
- `fullyQualifiedName` 是小写索引，term/terms 查询时值要小写
- `owners.name` 是 nested 字段，需要用 `{"nested": {"path": "owners", ...}}` 包装
- originEntityFQN 和 entityFQN 也是小写索引

### om_semantic_search

语义搜索（需要 OM 配置向量嵌入）。OM REST API: `POST /v1/search/vector/query`

**参数**:
- `query` (string, required): 自然语言查询
- `filters` (object, optional): { entityType: [...], service: [...], tags: [...], ... }
- `size` (int, default 10): 结果数量（max 50）
- `threshold` (float, default 0.0): 最小相似度分数

**注意**:
- 未配置向量嵌入时返回明确提示，Agent 应降级到 om_search_metadata
- 每个实体返回一个最匹配的 passage 摘要

### om_get_entity_details

获取实体完整详情。OM REST API: `GET /v1/{entityType}/{fqn}`

**参数**:
- `entityType` (string): 实体类型（从搜索结果的 entityType 字段取）
- `fqn` (string): Fully Qualified Name
- `columnOffset` / `columnLimit`: 宽表列分页
- `include` (array): ["lineage", "quality", "context", "content"]

**注意**:
- 列数组过长时自动分页，看 `columnsTruncated` / `hasMoreColumns` 标志
- DDL 和 SQL 有 30000 字符上限，看 `schemaDefinitionTruncated` / `sqlTruncated`
- `include: ["context"]` 会返回主键、外键、频繁 join 等——生成 SQL 前很有用

### om_get_entity_lineage

获取血缘关系。OM REST API: `GET /api/v1/lineage/{entityType}/{fqn}`

**参数**:
- `entityType` + `fqn` (required)
- `upstreamDepth` / `downstreamDepth` (int, default 3, max 10)
- `includeColumnLineage` (bool, default false): 列级血缘映射
- `includeSql` (bool, default false): 变换 SQL（占 90% 响应体积，按需开）

**注意**:
- 默认 table-level，开列级会显著增大响应
- 血缘节点有权限隔离：看不到的节点被隐藏，`hiddenNodes` 报告数量
- `cursor` 用于分页

### om_get_user_context

当前用户上下文。OM REST API: `GET /api/v1/users/current`

**无必选参数**。可选：includeOwnedSummary / includeFollowedSummary / ownedFilter / ownedLimit / followedLimit

### om_find_context

引导式上下文发现。内部调用 semantic_search + glossary 查询。

**参数**:
- `query` (string, required): 业务问题/术语
- `format` ("markdown" | "json", default markdown)

返回：相关 glossary term 定义 + candidate data assets

### om_root_cause_analysis

数据质量根因分析。内部串联 get_entity_lineage × N + testCase 搜索。

**参数**:
- `fqn` (string, required)
- `entityType` (string, required)
- `upstreamDepth` / `downstreamDepth` (int, default 3)

返回：
- status: "success"（没问题）或 "failed"（有失败测试）
- rootHasFailingTests: 自身是否有失败测试
- failingUpstreamNodesCount: 上游失败节点数
- downstreamImpact: 下游受影响资产

### om_get_test_definitions

获取可用测试模板。OM REST API: `GET /api/v1/testDefinition`

**参数**:
- `entityType` (string, default "TABLE"): TABLE 或 COLUMN
- `testPlatform` (string): OpenMetadata / GreatExpectations / DBT / Deequ / Soda / Other

返回：每个 test definition 的 name、description、supportedDataTypes（COLUMN 级）、parameterDefinition（创建时需要）

### om_create_test_case

创建测试用例。OM REST API: `POST /api/v1/testCase`

**参数**:
- `name` (string, required)
- `fqn` (string, required): **总是表 FQN**（不是列 FQN）
- `columnName` (string, COLUMN 级测试需要）
- `testDefinitionName` (string, required)
- `parameterValues` (array of {name, value}, required): test definition 定义的参数

### om_create_entity / om_patch_entity

通用实体 CRUD。OM REST API: POST `/api/v1/{entityType}` / PATCH `/api/v1/{entityType}/{fqn}`

**支持的 entityType**: glossary, glossaryTerm, domain, metric, chart, page, classification, tag, dataProduct, team, user（部分只读）

**不支持**: users/bots/apps/services/pipelines/testCases/ingestion（有专门的创建流程或需要更多权限）
