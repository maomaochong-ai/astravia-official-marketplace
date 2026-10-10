# 通过 API 访问数据 —— M0 实测记录（2026-10-09）

> 对应决策：[ADR-0008](../adr/adr-0008-api-data-access.md) §9 的 M0；实施方案：[api-data-access-implementation-plan.md](./api-data-access-implementation-plan.md) §3 的 T-M0-1 ~ T-M0-5
> 本轮**不改任何产品代码**，只做连通性实测。

## 一句话

M0 结论：**在不新增连接类型、不引入新进程的前提下，dbx-pro 已经能查 HTTPS API** —— 用清单里已有的 `duckdb` 类型，`read_json_auto('https://…')` 经真实引擎 `dbx-mcp 0.4.106` 端到端返回了行。**但需要认证头（Token / Bearer）的接口走不通**，因为 `CREATE SECRET` 被本插件自己的写闸门拦成 `SQL_BLOCKED`。这一条决定了 M1 不是可选项。

## 复现配方（完全隔离，不触碰用户数据）

引擎：`~/.astravia/plugin-services/dbx-pro/dbx-engine/runtime/versions/0.0.20/server/bin/dbx-mcp-darwin-arm64`（29,453,584 B，`--version` → `0.4.106`）。

三个必需的环境变量：

| 变量 | 值 | 为什么必需 |
| --- | --- | --- |
| `DBX_DATA_DIR` | 新建的临时目录 | 隔离连接库，不读不写用户真实的 `dbx.db` |
| `DBX_SECRET_KEY` | 自铸的 32 字节 base64url | **无此变量时所有连接类工具直接失败**，见下 |
| `DBX_DUCKDB_DRIVER_PATH` | DuckDB 驱动可执行文件路径 | 引擎**不自带** DuckDB 驱动，见下 |

### 密钥这一环（实测踩到的坑）

引擎在无头环境下对任何 `dbx_add_connection` / `dbx_execute_query` 都返回：

```
Error [MCP_POLICY_UNAVAILABLE]: SECRET_KEY_UNAVAILABLE:
this process cannot read the DBX data encryption key (KEYRING_ACCESS_FAILED)
```

这不是缺陷，是设计：生产路径由插件自己供密钥。`server/src/http-server.mjs` 里 `ensureEngineKey(dataDir)` 生成 `randomBytes(32).toString("base64url")`，写入 `<dataDir>/service-secrets.json`（`{schemaVersion:1,values:{"engine-key":…}}`，权限 0600），再作为 `DBX_SECRET_KEY` 注入子进程。复现时照做即可 —— **不要**跑 `--authorize-keychain`（那会改写用户 Keychain 的 ACL）。

### DuckDB 驱动这一环

不设 `DBX_DUCKDB_DRIVER_PATH` 时任何 DuckDB 查询都返回：

```
Error [DBX_TOOL_ERROR]: DuckDB driver is not installed.
Please install it from the Driver Manager or set DBX_DUCKDB_DRIVER_PATH.
```

驱动本体不在引擎里，来自上游 agent 注册表 `…/releases/download/agents-latest/agent-registry.json` 的 `duckdb` 条目（v0.1.29，macos-aarch64 = 6,702,961 B）。解包后是**一个独立可执行文件**（Mach-O arm64，约 27 MB），不是 dylib。

### 连接参数的正确形式（踩坑记录）

```
dbx_add_connection { name, db_type: "duckdb", host: "<DuckDB 文件路径>", database: "<库名，不是路径>" }
```

把文件路径填进 `database` 会得到 `Catalog Error: SET schema: No catalog + schema named "…"` —— 引擎把 `database` 当**catalog/schema 名**下发 `SET schema`。路径要放 `host`。这是 M0 里唯一花了时间才定位对的东西，写文档时必须带上。

## 实测结果

| # | 动作 | 结果 |
| --- | --- | --- |
| 1 | `SELECT version()` | `v1.5.5` |
| 2 | `read_json_auto('https://jsonplaceholder.typicode.com/posts?_limit=3')` | **3 行返回**；冷启 **17.5 s**（首次含扩展下载），热态 **2.7–3.3 s** |
| 3 | `read_csv_auto('https://raw.githubusercontent.com/plotly/datasets/master/2014_usa_states.csv')` | **3 行返回**，1.8 s |
| 4 | `duckdb_extensions()`（第 2 步之前） | `httpfs` → `installed=false, loaded=false` |
| 5 | `duckdb_extensions()`（第 2 步之后） | `httpfs` → **`installed=true, loaded=true`** |
| 6 | `INSTALL httpfs` | `Error [SQL_BLOCKED]: High-risk SQL is disabled in DBX MCP settings.` |
| 7 | `CREATE OR REPLACE SECRET … (TYPE HTTP, EXTRA_HTTP_HEADERS MAP {…})` | 同上 `SQL_BLOCKED` |
| 8 | `dbx_add_connection { db_type: "jdbc", host, port }` | **被接受并持久化**（返回 connection id） |
| 9 | 不设驱动变量直接查 DuckDB | `DuckDB driver is not installed …` |

### 两个非直觉但重要的推论

- **第 4/5/6 步合起来说明：`INSTALL` 被拦并不影响取数。** DuckDB 自己在首次用到 `httpfs` 时**静默自动下载并加载**了扩展（`installed` 从 `false` 变 `true`）。也就是说 ADR 里原来写的「需 `INSTALL` / `LOAD`，不是默认可用」在**可用性**上不成立（用户无需手动装），但在**可干预性**上成立（用户想手动装会被拦）。
- **第 7 步是真正的硬约束。** 不是「配置没写对」，是插件的 `classifyQuery` 按关键字把 DDL/敏感语句一律判为高危。所以：
  - 公开只读 API（无需认证）→ 今天就能查；
  - **需要 `Authorization` 头的 API → 今天查不了**，且不是靠文档能绕过的。

### 第 8 步的意义

`jdbc` 不只是在引擎内嵌清单里（85 项中 `mcpMode: bridge` + `queryExecution: true`），而是**运行时真的能建、能存**。ADR 附录 B 的第 2 问由此结案：MCP 通道上 `jdbc` 是通的，缺的只是 dbx-pro 侧的收录与表单。

## JDBC 插件从哪来（M1.5 的前置条件）

本机 DBX 桌面端里已经装着：

```
~/Library/Application Support/com.dbx.app/plugins/jdbc/
  manifest.json      id=jdbc, version=0.1.43, kind=external, database_type=jdbc,
                     executable=bin/dbx-jdbc-plugin
  bin/dbx-jdbc-plugin, bin/dbx-maven-resolver
  lib/dbx-jdbc-plugin.jar
  drivers/maven/io.prestosql_presto-jdbc_350/   ← 已解析的驱动缓存
```

即：**JDBC 运行时不由 `dbx-mcp` 提供，是 DBX 桌面端独立安装的插件**（对应上游文档说的 `dbx-jdbc-plugin-*.zip`）。dbx-pro 既不能安装它，也不能探测它的版本 —— 所以 M1.5 的产品文案必须写清「需先安装 DBX JDBC 插件」，否则就是虚假承诺。另外 `dbx-maven-resolver` 的存在说明驱动是**按需从 Maven 仓库解析**的，这又引入一个对 dbx-pro 而言不可见的网络依赖。

## 未实测的部分（不写成结论）

| 路径 | 状态 | 原因 |
| --- | --- | --- |
| ClickHouse `url('https://…', JSONEachRow)` | **未实测** | 本机无 ClickHouse，也没有在容器里拉镜像 |
| PostgreSQL + `pgsql-http` | **未实测** | 本机只有 `psql` 客户端，没有本地 PG 服务实例 |
| 深层分页 / 大结果集 | **未实测** | 只验证了 3 行的小响应 |
| 认证头的替代通路 | **未实测** | 只确认了 SQL 路径被拦，未穷举其它通路 |

M0 的验收标准是「至少一条路径端到端跑通，或明确记录其不可行的原因」—— DuckDB 这条已满足；上表四项按 ADR 的规矩记为**开放问题**，不当作结论。

## 遗留（M1 处理）

- `CREATE SECRET` 被拦 → 需要认证头的 API 必须走外部引擎（M1）。若产品希望「不装任何东西就支持带 Token 的 API」，那是一次**独立的安全决策**（要不要为 `CREATE SECRET` 开一个窄口子），不能夹带在本次落地里。
- 冷启 17.5 s 是扩展下载造成的，用户第一次查 API 会明显感知到卡顿 —— M2 的错误/进度文案要覆盖这种「首次很慢」。
- `jdbc` 的连通性验证放到 M1.5，且**必须先拿到产品决策**（是否暴露 JDBC 表单）。
