# ADR-0008: 通过 API 访问数据 —— 把非 SQL 数据源接入 dbx-pro 的能力边界

## 状态

提案中，待评审。目标实施版本 v0.4.x。M0 / M1 / M1.5 前置验证已于 2026-10-09 实测完成；**2026-10-10 需求澄清后本 ADR 的决策已修正**：产品主线改为**在插件内建「API 接入」连接类型**（原方案 C），由 M2 承担落地；方案 B 降级为可选执行后端。

**下一步主线是 M2 —— 在插件内建「API 接入」连接类型（原方案 C），本节以下内容是已完成的实测基础与备选后端。**

**M0 与 M1 已完成实测（2026-10-09）**：

- **M0**：零代码路径（`duckdb`）端到端可用，但 `duckdb` 的 DDL 在当前形态下无路可走（插件侧无 duckdb 写驱动、引擎侧 MCP 策略拦高危 SQL）—— 公开只读 API 今天就能查，**需要认证头的接口走不通**。
- **M1**：外部 SQL 化引擎这条路**已端到端跑通** —— 一个需要认证头的 HTTP 接口经引擎暴露成 PG wire protocol 后，dbx-pro 用现成的 `postgres` 类型就能：对象树列出对象、SQL 携带认证头取数、与本地表 JOIN、聚合。验收项 3/4 通过（「结果网格导出」为 UI 行为，未实测）。

实测记录：[m0-notes](../plans/api-data-access-m0-notes.md) / [m1-notes](../plans/api-data-access-m1-notes.md) / [m15-notes](../plans/api-data-access-m15-notes.md)，实施方案见 [api-data-access-implementation-plan.md](../plans/api-data-access-implementation-plan.md)。

调研数据取自 **2026-10-08 与 2026-10-09 两轮 GitHub 公开 API 实测**（星标 / 最近推送时间 / 活跃状态均为当日实测值）。第二轮（10-09）新增了对 dbx 上游插件体系的实测，得到四条改变结论的发现，见 §0。第三轮（10-09）在本仓库的引擎上做了 M0 连通性实测，新增六条事实，见 §0.1。第四轮（10-09）做了 M1 端到端实测（外部 SQL 化引擎 → 普通 `postgres` 连接），新增七条事实与**两处对自己旧结论的更正**，见 §0.2。**第五轮（10-10）是需求澄清导致的决策修正：产品主线从方案 B 改为方案 C（插件内建「API 接入」），见 §0.3。**

---

## 0. 本轮（2026-10-09）增量结论

| # | 发现 | 对决策的影响 |
|---|------|-------------|
| 1 | dbx 上游**已经有一套完整的插件体系**（`.dbxp` 包、manifest v1、Host API 1.x、sidecar 协议 v1、官方商店 `t8y2/dbx-store`），并且有 `connection-provider` 贡献点可以声明新的连接类型。 | 「插件化」这条路**存在**，但见第 2、3 条：它不通向「新建查询」。 |
| 2 | 上游 `plugins/connection-types/` 是 **85 个编译期 YAML 注册项**，其中 `jdbc.yaml`（通用 JDBC：自定义 JDBC URL + 导入驱动 JAR）与 `plugin.yaml`（外部插件专用界面）是**两个通用扩展入口**。dbx-pro 的 85 行清单与上游逐项比对，**恰好缺这 3 项：`jdbc`、`plugin`、`uxdb`**。 | 最重要的增量。把「自定义数据接口」拆成两个已有入口，其中一个（`jdbc`，`mcpMode: bridge`）**在 MCP 通道上本来就是通的**，只差收录与表单。 |
| 3 | `plugin.yaml` 的 `mcpMode: unsupported` + `queryExecution: false` + `specializedSurface: true`；且上游文档明确「`database_type` 是插件自定义类型标识，**不会给 DBX 内置数据库枚举添加成员**」。 | 「把用户自研 API 做成一个 DBX 插件，然后在新建查询里查它」**在当前上游契约下不成立** —— 插件只能提供它自己的专用界面。降级为上游协作项（M4），不作为落地路径。 |
| 4 | dbx-pro 的 `/health` 返回的驱动清单是**一条硬编码占位**（`request-router.mjs`），`driver-tiers.ts` 是「所有类型均 ready」的空壳。 | 「让扩展连接类型自动出现在下拉」需要真实驱动清单，这是上游/本插件要补的**最后一段路**（M4）。 |
| 5 | **M0 实测（2026-10-09）已在真实引擎上跑通**：用清单里已有的 `duckdb` 类型，`read_json_auto('https://…')` 经 `dbx-mcp 0.4.106` 端到端返回行；`httpfs` 由 DuckDB **静默自动安装加载**，用户无需手动 `INSTALL`。 | 「零代码路径」从推断变成事实：公开只读 API 今天就能查。代价是首次需装 DuckDB 驱动、冷启约 17.5 s。 |
| 6 | **需要认证头的接口在 `duckdb` 路径上走不通**：`CREATE SECRET` / `INSTALL httpfs` 在原始 MCP 路径上返回 `SQL_BLOCKED`（引擎策略）；经插件真实流程时则由写驱动拦下（`duckdb` 不在写驱动覆盖的三大家族内）。 | 这条把 M1 从「可选」变成「必需」：带 Token 的 API 只能走外部引擎或 JDBC。**M1 已实测跑通此路**（见 §0.2）；若要为 `CREATE SECRET` 开窄口子，那是一次**独立的安全决策**，不在本次落地范围。 |

### 0.1 M0 实测结论（本仓库，2026-10-09）

完整记录（含复现配方与原始证据）见 [plans/api-data-access-m0-notes.md](../plans/api-data-access-m0-notes.md)。

| 结论 | 实测证据 |
|------|---------|
| `duckdb` 路径可用 | `read_json_auto('https://jsonplaceholder.typicode.com/posts?_limit=3')` → 3 行；`read_csv_auto('https://raw.githubusercontent.com/plotly/datasets/master/2014_usa_states.csv')` → 3 行 |
| 扩展无需用户手动装 | 取数**前** `httpfs installed=false, loaded=false`；取数**后** `installed=true, loaded=true`；而显式 `INSTALL httpfs` 反而被闸门拦成 `SQL_BLOCKED` |
| **认证头不可达** | `CREATE OR REPLACE SECRET … (TYPE HTTP, EXTRA_HTTP_HEADERS MAP {…})` → `Error [SQL_BLOCKED]` |
| `jdbc` 运行时可用 | `dbx_add_connection { db_type:"jdbc" }` 被接受并持久化 —— 附录 B 第 2 问结案 |
| JDBC 运行时来自桌面端 | `~/Library/Application Support/com.dbx.app/plugins/jdbc`（manifest v0.1.43，`kind: external`，带 `dbx-maven-resolver` 与 `drivers/maven/` 缓存）—— **不由 `dbx-mcp` 提供** |
| DuckDB 驱动需单独获取 | 未设 `DBX_DUCKDB_DRIVER_PATH` → `DuckDB driver is not installed. Please install it from the Driver Manager…`；驱动是独立可执行文件（v0.1.29，macos-aarch64 6.7 MB），非 dylib |

**未实测**（列为开放问题，不得当作结论）：ClickHouse `url()` 表函数、深层分页与大结果集。（其中 PG + `pgsql-http` 与认证头通路已在 **M1** 实测，见 §0.2。）

### 0.2 M1 实测结论（本仓库，2026-10-09）

完整记录（含复现配方与原始证据）见 [plans/api-data-access-m1-notes.md](../plans/api-data-access-m1-notes.md)。

| 结论 | 实测证据 |
|------|---------|
| **外部引擎路径端到端成立** | 本地认证接口（`Authorization: Bearer …`）：不带头 `401`，带头 `200`；`X-API-Key` 同样 `200` |
| **带认证头的取数在 SQL 里可达** | `http(row('GET', uri, http_headers('Authorization','Bearer …'), null, null)::http_request)` + `json_to_recordset()` → 3 行 |
| **完整 SQL 语义可用** | 同一份 API 数据上做 `WHERE` / `ORDER BY` / `count(*)` / `sum()`，并与**本地表 JOIN**（3 行命中） |
| **对象树能列出 API 对象** | `dbx_list_tables` → `api_rows (VIEW)` / `dim_region (BASE TABLE)`；`dbx_get_schema_context` 返回完整列清单 |
| **1000 行硬上限不报错** | 3000 行接口 + `max_rows=5000` → 返回 1000 行、`isError=false`，尾部提示 `the 1000-row cap was reached` |
| **4xx / 5xx 不算查询错误** | 404 路径 → `status=404` 作为**结果列值**返回，不是错误 —— `count(*)` 仍能拿到真实总数 3000 |
| **首选引擎在本机太慢，不足以支撑验收** | Steampipe 的 `.plugin` 制品是 **GHCR 上的 OCI 镜像**（`installed_from: ghcr.io/turbot/steampipe/plugins/turbot/hackernews:1.2.0`），索引走 `hub.steampipe.io`（GitHub Pages）；实测单流 ≈0.9 MB/min，插件安装耗时 19 分钟，`service start` 再拉内嵌 PG + FDW 25 分钟仍未监听。→ 改用 PG 17 + `pgsql-http` 完成验收 |

**两条与旧版不同的认识（已回写 §4）**：

1. `SQL_BLOCKED` 的归属此前记错了。真正的硬拦来自**引擎侧的 MCP 策略**（`allowDangerousSql`），不是插件的 `classifyQuery`；插件那层只是「需要确认」的写闸门，点确认就能过。
2. **「把 API 建成视图」这个启用步骤可以在「新建查询」里完成** —— dbx-pro 的写驱动（`server/src/write/direct-write.mjs`）覆盖 PG / MySQL 系 / SQL Server，实测能成功执行 `create extension` / `create view`。唯一的带外前置是**数据库服务端装好对应扩展**（如 `http`），属环境前置，不是产品缺陷。

### 0.3 M2 决策修正（2026-10-10，需求澄清）

用户把需求说清楚了，本 ADR 旧版**理解偏了**。原话（第三轮澄清）：

> 需要在「新建连接」里有一个一级入口叫**「API 接入」**：点击后可以连接各种（公司内部或任意语言实现的）数据接口；API 形式的数据源要在**连接树**里展示；**可以在标签页执行查询**；通过**认证/鉴权**访问数据；结果以**结果网格**显示。

旧版把这条需求读成了「用现成的 `postgres` / `duckdb` 类型连上一个外部 SQL 化引擎即可」（方案 B），因此把方案 C（内置只读 API 数据源）写成「远期可选、本次明确不实现」。**这是错的**：用户要的是**产品里的一等公民连接类型**，不是「让用户自己搭一个引擎再当 PG 连」。据此修正：

| # | 旧结论 | 修正后的结论 |
|---|--------|-------------|
| 1 | 方案 C「远期可选、本次不实现」 | **方案 C 升为产品主线**，由 M2 承担本次落地 |
| 2 | 方案 B 是 M1 主线 | 方案 B 保留为**可选执行后端**（用户自备引擎时仍可用），不再是主线 |
| 3 | 「插件化」不可行 → 只登记为上游协作项 | **对第三方 `.dbxp` 插件确实不可行（§3 方案 D 结论不变）**；但 **dbx-pro 自己内建**一个连接类型**完全可行** —— dbx-pro 自带 Node 服务层，已有先例：自研写驱动 `server/src/write/direct-write.mjs` 就是绕过 `dbx-mcp` 的自有数据通路 |
| 4 | `jdbc` 是本轮最便宜的入口（M1.5） | M1.5 已实测**上游阻塞**（MCP 通道传不进 JDBC URL），不作为落地路径 |

关键判断：**「引擎的 `DB_TYPE_MANIFEST` 是硬编码的」这条约束，只约束「往引擎里加类型」，不约束「插件自己造一条数据通路」。** dbx-pro 的 `/query` 路由是自己写的（`server/src/engine/request-router.mjs`），它完全可以在识别到 `api` 类型连接时**不走 `dbx_execute_query`**，自己取数、自己执行。这与写驱动的存在方式完全同构，不需要上游任何改动。

---

## 1. 问题陈述

dbx-pro 现有的数据访问模型是**单一的 SQL 通道**：

```
插件 UI ──► /query (request-router) ──► dbx-mcp 子进程 ──► 数据库驱动 ──► SQL 结果集
```

这条通道有三个硬约束：

1. **对象模型是「库 / schema / 表 / 列」**。连接树、SQL 补全、表搜索（`table-search.ts`）、例程目录（`routines-catalog.ts`）全部建立在 `TreeNodeKind = "connection" | "schema" | "table" | "column"` 之上。
2. **查询语言是 SQL**。`classifyQuery()` 只认识 SQL 语句形态；分页（`sql-pagination.mjs`）靠 `SELECT * FROM (...) LIMIT/OFFSET` 包裹实现。
3. **数据源必须能进 `DB_TYPE_MANIFEST`**。该清单共 **85 行**（源码注释与本文旧版写作「84 种」，实测已更新），且**清单本身是硬编码的唯一来源** —— 连接类型下拉、分组、默认端口、文件型判定全部从它派生（`connection-type-catalog.ts`），没有任何从引擎动态获取类型的通道。

> **对旧版问题陈述的修正。** 旧版写「85 个类型全部是数据库/数仓/驱动，没有任何 API 形态」，这不准确：清单里已经有 `salesforce`、`dynamodb`、`etcd`、`consul`、`influxdb`、`victoriametrics`、`mq`、`mqtt`、`nacos`、`hbase` 等**非关系型/服务类数据源**，其中 `salesforce` 与 `dynamodb` 本身就是纯 HTTP API 后端（`family: "flat"`、`schemaAware: false`、`treeSchema: false`）。所以上游的文件模型里，**「一个不是数据库的东西」本来就是一个连接类型**。
>
> 真正的缺口不是「不支持 API」，而是**「没有一个用户可自配置的通用 API 数据源类型」**：已有的 API 类类型全是**闭集**（Salesforce / DynamoDB 由上游内置实现），用户无法自行指向公司内部接口。

而真实需求是：**数据已经通过公司内部 API 暴露了**（业务中台、指标平台、SaaS 开放接口、自建网关）。用户想要的不是「再连一个库」，而是：

> 在同一个工作台里，用同一种交互（连上 → 看到目录 → 查询 → 结果网格 → 导出 → 可视化）去访问 API 背后的数据。

### 1.1 需求拆解

| 诉求 | 是否等价于「加一个数据库类型」 | 说明 |
|------|------------------------------|------|
| 「调用 API 拿数据，结果进结果网格」 | ❌ 不止 | 分页/过滤/认证语义完全不是 SQL |
| 「公司内部自定义 API 接口访问数据」 | ❌ 不止 | 接口契约由公司自定，需要可配置的映射层，或用 JDBC 这类既有中间协议 |
| 「像查表一样按需查询」 | ✅ 接近 | 可以用 SQL 语义包装，见方案 B / M0 |
| 「跨多个 API 做联合查询」 | ❌ 不属于本次范围 | 见 §7 非目标 |
| 「用 AI 直接问 API 数据」 | ✅ 复用现有 AI 链路 | 已有 `send-context.ts` / tool handler |

### 1.2 必须回答的七个硬问题

任何方案在落地前都要能明确回答以下七问，否则会在实现中期炸开：

1. **凭据与认证**：API key / OAuth token / 签名密钥存在哪？由谁保管、谁能读？插件是否有权把它写进磁盘？
2. **查询语义**：用户侧表达的「查询」是 SQL、过滤 DSL，还是一次 REST 调用？如何与既有 SQL 编辑器共存？
3. **目录与树模型**：没有 schema/表的 API，在连接树里长什么样？懒加载边界在哪？
4. **分页与行数上限**：API 的 `cursor` / `page+size` 与工作台的 `ENGINE_ROW_CAP = 1000`、`totalRows` 如何对齐？进度条能不能拿到真实总数？
5. **写入边界**：只读？还是允许 POST/PUT？如果允许，如何复用现有 `SQL_BLOCKED → 用户确认 → allowWrite` 的确认闸门？
6. **错误契约**：HTTP 4xx/5xx、限流、超时如何映射进既有 `DBX_*` 错误码（`markdown-parser.mjs: classifyError`）？错误必须是诚实的（沿用「只分类、不改写原始 message」的审计要求）。
7. **边界归属**：把 API 拉进 dbx-pro，还是要求外部系统把 API 暴露成 SQL / JDBC / MCP，由 dbx-pro 只做聚合？

---

## 2. 上游 dbx 已有的扩展机制（2026-10-09 实测）

这一节是第二轮的产出，也是本 ADR 结论变化的原因。所有行号与原文均来自实测。

### 2.1 插件体系是完整的，而且是官方运营的

| 机制 | 实测内容 |
|------|---------|
| 包格式 | `.dbxp`，确定性打包 + Ed25519 签名（`plugins/sdk/packager`，`plugins/RELEASING.md`、`plugins/SIGNING.md`） |
| 契约版本 | manifest v1 + Host API 1.x（已见 1.1 / 1.2 / 1.3 / 1.4 分档）+ sidecar 协议 v1 |
| 贡献点 | `connection-provider`、`workbench`、`filesystem-provider`、`context-menu`、`result-view`、`command`、`menus`、`mcp` |
| 权限模型 | `host.events` / `host.binary` / `host.workbench` / `host.filesystem` / `host.plans:read` / `host.schema:read` / `host.storage` / `host.ai` / `host.clipboard:read` / `host.data:read`，以及按主机的 `host.network:https://<host>[:port]`（最多 8 个） |
| 后端进程 | 插件自带可执行文件，transport 为 `stdio-jsonl`（默认）或 `stdio-framed`；主机侧生命周期固定为 `connection/test` / `connection/connect` / `connection/disconnect` |
| SDK | 上游自带 Rust / Go SDK；CLI 发布为 `@dbx-app/plugin-cli`；模板 `frontend` / `svelte` / `rust` / `go` |
| 商店 | 官方目录 `t8y2/dbx-store`（`catalog/index.json` + `plugins/*.json` + `publishers/*.json`），本轮逐项枚举到 16 个插件（HTTP 客户端、Kafka、LDAP、SSH、S3、Docker、K8s、NATS、Prometheus、OTel、XXLJob、RocketMQ、Portainer 等）；目录带 `signingKeyId` 与 sha256 校验 |
| 文档 | `docs/content/docs/plugin-development.cn.mdx`（约 70 KB，含完整 contribution 协议） |

**商店里已经存在 HTTP/API 类插件**：`com.jettech.httpclient`（Postman 风格 HTTP 工作台）、`io.dbx.nintyapi`（接口集合 / 历史 / cURL 互转）、`io.github.caichangqing1120.prometheus`。它们证明「API 数据」确实是上游认可的插件题材 —— 但**都是工作台形态，不是可查询的数据源**（见 2.3）。

### 2.2 内置连接类型是「编译期注册表」，不是用户可安装的

上游仓库的 `plugins/connection-types/` 是 **85 个 YAML**（`access.yaml` … `zookeeper.yaml`），`plugins/README.md` 对它的定义是：

> `connection-types/` = "build-time registry for every DBX connection target, including databases, data services, message queues, and service registries."

即：**内置枚举成员由 DBX 自己编译进去**；第三方 `.dbxp` 插件声明的连接类型是插件私有标识，不会进入这个注册表。

### 2.3 两个通用扩展入口（关键）

上游注册表里有两个专门为「非内置数据源」准备的类型，它们就是「自定义」这个字面需求的现成答案：

| | `jdbc.yaml` | `plugin.yaml` |
|---|---|---|
| `dbType` | `jdbc` | `plugin` |
| `label` | JDBC | Plugin |
| `runtimeMode` | `external` | `external` |
| **`mcpMode`** | **`bridge`** | **`unsupported`** |
| `formKind` | `jdbc` | —（`specializedSurface: true`） |
| `supportLevel` | `browse` | `connect` |
| `traits` | `schemaAware` / `treeSchema` / `databaseObjectTree: true` | 无 |
| `queryExecution` | **`true`** | **`false`** |
| 其余 capabilities | `metadataBrowse` / `objectBrowser` / `sqlFileExecution: true` | 全 `false`（含 `metadataBrowse` / `objectBrowser` / `sqlExplain`） |
| 含义 | **通用 JDBC 连接：自定义 JDBC URL + 导入驱动 JAR** | **外部插件连接：宿主只渲染表单，业务界面由插件自己的专用 surface 提供** |

`mcpMode` 这一列是本 ADR 的分水岭：dbx-pro **唯一的连接路径是 `dbx-mcp`**，所以

- `jdbc`（`bridge`）→ **理论上经 MCP 通道可用**，只要 dbx-pro 收录并给出表单；
- `plugin`（`unsupported`）→ **在 MCP 上不可达**，因此插件式连接**结构上无法进入 dbx-pro 的新建查询**。

上游驱动管理文档同样确认了 JDBC 这条通用路径的存在：

> 「通用 JDBC 连接（自定义 JDBC URL + 导入的驱动 JAR）通过独立的 **DBX JDBC 插件** 运行，发布为单独的 `dbx-jdbc-plugin-*.zip` 资源……请在 **JDBC 驱动** 页签使用 **本地安装** 安装」

### 2.4 上游的驱动架构是混合式的，所以「加驱动」是上游的事

`docs/content/docs/driver-management.cn.mdx`：DBX 使用**混合驱动架构** —— 内置 Rust 驱动 / 独立原生 Agent（Go·Rust 独立进程或 sidecar）/ Java·JDBC Agent（子进程）/ JDBC 插件。这意味着给 DBX 增加一个**一等公民**数据源类型是上游的常规工作，有明确路径，但**发生在 dbx 仓库，不在本仓库**。

### 2.5 把上游机制映射回本次需求

| 用户的说法 | 上游能力 | 是否通向「新建查询」 |
|-----------|---------|------------------|
| 「集成到新建查询的自定义」 | `jdbc` 通用入口（自定义 JDBC URL + JAR） | ✅ 可查询（`mcpMode: bridge`），只差 dbx-pro 收录 |
| 「插件化」 | `.dbxp` + `connection-provider` 贡献点 | ❌ 插件类型不进内置枚举，且 `plugin` 在 MCP 上 `unsupported`；插件只能提供自己的专用界面 |
| 「插件化」 | 上游驱动插件 / 原生 Agent | ⚠️ 可以，但等于向上游贡献驱动，交付物在 dbx 仓库 |
| 「API 数据源」 | 数据库内 HTTP 取数（DuckDB / ClickHouse / PG 扩展），或外部 SQL 化引擎 | ✅ 零代码，见 §3 方案 B 与 M0 |

---

## 3. 候选方案

### 方案 A（新）：收录上游已有的 `jdbc` 通用入口

上游已经实现好了这个类型，dbx-pro 只是**没有收录**。工作量集中在三处：

1. `DB_TYPE_MANIFEST` 增加一行 `jdbc`（`mcpMode: "bridge"`、`family: "flat"`、`schemaAware: true`）；
2. 连接表单增加 JDBC 变体（JDBC URL + 驱动 JAR 选择），既有表单是 host/port/user/password 固定形态，需要分支；
3. 连接测试 / 错误文案。

**优点**

- **成本最低、最贴合「自定义」字面需求**：任何有 JDBC 驱动的数据源（含 CData、ZappySys 等商业 JDBC-over-REST 驱动）立刻可用。
- 复用既有的「导入 JAR 是本地操作、不需要网络」的安全属性。
- 不新增进程、不新增 DSL、不放开 `network.allowedHosts`。

**缺点 / 未验证**

- **`dbx-mcp` 是否携带 JDBC 插件尚未证实**：JDBC 插件是单独的 `dbx-jdbc-plugin-*.zip`，而 dbx-pro 的引擎是固定的 `dbx-mcp` 二进制（`runtime-lock.json` 钉 `0.4.106`）。这是 M1.5 的第一个验证项。
- 「API → JDBC 驱动」这一步通常意味着**引入商业驱动**，免费路径有限。
- 需要产品决策：JDBC 表单把「导入 JAR」暴露给用户，是权限与支持面的扩张。

### 方案 B：把 API 数据源交给外部联邦引擎，dbx-pro 只见 SQL（**降级为「可选执行后端」**）

不新增数据源类型，而是**让 API 变成 SQL 可查的东西**，dbx-pro 继续走它已经打磨好的 SQL 通道：

| 引擎 | 真身 | 星标（2026-10-09） | 语言 | 最近推送 | 活跃 |
|------|------|------------------|------|---------|------|
| [turbot/steampipe](https://github.com/turbot/steampipe) | 「零 ETL，SQL 直查 API」——每个 API 一个插件，Postgres FDW 暴露成表 | 7,979 | Go | 2026-10-07 | ✅ |
| [turbot/powerpipe](https://github.com/turbot/powerpipe) | Steampipe 同门的仪表盘/基准工具，复用同一批 API 插件 | 523 | Go | 2026-10-07 | ✅ |
| [trinodb/trino](https://github.com/trinodb/trino) | 分布式 SQL 引擎，连接器生态最全 | 13,311 | Java | 2026-10-08 | ✅ |
| [apache/calcite](https://github.com/apache/calcite) | 可嵌入的 SQL 解析/优化框架，自建 FDW 式适配层的地基 | 5,192 | Java | 2026-10-08 | ✅ |
| [apache/datafusion](https://github.com/apache/datafusion) | Rust 查询引擎，自研「SQL 化」时的首选内核 | 9,424 | Rust | 2026-10-08 | ✅ |
| [apache/drill](https://github.com/apache/drill) | Schema-free SQL 直查 JSON/Parquet/文件与 REST | 2,026 | Java | 2026-10-07 | ✅ |
| [apache/dremio-oss](https://github.com/dremio/dremio-oss) | 联邦查询 + 数据源插件 | 1,496 | Java | 2025-09-26 | ⚠️ 半年未推 |

**优点**

- dbx-pro 不需要理解 API：只要目标引擎暴露 Postgres 线协议（Steampipe / Trino / 已有 PG + `pgsql-http` 都能），它就是**一个普通 PG 连接**，`DB_TYPE_MANIFEST` 里的 `postgres` 直接可用。**M1 已实测**。
- 目录、分页、导出、可视化、AI —— 全部零改动。
- 安全边界清晰：出站访问发生在用户自己部署的引擎里，不是插件进程里。

**缺点**

- 用户要**额外部署一个引擎**（门槛高于「填个 URL」）。**但 M1 实测发现门槛不对称**：如果用户手上已有 PG，装一个 `pgsql-http` 扩展即可（低于部署新服务）；而原本的首选 Steampipe 在本机网络下**单插件安装就要 ~20 分钟、服务启动 ~40 分钟起**，不具备交互式可部署性。
- 真值最终取决于第三方引擎的插件质量（Steampipe 的某个 API 插件只读、字段有限）。
- `Canner/wren-engine`（661★）**已于 2026-05-06 归档**并合并进主仓库 —— 这条生态在快速洗牌，不宜绑死单一引擎。
- **对旧版的修正**：旧文写「Trino 连接器生态最全（含 REST）」。实测 Trino **没有官方通用 REST 连接器**；社区 `nineinchnick/trino-rest` 仅 17★ 且只针对 GitHub API。Trino 擅长的是「对已有数据库做分布式 SQL」，不擅长「对任意用户 API 做 SQL 化」。

### 方案 C：插件内建「API 接入」连接类型（**主线，本次采纳**）

在「新建连接」里新增一个一级入口 **「API 接入」**（`db_type: "api"`）：用户填一个 HTTP 接口即可把它变成工作台里可查询的数据源。它是**插件自有类型**，不进引擎清单，因此不受上游约束（对比方案 D）。

**为什么这条路通**：dbx-pro 的数据通路是自己的 Node 服务（`server/main.mjs` → `http-server.mjs` → `request-router.mjs`），`/query` 路由、错误信封、结果形状都由插件定义。识别到 `api` 连接时走插件自己的取数驱动即可 —— 与既有自研写驱动（`server/src/write/direct-write.mjs`）同构，**不需要上游任何改动**。

**执行模型：认证由插件施加，SQL 由成熟引擎执行**

1. 插件按连接配置（URL / 方法 / 请求头 / 认证方式 / 数据路径）发请求，**认证头在插件进程里注入**；
2. 响应按「数据路径」（如 `data.items`）抽出记录数组，归一化成 NDJSON 落到 `<数据目录>/api-cache/<name>.ndjson`；
3. 用户 SQL 里的数据源名（= 连接名）被重写为该文件上的 `read_json_auto('<绝对路径>')`；
4. 重写后的 SQL 交给引擎在一个**插件托管的本地 `duckdb` 连接**上执行；
5. 结果按既有 `toOutcome` 形状返回 —— 结果网格、导出、可视化、AI 全部零改动复用。

取舍：

- **不手写 SQL 引擎**：DuckDB 提供真 SQL（`WHERE` / `JOIN` / 聚合 / 窗口），符合「不要手写低质量替代实现」；
- **绕开 `CREATE SECRET` 死结**：M0 / M1 已实测 `CREATE SECRET` 在原始 MCP 路径被 `SQL_BLOCKED`、在写驱动路径被 `WRITE_UNSUPPORTED`（duckdb 不在覆盖家族内）。认证必须在插件侧完成，这恰好是唯一可行且安全的位置；
- **代价**：需要 DuckDB 驱动（M0 已证明可安装），且每次查询前要取数物化（冷启慢，见 §8）。

**优点**

- 门槛最低：填 baseURL + 端点 + token 即可，**不需要用户部署任何引擎**；
- 覆盖面足够广：公司内部指标的 `GET /metrics?code=xxx` 这类接口占绝大多数；
- 认证 / 鉴权是一等能力（Bearer / API-Key / Basic / 自定义头），直接命中需求里的「通过认证鉴权访问到数据」；
- 数据源进连接树、进标签页、进结果网格 —— 产品的四条诉求全部命中。

**缺点 / 未验证**

- **只读**：第一版只支持 `GET`（后续可扩 `POST`），写入不在此范围；
- **快照语义**：查询前取数，不是流式；大结果集受引擎 1000 行硬上限（M1 已实测）；
- **`network.allowedHosts` 必须放开**：当前是 3 个发布域名静态白名单，用户自填 URL 意味着需要放开通配或引入逐连接授权 —— 这是一次**独立的安全决策**，见 §4.2；
- 声明式映射（数据路径 / 分页字段）是一门小 DSL，需要克制，并防「字段猜错就静默出空表」；
- 与 ADR-0001 的 `@`提及 语法、`TreeNodeKind` 有交互，需要定义「表从哪里来」（见 §4.2）。

### 方案 D：插件化 —— 由第三方 `.dbxp` 插件提供 API 数据源（**不可行，登记为上游协作项**）

这是本轮最需要说清楚的一条，因为它表面上最像用户说的「插件化」。

**实测到的硬约束**

1. 上游文档原文：**「`database_type` 是插件自定义类型标识，不会给 DBX 内置数据库枚举添加成员。」**（`plugin-development.cn.mdx`）
2. 插件连接类型 `plugin` 的能力位是 `queryExecution: false` + `specializedSurface: true`，且 **`mcpMode: unsupported`**。
3. 插件能用的 Host API 方向是**「插件 → 宿主数据」**，**不是「宿主查询插件的数据」**：`queryData({ connectionId, database?, schema?, sql, maxRows?, timeoutMs? })` 只能在**用户已授权且已经打开的 DBX 连接**上跑一条只读单语句（`maxRows` 默认 500、上限 5000；行数据上限 8 MiB），且「Redis、MongoDB、搜索引擎等非 SQL 连接不提供该能力」。它是给插件渲染图表用的读接口，不是「让工作台查询插件数据」的入口。
4. dbx-pro 唯一的数据路径是 `dbx-mcp`。

**结论**：`.dbxp` 插件可以让 DBX 多一个「专用连接 + 专用界面」，但**不能让这个连接变成 SQL 工作台里可查询的数据源**，更不能经 MCP 进入 dbx-pro。因此「把用户自研 API 做成插件 → 在新建查询里查它」在当前上游契约下**不成立**。

**但它是可讨论的上游协作项**：如果上游把扩展连接类型纳入驱动清单（并让 `/health` 如实上报），或为 MCP 侧提供扩展类型枚举，方案 D 才会变成真路径。登记为 M4。

### 方案 E：只做 MCP —— 由外部系统暴露能力，dbx-pro 不碰 API（登记，不变）

让外部系统（或数据网关团队）把接口包成 MCP server，dbx-pro 只负责 MCP 连接管理。

**优点**

- 零新增数据访问代码，安全边界最干净。
- 与官方市场的 MCP 形态完全一致（`abilities/mcp/*`），甚至可以只发一个 `mcp.json`。

**缺点**

- 不解决「用结果网格看 API 数据」这条需求：MCP 返回的是给 AI 读的文本，不是可排序/可导出/可可视化的表格。
- 每个外部系统都要各自实现 MCP，重复建设。

---

## 4. 决策

> **【2026-10-10 决策修正】产品主线改为方案 C —— 在 dbx-pro 里内建一个一级连接类型「API 接入」（`db_type: "api"`），由 M2 负责落地。认证头由插件进程注入，取到的数据物化为 NDJSON，用户 SQL 交给引擎托管的本地 `duckdb` 连接执行，结果以既有结果网格形状返回。方案 B（外部 SQL 化引擎 → 普通 `postgres` 连接）保留为可选执行后端，不再是主线。方案 D（第三方插件）在当前上游契约下仍不成立，保持 M4 上游协作项。**
> 
> **M0 已于 2026-10-09 完成实测：`duckdb` 路径端到端可用；`duckdb` 的 DDL 无路可走，因此认证头接口需走插件自有取数路径（M2）或外部引擎（M1）。**
> 
> **M1 已于 2026-10-09 完成实测：外部 SQL 化引擎 → 普通 `postgres` 连接这条路端到端跑通，认证头、JOIN、聚合、行数上限均实测通过。ADR 的首选引擎 Steampipe 在本机网络下慢到不可交互（插件安装 19 分钟、服务启动 25 分钟未就绪），实际验收用 PG 17 + `pgsql-http` 完成 —— 这反向印证了「只承诺协议、不绑引擎」。证据见 [plans/api-data-access-m1-notes.md](../plans/api-data-access-m1-notes.md)。**
> 
> **M1.5 前置验证（2026-10-09）给出否定结论：`jdbc` 插件能被引擎启动，但 MCP 通道传不进 JDBC URL —— 只改清单与连接表单做不出能用的功能。证据见 [plans/api-data-access-m15-notes.md](../plans/api-data-access-m15-notes.md)。**

理由：

1. **方案 C 才是用户要的东西。** 用户的原话是「在新建连接里有一个入口叫 API 接入」，而不是「教我用 PG 连一个自己搭的引擎」。方案 B 能够今天就用，但它把「搭引擎、装扩展、写 `http(row(…)::http_request)`」这套复杂度转嫁给了用户；ADR 旧版把「实现简单」当成了「需求命中」，这是理解偏差（见 §0.3）。
2. **「插件化不通」只适用于第三方 `.dbxp`，不适用于 dbx-pro 自己。** 上游契约封死的是「插件给 DBX 内置枚举添成员」；而 dbx-pro 本来就拥有自己的服务层与自己的 `/query` 路由，写驱动 `direct-write.mjs` 已经证明「自有数据通路」在本插件内合法存在。
3. **不要把安全边界夹带进功能需求。** `network.allowedHosts` 从 3 个静态域名变成用户可填，是一次独立的安全决策 —— 本次把它显式写在 §4.2，由评审单独决议，而不是默默放开。
4. **不要手写 SQL 引擎。** API 数据必须能被真 SQL 查询（`WHERE` / `JOIN` / 聚合），自研方言解析器会在三个月内变成债务；M0 已实测的 DuckDB 路径就是现成的执行后端。
5. **认证必须留在插件侧。** M0 / M1 已把 `CREATE SECRET` 的两层堵点实测清楚（引擎 MCP 策略 + 写驱动家族未覆盖 duckdb）。插件进程自己发请求是唯一既可行又不需动上游闸门的位置，而且凭据可以继续放在现有加密凭证库里。
6. **方案 B 不删。** 用户自己已有 PG / Trino / 自建网关时，方案 B 仍是更省事的后端；本轮只把它从「主线」降为「可选后端」，文档保留。

### 4.1 落地形态（M1，已降为可选后端）

不改代码，只补文档 + 连通性验证：目标引擎暴露 PG wire protocol，dbx-pro 用现成的 `postgres` 类型连接即可。**已实测成立（2026-10-09）**：认证头、`WHERE` / `ORDER BY` / 聚合、与本地表 JOIN、对象树列出对象、1000 行上限，全部通过。

引擎是用户的选型，文档只给两条可替换路径，不绑单一发行版：

| 路径 | 部署形态 | 实测状态 |
| --- | --- | --- |
| PostgreSQL + `pgsql-http` | 已有 PG 时只需装一个扩展 | ✅ **M1 用它完成全部验收** |
| Steampipe | 单二进制 + 每 API 一个插件 | ⚠ **本机下慢到不可交互**（非不可用）：制品是 GHCR OCI 镜像、索引在 `hub.steampipe.io`（GitHub Pages），单流 ≈0.9 MB/min；插件安装实测 19 分钟，服务启动 25 分钟仍未就绪 |

带认证头的 SQL 形态（`pgsql-http` 的真实契约，写文档时必须带上）：`http_get()` **没有 headers 参数**，必须走 `http(row('GET', uri, http_headers('Authorization','Bearer <token>'), null::varchar, null::varchar)::http_request)`，再 `json_to_recordset((h).content::json)` 展开成表。

一次典型配置（示意，具体参数以引擎文档为准）：

```jsonc
// 不是 dbx-pro 的配置格式，仅说明「API 数据源在 dbx-pro 里就是一个 PG 连接」
{
  "name": "指标平台 (SQL 化引擎)",
  "db_type": "postgres",
  "host": "127.0.0.1",
  "port": 5432,
  "database": "<引擎给出的库名>",
  "username": "<引擎给出的用户名>",
  "password": "***"
}
```

### 4.2 「API 接入」的产品形态（M2 主线）

**连接类型**

| 项 | 取值 |
| --- | --- |
| `db_type` | `api`（**插件自有类型，不进 `DB_TYPE_MANIFEST`**） |
| 分组 | 新增分组「接口」（`category: "Interfaces"`，i18n `接口`），**排在分组列表最前**（实现选择，比原计划「文档 NoSQL 之后」更显眼） |
| 能力位 | 只读（`read_only: true`）；`inferCatalogFamily("api")` 落到 `"flat"`（`findDbType` 未命中时的默认值）；`/schemas` 明确回 `supported: false` |
| 存储 | **只存插件服务进程一侧**：`<dataDir>/api-connections.json`（0600 + tmp+rename 原子写，配置与凭据同文件单份）；**不进引擎**、不进客户端本地镜像 |

> **实现修正（相对本节初稿）**：初稿写「`connections.json` 镜像 + 加密凭证库」，落地时改为「服务端单份 0600 文件 + 凭据不回传」。理由：token 一旦进客户端镜像，就会多出两个副本（浏览器存储、导出备份），而服务端本来就要持有凭据才能发请求；回传体只给 `hasSecret`，客户端保存后再也看不到明文。
| 分组 | 新增分组「接口」（`interfaces`），排在「文档 NoSQL」之后 |
| 能力位 | 只读；`family: "flat"`、`schemaAware: false`、`treeSchema: false`、`tableDataEdit: false` |
| 存储 | **只在插件本地**（`connections.json` 镜像 + 加密凭证库放 token）；不进引擎 |

**为什么 `api` 不进 `DB_TYPE_MANIFEST`**：那份清单是引擎内置注册表的镜像，加一行就等于宣称「引擎认识这个类型」，后续 `toDbxAddParams` / `engineAddConnection` 会把它当成真库去连。`api` 必须走**完全独立的存储与执行分支**，所以由 `connection-type-catalog.ts` 在分组时**追加**，不污染 manifest 计数。

**连接表单字段（第一版）**

| 字段 | 说明 |
| --- | --- |
| 连接名称 | 同时是 SQL 里的表名 |
| 接口地址 | 完整 URL（内网接口允许 `http://`） |
| 请求方法 | 第一版仅 `GET`（`POST` 留待后续） |
| 认证方式 | `none` / `bearer` / `api-key` / `basic`；token / key 值只存服务端 `api-connections.json`（0600），**不写客户端本地镜像、不回传** |
| 认证头名 / 前缀 | `api-key` / 自定义头时使用（如 `X-API-Key`） |
| 自定义请求头 | `key: value` 多行，非敏感 |
| 数据路径 | 从 JSON 响应里定位**记录数组**的点路径（如 `data.items`；留空表示响应本身就是数组） |
| 行数上限 | 单次取数上限（受引擎 1000 行硬上限约束） |

> **实现修正（认证表单，2026-10-10）**：上表「认证头名 / 前缀」在实际表单里曾是**一个框换标签**，于是 Bearer 下也露出一个「令牌」框 —— 而服务端 `normalizeAuth` 对 bearer 直接返回、不读前缀，填了也被丢掉（死控件）；同一个框在 API Key 下叫「令牌」也容易让人把 key 本身填进去，它其实是**值前缀**（拼在凭据前面，`X-API-Key: Token <凭据>`）。现改为：前缀框**只在 `api-key` 下出现**，名为「值前缀（可选）」；`bearer` / `basic` / `none` 不再渲染它。
>
> 同时，请求头的**覆盖语义**对齐凭据：客户端从不收到 `headers`（值里可能藏凭据，与 token 同一套理由），所以表单里那个框天然是空的。缺省（槽位未动过） = **沿用已存值**；显式传（含空对象，即清空后重填） = **整体替换**。`/api-sources/test` 同样回退到已存请求头，否则「测一下」会用一个与真实查询不同的请求。连接摘要新增 `hasHeaders`（只告知有没有，不回传内容）驱动占位文案。

**表从哪来（与 `TreeNodeKind` 的交互）**：第一版**一个 `api` 连接 = 一张表**，连接名即表名；连接树下该连接只有一层「数据源」子节点（展示已发现的字段名），**不引入新的 `TreeNodeKind`**。跨接口的多表 / 多源留到 M2.2。

**执行路径（`/query` 内的「路径 0」）**

```text
api 连接 ─► 插件取数（带认证头）─► 归一化 NDJSON ─► SQL 表名重写 ─► 引擎 duckdb 连接 ─► toOutcome ─► 结果网格
```

**安全决策（需评审单独确认，不夹带在功能需求里）**

1. `network.allowedHosts` 必须从 3 个静态域名放开到**用户可填任意主机**。建议做法：保留 `allowedHosts` 用于发布资产，另为 API 接入提供**逐连接授权**（保存时提示目标主机并记录），而不是直接把白名单改成 `*`。
2. **出站请求只由插件服务进程发起**：认证头在服务端组装，token 单份存于 `<dataDir>/api-connections.json`（0600，见上「实现修正」）。浏览器侧只在保存时提交一次明文，保存成功后任何读接口都不再返回它。
3. **SSRF 边界**：第一版允许 `http://`（内网接口常见），但必须显式标记；至少不得默认跟随重定向到不同主机（待补）。
4. 上游文档明确 `host.network:https://…` 「不是原生 Sidecar 的网络防火墙」，因此**插件服务进程的出站是否真被 `allowedHosts` 约束需要实测**（§8 风险表）。
---

## 5. 与现有架构的接口点

以下路径均为**本仓库实测存在**的代码。行数为 2026-10-09 实测值；标注「第二轮更新」的行为本轮核对/新增。

| # | 路径 | 行数 | 与 API 数据访问的关系 |
|---|------|------|---------------------|
| 1 | `src/domain/connection-config.ts` | 227 | `DB_TYPE_MANIFEST` 共 **85 行**（旧文与源码注释写 84，实测已更正）+ `family: "schemas" \| "databases" \| "flat"`。方案 B **零改动**；方案 A 在这加 1 行；方案 C 需定义 `schemaAware` / `treeSchema` / 分页能力位 |
| 2 | `server/src/engine/request-router.mjs` | 618 | 读路径 `/query` → `dbx_execute_query`；写路径 `classifyQuery` + `SQL_BLOCKED` 确认闸门。**第二轮更新**：第 288 行的 `/health` 响应把 `drivers` 写成**一条硬编码占位** `[{ id: "dbx-cli", label: "dbx CLI (100+ databases)", tier: "first-class", ready: true }]` —— 即真实驱动清单当前不可得，这是 M4 的根因 |
| 3 | `src/domain/driver-tiers.ts` | 82 | **第二轮新增**。已退化为空壳：注释写「由引擎统一覆盖，所有类型均 ready」，`tierStats()` 硬返回 `{ total: 100, ready: 100, pending: 0 }`，`isReadyDbType()` 恒 `true`，`tierFor()` 对未知类型也放行。说明「类型清单该由引擎给」这件事**已经被上游承认，但没接线** |
| 4 | `src/features/database-workspace/services/connection-type-catalog.ts` | 165 | **第二轮新增。** 证明清单是**唯一来源**：分组、默认端口、默认用户名、文件型判定全从 `DB_TYPE_MANIFEST` 派生，无任何引擎侧动态类型通道 |
| 5 | `server/src/engine/markdown-parser.mjs` | 216 | `classifyError()` 的 `DBX_*` 错误码映射（`SQL_BLOCKED` / `CONNECTION_FAILED` / `TIMEOUT` / `READ_ONLY` …）。任何新数据源的错误都要落进这套码，且**只分类、不改写原始 message** |
| 6 | `server/src/engine/protocol.mjs` | 136 | `ok()` / `fail()` 信封与 `jsonReplacer`。新数据源的结果必须能 JSON 序列化（API 的 `Date` / `BigInt` / 循环引用要在这里兜住） |
| 7 | `server/src/write/direct-write.mjs` | 215 | 写路径自带完整连接规格（`resolveWriteConnSpec` 会回填 host/port/database，**不回填 username**）。API 侧若有写操作，无法复用这条路径 |
| 8 | `src/shared/services/engine-client.ts` | 389 | `engineExecuteByName` / `engineListSchemas` / `engineListTables` / `engineDescribeByName`；`EngineHealth.drivers` 的类型已声明为 `{ id, label, tier, ready, reason? }[]`，**消费该字段是 M4 的现成接口**。结果集统一为 `EngineQueryOutcome.rows: Record<string, unknown>[]` |
| 9 | `src/features/database-workspace/hooks/use-workbench-execution.ts` | 316 | 行数上限、`countOnly` 总数回填、`SQL_BLOCKED` → `requestWriteConfirm`。API 的「总数」语义直接决定导出进度条能否精确 |
| 10 | `src/features/database-workspace/services/table-search.ts` | 172 | 连接树搜索走 `engineListSchemas` + `engineListTables`。API 数据源若没有 schema/表概念，搜索会静默返回 `failedConnections` —— 必须有明确的降级表现 |
| 11 | `src/features/database-workspace/services/routines-catalog.ts` | 137 | 「方言覆盖有意保守：拿不准就返回 `null` 让调用方隐藏分组」。API 数据源同理：**宁可没有节点，也不要一个点开就报错的分组** |
| 12 | `plugin.json` | 131 | `network.allowedHosts = ["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]` —— 插件自身的出站白名单。方案 A / B 不需要动它，方案 C 必然要动 |
| 13 | `runtime-lock.json` | — | 引擎制品 `dbx-mcp 0.4.106`，来自 `github.com/maomaochong-ai/dbx/releases/…`（darwin-arm64 / darwin-x64 / win-x64，均带 sha256）。**M1.5 已实测**：二进制自带 `dbx-plugin-runtime`，但插件本体须位于 `<DBX_DATA_DIR>/plugins/<id>/`；桌面端把它装在 `com.dbx.app/plugins/`，dbx-pro 的数据目录下没有（见附录 D.1） |
| 14 | `design.md` | 392 | 现有设计语言；全文 `rest` / `graphql` / `http api` 零命中 —— 说明「API 数据源」是新增能力，不是既有能力的补丁 |
| 15 | `server/src/api-source/`（新增） | — | **M2 新增。** API 接入的取数驱动：认证头组装、HTTP 请求、点路径抽行、NDJSON 物化、SQL 表名重写。与 `write/direct-write.mjs` 同构的「插件自有数据通路」 |
| 16 | `server/src/engine/request-router.mjs` `/query` | — | **M2 改动。** 新增「路径 0」：`db_type === "api"` 的连接不走 `dbx_execute_query`，改走自有取数 + 本地 duckdb 执行。`/connections` 需合并本地 api 连接（引擎不认识它们） |
| 17 | `src/domain/dbx-storage.ts` | — | **M2 改动。** `readAllConfigs()` 现在以引擎列表为准，**只存在于本地镜像的条目会被丢弃** —— api 连接必须在这里保住；`writeConfig()` / `deleteConfig()` 也需对 api 分支短路，不去调引擎 |
| 18 | `src/features/database-workspace/components/connection-fields.tsx` | — | **M2 改动。** 表单当前是 host/port/user/password 固定形态；api 需要一套分支字段（URL / 方法 / 认证 / 数据路径），参考已有的「文件型」分支写法 |

---

## 6. 七个硬问题的当前答案

| # | 问题 | 主线（方案 B，M1）下的答案 | 遗留风险 |
|---|------|--------------------------|---------|
| 1 | 凭据与认证 | 凭据存在**用户自己的引擎**里（Steampipe 的 `~/.steampipe/config/*.spc`；PG + `pgsql-http` 则写进视图定义或 PG 侧配置）；dbx-pro 只存一把 PG 密码，走既有连接配置。方案 A 下凭据由 DBX 的 Secret Store 与 JDBC URL 承担 | 用户可能图省事把 token 写进 PG 连接备注/名称 —— 需要文档提醒。**M1 已实测**：`Authorization` / `X-API-Key` 两种头都能传进上游 API |
| 2 | 查询语义 | 仍然是 SQL。API 的过滤条件在引擎侧落成视图/参数表 | 用户会尝试 `WHERE` 一个引擎没暴露的字段，报错必须可解释 |
| 3 | 目录与树模型 | 引擎把 API 映射成 schema + 外发表，树**原样复用** `TreeNodeKind`。**M1 已实测**：`dbx_list_tables` 能列出 `api_rows (VIEW)`，`dbx_get_schema_context` 能返回完整列清单；引擎侧无 `dbx_list_schemas` 工具，插件走自己的 `/schemas` 目录查询（PG 方言查 `pg_catalog.pg_namespace`）。**注意分岔**：只有引擎把 API 物化成**具名对象**（Steampipe 的外发表、PG 的视图）才会出现在树里；`http_get(...)` 这种内联调用不产生树节点 | 某些 API 插件只支持固定字段集，`SELECT *` 与字段列表可能不一致 |
| 4 | 分页与行数上限 | `ENGINE_ROW_CAP = 1000` 与 `sql-pagination.mjs` 的 `LIMIT/OFFSET` 包裹对引擎是合法 SQL，**天然可用**；总数走 `countOnly`。**M1 已实测**：3000 行接口 + `max_rows=5000` 只返回 1000 行且 `isError=false`，尾部提示 `the 1000-row cap was reached`；`count(*)` 仍能拿到真实总数 3000 | 引擎对深层 `OFFSET` 可能很慢甚至不支持 —— 要设上限并给出明确提示，而不是让进度条卡在 indeterminate。**新增**：总数与展示行数不一致是常态，UI 必须分开表述 |
| 5 | 写入边界 | **默认只读**。API 数据源不做写路径 | 若将来要写，必须复用 `SQL_BLOCKED → 确认 → allowWrite`，不能新开一条无确认通道 |
| 6 | 错误契约 | 引擎的连接失败/超时已经落进 `CONNECTION_FAILED` / `TIMEOUT`；引擎内部某 API 插件的失败会以 SQL 错误文本返回，由 `classifyError` 归到 `UNKNOWN` 并**原样展示**。**M1 已实测四条**：4xx/5xx **不是错误**（状态码只是结果列值，404 也返回一行）；坏 JSON / 非法 SQL 才是 `DBX_TOOL_ERROR`；超时约 5 s（`pgsql-http` 默认）；所有错误文本尾部带 `SQL text omitted from user-facing error…` | 「API 限流」在 SQL 错误文本里可能难以归类，只能靠原始文本让用户判断。**新增风险**：接口返回 4xx/5xx 时用户会看到「查询成功 + 错误页正文」，M2 必须处理 |
| 7 | 边界归属 | API 适配归**外部引擎**（方案 B）或**上游 DBX**（方案 A 的 JDBC 插件）；dbx-pro 只做 SQL 客户端 + 结果呈现 + AI 上下文 | 用户会期待「插件内置支持某 API」—— 需要产品侧明确表述为「通过兼容的 SQL 引擎 / JDBC 接入」 |

**方案 C 升为主线后，上表三项的答案变了**（其余不变）：

| # | 旧答案（方案 B 视角） | 修正后（方案 C） |
|---|---------------------|-----------------|
| 1 | 凭据存在用户自己的外部引擎里 | **凭据回到插件本地**：token / key 存 dbx-pro 的加密凭证库，`connections.json` 只存引用；认证头在插件进程组装后出站 |
| 3 | 引擎把 API 映射成 schema + 外发表，树原样复用 | **第一版不引入新的树层级**：一个 api 连接 = 一张表，连接名即表名；子节点展示已发现字段 |
| 7 | API 适配归外部引擎 / 上游 DBX；dbx-pro 只做 SQL 客户端 | **API 适配归 dbx-pro 自己**（方案 C），与自研写驱动同构；上限：只读、只 `GET`、快照语义 |

---

## 7. 非目标（明确不做）

- ⚠ **不做通用 REST → 表格的「自动推断」**。响应结构无法一般化，硬做就是造一门没人会写的 DSL。**允许的是用户显式声明**数据路径（如 `data.items`）与认证方式，不是猜字段。
- ❌ **不默默在 `network.allowedHosts` 里放开任意主机**。放开出口白名单是**独立的安全决策**，必须在 M2.3 单独评审并记录（§4.2 决策 1）；`api` 接入不得以「顺手」的方式把它改成 `*`。
- ❌ **不自研 `.dbxp` 插件来当数据源**。上游契约不允许它进入内置枚举，`plugin` 类型在 MCP 上 `unsupported`（§3 方案 D）。
- ❌ **不做跨 API 的联邦查询**。如果确实需要，交给 Trino 这类引擎，而不是在插件里实现 join。
- ❌ **不允许 API 数据源写入**（M1 / M1.5 / M2）。
- ❌ **不改 `AiNodeKind` / ADR-0001 的 `@`提及 语法**。API 数据源在 AI 侧就是普通的连接/schema/表。
- ❌ **不引入新的服务进程**。dbx-pro 的服务端仍是单个 `dbx-engine`（`host-node`）。

---

## 8. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 用户不愿额外部署引擎 | 方案 B 落地率低 | M0 先给出零代码路径；M1 只交付「一份配置示例 + 两条可替换路径」；跑不起来就不是插件的问题 |
| **引擎自身的分发可达性 / 安装耗时**（M1 实测新增） | ADR 原本锚定的 Steampipe 在部分网络下**慢到不可交互**：`.plugin` 是 GHCR 上的 OCI 镜像、索引在 `hub.steampipe.io`（GitHub Pages），本机单流 ≈0.9 MB/min —— 插件安装 19 分钟（含一次 240 s 与一次 600 s 超时重试），`service start` 再拉内嵌 PG + FDW，25 分钟仍未就绪 | **不把方案 B 绑到任何单一发行版**：文档只承诺 Postgres wire protocol，并给出两条可替换路径（已有 PG + `pgsql-http`；自建 SQL 化引擎）。M1 的验收正是用可替换路径完成的 |
| 第三方引擎插件质量参差 | 字段缺失、只读、限流后行为不透明 | 错误**原样透传**，不替引擎美化；文档写明「能力上限由引擎决定」 |
| 生态洗牌（`Canner/wren-engine` 已归档、`dremio-oss` 半年未推） | 文档指向的仓库失效 | 文档只承诺**协议**（Postgres wire protocol），不承诺具体引擎版本；同时列出 Steampipe / Trino / 已有 PG + `pgsql-http` 等可替换路径。**M1 实测验证了这个立场**：首选引擎不可用时，换一个引擎不影响任何 ADR 结论 |
| 深层分页在引擎侧很慢 | 导出进度条卡在 indeterminate | 复用已有的 `latestKnownTotalRef` 回填 + 明确「引擎未返回总数」提示，而不是假装在动 |
| 用户误以为插件内置了某公司 API | 支持成本外溢 | 详情页/文档统一表述为「通过兼容 SQL 引擎 / JDBC 接入」 |
| ~~`dbx-mcp` 可能不含 JDBC 插件~~ → **已证实：既不含插件本体，MCP 通道也传不进 JDBC URL** | ~~M1.5 可能不成立~~ → **M1.5 从「待产品决策」升级为「上游阻塞」** | 三段实测：插件放进 `<DBX_DATA_DIR>/plugins/` 后引擎确实会启动它（`exit status: 127` + stderr `Java runtime not found`），补上 Java 后报 `JDBC URL is required`。落库 `config_json` 显示 `connection_string` / `jdbc_driver_class` / `jdbc_driver_paths` / `url_params` 恒为 `null`，而 `dbx_add_connection` 的 10 个入参里没有它们，多传的键被静默丢弃。**纯清单/表单改动只会暴露一个必然报错的入口**，须先等上游暴露 `connection_string` |
| ~~**带认证头的 API 在 SQL 路径上不可达**~~ → **M1 已解决：可达** | M0 覆盖不了需要 Token 的接口 | M0 实测 `CREATE SECRET` → `SQL_BLOCKED`（引擎策略）。**M1 实测：同一批接口经外部引擎暴露后，`Authorization` / `X-API-Key` 均可携带并取到数据**（同时漏出 M2 要处理的三个体验问题：1000 行硬上限不报错、4xx/5xx 不算错误、超时约 5 s）。`duckdb` 自身的带 Token 通路仍然不通，需 M4；**不为它开闸门口子**（那是独立的安全决策） |
| **DuckDB 驱动不随引擎分发** | M0 路径对未装驱动的用户直接不可用 | 文档写明需先装驱动或设 `DBX_DUCKDB_DRIVER_PATH`；M2 把「未安装」的报错变成可执行指引 |
| **插件自身出站白名单是否约束子进程未证实** | 若 `allowedHosts` 只约束渲染进程，方案 C 的安全论证要重做 | 上游文档已注明 `host.network:https://…`「不是原生 Sidecar 的网络防火墙」；作为 §附录 B 的实测项，不当作结论 |
| **方案 C 依赖 DuckDB 驱动** | 未装驱动的用户，API 接入能取到数但执行不了 SQL | 错误文本必须区分「取数失败」与「本地查询引擎不可用」；后者给出可执行指引（装驱动 / 设 `DBX_DUCKDB_DRIVER_PATH`） |
| **方案 C 是快照语义** | 用户以为是实时查询，实际是查询前取的一份快照 | 结果区标注取数时间与行数；缓存 TTL 在 M3 再谈，第一版不做隐藏缓存 |
| **数据路径写错 → 静默空表** | 用户得不到反馈，以为接口没数据 | 抽不到数组时**报错而非返回空**；抽到空数组时提示「接口返回 0 行」并附响应顶层键名 |
| **SSRF / 内网探测**（方案 C 新增） | 用户可填任意 URL，包括内网地址 | 第一版允许 `http://` 但显式标记；跨主机重定向拒绝（M2.3）；不自动跟随到非预期主机 |
| 把上游注册表当权威清单 | 上游加类型后本地清单静默落后（`uxdb` 已是实例） | M4 的上游协作项应包含「由引擎清单驱动下拉」；在此之前，把 §附录 B 的比对命令纳入例行维护 |

---

## 9. 里程碑

### M0 —— 零代码验证「数据库内 HTTP 取数」（1–2 天）

目标：在**不新增连接类型、不引入新进程**的前提下，回答「能不能直接查 API」。三条候选路径都落在已有的连接类型上：

- [x] **DuckDB**（清单已有，`native`）：**已跑通**。`read_json_auto('https://…')` 与 `read_csv_auto('https://…')` 均返回行。**更正原文**：`httpfs` 确实不是默认加载，但 **DuckDB 会自动安装并加载**，用户无需手动 `INSTALL`（且手动 `INSTALL` 会被闸门拦成 `SQL_BLOCKED`）。连接参数有坑：文件路径填 `host`，`database` 要填库名（填路径会得到 `SET schema` 的 `Catalog Error`）
- [ ] **ClickHouse**（清单已有）：`url('https://…', JSONEachRow)` 表函数 —— **本轮未实测**（本机无 ClickHouse）
- [x] **PostgreSQL** + `pgsql-http` 扩展 —— **已于 M1 实测跑通**（含认证头、JOIN、聚合、行数上限）；正确仓库是 `pramsey/pgsql-http`（MIT）
- [x] 记录失败模式：网络出口、TLS、认证头、错误文本长什么样 —— 认证头与错误文本已记录；**深层分页未覆盖**
- [x] 产出：`docs/plans/api-data-access-m0-notes.md`（含隔离复现配方、能力上限与扩展安装事实）

### M1 —— 打通方案 B（不改插件代码）（**已实测：✅ 已跑通**）

- [x] 用一个 SQL 化引擎暴露一个真实 API 数据源，监听本地 PG 端口 → **实测引擎：PG 17 + `pgsql-http`**（隔离集群 127.0.0.1:55432）。首选 Steampipe 在本机下载速率下不具备交互式可部署性，属路径偏离，不改变结论
- [x] 在 dbx-pro 里以 `postgres` 类型连接，验证四件事：连接树能看到外发表 ✅、SQL 查询返回行 ✅、结果网格导出 **未实测（UI 行为，需人工点一次）**、行数上限/分页不报错 ✅（但发现 1000 行硬上限**静默截断**）
- [x] 写一份 `docs/` 接入说明（引擎部署 + dbx-pro 连接），**明确这是外部依赖而非插件内置能力** → 见 [plans/api-data-access-m1-notes.md](../plans/api-data-access-m1-notes.md)（含复现配方与失败模式）
- [x] 记录失败模式：哪些查询在引擎侧不可下推、错误文本长什么样 → 已记四条（1000 行硬上限不报错 / 4xx·5xx 不算错误 / 超时约 5 s / 错误文本统一截尾）。**未实测**：深层分页与大结果集、引擎并发

### M1.5 —— 收录上游已有的 `jdbc` 通用入口（**已实测：上游阻塞，转 M4**）

前置验证已于 2026-10-09 完成，结论是否定的：**不改上游就做不出能用的功能**，证据见 [plans/api-data-access-m15-notes.md](../plans/api-data-access-m15-notes.md)。

- [x] 验证 `dbx-mcp`（钉 `0.4.106`）是否携带 / 能找到 DBX JDBC 插件 → **运行时编译在引擎里，插件本体不携带**：插件须位于 `<DBX_DATA_DIR>/plugins/<id>/` 才被发现（放进隔离数据目录后，错误从 `Plugin driver 'jdbc' is not installed` 变成 `exit status: 127`），而桌面端装在 `com.dbx.app/plugins/`
- [x] 验证 `jdbc` 类型经 MCP 通道的连接与查询链路 → **建连与持久化可用，查询不可用**：`dbx_add_connection { db_type: "jdbc", host, port }` 成功（`port` 对该类型实际必填），但查询恒报 `JDBC URL is required`
- [x] 定位卡死点 → JDBC URL 存在引擎的 `connection_string` 字段；`dbx_add_connection` 的附加入参只有 `port / username / password / database / ssl / driver_profile` 六项，25 个工具里**没有任何一个能写 `connection_string`**；唯一能落库的扩展位 `driver_profile` 单独设置也无效
- [ ] ~~`DB_TYPE_MANIFEST` 增加 `jdbc` 一项 + 连接表单 JDBC 变体~~ → **阻塞期间不做**：表单收集到的 URL 无处安放，只会得到一个必然失败的入口
- [ ] 转入 M4：请上游在 `dbx_add_connection` 上暴露 `connection_string`（及 `jdbc_driver_class` / `jdbc_driver_paths`）

### M2 —— 「API 接入」落地（**主线，本次实施**）

目标：让「新建连接」里出现一级入口「API 接入」；用户填一个带认证的 HTTP 接口后，能在**连接树**看到它、在**标签页**用 SQL 查它、在**结果网格**看结果。

**M2.1 垂直切片（第一版，可用交付）**

- [x] `src/domain/` 新增 API 接入的连接配置与能力位；`connection-type-catalog.ts` 追加分组「接口」（**排在分组列表最前**）
- [x] 连接表单分支：接口地址 / 请求方法 / 认证方式 / 认证头名 / 自定义请求头 / 数据路径 / 行数上限（`api-connection-fields.tsx` + `services/api-connection-form.ts`）
- [x] 存储分支：api 连接**只存插件服务端**（`<dataDir>/api-connections.json`，0600 原子写）；客户端不写本地镜像、不调 `writeConfig` / `deleteConfig`，`/connections` 由插件服务端合并给出
- [x] `server/src/api-source/`：认证头组装 → HTTP 取数 → 点路径抽行 → 归一化 NDJSON 物化 → SQL 表名重写
- [x] `request-router.mjs` `/query` 新增**路径 0**：api 连接不走 `dbx_execute_query`，改为「取数 + 本地 duckdb 执行」，结果沿用 `toOutcome` 形状
- [x] 连接树可见：api 连接作为顶层节点，子节点展示已发现字段（服务端契约已测；UI 渲染未人工确认）
- [x] 结果网格复用：`{ columns, rows, row_count, truncated }` 与只读数据源一致
- [x] 单测：认证头组装、点路径抽行、表名重写、本地存储合并、快照权限与删除清理
- [x] 认证表单收口（事后修正）：值前缀框只在 `api-key` 下出现并正名；请求头改为「缺省沿用 / 显式覆盖」（见 §4.2「实现修正（认证表单）」），并有 store / 路由 / 组件三层回归

**M2.2 多数据源与分页**

- [ ] 一个 api 连接下配置多个数据源（多个接口 → 多张表）
- [ ] 分页 / 游标字段（响应里给总页数或 next 指针时）
- [ ] `POST` 与请求体模板

**M2.3 安全收口**

- [ ] 出站授权：逐连接主机授权取代静态白名单（§4.2 决策 1）
- [ ] 重定向跨主机拒绝（§4.2 决策 3）
- [ ] 错误码归入既有 `DBX_*` 集合（`CONNECTION_FAILED` / `TIMEOUT` / `AUTH_FAILED`）（M2 已复用 `TIMEOUT` / `CONNECTION_FAILED` / `AUTH_FAILED`；HTTP 状态、非 JSON、限流另立 `API_HTTP_ERROR` / `API_INVALID_JSON` / `API_RATE_LIMITED`，见 `api-fetch.mjs`——是否统一留待本项收口）
- [ ] 响应体大小上限：当前全量读进内存（`api-fetch.mjs` 已删掉从未生效的 `maxBytes`），大结果集要有限流或落盘上限
- [ ] 并发取数的资源边界：多数据源同时取数 / 同一连接并发查询**未测**

**M2.4 体验补齐（原 M2 内容，顺延）**

- [ ] 针对「引擎未返回总数」的情况，让导出进度的降级提示准确，不复现 indeterminate
- [ ] 连接树对只读数据源的表现：不显示写相关菜单项（生成 INSERT/UPDATE/DELETE、VACUUM、删除表等），避免用户点了才报错
- [ ] 连接失败/超时的错误文本补一句「若数据源经外部引擎/JDBC 接入，请先确认引擎自身可达」

### M3 —— API 接入增强（按需）

- [ ] 认证方式扩充（OAuth2 client-credentials / 自定义签名）
- [ ] 取数结果缓存与刷新策略（TTL、手动刷新）
- [ ] 与 ADR-0001 的 `@`提及：数据源可作为 `@` 目标
- [ ] 若仍存在无法覆盖的内部 API（如 SOAP / gRPC），再评估「外部 SQL 化引擎」作为后端（方案 B 复活条件）

### M4 —— 上游协作项（非本仓库交付）

- [ ] 向上游提出：`/health` 应如实上报引擎真实驱动清单（当前 dbx-pro 侧是 1 条硬编码占位；`driver-tiers.ts` 已被注释成「引擎覆盖一切」却仍不接线）
- [ ] 向上游确认：扩展连接类型（含 `.dbxp` 的 `connection-provider`）是否有纳入驱动清单、并可在 MCP 侧枚举的计划
- [ ] 若两项都成立，重新评估方案 D（插件化）成为真路径的可行性

---

## 10. 验收标准

### M0

- [x] 至少一条「数据库内 HTTP 取数」路径在 dbx-pro 中端到端跑通 → **DuckDB 路径已跑通**，见 [plans/api-data-access-m0-notes.md](../plans/api-data-access-m0-notes.md)
- [x] 文档不宣称「免配置」，扩展安装 / 网络出口 / 认证头的前置条件写清楚 → m0-notes 已列「需装 DuckDB 驱动」「冷启 17.5 s」「认证头被拦」三条

### M1（2026-10-09 实测）

- [x] 一个真实 API 数据源，经外部引擎后可作为 `postgres` 连接被 dbx-pro 连接成功 → 本地认证接口经 PG + `pgsql-http` 暴露，dbx-mcp 以 `postgres` 连接成功（引擎层实测）
- [x] 该连接下能列出对象、能执行 SQL → `dbx_list_tables` 列出 `api_rows (VIEW)`；SQL 携带认证头取数、与本地表 JOIN、聚合全部通过。**结果进结果网格**：结构化行 + `isError=false` 已在引擎层确认，**真实 UI 渲染与导出需人工确认**
- [ ] ~~导出该结果集可用~~ **未实测**（UI 行为，需在桌面端点一次）。已拿到的等价证据：结果以结构化行返回、`isError=false`、行数上限提示存在；进度条状态**未观察**
- [x] 引擎未启动时，连接失败的报错是诚实的：实测 `Connection refused (os error 61)`，**不会伪造空结果**
- [x] `docs/` 中的接入说明能让一个没参与本次调研的人独立跑通 → [plans/api-data-access-m1-notes.md](../plans/api-data-access-m1-notes.md) 含 mock API 契约、隔离 PG 启动、引擎侧连接与 SQL 形态

### M1.5

- [ ] `dbx-mcp` 是否携带 JDBC 插件的结论明确（是/否，附验证方式）
- [ ] `jdbc` 类型经 MCP 通道连接 + 查询成功，或明确记录失败在链路哪一环
- [ ] 未放开 `plugin.json` 的 `network.allowedHosts`（导入 JAR 是本地操作）

### M2 —— 「API 接入」（本次实施，2026-10-10 验收）

验收方式：单测（`server/test/api-source.test.mjs`、`server/test/request-router.test.mjs`、`src/test/*.test.js`）+ 端到端脚本（插件真实 HTTP 服务 + 本地 mock 接口 + 真引擎 DuckDB，`23/23 通过`）。**未在桌面端 UI 里手工点过**，因此涉及像素/交互的项标 ◐。

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 「新建连接」出现一级入口「API 接入」，归属「接口」分组 | ✅ | `connection-type-catalog.test.js`：分组首项为「接口」且含 `api`；清单计数 = `DB_TYPE_MANIFEST.length + 1` |
| 能配一个带认证头的 HTTP 接口并保存成功 | ✅ | e2e `POST /api-sources` → 200，`type=api` |
| 该连接**不出现在引擎的连接列表**里（存储只在插件本地） | ✅ | e2e：引擎侧只多一个 `__` 前缀的内部 duckdb 连接（不出现在列表）；配置只在 `<dataDir>/api-connections.json`（0600） |
| 凭据不回传、不回显 | ✅ | e2e：`hasSecret=true`；明文 token 只在本地存储文件里出现一次 |
| 保存后数据源**出现在连接树**顶层，子节点展示已发现字段 | ◐ | 服务端契约已测：`/tables` → `[{ name, kind: "table" }]`，`/describe` → 5 列带类型（`id:bigint` / `title:varchar` / `amount:double` / `ok:boolean` / `author:json`）；`supported:false` 时客户端跳过 schema 层。**树的实际渲染未在桌面端点过** |
| 标签页 `select * from <数据源> limit N` 与带 `where` 的查询都得到行 | ✅ | e2e：`select * from posts` → rows=7；限定名+别名；`where amount >= 30` → `n=5, total=250`（引擎实执 SQL 已打印核对） |
| **结果进结果网格** | ◐ | 服务端沿用 `toOutcome` 形状返回；网格/导出是既有通用渲染，**未人工确认** |
| 认证头生效：不带 token → 401 / `AUTH_FAILED`，带 token → 有行 | ✅ | e2e 两条都跑过 |
| 删除后无残留 | ✅ | e2e：连接从列表消失、存储里无凭据残留、明文快照文件被清掉 |
| `npm run check`（tsc）与测试全绿 | ✅ | tsc 无输出；`api-source.test.mjs` 57/57、`request-router.test.mjs` 30/30、`api-connection-fields.test.js` 7/7；全量 `npm test` 878 例 / 877 通过 / 1 跳过 / 0 失败 |
| **不宣称**未实测的部分 | ✅ | 见下方「未实测」清单 |
| 认证表单与真实请求一致（事后修正） | ✅ | Bearer 下不再露出无效的前缀框（组件测试断言无 `留空即原样发送` 输入口）；API Key 下为「请求头名 / 值前缀（可选）/ 凭据」；自定义请求头「缺省沿用 / 显式传则整体替换」，两条路径都有回归；`/api-sources/test` 也回退到已存请求头（mock 实测收到 `x-env`） |

**本轮新增的两处收口（超出计划的加固）**

1. 物化快照按 0600 写（`api-query.mjs`），删除连接时一并清掉（`api-store.mjs`）：快照是接口数据的明文副本，连接删了不该留在磁盘上。
2. `fetchApiSource` 的 JSDoc 原本声明了从未使用的 `maxBytes` 参数 —— 已删掉该参数，改为在「未实测」里如实记录「响应体无大小上限」。

**未实测（不得宣称）**

- `POST` / 请求体模板、分页/游标：M2.2，**未实现**
- 大结果集：响应体全量进内存，无字节上限；单接口行数上限 1000（引擎硬约束）
- 并发：多数据源同时取数、同一连接并发查询**未测**
- `http://` 出站是否被 `plugin.json` 的 `network.allowedHosts` 拦截：**未测**，本轮未改白名单
- 跳转：当前为 `redirect: "follow"`，**未做**跳转跟到不同主机的拒绝（M2.3 待办）
- 桌面端 UI 真实点击（表单、连接树、结果网格、导出）

### 通用

- [ ] `plugin.json` 的 `network.allowedHosts` 变更需在 M2.3 显式决议并记录（本轮未改）
- [x] `DB_TYPE_MANIFEST` 未新增条目（已核：清单里无 `api`；`api` 是插件自有类型）
- [x] `TreeNodeKind` / `AiNodeKind` 未新增成员（已核：`tree-node-key.ts` / `table-drag.ts` 未动）
- [x] 既有 SQL 数据源行为零回归（全量测试全绿；`/query` 旧分支未改）

---

## 附录 A：候选项目实测清单（2026-10-09）

星标为 GitHub 公开 API 当日实测值。分组按**与本需求的形状匹配度**，不按热度。

### A.1 SQL 化外部引擎（方案 B 主线）

| 项目 | 许可 | 星标 | 语言 | 最近推送 | 备注 |
|------|------|------|------|---------|------|
| turbot/steampipe | AGPL-3.0 | 7,979 | Go | 2026-10-07 | 单二进制、零依赖，PG FDW 暴露 API 为表；**ADR 原定 M1 首选**。⚠ **实测：`.plugin` 为 GHCR OCI 镜像、索引在 `hub.steampipe.io`，单流 ≈0.9 MB/min——插件安装 19 分钟、服务启动 25 分钟未就绪**，不作为唯一路径 |
| turbot/powerpipe | AGPL-3.0 | 523 | Go | 2026-10-07 | 同门仪表盘/基准工具，复用同一批 API 插件 |
| apache/presto | Apache-2.0 | 16,754 | Java | — | Trino 前身；新项目应选 Trino |
| trinodb/trino | Apache-2.0 | 13,311 | Java | 2026-10-08 | 分布式 SQL 强，**无官方通用 REST 连接器** |
| apache/calcite | Apache-2.0 | 5,192 | Java | 2026-10-08 | 可嵌入 SQL 框架，自建适配层的地基 |
| apache/datafusion | Apache-2.0 | 9,424 | Rust | 2026-10-08 | Rust 查询内核；自研 SQL 化时的首选 |
| apache/datafusion-ballista | Apache-2.0 | 2,145 | Rust | — | DataFusion 的分布式版本 |
| apache/drill | Apache-2.0 | 2,026 | Java | 2026-10-07 | Schema-free SQL 直查 JSON/REST |
| apache/teiid | — | 320 | Java | **2023-01-04** | 数据虚拟化，**已停更**，不推荐 |
| dremio/dremio-oss | Apache-2.0 | 1,496 | Java | 2025-09-26 | 联邦查询 + 数据源插件，供应链半年未推 |

### A.2 数据库内 HTTP 取数（M0 零代码路径）

| 项目 | 许可 | 星标 | 语言 | 备注 |
|------|------|------|------|------|
| duckdb/duckdb | MIT | 42,004 | C++ | `read_json_auto` / `read_csv_auto` 可直读 `https://` |
| duckdb/duckdb-httpfs | MIT | 62 | C++ | **独立仓库**：httpfs 是扩展，需 INSTALL/LOAD |
| ClickHouse/ClickHouse | Apache-2.0 | 50,313 | C++ | `url('https://…', JSONEachRow)` 表函数；清单已收录 |
| chdb-io/chdb | Apache-2.0 | 2,916 | C++ | 嵌入式 ClickHouse，单进程可嵌 |
| pramsey/pgsql-http | MIT | 1,602 | C | PG 扩展：`http_get()` 直接发 HTTP。**M1 实测选用此路**（`CREATE EXTENSION http` → v1.7）。**两个坑**：`supabase/pgsql-http` 不存在（404）；`http_get()` 不带 headers 参数，带认证头必须走 `http(row(...)::http_request)` |
| supabase/wrappers | Apache-2.0 | 890 | Rust | PG 外部数据源封装（含若干 API/FDW 形态） |

### A.3 插件化 / 通用 API 数据源的先例

| 项目 | 许可 | 星标 | 备注 |
|------|------|------|------|
| grafana/grafana | AGPL-3.0 | 77,169 | 通用 BI 宿主，插件生态成熟 |
| grafana/grafana-infinity-datasource | Apache-2.0 | 1,084 | **最贴近本需求的先例**：「API datasource for grafana. Visualize data from JSON / CSV / TSV / XML / GraphQL endpoints」——即「把任意 API 声明式变成一个数据源」，可参考其映射模型 |
| betodealmeida/shillelagh | MIT | 461 | 「Making it easy to query APIs via SQL」：轻量 API→SQL 适配层 |
| nineinchnick/trino-rest | Apache-2.0 | **17** | Trino 社区 REST 连接器，**仅 GitHub API**、极不活跃 → 旧文「Trino 有 REST 连接器」的说法据此更正 |
| modelcontextprotocol/servers | MIT | 91,093 | 官方 MCP servers 集合（方案 E 的参考形态） |

### A.4 声明式 / 低代码数据接口（方向相反或过重）

| 项目 | 许可 | 星标 | 备注 |
|------|------|------|------|
| PostgREST/postgrest | MIT | 27,704 | 反方向：把 PG 暴露成 REST |
| hasura/graphql-engine | Apache-2.0 | 32,128 | 自动生成 GraphQL/REST + 细粒度权限 |
| directus/directus | — | 38,349 | 数据平台 + 自动 API |
| nocodb/nocodb | AGPL-3.0 | 65,224 | 表格即 API |
| appsmithorg/appsmith | Apache-2.0 | 41,044 | 低代码应用平台（含数据源层） |
| ToolJet/ToolJet | AGPL-3.0 | 41,055 | 同类低代码平台 |
| cube-js/cube | Apache-2.0 | 20,985 | 语义层，把度量/维度定义成统一 SQL API |
| Canner/WrenAI | AGPL-3.0 | 17,831 | GenBI + MDL 上下文层 |
| Canner/wren-engine | — | 661 | ⚠️ **已于 2026-05-06 归档**，并入主仓库 —— 生态洗牌的实例 |
| apache/superset | Apache-2.0 | 75,091 | BI，强调 SQL 编辑器与多数据源 |
| metabase/metabase | AGPL-3.0 | 49,593 | 易用型 BI，模型层可屏蔽底层复杂性 |

### A.5 ELT / 数据管道（形状不符，仅登记）

`airbytehq/airbyte` 22,197★ · `dlt-hub/dlt` 5,948★ · `meltano/meltano` 2,647★ · `apache/seatunnel` 9,707★ · `apache/nifi` 6,255★ · `apache/hop` 1,489★ —— 都是**搬运/落库**语义，不提供「按需查询、结果进网格」。

### A.6 其他

`tobymao/sqlglot` 9,667★（SQL 解析/转译，自研 SQL 化时的辅助）· `trinodb/*` 与 `apache/*` 见 A.1。

---

## 附录 B：开放问题与复核命令

以下问题**本轮未证实**，不得在文档或产品文案中当作结论。给出的是最小验证动作。

| # | 问题 | 复核方式 |
|---|------|---------|
| 1 | ~~`dbx-mcp 0.4.106` 是否携带 / 能找到 DBX JDBC 插件？~~ **已结案（2026-10-09）** | **运行时在引擎里，插件本体不携带但能被发现**：插件须位于 `<DBX_DATA_DIR>/plugins/<id>/`。桌面端把它装在 `~/Library/Application Support/com.dbx.app/plugins/jdbc`（manifest v0.1.43，`kind: external`，`executable: bin/dbx-jdbc-plugin`，含 `dbx-maven-resolver`），dbx-pro 的数据目录 `~/.astravia-dbx-data/` 下**没有** `plugins/` |
| 2 | ~~`jdbc` 类型经 MCP 通道是否真的可连接 + 可查询？~~ **已结案（2026-10-09）：可连接、不可查询** | 建连成功并持久化；查询恒报 `JDBC URL is required`。根因：URL 存在 `connection_string`，而 `dbx_add_connection` 无此入参（见附录 D.1） |
| 3 | 引擎真实驱动清单是什么？ | **引擎侧已得**：二进制内嵌 manifest 85 项（含 `jdbc` / `plugin` / `uxdb`），`mcpMode` 分布 {direct 11, bridge 69, unsupported 5}。**但 `/health` 仍返回 1 条硬编码占位** —— 即引擎知道、本插件不问，接线仍是 M4 |
| 4 | `plugin` 类型在 MCP 侧是否有替代入口？ | 查上游 `crates/dbx-mcp` 的连接类型过滤逻辑，确认 `mcpMode: unsupported` 是否硬拦截 |
| 5 | 插件的 `network.allowedHosts` 是否约束其子进程的出站 HTTP？ | 写一个最小 `.dbxp`，声明空 `host.network` 权限，让 sidecar 访问外部地址观察结果。上游文档已注明 `host.network:https://…`「不是原生 Sidecar 的网络防火墙」，**倾向于不约束**，但需实测 |
| 6 | 本地清单与上游注册表的漂移 | 例行执行：抓上游 `plugins/connection-types/*.yaml` 文件名集合，与本仓库 `grep -o 'dbType: "[^"]*"' src/domain/connection-config.ts` 的结果做差集。**2026-10-09 实测差集：上游独有 `jdbc` / `plugin` / `uxdb`；本仓库独有 `mariadb` / `aurora-postgresql` / `uds`** |
| 7 | M0 三条路径的实际可用性 | **DuckDB 已实测可用**（自动安装 `httpfs`，无需手动 `INSTALL`；带认证头时 `CREATE SECRET` 被 `SQL_BLOCKED`）。**PG + `pgsql-http` 已于 M1 实测可用**；**ClickHouse 仍未实测**，复核命令不变 |

---

## 附录 C：上游契约原文摘录

摘录用于把结论钉在可复查的原文上，避免下一轮再被「看起来像」的说法带偏。

1. **插件连接类型不进内置枚举** —— `docs/content/docs/plugin-development.cn.mdx`：

   > 「`database_type` 是插件自定义类型标识，不会给 DBX 内置数据库枚举添加成员。」

2. **插件网络权限的作用范围** —— 同上：

   > 「`host.network:https://host[:port]` 声明浏览器可访问的 HTTPS origin，DBX 将它加入 CSP 的 `connect-src`；最多 8 个，不允许路径、通配符或 Token。仍受目标服务 CORS 规则约束。**该权限不是原生 Sidecar 的网络防火墙。**」

3. **插件 → 宿主数据的方向** —— 同上（`host.data:read`）：

    > 「`host.data:read` 允许 `window.dbxPlugin.queryData` 在用户授权给插件的连接上执行一条只读 SQL。每个连接都需要用户同意；它不会授予写入、DDL 或重连。」

    > 「**只用已打开的连接。** ……DBX 不会替插件发起连接：已保存但未打开的连接会以 `Connection is not open` 拒绝。**Redis、MongoDB、搜索引擎等非 SQL 连接不提供该能力。**」

4. **`connection-provider` 的必需字段** —— `plugins/manifest.schema.json`：

   > required: `["type", "id", "database_type", "fields"]`；`capabilities` 枚举仅 `["test", "connect", "disconnect"]`；另有 `workbench` / `filesystem_provider` / `proxy_route` / `actions`。连接生命周期 RPC 固定为 `connection/test` / `connection/connect` / `connection/disconnect`。

5. **注册表是编译期的** —— `plugins/README.md`：

   > `connection-types/` = "build-time registry for every DBX connection target, including databases, data services, message queues, and service registries."

6. **通用 JDBC 入口** —— `plugins/connection-types/jdbc.yaml`（`dbType: jdbc`, `runtimeMode: external`, **`mcpMode: bridge`**, `formKind: jdbc`, `supportLevel: browse`, `queryExecution: true`, `traits: schemaAware/treeSchema/databaseObjectTree`）；`docs/content/docs/driver-management.cn.mdx`：

   > 「通用 JDBC 连接（自定义 JDBC URL + 导入的驱动 JAR）通过独立的 **DBX JDBC 插件** 运行，发布为单独的 `dbx-jdbc-plugin-*.zip` 资源。」

7. **插件连接入口的边界** —— `plugins/connection-types/plugin.yaml`：`dbType: plugin`, `runtimeMode: external`, **`mcpMode: unsupported`**, `supportLevel: connect`, `specializedSurface: true`, 全部 `capabilities: false`（含 `queryExecution`）。

8. **本插件侧的占位实现** —— `server/src/engine/request-router.mjs`（`/health`）：

   > `drivers: [{ id: "dbx-cli", label: "dbx CLI (100+ databases)", tier: "first-class", ready: true }]`

   以及 `src/domain/driver-tiers.ts`：

   > 「驱动档位表 —— 由引擎统一覆盖，所有类型均 ready。…… 仅当引擎上游明确不支持某个类型时，才在下方加 pending。」

---

## 附录 D：M0 原始证据与复现命令（2026-10-09）

引擎：`~/.astravia/plugin-services/dbx-pro/dbx-engine/runtime/versions/0.0.20/server/bin/dbx-mcp-darwin-arm64`（29,453,584 B，`--version` → `0.4.106`）。

```bash
# 完全隔离的引擎实例：不读不写用户真实的 dbx.db
DATA_DIR=$(mktemp -d)
KEY=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
printf '{"schemaVersion":1,"values":{"engine-key":"%s"}}' "$KEY" > "$DATA_DIR/service-secrets.json"
chmod 600 "$DATA_DIR/service-secrets.json"

DBX_DATA_DIR="$DATA_DIR" \
DBX_SECRET_KEY="$KEY" \
DBX_DUCKDB_DRIVER_PATH=<DuckDB 驱动可执行文件> \
  <上述 dbx-mcp 二进制>
```

随后按 MCP 握手（`initialize` 传 `protocolVersion: "2024-11-05"` → `notifications/initialized` → `tools/call`）：

```jsonc
// 1) 建连：文件路径填 host，库名填 database（填反会得到 SET schema 的 Catalog Error）
{"name":"dbx_add_connection","arguments":{"name":"c1","db_type":"duckdb","host":"<dir>/m0.duckdb","database":"m0"}}

// 2) 查 HTTPS API
{"name":"dbx_execute_query","arguments":{"connection_name":"c1","sql":"SELECT id, title FROM read_json_auto('https://jsonplaceholder.typicode.com/posts?_limit=3')","max_rows":10}}

// 3) 闸门验证（预期并实测为 SQL_BLOCKED）
{"name":"dbx_execute_query","arguments":{"connection_name":"c1","sql":"CREATE OR REPLACE SECRET s (TYPE HTTP, EXTRA_HTTP_HEADERS MAP {'X-Token':'abc'})","max_rows":1}}
```

实测输出摘要：`SELECT version()` → `v1.5.5`；HTTPS JSON → 3 行（冷启 **17.5 s** / 热态 **2.7–3.3 s**）；HTTPS CSV → 3 行（1.8 s）；`CREATE SECRET` 与 `INSTALL httpfs` → `Error [SQL_BLOCKED]: High-risk SQL is disabled in DBX MCP settings.`

⚠️ **不要用 `--authorize-keychain` 换取无头运行** —— 它会改写用户机器上 Keychain 的 ACL。上面这套自铸密钥的写法与生产路径（`server/src/http-server.mjs` 的 `ensureEngineKey`）一致，且完全隔离。

### D.1 M1.5 前置验证的原始证据（2026-10-09）

隔离数据目录 `mktemp -d`，把桌面端插件复制进去：`cp -R ~/Library/Application\ Support/com.dbx.app/plugins/jdbc <dir>/plugins/jdbc`（17 MB）；
Java 用上游已下载但未解包的 JRE：`tar -xzf ~/.dbx/agents/jre-download.tar.gz -C <dir>/java`（Temurin 21.0.12.1），`DBX_JAVA_BIN=<dir>/java/dbx-jre/bin/java`。

同一数据目录逐项加条件，`SELECT 1` 的结果：

| 条件 | 结果 |
| --- | --- |
| 无 `plugins/jdbc`、无 Java | `Plugin driver 'jdbc' is not installed` |
| 有 `plugins/jdbc`、无 Java | `Plugin 'jdbc' exited with status exit status: 127`；stderr `[plugin:jdbc] Java runtime not found. Install Java or the optional DBX JDBC runtime.` |
| 有 `plugins/jdbc`、有 Java | `JDBC URL is required` |

字段名试探全部失败（`jdbcUrl` / `driverClass` / `connection_string` / `jdbc_driver_class` / `url_params` 逐一试过），落库佐证：

```json
{"db_type":"jdbc","driver_profile":"org.postgresql:postgresql:42.7.4","url_params":null,
 "host":"localhost","port":5432,"database":"postgres","connection_string":null,
 "external_config":null,"jdbc_driver_class":null,"jdbc_driver_paths":[]}
```

`connection_string` 恒为 `null`；`driver_profile` 是唯一能落库的扩展位，但单独设置仍报 `JDBC URL is required`。
另：`dbx_add_connection` 的 `port` 对 `jdbc` **实际必填**（不给即 `Port is required for this database type.`）。