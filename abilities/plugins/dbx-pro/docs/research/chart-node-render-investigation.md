# BI 画布图表节点「拖入后不真正生成/渲染图表」一手事实核查

- 核查对象：`abilities/plugins/dbx-pro` 的 BI 画布（节点图编辑器）
- 核查方式：**仅源码级一手阅读 + grep 计数**，未做运行时（Electron 实机）验证
- 代码基线：工作区当前 `src/features/bi-editor/`（含 5 个未提交文件的既有改动，见 F16）
- 结论口径：每条事实都给出 `文件:行号` 与关键代码片段；推断一律标注为「推断」，不与事实混排

---

## 0. 结论摘要

用户陈述「图表节点拖拽画布后并不能真正生成并渲染出图表」在**渲染结果层成立、在事件层不成立**：

1. **拖拽事件链是通的，节点确实被创建**（F1–F3）。`onDragOver` 有 `preventDefault`，`onDrop` 已绑定，drop 里会 `setNodes` 写入一个新节点。所以「拖进去没反应」这一层不成立。
2. **节点创建后渲染的是占位图形，而不是该图表类型对应的真实图表**（F4–F6）：节点卡里只 import 了 `AreaChart` 与 `Donut` 两个渲染器，除 `chart-pie`/`chart-donut` 外的**所有** `chart-*`（柱、漏斗、箱线、散点、雷达、地图、KPI…）都落到同一个 `<AreaChart>`。
3. **数据永远是哈希伪随机序列，不会来自真实查询结果**（F7–F10）：`chartValues` 只读 `nodeResults[id]`，而 `runAll` 只执行 `kind.startsWith("source-")` 的节点，图表节点**永远不会**被写入 `nodeResults`，因此恒走 `hashValues()` 兜底分支。
4. **画布完全没有接入仓库里那套真实图表引擎**（F13）：`bi-editor` 目录下 `echarts|iframe|srcDoc` 命中数为 0，对 `chart-engine|chart-contract|chart-source` 的 import 数也为 0。
5. **属性面板收集的字段绑定被渲染层忽略**（F11）：`node-schema.ts` 为每种图表声明了 `xField / yField / valueField / category / stageField / geoField`，但 `node-graph.tsx` 只读 `values.title`，这些字段在整条渲染链上没有任何读取点。
6. **该缺口在文档层是「已知未完成项」而非本次新回归**（F15）：ADR-0001 明确把「节点功能打通」划给一份尚未存在的后续 ADR，并把「从数据集新建 → 自动创建 chart 节点」列为未勾选待办。

一句话：**这不是拖拽 bug，是「图表节点 = 带图表的占位卡」这个实现现状**；真实图表渲染能力（ECharts 引擎 + 字段绑定 + 上游数据回填）存在于本仓库其他模块，但没有接到画布节点图上。

---

## 1. 一手事实清单

### A 组 · 拖拽 / 创建链路（证明「节点被创建」）

**F1 节点库的拖拽源确实写出 `application/json` 载荷**
`src/features/bi-editor/canvas/components/node-library.tsx:286-297`

```tsx
draggable
onDragStart={(e) => {
  e.dataTransfer.setData("application/json", JSON.stringify({
    kind: "node", nodeType: item.key, label: item.label,
  }));
  ...
}}
```

**F2 画布 `dragOver` 已 preventDefault，`drop` 已绑定**
`src/features/bi-editor/canvas/components/node-graph.tsx:224-228`

```tsx
function onCanvasDragOver(e: DragEvent) {
	e.preventDefault();
	if (!dragOver) setDragOver(true);
}
function onCanvasDragLeave() { setDragOver(false); }
```

`.../node-graph.tsx:920-922`（JSX 绑定）

```tsx
onDragOver={onCanvasDragOver}
onDragLeave={onCanvasDragLeave}
onDrop={onCanvasDrop}
```

**F3 `onCanvasDrop` 会真正写入新节点**
`.../node-graph.tsx:229-233, 258-273`

```tsx
function onCanvasDrop(e: DragEvent) {
	e.preventDefault();
	setDragOver(false);
	const data = e.dataTransfer?.getData("application/json");
	if (!data) return;
	...
	const type = payload.nodeType;
	if (!type) return;
	const canvasPt = screenToCanvas(e.clientX, e.clientY);
	const x = canvasPt.x - 90;
	const y = canvasPt.y - 40;
	const tpl = NODE_TEMPLATES[type] ?? { w: 180, h: 110, tone: TONE.chart };
	nodeSeqRef.current++;
	const newId = `n${nodeSeqRef.current}`;
	const newNode: NodePos = { ...tpl, x: Math.max(8, x), y: Math.max(8, y), kind: type, selected: true };
	setNodes((prev) => { ...下略... });
```

> 判定：**拖放会创建节点**。用户描述的「拖拽后不能生成」若指「画布上什么都没出现」，与源码不符；若指「出现了但不是图表」，与 F4–F6 相符。

**F4 图表类模板全部注册在册**
`.../node-graph.tsx:113, 122-132`

```tsx
export const NODE_TEMPLATES: Record<string, Omit<NodePos, "x" | "y">> = {
	// ── 图表（设计稿 6 种） ──
	"chart-line":      { w: 216, h: 222, tone: TONE.chart,  kind: "chart-line" },
	"chart-bar":       { w: 216, h: 190, tone: TONE.chart,  kind: "chart-bar" },
	"chart-donut":     { w: 216, h: 206, tone: TONE.chart,  kind: "chart-donut" },
	"chart-kpi":       { w: 180, h: 110, tone: TONE.result, kind: "chart-kpi" },
	"chart-funnel":    { w: 216, h: 210, tone: TONE.chart,  kind: "chart-funnel" },
	"chart-boxplot":   { w: 216, h: 200, tone: TONE.chart,  kind: "chart-boxplot" },
	"chart-pie":       { w: 216, h: 206, tone: TONE.chart,  kind: "chart-pie" },
	"chart-scatter":   { w: 216, h: 190, tone: TONE.chart,  kind: "chart-scatter" },
	"chart-map":       { w: 240, h: 240, tone: TONE.chart,  kind: "chart-map" },
	"chart-radar":     { w: 216, h: 190, tone: TONE.chart,  kind: "chart-radar" },
```

### B 组 · 渲染链路（证明「渲染的不是对应图表」）

**F5 图表节点只 import 两个渲染器**
`.../node-graph.tsx:18`

```tsx
import { AreaChart, Donut, SERIES } from "../../shared/components/charts";
```

对照 `shared/components/charts.tsx` 实际导出：`AreaChart / Sparkline / Bars / HBars / Donut / Funnel / Gauge`。**`Bars`、`HBars`、`Funnel`、`Gauge` 未被 node-graph 引入**（`grep -rn "Bars\|HBars\|Funnel\|Sparkline\|Gauge" --include=*.tsx .` 的命中全部落在 `canvas-tiles.tsx`、`screen-editor.tsx`、`bi-workbench.tsx`、`bi-workspace.tsx`，node-graph 无命中）。

**F6 除饼/环外，所有图表类型都渲染成同一条面积图**
`.../node-graph.tsx:1042, 1119-1135`

```tsx
const isChart = kind.startsWith("chart-");
...
{isChart && (
	<div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-surface p-1 text-[10px] text-muted">
		{kind === "chart-pie" || kind === "chart-donut" ? (
			<Donut segments={chartValues.slice(0, 4).map((v, i) => ({
				value: Math.max(5, v),
				color: SERIES[i % SERIES.length],
			}))} size={56} thickness={8} holeFill="var(--color-surface)" />
		) : (
			<AreaChart values={chartValues} stroke={SERIES[1]} />
		)}
	</div>
)}
```

> 判定：`chart-bar` / `chart-funnel` / `chart-boxplot` / `chart-scatter` / `chart-radar` / `chart-map` 全部走 `<AreaChart>` 分支。**图形与所选类型不符，已证实。**
> 补充：`chart-kpi` 不会走到这里——`isMetric` 只认 `kind.startsWith("metric-")`（`:1043`），而模板 kind 是 `chart-kpi`，所以 KPI 卡渲染的是**面积图**而不是大数字；大数字分支 `:1137-1144` 只服务于 `metric-big/trend/gauge` 这三个「向后兼容」kind。

### C 组 · 数据链路（证明「数据永远是假的」）

**F7 数据来源：`nodeResults[id]` 否则哈希伪随机**
`.../node-graph.tsx:1055-1060`

```tsx
const chartValues = result && result.columns.length > 0
	? result.rows.slice(0, 14).map((r) => {
		const numVal = Object.values(r).find((v) => typeof v === "number");
		return typeof numVal === "number" ? numVal : 0;
	})
	: hashValues(`node-${id}`, 14, 30, 88);
```

其中 `result` 来自 `:1037` `const result = nodeResults[id];`。

**F8 伪随机序列是刻意的**
`.../node-graph.tsx:90-95`

```tsx
 * 不抄设计稿 GMV mock 数据（[42,48,45,55,51,…] 是设计稿的硬编码，用户明确禁止），
 * 而是用 seed 哈希出自己的稳定序列，保证每次打开画布图表形状一致但数值来源独立。
 */
function hashValues(seed: string, len = 14, min = 30, max = 85): number[] {
	return fnv1aArray(seed, len, min, max);
}
```

`src/shared/utils/hash.ts:1-6, 65-71`

```ts
 * 用于生成稳定的伪随机值，保证相同输入总是产生相同输出。
 * 典型用途：预览图表数据、临时 ID、颜色种子等。
...
export function fnv1aArray(seed: string, len: number, min: number, max: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < len; i++) out.push(fnv1aRange(`${seed}-${i}`, min, max));
	return out;
}
```

**F9 `runAll` 只执行 `source-*` 节点，图表节点从不执行**
`src/features/bi-editor/canvas/hooks/use-canvas-execution.ts:270-278`

```ts
		for (const id of order) {
			const node = nodes[id];
			...
			const kind = node.kind ?? "";
			if (kind.startsWith("source-")) {
				await runNode(id, node);
			}
		}
```

`.../use-canvas-execution.ts:217-218`

```ts
	// 非数据源节点：从上游获取数据，这里不做额外执行
}
```

`runNode` 的分支全集（`:96` `source-sql`、`:128` `source-table`、`:161` `source-connector`、`:189` `source-csv`、`:203` `source-extract`/`source-api`）中**没有任何 `chart-*` 分支**。

> 判定：`nodeResults` 里只可能出现数据源节点的 key。图表节点的 `result` 恒为 `undefined`，`chartValues` 恒等于 `hashValues("node-"+id, 14, 30, 88)`。**「图表节点数据来自真实查询」被否证。**

**F10 上游数据聚合函数存在，但没有传给 NodeGraph**
`.../use-canvas-execution.ts:220-245` 定义了 `getUpstreamData(id, links, nodes)`;
`src/features/bi-editor/canvas/canvas-editor.tsx:403-409` 只传 `nodeResults`：

```tsx
<NodeGraph
	nodes={nodes}
	setNodes={setNodes}
	links={links}
	setLinks={setLinks}
	nodeResults={nodeResults}
/>
```

`getUpstreamData` 在编辑器里唯一被调用的地方是运行状态文案：
`.../canvas-editor.tsx:280-285`

```tsx
	// 非数据源节点：检查是否有上游数据
	const upstream = getUpstreamData(rn.id, links, nodes);
	if (upstream) {
		return { ...rn, status: "done", note: `${upstream.rowCount} 行（上游）` };
	}
	return { ...rn, status: "done", note: "无数据" };
```

> 判定：即使数据源节点跑出了真实行，图表节点也拿不到——**聚合结果只用于运行面板的「N 行（上游）」提示，不进渲染**。

### D 组 · 配置链路（证明「字段绑定是空转的」）

**F11 属性面板收集字段，渲染层不读**
`src/features/bi-editor/canvas/components/node-schema.ts:88-174` 为每种图表声明了字段，例如：

```ts
	"chart-bar": { label: "柱图", fields: [
		{ key: "title", label: "标题", type: "text" },
		{ key: "xField", label: "X 字段", type: "text" },
		...
		{ key: "orientation", label: "方向", type: "select", options: ["vertical", "horizontal"] },
		{ key: "stacked", label: "堆叠", type: "select", options: ["no", "yes"] },
	] },
	"chart-funnel": { label: "漏斗图", fields: [
		{ key: "title", ... }, { key: "stageField", ... }, { key: "valueField", ... }, { key: "sort", ... },
	] },
```

而 `node-graph.tsx` 里 `values.*` 的全部读取点（`grep -n "values\." canvas/components/node-graph.tsx`）只有：

```
1038: const title = (values.title as string) ?? kind ?? id;
1097/1099: values.sql        （数据源节点 SQL 预览）
1103/1104: values.table      （数据源节点表名）
1113/1114: values.datasourceId
1148/1149/1155/1156: filter-* 的 placeholder/field/mode
1169: values.metric          （adv-summary）
```

全仓库 grep `xField|yField|valueField|geoField` 在 `node-schema.ts` 之外的唯一命中是 mock 预设：
`src/features/bi-editor/workbench/bi-workspace.tsx:219`

```ts
			values: { title: "GMV 趋势", xField: "ts", yField: "amount" } },
```

> 判定：**图表节点上用户填的 X/Y/维度/度量字段在渲染时被完全忽略**，`orientation`/`stacked`/`smooth`/`sort`/`donut`/`innerRadius`/`mapType` 等同理。属性面板是「能填但不生效」。

**F12 AI 插入节点也只写 title，不写数据**
`.../canvas-editor.tsx:454-481`

```tsx
onInsert={() => {
	...
	const hintKind = aiResult.kindHint ? `chart-${aiResult.kindHint}` : null;
	const chartId = hintKind ? Object.keys(nodes).find((k) => nodes[k]?.kind === hintKind) : ...;
	if (chartId) {
		setNodes((prev) => ({ ...prev, [chartId]: { ...n, selected: true,
			values: { ...(n.values ?? {}), title: aiResult.resultName } } }));
		void handleRunAll();
		getUi()?.notify?.({ message: `已根据 AI 建议更新 ${aiResult.resultName}`, variant: "success" });
	} else {
		getUi()?.notify?.({ message: "画布上没有图表节点，AI 无法写入", variant: "info" });
	}
}}
```

> 判定：AI 路径**只把标题写进已存在的图表节点**，且**不会新建图表节点**；`handleRunAll` 按 F9 又不会执行图表节点。因此 AI 路径同样产不出图表数据。

### E 组 · 与真实图表引擎的关系

**F13 `bi-editor` 与真实图表引擎之间零连接**
```bash
$ cd src/features/bi-editor && grep -rn "echarts|ECharts|iframe|srcDoc|srcdoc" .
（无输出，命中数 0）
$ grep -rn "chart-engine|chart-contract|chart-source" .
（无输出，命中数 0）
```

对照本插件内**确实存在**的真实渲染管线（与画布无关）：

| 事实 | 位置 |
| --- | --- |
| ECharts CDN iframe 外壳 | `src/features/chart-engine/renderer/echarts/shell.ts`（`ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"`） |
| ECharts 主题/配置合并 | `src/features/chart-engine/renderer/echarts/defaults.ts` |
| 自定义图形（metric/funnel/boxplot） | `src/features/chart-engine/renderer/figures/*` |
| 图表契约与数据映射 | `src/domain/chart-contract.ts`、`src/domain/chart-source.ts` |
| 渲染引擎已切 ECharts（ADR-0010b） | `src/tools/dbx-chart-collection.ts` |

> 判定：**画布图表节点完全没有使用这套引擎**。这也是「不能真正生成图表」在能力层面的根因：能力存在，但没接线。

**F14 大屏编辑器同款占位写法**
`src/features/bi-editor/canvas/screen-editor.tsx:23, 737`

```tsx
import { AreaChart, Funnel } from "../shared/components/charts";
...
<AreaChart values={hashSeries(seed, 14)} className="h-full w-full" />
```

> 判定：`page.style === "bigScreen"` 时也走哈希数据，问题不是「只有看板模式才有」。

### F 组 · 现状定性（是已知缺口，不是本次回归）

**F15 ADR 明示节点功能未打通，且后续 ADR 不存在**
`docs/adr/adr-0001-bi-workbench-first-screen.md:7`

```
本文件是首屏工作台的决策；画布编辑器（canvas-editor / node-graph）的详细决策见后续 ADR。
```

`...:120`

```
- ❌ 不改 canvas-editor / node-graph 内部实现（节点功能打通归编辑器专项 ADR）
```

`...:156`（未勾选待办）

```
- [ ] "从数据集新建" → 弹出数据集选择对话框 → 选表选字段 → 自动创建 canvas 项目 + 初始 chart 节点
```

`ls docs/adr/` 结果只有 `adr-0001-bi-workbench-first-screen.md` —— 上述「后续 ADR / 编辑器专项 ADR」**尚未存在**。

**F16 当前未提交改动全部是外观层，与本问题无因果关系**
`git diff abilities/plugins/dbx-pro/src/features/bi-editor/`（6 files, 9 insertions, 27 deletions）内容：

| 文件 | 改动 |
| --- | --- |
| `agent/agent-session.tsx` | `useState` 草稿态改为非响应式常量 |
| `canvas/components/add-node-menu.tsx` | `MENU_HEADER_H` 64→32，删除搜索条 |
| `canvas/components/node-graph.tsx` | 删除 `hot` 变量，连线 strokeWidth/opacity 简化 |
| `canvas/components/node-library.tsx` | 删除折叠态下重复的展开按钮 |
| `workbench/bi-workspace.tsx` | 删除 `<span className="hidden">{i}</span>` |
| `plugin.json` | 版本号 |

> 判定：**没有任何一处触及 drop 处理、chartValues、runAll 或渲染分支**。图表节点的现状是既有实现，不是这 6 个文件改出来的。

### G 组 · 附带发现的可用性缺陷（同一用户旅程上的坑）

**F17 节点库行没有点击 / 双击插入处理**
`node-library.tsx` 全文 `onClick` 仅 5 处：`:196`、`:215`（折叠按钮）、`:237`（清空搜索）、`:252`（"从数据集生成" 只 `notify`）、`:346`（删除模板）。分组行本身（`:283-311`）只有 `draggable` + `onDragStart`，**无 `onClick`、无 `onDoubleClick`**。

**F18 两处引导文案与实际行为矛盾**
`.../node-library.tsx:357-361`

```tsx
	{/* 底部 hint h-9 */}
	<div className="...">
		<Icon name="icon-[lucide--info]" className="size-3 shrink-0" />
		拖到画布添加节点 · 双击插入
	</div>
```

`.../canvas-editor.tsx:411-425`

```tsx
{/* 空态引导 —— 真空白画布，不再插手演示节点 */}
<div data-testid="canvas-empty-guide" ...>
	<span className="icon-[lucide--boxes] size-5 text-faint" />
	<span className="text-[13px] font-medium text-surface-foreground">空白画布</span>
	<span className="text-[11px] leading-5 text-muted">
		从左侧节点库点击节点添加；连好线后点右上角「保存」。…
	</span>
</div>
```

> 判定：`双击插入` 与 `点击节点添加` **均无实现**（F17），实际唯一入口是拖拽。用户若按提示点击/双击，表现就是「没反应」。

---

## 2. 对「A–G 七个问题」的逐项判定

> **前置说明（重要）**：本报告收到的任务原文只有一句——「1dbx-pro的bi画布图表节点拖拽画布后并不能真正的生成并渲染出图表，请你调研针对当前已有的图表节点实现。」，**未附 A–G 清单**。已检索仓库全文（`A–G`、`七个问题`、`问题 A` 等关键词）无结果。
> 下面的 A–G 是**为对齐该格式、由本报告从用户原句可验证拆解出的七个命题**，每条都只用上文 F1–F18 的一手证据判定。若 leader 手中的 A–G 清单不同，请回发原文，我用同一批证据重判，不改口径。

| 命题（重建） | 判定 | 依据 |
| --- | --- | --- |
| **A. 拖拽事件链失效，节点根本没被创建** | **已否证** | F1（拖拽源写载荷）、F2（`onDragOver` 有 `preventDefault`、`onDrop` 已绑定）、F3（drop 内 `setNodes` 写入新节点） |
| **B. 节点被创建，但画布上不渲染任何可视化** | **已否证** | F6（`isChart` 分支必然渲染 `<AreaChart>` 或 `<Donut>`） |
| **C. 渲染出的图形与所选图表类型不符（拖柱图得到面积图）** | **已证实** | F4（模板注册 10 种 `chart-*`）、F5（只 import `AreaChart`/`Donut`）、F6（仅 pie/donut 分流，其余全走 `AreaChart`）；F5 附带证明 `Bars/HBars/Funnel` 未被引入 |
| **D. 图表数据来自真实数据源 / 上游查询结果** | **已否证** | F7（`chartValues` 唯一真实来源是 `nodeResults[id]`）、F9（`runAll` 只执行 `source-*`，图表节点永不执行）、F8（兜底恒为 `hashValues`） |
| **E. 属性面板配置的 X/Y/维度/度量字段参与渲染** | **已否证** | F11（`node-graph.tsx` 的 `values.*` 读取点清单中没有 `xField/yField/valueField/category/stageField/geoField`） |
| **F. 画布图表节点接入了本仓库的真实图表渲染引擎（ECharts）** | **已否证** | F13（`bi-editor` 内 `echarts|iframe|srcDoc` 命中 0，对 `chart-engine|chart-contract|chart-source` 的 import 命中 0），对照表列出引擎确实存在于 `features/chart-engine`、`domain/chart-*`、`tools/dbx-chart-collection.ts` |
| **G. 该缺口是既有的、被文档显式延期的工作项，而非本次改动引入的回归** | **已证实** | F15（`adr-0001:120` 把「节点功能打通」归给尚未存在的编辑器专项 ADR；`:156` 待办未勾选）、F16（当前 6 个未提交文件全部是外观层，未触及 drop/chartValues/runAll/渲染分支） |

补充两条同旅程的独立缺陷（不属于 A–G，但影响用户复现路径）：

| 命题 | 判定 | 依据 |
| --- | --- | --- |
| H. 「双击插入」「点击节点添加」引导可用 | **已否证** | F17（行无 onClick/onDoubleClick）、F18（文案与实现矛盾） |
| I. 大屏模式无此问题 | **已否证** | F14（`screen-editor.tsx:737` 同一 `hashSeries` 占位写法） |

---

## 3. 证据不足 / 未验证项（明确不结论）

1. **运行时复现未做**：全部判定基于源码静态阅读，未在 Electron 宿主里实拖一次。「drop 一定创建节点」的置信度是**代码级**，不是**实机级**。
2. **拖拽在 Electron 宿主里 `application/json` 自定义 MIME 是否被拦截**：Chromium 同文档内自发自收通常可行，但未实机验证；若宿主对 `dataTransfer` 做了包装，F1/F3 的链路仍可能在实际运行时断裂。**这是唯一可能让 A 命题翻案的路径，需要一次实机拖拽验证。**
3. **`dist/` 产物与 `src` 是否一致**：`dist/assets/database-workspace-ZRZoFFTu.js` 中能 grep 到 `空白画布`、`拖到画布添加节点`、`chart-bar`、`chart-donut`、`application/json`，但 `onCanvasDrop|screenToCanvas` 因压缩改名为 0 命中。因此**只能说明 dist 含画布代码，不能说明 dist 与当前 src 逐行一致**。若要排除「用户装的是旧包」，需比对 `dist` 与本地重新构建的产物哈希。
4. **是否存在未合并的修复分支 / PR**：未检索远端分支，`docs/adr/` 无编辑器专项 ADR，`docs/plans/` 为空目录，因此**没有证据表明该缺口已在排期**（也没有证据表明没有）。
5. **`chart-*` 之外的 kind 是否也有同类缺口**：`screen-*`、`adv-*`、`output-*` 分支在 `node-graph.tsx:1146-1272` 逐段渲染，本次只核对了图表相关路径，其余未逐一判定。

---

## 4. 建议的验证动作（最小成本，用于把代码级证据升级为实机级）

1. 实机拖一个 `chart-bar` 到画布 → 确认节点出现、且图形是**折线/面积形**而非柱形（验证 C）。
2. 拖 `source-sql` + `chart-line`，连线后点「运行」→ 观察运行面板给 `chart-line` 打的 note 是 `N 行（上游）` 还是 `无数据`（验证 D/F10；依 F9 预期为 `无数据`）。
3. 选中该 `chart-line`，在右栏「X 字段」填任意字段名 → 图形形状是否变化（依 F11 预期**不变**）。
4. 用 `chart-pie` 与 `chart-bar` 各拖一个，对比两者渲染形状（依 F6 预期：前者环形、后者面积图）。
5. 若 1 中出现「节点根本不出现」，则回到 F2/F3 逐条打断点，重点确认 `e.dataTransfer.getData("application/json")` 在宿主中是否返回空串。
