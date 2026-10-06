# ADR-0003: 5 项待评估决策实施 + 设置面板对齐 dbx 桌面壳

## 状态
已实施

## 背景
ADR-0002 完成 8 项参数对齐后，剩余 5 项标记为「待评估」。同时 dbx 桌面壳的设置面板有完整的数据（Data）分类体系，插件设置面板需要对齐其分类结构和命名。

---

## 1. 5 项待评估决策

### 1.1 TABLE_DATA_EXPORT_PAGE_SIZE = 10,000

**决策**：不新增独立常量，由 `exportBatchSize`（默认 2000）控制。

**理由**：
- dbx 桌面壳的 `TABLE_DATA_EXPORT_PAGE_SIZE = 10_000` 是表数据导出的分页步长
- 插件的 `exportBatchSize` 已承担此职责，默认 2000 更保守（避免内存压力）
- 插件引擎硬上限 `ENGINE_ROW_CAP = 1000`，实际每批取数不超过 1000
- 用户可在设置中调整 `exportBatchSize` 到 10000，效果等同

**状态**：✅ 已由 `exportBatchSize` 覆盖

### 1.2 TABLE_DATA_EXPORT_MAX_ROWS = 2,147,483,647

**决策**：不新增独立常量，由 `exportRowLimit`（最大值 2,147,483,647）控制。

**理由**：
- dbx 桌面壳的 `TABLE_DATA_EXPORT_MAX_ROWS` 是导出行数的理论上限
- 插件的 `EXPORT_ROW_LIMIT_MAX = 2_147_483_647` 与之完全一致
- 当 `exportLimitEnabled` 关闭时，导出无上限（循环到末页）

**状态**：✅ 已由 `EXPORT_ROW_LIMIT_MAX` 覆盖

### 1.3 infiniteScrollMaxRows = 5,000

**决策**：新增 `infiniteScroll: boolean`（默认 false）设置项，对齐 dbx 桌面壳。

**理由**：
- dbx 桌面壳有 `infiniteScroll`（默认 false）和 `infiniteScrollMaxRows`（默认 5000，Legacy）
- 插件使用非虚拟化 DOM，无法实现真正的无限滚动
- 但可以提供「自动加载下一页」功能：滚到底部时自动拉取下一页数据
- `infiniteScrollMaxRows` 在 dbx 中已标记为 Legacy，当前使用 `queryResultMaxRows` 控制总量

**实现**：
- 新增 `infiniteScroll` 布尔设置
- 开启后，结果网格滚到底部时自动触发加载下一页
- 总量仍受 `queryResultMaxRows` 控制

**状态**：✅ 已实施

### 1.4 MAX_ROW_LIMIT = 5,000（协议层）

**决策**：保持 5,000 不变，不修改。

**理由**：
- dbx 桌面壳在 Rust 侧直接 clamp 到 `MAX_EXECUTE_QUERY_ROWS = 1000`，没有独立的协议层上限
- 插件的 `MAX_ROW_LIMIT = 5000` 是引擎协议层的防御性上限，用于 `clampRowLimit()`
- 实际效果：用户设置页大小最大 1,000（`MAX_RESULT_PAGE_SIZE` 已夹到 `ENGINE_ROW_CAP`），引擎调用时 `dbxMaxRows()` 再次 clamp 到 1000
- `MAX_ROW_LIMIT = 5000` 仅影响 `rowLimit` 参数传入引擎前的夹逼，不影响最终取数

**状态**：✅ 保持不变（防御性上限，不影响用户体验）

### 1.5 LIST_TABLES_LIMIT = 200

**决策**：不新增独立限制，由 `ENGINE_ROW_CAP = 1000` 统一约束。

**理由**：
- dbx 桌面壳的 `LIST_TABLES_LIMIT = 200` 限制 `dbx_list_tables` 工具返回的表数量
- 插件通过 `engineListTables()` 调用引擎，引擎侧受 `DBX_EFFECTIVE_ROW_CAP = 1000` 约束
- 200 vs 1000 的差异不影响用户体验（绝大多数连接的表数 < 200）
- 新增独立限制会增加代码复杂度，收益不大

**状态**：✅ 由引擎硬上限统一约束

---

## 2. 设置面板对齐 dbx 桌面壳

### 2.1 dbx 桌面壳 Data 分类结构

dbx 桌面壳的「数据」（Data）设置标签包含以下子分类：

| 子分类 | 包含设置 |
|--------|---------|
| **查询结果** | 默认每页行数、表打开页大小、查询结果总量限制、无限滚动、多语句默认视图、执行计划默认视图（自动计算总行数已移除，见 §4） |
| **数据网格显示** | 列注释、列类型、索引指示器、单元格类型着色、斑马纹、十字准线、数字右对齐、单元格详情按钮、行号 |
| **结果标签** | 命名方式、显示来源数据库 |
| **导出** | 每批取行数、限制导出行数、最大导出行数 |
| **历史保留** | 查询历史开关、历史条数上限 |

### 2.2 插件设置面板重构

**当前插件分类**：编辑器 / SQL 执行 / 数据网格 / 结果集 / 侧边栏 / 导出 / 关于

**目标分类**（对齐 dbx 桌面壳 Data 标签）：

| 分类 | 对齐来源 | 包含设置 |
|------|---------|---------|
| **查询结果** | dbx Data > Query Results | 默认每页行数、表打开页大小、查询超时、查询结果总量限制、无限滚动、多语句默认视图、执行计划默认视图（自动计算总行数已移除，见 §4） |
| **数据网格** | dbx Data > Data Grid Display | 显示行号、斑马纹、十字准线、单元格类型着色、数字列右对齐、列注释、列类型、单元格详情按钮 |
| **结果标签** | dbx Data > (Result tab settings) | 命名方式、显示来源数据库 |
| **导出** | dbx Data > Export | 每批取行数、限制导出行数、最大导出行数 |
| **侧边栏** | dbx Navigation | 单击表节点行为、双击表节点行为 |
| **历史** | dbx Data > History Retention | 记录查询历史、历史条数上限 |
| **关于** | dbx About | 版本信息、数据管理 |

### 2.3 新增设置项

| 设置键 | 类型 | 默认值 | 对齐 dbx | 说明 |
|--------|------|--------|---------|------|
| ~~`autoCalculateTotalRows`~~ | — | — | — | **已移除**（v0.0.83）：总数决定总页数与「共 N 行」，不能是可选功能，改为必定自动统计，见 §4 |
| `infiniteScroll` | boolean | false | `infiniteScroll` | 滚到底部自动加载下一页 |
| `dataGridStripedRows` | boolean | true | `dataGridStripedRows` | 斑马纹行 |
| `dataGridCrosshairHighlight` | boolean | false | `dataGridCrosshairHighlight` | 十字准线高亮 |
| `dataGridCellDetailButtonVisible` | boolean | true | `dataGridCellDetailButtonVisible` | 双击单元格查看详情 |
| `multiStatementDefaultView` | "result" \| "messages" | "result" | `multiStatementDefaultView` | 多语句默认视图 |
| `defaultExplainView` | "table" \| "canvas" | "table" | `defaultExplainView` | 执行计划默认视图 |
| `resultTabNamingMode` | "source" \| "table" \| "sequential" | "source" | `resultTabNamingMode` | 结果标签命名方式 |
| `showResultSourceDatabase` | boolean | true | `showResultSourceDatabase` | 结果标签显示来源数据库 |

---

## 3. 实施清单

| # | 改动 | 文件 | 状态 |
|---|------|------|------|
| 1 | 新增设置字段到 WorkbenchSettings | `workbench-settings.ts` | ✅ |
| 2 | 设置面板分类重构为 7 类 | `settings-panel.tsx` | ✅ |
| 3 | ~~autoCalculateTotalRows 接入执行逻辑~~ 改为总数统计状态机（必定统计 + pending/failed） | `use-workbench-execution.ts`、`workbench-reducer.ts`、`workbench-types.ts` | ✅ v0.0.83 |
| 4 | infiniteScroll 接入结果网格 | `result-grid.tsx` | ✅ |
| 5 | 数据网格视觉设置接入 | `result-grid.tsx` | ✅ |
| 6 | 更新测试 | `workbench-settings.test.js` | ✅ |

---

## 4. 后续修订（v0.0.83）：移除 `autoCalculateTotalRows`

**背景**：`autoCalculateTotalRows` 默认 `false`，而分页栏的「共 N 行」「总页数」「尾页」全部依赖总数。默认配置下总数永不统计，分页栏卡在「总数统计中」；又因为失败路径写了 `-1` 哨兵值，`totalPages = max(1, ceil(-1 / pageSize)) = 1`，`hasNextPage` 恒为 `false`，翻页按钮全变灰。

**决策**：删除该设置项（字段、默认值、范围校验、设置面板入口、测试断言一并删除），服务端分页结果**必定**自动统计总数。设置面板不再提供开关，只保留一行说明。

**备选方案**：把开关接到执行逻辑上（保留用户选择）。否决原因：用户已持久化的值就是默认的 `false`，接线之后现有用户仍然看到「总数统计中」+ 灰色翻页按钮，等于没修。

**后果**：

- 用户失去「跳过 COUNT」的能力（大表首次查询会多一次 COUNT 往返）。
- 换来的是分页栏可预测：总数决定总页数，失败时降级为「总数未知」而不是错误的「只有一页」。
- 统计为渲染后的 fire-and-forget，不阻塞结果展示；失败只标状态（`totalCountStatus: "failed"`），**不写 0 / -1**，`totalPages` 保持 `null`，`下一页` 退化为 `rows.length >= pageSize` 判断，用户可用分页栏刷新按钮显式重试。

**验证**：`src/test/workbench-total-count.test.js`（总数状态机：pending / 成功 / 失败不写哨兵 / 旧 `ranSql` 竞态）与 `src/test/workbench-settings.test.js`（页大小上限夹到 `ENGINE_ROW_CAP`）。

