# ADR-0008: 通过 API 访问数据 —— 把非 SQL 数据源接入 dbx-pro 的能力边界

## 状态

提案中，待评审。目标实施版本 v0.2.x（M1 起）。

调研数据取自 2026-10-08 的 GitHub 公开 API（星标 / 最近推送时间 / 活跃状态均为当日实测值）。

---

## 1. 问题陈述

dbx-pro 现有的数据访问模型是**单一的 SQL 通道**：

```
插件 UI ──► /query (request-router) ──► dbx-mcp 子进程 ──► 数据库驱动 ──► SQL 结果集
```

这条通道有三个硬约束：

1. **对象模型是「库 / schema / 表 / 列」**。连接树、SQL 补全、表搜索（`table-search.ts`）、例程目录（`routines-catalog.ts`）全部建立在 `TreeNodeKind = "connection" | "schema" | "table" | "column"` 之上。
2. **查询语言是 SQL**。`classifyQuery()` 只认识 SQL 语句形态；分页（`sql-pagination.mjs`）靠 `SELECT * FROM (...) LIMIT/OFFSET` 包裹实现。
3. **数据源必须是「数据库」**。`connection-config.ts` 的 `DB_TYPE_MANIFEST` 有 84 个类型，全部是数据库/数仓/驱动，**没有任何 REST / GraphQL / HTTP API 形态**（`design.md` 与 `README.md` 中 `rest` / `graphql` / `http api` 零命中）。

而真实需求是：**数据已经通过公司内部 API 暴露了**（业务中台、指标平台、SaaS 开放接口、自建网关）。用户想要的不是「再连一个库」，而是：

> 在同一个工作台里，用同一种交互（连上 → 看到目录 → 查询 → 结果网格 → 导出 → 可视化）去访问 API 背后的数据。

### 1.1 需求拆解

| 诉求 | 是否等价于「加一个数据库类型」 | 说明 |
|------|------------------------------|------|
| 「调用 API 拿数据，结果进结果网格」 | ❌ 不止 | 分页/过滤/认证语义完全不是 SQL |
| 「公司内部自定义 API 接口访问数据」 | ❌ 不止 | 接口契约由公司自定，需要可配置的映射层 |
| 「像查表一样按需查询」 | ✅ 接近 | 可以用 SQL 语义包装，见方案 C |
| 「跨多个 API 做联合查询」 | ❌ 不属于本次范围 | 见 §6 非目标 |
| 「用 AI 直接问 API 数据」 | ✅ 复用现有 AI 链路 | 已有 `send-context.ts` / tool handler |

### 1.2 必须回答的七个硬问题

任何方案在落地前都要能明确回答以下七问，否则会在实现中期炸开：

1. **凭据与认证**：API key / OAuth token / 签名密钥存在哪？由谁保管、谁能读？插件是否有权把它写进磁盘？
2. **查询语义**：用户侧表达的「查询」是 SQL、过滤 DSL，还是一次 REST 调用？如何与既有 SQL 编辑器共存？
3. **目录与树模型**：没有 schema/表的 API，在连接树里长什么样？懒加载边界在哪？
4. **分页与行数上限**：API 的 `cursor` / `page+size` 与工作台的 `ENGINE_ROW_CAP = 1000`、`totalRows` 如何对齐？进度条（ADR 相关：#5 导出进度）能不能拿到真实总数？
5. **写入边界**：只读？还是允许 POST/PUT？如果允许，如何复用现有 `SQL_BLOCKED → 用户确认 → allowWrite` 的确认闸门？
6. **错误契约**：HTTP 4xx/5xx、限流、超时如何映射进既有 `DBX_*` 错误码（`markdown-parser.mjs: classifyError`）？错误必须是诚实的（沿用「只分类、不改写原始 message」的审计要求）。
7. **边界归属**：把 API 拉进 dbx-pro，还是要求外部系统把 API 暴露成 MCP / 独立服务，由 dbx-pro 只做聚合？

---

## 2. 候选方案

### 方案 A：新增「HTTP / REST」数据库类型（直接内建）

在 `DB_TYPE_MANIFEST` 中新增 `family: "flat"` 的 `rest` / `graphql` 类型，连接配置里存 baseURL + 认证方式 + 端点清单，请求经插件服务端（`server/`）转发。

**优点**
- 复用现有一切：连接树、结果网格、导出、可视化、AI 上下文。
- 用户心智一致：多一个连接类型，其它操作不变。
- 服务端已在桌面上跑（`dbx-engine`，`host-node`），加出站请求不引入新进程。

**缺点**
- 「通用 REST → 表格」的映射本质上不可一般化：响应结构千奇百怪，必须让用户写**声明式映射**（JSONPath → 列），这就等于自造一门配置语言。
- `treeSchema` / `schemaAware` / 分页 / 排序 / 过滤全部要按 API 语义重新定义，等于在既有抽象上开一堆特例。
- `plugin.json` 的 `network.allowedHosts` 是**静态白名单**（当前只有 3 个 GitHub 域名）。允许用户连任意公司内网地址，等于把「网络出口白名单」这一安全边界让给用户配置 —— 这是要单独决策的事，不是顺手加的。

### 方案 B：把 API 数据源交给外部联邦引擎，dbx-pro 只见 SQL（**选定方向**）

不新增数据源类型，而是**让 API 变成 SQL 可查的东西**，dbx-pro 继续走它已经打磨好的 SQL 通道：

| 引擎 | 真身 | 星标（2026-10-08） | 语言 | 最近推送 | 活跃 |
|------|------|------------------|------|---------|------|
| [turbot/steampipe](https://github.com/turbot/steampipe) | 「零 ETL，SQL 直查 API」——每个 API 一个插件，Postgres FDW 暴露成表 | 7,977 | Go | 2026-10-07 | ✅ |
| [trinodb/trino](https://github.com/trinodb/trino) | 分布式 SQL 查询引擎，连接器生态最全（含 REST/JDBC/各类数据源） | 13,309 | Java | 2026-10-08 | ✅ |
| [cube-js/cube](https://github.com/cube-js/cube) | 语义层（Semantic Layer），把度量/维度定义成统一 SQL API | 20,973 | Rust | 2026-10-08 | ✅ |
| [Canner/WrenAI](https://github.com/Canner/WrenAI) | GenBI + 开放上下文层，text-to-SQL 用 MDL 描述业务语义 | 17,820 | Python | 2026-10-08 | ✅ |
| [PostgREST/postgrest](https://github.com/PostgREST/postgrest) | 反方向：把 Postgres 直接暴露成 REST API | 27,701 | Haskell | 2026-10-07 | ✅ |
| [hasura/graphql-engine](https://github.com/hasura/graphql-engine) | 把库/API 自动生成 GraphQL + REST，带细粒度权限 | 32,128 | TypeScript | 2026-10-07 | ✅ |
| [dlt-hub/dlt](https://github.com/dlt-hub/dlt) | Python 数据加载库，几百个 source（含 SaaS API）落地到目标库 | 5,941 | Python | 2026-10-08 | ✅ |
| [supabase/supabase](https://github.com/supabase/supabase) | Postgres 平台，自带 PostgREST 自动 API | 111,232 | TypeScript | 2026-10-08 | ✅ |
| [apache/superset](https://github.com/apache/superset) | BI，强调 SQL 编辑器与多数据源 | 75,076 | Python | 2026-10-08 | ✅ |
| [metabase/metabase](https://github.com/metabase/metabase) | 易用型 BI，模型层可屏蔽底层复杂性 | 49,576 | Clojure | 2026-10-08 | ✅ |

**优点**
- dbx-pro 不需要理解 API：只要目标引擎暴露 Postgres 线协议（Steampipe/Trino 都能），它就是**一个普通 PG 连接**，`DB_TYPE_MANIFEST` 里的 `postgres` 直接可用。
- 目录、分页、导出、可视化、AI —— 全部零改动。
- 安全边界清晰：出站访问发生在用户自己部署的引擎里，不是插件进程里。

**缺点**
- 用户要**额外部署一个引擎**（Steampipe 是单二进制，Trino 较重），门槛高于「填个 URL」。
- 真值最终取决于第三方引擎的插件质量（Steampipe 的某个 API 插件只读、字段有限）。
- `WrenAI` 的 `Wren Engine` 原仓库（`Canner/wren-engine`，661★）**已于 2026-05-06 归档**并合并进主仓库 —— 说明这条生态在快速洗牌，不宜把插件绑死在单一引擎上。

### 方案 C：轻量「只读 API 数据源」+ 声明式映射（远期可选）

介于 A 与 B 之间：只支持**只读**、只支持用户可以自己描述清楚的接口（`GET` + 固定 query 模板 + JSONPath 列表映射 + 分页字段名），作为 `family: "flat"` 的一个连接类型。

**优点**
- 门槛最低：填 baseURL + 端点 + token 即可。
- 覆盖面足够广：公司内部指标的 `GET /metrics?code=xxx` 这类接口占绝大多数。

**缺点**
- 只读、只 GET，复杂接口（POST 查询、嵌套对象、游标翻页）覆盖不到。
- 声明式映射本质上是一门 DSL，一旦发布就背上兼容包袱。
- 与 ADR-0001 的 `@`提及 语法、`TreeNodeKind` 都有交互，需要额外设计「表从哪来」。

### 方案 D：只做 MCP —— 由外部系统暴露能力，dbx-pro 不碰 API

让外部系统（或数据网关团队）把接口包成 MCP server，dbx-pro 只负责 MCP 连接管理。

**优点**
- 零新增数据访问代码，安全边界最干净。
- 与官方市场的 MCP 形态完全一致（`abilities/mcp/*`），甚至可以只发一个 `mcp.json`。

**缺点**
- 不解决「用结果网格看 API 数据」这条需求：MCP 返回的是给 AI 读的文本，不是可排序/可导出/可可视化的表格。
- 每个外部系统都要各自实现 MCP，重复建设。

---

## 3. 决策

> **M1/M2 走方案 B（外部 SQL 化引擎 → 普通 PG 连接）；M3 视真实需求再评估方案 C。本次明确不实现方案 A。**

理由：

1. **不在错误的抽象上加特例。** 方案 A 看起来最自然，实则要求把「对象模型 / 查询语言 / 分页 / 认证」四套语义全部重定义为 API 版本，而这些特例会渗透到连接树、SQL 编辑器、导出、可视化五个模块。收益是「少部署一个进程」，代价是插件内核复杂度翻倍。
2. **方案 B 的复利最高。** dbx-pro 对 PG 的支持是投入最深的（`family: "schemas"`、`pg_catalog` 目录查询、`prokind` 例程目录、`pg_get_function_identity_arguments` 签名）。让 API 变成 PG，等于把这部分投入直接复用。
3. **安全边界不能靠配置兜底。** `network.allowedHosts` 是静态白名单，是当前插件唯一的出站约束（现有 3 个域名全是发布资产域名）。方案 A 会把它变成用户可填字段 —— 那是一次独立的安全决策，不应夹带在「加个数据源」里。
4. **生态在洗牌，别绑死。** `Canner/wren-engine` 归档、`trinodb/trino` 与 `cube-js/cube` 同日仍在高频推送 —— 说明这一层不该由插件内置实现，而应由用户选择并替换。

### 3.1 落地形态（M1）

不改代码，只补文档 + 连通性验证：目标引擎（先 Steampipe，因其单二进制、零依赖）暴露 PG wire protocol，dbx-pro 用现成的 `postgres` 类型连接即可。

一次典型配置（示意，具体参数以引擎文档为准）：

```jsonc
// 不是 dbx-pro 的配置格式，仅说明「API 数据源在 dbx-pro 里就是一个 PG 连接」
{
  "name": "指标平台 (Steampipe)",
  "db_type": "postgres",
  "host": "127.0.0.1",
  "port": 9193,
  "database": "steampipe",
  "username": "steampipe",
  "password": "***"
}
```

---

## 4. 与现有架构的接口点

以下路径均为**本仓库实测存在**的代码，方案落地时逐一确认。

| # | 路径 | 行数 | 与 API 数据访问的关系 |
|---|------|------|---------------------|
| 1 | `src/domain/connection-config.ts` | 227 | `DB_TYPE_MANIFEST`（84 类型）+ `family: "schemas" \| "databases" \| "flat"`。方案 B **零改动**；方案 A/C 需在此新增类型并定义 `schemaAware` / `treeSchema` / 分页能力位 |
| 2 | `server/src/engine/request-router.mjs` | 618 | 读路径 `/query` → `dbx_execute_query`；写路径 `classifyQuery` + `SQL_BLOCKED` 确认闸门。方案 A/C 需要在这里挂「非 SQL 请求」的分支 —— 这正是本 ADR 要避免的复杂度 |
| 3 | `server/src/engine/markdown-parser.mjs` | 216 | `classifyError()` 的 `DBX_*` 错误码映射（`SQL_BLOCKED` / `CONNECTION_FAILED` / `TIMEOUT` / `READ_ONLY` …）。任何新数据源的错误都要落进这套码，且**只分类、不改写原始 message** |
| 4 | `server/src/engine/protocol.mjs` | 136 | `ok()` / `fail()` 信封与 `jsonReplacer`。新数据源的结果必须能 JSON 序列化（API 的 `Date` / `BigInt` / 循环引用要在这里兜住） |
| 5 | `server/src/write/direct-write.mjs` | 215 | 写路径自带完整连接规格（`resolveWriteConnSpec` 会回填 host/port/database，**不回填 username**）。API 侧若有写操作，无法复用这条路径 |
| 6 | `src/shared/services/engine-client.ts` | 389 | `engineExecuteByName` / `engineListSchemas` / `engineListTables` / `engineDescribeByName`。结果集统一为 `EngineQueryOutcome.rows: Record<string, unknown>[]` —— API 返回的嵌套 JSON 必须在这里被拍平成行 |
| 7 | `src/features/database-workspace/hooks/use-workbench-execution.ts` | 316 | 行数上限、`countOnly` 总数回填、`SQL_BLOCKED` → `requestWriteConfirm`。API 的「总数」语义（有没有 `total` 字段）直接决定导出进度条能否精确（见 §5） |
| 8 | `src/features/database-workspace/services/table-search.ts` | 172 | 连接树搜索走 `engineListSchemas` + `engineListTables`。API 数据源若没有 schema/表概念，搜索会静默返回 `failedConnections` —— 必须有明确的降级表现 |
| 9 | `src/features/database-workspace/services/routines-catalog.ts` | 137 | 「方言覆盖有意保守：拿不准就返回 `null` 让调用方隐藏分组」。API 数据源同理：**宁可没有节点，也不要一个点开就报错的分组** |
| 10 | `plugin.json` | 131 | `network.allowedHosts = ["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]` —— 插件自身的出站白名单。方案 A/C 必然要动它，方案 B 不需要 |
| 11 | `design.md` | 392 | 现有设计语言；全文 `rest` / `graphql` / `http api` 零命中 —— 说明「API 数据源」是新增能力，不是既有能力的补丁 |

---

## 5. 七个硬问题的当前答案

| # | 问题 | 方案 B 下的答案 | 遗留风险 |
|---|------|----------------|---------|
| 1 | 凭据与认证 | 凭据存在**用户自己的引擎**里（Steampipe 的 `~/.steampipe/config/*.spc`）；dbx-pro 只存一把 PG 密码，走既有连接配置 | 用户可能图省事把 token 写进 PG 连接备注/名称 —— 需要文档提醒 |
| 2 | 查询语义 | 仍然是 SQL。API 的过滤条件在引擎侧落成视图/参数表 | 用户会尝试 `WHERE` 一个引擎没暴露的字段，报错必须可解释 |
| 3 | 目录与树模型 | 引擎把 API 映射成 schema + 外发表，树**原样复用** `TreeNodeKind` | 某些 API 插件只支持固定字段集，`SELECT *` 与字段列表可能不一致 |
| 4 | 分页与行数上限 | `ENGINE_ROW_CAP = 1000` 与 `sql-pagination.mjs` 的 `LIMIT/OFFSET` 包裹对引擎是合法 SQL，**天然可用**；总数走 `countOnly` | 引擎对深层 `OFFSET` 可能很慢甚至不支持 —— 要设上限并给出明确提示，而不是让进度条卡在 indeterminate |
| 5 | 写入边界 | **默认只读**。API 数据源不做写路径 | 若将来要写，必须复用 `SQL_BLOCKED → 确认 → allowWrite`，不能新开一条无确认通道 |
| 6 | 错误契约 | 引擎的连接失败/超时已经落进 `CONNECTION_FAILED` / `TIMEOUT`；引擎内部某 API 插件的失败会以 SQL 错误文本返回，由 `classifyError` 归到 `UNKNOWN` 并**原样展示** | 「API 限流」在 SQL 错误文本里可能难以归类，只能靠原始文本让用户判断 |
| 7 | 边界归属 | API 适配归**外部引擎**；dbx-pro 只做 SQL 客户端 + 结果呈现 + AI 上下文 | 用户会期待「插件内置支持某 API」—— 需要产品侧明确表述为「通过兼容的 SQL 引擎接入」 |

---

## 6. 非目标（明确不做）

- ❌ **不做通用 REST → 表格的自动推断**。响应结构无法一般化，硬做就是造一门没人会写的 DSL。
- ❌ **不在 `network.allowedHosts` 里放开任意主机**。放开出口白名单是独立的安全决策，需要单独评审。
- ❌ **不做跨 API 的联邦查询**。如果确实需要，交给 Trino 这类引擎，而不是在插件里实现 join。
- ❌ **不允许 API 数据源写入**（M1/M2）。
- ❌ **不改 `AiNodeKind` / ADR-0001 的 `@`提及 语法**。API 数据源在 AI 侧就是普通的连接/schema/表。
- ❌ **不引入新的服务进程**。dbx-pro 的服务端仍是单个 `dbx-engine`（`host-node`）。

---

## 7. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 用户不愿额外部署引擎 | 方案落地率低 | M1 只交付「Steampipe 单二进制 + 一份配置示例」；跑不起来就不是插件的问题 |
| 第三方引擎插件质量参差 | 字段缺失、只读、限流后行为不透明 | 错误**原样透传**，不替引擎美化；文档写明「能力上限由引擎决定」 |
| 生态洗牌（`Canner/wren-engine` 已归档） | 文档指向的仓库失效 | 文档只承诺**协议**（Postgres wire protocol），不承诺具体引擎版本；同时列出 Steampipe / Trino 两个备选 |
| 深层分页在引擎侧很慢 | 导出进度条卡在 indeterminate，（#5 的观感问题复活） | 复用已有的 `latestKnownTotalRef` 回填 + 明确「引擎未返回总数」提示，而不是假装在动 |
| 用户误以为插件内置了某公司 API | 支持成本外溢 | 详情页/文档统一表述为「通过兼容 SQL 引擎接入」 |

---

## 8. 里程碑

### M1 —— 打通与验证（不改插件代码）

- [ ] 用 **Steampipe**（单二进制，7,977★，Go）暴露一个真实 API 数据源，监听本地 PG 端口
- [ ] 在 dbx-pro 里以 `postgres` 类型连接，验证四件事：连接树能看到外发表、SQL 查询返回行、结果网格导出正常、行数上限/分页不报错
- [ ] 写一份 `docs/` 接入说明（引擎部署 + dbx-pro 连接），**明确这是外部依赖而非插件内置能力**
- [ ] 记录失败模式：哪些查询在引擎侧不可下推、错误文本长什么样

### M2 —— 体验补齐（小改动）

- [ ] 针对「引擎未返回总数」的情况，让导出进度的降级提示准确（与 #5 的修复对齐，不复现 indeterminate）
- [ ] 连接树对只读数据源的表现：不显示写相关菜单项（生成 INSERT/UPDATE/DELETE、VACUUM、删除表等），避免用户点了才报错
- [ ] 连接失败/超时的错误文本补一句「若数据源经外部引擎接入，请先确认引擎自身可达」

### M3 —— 按需评估方案 C

- [ ] 只有在 M1/M2 之后**仍存在明确无法用外部引擎覆盖的内部 API**时，才评估轻量只读 API 数据源
- [ ] 评估门槛：必须能只读、只 GET、且接口契约稳定；否则回到方案 B
- [ ] 若启动，需一并更新 `connection-config.ts`、`request-router.mjs`、`classifyError`、`table-search.ts`、以及 `plugin.json` 的出站白名单

---

## 9. 验收标准

### M1

- [ ] 一个真实 API 数据源，经外部引擎后可作为 `postgres` 连接被 dbx-pro 连接成功
- [ ] 该连接下能列出对象、能执行 SQL、结果进入结果网格
- [ ] 导出该结果集可用，且进度条**不出现**无意义的 indeterminate 状态（若引擎不返回总数，显示明确提示）
- [ ] 关闭引擎后，连接失败的报错是诚实的（指出连接失败，而不是伪造一个空结果）
- [ ] `docs/` 中的接入说明能让一个没参与本次调研的人独立跑通

### 通用

- [ ] 未修改 `plugin.json` 的 `network.allowedHosts`
- [ ] 未新增 `DB_TYPE_MANIFEST` 条目（M3 之前）
- [ ] `TreeNodeKind` / `AiNodeKind` 未新增成员
- [ ] 既有 SQL 数据源行为零回归
