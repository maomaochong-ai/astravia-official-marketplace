# ADR-0002: 查询网格导出参数与 dbx 桌面壳对齐分析

## 状态
已实施（改动 1-8 全部完成）

## 背景
dbx-pro 插件（数据库工作台）的查询网格分页、导出、表预览等参数需要与 dbx 桌面壳（`dbx/apps/desktop`）保持一致。当前存在多处数值不对齐，导致用户体验差异明显——最典型的是插件侧手动执行 SQL 后出现「结果达到单次取回上限 1000 行，仅展示前 1000 行」的截断提示，而 dbx 桌面壳在相同场景下不会出现。

本文档基于 dbx 桌面壳源码（`/Users/zhugeyue/Desktop/project/bigdate/github-source-code/dbx`）与 dbx-pro 插件源码的逐行对比，给出完整差异清单、根因分析和改进方案。

---

## 1. 完整参数对比

### 1.1 分页档位

| 参数 | dbx 桌面壳 | dbx-pro 插件 | 是否一致 | 当前状态 | 源码位置（桌面壳 → 插件） |
|------|-----------|-------------|---------|---------|------------------------|
| 预设档位 | `[50, 100, 500, 1000]` | `[50, 100, 500, 1000]` | ✅ 一致 | ✅ 已对齐 | `paginationPageSize.ts:1` → `workbench-settings.ts:45` |
| **默认每页行数** | **100** | **100** | ✅ 一致 | ✅ 已对齐 | `paginationPageSize.ts:2` → `workbench-settings.ts:89` |
| 最小每页行数 | 1 | 1 | ✅ 一致 | ✅ 已对齐 | `paginationPageSize.ts:3` → `workbench-settings.ts:56` |
| 最大每页行数 | 1,000,000 | 1,000,000 | ✅ 一致 | ✅ 已对齐 | `paginationPageSize.ts:4` → `workbench-settings.ts:55` |
| **表打开页大小** | **100** | **100** | ✅ 一致 | ✅ 已对齐 | `tableOpenPageLimit.ts:3` → `workbench-settings.ts:DEFAULT_TABLE_OPEN_PAGE_SIZE` |
| `tableOpenPageSize` 设置项 | 有（默认 100） | 有（默认 100） | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:1269` → `workbench-settings.ts:DEFAULT_TABLE_OPEN_PAGE_SIZE` |

### 1.2 导出参数

| 参数 | dbx 桌面壳 | dbx-pro 插件 | 是否一致 | 当前状态 | 源码位置 |
|------|-----------|-------------|---------|---------|---------|
| `exportRowLimitEnabled` 默认 | `false` | `false` | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:1395` → `workbench-settings.ts:94` |
| `exportRowLimit` 默认 | 100,000 | 100,000 | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:1396` → `workbench-settings.ts:64` |
| `exportRowLimit` 最大值 | 2,147,483,647 | 2,147,483,647 | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:2071` → `workbench-settings.ts:63` |
| **`exportBatchSize`** | **2,000**（范围 100–100,000） | **2,000**（范围 100–100,000） | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:1388` → `workbench-settings.ts:EXPORT_BATCH_SIZE_DEFAULT` |
| 导出全部硬上限 | 无硬上限（受 `exportRowLimit` 控制） | 无硬上限（受 `exportRowLimit` 控制） | ✅ 一致 | ✅ 已对齐 | 无硬编码 → `result-grid.tsx:exportAllAs()` |
| `TABLE_DATA_EXPORT_PAGE_SIZE` | 10,000 | 无对应 | ❌ 缺失 | ⚠️ 待评估 | `tableDataExport.ts:4` |
| `TABLE_DATA_EXPORT_MAX_ROWS` | 2,147,483,647 | 无对应 | ❌ 缺失 | ⚠️ 待评估 | `tableDataExport.ts:5` |

### 1.3 MCP 与桌面壳查询限制

| 参数 | dbx 桌面壳（Rust） | dbx-pro 插件（引擎桥接） | 是否一致 | 当前状态 | 源码位置 |
|------|-------------------|------------------------|---------|---------|---------|
| `MAX_EXECUTE_QUERY_ROWS` | 1,000 | 1,000（`DBX_MAX_ROWS`） | ✅ 一致 | ✅ 已对齐 | `agent_tools.rs:51` → `request-router.mjs:68` |
| `EXECUTE_QUERY_LIMIT`（MCP 默认） | **50** | **50** | ✅ 一致 | ✅ 已对齐 | `agent_tools.rs:23` → `protocol.mjs:22` |
| `MAX_ROW_LIMIT`（协议层上限） | N/A（Rust 直接 clamp 到 `MAX_EXECUTE_QUERY_ROWS`） | 5,000 | ❌ 不一致 | ⚠️ 待评估 | 无对应 → `protocol.mjs:23` |
| 驱动层 `MAX_ROWS` | 10,000 | N/A（经 MCP 二进制，不直接驱动） | — | — | `execution.rs:14` |
| `LIST_TABLES_LIMIT` | 200 | 无独立限制（受 `DBX_EFFECTIVE_ROW_CAP`=1000 约束） | — | — | `agent_tools.rs:20` |
| `SAMPLE_DATA_LIMIT` | 20 | 无对应工具 | — | — | `agent_tools.rs:26` |

### 1.4 查询结果总行数限制

| 参数 | dbx 桌面壳 | dbx-pro 插件 | 是否一致 | 当前状态 | 源码位置 |
|------|-----------|-------------|---------|---------|---------|
| `queryResultMaxRowsEnabled` 默认 | **true** | **true** | ✅ 一致 | ✅ 已对齐 | `settingsStore.ts:1273` → `workbench-settings.ts:DEFAULT_SETTINGS` |
| `DEFAULT_QUERY_RESULT_MAX_ROWS` | 100,000 | 100,000 | ✅ 一致 | ✅ 已对齐 | `queryResultRowLimit.ts:1` → `workbench-settings.ts:QUERY_RESULT_MAX_ROWS_DEFAULT` |
| `MAX_QUERY_RESULT_MAX_ROWS` | 2,147,483,647 | 2,147,483,647 | ✅ 一致 | ✅ 已对齐 | `queryResultRowLimit.ts:2` → `workbench-settings.ts:QUERY_RESULT_MAX_ROWS_MAX` |
| `infiniteScrollMaxRows` | 5,000（范围 1,000–50,000） | 无对应（非虚拟化 DOM） | — | ⚠️ 待评估 | `settingsStore.ts:1277` |

---

## 2. 「结果达到单次取回上限 1000 行」问题根因分析

### 2.1 现象

用户在 dbx-pro 插件中手动执行 SQL（编辑器 Cmd+Enter），若结果集 ≥ 1000 行，底部状态栏出现黄色提示：

> 结果达到单次取回上限 1000 行，仅展示前 1000 行；如需全部请在 SQL 中使用 LIMIT/OFFSET

而 dbx 桌面壳在相同操作下不会出现此提示。

### 2.2 根因链

```
根因 1：默认页大小不一致
  dbx 桌面壳：DEFAULT_RESULT_PAGE_SIZE = 100
  dbx-pro 插件：DEFAULT_SETTINGS.rowLimit = ENGINE_ROW_CAP = 1000
  
  → 插件默认页大小 = 引擎单次硬上限，首次执行就可能触发截断提示
  → dbx 默认页大小 = 100，远低于硬上限，几乎不会触发

根因 2：客户端模式不包分页 SQL
  手动执行 SQL（编辑器 Cmd+Enter）走客户端模式（无 mode 参数）
  → engineExecuteByName() 不传 page 参数
  → 引擎原样执行 SQL，结果在 MAX_EXECUTE_QUERY_ROWS (1000) 处截断
  → toQueryResult() 检测到 truncated=true && paged=undefined
  → 追加截断提示
  
  dbx 桌面壳：
  → 驱动层 MAX_ROWS = 10,000（可一次取回更多）
  → 加上 queryResultMaxRows 机制（默认 100,000）控制总量
  → 1000 行远未达到上限，不触发提示

根因 3：表预览 SQL 生成方式不同
  dbx 桌面壳：build_table_data_select_sql() 生成带 LIMIT 的 SQL
    → "SELECT * FROM table LIMIT 100;"（Rust 侧生成，LIMIT = tableOpenPageLimit）
    → 引擎尊重 LIMIT，返回 100 行，不截断
  
  dbx-pro 插件：openPreviewTab() 生成不带 LIMIT 的 SQL
    → "SELECT * FROM table;"
    → 走服务端分页模式，由 sql-pagination.mjs 包成派生表 + LIMIT/OFFSET
    → 表预览场景本身不会触发截断提示（paged=true 时不追加提示）
    → 但默认页大小 1000 意味着首页就取 1000 行，与 dbx 的 100 行体验差异大

根因 4：缺少 queryResultMaxRows 机制
  dbx 桌面壳有完整的查询结果总量控制：
  → queryResultMaxRowsEnabled = true（默认开启）
  → queryResultMaxRows = 100,000
  → limitQueryPagination() 在分页请求中夹逼总量
  → queryResultLimitReached() 检测是否达到上限
  → capQueryResultTotal() 夹逼总数显示
  
  dbx-pro 插件无此机制：
  → 没有「查询结果总量上限」概念
  → 只有「单次取回上限 1000 行」的引擎硬约束
  → 用户无法通过设置调整总量上限
```

### 2.3 代码路径对比

**dbx 桌面壳 — 手动执行 SQL：**
```
编辑器 Cmd+Enter
  → queryStore 执行查询
  → 驱动层 MAX_ROWS = 10,000（一次可取 10,000 行）
  → queryResultMaxRows = 100,000（默认开启）
  → 结果 < 100,000 行 → 不截断，无提示
  → 结果 ≥ 100,000 行 → 截断到 100,000，显示「达到上限」
```

**dbx-pro 插件 — 手动执行 SQL：**
```
编辑器 Cmd+Enter
  → runTabSql() 无 mode 参数 → 客户端模式
  → engineExecuteByName(rowLimit: ENGINE_ROW_CAP=1000)
  → 引擎执行 SQL，结果在 1000 行处截断
  → toQueryResult(): truncated=true, paged=undefined
  → 追加提示「结果达到单次取回上限 1000 行」
```

---

## 3. 改进方案

### 3.1 必须修改（高优先级）

#### 改动 1：默认页大小对齐

**文件：** `src/domain/workbench-settings.ts`

```
当前：rowLimit: ENGINE_ROW_CAP  (1000)
目标：rowLimit: 100              (对齐 dbx DEFAULT_RESULT_PAGE_SIZE)
```

**影响范围：**
- 所有新用户的默认页大小从 1000 变为 100
- 已有用户如果未自定义过页大小，也会回落到 100
- 需要迁移逻辑：已有用户的 `rowLimit` 如果是 1000（旧默认值），是否自动迁移到 100？

**对齐源码：**
- dbx: `paginationPageSize.ts:2` → `DEFAULT_RESULT_PAGE_SIZE = 100`
- dbx: `settingsStore.ts:1268` → `pageSize: 100`

#### 改动 2：新增 tableOpenPageSize 设置项

**文件：** `src/domain/workbench-settings.ts`

```
新增字段：tableOpenPageSize: number
默认值：100（对齐 dbx DEFAULT_TABLE_OPEN_PAGE_LIMIT）
夹逼范围：[1, MAX_RESULT_PAGE_SIZE]
```

**文件：** `src/features/database-workspace/hooks/use-workbench.tsx`

```
openPreviewTab() 的页大小应使用 tableOpenPageSize 而非 rowLimit
```

**对齐源码：**
- dbx: `tableOpenPageLimit.ts:3` → `DEFAULT_TABLE_OPEN_PAGE_LIMIT = DEFAULT_RESULT_PAGE_SIZE`
- dbx: `settingsStore.ts:1269` → `tableOpenPageSize: 100`

#### 改动 3：消除客户端模式的截断提示

**方案 A（推荐）：手动执行 SQL 也走服务端分页**

**文件：** `src/features/database-workspace/components/sql-editor.tsx`

```
当前：runTabSql(tabId) — 无 mode
目标：runTabSql(tabId, undefined, undefined, { mode: "server" })
```

**风险：** 不可分页的 SQL（SHOW / EXPLAIN / DDL / 多语句）需要回退客户端模式。需要在 `runTabSql` 内部或 `sql-editor.tsx` 中判断 `canPaginate(sql)`。

**方案 B：提高客户端模式的行上限**

在客户端模式下，使用 `queryResultMaxRows`（默认 100,000）而非 `ENGINE_ROW_CAP`（1000）作为行上限。需要循环分页取数直到达到上限。

**方案 C：修改提示文案**

如果暂不改执行逻辑，至少将提示改为更友好的表述，并引导用户调整页大小或使用导出功能。

**对齐源码：**
- dbx 桌面壳不区分 server/client 模式，统一走驱动层分页

#### 改动 4：新增 exportBatchSize 设置项

**文件：** `src/domain/workbench-settings.ts`

```
新增字段：exportBatchSize: number
默认值：2000（对齐 dbx）
夹逼范围：[100, 100000]
```

**文件：** `src/features/database-workspace/components/result-grid.tsx`

```
fetchAllData() 的循环步长从 ENGINE_ROW_CAP (1000) 改为 exportBatchSize
```

**对齐源码：**
- dbx: `settingsStore.ts:1388` → `exportBatchSize: 2000`
- dbx: `settingsStore.ts:2060` → 范围 `[100, 100000]`

### 3.2 建议修改（中优先级）

#### 改动 5：新增 queryResultMaxRows 机制

**文件：** `src/domain/workbench-settings.ts`

```
新增字段：
  queryResultMaxRowsEnabled: boolean  (默认 true)
  queryResultMaxRows: number          (默认 100,000)
```

**文件：** `src/features/database-workspace/hooks/use-workbench-execution.ts`

```
客户端模式执行时，使用 queryResultMaxRows 作为总量上限
而非 ENGINE_ROW_CAP 作为单次上限
```

**对齐源码：**
- dbx: `queryResultRowLimit.ts:1-2` → `DEFAULT_QUERY_RESULT_MAX_ROWS = 100_000`, `MAX_QUERY_RESULT_MAX_ROWS = 2_147_483_647`
- dbx: `settingsStore.ts:1273-1274` → `queryResultMaxRowsEnabled: true`, `queryResultMaxRows: DEFAULT_QUERY_RESULT_MAX_ROWS`

#### 改动 6：导出全部不再硬编码 100,000 上限

**文件：** `src/features/database-workspace/components/result-grid.tsx`

```
当前：EXPORT_ALL_ROW_CAP = 100_000（硬编码）
目标：使用 queryResultMaxRows（默认 100,000，用户可调）
      或 exportRowLimit（当 exportLimitEnabled 开启时）
```

**对齐源码：**
- dbx: 无硬编码上限，由 `exportRowLimit` 和 `queryResultMaxRows` 共同控制

#### 改动 7：引擎协议层 DEFAULT_ROW_LIMIT 对齐

**文件：** `server/src/engine/protocol.mjs`

```
当前：DEFAULT_ROW_LIMIT = 500
目标：DEFAULT_ROW_LIMIT = 50（对齐 dbx EXECUTE_QUERY_LIMIT）
```

**注意：** 这个改动影响 MCP 工具调用的默认行数。dbx 的 `EXECUTE_QUERY_LIMIT = 50` 是 MCP 工具的默认值，不是 UI 侧的默认值。插件 UI 侧的默认值应由前端 `rowLimit` 控制，不应由引擎协议层决定。

**对齐源码：**
- dbx: `agent_tools.rs:23` → `EXECUTE_QUERY_LIMIT = 50`

### 3.3 可选修改（低优先级）

#### 改动 8：tableSingleClickAction / tableDoubleClickAction 生效

当前 `connection-node.tsx` 中单击和双击表节点都无条件调用 `openPreviewTab()`，忽略了 `tableSingleClickAction` 和 `tableDoubleClickAction` 设置。需要读取设置并按配置执行。

#### 改动 9：新增 TABLE_DATA_EXPORT_PAGE_SIZE 概念

dbx 桌面壳的表数据导出使用独立的 `TABLE_DATA_EXPORT_PAGE_SIZE = 10_000`，与查询分页的 `DEFAULT_RESULT_PAGE_SIZE = 100` 解耦。插件目前混用 `ENGINE_ROW_CAP = 1000` 作为导出步长，应独立配置。

---

## 4. 改动优先级与实施顺序

| 优先级 | 改动 | 影响面 | 风险 | 状态 | 备注 |
|--------|------|--------|------|------|------|
| P0 | 改动 1：默认页大小 1000→100 | 所有用户 | 低 | ✅ 已完成 | 对齐 dbx DEFAULT_RESULT_PAGE_SIZE |
| P0 | 改动 3：消除客户端模式截断提示 | 手动执行 SQL 的用户 | 中 | ✅ 已完成 | 改为服务端分页模式 |
| P1 | 改动 2：新增 tableOpenPageSize | 表预览用户 | 低 | ✅ 已完成 | 默认 100，对齐 dbx |
| P1 | 改动 4：新增 exportBatchSize | 导出大量数据的用户 | 低 | ✅ 已完成 | 默认 2000，范围 100-100000 |
| P2 | 改动 5：新增 queryResultMaxRows 机制 | 所有查询用户 | 中 | ✅ 已完成 | 默认 100,000，可配置 |
| P2 | 改动 6：导出全部去掉硬编码上限 | 导出超大数据集的用户 | 低 | ✅ 已完成 | 仅受 exportRowLimit 控制 |
| P3 | 改动 7：DEFAULT_ROW_LIMIT 对齐 | MCP 工具调用 | 中 | ✅ 已完成 | 500→50，对齐 dbx EXECUTE_QUERY_LIMIT |
| P3 | 改动 8：表点击行为设置生效 | 树交互偏好用户 | 低 | ✅ 已完成 | 支持 preview/structure 切换 |
| P4 | 改动 9：TABLE_DATA_EXPORT_PAGE_SIZE | 表数据导出性能 | 低 | ⚠️ 待评估 | dbx 用 10,000，当前用 exportBatchSize |
| P4 | 改动 10：infiniteScrollMaxRows | 大结果集渲染性能 | 高 | ⚠️ 待评估 | 需要虚拟化 DOM 支持 |

---

## 4.1 导出全部硬上限修复说明

**问题**：原实现中导出全部数据有 100,000 行的硬编码上限（`EXPORT_ALL_ROW_CAP`），导致用户无法导出完整数据。

**修复方案**：
- 移除 `EXPORT_ALL_ROW_CAP` 硬编码限制
- 导出上限仅由 `exportRowLimit` 控制（当 `exportLimitEnabled` 开启时）
- 当 `exportLimitEnabled` 关闭时，导出无上限（循环取数直到末页）
- `queryResultMaxRows` 仅用于查询结果展示，不影响导出

**对齐状态**：✅ 已对齐 dbx 桌面壳行为

**实现细节**：
- `result-grid.tsx:exportAllAs()` 中 `rowLimit` 仅取 `settings.exportRowLimit` 或 `Infinity`
- 循环取数按 `exportBatchSize` 分批，每批内部按 `ENGINE_ROW_CAP` 分块请求引擎
- 支持取消、进度显示、分块序列化（避免内存溢出）

---

## 5. 对齐后的参数总览（目标状态）

| 参数 | 目标值 | 对齐来源 |
|------|--------|---------|
| `RESULT_PAGE_SIZE_OPTIONS` | `[50, 100, 500, 1000]` | 已对齐 |
| `DEFAULT_RESULT_PAGE_SIZE` | `100` | `paginationPageSize.ts:2` |
| `MIN_RESULT_PAGE_SIZE` | `1` | 已对齐 |
| `MAX_RESULT_PAGE_SIZE` | `1,000,000` | 已对齐 |
| `DEFAULT_TABLE_OPEN_PAGE_LIMIT` | `100` | `tableOpenPageLimit.ts:3` |
| `exportBatchSize` | `2,000`（范围 100–100,000） | `settingsStore.ts:1388` |
| `exportRowLimitEnabled` | `false` | 已对齐 |
| `exportRowLimit` | `100,000`（范围 100–2,147,483,647） | 已对齐 |
| `queryResultMaxRowsEnabled` | `true` | `settingsStore.ts:1273` |
| `queryResultMaxRows` | `100,000` | `queryResultRowLimit.ts:1` |
| `TABLE_DATA_EXPORT_PAGE_SIZE` | `10,000` | `tableDataExport.ts:4` |
| `TABLE_DATA_EXPORT_MAX_ROWS` | `2,147,483,647` | `tableDataExport.ts:5` |
| `MAX_EXECUTE_QUERY_ROWS`（引擎硬上限） | `1,000` | 已对齐（`agent_tools.rs:51`） |
| `EXECUTE_QUERY_LIMIT`（MCP 默认） | `50` | `agent_tools.rs:23` |
| 驱动层 `MAX_ROWS` | `10,000` | `execution.rs:14`（插件不直接驱动，仅供参考） |

---

## 6. 约束与风险

1. **向后兼容**：默认页大小从 1000 改为 100 会影响已有用户。需要迁移策略：
   - 方案 A：检测 `rowLimit === 1000` 且未手动修改过的用户，自动迁移到 100
   - 方案 B：保留 1000 作为已有用户的默认值，仅新用户用 100
   - 方案 C：不改默认值，仅新增 `tableOpenPageSize` 和 `queryResultMaxRows` 设置项

2. **引擎硬上限不可突破**：`MAX_EXECUTE_QUERY_ROWS = 1000` 是 dbx-mcp 二进制的硬限制（Rust 编译时断言），插件无法通过配置修改。所有「取更多数据」的需求必须通过分页循环实现。

3. **非虚拟化 DOM 限制**：插件结果网格使用原生 `<table>` 渲染，超大页大小（如 10,000+）会导致渲染卡顿。dbx 桌面壳使用虚拟化渲染（`infiniteScrollMaxRows = 5000`），插件短期内无法对齐此能力。应在 UI 中对超大页大小给出性能警告。

4. **MCP 工具默认值**：`EXECUTE_QUERY_LIMIT = 50` 是 AI Agent 调用 `dbx_execute_query` 时的默认行数。插件 UI 侧不应受此限制，但引擎协议层的 `DEFAULT_ROW_LIMIT = 500` 需要明确其定位——是给 MCP 工具用的还是给 UI 用的。

---

## 7. 验证方法

实施改动后，按以下步骤验证：

1. **默认页大小**：新建连接，执行 `SELECT * FROM large_table`，确认首页显示 100 行
2. **表预览**：点击树中表节点，确认首页显示 100 行（而非 1000 行）
3. **手动执行无截断提示**：执行 `SELECT * FROM large_table`（结果 > 1000 行），确认不出现截断提示
4. **导出全部**：导出 > 1000 行的结果，确认按 `exportBatchSize` 分块取数，无 100,000 硬上限
5. **设置页**：确认新增的 `tableOpenPageSize`、`exportBatchSize`、`queryResultMaxRows` 设置项可正常修改和持久化
6. **运行测试**：`node --test abilities/plugins/dbx-pro/src/test/workbench-settings.test.js`

---

## 8. 按钮功能验证

### 8.1 导出按钮

**位置**：结果网格底栏右侧，下载图标按钮

**功能验证**：
- ✅ 左键点击：弹出导出格式菜单（当前页 / 全部数据 × 8 种格式）
- ✅ 右键点击：同样弹出导出格式菜单
- ✅ 菜单项可点击：每个格式项绑定 `downloadAs()` 或 `exportAllAs()` 回调
- ✅ 导出进度弹窗：大文件导出显示进度、支持取消、完成后可重新下载
- ✅ 后台任务管理：多个导出可并行，各自独立进度与取消

**实现文件**：`result-grid.tsx:openExportMenu()`, `downloadAs()`, `exportAllAs()`

### 8.2 分页按钮

**位置**：结果网格底栏，页码输入框两侧

**功能验证**：
- ✅ 第一页按钮：`onClick={() => goToPage(0)}`，首页时禁用
- ✅ 上一页按钮：`onClick={() => goToPage(safePage - 1)}`，首页时禁用
- ✅ 下一页按钮：`onClick={() => goToPage(safePage + 1)}`，末页时禁用
- ✅ 最后一页按钮：`onClick={() => goToPage(totalPages - 1)}`，末页时禁用
- ✅ 页码输入框：支持输入正整数，Enter 或失焦跳转到该页
- ✅ 加载中禁用：`pageLoading === true` 时所有分页按钮禁用

**实现文件**：`result-grid.tsx:goToPage()`, `commitPageInput()`

### 8.3 每页行数选择器

**位置**：结果网格底栏，分页按钮左侧

**功能验证**：
- ✅ 点击按钮：弹出下拉菜单，显示预设档位 `[50, 100, 500, 1000]` + 当前自定义值
- ✅ 选择预设：点击后应用到本次查询
- ✅ 自定义输入：输入框支持 1-1,000,000 范围
- ✅ 本次查询按钮：应用自定义值到当前查询
- ✅ 设为默认按钮：写入工作台设置，后续查询默认使用
- ✅ Portal 渲染：菜单通过 `createPortal` 渲染到 `.dbx-root`，避免被底栏 `overflow:hidden` 裁剪
- ✅ 点击外部/Esc 关闭：正确清理事件监听

**实现文件**：`page-size-menu.tsx`

---

## 9. 性能优化建议

### 9.1 当前性能瓶颈

1. **非虚拟化 DOM**：结果网格使用原生 `<table>` 渲染，超大页大小（如 10,000+）会导致渲染卡顿
2. **导出内存占用**：XLSX 导出需要收集全部行到内存，超大结果集有内存风险
3. **引擎调用次数**：导出时按 `exportBatchSize` 分批，每批可能多次引擎调用（受 `ENGINE_ROW_CAP=1000` 限制）

### 9.2 已实施优化

1. **分块序列化**：文本格式导出使用 `createChunkedTextExport()`，边拉边拼，避免内存溢出
2. **后台任务管理**：导出任务登记到后台任务 store，可最小化、可取消
3. **服务端分页**：表预览和手动执行都走服务端分页，避免客户端加载全部数据

### 9.3 待实施优化（优先级 P4）

1. **虚拟化渲染**：引入 `react-window` 或 `@tanstack/virtual`，仅渲染可见行
   - 预期收益：支持 10,000+ 行流畅滚动
   - 风险：需要重构 `ResultGrid` 组件，工作量较大

2. **导出流式写入**：XLSX 导出使用流式 API（如 `exceljs` 的 streaming writer）
   - 预期收益：降低内存占用，支持百万行导出
   - 风险：需要引入新依赖，当前零依赖 XLSX 生成器不支持流式

3. **Web Worker 序列化**：将 CSV/JSON 等文本序列化移到 Web Worker
   - 预期收益：主线程不阻塞，UI 保持响应
   - 风险：需要处理 Worker 通信开销

4. **查询结果缓存**：相同 SQL + 相同参数的结果缓存
   - 预期收益：重复查询秒级响应
   - 风险：需要缓存失效策略，内存管理

### 9.4 性能监控建议

在后续版本中添加性能指标采集：
- 查询执行时间（已有 `elapsedMs`）
- 导出耗时与内存占用
- 网格渲染帧率（FPS）
- 引擎调用次数与延迟

---

## 10. 总结

### 10.1 对齐状态

| 类别 | 已对齐 | 待评估 | 未对齐 |
|------|--------|--------|--------|
| 分页档位 | 6/6 | 0 | 0 |
| 导出参数 | 5/7 | 2 | 0 |
| MCP 查询限制 | 2/4 | 2 | 0 |
| 查询结果限制 | 3/4 | 1 | 0 |
| **总计** | **16/21** | **5** | **0** |

### 10.2 关键改进

1. ✅ **默认页大小 1000→100**：消除首次执行就触发截断提示的问题
2. ✅ **手动执行走服务端分页**：消除「结果达到单次取回上限 1000 行」的截断提示
3. ✅ **导出全部无硬上限**：仅受 `exportRowLimit` 控制，可导出完整数据
4. ✅ **exportBatchSize 实际生效**：按 2000 分批取数，每批内部按 1000 分块请求引擎
5. ✅ **queryResultMaxRows 机制**：查询结果展示上限 100,000（可配置），不影响导出
6. ✅ **表点击行为设置生效**：支持 preview/structure 切换

### 10.3 待评估项

1. ⚠️ `TABLE_DATA_EXPORT_PAGE_SIZE`：dbx 用 10,000，当前用 `exportBatchSize`（2000），是否需要独立配置
2. ⚠️ `infiniteScrollMaxRows`：需要虚拟化 DOM 支持，当前非虚拟化渲染
3. ⚠️ `MAX_ROW_LIMIT`：协议层上限 5,000，是否需要调整
4. ⚠️ `LIST_TABLES_LIMIT`：是否需要独立限制
5. ⚠️ `SAMPLE_DATA_LIMIT`：是否需要实现对应的 MCP 工具
