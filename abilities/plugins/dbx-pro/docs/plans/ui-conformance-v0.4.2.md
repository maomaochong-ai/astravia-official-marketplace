# dbx-pro 界面回归设计稿 · 改造销项计划（目标 0.4.2）

> 事实源：`dbx-pro.astravia-design/`（19 帧 TSX + 21 个共享原语组件 + `theme.css` + `DESIGN.md`）。
> 本文逐项列出「设计稿 → 插件现状 → 处理」，作为本轮的验收清单。

## 1. 背景与事实基线

| 事实 | 值 |
| --- | --- |
| 设计稿帧最后修改 | 2026-10-10 05:24–05:42 |
| 0.4.0「按设计稿重构」提交 | `af57fb25` 2026-10-10 20:03 |
| 其后追加功能提交 | `d8d0423a` 23:19（API 数据源 + BI 数据资产 + 图表），并重写了 `dbx-primitives.css`(22:48)、`connection-editor.css`(22:46)、`result-grid.css`(22:12)、`dbx-layout.css`(22:12) |
| 已发布版本 | `0.4.1`（gh-pages `marketplaceVersion 2026.10.10-3`，`a7720ad1`） |
| 设计稿二次修订（本轮进行中） | 2026-10-11 02:52:05 —— `design.json`、`frames/bi-assets.tsx`、`frames/assets.tsx`、`components/WorkbenchTopBar.tsx`、`components/TabBar.tsx`；`frames/index.tsx` 02:46；`frames/interactions.tsx` 02:33。**工作台主帧自本轮起才存在**，见 §1.1 |
| 设计稿首版 | 2026-10-09 23:56 – 10-10 05:42（`theme.css`、多数 `components/*.tsx` 仍是此版本） |
| 本次目标版本 | **`0.4.2`** —— 0.4.1 已发布且不可覆盖；本轮运行内容变化，必须提升能力版本 |

结论：0.4.0 重构之后，设计包在**本轮执行期间**又被继续编辑（新增工作台主帧、BI 帧、交互微态帧，并改写了顶栏与标签条组件），因此「设计稿早于重构完成、是静止的最终目标」这一前提**不成立**：取规格必须按文件 mtime 取最新者，凡与最新帧冲突的旧判据一律作废（见 §1.1 与 §7 D-4）。

### 1.1 勘误（已修正）：设计稿在本轮进行中被二次修订，工作台已有主帧

设计包在**本轮执行期间**被继续编辑：`frames/` 与 `components/` 的 mtime 从 2026-10-10 05:42 推进到 **2026-10-11 02:52**。因此此前写下的「设计稿没有工作台主帧」**已失效**，后续所有工作台相关取规格按这一条：

1. `frames/index.tsx`（259 行，标题「查询工作台」，02:46:33）**是工作台主帧**：含左连接树、中栏标签条 + 编辑器 + 结果区（工具栏 24px 图标 / 过滤行 / 分页栏）、右查询历史栏（`:214-247`）、以及表右键菜单与子菜单的钉位。它**不再是** `frames/panels.tsx`（244 行，标题「弹出面板规格 · 导入 / 导出 / 每页 / 取 Schema / 单元格」，01:18）的副本，两者已分离。
2. 顶栏与标签条的组件级规范在 **02:52:03** 再次更新：`components/WorkbenchTopBar.tsx`（导航项带 `size-3.5` 图标、导出按钮常驻 + 计数徽标、「BI」命名）与 `components/TabBar.tsx`（固定 `w-[170px]` 标签 + `+` 新建）。**组件 mtime 晚于页面帧时以组件为准。**
3. 新增帧：`frames/interactions.tsx`（02:33，交互微态：历史筛选分段 + BI 标签展开）、`frames/assets.tsx` / `frames/bi-assets.tsx`（02:52，BI）。其中两条只存在于微态帧的形态已判定不落地，见 §7 D-13 / D-14。

3. `components/Sql.tsx`（SQL 语法着色块）**只被 `frames/history.tsx` 使用**，编辑器工具栏在设计稿里没有对应帧。

## 2. 关键结论：配色已对齐，偏差在布局与功能

`src/style.css` 里的 `--dbx-*` 令牌**取值逐字取自 `theme.css`**（浅色 + 深色 + `data-dbx-theme` 三级兜底），并额外把宿主核心变量重映射进插件作用域。**因此不存在"配色不对"的问题，本轮不新增色值**。

⚠️ **易错陷阱（务必先读）**：插件 CSS 变量名与设计稿 Tailwind token 名**错位一级**，凭名字判断会得出完全相反的结论：

| 设计稿 Tailwind 类 | 设计稿 token | 设计稿取值（深色） | 插件 CSS 变量 | 插件 Tailwind 类 |
| --- | --- | --- | --- | --- |
| `bg-background` | `--color-background` | `#010409` | `--dbx-canvas` | `bg-canvas` |
| `bg-surface` | `--color-surface` | `#0d1117` | **`--dbx-panel`** | `bg-surface` / `bg-background`(重映射) |
| `bg-surface-raised` | `--color-surface-raised` | `#161b22` | **`--dbx-surface`** | `bg-surface-raised` |
| `bg-surface-sunken` | `--color-surface-sunken` | `#161b22` | `--dbx-panel-sunken` | `bg-surface-sunken` |
| `text-muted` | `--color-muted` | `#8b949e` | `--dbx-muted` | `text-muted` / `text-muted-foreground` |
| `text-faint` | `--color-faint` | `#6e7681` | `--dbx-faint` | `text-faint` |
| `border-border` | `--color-border` | `#30363d` | `--dbx-border` | `border-border` |
| `--color-primary` | `#238636` | `--dbx-primary` | `bg-primary` |
| `--color-accent` | `#58a6ff` | `--dbx-accent` | `text-accent` |
| `--color-ai` | `#a371f7` | `--dbx-ai` | `text-ai` |

已逐条核对：`.dbx-menu{background:var(--dbx-surface)}` = 设计稿 `bg-surface-raised` ✅；`.dbx-tab[data-active]{background:var(--dbx-panel)}` = `bg-surface` ✅；`--dbx-radius-chip/control/card` 均为 6px，与设计稿 `rounded-chip/control` ✅；`.dbx-nav-item.is-active{background:var(--dbx-panel);font-weight:600}` = 设计稿 `bg-surface font-semibold` ✅（**本轮修正**：原文取 `--dbx-surface`，那等于设计稿的 `bg-surface-raised`，比设计底亮一档；顶栏本身是 `bg-surface-raised`，选中项必须更深一档才看得出选中）；`.dbx-count-badge{background:var(--dbx-neutral-muted);font-family:var(--dbx-font-mono)}` = 设计稿徽标 ✅。**这些不是偏差**。

另有一条 Cascade 规则决定改法：**插件 feature CSS 未分层（unlayered），优先级高于 Tailwind 的 `@layer(utilities)`**。因此凡是要覆盖 Tailwind 原子类的设计稿细节，只能新增插件 CSS 类，不能靠再叠一个原子类。

## 3. 逐面销项清单

图例：`[ ]` 待改 / `[~]` 部分符合 / `[x]` 已符合

### 3.1 共享原语（根代理先落地，子任务只使用不改）

- [ ] **S1 `ContextMenu` 的 `shortcut` 键帽与 `checked` 勾选：未实现（有意）**
  `src/shared/components/context-menu.tsx` 目前只有 `icon` / `disabled` / `danger`。设计稿 `components/ContextMenu.tsx` 声明了 `shortcut?: string[]`（键帽组 `ml-auto flex shrink-0 items-center gap-1 pl-6`，单键 `min-w-4 rounded border border-border bg-background px-1 py-0.5 text-center font-mono text-[10px] leading-none text-muted`）与 `checked`（图标槽换 `icon-[lucide--check] size-4 text-accent`）。**不实现的原因**：插件没有任何树菜单加速键层（全仓只有 `sql-editor.tsx` 的 ⌘/Ctrl+Enter 一处真实快捷键），渲染 ⌘C / F5 / ⌫ / ⇧⌘E / ⇧⌘D / ⌥ / F2 会变成「按了没反应」的虚假提示；`checked` 在设计稿 `components/contextMenus.ts` 里出现 0 次，没有真实消费者。将来补加速键时按上面的规格补 S1 即可（公开 API 不变）。见 §7 偏差 D-12。
- [x] **S2 `.dbx-scroll` 滚动条规格**
  `src/shared/styles/dbx-primitives.css`。设计稿 `frames/scrollbars.tsx`：轨道 10px · 4px 圆角 · `bg-background`；滑块 6px · 3px 圆角 · 最短 24px；静止 `bg-neutral-muted` / 悬停 `bg-border-strong` / 拖拽 `bg-accent/70`。已按此实现。
- [x] **S3 补齐 `.dbx-btn` 的 `xs` / `md` 尺寸**（设计稿 `components/Btn.tsx`：`xs h-6 px-2 text-[12px]` / `md h-8 px-3 text-[14px]`；图标 `size-3` / `size-4`）。已补齐，现有 `.dbx-btn` 等价 `sm`，取值一致。
- [x] **S4 主菜单宽度按内容自适应**
  设计稿 `components/ContextMenu.tsx` 是 `flex min-w-[176px]`（按内容撑开，帧里出现的 236/248/276 是画面钉宽，不是组件规则）。插件原先在 `style.width` 写死 `CONTEXT_MENU_WIDTH = 208`，超长标签（如「强制删除（CASCADE）」）被 `truncate` 截断。已改为不写 `width`（绝对定位下 width:auto 即 shrink-to-fit），`min-width` 由 `.dbx-menu` 的 176px 兜底，越界时仍由 `placeContextMenu` 按实测宽度限宽；`SUBMENU_MIN_WIDTH` 172 → 176 与 CSS 对齐，`CONTEXT_MENU_WIDTH` 常量随之删除。`src/test/context-menu.test.js` 的布局模型同步回落到 CSS `min-width`，宽度相关的越界断言不再退化成恒真。

### 3.2 A · 结果面板 / 结果工具栏 / 分页（根代理）

帧：`frames/results.tsx`（+ 通用 `components/ResultGrid.tsx`、`components/PaneHeader.tsx`）

- [x] **A1 结果面板头** `result-panel.tsx`
  设计稿 `PaneHeader` 形态 —— `h-9 bg-surface-raised border-b px-3`，标题 `text-[14px] font-semibold tracking-tight`，meta `font-mono text-[12px] tabular-nums text-muted`（表名 `public.orders`），右侧 `ml-auto flex items-center gap-0.5`：`只读连接` chip、AI 分析按钮 + 方向随开合的 chevron、**`收起结果面板`（`panel-bottom-close`）**。已实现；meta 取 SQL 解析出的表名，连接名保留在 `title` 提示里。
- [x] **A2 AI 下拉结构** `result-panel.tsx`
  设计稿 `frames/results.tsx`：`w-64 rounded-card border border-border bg-popover p-1.5 shadow-popover`；每项 = `icon size-4 text-ai` + 14px semibold 标题 + 12px muted 说明；底部一条 12px muted 说明（说明发送内容与范围）。已按此重写（通用分析 / 生成看板 / 生成大屏 + 尾部说明）。
- [x] **A3 结果工具栏** `result-toolbar.tsx`（帧：`h-8 border-b px-2 gap-1`，纯 24px 图标）
  ① 图标按设计稿改名：`clipboard-list`→`copy`、`upload`→`download`、`list-ordered`→`hash` ✅；
  ② `hash` / `columns-3` / `arrow-up-down` / `table-properties` **常显**（无排序、无表时 `disabled`，不隐藏）✅；
  ③ 右侧补 meta `{行数} 行 · {耗时} ms`（12px `tabular-nums text-muted`，`·` 用 `text-faint`）✅；未提交单元格编辑的追加项**不实现**（见 §7 偏差 D-1）。
- [x] **A4 过滤行常显** `result-toolbar.tsx`
  设计稿：常驻一行，`WHERE` / `ORDER BY` 为 mono 标签（12px `tracking-[0.04em] text-muted`）+ `h-6` 输入壳 + `应用` 按钮。已实现，且 `.dbx-result-toolbar` 去掉自身下边框，改由两条行容器各带一条发丝线 ⇒ 合计正好 2 条。
- [x] **A5 分页栏重排** `result-grid.tsx` + `styles/result-grid.css`
  设计稿：`h-9 border-t px-3 gap-2`。左：`1–100 / 1,284`（mono `tabular-nums`）+ `后端分页` chip；右：`每页` 标签 + `h-6 w-14` 数值框 + `chevron-left` + `1 / 13` + `chevron-right` + `加载全部`（文字按钮）。已重建：旧栏里的 `已取回 N 行` / `共 N 行` / 刷新总数 / 计时**迁移**到 A3 的工具栏 meta，导出按钮去重（保留工具栏那一个），SQL 预览保留在中部可变区。`.dbx-pagination` 既有样式（`border-top: 1px solid var(--dbx-border); background: var(--dbx-panel)`）已符合，无需改动。
- [x] **A6 上下同步滚动条** `grid-hscroll.tsx`（新增）/ `result-grid.tsx` / `result-table.tsx`
  设计稿 `frames/scrollbars.tsx`：数据网格**顶部与底部各一条横向滚动条，双向同步**；规格同 S2；拖拽时显示可见列区间标签（`列 8–21`）。已实现：新增纯 Tailwind 组件 `GridHScroll`（顶部轨道 + 拖动/点击翻页/⇧滚轮横滚 + 拖拽期区间标签），与底部原生条共用同一 `scrollLeft`；结果表格滚动容器改用 `.dbx-scroll`。**保留原生底条**（Firefox 的 `scrollbar-width: none` 会连竖条一起干掉，`overflow-x: hidden` 会破坏滚轮/触控板行为且本轮无法用浏览器实测），因此顶条是「增强」而非「替换」。位置偏差见 §7 偏差 D-2。

### 3.3 B · SQL 编辑器工具栏（根代理）

规格来源：`components/Btn.tsx` / `components/IconButton.tsx` 的共同语言（设计稿**无编辑器帧**）

- [x] **B1** 复核：`sql-editor.tsx` 工具栏 `h-8 border-b px-2`，已含 `执行`（`.dbx-btn primary` + `⌘↵` 键帽）、`panel-top-open`（在新结果标签页执行）、`list-tree`（执行计划）、分隔线、`wand-sparkles`（格式化 SQL）、`wrap-text`（开启时 `dbx-icon-btn--active`）、`chevrons-up-down` 折叠全部、`chevrons-down-up` 展开全部；右侧 `ml-auto`：选区 chip、连接名、`eraser` 清空、`save` 保存到文件。本轮把「停止」态的行内硬编码 `rgb(220 38 38)` 换成令牌化 `.dbx-btn.danger`（硬编码色值违反"颜色只走令牌"）。
  **未实现**：`行 13, 列 12` 光标位置（见 §7 偏差 D-3）。

### 3.4 C · 历史栏（根代理）

规格来源：`components/PaneHeader.tsx` + `components/HistoryCard.tsx` + `components/history.ts`；页面级参照 `frames/history.tsx`

- [x] **C1** 容器：右栏 `w-[300px] bg-surface-raised`（`split-layout.tsx` 的 `DESIGN_RIGHT = 300`，与 `WorkbenchGhost.tsx` 一致 ✅）；`PaneHeader` 头 `h-9 border-b px-3`（`查询历史` + mono 计数）+ `trash-2`(danger) 清空。~~**`收起历史` / `panel-right-close` / `search` 输入框不实现**（见 §7 偏差 D-4）~~ —— **该判据已被 02:46 的工作台主帧推翻**：`frames/index.tsx:216-226` 明确画出 `search` / `trash-2`(danger) / `panel-right-close` 三个头部动作，本轮按帧补齐（搜索真实过滤、收起真实折叠右栏），见 §7 D-4。
- [x] **C2** 过滤行：`h-8 border-b px-2.5`，`全部` / `成功 N` / `失败 N` chips（`h-6 rounded-chip`，命中 `bg-neutral-muted`，计数 `text-faint`）+ 右侧 `上限 {limit}`（12px `text-faint`，到上限时改 `text-warning` 的「已到上限」）。分段切换动画未加（见 §7 偏差 D-5）。
- [x] **C3** 列表：`px-2.5 pb-2 space-y-1.5` + `今天` / `昨天` / `更早` 分组标题 + `HistoryCard` 形态（`.dbx-history-card` = `rounded-card` + 1px `border` + `bg-surface`，抬升面靠色调差与发丝线，不靠阴影悬空 ✅）。本轮把「载入编辑器」的动作图标改成设计稿的 `square-pen`（原为 `corner-down-left`）。卡片操作行**常显**，与设计稿「仅最新一条常显、其余悬停出现」不同（见 §7 偏差 D-6）。

### 3.5 D · 顶栏（根代理）

规格来源：`components/WorkbenchTopBar.tsx`

- [x] **D1** 复核分组、分隔线、图标尺寸与 24px 机制：`header` = `flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-raised px-2` ✅；左组 `新建连接`（`.dbx-btn` + `plus`）/ `新建查询`（`.dbx-btn ghost` + `square-pen`）/ `AI 协助`（`.dbx-btn ai` + `sparkles`）✅；分隔线 `mx-2 h-4 w-px bg-border` ✅；状态点 `size-1.5 rounded-full` + 12px 文字 ✅；右组 `.dbx-count-badge` 徽标 + 分隔线 + `dbx-nav-item`（`h-6 rounded-control px-2 text-[12px]`，命中 `is-active`）+ `maximize-2/minimize-2` 全屏 ✅。本轮补上设计稿的**连接计数**（`引擎就绪 · N 个连接`）。
  **刻意少一项**：设计稿有 4 个导航项（工作台 / 查询历史 / BI 数据资产 / 设置），插件只放 3 个——「工作台」就是当前界面本身，放一个指向自身的按钮没有目标。已在源码注释中说明。
  02:52 的组件规范又给导航项加了 `size-3.5` 图标与 `hover:bg-neutral-muted` 悬停底色，插件需同步（图标槽 + 悬停态）；「工作台」项仍按 D-8 省略。

### 3.6 E · 连接树 / 右键菜单 / 连接管理（工作流 1）

帧：`connections`、`menu-tree`、`menu-actions`（根骨架参照 `components/WorkbenchGhost.tsx`）

- [x] **E1** `connection-tree.tsx` / `connection-tree-toolbar.tsx`：工具条按设计稿改为两行（`h-9` 头 + `h-7` 工具行；`components/ConnectionTree.tsx` 实测为 `h-9`/`h-7`，本计划书原写的 `h-8` 是误记），搜索框下沉到第 2 行不再单占一行，多选图标改 `square-check-big`，行选中色对齐 `bg-accent-soft`；容器宽 248 / 折叠态 36 由 `split-layout.tsx` 提供。行内图标与 chevron 是 `size-3`（12px，设计稿实测），16px 是菜单行图标。
- [x] **E2** `connection-node.tsx`：标签字号按节点种类分流（`text-[14px]` / `font-mono text-[12px]`）、行右侧补组计数（`text-faint tabular-nums`）、loading 收进 meta 槽。表行 trailing `Chip`（如「4 列」）未做（需额外 `/describe` 往返，见 W1 报告 §2 E2-5）。
- [~] **E3** 右键菜单已按 `components/contextMenus.ts` 逐项接线：连接菜单 8 项、库（schema）菜单 11 项、表菜单 18 项；**只让能真正接线的出条目**，设计稿中引擎无对应 API 的 20+ 项（断开连接 / 实例信息 / 用户权限 / 进程列表 / 各类导出 / 重命名 / 比较架构 / 导入数据 等）逐条登记在 W1 报告 §2 E3，不出 disabled 假按钮。**快捷键键帽全部未落地**（原因见 §3.1 S1 与 §7 D-12）。
- [~] **E4** `connection-list.tsx` 行内副标题由内部 `db_type` 改为显示名；`connection-manager-view.tsx` 未改——整页形态在设计稿里没有对应帧（设计稿是 920×660 Sheet），其 Sheet 正文属 F 工作流；行右侧动作保持 3 个，不加「复制」（连接列表不返回密码，会复制出坏副本）。

工作流 1 的完整偏差表（E1-1…E4-4）、省略项清单与未验证项见 `docs/plans/reports/w1-connection-tree.md`；其中「菜单宽度固定 208」已在 §3.1 S4 修复。

### 3.7 F · 表单 / 设置 / 下载 / 面板（工作流 2）

帧：`connection-config`、`new-connection`、`dialogs`、`settings`、`downloads`、`panels`

- [~] **F1** 连接配置 Sheet：字段系统（基础 / 高级 / 其他 三区、两列网格、32px 控件、SSL 开关、默认 Schema chips、超时、备注）与 `保存并连接` 页脚已落地；设计稿的「默认查询上限 1000 行」未实现（`WorkbenchSettings` 无对应字段，见 W2-2）。
- [x] **F2** 弹窗壳：520 宽 `dbx-dialog`、标题条 44 / 底部件 56 / 控件 32、`rounded-sheet`；连接测试三态沿用既有实现；两个 backdrop 上的 `blur(2px)` 已按设计稿去掉（scrim 76% 无模糊，见 W2-4）。
- [~] **F3** 设置 Sheet：搜索框 224×28、左 nav 176、44px 行、分段控件、48px 页脚（`恢复默认设置` 从头部迁入）；网格密度 / NULL 显示 / 复制含表头等 9 项属 `WorkbenchSettings` 数据层缺口，未实现（见 W2-6）。
- [~] **F4** 下载后台：第四轮已按设计稿改为**底部通栏货架**（`export-tasks-shelf.tsx`，6 列 `1fr/200/150/110/140/132`，顶栏只留入口），「大小」列由真实字节字段支撑（W2-7 / W2-8 已订正）；剩余偏差为运行中总字节未知、时间列显示「已用」而非「剩余」、「暂停」无后端（见 §7 D-18…D-22 与 §10）。
- [~] **F5** 弹出面板壳 `dbx-popover` 已建；设计稿的六处场景中本轮只落了导出面板，越界只做左 / 上夹取（未做翻向，见 W2-10 / W2-11）。

工作流 2 的完整偏差表（W2-1…W2-15）与未验证项见 `docs/plans/reports/w2-forms-panels.md`。

### 3.8 G · BI 数据资产 / 看板 / 大屏 / 可视化筛选（工作流 3）

帧：`bi-assets`、`assets`、`viz-screen`、`viz-filters`

- [~] **G1** `bi-assets`：可落地部分已实现 —— 图库由「列表 + 抽屉」重写为帧的三栏工作台（header `h-14 px-8`、左 rail `w-[272px]`、中心 `grid-cols-3 gap-3 p-4`、右内联详情列 `w-[392px]`、`Thumb h-[104px]`）；未落地 8 条（左 aside 数据集行 / Toast / `mini` 缩略图变体 / 「新建看板」/ 浮层抽屉 / `bg-surface-sunken` 映射）见 `docs/plans/reports/w3-bi-viz.md` §2 G1-1…G1-8。
- [~] **G2** `assets` 看板：导出页外壳、卡片壳与 KPI 度量已按帧对齐（`.header` 56px 左对齐、`.chart-card` 12px 内边距 + 13px 标题带下边线、KPI 20px/600）；查询控制行、tile 网格行高、footer 未落地 —— 导出 HTML 的 DOM 由范围外 `src/tools/dbx-chart-collection.ts` 生成，见 W3 §2 G2-1…G2-3。
- [~] **G3** `viz-screen` 大屏：按「导出页 CSS + figure 字号」落地（大屏 KPI 34px、`screen.css` 同源深色外壳）；**插件不渲染独立大屏页面**，环图 126/16 与孔色未改，见 W3 §2 G3-1…G3-3。
- [~] **G4** `viz-filters` 筛选：控件度量（`h-8` / 12px / 命中态 accent 15% + accent 字）与去卡片化已落地；联动防抖、popover 向上翻转等属行为层，见 W3 §2 G4 段。

## 4. 分工与并行

三级并行，互不重叠文件：

| 工作单元 | 负责范围 |
| --- | --- |
| 根代理 | 共享原语（`context-menu.tsx`、`dbx-primitives.css`、`style.css`、`dbx-layout.css`）+ §3.2–3.5（结果面板/工具栏/分页/网格滚动条/SQL 工具栏/历史栏/顶栏） |
| 工作流 1 | §3.6 连接树、连接节点、右键菜单内容、连接管理视图 |
| 工作流 2 | §3.7 连接表单、弹窗、设置、下载后台、弹出面板 |
| 工作流 3 | §3.8 BI 资产、看板、大屏、可视化筛选 |

约束：子任务只使用已有原子类 + 自己的 feature CSS；不修改共享原语；`npm run build` 由根代理在收口时独占执行（并行 `vite build` 会争抢 `dist/`）。

## 5. 验证方式

1. `npm run check`（`tsc --noEmit`）—— 并行安全。
2. `npm test`（`node --test src/test/*.test.js server/test/*.test.mjs`）。
3. `npm run build`（根代理独占）。
4. **无头几何探针（本轮未执行）**：原本计划用 `harness/` + `agent-browser` 在 1440×900 下读 `getBoundingClientRect()` / `getComputedStyle()` 与设计稿帧做数值比对。本轮没有执行，原因见下：
   - `harness/` 目前只有「API 接入」那条链路的脚本（`api-data-access-e2e.mjs` / `api-data-access-shell-e2e.mjs`），没有能直接开页面的 `index.html`，做几何量测需要新建一套夹具。
   - 夹具里的工作台走真实引擎 HTTP（`vite.harness.config.ts` 代理到 `127.0.0.1:8899`）。没有引擎进程时结果区是空态/错误态，量出来的网格行高、分页栏数值没有意义。
   - 设计画布未打开，且本会话没有看图能力，无法做截图比对。
   ⇒ 本轮实际验收改为：JSdom 回归用例（`npm test`，包含 `result-grid` / `result-toolbar` / `context-menu` / `settings-panel` / `visualization-*` 等 40 个前端用例文件）+ `tsc` + 生产构建 + 仓库级校验 + 逐元素源码比对（帧 DOM、`theme.css` 令牌、尺寸/间距数值）。
   ⇒ 未做“渲染后实测几何”这一点，作为本轮残余风险登记在 §7 D-11。
5. 仓库级：`node scripts/marketplace.mjs check` 与 `node --test tests/*.test.mjs`。

> 环境注记：本机 Node 是 arm64 机器上的 x64（Rosetta），而 `node_modules` 里装的是 `@esbuild/darwin-arm64`，
> 会导致所有走 `src/test/support/tsx-loader.mjs` 的用例整文件报平台不匹配。
> 用 `npm i --no-save @esbuild/darwin-x64@0.28.2` 补齐（不改 `package.json` / 锁文件）后全量可跑。

## 6. 明确取舍

- **保留功能，不删功能**：分页栏里设计稿没有的辅助信息（SQL 预览、总数状态、上限提示）**迁移**到设计稿已有的信息位（工具栏右侧 meta、分页栏中部可变区），而不是删除。
- **`.dbx-icon-btn` 保持 24px**：设计稿 `components/IconButton.tsx` 默认 28px，但结果工具栏明确注明"只放 24px 纯图标按钮"，且用户要求图标对齐。以帧与注记为准。
- **`.dbx-tab` 右内边距 6px**（设计稿 `px-3`）：为常驻关闭按钮预留，视觉差异极小，保留。

## 7. 偏差登记（本轮收口时逐条确认）

| 编号 | 偏差 | 处理 / 理由 |
| --- | --- | --- |
| D-1 | 设计稿 `frames/results.tsx` 的行内编辑态（`撤销更改` / `提交 N 处更改` / `双击单元格编辑 · Esc 取消 · Enter 提交`）未实现 | 插件的结果网格是只读展示，没有写回通道；本轮只实现可见的 `只读连接` chip。**刻意不做**，不是遗漏。 |
| D-2 | 顶部横向滚动条位于**冻结表头之上**，设计稿注记写的是"表头下沿" | 设计稿 DOM 把 `<Track/>` 放在 `<thead>` **之前**；表头是同一滚动容器内的 sticky 元素，两者之间不存在可用间隙。以 DOM 为准，注记作废。 |
| D-3 | 编辑器工具栏没有 `行 13, 列 12` 光标位置 | CodeMirror 的光标行列没有暴露给工具栏；设计稿也没有编辑器帧，此条来自早前误读。若要做需新增 selection 监听。 |
| D-4 | ~~历史栏没有 `search` 输入框、没有 `收起历史`(`panel-right-close`) 按钮~~ —— **判据已被推翻**：`frames/index.tsx:216-226`（02:46 工作台主帧）明确画出 `search` / `trash-2`(danger) / `panel-right-close` 三个头部动作，`:227-236` 明确画出 `h-8` 过滤行（`全部` chip + `成功 N` / `失败 N` 纯文本 + 右侧 `上限 N`） | 旧判据来自「设计稿没有工作台主帧」的误读（§1.1）。**本轮必做**：搜索要真实过滤历史、收起要真实折叠右栏（与顶栏「查询历史」同一开关），不得留死按钮。 |
| D-5 | 过滤 chips 没有 200ms 位移切换动画（`frames/interactions.tsx` 的微态：track 232 + thumb 72·76 位移 + `cubic-bezier(0.4, 0, 0.2, 1)`） | 02:46 的工作台主帧用的是 **chip 形态**（无滑块轨道），chip 没有可供位移的 thumb，选中态按 `bg-neutral-muted` 立即切；300ms 以内的微态不改变可读性。**已知并接受**；若后续按微态帧改造为滑块分段，规格记在 D-14。 |
| D-6 | 历史卡操作行常显，设计稿是「仅最新一条常显，其余悬停出现」 | 悬停才出现的操作对触控与键盘不友好；常显不破坏视觉层级（分隔线 + 24px 图标）。**保留插件做法**。 |
| D-7 | 设计稿用 `font-display`（Space Grotesk），插件把 `--dbx-font-display` 别名到 sans | 插件不能自带打包字体（宿主只提供系统字栈）。KPI 等大数字改用 `font-sans` 表现，**已知并接受**。 |
| D-8 | 顶栏少一个「工作台」导航项 | 工作台就是当前界面，指向自身的按钮没有目标。已在源码注释说明。 |
| D-9 | 结果网格表头是单行（列名），设计稿是列名 + 类型两行 | 结果契约（`DbQueryResult`）不携带列类型，属数据层缺口；需要先在引擎/协议层补类型元数据。 |
| D-10 | 底栏不再出现「已取回 N 行」「共 N 行」字样，改为设计稿的区间记法 `1–1,000 / 4,321`（总数未知写 `?`） | 设计稿 `frames/results.tsx` 分页栏只有 `1–100 / 1,284`，没有这两组措辞；区间记法同时表达「本页取回」与「总行数」两件事，`?` 阻止拿取回行数冒充总数。原先的措辞属插件自加，`rowCount` / `rowCountKnown` 的语义化 `title` 仍保留在结果工具栏。`src/test/result-grid.test.js` 已同步到新契约。 |
| D-11 | 没有做「渲染后实测几何」与截图比对 | 设计画布未打开、本会话无看图能力，且 `harness/` 没有可直接开页面的夹具（见 §5.4）。当前一致性靠源码级逐元素比对 + JSdom 回归用例 + 生产构建保证，属残余风险。后续补探针时应先补夹具页与本地引擎。 |
| D-12 | 树右键菜单没有设计稿的快捷键键帽（⌘C / F5 / ⌫ / ⇧⌘E / ⇧⌘D / ⌥ / F2），`checked` 勾选也没实现 | 插件没有树菜单加速键层（全仓只有 SQL 编辑器 ⌘/Ctrl+Enter 一处真实快捷键），画出键帽等于承诺「按了有反应」，属虚假提示；`components/contextMenus.ts` 里 `checked` 出现 0 次。规格已记在 §3.1 S1，将来补加速键时一并补上。 |
| D-13 | `frames/interactions.tsx`（02:33）的 **BI 标签展开态**未实现：宽度 132 → 236 → 352、展开后升格为标题行 + 指标行（`28 指标 · 6 图`、走势图、`＋12.4% 环比上周`、`已固定` chip）、「点正文回到看板、chevron 收起」「固定后不被『收起全部』回收、未固定标签在切换查询后自动收窄」 | 最新的组件规范 `components/TabBar.tsx`（**02:52:03**，晚于该微态帧）没有展开态，标签条就是固定 `w-[170px]` 的简单形态。展开态还依赖「BI 标签 ↔ 产物」绑定与固定/回收语义，属**新功能**而非界面回归，本轮不做。**需用户决策**是否在后续版本立项；规格已完整记在本行。 |
| D-14 | `frames/interactions.tsx`（02:33）的筛选「滑块分段」未实现：track 232 / thumb 72·76 位移、`200ms cubic-bezier(0.4, 0, 0.2, 1)`、位移中旧标签淡出、选中项计数转 `accent`、键盘 ←/→ 切换 | 02:46 的页面帧 `frames/index.tsx:227-236` 用的是 **chip 形态**（`全部` chip + `成功/失败` 纯文本），比微态帧新，故以 chip 为准，滑块分段不落地。若后续按微态帧改造，规格已记在本行。 |
| D-15 | 设置 / 新建连接两处左导航条目的纵向间距取 **4px**（设计稿 `frames/settings.tsx:69-94` 与 `frames/new-connection.tsx:190-219` 的容器都是 `gap` 为 0 的静态 mock） | 0 间隙在真实可滚动列表里会让条目粘连，悬停底色与键盘焦点环也会互相贴合；4px 是在保留设计稿 `h-7`/`h-8` 条目高与 6px 圆角前提下最小可辨识的间隙。两处 nav 同时改（`.dbx-settings-nav`、`.dbx-conn-nav`），不新增类。 |
| D-16 | 连接树**收起态**的「连接」/「表」两个图标**删除**（设计稿 `components/ConnectionTree.tsx` 有这两项） | 设计稿里它们是没有 handler 的 `IconButton`，而插件没有可切换的「连接」面板、也没有独立「表」面板，画出来就是死按钮。按「不留死按钮」原则删除。⚠️ W6 报告把本条误记为 `D-13`（`D-13` 实为 BI 标签展开态），编号以本表为准，报告引用已订正为 `D-16`。 |
| D-17 | 新增的 `src/features/database-workspace/services/db-type-badge.ts`（字母徽标）**删除** | 全仓零调用方（`dbx-conn-typechip__badge` / `dbx-db-type-card__badge` 两处都渲染 `DatabaseTypeIcon`，设计稿里也没有字母徽标），属本轮引入的死代码。W6 曾把它记为「备用工具函数保留」，按仓库「不为假设需求预留」的惯例（参 ADR-0009 移除逐条 `schemaVersion`）改为删除；`tsc` 未开 `noUnusedLocals`，死导出不会被类型检查拦住，只能靠代码审查。 |
| D-18 | F4 运行中任务的「大小」显示 `42.1 / 61.8 MB`（已写出 / 总量） | 运行中只显示已写出字节；xlsx 运行中显示「—」 | `bytesTotal` 要等组包完成才知道（`result-grid.tsx` 在序列化结束后写）；xlsx 是一次性组包，没有增量字节通道。写 `0` 会被误读成「0 B」，故 xlsx 不写该字段、显示「—」 |
| D-19 | F4「时间」列运行中显示 `剩 2 秒`，已完成显示 `4.2 秒` | 运行中 `已用 12 秒`，结束态 `12 秒` | 没有速率模型就推不出剩余时间，编一个假倒计时属虚假提示；`formatElapsed` 只到整秒 |
| D-20 | F4 顶栏入口是 `Btn size="sm" ghost` + 中性计数胶囊（`components/WorkbenchTopBar.tsx`） | 沿用插件既有 `.dbx-nav-item` + `.dbx-count-badge` + 进度环（角标在「只剩等待保存 / 未保存」时转琥珀） | 进度环是用户此前报的缺陷修复（§8 第 1 项），且插件顶栏右组的既有语言是 `dbx-nav-item`；本轮只把面板拆成入口，不改入口形态 |
| D-21 | F4 运行中行有 `暂停` 按钮 | 未实现 | `export-tasks-store` 只有取消语义（`requestCancelExportTask`），没有暂停 / 续跑通道；画出按钮就是死按钮。取消（x）保留 |
| D-22 | F4 页脚写「导出文件保存在 `~/Downloads/dbx-pro` · 完成后最多保留 20 条记录」 | 「导出内容由系统保存对话框落盘 · 未保存的导出最多保留 3 份」 | 插件没有固定下载目录（走宿主系统保存对话框），也没有 20 条记录上限；页脚必须写真实行为。3 来自 `MAX_UNSAVED_EXPORTS` |
> 另有 2 项属**数据层缺口**而非界面取舍，因此在 §3 以 `[~]` 内联标注并指向工作流报告，不重复进本表：F1「默认查询上限 1000 行」（`WorkbenchSettings` 无对应字段）、F3 设置面板 9 项（同上）。原第 3 项 F4 导出任务「大小」列已由第四轮补齐（`ExportTask` 增加 `bytesExported` / `bytesTotal`，见 §10）。

## 8. 第三轮：用户 20 项清单销项（本轮执行）

> 本节的 20 项来自用户逐条反馈（含一张「查询历史栏」截图）。**全部改动只落在 `abilities/plugins/dbx-pro/**` 内，未改任何宿主代码**（清单第 5 条）。落点写的是本项真正改动/查看的文件。

| # | 项 | 结论 | 落点 |
| --- | --- | --- | --- |
| 1 | 顶栏「后台导出」按钮必须常驻且与设计稿一致 | [x] 不再依赖「有任务」才渲染，空态也能打开（面板内给空态文案）；运行中给计数徽标 | `workbench-top-bar.tsx`、`export-tasks-popover.tsx` |
| 2 | 结果网格顶栏图标对齐 | [x] 工具栏行 `height:32px` + `padding:0 8px` + `gap:4px`，24px 图标按钮垂直居中 | `styles/result-grid.css` |
| 3 | 删掉结果工具栏里重复的导出按钮 | [x] 导出只保留工具栏那一个 | `result-toolbar.tsx` |
| 4 | SQL 编辑器执行 DDL 失败 | [x] 根因是**客户端丢字段**：引擎 `/query` 对 DDL/DML 返回 `{kind:"ddl"\|"dml", command, affected_rows, columns:[], rows:[]}`，`toQueryResult` 只取 `columns`/`rows`，结果面板拿到空列即走报错分支；服务端写路径（`server/src/write/direct-write.mjs`）本身正常 | `shared/services/engine-client.ts`、`hooks/use-workbench-execution.ts`、`components/write-result-view.tsx`（新增）、`components/result-panel.tsx`、`state/workbench-types.ts` |
| 5 | 只改插件、不动宿主 | [x] 本轮全部改动都在插件目录内 | — |
| 6 | 连接树收起态的死图标 | [x] 删除（收起态工具栏只留「展开连接树」/「多选」/「导入」三个真按钮） | `components/connection-tree-rail.tsx`；见 §7 D-16 |
| 7 | （并入 8） | — | — |
| 8 | 标签条去横向滚动条 + 前后翻页 | [x] `.dbx-tab-scroll` 隐藏原生条（`scrollbar-width:none` + `::-webkit-scrollbar{height:0}`）；标签行右侧新增两个 24px `.dbx-icon-btn` 前后按钮，`revealTab()` 把目标标签滚进视野 | `components/tab-bar.tsx`、`shared/styles/dbx-primitives.css` |
| 9 | 历史卡「载入编辑器」无效（含历史栏溢出） | [x] 载入动作真实可用：`nextQueryLabel()`/`nextTabId()` 生成标签名 → `addTab` → `setTimeout(…,0)` 后执行（`addTab` 的 reducer 状态要下一 tick 才进 `stateRef`）；头部补齐 `search`（真实过滤）+ `trash-2` + `panel-right-close` 三个动作，收起与顶栏「查询历史」共用同一开合状态 | `hooks/use-workbench-history.ts`、`features/query-history/components/history-panel.tsx`、`right-panel.tsx`、`database-workspace.tsx` |
| 10 | 新建连接左栏与右栏不同步 / 数据库图标错误 | [x] 左栏点击真实切换右栏表单分组；db_type → 图标映射补齐（SQL Server 等此前落到通用图标）。图标走 `domain/database-icons.ts` + `shared/components/database-type-icon.tsx`；本轮一度新增的字母徽标 `services/db-type-badge.ts` 无调用方，已删（见 §7 D-17） | `connection-editor-flow.tsx`、`domain/database-icons.ts` |
| 11 | 存过程点击应看原生定义 | [x] 改为原生定义 SQL（`pg_get_functiondef` 等）打开「查看定义」tab，不再给 `CALL` 模板；`buildRoutineCallTemplate` 留给「调用」入口 | `connection-node.tsx`、`services/routines-catalog.ts` |
| 12 | 工作台的死按钮（⌘↵ 键帽） | [x] 键帽 chip 改成真按钮，`onClick={handleExecute}`、`disabled` 跟随连接/运行态、`title` 写真实快捷键 | `components/sql-editor.tsx` |
| 13 | AI 相关文本不可读 | [x] **无缺陷站点**：`` @`连接名` `` / `` @`连接名:schema.表` `` 是**宿主 @ 提及语法**，去掉就发不出去；`ai-prompt-templates.ts` 内反引号 0 处，`src/shared/ai/*.ts` 内非 `@` 反引号 0 处。不改。 | — |
| 14 | 连接树右键菜单缺口 | [x] 连接 8 / 库 11 / 表 18 项逐条接线；引擎无对应 API 的 20+ 项不出 disabled 假条目（清单见 W1 报告 §2 E3）；菜单宽度改内容自适应（`.dbx-menu{min-width:176px}`，§3.1 S4） | `connection-node.tsx`、`shared/components/context-menu.tsx`、`shared/utils/menu-placement.ts` |
| 15 | 「BI 数据资产」改名「BI」并统一页面 | [x] 顶栏导航项、BI 画廊、默认名、标题样式、详情抽屉、图表工具描述与**对外详情文案**全部统一为「BI」 | `workbench-top-bar.tsx`、`features/visualization/**`、`src/tools/dbx-chart-collection.ts`、`detail.json`、`detail.zh.json` |
| 16 | 设置面板左导航选中/悬停容器无间隙 | [x] 纵向间距 2px → 4px（两处 nav） | `styles/panels.css`、`styles/connection-editor.css`；见 §7 D-15 |
| 17 | 全局 AI 协助面板对齐设计稿、能正常工作、关闭键在右 | [x] 原实现是**模拟** AI（正则抽关键词 + 1s 假延时）→ 改为真发宿主 AI：`sendToHostAi` + 新增 `buildNewConnectionPrompt`，删假延时、加 `isSending`；头部 `ml-auto` 关闭键；动作行 `dbx-btn primary`「交给 AI 助手」+ `dbx-btn ghost`「本地解析」。**插件读不到宿主 AI 回执**（`conversation.sendPrompt` 是 ADR-0060 回执），因此交给宿主 AI 后用它的 `dbx_add_connection` 工具落地，不做假进度。设计稿没有 AI 面板帧，故按插件自身设计语言（`PaneHeader` 形态）对齐 | `ai-assistant-panel.tsx`、`send-to-ai-dialog.tsx`、`src/shared/ai/send-context.ts` |
| 18 | 插件 tab 用 dbx 官方图标 | [x] `"icon": "assets/icon.png"`（官方位图，不用 Solar 近似图形） | `plugin.json` |
| 19 | 结果网格底栏对齐 | [x] 底栏按设计稿 `h-9 border-t px-3 gap-2` 重排：左 `1–100 / 1,284` mono + `后端分页` chip；右 `每页` + 数值框 + 前后翻页 + `加载全部` | `result-grid.tsx`、`styles/result-grid.css` |
| 20 | 设计稿里其它未对齐处 | [x] 本轮前 19 面销项见 §3；本轮追加：`.dbx-nav-item.is-active` 底色 `--dbx-surface` → `--dbx-panel`（见 §2 勘误）、两处 nav 间距（D-15），有意偏差逐条登记在 §7 | 见 §3 / §7 |

**📸 截图追加项（查询历史栏）**：截图里的右栏即 §3.4 C1/C3 + 第 9 项，头部三动作与卡片「载入编辑器」均已接线；搜索行是设计稿 rail（`frames/index.tsx:215-226`）没有输入框时的紧凑适配（`h-8` 搜索行置于 `h-8` 筛选行之下）。

## 9. 本轮验证记录（0.4.2 收口）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run check`（插件根） | `tsc --noEmit` exit 0 |
| 插件测试 | `npm test`（插件根） | `# tests 878 / # suites 200 / # pass 877 / # fail 0 / # skipped 1` |
| 插件构建 | `npm run build` | `✓ built in 17.53s`，exit 0；产出 `release/dbx-pro-0.4.2.astraviapkg`（30 个运行文件） |
| 市场源校验 | `node scripts/marketplace.mjs check`（仓库根） | `Validated source entries for astravia-official-marketplace`，exit 0 |
| 市场源内容测试 | `node --test tests/*.test.mjs`（仓库根） | `# pass 59 / # fail 0`，exit 0 |

**版本提升（0.4.2）**：按 ADR-0009 §6 的身份清单同步 6 处字符串 / 5 个文件 —— `plugin.json`、`ability.json`、`.astravia/marketplace.source.json`（均为 `0.4.1` → `0.4.2`）、`package.json` 与 `package-lock.json`（`0.4.0` → `0.4.2`，锁文件 2 处）。引擎版本线（`runtime-lock.json`、`scripts/build-engine.mjs` 的 `0.4.106`、`plugin.json` 内 engine service `0.0.20`）**不动**。上表构建/类型/测试三项均在**提版之后**重跑，结论不变。`release/` 与 `dist/` 已由插件 `.gitignore` 覆盖（`git check-ignore` 逐条确认）。

**对外详情文案同步（第 15 项收尾）**：`detail.json` / `detail.zh.json` 的「BI data assets」/「BI 数据资产」表述全部改为「BI」，与界面重命名一致；§8 第 15 项落点已补上这两个文件。

**构建期发现并修掉两个 CSS 语法错误**（`tsc` 与 node 测试都不解析 CSS，只有 `vite build` 会暴露；已扫过全部 15 个插件 CSS 文件，括号现已平衡）：

- `styles/sheet-modal.css`：`backdrop-filter` 删行时多留一个 `}`，Tailwind 报 `Missing opening {` 直接终止构建；
- `shared/styles/dbx-primitives.css`：`.dbx-nav-item.is-active` 后多留一个 `}`；顺带合并 `.dbx-tab-scroll` 的重复声明。

**测试同步（改测试侧，非代码回退）**：`src/test/figure-render.test.js`（8 处）与 `src/test/dbx-chart-collection.test.js`（2 处）此前钉的是 W3 改造前的旧色值/旧字号，本轮按设计稿与 `--dbx-*` 令牌重新钉定：看板/大屏底板 `#f6f8fa` / `#0d1117`、涨跌 `#1a7f37` / `#cf222e`、大屏 KPI 字号 `34px`、卡片面 `#161b22` 与描边 `#30363d`、须线 `#656d76`、网格线 `#d0d7de`、`border-radius:6px;background:` 计数。`chart-theme-parity.test.js` 未改（卡片令牌未被 W3 触碰，其 `rgba(6,182,212,0.25)` 仍是 `.chart-card` 的实际描边）。

**代码审查（双轴）**：按 `code-review` 技能对本次未提交改动（固定点 `HEAD` = `fe35b1b2`）跑了两条独立审查轴，报告见 `docs/plans/reports/review-standards.md`（代码规范 / 坏味道）与 `review-spec.md`（规格符合）。

- **规范轴无硬违反**；命中 4 条疑似坏味道，已处理 2 条：删除新增死模块 `services/db-type-badge.ts`（D-17）、删除 `visualization-gallery.tsx` 内因本轮改动失去消费者的 `chartCount`；保留 2 条（导入逻辑重复、`kind?: string` 原语化）并记录理由。
- **规格轴**：§8 20 项与 §3 各面均能对到源码接线，无「既未实现也未登记为偏差」的设计稿元素；两处收口——对外详情文案漏改（已修）、3 项数据层缺口项的登记口径（已在 §7 表后说明）。
- **顺带修正的一处失实提示**：结果区 AI 菜单底部原写「将把 SQL、列结构与前 200 行发送给 AI 助手」，而 `buildResultVizPrompt` 不发任何数据行、`buildResultAnalysisPrompt` 只发当前页预览（默认 50 行）——按仓库「不做虚假提示」的规范改为「将把这条 SQL 与结果规模（行数 / 列数）发送给 AI 助手，不含数据行」（`result-panel.tsx`）。

## 10. 第四轮：用户反馈「后台任务导出面板没有对齐设计稿」销项（本轮执行）

反馈原文只有一句「后套任务导出面板没有对齐设计稿」，按「后台」理解；判据取设计稿帧 `frames/downloads.tsx`（F4 下载后台）。改动全部落在 `abilities/plugins/dbx-pro/**`。

**根因**：工作流 2 上一轮把 F4 落地成顶栏弹出面板（W2-7），而设计稿是**底部通栏货架**；「大小」列因 `ExportTask` 没有字节字段未做（W2-8）。两项都是当时主动登记的技术债，本轮一并偿还。

| # | 项 | 结论 | 落点 |
| --- | --- | --- | --- |
| 1 | 货架形态 | [x] 底部通栏货架：与 `<SplitLayout>` 同级挂在根列上，盖住连接树下方整幅宽度；头部「下载后台」+ 状态点「N 个进行中」+ `清空已完成` / 收起；6 列行（任务 / 进度 / 大小 / 时间 / 状态 / 操作）；空态；页脚说明 + 「已完成 N 个 · 合计 X」 | `components/export-tasks-shelf.tsx`（新增）、`components/database-workspace.tsx` |
| 2 | 顶栏入口 | [x] 面板拆成独立入口组件（原 popover 文件删除），保留既有进度环与计数角标，补开合语义（`aria-haspopup` / `aria-expanded`） | `components/export-tasks-trigger.tsx`（新增）、`components/workbench-top-bar.tsx`、`components/export-tasks-popover.tsx`（删除） |
| 3 | 「大小」列 | [x] 数据层补齐：`ExportTask.bytesExported / bytesTotal`；`ChunkedTextExport` 增 `bytes()` 懒计数（不复制内容、每段只编码一次）；runner `onProgress(rows, bytes)` 透传；`result-grid` 写入 | `state/export-tasks-store.ts`、`services/result-export.ts`、`services/export-all-runner.ts`、`components/result-grid.tsx` |
| 4 | 字节格式化 | [x] 纯函数 `formatBytes`（1000 进制，与系统文件管理器一致；未知写「—」）+ 单测 | `services/format-bytes.ts`（新增）、`src/test/format-bytes.test.js`（新增） |
| 5 | 样式对齐 | [x] 头部 gap 10 / 标题 14px、列头与行 gap 12、字号 11→12、行区滚动上限 264px、状态点本地实现（共享 `.dbx-status-dot` 无 accent 档）、空态、页脚左右分栏、`.dbx-export-count--attention` 补定义 | `styles/panels.css` |
| 6 | 只改插件 | [x] 未改 `style.css`、`shared/**`（`.dbx-primitives.css` / `.dbx-layout.css`）等宿主侧样式；`workbench-top-bar.tsx` 属插件自有顶栏 | — |

**顺带修掉的两个既有缺陷**：`.dbx-export-count--attention`（琥珀态角标）此前从未定义，顶栏在「只剩等待保存 / 未保存」时不变色 —— 已补；`.dbx-popover-empty*` 至今未定义（空态无样式），该壳已无消费者，按 F5 复用预期**保留并登记**。

**验证**：`tsc --noEmit` exit 0；直接相关套件 `export-all-runner` / `result-export` / `export-save` / `export-tasks-store` / `xlsx-export` / `result-grid` / `format-bytes` 共 **78 项全通过**。

工作流 2 报告已同步订正：`reports/w2-forms-panels.md` §2 的 W2-7 / W2-8 / W2-9 标记为已订正，§5 记录本轮落点。


