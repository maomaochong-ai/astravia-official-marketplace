# 工作流 1 · §3.6 E 连接树 / 连接视图 / 右键菜单 —— 改造报告

范围：`abilities/plugins/dbx-pro`（E1–E4）。约束：只动本工作流自有文件（`connection-tree.*`、`connection-node.*`、`connection-list.*`、`connection-manager-view.tsx`、`styles/connection-tree.css`）；用户任务书另允许「菜单内容文件」，实现时未新建此类文件（原因见「依赖与阻塞」。不动 `src/index.tsx`、`src/style.css`、`src/shared/**`、`src/domain/**` 及其他工作流的文件。

状态：E1–E4 的代码改造已落地，`npx tsc --noEmit` **EXIT 0**。快捷键 keycaps 与菜单宽度两项受宿主共享件（禁改）阻塞，未落地，见「依赖与阻塞」。

## 1. 改动文件清单

| 文件 | 改动行数（`git diff --stat`） | 改动内容 |
| --- | --- | --- |
| `src/features/database-workspace/components/connection-tree.tsx` | 26 | 工具条改传 `selectedCount` / `query` / `onQueryChange`；删除原先单占一行的 `h-7` 搜索行（搜索框下沉到工具条第 2 行）；容器与树滚动区、搜索命中断、多选 / 空闲底部条、`SendToAiDialog` 均未改 |
| `src/features/database-workspace/components/connection-tree-toolbar.tsx` | 89 | 由单行 `h-9` 改为设计稿两行：第 1 行 `h-9`（图标 + 「连接」+ 条件计数 + `ml-auto` 导入 / 导出 / 刷新 / 收起面板），第 2 行 `h-7`（展开全部 / 收起全部 / 多选 `square-check-big` / 内嵌搜索框 / 条件 `已选 N`）；新增 props `selectedCount`、`query`、`onQueryChange`；导入导出与 `handleImportFile` 逻辑逐字保留 |
| `src/features/database-workspace/components/connection-node.tsx` | 523 | 新增 11 个 helper；重写连接 / 库 / 表三套右键菜单（详见 §2 E3）；行内文本尺寸与右侧计数对齐设计稿；顶部交互注释同步 |
| `src/features/database-workspace/components/connection-list.tsx` | 7 | 行内类型副标题由内部 `db_type` 改为显示名（`findDbType(...)?.label ?? db_type`） |
| `src/features/database-workspace/components/connection-manager-view.tsx` | 0 | 未改动，理由见 §2 E4-3 |

未触碰（其他工作流或禁改）：`index.tsx`、`style.css`、`shared/**`、`shared/components/context-menu.tsx`、`shared/styles/dbx-primitives.css`、`split-layout.tsx`、`result-*`、`sql-editor*`、`history-panel.tsx`、`workbench-top-bar.tsx`、`page-size-menu.tsx`、`horizontal-split.tsx`、`grid-hscroll.tsx`、`sql-table-ref.ts`。

`styles/connection-tree.css` 保持空壳：本轮所有树样式都用 Tailwind 原子类写在 TSX 内，未新增插件 CSS 类（该文件在 `src/index.tsx:26` 已注册，无需改入口）。

## 2. 偏差表

### E1 连接树面板（`connection-tree.tsx` / `connection-tree-toolbar.tsx`）

| # | 设计稿 | 改造前 | 处理 / 证据 |
| --- | --- | --- | --- |
| E1-1 | 展开态 `w-[248px] border-r border-border bg-surface-raised`；收起态 `w-9`（36px）竖条 | 容器 `flex h-full flex-col bg-surface-raised`，宽度由外层分栏给 | **不在本文件加宽度/右边框**：`split-layout.tsx`（根代理文件，禁改）已设 `DESIGN_LEFT = 248`、`width: leftCollapsed ? 36 : effectiveLeft`，并渲染完整 36px 收起栏与 `.dbx-splitbar` 1px 分隔线。重复加会与内联拖拽宽度打架并出现双线。证据：`split-layout.tsx:27/28/30`、左栏分支与 36px rail |
| E1-2 | 第 1 行 `flex h-9 items-center gap-2 border-b border-border px-3` + 第 2 行 `flex h-7 items-center border-b border-border px-2` | 工具条单行 `h-9`，另有独立 `h-7` 搜索行（合计多占一行） | 已改为设计稿两行，搜索框内嵌第 2 行。**任务书写「h-8 头」，与其冲突** —— 设计稿 `components/ConnectionTree.tsx` 与 `components/WorkbenchGhost.tsx` 实测均为 `h-9` 头 + `h-7` 工具行（帧类名逐字），按「设计稿优先」取 `h-9`/`h-7`。证据：`ConnectionTree.tsx:27` 行高 `h-6`、头部 `h-9 border-b ... px-3`、工具行 `h-7 ... px-2` |
| E1-3 | 设计稿无搜索框 | 独立 `h-7` 搜索行 | 连接树懒加载必须能搜表，故保留搜索能力但**不再单占一行**：嵌进第 2 行 `mx-1 flex h-5 min-w-0 flex-1 ...`，带 `search` 图标与条件清除按钮 |
| E1-4 | 工具行常显「已选 N」 | 无 | 已加，但仅在 `selectionMode \|\| selectedCount > 0` 时渲染，避免默认「已选 0」噪声（有意偏差） |
| E1-5 | 多选按钮图标 `square-check-big` | `list-checks` | 已改 `square-check-big`（同 24px `dbx-icon-btn`，`active={selectionMode}`） |
| E1-6 | `IconButton` 默认 `sm` = 28px / 图标 14px | 插件图标按钮 24px | 约束要求图标按钮固定 24px（`.dbx-icon-btn`），等价设计稿 `xs`（24px + `size-3` 图标）→ 保持 24px/12px 图标 |
| E1-7 | 行选中 `bg-accent-soft` | `bg-link-soft` | 已改。`--color-link-soft: var(--dbx-accent-soft)`（`style.css:56`），**同一色值**，纯命名对齐、零视觉变化 |
| E1-8 | 底部条 `h-9` 仅「交给 AI」 | 多选态还有 清空 / 看板下拉 / 退出；空闲态有「当前: X」 | 保留（约束：不得删除既有功能），登记为有意偏差 |
| E1-9 | 滚动条 10px / 6px | `.dbx-scroll`（根代理 S2，禁改） | 不重复定义，沿用共享件 |

### E2 树节点（`connection-node.tsx` 行结构）

| # | 设计稿 | 改造前 | 处理 / 证据 |
| --- | --- | --- | --- |
| E2-1 | 行 `flex h-6 items-center gap-1.5 whitespace-nowrap pr-2`；缩进 `8 + depth*12`；无连接线 | 同 | 一致，未动 |
| E2-2 | 标签 `truncate text-[14px]`；mono 节点 `font-mono text-[12px]` | 行容器带 `text-[12px]`，标签无字号 | 已改：行容器去掉 `text-[12px]`；标签按种类 `font-mono text-[12px]`（schema/table/column/routine）或 `text-[14px]`（connection/分组） |
| E2-3 | 行右侧组计数 `ml-auto shrink-0 font-mono text-[12px] tabular-nums text-faint` | 无 | 已加：`hasLoadedChildren && children.length > 0` 时显示 `children.length`；加载中显示 `loader` 3px spinner。计数源为 `children.length`（`TreeNode` 无 count 字段） |
| E2-4 | 行内图标 `size-3`（12px）、chevron `size-3`（12px） | 同为 `h-3 w-3` | 一致，未动（设计稿树行图标实测 `size-3`，非 16px；16px `size-4` 是菜单行图标） |
| E2-5 | 表行 trailing 用 `Chip`（如「4 列」） | 无 | 未实现：列数需额外 `/describe` 往返，属新增请求；登记为后续项（组计数已覆盖信息需求） |
| E2-6 | 展开 / 收起 / 懒加载 loading | 同 | 保留未动；只把 loading 从行尾挪到 meta 位（与计数同槽） |

### E3 右键菜单（`connection-node.tsx`，对齐 `components/contextMenus.ts`）

策略：以设计稿条目顺序为骨架；**能真正接线的才出条目**，接不上的**直接省略并在下表登记，不出 disabled / no-op 假按钮**；插件独有且已实现的能力作为「插件额外项」插在语义相邻处并登记。

**连接菜单（设计 19 项 + 4 分隔；已接 8 项）**

| 条目 | 接线目标 |
| --- | --- |
| 复制名称（`copy`） | `copyText(node.label)` |
| 复制连接信息 ▸（`link-2`） | 连接字符串（由 `db_type`/`host`/`port`/`database` 拼 DSN，`DbConnection` 无连接串字段）· 主机与端口 · 数据库名（无 `database` 时不出该行） |
| 新建查询（`terminal`） | `newQueryForConnection()`（既有） |
| 展开 / 折叠（插件额外项） | `ensureChildren()` + `expand()` / `toggleNode` |
| 新建表（插件额外项） | `openNewTable(node.label)`（既有，1 参 → schema 省略） |
| 创建数据库（`plus`） | `openCreateDatabase()`：只开 `CREATE DATABASE new_database;` 模板 tab，**不自动执行** |
| 刷新（`refresh-cw`） | `refreshNode()`：`invalidateConnectionTree` + `ensureChildren()` |
| 添加到 AI（`sparkles`，设计名「发送到 AI 分析」的等价槽位） | `openAiDialog(buildConnectionPrompt({ connectionName, dbType }))` |
| 删除连接（`trash-2`，danger） | `confirmRemoveConnection()` → 菜单内二次确认 → `removeConnection()`（`engineRemoveConnection` + 清 `activeConnectionName` + `refreshConnections()`，失败 `setError`）。**不用 `window.confirm`**：宿主 webview 里它是静默 no-op（文件内既有注释） |

**库（schema）菜单（设计 25 项 + 4 分隔；已接 11 项）**：新建查询 · 添加到 AI（本地 prompt，与既有实现一致）· 展开 / 折叠（额外）· 新建表（`openNewTable(conn, node.label)`）· 新建 Schema（`openCreateSchema()` 模板 tab）· 刷新 · 复制 Schema 名 · 复制为 SQL 引用 · 删除 Schema（danger，`runDropSchema()`：PG 族 `DROP SCHEMA IF EXISTS x CASCADE;`，其余 `DROP SCHEMA IF EXISTS x;`；开 tab 后由既有延迟执行通道触发写确认）。

**表菜单（设计 26 项 + 5 分隔；已接 18 项）**：复制名称 ▸（名称 / 完整路径）· 新建查询 · 添加到 AI · 查看数据（原「预览数据」改名对齐）· 新标签页查看（原「在新标签页打开（不执行）」改名）· 查看 DDL（`generateSql("create")`）· 查看表结构（插件额外项，保留）· 生成 SQL ▸（SELECT / INSERT / UPDATE / DELETE + CREATE / ALTER / DROP TABLE）· 统计行数（额外）· 复制表结构为 ▸（TSV / Markdown 表格，走 `/describe`）· 复制为 SQL 引用 · 可视化 ▸（额外：生成企业看板 / 生成数据大屏）· 执行 VACUUM · 执行 VACUUM FULL（额外）· 更多 ▸（清空数据 / 截断表 / 删除表 / 强制删除（CASCADE），均 danger）· 刷新。routine / routine-folder 两套菜单**未改动**。

**省略项（设计稿有、插件无对应能力，故不出条目）**

| 省略项 | 原因 |
| --- | --- |
| 断开连接（`unplug`） | 引擎无「关闭连接」API，只有删除连接 |
| 编辑连接 | 连接编辑器是 `database-workspace.tsx` 的本地 state / `connection-editor-flow.tsx`（WF2 归属），工作台上下文无入口 |
| 浏览对象 | 与「展开 / 折叠」重复 |
| 实例信息 / 用户与权限 / 进程列表 / 服务器仪表盘 | 引擎无对应 endpoint，属新能力 |
| 执行 SQL 文件 | 无「读取本地文件 + 执行」通道（导入走隐藏 `<input type=file>`，与执行器不连通） |
| 导出全部数据库 / 导出数据库 / 导出数据 / 导出表结构 / 导出数据字典 | 工作台上下文无导出入口（导出在结果面板，属其他工作流） |
| 选择显示数据库 / 可见对象过滤器 / Schema 过滤器 | 无「树可见性策略」持久化字段，属数据层缺口 |
| 复制连接 | 连接列表接口不返回 `password`，复制出的副本不可用（帮倒忙） |
| 在文件管理器中显示 | `engineRevealInFolder` 面向「文件路径」，连接没有文件系统路径 |
| 重命名 / 重命名数据库 | 方言不安全（MySQL 无 `RENAME DATABASE`，MSSQL 需 `sp_rename`），且 F2 行内重命名未实现 |
| 设为默认数据库 / 编辑数据库属性 / 编辑注释 | 无对应持久化字段与接口 |
| 历史查询（子菜单） | `history-panel.tsx` 属其他工作流，无跨模块调用通道 |
| 查看关系图 / 查看依赖关系 / 比较架构 / 比较数据 / 数据传输 | 引擎无对应能力 |
| 文档 / 在数据库中查找 | 无对应能力 |
| 导入数据 | 无「导入数据」通道（连接导入与数据导入是两回事） |
| 编辑表结构 / 生成模型 | 插件只有只读 DESCRIBE，无可写表设计器 / ORM 模型生成 |
| 克隆为新表 / 复制表 / 粘贴表 | 无表级 DDL 复制 / 剪贴板表结构落库通道 |
| SCHEMA 的 更多 ▸ | 其成员（清空所有表数据 / 删除所有表 / 删除数据库）均为跨表批量危险操作，无批量执行通道 |

**与设计稿的措辞差异（保留插件名，登记）**：设计「复制名称」子项为 名称 / 完整路径（已采用）；设计表的「编辑表结构」在插件里是只读「查看表结构」；设计「查看 DDL」在插件里是**用真实列结构生成**的 CREATE 模板（非服务端原始 DDL）；设计「生成 SQL ▸」的单个 `DDL` 在插件里拆成 CREATE / ALTER / DROP TABLE 三项（更精确）。

### E4 连接管理视图与连接列表

| # | 设计稿（`frames/connections.tsx`） | 改造前 | 处理 / 理由 |
| --- | --- | --- | --- |
| E4-1 | 行内副标题是显示名（`conn.driver`，如 `PostgreSQL 16.2`） | 原始 `db_type`（如 `postgres`） | 已改为 `findDbType(conn.db_type)?.label ?? conn.db_type`；版本号引擎未回报，只到显示名 |
| E4-2 | 空行状态点表达「连接状态」（`state` + `reason`） | 状态点表达「读写权限」（`read_only`），另有独立「已配置」列 | 保留：插件行内已有 只读/可写 列 + 权限过滤 chip，改变状态点语义会与过滤 UI 冲突；登记为语义偏差 |
| E4-3 | 行右侧 4–5 个动作 | 3 个（测试 / 编辑 / 删除） | 不加「复制」动作：会复制出无密码的坏副本（同 E3 理由）。`connection-manager-view.tsx` **未改动**：它只是整页壳（`h-9` 工作台状态头 + `<ConnectionEditorFlow />`），Sheet 正文（步骤条、搜索行、58px 行、`h-14` 页脚）全部由 `connection-editor-flow.tsx` 提供，属 WF2 归属；整页形态在设计稿里没有对应帧（设计稿是 920×660 Sheet）。删掉状态头会删功能，故保留并登记 |
| E4-4 | `h-14` 页脚 / 生产 chip / 测试结果行 / 「已配置」列 | 设计稿无 / 有 | 页脚在 WF2 文件内；生产 chip 与测试结果行是插件既有能力，保留登记 |

## 3. 验收与自检

- `npx tsc --noEmit`：**EXIT 0**（含本工作流 4 个改动文件）。
- 硬编码颜色：`git diff -U0` 的**新增行**中 `#hex` 命中 **0**。既有 `connection-node.tsx` 的两处 inline hex（选中勾选框 `#fff`、类型徽标 `#1e293b`/`#fff`）为**改造前既有代码**，本轮未触碰（已在 diff 外）。
- `font-display`：本工作流文件命中 0。
- 菜单接入自检：新标签（复制连接信息 / 创建数据库 / 删除连接 / 新建 Schema / 删除 Schema / 查看数据 / 新标签页查看 / 查看 DDL / 复制表结构为 / 复制名称）全部存在；旧标签（预览数据 / 发送到 AI 分析 / 在新标签页打开（不执行） / 复制连接名）在代码中残留 0（仅剩注释内 1 处描述双击行为的旧词已同步）。
- `git status --short` 中本工作流自有路径：`connection-tree.tsx`、`connection-tree-toolbar.tsx`、`connection-node.tsx`、`connection-list.tsx`；其余 ` M`/`??` 条目均属其他工作流（`connection-editor*`、`result-*`、`sql-editor*`、`split-layout.tsx`、`dbx-primitives.css` 等），未触碰。
- 说明：本轮早期曾误改 `shared/components/context-menu.tsx`，已手工回滚（未用 `git checkout`，避免覆盖并行改动）；`shared/styles/dbx-primitives.css` 的现有 diff 属根代理 S2/S3，未回退。

## 4. 依赖与阻塞（需根代理决策）

1. **菜单快捷键 keycaps 全部不可渲染（阻塞）**：`src/shared/components/context-menu.tsx`（禁改，S1）没有 `shortcut` / `checked` 支持 —— 全仓 grep 该文件内 `shortcut`、`checked` 命中 0。设计稿要的 ⌘C / ⌘E / ⇧⌘E / ⇧⌘D / ⌥ / F2 / F5 / ⌫ 因此都出不来。**未落地任何快捷键**，也未新建 `SHORTCUT_BY_ID` 之类的映射表（没有消费者即死代码）。请先落 S1（props 形态保持 `{ menu, onClose }` / `ContextMenuState` 不变），本工作流可立即补上。
2. **菜单宽度（阻塞在共享件）**：`context-menu.tsx` 固定 `width: CONTEXT_MENU_WIDTH = 208`、子菜单 `minWidth: SUBMENU_MIN_WIDTH = 172`；设计稿实际规则是 `min-w-[176px]` **按内容自适应**（`menu-tree.tsx` 里 236/248/276 是画面钉宽，不是组件规则）。当前超长标签（如「强制删除（CASCADE）」）会被 `truncate`。改动需在共享件上（本工作流禁改）。
3. **子菜单危险色（共享件限制）**：`ContextMenuSubmenu` 无 `danger` 属性，而 `contextMenus.ts` 的「更多」父行带 danger → 父行无法红色，只有子项可（现有行为）。
4. **设计稿枚举缺口**：「复制连接信息」子项未在设计稿枚举，本工作流按 DSN / 端点 / 库名三项实现（无 `database` 时不显示库名行）。若规格另有要求请回填。
5. `frames/index.tsx` 与 `frames/panels.tsx` 内容重复（同一 244 行文件的副本），本工作流未使用它们，左树规格以 `components/WorkbenchGhost.tsx` + `components/ConnectionTree.tsx` 为准。

## 5. 未验证项

1. 未做运行时几何实测（禁跑 `npm run build` / `npm test` / 起服务）：248/36px、24px 行高、`h-9`+`h-7` 均按帧类名与既有分栏代码静态对齐，未用 `getBoundingClientRect()` 复核。
2. 未在设计画布做视觉比对：`已选 N` 的条件显示、行右侧计数的视觉密度属于推断，未逐帧肉眼核对。
3. 「创建数据库 / 新建 Schema / 删除 Schema / 删除连接」只验证了类型与调用路径，未连真实引擎跑通（写确认、方言分支未实测）。
4. 「复制表结构为」（TSV / Markdown）依赖 `/describe` 返回的 `EngineColumn` 字段名（`type` / `nullable` / `defaultValue` / `isPrimaryKey`）在本轮已按类型确认，但未实测输出文本。
