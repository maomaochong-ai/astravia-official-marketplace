# Glossary vs Domain vs Metric

OpenMetadata 中三个容易混淆的治理概念。

## Glossary + GlossaryTerm

**定位**：业务语言词典

| 维度 | 说明 |
|------|------|
| 用途 | 定义业务术语，让技术人员和业务人员用同一套语言 |
| 层级 | Glossary（分类）→ GlossaryTerm（术语） |
| 关系 | GlossaryTerm 可以 tag 到 data assets（表、仪表盘等） |
| 例子 | Glossary: "Sales" → GlossaryTerm: "ActiveCustomer"（定义：过去 30 天有下单行为的客户） |
| 工具 | om_create_entity(entityType="glossaryTerm"), om_patch_entity 给资产打标签 |

## Domain + DataProduct

**定位**：数据的"组织架构"

| 维度 | 说明 |
|------|------|
| 用途 | 按业务域组织数据资产，帮助用户快速找到相关数据 |
| 层级 | Domain（业务域）→ DataProduct（数据产品）→ Data Assets |
| 关系 | Domain 包含 DataProduct，DataProduct 包含 data assets |
| 例子 | Domain: "Sales" → DataProduct: "Customer360"（一个完整的数据产品，含 dim_customer、fact_orders 等表） |
| 工具 | om_create_entity(entityType="domain"), om_patch_entity 设置资产的 domain |

## Metric

**定位**：可复用的指标定义

| 维度 | 说明 |
|------|------|
| 用途 | 标准化跨团队的指标定义，避免同一个指标有不同口径 |
| 内容 | Metric 包含 metricExpression（计算表达式）、granularity（粒度：DAY/MONTH/...）、unitOfMeasurement |
| 关系 | Metric 关联到它所依赖的 data assets |
| 例子 | Metric: "DailyActiveUsers" → metricExpression: "COUNT(DISTINCT user_id)", granularity: "DAY" |
| 工具 | om_create_entity(entityType="metric"), om_search_metadata(entityType="metric") |

## 三者的典型协作流程

```
1. 数据工程师创建 Domain "Sales"，把 sales.fact_orders 归入该域
2. 业务分析师创建 GlossaryTerm "ActiveCustomer"，tag 到 sales.dim_customer
3. Data Analyst 创建 Metric "DailyActiveUsers"，关联 dim_customer 表
4. Agent 搜索 "有哪些活跃客户相关的数据"
   → om_find_context(query="活跃客户")
   → 返回 GlossaryTerm "ActiveCustomer" + Metric "DailyActiveUsers" + 相关表 dim_customer
```

## Agent 使用建议

- 用户说"我要找活跃客户相关数据" → 先用 `om_find_context`，它会自动处理 glossary + metric + data asset 的关联
- 用户说"帮我创建一个新的业务术语" → 用 `om_create_entity(entityType="glossaryTerm")`
- 用户说"帮我把这几张表归入销售域" → 用 `om_patch_entity` 设置 domain 引用
- 用户说"DailyActiveUsers 指标的数据在哪" → 先 `om_search_metadata(entityType="metric", query="DailyActiveUsers")`，再 `om_get_entity_details`
