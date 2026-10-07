# Entity Types Reference

OpenMetadata 实体类型速查表。

## 数据资产（Data Assets）

| entityType | 说明 | 典型 FQN 格式 |
|-----------|------|--------------|
| table | 数据库表 | `service.database.databaseSchema.table` |
| dashboard | BI 仪表板 | `dashboardService.dashboardName` |
| dashboardDataModel | 仪表板数据模型 | 关联 dashboard |
| chart | 图表 | `dashboardService.dashboard.chart` |
| topic | Kafka/Pulsar 主题 | `messagingService.schema.topic` |
| pipeline | 数据管线（Airflow/Dagster） | `pipelineService.pipeline` |
| storedProcedure | 存储过程 | `service.schema.procedure` |
| mlmodel | 机器学习模型 | `mlmodelService.mlmodel` |
| searchIndex | 搜索引擎索引 | `searchService.index` |
| apiEndpoint | API 端点 | `apiService.apiCollection.endpoint` |
| apiCollection | API 集合 | `apiService.apiCollection` |
| metric | 业务指标 | domain + name |
| container | 通用容器（Iceberg、Hudi） | `service.database.container` |
| spreadsheet / worksheet | Google Sheets | `driveService.spreadsheet.worksheet` |
| file / directory | 对象存储文件 | `storageService.bucket.path` |

## 容器（Containers）

| entityType | 说明 |
|-----------|------|
| database | 数据库（PostgreSQL, BigQuery, Snowflake 等） |
| databaseSchema | Schema / Schema |

## 服务（Services）

| entityType | 说明 |
|-----------|------|
| databaseService | 数据库连接（PostgreSQL, BigQuery, Snowflake 等） |
| dashboardService | BI 工具连接（Looker, Tableau, Superset 等） |
| messagingService | 消息队列连接（Kafka, Pulsar） |
| pipelineService | 编排引擎连接（Airflow, Dagster） |
| mlmodelService | ML 平台连接（MLflow） |
| storageService | 对象存储连接（S3, GCS） |
| searchService | 搜索引擎连接 |
| apiService | API 网关连接 |
| metadataService | 外部元数据源连接 |
| driveService | Drive 服务（Google Drive） |
| securityService | 安全服务 |

## 治理（Governance）

| entityType | 说明 |
|-----------|------|
| glossary | Glossary 分类 |
| glossaryTerm | 业务术语 |
| tag | 标签 |
| classification | 标签体系分类 |
| domain | 数据域 |
| dataProduct | 数据产品 |
| metric | 指标定义 |

## 用户（User）

| entityType | 说明 |
|-----------|------|
| user | 用户 |
| team | 团队 |

## 数据质量（Data Quality）

| entityType | 说明 |
|-----------|------|
| testCase | 测试用例 |
| testSuite | 测试套件（一组 testCase） |
| testCaseResult | 测试结果记录 |
| testDefinition | 测试模板 |

## 其他

| entityType | 说明 |
|-----------|------|
| page | Knowledge Center 文章 |
| persona | Persona（AI 上下文角色） |
| query | 已执行的 SQL 查询记录 |

## FQN 规则

- **Fully Qualified Name** 是 OpenMetadata 中标识实体的唯一字符串
- 通常格式：`service.container1.container2.entity`
- 示例：`sample_data.ecommerce_db.shopify.dim_address`
- 小写索引：在 OpenSearch DSL 的 term/terms 查询中 FQN 必须小写
- 搜索结果中直接返回 FQN，直接传给其他工具即可，**不要手动拼接**
