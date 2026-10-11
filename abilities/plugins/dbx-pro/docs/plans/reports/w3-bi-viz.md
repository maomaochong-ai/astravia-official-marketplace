# 工作流 3 · §3.8 G BI 数据资产 / 看板 / 大屏 / 可视化筛选 —— 改造报告

范围：`abilities/plugins/dbx-pro/src/features/visualization/**`（G1–G4）。约束：只动本工作流自有文件；不动 `src/index.tsx`、`src/style.css`、`src/shared/**`、`src/domain/**`、`src/tools/**`、`features/database-workspace/**` 及其他工作流的文件；不新增依赖、不新增功能。

状态：G1/G2/G4 的**可落地部分**已实现，G3 按「导出页 CSS + figure 字号」落地；`npx tsc --noEmit` 无输出。设计画布视觉比对与几何探针未运行，见「未验证项」。

帧（设计根 `dbx-pro.astravia-design`，只读、随画布实时改动）：`frames/bi-assets.tsx`、`frames/assets.tsx`、`frames/viz-screen.tsx`、`frames/viz-filters.tsx`、`components/Charts.tsx`、`components/SpecVizFilters.tsx`、`theme.css`。

## 1. 改动文件清单

`git diff --stat`（仅本工作流路径）：9 files changed, 1204 insertions(+), 446 deletions(-)。

| 文件 | 改动 |
| --- | --- |
| `src/features/visualization/components/visualization-gallery.tsx` | **重写（+649/−… ）**：由「列表 + 抽屉」改为 `bi-assets.tsx` 的三栏工作台。header `h-14 px-8`（标题 / 计数 / 搜索 240×28 / chips / 清空）；左 rail `w-[272px]`（数据集汇总，可点击定位产物）；中心 `grid-cols-3 gap-3 p-4`；右 `w-[392px]` 内联详情列；卡片 `Thumb h-[104px]`（内联 SVG 三态 line/donut/bars）+ 名称/元信息（连接·表·行数·时间）/ 快捷操作行 + 「更多」菜单。保留原有搜索、类型筛选、双段确认清空、预览、下载、交给 AI、删除等全部行为；删除 `CHART_ICON_MAP`（图标字体落图形属违规）。样式**只用 `.viz-assets-*` 自定义类**，不混用原子类 |
| `src/features/visualization/components/visualization-detail-drawer.tsx` | **重写**：由遮罩浮层改为内联右列 `.viz-detail-column`（392px）；头部 `.viz-detail-head` + `.viz-icon-btn`；正文 `.viz-drawer-body`；页脚 `.viz-drawer-actions`（48 + 上边线）与 `.viz-detail-foot-note`。**移除遮罩与点击遮罩关闭，保留 Esc 关闭**；筛选/重取数/导出/新窗口打开的逻辑与禁用态未变 |
| `src/features/visualization/visualization.css` | 令牌化 + 新增三栏工作台段落（原 461 行 → 约 1105 行）。① 抽屉换壳与 `.viz-grid gap:12px`、`.viz-canvas-card padding:10px`、`.viz-canvas-title` 改 32px 带下边线的卡头行、`.viz-canvas-desc` 10px/`--dbx-faint`、错误卡与横幅改令牌；② 筛选控件度量：`.viz-check` 24px + `:has(input:checked)` 命中态（accent 15% 底 + accent 字）、`.viz-input` **32px / `padding:0 10px`**、`.viz-range`、`.viz-section*` 去卡片化（标题 11px）；③ 追加 `.viz-assets*` / `.viz-rail-*` / `.viz-asset-*` / `.viz-chip` / `.viz-menu*` / `.viz-ghost-btn` / `.viz-thumb-*` 整套；④ 统一圆角到设计令牌：`.toolbar-badge`→`--dbx-radius-chip`、`.viz-dataset`/`.viz-sql`/`.viz-banner`/`.viz-lineage-source`→`--dbx-radius-control`，`.viz-lineage-time`→`--dbx-faint` |
| `src/features/visualization/figures/figure-palette.ts` | 注释纠正（`text`/`muted` 对齐 `--viz-title`/`--viz-desc`，`grid`/`axis` 对齐 `themes/chart-defaults-*.js`）；`DASHBOARD_PALETTE`：`axis #656d76` / `grid #d0d7de` / `surface #f6f8fa` / `surfaceBorder #d0d7de` / `up #1a7f37` / `down #cf222e`；`SCREEN_PALETTE`：`axis #8b949e` / `grid #30363d` / `surface #161b22` / `surfaceBorder #30363d` / `up #3fb950` / `down #f85149`。**`SERIES_COLORS` 与两个 palette 的 `series` 字段未动**（见 G-X2） |
| `src/features/visualization/figures/metric-figure.ts` | 指标卡对齐设计 `Kpi`：圆角 8→6px、数值字号 26/30→**看板 20 / 大屏 34**、字重 700→600、标签去掉 `letter-spacing`、环比行 11→10px（加 `font-weight:600`）、内边距 `14px 16px`→`12px`；同步修正文件内「字号固定」注释并给出帧出处。**字面量内联策略不变**（该 HTML 既进宿主也进离线导出文档，导出文档没有宿主 CSS 变量） |
| `src/features/visualization/themes/dashboard.css` | 导出页外壳对齐设计（浅色）：`body background #f6f8fa / padding 12px 32px`；`.header` 改 56px 左对齐 + 下边线；`.header h1` 20px/600（**删除渐变 + `-webkit-background-clip` + `-webkit-text-fill-color:transparent`，避免字隐形**）；`.header p` 12px；`.grid gap 12px`；`.chart-card padding 12px`；`.chart-card h3` 13px + 下边线（`color` 仍是第一条 `color` 声明） |
| `src/features/visualization/themes/screen.css` | 同上，深色：`background #0d1117`（去掉渐变）、`.header` 56px + `#30363d` 下边线、`h1 #e6edf3`、`p #8b949e`、`.grid gap 12px`、`.chart-card padding 12px`、`h3` 13px + 下边线。**四个被测试钉死的卡片 token 与 `h3 color #a5f3fc`、`.chart-desc #94a3b8`、`@keyframes fadeIn` 及其延迟规则逐字保留** |
| `src/features/visualization/themes/chart-defaults-dashboard.js` | `gridColor '#d0d7de'` / `tickColor '#656d76'`（与 `figure-palette.grid/axis` 同源） |
| `src/features/visualization/themes/chart-defaults-screen.js` | `gridColor '#30363d'` / `tickColor '#8b949e'`（同上） |

未触碰：`src/tools/dbx-chart-collection.ts`、`src/index.tsx`、`src/style.css`、`src/shared/**`、`src/domain/**`、`features/database-workspace/**`，以及 `components/chart-grid.tsx`、`components/dataset-filter-panel.tsx`、`components/dataset-summary-list.tsx`、`components/visualization-lineage-panel.tsx`、`components/visualization-tab.tsx`、`hooks/use-dataset-refetch.ts`、`figures/funnel-figure.ts`、`figures/boxplot-figure.ts`、所有 `src/test/*.js`（对齐全部通过 `visualization.css` 完成，类名经比对 1:1 覆盖）。

## 2. 偏差表

### G1 · 图库（`bi-assets`）

| # | 设计稿 | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| G1-1 | 左 aside = 数据集行列表 +「只读快照」chip + 「+」新建 | 左 rail = **只读数据集汇总**（名称 / 表 / 已载入·总行数 / 取数时间），点击定位到产物 | 资产页只管理已生成产物，数据集由产物携带；「新建」在本插件是对话入口，做成按钮即伪造未实现的流程 |
| G1-2 | 中心 sub-header `h-9` + footer `h-9`（占用 3.1 MB） | center-head 36px 显示「N 个数据集」提示；center-foot 36px 显示「图表 N 个」 | 尺寸对齐；文案按插件真实可得的计数，不伪造体积统计 |
| G1-3 | Toast `absolute right-6 bottom-16 w-[320px]` | 未实现 | 插件通知已是 `.viz-banner-error/.viz-banner-ok` 就地横幅；新增 Toast 属新增交互（ADR 禁新功能） |
| G1-4 | Thumb 四变体（含 `mini` 城市条） | 三变体 line / donut / bars | `mini` 需要「城市」这类维度语义，插件只有 `chartItems[0].type`；硬套会给出误导图形 |
| G1-5 | header `Btn variant="primary"`「新建看板」 | header = 标题 / 计数 / 搜索 / chips / 清空 | 同上，「新建」入口属对话侧 |
| G1-6 | 右抽屉呈浮层（叠在内容上，`w-[392px]`） | 内联右列 `.viz-detail-column`（392px，`flex-shrink:0`） | 宽度逐值对齐；宿主中栏内不做浮层（帧自身注释：不使用遮罩/独立窗口），且内联列不会盖住 grid |
| G1-7 | `bg-surface-sunken` 作为缩略图底色 | `--dbx-panel-sunken`（缩略图）/ `--dbx-surface-2`（数据集块） | **`--dbx-surface-sunken` 在插件令牌表里不存在**；两处按「下沉面」语义分别映射 |
| G1-8 | `bg-background`(#010409) | `--dbx-canvas` | `.dbx-root` 把宿主 `--background` 重映射为面板色，直接用 `bg-background` 会得到错误底色 |

### G2 · 看板（`assets`）

| # | 设计稿 | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| G2-1 | 查询控制行 `h-12 px-8`、tile 网格 `grid-rows-[88px_240px_1fr] grid-cols-12 gap-3 px-8 py-3`、footer `h-9 px-8`、KPI 带 | 只落了 `.grid gap 12px`、`.chart-card padding 12px`、`.chart-card h3` 13px + 下边线、`.header` 56px 左对齐 | 导出 HTML 的 DOM 由**范围外** `src/tools/dbx-chart-collection.ts`（`generateHtml` / `buildChartArea` / `buildHtmlHead`）生成，本工作流不能新增 KPI 带 / 查询行 / 页脚节点；`.header > h1 + p` 也是同一文件产出，所以 `.header` 只能纯 CSS 改样式 |
| G2-2 | KPI `font-display text-[20px] font-semibold` | `figures/metric-figure.ts` 数值 **20px（看板）/ 34px（大屏）**、`font-weight:600`、卡片圆角 6px、内边距 12px、标签 11px、环比 10px | 插件把 `font-display` 别名为 sans（计划 §7 D-7），故不写 `font-display`；其余数值按帧内 `Kpi` 实测量落 |
| G2-3 | 图表卡片壳按 `Tile` | `.viz-canvas-title` = 32px 高带下边线的卡头行 + 12px/600 标题；卡体 `padding:10px`；副标题 10px `--dbx-faint` | 与 `assets.tsx` `Tile`（`h-8 shrink-0 border-b border-border px-2.5` + `p-2.5` 卡体 + `text-[10px] text-faint` 注释）逐值一致，故 `chart-grid.tsx` **无需改 TSX** |

### G3 · 大屏（`viz-screen`）

| # | 设计稿 | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| G3-1 | 独立大屏页面：header `h-10`、KPI 带 `grid-cols-[1.5fr_1fr_1fr_1fr] divide-x`（34px）、中段 `grid-cols-12 gap-4`（面积图 col-span-8、环图 126/16）、底部 `h-[196px]`、footer `h-8` | 插件**不渲染独立大屏页面**（产物以卡片/导出文档呈现）；大屏只影响 `themes/screen.css` 外壳与 figure 字号 | 新增整页大屏视图＝新增功能，超出「UI/布局/样式对齐」范围 |
| G3-2 | `Panel` 头行无边框、无固定高（`flex shrink-0 items-center gap-2`，标题 14px，meta 12px 右对齐） | 卡片壳按 `assets.tsx` `Tile`（有下边线、`h-8`）实现 | 两帧是两套壳：看板图行走 `Tile`，大屏页行走 `Panel`。本插件渲染的是看板卡片，故选 `Tile`；`Panel` 的差异登记于此，不额外造壳 |
| G3-3 | 34px KPI 数值、环图孔色 `var(--color-screen-raised)` | `metric-figure` 大屏字号 34px ✓；环图由 Chart.js 配置（`chart-runtime-browser.ts`），孔色未改 | 34px 已对齐；环图 126/16 与孔色属图表运行时配置，改它需动 `segments`/`cutout` 语义，非本次样式对齐范围 |

### G4 · 筛选（`viz-filters`）

| # | 设计稿 | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| G4-1 | 控件 `h-8`（12px）、命中态 `accent 15% + accent 字` | `.viz-input` **32px** + `padding:0 10px`；`.viz-check` 24px + `:has(input:checked)` → `color-mix(accent 15%)` 底 + accent 字 | 逐值对齐（`.viz-check` 对应设计的 `Tag h-6`，`.viz-input` 对应 `Control h-8 / px-2.5`） |
| G4-2 | `.viz-input` 宽度由网格 `w-full` 决定 | 固定 `120px` | 插件筛选列宽与帧不同，固定宽度避免双输入框被挤成不可读 |
| G4-3 | **联动防抖 240ms** | **未实现**（改动即算，无防抖） | `visualization-detail-drawer.tsx:56-58` 明确「2000 行 × 几个列的过滤与重映射是毫秒级，刻意不引入 memo」；且 `src/test/visualization-detail-wiring.test.js:138-144`/`:157-174` 在 `fireEvent` 后**同步**断言筛选结果与图数据，插入防抖会破坏既有验收。属功能变更，需单独评审 |
| G4-4 | popover 建议面板（向上翻转、阴影） | 无 popover 形态（区间=双输入框、枚举=chip 行） | 面板形态是插件既有交互；新增 popover 属新功能 |

### 横向 / 共享约束

| # | 设计稿 | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| G-X1 | 卡片按设计改 `#d0d7de` 边框 / 无阴影 / 6px 圆角 | 保持 `#ffffff`+`1px solid #e5e7eb`+`0 1px 3px`+12px（看板）/`rgba(255,255,255,0.04)`+`rgba(6,182,212,0.25)`+`0 0 24px`+4px（大屏） | 这 6 个 token 被 `src/test/chart-theme-parity.test.js`（`THEMES` 表 ~49–84）钉死，且要求 `themes/*.css` 与 `visualization.css` 的 `.viz-theme-*` 三处一致；本工作流禁跑测试，改一面必然让另一面失败 → 需与测试面同步后再改 |
| G-X2 | 换用设计色板 4 色 `#58a6ff/#3fb950/#a371f7/#d29922` | `SERIES_COLORS` 8 色保持 QuickBI/DataV 前导不变 | ① `src/test/figure-render.test.js:59-60` 钉住前三位与长度 8；② 范围外 `src/tools/dbx-chart-collection.ts:21,98` 把它当作**导出图表的默认调色板**复用。改常量等于同时改两个契约，且改不动消费方 → 仅登记 |
| G-X3 | 导出页配色 | 看板仍为浅色 QuickBI | 把看板从浅色改为设计深色是产品配色决策，不是对齐；需根代理授权 |
| G-X4 | `frames/viz-screen.tsx`、`frames/viz-filters.tsx` 已独立成帧（原为 `Spec*.tsx` 组件的堆叠页） | 按新帧对齐 | **警示**：兄弟工作流的任务描述引用了旧帧路径（`components/SpecVizFilters.tsx` 等）。若他们读的是旧结构，规格会与实际帧不一致，请根代理核对 |
| G-X5 | `figures/funnel-figure.ts` 外壳 | 未改 | 四个设计帧里没有漏斗形态，其配色已随 `figure-palette.ts` 更新；无对照物可对齐 |

## 3. 验收与自检

- `npx tsc --noEmit`：**输出为空**（此前 `visualization-gallery.tsx:407` 的 `"area"` 与 `ChartItem.type` 联合无交集（TS2367）已修掉）。
- 硬编码颜色自检：`visualization.css` 新增段落（533 行起）与 `visualization-gallery.tsx`、`visualization-detail-drawer.tsx` 中 `#hex` / `rgb()/rgba()` 命中 **0**（全部走 `--dbx-*` / `--viz-*`）。
- `font-display`：本 feature 目录命中 **0**。
- 花括号平衡：`visualization.css` 162/162、`themes/dashboard.css` 12/12、`themes/screen.css` 21/21。
- 类名覆盖：`components/*.tsx` 使用的 `viz-*` 类与 `visualization.css` 定义做集合差，未定义项只剩模板字符串前缀（`viz-assets-`、`viz-theme-`、`viz-thumb-bar-`、`viz-thumb-seg-`），无真实缺口。
- `git status --short` 中本工作流自有路径：`components/visualization-detail-drawer.tsx`、`components/visualization-gallery.tsx`、`figures/figure-palette.ts`、`figures/metric-figure.ts`、`themes/chart-defaults-dashboard.js`、`themes/chart-defaults-screen.js`、`themes/dashboard.css`、`themes/screen.css`、`visualization.css`；其余 ` M`/`??` 条目均属其他工作流，未触碰。
- `git diff --stat`（本工作流）：9 files changed, **1204 insertions(+), 446 deletions(-)**。

## 4. 未验证项

1. **未跑任何测试**（本工作流禁 `npm test`）。`src/test/chart-theme-parity.test.js`、`figure-render.test.js`、`visualization-detail-wiring.test.js` 的结论均为**静态推演**：抽取器取「全文件第一个匹配块」的「第一条同名声明」，因此本轮只在原规则内改 `padding`/`border-bottom`/`font-size`/`body`/`.header`/`.grid`，未在其前插入任何被钉属性的重复声明；`.chart-card` / `.viz-canvas-card` 均未新增更早的同名规则。仍需在可跑测试的环境复核一遍。
2. **未做几何实测**：无 `npm run build` / 无头探针，`h-14 / w-[272px] / w-[392px] / h-[104px] / grid-cols-3 gap-3 p-4 / 32px 控件` 等均按帧内字面量与 CSS 对齐，未实测 `getBoundingClientRect()`。
3. **未做画布视觉比对**：`.notes.json` 注记未读取。
4. `.viz-assets { height:100% }` 的父级链已核（`sql-editor-workspace.tsx` 里 is `flex h-full min-h-0 flex-col` → `min-h-0 flex-1 overflow-hidden`），按此路径 `height:100%` 可解析；但宿主若换挂载方式（非 flex 且高度 auto）会退化为内容高。该挂载点属 `features/database-workspace`（禁改），未加固。
5. `figures/metric-figure.ts` 的 20/34px 只改了字面量；Chart.js 侧 dataset 字号（`themes/chart-defaults-*.js` 未含 fontSize）未受影响，导出页与宿主 UI 的字号一致性未逐项实测。
6. Dev 期清空按钮的双段确认（3000ms）语义未变，但未做交互实测。
