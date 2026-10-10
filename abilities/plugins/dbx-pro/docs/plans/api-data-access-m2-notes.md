# 通过 API 访问数据 —— M2「API 接入」实施记录（2026-10-10）

> 对应决策：[ADR-0008](../adr/adr-0008-api-data-access.md) §9 的 M2、§10.5 的验收表
> 实施方案：[api-data-access-implementation-plan.md](./api-data-access-implementation-plan.md) §3 的 T-M2-1 ~ T-M2-4
> 上一阶段：[api-data-access-m1-notes.md](./api-data-access-m1-notes.md)

## 一句话

M2 结论：**「插件自己当数据源」这条路落地成立 —— 用户填一个带认证头的 HTTP 接口，就能在标签页里写 SQL、返回行；连接不出现在引擎的连接列表里，凭据只有一份、明文快照可清。**

与 M0 / M1 最大的不同：**这次不改任何上游引擎，也不需要用户额外部署东西**。取数、缓存物化、SQL 执行全在插件进程内，用户看到的仍然是一棵树 + 一个结果网格。

## 落地形态

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 定义 | `src/domain/connection-config.ts` | `ApiConnectionSpec` / `ApiAuthSpec` / `api?` / `hasSecret?`。**`api` 不进 `DB_TYPE_MANIFEST`** |
| 界面 | `services/api-connection-form.ts` | 纯逻辑：认证方式选项、默认值、patch 合并、请求头文本 ⇄ 表 |
| 界面 | `components/api-connection-fields.tsx` | 表单分支（接口地址 / 方法 / 认证 / 数据路径 / 行数上限） |
| 界面 | `services/connection-type-catalog.ts` | 「接口」分组 + `API_CATALOG_ENTRY`（虚拟类型，只活在插件自己的通道里） |
| 客户端传输 | `src/shared/services/engine-client.ts` | `engineSaveApiSource` / `engineDeleteApiSource` / `engineTestApiSource` |
| 服务端 | `server/src/api-source/api-store.mjs` | `<dataDir>/api-connections.json`（0600、tmp+rename）；`__dbx_pro_api__` 内部连接登记 |
| 服务端 | `server/src/api-source/api-source.mjs` | 归一化配置、认证头组装、点路径抽行、列类型推断、快照文件名 |
| 服务端 | `server/src/api-source/api-fetch.mjs` | 出站 HTTP（超时钳制、错误码映射） |
| 服务端 | `server/src/api-source/sql-rewrite.mjs` | 把 `from <连接名>` 改写成 `read_json_auto('<快照>')`，支持限定名 / 别名 / CJK 标识符 |
| 服务端 | `server/src/api-source/api-query.mjs` | 取数 → 归一化 NDJSON 物化（0600）→ 交给引擎的本地 duckdb 执行 |
| 服务端 | `server/src/engine/request-router.mjs` | `/api-sources`、`/api-sources/test`、`/query` 的**路径 0** |

## 与计划的偏离（以代码与实测为准）

1. **「接口」分组排在分组列表最前**，不是计划里的「文档 / NoSQL 之后」：它是最常用的新建入口。实测见 `src/test/connection-type-catalog.test.js`。
2. **存储只有一份**：计划写的是「本地镜像 + 加密凭证库」，实现改成**服务端单个 0600 文件**同时装配置与凭据。理由是没有必要为同一把 token 再多两份副本；代价是服务端进程可读明文（已在 ADR §4.2「实现修正」里写明）。
3. **物化快照按 0600 写、删除连接时一并清掉**：快照是接口返回数据的明文副本，连接没了就不该留在磁盘上（ADR §4.2 未覆盖，属本轮加固）。
4. **`api` 不是引擎认识的类型**：插件登记**一个共享的内部 DuckDB 连接** `__dbx_pro_api__`，`__` 前缀让它不出现在连接树里。计划里「路径 0」描述的行为与实现一致，但实现细节（共享连接 + 快照文件）是新增的。
5. **查询每次都重新取数**，没有 TTL 缓存：第一版取「数据总是新的」，缓存策略留给后续。

## 验收证据

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 类型选择里出现「API 接入」，归属「接口」分组 | ✅ | `src/test/connection-type-catalog.test.js` |
| 表单保存带认证头的接口 | ✅ | e2e `POST /api-sources` → 200，`type=api` |
| 不写本地镜像、不调 `writeConfig` / `deleteConfig` | ✅ | `src/test/use-connection-editor.test.js`（13 例） |
| 凭据不回传 | ✅ | e2e：`hasSecret=true`，响应串里搜不到 token |
| 存储 0600 | ✅ | e2e + `server/test/api-source.test.mjs` 都对 `mode & 0o777` 断言 |
| 连接树 / 字段发现的服务端契约 | ✅ | `server/test/request-router.test.mjs`：`/tables` → `[{ name, kind: "table" }]`，`/describe` → 5 列带类型 |
| `select ... from <数据源>` 取到行 | ✅ | e2e：7 行；限定名 + 别名；`where amount >= 30` → `n=5, total=250` |
| 写 / DDL 被拒 | ✅ | e2e：`WRITE_BLOCKED(403)` |
| 没有引用任何 API 数据源时的报错是诚实的 | ✅ | e2e：`API_SOURCE_NOT_REFERENCED(400)` + 可用数据源名 |
| 重名保护 | ✅ | e2e：与已有连接同名 → `BAD_REQUEST` |
| 删除后无残留（连接 / 凭据 / 明文快照） | ✅ | e2e 三条断言全过 |
| **UI 实际渲染与交互** | ◐ | **未在桌面端手工点过**：树、结果网格、导出都没人眼确认 |

汇总（本轮最后一次全量执行）：

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 无输出 |
| `node --test server/test/api-source.test.mjs` | 55 / 55（14 suites） |
| `node --test server/test/request-router.test.mjs` | 28 / 28（4 suites） |
| `npm test` | 865 例，864 通过，0 失败，1 跳过 |
| `harness/api-data-access-e2e.mjs` | **23 / 23 通过** |

关于最后一行的「UI 未确认」：代码层已经核过一轮 —— 连接卡片与对象树走的是既有通用分支（`getDatabaseTypeVisual` 未收录 `api` 时回退灰色缩写徽标 `AP`；`DatabaseTypeIcon` 回退中性的 lucide 数据库图标；`connection-manager-view.tsx` 的次级文字直接显示类型 id `api`），不会报错也不会留空。但目前**确实是中性兜底而不是专门的「接口」图标 / 译名**，要不要做品牌化留给 UI 评审。

## 复现配方（不碰用户数据）

```bash
cd abilities/plugins/dbx-pro

# 1) 本地假接口：需要 Authorization: Bearer secret-token-123，返回嵌套 JSON
node harness/api-data-access-mock-api.mjs

# 2) 另一个终端：真实插件 HTTP 服务 + 真引擎 DuckDB
DBX_DUCKDB_DRIVER_PATH=<duckdb 驱动目录> node harness/api-data-access-e2e.mjs
```

两个脚本都在 `harness/` 下（**不在制品白名单内**，不进 `.astraviapkg`），数据目录是临时目录。

> 不设 `DBX_DUCKDB_DRIVER_PATH` 时 `/query` 会返回 501：接口数据已经取到了，只是没有引擎侧的 DuckDB 驱动来跑 SQL。这是**环境缺失**，不是功能回归。

## 未实测（不得宣称）

- `POST` / 请求体模板、分页 / 游标：M2.2，**未实现**
- 大结果集：响应体全量读进内存，**无字节上限**；单数据源行数上限 1000（引擎约束）
- 并发：多数据源同时取数、同一连接并发查询**未测**
- `http://` 出站是否被 `plugin.json` 的 `network.allowedHosts` 拦截：**未测**，本轮未改白名单
- 跳转：当前 `redirect: "follow"`，**未做**「跳到不同主机就拒绝」（M2.3）
- 桌面端 UI 手工点击：新连接表单、连接树、结果网格、导出

## 事后修正：认证表单三处对不上的地方（2026-10-10，同轮）

用户按表单实际操作时发现，先按「修」处理：

1. **Bearer 下的「令牌」框是空的** —— 那个框内部绑的是 `auth.prefix`（值前缀），而服务端 `normalizeAuth` 对 bearer 直接返回、不读前缀，填了也会被丢掉。现在该框只在 **API Key** 下出现。
2. **同一个框在 API Key 下的名字不达意** —— 它真的是「值前缀」（`<headerName>: [prefix ]<key>`），改名为 **值前缀（可选）**，并加一行说明：填 `Token` 就发出 `X-API-Key: Token <凭据>`。这也是 `Authorization: token abc` 这类非标准方案的推荐搭法。
3. **自定义请求头再保存被清空** —— 客户端从不收到 `headers`（值里可能藏凭据），框里天然是空的，旧逻辑却把 `{}` 提交上去，把已存请求头整个盖掉。

第 3 条的收口方式：**缺省即沿用，显式传（含空对象）才覆盖**，与早就存在的凭据语义一致。

- 客户端 `apiSourcePayload` 只在 `spec.headers !== undefined` 时带上键；没被动过的框就是「缺省」。
- 服务端 `upsertApiSource` 在载荷无 `headers` 键时沿用已存值；无请求头的新连接仍写入 `{}`。
- `/api-sources/test` 同样回退到已存请求头，否则「测一下」会用一个和真实查询不同的请求。
- 连接摘要新增 `hasHeaders`（只告知有没有，不回传内容），驱动占位文案「已保存，留空表示不修改」。

### 印证（实测）

- 服务端：`请求头缺省时沿用已存值，显式传空对象才清空`（`{"X-Env":"prod","Accept-Language":"zh-CN"}` 经一次无 `headers` 的保存后原样保留；传 `{}` 则清空）；`连接摘要只告知有没有请求头，不回传内容`。→ `server/test/api-source.test.mjs` **57/57**。
- 路由：`/api-sources/test` 草稿无 `headers` 键 → mock 收到 `x-env: prod`；草稿带 → 收到 `x-env: dev`。→ `server/test/request-router.test.mjs` **30/30**。
- 客户端：`ApiConnectionFields` 新增 7 条渲染断言（Bearer 无前缀框、API Key 为「请求头名/值前缀/凭据」、Basic 为「用户名/密码」、两种占位文案）；hook 新增「请求头原样回传」「显式清空回传空对象」「缺省不带键」。→ `src/test/api-connection-fields.test.js` 7/7、`src/test/use-connection-editor.test.js` **15/15**。
- 全量：`npm test` **878 tests / 877 pass / 0 fail / 1 skipped**；`npx tsc --noEmit` 干净；`npm run build` 通过（29 runtime files）。

界面上「凭据只保存在本机」的说明改为「仅本机账号可读」：实际落盘是 0600 的本地文件（`api-connections.json`），不是加密存储（见 ADR §4.2 实现修正）。

## 版本与发布

- `plugin.json` 与 `.astravia/marketplace.source.json` 都还是 **0.4.0**，本轮**没有**动版本号。M2 是代码类改动、会改变分发内容，按仓库规则需要提升能力版本并同步身份文件 —— 但这条版本线同时被另一条（数据资产 / 可视化）在途改动占用，提版时机交给发布决定，不在此处默默改。
- `dist/` 与 `release/` 都不提交；`node --test tests/*.test.mjs` 是内容测试，放构建前/后均可，但**内容测试要在构建后跑**才能覆盖生成的插件资源。
