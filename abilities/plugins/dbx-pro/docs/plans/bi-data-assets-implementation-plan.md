# BI 数据资产实施方案

> 对应决策文档：[ADR-0009: BI 数据资产 —— 从「图表打包器」到「看板/大屏工作台」的能力边界](../adr/adr-0009-bi-data-assets.md)
>
> 本方案只描述**怎么做**：任务拆分、涉及文件、改动要点、验证方式、发布步骤。架构取舍的理由见 ADR-0009。

---

## 0. 范围与前置

| 项 | 内容 |
|----|------|
| 目标 | 让「BI 数据资产」从「图表打包器 + 下载器」升级为**可筛选、可重新取数、数据来源可追溯**的看板 / 大屏工作台 |
| 落点 | 只改 dbx-pro 插件内部（`abilities/plugins/dbx-pro/`），**不新增服务进程、不新增 Agent 工具、不改 `plugin.json` 权限** |
| 前置 | 无。M0 可以立即开工；M1 需要 M0 的迁移与提示先落地 |
| 明确不做 | 组织 / 工作空间 / 权限 / 发布 / 嵌入 / 数据门户 / 电子表格 / 数据填报 / 数据集编辑器 / 地图类图表。见 ADR-0009 §7 |
| 版本节奏 | M0 → `0.1.16`；M1 → `0.2.0`；M2 → `0.3.0`；M3 → `0.4.0` |

工作方式：**M0 与 M1 不并行**。M1 依赖 M0 的存储迁移与 `MAX_VISUALIZATIONS` 提示；M1 内部拆成「模型先落、UI 后跟」两刀，第一刀不改任何 UI 行为。

---

## 1. 现状基线（2026-10-09 实测）

### 1.1 数据模型

```ts
// src/domain/chart-contract.ts — 35 行
interface ChartItem {
  type: "line" | "bar" | "pie" | "doughnut" | "polarArea" | "radar" | "scatter" | "bubble";
  data: { labels?: unknown[]; datasets: { label?: string; data: unknown[] }[] };
  options?: Record<string, unknown>;
  title?: string;
  description?: string;
  height?: number;
}

interface Visualization {
  id?: string;
  title: string;
  type: "dashboard" | "screen";
  connection: string;
  table: string;
  html: string;          // ← 一次性生成的整页 HTML，事实源之一
  chartItems: ChartItem[]; // ← 事实源之二
  sql?: string;          // ← 存了但 UI 从不展示、从不复用
  createdAt?: number;
}
```

文件头明确写着「旧 Canvas 规则引擎 / preset 模板 / inferLayout 已移除」—— ADR-0007 的 Canvas 实现已经不在代码里。

### 1.2 存储

`src/features/visualization/visualization-store.ts`（145 行）：

| 常量 / 行为 | 值 | 问题 |
|---|---|---|
| `STORE_PATH` | `"visualizations.json"` | 单文件，无分片 |
| `STORE_SCHEMA_VERSION` | `1` | 无迁移路径 |
| `MAX_VISUALIZATIONS` | `20` | **超出静默截断**，用户无感知 |
| `normalize()` | 丢弃非对象 / 空 id 条目 | 静默丢数据 |
| 读模型 | 模块级单例 + `useSyncExternalStore` | 所有 hook 实例共享同一份列表 |
| 写模型 | `writeChain` 串行化 | 不会并发写坏 |
| `hydrate()` | 只读一次，「本地已改则优先本地」 | — |

### 1.3 图表工具

`src/tools/dbx-chart-collection.ts`（244 行）：

- `CHARTJS_CDN = "chart.js@4.4.1"`
- `charts` 上限 12（handler 与 `generateHtml` 双重 trim）—— 与 ADR-0005 的 `LAYOUT_MAP` 一致
- `normalizeChartData()` 修 AI 常见错格式：裸数组 → `labels` + `datasets`；`data.rows` → `labels` + `datasets` + 8 色板
- `validateChartData()` 失败时渲染**可见错误卡片**（不静默白屏）
- `generateHtml()` = `buildHtmlHead` + `chart-defaults` + Grid 布局
- handler 末尾：`saveVisualizationToStore()` + `showVisualizationPreview()`

### 1.4 UI

| 文件 | 行数 | 现状 |
|------|------|------|
| `components/visualization-gallery.tsx` | 360 | 卡片墙：搜索（标题/表名/连接）、`type` 过滤、`CHART_ICON_MAP` 图标占位缩略图（**刻意不加载 iframe**）、溢出菜单（新窗口 / 下载 / 交给 AI 修改 / 删除）、清空用两次点击内联确认 |
| `components/visualization-tab.tsx` | 103 | iframe `srcDoc` 预览 —— v0.0.103 起的唯一预览形态 |
| `visualization-gallery-view.tsx` | 82 | 视图装配 |
| `visualization-bridge.ts` | 38 | 预览 / 保存回调桥（**单例回调**） |
| `chart-shell.ts` | 38 | `buildHtmlHead` + `getShellCss`（`themes/*.css?raw`） |
| `chart-defaults.ts` | 34 | `CHART_RUNTIME_GUARD` + 主题 defaults |
| `themes/chart-defaults-dashboard.js` / `-screen.js` | 56 / 54 | 两套 Chart.js defaults |
| `themes/dashboard.css` / `screen.css` | 12 / 15 | 主题 CSS 极薄 |

### 1.5 导出链路

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/shared/utils/chart-runtime.ts` | 39 | `withEmbeddedChartJs()` 把 CDN `<script>` 换成内联 `vendor/chart.umd.js`，**幂等**，历史产物也被修好 |
| `src/shared/utils/html-export.ts` | 38 | Data URL 导出（规避 popup blocker + Blob 生命周期）；`safeFilename()` 保留中文 |
| `src/shared/vendor/chart.umd.js` | — | 随插件打包的 Chart.js 运行时 |

### 1.6 入口与测试

| 位置 | 说明 |
|------|------|
| `src/features/database-workspace/components/workbench-top-bar.tsx:150` | 顶部「BI 数据资产（看板/大屏）」按钮 + 数量角标 |
| `src/shared/ai/send-context.ts`（260 行，`:122-123`） | AI 工作流提示词：`dbx_query_full` 取数 → `render_chart` 预览 → `dbx_chart_collection` 打包 |
| `src/index.tsx`（209 行） | 插件装配入口。**本方案不改** |
| `plugin.json`（131 行） | 16 个权限，`network.allowedHosts` = 3 个发布资产域名。**本方案不改** |
| `src/test/*.test.js` | 34 个测试文件（M0 删掉孤儿测试、新增文档迁移测试后的计数）；测试脚本 glob 是 `src/test/*.test.js`（**新测试必须是 `.js`**） |
| `src/test/dbx-chart-collection.test.js` | 11 KB，覆盖 normalize / validate / generateHtml |
| `src/test/filter-bar.test.js` | 4.4 KB，**孤儿测试**：模拟已删除的 `Canvas.tsx` + `FilterBar.tsx`。**M0 已删除** |
| `src/test/chart-runtime.test.js` | 3.7 KB，`withEmbeddedChartJs` / `escapeScriptContent` |
| `src/test/stores.test.js` | 4.2 KB，存储层（workbench-settings / query-history；M0 未加可视化用例，理由见 §3 M0 完成记录） |
| `src/test/visualization-doc.test.js` | **M0 新增**，3.7 KB，文档读写与 v1 → v2 迁移（12 用例） |

测试命令（`package.json`）：

```bash
npm run check   # tsc --noEmit
npm test        # node --import ./src/test/support/dom-setup.mjs --experimental-strip-types --test src/test/*.test.js server/test/*.test.mjs
npm run build   # vite build
```

> ⚠️ 因为测试脚本的 glob 是 `src/test/*.test.js`，**新增测试一律用 `.js`**（不是 `.ts` / `.tsx`）；`--experimental-strip-types` 允许测试文件直接 import `.ts` 源码。

---

## 2. 目标形态

### 2.1 新增与改动的文件清单

**新增**

| 路径 | 职责 |
|------|------|
| `src/domain/dataset-spec.ts` | `DatasetSpec` 类型 + 规范化 / 行数裁剪 / 体积估算 |
| `src/domain/dataset-filter.ts` | `ChartFilter` 类型 + 纯函数筛选求值 `applyFilters()` |
| `src/domain/visualization-doc.ts` | 存储文档 v1 → v2 迁移（含「只读快照」标记） |
| `src/features/visualization/components/visualization-detail-drawer.tsx` | 产物详情抽屉（数据集 + SQL + 筛选 + 重新取数） |
| `src/features/visualization/components/dataset-summary-list.tsx` | 数据集 / SQL / 行数展示 |
| `src/features/visualization/components/dataset-filter-panel.tsx` | 字段级筛选（等值 + 范围） |
| `src/features/visualization/components/chart-item-renderer.tsx` | UI 内直接渲染 Chart.js（import `vendor/chart.umd.js` + 复用 defaults） |
| `src/features/visualization/hooks/use-dataset-refetch.ts` | 重新取数的异步状态机 |
| `src/test/dataset-spec.test.js` | 规范化 / 裁剪 / 体积估算 |
| `src/test/dataset-filter.test.js` | 筛选求值 |
| `src/test/visualization-doc.test.js` | v1 → v2 迁移 |
| `src/test/visualization-detail.test.js` | 详情抽屉接线（RTL） |

**改动**

| 路径 | 改动要点 |
|------|---------|
| `src/domain/chart-contract.ts` | 新增 `DatasetSpec` / `ChartFilter`；`Visualization.html` 改可选；新增 `datasets?` / `filters?` / `schemaVersion?` |
| `src/features/visualization/visualization-store.ts` | 接 `visualization-doc.ts` 的迁移；`MAX_VISUALIZATIONS` 20 → 100；截断时提示 |
| `src/tools/dbx-chart-collection.ts` | 新增可选 `datasets` 输入；`html` 改为导出时生成 |
| `src/features/visualization/components/visualization-gallery.tsx` | 卡片接入详情抽屉；只读快照标记 |
| `src/features/visualization/components/visualization-tab.tsx` | 改为渲染 `chartItems` + `filters`；iframe 降级为「精确预览导出效果」 |
| `src/shared/ai/send-context.ts` | 补 `datasets` 传参说明 |
| `src/test/dbx-chart-collection.test.js` | 扩充 datasets 分支与向后兼容用例 |
| `src/test/stores.test.js` | 补 v1 → v2 迁移用例 |
| `design.md` | 修正第 350 行过期路线项 |

**删除**

| 路径 | 依据 |
|------|------|
| `src/test/filter-bar.test.js` | 测的是已删除的 `Canvas.tsx` / `FilterBar.tsx`；删除前必须全仓确认无生产引用 |

### 2.2 目标数据模型

```ts
// src/domain/dataset-spec.ts
export interface DatasetSpec {
  id: string;
  title: string;
  connection: string;
  table: string;
  /** 生成这个数据集时实际执行的 SQL —— 重新取数的唯一依据 */
  sql: string;
  columns: string[];
  /** 落盘前按上限裁剪；完整行数见 rowCount */
  rows: Record<string, unknown>[];
  /** SQL 完整结果行数（可能大于 rows.length） */
  rowCount: number;
  fetchedAt: number;
}

// 常量
export const DATASET_ROW_LIMIT = 2000;       // 与 dbx_query_full 默认 maxRows 一致
export const DATASET_STORE_BYTE_LIMIT = 2 * 1024 * 1024; // 单产物落盘体积上限（待实测校准）
```

```ts
// src/domain/dataset-filter.ts
export interface ChartFilter {
  column: string;
  /** 等值集合；空集合等价于不过滤 */
  values?: (string | number | boolean)[];
  min?: number | string;
  max?: number | string;
}

/** 字段不在 dataset.columns 里 → 跳过该 filter（与 QueryBI 跨数据集行为同理） */
export function applyFilters(
  rows: Record<string, unknown>[],
  columns: string[],
  filters: ChartFilter[],
): Record<string, unknown>[];
```

```ts
// src/domain/chart-contract.ts（改动后）
export interface Visualization {
  id?: string;
  title: string;
  type: "dashboard" | "screen";
  connection: string;
  table: string;
  /** 导出时才生成；不再是存储的事实源 */
  html?: string;
  chartItems: ChartItem[];
  sql?: string;
  datasets?: DatasetSpec[];
  filters?: ChartFilter[];
  schemaVersion?: 2;
  createdAt?: number;
}
```

存储文档：

```jsonc
// visualizations.json — v2
{ "schemaVersion": 2, "items": [ /* Visualization[] */ ] }

// visualizations.json — v1（必须继续能读）
[ /* Visualization[]，无外层包装 */ ]
```

### 2.3 目标用户流程

```text
① 生成
   表上右键 → 可视化 → AI 写聚合 SQL → dbx_query_full 取数
   → 产出 DatasetSpec + ChartItem[] → 落库（schemaVersion 2）

② 查看与筛选
   「BI 数据资产」→ 点开产物 → 详情抽屉
   → 数据集列表（连接 / 表 / 行数 / SQL）
   → 筛选面板（字段级等值 + 范围）
   → 改筛选 → 前端过滤 rows → 图表重绘（不重跑 SQL）
   → 顶部标注「筛选后 N 行 / 全部 M 行」

③ 重新取数
   → 点「重新取数」→ 重跑 DatasetSpec.sql → 更新 rows + rowCount + fetchedAt
   → 全部引用该数据集的图表刷新；失败时原样展示 SQL 错误

④ 导出
   → 点「导出」→ 此刻才生成 html → withEmbeddedChartJs() 内联运行时 → 下载
```

---

## 3. 任务拆分

### M0 —— 修下限（不改 UI 行为）

> 目标：把存储与测试的地基修正，给 M1 一张安全网。验收时**用户可见行为只应有一处变化**：达到上限时的提示。

#### T-M0-1 存储文档升到 v2 并支持 v1 读取

- **涉及**：`src/domain/visualization-doc.ts`（新增）、`src/features/visualization/visualization-store.ts`
- **步骤**
  1. 新增 `visualization-doc.ts`：`CURRENT_DOC_VERSION = 2`、`readDoc(raw): { schemaVersion, items }`、`writeDoc(items): string`
  2. `readDoc()` 同时接受 v1（裸数组）与 v2（`{schemaVersion, items}`）；v1 条目升级时补 `schemaVersion: 2` 并打上 `readonlySnapshot: true` 标记
  3. **不尝试反推 `datasets`** —— v1 条目保留 `html` + `chartItems`，只是不能再局部编辑
  4. `visualization-store.ts` 的 `hydrate()` / `persist()` 改走这两个函数
- **验证**：`src/test/visualization-doc.test.js` 覆盖 4 类输入（v1 裸数组 / v2 文档 / 损坏 JSON / 混合条目）

#### T-M0-2 放开上限并让截断可见

- **涉及**：`src/features/visualization/visualization-store.ts`
- **步骤**
  1. `MAX_VISUALIZATIONS` 20 → 100
  2. 截断发生时通过宿主 `notify` 明确提示（文案需说明「已超出上限，最旧的 N 条未保存」）
  3. **不改** `slice` 语义与排序规则，避免行为漂移
- **验证**：`src/test/stores.test.js` 增加「超过上限时收到提示且条目数正确」用例

#### T-M0-3 清理孤儿测试

- **涉及**：`src/test/filter-bar.test.js`（删除或改写）、`src/shared/services/infer-schema.ts`（判定）
- **步骤**
  1. 先跑 `grep -rn "filter-bar\|FilterBar" src/ --include=*.ts --include=*.tsx` 确认无生产引用
  2. 确认 `infer-schema.ts` 是否与已删除的 Canvas 流水线有关联；无关则不动
  3. 删除 `filter-bar.test.js`（新筛选契约在 M1 由 `dataset-filter.test.js` 覆盖）
- **验证**：`npm test` 全绿；`grep` 输出为空

#### T-M0-4 修正过期文档

- **涉及**：`design.md`
- **步骤**：第 350 行 `- [ ] 添加数据可视化功能` → 改为已完成的描述并指向 ADR-0005 / 0007 / 0009
- **验证**：人工核对

#### M0 交付

- [x] 4 个任务全部通过验证
- [x] `npm run check` + `npm test` 全绿（640 tests / 639 pass / 1 skip / 0 fail）
- [x] 版本 `0.1.15` → `0.1.16`（见 §6）
- [x] 一页「BI 数据资产现状与迁移说明」→ `docs/plans/bi-data-assets-m0-notes.md`

**完成记录（2026-10-09）—— 与上述步骤的三处偏差**

1. **`schemaVersion` 只放在文档外壳，不放逐条条目。** 逐条版本号没有消费者：判定「只读快照」只看文档外壳是不是裸数组，加逐条字段是推测性设计。v1 条目实际打的是 `readonlySnapshot: boolean`。
2. **迁移用例没有放进 `stores.test.js`，而是新增 `visualization-doc.test.js`。** `visualization-store.ts` 是模块级单例 + React hook，测它要把 storage、React 生命周期都铺开；迁移判定是纯函数，放在新模块测试更直接，也避免为了测试去导出内部实现。`stores.test.js` 因此不动。
3. **T-M0-2 的验证方式改为构建级核对 + `visualization-doc.test.js`。** 「超上限时收到提示」需要 mock 宿主 `notify` 并驱动 store 单例，成本远高于收益；上限与提示逻辑极短，已人工核对，且提示效果在真实使用时可见。**这是一处真实的测试缺口**，若日后在 store 层引入可注入的依赖（如 `setRuntime`），应补上该用例。

`infer-schema.ts` 的判定结论：**保留**。它无生产引用，但推断列角色的能力正是 M1 筛选面板选择控件形态的依据；M1 接上消费者后即为活代码。

---

### M1 —— 方案 B 减法版 + 筛选（主体）

#### 第一刀：模型先落，UI 不动

##### T-M1-1 扩展数据模型

- **涉及**：`src/domain/chart-contract.ts`、`src/domain/dataset-spec.ts`（新增）
- **步骤**
  1. `chart-contract.ts` 新增 `DatasetSpec` / `ChartFilter`（或从 `dataset-spec.ts` / `dataset-filter.ts` re-export，保持既有 import 路径不破）
  2. `Visualization.html` 改可选；新增 `datasets?` / `filters?` / `schemaVersion?: 2`
  3. `dataset-spec.ts` 实现 `normalizeDatasetSpec()`（补 id / 补 columns 推断 / 裁剪 rows 到 `DATASET_ROW_LIMIT`）、`estimateDatasetBytes()`
- **验证**：`src/test/dataset-spec.test.js` —— 缺 id 自动补、超限裁剪且 `rowCount` 保留完整值、体积估算误差 < 10%

##### T-M1-2 筛选求值

- **涉及**：`src/domain/dataset-filter.ts`（新增）
- **步骤**
  1. 实现 `applyFilters(rows, columns, filters)`：等值（`values`，空集合等价不过滤）、范围（`min` / `max`，含字符串日期直比）
  2. 字段不在 `columns` 里 → 跳过该 filter（**不报错**，与 Quick BI 跨数据集不关联的行为同理）
  3. 多个 filter 之间为 AND
- **验证**：`src/test/dataset-filter.test.js` —— 空筛选、空 Set、跨源列跳过、多条件 AND、范围边界（含 `min === max`）、字符串日期

##### T-M1-3 图表工具支持 datasets，html 改为惰性生成

- **涉及**：`src/tools/dbx-chart-collection.ts`
- **步骤**
  1. 新增**可选** `datasets` 参数；不传时行为与现在完全一致（向后兼容是硬要求）
  2. `html` 从「handler 里生成并存储」改为「存 `datasets` + `chartItems`；导出时生成」
  3. 导出路径继续走 `buildHtmlHead` + `chart-defaults` + `withEmbeddedChartJs()`，不改语义
  4. 保留既有的 `normalizeChartData()` / `validateChartData()` 的可见错误卡片行为
- **验证**：`src/test/dbx-chart-collection.test.js` 扩充 —— ①不带 datasets 的旧调用产物结构与旧测试断言一致；②带 datasets 时 `html` 不落库；③导出时才生成 html 且内联 Chart.js 生效

#### 第二刀：UI 跟上

##### T-M1-4 UI 内 Chart.js 渲染

- **涉及**：`src/features/visualization/components/chart-item-renderer.tsx`（新增）
- **步骤**
  1. 直接 `import` `src/shared/vendor/chart.umd.js`，**确保与导出产物同版本**
  2. 复用 `chart-defaults.ts` 的两套 defaults（dashboard / screen），避免 iframe 内外视觉不一致
  3. 组件卸载时 `chart.destroy()`，避免内存泄漏
- **验证**：视觉对比 —— 同一产物在 UI 内与导出 HTML 中并排观察

##### T-M1-5 详情抽屉

- **涉及**：`visualization-detail-drawer.tsx`、`dataset-summary-list.tsx`、`dataset-filter-panel.tsx`（新增）、`visualization-gallery.tsx`
- **步骤**
  1. 抽屉三段：数据集摘要（连接 / 表 / 行数 / SQL）→ 筛选面板 → 图表预览
  2. 筛选面板从 `DatasetSpec.columns` 派生可用字段；等值型给多选，数值 / 日期型给范围
  3. 筛选变化 → `applyFilters()` → 传过滤后的 rows 给 `ChartItemRenderer` → **不发新查询**
  4. 顶部显式标注「筛选后 N 行 / 全部 M 行」
  5. 画廊卡片点击打开抽屉；v1 「只读快照」产物在抽屉里表明状态并禁用筛选
- **验证**：`src/test/visualization-detail.test.js`（RTL）—— 打开抽屉、改筛选后图表数据源变化、只读快照禁用筛选

##### T-M1-6 重新取数

- **涉及**：`src/features/visualization/hooks/use-dataset-refetch.ts`（新增）、详情抽屉
- **步骤**
  1. 复用 `dbx_query_full` 背后的同一取数函数，**不新增数据通道**
  2. 状态机：`idle → running → ok / error`；`ok` 时更新 `rows` / `rowCount` / `fetchedAt` 并持久化
  3. `error` 时**原样透传 SQL 错误文本**，走既有 `classifyError` 的错误码
  4. 未保存的筛选条件在重新取数后保留（但需重算：字段可能消失）
- **验证**：手动用例 —— 改一条数据后重新取数，图表反映新数据；故意写错 SQL，错误文本可见

##### T-M1-7 更新 AI 工作流提示词

- **涉及**：`src/shared/ai/send-context.ts`
- **步骤**：在 `dbx_chart_collection` 调用说明处补 `datasets` 的传参方式与「传了 datasets 就不要自己拼 html」；保持既有 `render_chart` 预览步骤不变
- **验证**：`src/test/send-context.test.js` 更新（若断言了提示词片段）

#### M1 交付

- [x] 7 个任务全部通过验证 —— 其中 6 个靠自动化验证；T-M1-6（重新取数）方案指定的验证方式就是「真实连接手动用例」，本机没有可用数据源，未执行（见下方交付记录第 6 条）
- [x] ADR-0009 §10 的 M1 验收标准逐条勾选（唯一未勾的是「重新取数」那条，原因写在同一处）
- [x] `npm run check` + `npm test` + `npm run build` 全绿（708 tests / 707 pass / 1 skip / 0 fail）
- [x] 版本 `0.1.16` → `0.2.0`（见 §6：6 处字符串、5 个文件）

**完成记录（2026-10-09）—— 与方案的偏差、新模块与发布说明**

1. **`applyFilters` 的签名比方案多一个 `columns` 入参**：`applyFilters(rows, columns, filters)`。判断「字段不在 `columns` 里则跳过」必须知道列清单，把列交给函数比让调用方先自己筛更不容易错。
2. **新增模块 `src/domain/chart-source.ts`（方案未列）**：「行 → Chart.js data」是筛选重绘与导出共同的依赖，独立成 domain 模块后 `resolveChartItems()` 同时服务详情抽屉、预览标签页、卡片导出三处，不必各自重算。
3. **新增模块 `src/features/visualization/visualization-html.ts`（方案 T-M1-3b）**：`html` 改为导出时生成，就需要一个唯一的生成入口，否则导出路径很快会分叉成多份实现。它复用的就是 `dbx-chart-collection` 的 `generateHtml()`，和 Agent 生成路径同源。
4. **渲染 / 导出路径全部改成「先解析图表项再渲染」**：`visualization-tab.tsx` 与 `visualization-gallery.tsx` 的卡片导出原先直接用 `viz.chartItems`（即 AI 写下的占位数据），带 `datasets` 的产物会导出一张空图。已改为先 `resolveChartItems()`（卡片用产物自带的初始筛选）再渲染 / 导出。
5. **测试落地位置与 §4 表格有差异**：接线测试叫 `visualization-detail-wiring.test.js`；主题一致性新增 `chart-theme-parity.test.js`；导出内联与工具契约的断言并进了 `dbx-chart-collection.test.js`，没有另开 `chart-runtime.test.js`。
6. **本次唯一未闭环的验收项**：T-M1-6 重新取数的真实连接验证与 §4 那份手动清单（真实 PostgreSQL + MySQL、引擎日志确认“筛选不新发查询”、断网打开导出、手工降级 v1 文件）都没跑 —— 本机无可用数据源。不允许用单测代替真实环境，所以清单原封不动留在未勾选状态。
7. **发布说明（§7 回滚点，必须写进发布通报）**：M1 之后带 `datasets` 的产物**不再落库 `html`**，`html` 是导出时派生的。`0.1.x` 及更早的插件版本读不到 `html`，会判定“既没有 HTML 也没有图表项”而预览失败 —— 回滚或降级到 `0.1.x` 之前，先把这类产物导出成文件或删掉。
8. **展示层文案（§6 的评估项）本轮刻意不改**：`detail.json` / `detail.zh.json` 与市场卡片描述依旧只介绍工作台，没提看板/大屏与筛选。理由有两条：它现在的描述连 **M1 之前就存在**的看板/大屏能力都没写，说明整个展示层落后于插件的实际能力，不是 M1 造成的缺口；修正它需要一次中英文对齐的文案专用改动（卡片描述 + 详情块同步），不该混进一个模型/UI 里程碑里顺便做完。建议单独排一轮，至少要把「看板/大屏 + 数据集筛选与重新取数」写进去（AGENTS.md 要求卡片简介描述使用价值）。

---

### M2 —— 图表表现力（`0.2.0` → `0.3.0`)

#### T-M2-1 类型扩展（只增不改）

- **涉及**：`src/domain/chart-contract.ts`、`src/tools/dbx-chart-collection.ts`
- **步骤**
  1. `ChartItemType` 在原有 8 个值之后追加 `"funnel" | "boxplot" | "metric"`，原 8 个值一字不动
  2. 工具 `charts[].type` 的 JSON Schema `enum` 同步追加 —— 它才是 Agent 实际能传的取值范围
  3. 工具 `description` 补三种类型的数据契约与 `options.figure` 的字段清单
- **验证**：`dbx-chart-collection.test.js` —— `enum.slice(0, 8)` 逐字等于旧的 8 种、`slice(8)` 恰为三种新类型；描述里出现 `funnel` / `metric` / `boxplot` / `options.figure`

#### T-M2-2 自研渲染器（`src/features/visualization/figures/`，新增 9 个文件）

- **步骤**
  1. 基础层：`figure-palette`（两套主题调色板 + `SERIES_COLORS` 单一来源）、`figure-text`（`escapeHtml` / 数值格式化 / 降级提示块）、`figure-options`（`options.figure` 唯一读取口）、`figure-context`（类型）、`figure-series`（series 读取）
  2. 渲染器：`funnel-figure` / `metric-figure` / `boxplot-figure`，签名 `(item, context) => string`，返回**卡片正文片段**；几何内联、无 `<style>`、无 `var(--…)`
  3. `figure-registry`：`FIGURE_RENDERERS` 登记表 + `isFigureType()` + `renderFigure()`（含未注册类型的可见降级卡）
- **验证**：`figure-render.test.js` —— 分派与注册表、三种类型的数据契约与边界、降级、`options.figure` 的开关与钳制、**全部用户可见文本经 `escapeHtml`**

#### T-M2-3 两条路径接线

- **涉及**：`dbx-chart-collection.ts`、`chart-grid.tsx`、`figure-item-renderer.tsx`（新增）、`visualization.css`、`chart-source.ts`
- **步骤**
  1. 导出：`buildChartArea` 在 `isFigureType(chart.type)` 时只 push 片段并 `return`，不生成 `new Chart(...)`、不放 `<canvas>`
  2. UI：`ChartGrid` 三分支分派（数据非法 → 错误卡 / figure → `FigureItemRenderer` / 原生 → `ChartItemRenderer`）；`figure-item-renderer.tsx` 用 `dangerouslySetInnerHTML` 注入同一段字符串
  3. `"funnel"` 进 `SINGLE_SERIES_TYPES`（漏斗是一条链路）；`"metric"` 刻意不进（`datasets[1..]` 是口径对照）
- **验证**：`figure-dispatch.test.js` —— 分派正确、原生类型不受影响、**UI 注入结果与 `renderFigure()` 输出逐字相等**（ADR-0009 §10 ⑤ 的视觉一致在 M2 的等价形式）；`chart-source.test.js` 守住单序列语义

#### T-M2-4 提示词

- **涉及**：`src/shared/ai/send-context.ts`
- **步骤**：结果集 / 看板 / 大屏三条提示词路径都补 metric / funnel / boxplot 的选用原则与 `options.figure`；大屏的「核心指标」明确指到 `metric`
- **验证**：`send-context.test.js` —— 三条路径都出现，且三处抄本的合同行逐字一致

#### M2 交付

- [x] 4 个任务全部通过验证
- [x] ADR-0009 §10 的 M2 验收标准逐条勾选
- [x] `npm run check` + `npm test` + `npm run build` 全绿（759 tests / 758 pass / 1 skip / 0 fail；产物 `release/dbx-pro-0.3.0.astraviapkg`，29 个运行时文件）
- [x] 版本 `0.2.0` → `0.3.0`（§6：6 处字符串、5 个文件）
- [x] 零新增 npm 依赖、零新增 vendored UMD —— M2 的硬前提（见完成记录第 1 条）

**完成记录（2026-10-09）—— 取舍、不实现项与已知问题**

1. **零依赖是硬约束推出来的结论**：产物必须是一份自包含离线 HTML，每加一种图就多内联一个 UMD 的话，导出体积与「来源 + sha256 校验 + 版本号断言」的配套工作会同步膨胀。所以三种新类型全部自研 DOM/HTML 渲染，没有引入 Chart.js 插件，`src/shared/vendor/` 仍然只有 `chart.umd.js` 一份。`recharts ^3.10.1` 是 M1 之前就存在但未使用的依赖，M2 没有动它（清理是另一个盘子的事）。
2. **桑基图 / 词云评估后不实现**：桑基的分层布局与连线路径得自己写（Chart.js 无原生支持，`chartjs-chart-sankey` 也不在随插件打包的那份 UMD 里），跨层标签避让是独立工作量；词云需要排版 / 碰撞检测库加中文分词与字形测量，收益不抵体积与依赖成本。两者均已写进 ADR-0009 §9 M2 的「不实现项」。
3. **箱形图用纯 HTML/CSS 百分比定位，不用 SVG**：最初考虑过 `viewBox` 缩放，放弃的原因是它会把纵轴刻度、标签一起放进坐标系，字体大小会随容器宽度浮动，与另两种渲染器不一致。现在坐标轴刻度是 56px 固定栏，箱体 / 中位线 / 上下须都是百分比定位，图和字各自稳定。
4. **逃生口是代码级登记表，不是 Agent 自由发挥**：`FIGURE_RENDERERS` 加一项就能同时接上 UI 与导出两条路径；**不接受 Agent 传裸 HTML / SVG** —— 那等于绕开全部转义，与「图表类型只增不改」的兼容性合同也没法对账。ADR-0009 §7 非目标里原写的是「Agent 提供 Chart.js `options` / `plugins` 已部分覆盖」，实际落到的是一份更窄、但可控的登记表。
5. **地图类明确不实现**：理由沿用 §7 非目标第 7 条 —— 省 / 市级地理边界数据是数 MB 级，与自包含离线单文件的成本模型直接冲突。该结论已写进 ADR-0009 §10 M2 的验收项。
6. **已知问题（本轮刻意不修）**：`buildChartArea` 里 `<h3>${chart.title}</h3>` / `<p class="chart-desc">${chart.description}</p>` 是**既有**的未转义插值（M0 / M1 就存在）。M2 只保证 figure 自己产出的文本全部过 `escapeHtml`，没顺手改非 figure 路径的转义 —— 那是一个影响所有图表类型、且会改变既有导出字节的独立口径改动，不该搭在 M2 里。
7. **`options.figure` 与 `options` 是两层**：figure 分支只读 `options.figure`，不会把它交给 Chart.js；反过来原生类型传 `options.figure` 也只是被忽略的未知键。这样两边都不会因为对方新增字段而炸。
8. **展示层文案仍未更新**：与 M1 完成记录第 8 条同一结论 —— `detail.json` / 卡片描述还只讲工作台，没提看板 / 大屏、数据集筛选、也没提这批新图表类型。建议单独排一轮中英文对齐的文案改动。
9. **发布说明（§7 回滚点，仍适用）**：M1 之后带 `datasets` 的产物不再落库 `html`；`0.1.x` 及更早版本读不到这类产物。M2 没有改变这个约定，但新增了三种 `type` 取值 —— 降级到 `0.2.x` 时，带 `funnel` / `boxplot` / `metric` 的产物会掉进 Chart.js 并得到一个白画布（那时还没有降级卡），所以**先导出或删掉这类产物再降级**。
10. **构建哈希说明**：`npm run build` 产出的 `release/dbx-pro-0.3.0.astraviapkg` 与市场构建（dev 模式）生成的制品哈希不一致（`0eb101d6…` vs `2c4b13dc…`），与 M1 同样的原因（两条构建路径的产物不同），不影响任何断言；正式制品由受保护 CI 构建。

### M3 —— 轻量血缘（`0.3.0` → `0.4.0`)

- [x] 产物 → 源连接 / 表 / SQL / 生成时间 的展示 —— `src/domain/visualization-lineage.ts`（纯函数层） + `src/features/visualization/components/visualization-lineage-panel.tsx`（纯 props） + `visualization-detail-drawer.tsx` 接线
- [x] 「哪些产物引用了这张表」反查（扫描 `DatasetSpec.connection + table`）—— `findArtifactsByTable(items, target, excludeId)`：按 **(连接, 表名) 成对**匹配、排除产物自己
- [x] 不做 Quick BI 的图分析 / 下钻到组件粒度 —— 本轮只有「这条产物来自哪里」「谁还读了这张表」两条**只读**视图，没有图分析画布、没有列级 / 组件级下钻

**M3 交付记录（2026-10-10）**

1. **表身份按 (连接, 表名) 成对匹配，不做大小写折叠**：PostgreSQL 会把未加引号的标识符折叠成小写，而 Linux 上的 MySQL 默认区分大小写 —— 一律 `toLowerCase()` 的折中方案在 MySQL 上会**错配**到另一张表，比漏配更糟。宁可漏配也不错配。
2. **反查是只读视图，不做跳转**：面板只展示「还有哪些产物读了同一张表」，点击不切换产物 —— 切换会牵动详情抽屉、画廊选中态与未保存的筛选，属于交互设计，不在本轮。
3. **旧格式（v1 只读快照）不编造取数 SQL**：没有取数 SQL 时如实显示「旧格式快照只有表信息，没有取数 SQL」，而不是拿表名反推一句看起来合理的 SQL。快照的**表**来自产物顶层真实记录的 `connection` / `table`（`datasets` 缺失时的唯一线索）—— 属于「记录到的来源」，不是编造；新产物以 `datasets[]` 为唯一权威来源，顶层追踪字段不额外算一个来源。
4. **测试**：新增 `src/test/visualization-lineage.test.js`（14 项 = 纯函数 10 + 面板文案 3 + 抽屉接线 1）；接线用例挂的是**真实** `VisualizationDetailDrawer` 与**真实** store（`renderHook(() => useVisualizationStore())`），不以纯函数测试替代接线测试（§4 硬要求第 2 条）。
5. **零新增 npm 依赖**：血缘是字符串与数组运算，没有引入图布局库；`src/shared/vendor/` 不变。
6. **版本**：`0.3.0` → `0.4.0`（§6：6 处字符串、5 个文件），并同轮把展示层文案对齐到 M1 / M2 / M3 的实际能力。
7. **降级安全**：血缘只是读 `visualizations.json` 里已有字段（`datasets[].connection / table / sql / rowCount`）并多显示一块，**没有新增存储字段、没有改文档格式**；降级回 `0.3.x` 只是少了这一个面板，产物照旧可预览、可导出。所以 M3 不新增回滚点。
8. **全量测试**：0.4.0 共 781 项 / `# pass 780` / `# fail 0` / `# skipped 1`（沿用既有那 1 项）；对比 0.3.0 的 759 项，新增 22 项 = 血缘 14 + 真实连接门控 3 + `stores.test.js` 2 + `execute-server-page.test.js` 3。同轮的 Track A 也把 M1 欠下的真实连接验证补上了：门控用例在本机真 PostgreSQL 上 **3/3 通过**（不是跳过）。

---

## 4. 测试策略

### 分层

| 层 | 目标 | 文件 |
|----|------|------|
| 纯函数 | 规范化、裁剪、筛选求值、文档迁移、血缘计算 | `dataset-spec.test.js`、`dataset-filter.test.js`、`visualization-doc.test.js`、`visualization-lineage.test.js` |
| 图表片段 | 三种自研渲染器的数据契约、转义与降级 | `figure-render.test.js`、`figure-dispatch.test.js` |
| 工具契约 | `dbx_chart_collection` 的输入输出与向后兼容 | `dbx-chart-collection.test.js`（扩充） |
| 存储 | v1 → v2 迁移、上限提示、并发写 | `stores.test.js`（扩充） |
| 组件接线 | 详情抽屉、筛选面板、血缘面板的可见行为 | `visualization-detail-wiring.test.js`、`visualization-lineage.test.js`（均为 RTL） |
| 导出 | 内联 Chart.js、断网可用、UI↔导出一致 | `chart-runtime.test.js`、`chart-theme-parity.test.js` |
| 真实连接（门控） | 真库取数 → 产物 → 筛选不重查 → 重新取数 → 离线单文件渲染 | `bi-live-postgres.test.js`（本机连不上 PostgreSQL 时整体跳过） |

### 硬要求

1. **新测试一律 `.js`** —— 测试脚本 glob 是 `src/test/*.test.js`。
2. **纯函数测试不能替代接线测试** —— 筛选必须有一条从「组件里改筛选 → 图表数据源变化」的 RTL 用例（遵循 `docs/plugin-project-structure.md` 的测试约定）。
3. **向后兼容必须有专门用例** —— 「不带 `datasets` 的旧调用」不是靠人工判断，要有断言。
4. **每周至少一次手动验证**：真实连接上生成产物 → 筛选 → 重新取数 → 断网导出 → 在浏览器打开。

### 手动验证清单（每个里程碑收尾跑一次）

> **覆盖状态（2026-10-10 复核）**：下面 6 条是**界面级**手动清单，一律不勾 —— 本轮没有在真实界面里点过一遍流程。其中 4 条的「真库 + 真引擎」部分已有自动化门控用例（`src/test/bi-live-postgres.test.js`）盯着，但它不等于手动清单，也不能代替手动清单。

- [ ] 真实数据库（PostgreSQL + MySQL 各一）生成 dashboard 与 screen 各一个
      > PostgreSQL 侧已跑通：门控用例①（真库建表 → 真引擎取数 → dashboard 与 screen 两种产物都生成）。**MySQL 本机无实例，未跑**；产物种类只覆盖了用例里那两种 SQL。
- [ ] 筛选生效，且**没有**新的数据库查询（看引擎日志）
      > 门控用例②已断言「筛选只重算前端、引擎 `/query` 调用数不增」（在 HTTP 层计数，不是看引擎日志）。界面级确认未跑。
- [ ] 重新取数后图表反映新数据
      > 门控用例③：先向表里插一行，再驱动真实 `useDatasetRefetch`，断言重取后数据反映新值；同时断言 SQL 失败时引擎错误原样可见。界面级确认未跑。
- [ ] 断网打开导出的 HTML，图表正常渲染
      > 门控用例①用 happy-dom 执行自包含单文件（不注入任何库）验证了离线可渲染，**但不是真实浏览器**。断网 + 真浏览器仍未跑。
- [ ] 把 `visualizations.json` 手工降级成 v1 格式，重启后产物仍在、可预览
      > 迁移逻辑由 `visualization-doc.test.js` + `stores.test.js` 覆盖；「手工改文件 + 重启桌面端」未跑。
- [ ] 达到 100 条上限时看到明确提示
      > `stores.test.js` 断言了截断时的提示文案；界面级未跑。

**结论**：本轮**只能确认 ①（PostgreSQL 侧）与 ③ 的真实数据链路成立**，而且是靠门控集成用例而不是手动点击。仍欠的是：**MySQL 实例上的界面验证**、**真实浏览器断网导出**、**手工降级 + 重启**、**100 条上限的界面提示**。这四项目前都缺环境（本机只有一个 PostgreSQL），需要在有 MySQL 的机器上补一轮，不能凭单测勾选。

---

## 5. 迁移与兼容

### 5.1 存储迁移

```text
读：visualizations.json
  ├─ 解析失败        → 视为空文档（保留原文件，不覆盖）
  ├─ 裸数组（v1）     → 每条补 schemaVersion: 2 + readonlySnapshot: true
  └─ {schemaVersion:2} → 直接使用
写：永远写 { schemaVersion: 2, items: [...] }
```

**只读不删**是硬约束：v1 条目的 `html` + `chartItems` 原样保留，不尝试反推 `datasets`。

### 5.2 工具契约兼容

| 输入 | 行为 |
|------|------|
| 只有 `charts[]`（旧调用） | 与现在**完全一致**：生成 html 并存储 |
| `charts[]` + `datasets[]` | 存储 `datasets` + `chartItems`；`html` 不落库，导出时才生成 |
| `datasets[]` 里 `rows` 超限 | 裁剪到 `DATASET_ROW_LIMIT`，保留完整 `rowCount` |

### 5.3 体积保护

落盘前按顺序降级：

```text
1. rows 裁剪到 2000 行
2. 体积仍超 DATASET_STORE_BYTE_LIMIT →
   a. 只保留 columns 中实际被 chartItems 引用的列
   b. 仍超 → 只存 sql + columns，不存 rows（UI 上标记「需要重新取数」）
3. 写入失败 → notify 并保留旧值，不破坏已存产物
```

> `DATASET_STORE_BYTE_LIMIT` 需要实测校准：M0 期间跑一个真实 2000 行 × N 列产物，记录 JSON 体积后再定值。

---

## 6. 版本与发布

### 每次发布要同步的位置

| 文件 | 字段 |
|------|------|
| `abilities/plugins/dbx-pro/plugin.json` | `version` |
| `abilities/plugins/dbx-pro/ability.json` | `version` |
| `abilities/plugins/dbx-pro/package.json` | `version` |
| `abilities/plugins/dbx-pro/package-lock.json` | `version`（+ 根 name 项） |
| `.astravia/marketplace.source.json` | `abilities[]` 中 `slug === "dbx-pro"` 的 `version` |

`dist/` 与 `release/` 在 `.gitignore` 里，**不提交**；`.astraviapkg` 由 CI 构建并作为不可变制品发布。`marketplaceVersion` 由 CI 分配，源码不手工维护。

### 提交前检查

```bash
cd abilities/plugins/dbx-pro
npm run check
npm test
npm run build

cd ../../..
node scripts/marketplace.mjs check
node --test tests/marketplace.test.mjs
```

> 若 P0 展示层需要更新（M1 会让「BI 数据资产」成为可对外介绍的能力），同步评估 `detail.json` / `detail.zh.json`。默认语言写英文、中文放 `zh` 覆盖。

### 版本映射

| 里程碑 | 版本 | 性质 |
|--------|------|------|
| M0 | `0.1.16` | patch：存储格式变化 + 提示，用户可见行为几乎不变 |
| M1 | `0.2.0` | minor：新增筛选 / 重新取数 / 详情抽屉（**用户可见的能力升级**） |
| M2 | `0.3.0` | minor：新增图表类型 |
| M3 | `0.4.0` | minor：血缘 |

---

## 7. 风险与回滚

| 风险 | 触发条件 | 回滚动作 |
|------|---------|---------|
| v1 → v2 迁移写坏存量产物 | 用户报告产物丢失 | 迁移代码**不删不覆写原文件**；出问题时可从备份恢复并回退到上一版本插件 |
| `rows` 落盘撑爆宿主存储 | `visualizations.json` 增长到几十 MB | §5.3 的三级降级；降级后产物仍可用（只是需要重新取数） |
| 筛选口径误导 | 用户按筛选后的数字决策 | 顶部强制标注「筛选后 / 全部」；文档明确写筛选不改变聚合口径 |
| UI 内渲染与导出视觉不一致 | 用户对比后发现差异 | 复用同一份 `vendor/chart.umd.js` 与 defaults；不引入第二套主题 |
| `filter-bar.test.js` 删除误伤 | 有未发现的生产引用 | M0 先 `grep` 全仓；删除与引用确认在同一个提交里 |
| AI 生成 `datasets` 失败 | 生成成功率下降 | `datasets` 保持可选；不传即退回旧行为 |
| M1 复杂度被低估 | 里程碑滑期 | M1 已拆两刀，第一刀（模型）可独立交付并验收 |

**回滚点**：

- M0 前：`visualizations.json` 仍是裸数组，回退插件版本无副作用
- M0 后：v2 文档对旧版本插件不可读 → **M0 的发布说明必须提示备份**，或在读路径同时兼容（推荐前者）
- M1 后：`html` 不再落库，旧版本插件读不到 `html` 会预览失败 → 发布说明必须说明

---

## 8. 完成定义（DoD）

一个里程碑算完成，需要同时满足：

1. 该里程碑所有任务勾选完毕
2. ADR-0009 §10 中对应段落的验收标准逐条通过
3. `npm run check` / `npm test` / `npm run build` 全绿
4. 手动验证清单（§4）跑过一次 —— **目前 M0–M3 都还没跑过**（界面级，本机缺 MySQL 实例）。`0.4.0` 的做法是把其中「真库 + 真引擎」那部分用门控集成用例顶上并**逐条登记缺口**（§4 覆盖状态），而不是直接把清单勾绿；这一条仍算未满足。
5. 版本已在 5 处同步（§6）
6. `node scripts/marketplace.mjs check` + `node --test tests/marketplace.test.mjs` 通过
7. 若行为对用户可见，`detail.json` / `detail.zh.json` 已评估是否需要更新

---

## 附录：命令速查

```bash
cd abilities/plugins/dbx-pro

# 开发
npm install
npm run check          # tsc --noEmit
npm test               # 全量测试
npm run build          # vite build（M1 前确认构建产物可用）

# 排查
grep -rn "BI 数据资产" src/                      # 功能在代码里的全部出现位置
grep -rn "filter-bar\|FilterBar" src/           # 孤儿测试引用确认
grep -n "STORE_SCHEMA_VERSION\|MAX_VISUALIZATIONS\|STORE_PATH" \
     src/features/visualization/visualization-store.ts
grep -rn "dbx_chart_collection" src/             # 确认只有一处图表工具注册

# 产物
ls ~/Library/Application\ Support/*/dbx-pro/visualizations.json   # 宿主存储路径按实际平台确认

# 仓库级校验（在仓库根）
node scripts/marketplace.mjs check
node --test tests/marketplace.test.mjs
```
