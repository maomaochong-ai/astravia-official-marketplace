# BI 画布图表节点「拖入后不能真正生成并渲染图表」根因调研报告

- 调研对象：`abilities/plugins/dbx-pro` 的 BI 画布（节点图编辑器）
- **代码基线（快照）**：HEAD `28ac7440`（v0.4.61）时的 `src/features/bi-editor/`——`node-graph.tsx` 1647 行、`use-canvas-execution.ts` 304 行、`canvas-editor.tsx` 522 行。**本报告所有 `文件:行号` 引用均对应该快照**；工作区此后被并发开发推进（`node-graph.tsx` 已涨到约 1940 行），时点与新增风险见 §5、§8。
- 一手事实清单（F1–F18，逐条带 `文件:行号` + 代码片段）：见同目录
  [chart-node-render-investigation.md](./chart-node-render-investigation.md)
- 独立审计（对手写结论逐条对账源码）：见同目录
  [chart-node-root-cause-audit.md](./chart-node-root-cause-audit.md) —— 裁定「核心事实与结论成立，予以采纳」，**报告本身无阻断性发现**；本版已按审计 §7 的「应修 / 建议」清单修正文字层面问题，并补入审计新增的风险项（§8.7–§8.10）
- 本报告在事实清单之上做**归因、分层与修复方案**；凡未在源码中读到的内容一律标为「推断」或列入「证据不足」
- 未做 Electron 实机拖拽验证（见 §7、§8）

---

## 0. 结论

用户描述的现象**在渲染结果层成立，在事件层不成立**。

拖拽链路是通的，节点确实被创建；问题是**创建出来的图表节点是一个「带占位图的卡片」**：

1. 除饼/环外，**所有**图表类型都渲染成同一条面积图（`node-graph.tsx:1119-1135`）；
2. 数据**恒为 FNV-1a 哈希伪随机序列**，永不来自查询结果（`node-graph.tsx:1055-1060` + `use-canvas-execution.ts:270-278`）；
3. 属性面板收集的 `xField / yField / category / valueField / stageField / geoField` 等绑定**在整条渲染链上没有任何读取点**（`node-schema.ts:88-174` vs `node-graph.tsx` 的 `values.*` 读取点清单）；
4. 仓库里**确实存在**一套真实图表能力（ECharts / Chart.js + 数据映射 + 已注册图形），但它**与画布零连接**（`bi-editor` 内 `echarts|iframe|srcDoc` 命中 0，对 `chart-engine|chart-contract|chart-source` 的 import 命中 0）。

一句话：**这不是拖拽 bug，而是「图表节点 = 带图表的占位卡」这一实现现状**——能力存在，接线缺失。

该缺口在文档层是**已被明示延期的工作项**，不是本次改动引入的回归：`adr-0001` 把「节点功能打通」划给一份**尚未存在**的后续 ADR（`docs/adr/` 下只有 adr-0001）。

---

## 1. 事实链（六层，自外向内）

| 层 | 环节 | 实际行为 | 关键证据 | 判定 |
| --- | --- | --- | --- | --- |
| L1 | 拖拽 → 创建节点 | 载荷写入 → `dragOver` preventDefault → `drop` → `setNodes` 写入新节点 | `node-library.tsx:286-297`；`node-graph.tsx:224-228, 920-922, 229-233, 258-273` | **正常，已排除** |
| L1b | 落点坐标 | `screenToCanvas` 已减 `rect.left/top` 并除 `v.scale` | `node-graph.tsx:186-194`、`197-204` | **正常，已排除** |
| L2 | 图形渲染 | 只 import `AreaChart`/`Donut`；仅 `chart-pie`/`chart-donut` 分流，其余全走 `<AreaChart>` | `node-graph.tsx:18`、`1042`、`1119-1135` | **与所选类型不符（缺陷）** |
| L3 | 数据来源 | 只读 `nodeResults[id]`，否则 `hashValues(\`node-${id}\`,14,30,88)`；而图表节点**永不被执行** → 恒为哈希 | `node-graph.tsx:1037`、`1055-1060`；`use-canvas-execution.ts:217-218`、`270-278` | **恒为假数据（缺陷）** |
| L3b | 上游数据 | `getUpstreamData` 存在，但只用于运行面板文案「N 行（上游）」，未传给 `NodeGraph` | `use-canvas-execution.ts:220-245`；`canvas-editor.tsx:403-409`、`280-285` | **存在但未接线（缺陷）** |
| L4 | 字段绑定 | `NODE_SCHEMA` 声明了各图表的 X/Y/维度/数值字段，渲染层完全不读 | `node-schema.ts:88-174` vs `node-graph.tsx` 读取点仅 `title/sql/table/datasourceId/placeholder/field/mode/metric` | **配置空转（缺陷）** |
| L5 | 真实图表引擎 | 引擎在仓库里，画布没用（`bi-editor` 内 0 import）；`recharts` 是依赖但全仓库 0 处 import | `chart-engine/renderer/**`、`domain/chart-contract.ts`、`domain/chart-source.ts`；`chart-source` 的使用者只有 `tools/dbx-chart-collection.ts`（+ 单测）；**`chart-contract` 另被 `chart-engine/renderer/figures/*`（8 处）、`domain/*`（5 处）、`visualization-bridge.ts:8`（1 处）消费** | **未接线（根因之一）** |
| L6 | 节点库暴露面 | 图表组只暴露 6 种，而模板/属性 schema 有 10 种；「从数据集生成」是 `notify` 桩 | `node-library.tsx`（图表组 6 项）、`node-graph.tsx:113,122-132`、`node-schema.ts:88-174`、`node-library.tsx:249-267`（桩 `notify` `:253-256`，message `:254`） | **注册面不一致（缺陷）** |

### L2 细节

```tsx
// node-graph.tsx:18 —— 图表节点只引入两个渲染器
import { AreaChart, Donut, SERIES } from "../../shared/components/charts";
```

```tsx
// node-graph.tsx:1119-1135
{isChart && (
  <div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface p-1 text-[10px] text-muted">
    {kind === "chart-pie" || kind === "chart-donut" ? (
      <Donut segments={chartValues.slice(0, 4).map((v, i) => ({
        value: Math.max(5, v), color: SERIES[i % SERIES.length],
      }))} size={56} thickness={8} holeFill="var(--color-surface)" />
    ) : (
      <AreaChart values={chartValues} stroke={SERIES[1]} />
    )}
  </div>
)}
```

- `shared/components/charts.tsx`（198 行）实际导出 `AreaChart / Sparkline / Bars / HBars / Donut / Funnel / Gauge`，其中 **`Bars`、`HBars`、`Funnel`、`Gauge` 在 `node-graph.tsx` 里零引用**。
- 后果：拖 `chart-bar` / `chart-funnel` / `chart-boxplot` / `chart-scatter` / `chart-radar` / `chart-map` 得到的都是同一条面积图，**用户的直觉判断「这不是我拖的那个图」完全正确**。
- 附带缺陷：`chart-kpi` 的 kind 以 `chart-` 开头，会进 `isChart` 分支画面积图，而**不是**大数字——大数字分支 `:1137-1144` 只服务 `metric-*`（`:1043` `isMetric = kind.startsWith("metric-")`）这三个「向后兼容」kind。

### L3 细节

```tsx
// node-graph.tsx:1055-1060
const chartValues = result && result.columns.length > 0
	? result.rows.slice(0, 14).map((r) => {
		const numVal = Object.values(r).find((v) => typeof v === "number");
		return typeof numVal === "number" ? numVal : 0;
	})
	: hashValues(`node-${id}`, 14, 30, 88);
```

```ts
// use-canvas-execution.ts:270-278
for (const id of order) {
	const node = nodes[id];
	const kind = node.kind ?? "";
	if (kind.startsWith("source-")) {
		await runNode(id, node);
	}
}
```

`runNode` 的分支全集只有 `source-sql:96` / `source-table:128` / `source-connector:161` / `source-csv:189` / `source-extract`+`source-api:203`。

因此：**`nodeResults` 里只可能出现数据源节点的 key**，图表节点的 `result` 恒为 `undefined`，`chartValues` 恒等于 `hashValues("node-"+id, 14, 30, 88)`。

伪随机是有意为之，且已按用户要求避开设计稿 mock 数据：

```tsx
// node-graph.tsx:90-95
 * 不抄设计稿 GMV mock 数据（[42,48,45,55,51,…] 是设计稿的硬编码，用户明确禁止），
 * 而是用 seed 哈希出自己的稳定序列，保证每次打开画布图表形状一致但数值来源独立。
```

**结论：哈希序列是「当前唯一可能的数据」这一事实的产物，而不是错误；错误在于上游真实数据从未被接进来。**

---

## 2. 为什么「拖入的图表不会真的渲染」——归因排序

| # | 原因 | 影响 | 证据 |
| --- | --- | --- | --- |
| 1 | 图表节点没有数据通路：`nodeResults[id]` 永为空、上游数据未接入渲染 | 用户看到的是**无意义的稳定假数据** | `node-graph.tsx:1037,1055-1060`；`use-canvas-execution.ts:270-278`；`canvas-editor.tsx:403-409` |
| 2 | 类型分派缺失：10 种 `chart-*` 共用 2 个渲染器 | 用户看到的是**错误的图形** | `node-graph.tsx:18,1119-1135` |
| 3 | 字段绑定未消费：schema 里的 X/Y/维度/数值不被读取 | 用户在属性面板里改配置**看不到任何变化** | `node-schema.ts:88-174` vs `node-graph.tsx` values 读取点 |
| 4 | 真实引擎未接线：ECharts / Chart.js 能力与画布零连接 | 即使数据接上，也**没有高保真渲染器可用** | `bi-editor` 内 `echarts|iframe|srcDoc` 命中 0 |
| 5 | 注册面不一致：模板 10 种 / 属性面板 10 种 / 节点库 6 种 | 部分类型**根本拖不出来**，且三处口径不符 | `node-library.tsx` 图表组；`node-graph.tsx:113`；`node-schema.ts` |

排序依据：原因 1、2 单独任一条就足以让用户得出「不能真正生成并渲染图表」的结论；原因 3 是复现路径上的二次打击（用户按提示去配置字段，图形毫无反应）。

---

## 3. 设计意图 vs 实现（设计稿证据）

设计源：`ui-mock/dbx-bi-editor.astravia-design/`

| 设计稿约定 | 位置 | 实现现状 |
| --- | --- | --- |
| 图表节点卡片带 **结果集 / 维度 / 数值 / 图形 / 输出去向** 等映射行 | `components/editor/NodeGraph.tsx:168-195`（`title="GMV 趋势" type="chartjs · line"`） | 画布只渲染 `values.title`（`node-graph.tsx:1038`），无任何映射行 |
| 图表节点**标签声明图表库**：`chartjs · line` / `chartjs · doughnut` | 同上 `:171`、`:200` | 实现是自绘 SVG（`shared/components/charts.tsx`）+ 未接线的 ECharts，**声明与实现不符** |
| 图表组 6 种，每种声明字段映射（X 轴/Y 轴/维度/内环/度量/对比/阶段/口径/分组/指标） | `frames/nodes.tsx:57-110` | 节点库确实是这 6 种，但**映射字段不参与渲染**（§1 L4） |
| 「图表节点消费 table 输出」；「运行与否由下游图表节点决定」 | `frames/data.tsx:23-34, 197, 251` | `runAll` 只跑 `source-*`，图表节点**不触发上游**，也不消费输出 |

> 设计意图是清晰的：**图表节点 = 具体类型的图 + 显式字段映射 + 从上游 table 插座取数**。实现保留了视觉外壳，把数据与类型分派整段留空。

---

## 4. 文档层印证：这是已知延期项

`docs/adr/adr-0001-bi-workbench-first-screen.md`：

- `:7` 「本文件是首屏工作台的决策；画布编辑器（canvas-editor / node-graph）的详细决策见后续 ADR。」
- `:38` 「**Canvas 编辑器内部 gap**（不在本 ADR 范围，归 canvas-editor 专项 ADR）：属性面板覆盖不全、节点执行链路只打通 AI 路径、保存→compile→render 闭环不完整。」
- `:120` 非目标：「❌ 不改 canvas-editor / node-graph 内部实现（节点功能打通归编辑器专项 ADR）」
- `:156` 未勾选待办：「"从数据集新建" → 弹出数据集选择对话框 → 选表选字段 → **自动创建 canvas 项目 + 初始 chart 节点**」
- Phase 2：「预览缩略图从静态 hash 改成节点图真实渲染（Phase 2 末期或 Phase 4）」

三点核对结果：

1. **承诺的后续 ADR 不存在**：`docs/adr/` 目录下只有 `adr-0001-bi-workbench-first-screen.md`。→ 修复方案仍未定稿。
2. **「节点执行链路只打通 AI 路径」与实际一致**：`canvas-editor.tsx:456-483` 的 AI 插入（`onInsert`）只把 `title` 写进**已存在**的图表节点（`:475` `values: { ...(n.values ?? {}), title: aiResult.resultName }`）、且**不新建图表节点**（找不到图表节点时 `:482` 只提示「画布上没有图表节点，AI 无法写入」），随后调用的 `handleRunAll`（`:479`）又不会执行图表节点。→ AI 路径同样产不出图表数据。
3. **ADR 对文件名已过时**：ADR 里写的 `bigscreen-workspace.tsx`（478 行）在 `workbench/` 已不存在，现为 `bi-workspace.tsx`（50355 B）；全仓库 `grep -rn "bigscreen-workspace|BigscreenWorkspace" src` 无命中。ADR 把 `bi-workbench.tsx` 标为「💀 死代码」，该判定仍成立（仅被 `bi-editor/index.ts` re-export，无生产 import）。

---

## 5. 非回归证明（含工作区在飞改动）

> 本节数字均为**测量时点快照**；仓库在工作区被并发开发持续推进，数字会过期。
> - **T0** = 2026-10-14 20:4x，HEAD `28ac7440`（v0.4.61）——本报告引用行号的基准快照。
> - **T2** = 2026-10-14 21:15，HEAD `1b1d24ab`（v0.4.63，经两次 `commit --amend`）：`git status --short` = **2 个修改文件**，`git diff --stat` = **2 files / 29 insertions / 28 deletions**。T0 记录的「9 个修改 + 3 个未跟踪新模块」**已被并发开发提交**，因此不再出现在 status 里。

1. **与本问题无因果关系（T0 证据）**：T0 的未提交改动为 9 个修改文件 + 3 个未跟踪新模块。
   - 已修改（T0 `git diff --stat`：9 files, 246 insertions, 49 deletions）：`plugin.json`（仅 `styles[]` 里 CSS 文件名，版本号当时已提交为 0.4.61）、`agent-session.tsx`（草稿态 `useState` 改常量）、`add-node-menu.tsx`（菜单头高 64→32、删除搜索条）、`canvas-strip.tsx`（**新增**调色板/网格步长/缩放视图控制）、`editor-status-bar.tsx`（**新增**状态栏信息）、`node-graph.tsx`（删除未使用变量 `hot`，连线 `strokeWidth`/`opacity` 去掉 hot 分支）、`node-library.tsx`（删除折叠态展开按钮与分隔线）、`charts.tsx`（硬编码 hex → `var(--color-series-N)` 主题化，SVG 描边改为 `style` 下传）、`bi-workspace.tsx`（`bg-[#…]` → `bg-series-N`、删除隐藏 `<span>`）。
   - 未跟踪新增：`canvas/lib/auto-layout.ts`（140 行）、`canvas/hooks/use-canvas-history.ts`（157 行）、`shared/canvas-palettes.ts`（76 行）。
   - 逐项核对结论：**没有任何一处触及节点创建、`chartValues`、`runAll`/`runNode`、图表类型分派或 `values.*` 字段读取**。`charts.tsx` 的改动只改配色来源（`canvas-palettes.ts:8` 注释确认它服务 `var(--color-series-N)`），**不改图表语义**。
2. **本问题不是「只有看板模式才有」**：`screen-editor.tsx:23,737` 用同一套占位写法（`hashSeries(seed, 14)`）——大屏模式同样如此。
3. **不是拖拽实现缺失**：见 §1 L1/L1b，载荷、drop 绑定、`setNodes`、坐标换算四处均已逐行核对正确。
4. **但「非回归」≠「工作区健康」（T2 新增事实，审计 §1）**：T2 的工作区存在**本报告撰写之后**由并发开发引入的两处阻断级问题，**与「图表为什么画不出来」无关，但会挡住按 §6 动工**：
   - **`CanvasStrip` 契约断裂**：`canvas-strip.tsx:27-35` 新增了 9 个**必填** prop（含 `palette: CanvasPalette;`，无 `?`），而唯一调用点 `canvas-editor.tsx:404` 只传了 `nodeCount`/`linkCount` → 类型错误 `TS2740`，且渲染期 `palette` 为 `undefined` 时会解引用（`canvas-strip.tsx:70` `palette.description`、`:81` `paletteSwatch(palette, i)`、`:85` `palette.label`）。T0 快照里这些 prop 是可选（`nodeCount?: number`），属新引入。
   - **`node-graph.tsx` 在飞语法错误**：T2 该文件约 1940 行（T0 为 1647 行）且正被编辑，`npm run check` 此时只输出 **13 条解析错误**（`node-graph.tsx(1634,8) TS1003 … (1737,1) TS1128`）——**工作区当前不编译**；且 tsc 在任一 include 文件存在语法错误时**会跳过全部语义诊断**，此时的检查数字不能当语义基线（机制已实测确证）。
   - **结论：修图表之前先修这两处**，否则后续一切「已验证」都建立在不编译的工作区上。

---

## 6. 修复方案

### P0 —— 让拖入的图表节点「真的是图表、且用真实数据」

**P0.1 数据通路（最高优先级，改动最小、收益最大）**

- 新增 `resolveNodeChartData(node, upstreamResult, kind)`：把上游 `NodeResult.rows` + `node.values.{xField,yField,...}` 映射成 `{ labels, datasets }`。
- **优先复用现成实现，但有两个前置条件（审计 §5 补齐）**：`src/domain/chart-source.ts:39 buildChartJsData(item, source, rows)` 已实现「行 → `{labels, datasets}`，按 `ChartSource{labelColumn, valueColumns}` 映射，pie/doughnut/funnel 自动单系列（`:19 SINGLE_SERIES_TYPES`）」。但 ——
  - (a) 它是**三参**函数：除合成 `ChartSource`（`domain/chart-contract.ts:62`，只有三个字段，无需扩展）外，**还需构造一个 `ChartItem`**（`domain/chart-contract.ts:37`：`type; data; options?; title?; …`），原写「构造一个合成的 `ChartSource` 即可直接调用」**不完整**；
  - (b) 它的返回是 **Chart.js 形状的 `{labels, datasets}`**，而画布现有 `<AreaChart values={number[]}>`（`shared/components/charts.tsx:45`）吃的是**数值数组**，**必须再写一层适配**（取 `datasets[0].data`，并决定 `labels` 是否在卡片上显示）——不是「返回结构可直接喂给画布」。
- 数据来源顺序：`nodeResults[id]`（若将来图表节点会被执行）→ `getUpstreamData(id, links, nodes)`（当前唯一真实来源）→ 哈希占位（仅在确无上游数据时保留，并**在卡片上显式标注「无数据」**，不要静默画假数据）。
- 接线方式：`canvas-editor.tsx` 目前只把 `nodeResults` 传给 `NodeGraph`（`:403-409`），需要把上游聚合结果一并传入（或让 `NodeGraph` 收到 `links` 后自行调用 `getUpstreamData`——`links` 已经传了，这是零成本选项）。

**P0.2 类型分派**

- 按 `kind` 分派到正确渲染器：`chart-line`→折线、`chart-bar`→柱、`chart-pie`/`chart-donut`→环/饼、`chart-kpi`→大数字（**修掉 `chart-kpi` 落进 `isChart` 画面积图的 bug**）、`chart-funnel`→漏斗、`chart-boxplot`/`chart-scatter`/`chart-radar`/`chart-map`→各自实现或**显式「暂未实现该类型」提示卡**（不要静默退化成面积图——静默退化正是用户困惑的来源）。
- `shared/components/charts.tsx` 里现成的 `Bars / HBars / Funnel / Gauge` 可直接接入，成本最低。

**P0.3 卡片信息层**

- 按设计稿渲染「结果集 / 维度 / 数值」等映射行（`ui-mock/.../components/editor/NodeGraph.tsx:168-195`），让用户看得见「这个图绑了哪两列」。

**P0.4 渲染器路线（需产品决策，三条路各有权衡）**

| 路线 | 做法 | 优点 | 代价 |
| --- | --- | --- | --- |
| A. 扩展 `shared/components/charts.tsx` | 手写带坐标轴/图例的 SVG 渲染器 | 零新依赖、与现有节点尺度一致、无 iframe/实例开销、风险最低 | 保真度低于 ECharts，工作量大 |
| B. 进程内 `echarts` | `echarts` 已是 package.json 依赖（`echarts ^5.6.0`），直接 `echarts.init(div)` | 保真度最高（图例/提示框/自适应） | 画布上 10+ 实例的实例化与 resize 开销；需处理卸载 |
| C. iframe + `chart-engine` HTML 片段 | 复用 `buildHtmlHead()`（`shell.ts:26-47`）与 `renderFigure()` | 与导出产物**完全一致**（WYSIWYG） | `shell.ts:14` 的 `ECHARTS_CDN` 走公网 CDN；每图一个 iframe；桌面端离线场景不可接受 |

**推荐：P0 走路线 A**（先把正确的图形与真实数据做出来，风险与依赖最小），**并把路线 B/C 记为后续保真度升级项**。理由：用户诉求是「拖进去能看到真的图、是真的数据」，而不是「一定是 ECharts」；且 C 的 CDN 依赖在桌面端是硬风险，B 需要先解决多实例性能。

> ⚠️ 术语澄清（影响方案取舍，务必注意）：`chart-engine` **不是 React 组件库**。`figure-registry.ts` 的渲染器签名是 `(item, context) => string`，输出的是 HTML 片段，配合 `shell.ts` 的 iframe/CDN 外壳用于**导出**；`chart-contract.ts:4-8` 也写明「工具生成（dbx_chart_collection）和 UI 预览共用」。所以「把 chart-engine 接到画布」实际等价于路线 C（iframe），**不能**直接当作 React 卡片内联渲染。
> 另：`recharts` 在 `dependencies` 里但全仓库 **0 处 import**，是未接线的历史依赖，不要误当作可用渲染器（除非有意启用）。

### P1 —— 打通节点执行链路（ADR 说的「只打通 AI 路径」）

- `handleRunAll` 已经会算上游：让「运行」操作对图表节点也产生语义——先跑上游 `source-*`，再把 `getUpstreamData` 结果写进图表节点，使其 run note 从「无数据」变成真实行数。
- 空态引导承诺的「连好线后点运行」链路只有在这一步之后才成立。
- 顺带补齐运行面板里图表节点 `nodeResults` 的语义（当前 `canvas-editor.tsx:280-285` 只打 note）。

### P2 —— 配置面与注册面一致

- `xField/yField/category/value/stageField/geoField` 改为**从上游列下拉选择**（当前是自由文本输入，`property-inspector.tsx` 的 `Field`）。
- 解决三处口径不一致（模板 10 / schema 10 / 节点库 6）：要么补齐 `chart-donut`、`chart-scatter`、`chart-map`、`chart-radar` 的入库项，要么把模板与 schema 收斂到 6 种。**建议先补齐**，因为 `chart-donut` 是设计稿主推类型（`NodeGraph.tsx:197-219`）却在库里拖不出来。
- 「从数据集生成」按钮（`node-library.tsx:249-267`，当前只 `notify`，`:253-256`）落到真实流程 = ADR-0001 `:156` 的未勾选待办。

### P3 —— 保存 → compile → render 闭环

- `screen-editor.tsx:737` 的哈希占位同样要换真实渲染；服务端 `POST /api/bigscreen/compile` / `POST /api/bigscreen/render`（`server/src/api/internal/bigscreen.ts:62,68`，由 `engine/bigscreen-compiler.ts` 支撑）目前接的是**紧凑 spec**，与画布节点图**不是同一套表示**，闭环需要显式的「节点图 → spec」转换。

### 建议的落地顺序

`P0.1 + P0.2（+ 若走路线 A 则含渲染器）》 → 实机验证（§7） → `P0.3/P2` → `P1` → `P3`。

---

## 7. 验证方式

### 7.1 现有自动化验证能力（基线已核实）

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm test` | **692 tests / 668 pass / 13 fail / 11 cancelled**（T0 快照；日志 `/tmp/dbx-test.log`，EXIT=1） | 文件级失败 **9 个**：**其中 8 个**（`src/test/bigscreen/*`、`src/test/ui/{context-menu,page-size-menu,result-grid,settings-panel}.test.ts`、`src/test/connection/driver-manager-page.test.ts`、`src/test/api/api-connection-fields.test.ts`）的失败首因是**本地 esbuild 原生二进制平台不匹配**（`@esbuild/darwin-arm64` 存在但当前 node 需要 `darwin-x64`），**与代码无关**；**第 9 个 `src/test/ui/menu-placement.test.ts` 是真实的失效 import**（`ERR_MODULE_NOT_FOUND: …/src/shared/utils/menu-placement.ts`，实际文件在 `src/shared/components/menu-placement.ts`），**应单列而非并入环境问题**。另有 2 处非文件级失败：`not ok 56 - useConnectionEditor`（4 个 AssertionError）、`not ok 98 - dbx-pro engine bridge (headless E2E)`（缺 `server/src/src/http-server.mjs`，实际是 `http-server.ts`）。11 个 cancelled 均为 `cancelledByParent`。 |
| `npm run check`（`tsc --noEmit`） | T0：**379 errors，全部位于 `src/test/**` 与 `server/test/**`** | 生产源码（含 `bi-editor`）**在 T0 时**零类型错误。**该结论在 T1/T2 已不成立**（`canvas-strip.tsx` / `canvas-editor.tsx` 的生产类型错误由并发开发引入）；且 T2 因 `node-graph.tsx` 在飞语法错误，tsc **只输出 13 条解析错误并跳过全部语义诊断**——**该数字不能当作语义基线**。 |

> ⚠️ **当前环境没有可执行的画布自动化回归网**：唯一直接渲染 `BigscreenEditor` 的用例（`src/test/bigscreen/bigscreen-empty-canvas.test.ts:27,92`）因上述环境问题跑不起来（`grep -rn "node-graph\|bi-editor" src/test` 只命中 `bigscreen-*.test.ts` 两个文件，**DnD/图表节点渲染零覆盖**）。**修 P0 之前应先修本地 esbuild 平台问题**，否则「已验证」只能是人工目视。

### 7.2 最小成本实机验证动作（把代码级结论升级为实机级）

1. 拖一个 `chart-bar` 到画布 → 预期：**节点出现**，但图形是**折线/面积形**而非柱形（验 L2）。
2. 拖 `source-sql` + `chart-line` 并连线 → 点「运行」→ 看运行面板给 `chart-line` 的注记：**已连线且上游执行成功时显示 `N 行（上游）`**（`canvas-editor.tsx:285` 全量运行、`:322` 单节点运行）；**未连线或上游无列**时才显示 `无数据`（`:287`），非数据源节点且无上游显示 `无上游数据`（`:324`）。⚠️ **这与「画布上图形仍是哈希假数据」并不矛盾**——上游行数只走运行面板文案，从不进渲染，这正是 P0.1 要接的那根线。**原写「预期 `无数据`」是错的**，且会把最关键的观测点（上游确有数据、只差接线）误判为无数据。
3. 选中该 `chart-line`，在右栏「X 字段」填任意字段名 → 预期图形**形状不变**（验 L4）。
4. `chart-pie` 与 `chart-bar` 各拖一个对比 → 预期前者环形、后者面积图，两者数据形状不同但都来自哈希（验 L2 + L3）。
5. 若第 1 步节点根本没出现 → 回到 `onCanvasDrop`：重点确认宿主是否拦掉了 `e.dataTransfer.getData("application/json")`（这是唯一可能令 L1 结论翻案的路径）。

---

## 8. 证据不足 / 残余风险（明确不下结论）

1. **未做 Electron 实机拖拽**：全部判定为源码级静态阅读。「drop 一定创建节点」的置信度是**代码级**，不是**实机级**。
2. **宿主是否拦截 `application/json` 自定义 MIME 未验证**：Chromium 同文档自发自收通常可行，若桌面端包装了 `dataTransfer`，L1 仍可能在实际运行时断裂。
3. **`dist/` 与 `src` 已可确定为不一致**（升级结论，见审计 §6）：`dist/` 快照为 2026-10-14 20:34，而 `canvas-strip.tsx`（20:46）、`canvas-editor.tsx`（20:55）、`node-graph.tsx`（20:59）均更晚 → **本地 `dist/` 必然不代表当前 `src`**；因资源被压缩改名，无法逐行对账，故**不能确定用户实际安装包对应哪个快照**。
4. **是否存在未合并的修复分支/PR 未检索**：`docs/plans/` 为空目录，`docs/adr/` 只有 adr-0001。
5. **`screen-*` / `adv-*` / `output-*` 分支未逐一判定**：本次只核对图表相关路径。
6. **测试失败已完整归因**（审计 §4.1 收敛，替代原「其余 6 个未排查」）：13 fail / 11 cancelled = 8 环境（esbuild 平台）+ 1 真实失效 import + 2 非文件级（`useConnectionEditor` 断言失败、E2E 缺 `http-server.mjs`）+ 11 `cancelledByParent`。**但测试网的腐化不止 esbuild**：另有约 380 条 test 侧类型错误 + 1 处失效 import，属长期欠账，不是本次问题引入。
7. **并发开发引入的两处阻断级问题尚未修**：`CanvasStrip` 必填 prop 契约断裂（`canvas-strip.tsx:27-35` vs 唯一调用点 `canvas-editor.tsx:404`）、`node-graph.tsx` 在飞语法错误（T2 13 条解析错误，工作区不编译）。见 §5.4。
8. **「可配置假象」本身是未列出的产品风险**：属性面板能填 X/Y/维度/数值字段却完全无效果，用户会怀疑是自己配置错了，而不是功能缺失——这放大了「图表画不出来」的感受（L4 的用户体验面）。
9. **`recharts` 在 `dependencies` 中但全仓库 0 处 import**（`grep -rn "recharts" src` 无输出）：既是未接线依赖，也是「有库却没用」的口径干扰项；修复时不要误当作可用渲染器。
10. **审计自身标注的「无法核实」项（沿用）**：`CanvasStrip` 渲染期是否真抛错（代码级推断，未实机）、T0 的 `git diff --stat` 精确数字（246/49，无快照可复算）、`plugin.json` 的 `styles[]` 与 `dist/` 资源是否逐一对应。

---

## 附：可直接复用的现成能力（修复时应优先复用，不要重写）

| 能力 | 位置 | 用途 |
| --- | --- | --- |
| 行 → `{labels, datasets}` 映射 | `src/domain/chart-source.ts:27,39`（`resolveChartData` / `buildChartJsData`） | P0.1 数据通路的核心，**已带单测**（`src/test/chart/chart-source.test.ts`） |
| 图表/数据集契约 | `src/domain/chart-contract.ts:15,37,62,72,104` | `ChartItem` / `ChartSource` / `DatasetSpec` / `Visualization` |
| 特征 → 领域类型桥接层（8 行） | `src/features/visualization/visualization-bridge.ts` | 注释已预授权 `bi-editor`/`database-workspace` 走它引用 domain 类型；**已有消费方**：`src/features/database-workspace/state/workbench-types.ts:9` 从中 `import type { Visualization }`（原写「目前无消费方」有误） |
| 已注册自有图形 | `src/features/chart-engine/renderer/figures/figure-registry.ts`（`funnel`/`metric`/`boxplot`） | 仅用于导出 HTML 片段（签名 `(item, context) => string`） |
| 微图表组件 | `src/features/bi-editor/shared/components/charts.tsx`（198 行） | 路线 A 的基座，已含 `Bars/HBars/Funnel/Gauge` 未被画布使用 |
| ECharts 依赖 | `package.json` `echarts ^5.6.0` | 路线 B 可直接用，无需新增依赖 |
