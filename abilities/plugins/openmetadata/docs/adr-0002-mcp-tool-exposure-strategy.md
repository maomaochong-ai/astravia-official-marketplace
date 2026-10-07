# ADR-0002: MCP 工具暴露策略

## 状态
已决策

## 背景
OpenMetadata MCP Server 原生暴露了 **17+ 个工具**（见 `openmetadata-mcp/src/main/resources/json/data/mcp/tools.json`），覆盖元数据搜索、语义搜索、实体详情、血缘、数据质量、知识图谱和实体 CRUD 等能力。由于 ADR-0001 决策了「插件侧实现 MCP → REST API 映射」的架构，本 ADR 需要解决：**哪些工具暴露给宿主 Agent，以及如何分层实现**。

## 约束
- 插件侧工具必须通过 `agent.tools.register` 注册到宿主
- 工具的 schema（参数、描述）需要从 OM MCP tools.json 适配到宿主的工具注册格式
- RDF 相关工具（sparql_query、entity_neighborhood、find_by_tag、shacl_validate、ontology_describe）依赖 OM RDF 服务（Fuseki），但用户部署的 OM 实例可能未启用 RDF
- 写入类工具（create_entity、patch_entity、create_lineage、create_test_case）涉及数据变更，需要更谨慎的错误处理
- 插件侧需要确保工具调用不会因 token 过期、CORS、网络超时等问题导致 Agent 挂起

## 工具分层

### L0 — 核心只读工具（P0 必做）
这些是数据发现和理解的基础，覆盖 90% 的常见使用场景。
**注意：OM API 根路径是 `/v1`（不是 `/api/v1`），以下端点已从 OM 源码验证。**

| 工具名（插件侧） | OM MCP 对应 | 真实 REST API 端点 | 说明 |
|-----------------|-------------|---------------|------|
| `om_search_metadata` | search_metadata | `GET /v1/search/query` | 关键词搜索元数据资产（OpenSearch DSL 高级查询） |
| `om_semantic_search` | semantic_search | `POST /v1/search/vector/query` | 语义搜索（需要 OM 配置向量嵌入） |
| `om_get_entity_details` | get_entity_details | `GET /v1/{entityType}/{fqn}` | 获取实体完整详情（context 扩展见 `/context` 子路径） |
| `om_get_entity_lineage` | get_entity_lineage | `GET /v1/lineage/{entity}/{id}` | 获取血缘关系（按 entity + UUID） |
| `om_get_user_context` | get_user_context | `GET /v1/users/current` | 当前用户上下文 |
| `om_get_persona_context` | get_persona_context | `GET /v1/personas/my/context` 或 `GET /v1/personas/name/{fqn}/context` | Persona AI 上下文 |
| `om_find_context` | find_context | 组合 semantic_search + glossary | 引导式上下文发现 |

### L1 — 写入治理工具（P1）
数据治理的增删改操作，需要插件侧增加二次确认提示。

| 工具名（插件侧） | OM MCP 对应 | 真实 REST API 端点 | 说明 |
|-----------------|-------------|---------------|------|
| `om_create_entity` | create_entity | `POST /v1/{entityType}` | 创建 glossary/domain/metric 等治理实体 |
| `om_patch_entity` | patch_entity | `PATCH /v1/{entityType}/{fqn}` | JSON Patch 更新实体 |
| `om_create_lineage` | create_lineage | `POST /v1/lineage` | 创建血缘边 |
| `om_create_test_case` | create_test_case | `POST /v1/dataQuality/testCases` | 创建数据质量测试用例 |
| `om_get_test_definitions` | get_test_definitions | `GET /v1/dataQuality/testDefinitions` | 获取可用测试定义 |
| `om_describe_entity_type` | describe_entity_type | 从 OM OpenAPI schema 或 OM MCP tools.json 读取 | 返回 create_entity 可接受的 attributes |

### L2 — 分析诊断工具（P2）
组合型分析工具，内部串联多个 REST API 调用。

| 工具名（插件侧） | OM MCP 对应 | 实现方式 | 说明 |
|-----------------|-------------|---------|------|
| `om_root_cause_analysis` | root_cause_analysis | get_entity_lineage × N + testCase 搜索 | 数据质量根因分析（遍历上游失败） |
| `om_company_context` | company_context | POST `/api/v1/search/query` (Context 过滤) | Context Center 知识片搜索 |

### L3 — RDF 知识图谱工具（P3，条件启用）
依赖 OM RDF 服务，需要运行时检测是否启用。

| 工具名（插件侧） | OM MCP 对应 | 启用条件 | 说明 |
|-----------------|-------------|---------|------|
| `om_sparql_query` | sparql_query | OM 配置 `rdfStore.enabled=true` | 执行 SPARQL 查询知识图谱 |
| `om_entity_neighborhood` | entity_neighborhood | 同上 | 获取实体 n-hop 邻域 |
| `om_find_by_tag` | find_by_tag | 同上 | 按标签/术语查找实体 |
| `om_shacl_validate` | shacl_validate | 同上 | SHACL 图谱验证 |
| `om_ontology_describe` | ontology_describe | 同上 | 描述本体类/属性 |

**L3 工具在插件初始化时检测 OM 实例的 RDF 配置，未启用时不注册这些工具**，避免 Agent 误调用后收到 404。

### 工具注册总览

```
插件初始化
  ├─ 检测连接状态 → 失败则仅注册连接配置工具
  ├─ 注册 L0 核心只读工具（始终注册）
  ├─ 注册 L1 写入治理工具（始终注册，但需 Token 有 write 权限）
  ├─ 注册 L2 分析诊断工具（始终注册）
  └─ 检测 RDF 启用 → 注册 L3 知识图谱工具
```

## 工具设计规范

### 命名规范
- 统一前缀 `om_`（openmetadata 缩写），避免与 dbx-* 等其他插件工具命名冲突
- 使用小写 + 下划线（snake_case），与 OM MCP 原生工具风格一致
- 不再重命名工具语义（如 `om_search_metadata` 而非 `om_search`），保持与 OM MCP 一致降低迁移成本

### 参数适配
- 直接复用 OM MCP tools.json 中的参数 schema，减少适配层偏差
- OM MCP 原生的注解（annotations: readOnlyHint、destructiveHint）保留到插件侧工具定义中，让宿主 Agent 了解工具安全属性
- RDF 工具的 admin-only 权限在插件侧透传 OM 的 403 错误，不在插件层做权限缓存

### 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| Token 过期 (401) | 返回结构化错误 `{ type: "auth", message: "Token 已过期，请在插件配置中更新" }`，同时通知插件 UI 弹出过期提示 |
| 权限不足 (403) | 透传 OM 的错误消息，告知 Agent 当前 Token 无此操作权限 |
| 网络超时 | 30s 超时，返回 `{ type: "timeout", message: "OpenMetadata 服务端未响应" }` |
| CORS 拦截 | 返回明确错误提示："请确认 OpenMetadata 实例已配置允许插件域名跨域访问" |
| RDF 未启用 | L3 工具本身不会注册；若通过其他方式调用，返回 `"OpenMetadata RDF 服务未启用"` |

### 结果裁剪
- 搜索结果默认 limit 10（与 OM MCP 默认一致），避免一次性返回过多消耗 Token
- 大字段（table columns、dashboard charts）按 OM MCP 的分页逻辑处理（columnOffset/columnLimit）
- 血缘结果默认 table-level，不包含列级血缘和 SQL（需要时显式请求）
- 不在插件侧做额外的结果格式化或中文翻译，保持 OM 原生数据结构

## 决策

### 1. 工具暴露策略
- **全量透传 L0-L1 + 按条件启用 L2-L3**
- L0（7 个）和 L1（6 个）共 **13 个工具** 在首版注册，覆盖 OM MCP 90% 以上高频使用场景
- L2（1 个，root_cause_analysis）首版也实现，因为根因分析是数据治理核心能力
- L3（5 个 RDF 工具）按运行时条件注册

### 2. 不做二次封装
- 插件侧工具定义直接映射 OM MCP tools.json 的 schema，不做参数重命名或语义变更
- 不添加 OM 原生没有的自定义工具（如 `om_search_tables_by_name` 这种简化版）——Agent 应学会使用完整工具集
- 工具描述使用 OM MCP 原始英文描述，不做中文翻译（避免翻译偏差，Agent 可理解英文）

### 3. 工具注册方式
参考 dbx-pro 的 `agent.tools.register` 模式：
```typescript
ctx.agent.tools.register(om_search_metadata_tool_definition, om_search_metadata_handler);
ctx.agent.tools.register(om_get_entity_details_tool_definition, om_get_entity_details_handler);
// ... 逐个注册
```

Handler 内部流程：
```
Handler(params, ctx)
  → 读取当前活跃连接配置
  → 构建 REST API 请求（URL + Bearer Token）
  → fetch 调用
  → 处理 401/403/网络错误
  → 返回结构化 JSON 结果（或 trim 后的紧凑格式）
```

## 后果

### 正面
- **分层清晰**：首版聚焦 L0 + L1（13 个核心工具），后续按需扩展
- **零语义偏差**：工具 schema 直接复用 OM MCP 定义，Agent 在 OM 文档和宿主工具之间看到的是同一套接口
- **RDF 条件启用**：避免用户未配 RDF 时 Agent 误调用导致困惑
- **统一错误处理**：401 触发 Token 过期提示、403 透传 OM 权限信息、超时明确告知

### 负面
- **工作量大**：13 个工具的 REST API 映射实现量不轻
- **REST API 版本漂移风险**：OM 升级后 REST API 字段可能变化，需要适配

### 风险
- OM REST API 的某些端点可能与 MCP 工具不完全 1:1 对应（MCP 可能有聚合逻辑），需要逐个比对
- OM API Token 的权限模型可能导致某些只读工具也返回 403（如用户未被分配 Data Consumer 角色）

## 参考
- OpenMetadata MCP tools.json: `/Users/zhugeyue/Desktop/project/bigdate/source-code/OpenMetadata-main/openmetadata-mcp/src/main/resources/json/data/mcp/tools.json`
- OpenMetadata REST API 参考: https://docs.open-metadata.org/v1.13.x/swagger-api-docs
- OM 实体类型清单: https://docs.open-metadata.org/v1.13.x/main-concepts/metadata-standard/schemas
- dbx-pro 工具注册方式: `abilities/plugins/dbx-pro/src/` 下的 register-tools.ts（若存在）
