# ADR-0004: Agent Skill 与宿主交互模式

## 状态
已决策

## 背景
OpenMetadata 插件向宿主 Agent 暴露了 13+ 个 MCP 工具（见 ADR-0002）。Agent 如何理解这些工具的使用场景、参数规范、组合模式，直接决定了用户能否自然地"让 AI 做数据发现和治理"。本 ADR 定义 SKILL.md 的结构、@ 提及格式、prompt 模板和交互流程。

## 约束
- **不得修改宿主源码**（open-astravia）
- SKILL.md 放在 `agent/skills/openmetadata/SKILL.md`，参考 dbx-pro 的 `agent/skills/dbx-pro/SKILL.md`
- SKILL.md 是 Agent 的"操作手册"，不是面向终端用户的文档
- @ 提及格式要能让 Agent 识别出"这是 OM 插件的元数据引用"

## SKILL.md 结构设计

### 对比 dbx-pro SKILL.md
dbx-pro 的 SKILL.md 聚焦于"AI 对话中的数据库操作"——列出工具、给出 SQL 工作流示例、描述可视化生成链路。OM 插件需要类似的结构，但场景不同。

### SKILL.md 章节设计

```
SKILL.md
├── 总览（插件定位 + OM 核心概念速览）
├── 工具清单表格（工具名 / 功能 / 参数要点 / 只读 or 写入）
├── 典型工作流
│   ├── 场景 1: 我有一个业务问题，不知道对应什么数据资产
│   ├── 场景 2: 我知道一个表，想了解它的详情
│   ├── 场景 3: 某个报表数据异常，想查根因
│   ├── 场景 4: 想创建一个新的数据域 / Glossary 术语
│   └── 场景 5: 两个表之间是否应该有关系？
├── @ 提及格式与处理
├── 错误处理指南（Token 过期 / RDF 未启用 / 权限不足）
└── references/ 指引表
    ├── tools-usage.md       各工具详细参数和示例
    ├── entity-types.md      OM 实体类型速查表
    └── glossary-vs-domain.md 治理概念区分
```

### OM 核心概念速览（Agent 需要知道的）
```
OpenMetadata = 统一元数据平台
  ├── Data Assets（数据资产）
  │   ├── table / dashboard / topic / pipeline / chart / metric / mlmodel / ...
  │   ├── 关联: service → database → schema → table
  │   └── 关联: tags / glossary terms / domains
  ├── Lineage（血缘）
  │   ├── 上游: 谁产生了这个资产
  │   └── 下游: 谁消费了这个资产
  ├── Data Quality（数据质量）
  │   ├── testSuite: 一组测试
  │   ├── testCase: 单个测试（有 testDefinition 和 parameterValues）
  │   └── testDefinition: 测试模板（如 "column values to be unique"）
  └── Governance（治理）
      ├── Glossary → Glossary Term（业务术语，打标签用）
      ├── Domain → Data Product（数据域 / 数据产品）
      ├── Tag → Classification（分类标签体系）
      └── Metric（指标定义，含表达式和粒度）
```

## @ 提及格式

### 格式设计
参考 dbx-pro 的 `` @`连接名:schema.表名` `` 格式，OM 插件采用：

| 引用类型 | 格式 | 示例 |
|---------|------|------|
| **OM 实体** | `@om:<entityType>:<fqn>` | `@om:table:sales.dim_customer` |
| **OM 实体（简化）** | `@om:<fqn>` （无 entityType 时 Agent 自动搜索） | `@om:sales.dim_customer` |
| **OM 术语** | `@om:glossaryTerm:<fqn>` | `@om:glossaryTerm:Sales.CustomerID` |
| **OM 指标** | `@om:metric:<fqn>` | `@om:metric:DailyActiveUsers` |

### @ 处理流程
```
用户在输入框键入 '@om:'
  → 宿主 AtPanel 弹出自定义候选项（若宿主支持）
  → 或通过插件 Activity Tab 中的 @ 注入按钮
  → 用户选择实体 → 注入 `@om:table:sales.dim_customer`
  → Agent 识别 @om 前缀 → 调用 om_get_entity_details 解析 FQN
  → Agent 获得实体详情 → 继续对话分析
```

## 典型工作流（SKILL.md 核心内容）

### 场景 1: 业务问题 → 数据发现
```
用户: "帮我找一下和客户消费行为相关的数据"
  → Agent 调用 om_semantic_search(query="customer purchase behavior")
  → 返回候选表列表（sales.fact_orders, customers.dim_accounts, ...）
  → Agent 展示给用户，并调用 om_get_entity_details 查看 top 3 的详情
  → Agent 总结："找到 5 个相关资产，最匹配的是 sales.fact_orders..."
```

### 场景 2: 表详情 → 上下文理解
```
用户: "帮我理解 @om:table:sales.dim_customer 这张表"
  → Agent 调用 om_get_entity_details(entityType="table", fqn="sales.dim_customer")
  → Agent 提取：列定义、主键、外键、owner、tags、tier、描述
  → Agent 总结："sales.dim_customer 是客户维度表，主键 customer_id..."
```

### 场景 3: 数据质量根因分析
```
用户: "@om:table:bi.daily_revenue 最近的数据质量异常，帮我查根因"
  → Agent 调用 om_root_cause_analysis(fqn="bi.daily_revenue", entityType="table")
  → 返回结果包含：
      - 自身失败的测试（如有）
      - 上游节点中失败的测试（根因）
      - 下游受影响的资产
  → Agent 总结："bi.daily_revenue 的数据异常源于上游 sales.fact_orders 的非空性测试失败..."
```

### 场景 4: 创建治理实体
```
用户: "帮我创建一个 Glossary 术语 'HighValueCustomer'，放在 Sales 分类下"
  → Agent 先调用 om_get_entity_details 确认 Sales Glossary 存在
  → Agent 调用 om_create_entity(
        entityType="glossaryTerm",
        name="HighValueCustomer",
        attributes={glossaryRef: {type:"glossary", fqn:"Sales"}},
        description="消费额超过10万的客户"
    )
  → Agent 调用 om_patch_entity 给相关表打标签
  → Agent 总结："已创建 HighValueCustomer 术语，标记了 3 张相关表..."
```

### 场景 5: 血缘探索
```
用户: "@om:table:bi.daily_revenue 的数据从哪来？"
  → Agent 调用 om_get_entity_lineage(
        entityType="table", fqn="bi.daily_revenue",
        upstreamDepth=2, downstreamDepth=0
    )
  → Agent 展示："bi.daily_revenue 从 bi.daily_sales_summary 聚合而来，
    后者由 sales.fact_orders 和 sales.dim_product 关联计算..."
```

## 错误处理指南

### Token 过期
- 工具返回 `{ type: "auth", message: "Token 已过期" }`
- Agent 应告知用户："OpenMetadata API Token 已过期，请前往插件设置更新"
- **Agent 不应自动重试或降级**

### RDF 未启用
- L3 工具（sparql_query 等）不会被注册到 Agent
- Agent 调用时收到 "tool not found"
- SKILL.md 中明确说明："如果你的 OM 实例未启用 RDF，SPARQL 工具不可用，请用 search_metadata 替代"

### 权限不足
- OM 返回 403
- 工具透传错误消息："当前 Token 无权限读取该资产，需要 Data Consumer 或更高角色"
- Agent 应告知用户，不做猜测性重试

### 语义搜索不可用
- OM 未配置向量嵌入时，semantic_search 失败
- 工具返回明确提示："当前 OM 实例未配置向量嵌入，语义搜索不可用"
- Agent 应自动降级到关键词搜索 search_metadata

### 实体不存在
- OM 返回 404
- 工具返回明确提示，Agent 应建议使用 search_metadata 找到正确的 FQN

## 决策

### 1. SKILL.md 定位
- **Agent 的操作手册**，不是用户文档
- 用 Agent 能理解的结构化格式写，不要大段散文
- 工作流示例用 "用户问题 → Agent 工具调用序列 → Agent 回复" 三步式

### 2. @ 提及格式
- 统一前缀 `@om:`，与 dbx-pro 的 `@dbx:` 风格一致
- 支持简化格式（省略 entityType），Agent 可自动搜索匹配
- 实体引用格式：`@om:<entityType>:<fqn>` 或 `@om:<fqn>`

### 3. references/ 文档拆分
- SKILL.md 只放高频内容和工作流
- 工具详细参数、实体类型速查等放到 references/ 目录
- 通过 SKILL.md 开头的指引表关联

### 4. 错误处理
- 插件侧工具 Handler 统一捕获错误并结构化返回
- SKILL.md 中给 Agent 明确的错误应对策略，不搞模糊处理

## 后果

### 正面
- Agent 有完整的 OM 工具使用指南，能自然地组合使用
- @ 提及格式与插件定位（元数据上下文助手）一致
- references/ 拆分保持 SKILL.md 精简，高频内容优先

### 负面
- 需要持续维护 SKILL.md 与工具实现的同步（新增/修改工具时更新）
- 典型工作流的 "Agent 回复" 部分需要反复打磨

### 风险
- OM 升级后 REST API 字段变化可能导致工具行为变化，SKILL.md 的示例可能不再准确

## 参考
- dbx-pro SKILL.md: `abilities/plugins/dbx-pro/agent/skills/dbx-pro/SKILL.md`
- dbx-pro ADR-0001 交互流程: `abilities/plugins/dbx-pro/docs/adr-0001-ai-interaction.md`
- OpenMetadata 实体类型: https://docs.open-metadata.org/v1.13.x/main-concepts/metadata-standard/schemas/
