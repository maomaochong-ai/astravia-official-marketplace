# JListProgress（列表进度图）配置路径

> 来源：`ListProgressOption.vue`（配置面板）+ `ListProgress.vue`（渲染逻辑）

## 行配置（option.row）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 行高 | `option.row.height` | `48` |
| 左边距 | `option.row.marginLeft` | `0` |
| 上边距 | `option.row.marginTop` | `8` |
| 右边距 | `option.row.marginRight` | `0` |

## 进度条配置（option.bar）

### 背景轨道

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 轨道背景色 | `option.bar.background.color` | `#1890ff33` |
| 轨道渐变启用 | `option.bar.background.gradient.enabled` | `false` |
| 轨道渐变类型 | `option.bar.background.gradient.type` | `linear` / `radial` |
| 轨道渐变方向 | `option.bar.background.gradient.direction` | `to right` |
| 轨道渐变起始色 | `option.bar.background.gradient.startColor` | `#000000` |
| 轨道渐变结束色 | `option.bar.background.gradient.endColor` | `#FFFFFF` |

### 填充色

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 填充色 | `option.bar.fill.color` | `#1890ff` |
| 填充渐变启用 | `option.bar.fill.gradient.enabled` | `false` |
| 填充渐变类型 | `option.bar.fill.gradient.type` | `linear` / `radial` |
| 填充渐变方向 | `option.bar.fill.gradient.direction` | `to right` |
| 填充渐变起始色 | `option.bar.fill.gradient.startColor` | `#000000` |
| 填充渐变结束色 | `option.bar.fill.gradient.endColor` | `#FFFFFF` |

### 进度条尺寸与外观

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 进度条高度 | `option.bar.height` | `8` |
| 圆角 | `option.bar.borderRadius` | `4` |
| 指示点大小 | `option.bar.indicatorSize` | `0` |
| 指示点颜色 | `option.bar.indicatorColor` | `#1890ff` |

### 进度条边框

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 启用边框 | `option.bar.border.enabled` | `false` |
| 边框颜色 | `option.bar.border.color` | `#1890ff` |
| 边框宽度 | `option.bar.border.width` | `1` |
| 边框内边距 | `option.bar.border.padding` | `2` |

### 超出100%样式（option.bar.exceed）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 启用超出样式 | `option.bar.exceed.enabled` | `false` |
| 触发百分比 | `option.bar.exceed.percent` | `100` |
| 超出填充色 | `option.bar.exceed.fill.color` | `#ff4d4f` |
| 超出渐变启用 | `option.bar.exceed.fill.gradient.enabled` | `false` |
| 超出指示点颜色 | `option.bar.exceed.indicatorColor` | `#ff4d4f` |

### 数据字段

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 数值字段 | `option.bar.valueField` | `value` |
| 总量类型 | `option.bar.total.type` | `field`（取数据中字段）/ `val`（固定值） |
| 总量字段名 | `option.bar.total.field` | `total` |
| 总量固定值 | `option.bar.total.val` | `100` |

## 左侧区域（option.beginInfo / option.beginFields）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 左侧区域宽度 | `option.beginInfo.width` | `80` |
| 左侧字段排列 | `option.beginInfo.layout` | `row` / `column` |
| 左侧字段列表 | `option.beginFields` | 字段对象数组，见下方「字段对象结构」 |

## 中间区域（option.progressSection / option.centerTopFields / option.centerTopInfo）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 中间左边距 | `option.progressSection.marginLeft` | `8` |
| 中间右边距 | `option.progressSection.marginRight` | `8` |
| 进度条上方字段排列 | `option.centerTopInfo.layout` | `row` / `column` |
| 进度条上方字段列表 | `option.centerTopFields` | 字段对象数组 |

## 右侧区域（option.endInfo / option.endFields）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 右侧区域宽度 | `option.endInfo.width` | `60` |
| 右侧字段排列 | `option.endInfo.layout` | `row` / `column` |
| 右侧字段列表 | `option.endFields` | 字段对象数组 |

## 字段对象结构（beginFields / centerTopFields / endFields 数组项）

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 字段名（数据键） | `field.key` | `name` |
| 显示名 | `field.name` | `名称` |
| 水平对齐 | `field.textAlign` | `left` / `center` / `right` |
| 字号 | `field.style.fontSize` | `14` |
| 颜色 | `field.style.fontColor` | `#ffffff` |
| 字重 | `field.style.fontWeight` | `normal` |
| 字体风格 | `field.style.fontStyle` | `normal` |
| 字间距 | `field.style.letterSpacing` | `0` |
| 字体族 | `field.style.fontFamily` | `""` |
| 渐变启用 | `field.style.fontGradient.enabled` | `false` |

## 滚动配置（option.scroll）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 启用滚动 | `option.scroll.enabled` | `false` |
| 滚动方向 | `option.scroll.direction` | `up` / `down` |
| 停留时间（ms） | `option.scroll.interval` | `2000` |
| 每次滚动行数 | `option.scroll.count` | `1` |
| 动画时长（ms） | `option.scroll.duration` | `500` |

## chartData 格式

```python
chart_data = [
    {"name": "项目A", "value": 85,  "total": 100},
    {"name": "项目B", "value": 120, "total": 100},  # 超出100%时触发 exceed 样式
    {"name": "项目C", "value": 62,  "total": 100},
    {"name": "项目D", "value": 43,  "total": 100},
]
# total.type='field' 时，数据中的 total 字段为分母；total.type='val' 时，使用 option.bar.total.val
```
