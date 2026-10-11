# 仪表盘/进度/视频/天气/日历/交互类组件速查

> 涵盖：JGauge / JColorGauge / JAntvGauge / JSemiGauge / JProgress / JCustomProgress /  
>         JRoundProgress / JListProgress / JLiquid / JTotalProgress / JVideoPlay / JVideoJs /  
>         JWeatherForecast / JPermanentCalendar  
> 按需加载：当用户要添加仪表盘、进度条、视频、天气、日历类组件时读本文件

---

## 仪表盘系列选型

| 需求 | 组件 |
|------|------|
| 普通仪表盘，单指针单色 | JGauge |
| 多色段仪表盘（红/黄/绿分区）| JColorGauge |
| 渐变色弧进度仪表盘 | JAntvGauge |
| 半圆仪表盘，多层视觉 | JSemiGauge |

---

## JGauge（基础仪表盘）

**尺寸** w=400 h=300  
**chartData** `[{value, name, max}]` 或 `[{min, max, label, value}]`  
**Online表单** 不设nameFields/typeFields（onlyValueChart），无xAxis/yAxis，series type='gauge'  

**key option**:

| 配置 | 路径 |
|------|------|
| 刻度值显隐 | `option.series[0].axisLabel.show` |
| 刻度值颜色 | `option.series[0].axisLabel.color` |
| 刻度线显隐 | `option.series[0].axisTick.show` |
| 分割线显隐 | `option.series[0].splitLine.show` |
| 指标字号 | `option.series[0].detail.fontSize` |

---

## JColorGauge（多色仪表盘）

**尺寸** w=400 h=300  
**chartData** `[{name, value}]`（不含max）  
**行为** 轴线按比例分3色段（默认红/黄/蓝）

---

## JAntvGauge（渐变仪表盘）

**尺寸** w=400 h=300  
**chartData** `[{name, value, max}]`  
**行为** AntV G2Plot，4种colorType  
**Online表单** 不设isGroup字段（白名单排除）

---

## JSemiGauge（半圆仪表盘）

**尺寸** w=400 h=300  
**chartData** `[{value, name, max}]`  
**映射机制** 第一类（dataMapping），`[{filed:'总计'},{filed:'已用'}]`；同时有 `option.titleMapping/option.valueMapping` 存实际字段名  
**行为** 固定5层：外刻度/外进度弧/内圆/内阴影/内进度弧  
**必须从default_configs.json深拷贝**（含 echarts.graphic.LinearGradient）  
**spec_builder** 有 `JSemiGauge` handler：`{value, max, titleSuffix, valueSuffix}`，详见 `references/spec-builder.md` §4

---

## 进度图系列选型

| 需求 | 组件 |
|------|------|
| 单条水平进度条 | JCustomProgress 或 JTotalProgress（双层对比感）|
| 多行进度条列表 | JListProgress |
| 圆形进度 | JRoundProgress 或 JRingProgress（见charts）|
| 液态波浪感 | JLiquid |

---

## JCustomProgress（基础进度图）

**尺寸** w=450 h=100  
**chartData** `[{name, value}]`  
**key option**: `barWidth, padding, progressColor, backgroundColor, titleColor, titleFontSize, valueColor, valueFontSize`

---

## JProgress（进度图/ECharts双层条）

**尺寸** w=450 h=100  
**chartData** `[{name, value}]`  
**特殊结构** 专属双series结构（前景+背景），无xAxis，`option.yAxis.axisLabel.show`控标题显隐  
**⚠️ Online表单** 禁用含xAxis/yAxis的柱形option  
**config路径**:
- 显示标题：`option.yAxis.axisLabel.show`
- 标题字体颜色：`option.yAxis.axisLabel.color`

---

## JListProgress（列表进度图）

**行为** 多行列表，每行有名称+水平进度条+数值，支持滚动  
**映射机制** 第二类（option内嵌），`option.beginFields[].key`、`option.centerTopFields[].key`、`option.endFields[].key`  
**必须从default_configs.json深拷贝**（含完整ListProgressOption）  
**spec_builder** 有 `JListProgress` handler：`{title, current, target, label, date}`，详见 `references/spec-builder.md` §4

---

## JRoundProgress（圆形进度图）

**尺寸** w=200 h=200  
**chartData** `[{value}]`（value 0-100）  
**基于ECharts polar+gauge，支持渐变色**

---

## JLiquid（液体进度/水球图）

**尺寸** w=300 h=300  
**chartData** `[{value}]`（value 0-1，小数！）  
**Online表单** onlyValueChart，nameFields=[]  
**形状** circle/rect/heart等可选

---

## JTotalProgress（统计进度图/双层对比条）

**行为** ECharts水平条形图，前景色值条+灰色背景对比条叠加，突出"已用/总计"对比感  
**chartData** `[{value: 50}]` 单值，0-100  
**Online表单** onlyValueChart，nameFields=[]，category=HorizontalBar

---

## 视频系列

### JVideoPlay（视频播放器）
**尺寸** w=450 h=300

### JVideoJs（RTMP视频播放器）
**尺寸** w=450 h=300

---

## JWeatherForecast（天气预报，6变体）

**⚠️ comp_ops.py不支持此组件**，必须用自定义脚本操作template数组添加  
**dataType** 必须为1（自动获取天气数据），chartData为 `"[]"`  
**区分方式** 同一compType，通过 `option.template` 区分（不是index）

| 变体 | template值 | 尺寸 w×h | fontColor |
|------|-----------|----------|-----------|
| 滚动版 | 11 | 311×47 | #fff |
| 横线版 | 34 | 300×30 | #fff |
| 带背景 | 21 | 415×131 | #000 |
| 好123版 | 12 | 318×61 | #fff |
| 温度计版 | 27 | 400×266 | #fff |
| 列表文字版 | 94 | 257×47 | #fff |

完整脚本见 `references/weather-forecast-guide.md`

---

## JPermanentCalendar（日历）

**尺寸** w=1000 h=480  
**映射机制** 第二类（option内嵌），`option.field.dateField` / `option.field.valueField`（字符串，填数据字段名）  
**必须从default_configs.json深拷贝**（含 permanentCalendarOption/permanentCalendarData）  

**🚨 静态chartData必须用当月日期**：日历默认展示当月，历史月份日期点不可见  
```python
from datetime import date
y, m = date.today().year, date.today().month
# dates替换为 f'{y}-{m:02d}-{d:02d}' 格式
```

详细配置见 `references/permanent-calendar-option-config.md`

---

## 踩坑（仪表盘/进度/特殊类）

- **JSemiGauge** 必须从default_configs.json深拷贝，含LinearGradient复杂结构
- **JListProgress** 必须从default_configs.json深拷贝，字段映射在option.beginFields等
- **JGauge Online表单** 不设nameFields/typeFields（onlyValueChart）；不设isGroup（白名单排除）
- **JLiquid chartData** value是小数（0-1），不是整数
- **JWeatherForecast** comp_ops.py不支持，必须自定义脚本；dataType=1
- **JPermanentCalendar** 静态数据必须用当月日期，否则数据点不可见
- **JProgress** 专属双series结构，禁用含xAxis/yAxis的柱形option
- **JSemiGauge dataMapping** 槽位是'总计'/'已用'，同时需设option.titleMapping/valueMapping
