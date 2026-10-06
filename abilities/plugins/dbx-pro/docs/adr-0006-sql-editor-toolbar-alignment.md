# ADR-0006: SQL 编辑器工具栏与 dbx 对齐

## 状态

提案中，尚未实施。

## 背景

dbx 桌面壳的 SQL 编辑器工具栏（`EditorToolbar.vue`）承载了 27+ 个操作按钮、连接上下文选择器组、事务控制组，以及窄宽度下的溢出菜单。dbx-pro 插件的 SQL 编辑器工具栏（`sql-editor.tsx`）目前仅有 3 个按钮（执行 / 整理 / 清空）+ 右侧连接名纯文本显示。这是 **dbx 与 dbx-pro 之间最大的功能鸿沟**，直接影响核心开发效率。

本文档以 dbx `EditorToolbar.vue` 为基准逐项对比差异，给出实施优先级、分阶段计划与约束决策。

---

## 1. 基准：dbx EditorToolbar.vue 完整按钮清单

### 1.1 分组结构（按从左到右顺序）

```
[执行组] Play ↔ Square · SquarePlay · Eye · GitBranch · "A"(Explain/Analyze)
[编辑操作组] AlignLeft · Minimize2 · FoldVertical · UnfoldVertical · A/a(case) · WrapText · SpellCheck2 · BetweenVerticalStart · Shield
[文件/保存组] Save · RefreshCw · FolderOpen · Download · ClipboardPaste · CirclePlay
[--- 空隙 ---]  (宽度充足时才显示以下组)
[连接上下文组] ConnectionTreeSelect(带色点) · Catalog(Layers) · Database(SearchableSelect) · Schema
[事务组] Tx:A/M toggle · Check(Commit绿) · RotateCcw(Rollback红)
[--- 溢出 ---]  MoreHorizontal（toolbarTier >= 1 时，折叠第 2、3 组 + RefreshCw 到溢出菜单）
```

### 1.2 逐项完整表

| # | 图标 | 功能 | 可见条件 | 颜色/备注 |
|---|------|------|---------|----------|
| G1-1 | Play / Square | 执行 ↔ 停止（toggle） | 始终可见 | 运行中切换为 Square |
| G1-2 | SquarePlay | 新结果标签执行 | 始终可见 | violet 色 |
| G1-3 | Eye | 预览 DML 变更 | 仅 DML + 可写连接 | sky blue |
| G1-4 | GitBranch | EXPLAIN 计划 | 始终可见 | — |
| G1-5 | A | EXPLAIN ANALYZE / Autotrace toggle | DM / PG / SQLServer | — |
| G2-1 | AlignLeft | 专业格式化 SQL | 始终可见 | amber |
| G2-2 | Minimize2 | 压缩 SQL（去除空白） | 始终可见 | amber |
| G2-3 | FoldVertical | 全部折叠 | 始终可见 | — |
| G2-4 | UnfoldVertical | 全部展开 | 始终可见 | — |
| G2-5 | A/a | 关键字大小写切换 | 始终可见 | — |
| G2-6 | WrapText | 软换行 toggle | 始终可见 | — |
| G2-7 | SpellCheck2 | 语义诊断 toggle | 始终可见 | — |
| G2-8 | BetweenVerticalStart | INSERT 值提示 toggle | 始终可见 | — |
| G2-9 | Shield | Redis 危险命令拦截 toggle | 仅 Redis 连接 | — |
| G3-1 | Save | 保存 SQL 到文件 | 始终可见 | blue |
| G3-2 | RefreshCw | 对象源刷新 | 仅对象浏览器可选中对象 | — |
| G3-3 | FolderOpen | 打开 SQL 文件 | 始终可见 | — |
| G3-4 | Download | 导入结果归档 | 始终可见 | — |
| G3-5 | ClipboardPaste | 粘贴 IN 条件（多 DB 适配） | 始终可见 | — |
| G3-6 | CirclePlay | 多 DB 同时执行 | 始终可见 | — |
| G4-1 | ConnectionTreeSelect | 连接选择器（带色点） | 始终可见 | — |
| G4-2 | Catalog | Catalog 选择器 | 仅 Doris 系 | Layers 图标 |
| G4-3 | Database | 数据库选择器（可搜索） | 始终可见 | SearchableSelect |
| G4-4 | Schema | Schema 选择器 | PG / SQLServer / Snowflake 等 | — |
| G5-1 | Tx:A/M | 自动提交 ↔ 手动事务 toggle | 仅支持事务的驱动 | — |
| G5-2 | Check | Commit | 仅手动事务中 | green |
| G5-3 | RotateCcw | Rollback | 仅手动事务中 | red |

**溢出行为**：当 `toolbarTier >= 1` 时，G2 全部、G3-2 ~ G3-6 折叠进 MoreHorizontal 菜单；`toolbarTier` 由窗口宽度动态计算。

### 1.3 布局细节

- 工具栏使用 Radix UI Toolbar 原语 + Tailwind
- 执行组始终保持在最左，不会被折叠
- 连接上下文组靠右对齐，与执行组之间有弹性空隙
- 事务组在连接组右侧，最右
- 分组间使用分隔线（`ToolbarSeparator`）

---

## 2. dbx-pro 当前状态（sql-editor.tsx）

### 2.1 按钮清单（仅 4 个元素）

| 位置 | 元素 | 图标 | 问题 |
|------|------|------|------|
| 左侧 | 执行 | Play | ❌ 运行中仅 disabled，没有变成 Square 图标；不是 toggle |
| 左侧 | 整理 | ListFilter | ⚠️ 仅简单 Tidy，不是专业格式化（缩进/对齐） |
| 左侧 | 清空 | Trash2 | ✅ 基本可用 |
| 右侧 | 连接名文本 | 无 | ❌ 纯文本显示，不可点击选择 |

### 2.2 缺失一览（共 23 项缺失 / 不完整）

- **执行组**：缺 执行↔停止 toggle（当前 disabled + Play 图标）、ExecuteInNewTab、Preview DML、Explain、ExplainAnalyze
- **编辑操作组**：缺 专业格式化（Format）、压缩、折叠/展开、大小写 toggle、软换行、语义诊断、INSERT 提示、Redis 拦截
- **文件/保存组**：缺 Save、Open、Import、PasteIN、MultiDB Execute
- **连接上下文组**：ConnectionPicker（可点击）、Catalog、Database、Schema —— 全部缺失（目前仅纯文本）
- **事务组**：Transaction toggle、Commit、Rollback —— 全部缺失
- **溢出菜单**：缺失

---

## 3. 优先级矩阵

### P1 — 必须实施（核心工作流阻塞项）

| 功能 | dbx 来源 | dbx-pro 现状 | 决策依据 |
|------|---------|-------------|---------|
| 执行 ↔ 停止 toggle | G1-1 | disabled + 无 Square 图标 | 用户按下执行后，不能立刻停止，这是阻塞级问题 |
| 新结果标签执行（ExecuteInNewTab） | G1-2 | 缺失 | 用户要并排对比多组结果的核心能力 |
| 专业格式化 SQL | G2-1 AlignLeft | 只有 Tidy（L3） | Tidy 仅做语法整理，不做缩进/对齐；格式化是高频操作 |
| 保存 SQL | G3-1 Save | 缺失 | 代码即资产，保存到本地文件是基本需求 |
| 连接选择器（可点击） | G4-1 ConnectionTreeSelect | 纯文本 | 用户在 SQL 窗口内切换连接的唯一入口 |
| 数据库选择器 | G4-3 Database(SearchableSelect) | 缺失 | 跨库开发的基本需求 |
| Schema 选择器 | G4-4 Schema | 缺失 | PG / SQLServer 用户的硬需求 |

### P2 — 重要但可延后

| 功能 | dbx 来源 | 决策依据 |
|------|---------|---------|
| EXPLAIN 计划 | G1-4 GitBranch | 性能调优必备，但可先通过 dbx 桌面壳查看 |
| 全部折叠 / 展开 | G2-3/4 | 长 SQL 导航效率提升 |
| 软换行 toggle | G2-6 WrapText | 长行 SQL 可读性 |
| 关键字大小写 toggle | G2-5 A/a | 团队代码规范统一 |
| 事务 toggle + Commit / Rollback | G5-1/2/3 | 插件目前写操作走独立确认流程，事务层未就绪；但用户期望存在 |
| 对象源刷新 | G3-2 RefreshCw | 对象浏览器联动，可延后 |
| Overflow 折叠菜单 | toolbarTier | 宽屏先可用，窄屏适配可后做 |

### P3 — 有条件 / 边界场景

| 功能 | dbx 来源 | 暂缓原因 |
|------|---------|---------|
| 预览 DML 变更 | G1-3 Eye | 需要可写 grid，当前无 |
| EXPLAIN ANALYZE | G1-5 A | 仅 DM / PG / SQLServer，受众窄 |
| 压缩 SQL | G2-2 Minimize2 | 使用场景有限 |
| 语义诊断 | G2-7 SpellCheck2 | 实现复杂，语言服务层未就绪 |
| INSERT 值提示 | G2-8 BetweenVerticalStart | 边界场景 |
| Redis 危险命令拦截 | G2-9 Shield | 仅 Redis 驱动 |
| 打开 SQL 文件 | G3-3 FolderOpen | 插件 runtime 需文件选择 API |
| 导入结果归档 | G3-4 Download | 低频 |
| 粘贴 IN 条件 | G3-5 ClipboardPaste | 边界 |
| 多 DB 同时执行 | G3-6 CirclePlay | 架构层需支持并发路由 |
| Catalog 选择器 | G4-2 Layers | 仅 Doris 系 |

### 「不适用」项

| 项 | 原因 |
|----|------|
| 事务组（Commit / Rollback） | dbx-pro 是 plugin-only，无独立事务层；写操作走宿主确认流程。P2 的 toggle 仅做 UI 壳，不接真实事务 |
| 连接组布局 | dbx 的 `ConnectionTreeSelect` 是 Tree 组件，dbx-pro 已有 `use-workbench` hook 提供连接列表，用简单 Combobox 即可 |

---

## 4. 实施分阶段计划

### Phase 1 — P1 核心工具（~5 人日）

目标：补齐 **7 项 P1 功能**，工具栏布局与 dbx 基本对齐。

#### 1.1 执行组改造

```sql
现状: [Play(disabled when running)] [ListFilter(Tidy)] [Trash2(清空)] ...连接名文本...
目标: [Play ↔ Square(toggle)] [SquarePlay(violet)] ... [连接选择器 ▾] [数据库 ▾] [Schema ▾]
```

**执行 ↔ 停止 toggle**：
- 运行中 `isRunning === true` 时，Play 图标切换为 Square（实心方块 `icon-[lucide--square]`）
- 点击 Square 触发 `cancelExecution()`（workbench hook 已有）
- 需要 toolbar 感知 `isRunning`、`cancelExecution` —— 从 `useWorkbench()` 传入

**新结果标签执行**：
- 复用 dbx 的 `SquarePlay` 图标 + violet 色（`bg-violet-500/10 text-violet-600 hover:bg-violet-500/20`）
- 行为：调用 `workbench.openEditorTab({ connectionName, sql })` 然后执行
- dbx-pro 的 tab 管理在 `workbench.ts` hook 中，需暴露 `openTabAndRun` 能力

#### 1.2 专业格式化 SQL

- dbx-pro 当前的 `tidy` 是轻量 prettier；**Format** 需要更专业的 SQL formatter（缩进、关键字大写、对齐）
- 候选：`sql-formatter` 或 `pg-formatter`（已在 dbx 使用）
- 实现：在现有 Tidy 按钮旁新增 AlignLeft（amber）按钮，独立调用专业 formatter
- 快捷键冲突检测（dbx 用 `Shift+Mod+F`）

#### 1.3 保存 SQL

- 需要 astravia plugin runtime 提供文件系统 API（宿主权限）
- 候选路径：`@astravia-org/plugin-runtime` 的 `fs.saveFile()` 或 `dialog.showSaveDialog()`
- 行为：弹出系统保存对话框，写入当前编辑器内容
- dbx 用 `Mod+S`，需确认宿主是否已占用

#### 1.4 连接上下文组

**连接选择器**：
- 图标：`Dot`（使用连接颜色） + 连接名（当前选中）
- 点击弹出 Combobox，列出 `useWorkbench().connections` 中所有可用连接
- 选中后更新 tab 的 `connectionName` + 重新加载 database/schema 列表
- 状态来源：`useWorkbench().activeTab.connectionName`

**数据库选择器**：
- SearchableSelect / Combobox，数据源为选中连接下的 database 列表
- 数据源：需要 dbx-pro 已有的 database 元数据获取能力（连接工具函数）
- 选中后更新 tab 的 `database`

**Schema 选择器**：
- 同上，PG / SQLServer / Snowflake 驱动才显示
- 选中后更新 tab 的 `schema`

#### 1.5 布局改造要点

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Play↔Square] [SquarePlay]  │ [AlignLeft] [Minimize2] [Tidy] [Trash2]      │
│                              │                                              │
│                              │  ⋮  (分隔)                                   │
│                              │  ● connName ▾   Database ▾   Schema ▾        │
└─────────────────────────────────────────────────────────────────────────────┘
```

- 工具栏分两段：左段操作按钮组，右段连接上下文组
- 左段与右段间使用 flex-1 弹性空隙（dbx 用 `<div class="flex-1" />`）
- 执行组不参与 overflow
- **Phase 1 暂不实现 overflow 折叠**（假设 1200px 以上宽度使用）

### Phase 2 — P2 增强（~4 人日）

1. EXPLAIN 按钮：复用执行逻辑，前置 `EXPLAIN ` 包装
2. 折叠 / 展开：CodeMirror 已有 fold 扩展，暴露按钮调用 `cm.foldAll()` / `cm.unfoldAll()`
3. 软换行 toggle：调用 CodeMirror 的 `setOption("lineWrapping", bool)`
4. 关键字大小写 toggle：正则替换 `\b(SELECT|FROM|WHERE|...)\b`（大小写映射表）
5. 事务 UI 壳：只渲染 toggle + Commit / Rollback 按钮，但点击显示「当前插件不支持事务编辑」提示 —— 保留视觉占位，避免与 dbx 落差过大
6. Overflow 折叠菜单：实现 `toolbarTier` 计算，窄宽度将 G2 后半 + G3 折叠进 MoreHorizontal

### Phase 3 — P3 边界（待定）

按实际用户反馈逐项落地，不在本 ADR 强制排期。

---

## 5. 技术决策

### 5.1 连接选择器技术选型

| 方案 | 优点 | 缺点 |
|------|------|------|
| Radix UI Combobox + shadcn Command | dbx-pro 已引入 Radix，搜索体验好 | 体积稍大 |
| 原生 `<select>` + 可搜索 input | 实现最轻 | 体验差，长列表难用 |

**决策**：复用现有 ResultGrid 的列导航 Popover 中已实现的 Command 模式，统一组件。

### 5.2 专业 Formatter 库

| 库 | dbx 是否用 | 支持方言 | 体积 |
|----|-----------|---------|------|
| `sql-formatter` | ❌ | MySQL/PG/SQLite/SQLServer/... | ~30KB gz |
| `pg-formatter` (Rust → WASM) | ✅ | PG only，其他方言有限 | ~50KB gz |

**决策**：采用 `sql-formatter`（dbx-pro 需支持多驱动），并按当前连接方言切换 `dialect` 参数。dbx 用 `pg-formatter` 是因为 PG-only，dbx-pro 覆盖 MySQL/PG/SQLServer/Doris/Snowflake 等，`sql-formatter` 更合适。

### 5.3 保存 SQL 的宿主 API

**决策**：在 astravia plugin runtime 中增加 `fs.saveFile({ defaultName, content })` 能力。如果宿主暂未暴露，Phase 1 先用「下载为 .sql 文件」降级实现（`<a download>`），不阻塞 P1 整体交付。

---

## 6. 风险与约束

### 6.1 架构层约束

| 约束 | 说明 | 应对 |
|------|------|------|
| plugin-only 无事务层 | Commit / Rollback 按钮无法真接事务 | P2 仅做 UI 壳 + 友好提示 |
| 文件系统 API | Save SQL 依赖宿主暴露能力 | 若宿主暂不支持，降级为 download |
| database/schema 元数据获取 | 连接选择后需异步拉取元数据 | 复用现有连接工具函数，加 loading 状态 |
| CodeMirror 实例引用 | Fold/Unfold、lineWrapping toggle 需直接操作 cm 实例 | toolbar 组件需持有 `editorRef` 或通过 context 暴露 |

### 6.2 UI/UX 风险

| 风险 | 说明 | 应对 |
|------|------|------|
| 工具栏宽度溢出 | dbx-pro 宿主可能比 dbx 桌面壳窗口窄 | Phase 1 先实现不折叠，Phase 2 补 overflow |
| 按钮密度 | 27+ 按钮放在一行过于拥挤 | 与 dbx 保持一致的 overflow 策略 |
| 运行中状态不一致 | Execute 按钮 disabled + 无 Square 图标是当前最扎眼问题 | Phase 1 优先修复 |

### 6.3 与 dbx 桌面壳的行为差异

- dbx 的 `RefreshCw` 刷新对象浏览器中的当前选中对象 —— dbx-pro 工具栏简化为「刷新数据库元数据」或隐藏
- dbx 的 `ClipboardPaste`（IN 条件粘贴）依赖剪贴板格式解析 —— dbx-pro 可延后
- dbx 的 `CirclePlay`（多 DB 执行）需要并发路由层 —— 架构层暂不具备

---

## 7. 验收标准

### Phase 1 验收（P1）

- [ ] 执行按钮运行中切换为 Square 图标，点击停止调用 `cancelExecution()`
- [ ] SquarePlay（violet）按钮可见，点击在新标签执行
- [ ] AlignLeft（amber）格式化按钮存在，调用 `sql-formatter`，按连接方言切换
- [ ] Save 按钮存在，触发保存文件对话框（或降级为下载）
- [ ] 工具栏右侧显示 **连接选择器（可点击）+ 数据库选择器 + Schema 选择器**
- [ ] 连接选择器数据源为 `useWorkbench().connections`，颜色点同步
- [ ] 切换连接后，database 列表自动刷新
- [ ] 工具栏与 dbx EditorToolbar 视觉分组对齐（左操作区 flex-1 右连接区）
- [ ] 不破坏现有 Tidy / 清空按钮

### Phase 2 验收（P2）

- [ ] EXPLAIN 按钮存在，点击在新结果标签以 EXPLAIN 模式执行
- [ ] Fold / Unfold 按钮调用 CodeMirror fold API
- [ ] WrapText toggle 实时切换编辑器软换行
- [ ] Keyword case toggle 可切换 upper / lower / 保留
- [ ] 事务组 UI 占位（toggle + Commit green + Rollback red），点击显示不支持提示
- [ ] 窄宽度下自动折叠溢出菜单（MoreHorizontal）

### 跨 Phase 通用标准

- [ ] 所有按钮使用 `dbx-iconbtn` 类（dbx-pro 现有按钮样式约定）
- [ ] 按钮可见性按驱动 / 连接类型条件渲染
- [ ] 状态变化（运行中 / 已停止 / 连接切换）按钮正确 enabled/disabled
- [ ] 深色/浅色主题变量覆盖正确（走 `@scope`）
- [ ] 构建产物 CSS scope 验证通过（见 ADR-0004 §8）

---

## 8. 参考资料

- dbx 源码：`github-source-code/dbx/apps/desktop/src/components/layout/EditorToolbar.vue`（L551-932 按钮清单、状态机逻辑）
- dbx-pro 源码：`dbx-pro/src/features/database-workspace/components/sql-editor.tsx`（L288-324 当前工具栏）
- dbx-pro 工作台状态：`dbx-pro/src/features/database-workspace/hooks/use-workbench.ts`
- ADR-0004：查询结果网格工具栏完善（dbx-cta / dbx-iconbtn 样式约定）
- dbx-pro Props 缺口：ADR-0004 §9 ResultGrid Props 缺口修复，类似地，SQL 编辑器工具栏需要从 workbench hook 显式取状态而非隐式 context
- `sql-formatter`：https://github.com/sql-formatter-org/sql-formatter
- `pg-formatter`（dbx 在用）：https://github.com/darold/pgFormatter（WASM 移植）
