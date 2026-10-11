# JSemiGauge（半圆仪表盘）配置路径

> 来源：`SemiGaugeOption.vue`（配置面板）+ `SemiGauge.vue`（渲染逻辑）

## 基础角度配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 起始角度（度） | `option.customAttr.basic.startAngle` | `225` |
| 结束角度（度） | `option.customAttr.basic.endAngle` | `-45` |

## 指针配置（option.customAttr.innerProgress.pointer）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示指针 | `option.customAttr.innerProgress.pointer.show` | `true` |
| 指针颜色 | `option.customAttr.innerProgress.pointer.itemStyle.color` | `#1890ff` |
| 指针长度比例 | `option.customAttr.innerProgress.pointer.length` | `"60%"` |
| 指针宽度 | `option.customAttr.innerProgress.pointer.width` | `6` |

## 数值显示（detail）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示数值 | `option.customAttr.innerProgress.detail.show` | `true` |
| 数值字号 | `option.customAttr.innerProgress.detail.textStyle.fontSize` | `24` |
| 数值颜色 | `option.customAttr.innerProgress.detail.textStyle.color` | `#1890ff` |
| 数值字重 | `option.customAttr.innerProgress.detail.textStyle.fontWeight` | `bold` |
| 数值字体 | `option.customAttr.innerProgress.detail.textStyle.fontFamily` | `""` |
| 数值字段映射 | `option.valueMapping` | `value` |
| 数值前缀 | `option.valuePrefix` | `""` |
| 数值后缀 | `option.valueSuffix` | `""` |
| 水平偏移 | `option.customAttr.innerProgress.detail.offsetCenter[0]` | `"0%"` |
| 垂直偏移 | `option.customAttr.innerProgress.detail.offsetCenter[1]` | `"20%"` |

## 标题显示（title）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示标题 | `option.customAttr.innerProgress.title.show` | `true` |
| 标题字号 | `option.customAttr.innerProgress.title.textStyle.fontSize` | `14` |
| 标题颜色 | `option.customAttr.innerProgress.title.textStyle.color` | `#cccccc` |
| 标题字重 | `option.customAttr.innerProgress.title.textStyle.fontWeight` | `normal` |
| 标题字体 | `option.customAttr.innerProgress.title.textStyle.fontFamily` | `""` |
| 标题字段映射 | `option.titleMapping` | `name` |
| 标题前缀 | `option.titlePrefix` | `""` |
| 标题后缀 | `option.titleSuffix` | `""` |
| 水平偏移 | `option.customAttr.innerProgress.title.offsetCenter[0]` | `"0%"` |
| 垂直偏移 | `option.customAttr.innerProgress.title.offsetCenter[1]` | `"50%"` |

## 外刻度（outerScale）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 外刻度半径 | `option.customAttr.outerScale.radius` | `"90%"` |
| 刻度分段数 | `option.customAttr.outerScale.splitNumber` | `5` |
| 显示刻度标签 | `option.customAttr.outerScale.axisLabel.show` | `true` |
| 刻度标签颜色 | `option.customAttr.outerScale.axisLabel.color` | `#cccccc` |
| 刻度标签字号 | `option.customAttr.outerScale.axisLabel.fontSize` | `12` |
| 刻度标签距离 | `option.customAttr.outerScale.axisLabel.distance` | `-30` |

## 外进度环（outerProgress）

| 说明 | 配置路径 | 格式说明 |
|------|---------|--------|
| 外进度环半径 | `option.customAttr.outerProgress.radius` | `"85%"` |
| 外进度环颜色 | `option.customAttr.outerProgress.axisLine.lineStyle.color` | 颜色数组，见下方说明 |
| 外进度环宽度 | `option.customAttr.outerProgress.axisLine.lineStyle.width` | `8` |

## 内圆（innerCircle）

| 说明 | 配置路径 | 格式说明 |
|------|---------|--------|
| 内圆半径 | `option.customAttr.innerCircle.radius` | `"70%"` |
| 内圆颜色 | `option.customAttr.innerCircle.axisLine.lineStyle.color` | 颜色数组，见下方说明 |
| 内圆轨道宽度 | `option.customAttr.innerCircle.axisLine.lineStyle.width` | `2` |

## 内阴影（innerShadow）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 内阴影半径 | `option.customAttr.innerShadow.radius` | `"65%"` |
| 启用自定义渐变 | `option.customAttr.innerShadow.customGradient.enabled` | `false` |
| 渐变起始色 | `option.customAttr.innerShadow.customGradient.startColor` | `#1890ff` |
| 渐变结束色 | `option.customAttr.innerShadow.customGradient.endColor` | `#001f4d` |
| 阴影轨道宽度 | `option.customAttr.innerShadow.axisLine.lineStyle.width` | `30` |

## 内进度环（innerProgress）

| 说明 | 配置路径 | 格式说明 |
|------|---------|--------|
| 内进度环半径 | `option.customAttr.innerProgress.radius` | `"75%"` |
| 内进度环颜色 | `option.customAttr.innerProgress.axisLine.lineStyle.color` | 颜色数组，见下方说明 |
| 内进度环宽度 | `option.customAttr.innerProgress.axisLine.lineStyle.width` | `12` |

## 颜色数组格式说明

`outerProgress`、`innerCircle`、`innerProgress` 的颜色均使用 ECharts 颜色分段格式：

```python
# [[比例阈值, 颜色], [1, 末尾颜色]]
# 双色示例（0~0.5 蓝色，0.5~1 青色）
color = [[0.5, "#1890ff"], [1, "#00e5ff"]]

# 单色示例（整段同色）
color = [[1, "#1890ff"]]

# 轨道背景色示例（深色透明）
color = [[1, "#1890ff22"]]
```

## chartData 格式

```python
# 单条数据（name=标题，value=当前值，max=最大值）
chart_data = [{"name": "完成率", "value": 75, "max": 100}]

# 多条数据时仪表盘取第一条
chart_data = [{"name": "CPU使用率", "value": 62.5, "max": 100}]
```
