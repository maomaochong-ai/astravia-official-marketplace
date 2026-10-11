# ECharts 常用属性速查

> 本文件含：section 9（UI 面板字段映射、label.position、tooltip.formatter、轴名称、数据过滤、图表专属设置）+ section 10（快速生成函数 + 模板参考）
> 组件结构见 chart-components.md；ECharts 模板见 chart-echarts-templates.md

---

## 9. ECharts 常用属性速查

### 9.1 UI 面板 → ECharts 字段映射

各图表右侧面板的 UI 选项与 ECharts config 字段的对应关系（适用于柱形图、折线图等通用图表）：

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **标题设置** | 显示/隐藏 | `title.show` | `true`/`false` |
| | 标题文字 | `title.text` | 字符串 |
| | 字体颜色 | `title.textStyle.color` | 颜色值 |
| | 字体加粗 | `title.textStyle.fontWeight` | `"bolder"` / `"normal"` |
| | 字体大小 | `title.textStyle.fontSize` | 数字 |
| | 标题位置 | `title.left` | `"left"` / `"center"` / `"right"` |
| | 顶边距 | `title.top` | **UI限制 0~100**，字符串数字如 `"50"` |
| | 字体粗细 | `title.textStyle.fontWeight` | `"normal"`正常 / `"bold"`粗体 / `"bolder"`特粗 / `"lighter"`细体 |
| **柱体设置** | 宽度 | `series[].barWidth` | **UI限制 0~100**，数字（像素） |
| | 圆角 | `series[].itemStyle.barBorderRadius` | **UI限制 0~100**，数字（四角相同）或 `[上左,上右,下右,下左]` |
| | 最小高度 | `series[].barMinHeight` | **UI限制 0~100**，数字（像素） |
| | 柱体颜色 | `series[].itemStyle.color` | 颜色值 |
| **折线设置** | 平滑曲线 | `series[].smooth` | `true`/`false` |
| | 标记点显示 | `series[].showSymbol` | `true`/`false` |
| | 点大小 | `series[].symbolSize` | 数字 |
| | 阶梯线图 | `series[].step` | `true`/`false` |
| | 线条宽度 | `series[].lineStyle.width` | 数字 |
| | 线条颜色 | `series[].itemStyle.color` | 颜色值 |
| | 面积堆积 | `series[].isArea` + `series[].areaStyle` | `isArea:true` + `areaStyle.color` 设为实色 |
| | 面积颜色 | `series[].areaStyle.color` | 颜色值 |
| | 面积透明度 | `series[].areaStyle.opacity` | 0~1 |
| **X 轴设置** | 显示/隐藏 | `xAxis.show` | `true`/`false` |
| | X 轴名称 | `xAxis.name` | 字符串，空=不显示 |
| | 分割线 | `xAxis.splitLine.show` | `true`/`false` |
| | 分割线颜色 | `xAxis.splitLine.lineStyle.color` | 颜色值 |
| | 字体大小 | `xAxis.axisLabel.textStyle.fontSize` | 数字 |
| | 字体颜色 | `xAxis.axisLabel.textStyle.color` | 颜色值 |
| | 轴线颜色 | `xAxis.axisLine.lineStyle.color` | 颜色值 |
| **Y 轴设置** | 显示/隐藏 | `yAxis.show` | `true`/`false` |
| | Y 轴名称 | `yAxis.name` | 字符串，空=不显示 |
| | 分割线 | `yAxis.splitLine.show` | `true`/`false` |
| | 分割线颜色 | `yAxis.splitLine.lineStyle.color` | 颜色值 |
| | 字体大小 | `yAxis.axisLabel.textStyle.fontSize` | 数字 |
| | 字体颜色 | `yAxis.axisLabel.textStyle.color` | 颜色值 |
| | 轴线颜色 | `yAxis.axisLine.lineStyle.color` | 颜色值 |
| **数值设置** | 显示/隐藏 | `series[].label.show` | `true`/`false` |
| | 字体大小 | `series[].label.textStyle.fontSize` | 数字 |
| | 字体颜色 | `series[].label.textStyle.color` | 颜色值 |
| | 字体粗细 | `series[].label.textStyle.fontWeight` | `"bolder"` / `"normal"` |
| | 字体位置 | `series[].label.position` | 见下方位置速查 |
| **提示语设置** | 显示/隐藏 | `tooltip.show` | `true`/`false` |
| | 字体大小 | `tooltip.textStyle.fontSize` | 数字 |
| | 字体颜色 | `tooltip.textStyle.color` | 颜色值 |
| **坐标轴边距** | 上/下/左/右 | `grid.top/bottom/left/right` | **UI限制 0~200**，数字（像素） |
| **图例设置** | 显示/隐藏 | `legend.show` | `true`/`false` |
| | 字体大小 | `legend.textStyle.fontSize` | 数字 |
| | 字体颜色 | `legend.textStyle.color` | 颜色值 |
| | 纵向位置 | `legend.top` | `"top"` / `"bottom"` |
| | 横向位置 | `legend.left` | `"left"` / `"center"` / `"right"` |
| | 布局朝向 | `legend.orient` | `"horizontal"` / `"vertical"` |
| **自定义颜色** | 系列颜色 | `series[n].itemStyle.color` | 对应第 n 个系列（多系列图）|

### 9.2 label.position 可选值

| UI 说明 | ECharts 值 | 适用场景 |
|---------|-----------|---------|
| 上方 | `"top"` | 柱形图、折线图（默认） |
| 下方 | `"bottom"` | 柱形图 |
| 左边 | `"left"` | 横向图、负值柱 |
| 右边 | `"right"` | 横向柱状图 |
| 内部 | `"inside"` | 柱形图内部标注 |
| 外部 | `"outside"` | 饼图（默认） |

### 9.3 tooltip.formatter 语法

| 占位符 | 含义 | 适用图表 |
|--------|------|---------|
| `{a}` | 系列名（series.name） | 所有 |
| `{b}` | 数据名/X轴值 | 所有 |
| `{c}` | 数值（Y轴值） | 所有 |
| `{d}` | 百分比（%，不含 % 符号） | 饼图 |

```python
# 常用 formatter 示例
"formatter": "{b} : {c}"            # 数据名: 数值
"formatter": "{b} : {c} ({d}%)"     # 饼图带百分比
"formatter": "{a}<br/>{b} : {c}"    # 系列名换行+数据名: 数值
```

### 9.4 X/Y 轴名称完整显示配置

默认 `xAxis.name` 只设字符串，轴名可能被截断或与轴标签重叠。确保完整显示需：

```python
"xAxis": {
    "name": "手机品牌",
    "nameLocation": "middle",    # "start"=轴起点 / "middle"=居中 / "end"=轴末尾（默认）
    "nameGap": 30,               # 轴名与轴线之间的距离（像素），默认15，轴标签较长时需增大
    "nameTextStyle": {"color": "#333", "fontSize": 12},
},
# 同时增大 grid.bottom（X轴底部留白），防止轴名被裁剪
"grid": {"bottom": 65},   # 默认60，轴名居中时建议65~80
```

```python
# Y 轴名称同理
"yAxis": {
    "name": "销量（台）",
    "nameLocation": "end",     # Y轴名一般用 "end"（轴顶部）
    "nameGap": 10,
    "nameTextStyle": {"color": "#333", "fontSize": 12},
},
"grid": {"left": 70},      # 增大左侧留白防截断
```

### 9.5 数据过滤（显示X轴前N项）

UI 面板「数据过滤 → 显示X轴前 ___ 项」对应 **ECharts config JSON 中的 `dataFilter.filterCount`**（不在 `extData` 中）。

```python
# 在 echarts_config 根级添加（与 xAxis/yAxis/series 同级）
"dataFilter": {"filterCount": 50}   # 只显示 X 轴前50项
```

> **位置**：`chartList[].config`（JSON 字符串）的根级，不是 `extData`。
> **2026-04-03 实测确认**：浏览器保存 payload 中 `config` 的根级有 `"dataFilter":{"filterCount":5101}`。

### 9.6 图表专属 UI 设置速查

> 以下为各特殊图表专属 UI 面板的字段映射，通用字段（标题/提示语/图例等）见 9.1。

#### 散点图（scatter.simple / scatter.bubble）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **散点设置** | 大小 | `series[].symbolSize` | 数字（像素） |
| | 颜色 | `series[].itemStyle.color` | 颜色值 |
| **气泡专属** | 中心颜色 | `series[].itemStyle.color.colorStops[0].color` | 径向渐变内圈色（`type:"radial"`） |
| | 边缘颜色 | `series[].itemStyle.color.colorStops[1].color` | 径向渐变外圈色 |

#### 仪表盘（gauge.simple / gauge.simple180）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **中心点设置** | X轴 | `series[].center[0]` | 水平位置（像素），值越小越靠右 |
| | Y轴 | `series[].center[1]` | 垂直位置（像素），值越小越靠下 |
| **仪表盘数据** | 标题显示 | `series[].title.show` | `true`/`false` |
| | 标题字体大小 | `series[].title.textStyle.fontSize` | 数字 |
| | 标题颜色 | `series[].title.textStyle.color` | 颜色值 |
| | 指针显示 | `series[].pointer.show` | `true`/`false` |
| | 指针颜色 | `series[].itemStyle.color` | 颜色值 |
| | 指针字体大小 | `series[].detail.textStyle.fontSize` | 数字（指针下方数值文字） |
| | 指针字体颜色 | `series[].detail.textStyle.color` | 颜色值 |
| **仪表盘设置** | 刻度值显示 | `series[].axisLabel.show` | `true`/`false` |
| | 刻度值字体大小 | `series[].axisLabel.textStyle.fontSize` | 数字 |
| | 仪盘半径（%） | `series[].radius` | `"75%"`（gauge.simple 专属，180° 无此字段） |
| | 轴线宽度 | `series[].axisLine.lineStyle.width` | 数字 |
| | 分割线长度 | `series[].splitLine.length` | 数字（刻度与仪盘之间距离） |
| | 刻度线长度 | `series[].axisTick.length` | 数字 |
| **自定义配色** | 分段颜色 | `series[].axisLine.lineStyle.color` | 二维数组 `[[阈值比例, 颜色], ...]`，最后项比例必须为 `1` |

#### 象形柱图（pictorial.spirits）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **象形图设置** | 图标 | `series[].symbol` | `"path://..."` 或 `"image://url"`，空=默认矩形 |
| | 图表大小 | `series[].symbolSize` | 数字（像素） |
| | 图表间距 | `series[].symbolMargin` | 如 `"5%!"` |
| | 最大值 | `xAxis.max` + `series[].symbolBoundingData` | **两处必须一致**，图标铺满基准值 |
| | 是否补全 | `series[].secondOpacity` | 背景图标透明度（如 `0.2`），关闭=不显示背景 |

> **⚠️ 象形图图标命名注意：** 图标名称尽量使用字母，使用其他字符（如中文）会导致图片上传失败。

#### 雷达图自定义颜色（radar.basic / radar.custom）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **自定义配色** | 边框颜色 | `series[].data[n].lineStyle.color` | 每个系列边框（折线）颜色 |
| | 透明度 | `series[].data[n].areaStyle.opacity` | 填充区域透明度（0~1） |

> 雷达图自定义颜色需同时设置 `areaStyle.color`（填充色）和 `lineStyle.color`（边框色）：
> ```python
> "data": [{"name": "系列1", "value": [...], "lineStyle": {"color": "#c23531"}, "areaStyle": {"color": "#c23531", "opacity": 0.3}}]
> ```

#### 折柱混合图双 Y 轴（mixed.linebar）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **左Y轴设置** | 显示/名称/分割线/字体 | `yAxis[0].show/name/splitLine/axisLabel` | `yAxis` 是数组，索引0=左轴 |
| **右Y轴设置** | 显示/名称/分割线/字体 | `yAxis[1].show/name/splitLine/axisLabel` | 索引1=右轴；series 绑定右轴需设 `yAxisIndex: 1` |

#### 地图（map.simple / map.scatter）

| UI 面板 | UI 选项 | ECharts 字段 | 说明 |
|---------|---------|-------------|------|
| **地图设置** | 地图 | `geo.map` | 地图区域名，如 `"china"` 或省份名（通过地图维护设置区域） |
| | 比例 | `geo.layoutSize` + `geo.zoom` | layoutSize=像素尺寸，zoom=缩放比 |
| | 字体大小 | `geo.label.fontSize` | 区域名字体大小 |
| | 字体颜色 | `geo.label.color` | 区域名字体颜色 |
| | 区域线 | `geo.itemStyle.borderWidth` | 区域边框线宽 |
| | 区域颜色 | `geo.itemStyle.areaColor` | 区域填充色 |
| | 区域高亮颜色 | `geo.emphasis.itemStyle.areaColor` | 鼠标点击高亮色 |
| | 边框颜色 | `geo.itemStyle.borderColor` | 区域边框颜色 |
| **散点设置** | 大小（点地图） | `series[].symbolSize` | map.scatter 专属 |
| | 颜色 | `series[].itemStyle.color` | map.scatter 专属 |
| | 透明度 | `series[].itemStyle.opacity` | map.scatter 专属（0~1） |
| **数值设置** | 显示 | `series[].label.show` | `true`/`false` |
| | 字体大小 | `series[].label.fontSize` | 数字 |
| | 字体颜色 | `series[].label.color` | 颜色值 |
| | 字体位置 | `series[].label.position` | `"top"/"left"/"right"/"bottom"/"inside"` |

> **地图区域维护说明：** 积木报表的地图区域（`geo.map` 的可选值）在系统「地图维护」菜单中设置，支持中国全图、各省份、自定义区域。`geo.map` 填写与地图维护中一致的名称。

---

## 9.7 自定义配色（系统格式）— 验证规则

> 积木报表的「自定义颜色」面板写入的是系统专用 `colors[]` 字段，**不是** ECharts 标准 `color[]`。
> 两套字段并存，改错位置颜色不生效或不持久化。

### 饼图类（pie.simple / pie.doughnut / pie.rose）— 3 处

颜色按**数据项**粒度设置，共 3 处，`color[]` 不改：

```python
# 按数据项数量准备颜色列表
colors = ["#2196F3", "#26C6DA", "#3F51B5"]   # len == len(data)

# 处1：每个数据项 itemStyle.color
# 处2：每个数据项 label.color
for i, item in enumerate(cfg["series"][0]["data"]):
    item["itemStyle"] = {"color": colors[i]}
    item["label"]     = {"color": colors[i]}

# 处3：系统 colors[] 对象数组
cfg["colors"] = [
    {"color": c, "edgeColor": "", "opacity": 1, "lineColor": "", "sort": i + 1}
    for i, c in enumerate(colors)
]
# ❌ 不要改 cfg["color"]（ECharts 全局色板，系统不通过它管理）
```

### 柱形图类（bar.stack / bar.multi / bar.stack_h / bar.posneg 多系列）— 2 处

颜色按**系列**粒度设置，共 2 处，保留 `barBorderRadius`：

```python
# 按系列数量准备颜色列表
colors = ["#2196F3", "#26C6DA", "#7986CB"]   # len == len(series)

# 处1：每个系列 itemStyle.color（保留 barBorderRadius）
for i, s in enumerate(cfg["series"]):
    s["itemStyle"]["color"] = colors[i]

# 处2：系统 colors[] 对象数组
cfg["colors"] = [
    {"color": c, "edgeColor": "", "opacity": 1, "lineColor": "", "sort": i + 1}
    for i, c in enumerate(colors)
]
# ❌ 不要改 cfg["color"]
```

### colors[] 对象字段说明

| 字段 | 说明 | 典型值 |
|------|------|--------|
| `color` | 主颜色（十六进制） | `"#2196F3"` |
| `edgeColor` | 边框色，空=不设 | `""` |
| `opacity` | 透明度 | `1` |
| `lineColor` | 线条色（折线图用），空=不设 | `""` |
| `sort` | 排序序号（1-based） | `1, 2, 3...` |

---

## 10. 快速生成图表的 Python 函数

```python
def create_chart(chart_type, title, db_code, db_id, row_start, col_start,
                 rows=10, cols=5, width="650", height="350"):
    layer_id = "chart_" + gen_id()
    base_configs = {
        "bar.simple": {
            "title": {"text": title, "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
            "xAxis": [{"type": "category", "data": []}],
            "yAxis": [{"type": "value"}],
            "series": [{"type": "bar", "data": [], "barWidth": "40%"}]
        },
        "pie.simple": {
            "title": {"text": title, "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
            "legend": {"bottom": "5%", "left": "center"},
            "series": [{"type": "pie", "radius": "55%", "center": ["50%", "50%"], "data": []}]
        },
        "line.simple": {
            "title": {"text": title, "left": "center"},
            "tooltip": {"trigger": "axis"},
            "xAxis": [{"type": "category", "data": []}],
            "yAxis": [{"type": "value"}],
            "series": [{"type": "line", "smooth": True, "data": []}]
        }
    }
    config = base_configs.get(chart_type, base_configs["bar.simple"])
    row_end = row_start + rows - 1
    col_end = col_start + cols - 1
    virtual_cells = [[r,c] for r in range(row_start, row_end+1) for c in range(col_start, col_end+1)]
    chart_rows = {}
    for r in range(row_start, row_end + 1):
        cells = {str(c): {"text": " ", "virtual": layer_id} for c in range(col_start, col_end + 1)}
        chart_rows[str(r)] = {"cells": cells}
    chart_item = {
        "row": row_start, "col": col_start, "colspan": 0, "rowspan": 0,
        "width": width, "height": height,
        "config": json.dumps(config, ensure_ascii=False), "url": "",
        "extData": {"chartType": chart_type, "dataType": "sql", "dataId": str(db_id),
                    "dbCode": db_code, "axisX": "name", "axisY": "value", "series": "type",
                    "xText": "", "yText": "", "apiStatus": "1"},
        "layer_id": layer_id, "offsetX": 0, "offsetY": 0,
        "backgroud": {"enabled": False, "color": "#fff", "image": "", "repeat": "repeat"},
        "virtualCellRange": virtual_cells
    }
    return chart_item, chart_rows
```

## 模板报表参考

通过 `GET /jmreport/getReportByUser?reportId=&template=1` 查询模板。

### 46个模板分类

| 分类 | 数量 | 示例 |
|------|------|------|
| 基础表格 | 30 | 信息采集表、简单分组报表 |
| 图表报表 | 9 | 全国各大城市化员数据、物业实时监控 |
| 循环报表 | 4 | 订单表循环打印、班级循环套打表 |
| 图片报表 | 4 | 员工信息表、证书打印 |
| 条码/二维码 | 3 | 实习证明、凭证条码报表 |

### 图表数据绑定 extData

| 字段 | 固定值 | 含义 |
|------|--------|------|
| `axisX` | `name` | X轴/分类 |
| `axisY` | `value` | Y轴/数值 |
| `series` | `type` | 系列/分组 |

`dataType` 取值：`"sql"`, `"api"`, `"json"`, `"javabean"`, `"files"`, `null`（静态图表）
