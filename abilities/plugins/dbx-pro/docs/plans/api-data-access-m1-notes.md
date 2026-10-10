# 通过 API 访问数据 —— M1 实测记录（2026-10-09）

> 对应决策：[ADR-0008](../adr/adr-0008-api-data-access.md) §9 的 M1；实施方案：[api-data-access-implementation-plan.md](./api-data-access-implementation-plan.md) §3 的 T-M1-1 ~ T-M1-6
> 上一阶段：[api-data-access-m0-notes.md](./api-data-access-m0-notes.md)
> 本轮**不改任何产品代码**，只做连通性实测。

## 一句话

M1 结论：**「外部引擎把 API 暴露成 PostgreSQL wire protocol，dbx-pro 以现成的 `postgres` 类型接入」这条路协议层成立，且已端到端跑通** —— 对象树列出对象、SQL 携带认证头取数、与本地表 JOIN、聚合全部返回行；M0 覆盖不到的「需要认证头的接口」在这里被覆盖了。

但**首选引擎 Steampipe 在本机下载速率下不具备交互式可部署性**（插件安装 19 分钟、服务启动 25 分钟未就绪，详见「路径偏离」），M1 的引擎改用本机 PostgreSQL 17 + `pgsql-http` 完成。ADR §8 只承诺**协议**、不绑引擎，因此这个替换不改变结论。

## 路径偏离：为什么最后不是 Steampipe

ADR §9 把 Steampipe 列为 M1 首选（单二进制、跨源、7,979★）。实测它是**能装，但慢到不可交互**：

| 环节 | 实测 |
| --- | --- |
| 二进制定位 | `steampipe` v2.4.7 单文件，解压后 1 个可执行文件，`xattr -dr com.apple.quarantine` 后可用 ✅ |
| 制品分发 | `.plugin` **不在 GitHub Releases**（各 tag 只有 `steampipe_export_*` / `steampipe_sqlite_*` / `steampipe_postgres_*.pg14\|pg15`），而是 **GHCR 上的 OCI 镜像**（`versions.json` 记 `installed_from: ghcr.io/turbot/steampipe/plugins/turbot/hackernews:1.2.0`，拉取临时文件名为 `oras_file_*`）；索引元数据走 `hub.steampipe.io`（GitHub Pages，`185.199.108.154:443`） |
| 实测速率 | 单流 ≈**0.9 MB/min**，3–4 流并发合计 ≈2.5–3 MB/min。装一个插件要下 4 个平台共约 37 MB → **本次耗时 19 分钟**（前两次尝试在 240 s / 600 s 超时） |
| 服务启动 | 插件安装成功后，`steampipe service start` 会**再拉一轮**：内嵌 PG 14.19 + 3 个平台的 `steampipe_postgres_fdw.so.*.gz`（≈5 MB 起/个）。实测**跑了 25 分钟仍未监听 9193**，无日志输出。`STEAMPIPE_UPDATE_CHECK=false` / `STEAMPIPE_TELEMETRY=none` 不影响 |
| 结论 | 不是「不通」，而是**单插件的交互式安装需 ~20 分钟、完整服务启动需 ~40 分钟以上**，且会把交互会话拖到超时。判为**部署可达性**问题（国内网络 / 企业内网只会更严重），不作为 M1 依赖 |

→ 这不是 Steampipe 的缺陷，是**部署可达性与性能**问题。已作为风险记入 ADR §8；T-M1-2 的「引擎」由路径 B2 承担。**Path A 收尾状态：安装完成、服务启动未完成，主动停止（`pkill steampipe service start`），未产生任何验收证据。**

## 复现配方（完全隔离，不触碰用户数据）

### 1. 模拟一个「需要认证头的 HTTP 数据接口」

本地 Node 服务，`127.0.0.1:8787`：

| 路径 | 契约 |
| --- | --- |
| `/public` | 无认证，返回 3 行 JSON |
| `/private` | 必须 `Authorization: Bearer s3cret-token-m1`，否则 401 |
| `/key` | 必须 `X-API-Key: key-m1-abc123`，否则 401 |
| `/slow?s=N` | 延迟 N 秒（默认 70）后返回 |
| `/badjson` | 返回非 JSON 文本 |
| `/big?n=N` | 返回 N 行（默认 3000） |

### 2. 独立的 PostgreSQL 17（不碰用户的 Homebrew 数据目录）

```
initdb -D <work>/pgdata
postgres -D <work>/pgdata -p 55432 -k <work>/pgsock -c listen_addresses=127.0.0.1
createdb -p 55432 m1
psql -p 55432 -d m1 -c "create extension http"     -- → http 1.7
```

`pgsql-http` v1.7.2 由 `make && make install` 装到 Homebrew PG 17（`.so` → `/opt/homebrew/lib/postgresql@17/http.dylib`）。**这动到了用户机器的 Homebrew PG，收尾必须 `make uninstall`。**

### 3. dbx-pro 的引擎（与 M0 相同）

`~/.astravia/plugin-services/dbx-pro/dbx-engine/runtime/versions/0.0.20/server/bin/dbx-mcp-darwin-arm64`（`dbx-mcp 0.4.106`），环境变量 `DBX_DATA_DIR`（临时目录）+ `DBX_SECRET_KEY`（自铸 base64url）。

### 4. 在引擎里建 `postgres` 连接

```
dbx_add_connection { name, db_type: "postgres", host: "127.0.0.1", port: 55432, username: "postgres", database: "m1" }
```

### 5. 带认证头的 SQL 形态（`pgsql-http` 的真实契约）

`http_get(uri)` **只接受 `(uri)` 或 `(uri, data jsonb)`，没有 headers 参数。** 要带请求头必须走 `http_request` 复合类型，且 5 个字段一个都不能少：

```sql
http(row('GET', '<uri>', http_headers('Authorization','Bearer <token>'), null::varchar, null::varchar)::http_request)
```

再用 `json_to_recordset((h).content::json)` 把 JSON 展开成表。这一步是 M1 最容易踩的坑，写文档时必须带上。

## 实测结果（T-M1-1 / T-M1-3 / T-M1-4）

全部通过 `dbx_execute_query` 在引擎层验证 —— **这正是插件自身查询走的同一条通道**，因此等价于产品路径。

| # | 动作 | 结果 |
| --- | --- | --- |
| A | 无认证 `/public` 的状态码 | `200`，34 ms |
| B | `/private` **不带** `Authorization` | `401`，1 ms |
| C | `/private` **带** `Authorization: Bearer <token>` | **`200`，8 ms** |
| C2 | `/key` 带 `X-API-Key` | `200`，1 ms |
| D | JSON → 表 + `WHERE amount > 1000` + `ORDER BY` | 2 行（north 2450 / east 1200），2 ms |
| E | 聚合 `count(*)` / `sum(amount)` | `3 / 4480`，1 ms |
| F | `dbx_list_tables`（对象树） | `- api_rows (VIEW)` `- dim_region (BASE TABLE)` |
| G | API 视图 ⋈ 本地表 | north\|carol\|2450、east\|alice\|1200、west\|bob\|830，5 ms |
| H | 3000 行接口 + `max_rows=5000` | 返回 **1000 行**，20 ms，`isError=false` |
| I | 404 路径 | `status=404` 出现在**结果行**里，不是错误；1 ms |
| J | 坏 JSON | `Error [DBX_TOOL_ERROR]: invalid input syntax for type json … Token "this" is invalid.` |
| K | 8 秒慢接口 | `Error [DBX_TOOL_ERROR]: Operation timed out after 5001 milliseconds with 0 bytes received` |
| L | 非法 SQL | `Error [DBX_TOOL_ERROR]: relation "nowhere.table_x" does not exist` |
| M | 引擎侧 DDL（对照） | `Error [SQL_BLOCKED]: High-risk SQL is disabled in DBX MCP settings.` |
| N | `dbx_get_schema_context` | 返回 `api_rows` 的完整列清单（VIEW 类型也认） |

### T-M1-4 的四个子项逐条对账

| 子项 | 结论 | 依据 |
| --- | --- | --- |
| 连接树能列出外发表 | ✅ | F：`api_rows (VIEW)` / `dim_region (BASE TABLE)` 都出现在 `dbx_list_tables` 里；N 能进一步拿到列 |
| SQL 查询返回行 | ✅ | A/C/C2/D/E/G 全部返回行 |
| 结果网格导出正常 | **⚠ 未实测** | 导出按钮在 UI 层，无法用 MCP 复现。可验证的等价事实：查询返回结构化行、`isError=false`，没有「行数未知」以外的新阻断 |
| 行数上限与分页不报错 | ✅ | H：3000 行接口在 `max_rows=5000` 下返回 1000 行且**不报错**，尾部提示 `… (showing 1000 rows; the 1000-row cap was reached — the result may be truncated)` |

## T-M1-6 引擎侧失败模式（原文记录）

四条，都会直接出现在用户面前：

1. **1000 行硬上限。** 引擎侧 `DBX_MAX_ROWS` / `DBX_EFFECTIVE_ROW_CAP` 都是 1000，`max_rows=5000` 不生效。`select count(*)` 仍能拿到真实总数（3000），也就是**总数与展示行数会不一致**。
2. **4xx / 5xx 不是错误。** HTTP 状态码是普通列值（I：404 老老实实返回一行）。只有 HTTP 库自身失败（超时、TLS）才升级为错误。→ 用户看到「查询成功」但结果是错误页正文，这是最反直觉的一条。
3. **超时约 5 秒。** `pgsql-http` 默认 curl 超时 5 s（K：5001 ms）。可用 `http_set_curlopt('CURLOPT_TIMEOUT', N)` 放宽，但这需要一条额外的写语句（走写确认框）。
4. **错误文本被统一截尾。** 所有 `DBX_TOOL_ERROR` 末尾都带 `SQL text omitted from user-facing error; enable debug SQL diagnostics to inspect the original statement.` —— 原始 SQL 不会回显给用户。

## 重要更正：M0 结论里一处不准确

M0 记录写的是「`CREATE SECRET` 被**本插件自己的写闸门**拦成 `SQL_BLOCKED`」。M1 把这条拆清楚了，**三层是两个不同的闸门**：

| 层 | 机制 | 实际报错 |
| --- | --- | --- |
| 插件（确认闸门） | `server/src/engine/sql-safety.mjs` 的 `classifyQuery` 把 DDL/写判为 `requiresConfirmation` → `request-router.mjs` 抛 `SQL_BLOCKED: 写 / DDL 需要显式确认`（403），UI 弹写确认框后可重试 | 可**通过确认**放行 |
| 插件（写驱动） | 确认后**不走 dbx-mcp**，改由 `server/src/write/direct-write.mjs` 直连数据库执行；只覆盖 PostgreSQL / MySQL 系 / SQL Server 三大家族 | `duckdb` → `WRITE_UNSUPPORTED`：`暂不支持 duckdb 的写操作：写驱动覆盖 PostgreSQL / MySQL 系 / SQL Server 三大家族，其余类型请在 dbx 桌面端执行` |
| 引擎（策略闸门） | `dbx-mcp` 的持久化 MCP 策略（`allowDangerousSql` / `McpGlobalPolicyState`），**进程级 env 只能收紧不能放宽** | `SQL_BLOCKED: High-risk SQL is disabled in DBX MCP settings.` |

三个直接后果：

- **`duckdb` 的 DDL 真的无路可走** —— 插件侧没有 duckdb 写驱动，引擎侧被 MCP 策略拦。所以 M0 那条硬约束成立，只是原因不是「插件闸门」。
- **`postgres` 的 DDL 走得通。** 已实测：`executeWrite` 对 `db_type: "postgres"` 成功执行了 `create table` / **`create extension if not exists http`** / `create or replace view …（把 API 包装成视图）` / `insert` / `select` / `drop`，返回 `{"command":"CREATE", …}`。
- → **「把 API 建成视图」这个启用步骤可以在「新建查询」里完成**（走写确认框），不需要带外手工执行。这是 M1 对 ADR 原判断的一处放松，已写回 ADR。

## 未实测（不写成结论）

| 项 | 状态 | 原因 |
| --- | --- | --- |
| Steampipe 引擎本身 | **未完成（已关闭）** | 插件安装已完成（19 分钟），但 `service start` 追拉内嵌 PG + FDW，25 分钟仍未监听 9193，主动停止。未产生任何验收证据 → 验收改由 PG 17 + `pgsql-http` 承担（见「路径偏离」） |
| 结果网格导出（T-M1-4 第 3 项） | **未实测** | UI 层行为，MCP 无法复现 |
| 深层分页 / 大结果集分页下推 | **未实测** | 只验证了 3000 行这一档，未验证「翻到第 N 页」 |
| 引擎并发 / 多连接隔离 | **未实测** | 单连接串行验证 |
| DuckDB `httpfs` 的只写/只读能力边界 | **未实测** | 仅 M0 记录到自动安装，未测 POST |

## 遗留

- **T-M1-5 接入说明**：正文即本文件的「复现配方」（引擎部署 + dbx-pro 连接步骤，并写明「这是外部依赖，不是插件内置能力」）；ADR §9 的 M1 清单与实施方案 §3 的 T-M1-5 均指向它。
- ADR 的 **M1 状态从「待实施」改为「已跑通」**；M1 首选引擎的安装耗时可达性风险记入 **ADR §8**（风险表）。
- `pgsql-http` 的 `make install` 动到了用户机器的 Homebrew PG 17，**收尾执行 `make uninstall` 还原**（`.dylib` 与 `extension/http*` 一并回收）。
- 收尾时 T-M1-4 第 3 项（结果网格导出）需要在桌面端人工点一次，本文件不作已通过声明。
- **Path A（Steampipe）收尾**：安装完成后 `service start` 仍拉 25 分钟未就绪，已 `pkill`；未产生验收证据，已在「路径偏离」中记为部署可达性问题。
- **环境回收（已执行）**：`pgsql-http` 的 `make uninstall` 已回收（`http.dylib` 与 `extension/http*` 均已移除，已复查）；隔离 PG 集群（55432）、mock API（8787）、`/tmp/m1-steampipe.*` 工作目录（265 MB）均已停/删。
- **表述更正（已回写）**：Steampipe 制品分发的描述从「制品只发布在 hub（GitHub Pages）」改为「**二进制制品为 GHCR（`ghcr.io`）上的 OCI 镜像，索引元数据在 `hub.steampipe.io`**」；结论从「不可达」改为「**慢到不可交互**」。已同步 ADR § 0.2 / §3 / §4.1 / §8 / 附录 A、m1-notes「路径偏离」、实施方案 §1 / §3 / §5。
