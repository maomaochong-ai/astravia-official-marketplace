# 图表与组件配置参考（组件 + chartList 结构）

积木报表支持 4 种图层组件和 30+ 图表类型的完整配置参考。

> 本文件含：sections 1-7（imgList/barcodeList/qrcodeList/displayConfig/chartList 结构）
> ECharts 模板见 chart-echarts-templates.md；常用属性速查见 chart-echarts-props.md

---

## 1. 组件类型总览

| 组件 | jsonStr 字段 | 用途 |
|------|-------------|------|
| 图片 | `imgList` | 外部图片/Logo/背景图 |
| 图表 | `chartList` | ECharts 可视化图表 |
| 条形码 | `barcodeList` | CODE128/EAN 等一维码 |
| 二维码 | `qrcodeList` | QR Code 二维码 |

所有组件共享基础属性：`row`, `col`, `colspan`, `rowspan`, `width`, `height`, `layer_id`, `offsetX`, `offsetY`, `virtualCellRange`

## 2. Virtual Cell 占位规则

所有图层组件都需要在 `rows` 中声明 virtual 占位：

```python
for r in range(row_start, row_end + 1):
    cells = {}
    for c in range(col_start, col_end + 1):
        cells[str(c)] = {"text": " ", "virtual": layer_id}
    rows_data[str(r)] = {"cells": cells}
```

**注意：** `virtual` 值必须和 `layer_id` 一致；`text` 必须为 `" "`（一个空格）；组件区域不能和数据行重叠。

## 3. 图片组件 (imgList)

```python
{
    "row": 0, "col": 1, "colspan": 0, "rowspan": 0,
    "width": 315, "height": 151,       # 数字
    "src": "/jmreport/img/upload/xxx.png",
    "isBackend": False, "isBackendImg": False,
    "layer_id": "img_xxx",
    "offsetX": 0, "offsetY": 0,
    "virtualCellRange": [[0,1],[0,2],[1,1],[1,2]]
}
```

## 4. 条形码组件 (barcodeList)

```python
{
    "row": 3, "col": 0, "colspan": 0, "rowspan": 0,
    "width": 300, "height": 200,
    "layer_id": "barcode_xxx",
    "offsetX": 0, "offsetY": 0,
    "jsonString": json.dumps({
        "barcodeContent": "jmreport",   # 支持 ${dbCode.field} 动态绑定
        "format": "CODE128",            # CODE128/CODE39/EAN13/EAN8/UPC/ITF14
        "width": 2, "height": 100,
        "displayValue": False,
        "text": "jmreport",
        "fontSize": 20, "background": "#fff", "lineColor": "#000", "margin": 10
    }),
    "virtualCellRange": [[3,0],[3,1],[4,0],[4,1]]
}
```

## 5. 二维码组件 (qrcodeList)

```python
{
    "row": 5, "col": 0, "colspan": 0, "rowspan": 0,
    "width": 128, "height": 128,
    "layer_id": "qrcode_xxx",
    "offsetX": 0, "offsetY": 0,
    "jsonString": json.dumps({
        "text": "http://jimureport.com/",  # 支持 ${dbCode.field}
        "width": 128, "height": 128,
        "colorDark": "#000000", "colorLight": "#ffffff"
    }),
    "virtualCellRange": [[5,0],[5,1],[6,0],[6,1]]
}
```

## 6. 单元格内嵌组件 (displayConfig)

```python
cell = {"text": "#{dbCode.imgUrl}", "display": "img"}                          # 图片
cell = {"text": "#{dbCode.code}",   "display": "barcode", "config": "bc1"}   # 条形码
cell = {"text": "#{dbCode.url}",    "display": "qrcode",  "config": "qr1"}   # 二维码
# config 引用 displayConfig 中的配置ID
# 条形码 displayValue 默认 false（不显示文字），需传完整字段
# 详见 references/report-design.md 第7节 displayConfig
```

---

## 7. 图表组件 (chartList)

### 图表模板文件

`src/main/resources/static/jmreport/desreport_/chartjson/`

可通过 `GET /jmreport/addChart?chartType=bar.simple` 获取模板配置。

### 图表分类速查

#### 柱状图 (Bar)

| chartType | 说明 | 数据集要求 |
|-----------|------|-----------|
| `bar.simple` | 单系列柱状图 | `name, value` |
| `bar.multi` | 多系列柱状图 | `name, value, type` |
| `bar.stack` | 堆叠柱状图 | `name, value, type` |
| `bar.horizontal` | 横向柱状图 | `name, value` |
| `bar.multi.horizontal` | 横向多系列 | `name, value, type` |
| `bar.stack.horizontal` | 横向堆叠 | `name, value, type` |
| `bar.negative` | 正负柱状图 | `name, value, type` |
| `bar.background` | 带背景柱状图 | `name, value` |

#### 折线图 (Line)

| chartType | 说明 | 数据集要求 |
|-----------|------|-----------|
| `line.simple` | 单系列折线图 | `name, value` |
| `line.multi` | 多系列折线图 | `name, value, type` |
| `line.smooth` | 平滑曲线图 | `name, value` |
| `line.area` | 面积图 | `name, value, type` |
| `line.step` | 阶梯折线图 | `name, value` |

#### 饼图 (Pie)

| chartType | 说明 | 数据集要求 |
|-----------|------|-----------|
| `pie.simple` | 饼图 | `name, value` |
| `pie.doughnut` | 环形图 | `name, value` |
| `pie.rose` | 玫瑰图 | `name, value` |

#### 散点图 (Scatter)

| chartType | 说明 | 数据集要求 |
|-----------|------|-----------|
| `scatter.simple` | 普通散点图 | 特殊（[x,y]二元数组） |
| `scatter.bubble` | 气泡散点图 | 特殊（多系列[x,y]，径向渐变色） |

#### 其他图表

| chartType | 说明 | 数据集要求 |
|-----------|------|-----------|
| `mixed.linebar` | 柱线混合图 | `name, value, type` |
| `gauge.simple` | 仪表盘 | `name, value` |
| `gauge.simple180` | 半圆仪表盘 | `name, value` |
| `radar.basic` | 多边形雷达图 | 特殊（indicator） |
| `radar.custom` | 圆形雷达图 | 特殊（indicator，shape:"circle"） |
| `funnel.simple` | 漏斗图 | `name, value` |
| `funnel.pyramid` | 金字塔图 | `name, value` |
| `map.simple` | 区域地图 | 特殊 |
| `map.scatter` | 地图散点 | 特殊 |
| `graph.simple` | 关系图 | 特殊（需两个数据集） |
| `pictorial.spirits` | 象形柱图 | `name, value` |

> **⚠️ id 与模板 type 的映射关系（重要）**
>
> `chart_type_list.js` 中每个图表有 `id`（唯一标识）和 `type`（请求后端模板用的类型）两个字段，部分图表两者不同。`extData.chartType` 和 `addChart?chartType=` 接口都**使用 id**，不是 type。
>
> | id（extData.chartType 传此值） | type（内部模板类型） |
> |-------------------------------|---------------------|
> | `bar.background` | `bar.simple` |
> | `bar.negative` | `bar.stack.horizontal` |
> | `funnel.pyramid` | `funnel.simple` |
> | `radar.custom` | `radar.basic` |
> | 其他所有图表 | id == type（相同） |

### chartList 结构

```python
{
    "row": 0, "col": 0,
    "colspan": 7,            # col_end - col + 1，不是 0
    "rowspan": 14,           # row_end - row + 1，不是 0
    "width": "650",          # ⚠️ 必须是字符串，传整数不生效（2026-04-03 实测）
    "height": "350",         # ⚠️ 必须是字符串，传整数不生效（2026-04-03 实测）
    "config": json.dumps(echarts_option),  # ECharts 配置 JSON 字符串
    "url": "",
    "extData": {             # dict 对象，不是 JSON 字符串（浏览器实测 2026-04-02）
        "chartId": "chart_xxx",      # 必须等于 layer_id！
        "id": "chart_xxx",           # 必须等于 layer_id！
        "chartType": "bar.simple",   # 图表类型；多系列对比用 "bar.multi"（见下方说明）
        # ── 数据集绑定 ──────────────────────────────
        "dataType": "api",           # "sql"/"api"/"json"/"javabean"
        "apiStatus": "1",            # JSON静态数据集用 "0"，SQL/API动态数据集用 "1"
        "dataId": "数据集ID",
        "dataId1": "",               # 第二数据集（graph.simple 双数据集用）
        "dbCode": "数据集编码",
        "axisX": "name",             # X轴字段（标准模式，isCustomPropName=False 时生效）
        "axisY": "value",            # Y轴字段（标准模式）
        "series": "type",            # 系列字段（单系列/自定义属性模式传 ""）
        # ── 自定义属性模式（UI 上"自定义属性"开关）────────────
        # isCustomPropName=True 时，xText/yText 优先生效（对应 UI 分类属性/值属性下拉）
        # isCustomPropName=False 时，xText/yText 置空，用 axisX/axisY
        "isCustomPropName": False,   # True=启用自定义属性
        "xText": "",                 # 分类属性（UI: 分类属性）启用自定义时填字段名
        "yText": "",                 # 值属性（UI: 值属性）启用自定义时填字段名
        # ── 联动/钻取 ────────────────────────────────
        "linkIds": "",
        "source": "", "target": "",  # graph 图用
        # linkIds 中钻取配置对象的关键字段：
        # "ejectType": "0"  →  新窗口打开（linkType=0报表钻取/linkType=1网络链接时生效）
        # "ejectType": "1"  →  当前窗口打开
        # "ejectType": ""   →  默认（初始值为空字符串）
        # 注意：linkType=2（图表联动）时 ejectType 不生效
        # "requirement": ""  →  触发条件表达式，空字符串=无条件触发
        # ── 定时刷新（design.js:627-628 实测）──────────────────
        # 禁用：isTiming=False（布尔，不是空字符串 ""）
        # 启用：isTiming=True   intervalTime="5"（字符串秒数，默认"5"）
        "isTiming": False,
        "intervalTime": "5",
    },
    "layer_id": "chart_xxx",
    "offsetX": 0, "offsetY": 0,
    "backgroud": {"enabled": False, "color": "#fff", "image": "", "repeat": "repeat"},
    # 注意：
    #   - 拼写是 backgroud（非 background）
    #   - image URL 格式：上传返回 message="jimureport/xxx.png"，存储时加 "/" 前缀
    #     → image = "/jimureport/xxx.png"（不是 /jmreport/img/jimureport/xxx.png）
    #   - 报表 Sheet 背景图（background.path）才用 /jmreport/img/ 前缀，两者不同！
    "virtualCellRange": [[0,0],[0,1],...]   # 只标第一行
}
```

> **关键：**
> - `width`/`height` **必须是字符串**（`"650"`/`"350"`），传整数不生效
> - **单系列**：`chartType="bar.simple"`，`apiStatus="1"`，`series=""`，ECharts xAxis.data/series[].data 留空由引擎填充
> - **多系列对比（JSON数据集）**：`chartType="bar.multi"`，`apiStatus="0"`，**必须预填** `xAxis.data`、`series[].data`、`legend.data`，每个 series 需有 `typeData:[]` 字段；`series` 字段仍设为分组字段名（如 `"type"`）
> - **多系列对比（SQL/API数据集）**：`chartType="bar.multi"`，`apiStatus="1"`，`series="type"`，引擎运行时动态分组，ECharts xAxis.data/series[].data 可留空
> - **⚠️ mixed.linebar（折柱混合图）必须用 `apiStatus="0"` + 预填数据**（2026-04-07 实测）：即使绑定了 SQL 数据集，也必须预填 xAxis.data 和 series[].data；apiStatus="1" 会导致图表区域空白。此外 `xText`/`yText` 必须传实际字段名（如 `"name"`/`"value"`），不能为空字符串。每个 series 必须有 `typeData: [{name, type, _index, _rowKey}]` 字段。
> - `backgroud` 拼写有误但必须这样（不是 background）；完整结构含 `repeat` 字段；`colspan`/`rowspan` 是实际跨度

### 图表字段映射规则

> **重要：图表数据绑定使用固定的三个字段名 name/value/type，SQL 需要 AS 别名。**

```sql
-- 单系列
SELECT product_name AS name, sales_amount AS value, '' AS type FROM sales_table

-- 多系列
SELECT month AS name, amount AS value, category AS type FROM sales_table

-- 仪表盘
SELECT '完成率' AS name, ROUND(done*100/total) AS value, '' AS type FROM task_summary
```
