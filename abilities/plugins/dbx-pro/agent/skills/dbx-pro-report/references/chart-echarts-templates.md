# ECharts 配置模板（简化最小配置）

> 完整默认值可通过 `GET /jmreport/addChart?chartType=<type>` 获取原始配置。
> 组件结构见 chart-components.md，常用属性速查见 chart-echarts-props.md。

---

## 中文图表名快查表（优先看这里）

> 「系统名称」= 积木报表选图表时界面上显示的名字（来自截图实测）。

| 系统名称 | 别称/用户说法 | chartType | series | 特殊说明 |
|---------|------------|-----------|--------|---------|
| **柱形图** | | | | |
| 普通柱形图 | — | `bar.simple` | `""` | |
| 带背景柱形图 | — | `bar.simple` | `""` | series 加 `showBackground:True`；extData.chartType 仍写 `bar.simple` |
| 多数据对比柱形图 | 多系列柱状图 | `bar.multi` | `"type"` | |
| 正负条形图 | — | `bar.negative` | `"type"` | yAxis=分类，xAxis=数值；负值用负数 |
| 堆叠柱形图 | — | `bar.stack` | `"type"` | |
| 堆叠条形图 | — | `bar.stack.horizontal` | `"type"` | |
| 多数据条形柱状图 | 多系列横向对比 | `bar.multi.horizontal` | `"type"` | |
| 横向柱形图 | 条形图 | `bar.horizontal` | `""` | label position="right" |
| **折线图** | | | | |
| 普通折线图 | 折线图 | `line.simple` | `""` | |
| 平滑曲线折线图 | 平滑折线图 | `line.simple` | `""` | series 加 `smooth:True` |
| 面积堆积折线图 | 面积图 | `line.simple` | `""` | series 加 `isArea:True` + `areaStyle.color` |
| 阶梯折线图 | — | `line.simple` | `""` | series 加 `step:True` |
| 多数据对比折线图 | 多系列折线图 | `line.multi` | `"type"` | xAxis 加 `boundaryGap:True` |
| **饼图** | | | | |
| 普通饼图 | 饼图 | `pie.simple` | `""` | |
| 环状饼图 | 环形图 | `pie.doughnut` | `""` | radius=["45%","55%"] |
| 南丁格尔玫瑰饼图 | 玫瑰图 | `pie.rose` | `""` | roseType="radius" |
| **混合图** | | | | |
| 普通折柱图 | 折柱混合图 | `mixed.linebar` | `"type"` | yAxis 是数组（双Y轴）；根级加 `"chartType":"linebar"` |
| **仪表盘** | | | | |
| 360°仪表盘 | 仪表盘 | `gauge.simple` | `""` | |
| 180°仪表盘 | 半圆仪表盘 | `gauge.simple180` | `""` | startAngle:190, endAngle:-10 |
| **散点图** | | | | |
| 普通散点图 | 散点图 | `scatter.simple` | `""` | data 每项为 `[x,y]` |
| 气泡散点图 | 气泡图 | `scatter.bubble` | `""` | 多系列 + 径向渐变 |
| **漏斗图** | | | | |
| 普通漏斗图 | 漏斗图 | `funnel.simple` | `""` | sort="descending" |
| 金字塔漏斗图 | 金字塔图 | `funnel.pyramid` | `""` | sort="ascending" |
| **雷达图** | | | | |
| 普通雷达图 | 雷达图 | `radar.basic` | `""` | shape="polygon"；legend.data 必须预填 |
| 圆形雷达图 | — | `radar.custom` | `""` | shape="circle"；splitArea 渐变填充 |
| **象形图** | | | | |
| 普通象形图 | 象形柱图 | `pictorial.spirits` | `""` | type="pictorialBar"；横向布局 |
| **地图** | | | | |
| 区域地图 | — | `map.simple` | `""` | 根级加 `"chartType":"map"` |
| 点地图 | — | `map.scatter` | `""` | extData 加 `isCustomPropName:True` |
| **关系图** | | | | |
| 普通关系图 | 关系图 | `graph.simple` | `""` | 不绑数据集，节点+边内嵌 config；extData 只需 chartId+chartType |

**API 图表轴字段选择（必须用 `pick_chart_axes`）**：

```python
from jimureport_chart import pick_chart_axes
field_list = parse_api(session, api_url)          # 或 parse_sql
axis_x, axis_y = pick_chart_axes(field_list)      # 语义关键词自动选轴
# chart_entry 会在 axis_x != "name" 时自动设 isCustomPropName=True，无需手动干预
```

> ⚠️ **patch 脚本禁止硬编码 `isCustomPropName=False`**。字段名非 `name`/`value` 时必须显式设：
> ```python
> if axis_x != "name" or axis_y != "value":
>     ext["isCustomPropName"] = True
>     ext["xText"] = axis_x
>     ext["yText"] = axis_y
> ```

**关键参数默认值：**
- `api_status="0"`（JSON静态数据集）/ `api_status="1"`（SQL/API数据集）
- ⚠️ **API 数据集图表必须用 `api_status="1"`**，写 `"0"` 会导致图表用静态空数据渲染，数据集绑定不生效
- `data_type="json"` / `data_type="sql"`
- 单系列图表 `series=""` — 多系列图表 `series="type"`
- **API 图表字段名非 `name`/`value` 时**：必须在 `chart_entry` 返回的对象上追加：
  ```python
  chart["extData"]["isCustomPropName"] = True
  chart["extData"]["xText"] = "实际分类字段名"   # 如 "quarter"
  chart["extData"]["yText"] = "实际值字段名"     # 如 "user_count"
  # axisX/axisY 已通过 chart_entry 的 axis_x/axis_y 参数传入，保持一致即可
  ```
- 布局默认：`ROW_STEP=20`，`CHART_W="560"`，`CHART_H="380"`，列宽80px
- 左列 col=1\~7，右列 col=8\~14（两列并排时）

---

## SQL/API 图表数据回填（必须执行）

> **SQL/API 数据集图表创建后必须回填数据，否则设计器页面 ECharts 空白。**
> JSON 数据集无此问题（数据已内嵌 config）。

| 数据集类型 | 回填接口 | 返回路径 |
|-----------|---------|---------|
| SQL (`dataType="sql"`) | `/qurestSql` | `resp["result"]` → list |
| API (`dataType="api"`) | `/qurestApi` | `resp["result"]["data"]` → list |

### 流程

```
save_db → chart_entry → /save(第一次) → /qurestSql 或 /qurestApi → 回填config → /save(第二次)
```

### 代码片段（SQL/API 图表通用，每次创建后复用）

```python
from collections import OrderedDict

def fetch_and_fill_chart(session, chart, report_id=None):
    """
    SQL 数据集调 /qurestSql，API 数据集调 /qurestApi，回填 chart['config']。
    chart: chartList 中的单个图表对象（含 extData 和 config）
    """
    ext = chart["extData"]

    # 1. 查询实际数据（SQL → /qurestSql；API → /qurestApi）
    chart_setting = {
        "chartId": ext["chartId"], "id": ext["chartId"],
        "chartType": ext["chartType"], "dataType": ext["dataType"],
        "apiStatus": ext["apiStatus"], "dataId": ext["dataId"],
        "dataId1": "", "dbCode": ext["dbCode"],
        "axisX": ext["axisX"], "axisY": ext["axisY"],
        "series": ext["series"],
        "xText": "", "yText": "", "linkIds": "",
        "source": "", "target": "", "isTiming": "", "intervalTime": "",
        "isCustomPropName": False, "run": 1,
    }
    payload = {"apiSelectId": ext["dataId"], "chartSetting": chart_setting}
    if ext.get("dataType") == "api":
        result = session.request("/qurestApi", payload)["result"]
        rows = result["data"] if isinstance(result, dict) else result
    else:
        rows = session.request("/qurestSql", payload)["result"]

    if not rows:
        return chart   # 数据为空则不修改

    axis_x      = ext["axisX"]       # 通常 "name"
    axis_y      = ext["axisY"]       # 通常 "value"
    series_fld  = ext["series"]      # "" 单系列 / "type" 多系列

    cfg = json.loads(chart["config"])

    if series_fld:
        # ── 多系列：按 type 分组 ─────────────────────────────────────
        x_seen = OrderedDict()
        for r in rows:
            x_seen[r[axis_x]] = None
        x_data = list(x_seen.keys())

        smap = OrderedDict()
        for r in rows:
            t = r[series_fld]
            if t not in smap:
                smap[t] = {}
            smap[t][r[axis_x]] = r[axis_y]
        series_names = list(smap.keys())

        # 对齐 x_data，缺失填 None
        for t in smap:
            smap[t] = [smap[t].get(x) for x in x_data]

        # 回填
        if "xAxis" in cfg:
            cfg["xAxis"]["data"] = x_data
        if "legend" in cfg:
            cfg["legend"]["data"] = series_names

        # 保留原 series 模板样式，只替换 name/data
        orig = {s.get("name", ""): s for s in cfg.get("series", [])}
        new_series = []
        for sname in series_names:
            tmpl = dict(orig.get(sname, {}))
            tmpl["name"] = sname
            tmpl["data"] = smap[sname]
            new_series.append(tmpl)
        cfg["series"] = new_series

    else:
        # ── 单系列：直接取 value 列表 ────────────────────────────────
        x_data = [r[axis_x] for r in rows]
        y_data = [r[axis_y] for r in rows]

        if "xAxis" in cfg:
            cfg["xAxis"]["data"] = x_data
        elif "yAxis" in cfg and isinstance(cfg["yAxis"], dict):
            cfg["yAxis"]["data"] = x_data   # 横向图分类在 yAxis

        if cfg.get("series"):
            cfg["series"][0]["data"] = y_data

    chart["config"] = json.dumps(cfg, ensure_ascii=False)
    return chart


# 用法：每个 SQL 图表保存后调用
# chart_list = [fetch_and_fill_chart(session, c) for c in chart_list]
# session.request("/save", base_save(report_id, designer, ..., chartList=chart_list))
```

### 注意

- `parse_sql` 用于 UNION SQL 时，传不含 UNION 的简化版（`LIMIT 1` 即可）
- `/qurestSql` 返回 `result` 是原始行列表（`list`），不是 dict
- 单系列饼图（`series=""`）：`rows` 直接是 `[{name,value}, ...]`，回填到 `series[0].data`

---
## 通用头部（大多数图表共用，按需裁剪）

```python
TITLE  = {"show": True, "text": "标题", "left": "left", "top": "5",
           "textStyle": {"fontSize": 18, "fontWeight": "bolder", "color": "#c23531"}}
LEGEND = {"show": True, "top": "top", "left": "center", "orient": "horizontal",
          "data": [], "padding": [25, 20, 25, 10], "textStyle": {"color": "#333", "fontSize": 12}}
GRID   = {"left": 60, "top": 60, "right": 100, "bottom": 60}
TIP    = {"show": True, "textStyle": {"color": "#fff", "fontSize": 18}}
TIP_AXIS = {**TIP, "trigger": "axis", "axisPointer": {"type": "shadow"},
            "appendToBody": True, "confine": True}
XCAT   = {"show": True, "type": "category", "data": []}  # 分类X轴
YVAL   = {"show": True, "type": "value"}                  # 数值Y轴
YCAT   = {"show": True, "type": "category", "data": []}  # 横向图分类Y轴
XVAL   = {"show": True, "type": "value"}                  # 横向图数值X轴
```

---

## 8. 配置模板

### bar.simple — 单系列柱状图

```python
{"title": TITLE, "grid": GRID, "tooltip": TIP,
 "xAxis": {"show": True, "data": []}, "yAxis": {"show": True},
 "series": [{"name": "", "type": "bar", "data": [], "barWidth": 50,
             "itemStyle": {"barBorderRadius": 0, "color": "#c43632"}}]}
```

### bar.background — 带背景柱状图

> 与 bar.simple 区别：series 增加 `showBackground` + `backgroundStyle`
>
> **⚠️ extData.chartType 必须保持 `bar.simple`，不能写 `bar.background`**
> 引擎不识别 `bar.background`，会导致坐标轴正常但柱体数据全部消失。
> 带背景效果只需在 echarts series 层配置，与 chartType 无关。

```python
# 同 bar.simple，series 中增加：
"showBackground": True,
"backgroundStyle": {"color": "rgba(220, 220, 220, 0.8)"},
# tooltip 增加：
"formatter": "{b} : {c}"
```

### bar.multi — 多系列柱状图

> 多系列增加 legend；tooltip 用 axis 触发；SQL/API 数据集时 series 留空由引擎填充

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP_AXIS,
 "xAxis": XCAT, "yAxis": {"show": True},
 # 必须保留一个带 itemStyle 的占位条目，否则前端 getSeriesItemStyle 读 series[0] 崩溃
 # 引擎运行时用真实数据替换；JSON静态数据集需手动预填每个 series
 "series": [{"type": "bar", "data": [], "barWidth": 15,
             "itemStyle": {"color": "", "barBorderRadius": 0}}]}
```

### bar.stack — 堆叠柱状图

> `stack` 同名的系列会堆叠；`stack=""` 不参与堆叠

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP_AXIS,
 "xAxis": XCAT, "yAxis": {"show": True},
 "series": [{"type": "bar", "name": "系列A", "stack": "总量", "data": [], "barWidth": 15,
             "itemStyle": {"color": "", "barBorderRadius": 0}}]}
```

### bar.negative — 正负条形图

> **轴方向与普通柱图相反**：yAxis 放分类，xAxis 放数值；负值用负数

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP_AXIS,
 "yAxis": {"show": True, "type": "category", "data": []},
 "xAxis": {"show": True, "type": "value", "splitLine": {"show": True}},
 "series": [
     {"type": "bar", "name": "正值", "stack": "总量", "data": [], "barWidth": 25,
      "itemStyle": {"color": "", "barBorderRadius": 0}, "label": {"show": True}},
     {"type": "bar", "name": "负值", "stack": "总量", "data": [], "barWidth": 25,
      "itemStyle": {"color": "", "barBorderRadius": 0}, "label": {"show": True, "position": "left"}},
 ]}
```

### bar.horizontal — 横向柱状图

> 单系列横向；label position 为 `"right"`

```python
{"title": TITLE, "grid": GRID, "tooltip": TIP_AXIS,
 "yAxis": YCAT, "xAxis": XVAL,
 "series": [{"type": "bar", "name": "", "data": [], "barWidth": 0,
             "itemStyle": {"color": "", "barBorderRadius": 0},
             "label": {"show": True, "position": "right",
                       "textStyle": {"color": "black", "fontSize": 16, "fontWeight": "bolder"}}}]}
```

### bar.multi.horizontal — 多系列横向柱状图

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP_AXIS,
 "yAxis": YCAT, "xAxis": XVAL,
 "series": []}  # 引擎动态生成，每个系列 label.position="right"
```

### bar.stack.horizontal — 堆叠横向柱状图

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP_AXIS,
 "yAxis": YCAT, "xAxis": XVAL,
 "series": [{"type": "bar", "name": "", "stack": "总量", "data": [], "barWidth": 15,
             "itemStyle": {"color": "", "barBorderRadius": 0}}]}
```

---

### line.simple — 单系列折线图

> **四种折线变体：** smooth=True → line.smooth；isArea=True + areaStyle.color="#c43632" → line.area；step=True → line.step

```python
{"title": TITLE, "grid": GRID, "tooltip": TIP,
 "xAxis": {"show": True, "data": []}, "yAxis": {"show": True},
 "series": [{"type": "line", "name": "", "data": [],
             "smooth": False, "step": False, "isArea": False,
             "areaStyle": {"color": "rgba(220,38,38,0)", "opacity": 1},
             "showSymbol": True, "symbolSize": 5,
             "lineStyle": {"width": 2}, "itemStyle": {"color": "#c43632"}}]}
```

### line.multi — 多系列折线图

> xAxis 增加 `boundaryGap: True`；引擎动态生成 series

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID,
 "tooltip": {**TIP, "trigger": "axis", "appendToBody": True, "confine": True},
 "xAxis": {"show": True, "type": "category", "boundaryGap": True, "data": []},
 "yAxis": YVAL, "series": []}
```

---

### pie.simple — 饼图

> data 每项为 `{name, value, itemStyle:{color:None}}`，不是平铺数组
>
> | chartType | isRose | isRadius | roseType | radius |
> |-----------|--------|----------|----------|--------|
> | pie.simple   | False | False | ""       | "55%" |
> | pie.doughnut | False | True  | ""       | ["45%","55%"] |
> | pie.rose     | True  | False | "radius" | "55%" |
>
> `autoSort: False`=不排序；`notCount: False`=显示零值；百分比：formatter 末尾追加 `({d}%)`

```python
{"title": TITLE, "legend": LEGEND,
 "series": [{"type": "pie", "name": "", "radius": "55%", "center": [320, 180],
             "isRose": False, "isRadius": False, "roseType": "",
             "minAngle": 0, "autoSort": False, "notCount": False,
             "data": [],
             "label": {"show": True, "position": "outside",
                       "textStyle": {"fontSize": 16, "fontWeight": "bolder"}}}],
 "tooltip": {**TIP, "formatter": "{a} <br/>{b} : {c}"}}
```

### pie.doughnut — 环形图

```python
# 同 pie.simple，series 中修改：
"isRadius": True, "radius": ["45%", "55%"]
```

### pie.rose — 玫瑰图

```python
# 同 pie.simple，series 中修改：
"isRose": True, "roseType": "radius"
```

---

### mixed.linebar — 折柱混合图

> 根级有 `"chartType": "linebar"`；yAxis 是**数组**（双 Y 轴）；右轴系列设 `yAxisIndex: 1`

```python
{"chartType": "linebar",
 "title": TITLE, "legend": LEGEND, "grid": GRID,
 "tooltip": {**TIP, "trigger": "axis", "axisPointer": {"type": "cross", "crossStyle": {"color": "#999"}},
             "appendToBody": True, "confine": True},
 "xAxis": {"show": True, "type": "category", "data": [], "axisPointer": {"type": "shadow"}},
 "yAxis": [{"show": True, "name": "左轴", "type": "value"},
           {"show": True, "name": "右轴", "type": "value"}],
 "series": [
     {"type": "bar",  "name": "柱系列", "data": [], "barWidth": 15,
      "itemStyle": {"color": "", "barBorderRadius": 0}},
     {"type": "line", "name": "线系列", "data": [], "yAxisIndex": 1,
      "smooth": False, "showSymbol": True, "symbolSize": 5,
      "lineStyle": {"width": 2}, "itemStyle": {"color": ""}},
 ]}
```

---

### gauge.simple — 360° 仪表盘

> 无 xAxis/yAxis；data 单项 `{name, value}`；`axisLine.lineStyle.color` 为分段数组，最后项比例必须为 `1`
>
> | chartType | startAngle | endAngle | radius |
> |-----------|-----------|---------|--------|
> | gauge.simple    | 无（225°默认） | 无（-45°默认） | "75%" |
> | gauge.simple180 | 190           | -10           | 无     |

```python
{"title": TITLE,
 "series": [{"type": "gauge", "name": "业务指标",
             "center": [330, 200], "radius": "75%",  # simple180: 去掉radius，改为startAngle:190, endAngle:-10
             "pointer": {"show": True},
             "data": [{"name": "完成率", "value": 50}],
             "itemStyle": {"color": "#63869E"},
             "axisLine": {"lineStyle": {"width": 25,
                                        "color": [[0.2, "#91c7ae"], [0.8, "#63869E"], [1, "#C23531"]]}},
             "axisTick":  {"length": 10, "lineStyle": {"color": "#fff"}},
             "splitLine": {"length": 30, "lineStyle": {"color": "#fff", "width": 3}},
             "axisLabel": {"show": True, "color": "auto", "textStyle": {"fontSize": 10}},
             "title":  {"show": True, "textStyle": {"color": "#000", "fontSize": 20}},
             "detail": {"formatter": "{value}%",
                        "textStyle": {"color": "rgba(0,0,0,1)", "fontSize": 25}}}],
 "tooltip": {**TIP, "formatter": "{b} : {c}"}}
```

### gauge.simple180 — 180° 半圆仪表盘

```python
# 同 gauge.simple，series 中修改：
"startAngle": 190, "endAngle": -10
# 删除 "radius" 字段
```

---

### scatter.simple — 普通散点图

> data 每项是 `[x, y]` 二元数组；无 legend

```python
{"title": TITLE, "grid": GRID,
 "tooltip": {**TIP, "formatter": "{c}"},
 "xAxis": {"show": True, "name": ""}, "yAxis": {"show": True, "name": ""},
 "series": [{"type": "scatter", "symbolSize": 20, "data": [],
             "itemStyle": {"color": "#C23531", "opacity": 1},
             "label": {"show": True, "formatter": "{c}", "position": "top", "opacity": 1}}]}
```

### scatter.bubble — 气泡散点图

> 多系列 + legend；`itemStyle.color` 使用径向渐变对象

```python
{"title": TITLE, "legend": LEGEND, "grid": GRID, "tooltip": TIP,
 "xAxis": {"show": True, "name": ""}, "yAxis": {"show": True, "name": ""},
 "series": [
     {"type": "scatter", "name": "系列A", "symbolSize": 20, "data": [],  # 每项 [x, y]
      "itemStyle": {
          "color": {"type": "radial", "r": 0.8,
                    "colorStops": [{"offset": 0, "color": "#E7727C"},
                                   {"offset": 1, "color": "#D7291F"}]},
          "shadowBlur": 10, "shadowColor": "rgba(25,100,150,0.5)", "shadowOffsetY": 5}},
 ]}
```

---

### funnel.simple — 漏斗图

> data 每项为 `{name, value}`；sort="descending"=漏斗形；sort="ascending"=金字塔形（funnel.pyramid）；sort="none"=原始顺序

```python
{"title": TITLE, "legend": LEGEND,
 "series": [{"type": "funnel", "name": "漏斗图",
             "orient": "vertical", "sort": "descending",  # funnel.pyramid 改为 "ascending"
             "left": "10%", "width": "80%", "top": 60, "bottom": 60, "gap": 2,
             "data": [],
             "itemStyle": {"borderColor": "#fff", "borderWidth": 1},
             "label": {"show": True, "position": "inside",
                       "textStyle": {"fontSize": 16, "fontWeight": "normal"}},
             "emphasis": {"label": {"fontSize": 20}}}],
 "tooltip": {**TIP, "trigger": "item", "formatter": "{b} : {c}"}}
```

### funnel.pyramid — 金字塔图

```python
# 同 funnel.simple，series 中修改：
"sort": "ascending", "name": "金字塔漏斗图"
```

---

### radar.basic — 多边形雷达图

> `indicator` 顺序必须与 `series[].data[].value` 数组严格一一对应
>
> | chartType | shape | 特有字段 |
> |-----------|-------|---------|
> | radar.basic  | "polygon" | 无 |
> | radar.custom | "circle"  | startAngle:90, splitNumber:4, radius:90(px), splitArea（渐变填充） |

#### ⚠️ SQL数据集必须用「长格式」，不能用「宽格式」

**错误根因（已踩坑 2026-05-25）**：JimuReport 前端的图表填充机制对多系列雷达图期望「每行=一个(维度, 系列, 值)」的长格式。若传宽格式（每行=一个系列，多列=各维度），前端会把系列名作为 indicator 轴、把单列值展平成数组，导致：
- 雷达图变成以系列名命名的三角形（维度数=系列数而非实际维度数）
- legend 显示 `undefined`（因 series[0].data 被覆盖为普通数字数组，`.name` 属性为 undefined）
- 设置 `apiStatus="0"` 或手动写入 config 均无效，前端每次渲染都会用 `/qurestSql` 覆盖

**正确做法：SQL 用 UNION 转长格式 + extData.series 设为系列列名**

```sql
-- 宽格式表 radar_demo (id, name, attack, defense, speed, magic, endurance)
-- 转成长格式查询：
SELECT '攻击力' AS dimension, name, attack    AS score FROM radar_demo
UNION ALL SELECT '防御力', name, defense  FROM radar_demo
UNION ALL SELECT '速度',   name, speed    FROM radar_demo
UNION ALL SELECT '魔法值', name, magic    FROM radar_demo
UNION ALL SELECT '耐力',   name, endurance FROM radar_demo
ORDER BY name, dimension
```

**extData 绑定**：

| 属性 | 值 | 含义 |
|------|----|------|
| axisX | `dimension` | 维度列 → radar indicator 轴名 |
| axisY | `score` | 值列 → 各维度得分 |
| series | `name` | 系列列 → 每条折线/区域（如英雄名） |

前端会自动 pivot：unique(dimension) → indicator[]，按 name 分组 → series[].data[].value[]。

**ECharts config 初始模板（留空让前端填充）**：

```python
{"title": TITLE, "legend": LEGEND,
 "radar": [{"shape": "polygon",  # radar.custom 改为 "circle"，并加 radius:90, startAngle:90, splitNumber:4, splitArea
            "center": [320, 200],
            "indicator": [],   # 前端自动从 dimension 列填充
            "name": {"formatter": "{value}", "textStyle": {"color": "#72ACD1", "fontSize": 14}},
            "axisLine": {"lineStyle": {"color": "gray", "opacity": 0.5}},
            "splitLine": {"lineStyle": {"color": "gray", "opacity": 0.5}}}],
 "series": [{"type": "radar", "data": []}],   # 前端自动从 name+score 列填充
 "tooltip": TIP}
```

### radar.custom — 圆形雷达图

```python
# 同 radar.basic，radar[] 中修改：
"shape": "circle", "radius": 90, "startAngle": 90, "splitNumber": 4,
"splitArea": {"areaStyle": {
    "color": ["rgba(114,172,209,0.2)", "rgba(114,172,209,0.4)",
              "rgba(114,172,209,0.6)", "rgba(114,172,209,0.8)", "rgba(114,172,209,1)"],
    "shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.3)"}}
```

---

### graph.simple — 关系图

> **⚠️ 关键规则（实测 2026-04-10）：**
> 1. `extData` 只需 `{"chartId": layer_id, "chartType": "graph.simple"}`，**不绑定数据集**
> 2. 节点+边全部内嵌在 `config` JSON 的 `series[0].data` 和 `series[0].links` 中
> 3. `data[].category` 是 `categories` 数组的整数下标（0-based），**不是字符串**
> 4. `virtualCellRange` 只放**一行**锚点行（不是全部占用行）
> 5. `colspan`/`rowspan` 正常填写（如 7/14），与 virtualCellRange 无关
> 6. 不需要任何 JSON 数据集 —— config 自包含所有数据

```python
echarts_cfg = {
    "title": {"padding": [5,20,5,20], "left": "left", "show": True,
              "text": "报表标题", "textStyle": {"color": "#c23531", "fontSize": 18, "fontWeight": "bolder"}},
    "legend": {"padding": [25,20,25,10], "data": ["分类1","分类2"],
               "top": "top", "orient": "horizontal", "left": "center", "show": True,
               "textStyle": {"color": "#333", "fontSize": 12}},
    "tooltip": {"show": True, "textStyle": {"color": "#fff", "fontSize": 18},
                "backgroundColor": "rgba(50,50,50,0.7)", "padding": [5,4], "borderWidth": 0},
    "color": ["#c23531","#2f4554","#61a0a8","#d48265","#91c7ae","#749f83"],
    "series": [{"type": "graph", "name": "关系图",
                "layout": "circular",   # "circular"=环形 / "force"=力引导
                "center": [320, 150],
                "lineStyle": {"curveness": 0.3, "color": "source"},
                "label": {"show": True, "position": "right",
                          "textStyle": {"color": "#333", "fontSize": 12}},
                "data": [
                    {"name": "节点A", "category": 0, "value": 28},  # category=整数下标
                    {"name": "节点B", "category": 1, "value": 15},
                ],
                "links": [
                    {"source": "节点A", "target": "节点B"},  # 必须与 data[].name 严格匹配
                ],
                "categories": [
                    {"name": "分类1", "itemStyle": {"color": ""}},
                    {"name": "分类2", "itemStyle": {"color": ""}},
                ]}]
}

layer_id = gen_id()
chart_item = {
    "row": ROW, "col": COL, "colspan": 7, "rowspan": 14,
    "width": "650", "height": "350",
    "config": json.dumps(echarts_cfg, ensure_ascii=False),
    "url": "",
    "extData": {"chartId": layer_id, "chartType": "graph.simple"},  # 仅这两个字段！
    "layer_id": layer_id, "offsetX": 0, "offsetY": 0,
    "backgroud": {"enabled": False, "color": "#fff", "image": ""},
    "virtualCellRange": [[ROW, c] for c in range(COL, COL + 7)],   # 只有一行锚点！
}
# rows 也只需一行
chart_rows = {str(ROW): {"cells": {str(c): {"text": " ", "virtual": layer_id}
                                    for c in range(COL, COL + 7)}}}
```

---

### pictorial.spirits — 象形柱图

> 类型为 `pictorialBar`；横向布局（yAxis=分类，xAxis=数值）；xAxis.max 须与 symbolBoundingData 一致
> **⚠️ 图标名称只用字母，否则上传失败**

```python
{"title": TITLE, "grid": GRID,
 "yAxis": {"show": True, "name": "", "data": [],
           "axisTick": {"show": False},
           "axisLabel": {"textStyle": {"color": "#999", "fontSize": 16}}},
 "xAxis": {"show": True, "name": "", "max": 2000},  # max 须与 symbolBoundingData 一致
 "series": [{"type": "pictorialBar", "data": [],
             "symbol": "",           # "path://..." 或 "image://url"
             "symbolSize": 30, "symbolRepeat": "fixed", "symbolMargin": "5%!",
             "symbolBoundingData": 2000, "symbolClip": True, "secondOpacity": 0.2,
             "label": {"show": True, "position": "right",
                       "textStyle": {"color": "black", "fontSize": 16, "fontWeight": "bolder"}}}]}
```

---

### map.simple — 区域地图

> 根级必须有 `"chartType": "map"`；无 xAxis/yAxis，用 `geo` 定义地图；series 只需 `name` + `coordinateSystem`（无 type 字段）
>
> **⚠️ 不需要数据集**：区域地图的边界数据来自系统内部 GeoJSON 接口，**禁止调 `save_db` 创建数据集**。
> `extData` 只需 `{"chartId": layer_id, "chartType": "map.simple"}`，不绑 dataId/dbCode。

> **地图级别切换 API**：`/map/queryMapByCode`
> - 全国：`{"name":100000, "label":"中华人民共和国", "mapType":"0"}`
> - 省级：`{"name":530000, "label":"云南省", "mapType":"1"}`
>
> **geo.map 用地区编码字符串**（不是 "china"）：全国=`"100000"`，省级=`"530000"`，市级=`"430200"`
> **geo 必须包含**：`mapCode`、`mapName`、`mapLevel`、`mapType`
>
> **mapCode 规则**：从省到当前级别的完整路径数组：
> - 全国 (level "0")：`[100000]`（整数）
> - 省级 (level "1")：`[440000]`（整数）
> - 市级 (level "2")：`["430000", "430200"]`（字符串，省编码 + 市编码）
> - 县区级 (level "3")：`["430000", "430200", "430211"]`（字符串，省 + 市 + 区编码）

```python
# 全国地图
{"chartType": "map",
 "title": TITLE,
 "tooltip": {"show": True, "trigger": "item", "textStyle": {"color": "#fff", "fontSize": 13},
             "backgroundColor": "rgba(50, 50, 50, 0.7)", "padding": [5, 4], "borderWidth": 0},
 "geo": {"map": "100000", "mapCode": [100000], "mapName": "中华人民共和国", "mapLevel": "0", "mapType": "0",
         "layoutCenter": ["50%", "50%"], "layoutSize": 600,
         "zoom": 0.7, "roam": True, "regions": [],
         "label": {"show": False, "color": "#fff", "fontSize": 12},
         "itemStyle": {"areaColor": "#224C66", "borderColor": "#0692a4", "borderWidth": 1},
         "emphasis": {"itemStyle": {"areaColor": "#0b1c2d"}, "label": {"color": "#fff"}}},
 "series": [{"name": "地图", "coordinateSystem": "geo"}],
 "color": ["#c23531","#2f4554","#61a0a8","#d48265","#91c7ae","#749f83","#ca8622","#bda29a","#6e7074","#546570","#c4ccd3"]}

# 省级地图（以云南省为例）— 修改 geo 中 5 个字段：
# geo.map="530000", geo.mapCode=[530000], geo.mapName="云南省", geo.mapLevel="1", geo.mapType="1"
# 注意：省级 mapCode 是整数数组 [530000]，市级及以下才用字符串数组

# 市级地图（以株洲市为例）— mapCode 需含上级省编码：
# geo.map="430200", geo.mapCode=["430000","430200"], geo.mapName="株洲市", geo.mapLevel="2", geo.mapType="2"
```

### map.scatter — 点地图

> series type 为 `"scatter"`；data[].name 需匹配内置城市坐标库（省会/直辖市）
> 系统根据 name 自动解析经纬度，data 格式：`{name: "省名", value: [经度, 纬度, 数据值]}`
>
> **extData 要点**：
> - `isCustomPropName: True`，`xText: "name"`, `yText: "value"`（分类/值属性）
> - `axisX` = `"name"`（跟随 xText），`axisY` = `"value"`（跟随 yText）
> - `dataType: "api"`, `apiStatus: "1"`
>
> **series.name** = yText 的值（如 `"value"`），不是空字符串

```python
# 同 map.simple 的 geo/tooltip/color，series 改为：
{"type": "scatter", "name": "value", "coordinateSystem": "geo",
 "encode": {"value": [2]},
 "itemStyle": {"color": "#F4E925"},
 "label": {"show": False, "formatter": "{b}", "position": "right"},
 "emphasis": {"label": {"show": True}},
 "data": []}  # 系统自动填充：{name: "河北", value: [114.502461, 38.045474, null]}
# 散点样式：symbolSize 控制大小，itemStyle.opacity 控制透明度（不要用 rgba 的 alpha）
# 示例：symbolSize=20, itemStyle={"color": "rgba(255,0,0,1)", "opacity": 0.3}
```
