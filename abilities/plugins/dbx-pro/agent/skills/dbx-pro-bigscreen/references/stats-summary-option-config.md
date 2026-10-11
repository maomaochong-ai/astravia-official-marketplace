# JStatsSummary（统计概览）配置路径

> 来源：`StatsSummaryOption.vue` + `StatsSummarySectionOption.vue`（配置面板）
>
> 三个变体：`JStatsSummary_1`（卡片）、`JStatsSummary_2`（背景）、`JStatsSummary_3`（高亮）
> 三者共用同一组件类型 `JStatsSummary`，差异仅在 option 内容。

## 布局配置（option.layout）

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 背景类型 | `option.layout.fill.type` | `color` / `image` |
| 背景色 | `option.layout.fill.color` | `#00000000` |
| 渐变启用 | `option.layout.fill.gradient.enabled` | `false` |
| 渐变类型 | `option.layout.fill.gradient.type` | `linear` / `radial` |
| 渐变方向 | `option.layout.fill.gradient.direction` | `to right` |
| 渐变起始色 | `option.layout.fill.gradient.startColor` | `#000000` |
| 渐变结束色 | `option.layout.fill.gradient.endColor` | `#FFFFFF` |
| 背景图 URL | `option.layout.fill.image.url` | `""` |
| 背景图重复 | `option.layout.fill.image.repeat` | `no-repeat` |
| 背景图位置 | `option.layout.fill.image.position` | `center` |
| 背景图大小 | `option.layout.fill.image.size` | `cover` |
| 圆角 | `option.layout.borderRadius` | `0` |
| 边框宽度 | `option.layout.borderWidth` | `0` |
| 边框颜色 | `option.layout.borderColor` | `#1890ff` |
| 阴影 | `option.layout.shadow` | `false` |
| 卡片排列方向 | `option.layout.justify` | `flex-start` / `center` / `flex-end` / `space-between` / `space-around` / `space-evenly` |
| 卡片间距 | `option.layout.gap` | `12` |
| 上内边距 | `option.layout.padding.top` | `0` |
| 下内边距 | `option.layout.padding.bottom` | `0` |
| 左内边距 | `option.layout.padding.left` | `0` |
| 右内边距 | `option.layout.padding.right` | `0` |

## 数据字段映射（option.fieldMap）

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 标签字段 | `option.fieldMap.label` | `name` |
| 数值字段 | `option.fieldMap.value` | `value` |
| 单位字段 | `option.fieldMap.unit` | `unit` |
| 对比值字段 | `option.fieldMap.compareValue` | `compare` |
| 对比标签字段 | `option.fieldMap.compareLabel` | `compareLabel` |
| 对比状态字段 | `option.fieldMap.compareState` | `state` |
| 正向值文字 | `option.fieldMap.positiveValue` | `↑` |
| 负向值文字 | `option.fieldMap.negativeValue` | `↓` |

## 卡片样式（option.card）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 最小宽度 | `option.card.minWidth` | `120` |
| 背景类型 | `option.card.fill.type` | `color` / `image` |
| 背景色 | `option.card.fill.color` | `#1890ff1a` |
| 渐变启用 | `option.card.fill.gradient.enabled` | `false` |
| 渐变方向 | `option.card.fill.gradient.direction` | `to right` |
| 渐变起始色 | `option.card.fill.gradient.startColor` | `#000000` |
| 渐变结束色 | `option.card.fill.gradient.endColor` | `#FFFFFF` |
| 背景图 URL | `option.card.fill.image.url` | `""` |
| 背景图重复 | `option.card.fill.image.repeat` | `no-repeat` |
| 背景图位置 | `option.card.fill.image.position` | `center` |
| 背景图大小 | `option.card.fill.image.size` | `cover` |
| 圆角 | `option.card.borderRadius` | `8` |
| 边框宽度 | `option.card.borderWidth` | `1` |
| 边框颜色 | `option.card.borderColor` | `#1890ff` |
| 垂直内边距 | `option.card.padding.vertical` | `12` |
| 水平内边距 | `option.card.padding.horizontal` | `16` |
| 垂直外边距 | `option.card.margin.vertical` | `0` |
| 垂直边距 | `option.card.padding.horizontal` | `16` |
| 阴影 | `option.card.shadow` | `false` |
| 模糊半径 | `option.card.blur` | `4` |

## 分区配置（option.sections）

每张卡片分为 `top`、`middle`、`bottom` 三个分区，配置路径格式为 `option.sections.{key}.*`（`{key}` = `top` / `middle` / `bottom`）。

### 分区基础

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 分区类型 | `option.sections.{key}.type` | `value`（数值）/ `compare`（对比）/ `label`（标签） |
| 水平对齐 | `option.sections.{key}.align` | `flex-start` / `center` / `flex-end` |
| 垂直对齐 | `option.sections.{key}.alignItems` | `flex-start` / `center` / `flex-end` |
| 上内边距 | `option.sections.{key}.paddingTop` | `4` |
| 下内边距 | `option.sections.{key}.paddingBottom` | `4` |
| 最小高度 | `option.sections.{key}.minHeight` | `0` |

### type=value 时（数值样式）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.sections.{key}.value.fontSize` | `24` |
| 颜色 | `option.sections.{key}.value.fontColor` | `#1890ff` |
| 字重 | `option.sections.{key}.value.fontWeight` | `bold` |
| 字体风格 | `option.sections.{key}.value.fontStyle` | `normal` |
| 字间距 | `option.sections.{key}.value.letterSpacing` | `0` |
| 字体族 | `option.sections.{key}.value.fontFamily` | `""` |
| 渐变启用 | `option.sections.{key}.value.fontGradient.enabled` | `false` |
| 渐变类型 | `option.sections.{key}.value.fontGradient.type` | `linear` / `radial` |
| 渐变方向 | `option.sections.{key}.value.fontGradient.direction` | `to right` |
| 渐变起始色 | `option.sections.{key}.value.fontGradient.startColor` | `#000000` |
| 渐变结束色 | `option.sections.{key}.value.fontGradient.endColor` | `#FFFFFF` |
| 单位字号 | `option.sections.{key}.value.unit.fontSize` | `14` |
| 单位颜色 | `option.sections.{key}.value.unit.fontColor` | `#1890ff` |
| 单位字重 | `option.sections.{key}.value.unit.fontWeight` | `normal` |
| 单位字体风格 | `option.sections.{key}.value.unit.fontStyle` | `normal` |
| 单位字间距 | `option.sections.{key}.value.unit.letterSpacing` | `0` |
| 单位字体族 | `option.sections.{key}.value.unit.fontFamily` | `""` |
| 单位间距 | `option.sections.{key}.value.unitGap` | `4` |

### type=compare 时（对比样式）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 标签字号 | `option.sections.{key}.compare.labelStyle.fontSize` | `12` |
| 标签颜色 | `option.sections.{key}.compare.labelStyle.fontColor` | `#cccccc` |
| 标签字重 | `option.sections.{key}.compare.labelStyle.fontWeight` | `normal` |
| 正向颜色 | `option.sections.{key}.compare.valueStyle.positiveColor` | `#52c41a` |
| 负向颜色 | `option.sections.{key}.compare.valueStyle.negativeColor` | `#ff4d4f` |
| 正向渐变启用 | `option.sections.{key}.compare.valueStyle.positiveGradient.enabled` | `false` |
| 负向渐变启用 | `option.sections.{key}.compare.valueStyle.negativeGradient.enabled` | `false` |

### type=label 时（标签样式）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.sections.{key}.label.fontSize` | `14` |
| 颜色 | `option.sections.{key}.label.fontColor` | `#cccccc` |
| 字重 | `option.sections.{key}.label.fontWeight` | `normal` |
| 字体风格 | `option.sections.{key}.label.fontStyle` | `normal` |
| 字间距 | `option.sections.{key}.label.letterSpacing` | `0` |
| 字体族 | `option.sections.{key}.label.fontFamily` | `""` |
| 渐变启用 | `option.sections.{key}.label.fontGradient.enabled` | `false` |

## 高亮配置（option.highlight）

适用于 `JStatsSummary_3`（高亮变体），`option.highlight` 是数组，每项对应一张高亮卡片。

| 说明 | 配置路径 | 说明 |
|------|---------|------|
| 卡片索引 | `option.highlight[i].index` | 从 0 开始，对应第 i+1 张卡片 |
| 高亮数值样式 | `option.highlight[i].value.*` | 同 sections value 样式字段 |
| 高亮标签样式 | `option.highlight[i].label.*` | 同 sections label 样式字段 |

## chartData 格式

```python
chart_data = [
    {"name": "总销售额", "value": 128000, "unit": "万元", "compare": "+12.5%", "state": 1},
    {"name": "订单数量", "value": 3842,   "unit": "笔",   "compare": "-2.3%",  "state": -1},
    {"name": "客户数",   "value": 1256,   "unit": "人",   "compare": "+5.8%",  "state": 1},
    {"name": "退单率",   "value": 1.2,    "unit": "%",    "compare": "-0.3%",  "state": 1},
]
# state: 1=正向（绿色），-1=负向（红色）
```
