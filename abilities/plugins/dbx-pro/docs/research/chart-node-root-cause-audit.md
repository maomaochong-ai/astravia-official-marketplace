# 对抗性审计报告 —《BI 画布图表节点根因调研报告》

被审对象：`docs/research/chart-node-root-cause-report.md`（262 行）
一手事实清单：`docs/research/chart-node-render-investigation.md`（433 行，F1–F18）
审计方式：只读（`read` / `grep` / `wc -l` / `git show` / `git diff` / `npm run check` / `npm test` 只读重跑），审计期间未修改、创建或删除任何既有文件；唯一新增文件为本报告。

---

## 0. 审计快照与时点（必读）

审计期间**工作区与 HEAD 持续变动**（并发代理反复 `commit (amend)`），因此本报告所有"当前值"都带时间戳；判定表一律区分「报告快照时点」与「审计末刻」。

| 标记 | 时点 | HEAD | 关键状态 |
| --- | --- | --- | --- |
| **T0 报告快照** | 报告撰写时（本审计推定并已用源码反证） | `28ac7440` v0.4.61 | 工作区 `node-graph.tsx` = 1647 行（报告 chart 引用行号逐条吻合）；`use-canvas-execution.ts` = 304 行（= 该 HEAD 内容，报告 :217/:220-245/:270-278 吻合）；`git diff --stat` = 9 files/246+/49-；`npm run check` = 379 errors（全在 test） |
| **T1 审计中途** | 本审计第一次基线复跑 | `28ac7440` → `6336c6b4` | worktree 12 files/283+/60-；`npm run check` = 382（生产 3 + test 379）；随后一度只剩 4 条解析错误 |
| **T2 审计末刻** | 2026-10-14 21:15:08 | `1b1d24ab` v0.4.63 | `git diff --stat` = **2 files/29+/28-**；`node-graph.tsx` **1941 行且正在被编辑**（13 条解析错误）⇒ 此刻 `npm run check` 的语义诊断被遮蔽，不可用作基线 |

`git reflog -3` 实测（T2）：

```
1b1d24ab HEAD@{0}: commit (amend): fix(dbx-pro): v0.4.63 — SocketHandlers + 主题 + 选中样式 + 框选位置
6336c6b4 HEAD@{1}: commit (amend): fix(dbx-pro): v0.4.62 — 三个画布回归 bug 修复（主题/选中样式/框选位置）
28ac7440 HEAD@{2}: commit (amend): fix(dbx-pro): v0.4.61 — Socket 事件流回归修复（核心 bug）
```

**推论（标注为推断）**：审计期间存在并发的插件开发活动，HEAD 由 `28ac7440 → 6336c6b4 → 1b1d24ab` 三跳、全部为 amend 提交。故：**不得把并发中间态当作被审报告的缺陷**；本报告把所有"数字类不符"一律裁为「时序问题」，并对**源码语义类不符**才裁「不符」。

---

## 1. 审计结论

**报告本身：无阻断性发现。** 核心事实链（拖拽链正常 → 节点被创建 → 渲染为占位图形 → 数据恒为哈希 → 上游数据未接线 → 真实引擎与画布零连接）在 T0、T1、T2 三个时点均成立，且报告给出的修复方向（P0.1 接数据、P0.2 分派类型）与源码事实一致。

**但当前工作区（T2）存在报告之后引入的阻断级回归，与图表渲染同属"画布中栏"路径，须先处理再动手改图表**：

| 级别 | 事实 | 证据 |
| --- | --- | --- |
| **阻断（当前时点）** | `CanvasStrip` 在 v0.4.62 起新增 9 个**必填** props，而唯一调用点只传 2 个 ⇒ 类型错误 + **渲染期解引用 `undefined`** | `canvas-strip.tsx:26-35`（`palette: CanvasPalette;` 无 `?`）+ `canvas-editor.tsx:404`（`<CanvasStrip nodeCount={…} linkCount={…} />`）+ `canvas-strip.tsx:70,81,85`（`palette.description` / `paletteSwatch(palette, i)` / `palette.label`） |
| **阻断（当前时点·在飞）** | `node-graph.tsx` 当前含 13 条解析错误，工作区**不编译** | `npm run check` 21:15:08：`node-graph.tsx(1634,8) TS1003` … `(1737,1) TS1128`（全部 TS10xx/TS11xx/TS13xx 语法类） |

这两条**不是报告的错误**（报告的 §7.1 结论在 T0 时点成立，见 §4.3），但会直接影响「按报告 §6 开工」的前置条件。

---

## 2. 核心结论 C1–C6 逐一判定

报告 §0 以 4 条编号结论 + 1 句定性表述给出主张；下表把它拆成 6 个可独立证伪的命题（C1–C6），每条都同时给出 T0 与 T2 的核对结果。

| 编号 | 命题（源自报告） | 判定 | 一手证据（T2 行号，括号内为 T0 行号） |
| --- | --- | --- | --- |
| **C1** | 拖拽事件链正常、节点会被真的创建（"现象在渲染结果层成立、事件层不成立"） | **属实** | 载荷 `node-library.tsx:286-297 setData("application/json", {kind:"node", nodeType:item.key})`；`node-graph.tsx:224-228` 存在 `preventDefault`、`:1244 onDrop={onCanvasDrop}`；drop 分支 `:258-273` `setNodes` |
| **C2** | 除饼/环外**所有** `chart-*` 都渲染成同一个面积图 | **属实** | `node-graph.tsx:18` 仅 `import { AreaChart, Donut, SERIES }`；`:1438 {isChart && (`、`:1440 {kind === "chart-pie" \|\| kind === "chart-donut" ? (`（T0：`:1119`/`:1121`）；`Bars/HBars/Funnel/Gauge` 在 `bi-editor/**` 内**零引用** |
| **C3** | 图表节点数据恒为 FNV-1a 哈希伪随机序列，永不来自查询结果 | **属实** | `node-graph.tsx:1374-1379`（T0 `:1055-1060`）：`const chartValues = result && result.columns.length > 0 ? … : hashValues(\`node-${id}\`, 14, 30, 88)`；`use-canvas-execution.ts:292 if (!kind.startsWith("source-")) continue;`（T0 `:275` 正分支写法）⇒ 图表节点永不执行 |
| **C4** | `nodeResults` 中只可能出现数据源节点 key | **属实（强）** | 全仓写入点仅 `use-canvas-execution.ts:116…226`（全部位于 `runNode` 的 `source-*` 分支内）+ `:264 setNodeResults({})`；全仓 `runAll(`/`runNode(` 调用点仅 `:295`、`canvas-editor.tsx:269,309`（均为手动执行入口） |
| **C5** | 属性面板字段（xField/yField/category/valueField/stageField/geoField）在整条渲染链上无读取点 | **属实** | `grep -c "values\.(xField\|yField\|category\|valueField\|stageField\|geoField\|indicatorField)" src` = **0**；`node-graph.tsx` 的 `values.` 读取点仅 `title/sql/table/datasourceId/placeholder/field/mode/metric` |
| **C6** | 真实图表能力存在于仓库但与画布零连接 | **属实** | `grep -rn "echarts\|iframe\|srcDoc" src/features/bi-editor` = **0**；`features/chart-engine` 消费者仅 `src/tools/dbx-chart-collection.ts:15,16,20,21,39` + `src/test/chart/figure-render.test.ts:10,11`；`domain/chart-source.ts` 消费者仅 `src/tools/dbx-chart-collection.ts:18` + 单测 |

**附：报告 §1 六层表（L1–L6）的引用核对**：L1/L1b（拖拽与落点）引用 `node-library.tsx:286-297`、`node-graph.tsx:224-228,920-922,229-233,258-273`、`screenToCanvas` `:186-194` — **属实**（T0/T2 逐条吻合，T2 仅整体位移）；L3/L3b/L5 引用见 C3/C6；L6"注册面不一致（图表组 6 / 面板 10 / 模板 10）"**属实**（见 §5.2 差集表）。

---

## 3. 报告引用逐条核对

判定用语仅限：**属实 / 不符 / 证据不足**。`漂移` 表示"对 T0 属实、对 T2 行号位移"，一律计入 属实 但单独标注。

| # | 报告引用 | 判定 | 说明 |
| --- | --- | --- | --- |
| 1 | `node-graph.tsx:18` 只 import `AreaChart, Donut, SERIES` | 属实 | T2 仍为 `:18`（文件头部未动），原文一致 |
| 2 | `node-graph.tsx:1037` `const result = nodeResults[id]` | 属实 | T0 一致；T2 漂移至 `:1356` 附近（整体 +319，文件 1647→1941） |
| 3 | `node-graph.tsx:1042/1043` 渲染分支 | 属实 | T2 = `:1361/:1362`（`const isChart = kind.startsWith("chart-");` / `const isMetric = kind.startsWith("metric-");`） |
| 4 | `node-graph.tsx:1055-1060` `chartValues` + `hashValues` | 属实 | T2 = `:1374-1379`，逐字一致（含 `14, 30, 88`） |
| 5 | `node-graph.tsx:1119-1135` `isChart` 块、`:1121` 饼/环分流 | 属实（压缩格式） | T2 = `:1438`/`:1440`，语义逐字一致 |
| 6 | `node-graph.tsx:1137-1144` `metric-*` 大数字分支 | 属实 | T2 漂移至 `:1456` 附近；语义一致 |
| 7 | `node-graph.tsx:113-132` `NODE_TEMPLATES` 10 个 `chart-*` | 属实 | T2 键集合不变（line 数位移） |
| 8 | `node-graph.tsx:90-95` 哈希序列注释（"不抄设计稿 GMV mock 数据…"） | 属实 | 逐字一致，且与用户约束一致 |
| 9 | `node-graph.tsx:186-194` `screenToCanvas`、`:197-204`、`:224-228`、`:229-233`、`:258-273`、`:920-922` | 属实 | 事件层四处逐行核对通过（T0 与 T2 语义一致） |
| 10 | `node-library.tsx:286-297` drag payload、`:252` "从数据集生成"按钮、`:357-361` hint | 属实 | 逐字一致；另 `:196/:215/:237/:346` 为仅有的 onClick 点 |
| 11 | `use-canvas-execution.ts:217-218`（非数据源节点不执行）、`:220-245` `getUpstreamData`、`:270-278` `runAll` 过滤 | 属实（**仅对 T0/28ac7440 的 304 行版**） | 已用 `git show 28ac7440:./…` 逐行比对：`:217` 注释、`:220 getUpstreamData`、`:247 const runAll`、`:275 if (kind.startsWith("source-")) {` 全部吻合。T2 = 329 行（`:231/:229/:261/:292`），漂移 ≈11–17 行，因 v0.4.62 引入 `muted`/`RunOutcome.results` |
| 12 | `canvas-editor.tsx:403-409` 只向 NodeGraph 传 `nodeResults`；`:280-285` 上游文案 | 属实（T0） | T0 = `:403`（`git show 28ac7440` 实测 CanvasStrip 在 `:402`、NodeGraph 在 `:403`）；T2 = `:404`/`:283`（±2） |
| 13 | `node-schema.ts:88-174` 10 个 `chart-*` 字段声明 | 属实 | 逐条一致（chart-pie 108 / chart-donut 117 / chart-kpi 126 / chart-funnel 135 / chart-boxplot 144 / chart-map 161 / chart-radar 170 等） |
| 14 | 附录「`buildChartJsData` 已带单测 `src/test/chart/chart-source.test.ts`」 | 属实 | `chart-source.test.ts:10 import { buildChartJsData, resolveChartData }` |
| 15 | 附录「`figure-registry.ts` 仅导出 HTML 片段」 | 属实 | `figure-registry.ts:39 renderFigure(item, context) => string` |
| 16 | 附录「`visualization-bridge.ts`（8 行，空转，**目前无消费方**）」 | **不符** | 存在消费方：`src/features/database-workspace/state/workbench-types.ts:9 import type { Visualization } from "../../visualization/visualization-bridge";` |
| 17 | 附录「`echarts ^5.6.0`」 | 属实 | `package.json:40` |
| 18 | §3 设计稿行号 `NodeGraph.tsx:169` / `:198` | **不符** | 实际 `:171` / `:200`（`ui-mock/dbx-bi-editor.astravia-design/components/editor/NodeGraph.tsx`） |
| 19 | §6 P0.4 路线 C 依赖 `shell.ts:26-39 buildHtmlHead()` | **不符（轻微）** | 实际 `buildHtmlHead()` 跨 `shell.ts:26-47` |
| 20 | §1 L5「`chart-engine/renderer/**`、`domain/chart-contract.ts`、`domain/chart-source.ts` … 唯一使用者 `tools/dbx-chart-collection.ts`」 | 部分不符 | 对 **chart-engine 渲染器**与 **chart-source** 属实（除单测）；对 **chart-contract** 不成立：另有 `chart-engine/renderer/figures/*.ts` 8 处、`domain/{dataset-spec,visualization-doc,dataset-filter,workbench-session,chart-source}.ts` 5 处、`visualization-bridge.ts:8` 1 处 |
| 21 | 报告称 `charts.tsx` 共 191 行 | **不符（轻微）** | `wc -l` = **198** |
| 22 | §5「未提交改动…没有任何一处触及节点创建、`chartValues`、`runAll`/`runNode`、图表类型分派或 `values.*` 字段读取」 | 属实（**跨时点仍成立**） | T0 的 9 文件 diff 已逐项核对未触及；T2 虽 `use-canvas-execution.ts`/`node-graph.tsx` 再次被改，但改动内容为 `RunOutcome.results` 回传与 Minimap/吸附交互，`chartValues`/分派语义未变（C2/C3 复核通过） |
| 23 | §5 数字类（`git status` = 9 修改 + 3 未跟踪；`git diff --stat` = 9 files/246+/49-；`plugin.json` 仅 styles[]） | **证据不足（无快照可复算）** | 其"文件清单内容"可核对项全部一致（`node-library.tsx` 折叠态、`add-node-menu.tsx` 64→32、`node-graph.tsx` 删 `hot`、`charts.tsx` hex→`var(--color-series-N)`、3 个未跟踪新模块）；但精确 246/49 无 T0 快照留存。**对 T2 不符**：现为 2 files/29+/28-，`plugin.json` 的 0.4.61→0.4.62 版本与样式哈希已随 v0.4.62 提交，不再出现在 diff 中 |
| 24 | §7.1 `npm test` = 692 tests / 668 pass / 13 fail / 11 cancelled、9 个文件级失败 | 属实 | 见 §4.1（`/tmp/dbx-test.log` 尾行逐字吻合） |
| 25 | §7.1「其中**至少 7 个**（含 `bigscreen-*.test.ts`、`src/test/ui/*`）首因是 esbuild 平台不匹配」 | 数字属实 / **举例不精确** | 实测 **8** 个文件首因 esbuild（≥7 成立）；但 `src/test/ui/menu-placement.test.ts` 首因是 `ERR_MODULE_NOT_FOUND`（真实失效 import，非环境） |
| 26 | §7.1 `npm run check` = 379 errors，全部位于 `src/test/**` 与 `server/test/**`，生产源码零类型错误 | **属实（对 T0）** / **不可复现（对 T1/T2）** | 关键反证已完成：`git show 28ac7440:./src/features/bi-editor/canvas/components/canvas-strip.tsx` 的 `interface Props { nodeCount?: number; linkCount?: number; }` —— 当时 `canvas-editor.tsx:402` 只传这两个 props **是合法的**，故 T0 时点生产源码可以零错误。T2 不成立（`canvas-editor.tsx:404` TS2740 静态可证） |
| 27 | §7.2 五步实机验证 + §8 六条残余风险 | 属实（作为风险披露完备） | 步骤 2 的**预期值**需修正，见 §7 建议 4 |
| 28 | §2 归因排序（5 条）与排序依据 | 属实 | 与 C1–C6 一致；"原因 1、2 任一条足以让用户得出不能真正渲染的结论"这一判断成立 |
| 29 | §4 依据 ADR-0001 判定"已知缺口、非本次回归" | 属实 | `docs/adr/adr-0001-bi-workbench-first-screen.md:120`「节点功能打通归编辑器专项 ADR」、`:156`「自动创建 chart 节点」未勾选；`docs/adr/` 下确无后续 ADR |

---

## 4. 验证基线复核实测

### 4.1 `npm test`（只读重跑，日志 `/tmp/dbx-test.log`）

- 尾行逐字：`# tests 692 / # pass 668 / # fail 13 / # cancelled 11` ⇒ **与报告一致，属实**。
- 文件级失败 **9** 个（TAP `not ok N - src/...test.ts`）：

| 文件 | 首因 |
| --- | --- |
| `src/test/api/api-connection-fields.test.ts` | esbuild 平台不匹配 |
| `src/test/bigscreen/bigscreen-empty-canvas.test.ts` | esbuild |
| `src/test/bigscreen/bigscreen-screen-save.test.ts` | esbuild |
| `src/test/connection/driver-manager-page.test.ts` | esbuild |
| `src/test/ui/context-menu.test.ts` | esbuild |
| `src/test/ui/page-size-menu.test.ts` | esbuild |
| `src/test/ui/result-grid.test.ts` | esbuild |
| `src/test/ui/settings-panel.test.ts` | esbuild |
| `src/test/ui/menu-placement.test.ts` | **`ERR_MODULE_NOT_FOUND`**：`Cannot find module '…/src/shared/utils/menu-placement.ts' imported from …/src/test/ui/menu-placement.test.ts` |

- ⇒ **8 环境 + 1 真实代码缺陷**；报告"至少 7 个因 esbuild"数字成立但把 `src/test/ui/*` 整体归因不准确。
- 另两处非文件级失败：`not ok 56 - useConnectionEditor`（4 个 `AssertionError`，`src/test/api/use-connection-editor.test.ts:172`，真实断言失败）；`not ok 98`（E2E，`Cannot find module '…/src/server/src/http-server.mjs'` —— 该文件不存在，`server/src/` 只有 `http-server.ts`）。
- 结论：报告 §8 #6「13 fail 中已定位 7 个环境、其余 6 个未逐一排查」**在审计中已可收敛**（9 文件级全部归因 + 2 个非文件级）：这是报告可**补强**项，不是缺陷。
- **证据可复现性**：本表数字在 21:18 对 `/tmp/dbx-test.log` 二次读取复核，与首次结论逐字一致（`# tests 692 / # pass 668 / # fail 13 / # cancelled 11`、9 个 `not ok` 行号 1695/2008/2056/2819/4865/4895/4943/4991/5052、esbuild 块 8、`ERR_MODULE_NOT_FOUND` 4879；日志 mtime 20:52:41，`npm test` 自身 EXIT=1）。注意该日志位于 `/tmp`，重跑会覆盖同一路径，故上述数字以本报告记录为准。

### 4.2 报告 §7.1 关于 `bigscreen-empty-canvas.test.ts` 的推论

报告称它是"唯一直接渲染 `BigscreenEditor` 的用例"，且因 esbuild 跑不起来 —— **属实**（该文件确在 esbuild 失败列表内）。故报告"当前环境没有可执行的画布自动化回归网"**成立**，`grep -rn "node-graph\|bi-editor" src/test` 亦仅命中 `bigscreen-*.test.ts` 两个文件（**DnD / 图表节点渲染零覆盖**，与报告一致）。

### 4.3 `npm run check`（只读重跑）

| 时点 | 输出 | 归属 |
| --- | --- | --- |
| T0（报告） | 379 errors | 全 test（无法直接复现，但已由 canvas-strip Props 反证为**可信**） |
| T1（审计首次） | 382 errors | 生产 3 + test 379 |
| T1′ | 4 errors | 全为 `use-canvas-execution.ts` 解析错误（并发瞬态，其后被提交修好） |
| T1″ | 386 errors | 生产 6 + test 380 |
| T2（21:15:08） | 13 errors | **全为 `node-graph.tsx` 解析错误** ⇒ tsc 跳过全部语义诊断 |

已实测的机制（`/tmp/tsbehave` 实验确证）：**任一被 include 文件存在语法错误时，`tsc --noEmit` 只输出解析错误、完全跳过语义诊断**。这解释了 382→4 的落差，也是 T2 输出不可读作语义基线的原因。

---

## 5. §6 修复方案技术前提核对

### 5.1 技术前提

| 前提 | 判定 | 证据 |
| --- | --- | --- |
| `buildChartJsData(item, source, rows)` 已实现"行 → `{labels, datasets}`" | 属实 | `domain/chart-source.ts:39`；`:19 SINGLE_SERIES_TYPES`（pie/doughnut/funnel 自动单系列） |
| `ChartSource` 仅 3 字段、无需扩展 | 属实 | `domain/chart-contract.ts:62` |
| **"构造一个合成的 `ChartSource` 即可直接调用"** | **不完整** | 该函数是**三参** `buildChartJsData(item, source, rows)`，还需构造 `ChartItem`（`chart-contract.ts:37`，含 `type/title/…`），报告未提 |
| **返回结构可直接喂给画布** | **需转换** | `buildChartJsData` 返回 Chart.js 形状 `{labels, datasets}`，而画布 `<AreaChart values={number[]}>`（`shared/components/charts.tsx:45`）入参是**数值数组** ⇒ 需要一层 `datasets[0].data` 提取/适配；报告 P0.1 未写这一步 |
| 上游真实数据来源是 `getUpstreamData` | 属实 | `use-canvas-execution.ts:229-253`（T0 `:220-245`）；语义：无入边 → `null`；全列空 → `null`；否则 `{columns, rows, rowCount, durationMs: 0}` |
| `links` 已传入 NodeGraph ⇒ 可零成本让 NodeGraph 自己算上游 | 属实 | `canvas-editor.tsx:405+` 传 `links`；`getUpstreamData` 目前仅被 `canvas-editor.tsx:283/322` 用于运行状态文案 |
| 路线 A（扩 `charts.tsx`）可行 | 属实 | `charts.tsx` 已导出 `SERIES/seriesColor/ticks/yPercent/AreaChart/Sparkline/Bars/HBars/Donut/Funnel/Gauge`（198 行），`Bars/HBars/Funnel/Gauge` 在画布侧零引用，可直接接入 |
| 路线 B（引入 ECharts）可行 | 属实（有依赖） | `package.json:40 echarts ^5.6.0`；`recharts ^3.10.1` 亦在依赖中但**全仓 0 import** |
| 路线 C（iframe + `shell.ts`）可行 | 属实 | `shell.ts:14 ECHARTS_CDN`、`:26-47 buildHtmlHead()`；唯一范例 `tools/dbx-chart-collection.ts` 用 `renderFigure` 产 HTML 片段 |
| `chart-*` 注册面 10/10/6 的说法 | 属实 | 见 §5.2 |
| P0.2 缺 `chart-donut` 拖不出来（设计稿主推） | 属实 | 节点库图表组 6 项无 donut；`chart-donut` 在 schema（`node-schema.ts:117`）与模板（`node-graph.tsx` NODE_TEMPLATES）里都有 |
| `chart-kpi` 落入 `isChart` 画面积图 | 属实 | `isMetric = kind.startsWith("metric-")`（T2 `:1362`）不含 `chart-kpi`；大数字分支只服务 `metric-*`（`metric-big/metric-trend/metric-gauge`） |

### 5.2 注册面差集（T2 实测）

| 集合 | 数量 | 关键差异 |
| --- | --- | --- |
| `node-library.tsx` GROUPS 图表组 | 6 | `chart-line/bar/pie/kpi/funnel/boxplot` |
| `node-graph.tsx` `NODE_TEMPLATES` `chart-*` | 10 | 多 `chart-donut/scatter/map/radar` |
| `node-schema.ts` `NODE_SCHEMA` `chart-*` | 10 | 同模板集合 |
| 渲染 fallback | 2 条分支 | `chart-pie`/`chart-donut` → `<Donut>`；**其余 8 类 → `<AreaChart>`** |

⇒ `chart-donut`（设计稿主推）**可在模板/schema 中命中但拖不出来**；`chart-scatter/map/radar` 同理。报告 §1 L6 与 §6 P2 的表述准确。

---

## 6. §8 遗漏风险（审计补充）

报告 §8 六条残余风险本身**无需删除**，但缺以下 6 项：

1. **当前 HEAD 的已提交生产类型错误未纳入残余风险**：`canvas-editor.tsx:404` TS2740（`CanvasStrip` 缺 9 个必填 props）+ 运行时 `palette.description` 解引用（见 §1）。它比报告 §8 #2「宿主是否拦 `application/json`」更前置：中栏可能整块渲染失败。
2. **工作区在飞语法错误**：T2 实测 `node-graph.tsx` 13 条解析错误 ⇒ 此刻"按报告开工"会遇到不编译的工作区；应先与在飞改动收口（报告 §5 只提示了"避免冲突"，未提示"当前可能不编译"）。
3. **`dist/` 与 `src` 的关系已可量化**（部分解答 §8 #3）：`dist/` 构建时间 `Oct 14 20:34`，而 `canvas-strip.tsx`(20:46)、`canvas-editor.tsx`(20:55)、`node-graph.tsx`(21:14)、`use-canvas-execution.ts`(21:01) 等均更晚 ⇒ **本地 `dist/` 必然不代表当前 `src`**，不能用于验证；用户装机包来自 CI，另论。
4. **测试网的腐化不止 esbuild**：`src/test/**` 现有约 380 条类型错误 + 1 处失效 import（`menu-placement`）⇒ 报告"先修本地 esbuild 平台问题"不足以恢复回归网，还需修测试源码本身。
5. **图表节点的"可配置假象"未列为风险**：`values.*` 字段可填、可保存、可在属性面板显示上游行数，但渲染链零消费 ⇒ 用户会得到"配置有效"的错误反馈（报告 §2 #3 已述事实，但未作为残余风险/UX 风险单列）。
6. **`recharts` 已在依赖中但零引用**：若选路线 A，报告未评估是否应清理该依赖；若选路线 B，也未说明它可作为轻量备选（审计仅记录事实，不作方案建议）。

---

## 7. 报告需修正项清单

### 阻断级（报告本身）
**无。**

### 应修级

1. 附录：「`visualization-bridge.ts` … 目前无消费方」→ **不符**。正确值：`src/features/database-workspace/state/workbench-types.ts:9` 已 import 该桥接层的 `Visualization` 类型。
2. §7.1：「至少 7 个（含 … `src/test/ui/*`）的失败首因是 esbuild」→ 计数成立（实测 8），但将 `src/test/ui/*` 整体归因 esbuild 不准确；应单列 `src/test/ui/menu-placement.test.ts` 的真实失效 import（`src/shared/utils/menu-placement.ts` 不存在，实际文件在 `src/shared/components/menu-placement.ts`）。
3. §1 L5：「`chart-engine/renderer/**`、`domain/chart-contract.ts`、`domain/chart-source.ts` … 唯一使用者 `tools/dbx-chart-collection.ts`」→ 应限定作用域。正确值：引擎渲染器与 `chart-source` 确实只有该工具（+单测）消费；`chart-contract` 另有图形渲染器 8 处、`domain/*` 5 处、`visualization-bridge.ts:8` 1 处消费。
4. §5 与 §7.1 的所有数字类声明**必须补测量时点**：明确标注"以下数字为撰写时点的工作区快照"（否则读者会把 `9 files/246+/49-`、`379 errors 全 test` 当成当前事实）。**尤其 §7.1 的"生产源码零类型错误"在 T2 已不成立**（见 §1），这是本审计最容易被误用的结论。
5. §3 设计稿行号：`NodeGraph.tsx:169` → `:171`、`:198` → `:200`。

### 建议级

1. `charts.tsx` 191 行 → 198 行。
2. §6 路线 C 的 `shell.ts:26-39 buildHtmlHead()` → `:26-47`。
3. §6 P0.1：补两句技术前提 ——（a）`buildChartJsData` 是**三参**，除 `ChartSource` 外还需构造 `ChartItem`；（b）其返回 `{labels, datasets}`（Chart.js 形状）与画布 `<AreaChart values={number[]}>` 入参形状不同，需显式转换。
4. §7.2 步骤 2 的预期值：「预期 `无数据`」不准确。按源码，连线上游且上游成功时面板显示 **`N 行（上游）`**（`canvas-editor.tsx:283`/`:322` + `use-canvas-execution.ts:229-253`），只有无连线/无列时才显示 `无数据`（`:285`/`:316`），非数据源无上游时为 `无上游数据`（`:324`）。
5. 报告中所有行号引用建议统一标注「快照：HEAD xxxxx / 文件 N 行」，因为 `node-graph.tsx` 已由 1647 → 1941 行（chart 区整体位移 +319）。
6. §8 #3 可由"未确定"升级为"已确定 dist ≠ 当前 src"（依据见 §6 第 3 条）。

---

## 8. 无法核实事项（明确不下结论）

1. **Electron 宿主是否拦截 `application/json` 自定义 MIME** —— 未实机验证；这是唯一能翻案 C1（拖拽链正常）的路径。
2. **`CanvasStrip` 渲染期是否真的抛错** —— 类型层与代码路径已确证缺失必填 prop，但"必然抛 TypeError"属**推断**（依据 `canvas-strip.tsx:70 palette.description` 在渲染期直接解引用、唯一调用点未传该 prop）；需在 Astravia 内实机打开 BI 编辑器确认是否有 ErrorBoundary 兜底。
3. **用户实际安装的版本与 `dist/` 是否一致** —— 用户报障所用包来自 CI 或本地 `dist/` 无法区分；本地 `dist/` 已知陈旧（见 §6 第 3 条）。
4. **是否有未合并的修复分支/PR** —— 未检索远端。
5. **`screen-*` / `adv-*` / `output-*` 三类节点的渲染分支** —— 本次仅确认 `screen-editor.tsx:737` 同款哈希占位（报告已引），其余分支未逐一判定。
6. **T0 的 `git diff --stat` 精确数字（246/49）** —— 无快照留存，只能核对文件清单与改动性质。
7. **`plugin.json` 的 `styles[]` 与 `dist` 的对应性** —— 观察到 `dist/assets/style-c8d16b4e89.css` 存在且与当前 `plugin.json` 同名，但未核对内容哈希。

---

## 9. 审计方法与命令清单

- 逐行核对：`read`（报告 1–262、node-graph.tsx 全文、use-canvas-execution.ts 全文、canvas-strip/canvas-editor/node-card/node-schema/node-library/charts.tsx/chart-contract/chart-source/shell.ts/figure-registry/bridge）。
- 快照取证：`git show 28ac7440:./<path>`（必须带 `./`，插件在子目录）、`git show HEAD:./<path>`、`git diff --stat 28ac7440 6336c6b4`、`git reflog -3`。
- 语义核对：`grep -rn` 全仓搜索 `nodeResults|setNodeResults|resultsRef`、`runAll(|runNode(`、`values.<绑定字段>`、`echarts|iframe|srcDoc`、`chart-engine|chart-contract|chart-source`、`visualization-bridge`。
- 基线复跑（只读）：`npm test`（日志 `/tmp/dbx-test.log`）、`npm run check`（`/tmp/dbx-check*.log`，含 T2 的 `/tmp/dbx-check5.log`）；未执行 `npm run build`（会写 `dist/`）。
- 未修改任何仓库文件；临时产物全部写 `/tmp`。

**审计裁定：报告的核心事实与结论成立，予以采纳；文字层面按 §7 清单修正后即可作为实施依据。当前工作区另有两项报告之后引入的阻断级回归（`CanvasStrip` 契约断裂、`node-graph.tsx` 在飞语法错误），须在动工修图表前先处理。**
