# 通过 API 访问数据 —— 实施方案

> 对应决策：[ADR-0008](../adr/adr-0008-api-data-access.md) §4 与 §9
> M0 实测记录：[api-data-access-m0-notes.md](./api-data-access-m0-notes.md)
> M1.5 前置验证记录：[api-data-access-m15-notes.md](./api-data-access-m15-notes.md)
> M1 实测记录：[api-data-access-m1-notes.md](./api-data-access-m1-notes.md)
> 本方案只覆盖 ADR-0008 的范围（把 API 数据源接进「新建查询」）。BI 数据资产不在本文。

## 0. 一句话

**不改 dbx-pro 的数据模型**：把「数据接口」映射到已经存在的连接类型。M0 已验证「不装任何东西就能查公开只读 API」；需要认证头的接口走 M1 的外部 SQL 化引擎，**M1 已于 2026-10-09 端到端跑通**（认证头、JOIN、聚合、行数上限全部实测，见 [m1-notes](./api-data-access-m1-notes.md)）；M1.5（收录上游 `jdbc` 通用入口）经前置验证**已判定为上游阻塞**，转入 M4。

## 1. 三条路径与它们的边界（已验证）

| 路径 | 覆盖的接口 | 用户前置成本 | 需要产品决策 | 状态 |
| --- | --- | --- | --- | --- |
| M0 · `duckdb` + `read_json_auto` / `read_csv_auto` | **公开只读**、GET、无自定义头 | 装一次 DuckDB 驱动 | 否 | **已跑通** |
| M1 · 外部 SQL 化引擎 → 普通 `postgres` 连接 | 需要认证头、分页、有状态查询 | 自行部署引擎 | 否 | **已跑通**（实测用 PG 17 + `pgsql-http`；Steampipe 在本机下载速率下不具备交互式可部署性） |
| M1.5 · 收录上游 `jdbc` | 有 JDBC 驱动/自定义 JDBC URL 的接口 | 先装 DBX JDBC 插件（用户侧） | 是（但已不是瓶颈） | ⛔ **上游阻塞**：MCP 传不进 JDBC URL |
| M3 · 自建轻量只读 API 数据源 | 以上都覆盖不了的内部 API | 无 | **是**（动网络边界） | 仅在 M0/M1/M1.5 之后仍有明确缺口时评估 |

方案 D（把用户自研 API 做成 DBX 插件）**不在这条路上**：上游 `plugin.yaml` 的 `mcpMode: unsupported` + `queryExecution: false`，插件类型不进新建查询的类型枚举。降级为 M4 上游协作项。

## 2. 实施原则（不可协商）

1. **不新增连接类型**（M3 之前）。M0 用 `duckdb`，M1 用 `postgres`，M1.5 只收录上游已有的 `jdbc`。
2. **不动 `plugin.json` 的 `network.allowedHosts`**（M3 之前）。现有 3 个域名全是发布资产域名，加数据源域名是一次独立的安全决策。
3. **文档不宣称「免配置」**。M0 要装驱动、M1 要部署引擎、M1.5 要装 JDBC 插件 —— 三条都有前置条件，必须在开始使用前说清。
4. **错误原样透传**，只补分类不改写 message（`markdown-parser.mjs` 的 `classifyError`）。
5. **不做静默降级**。引擎没返回总数就明说，不要伪造 indeterminate 进度。

## 3. 任务分解

### M0 —— 零代码验证（已完成）

| # | 任务 | 交付物 | 状态 |
| --- | --- | --- | --- |
| T-M0-1 | 打通隔离复现配方（`DBX_DATA_DIR` / `DBX_SECRET_KEY` / `DBX_DUCKDB_DRIVER_PATH`） | 见 m0-notes「复现配方」 | ✅ |
| T-M0-2 | DuckDB 路径：HTTPS JSON + HTTPS CSV 端到端取数 | 实测 3 行返回 | ✅ |
| T-M0-3 | 记录失败模式：网络出口 / TLS / 认证头 / 错误文本 / 冷热延迟 | m0-notes「实测结果」表 | ✅ |
| T-M0-4 | 确认 `jdbc` 在运行时可用（不只是清单里有） | 连接被接受并持久化 | ✅ |
| T-M0-5 | 产出一页可行性说明，写清能力上限与前置条件 | [api-data-access-m0-notes.md](./api-data-access-m0-notes.md) | ✅ |

M0 的**未覆盖**部分（记为开放问题，不写成结论）：ClickHouse `url()` 表函数、PG + `pgsql-http`、深层分页/大结果集、认证头的替代通路。

### M1 —— 打通方案 B（不改插件代码）· 主线

| # | 任务 | 验收 | 状态 |
| --- | --- | --- | --- |
| T-M1-1 | 选一个要认证头的接口，用它证明「M0 覆盖不到、M1 能覆盖」 | 能取到数据 | ✅ 本地模拟认证接口：不带头 `401`、带 `Authorization` / `X-API-Key` 均 `200` |
| T-M1-2 | 用外部引擎把它暴露成 PG wire protocol | 引擎本地监听可用 | ✅ **改路径**：PG 17 + `pgsql-http` 承担（监听 127.0.0.1:55432）；Steampipe 插件安装实测 19 分钟、`service start` 25 分钟仍未就绪（制品为 GHCR OCI 镜像 + `hub.steampipe.io` 索引，单流 ≈0.9 MB/min） |
| T-M1-3 | 在 dbx-pro 里以 `postgres` 类型连接 | 连接成功 | ✅ `dbx_add_connection` 建连并持久化 |
| T-M1-4 | 验证四件事：连接树能列出外发表 / SQL 查询返回行 / 结果网格导出正常 / 行数上限与分页不报错 | 全部通过 | ✅ 3/4：对象树列出 `api_rows (VIEW)`、SQL 返回行、1000 行上限不报错；**导出为 UI 行为，未实测** |
| T-M1-5 | 写接入说明（引擎部署 + dbx-pro 连接），明确「这是外部依赖，不是插件内置能力」 | 没参与调研的人能独立跑通 | ✅ 复现配方见 [m1-notes](./api-data-access-m1-notes.md) |
| T-M1-6 | 记录引擎侧的失败模式：哪些查询不可下推、错误文本长什么样 | 有原文记录 | ✅ 4 条原文记录（1000 行硬上限 / 4xx-5xx 不算错误 / 约 5 s 超时 / 错误文本截尾） |

T-M1-2 的引擎是用户的部署决定，不是本插件的内置能力。文档只承诺**协议**（Postgres wire protocol），不承诺具体引擎版本 —— ADR §8 已记录 `Canner/wren-engine` 归档、`dremio-oss` 停更，绑死引擎等于给自己埋雷。M1 实测进一步证明这一点：ADR 的首选引擎 Steampipe 在本机下载速率下**不具备交互式可部署性**（插件安装 19 分钟、服务启动 25 分钟未就绪），而换成 PG + `pgsql-http` 后验收项全部成立 —— 协议承诺成立，引擎选型不成立。

### M1.5 —— 收录上游 `jdbc` 通用入口 · ⛔ 上游阻塞（2026-10-09 实测）

前置验证已给出**否定结论**：不改上游就做不出能用的功能。原「开闸条件」（M1 之后仍有 JDBC 需求 **且** 产品同意暴露 JDBC 表单）已不是瓶颈 —— 即使产品同意，链路也走不通。详见 [api-data-access-m15-notes.md](./api-data-access-m15-notes.md)。

| # | 验证 | 结论 |
| --- | --- | --- |
| T-M1.5-0a | `dbx-mcp 0.4.106` 是否携带 JDBC 插件？ | **运行时编译在引擎里，插件本体不携带但能被发现。** 插件须位于 `<DBX_DATA_DIR>/plugins/<id>/`（实测：放进去后错误从 `Plugin driver 'jdbc' is not installed` 变成 `exit status: 127`）；桌面端装在 `…/com.dbx.app/plugins/jdbc`（manifest v0.1.43，`kind: external`），dbx-pro 的数据目录下没有 |
| T-M1.5-0b | `jdbc` 类型经 MCP 通道能否建连？ | **能。** `{db_type:"jdbc", host, port}` 被接受并持久化（`port` 对该类型实际必填） |
| T-M1.5-0c | 驱动从哪来？ | 桌面端 JDBC 插件带 `dbx-maven-resolver`，按需从 Maven 仓库解析（本机已缓存 `io.prestosql_presto-jdbc_350`）—— 对 dbx-pro 不可见 |
| T-M1.5-0d | **查询链路能不能通？** | **不能。** 补上 Java 后恒报 `JDBC URL is required`；URL 存在引擎的 `connection_string` 字段，而 `dbx_add_connection` 的入参只有 `port / username / password / database / ssl / driver_profile`，25 个工具里**没有任何一个能写 `connection_string`** |
| T-M1.5-0e | 多传字段名能不能绕过？ | **不能。** `jdbcUrl` / `driverClass` / `connection_string` / `jdbc_driver_class` / `url_params` 逐一试过，落库 `config_json` 显示恒为 `null`/`[]`（引擎静默丢弃未知键）；`driver_profile` 是唯一能落库的扩展位，单独设置也无效 |

**因此原代码触点在阻塞解除前一律不动**：表单收集到的 URL 无处安放，改完只会得到一个必然报错的入口。

| # | 原计划触点 | 现状 |
| --- | --- | --- |
| T-M1.5-1 | `src/domain/connection-config.ts` 增加 `jdbc` 一项 | ⛔ 阻塞期间不做 |
| T-M1.5-2 | `connection-type-catalog.ts` 默认值/分组 | ⛔ 阻塞期间不做 |
| T-M1.5-3 | `connection-fields.tsx` JDBC 变体（URL + 驱动 JAR） | ⛔ 阻塞期间不做 |
| T-M1.5-4 | `use-connection-editor.ts` 校验规则 | ⛔ 阻塞期间不做 |
| T-M1.5-5 | `request-router.mjs` 的 `toDbxAddParams` 字段映射 | ✅ **已实测结案**：引擎侧根本不存在可写 URL 的参数形态，不是「字段名没猜对」 |
| T-M1.5-6 | 错误文案区分「JDBC 插件未安装」 | 可独立做（M2 范畴），但需先确认该错误在真实用户环境下会出现 |

**解锁条件**：上游在 `dbx_add_connection` 上暴露 `connection_string`（及 `jdbc_driver_class` / `jdbc_driver_paths`），或提供等价的配置写入能力。在此之前 M1.5 归 M4。

验收：~~`jdbc` 类型经 MCP 通道连接 + 查询成功~~ → 已变更为**明确记录卡在链路哪一环**（见 T-M1.5-0d / 0e）。

### M2 —— 体验补齐（小改动）

| # | 任务 |
| --- | --- |
| T-M2-1 | 「引擎未返回总数」时导出进度提示准确，不复现 indeterminate |
| T-M2-2 | 只读数据源的连接树不显示写相关菜单项（生成 INSERT/UPDATE/DELETE、VACUUM、删表等），避免点了才报错 |
| T-M2-3 | 连接失败/超时文案补一句「若数据源经外部引擎/JDBC 接入，请先确认引擎自身可达」 |
| T-M2-4 | **首次取数很慢**（M0 实测冷启 17.5 s，扩展下载所致）要有可理解的提示 |
| T-M2-5 | 「API 数据源」若走 `duckdb` 路径，`CREATE SECRET` 被 `SQL_BLOCKED` 拦下时，错误文案要指出「带认证头的接口请走外部引擎或 JDBC 接入」，而不是只丢一个 `SQL_BLOCKED` |

### M3 —— 仅在有明确缺口时评估（⛔ 需产品决策）

- [ ] 只有在 M0 / M1 / M1.5 之后**仍存在明确无法覆盖的内部 API**时才启动
- [ ] 门槛：必须能只读、只 GET、接口契约稳定；否则退回 M1
- [ ] 若启动，需一并更新 `connection-config.ts`、`request-router.mjs`、`classifyError`、`table-search.ts`，以及 `plugin.json` 的出站白名单

### M4 —— 上游协作项（非本仓库交付）

- [ ] 向上游提出：`/health` 应如实上报引擎真实驱动清单（当前 dbx-pro 侧是 1 条硬编码占位，`driver-tiers.ts` 已被注释成「引擎覆盖一切」却仍不接线）
- [ ] 向上游确认：扩展连接类型是否有纳入驱动清单、并可在 MCP 侧枚举的计划
- [ ] 两项都成立才重新评估方案 D（插件化）是否成为真路径

## 4. 验收标准

与 [ADR-0008 §10](../adr/adr-0008-api-data-access.md) 逐条对齐，不另立标准。

已知的长期约束（写进文档，不当作待修 bug）：

- 未修改 `plugin.json` 的 `network.allowedHosts`（M3 之前）
- 新增 `DB_TYPE_MANIFEST` 条目仅限 `jdbc`，且仅在 M1.5 开闸后
- `TreeNodeKind` / `AiNodeKind` 不新增成员
- 既有 SQL 数据源行为零回归

## 5. 风险与前置条件

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 用户不愿额外部署引擎 | M1 落地率低 | M0 先给零代码路径；M1 只交付「单二进制 + 一份配置示例」 |
| 第三方引擎插件质量参差 | 字段缺失、限流行为不透明 | 错误原样透传，不替引擎美化 |
| 用户把「API 数据源」理解成插件内置 | 支持成本外溢 | 详情页文案统一为「通过兼容 SQL 引擎 / JDBC 接入」 |
| 引擎自身的安装可达性 | 用户按文档走却在引擎安装/启动上卡到超时，M1 落地率归零 | 实测首选引擎 Steampipe 的插件制品是 GHCR 上的 OCI 镜像、索引与 `service start` 又依赖 `hub.steampipe.io`（GitHub Pages），本机单流 ≈0.9 MB/min：插件安装实测 19 分钟、服务启动 25 分钟仍未就绪。文档给出**两条**可替换路径（PG + `pgsql-http`、自建 SQL 化引擎），不绑定单一发行版 |
| **`jdbc` 通道被上游能力缺口卡住** | M1.5 无法交付（原以为只需产品决策） | 已实测定位到 `connection_string` 不可写；转入 M4 上游协作项，主线保持 M1 |
| JDBC 插件不在用户机器上 | 即便解锁，功能对部分用户仍不可用 | 解锁后开闸前必须定好「未安装时怎么提示」 |
| 上游加类型后本地清单静默落后 | `uxdb` 已是实例 | 把附录 B 的比对命令纳入例行维护；长期方案是 M4 的「由引擎清单驱动下拉」 |

## 6. 明确不做

- 不新增**引擎清单里的**连接类型（M3 之前）—— M2 加的是插件自有类型 `api`，不进 `DB_TYPE_MANIFEST`，见 [ADR-0008 §4.2](../adr/adr-0008-api-data-access.md)
- 不放开插件的出站白名单（M3 之前）
- 不为 `CREATE SECRET` / `INSTALL` 开写闸门的口子（**若要开，是独立的安全决策，不在本方案内**）
- 不把任何第三方引擎内置进插件
- 不承诺「免配置」「零依赖」

## 7. 版本与发布

本方案的实施**分两类提交**，发布节奏不同：

- **文档类**（ADR-0008、本方案、m0-notes、m1-notes、m15-notes、m2-notes）—— 不改变分发内容，**不提升市场版本**（`docs/` 不在 `RUNTIME_DIRS` 内，已实测确认制品里零个 `docs/` 条目）。
- **代码类**（M1.5 及之后的改动）—— 改变分发内容，需提升能力版本并同步 `plugin.json` / `ability.json` / `.astravia/marketplace.source.json`。

> **现状（2026-10-10）**：M1.5 仍被上游阻塞（归入 M4）；**M2 已落地**并产生代码类改动，但版本号仍是 `0.4.0`，提版时机交给发布决定（同时被另一条在途改动占用），见 [api-data-access-m2-notes.md](./api-data-access-m2-notes.md)。
