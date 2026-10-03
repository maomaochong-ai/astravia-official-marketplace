# dbx-pro 数据库工作台 — 设计还原度对照清单

对照基准：旧项目 `packages/desktop-app/src/renderer/domains/database/`
（`components/*.tsx` 共 **6412 行**）。
对照对象：插件 `abilities/plugins/dbx-pro/src/`（面板当前 **512 行**）。
口径：**逐组件判定**，分「已还原 / 结构等价但合并实现 / 未还原」三档，每条给出插件侧落点。
行号均为本文件生成时实测值（`grep`/`wc` 输出），**全部条目属【实证】**。

---

## 一、已还原（结构与交互对齐）

| # | 旧项目组件 | 插件落点 | 还原内容 |
| --- | --- | --- | --- |
| 1 | `DatabaseWorkspace.tsx` | `dbx-pro-panel.tsx`（`DbxProPanel`） | 三栏骨架：左连接/对象树、中 SQL 工作区、右表信息；顶栏 + 底部状态栏 |
| 2 | `DatabaseWorkspaceHeader.tsx` | `dbx-pro-panel.tsx:371-375` | 刷新连接 / 执行 / 添加连接主操作 |
| 3 | `DatabaseExplorerTree.tsx` | `dbx-pro-panel.tsx:66`（`ConnectionTree`）、`:112-137`（树渲染） | 连接 → schema → 表三级树、展开态、选中态、表内联操作 |
| 4 | `DatabaseExplorerContextMenu.tsx` | `dbx-pro-panel.tsx:497-502`（连接菜单）、`:504-509`（表菜单） | 表右键：预览数据 / 复制表名；**连接右键：编辑连接 / 删除连接** |
| 5 | `DatabaseConnectionForm.tsx` | `features/connection-management/components/connection-form.tsx` | 连接列表 + 新建/编辑表单 + 测试连接 + 类型选择，内建增删改 |
| 6 | `DatabaseQueryPanel.tsx` | 面板中部（`SqlEditor` + `ResultGrid` 装配区）、`:79`（`SqlTab` 类型） | 多查询 Tab、新建/关闭 Tab、执行、执行态禁用 |
| 7 | `DatabaseResultGrid.tsx` | `features/sql-workbench/components/result-grid.tsx` | 结果表格：列头、行渲染、行内编辑与删行 |
| 8 | `DatabaseStatus.tsx` | `dbx-pro-panel.tsx:50`（`ConnStatus`）、`:119`（状态点）、`:351`（`statusOf`）、`:420`（状态栏） | 连接状态**语义化着色** + 行数/耗时/选中表信息 |
| 9 | `DatabaseSurface.tsx` | `dbx-pro-panel.tsx:23`（本地 `Surface`） | 面板容器语义（边框/圆角/底色） |
| 10 | `DatabaseSectionLabel.tsx` | `dbx-pro-panel.tsx:27`（本地 `SectionLabel`） | 区块标题 + 可选图标 |
| 11 | `DatabaseBadge.tsx` | `dbx-pro-panel.tsx:36`（本地 `Badge`） | 小标签 |
| 12 | `DatabaseTypeBadge.tsx` | `dbx-pro-panel.tsx:40`（本地 `TypeBadge`）+ `src/domain/database-type-visual.ts` | 数据库类型色标胶囊（87 类配色表，含 fallback） |
| 13 | `DatabaseDetail.tsx` / `database-details-shared.tsx` | `dbx-pro-panel.tsx:437`（右栏 `Surface`）、`:451-476`（表信息 / 列 / 索引） | 表名卡、预览数据按钮、**列清单**、**索引清单（含 UNIQUE 标记）** |
| 14 | `DatabaseTypePicker.tsx` | `connection-form.tsx`（按 `DB_TYPE_MANIFEST` 渲染类型选择） | 连接类型选择 |

**本轮新增的三处还原缺口修补**

| 项 | 落点 | 说明 |
| --- | --- | --- |
| 左栏搜索/过滤框 | `dbx-pro-panel.tsx:95-99`（输入框）、`:78-80` + `:82-91`（过滤状态与函数） | 同时过滤连接与表；连接名命中时展示其全部表 |
| 表详情索引展示 | `dbx-pro-panel.tsx:175`（state）、`:254`（`refreshIndexes`）、`:465-476`（渲染）+ `src/domain/catalog.ts` 新增 `listFlatIndexesSql` | flat 家族（SQLite）走 `pragma_index_list` 取 `name` + 唯一性；schemas/databases 家族走 `tableObjectSql(family,"index",…)` |
| 结果导出 CSV | `dbx-pro-panel.tsx:334`（`exportCsv`）、`:427-429`（状态栏按钮） | 纯前端 `Blob` 生成，结果非空时出现 |

**诚实性修补**：连接状态点原为硬编码常亮绿灯，已改为只反映本会话真实发生过的事——
`idle` 灰（尚未执行过查询）/ `ok` 绿（最近一次成功）/ `running` 琥珀脉动 / `error` 红，并带 `title` 说明（`:119`）。

---

## 二、未还原（诚实差距清单）

| # | 旧项目能力 | 插件现状 | 影响 | 备注 |
| --- | --- | --- | --- | --- |
| G1 | `DatabaseQueryHistoryPopover.tsx` 查询历史 | 无（`grep history` 在 `src/` 零命中） | 中 | 可补功能，非布局缺口 |
| G2 | `DatabaseSettingsPanel.tsx` 工作台设置 | 无（`grep Settings` 零命中） | 中 | 旧设置来自宿主全局配置，插件读不到，需自建 |
| G3 | `SchemaInjectionScopePanel.tsx` + `lib/ai-anchor.ts` AI 上下文注入 | 无（`grep Injection`、`ai-anchor` 均零命中） | 中 | 需 Agent 侧接口，当前 SDK 面未开放 |
| G4 | `explorer-row-tools.tsx`（223 行）行工具 | 部分：仅表级（预览/复制名） | 低 | 列级/索引级操作未做 |
| G5 | `DatabaseNotice.tsx` / `DatabaseListHeader.tsx` | 无独立基元（`grep` 零命中），由内联样式等价表达 | 低 | 视觉基本一致，缺独立可复用组件 |
| G6 | 真实远端库连通（PostgreSQL/MySQL/…） | 连接类型 85 项**全量列出并标注档位**；自持引擎已落盘并 headless 跑通，但只有 SQLite 驱动 `ready:true`，其余 9 类如实返回 `DRIVER_UNSUPPORTED` | 高 | 属数据层；引擎通路已就绪，后续按驱动逐个补 |

---

## 三、验证证据（本轮回执）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | **exit 0** |
| 单元测试 | `node --experimental-strip-types --test src/test/*.test.js` | **`# tests 66 / # pass 66 / # fail 0 / # cancelled 0`**（基线 49 + 引擎 14 + 第三轮审计回归 3） |
| 构建 | `npx vite build` | **✓ built in 11.62s**；`release/dbx-pro-0.0.11.astraviapkg`（**307 382 B / 22 runtime files**，含 `service/main.mjs` + `service/drivers/sqlite-driver.mjs`） |
| 引擎套件（源码入口 + 产物入口） | `node --test src/test/engine-service.test.js`；`DBX_ENGINE_ENTRY=service/main.mjs node --test …` | **两个入口各 `# tests 17 / # pass 17 / # fail 0 / # cancelled 0`**，无任何 `not ok`（套件级 TAP 缺陷根因：末个用例已主动 `stop()`，`after()` 再 `stop()` 时子进程早已退出，`once("exit")` 永不触发；已改为幂等 `stop()`） |
| 引擎产物哈希 | `node scripts/build-engine.mjs --check` + 独立 `shasum -a 256` | `service/main.mjs` 29 748 B / `dbe2350b…c814e`；`service/drivers/sqlite-driver.mjs` 11 977 B / `f22a82ca…9417f`，两项 `status: "ok"`，与 `plugin.json` 声明逐位一致；引擎版本 `0.1.1`（字节变化已抬版本，宿主才会重装） |
| 市场源校验 | `node scripts/marketplace.mjs check` | **Validated source entries for astravia-official-marketplace**（exit 0） |
| 索引 SQL 实证 | 真实 `sqlite3 -json "SELECT name, CASE WHEN \"unique\"=1 THEN 'YES' ELSE 'NO' END AS is_unique FROM pragma_index_list('users') ORDER BY name"` | 返回 `idx_users_email/YES`、`idx_users_name/NO`，**exit 0** ⇒ 右栏索引取数路径真实可用 |
| **引擎 headless E2E（leader 独立复验）** | `node service/src/http-server.mjs --port 3998 --auth-disabled` + `curl` | `/health` 返回 `drivers` 档位表（sqlite `tier:first-class, ready:true`；postgres/mysql `tier:experimental, ready:false`）；`/query` 真实 SQLite 取回 2 行；`/catalog` 返回 `main` 命名空间 + `users` 表；写语句无授权时返回 **`WRITE_BLOCKED`** |
| **引擎鉴权闸门（leader 独立复验）** | 带 `ASTRAVIA_SERVICE_SECRET_ENGINE_KEY` 启动后 `curl` | 不带令牌 → **HTTP 401 / `UNAUTHORIZED`**；带 `Bearer` 令牌 → 查询成功 |
| **第三轮审计 B1（字符串内注释符）** | 真起引擎 + 真 HTTP | `SELECT 'x/*y*/z'` → 200 原样返回；`INSERT … ('p/*q*/r')` 落库后读回仍是 `p/*q*/r`；`SELECT 'a;b'` → 200 且 `statement_count=1`（此前分别被改坏 / 502 / 误 403） |
| **第三轮审计 B2（坏文件挂死）** | `POST /query {file:"/etc/passwd"}` | **102 ms** 返回 502 `CONNECTION_ERROR`；随后 `/health` **7 ms** 200，进程存活 —— 此前 ≥150 s 不返回、SIGTERM 无效 |
| **第三轮审计 B3（鉴权 fail-open）** | 不设密钥 / 密钥为空各起一次引擎 | 两次均**非零退出**并输出 `{"event":"server-error","code":"NO_SECRET"}`；显式 `--auth-disabled` 仍可启动（如实上报 `auth:"disabled"`） |
---

## 四、残留风险

- **R-a 基元内联**：`Surface` / `SectionLabel` / `Badge` / `TypeBadge` 定义在 `dbx-pro-panel.tsx:23-45`，与仓库「基础组件一个文件只放一个组件」的约定有偏差；`src/shared/components/` 目前仅保留 `modal-dialog.tsx`。
- **R-b 引擎已实现但宿主全链路未联调**：`service/src/**` 7 个文件（http-server / driver-registry / engine/{protocol,query-guard,connection-pool,request-router} / drivers/sqlite-driver）与构建产物 `service/main.mjs`、`service/drivers/sqlite-driver.mjs` 均已落盘并进包；`plugin.json#providers.services` 声明 `host-node` / 5 平台 / `credentials[engine-key]` / `templates[]`。**已由 leader 独立 headless 复验**（/health 档位表、/query 真实取数、/catalog、WRITE_BLOCKED、401 鉴权、第三轮审计 B1/B2/B3 回归），但**真实 Desktop 的 `install() → start() → /health` 全链路无联调环境，未验证** ⇒ 非 SQLite 类型的真实连通不在本次已验证范围内（`postgres`/`mysql` 等 9 类仍如实返回 `DRIVER_UNSUPPORTED`）。
- **R-c 未做像素级截图比对**：按约定采用「组件对照 + 自证门禁」验收，未做截图 diff。
- **R-d `allowWrites` 仍为常量**：写入闸门当前固定关闭，尚未接真实策略配置。
