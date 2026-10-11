# 大屏组件配置修改参考

修改大屏组件样式时，根据组件类型和修改目标，使用对应的配置路径。

## 专文索引（这些组件配置有独立详细文档，必须跳转过去看）

| compType | 专文路径 |
|---|---|
| `JBreakRing` | `references/break-ring-option-config.md` |
| `JCardScroll` | `references/card-scroll-option-config.md` |
| `JGaoDeMap` | `references/gaode-map-option-config.md` |
| `JListProgress` | `references/list-progress-option-config.md` |
| `JOrbitRing` | `references/orbit-ring-option-config.md` |
| `JPermanentCalendar` | `references/permanent-calendar-option-config.md` |
| `JScrollList` | `references/scroll-list-option-config.md` |
| `JSemiGauge` | `references/semi-gauge-option-config.md` |
| `JStatsSummary` | `references/stats-summary-option-config.md` |
| `JTabToggle` | `references/tab-toggle-option-config.md` |

> 这 10 个有专文的组件本文件**也**有简表（保持入口一致），但完整属性以专文为准。其他 86 个组件全部在本文件中（含末尾"补充：原本未文档化的 11 个组件"小节）。

## 目录（按需跳读）

- §修改输出格式 / §颜色修改规则 / §通用规则 — 调用约定、着色与共性
- §基础配置 / §标题设置 / §X轴 / §Y轴 / §图例 / §柱体 / §折线 / §饼图 / §坐标轴边距 / §数值设置 — ECharts 通用面板字段
- §文本设置（JText/JCurrentTime/JNumber）/ §翻牌器（JCountTo）/ §进度条 / §列表进度图 / §水波图 / §象形图系列 — 指标/装饰类组件
- §仪表盘系列 / §环形图系列 / §玉珏 / §矩形图 / §颜色块 / §字符云 / §闪光云 — 仪表/云图
- §轮播表格 / §表格/数据表/列表 / §滚动/历程/排名/气泡排名 / §滚动列表（JScrollList）— 表格与排名板
- §3D 金字塔/漏斗 / §圆形进度图 / §图片/图标/轮播图 / §边框装饰 / §播放器 / §Iframe / §按钮 / §天气 — 交互/媒体组件
- §环形/南丁格尔/胶囊/百分比柱状/ECharts 进度条 — 小图表补充
- §地图系列（地图设置/配色/视觉映射/散点/热力/柱体/飞线）— 地图专属字段
- §组件数据格式（chartData）/ §组件与设置面板映射表 / §ECharts 与非 ECharts 组件区分 — 数据结构与关联关系

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

## 颜色修改规则

### customColor 组件列表
以下组件的颜色属性使用 `customColor` 格式修改：
- JRadioButton, JRadialBar, JActiveRing, JRing, JPyramidFunnel, JFunnel
- JBubble, DoubleLineBar, JMultipleLine, JArea, JLine
- JRotatePie, JRose, JPie, JMixLineBar, JPercentBar
- JMultipleBar, JCapsuleChart, JStackBar, JQuadrant

格式：
```json
"customColor": [
  {"color1": "#FF0000", "color": "#FF0000"},
  {"color1": "#00FF00", "color": "#00FF00"}
]
```

### 柱体颜色
普通柱状图使用 `option.series[${index}].itemStyle.color`
JDynamicBar 等也使用 `option.series[${index}].itemStyle.color`

### 其他组件
不包含 customColor 属性的组件，按照对应组件配置的属性 value 值修改

## 通用规则

- 颜色使用具体色值（如 `#000000`），不使用英文单词（如 black）
- 字体粗细可选值：`normal`（默认）、`bold`（粗体）、`lighter`（细体）
- Y轴单位 `option.yAxis.yUnit`：预设值有 `%`（百分比）、`K`（千）、`W`（万）、`M`（亿）；自定义单位时设 `yUnit: 'CUSTOM'` 并设 `yCustomUnit: '元'`

## 基础配置 (BasicOption)

| 说明 | 配置路径 |
|------|---------|
| 图层名称 | `name` |
| 图层背景色 | `background` |
| 图层边框线 | `borderColor` |
| 提示语显隐 | `option.tooltip.show` |
| 提示语字体大小 | `option.tooltip.textStyle.fontSize` |
| 提示语字体颜色 | `option.tooltip.textStyle.color` |

## 标题设置 (TitleOption)

| 说明 | 配置路径 |
|------|---------|
| 标题名称 | `option.title.text` |
| 标题字体大小 | `option.title.textStyle.fontSize` |
| 标题字体颜色 | `option.title.textStyle.color` |
| 标题字体粗细 | `option.title.textStyle.fontWeight` |
| 副标题名称 | `option.title.subtext` |
| 副标题字体大小 | `option.title.subtextStyle.fontSize` |
| 副标题字体颜色 | `option.title.subtextStyle.color` |
| 左对齐 | `option.title.left` |
| 垂直居中 | `option.title.top` |

## X轴设置 (XAxisOption)

| 说明 | 配置路径 |
|------|---------|
| X轴名称 | `option.xAxis.name` |
| X轴名称颜色 | `option.xAxis.nameTextStyle.color` |
| X轴名称字体大小 | `option.xAxis.nameTextStyle.fontSize` |
| X轴标签颜色 | `option.xAxis.axisLabel.color` |
| X轴标签角度 | `option.xAxis.axisLabel.rotate` |
| X轴轴线颜色 | `option.xAxis.axisLine.lineStyle.color` |
| X轴类型 | `option.xAxis.type` |
| X轴网格线显隐 | `option.xAxis.splitLine.show` |
| X轴网格线颜色 | `option.xAxis.splitLine.lineStyle.color` |

## Y轴设置 (YAxisOption)

| 说明 | 配置路径 | 备注 |
|------|---------|------|
| Y轴名称 | `option.yAxis.name` | |
| Y轴名称颜色 | `option.yAxis.nameTextStyle.color` | |
| Y轴名称字体大小 | `option.yAxis.nameTextStyle.fontSize` | |
| Y轴标签颜色 | `option.yAxis.axisLabel.color` | |
| Y轴标签角度 | `option.yAxis.axisLabel.rotate` | |
| Y轴轴线颜色 | `option.yAxis.axisLine.lineStyle.color` | |
| Y轴类型 | `option.yAxis.type` | |
| Y轴网格线显隐 | `option.yAxis.splitLine.show` | |
| Y轴网格线颜色 | `option.yAxis.splitLine.lineStyle.color` | |
| Y轴单位 | `option.yAxis.yUnit` | 预设: `%`, `K`, `W`, `M`；自定义: 设为 `CUSTOM` 并设 `yCustomUnit` |

## 图例设置 (LegendOption)

| 说明 | 配置路径 |
|------|---------|
| 图例字体大小 | `option.legend.textStyle.fontSize` |
| 图例排列方向 | `option.legend.orient` |
| 图例上下边距 | `option.legend.t` |
| 图例左右边距 | `option.legend.r` |

## 柱体设置 (BarCylinder)

| 说明 | 配置路径 |
|------|---------|
| 柱体宽度 | `option.series[${index}].barWidth` |
| 柱体圆角 | `option.series[${index}].itemStyle.borderRadius` |
| 柱体颜色 | `option.series[${index}].itemStyle.color` |
| 柱体背景色显隐 | `option.series[${index}].showBackground` |
| 柱体背景色颜色 | `option.series[${index}].backgroundStyle.color` |

## 折线设置 (PolyglineOption)

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 折线类型 | `option.series[${index}].lineType` | `line`（折线）, `smooth`（曲线）, `area`（面积） |
| 透明度 | `option.series[0].areaStyleOpacity` | |
| 线条宽度 | `option.series[${index}].lineWidth` | |
| 标记点 | `option.series[${index}].symbol` | |
| 点的大小 | `option.series[${index}].symbolSize` | |

## 饼图设置 (pieSettingOption)

| 说明 | 配置路径 |
|------|---------|
| 设置成环形 | `option.isRadius` |
| 内环半径 | `option.innerRadius` |
| 外环半径 | `option.outRadius` |
| 南丁格尔玫瑰 | `option.isRose` |
| 标签显示位置 | `option.pieLabelPosition` |

## 坐标轴边距 (GridOption)

| 说明 | 配置路径 |
|------|---------|
| 左边距 | `option.grid.left` |
| 顶边距 | `option.grid.top` |
| 右边距 | `option.grid.right` |
| 底边距 | `option.grid.bottom` |

## 数值设置 (NumOption)

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 显示数值 | `option.series[${index}].label.show` | |
| 数值位置 | `option.series[${index}].label.position` | `top`（顶部）, `""`（中间）, `insideBottom`（底部） |
| 数值格式 | `option.label.format` | |
| 数值颜色 | `option.series[${index}].label.color` | |
| 数值字体大小 | `option.series[${index}].label.fontSize` | |
| 数值字体粗细 | `option.series[${index}].label.fontWeight` | |
| 数值单位显隐 | `option.showUnit.show` | |
| 数值单位数量级 | `option.showUnit.numberLevel` | `1`（百分比）, `3`（千）, `4`（万） |
| 数值单位小数位 | `option.showUnit.decimal` | |

## 文本设置 (TextOption) - JText / JCurrentTime / JNumber 组件

| 说明 | 配置路径 | 可选值 |
|----|---------|--------|
| 字体大小 | `option.body.fontSize` | |
| 字体间距 | `option.body.letterSpacing` | |
| 字体颜色 | `option.body.color` | |
| 字体粗细 | `option.body.fontWeight` | `normal`, `bold`, `lighter` |
| 对齐方式 | `option.body.textAlign` | `left`, `center`, `right` |
| 字体 | `option.body.fontFamily` | |
| 字体风格 | `option.body.fontStyle` | `normal`, `italic` |
| 千分符 | `option.body.thousandSeparator` | |
| 水平间距 | `option.body.marginLeft` | |
| 垂直间距 | `option.body.marginTop` | |
| 跑马灯 | `option.horseLamp` | |
| 跑马灯速度(ms) | `option.speed` | |
| 超链接开关 | `option.isLink` | |
| 超链接地址 | `option.openUrl` | |
| 超链接打开方式 | `option.openType` | `_blank`, `_self` |

### 文本渐变配置（JText / JCurrentTime / JNumber 支持）

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 启用渐变 | `option.body.gradient.enabled` | `true`/`false` |
| 渐变类型 | `option.body.gradient.type` | `linear`（线性）, `radial`（径向） |
| 渐变方向 | `option.body.gradient.direction` | `to right`, `to left`, `to bottom`, `to top`, `135deg` 等 |
| 起始颜色 | `option.body.gradient.startColor` | `#000000` |
| 结束颜色 | `option.body.gradient.endColor` | `#ffffff` |

> **注意**：启用渐变后前端会自动设置 CSS `-webkit-background-clip: text`，`color` 字段将被忽略。

## 翻牌器设置 (CountToTextOption) - JCountTo 组件

| 说明 | 配置路径 |
|------|---------|
| 字体粗细 | `option.fontWeight` |
| 字体颜色 | `option.fontColor` |
| 字体大小 | `option.fontSize` |
| 前缀文本 | `option.prefix` |
| 前缀字体大小 | `option.prefixFontSize` |
| 前缀字体颜色 | `option.prefixColor` |
| 前缀字体粗细 | `option.prefixFontWeight` |
| 前缀对齐方式 | `option.prefixTextAlign` |
| 前缀X间距 | `option.prefixGridX` |
| 前缀Y间距 | `option.prefixGridY` |
| 后缀文本 | `option.suffix` |
| 后缀字体大小 | `option.suffixFontSize` |
| 后缀字体颜色 | `option.suffixColor` |
| 后缀字体粗细 | `option.suffixFontWeight` |
| 后缀对齐方式 | `option.suffixTextAlign` |
| 后缀X间距 | `option.suffixGridX` |
| 后缀Y间距 | `option.suffixGridY` |

## 进度条设置 (CustomProgressOption)

| 说明 | 配置路径 |
|------|---------|
| 目标颜色 | `option.backgroundColor` |
| 进度颜色 | `option.progressColor` |
| 进度条宽度 | `option.barWidth` |
| 边距 | `option.padding` |
| 标题颜色 | `option.titleColor` |
| 标题字体大小 | `option.titleFontSize` |
| 标题位置 | `option.titlePosition` |
| 数值颜色 | `option.valueColor` |
| 数值字体大小 | `option.valueFontSize` |
| 数值位置 | `option.valuePosition` |
| 数值横向偏移 | `option.valueXOffset` |

## 列表进度图设置 (ListProgressOption)

| 说明 | 配置路径 |
|------|---------|
| 行高度 | `option.row.height` |
| 行左边距 | `option.row.marginLeft` |
| 行右边距 | `option.row.marginRight` |
| 行上边距 | `option.row.marginTop` |
| 进度条颜色 | `option.bar.background.color` |
| 进度条填充色 | `option.bar.fill.color` |
| 进度条高度 | `option.bar.height` |
| 进度条圆角 | `option.bar.borderRadius` |
| 指示点大小 | `option.bar.indicatorSize` |
| 指示点颜色 | `option.bar.indicatorColor` |
| 显示边框 | `option.bar.border.enabled` |
| 边框颜色 | `option.bar.border.color` |
| 边框大小 | `option.bar.border.width` |
| 边框边距 | `option.bar.border.padding` |

## 水波图设置 (LiquidPlotOption) - JLiquid 组件

| 说明 | 配置路径 |
|------|---------|
| 显示类型 | `option.liquidType` |
| 波纹颜色 | `option.color` |
| 波纹个数 | `option.count` |
| 波纹长度 | `option.length` |
| 外框颜色 | `option.borderColor` |
| 外框宽度 | `option.borderWidth` |
| 间距 | `option.distance` |
| 透明度 | `option.strokeOpacity` |
| 文本颜色 | `option.textColor` |
| 文本字体大小 | `option.textFontSize` |

## 象形图设置 (PictorialOption) - JPictorialBar 组件

| 说明 | 配置路径 |
|------|---------|
| 柱体颜色 | `option.barColor` |
| 透明度 | `option.barOpacity` |
| 图标间距 | `option.series[0].barCategoryGap` |

## 象形图图标设置 (PictorialIconOption) - JPictorial 组件

| 说明 | 配置路径 |
|------|---------|
| 图标间距 | `option.symbolMargin` |
| 图标大小 | `option.symbolSize` |
| 图标路径/URL | `option.symbol` |

## 仪表盘设置 (GaugeOption)

| 说明 | 配置路径 |
|------|---------|
| 刻度值显隐 | `option.series[0].axisLabel.show` |
| 刻度值颜色 | `option.series[0].axisLabel.color` |
| 刻度值字体大小 | `option.series[0].axisLabel.fontSize` |
| 刻度线显隐 | `option.series[0].axisTick.show` |
| 刻度线长度 | `option.series[0].axisTick.length` |
| 刻度线颜色 | `option.series[0].axisTick.lineStyle.color` |
| 分割线显隐 | `option.series[0].splitLine.show` |
| 分割线长度 | `option.series[0].splitLine.length` |
| 分割线颜色 | `option.series[0].splitLine.lineStyle.color` |
| 指标字号 | `option.series[0].detail.fontSize` |

## 渐变仪表盘设置 (AntvGaugeOption)

| 说明 | 配置路径 |
|------|---------|
| 粗细 | `option.gaugeWidth` |
| 刻度值显隐 | `option.axisLabelShow` |
| 刻度值颜色 | `option.axisLabelColor` |
| 刻度值字体大小 | `option.axisLabelFontSize` |
| 刻度线显隐 | `option.axisTickShow` |
| 刻度线颜色 | `option.lineColor` |
| 文本颜色 | `option.valueColor` |
| 文本字体大小 | `option.valueFontSize` |
| 指针颜色 | `option.indicatorColor` |
| 指针粗细 | `option.indicatorLength` |

## 环形图设置 (ActiveRingPlotOption)

| 说明 | 配置路径 |
|------|---------|
| 颜色 | `option.color` |
| 背景色 | `option.bgColor` |
| 外环半径 | `option.outRadius` |
| 内环半径 | `option.innerRadius` |
| 标题字体大小 | `option.fontSize` |
| 标题字体颜色 | `option.fontColor` |
| 标题字体粗细 | `option.fontWeight` |
| 数值字体大小 | `option.valueFontSize` |
| 数值字体颜色 | `option.valueFontColor` |
| 数值字体粗细 | `option.valueFontWeight` |

## 动态环形图设置 (ActiveRingOption)

| 说明 | 配置路径 |
|------|---------|
| 显示原始值 | `option.showOriginValue` |
| 文字颜色 | `option.textColor` |
| 文字大小 | `option.textFontSize` |
| 线条宽度 | `option.lineWidth` |
| 环半径 | `option.radius` |
| 动态环半径 | `option.activeRadius` |

## 玉珏设置 (RadialBarOption)

| 说明 | 配置路径 |
|------|---------|
| 显示圆角 | `option.radiuShow` |
| 背景显示 | `option.bgShow` |
| 外环半径 | `option.radius` |
| 内环半径 | `option.innerRadius` |
| 最大旋转角 | `option.maxAngle` |

## 矩形图设置 (RectangleOption)

| 说明 | 配置路径 |
|------|---------|
| 文本颜色 | `option.titleColor` |
| 文本字体大小 | `option.titleFontSize` |
| 显示图例 | `option.showLegend` |

## 颜色块设置 (ColorBlockOption)

| 说明 | 配置路径 |
|------|---------|
| 行数 | `option.lineNum` |
| 边距 | `option.padding` |
| X间距 | `option.borderSplitx` |
| Y间距 | `option.borderSplity` |
| 小数位数 | `option.decimals` |
| 字体大小 | `option.fontSize` |
| 字体颜色 | `option.color` |
| 字体粗细 | `option.fontWeight` |
| 对齐方式 | `option.textAlign` |
| 前缀字体颜色 | `option.prefixColor` |
| 前缀字体粗细 | `option.prefixFontWeight` |
| 前缀X间距 | `option.prefixSplitx` |
| 前缀Y间距 | `option.prefixSplity` |
| 后缀字体大小 | `option.suffixFontSize` |
| 后缀字体颜色 | `option.suffixColor` |
| 后缀字体粗细 | `option.suffixFontWeight` |
| 后缀X间距 | `option.suffixSplitx` |

## 字符云设置 (WordCloudOption)

| 说明 | 配置路径 |
|------|---------|
| 字体颜色 | `option.color` |
| 字体间距 | `option.padding` |
| 字体旋转 | `option.rotation` |
| 字体最大值 | `option.minSize` |
| 字体最小值 | `option.maxSize` |
| 形状 | `option.series[0].shape` |

## 闪光云设置 (FlashCloudOption)

| 说明 | 配置路径 |
|------|---------|
| 缩放 | `option.zoom` |
| 字体大小 | `option.textSize` |
| 字体颜色 | `option.textColor` |

## 轮播表格设置 (ScrollBoardOpt) - JScrollBoard 组件

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 轮播方式 | `option.carousel` | `single`（单行）, `page`（整页） |
| 悬浮暂停 | `option.hoverPause` | |
| 等待时间(ms) | `option.waitTime` | |
| 开启排名 | `option.index` | |
| 序号列宽 | `option.indexWidth` | |
| 显示表头 | `option.headShow` | |
| 表头背景颜色 | `option.headerBGC` | |
| 表头行高 | `option.headerHeight` | |
| 表头字体大小 | `option.headFontSize` | |
| 每页行数 | `option.rowNum` | |
| 奇行颜色 | `option.oddRowBGC` | |
| 偶行颜色 | `option.evenRowBGC` | |
| 表体字体大小 | `option.bodyFontSize` | |

## 表格设置 (ScrollTableStyle)

| 说明 | 配置路径 |
|------|---------|
| 开启排名 | `option.ranking` |
| 开启滚动 | `option.scroll` |
| 滚动时间 | `option.scrollTime` |
| 显示表头 | `option.showHead` |
| 表头背景颜色 | `option.headerBgColor` |
| 表头字体颜色 | `option.headerFontColor` |
| 表头字体大小 | `option.fontSize` |
| 行高 | `option.lineHeight` |
| 边框显示 | `option.showBorder` |
| 边框宽度 | `option.borderWidth` |
| 边框颜色 | `option.borderColor` |
| 边框线类型 | `option.borderStyle` |
| 表格字体颜色 | `option.bodyFontColor` |
| 表格字体大小 | `option.bodyFontSize` |
| 奇行颜色 | `option.oddColor` |
| 偶行颜色 | `option.evenColor` |

## 数据表格设置 (TableStyle)

| 说明 | 配置路径 |
|------|---------|
| 表头背景颜色 | `option.headerBgColor` |
| 表头字体大小 | `option.headerFontSize` |
| 表头字体颜色 | `option.headerColor` |
| 内容字体颜色 | `option.bodyColor` |
| 内容字体大小 | `option.bodyFontSize` |
| 内容背景颜色 | `option.bodyBgColor` |

## 列表设置 (ListStyle)

| 说明 | 配置路径 |
|------|---------|
| 显示标题前缀 | `option.showTitlePrefix` |
| 显示时间前缀 | `option.showTimePrefix` |
| 布局 | `option.layout` |
| 标题字体颜色 | `option.titleFontColor` |
| 标题字体粗细 | `option.titleFontWeight` |
| 标题字体大小 | `option.titleFontSize` |
| 图标颜色 | `option.iconColor` |
| 内容颜色 | `option.contentColor` |
| 开启动画 | `option.isEnableAnimation` |
| 轮播时间(ms) | `option.scrollTime` |

## 滚动设置 (ScrollOption) - JScrollRankingBoard 组件

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 是否排序 | `option.sort` | |
| 轮播方式 | `option.carousel` | `single`（单行）, `page`（整页） |
| 显示行数 | `option.rowNum` | |
| 滚动时间(ms) | `option.waitTime` | |
| 进度条颜色 | `option.color` | 默认 `#1370fb` |
| 文字颜色 | `option.textColor` | 默认 `#fff` |
| 字体大小 | `option.fontSize` | 默认 `13` |

## 历程设置 (DevHistoryOption)

| 说明 | 配置路径 |
|------|---------|
| 缩放 | `option.zoom` |
| 轮播间隔 | `option.waitTime` |
| 背景色 | `option.typeBackColor` |
| 字体颜色 | `option.typeFontColor` |
| 内容字体颜色 | `option.titleColor` |
| 内容字体大小 | `option.titleFontSize` |

## 个性排名设置 (RankingStyle) - JFlashList 组件

> 🚨 **三大隐藏陷阱**（实测 2026-04-30，AI 按 ECharts 直觉踩坑后补录）：
> 1. **`option.title` 是【字符串】**（默认 `"排名统计"`），不是 ECharts title dict。误传 `{show, text, textStyle}` → 前端 Vue 模板 `{{ option.title }}` 把对象 `JSON.stringify` 后整段 `{"show":true,"text":"..."}` 当文本贴出来，溢出容器形成"漏 JSON"错觉。显隐用 `option.titleShow`（boolean），颜色字号用 `option.titleColor` / `option.titleSize`。
> 2. **只渲染前 4 条**（组件内 `result.slice(0,4)`，按 value 降序）。给 8/10 条 mock 数据后 5/6 条被静默丢弃。
> 3. **容器最小宽度 ≥240px**。<200px 时长名称（≥10 汉字）被强制单字竖排堆叠——序号块 + numberSize 数值带走 ~80px，可用名称区 <130px 撑不下"火灾突发-海淀清河"这种 11 字串。解决：加宽到 240+ 或把 name 简化到 6-8 字（"火灾·海淀"格式）。

✅ 正确写法：
```json
{
  "type": "JFlashList",
  "pos": [x, y, 240, 250],
  "data": [{"name": "火灾·海淀", "value": 4}, {"name": "燃气·丰台", "value": 4}],
  "option": {
    "title": "应急事件实时",
    "titleShow": true,
    "titleColor": "#ff4d4f",
    "titleSize": 14
  }
}
```

❌ 错误写法（漏 JSON 串）：
```json
"option": {
  "title": {"show": true, "text": "应急事件实时", "textStyle": {"color": "#ff4d4f"}}
}
```

| 说明 | 配置路径 | 类型 | 备注 |
|------|---------|------|------|
| 整体缩放 | `option.zoom` | number | 范围 1-5 |
| 显示标题 | `option.titleShow` | boolean | 控制标题区域显隐 |
| 标题文本 | `option.title` | **string** | ⚠️ 字符串，非 ECharts title dict |
| 标题颜色 | `option.titleColor` | color | 十六进制色值 |
| 标题字号 | `option.titleSize` | number | 字体大小(px) |
| 排名项名称颜色 | `option.itemColor` | color | 十六进制色值 |
| 数值颜色 | `option.numberColor` | color | 十六进制色值 |
| 数值字号 | `option.numberSize` | number | 字体大小(px) |
| 入场动画类型 | `option.animateType` | string | CSS动画类名，如 `zoomInUp` |

**数据说明**：
- chartData 最多取前 4 条（组件内部 `result.slice(0,4)`），按 value 降序排列
- 字段映射：`name`（排名项名称）、`value`（数值）

## 气泡排名设置 (BubbleRankingStyle)

| 说明 | 配置路径 |
|------|---------|
| 比例 | `option.zoom` |
| 显示提示词 | `option.showTip` |
| 提示词背景颜色 | `option.tipColor` |
| 提示词宽度 | `option.tipWidth` |
| 提示词内容颜色 | `option.tipFontColor` |
| 提示词内容字体大小 | `option.tipFontSize` |

## 滚动列表 (JScrollList)

详细配置见 `references/scroll-list-option-config.md`（变体区分规则、容器/行/表头/序号列/字段映射完整路径 + 三变体 option 示例）。

## 3D金字塔/漏斗设置 (Pyramid3DOption)

| 说明 | 配置路径 |
|------|---------|
| 缩放 | `option.zoom` |
| 尺寸 | `option.size` |

## 圆形进度图设置 (RoundProgressOption) - JRoundProgress 组件

| 说明 | 配置路径 |
|------|---------|
| 背景颜色 | `option.backgroundStyle.color` |
| 外圆边框颜色 | `option.outerCircle.borderColor` |
| 内圆边框颜色 | `option.innerCircle.borderColor` |

## 图片设置 (ImageOption) - JImg 组件

| 说明 | 配置路径 |
|------|---------|
| 图片地址 | `option.body.url` |
| 旋转开关 | `option.izRotate` |
| 旋转时间(ms) | `option.rotateTime` |
| 透明度 | `option.opacity` |
| 背景颜色 | `option.backgroundColor` |
| 圆角 | `option.borderRadius` |
| 内边距 | `option.padding` |

## 图标设置 (CustomIconOption) - JCustomIcon 组件

| 说明 | 配置路径 |
|------|---------|
| 图标颜色 | `option.color` |
| 透明度 | `option.opacity` |
| 模糊度 | `option.filter` |

> `config.type` 设 `'01'`~`'36'` 决定显示哪个系统图标，与 option 无关。

## 轮播图设置 (CarouselOption) - JCarousel 组件

| 说明 | 配置路径 |
|------|---------|
| 自动轮播 | `option.autoplay` |
| 显示指示点 | `option.dots` |
| 指示点位置 | `option.dotPosition` |

## 边框/装饰设置 (BorderDecorationStyle) - JDragBorder / JDragDecoration 组件

| 说明 | 配置路径 |
|------|---------|
| 边框/装饰类型 | `option.type` |
| 标题文本 | `option.title` |
| 主颜色 | `option.mainColor` |
| 副颜色 | `option.subColor` |
| 翻转 | `option.reverse` |
| 动画时长(s) | `option.dur` |
| 扫描动画时长 | `option.scanDur` |
| 光晕动画时长 | `option.haloDur` |

## 播放器设置 (VideoPlayOption) - JVideoPlay 组件

| 说明 | 配置路径 |
|------|---------|
| 自动播放 | `option.autoPlay` |
| 循环播放 | `option.loop` |

## Iframe 设置 (IframeOption) - JIframe 组件

| 说明 | 配置路径 |
|------|---------|
| 链接地址 | `option.body.url` |

## 按钮设置 (RadioButtonStyle) - JRadioButton 组件

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 按钮形状 | `option.body.shape` | |
| 水平间距 | `option.body.marginLeft` | |
| 垂直间距 | `option.body.marginTop` | |

## 天气设置 (WeatherOption) - JWeatherForecast 组件

| 说明 | 配置路径 |
|------|---------|
| 城市 | `option.city` |
| 显示模板 | `option.template` |
| 显示天数 | `option.num` |
| 背景颜色 | `option.bgColor` |
| 字体大小 | `option.fontSize` |
| 字体颜色 | `option.fontColor` |

## 环形设置 (RingOption)

| 说明 | 配置路径 |
|------|---------|
| 内半径 | `option.innerRadius` |
| 外半径 | `option.outRadius` |

## 南丁格尔玫瑰设置 (RoseOption)

| 说明 | 配置路径 |
|------|---------|
| 边框宽度 | `option.series[0].itemStyle.borderWidth` |
| 颜色透明度 | `option.series[0].itemStyle.colorOpacity` |

## 胶囊图设置 (CapsuleChartOption)

| 说明 | 配置路径 |
|------|---------|
| 显示数值 | `option.showValue` |
| X轴名称 | `option.unit` |

## 百分比柱状图样式 (PercentBarStyle)

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| Y轴刻度颜色 | `option.yNameFontColor` | |
| Y轴刻度字体大小 | `option.yNameFontSize` | |
| X轴刻度颜色 | `option.xNameFontColor` | |
| X轴刻度字体大小 | `option.xNameFontSize` | |
| 图例位置 | `option.legendPosition` | `top`（居上）, `bottom`（居下） |
| 图例字体颜色 | `option.legendFontColor` | |
| 图例字体大小 | `option.legendFontSize` | |

## 进度条 ECharts 设置 (ProgressOption)

| 说明 | 配置路径 |
|------|---------|
| 显示标题 | `option.yAxis.axisLabel.show` |
| 标题字体颜色 | `option.yAxis.axisLabel.color` |
| 标题字体大小 | `option.yAxis.axisLabel.fontSize` |
| 数值字体颜色 | `option.series[1].label.color` |
| 数值字体大小 | `option.series[1].label.fontSize` |
| 横向偏移 | `option.valueXOffset` |
| 纵向偏移 | `option.valueYOffset` |
| 柱体宽度 | `option.series[0].barWidth` |
| 进度颜色 | `option.series[0].color` |
| 目标颜色 | `option.series[1].color` |

## 地图设置 (MapOption)

| 说明 | 配置路径 |
|------|---------|
| 显示区域名称 | `option.geo.label.normal.show` |
| 区域名称颜色 | `option.geo.label.normal.color` |
| 区域名称字体大小 | `option.geo.label.normal.fontSize` |
| 开启钻取 | `commonOption.breadcrumb.drillDown` |
| 鼠标缩放 | `option.geo.roam` |
| 缩放比例 | `option.geo.zoom` |
| 长宽比 | `option.geo.aspectScale` |
| 顶边距 | `option.geo.top` |
| 左边距 | `option.geo.left` |

## 地图配色设置 (LineMapColorOption)

| 说明 | 配置路径 |
|------|---------|
| 启用渐变色 | `commonOption.gradientColor` |
| 中心颜色 | `commonOption.areaColor.color1` |
| 边缘颜色 | `commonOption.areaColor.color2` |
| 区域颜色 | `commonOption.areaColor.color1` |
| 区域高亮颜色 | `option.geo.itemStyle.emphasis.areaColor` |
| 区域边界颜色 | `option.geo.itemStyle.normal.borderColor` |
| 阴影大小 | `option.geo.itemStyle.normal.shadowBlur` |
| 阴影水平偏移 | `option.geo.itemStyle.normal.shadowOffsetX` |
| 阴影垂直偏移 | `option.geo.itemStyle.normal.shadowOffsetY` |
| 阴影颜色 | `option.geo.itemStyle.normal.shadowColor` |

## 视觉映射设置 (VisualMapOption)

| 说明 | 配置路径 | 可选值 |
|------|---------|--------|
| 开启视觉映射 | `option.visualMap.show` | |
| 类型 | `option.visualMap.type` | `continuous`, `piecewise` |
| 文本颜色 | `option.visualMap.textStyle.color` | |
| 文本粗细 | `option.visualMap.textStyle.fontWeight` | |
| 文本字体大小 | `option.visualMap.textStyle.fontSize` | |
| 最小值 | `option.visualMap.min` | |
| 最大值 | `option.visualMap.max` | |

## 地图散点设置 (ScatterOption)

| 说明 | 配置路径 |
|------|---------|
| 散点大小 | `option.area.markerSize` |
| 散点形状 | `option.area.markerShape` |
| 散点类型 | `option.area.markerType` |
| 散点颜色 | `option.area.markerColor` |
| 散点文本显示 | `option.area.scatterLabelShow` |
| 散点文本颜色 | `option.area.scatterLabelColor` |
| 散点文本位置 | `option.area.scatterLabelPosition` |
| 散点文本字体大小 | `option.area.scatterFontSize` |
| 散点数量 | `option.area.markerCount` |
| 散点透明度 | `option.area.markerOpacity` |

## 热力地图设置 (HeatOption)

| 说明 | 配置路径 |
|------|---------|
| 热力点大小 | `commonOption.heat.pointSize` |
| 模糊大小 | `commonOption.heat.blurSize` |
| 最大透明度 | `commonOption.heat.maxOpacity` |

## 柱体地图设置 (BarMapOption)

| 说明 | 配置路径 |
|------|---------|
| 柱体大小 | `commonOption.barSize` |
| 柱体左侧颜色 | `commonOption.barColor` |
| 柱体右侧颜色 | `commonOption.barColor2` |

## 飞线地图设置 (FlyLineOption)

| 说明 | 配置路径 |
|------|---------|
| 动画时间 | `commonOption.effect.period` |
| 标记形状 | `commonOption.effect.markerShape` |
| 标记大小 | `commonOption.effect.symbolSize` |
| 标记颜色 | `commonOption.effect.markerColor` |
| 尾迹长度 | `commonOption.effect.trailLength` |

---

## 组件数据格式 (chartData)

### 柱状图/折线图/混合图
JBar, JStackBar, JLine, JSmoothLine, JStepLine, JMultipleLine, JArea, JMixLineBar, DoubleLineBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JNegativeBar, JPercentBar
```json
[{"name": "一月", "value": 820, "type": "系列名"}]
```
双轴图额外字段：`"yAxisIndex": "0"` 或 `"1"`

### 饼图/环形图/玫瑰图
JPie, JRose, JRing, JRotatePie, JBreakRing, JActiveRing, JRadialBar, JFunnel, JPyramidFunnel
```json
[{"name": "类别", "value": 800}]
```

### 仪表盘
JGauge, JColorGauge, JAntvGauge
```json
[{"min": 0, "max": 100, "label": "完成率", "value": 76}]
```

### 半圆仪表盘
JSemiGauge
```json
[{"total": 800, "used": 500}]
```

### 水球图
JLiquid（值为 0-100，前端自动除以100）
```json
[{"value": 75}]
```

### 数字指标
JNumber（对象格式，不是数组）
```json
{"value": 128560}
```

### 翻牌器
JCountTo
```json
{"value": 1024}
```

### 文本
JText
```json
{"value": "显示的文字内容"}
```

### 排行榜
JScrollRankingBoard（直接数组，不要 JSON.stringify）
```json
[{"name": "北京", "value": 1200, "type": "城市"}, {"name": "上海", "value": 1050, "type": "城市"}]
```

### 轮播表（二维数组）
JScrollBoard — **chartData 是二维数组**（行 × 列），首行不是表头，表头由 `option.header` 配置：
```json
[
  ["行1列1", "行1列2", "行1列3"],
  ["行2列1", "行2列2", "行2列3"]
]
```
列名通过 `option.header: [{label:"列名", key:"", width:100}]` 配置，`key` 为空时按索引顺序取二维数组值。

### 个性排名
JFlashList（最多取前4条，按 value 降序排列）
```json
[{"name": "苹果", "value": 1000, "type": "手机品牌"}]
```

### 气泡排名
JBubbleRank — **字段为 title/desc，不是 name/value**：
```json
[{"title": "Java", "desc": "事项数：369"}, {"title": "Python", "desc": "事项数：258"}]
```

### 滚动列表
JScrollList — chartData 为业务对象数组，字段名与 `option.fieldMapping[].key` 对应：
```json
[{"plateNumber": "粤A12345", "violationCount": 3}, {"plateNumber": "粤B67890", "violationCount": 1}]
```

### 透视表
JPivotTable — chartData 是复杂对象，不是数组：
```json
{
  "x": [{"fieldId1": ["值A", "值B"]}, {"fieldId2": ["1", "2"]}],
  "data": [
    {"y": ["2022/09", "2022"], "t_id": "rowId1", "data": [111, null], "sum": 111, "summary_col": false}
  ]
}
```

### 滚动表格
JScrollTable（数组 + option.fieldMapping）
```json
[{"col1": "值1", "col2": "值2"}]
```
option 需配合 `fieldMapping: [{"name": "列名", "key": "col1", "width": "30%"}]`

### 数据表格
JTable, JCommonTable
```json
[
  {"fieldTxt": "姓名", "fieldName": "name", "type": "field", "isShow": "Y"},
  {"fieldTxt": "年龄", "fieldName": "age", "type": "field", "isShow": "Y"}
]
```

### 数据列表
JList
```json
[{"title": "标题", "date": "2026-03-18", "desc": "描述", "avatar": "url"}]
```

### 词云
JWordCloud, JImgWordCloud, JFlashCloud
```json
[{"name": "关键词", "value": 100}]
```

### 地图组件
JAreaMap, JBubbleMap, JFlyLineMap, JBarMap, JHeatMap
```json
[{"name": "城市名", "value": 199}]
```

### 按钮
JRadioButton, JCustomButton
```json
[{"title": "按钮文字", "value": 0, "href": "https://example.com"}]
```

### 轮播图
JCarousel
```json
[{"src": "https://example.com/1.png"}, {"src": "https://example.com/2.png"}]
```

### 进度条
JProgress
```json
[{"name": "任务A", "value": 80, "total": 100}]
```

### 胶囊图
JCapsuleChart
```json
[{"name": "类目", "value": 500}]
```

### 性别比例
JGender
```json
[{"man": 60, "woman": 40}]
```

### 统计卡片
JStatsSummary
```json
[{"title": "指标名", "value": 1234, "unit": "元", "compare": 12.5, "label": "同比", "state": "up"}]
```

---

## 组件与设置面板映射表

每个组件在设计器右侧面板显示的配置项列表（optionList），以下为完整映射：

### 柱状图系列
| 组件 | 设置面板 |
|------|---------|
| JBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, BarCylinder, CustomColorOption, OtherOption |
| JStackBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, BarCylinder, CustomColorOption |
| JDynamicBar | BasicOption, TitleOption, XAxisOption, YAxisOption, GridOption, BarCylinder |
| JHorizontalBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, BarCylinder, CustomColorOption |
| JBackgroundBar | BasicOption, TitleOption, XAxisOption, YAxisOption, GridOption, NumOption, BarCylinder |
| JMultipleBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, BarCylinder, CustomColorOption |
| JNegativeBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, CustomColorOption |
| JPercentBar | BasicOption, PercentBarStyle, CustomColorOption |
| JCapsuleChart | BasicOption, CapsuleChartOption, CustomColorOption |

### 折线/面积图系列
| 组件 | 设置面板 |
|------|---------|
| JLine | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, PolyglineOption, CustomColorOption, OtherOption |
| JSmoothLine | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, PolyglineOption |
| JStepLine | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption |
| JArea | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, PolyglineOption, CustomColorOption |
| JMultipleLine | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, PolyglineOption, CustomColorOption |

### 混合图系列
| 组件 | 设置面板 |
|------|---------|
| JMixLineBar | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, NumOption, BarCylinder, PolyglineOption, CustomColorOption |
| DoubleLineBar | BasicOption, TitleOption, XAxisOption, YLeftAxisOption, YRightAxisOption, LegendOption, GridOption, NumOption, BarCylinder, PolyglineOption, CustomColorOption |

### 饼图/环形图系列
| 组件 | 设置面板 |
|------|---------|
| JPie | BasicOption, TitleOption, LegendOption, gridPieOption, pieSettingOption, NumOption, CustomColorOption |
| JRose | BasicOption, TitleOption, LegendOption, gridPieOption, RoseOption, NumOption, CustomColorOption |
| JRotatePie | BasicOption, TitleOption, LegendOption, gridPieOption, CustomColorOption |
| JRing | BasicOption, TitleOption, LegendOption, gridPieOption, RingOption, NumOption, CustomColorOption |
| JBreakRing | BasicOption, BreakRingOption |
| JActiveRing | BasicOption, ActiveRingOption, CustomColorOption |
| JRadialBar | BasicOption, RadialBarOption, CustomColorOption |

### 仪表/进度系列
| 组件 | 设置面板 |
|------|---------|
| JGauge | BasicOption, GaugeOption, CustomColorOption |
| JColorGauge | BasicOption, GaugeOption, CustomColorOption |
| JAntvGauge | BasicOption, AntvGaugeOption, CustomColorOption |
| JSemiGauge | BasicOption, SemiGaugeOption |
| JProgress | BasicOption, ProgressOption, CustomColorOption |
| JCustomProgress | BasicOption, CustomProgressOption |
| JListProgress | BasicOption, ListProgressOption |
| JRoundProgress | BasicOption, RoundProgressOption |
| JRingProgress | BasicOption, ActiveRingPlotOption |
| JLiquid | BasicOption, LiquidPlotOption |

### 散点/气泡/漏斗系列
| 组件 | 设置面板 |
|------|---------|
| JScatter | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption |
| JBubble | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, CustomColorOption |
| JQuadrant | BasicOption, TitleOption, XAxisOption, YAxisOption, LegendOption, GridOption, CustomColorOption |
| JFunnel | BasicOption, TitleOption, LegendOption, NumOption, CustomColorOption |
| JPyramidFunnel | BasicOption, TitleOption, LegendOption, NumOption, CustomColorOption |
| JPyramid3D | BasicOption, Pyramid3DOption, CustomColorOption |
| JRadar | BasicOption, TitleOption, LegendOption, CustomColorOption |

### 文本/数字系列
| 组件 | 设置面板 |
|------|---------|
| JText | BasicOption, TextOption, ModalSettingsOption |
| JCountTo | BasicOption, CountToTextOption |
| JNumber | BasicOption, TextOption |
| JColorBlock | BasicOption, ColorBlockOption |
| JCurrentTime | BasicOption, TextOption |

### 表格/列表系列
| 组件 | 设置面板 |
|------|---------|
| JScrollBoard | BasicOption, ScrollBoardOpt |
| JScrollTable | BasicOption, ScrollTableStyle |
| JCommonTable | BasicOption, TableStyle |
| JTable | BasicOption, TableStyle |
| JList | BasicOption, ListStyle |
| JScrollList | BasicOption, ScrollListOption |
| JScrollRankingBoard | BasicOption, ScrollOption |
| JFlashList | BasicOption |
| JBubbleRank | BasicOption, BubbleRankingStyle |
| JDevHistory | BasicOption, DevHistoryOption |

### 地图系列
| 组件 | 设置面板 |
|------|---------|
| JAreaMap | BasicOption, MapOption, LineMapColorOption, VisualMapOptoin |
| JBubbleMap | BasicOption, MapOption, LineMapColorOption, ScatterOption, VisualMapOptoin |
| JFlyLineMap | BasicOption, MapOption, LineMapColorOption, FlyLineOption, ScatterOption |
| JBarMap | BasicOption, MapOption, LineMapColorOption, BarMapOption |
| JHeatMap | BasicOption, MapOption, LineMapColorOption, HeatOption |
| JTotalFlyLineMap | BasicOption, MapOption, LineMapColorOption, FlyLineOption, ScatterOption, TimeLineOption |
| JTotalBarMap | BasicOption, MapOption, LineMapColorOption, BarMapOption, TimeLineOption |

### 其他组件
| 组件 | 设置面板 |
|------|---------|
| JCommon | BasicOption（**用 `config.customOption` 写 JS 代码生成 option**；与 JCustomEchart 区分：JCustomEchart 用 chartData=JSON option，JCommon 用 customOption=JS 字符串） |
| JCustomEchart | BasicOption（chartData = 完整 ECharts option JSON；详见末尾"补充"节） |
| JWordCloud | BasicOption, WordCloudOption, CustomColorOption |
| JImgWordCloud | BasicOption, WordCloudOption |
| JFlashCloud | BasicOption, FlashCloudOption |
| JRadioButton | BasicOption, RadioButtonStyle, CustomColorOption |
| JSelectRadio | BasicOption, TabSelectOption |
| JPictorialBar | BasicOption, TitleOption, YAxisOption, XAxisOption, GridOption, PictorialOption, OtherOption |
| JPictorial | BasicOption, TitleOption, XAxisOption, YAxisOption, GridOption, PictorialIconOption, OtherOption |
| JGender | BasicOption, LegendOption |
| JStatsSummary | BasicOption, StatsSummaryOption |
| JCarousel | BasicOption, CarouselOption |
| JVideoPlay | BasicOption, VideoPlayOption |
| JIframe | BasicOption, IframeOption |
| JRectangle | BasicOption, RectangleOption |
| JImg | BasicOption, ImageOption |
| JCustomIcon | BasicOption, customIconOption |
| JWeatherForecast | BasicOption, WeatherOption |
| JDragBorder | BasicOption, BorderDecorationStyle |
| JDragDecoration | BasicOption, BorderDecorationStyle |
| JRoundProgress | BasicOption, RoundProgressOption |

---

## 补充：原本未文档化的 11 个组件

> 以下从源码补提取，每条都标注了源码位置便于核对。

### JCustomEchart 自定义 ECharts
- **实现**: `packages/components/echarts/CustomEchart/customEchart.vue`
- **关键字段**:
  - `config.chartData`: **完整 ECharts option JSON**（不是普通 `[{name,value}]`），组件直接拿来渲染
  - `config.option`: 与 chartData deepMerge，可覆盖任意字段
- **限制**:
  - 写 API 数据时不能把 chartData 当普通数据数组传——它就是 option 本体
  - LinearGradient 需用 `{"__type":"LinearGradient","__raw":"..."}` 序列化
  - 在 `noJsConfig` 列表，不支持 JS 增强配置

### JTotalProgress 统计进度图
- **实现**: `packages/components/echarts/totalProgress/progress.vue`
- **关键字段**:
  - `option.targetValue`: `{[fieldName]: number}` 目标值映射，**key 必须等于 `valueFields[0].fieldName`**
  - `option.compStyleConfig.showProgressText` / `progress.{show,name}` / `target.{show,name}`: 进度/目标标签
  - `valueFields[0].fieldTxt`: 进度条标题（取首项 fieldTxt）
- **chartData**: `[{value: 50}, ...]`，每条渲染一个进度条；进度 = value / targetValue[fieldName]
- **限制**:
  - `targetValue` key 不匹配 fieldName 时进度恒为 0
  - value 为 NaN/null 自动归零
  - `noLinkageComp`：不支持联动

### JPivotTable 透视表
- **实现**: `packages/components/pivotTable/Table.vue` + `useTableBiz.ts:126-133`
- **关键字段**:
  - `config.nameFields`: 行维度数组（首项为分组轴）
  - `config.typeFields`: 列维度数组（决定表头层数，每层 48px）
  - `config.compStyleConfig.izPage` / `columnFreeze`: 分页 / 固定列
- **chartData**: 二维 JSON 数组，字段名对应 nameFields/typeFields/valueFields
- **限制**:
  - **必须 `dataType=4`**——dataType=1 静态数据时 dataSource 直接置空，不渲染
  - `noLinkageComp`：不支持联动
  - 滚动高度 = 总高 - 24 - 40 - typeFields.length × 48 - 卡片头高，列层数多时正文很小

### JRankingList 排行榜（自定义）
- **实现**: `packages/components/rankingList/RankingList.vue`
- **关键字段**:
  - `option.compStyleConfig.summary`: `{showTotal, showName, totalType:'sum'|'max'|'min'|'average'}` 顶部总计行
  - `option.compStyleConfig.showUnit`: `{numberLevel, decimal, position:'prefix'|'suffix', unit}` 数值单位
  - `config.dataFilterNum`: 截取前 N 条
- **chartData**: `[{name:'Java', value:369}, ...]`，**渲染前自动按 value 降序**；前 3 名显示金/银/铜奖杯 SVG，第 4 名起显示数字
- **限制**:
  - value 必须是数值（字符串会按字符串排序）
  - 在 `noProperties`、`noEventComp`、`noScreenEventComp` 列表：属性面板无配置项、不支持点击/大屏事件

### JCardCarousel 卡片轮播
- **实现**: `packages/components/cardCarousel/CardCarousel.vue`
- **关键字段**:
  - `option.titleFieldMapping`: `{key, show, position:'top'|'bottom'|'left'|'right', direction, offset:{x,y}, textStyle}`
  - `option.contentFieldMapping`: `[{key, name, nameStyle, valueStyle, nameCompose:{enabled,prefix,suffix,...}, valueCompose:{...}}]`
  - `option.autoScrollEnabled` / `autoScrollDirection:'to-left'|'to-right'` / `autoScrollSpeed`（px/s，默认 100）
  - `option.cardStyle`: `{backgroundColor, minWidth, borderRadius, padding*, margin*, backgroundImage, borderEnabled, borderWidth, borderStyle, borderColor}`
  - `option.contentLineHeight` / `contentLineAlign:'space-between'|'start'|'center'`
- **chartData**: `[{title:'销售汇总', orderNum:1247, orderAmount:28475000}, ...]`
- **限制**:
  - 自动滚动**仅当内容总宽 > 容器宽**时生效
  - `nameCompose`/`valueCompose` 的 `enabled:false` 时 prefix/suffix 配置完全忽略

### JCircleRadar 圆形雷达图
- **实现**: `packages/components/echarts/CircleRadar/radar.vue`
- **关键字段**:
  - `option.radar[0].indicator`: 雷达轴定义（**由 chartData 的 `name` 字段自动生成**）
  - `option.grid:{left, top}`: 控制雷达中心坐标，`center=[left%, top%]`
  - `option.customColor`: 各系列颜色数组
- **chartData**: `[{name:'得分', value:75, type:'NBA', max:100}]`；name=轴标签，type=系列名（同 type 一条线），value=该轴值
- **限制**:
  - **`max` 字段在 chartData 中无效**——构建 indicator 时只读 name；如要设 max 必须在 `option.radar[0].indicator` 里手动写
  - type 为空时图表不渲染
  - `dataFilterNum` 限制雷达轴数量（slice 前 N 条）

### JBar3d 3D 柱形图（实为 ECharts pictorialBar 模拟）
- **实现**: `packages/components/echarts3d/Bar3d/bar3d.vue`
- **关键字段**:
  - `option.graphic.children[0].style.fill`: 底座地面色（默认 `#3f4867`），同时应用到 children[0/1]
  - `option.extraInfo`: `{enabledGradient, direction:'to bottom'|'to top', startColor, endColor}`
  - `option.series[id='barColor'].color`: 柱体主色；`barTopColor` / `barBottomColor` 控制顶/底面
- **chartData**: `[{name:'苹果', value:1000}, ...]`；阴影柱高自动 = max × 1.2
- **限制**:
  - **目录名带 echarts3d 但实际是 ECharts pictorialBar 模拟，不是 Three.js**
  - `option.graphic.children` 必须至少 1 项且含 `style.fill`，否则地面色不生效
  - `option.series` 用 id 匹配：`barTopColor` / `barBottomColor` / `barColor` / `shadowColor` / `shadowTopColor`

### JBarGroup3d 3D 分组柱形图（同 JBar3d，分组版）
- **实现**: `packages/components/echarts3d/BarGroup3d/BarGroup3d.vue`
- **关键字段**:
  - `option.seriesCustom`: `{barTopColor:[], barBottomColor:[], barColor:[], shadowColor:[], shadowTopColor:[]}` 各分组颜色（**10 色循环**）
  - `option.graphic.children[0].style.fill`: 底座色
- **chartData**: `[{name:'1991销量', value:13000, type:'小米'}, ...]`；**必须含 `type` 字段**作为分组维；同 name 下不同 type 并排
- **限制**:
  - 无 `type` 字段时 series 为空，不渲染
  - 同 JBar3d，本质是 pictorialBar 不是 Three.js
  - 分组数 > 10 时颜色循环复用

### JDragEditor 富文本（TinyMCE）
- **实现**: `packages/components/editor/JDragEditor.vue`
- **关键字段**: 无特有 option；内容存 `config.chartData`，支持 3 种格式：字符串 / `{value:html}` / `[{value:html}]`（取 [0]）
- **限制**:
  - 编辑器修改直接写回 `config.chartData`，依赖整体页面保存
  - 在 `noProperties`、`noEventComp`、`noRefreshComp` 列表：无属性面板、无事件、不自动刷新
  - 高度 = `size.height - 20px`，组件本身 25px 上边距，小尺寸时编辑区被压缩

### JForm 查询表单（联动驱动器）
- **实现**: `packages/components/form/Form.vue`
- **关键字段**:
  - `option.fields`: `[{fieldName, fieldTxt, widgetType:'input'|'select'|'date', dictCode, searchMode:'single'|'range'|'multi', dateFormat, defaultValue, izSearch}]`
  - `option.showSubmitBtn` / `showResetBtn` / `mode:'dark'|null`
  - `config.showBtn`: false 时实时联动（无需点击查询）
  - `config.linkageConfig`: `[{linkageId, linkage:[{source, target}]}]`
- **chartData**: 无（表单不显示图表，数据通过联动推送给其他组件）
- **限制**:
  - `noStaticData`：不支持静态数据，必须走联动或数据集
  - `showBtn=false` 时 watch 是 `{deep:true, immediate:true}`，**挂载即触发一次联动**；后续 model 变化触发 debounce 查询
  - 日期 defaultValue 支持 `=dateStr(format, offset)` 动态表达式；range 模式用 `|` 分隔两端

### JVideoJs RTMP 播放器（Video.js）
- **实现**: `packages/components/video/js/videoJs.vue`
- **关键字段**: `option.url`：mp4 / webm / ogg / flv / m3u8；RTMP/RTSP **会自动转换为 HTTP-FLV** 尝试播放
- **chartData**: 无，所有配置在 option 中；默认 `{url: "http://vjs.zencdn.net/v/oceans.mp4"}`
- **限制**:
  - **RTMP/RTSP 浏览器原生不支持**；自动转换为 `http://host/path.flv` 后能否播放取决于服务端是否部署流媒体转发
  - HLS.js 支持代码已注释，**m3u8 当前仅 Safari 原生支持**
  - `noEventComp`/`noScreenEventComp`：不支持点击联动
  - 设计器预览有黑色半透明蒙层（z-index:33）覆盖视频，防误操作

---

## 顺手发现的隐藏限制（未在专章节说明，作为补遗）

- **JBarGroup3d**: 颜色数组超 10 个时按取模循环；`option.seriesCustom` 可整体覆盖颜色（`BarGroup3d.vue:132`）
- **JCircleRadar**: chartData 中 `max` 字段被忽略，构建 indicator 时只读 name（`radar.vue:78`）
- **JPivotTable**: `dataType=1` 完全无效，dataSource 强制置空（`useTableBiz.ts:126-133`）
- **JForm**: `showBtn=false` 时挂载立即触发一次联动查询（`Form.vue:240`）
- **JVideoJs**: 设计器中蒙层 z-index:33 防误操作（`videoJs.vue:3-4`）

---

## ECharts 与非 ECharts 组件区分

**ECharts 组件**（底层用 ECharts 渲染，option 遵循 ECharts 规范 + 扩展属性）：
JBar, JStackBar, JDynamicBar, JHorizontalBar, JBackgroundBar, JMultipleBar, JNegativeBar,
JLine, JSmoothLine, JStepLine, JMultipleLine, JArea,
JMixLineBar, DoubleLineBar,
JPie, JRose, JRotatePie, JRing,
JScatter, JBubble, JQuadrant,
JFunnel, JPyramidFunnel,
JRadar, JCircleRadar,
JGauge, JColorGauge,
JProgress, JPictorialBar,
JBar3d, JBarGroup3d,
JWordCloud,
JAreaMap, JBubbleMap, JFlyLineMap, JBarMap, JHeatMap, JTotalFlyLineMap, JTotalBarMap,
JCustomEchart

**非 ECharts 组件**（自定义渲染，option 使用组件私有属性）：
JNumber, JCountTo, JText, JColorBlock, JCurrentTime,
JLiquid, JAntvGauge, JSemiGauge, JCustomProgress, JListProgress, JRoundProgress, JRingProgress,
JActiveRing, JRadialBar, JBreakRing,
JCapsuleChart, JPercentBar,
JScrollBoard, JScrollTable, JCommonTable, JTable, JList, JScrollList, JScrollRankingBoard, JFlashList, JBubbleRank,
JCarousel, JVideoPlay, JImg, JIframe,
JRadioButton, JSelectRadio, JTabToggle, JForm,
JDragBorder, JDragDecoration, JDragEditor,
JPyramid3D, JGender, JStatsSummary,
JFlashCloud, JImgWordCloud, JOrbitRing, JRectangle, JDevHistory
