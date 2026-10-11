# ADR-0010b: ECharts 渲染引擎迁移 —— 替换 Chart.js

## 状态

已接受。执行版本 `0.4.5`。

父决策：ADR-0010。

**方向**：**ECharts 替换 Chart.js**（不是并存）。理由：jimubi-bigscreen / jimureport / jeecg-onlchart 全部是 ECharts 生态，spec_builder.ts 输出的 option 是 ECharts option 格式。保留 Chart.js 会导致两套 option schema + 两套 defaults + 两套 handler 路由，维护成本翻倍且 Agent 必须决定用哪个引擎。

---

## 0. 迁移影响面（16+ 文件）

### 🔴 高影响（核心渲染链，必须改）

| 文件 | 当前职责 | 改动性质 | 估算行数 |
|---|---|---|---|
| `src/shared/vendor/chart.umd.js` | Chart.js 4.4.1 内联 raw | 替换为 ECharts 5.x 内联 raw | 0（替换文件）|
| `src/features/visualization/services/chart-runtime.ts` | `?raw` import Chart.js + window.Chart 初始化 | `?raw` import ECharts + window.echarts 初始化 + 兼容 window.Chart = echarts | +20 |
| `src/features/visualization/chart-runtime-browser.ts` | 浏览器端 Chart.js 初始化 | 同上 + echarts.init + setOption | +30 |
| `src/features/visualization/chart-shell.ts` | HTML 模板 + Chart.js script tag | ECharts script tag + echarts.init 代码 | +40 |
| `src/features/visualization/chart-defaults.ts` | Chart.js defaults（深色 dashboard + 深色 screen）| ECharts defaults（ECharts 全局 theme 注册 + 5 套 palettes）| +150 |
| `src/features/visualization/themes/chart-defaults-dashboard.js` | Chart.js dashboard 默认 | ECharts dashboard theme | +80 |
| `src/features/visualization/themes/chart-defaults-screen.js` | Chart.js screen 默认 | ECharts screen theme | +80 |
| `src/domain/chart-contract.ts` | ChartType 枚举 8 种 + ChartItem 接口 | ChartType 扩展到 60+（ECharts graphType）+ EChartsOption 兼容 + ChartItem 可选 engine 字段 | +100 |
| `src/tools/dbx-chart-collection.ts` | generateHtml() → Chart.js new Chart() | generateHtml() → echarts.init().setOption() | +60 |
| `src/features/visualization/components/chart-grid.tsx` | Grid 渲染 Chart.js canvas | Grid 渲染 ECharts div + echarts.init | +40 |
| `src/features/visualization/components/chart-item-renderer.tsx` | 核心渲染组件（Chart.js canvas 上 new Chart()）| 核心渲染组件（ECharts div 上 echarts.init + setOption）| +80 |

### 🟡 中影响（适配层，需要改）

| 文件 | 改动性质 |
|---|---|
| `src/domain/chart-source.ts` | 数据源绑定：Chart.js datasets → ECharts series |
| `src/domain/dataset-spec.ts` | datasets 字段适配 ECharts |
| `src/features/visualization/services/html-export.ts` | HTML 导出适配 ECharts |
| `src/features/visualization/figures/figure-registry.ts` | 自有 figure（funnel/metric/boxplot）确认是否需要改 — 多数不走 Chart.js canvas |

### 🟢 低影响（确认不需要改）

| 文件 | 理由 |
|---|---|
| `src/features/visualization/figures/funnel-figure.ts` | 自有 funnel，用 SVG 渲染，不依赖 Chart.js |
| `src/features/visualization/figures/metric-figure.ts` | 自有 metric，HTML + CSS 渲染 |
| `src/features/visualization/figures/boxplot-figure.ts` | 自有 boxplot，SVG 渲染 |
| `src/features/visualization/figures/figure-*.ts` 其他 | figure 自有渲染，不依赖 Chart.js |
| `src/tools/register-tools.ts` | 工具注册，不动 |
| `src/shared/ai/send-context.ts` | AI 上下文，不动 |

### 📋 测试文件（需要改）

| 文件 | 改动 |
|---|---|
| `src/test/chart-runtime.test.js` | 适配 ECharts |
| `src/test/chart-source.test.js` | 适配 ECharts |
| `src/test/chart-theme-parity.test.js` | 适配 ECharts 主题 |
| `src/test/dbx-chart-collection.test.js` | 适配 ECharts |

---

## 1. ECharts vs Chart.js API 差异（必须适配）

### 1.1 初始化

```javascript
// Chart.js
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, { type: 'bar', data: {...}, options: {...} });

// ECharts
const dom = document.getElementById('chart');
const chart = echarts.init(dom, 'dark');  // ECharts 有内置 dark theme
chart.setOption({ xAxis: {...}, yAxis: {...}, series: [{ type: 'bar', ... }] });
// 响应式：window.onresize = () => chart.resize()
```

### 1.2 数据格式

```javascript
// Chart.js: { labels: [...], datasets: [{ data: [...] }] }
{
  labels: ['A', 'B', 'C'],
  datasets: [{ label: 'Sales', data: [100, 200, 150] }]
}

// ECharts: { xAxis: { type: 'category', data: [...] }, series: [{ data: [...] }] }
{
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', name: 'Sales', data: [100, 200, 150] }]
}
```

### 1.3 主题系统

```javascript
// Chart.js: 手动改每个 option 的颜色
new Chart(ctx, { options: { plugins: { legend: { labels: { color: '#fff' } } } } });

// ECharts: 内置 theme 注册（可扩展）
echarts.registerTheme('dark-screen', { backgroundColor: '#0a1929', textStyle: { color: '#d4e8ff' }, ... });
echarts.init(dom, 'dark-screen');
```

ECharts 自带 `dark` 内置 theme，用户还可以 `registerTheme()` 自定义。**这比 Chart.js 手动改每个 option 优雅得多**。

### 1.4 图表类型

| Chart.js 类型 | ECharts 等价 | 映射复杂度 |
|---|---|---|
| bar | bar | 低（series 类型一致）|
| line | line | 低 |
| pie / doughnut | pie（通过 radius 控制饼 vs 环）| 低 |
| radar | radar | 低 |
| scatter / bubble | scatter | 低（bubble 用 itemStyle.size）|
| polarArea | pie（radius: '100%' + startAngle）| 中（Chart.js polarArea ≠ ECharts 原生）|
| **无** | gauge | ✅ ECharts 原生仪表盘 |
| **无** | funnel | ✅ ECharts 原生漏斗 |
| **无** | wordCloud | ✅ ECharts 扩展 |
| **无** | heatmap | ✅ ECharts 原生 |
| **无** | geo (地图) | ✅ ECharts 原生 |
| **无** | gauge (仪表盘) | ✅ ECharts 原生 |
| **无** | graph (关系图) | ✅ ECharts 原生 |
| **无** | parallel (平行坐标) | ✅ ECharts 原生 |

**结论**：ECharts 类型是 Chart.js 的 **8→60+ 扩张**，正好匹配 jimubi-bigscreen 的 129 组件。

---

## 2. 迁移策略

### 阶段 1：最小可行验证（1 天）

1. `npm install echarts` 或内联 raw import
2. 复制 `src/shared/vendor/chart.umd.js` → `src/shared/vendor/echarts.min.js`
3. 在 `chart-runtime.ts` 里新增 ECharts 初始化分支（`if engine === 'echarts'`）
4. `dbx_chart_collection` 里新增一个最小 ECharts 柱状图测试 case
5. 在现有 UI 抽屉里，切换 `chart.engine` 字段验证渲染

**验收**：一个 ECharts bar chart 能在 UI 里渲染。

### 阶段 2：核心链路迁移（3-5 天）

1. `chart-contract.ts`：ChartType 枚举扩到 60+
2. `chart-shell.ts` / `chart-defaults.ts` / `chart-runtime-browser.ts`：ECharts theme 替换
3. `dbx-chart-collection.ts`：generateHtml → ECharts init
4. `chart-item-renderer.tsx`：Chart.js canvas → ECharts div
5. `chart-grid.tsx`：同上

### 阶段 3：Figure 确认 + 测试（1-2 天）

1. 确认 7 个自有 figure（funnel/metric/boxplot）是否需要改
2. 全测试文件适配 ECharts
3. tsc check + build + marketplace check + tests

### 阶段 4：Chart.js 代码清理（可选）

验证 ECharts 稳定后，删除旧的 Chart.js references（chart.umd.js / chart-defaults-*.js 旧版本）。

---

## 3. 验收标准

| # | 验收 | 通过标准 |
|---|---|---|
| 1 | `chart.engine = "echarts"` 渲染正常 | 柱状图 + 折线图 + 饼图 + 仪表盘全部正常渲染 |
| 2 | ECharts 内置 dark theme + 5 套自定义 palettes 可用 | `palette: "tech"` → 整屏深色主题 |
| 3 | Jimubi JBar/JLine/JPie/JGauge/JRadar/JHeatMap → ECharts option 生成正确 | handler 输出的 option 在 ECharts 里直接 setOption 渲染 |
| 4 | 所有现有 Chart.js 渲染路径已移除或有 ECharts 等价 | 无新 Chart.js 初始化代码 |
| 5 | 构建链全绿 | tsc → 0 error / vite build → runtime files / marketplace check / tests |
