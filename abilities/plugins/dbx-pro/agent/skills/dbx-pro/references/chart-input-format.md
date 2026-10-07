# dbx_chart_collection 输入格式

## 工具契约

dbx_chart_collection 接受 **Chart.js charts[] 数组**（与宿主 render_chart 格式完全兼容），
自动生成完整 HTML 看板/大屏页面。

## ChartItem 规范（极简版）

**只有 `type` 是必填的。所有 Chart.js 原生字段都接受。**

```jsonc
{
  "type": "bar",              // 必填：chart 类型
  "data": {                   // Chart.js data — 必须和 type 匹配
    "labels": ["A", "B", "C"],
    "datasets": [{ "label": "销售额", "data": [100, 200, 150] }]
  },
  "options": {                // Chart.js options（可选）
    "responsive": true,
    "maintainAspectRatio": false
  },
  "title": "月度销售",         // 可选：卡片标题
  "description": "2025 Q1",   // 可选：卡片副标题
  "height": 280,              // 可选：卡片高度（px）
  // ...任何其他 Chart.js 字段都能放
}
```

## 常见报错 & 避免

### ❌ 不要放 Chart.js 没有的字段

Chart.js 原生字段：`type`, `data`, `options`, `plugins`, `interaction`, `animation`, `responsive`, `maintainAspectRatio` 等。

**不要**瞎编字段名，比如：
- `height` 不是 Chart.js data 字段——它是插件级的卡片高度，放 ChartItem 顶层 ✅
- `md_intro` 不是 Chart.js 字段——如果你想放介绍文字，用 `description` 字段

### ✅ Chart.js data 必须和 type 匹配

| type | data 结构要求 |
|------|-------------|
| `line`, `bar` | `datasets[].data: number[]` 或 objects |
| `pie`, `doughnut`, `polarArea` | `datasets[].data: number[]` |
| `radar` | `datasets[].data: number[]` + 所有 dataset 同长度 |
| `scatter`, `bubble` | `datasets[].data: [{x,y,radius?}]` |

### ✅ 最多 12 个图表

超过 12 个会被截断。建议：
- 看板（dashboard）：6-8 图，浅 QuickBI 风格
- 大屏（screen）：8-12 图，深 DataV 风格

## 宿主 render_chart vs dbx_chart_collection

| 维度 | render_chart（宿主） | dbx_chart_collection（插件） |
|------|---------------------|---------------------------|
| 位置 | 对话气泡 inline | 完整 HTML iframe tab |
| 单次 | 最多 4 图 | 最多 12 图 |
| 适合 | 快速试错、迭代 | 最终产出、持久化分享 |
| ChartItem 格式 | **完全相同** | **完全相同** |

工作流：**先用 render_chart 试 → 调好了再 dbx_chart_collection 打包**。
