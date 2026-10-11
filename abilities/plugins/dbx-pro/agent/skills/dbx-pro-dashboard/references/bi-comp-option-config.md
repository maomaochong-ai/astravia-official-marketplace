# 组件配置选项路径参考（来源：config.ts）

> 配置路径来自 `config.ts` 的 `getOptionConfig` 函数，用于 `comp_ops.py edit --set "路径=值"` 命令。
> 注意：`background` 和 `borderColor` 是组件顶层字段，不是 `option.*` 路径。

---

## 修改输出格式

只返回需要修改的属性，不包含未修改的配置：

```json
{
  "compConfig": {
    "option": {
      "series": [{ "itemStyle": { "color": "#FFFF00" } }]
    }
  }
}
```

修改名称/背景等基础属性：
```json
{
  "compConfig": {
    "name": "京东销量柱形图",
    "background": "#000000"
  }
}
```

---

## 颜色修改规则

### customColor 组件列表
以下组件的颜色属性使用 `customColor` 格式修改：
- JRadioButton, JRadialBar, JActiveRing, JRing, JPyramidFunnel, JFunnel
- JBubble, DoubleLineBar, JMultipleLine, JArea, JLine
- JRotatePie, JRose, JPie, JMixLineBar, JPercentBar
- JMultipleBar, JCapsuleChart, JStackBar, JQuadrant
- JGraphSimple, JRectangle（通过各自 customColor 类型配置）

格式：
```json
"customColor": [
  {"color1": "#FF0000", "color": "#FF0000"},
  {"color1": "#00FF00", "color": "#00FF00"}
]
```

### 柱体颜色
普通柱状图使用 `option.series[0].itemStyle.color`（不在 customColor 列表内的柱图组件）

### 其他组件
不包含 customColor 属性的组件，按照对应组件配置的属性 value 值修改。

---

## 通用规则

- 颜色使用具体色值（如 `#000000`），不使用英文单词（如 black）
- 字体粗细可选值：`normal`（默认）、`bold`（粗体）、`lighter`（细体）
- Y轴单位 `option.yAxis.yUnit`：预设值有 `%`（百分比）、`K`（千）、`W`（万）、`M`（亿）；自定义单位时设 `yUnit: 'CUSTOM'` 并设 `yCustomUnit: '元'`

---

## 一、通用配置（多组件共享）

### 基础配置（baseConfig）
适用组件：JTable, JBackgroundBar, JMultipleBar, JNegativeBar, JMultipleLine, JCommonTable, JForm, JList, JDynamicInfo, JCalendar, JBar, JHorizontalBar, JPie, JLine, JRadar, JRing, JArea, JGauge, JColorGauge, JStackBar, JPictorialBar, JPictorial, JFunnel, JDynamicBar, JColorSelect, JTabs, JGrid, JProgress, JQuickNav, JGrowCard, JSimpleCard, CountTo, JProjectCard, JWaitMatter, JImg, JText, JCurrentTime, JRadioButton, JBubbleMap, JFlyLineMap, JBarMap, JTotalFlyLineMap, JSmoothLine, JStepLine, JPyramidFunnel, JMixLineBar, JScatter, JBubble, JCircleRadar, JTotalBarMap, JHeatMap, JFly3dMap, JGraphSimple, JNumber, DoubleLineBar, JPivotTable, JCustomCard

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 背景颜色 | `background` | color | `#FFFFFF`（亮色）/ `#FFFFFF00`（暗色） |
| 边框颜色 | `borderColor` | color | `#FFFFFF`（亮色）/ `#FFFFFF00`（暗色） |

---

### 卡片配置（cardConfig）
适用组件：JBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JLine, JScatter, JBubble, JSmoothLine, JStepLine, JMultipleLine, JArea, JStackBar, JPictorialBar, JPictorial, JDynamicBar, JNegativeBar, JRadar, JCircleRadar, JPie, JRose, JRing, JGauge, JQuickNav, JProjectCard, JWaitMatter, JFunnel, JPyramidFunnel, JColorGauge, JIframe, JBubbleMap, JBarMap, JHeatMap, JFlyLineMap, JTotalBarMap, JTotalFlyLineMap, JGraphSimple, JNumber, JCommonTable, JList, JRadioButton

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 卡片显隐（开关） | `option.card.show` | switch | false |
| 标题文本 | `option.card.title` | input | - |
| 字体大小 | `option.card.textStyle.fontSize` | number | 18 |
| 标题背景 | `option.card.headColor` | color | `#ffffff`（亮色） |
| 字体颜色 | `option.card.textStyle.color` | color | `#4A4A4A`（亮色） |
| 右上角文本 | `option.card.extra` | input | - |
| 右上角跳转地址 | `option.card.rightHref` | input | - |
| 组件尺寸 | `option.card.size` | select | `small`（小）/ `default`（大） |

---

### 标题配置（titleConfig）
适用组件：JBar, JHorizontalBar, JLine, JScatter, JBubble, JArea, JStackBar, JPictorialBar, JPictorial, JDynamicBar, JRadar, JCircleRadar, JPie, JRose, JRing, JGauge, JColorGauge, JFunnel, JPyramidFunnel, JProgress, JBubbleMap, JFlyLineMap, JHeatMap, JBarMap, JTotalFlyLineMap, JTotalBarMap, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JNegativeBar, JSmoothLine, JStepLine, JGraphSimple, JMultipleLine

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 标题显隐（开关） | `option.title.show` | switch | true |
| 标题文本 | `option.title.text` | input | - |
| 字体颜色 | `option.title.textStyle.color` | color | `#464646`（亮色） |
| 字体粗细 | `option.title.textStyle.fontWeight` | select | `bold` |
| 字体大小 | `option.title.textStyle.fontSize` | number | 18 |
| 顶边距 | `option.title.top` | slider | 1（0-400px） |
| 左边距 | `option.title.left` | slider | 1（0-2000px） |

---

### 副标题配置（subTitleConfig）
适用组件：JBar, JHorizontalBar, JLine, JScatter, JBubble, JArea, JStackBar, JPictorialBar, JPictorial, JDynamicBar, JRadar, JCircleRadar, JPie, JRose, JRing, JGauge, JColorGauge, JFunnel, JPyramidFunnel, JBubbleMap, JBarMap, JFlyLineMap, JTotalBarMap, JHeatMap, JTotalFlyLineMap, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JNegativeBar, JSmoothLine, JStepLine, JGraphSimple, JMultipleLine

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 副标题文本 | `option.title.subtext` | input | - |
| 字体颜色 | `option.title.subtextStyle.color` | color | `#464646`（亮色） |
| 字体粗细 | `option.title.subtextStyle.fontWeight` | select | `normal` |
| 字体大小 | `option.title.subtextStyle.fontSize` | number | 12 |

---

### X轴配置（xAxisConfig）
适用组件：JBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JLine, JScatter, JBubble, JArea, JStackBar, JDynamicBar, JNegativeBar, JSmoothLine, JStepLine, JMultipleLine, JPictorialBar, JPictorial

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| X轴显隐（开关） | `option.xAxis.show` | switch | true |
| 轴名称 | `option.xAxis.name` | input | - |
| 轴名称颜色 | `option.xAxis.nameTextStyle.color` | color | `#333`（亮色） |
| 轴名称字体大小 | `option.xAxis.nameTextStyle.fontSize` | number | 12 |
| 坐标轴类型 | `option.xAxis.type` | select | `category`（类型）/ `value`（数值） |
| 轴线颜色 | `option.xAxis.axisLine.lineStyle.color` | color | `#333`（亮色） |
| 文字角度 | `option.xAxis.axisLabel.rotate` | slider | 0（-90~90°） |
| 文字大小 | `option.xAxis.axisLabel.fontSize` | number | 12 |
| 字体颜色 | `option.xAxis.axisLabel.color` | color | `#909198`（亮色） |
| 显示分割线 | `option.xAxis.splitLine.show` | switch | false |
| 分割线颜色 | `option.xAxis.splitLine.lineStyle.color` | color | `#f3f3f3` |

---

### Y轴配置（yAxisConfig）
适用组件：JBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JMixLineBar, JLine, JPictorial, JScatter, JBubble, JArea, JStackBar, JDynamicBar, JNegativeBar, JSmoothLine, JStepLine, JMultipleLine

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| Y轴显隐（开关） | `option.yAxis.show` | switch | true |
| 标轴名称 | `option.yAxis.name` | input | - |
| 轴名称颜色 | `option.yAxis.nameTextStyle.color` | color | `#333`（亮色） |
| 轴名称字体大小 | `option.yAxis.nameTextStyle.fontSize` | number | 12 |
| 最大值 | `option.yAxis.max` | number | - |
| 最小值 | `option.yAxis.min` | number | - |
| 刻度字体大小 | `option.yAxis.axisLabel.fontSize` | number | 12 |
| 字体颜色 | `option.yAxis.axisLabel.color` | color | `#909198`（亮色） |
| 显示轴线 | `option.yAxis.axisLine.show` | switch | false |
| 轴线颜色 | `option.yAxis.axisLine.lineStyle.color` | color | `#333` |
| 显示分割线 | `option.yAxis.splitLine.show` | switch | true |
| 分割线颜色 | `option.yAxis.splitLine.lineStyle.color` | color | `#f3f3f3` |

---

### 提示语配置（tooltipConfig）
适用组件：JBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JLine, JScatter, JBubble, JPie, JRose, JArea, JRing, JRadar, JCircleRadar, JStackBar, JPictorialBar, JPictorial, JDynamicBar, JNegativeBar, JFunnel, JPyramidFunnel, JSmoothLine, JStepLine, JMultipleLine

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 提示语显隐（开关） | `option.tooltip.show` | switch | true |
| 字体大小 | `option.tooltip.textStyle.fontSize` | number | 14 |
| 字体颜色 | `option.tooltip.textStyle.color` | color | `#464646`（亮色） |

---

### 图例配置（legendConfig）
适用组件：JRadar, JStackBar, JMultipleBar, JMixLineBar, JMultipleLine, DoubleLineBar, JPie, JRose, JRing, JCircleRadar, JFunnel, JPyramidFunnel, JDynamicBar, JNegativeBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 图例显隐（开关） | `option.legend.show` | switch | true |
| 字体大小 | `option.legend.textStyle.fontSize` | number | 14 |
| 排序方式 | `option.legend.orient` | select | `horizontal`（横排）/ `vertical`（竖排） |
| 上下边距 | `option.legend.t` | slider | 1（1~100%） |
| 左右边距 | `option.legend.r` | slider | 1（1~100%） |

---

### 坐标轴边距（gridConfig）
适用组件：JBar, JHorizontalBar, JBackgroundBar, JStackBar, JProgress, JPictorialBar, JPictorial, JMultipleBar, JLine, JScatter, JBubble, JArea, JDynamicBar, JNegativeBar, JSmoothLine, JStepLine, JMultipleLine

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 坐标轴边距显隐（开关） | `option.grid.show` | switch | false |
| 左边距 | `option.grid.left` | slider | 105px（1~400px） |
| 顶边距 | `option.grid.top` | slider | 90px（1~400px） |
| 右边距 | `option.grid.right` | slider | 105px（1~400px） |
| 底边距 | `option.grid.bottom` | slider | 115px（1~400px） |

---

### 中心坐标（gridConfigOther）
适用组件：JPie, JRadar, JCircleRadar, JRing, JRose

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 中心坐标显隐（开关） | `option.grid.show` | switch | false |
| 上下边距 | `option.grid.top` | slider | 50（1~100%） |
| 左右边距 | `option.grid.left` | slider | 50（1~100%） |

---

### 数值设置（valueConfig）
适用组件：JBar, JHorizontalBar, JMultipleBar, JStackBar, JNegativeBar, JLine, JMultipleLine, DoubleLineBar, JBubble, JScatter, JFunnel, JPyramidFunnel, JRadar, JCircleRadar, JArea

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 是否显示 | `option.series[0].label.show` | switch | false |
| 位置 | `option.series[0].label.position` | select | `outside`（中间）/ `top`（顶部）/ `bottom`（底部） |
| 字体大小 | `option.series[0].label.fontSize` | number | 13 |
| 字体颜色 | `option.series[0].label.color` | color | `#787575`（亮色） |
| 字体粗细 | `option.series[0].label.fontWeight` | select | `normal` |
| 内容格式 | `option.label.format` | input | - |

---

### 自定义配色（colorConfig）
适用组件：JLine, JArea, JBubble, JGraphSimple, JStackBar, JPie, JRose, JRing, JCapsuleChart, JActiveRing, JRotatePie, JMultipleBar, JMultipleLine, DoubleLineBar, JMixLineBar

| 配置项 | prop 路径 | 类型 | 说明 |
|--------|-----------|------|------|
| 自定义配色 | - | customColor | 多色数组，见颜色修改规则 |

---

### 自定义属性（commonConfig）
适用组件：JCommon, JBar, JHorizontalBar, JLine, JScatter, JBubble, JArea, JStackBar, JPictorialBar, JPictorial, JDynamicBar, JRadar, JCircleRadar, JPie, JRing, JGauge, JColorGauge, JFunnel, JPyramidFunnel, JProgress, JBubbleMap, JFlyLineMap, JHeatMap, JBarMap, JTotalFlyLineMap, JTotalBarMap, JBackgroundBar, JMultipleBar, JMixLineBar, DoubleLineBar, JNegativeBar, JSmoothLine, JStepLine, JMultipleLine

| 配置项 | prop 路径 | 类型 | 说明 |
|--------|-----------|------|------|
| 自定义属性 | `customOption` | textarea | JSON 格式的自定义 ECharts option |

---

## 二、各组件专属配置

### JBar / JHorizontalBar / JBackgroundBar / JDynamicBar（柱形图系列）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、坐标轴边距、数值设置、单位设置、自定义属性

**柱体设置（barConfig）**
适用：JBackgroundBar, JBar, JHorizontalBar, JDynamicBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 宽度 | `option.series[0].barWidth` | slider | 40（0~100） |
| 圆角 | `option.series[0].itemStyle.borderRadius` | slider | 0（0~100） |
| 柱体颜色 | `option.series[0].itemStyle.color` | color | `#64b5f6` |
| 显示柱体背景 | `option.series[0].showBackground` | switch | false |
| 柱体背景色 | `option.series[0].backgroundStyle.color` | color | `#51626e` |

**单位设置（unitConfig）**
适用：JBar, JHorizontalBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 单位显隐（开关） | `option.showUnit.show` | switch | false |
| 数量级 | `option.showUnit.numberLevel` | select | `0` |
| 保留小数 | `option.showUnit.decimal` | number | 0 |

---

### JMultipleBar（多系列柱形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、图例、坐标轴边距、数值设置、自定义配色、自定义属性

**柱体设置（multiBarConfig，仅大屏模式可用）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 宽度 | `option.series[0].barWidth` | slider | 40（0~100） |
| 圆角 | `option.series[0].itemStyle.borderRadius` | slider | 0（0~100） |

---

### JLine / JSmoothLine / JStepLine / JArea / JMultipleLine（折线图系列）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、图例（JMultipleLine）、坐标轴边距、数值设置、自定义配色、自定义属性

**折线设置（lineConfig）**
适用：JLine, JMultipleLine, JArea

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 折线类型 | `option.series[0].lineType` | select | `smooth`（曲线）/ `line`（折线）/ `area`（面积） |
| 平滑曲线（仅JArea） | `option.izSmooth` | switch | false |
| 面积透明度 | `option.series[0].areaStyleOpacity` | slider | 0.5（0~1） |
| 标记点 | `option.series[0].symbol` | select | `emptyCircle`（空心）/ `circle`（实心）/ `none`（无） |
| 点的大小 | `option.series[0].symbolSize` | slider | 0（0~100） |
| 线条宽度 | `option.series[0].lineWidth` | slider | 0（0~100） |

---

### JPie / JRose / JRing（饼图/玫瑰图/环形图系列）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、提示语、图例、中心坐标、自定义配色、自定义属性

**饼图设置（pieConfig）**
适用：JPie

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 设置为环形 | `option.isRadius` | switch | false |
| 内半径 | `option.innerRadius` | slider | 100（0~100） |
| 外半径 | `option.outRadius` | slider | 150（0~200） |
| 南丁格尔玫瑰 | `option.isRose` | switch | false |
| 标签位置 | `option.pieLabelPosition` | select | `outside` |

**环形设置（ringConfig）**
适用：JRing

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 内半径 | `option.innerRadius` | slider | 60（0~200） |
| 外半径 | `option.outRadius` | slider | 100（0~200） |

**数值设置（pieValueConfig）**
适用：JPie, JRing, JRose, JRotatePie

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 是否显示 | `option.series[0].label.show` | switch | false |
| 字体大小 | `option.series[0].label.fontSize` | number | 18 |
| 字体颜色 | `option.series[0].label.color` | color | `#000`（亮色） |
| 字体粗细 | `option.series[0].label.fontWeight` | select | `normal` |
| 高亮字体大小（JRing/JRose） | `option.series[0].emphasis.label.fontSize` | number | 14 |
| 高亮字体颜色（JRing/JRose） | `option.series[0].emphasis.label.color` | color | `#000`（亮色） |
| 高亮字体粗细（JRing/JRose） | `option.series[0].emphasis.label.fontWeight` | select | `normal` |
| 标签位置（JRing/JRose） | `option.pieLabelPosition` | select | `outside` |
| 内容格式 | `option.label.format` | input | - |

---

### JGauge / JColorGauge（仪表盘）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、自定义属性

**仪表盘设置（gaugeConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 显示刻度值 | `option.series[0].axisLabel.show` | switch | false |
| 显示刻度线 | `option.series[0].axisTick.show` | switch | false |
| 指标字号 | `option.series[0].detail.fontSize` | number | 18 |
| 刻度长度 | `option.series[0].axisTick.length` | number | 18 |
| 刻度字号 | `option.series[0].axisLabel.fontSize` | number | 18 |
| 分割线长度 | `option.series[0].splitLine.length` | number | 18 |
| 刻度颜色 | `option.series[0].axisTick.lineStyle.color` | color | `#eee` |
| 分割线颜色 | `option.series[0].splitLine.lineStyle.color` | color | `#eee` |

---

### JFunnel / JPyramidFunnel（漏斗/金字塔漏斗）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、提示语、图例、自定义配色、数值设置、自定义属性

---

### JRadar / JCircleRadar（雷达图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、提示语、图例、中心坐标、数值设置、自定义属性

---

### JStackBar（堆叠柱形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、图例、坐标轴边距、数值设置、自定义配色、自定义属性

---

### JMixLineBar（混合折线柱形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、图例、坐标轴边距、自定义配色、自定义属性

---

### DoubleLineBar（双Y轴折线柱形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、提示语、图例、坐标轴边距、数值设置、自定义配色、自定义属性

**左Y轴设置（yLeftAxisConfig）**
适用：DoubleLineBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 左Y轴显隐（开关） | `option.yAxis[0].show` | switch | true |
| 标轴名称 | `option.yAxis[0].name` | input | - |
| 轴名称颜色 | `option.yAxis[0].nameTextStyle.color` | color | `#333`（亮色） |
| 轴名称字体大小 | `option.yAxis[0].nameTextStyle.fontSize` | number | 12 |
| 最大值 | `option.yAxis[0].max` | number | - |
| 最小值 | `option.yAxis[0].min` | number | - |
| 刻度字体大小 | `option.yAxis[0].axisLabel.fontSize` | number | 12 |
| 字体颜色 | `option.yAxis[0].axisLabel.color` | color | `#909198`（亮色） |

**右Y轴设置（yRightAxisConfig）**
适用：DoubleLineBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 右Y轴显隐（开关） | `option.yAxis[1].show` | switch | true |
| 标轴名称 | `option.yAxis[1].name` | input | - |
| 轴名称颜色 | `option.yAxis[1].nameTextStyle.color` | color | `#333`（亮色） |
| 轴名称字体大小 | `option.yAxis[1].nameTextStyle.fontSize` | number | 12 |
| 最大值 | `option.yAxis[1].max` | number | - |
| 最小值 | `option.yAxis[1].min` | number | - |
| 刻度字体大小 | `option.yAxis[1].axisLabel.fontSize` | number | 12 |
| 字体颜色 | `option.yAxis[1].axisLabel.color` | color | `#909198`（亮色） |
| 显示轴线 | `option.yAxis[1].axisLine.show` | switch | false |
| 轴线颜色 | `option.yAxis[1].axisLine.lineStyle.color` | color | `#333` |
| 显示分割线 | `option.yAxis[1].splitLine.show` | switch | true |
| 分割线颜色 | `option.yAxis[1].splitLine.lineStyle.color` | color | `#f3f3f3` |

---

### JNegativeBar（正负柱形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、图例、坐标轴边距、数值设置、自定义属性

---

### JScatter（散点图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、坐标轴边距、数值设置、自定义属性

**散点设置（commonScatterConfig）**
适用：JScatter

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 散点颜色 | `option.series[0].itemStyle.color` | color | `#64b5f6` |

---

### JBubble（气泡图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴、Y轴、提示语、坐标轴边距、数值设置、自定义配色、自定义属性

---

### JPictorialBar / JPictorial（象形图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、X轴（JPictorialBar除部分）、Y轴（JPictorial）、提示语、坐标轴边距、数值设置、自定义属性

**象形图设置（pictorialConfig）**
适用：JPictorialBar

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 柱体颜色 | `option.barColor` | color | `#e54035`（亮色） |
| 柱体透明度 | `option.barOpacity` | slider | 0.5（0~1） |

---

### JProgress（进度图）

> 通用配置：基础配置、标题配置、坐标轴边距

**进度图设置（progressConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 标题字号 | `option.yAxis.axisLabel.fontSize` | number | 16 |
| 标题颜色 | `option.yAxis.axisLabel.color` | color | `#000000`（亮色） |
| 数值字号 | `option.series[1].label.fontSize` | number | 16 |
| 数值颜色 | `option.series[1].label.color` | color | `#000000`（亮色） |
| 进度颜色 | `option.series[0].color` | color | `#151B87` |
| 目标颜色 | `option.series[1].color` | color | `#eeeeee`（亮色） |

---

### JGraphSimple（关系图）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、自定义配色、自定义属性

**关系图配置（graphConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 连线文本字体大小 | `commonOption.graph.link.fontSize` | number | 15 |
| 连线文本颜色 | `commonOption.graph.link.fontColor` | color | `#000000` |
| 节点字体大小 | `commonOption.graph.node.fontSize` | number | 12 |
| 节点文本颜色 | `commonOption.graph.node.fontColor` | color | `#ffffff` |

---

### JText / JNumber / JCurrentTime（文本/数值/当前时间）

> 通用配置：基础配置、卡片配置（仅JNumber）

**文本设置（textConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 | 适用组件 |
|--------|-----------|------|--------|----------|
| 显示星期 | `option.showWeek` | select | `hide` | JCurrentTime |
| 字体大小 | `option.body.fontSize` | number | 16 | 全部 |
| 字体颜色 | `option.body.color` | color | `#000`（亮色） | 全部 |
| 字体粗细 | `option.body.fontWeight` | select | `normal` | 全部 |
| 字体间隔 | `option.body.letterSpacing` | number | 0 | JText |
| 对齐方式 | `option.body.textAlign` | select | `center`（左/中/右） | 全部 |
| 水平缩进 | `option.body.marginLeft` | slider | 50（0~600） | 全部 |
| 垂直缩进 | `option.body.marginTop` | slider | 0（0~500） | 全部 |
| 跑马灯 | `option.horseLamp` | switch | false | JText |
| 滚动速度(毫秒) | `option.speed` | number | 1000 | JText |

---

### JCountTo（翻牌数字）

**内部设置（countToConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 整体 | `option.whole` | switch | false |
| 宽度 | `option.boxWidth` | number | 16（1~500） |
| 高度 | `option.boxHeight` | number | 50（10~500） |
| 艺术字体 | `option.fontFamily` | select | - |
| 字体大小 | `option.fontSize` | number | 16 |
| 字体颜色 | `option.color` | color | `#fff` |
| 字体粗细 | `option.fontWeight` | select | `normal` |
| 前缀 | `option.prefix` | input | - |
| 前缀字体大小 | `option.prefixFontSize` | number | 16 |
| 前缀字体颜色 | `option.prefixColor` | color | `#fff` |
| 前缀字体粗细 | `option.prefixFontWeight` | select | `normal` |
| 后缀内容 | `option.suffix` | input | - |
| 后缀字体大小 | `option.suffixFontSize` | number | 16 |
| 后缀字体颜色 | `option.suffixColor` | color | `#fff` |
| 后缀字体粗细 | `option.suffixFontWeight` | select | `normal` |

---

### JColorBlock（颜色块）

**颜色块设置（colorBlockConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 行数 | `option.lineNum` | slider | 24（1~24） |
| X间距 | `option.borderSplitx` | number | 20（0~200） |
| Y间距 | `option.borderSplity` | number | 20（0~200） |
| 小数位数 | `option.decimals` | number | 0（0~10） |
| 字体大小 | `option.fontSize` | number | 16 |
| 字体颜色 | `option.color` | color | `#fff` |
| 字体粗细 | `option.fontWeight` | select | `normal` |
| 边距 | `option.padding` | number | 0（1~50） |
| 前缀文本 | `option.prefix` | input | - |
| 前缀字体大小 | `option.prefixFontSize` | number | 16 |
| 前缀字体颜色 | `option.prefixColor` | color | `#fff` |
| 前缀字体粗细 | `option.prefixFontWeight` | select | `normal` |
| 前缀X间距 | `option.prefixSplitx` | number | 20（0~200） |
| 前缀Y间距 | `option.prefixSplity` | number | 20（0~200） |
| 后缀文本 | `option.suffix` | input | - |
| 后缀字体大小 | `option.suffixFontSize` | number | 16 |
| 后缀字体颜色 | `option.suffixColor` | color | `#fff` |
| 后缀字体粗细 | `option.suffixFontWeight` | select | `normal` |
| 后缀X间距 | `option.suffixSplitx` | number | 20（0~200） |

---

### JSelectRadio（选项卡/下拉框）

**选项卡设置（selectRadioConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 字体大小 | `option.fontSize` | number | 16 |
| 字体颜色 | `option.color` | color | `#fff` |
| 类型 | `option.type` | select | `radio`（选项卡）/ `select`（下拉框） |
| 字体间距 | `option.padding` | number | 0（1~100） |

**边框设置（selectBorderConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 背景颜色 | `option.backgroundColor` | color | `#39414d` |
| 边框颜色 | `option.borderColor` | color | - |
| 边框宽度 | `option.borderWidth` | number | 0（1~50） |

**高亮设置（activeSelectConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 字体颜色 | `option.activeColor` | color | `#fff` |
| 背景颜色 | `option.activeBackgroundColor` | color | `#0a73ff` |
| 边框颜色 | `option.activeBorderColor` | color | - |
| 边框宽度 | `option.activeBorderWidth` | number | 0（1~50） |

---

### JRadioButton（按钮）

> 通用配置：基础配置、卡片配置

**按钮设置（btnConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 水平缩进 | `option.body.marginLeft` | slider | 50（0~500） |
| 垂直缩进 | `option.body.marginTop` | slider | 0（0~500） |
| 形状 | `option.body.shape` | select | `solid`（常规）/ `circle`（圆形）/ `dashed`（虚线） |
| 按钮颜色 | `option.body.colors` | customColor | - |

---

### JDragBorder / JDragDecoration（边框/装饰）

**样式设置（borderConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 | 说明 |
|--------|-----------|------|--------|------|
| 边框类型 | `option.type` | select | `1`~`13` | 仅JDragBorder |
| 装饰类型 | `option.type` | select | `1`~`12` | 仅JDragDecoration |
| 标题 | `option.title` | input | `标题` | - |
| 字体大小 | `option.fontSize` | number | 18 | 仅JDragDecoration |
| 主颜色 | `option.mainColor` | color | `#64b5f6` | - |
| 副颜色 | `option.subColor` | color | `#64b5f6` | - |
| 翻转 | `option.reverse` | switch | false | - |
| 动画时长 | `option.dur` | number | 3 | - |

---

### JList（列表）

> 通用配置：基础配置、卡片配置

**列表设置（listConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 显示标题前缀 | `option.showTitlePrefix` | switch | false |
| 显示时间前缀 | `option.showTimePrefix` | switch | false |
| 标题字体大小 | `option.titleFontSize` | number | 14 |
| 标题字体颜色 | `option.titleFontColor` | color | `#000`（亮色） |
| 标题字体粗细 | `option.titleFontWeight` | select | `normal` |
| 图标颜色 | `option.iconColor` | color | `#000`（亮色） |
| 内容颜色 | `option.contentColor` | color | `#000`（亮色） |
| 布局朝向 | `option.layout` | select | `horizontal`（横向）/ `vertical`（纵向） |

---

### JCommonTable（通用表格）

> 通用配置：基础配置、卡片配置

**表格设置（commonTableConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 表头字体颜色 | `option.headerColor` | color | `#000` |
| 表头背景色 | `option.headerBgColor` | color | `#ffffff` |
| 字体颜色 | `option.bodyColor` | color | `#000` |
| 背景颜色 | `option.bodyBgColor` | color | `#ffffff` |

---

### JScrollBoard（滚动表格）

**表格设置（scrollBoardConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 开启排名 | `option.index` | switch | true |
| 显示表头 | `option.headShow` | switch | true |
| 表头高度 | `option.headerHeight` | number | 35（1~100） |
| 表头背景颜色 | `option.headerBGC` | color | `#00BAFF` |
| 滚动时间(毫秒) | `option.waitTime` | number | 2000（500~30000） |
| 轮播方式 | `option.carousel` | select | `single`（单行）/ `page`（整页） |
| 悬浮暂停 | `option.hoverPause` | switch | true |
| 序号列宽 | `option.indexWidth` | number | 80（1~500） |
| 奇行颜色 | `option.oddRowBGC` | color | `#003B51` |
| 偶行颜色 | `option.evenRowBGC` | color | `#0A2732` |
| 表头设置 | `option.header` | headerTable | - |

---

### JScrollTable（滚动数据表格）

**表格设置（scrollTableConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 行高 | `option.lineHeight` | number | 50（12~200） |
| 字体大小 | `option.fontSize` | number | 24（12~200） |
| 开启滚动 | `option.scroll` | switch | false |
| 线条 | `option.showBorder` | switch | true |

**表头设置（scrollTableHeaderConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 表头显隐 | `option.showHead` | switch | true |
| 表头背景色 | `option.headerBgColor` | color | `#0a73ff` |
| 表头字体颜色 | `option.headerFontColor` | color | `#ffffff` |

**表体设置（scrollTableBodyConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 表体字体颜色 | `option.bodyFontColor` | color | `#fff` |
| 奇行颜色 | `option.oddColor` | color | `#0a2732` |
| 偶行颜色 | `option.evenColor` | color | `#003b51` |

---

### JScrollRankingBoard（滚动排名）

**滚动设置（scrollRankConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 滚动时间(毫秒) | `option.waitTime` | number | 2000（500~30000） |
| 行数 | `option.rowNum` | number | 5（1~100） |
| 轮播方式 | `option.carousel` | select | `single`（单行）/ `page`（整页） |
| 是否排序 | `option.sort` | switch | true |

---

### JQuickNav（快捷导航）

> 通用配置：基础配置、卡片配置

**内容设置（navConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 列数 | `option.body.column` | number | 14（1~50） |
| 对齐方式 | `option.body.textAlign` | select | `center`（左/中/右） |
| 图标位置 | `option.body.iconAlign` | select | `top`（顶部）/ `left`（居左） |
| 图标大小 | `option.icon.fontSize` | number | 20（14~50） |
| 图标库 | `option.icon.scriptUrl` | input | 阿里云图标地址 |

---

### JGrowCard / JSimpleCard（统计卡片）

> 通用配置：基础配置

**内容设置（growCardConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 | 适用 |
|--------|-----------|------|--------|------|
| 水平间距 | `option.body.horizontal` | slider | 8（1~50） | 全部 |
| 垂直间距 | `option.body.vertical` | slider | 8（1~50） | 全部 |
| 宽度占比 | `option.body.span` | slider | 6（4~24） | 全部 |
| 保留小数 | `option.decimals` | number | 0（0~8） | JGrowCard |
| 标题颜色 | `option.title.color` | color | `#000000` | JSimpleCard |
| 标题字体大小 | `option.title.fontSize` | number | 18（12~50） | JSimpleCard |
| 数值颜色 | `option.value.color` | color | `#000000` | JSimpleCard |
| 数值字体大小 | `option.value.fontSize` | number | 20（12~50） | JSimpleCard |
| 图标大小 | `option.icon.fontSize` | number | 30（20~60） | JSimpleCard |
| 图标颜色 | `option.icon.color` | color | `#000000` | JSimpleCard |
| 图标库 | `option.icon.scriptUrl` | input | 阿里云图标地址 | 全部 |

---

### JProjectCard（项目卡片）

> 通用配置：基础配置、卡片配置

**内容设置（projectCardConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 列数 | `option.body.column` | number | 3（1~10） |
| 图标大小 | `option.icon.fontSize` | number | 20（14~50） |
| 图标库 | `option.icon.scriptUrl` | input | 阿里云图标地址 |

---

### JWaitMatter（待办事项）

> 通用配置：基础配置、卡片配置

**内容设置（waitMatterConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 列数 | `option.body.column` | number | 3（1~10） |
| 图标大小 | `option.icon.fontSize` | number | 20（14~50） |
| 图标库 | `option.icon.scriptUrl` | input | 阿里云图标地址 |

---

### JIframe（iframe嵌入）

> 通用配置：基础配置、卡片配置

**iframe设置（iframeConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 地址 | `option.body.url` | input | - |

---

### JCarousel（轮播图）

**轮播图设置（carouselConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 是否自动切换 | `option.autoplay` | switch | false |
| 显示指示点 | `option.dots` | switch | false |
| 指示点位置 | `option.dotPosition` | select | `bottom`（顶/底） |

---

### JVideoPlay（视频播放）

**播放设置（videoConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 自动播放 | `option.autoPlay` | switch | false |
| 循环播放 | `option.loop` | switch | true |

---

### JFlashList（个性排名）

**排名设置（flashListConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 比例 | `option.zoom` | slider | 1（1~5） |
| 显示标题 | `option.titleShow` | switch | false |
| 标题 | `option.title` | input | `排名` |
| 标题字体大小 | `option.titleSize` | number | 16（1~100） |
| 标题字体颜色 | `option.titleColor` | color | `#fff` |
| 统计项颜色 | `option.itemColor` | color | `#fff` |
| 数字颜色 | `option.numberColor` | color | `#fff` |
| 数字字体大小 | `option.numberSize` | number | 16（1~100） |

---

### JBubbleRank（气泡排名）

**排名设置（bubbleRankConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 比例 | `option.zoom` | slider | 1（1~5） |
| 显示Tip | `option.showTip` | switch | true |
| Tip背景色 | `option.tipColor` | color | `#0E4C73` |
| Tip宽度 | `option.tipWidth` | number | 70（20~200） |
| Tip字体大小 | `option.tipFontSize` | number | 12（10~200） |
| Tip字体颜色 | `option.tipFontColor` | color | `#fff` |

---

### JLiquid（水波图）

**水波图设置（liquidPlotConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 类型 | `option.liquidType` | select | `circle`（圆）/ `diamond`（菱）/ `rect`（方）/ `triangle`（三角）/ `heart`（心）/ `stars`（五星） |
| 颜色 | `option.color` | color | `#1E90FF` |
| 外框宽度 | `option.borderWidth` | number | 2（1~20） |
| 间距 | `option.distance` | number | 1（1~20） |
| 外框颜色 | `option.borderColor` | color | `#1E90FF` |
| 外框透明度 | `option.strokeOpacity` | slider | 0（0~100） |
| 水波个数 | `option.count` | number | 4（0~100） |
| 水波长度 | `option.length` | number | 128（0~200） |
| 文本颜色 | `option.textColor` | color | `#ffffff` |
| 文本大小 | `option.textFontSize` | number | 30（1~50） |

---

### JRingProgress（环形进度图）

**环形图设置（activeRingPlotConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 环形颜色 | `option.color` | color | `#1E90FF` |
| 环形背景色 | `option.bgColor` | color | `#E8EDF3` |
| 字体颜色 | `option.fontColor` | color | `#FFFFFF` |
| 字体大小 | `option.fontSize` | number | 16（0~100） |

---

### JActiveRing（动态环形图）

**动态环形图设置（activeRingConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 显示原始值 | `option.showOriginValue` | switch | false |
| 线条宽度 | `option.lineWidth` | number | 10（5~30） |
| 环半径 | `option.radius` | number | 100（10~500） |
| 环半径（动态） | `option.activeRadius` | number | 120（10~500） |
| 文字颜色 | `option.textColor` | color | `#ffffff` |
| 文字大小 | `option.textFontSize` | number | 20（10~60） |

---

### JRadialBar（玉珏图）

**玉珏设置（radialBarConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 类型 | `option.type` | select | `bar`（柱形）/ `line`（线形） |
| 外环半径 | `option.radius` | slider | 0.8（0~1） |
| 内环半径 | `option.innerRadius` | slider | 0.2（0~1） |
| 最大旋转角度 | `option.maxAngle` | number | 240（0~360） |
| 圆角 | `option.radiuShow` | switch | false |
| 显示背景 | `option.bgShow` | switch | false |
| 自定义配色 | - | customColor | - |

---

### JPercentBar（百分比柱形图）

**柱形图设置（percentBarConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| Y轴刻度颜色 | `option.yNameFontColor` | color | `#fff` |
| Y轴刻度大小 | `option.yNameFontSize` | number | 12（0~36） |
| X轴刻度颜色 | `option.xNameFontColor` | color | `#fff` |
| X轴刻度大小 | `option.xNameFontSize` | number | 12（0~36） |
| 图例朝向 | `option.legendLayout` | select | `horizontal`（横）/ `vertical`（竖） |
| 图例位置 | `option.legendPosition` | select | `bottom`（下）/ `top`（上） |
| 图例字体颜色 | `option.legendFontColor` | color | `#fff` |
| 图例字体大小 | `option.legendFontSize` | number | 16（0~36） |
| 自定义配色 | - | customColor | - |

---

### JRectangle（矩形树图）

**矩形图设置（rectangleConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 主题 | `option.theme` | select | `default`（默认）/ `dark`（黑暗） |
| 字体大小 | `option.titleFontSize` | number | 12（0~36） |
| 字体颜色 | `option.titleColor` | color | `#fff` |
| 提示语字体大小 | `option.tipFontSize` | number | 12（0~36） |
| 提示语字体颜色 | `option.tipColor` | color | `#fff` |

---

### JAntvGauge（AntV仪表盘）

**仪表盘设置（antvGaugeOptionConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 仪表盘类型 | `option.gaugeType` | select | `''`（经典）/ `meter`（米轨） |
| 仪表盘粗度 | `option.gaugeWidth` | number | 15（0~100） |
| 显示刻度线 | `option.axisTickShow` | switch | false |
| 刻度线颜色 | `option.lineColor` | color | `#eee` |
| 显示刻度值 | `option.axisLabelShow` | switch | true |
| 刻度值颜色 | `option.axisLabelColor` | color | `#fff` |
| 刻度值字号 | `option.axisLabelFontSize` | number | 15（0~100） |
| 文本字号 | `option.valueFontSize` | number | 30（0~100） |
| 文本颜色 | `option.valueColor` | color | 12（默认值） |
| 指针颜色 | `option.indicatorColor` | color | `#D0D0D0` |
| 指针粗度 | `option.indicatorLength` | number | 8（0~100） |

---

### JCapsuleChart（胶囊图）

**胶囊图设置（capsuleConfig）**

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 显示数值 | `option.showValue` | switch | false |
| x轴名称 | `option.unit` | input | - |

---

## 三、地图组件配置

### JBubbleMap / JBarMap / JFlyLineMap / JHeatMap / JTotalFlyLineMap / JTotalBarMap（地图系列）

> 通用配置：基础配置、卡片配置、标题配置、副标题配置、自定义属性

**地图设置（mapConfig）**
适用：JBubbleMap, JFlyLineMap, JBarMap, JTotalFlyLineMap, JTotalBarMap, JHeatMap, JFly3dMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 地图选择 | `option.area.value` | areaSelect | - |
| 区域名称显隐 | `option.geo.label.normal.show` | switch | false |
| 区域名称字体大小 | `option.geo.label.normal.fontSize` | number | 10（1~50） |
| 区域名称字体颜色 | `option.geo.label.normal.color` | color | `#EBCCCC` |
| 开启钻取 | `commonOption.breadcrumb.drillDown` | switch | false |
| 地图导航文字颜色 | `commonOption.breadcrumb.textColor` | color | `#000000` |
| 鼠标缩放 | `option.geo.roam` | switch | false |
| 缩放比例 | `option.geo.zoom` | slider | 1（0.1~10） |
| 地图的长宽比 | `option.geo.aspectScale` | slider | 0.75（0.1~3） |
| 地图顶边距 | `option.geo.top` | slider | 20（0~1000） |
| 地图左边距 | `option.geo.left` | slider | 20（0~1000） |

**地图配色（lineMapColorConfig）**
适用：JTotalFlyLineMap, JFlyLineMap, JBubbleMap, JTotalBarMap, JHeatMap, JBarMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 启用渐变色 | `commonOption.gradientColor` | switch | false |
| 区域中心颜色（渐变时） | `commonOption.areaColor.color1` | color | `#0A0909` |
| 区域边缘颜色（渐变时） | `commonOption.areaColor.color2` | color | `#3B373700` |
| 区域颜色（非渐变） | `commonOption.areaColor.color1` | color | `#EEDD78` |
| 区域高亮颜色 | `option.geo.itemStyle.emphasis.areaColor` | color | `#EEDD78` |
| 区域边界颜色 | `option.geo.itemStyle.normal.borderColor` | color | `#93ebf8` |
| 区域阴影大小 | `option.geo.itemStyle.normal.shadowBlur` | number | 10 |
| 阴影水平偏移 | `option.geo.itemStyle.normal.shadowOffsetX` | number | -2 |
| 阴影垂直偏移 | `option.geo.itemStyle.normal.shadowOffsetY` | number | 2 |
| 区域阴影颜色 | `option.geo.itemStyle.normal.shadowColor` | color | `#80d9f8` |

**视觉映射（visualMapConfig）**
适用：JBubbleMap, JBarMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 视觉映射显隐（开关） | `option.visualMap.show` | switch | true |
| 类型 | `option.visualMap.type` | select | `continuous`（连续）/ `piecewise`（分段） |
| 最小值 | `option.visualMap.min` | number | 0 |
| 最大值 | `option.visualMap.max` | number | 0 |
| 区域配色 | `commonOption.inRange.color` | customColor | 10色 |

**散点配置（scatterConfig）**
适用：JBubbleMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 散点类型 | `option.area.markerType` | select | `effectScatter`（涟漪）/ `scatter`（散点） |
| 散点颜色 | `option.area.markerColor` | color | `#DDE330` |
| 散点显示数量 | `option.area.markerCount` | number | 5（0~100） |
| 散点透明度 | `option.area.markerOpacity` | slider | 1（0~1） |

**柱体配置（barMapConfig）**
适用：JBarMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 柱体大小 | `commonOption.barSize` | number | 17 |
| 柱体左侧颜色 | `commonOption.barColor` | color | `#D6F263` |
| 柱体右侧颜色 | `commonOption.barColor2` | color | `#A3DB6B` |

**飞线配置（flyLineConfig）**
适用：JFlyLineMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 动画时间 | `option.commonOption.effect.period` | number | 6 |
| 特效尾迹的长度 | `option.commonOption.effect.trailLength` | number | 0（0~1） |
| 标记大小 | `option.commonOption.effect.symbolSize` | number | 15 |

**热力配置（heatConfig）**
适用：JHeatMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 点大小 | `commonOption.heat.pointSize` | number | 15 |
| 点模糊大小 | `commonOption.heat.blurSize` | number | 20 |
| 最大透明度 | `commonOption.heat.maxOpacity` | number | 1 |

**时间轴配置（timeLineConfig）**
适用：JTotalFlyLineMap, JTotalBarMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 时间轴显隐（开关） | `option.timeline.show` | switch | true |
| 播放速度(毫秒) | `option.timeline.playInterval` | number | 2000 |
| 自动播放 | `option.timeline.autoPlay` | switch | false |
| 时间轴刻度线颜色 | `option.timeline.lineStyle.color` | color | `#555555` |
| 时间轴刻度值颜色 | `option.timeline.label.normal.textStyle.color` | color | `#ffffff` |
| 鼠标经过刻度值颜色 | `option.timeline.label.emphasis.textStyle.color` | color | `#ffffff` |
| 当前项边框颜色 | `option.timeline.checkpointStyle.borderColor` | color | `#777777` |
| 当前项边框宽度 | `option.timeline.checkpointStyle.borderWidth` | number | 2 |
| 控制按钮颜色 | `option.timeline.controlStyle.normal.color` | color | `#666666` |
| 鼠标经过控制按钮颜色 | `option.timeline.controlStyle.emphasis.color` | color | `#aaaaaa` |
| 控制按钮边框颜色 | `option.timeline.controlStyle.normal.borderColor` | color | `#666666` |
| 鼠标经过按钮边框颜色 | `option.timeline.controlStyle.emphasis.borderColor` | color | `#aaaaaa` |

**数据配置（dataConfig）**
适用：JTotalBarMap

| 配置项 | prop 路径 | 类型 | 默认值 |
|--------|-----------|------|--------|
| 数据标题 | `commonOption.dataTitle` | input | `''` |
| 数据标题字体大小 | `commonOption.dataTitleSize` | number | 25 |
| 数据标题字体颜色 | `commonOption.dataTitleColor` | color | `#ffffff` |
| 柱形图排名文本颜色 | `commonOption.dataNameColor` | color | `#dddddd` |
| 柱形图排名刻度颜色 | `commonOption.dataValueColor` | color | `#dddddd` |
| 柱形图底边距 | `commonOption.grid.bottom` | slider | 50（0~100） |
| 柱形图左边距 | `commonOption.grid.left` | slider | 80（0~100） |
| 柱形图顶边距 | `commonOption.grid.top` | slider | 80（0~100） |
