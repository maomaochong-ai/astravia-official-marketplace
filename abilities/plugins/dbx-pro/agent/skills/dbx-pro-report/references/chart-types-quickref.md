# 图表类型速查（系统名称 → chartType）

> 「系统名称」= 积木报表界面上显示的图表名称（实测截图对齐）。
> 完整 ECharts 配置模板见 `chart-echarts-templates.md`，典型 payload 见 `chart-canonical-configs.md`。

---

## 柱状/条形图

| 系统名称 | 别称/用户说法 | chartType | series | 特殊说明 |
|---------|------------|-----------|--------|---------|
| 普通柱形图 | — | `bar.simple` | `""` | |
| 带背景柱形图 | — | `bar.simple` | `""` | series 加 `showBackground:True`；extData.chartType 仍写 `bar.simple` |
| 多数据对比柱形图 | 多系列柱状图 | `bar.multi` | `"type"` | |
| 正负条形图 | — | `bar.negative` | `"type"` | yAxis=分类，xAxis=数值 |
| 堆叠柱形图 | — | `bar.stack` | `"type"` | |
| 堆叠条形图 | — | `bar.stack.horizontal` | `"type"` | |
| 多数据条形柱状图 | 多系列横向对比 | `bar.multi.horizontal` | `"type"` | |
| 横向柱形图 | 条形图 | `bar.horizontal` | `""` | label position="right" |

## 折线图

| 系统名称 | 别称/用户说法 | chartType | series | 特殊说明 |
|---------|------------|-----------|--------|---------|
| 普通折线图 | 折线图 | `line.simple` | `""` | |
| 平滑曲线折线图 | 平滑折线图 | `line.simple` | `""` | series 加 `smooth:True` |
| 面积堆积折线图 | 面积图 | `line.simple` | `""` | series 加 `isArea:True` |
| 阶梯折线图 | — | `line.simple` | `""` | series 加 `step:True` |
| 多数据对比折线图 | 多系列折线图 | `line.multi` | `"type"` | xAxis 加 `boundaryGap:True` |

## 饼图

| 系统名称 | 别称/用户说法 | chartType | series | 特殊说明 |
|---------|------------|-----------|--------|---------|
| 普通饼图 | 饼图 | `pie.simple` | `""` | |
| 环状饼图 | 环形图 | `pie.doughnut` | `""` | radius=["45%","55%"] |
| 南丁格尔玫瑰饼图 | 玫瑰图 | `pie.rose` | `""` | roseType="radius" |

## 混合/特殊

| 系统名称 | 别称/用户说法 | chartType | series | 特殊说明 |
|---------|------------|-----------|--------|---------|
| 普通折柱图 | 折柱混合图 | `mixed.linebar` | `"type"` | yAxis 是数组；根级加 `"chartType":"linebar"` |
| 360°仪表盘 | 仪表盘 | `gauge.simple` | `""` | |
| 180°仪表盘 | 半圆仪表盘 | `gauge.simple180` | `""` | startAngle:190, endAngle:-10 |
| 普通散点图 | 散点图 | `scatter.simple` | `""` | data 每项为 `[x,y]` |
| 气泡散点图 | 气泡图 | `scatter.bubble` | `""` | 多系列+径向渐变 |
| 普通漏斗图 | 漏斗图 | `funnel.simple` | `""` | sort="descending" |
| 金字塔漏斗图 | 金字塔图 | `funnel.pyramid` | `""` | sort="ascending" |
| 普通雷达图 | 雷达图 | `radar.basic` | `""` 单系列 / `"name"` 多系列 | shape="polygon"；**SQL数据集必须用长格式**（见 chart-echarts-templates.md § radar.basic） |
| 圆形雷达图 | — | `radar.custom` | `""` 单系列 / `"name"` 多系列 | shape="circle"；splitArea 渐变；同样须长格式SQL |
| 普通象形图 | 象形柱图 | `pictorial.spirits` | `""` | type="pictorialBar"；横向布局 |
| 区域地图 | — | `map.simple` | `""` | 根级加 `"chartType":"map"` |
| 点地图 | — | `map.scatter` | `""` | extData 加 `isCustomPropName:True` |
| 普通关系图 | 关系图 | `graph.simple` | `""` | 不绑数据集；节点+边内嵌 config |

---

## 地图数据生成规则（必须遵守）

**无论使用何种数据集类型（SQL / API / JSON / YApi mock），地图数据内容必须与用户指定的地理范围语义匹配。**

| 用户指定地图范围 | 数据应包含 |
|---|---|
| 全国 | 全国 31 个省/直辖市/自治区 |
| 某省（如山东省、广东省） | 该省所有地级市 |
| 某市（如青岛市） | 该市所有区县 |

> 此规则对 `map.simple`（区域地图）和 `map.scatter`（点地图）均适用。
> 用户说"广东省" → 数据里放广东各城市；用户说"全国" → 数据里放各省份。
> **禁止**用不匹配范围的地理数据（如省级地图塞全国数据，或城市地图只有几个省份）。

---

## series 字段取值规则

| 情况 | series 值 |
|------|----------|
| 单系列图表（pie.simple, bar.simple, line.simple, gauge, scatter, radar, funnel 等） | `""` |
| 多系列图表（bar.multi, line.multi, bar.stack, bar.negative, mixed.linebar 等） | `"type"` |

> 单系列图表 `series` 传 `"type"` 会导致预览时图表不自动加载、需手动点击"运行"。
