# ADR-0010a: BI 可视化 5 skill 执行层对等移植

## 状态

已接受。执行版本 `0.4.5`。

父决策：ADR-0010。

---

## 0. 增量结论

jimubi-bigscreen 的 **spec_builder.py**（1100+ 行 Python）不是「JeecgBoot 平台 API 调用」——它是一个**独立编译器**：AI 写紧凑 JSON spec → 编译器加载 129 个 defaults JSON → 按组件类型路由 handler → 应用深色主题 palettes → pitfall 防呆修正 → 输出完整组件 JSON。`--dry` 模式下纯编译不调任何 API。

这个设计模式（紧凑 spec → defaults 展开 → handler 路由 → 主题应用 → 防呆 → 输出）**与具体渲染器解耦**。dbx-pro 的对等实现：目标从「生成 JimuBI 组件 JSON」变成「生成 ECharts option + Chart.js option + HTML 片段」。

---

## 1. 5 个 BI skill 的对等实现

### 1.1 jimubi-bigscreen → dbx-bigscreen-builder

**jimubi spec_builder.py 设计模式（可直接搬）**：

| 模式 | jimubi 实现 | dbx-pro 对等 |
|---|---|---|
| 紧凑 spec 格式 | `{ page, palette, components[] }` | **直接复用**同格式 |
| defaults 驱动展开 | `defaults/<comp>.json` 读取 + 缓存 | `bigscreen-defaults.ts`：ECharts + Chart.js defaults 库 |
| per-type handler 路由 | 21 个 SPECIAL_HANDLERS + ECHARTS_CARTESIAN + ECHARTS_POLAR | 21 个 TypeScript handler（签名 `(comp, palette, defaults, engine) => EChartsOption \| ChartItem \| HtmlFragment`） |
| 深色主题自动应用 | `PALETTES` 命名色板（科技/复古/商务） | `bigscreen-palettes.ts`：5 套命名色板（科技/政务/商务/复古/医疗）|
| pitfall 防呆 | 字段名兼容 + 颜色格式 + 布局预警 | `bigscreen-pitfalls.ts`：同等逻辑 + dbx-pro 特有（rows→datasets）|
| 变体支持 | `load "<type>_<variant>.json"` | Chart.js/ECharts defaults 变体分档 |
| 布局约束预警 | JStatsSummary 折行高度 + 饼图 h<220 重叠 + JColorBlock 24 栅格 | `bigscreen-layout.ts`：同等逻辑 |
| 输出 | JimuBI 组件 JSON → 调 API 上传 | **ECharts option / ChartItem[] / HTML** → 调 dbx_chart_collection |

**目标产物**：

```typescript
// 新工具注册到 src/tools/
export interface DbxBigscreenBuilderInput {
  page: { name: string; bg?: string; theme?: "dark" | "light" };
  palette?: "tech" | "gov" | "biz" | "retro" | "medical";
  components: JimubiCompactComponent[];  // jimubi 风格紧凑 spec
  engine?: "echarts" | "chartjs";         // 默认 echarts
}

export type JimubiCompactComponent = {
  type: string;           // JimuBI 类型名：JBar, JLine, JPie, JStatsSummary...
  pos?: [number, number, number, number];  // [x, y, w, h] 绝对坐标（可选，走 Grid 就不要）
  variant?: string;       // 变体：JStatsSummary "1" | "2" | "3"
  title?: string;
  data?: unknown[];
  color?: string | string[];
  paletteOverride?: Partial<Palette>;
  // ...其他 Jimubi spec 字段
};

// 编译器输出
export interface BuiltComponent {
  kind: "echarts" | "chartjs" | "html";
  type: string;            // 标准化后的类型：bar, line, pie, stats-summary...
  chartItem?: ChartItem;   // dbx-pro ChartItem 格式
  echartsOption?: EChartsOption;  // ECharts option
  html?: string;           // HTML 片段（用于 JText/JStatsSummary/JScrollBoard 等）
  warnings?: string[];     // pitfall + 布局预警
}
```

**文件清单**：

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `src/tools/dbx-bigscreen-builder.ts` | ~800 | 主编译函数 + handler 路由 + 变体支持 |
| `src/features/visualization/bigscreen-defaults.ts` | ~600 | ECharts + Chart.js defaults 库（30+ 类型）|
| `src/features/visualization/bigscreen-palettes.ts` | ~50 | 5 套命名色板 |
| `src/features/visualization/bigscreen-pitfalls.ts` | ~200 | 15+ pitfall 防呆函数 |
| `src/features/visualization/bigscreen-layout.ts` | ~150 | 布局约束 + 组件高度估算 |

### 1.2 jimubi-dashboard → dbx-dashboard-builder

jimubi-dashboard spec_builder 与 bigscreen **共享同一套 Python 代码**，只有以下差异：
- 主题：亮色（dashboard）vs 深色（screen）
- 栅格：24 列 vs 自由绝对定位
- 组件子集：dashboard 组件更少（地图/装饰类不支持）

**dbx-pro 对等**：同 `dbx-bigscreen-builder.ts`，传入 `theme: "light"` + 24 栅格布局。不需要单独的 builder。

### 1.3 jimureport → dbx-report-builder

jimureport 是独立的报表编译器（26 个 Python 脚本），与 bigscreen spec_builder 是**不同架构**：
- **spec 格式**：`{ sql, parameters, groups, headers, options }` — SQL 驱动，不是组件驱动
- **核心能力**：多级表头、分组小计/合计、参数化 SQL、模板化导出

**dbx-pro 对等**：

```typescript
export interface DbxReportBuilderInput {
  title: string;
  sql: string;                     // 主 SQL（可含 ? 占位符）
  parameters?: ReportParameter[];  // 参数定义
  groups?: string[];               // 分组列 → 自动小计/合计
  headers?: ReportHeader[];        // 多级表头定义
  engine?: "echarts" | "chartjs";
  charts?: ReportChartSpec[];      // 报表内嵌图表（jimureport 图表联动）
}

export interface ReportParameter {
  name: string;
  type: "string" | "number" | "date" | "enum";
  default?: unknown;
  options?: { label: string; value: unknown }[];
}

export interface ReportHeader {
  label: string;
  column?: string;      // 对应数据列
  colspan?: number;
  children?: ReportHeader[];
  align?: "left" | "center" | "right";
}
```

**文件清单**：

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `src/tools/dbx-report-builder.ts` | ~400 | 报表编译 → HTML + 内嵌 ECharts 图表 |
| `server/src/engine/report-executor.mjs` | ~200 | SQL 执行 + 参数替换 + 分页（放 server/，因为需要 dbx MCP）|

### 1.4 jeecg-onlchart → dbx-chart-engine

jeecg-onlchart 的核心是 **graphType 选型矩阵**（60+ ECharts graphType 与 Online 图表的映射）。dbx-pro 用 ECharts 后需要：
- 完整 graphType 注册表
- graphType → ECharts option 自动生成
- 字段推断（从 rows 推断 labels + datasets）

**文件清单**：

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `src/features/visualization/chart-graph-registry.ts` | ~300 | 60+ graphType → ECharts option 工厂函数 |
| `src/features/visualization/chart-inference.ts` | ~150 | rows → labels + datasets 自动推断 |

### 1.5 jeecg-onlreport → dbx-filter-builder

jeecg-onlreport 处理 SQL 驱动的数据列表（与 jimureport 的"报表"不同——前者是在线筛选查询，后者是格式化导出）。dbx-pro 的结果网格已经能显示筛选查询结果，需要补齐的是：
- 参数化 SQL 构建（WHERE 条件占位符）
- 筛选器 UI 组件
- 自动生成下拉选项（从 DISTINCT 列值推断）

**文件清单**：

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `server/src/engine/filter-builder.mjs` | ~150 | WHERE 条件 SQL 构建 + 参数替换 |
| `src/features/database-workspace/components/filter-panel.tsx` | ~200 | 筛选器 UI（如果还没有）|

---

## 2. 组件类型映射（jimubi → ECharts + Chart.js）

### 2.1 JimuBI → ECharts 映射（主要目标）

| JimuBI 类型 | ECharts graphType | 复杂度 | 备注 |
|---|---|---|---|
| JBar / JStackBar / JMultipleBar / JNegativeBar | bar（含 stack/horizontal）| 低 | 数据 `[{name,value}]` → ECharts `{legend, xAxis: {type:'category'}, series: [{type:'bar'}]}` |
| JLine / JSmoothLine / JStepLine / JArea / JMultipleLine | line / area | 低 | 同上 |
| JPie / JRose / JRotatePie | pie | 低 | |
| JRing / JBreakRing / JActiveRing | pie（radius 内外环）| 中 | ECharts 饼图做环形；自动 legend 布局 |
| JRadar / JCircleRadar | radar | 低 | |
| JScatter / JBubble | scatter | 低 | |
| JFunnel / JPyramidFunnel | funnel | 低 | ECharts 原生支持 |
| JGauge / JAntvGauge / JColorGauge | gauge | 低 | ECharts 原生仪表盘 |
| JSemiGauge | gauge（max=180, startAngle=200）| 中 | 半圆形 |
| JLiquid | ❌ | 高 | ECharts 无原生水波图，可用自定义 series 但复杂度高 → **方案：ECharts liquid-fill 扩展** |
| JFlyLineMap | geo + lines effect | 高 | 需要中国 GeoJSON + 城市坐标 |
| JAreaMap | geo | 中 | 省份热力 |
| JBubbleMap | geo + scatter-effect | 中 | |
| JBarMap | geo + bar（3D bar）| 中 | ECharts bar3D |
| JStatsSummary | 组合：text + metric HTML + 迷你 ECharts 对比图 | 中 | 不是纯 ECharts |
| JCountTo / JNumber | metric HTML（不是 ECharts）| 低 | |
| JText / JDragBorder / JDragDecoration | HTML div（不是 ECharts）| 低 | |
| JScrollBoard / JScrollTable | HTML + CSS 滚动表格 | 低 | |
| JScrollRankingBoard | ECharts bar（自动排序 + 截断前 N）| 低 | |
| JCapsuleChart / JPercentBar | ECharts bar（stack + 百分比）| 低 | |
| JListProgress | HTML 滚动进度列表 | 低 | |
| JHeatMap | heatmap | 中 | ECharts 原生 |
| JWordCloud | wordCloud（扩展）| 中 | ECharts wordCloud 扩展 |

### 2.2 JimuBI → Chart.js 映射（降级目标）

如果 `engine: "chartjs"`（向后兼容），ECharts 不支持的组件类型降级：
- JGauge → doughnut + 自定义 label
- JLiquid → 不支持（提示换 engine: "echarts"）
- JFlyLineMap → scatter + lines（用 Chart.js annotation）
- JRadar → radar（原生支持）

---

## 3. server/ vs src/ 分层（用户明确）

| 功能 | 层 | 目录 | 理由 |
|---|---|---|---|
| spec_builder 编译链（handler + defaults + 防呆 + 布局）| 前端 | `src/tools/` + `src/features/visualization/` | 纯 JSON 操作 + option 生成，不需要数据库 |
| ECharts/Chart.js 渲染 | 前端 | `src/features/visualization/` + `src/shared/vendor/` | 浏览器渲染 |
| 报表 SQL 执行 | 后端 | `server/src/engine/report-executor.mjs` | 需要 dbx MCP 连接池执行 SQL |
| 筛选器 SQL 构建 | 后端 | `server/src/engine/filter-builder.mjs` | 参数替换 + SQL 安全检查（复用 sql-safety.mjs）|
| 演示数据 mock 生成 | 后端 | `server/src/engine/mock-data-generator.mjs` | 从模板 spec 推断数据结构 + 造 mock 数据 |
| GraphType 注册表 | 前端 | `src/features/visualization/chart-graph-registry.ts` | 纯 option 工厂 |

---

## 4. 验收标准

| # | 验收 | 通过标准 |
|---|---|---|
| 1 | dbx-bigscreen-builder 可编译紧凑 spec | 传入 `{ components: [{ type: "JBar", data: [...] }] }` → 输出 ECharts option + ChartItem |
| 2 | handler 覆盖 80%+ JimuBI 常用组件 | JBar/JLine/JPie/JStatsSummary/JScrollRankingBoard/JGauge/JRadar/JHeatMap 有 handler |
| 3 | pitfall 防呆生效 | JScrollList label→name 自动修正；饼图 h<220 警告；百分比 width→0 |
| 4 | palettes 自动应用 | `palette: "tech"` 整屏 ECharts 深色主题 |
| 5 | dbx-report-builder 可生成报表 | 传入 SQL + 参数 + 分组 → HTML 报表 + ECharts 内嵌图表 |
| 6 | graphType 注册表完整 | 60+ graphType → ECharts option 工厂函数 |
| 7 | server/ 新增文件通过现有 SQL 安全检查 | report-executor.mjs 复用 sql-safety.mjs |
