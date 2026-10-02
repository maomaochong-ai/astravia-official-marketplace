# Q1 — 旧数据库工作台设计还原规格

来源项目：`/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia`（只读）
目标插件：`astravia-official-marketplace/abilities/plugins/dbx-pro`
所有 `路径:行` 均指向**旧项目**的 `packages/desktop-app/src/renderer/domains/database/`，除非另注。

---

## 0. 还原度判定口径

「还原度达标」拆成四层，逐层可独立验收，避免用「看起来像」做主观判断：

| 层 | 判定物 | 达标标准 |
| --- | --- | --- |
| L1 结构 | 三栏分区、页头、标签栏、结果面板的存在与顺序 | 与本文 §1 一致 |
| L2 视觉 | 尺寸常量、圆角/边框/底色、字号、语义色（`bg-muted/40` 这类宿主 token，不是硬编码 hex） | 与本文 §1/§9 一致 |
| L3 交互 | §4 的逐条清单全部可用（含快捷键、右键、拖拽、分页、编辑） | 每条都能在真机点出来 |
| L4 状态 | 空态/加载/错误/截断/危险确认，以及 §5 的持久化语义 | 与旧实现语义一致（键名可变，语义不可丢） |

**明确不在还原范围**：数据引擎的行为细节（涉及 `dbx-mcp`，见 `plugin-constraints.md` §4/§7）。

---

## 1. 布局规格（L1 + L2）

### 1.1 自适应分档【实证】

`lib/database-layout.ts`（全文 37 行）定义两个断点与三档模式：

| 断点 | 值 | 含义 |
| --- | --- | --- |
| `DATABASE_LAYOUT_TREE_BREAKPOINT` | 560 | ≥560 连接树 inline（`autoTree`） |
| `DATABASE_LAYOUT_DETAILS_BREAKPOINT` | 880 | ≥880 连接详情 inline（`autoDetails`） |

| mode | 宽度 | 三栏呈现 |
| --- | --- | --- |
| wide | ≥880 | 树 inline + 主栏 inline + 详情 inline |
| medium | ≥560 | 树 inline + 主栏 inline，详情变右侧浮层 |
| narrow | <560 | 仅主栏，树变左侧浮层、详情变右侧浮层 |

容器内边距/间距随档位变化（`components/DatabaseWorkspace.tsx:992-994`）：

| 变量 | narrow | medium | wide |
| --- | --- | --- | --- |
| `contentPadding` | `px-4 pb-4 pt-3` | `px-6 pb-5 pt-4` | `px-8 pb-6 pt-5` |
| `contentGap` | `gap-3` | `gap-4` | `gap-5` |
| `mainGap` | `gap-3` | `gap-4` | `gap-4` |

### 1.2 列宽【实证】

| 区域 | 规格 | 证据 |
| --- | --- | --- |
| 连接树 | 默认 280px，可拖拽 200–380px | `DatabaseWorkspace.tsx:86-88,709,740` |
| 连接树容器 | `style={{width: treeWidth}}` + `relative flex shrink-0 flex-col overflow-hidden rounded-xl bg-muted/40` | `:1095-1098` |
| 连接详情 | 固定 `w-[320px] shrink-0 overflow-y-auto rounded-xl bg-muted/40 px-4 py-4` | `:1433` |
| 树浮层 | 左贴边 `w-[min(300px,calc(100%-40px))]` + `rounded-r-xl bg-muted/95 shadow-2xl` | `:1441` |
| 详情浮层 | 右贴边 `w-[min(340px,calc(100%-40px))]` + `rounded-l-xl bg-muted/95 shadow-2xl` | `:1490` |
| 浮层遮罩 | `absolute inset-0 z-30` + `bg-black/25`（点击关闭） | `:1437-1439` |

> 插件落点：面板槽内**不要**用 `fixed`；浮层一律用容器 `relative` + 子元素 `absolute`（SDK 硬规则）。

### 1.3 页头【实证】

两种变体，同一个组件（`DatabaseWorkspaceHeader.tsx`）：

- `toolbar`（活动面板用，插件应采用）：`flex h-10 shrink-0 items-center gap-2 border-b border-border/40 px-3`；
  左 `context`（`min-w-0 flex-1`），右 `actions`（`shrink-0 gap-1`）。
- `page`（路由/设置页用，插件不需要）：`px-8 pb-4 pt-7`，标题 `text-[24px] font-bold leading-tight tracking-tight`，
  副标题 `mt-1 text-[12px] text-muted-foreground/60`，带 `motion` 入场（`y:-8 → 0`, 0.45s, ease `[0.22,1,0.36,1]`）。

### 1.4 列表/树头部【实证】

`DatabaseListHeader.tsx` 两变体：

- `toolbar`（树用）：`flex h-9 shrink-0 items-center gap-px border-b bg-muted/20 px-3 text-xs font-medium text-muted-foreground`；
  左纯文字标题 + `flex-1` 弹性空隙 + 右按钮组；**常态不显示计数徽章**。
- `default`：`justify-between px-4 pt-3.5 pb-2`，左 `DatabaseSectionLabel`，右计数徽章 + 动作。

### 1.5 基础视觉件【实证】

| 件 | 类名 |
| --- | --- |
| `DatabaseSurface` | `rounded-xl border border-border bg-card` |
| `DatabaseSectionLabel` | `flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase`，图标 `h-3.5 w-3.5` |
| 结果面板底 | `rounded-xl bg-muted/35`（`DatabaseResultGrid.tsx:274`） |
| 编辑区底 | `rounded-lg bg-background/70 ring-1 ring-inset ring-border/50 focus-within:ring-primary/40`（`DatabaseQueryPanel.tsx`） |

### 1.6 状态色板【实证】

`DatabaseStatus.tsx` `DATABASE_STATUS_STYLES`：

| 状态 | 圆点 | 胶囊 |
| --- | --- | --- |
| `ok` | `bg-emerald-500` | `bg-emerald-500/12 text-emerald-600 dark:text-emerald-400` |
| `failed` | `bg-destructive` | `bg-destructive/12 text-destructive` |
| `testing` | `animate-pulse bg-amber-400` | `bg-amber-500/12 text-amber-600 dark:text-amber-400` |
| `untested` | `bg-muted-foreground/40` | `bg-muted text-muted-foreground` |

圆点 `h-1.5 w-1.5 rounded-full`；胶囊 `rounded-full px-2 py-0.5 text-[11px] font-medium`（无边框软填充）。

> 插件落点：这些是宿主语义 token（`bg-muted`/`border-border`/`text-muted-foreground`），Tailwind v4 +
> SDK 的 `@theme inline` 别名可直接用；**禁止**再写 `.dark .dbx-*` 硬编码 hex（现状违规，见 `plugin-constraints.md` §5）。

---

## 2. 组件清单映射表

行数=该文件实际行数；「插件落点」列为建议的插件内文件路径（`src/` 下）。

| 旧文件 | 行数 | 职责 | 插件落点 | 备注 |
| --- | --- | --- | --- | --- |
| `DatabaseWorkspace.tsx` | 1527 | 三栏编排、分档、浮层、标签栏宿主、危险确认 Dialog | `features/workbench/components/db-workbench.tsx` | 拆薄；编排/树/详情/标签栏分文件 |
| `DatabaseExplorerTree.tsx` | 1741 | 连接→[schema\|database]→表→列→子对象 懒加载树、分组、右键、行工具 | `features/explorer/components/*` | 最大的还原目标，按 `explorer-row-tools` 拆 |
| `DatabaseResultGrid.tsx` | 798 | 结果表、工具条、分页、行内编辑、导出、自动刷新 | `features/sql-workbench/components/result-grid.tsx`（重写） | 现有实现仅 168 行，差距最大 |
| `database-details-shared.tsx` | 402 | 连接详情/表详情的共享分区、字段行、动作 | `features/details/components/*` | |
| `SchemaInjectionScopePanel.tsx` | 330 | AI 注入范围：all / connection / table 三选 + 搜索 + 树勾选 | `features/ai-scope/components/schema-injection-scope-panel.tsx` | 含硬编码中文，插件必须 i18n |
| `DatabaseConnectionForm.tsx` | 227 | 连接表单（类型/主机/端口/库/账号/密码/SSL/env） | `features/connection-management/components/connection-form.tsx` | 现有 383 行，字段基本齐，需接新数据层 |
| `explorer-row-tools.tsx` | 223 | 行内悬浮工具（展开/刷新/打开表/复制名/危险操作） | `features/explorer/components/explorer-row-tools.tsx` | |
| `DatabaseSettingsPanel.tsx` | 211 | 行为偏好：安全模式/行数上限/超时/AI 白名单/dbx 工具开关 | `features/settings/components/*` | 部分宿主级设置插件无法写，需自持（见 §5.3） |
| `DatabaseQueryHistoryPopover.tsx` | 179 | 查询历史浮层（逐条删除/清空/重放） | `features/sql-workbench/components/query-history-popover.tsx` | 现插件缺此件 |
| `DatabaseQueryPanel.tsx` | 134 | SQL 面板：连接下拉、问 AI、编辑器、Ctrl+Enter、运行 | `features/sql-workbench/components/query-panel.tsx` | |
| `DatabaseExplorerContextMenu.tsx` | 112 | 树右键菜单 | 同上（explorer） | |
| `DatabaseConnectionDetailsWorkbench.tsx` | 92 | 详情右栏装配 | `features/details/components/*` | |
| `DatabaseTypePicker.tsx` | 83 | 数据库类型选择（分组 + 搜索） | `features/connection-management/components/db-type-picker.tsx` | |
| `DatabaseStatus.tsx` | 67 | 状态点/胶囊色板 | `shared/components/db-status.tsx` | |
| `DatabaseWorkspaceHeader.tsx` | 61 | 页头两变体 | `shared/components/workbench-header.tsx` | 只需 toolbar 变体 |
| `DatabaseListHeader.tsx` | 54 | 列表/树头两变体 | `shared/components/list-header.tsx` | |
| `DatabaseNotice.tsx` | 52 | 提示条（tone: info/success/warning/error）+ 内嵌动作 | `shared/components/db-notice.tsx` | |
| `DatabaseTypeBadge.tsx` / `DatabaseBadge.tsx` | 30 / 29 | 类型徽章 / 计数徽章 | `shared/components/*` | |
| `DatabaseSectionLabel.tsx` | 25 | 小节标题 | `shared/components/section-label.tsx` | |
| `DatabaseDetail.tsx` | 19 | 详情字段行 | 同上 | |
| `DatabaseSurface.tsx` | 16 | 软填充表面 | `shared/components/surface.tsx` | |

插件**已有但需重写/替换**：`dbx-pro-panel.tsx`(305)、`connection-form.tsx`(383)、`sql-editor.tsx`(165)、
`result-grid.tsx`(168)、`modal-dialog.tsx`(54)、`dbx-cli.ts`(112)、`dbx-storage.ts`、`catalog.ts`。

---

## 3. 索引表（最重要：旧文件 → 关键行区间 → 功能）

按「实现时最可能反复回查」排序。行区间是 grep 定位到的关键段，可直接 `sed -n` 复核。

| # | 旧文件 | 行区间 | 功能 | 插件落点 |
| --- | --- | --- | --- | --- |
| 1 | `components/DatabaseWorkspace.tsx` | 86-88 | 树列宽常量 280/200/380 | `lib/layout.ts` |
| 2 | 同上 | 702-704 | `resolveDatabaseLayout` 调用与 `compact` 派生 | 同上 |
| 3 | 同上 | 709,740 | 树宽 state 与拖拽 clamp | 同上 |
| 4 | 同上 | 992-994 | 分档 padding/gap 映射 | 同上 |
| 5 | 同上 | 1095-1148 | 树列装配（`aside` + ListHeader toolbar） | `explorer/explorer-tree.tsx` |
| 6 | 同上 | 1151-1450 | 主栏装配（标签栏 + 空态 + 查询 + 结果） | `workbench/db-workbench.tsx` |
| 7 | 同上 | 1176-1300 | 查询标签栏：新建、dirty `*`、pinned、右键（关闭其他/全部/重命名/钉住）、拖拽排序 | `query-tab-bar.tsx` |
| 8 | 同上 | 1433 | 详情列 320px | `details/*` |
| 9 | 同上 | 1437-1504 | 树/详情浮层 + 遮罩 | `workbench/*` |
| 10 | 同上 | 90 | `USER_GROUPS_KEY = "astravia:database:user-groups"` 用户自定义分组持久化 | §5 |
| 11 | `lib/query-tabs.ts` | 4-46 | `DatabaseQueryStatus`、`OpenTableMeta`、`QueryTabState`（含 `dirty`/`pinned`/`loadingPage`/`openTableMeta`） | `lib/query-tabs.ts`（原样移植） |
| 12 | 同上 | 46-126 | `createQueryTab`/`closeQueryTab`/`reorderQueryTabs`/`patchQueryTab`/`closeOtherQueryTabs`/`closeAllQueryTabs` | 同上（纯函数，可直搬） |
| 13 | `hooks/useDatabaseQueryModel.ts` | 26 | `OPEN_TABLE_PAGE_SIZE = 100` | `lib/constants.ts` |
| 14 | 同上 | 41-130 | `DatabaseQueryModel`：tabs/投影字段/history/分页/actions 全清单 | `hooks/use-query-model.ts` |
| 15 | 同上 | 130+ | `run` / `runConfirmed` / `runSqlInNewTab` / `openTable` / `goToPage` / `reloadOpenTable` / `rerun` | 同上 |
| 16 | `hooks/useDatabaseExplorerModel.ts` | 15-24 | `ExplorerListNode<T>`（loading/error/items 三态节点） | `lib/explorer-node.ts` |
| 17 | 同上 | 25 | `STORAGE_PREFIX = "astravia.db.explorer.v1"` + `${prefix}.${field}` | §5 |
| 18 | 同上 | 76 | `TABLE_OBJECT_KINDS` = index/constraint/foreign-key/trigger/partition | `lib/constants.ts` |
| 19 | 同上 | 85-92 | `objectFamilyOfScope(scope)` | `lib/catalog.ts` |
| 20 | 同上 | 94-148 | `DatabaseExplorerModel`：`tablesOf/columnsOf/scopesOf/objectsOf` + expand/toggle/ensure/reload 动作 | `hooks/use-explorer-model.ts` |
| 21 | `hooks/useDatabaseWorkspaceModel.ts` | 25-66 | `DatabaseConnectionFormState`、测试快照、`SchemaInjectionScopeKind`、`DatabaseFormFieldKey` | `lib/forms.ts` |
| 22 | 同上 | 68-183 | `DatabaseWorkspaceModel`：连接/表单/测试/注入范围/表缓存/安全模式/行数/超时/工具偏好/AI 白名单 | `hooks/use-workspace-model.ts` |
| 23 | 同上 | 183-210 | `emptyForm`（file-based 类型 host/port 留空）、`toParams` | `lib/forms.ts` |
| 24 | `hooks/useDatabaseAnalyzeSql.ts` | 17,50 | 分析来源 `"editor" \| "history"`，签名 `(connectionName, sql)` | `features/ai/*` |
| 25 | `hooks/useDatabaseAnalyzeResult.ts` | 19-36 | `AnalyzeResultInput` + 执行器 | 同上 |
| 26 | `hooks/useDatabaseAnalyzeTable.ts` | 25 | `(connection, table)` 表分析 | 同上 |
| 27 | `components/DatabaseQueryPanel.tsx` | 全文 134 | 连接下拉（`max-w-[220px]`、未绑定项 `databaseConnectionFollowSidebar`）、问 AI、编辑器容器、Ctrl/Cmd+Enter、运行按钮 | `query-panel.tsx` |
| 28 | `components/DatabaseResultGrid.tsx` | 274-330 | 工具条：行数/截断徽章/只读或无主键提示/刷新/自动刷新（5-30s） | `result-grid.tsx` |
| 29 | 同上 | 350-440 | 加行、导出 CSV/JSON、复制结果、问 AI、编辑模式开关（含禁用原因） | 同上 |
| 30 | 同上 | 442-466 | 空态 `databaseResultIdle`、错误态 `DatabaseNotice tone="error"` + AI 按钮 | `empty-states.tsx` |
| 31 | 同上 | 469-540 | 表格：`border-separate border-spacing-0 text-[12px]`、`thead sticky top-0 z-10`、行号列 `w-10`、`border-b border-border/25` | 同上 |
| 32 | 同上 | 533-613 | 行内编辑单元格 + 新增行表单 + 保存/取消 | 同上 |
| 33 | 同上 | 84-114 | 居中态三件套（空/运行中 + 已用秒数） | `empty-states.tsx` |
| 34 | `components/DatabaseConnectionForm.tsx` | 全文 227 | 表单字段与校验 | `connection-form.tsx` |
| 35 | `components/SchemaInjectionScopePanel.tsx` | 全文 330 | 注入范围三选 + 搜索 + 树勾选 + 批量全选 | `ai-scope/*` |
| 36 | `components/explorer-row-tools.tsx` | 全文 223 | 行内工具与危险操作入口 | `explorer-row-tools.tsx` |
| 37 | `components/DatabaseSettingsPanel.tsx` | 全文 211 | 偏好设置分区 | `settings/*` |
| 38 | `components/DatabaseQueryHistoryPopover.tsx` | 全文 179 | 历史浮层 | `query-history-popover.tsx` |
| 39 | `lib/sql-editability.ts` | 10-35,188 | `QueryEditabilityReason`、`EditableQueryInfo`、`analyzeEditableQuery(sql)` 决定可否行内编辑 | `lib/sql-editability.ts` |
| 40 | `lib/table-ops.ts` | 9-105 | `TableTarget`、`TableDangerOp`(truncate/drop/rename)、`buildExportSelectSql`、`buildDangerOpSql`、`toCsv`、`toJson`、`exportFileName` | `lib/table-ops.ts` |
| 41 | `lib/result-summary.ts` | 11-63 | `summarizeQueryResult(result, options)` → 结果摘要文本 | `lib/result-summary.ts` |
| 42 | `lib/ai-anchor.ts` | 11-48 | `DatabaseAiAnchor` 联合类型、`formatAnchorTableSchema` | `lib/ai-anchor.ts` |
| 43 | `lib/introspection-limiter.ts` | 15,41,64,69 | `MAX_CONCURRENT_INTROSPECTION = 2` + 队列（元数据并发闸门） | `lib/introspection-limiter.ts` |
| 44 | `lib/database-error-labels.ts` | 5,21 | `ERROR_LABEL_KEYS` + `formatDatabaseError`（错误码→文案） | `lib/error-labels.ts` |
| 45 | `lib/analyze-context.ts` | 11-22 | `ANALYZE_SQL_CHAR_LIMIT=8000`、`ANALYZE_CONTEXT_CHAR_LIMIT=6000`、`clipToLimit` | `lib/analyze-context.ts` |
| 46 | `lib/catalog-family.ts` | 12,17 | `isUsableScope`、`tableScopeQualifier` | `lib/catalog.ts` |
| 47 | `lib/explorer-order.ts` | 189 | `astravia.db.explorer.v1.order` 排序持久化（239 行） | §5 |
| 48 | `lib/explorer-visibility.ts` | 33 | `astravia.db.explorer.v1.visibility`（125 行） | §5 |
| 49 | `lib/explorer-toolbar-state.ts` | 16 | `astravia:db:explorer-toolbar`（73 行） | §5 |
| 50 | `lib/query-history.ts` | 13 | `astravia:db:query-history`（80 行） | §5 |
| 51 | `lib/database-tree.ts` | 163 | 树结构工具（排序/可见性/分组） | `lib/database-tree.ts` |
| 52 | `lib/result-grid.ts` | 144 | 单元格格式化/复制/CSV 序列化 | `lib/result-grid.ts` |
| 53 | `lib/sql-dialect.ts` | 133 | 方言识别（限定名/引号/LIMIT 语法） | `lib/sql-dialect.ts` |
| 54 | `lib/database-type-catalog.ts` | 584 | 类型元数据（file-based/defaultPort/分组/能力） | `lib/database-type-catalog.ts` ← 与插件 `connection-config.ts` 合并 |
| 55 | `lib/dbx-sync.ts` | 全文 75 | Markdown 表 → `DbQueryResult` 反解析 + 耗时提取 | `lib/engine-result.ts`（改写为新引擎协议） |
| 56 | `lib/dbx-access-guide.ts` | 10-15 | `shouldShowDbxAccessGuide`（引导用户装 dbx 桌面端的提示显示条件） | 插件语义变为「引擎未就绪」引导 |
| 57 | `main/database/sql-safety.ts` | 1-120 | 读写判定/注释剥离/危险确认依据 | 插件须自持一份（`plugin-constraints.md` §7） |
| 58 | `main/database/database-catalog.ts` | 全文 135 | schema/database/索引/FK/触发器/分区 的 introspect SQL | `lib/introspect-sql.ts`（原样移植） |
| 59 | `main/database/database-service.ts` | 230-623 | 各操作的真实参数形态、行数上限 100、超时 30s、生产写闸门 | `lib/engine-contract.ts`（对齐语义） |

---

## 4. 交互清单（L3，逐条验收）

### 4.1 对象树

- [ ] 连接 → （catalog 分层）schema/database → 表 → 列 → 表级子对象（`TABLE_OBJECT_KINDS` 五类）懒加载；**展开才取数**。
- [ ] 三态节点：loading / error（可重试）/ items（`ExplorerListNode`）。
- [ ] flat 家族（SQLite 等）不出现中间层，行为与旧版一致。
- [ ] 分组折叠（`isGroupCollapsed`）、用户自定义分组（`USER_GROUPS_KEY`）、组内批量展开/折叠。
- [ ] 行内工具：刷新、打开表、复制名、危险操作（truncate/drop/rename，需确认）。
- [ ] 右键菜单：展开/折叠/刷新/新建查询/危险操作。
- [ ] 排序、可见性、工具条状态各自独立持久化（§5）。
- [ ] 元数据请求并发 ≤2（`introspection-limiter`），避免打爆连接。

### 4.2 查询面板

- [ ] 多标签：新建（标题「查询 N」）、关闭、关闭其他、关闭全部、重命名、钉住、拖拽排序。
- [ ] 每标签独立 `sql/status/result/error/errorDetail/openTableMeta/loadingPage/dirty`。
- [ ] `dirty` 未保存标记 `*`；脏标签关闭需确认。
- [ ] 标签绑定连接（`connectionName`）：新建即绑定 / 未绑定则执行时回退当前选中；执行连接可下拉改绑（清结果保 SQL）。
- [ ] Ctrl/Cmd+Enter 执行；空 SQL 禁用运行；无绑定连接禁用运行。
- [ ] 查询历史：成功才记录、全局共享、逐条删除、清空、点击重放。

### 4.3 结果网格

- [ ] 工具条：`N 行`、截断提示、刷新、自动刷新（5/10/30s，显示倒计时）、加行、导出 CSV/JSON、复制结果、问 AI、编辑模式。
- [ ] 编辑模式禁用原因可读：只读连接 / 无主键 / 表无主键。
- [ ] 行号列 + 粘性表头；单元格双击进入编辑；新增行表单保存/取消。
- [ ] 服务端分页：仅「打开表」结果可翻页（`LIMIT pageSize OFFSET (page-1)*pageSize`），页大小 ≤100；满页才允许「下一页」。
- [ ] 空态（未执行）/ 运行态（含已用秒数）/ 错误态（`DatabaseNotice` + 问 AI）。

### 4.4 连接管理

- [ ] 列表：名称、类型徽章、状态点/胶囊、分组、计数。
- [ ] 新增/编辑表单；类型选择器（分组 + 搜索）；file-based 类型自动清空 host/port。
- [ ] 连接测试：草稿测试走临时连接（旧实现 `astravia-test-<8hex>`，测完必删）；已存连接直接测；状态落 `testSnapshots`。
- [ ] 删除连接（确认）。
- [ ] 详情右栏：连接信息、能力、危险区。

### 4.5 AI 上下文注入

- [ ] `schemaInjection` 开关 + 范围三选（all / connection / table）。
- [ ] 范围面板：按连接搜索表、勾选、批量全选/清空、展开收起。
- [ ] 编辑器「问 AI」（携 SQL + 连接）、结果「问 AI」（携结果摘要）、错误「问 AI」（携错误详情）。
- [ ] 表分析：携表名 + 列信息。

> 插件实现口径：旧的「锚点注入宿主会话」在插件里**没有等价物**（`plugin-constraints.md` §7）。
> 可选替代：`ctx.conversation` 打开会话预填 prompt，或 `ctx.ai.complete/chat` 就地分析。二者必须二选一并写进详情页文案。

### 4.6 安全闸门

- [ ] 写/DDL 拦截 → 危险确认 Dialog → 确认后以 `confirmedWrite` 重跑；SQL 文本不一致时报 `CONFIRM_MISMATCH`。
- [ ] 生产连接默认禁 AI 访问；白名单可显式开启（prod 默认关 / dev 默认开）。
- [ ] 安全模式 `strict`（所有连接写需授权）/ `relaxed`（仅 prod 拦截），切 relaxed 前确认。
- [ ] 行数上限、查询超时（默认 100 / 30000ms）可改。

---

## 5. 状态与持久化

### 5.1 旧 localStorage 键 → 插件存储映射【实证】

旧键（全部 try/catch 静默降级）：

| 旧键 | 内容 | 插件落点（`ctx.storage`） |
| --- | --- | --- |
| `astravia.db.explorer.v1.order` | 连接/分组排序 | `explorer.json#order` |
| `astravia.db.explorer.v1.visibility` | 可见性 | `explorer.json#visibility` |
| `astravia.db.explorer.v1.*` | 展开态（`${STORAGE_PREFIX}.${field}`） | `explorer.json#expanded` |
| `astravia:db:explorer-toolbar` | 工具条状态 | `explorer.json#toolbar` |
| `astravia:db:query-history` | 查询历史（最近 N 条） | `query-history.json` |
| `astravia:database:user-groups` | 用户自定义分组 | `groups.json` |
| 查询标签（`QueryTabState[]`） | 会话内状态 | `ctx.storage` 可选（旧版未持久化，插件保持会话内即可） |

**约束**：`ctx.storage` 的路径受限、写用 `commit()` 原子提交 + `expectedRevision` 乐观锁；
`putBlobFromFile` 可存二进制。**禁止**继续用 `localStorage` / `sqlite3` CLI 直写 `dbx.db`。

### 5.2 连接配置

旧版连接存在引擎的 `dbx.db`（`connections` 表），由 `dbx_add_connection` 工具写入。
插件里没有该引擎，必须自持：`connections.json`（非敏感字段）+ `ctx.secrets`（密码/token）。
迁移期需保留「从 `dbx.db` 一次性导入」的兼容路径（现状 `dbx-storage.ts` 的 `readAllConfigs` 已能读）。

### 5.3 宿主级设置（插件写不到）

旧版这些存在**宿主 desktop-config**：`database.connectionEnv`、`database.prodWriteApproved`、
`database.connectionAiAccess`、`database.safetyMode`、`database.rowLimit`、`database.queryTimeoutMs`、
`database.toolPrefs`、`database.schemaInjection`、`database.dbxToolEnabled`。

插件**无法读写宿主配置**，必须在自身存储里重建一份等价设置（语义保持一致，键名自定），
并在详情页/设置页明确「本插件的安全设置独立于 Astravia 全局设置」。

---

## 6. i18n

- 旧工作台用宿主 `settings` 命名空间（`useTranslation("settings")`，键形如 `databaseQueryTitle`）。
- 插件有自己的目录：`locales/{zh,en}.json` + `ctx.i18n.t(bareKey)` / `useTranslation()`（无命名空间参数，
  只解析本插件目录；缺失键回落顺序：当前语言 → `defaultLocale` → 键名本身）。
- 现状问题：`index.tsx` 里 `label: "dbx-pro"` 硬编码，`locales/*.json` 未被使用；
  `SchemaInjectionScopePanel` 移植版含硬编码中文（`已选 N 张表`、`清空`、`在 {connection} 中搜索表…`、
  `无匹配的表`、`收起`/`展开 N 张表（已选 M）`）。
- 迁移规则：以 ✓ 结构对齐 `locales/*.json` 的键空间（`workbench.*` / `explorer.*` / `query.*` /
  `result.*` / `connection.*` / `settings.*` / `ai.*` / `error.*`），**禁止**散落中文字面量。

---

## 7. `lib/` 模块角色与可用性

「可直搬」= 纯逻辑、无 Electron/宿主依赖；「需改」= 依赖宿主 API；「重写」= 依赖不存在的能力。

| 模块 | 行数 | 角色 | 结论 |
| --- | --- | --- | --- |
| `query-tabs.ts`、`explorer-order.ts`、`explorer-visibility.ts`、`explorer-toolbar-state.ts`、`table-ops.ts`、`result-summary.ts`、`ai-anchor.ts`、`introspection-limiter.ts`、`analyze-context.ts`、`catalog-family.ts`、`sql-dialect.ts`、`result-grid.ts`、`database-tree.ts` | 20–240 | 纯函数/纯状态 | **可直搬**（改 import 与 i18n） |
| `database-type-catalog.ts`(584)、`explorer-order` 的数据源 | — | 类型元数据 | 与插件 `connection-config.ts`(211, 87 类型) 合并去重 |
| `sql-editability.ts`(221)、`database-error-labels.ts`(34) | — | 可编辑性判定、错误码文案 | 可直搬，文案改 i18n 键 |
| `query-history.ts`(80) | — | 历史读写 | 需改：`localStorage` → `ctx.storage` |
| `dbx-sync.ts`(75) | — | Markdown 表解析 | **重写**：新引擎协议不再是 Markdown 表 |
| `dbx-access-guide.ts`(21) | — | dbx 安装引导 | 语义改为「引擎未就绪」 |
| `database-api.ts`(114) | — | 宿主 preload API 调用 | **不可用**：插件无 preload 通道 |
| `database-layout.ts`(37) | — | 分档计算 | 可直搬 |
| `hooks/*`(5 个，880+586+474+116+114+84) | 2254 | 三个模型 + 三个分析器 | 需改：数据调用换新引擎层；`localStorage` 换 `ctx.storage`；宿主设置换插件设置 |
| `components/*`(22 个) | ≈6300 | 视图 | 视觉可移植；`@astravia/ui` 组件需替换为插件自带/`@astravia-org/ui`（可选，见 §Q-F） |

**关键依赖缺口**：旧工作台用了 `@astravia/ui`（Button/DropdownMenu/Dialog）与
`@astravia/theme-ui/file-preview` 的 `TextCodeEditorView`（CodeMirror 封装）。
插件拿不到这两个包。两条路：

- **Q-F-1（建议）**：SQL 编辑器引入插件自有 `codemirror@6` + `@codemirror/lang-sql`（保真度高：
  行号、选中、括号匹配、撤销栈、Ctrl+Enter 语义一致），代价是包体上升。
- **Q-F-2**：沿用现有 CSS-overlay 高亮实现（`sql-editor.tsx`，165 行），零依赖但无行号/撤销，
  长 SQL 体验明显低于旧版。
- 另需确认宿主可选 UI 包 `@astravia-org/ui`（`plugin.json` 需 `hostUi: true`，Desktop ≥0.5.31 +
  plugin-vite ≥0.0.5）能否覆盖 Button/Dialog/DropdownMenu；覆盖不了的部分用 Tailwind v4 自绘。

---

## 8. 空/加载/错误态清单

| 场景 | 旧表现 | 证据 |
| --- | --- | --- |
| 无任何打开查询 | 中栏引导页（大图标 `h-16 w-16 rounded-2xl bg-primary/10` + 说明段 `max-w-[380px] text-[12.5px]`） | `DatabaseWorkspace.tsx:1155-1170,1410-1425` |
| 连接列表加载中 | 骨架块 `h-[52px] animate-pulse rounded-lg bg-background/70` | `:942` |
| 结果未执行 | 居中图标 + `databaseResultIdle` | `DatabaseResultGrid.tsx:442` |
| 结果运行中 | 居中 `databaseRunning` + 已用秒数 `text-[11px] tabular-nums text-muted-foreground/50` | `:110-114` |
| 结果为空（affected rows） | 插件现实现显示 `0 行（affected rows: N）` | `result-grid.tsx` |
| 查询失败 | `DatabaseNotice tone="error"` + `databaseQueryFailed` + 问 AI 按钮 | `:447-461` |
| 结果被截断 | 行数旁截断徽章 + `databaseResultTruncatedHint` | `:278-286` |
| 权限/只读 | `databaseEditReadOnly` / `databaseEditNoPkWarning` / `databaseEditKeylessWarning` | `:296-304` |
| 引擎未就绪 | （旧为 dbx 桌面端引导 `dbx-access-guide`）插件改为引擎安装/启动失败提示 + 重试 | `lib/dbx-access-guide.ts` |

---

## 9. 视觉 token 摘要（L2 复核用）

- 容器：`rounded-xl` / `bg-muted/40`（树、详情）/ `bg-muted/35`（结果）/ `bg-muted/20`（树头）/ `bg-card`（Surface）。
- 边框：`border-border`、细分隔 `border-border/40`、单元格 `border-border/25`。
- 字号：页标题 24 / 主文 12.5 / 表格 12 / 次要 11.5 / 标签 11 / 行号 10.5。
- 重点色：`text-primary`、`bg-primary/10`、`ring-primary/40`。
- 圆角：容器 `rounded-xl`、编辑器 `rounded-lg`、胶囊 `rounded-full`。
- 动效：仅页头 `motion` 入场与 `animate-pulse`；不引入额外动画。
