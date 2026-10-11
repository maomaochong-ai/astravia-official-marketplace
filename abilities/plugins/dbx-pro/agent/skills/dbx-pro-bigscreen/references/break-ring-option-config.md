# JBreakRing（多色环形图）配置路径

> 来源：`BreakRingOption.vue`（配置面板）+ `BreakRing.vue`（渲染逻辑）

## 基础配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 内径比例（0~1） | `option.innerRadius` | `0.6` |
| 外径比例（0~1） | `option.outRadius` | `0.8` |
| 扇区间距宽度 | `option.series[0].itemStyle.borderWidth` | `2` |
| 发光模糊半径 | `option.series[0].itemStyle.shadowBlur` | `10` |

## 标题配置（option.title）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示标题 | `option.title.show` | `true` |
| 主标题文字 | `option.title.text` | `总计` |
| 主标题颜色 | `option.title.textStyle.color` | `#ffffff` |
| 主标题字重 | `option.title.textStyle.fontWeight` | `bold` |
| 主标题字号 | `option.title.textStyle.fontSize` | `20` |
| 副标题文字 | `option.title.subtext` | `（件）` |
| 副标题颜色 | `option.title.subtextStyle.color` | `#cccccc` |
| 副标题字重 | `option.title.subtextStyle.fontWeight` | `normal` |
| 副标题字号 | `option.title.subtextStyle.fontSize` | `14` |

## 标题位置

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 水平位置模式 | `option.title.customLeft` | `true`（自定义）/ `false`（预设） |
| 水平预设位置 | `option.title.left` | `center` / `left` / `right`（customLeft=false 时生效） |
| 水平自定义值 | `option.title.left` | `"50%"`（customLeft=true 时传百分比字符串） |
| 垂直位置模式 | `option.title.customTop` | `true` / `false` |
| 垂直预设位置 | `option.title.top` | `center` / `top` / `bottom`（customTop=false 时生效） |
| 垂直自定义值 | `option.title.top` | `"45%"`（customTop=true 时传百分比字符串） |
| 文字对齐 | `option.title.textAlign` | `center` / `left` / `right` |
| 小数位数 | `option.title.totalDecimalPlaces` | `0`（总计数值保留小数位，0=整数） |

## 引导线配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 引导线第二段长度 | `option.series[0].labelLine.length2` | `8` |

## 颜色配置

环形图各扇区颜色通过 `option.customColor` 数组设置（与系列数量对应）：

```python
option = {
    "customColor": ["#1890ff", "#52c41a", "#faad14", "#ff4d4f", "#722ed1"],
    "innerRadius": 0.6,
    "outRadius": 0.8,
    "title": {
        "show": True,
        "text": "总计",
        "textStyle": {"color": "#ffffff", "fontWeight": "bold", "fontSize": 20},
        "subtext": "（件）",
        "subtextStyle": {"color": "#cccccc", "fontSize": 14},
        "customLeft": False, "left": "center",
        "customTop": False, "top": "center",
        "textAlign": "center",
        "totalDecimalPlaces": 0,
    },
    "series": [{"itemStyle": {"borderWidth": 2, "shadowBlur": 10},
                "labelLine": {"length2": 8}}],
}
```

## chartData 格式

```python
chart_data = [
    {"name": "类型A", "value": 335},
    {"name": "类型B", "value": 310},
    {"name": "类型C", "value": 234},
    {"name": "类型D", "value": 135},
    {"name": "类型E", "value": 108},
]
```
