# dbx-pro 工作台重构 — 实施计划（leader 冻结稿）

依据：`design-spec.md`（旧工作台设计还原规格）、`plugin-constraints.md`（插件约束与引擎真相）、
`engine-runtime.md`（自持引擎通路实证，产出中）。
用户决策：**UI 高保真还原 + 自持纯 JS 引擎，一步到位**；类型清单**全量保留 + 标注能力档位**。

---

## 0. 验收口径（用户已确认）

- 自证即可：`tsc --noEmit` 归零 + `vite build` 成功 + 单测全绿 + 「旧组件 → 插件组件」逐条对照清单。
- 不跑旧项目截图对照。设计还原度按 `design-spec.md` 的 L1 结构 / L2 视觉 / L3 交互 / L4 状态四层验收。
- 全程只改 `abilities/plugins/dbx-pro`。保留工作区已有改动（staged：`locales/*.json`、`dbx-pro-panel.tsx`、
  `index.tsx`、`scripts/static-marketplace.mjs`；unstaged 的 `web-element-picker` 两个文件**严禁触碰**）。

## 1. 分层（冻结）

```
UI 组件 ──▶ hooks（三个 model）──▶ services（stores + engine-client）──▶ engine 服务进程 ──▶ 数据库
                                          │
                                          └─ ctx.storage 持久化 / ctx.secrets 存密码
```

- **UI 不得直接调用 transport**；只能经 hooks。
- **engine-client 与宿主通路解耦**：通路只实现在 `engine-transport.ts`，换通路不改上层。
- **引擎进程对连接配置无状态**：每次请求携带连接参数（含密码），引擎按连接指纹维护连接池。
  连接配置的持久化归插件（`ctx.storage` + `ctx.secrets`），引擎不落盘。

## 2. 引擎协议（冻结）

单一 Node 进程，两种入口共用同一套 handler：

| 入口 | 用途 | 消费者 |
| --- | --- | --- |
| `http-server.mjs` | 回环 HTTP，JSON 收发 | 面板 UI |
| `stdio-server.mjs` | MCP stdio（换行分隔 JSON） | Agent（`agent.mcpServers`） |

HTTP 端点（全部 POST，`Content-Type: application/json`）：

| 端点 | 入参 | 出参 |
| --- | --- | --- |
| `GET /health` | — | `{ version, drivers[], pid }` |
| `POST /test` | `{ connection }` | `{ serverVersion, latencyMs }` |
| `POST /catalog` | `{ connection, scope }` | `{ nodes[] }`（scope: `databases`/`schemas`/`tables`/`columns`/`objects`） |
| `POST /describe` | `{ connection, scope, table }` | `{ columns[], objects[] }` |
| `POST /query` | `{ connection, sql, options }` | `{ columns, rows, rowCount, truncated, durationMs, affectedRows? }` |
| `POST /context` | `{ connection, scope, tableNames }` | `{ text }` |
| `POST /table-op` | `{ connection, op, target }` | `{ affectedRows }`（op: `truncate`/`drop`/`rename`） |

统一信封：成功 `{ ok: true, data }`；失败 `{ ok: false, error: { code, message, detail? } }`。
错误码沿用旧项目语义 + `CONFIRM_MISMATCH`、`DRIVER_UNSUPPORTED`、`ENGINE_NOT_READY`。

安全：只绑 `127.0.0.1`；启动时生成随机 token，经 env 传给引擎，所有请求带 `X-Dbx-Token`。
`options` 含 `rowLimit`（默认 100）、`timeoutMs`（默认 30000）、`confirmedWriteSql`（写闸门绑定）。

## 3. 驱动矩阵（类型全量保留，档位标注）

`src/domain/driver-matrix.ts` 为 87 个类型逐一标注：

| 档 | 类型 | 实现 |
| --- | --- | --- |
| 一等（真连） | postgres、mysql、mariadb、sqlite、mssql、clickhouse、redis、mongodb | 官方纯 JS 驱动 |
| 实验（尽力） | duckdb、cloudflare-d1、turso、databricks、bigquery、snowflake | REST 或 wasm，逐个评估 |
| 不可达 | oracle、db2、saphana、teradata、dameng、kingbase、gaussdb、oceanbase… | 表单可填、保存可用，执行时返回 `DRIVER_UNSUPPORTED` 并附说明 |
| 超范围 | mq/mqtt/etcd/zookeeper/nacos/consul/argo/salesforce/spanner… | 标注为实验性/不提供执行 |

UI 必须在类型选择器、连接详情、错误态三处如实呈现档位，**不得宣称未实现的能力**。
`ability.json` / `detail*.json` 里「via dbx CLI / 60+ 数据库」的描述必须改写为实际能力与矩阵。

## 4. 打包与体积（已实证）

- 打进 `.astraviapkg` 的只有：`plugin.json`、`ability.json`、`assets/`、`dist/`、`locales/`
  （由现有制品 `unzip -l release/dbx-pro-0.0.11.astraviapkg` 反推）。
- **引擎产物必须落在 `dist/` 内**，且要在 vite 清空 outDir **之后**生成：
  `"build": "vite build && node scripts/build-engine.mjs"`。
- 驱动依赖装进 **`service/package.json` 独立树**，不动插件主工具链的 `node_modules`
  —— 主工具链依赖手工补的 x64 原生包，任何 install 都可能把它重置。
- 引擎用 esbuild `bundle + splitting` 按驱动**分文件**输出，规避「单文件 ≤8MB」上限，并实现按需加载。
- 限额：归档 ≤25MB、解压 ≤100MB、单文件 ≤8MB。

## 5. 文件布局（冻结；遵循 AGENTS.md「文件名必须表达职责」）

```
service/                      # 引擎源码，不进包
  package.json                # 驱动依赖（独立树）
  http-server.mjs  stdio-server.mjs
  engine/{request-router,driver-registry,connection-pool,query-guard,protocol}.mjs
  drivers/{postgres,mysql,sqlite,mssql,clickhouse,redis,mongodb}-driver.mjs
scripts/build-engine.mjs      # esbuild → dist/engine/
src/
  index.tsx                   # 仅装配入口
  domain/                     # 纯逻辑与元数据（可直搬旧 lib/）
  services/                   # engine-client / engine-transport / *-store
  hooks/                      # use-workspace-model / use-explorer-model / use-query-model
  shared/components/          # 一文件一组件的基础视觉件
  features/
    workbench/ explorer/ sql-workbench/ connection-management/ details/ ai-scope/ settings/
  test/*.test.mjs
```

删除：`src/features/connection-management/services/dbx-cli.ts`、`src/domain/dbx-storage.ts`（通路作废）。

## 6. 硬性改造项（来自 `plugin-constraints.md` §9）

1. `src/style.css`：删 `position:fixed` 视口级浮层与 `.dark .dbx-*` 硬编码 hex，改容器内 `absolute` + 语义 token。
2. `src/runtime-contract.ts`：顶层 `process.env.HOME` 移入激活期（MF 顶层求值陷阱）。
3. `src/index.tsx`：`label` 用 `%tab.label%` 目录键；去掉内联 SVG（继承 `plugin.json#icon`）；
   去掉手动 `dispose()`（宿主自动回收）；删死代码 `registerAgentTool`。
4. `plugin.json`：移除 `sqlite3` 命令、`dbx` 命令；按实证结论增补权限 / `providers` / `network` / `agent.mcpServers`。
5. i18n 全量：`locales/{zh,en}.json` 覆盖所有字符串，**禁止中文字面量**；`categoryI18n` 补齐 `zh`/`en`。
6. 版本同步：`plugin.json`、`package.json`、`ability.json`、`.astravia/marketplace.source.json`。

## 7. 分阶段交付与验收门

| 阶段 | 内容 | 验收门 |
| --- | --- | --- |
| D1 引擎与数据层 | `service/` 引擎 + 驱动 + `engine-client`/`engine-transport` + stores；删作废通路 | 引擎 headless 可用（对 sqlite 实测跑通一条查询）；`tsc` 相关文件归零；引擎单测绿 |
| D2 视觉基座与连接管理 | `shared/components/*`、`domain/*` 纯逻辑、连接列表/表单/类型选择器/详情 | `tsc` 归零；build 成功；对照清单相应条目可勾 |
| D3 对象树 | explorer 全量：懒加载、三态、分组、右键、行内工具、并发闸门、持久化 | 同上 |
| D4 查询工作台 | 标签栏、查询面板、SQL 编辑器、结果网格、历史、表详情、设置、AI 注入 | 同上 |
| D5 收尾 | index/runtime-contract/style.css、i18n 全量、ability/detail 文案与矩阵、版本同步、真机联调 | `tsc` 0 / build 成功 / 单测全绿 / 逐条对照清单完成 |

## 8. 风险

| 风险 | 应对 |
| --- | --- |
| `host-node` 服务通路无先例 | `engine-runtime.md` 实证；不可用则降级 spawn+回环 HTTP（同一份引擎代码复用） |
| 宿主 Node 版本低导致 `node:sqlite` 不可用 | 降级 `sql.js`（wasm，随包分发） |
| 驱动包体积超限 | 按驱动分文件 + 只装用得到的驱动 |
| 主工具链 x64 原生包被 install 重置 | 引擎依赖独立树；不跑会重写插件 node_modules 的安装 |
| 87 类型中的不可达类型被误认为可用 | 三处 UI 标注 + 文案改写 + 错误码说明 |

## 9. 据 `engine-runtime.md` 实证后的冻结决策（覆盖前文冲突处）

| 议题 | 决策 | 依据 |
| --- | --- | --- |
| 数据通路 | **通路 A**：`plugin.json#providers.services`（`kind: "host-node"`）+ `ctx.services.request` | 宿主真实实现 811+302 行；`plugin-service-provider-service.ts` |
| 降级通路 | 通路 B：`ctx.command.spawn` + `ctx.network.request`，需 `allowedHosts` 显式写 `127.0.0.1`（无回环豁免） | `plugin-network-service.ts:60` |
| SQLite 驱动 | **`node:sqlite`**（托管 Node 22.22.2 免 flag 实测可用），不用原生模块、不用 sql.js | `~/.astravia/runtimes/node/22.22.2/bin/node` 实测 |
| 引擎产物 | 每平台 `executable` 与 `entry` 指向同一 `.mjs`；`install()` 需 base64 上传且 sha256 逐一匹配 | `plugin-service-runtime-installer.ts:262-287` |
| 引擎交付形态 | 按驱动**分文件**（`engine/main.mjs` + `engine/drivers/*.mjs`），面板 `?raw` 内联 → base64 → `install()`；运行时用相对 `import()` 动态加载 | 规避单文件 ≤8MB |
| 查询超时 | 必须**显式**传 `timeoutMs`（宿主默认 30s，旧工作台默认 30000ms 正好压边界）；上限 5min | `plugin-service-provider-service.ts:30-33` |
| UI 基元 | **自实现** Button / Dialog / DropdownMenu 等（语义 token + Tailwind），**不启用 `hostUi`** | `@astravia-org/ui` 未发布 npm（E404），启用需 vendored 类型，代价大于收益 |
| SQL 编辑器 | 插件自带 `codemirror@6` + `@codemirror/lang-sql` | 宿主 UI 包不含编辑器组件 |
| 设置来源 | 宿主 `database.*` 配置**读不到**，安全闸门 / 行数 / 超时全部插件自建于 `ctx.storage` | `ctx.settings` 不存在（SDK 34 模块零命中） |
| Agent 直连库（通路 C） | **暂缓**，D1–D5 完成并证明通路 A 后单独评估（需 `agent.mcp.control`） | 一次性引入第二个未验证集成，风险叠加 |
