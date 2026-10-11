# JPermanentCalendar（日历）配置路径

> 来源：`PermanentCalendarOption.vue`（配置面板）+ `PermanentCalendar.vue`（渲染逻辑）

## 容器样式

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 背景色（纯色） | `option.container.background.color` | `#00000000` |
| 渐变启用 | `option.container.background.gradient.enabled` | `true` |
| 渐变类型 | `option.container.background.gradient.type` | `linear` |
| 渐变方向 | `option.container.background.gradient.direction` | `to bottom` |
| 渐变起始色 | `option.container.background.gradient.startColor` | `#0B2B58` |
| 渐变结束色 | `option.container.background.gradient.endColor` | `#0A1E3A` |
| 上内边距 | `option.container.padding.top` | `8` |
| 右内边距 | `option.container.padding.right` | `10` |
| 左内边距 | `option.container.padding.left` | `10` |
| 显示边框 | `option.container.border.enabled` | `true` |
| 边框大小 | `option.container.border.width` | `1` |
| 边框颜色 | `option.container.border.color` | `#2B6CB0` |
| 边框样式 | `option.container.border.style` | `solid` / `dashed` / `dotted` |

## 月份配置

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 显示月份 | `option.month.show` | `true` |
| 位置 | `option.month.position` | `left` / `right` / `center` |
| 上偏移 | `option.month.offsetTop` | `-15` |
| 左偏移 | `option.month.offsetLeft` | `0` |
| 显示英文月份 | `option.month.showEn` | `true` |
| 中文字号 | `option.month.cn.fontSize` | `70` |
| 中文字重 | `option.month.cn.fontWeight` | `bold` |
| 中文字体风格 | `option.month.cn.fontStyle` | `italic` |
| 中文字间距 | `option.month.cn.letterSpacing` | `0` |
| 中文字体 | `option.month.cn.fontFamily` | `""` |
| 中文透明度 | `option.month.cn.opacity` | `0.08` |
| 中文颜色 | `option.month.cn.color.value` | `#FFFFFF` |
| 中文渐变启用 | `option.month.cn.color.gradient.enabled` | `false` |
| 英文字号 | `option.month.en.fontSize` | `28` |
| 英文颜色 | `option.month.en.color.value` | `#7EC8E3` |
| 英文透明度 | `option.month.en.opacity` | `1` |
| 英文渐变启用 | `option.month.en.color.gradient.enabled` | `false` |

## 周配置

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 周起始 | `option.week.start` | `sun`（周日）/ `mon`（周一） |
| 周行高 | `option.week.height` | `24` |
| 周下边距 | `option.week.marginBottom` | `18` |
| 显示英文 | `option.week.showEn` | `false` |
| 前缀（showEn=false 时） | `option.week.prefix` | `周` / `星期` |
| 字号 | `option.week.fontSize` | `20` |
| 字重 | `option.week.fontWeight` | `bold` |
| 字体风格 | `option.week.fontStyle` | `normal` |
| 字间距 | `option.week.letterSpacing` | `0` |
| 字体 | `option.week.fontFamily` | `""` |
| 颜色 | `option.week.color.value` | `#FFFFFF` |
| 渐变启用 | `option.week.color.gradient.enabled` | `true` |
| 渐变方向 | `option.week.color.gradient.direction` | `to bottom` |
| 渐变起始色 | `option.week.color.gradient.startColor` | `#FFFFFF` |
| 渐变结束色 | `option.week.color.gradient.endColor` | `#0066CC` |

## 日期配置

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 格子高度 | `option.cell.height` | `76` |
| 日期字号 | `option.cell.day.fontSize` | `16` |
| 日期字重 | `option.cell.day.fontWeight` | `normal` |
| 日期字体风格 | `option.cell.day.fontStyle` | `normal` |
| 日期字间距 | `option.cell.day.letterSpacing` | `0` |
| 日期字体 | `option.cell.day.fontFamily` | `""` |
| 日期颜色 | `option.cell.day.color.value` | `#FFFFFF` |
| 日期渐变启用 | `option.cell.day.color.gradient.enabled` | `false` |

## 数据字段及样式

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 日期字段名 | `option.field.dateField` | `date` |
| 数值字段名 | `option.field.valueField` | `value` |
| 单位 | `option.field.unit` | `无`/`万`/`十万`/`百万`/`千万`/`亿`/`自定义单位` |
| 自定义单位文字 | `option.field.customUnit` | `件`（unit='自定义单位' 时） |
| 数据后跟单位 | `option.field.appendUnit` | `true` |
| 小数位 | `option.unit.decimals` | `1`（unit 为万/十万/百万/千万/亿 时） |
| 数值位置 | `option.dataVal.position` | `top` / `right` / `bottom` / `left` |
| 数值偏移X | `option.dataVal.offsetX` | `-2` |
| 数值偏移Y | `option.dataVal.offsetY` | `-15` |
| 数值字号 | `option.dataVal.fontSize` | `14` |
| 数值字重 | `option.dataVal.fontWeight` | `700` |
| 数值字体风格 | `option.dataVal.fontStyle` | `normal` |
| 数值字间距 | `option.dataVal.letterSpacing` | `0` |
| 数值字体 | `option.dataVal.fontFamily` | `""` |
| 数值颜色 | `option.dataVal.color.value` | `#FFD700` |
| 数值渐变启用 | `option.dataVal.color.gradient.enabled` | `false` |

## 数据圆圈

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 开启圆圈 | `option.circle.enabled` | `true` |
| 圈大小 | `option.circle.size` | `38`（min 12，max 64） |
| 线宽 | `option.circle.strokeWidth` | `4`（min 1，max 10） |
| 填充不透明度 | `option.circle.fillOpacity` | `0.14`（max 0.6） |
| 最浅强度 | `option.circle.minIntensity` | `0.55`（glowEnabled=true 时有效） |
| 发光 | `option.circle.glowEnabled` | `true` |
| 发光强度 | `option.circle.glowStrength` | `1.0`（glowEnabled=true 时有效） |
| 虚线边 | `option.circle.dashed` | `false` |
| 双环 | `option.circle.doubleRing` | `true` |
| 脉冲动画 | `option.circle.pulse` | `true` |

## chartData 格式（静态数据必须用当月日期）

```python
from datetime import date
y, m = date.today().year, date.today().month
chart_data = [
    {"date": f"{y}-{m:02d}-05", "value": 620000},
    {"date": f"{y}-{m:02d}-10", "value": 265000},
]
```
