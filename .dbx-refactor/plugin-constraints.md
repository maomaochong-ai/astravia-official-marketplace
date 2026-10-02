# Q2 + Q3 — 插件改造约束与引擎真相

目标插件：`astravia-official-marketplace/abilities/plugins/dbx-pro`（`plugin.json` v0.0.11）
SDK：`@astravia-org/plugin-sdk ^0.3.10`（`.tooling/open-astravia/packages/plugins/plugin-sdk`）
证据分级：`【实证】`= 读过源码/命令输出并给出 `路径:行`；`【推断】`= 推导，需复验；`【未知】`= 本仓库无可验证证据。

---

## 1. 插件运行时契约（UI 硬规则）

`【实证】` SDK `docs/styling-and-pitfalls.md`、`dist/ui.d.ts`：

| 规则 | 内容 | 对本插件的含义 |
| --- | --- | --- |
| 同树渲染 | 插件 UI 与宿主在同一 document / React 树（无 iframe、无 Shadow DOM） | 不能用 iframe 造「独立窗口」 |
| 无视口级定位 | 面板类槽位（activity-tab / bottom-panel / file-preview / input-action 面板）**禁止** `position: fixed`、`position: sticky` 铺满视口与超高 `z-index` | 现状 `src/style.css` 的 `.dbx-sheet-backdrop{position:fixed;inset:0}` 违规，必须改 |
| 全局浮层 | 仅 `registerGlobalSlot`（`ui.slot.global`）可做全局层 | 本插件不需要，浮层用容器内 `absolute` |
| 通知 | 只能 `ctx.ui.notify({ message, error })`，无权限门槛 | 禁止 `createPortal(..., document.body)` 与自造 toast |
| 样式隔离 | 宿主注入 `@scope ([data-astravia-plugin-root="<id>"])` | 不能写全局选择器；`.dark .dbx-*` 硬编码 hex 全部作废 |
| 主题 | Tailwind v4 `@import "tailwindcss"` + SDK 自动注入 token 别名 | 用 `bg-muted`/`border-border`/`text-muted-foreground` 等语义类 |
| 单例 | React、`@astravia-org/plugin-sdk` 是宿主单例（external、`import:false`） | 不得打包第二份 React |
| MF 陷阱 | 模块顶层不得求值共享依赖导出的 JSX/组件 | 现状 `src/runtime-contract.ts` 顶层 `` `${process.env.HOME}` `` 需移入激活期 |
| 清理 | `ctx.ui.register*` 返回的 Disposable 由宿主自动回收 | 不要再手写对称的 `deactivate()`，也不要手动 `dispose()` |
| 状态归属 | 运行时状态须由闭包按激活期持有 | 每次 reload 后不能留旧闭包状态 |

`【实证】` 单例与 i18n：`dist/hooks.d.ts:28 export declare function useTranslation(): PluginTranslation;`
（**无命名空间参数**，只解析本插件目录）；`dist/i18n.d.ts` 回落链 = 当前语言 → `defaultLocale` → 裸键名。
`plugin.json` 已声明 `defaultLocale: "zh"`，`locales/{zh,en}.json` 已存在但未被使用。

---

## 2. SDK API 面（可实现的能力边界）

### 2.1 `PluginContext` 成员`【实证】dist/context.d.ts`

`plugin` / `permissions` / `ui` / `fileExplorer` / `conversation` / `agent` / `appActions` / `ai` /
`official` / `fs` / `command` / `cliProviders` / `services` / `models` / `media` / `ocr` / `jobs` /
`artifacts` / `capture?` / `browser` / `network` / `gateway?` / `storage` / `secrets` / `i18n` /
`getAgentMode()` / `onAgentModeChanged(listener)`

**没有 `settings` 成员**`【实证】`；但 `PLUGIN_PERMISSIONS` 含 `settings.read`/`settings.write``【实证】dist/permissions.d.ts:1`。

### 2.2 与本任务直接相关的 API

| API | 关键契约 | 对本插件 |
| --- | --- | --- |
| `ctx.command.run(file, args?, opts?)` | **execFile 语义，无 shell**；`file` 必须已在 `plugin.json#commands` 声明且被用户启用；`cwd` 必须在宿主允许根内；`opts.env` 叠加在宿主 env 之上（保留 PATH）；返回 `{stdout, stderr, exitCode}` | `plugin.json` 已声明 `["dbx","sqlite3"]`，但 `dbx` 二进制**本机不存在**（§4） |
| `ctx.command.spawn(file, args?, opts?)` | ADR-0054；`spawnId`/`pid`/`port?`/`stop()`/`status()`/`onExit()`；`allocatePort` 会替换参数里的 `{{PORT}}`；子进程独立进程组，插件卸载/禁用/退出宿主时整树被杀；`status().recentOutput` 约 64KB | **推荐通路 B 的基础**（§5） |
| `ctx.network.request(req)` | **主进程发起**，无渲染器 CORS 问题；需 `network.fetch` + `plugin.json#network.allowedHosts`；`responseType` json/text/base64 | 访问 `http://127.0.0.1:<port>` 仍受 allowedHosts 约束，需列入 |
| `ctx.storage` | 私有命名空间文件存储；`readFile`/`writeFile`/`commit(changes,{expectedRevision})` 原子提交/`readSnapshot`/`putBlob`/`putBlobFromFile`/`readBlob`/`getBlobRef`/`deleteBlob`；含 `readJsonFile`/`writeJsonFile` | **替代** `localStorage` 与 `sqlite3` 直写 |
| `ctx.secrets` | 秘钥读写（`secrets.read`/`secrets.write`） | 连接密码/token |
| `ctx.services` | `install(serviceId, artifacts)`/`start`/`stop`/`restart`/`getStatus`/`request`（宿主默认超时 30s，上限 5min）/`reportReady`/`onStatusChange`/`readDataFile`/`writeDataFile` | **推荐通路 A 的基础**（§5） |
| `ctx.agent` | **只有** `registerTool`/`registerSystemPromptProvider`/`registerContinuationProvider`/`registerHook` | **UI 无法调用任何工具**（§4.4） |
| `ctx.ai` | `complete` / `chat`（含 `tools`，插件自行执行 toolCalls）/ 模型列表 | 旧版「问 AI」的替代实现之一 |
| `ctx.conversation` | 会话读写、`sendPrompt`（`conversation.draft.read`） | 另一替代实现 |
| `ctx.fs` | `readFile`/`readBinaryFile`/`stat`/`listFilesRecursive`（限宿主允许根）；**只有 `saveAs`，没有「选择文件打开」** | 文件型数据库（SQLite/DuckDB）路径受限（§7） |
| `ctx.ui` | `registerActivityTab`/`registerWorkspaceView`（`ui.slot.workspace-view`）/`registerBottomPanel`/`registerInputAction`/`registerGlobalSlot`/`openActivityTab`/`setWorkspaceViewBadge`/`notify` | 挂载点选择见 §7-Q-C |

### 2.3 现状权限（`plugin.json`）

`【实证】` 已声明：`ui.slot.activity-tab`、`ui.slot.ability-detail`、`agent.command.run`、
`storage.read`、`storage.write`、`shell.openExternal`。

**必然要新增**（取决于 §5 选路）：`agent.command.spawn` 与/或 `agent.mcp.control`、
`network.fetch`、`secrets.read`/`secrets.write`、`fs.read`（文件型连接）。
`plugin.json` 还需新增 `network.allowedHosts`、`providers`、`agent.mcpServers`（按选路）。
`【实证】` 字段名合法：`manifest-schema.ts` 中 `allowedHosts`(156/166)、`providers`(420)、
`network`(423)、`commands`(425)、`mcpServers`(389)。

---

## 3. 插件数据层现状（实证缺陷）

`【实证】` 在插件目录执行 `npx tsc --noEmit` → **exit 2，24 条错误**，全部集中在
`src/features/main-panel/components/dbx-pro-panel.tsx` 与 `src/index.tsx`。代表性错误：

```
dbx-pro-panel.tsx(151,24): error TS2554: Expected 1 arguments, but got 0.   // readAllConfigs() 需要 ctx 参数
dbx-pro-panel.tsx(181,61): error TS2353: 'kind' does not exist in type 'CatalogScope'.
dbx-pro-panel.tsx(194,22): error TS2554: Expected 3-4 arguments, but got 2. // listTablesInScopeSql(scope,...)
dbx-pro-panel.tsx(207,56): error TS2353: 'error' does not exist in type 'DbQueryResult'.
dbx-pro-panel.tsx(240,68): error TS2322: Property 'busy' does not exist on type ...  // sql-editor props 不匹配
dbx-pro-panel.tsx(245,12): error TS2741: Property 'totalRows' is missing ...        // result-grid props 不匹配
dbx-pro-panel.tsx(291,23): error TS2322: Property 'onSave' does not exist ... Did you mean 'onSaved'?
src/index.tsx(17,37):      error TS2322
```

结论`【实证】`：**当前源码处于重构中断状态，不能编译，也不能发布**。这不是「小修小补」的对象——
面板与 domain 层的函数签名互不匹配，且数据层建立在不存在的前提上（§4）。

其余静态问题（读源码所得，未被修复）：

| 问题 | 证据 |
| --- | --- |
| `services/dbx-cli.ts` 依赖不存在的 `dbx` CLI：`connections list`/`schema list`/`schema describe`/`query`/`context` | `src/features/connection-management/services/dbx-cli.ts` |
| `domain/dbx-storage.ts` 用 `sqlite3` CLI 直写引擎库 `dbx.db` | 同上 |
| `index.tsx` 硬编码 `label: "dbx-pro"`，`locales/*.json` 未用 | `src/index.tsx` |
| `style.css` 视口级 `fixed` 浮层 + `.dark .dbx-*` 硬编码色 | `src/style.css` |
| `runtime-contract.ts` 顶层读 `process.env.HOME`（MF 顶层求值陷阱） | `src/runtime-contract.ts` |
| `registerAgentTool` 是死代码，且 `agent.tools.register` 未声明 | `src/index.tsx` |
| 手动 `dispose()` activity tab（宿主已自动回收）；未使用 `%tab.label%` 目录键 | `src/index.tsx` |

`src/test/{catalog.test.js, connection-config.test.js}` 目前 25/25 通过`【实证】BUILD.md`，
但它们只覆盖纯函数，不覆盖上面任何缺陷。

> 时序提示`【实证】git status`：当前工作树已包含他人并行推进的**已暂存改动**
> （`locales/{zh,en}.json`、`src/index.tsx`、`src/features/main-panel/components/dbx-pro-panel.tsx`，
> 相对 HEAD 共 312 插入 / 787 删除）。上面的 tsc 测量是在**包含这批改动的当前工作树**上取得的，
> 因此 24 条错误描述的是「重构进行中」的即时状态，而非纯旧基线。

---

## 4. Q3 引擎真相表

### 4.1 旧项目的数据通路是 MCP，不是 CLI`【实证】`

| 事实 | 证据 |
| --- | --- |
| 旧工作台唯一的引擎接口是 **`dbx-mcp` MCP stdio 服务**（随 Desktop 分发） | `packages/desktop-app/resources/dbx-mcp/{win32-x64,darwin-arm64,darwin-x64}/dbx-mcp`；`src/main/mcp/dbx-mcp-path.ts` |
| 平台键：`win32-x64`/`darwin-arm64`/`darwin-x64`/`linux-x64`；`resolveDbxMcpBinaryPath()` → `resources/dbx-mcp/{platform}/dbx-mcp[.exe]` | 同上 |
| 二进制大小：darwin-arm64 19,204,192 B；darwin-x64 23,436,976 B；win32-x64 21,228,032 B | `ls -la` |
| 传输是**换行分隔 JSON**（非 Content-Length 分帧） | `design-docs/dbx-mcp/dbx-main-integration-tasks.md:92` |
| 主进程自写轻量客户端（未用官方 MCP SDK）；握手 15s / 调用 60s / 关停宽限 2s | `src/main/database/dbx-mcp-client.ts` |
| 引擎数据目录被隔离到 `userData/dbx-engine`（不污染 `~/Library/Application Support/com.dbx.app/dbx.db`） | 同上（注入 `DBX_DATA_DIR`） |
| **本机 `which dbx` 无输出**；Desktop 资源目录只有 `dbx-mcp`/`appshot`/`ocr-models`；未安装 `@dbx-app/cli` | 命令输出 |
| 旧代码**从不调用** `dbx` CLI（`src` 内无 `execFile("dbx"` 之类） | 全仓 grep |

### 4.2 真实工具面（13 个）`【实证】`

旧项目 `src` 内直接引用的工具名（`src/main/database/database-service.ts:262,301,344,363,392,417,441,468,546,585`，
`confirmed-write-runner.ts:33`）：

`dbx_list_connections`、`dbx_add_connection`、`dbx_remove_connection`、`dbx_list_tables`、
`dbx_describe_table`、`dbx_execute_query`、`dbx_get_schema_context`；
另有 `dbx_open_table`、`dbx_execute_and_show`、`dbx_execute_redis_command`。

二进制字符串核对（`strings darwin-arm64/dbx-mcp`）额外确认存在：
`dbx_open_session`、`dbx_close_session`、`dbx_duplicate_connection`。

其中 `dbx_open_table` / `dbx_execute_and_show` 只能在 dbx 桌面端运行时工作，否则返回
`Error [DBX_NOT_RUNNING]`——**Astravia 刻意不使用**，改为自建等价 UI。

### 4.3 结果格式是 Markdown 文本，不是 JSON`【实证】`

`src/renderer/domains/database/lib/dbx-sync.ts`（75 行）：
- `DBX_EXECUTE_QUERY_TOOL = "dbx_execute_query"`；
- 入参只有 `connection_name` + `sql`；
- 返回取 `content[].text` 拼接，再按 **Markdown 表格**（`|` 行 + 第二行 `| --- |` 分隔）逐行解析成
  `DbQueryResult{columns, rows, rowCount, durationMs, rawText}`；
- 耗时用 `/(\d+)\s*(ms|s)\b/i` 从文本里抠。

### 4.4 插件拿不到这条通路`【实证】`

| 阻碍 | 证据 |
| --- | --- |
| `dbx-mcp` 路径由主进程 `process.resourcesPath`/`process.cwd()` 解析 | `dbx-mcp-path.ts` |
| 插件 `ctx.command.*` 只能执行 `plugin.json#commands` 里声明且用户开启的可执行文件；现状只声明了 `dbx`/`sqlite3`，且这两个都不可用于该引擎 | `dist/command.d.ts` |
| **`PluginAgentApi` 没有调用工具的 API**（只有 register*），grep `toolHandler\|executeTool\|invokeTool` 只命中权限字面量 | `dist/agent.d.ts` |
| 旧版的 schema/索引/FK/触发器/分区并非引擎工具，而是产品层用只读 SQL 合成（`information_schema`/`pg_*`） | `src/main/database/database-catalog.ts`（135 行）、插件 `src/domain/catalog.ts` |

### 4.5 引擎之外、旧版还依赖的宿主能力

| 能力 | 旧位置 | 插件可替代性 |
| --- | --- | --- |
| 连接配置持久化 | 引擎 `dbx.db` 的 `connections` 表（`dbx_add_connection` 写入） | 必须自持（`connections.json` + `ctx.secrets`） |
| 读写闸门与生产保护 | `src/main/database/sql-safety.ts`（212）、`database-service.executeQuery`（行上限 100、超时 30s、单次 `DBX_MCP_CONFIRMED_WRITE_SQL` 绑定、`CONFIRM_MISMATCH`） | 需在插件内重建等价实现 |
| AI 访问白名单 | `guardConnectionAiAccess`（prod 默认禁） | 需自持 |
| 环境标签/写授权/安全模式/行数/超时 | 宿主 desktop-config | 需自持（§9） |
| Schema 上下文注入 | `src/main/database/schema-context-injection.ts`（283）→ `dbx_get_schema_context` | 需自持（引擎无该工具给插件） |
| dbx 引擎数据文件 | `userData/dbx-engine` | 插件无法读取（`ctx.fs` 限宿主允许根）`【推断】` |

---

## 5. 三条可选数据通路（含推荐）

### 通路 A — 插件自持「受管本地服务」`ctx.services`（推荐）

`【实证】` `dist/service-provider.d.ts`：`install(serviceId, artifacts)`/`start`/`stop`/`restart`/
`getStatus`/`request(serviceId, {path, method,...})`（宿主默认 30s、上限 5min）/`reportReady`/
`onStatusChange`/`readDataFile`/`writeDataFile`。

- 服务本体随插件包分发（`providers.services[].runtime.entry`，如 `service/main.mjs`），
  用**纯 JS 驱动**（`pg`/`mysql2`/`mongodb`/`redis`/`@clickhouse/client`/`mssql`/`sql.js`…）直连数据库。
- `【实证】` 限制：`manifest.ts` 的 `normalizeServiceProviders` 要求每个 provider 至少声明一个平台
  （`"Service provider must declare at least one platform: ${provider.id}"`），且 `runtime.platforms`
  是必填 `Record`，每个平台需 `executable` + `artifacts[{sha256, archive, destination}]`
  → 即使 `host-node` 也要先 `install()` 上传 artifact（base64 载荷）再 `start()`。
- `【未知】` 本工作区**没有 `host-node` 服务的真实插件示例**（SDK 只有 manifest 级测试）。
  → 首次落地需真机验证，风险中等。
- 同一服务可同时暴露给 Agent：`plugin.json#agent.mcpServers: { dbx: { type: "service", serviceId, path } }`
  （需 `agent.mcp.control`）`【实证】dist/mcp.md`。

### 通路 B — `ctx.command.spawn("node", …)` + 回环 HTTP

`【实证】` `command.d.ts`（`allocatePort` 替换 `{{PORT}}`；`handle.status().port`）。

```
ctx.command.spawn("node", ["service/http-server.mjs", "--port", "{{PORT}}"], { allocatePort: true })
  → const port = (await handle.status()).port
  → ctx.network.request({ url: `http://127.0.0.1:${port}/query`, method: "POST", ... })
```

- 需要：`plugin.json#commands` 增加 `node`（用户需开启）、权限 `agent.command.spawn` + `network.fetch`、
  `network.allowedHosts` 列入 `127.0.0.1`（是否需要对回环主机做白名单声明需真机复验`【推断】`）。
- 优点：`ctx.network.request` 在**主进程**执行 → 无渲染器 CORS；`status().recentOutput` 便于诊断。
- 缺点：多一个进程与端口管理；`node` 版本取决于宿主运行时。

### 通路 C — 把 Node MCP 服务作为**插件自带 MCP** 交给宿主托管（若要保 Agent 侧能力）

`【实证】` 本仓内**已被验证**的样板：`packages/plugins/externals/cowart-astravia`。

| 件 | 内容 |
| --- | --- |
| `.mcp.json` | `{"mcpServers":{"cowart-mcp":{"command":"node","args":["./scripts/start-mcp.mjs"],"cwd":"."}}}` |
| 说明 | `node` **不需要** 写进 `plugin.json#commands`（MCP 由宿主 `agent.mcpServers` 托管启动，与 `ctx.command.spawn` 不同） |
| 打包 | `scripts/build-mcp.mjs` 用 esbuild：`bundle:true, platform:"node", format:"esm", target:"node20", packages:"bundle"` → `scripts/cowart-mcp.bundle.mjs`（**构建产物不入库**，实测 `ls` 不存在） |
| 启动 | `scripts/start-mcp.mjs`：优先 import 自包含 bundle，否则检查依赖缺失并 `npm install --omit=dev` 兜底 |
| 陷阱 | 「Do NOT `process.exit` after import — MCP 进程必须留在 stdio 上继续运行」 |
| 打包白名单 | `.mcp.json`、`mcp/`、`scripts/` 会被打入插件；`node_modules` **不会** |

→ dbx-pro 若也要给 Agent 提供数据库工具，应在**同一服务**上开两条通道：
stdio（给 `agent.mcpServers`）+ HTTP（给面板，通路 A/B），两个进程各自持连接池。

### 推荐

**通路 A（主）+ 通路 C（若需 Agent 侧）**：面板数据走 `ctx.services.request`，服务实现用纯 JS 驱动；
`host-node` 落地受阻时立即降级到**通路 B**（同一份 `service/main.mjs` 加 `--port` 模式即可复用）。
理由：A 是 SDK 明文设计的插件→本地服务契约，无需 `network.allowedHosts` 与 `node` 命令授权，
生命周期由宿主托管（卸载/退出自动清理），最贴合「插件自持引擎」的定位。

---

## 6. 驱动支持矩阵（还原度的真实边界）

旧版声明 **87 个 `dbType`**`【实证】src/domain/connection-config.ts`（含 `mysql`/`postgres`/`sqlite`/
`sqlserver`/`clickhouse`/`mongodb`/`redis`/`snowflake`/`oracle`/`trino`/`hive`/`spark`/`doris`/`neo4j`/
`qdrant`/`milvus`/`bigquery`/`cassandra`… 以及非关系型家族 `mq`/`mqtt`/`etcd`/`zookeeper`/`nacos`/
`consul`/`argo`/`salesforce`/`spanner`）。

**这些能力由引擎（Go 二进制）承担，插件用 JS 驱动无法 1:1 覆盖。** 必须在详情页与设置页公开矩阵：

| 档 | 类型 | 实现 | 备注 |
| --- | --- | --- | --- |
| 一等 | postgres、mysql、mariadb、sqlite（纯 JS/`node:sqlite`）、mssql、clickhouse、redis、mongodb | 官方 JS 驱动，可直接 bundle | `mysql2`、`pg`、`mssql`(tedious)、`@clickhouse/client`、`ioredis`、`mongodb`、`sql.js`/`node:sqlite` |
| 二等 | duckdb（`@duckdb/duckdb-wasm` 或 `sql.js` 降级）、cloudflare-d1、turso、databricks、bigquery（REST）、snowflake（REST） | 部分可用，需评估包体与协议 | 各需单独验证 |
| 三等 | oracle、db2、saphana、teradata、dameng、kingbase、gaussdb、oceanbase、informix… | **不可达**（无纯 JS 驱动 / 驱动含原生模块） | 详情页明确标注「需由 dbx 引擎提供，本插件暂不支持」 |
| 四等 | mq/mqtt/etcd/zookeeper/nacos/consul/argo/salesforce/spanner/iotdb… | 超出数据库工作台范畴 | 建议从插件类型清单中裁剪或标注为实验性 |

**原生模块不可 bundle**（`better-sqlite3`、`@duckdb/node-api`、`oracledb`），这决定了「照搬全部 87 类型」在插件形态下不可能。
`node:sqlite` 仅在宿主 Node ≥22.5 可用`【推断】`。
**包体约束**：市场限制为归档 ≤25MB、解压 ≤100MB、单文件 ≤8MB；纯 JS 驱动全量入包需实测体积（含 `pg`+`mysql2`+
`mongodb`+`ioredis`+tedious+`@clickhouse/client` 量级在数 MB 到十余 MB）。

---

## 7. 「旧工作台有、插件做不到」清单与兜底

| # | 旧能力 | 为什么做不到 | 兜底方案 |
| --- | --- | --- | --- |
| 1 | 通过 `dbx-mcp` 访问 87 类数据库 | 二进制在主进程资源目录；插件不能执行、不能调用 MCP 工具 | 通路 A/B + §6 矩阵；详情页显式声明支持范围 |
| 2 | 复用用户已有的 dbx 连接（同一份 `dbx.db`） | 引擎库在 `userData/dbx-engine`，`ctx.fs` 限宿主允许根 | 提供一次性「导入连接配置」向导（用户手动导出文件后经 `ctx.fs` 读取）；不做静默读取 |
| 3 | `dbx_open_table` 在 dbx 桌面端打开表 | 需要 dbx 桌面端运行 | 无关：插件内自建结果面板（旧版本来也是自建） |
| 4 | 宿主设置里的数据库偏好（env 标签、生产写授权、AI 白名单、安全模式、行数、超时） | 插件读不到宿主 desktop-config（无 `ctx.settings`） | 在插件存储内重建同名语义设置；UI 明确「独立于全局设置」 |
| 5 | 「锚点注入宿主会话」的 AI 上下文注入 | 旧实现走宿主 conversation + systemPrompt 通道 | 二选一：`ctx.conversation.sendPrompt` 预填 prompt，或 `ctx.ai.complete/chat` 就地分析 |
| 6 | 文件型数据库（SQLite/DuckDB）选择本地文件 | `dist/fs.d.ts` 只有 `saveAs`，无「选择文件打开」 | 让用户手动输入/粘贴路径（受宿主允许根限制），或读取拖入文件（若宿主提供）；需真机验证`【推断】` |
| 7 | 结果行内编辑回写 | 引擎提供了写保护与 `CONFIRM_MISMATCH` 语义 | 插件内自实现同语义（写前确认 + SQL 文本校验），或首版直接置为只读并标注 |
| 8 | 元数据（索引/FK/触发器/分区） | 引擎无对应工具（旧版也是 SQL 合成） | 原样移植 `database-catalog.ts` 的只读 SQL，按 `family` 分方言 |
| 9 | 全局快捷键 / 宿主命令面板集成 | 插件只可 `ui.shortcuts.register` 注册插件作用域 | 首版不做；需要时单独评估 |
| 10 | 独立窗口式「数据库设置」页 | 插件无页面路由权（只有 activity-tab / workspace-view） | 设置做进插件自身面板的侧栏或弹层 |

---

## 8. 构建 / 测试 / 坑

`【实证】` `BUILD.md` 与 `package.json`：

| 项 | 值 |
| --- | --- |
| 依赖 | `@astravia-org/plugin-sdk ^0.3.10`、`@astravia-org/plugin-vite ^0.2.4`、`@astravia-org/plugin-cli ^0.1.7`、React 19.1.1、Tailwind 4.1.12、Vite 7.1.7、TS 5.9.2 |
| 命令 | `npm run build`（= `vite build`）、`npm run check`（= `tsc --noEmit`）、`node --test src/test/*.test.js` |
| 真实耗时 | build ≈ 2 分钟；单测 25/25 ≈ 76ms |
| 坑 1 | 需要 `@astravia-org/*` 的 `node_modules` 符号链接（BUILD.md 要求） |
| 坑 2 | MF 空闲超时补丁 10s→120s，会被 `bun install` 重置 |
| 坑 3 | 版本需 4 处同步（`plugin.json`、`package.json`、`ability.json`、`src/index.tsx`？见 BUILD.md） |
| 坑 4 | 发布走 `gh release`；`dist/` 不入库 |
| 验收基线 | 当前 `npx tsc --noEmit` **exit 2 / 24 错误**（§3）→ 一切改造的最低门槛是归零 |

首次联调：`node scripts/marketplace.mjs check` + `node scripts/marketplace.mjs build` +
`node --test tests/*.test.mjs`（内容测试须在构建后）。本机 Python shim 环境可用
`ASTRAVIA_PYTHON` 指向真实解释器。

---

## 9. 迁移映射与硬性改造清单

### 9.1 存储映射

| 旧 | 新 |
| --- | --- |
| `localStorage` 6 类键（见 `design-spec.md` §5.1） | `ctx.storage` 的 `explorer.json` / `query-history.json` / `groups.json` |
| 引擎 `dbx.db#connections` | `connections.json` + `ctx.secrets` |
| SQLite CLI 直写 `dbx.db` | 删除（`sqlite3` 从 `commands` 移除） |
| 宿主 `database.*` 配置 | 插件内 `settings.json`（语义等价，键名自定） |

### 9.2 硬性改造清单（按依赖顺序）

1. **确定数据通路**（A / B / C，§5）——决定 `plugin.json` 权限、`providers`、`network`、`agent.mcpServers`。
2. **实现引擎服务层**（`service/main.mjs` + 驱动池），先支持 §6 一等类型。
3. **重写 `src/domain/`**：`connection-config.ts` 瘦身为「连接模型 + 类型元数据」，新增 `engine-client.ts`、
   `settings-store.ts`、`connections-store.ts`；删除 `dbx-cli.ts`、`dbx-storage.ts`。
4. **移植纯逻辑 `lib/`**（`design-spec.md` §7「可直搬」清单）。
5. **重建面板 UI**，按 `design-spec.md` §1 的尺寸与 token；拆分为 explorer / query / result / details / settings 子目录。
6. **修 `src/index.tsx`**：`%tab.label%` 目录键、去掉内联 SVG 图标（继承 `plugin.json#icon`）、去掉手动 dispose、删死代码。
7. **修 `src/runtime-contract.ts`**：顶层 `process.env` 移入激活期。
8. **重写 `src/style.css`**：删 `fixed` 浮层与 `.dark .dbx-*` 硬编码。
9. **i18n 全量**：`locales/{zh,en}.json` 覆盖全部字符串，消除中文字面量。
10. **补测试**：纯逻辑单测 + 服务层契约测试；`tsc --noEmit` 归零；真机走一遍 `design-spec.md` §4 清单。
11. **同步版本与文档**：`plugin.json`/`package.json`/`ability.json` 版本提升，
    `ability.json` 与 `detail*.json` 的「via dbx CLI / 60+ 数据库」描述改为实际能力与支持矩阵。

---

## 10. 待复验清单（本文件中的 `【推断】`/`【未知】`）

- [ ] `host-node` 服务在真机的可用性（无参考实现；`ctx.services.install` 载荷格式与体积上限）。
- [ ] `ctx.network.request` 访问 `127.0.0.1` 是否必须列入 `network.allowedHosts`。
- [ ] `ctx.fs` 是否能读取用户拖入/选择的数据库文件路径。
- [ ] 宿主 Node 版本是否 ≥22.5（决定 `node:sqlite` 可用性）。
- [ ] 纯 JS 驱动全量入包后的实际体积与市场限额的余量。
- [ ] `settings.read`/`settings.write` 是否存在可用 API（当前 dist 无对应模块）。
- [ ] 挂载点选 `registerActivityTab` 还是 `registerWorkspaceView`（带宽/布局差异）。
