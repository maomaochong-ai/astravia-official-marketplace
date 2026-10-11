# 报表钻取与联动（超链接设置）

报表钻取与联动：点击单元格或图表元素时，跳转到另一个报表/URL（钻取），或重新渲染当前报表内的其他图表（联动）。

---

## 1. 类型总览（linkType）

| linkType | 类型 | 触发方式 | 目标 | 场景 |
|----------|------|---------|------|------|
| `"0"` | **报表钻取** | 点击单元格/图表 | 跳转到目标报表 | 汇总→明细逐层查看 |
| `"1"` | **网络链接** | 点击单元格/图表 | 跳转到外部URL | 跳转第三方系统 |
| `"2"` | **联动（图表刷新）** | 点击单元格/图表 | 当前报表内的其他图表重新渲染 | 表格→图表刷新、图表→图表刷新 |
| `"4"` | **主子表联动** | 自动（渲染时） | 当前报表内子表数据过滤 | 多源报表主子关联 |

**三者区别：**
- **钻取（0/1）**：点击 → **跳转**到其他页面（导航）
- **联动（2）**：点击 → 当前页面内**图表刷新**（不跳转，图表数据集带参重新查询）
- **主子表联动（4）**：渲染时**自动传参**（不需要点击，见 `examples/multi-source-table.md`）

---

## 2. API 接口

### 新增/编辑钻取配置

`POST /jmreport/link/saveAndEdit`

不传 id = 新增，传 id = 编辑。返回 `result` 为 linkId。

### 查询钻取配置

`GET /jmreport/link/getLinkData?linkType=0&reportId={reportId}`

### 按 ID 批量查询

`GET /jmreport/link/queryByIds?ids={id1},{id2}`

### 删除钻取配置

`POST /jmreport/link/delete`

```python
api_request('/jmreport/link/delete', {"id": "1197359199185883136"})
# 返回: {"success": true, "result": "删除成功!"}
```

---

## 3. 完整 JSON 结构

### 3.1 报表钻取报表（linkType=0）

点击单元格 → 跳转到目标报表

```json
{
    "id": "1064085522512957440",
    "reportId": "ce07b22a7174f8e620da2f3126fb846a",
    "parameter": "[{\"paramName\":\"update_by\",\"paramValue\":\"id\",\"tableIndex\":0,\"dbCode\":\"pop\",\"fieldName\":\"update_by\"}]",
    "ejectType": "1",
    "linkName": "钻取",
    "apiMethod": "",
    "linkType": "0",
    "apiUrl": "",
    "linkChartId": null,
    "requirement": ""
}
```

### 3.2 报表网络钻取（linkType=1）

点击单元格 → 跳转到外部 URL

```json
{
    "id": "",
    "reportId": "1197357904953692160",
    "parameter": "[{\"paramName\":\"name\",\"paramValue\":\"name\",\"paramCell\":\"\",\"tableIndex\":1,\"dbCode\":\"pop\",\"fieldName\":\"id\"}]",
    "ejectType": "1",
    "linkName": "网络钻取",
    "apiMethod": "",
    "linkType": "1",
    "apiUrl": "http://www.baidu.com",
    "linkChartId": null,
    "requirement": "",
    "charId": ""
}
```

### 3.3 图表钻取（linkType=0/1）

图表钻取的 JSON 结构与报表钻取/网络钻取**完全一致**，区别仅在于 `parameter` 中的 `paramValue` 使用图表专用属性：

| paramValue | 含义 | 说明 |
|-----------|------|------|
| `name` | 图表分类属性（X轴） | 点击的柱子/扇区对应的分类名 |
| `value` | 图表值属性（Y轴） | 点击的柱子/扇区对应的数值 |
| `seriesName` | 图表系列属性 | 多系列图表中的系列名称 |

```json
{
    "id": "",
    "reportId": "ce07b22a7174f8e620da2f3126fb846a",
    "parameter": "[{\"paramName\":\"update_by\",\"paramValue\":\"value\",\"tableIndex\":0,\"dbCode\":\"pop\",\"fieldName\":\"\"}]",
    "ejectType": "0",
    "linkName": "图表钻取",
    "apiMethod": "",
    "linkType": "0",
    "apiUrl": "",
    "linkChartId": null,
    "requirement": "",
    "charId": ""
}
```

---

## 4. 字段详解

### link 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | 钻取配置ID（新增时不传，编辑时传） |
| `reportId` | String | linkType=0 时为**目标报表ID**；linkType=4 时为**当前报表ID** |
| `linkName` | String | 链接名称 |
| `linkType` | String | `"0"`=报表钻取, `"1"`=网络链接, `"2"`=图表联动, `"4"`=主子表联动 |
| `ejectType` | String | 弹出方式：`"0"`=新窗口, `"1"`=当前窗口 |
| `apiUrl` | String | 外部URL（linkType=1 时必填） |
| `apiMethod` | String | 请求方法（通常为空） |
| `linkChartId` | String | 联动图表ID（linkType=2 时使用） |
| `requirement` | String | 条件（可选） |
| `charId` | String | 图表钻取时关联的图表ID |
| `parameter` | String | **JSON 字符串**，参数映射数组 |

### parameter 参数结构（JSON 字符串内的数组元素）

```json
{
    "paramName": "update_by",     // 目标报表/URL 接收的参数名
    "paramValue": "id",           // 参数值来源（见下方规则）
    "paramCell": "",              // 单元格引用（可选）
    "tableIndex": 0,              // 数据集序号（0-based）
    "dbCode": "pop",              // 数据集编码
    "fieldName": "update_by"      // 字段名（用于回显）
}
```

### paramValue 取值规则

**单元格钻取时：**

| 类型 | 语法 | 示例 | 说明 |
|------|------|------|------|
| 字段引用 | `字段名` | `id`、`name` | 传递当前点击行中该字段的值（从数据集下拉选择） |
| 列表达式 | `=列字母` | `=B` | 传递当前点击行中 B 列单元格的值 |
| 固定单元格 | `=列字母行号` | `=B3` | 始终传递 B3 单元格的值，不随点击行变化 |
| 地址栏参数 | `param.参数名` | `param.sex` | 从浏览器地址栏获取 `?sex=xxx` 的值（v1.9.6+） |

**图表钻取时：**

| 类型 | paramValue | 说明 |
|------|-----------|------|
| X轴分类 | `name` | 点击的数据点对应的分类名称 |
| Y轴数值 | `value` | 点击的数据点对应的数值 |
| 系列名 | `seriesName` | 多系列图表中的系列名称 |

---

## 5. 单元格绑定钻取

创建钻取配置后，需要在报表 jsonStr 中将 linkId 绑定到触发钻取的单元格。

> **关键：linkIds 必须是逗号分隔的字符串（不是数组！），且单元格必须加 `display: "link"`**

```python
# 在触发钻取的单元格中添加 linkIds 和 display
"4": {
    "cells": {
        "1": {
            "text": "#{order.order_code}",
            "style": 2,
            "linkIds": "1064085522512957440",   # 逗号分隔的字符串，不是数组！
            "display": "link"                    # 必须标记为 link，否则不生效
        }
    }
}

# 多个钻取绑定到同一个单元格
"linkIds": "id1,id2"    # 用逗号分隔
```

**图表绑定钻取**：linkIds 放在 `extData` 内部（不是 chartList 顶层！）
```python
chart_list = [{
    "row": 15, "col": 1,
    "width": "540", "height": "350",
    "config": json.dumps(echarts_config),
    "extData": {
        "chartType": "bar.simple",
        "dataType": "sql",
        "dataId": "数据集ID",
        "dbCode": "sales",
        "axisX": "name", "axisY": "value", "series": "type",
        "linkIds": "link_id_here"   # 放在 extData 里面！字符串格式
    },
    # ...  注意：不要放在 chartList 顶层
}]
```

---

## 6. 完整流程示例

### 6.1 报表钻取报表

**场景**：汇总表 → 点击订单编号 → 跳转到明细报表

```python
# Step 1: 创建钻取配置
link_data = {
    "linkName": "查看明细",
    "linkType": "0",                          # 报表钻取
    "reportId": detail_report_id,             # 目标明细报表ID
    "ejectType": "0",                         # 新窗口
    "apiUrl": "",
    "apiMethod": "",
    "requirement": "",
    "parameter": json.dumps([                 # 注意: parameter 是 JSON 字符串
        {
            "paramName": "order_id",          # 目标报表 SQL 中的 ${order_id}
            "paramValue": "id",               # 当前行的 id 字段值
            "tableIndex": 0,
            "dbCode": "order",                # 当前报表的数据集编码
            "fieldName": "order_id"
        }
    ], ensure_ascii=False)
}
link_result = api_request('/jmreport/link/saveAndEdit', link_data)
link_id = link_result['result']

# Step 2: 在 jsonStr 的单元格中绑定 linkIds
rows = {
    "1": {"cells": {"1": {"text": "订单汇总表", "style": 5, "merge": [0, 3]}}, "height": 40},
    "2": {"cells": {}, "height": 15},
    "3": {
        "cells": {
            "1": {"text": "订单编号", "style": 4},
            "2": {"text": "客户", "style": 4},
            "3": {"text": "总额", "style": 4},
            "4": {"text": "状态", "style": 4},
        },
        "height": 34
    },
    "4": {
        "cells": {
            "1": {
                "text": "#{order.order_no}",
                "style": 2,
                "linkIds": link_id,            # 字符串格式（不是数组）
                "display": "link"              # 必须标记
            },
            "2": {"text": "#{order.customer}", "style": 2},
            "3": {"text": "#{order.total_amount}", "style": 2},
            "4": {"text": "#{order.status}", "style": 2},
        }
    },
    "len": 200
}

# Step 3: 保存报表设计（save 接口）
```

### 6.2 网络链接钻取

**场景**：点击单元格 → 跳转到外部系统

```python
link_data = {
    "linkName": "打开外部系统",
    "linkType": "1",                                    # 网络链接
    "reportId": current_report_id,                      # 当前报表ID
    "apiUrl": "http://www.baidu.com",                   # 外部URL
    "ejectType": "1",                                   # 当前窗口
    "apiMethod": "",
    "requirement": "",
    "parameter": json.dumps([
        {
            "paramName": "name",
            "paramValue": "name",           # 当前行 name 字段
            "paramCell": "",
            "tableIndex": 1,
            "dbCode": "pop",
            "fieldName": "id"
        }
    ], ensure_ascii=False)
}
# 实际跳转: http://www.baidu.com?name=xxx
```

> **注意**：不要手动在 apiUrl 中拼接参数，使用 parameter 配置自动构建。

### 6.3 图表钻取

**场景**：点击柱状图的柱子 → 跳转到明细报表

```python
link_data = {
    "linkName": "图表钻取",
    "linkType": "0",                          # 报表钻取（也可以是 "1" 网络链接）
    "reportId": detail_report_id,             # 目标报表
    "ejectType": "0",                         # 新窗口
    "apiUrl": "",
    "apiMethod": "",
    "requirement": "",
    "charId": "",                             # 图表ID（可选）
    "parameter": json.dumps([
        {
            "paramName": "category",
            "paramValue": "name",             # X轴分类值
            "tableIndex": 0,
            "dbCode": "pop",
            "fieldName": ""
        },
        {
            "paramName": "amount",
            "paramValue": "value",            # Y轴数值
            "tableIndex": 0,
            "dbCode": "pop",
            "fieldName": ""
        }
    ], ensure_ascii=False)
}
```

---

## 7. 注意事项

1. **parameter 是 JSON 字符串**：必须用 `json.dumps()` 转为字符串，不是原始数组
2. **linkIds 是逗号分隔的字符串**：不是数组！如 `"id1"` 或 `"id1,id2"`，前端通过字符串拼接管理
3. **单元格必须加 `display: "link"`**：否则前端不识别为超链接，右侧面板会显示"暂无数据"
4. **reportId 含义不同**：linkType=0 时是**目标报表ID**；linkType=4（主子表）时是**当前报表ID**
5. **参数字段值应唯一**：如果参数字段存在重复值，系统默认取第一条匹配记录
6. **不要手动拼接URL参数**：使用 parameter 配置，系统自动构建带参URL
7. **弹出方式**：`ejectType="0"` 新窗口，`"1"` 当前窗口
8. **图表钻取 paramValue**：使用 `name`（X轴）/ `value`（Y轴）/ `seriesName`（系列），不是字段名
9. **地址栏参数**（v1.9.6+）：`param.xxx` 语法可获取浏览器地址栏参数
10. **图表钻取与报表钻取结构一致**：JSON 结构完全相同，仅 paramValue 取值不同
11. **图表 linkIds 放在 extData 内部**：`chartList[].extData.linkIds`（不是 chartList 顶层！前端 view.js 通过 `data.extData.linkIds` 读取）

---

## 8. 图表联动（linkType=2）

联动与钻取不同：**联动不跳转页面**，而是在当前报表内重新渲染目标图表。点击表格单元格或图表 → 目标图表的数据集带参重新查询 → 图表刷新显示过滤后的数据。

### 核心规则

- **联动统一用 linkType=2**：不管是表格联动图表还是图表联动图表，都用 `linkType=2`
- **linkType=0 永远是钻取**（跳转报表），不是联动
- **只能联动图表**：联动目标只能是当前报表内的其他图表（不能联动自身）
- **报表联动图表**：parameter 结构与钻取一致（`{paramName, paramValue, tableIndex, dbCode, fieldName}`）
- **图表联动图表**：parameter 结构简化（`{paramName, paramValue, index}`）
- **paramValue 取值**：支持字段名、`=C1`表达式、`param.sex`地址栏参数、图表的`name`/`value`/`seriesName`

### 8.1 报表联动图表（表格单元格 → 图表刷新）

parameter 结构与报表钻取一致，但 **linkType 必须是 "2"**，不是 "0"。

```json
{
    "reportId": "当前报表ID",
    "linkName": "按类别联动品牌图",
    "linkType": "2",
    "linkChartId": "chartA_layer_id",
    "requirement": "",
    "parameter": "[{\"paramName\":\"category\",\"paramValue\":\"category\",\"tableIndex\":0,\"dbCode\":\"catSum\",\"fieldName\":\"category\"}]"
}
```

### 8.2 图表联动图表（图表 → 图表刷新）

```json
{
    "reportId": "1197399727537475584",
    "linkName": "每月订单",
    "requirement": "",
    "linkChartId": "4gWTCuSf3N2pRy9U",
    "linkType": "2",
    "parameter": "[{\"paramName\":\"type\",\"paramValue\":\"name\",\"index\":1}]",
    "id": "1197399727541669888"
}
```

### 两种联动的 parameter 差异

| 联动类型 | parameter 结构 | 说明 |
|---------|---------------|------|
| 报表联动图表 | `{paramName, paramValue, tableIndex, dbCode, fieldName}` | 与钻取 parameter 一致 |
| 图表联动图表 | `{paramName, paramValue, index}` | 简化结构 |

### 与钻取的配置差异

| 配置项 | 钻取（linkType=0/1） | 联动（linkType=2） |
|-------|---------------------|------------------|
| `linkType` | `"0"`报表 / `"1"`网络 | **`"2"`（统一）** |
| `reportId` | 目标报表ID（0）/ 当前报表ID（1） | 当前报表ID |
| `linkChartId` | `null`（不使用） | **必填**，目标图表 layer_id |
| `ejectType` | 0=新窗口 / 1=当前窗口 | 不使用（不跳转） |
| parameter | `{paramName,paramValue,tableIndex,dbCode,fieldName}` | 同左 | `{paramName,paramValue,index}` |
| paramValue | 字段名/=B/=B3/param.xxx | 同左 | name/value/seriesName |
| 效果 | 跳转新页面 | 当前页面图表刷新 | 当前页面图表刷新 |

### 联动前提条件

1. **目标图表的数据集必须有参数**：SQL 中用 `${param}` 声明，paramList 中配置
2. **参数需设置默认值**：确保初始页面时图表能正常显示数据
3. **不能联动自身**：只能联动报表中的其他图表

### 表格联动图表示例

```python
# 1. 准备两个数据集
# 数据集A：源表格（按性别统计人数）
ds_a_sql = "select sex, count(*) as cnt from sys_user group by sex"

# 数据集B：目标图表（需参数 sex，设默认值确保初始显示）
ds_b_sql = "select realname as name, age as value, '' as type from sys_user where sex = '${sex}'"
ds_b_params = [{"paramName": "sex", "paramTxt": "性别", "paramValue": "1",  # 默认值
                "widgetType": "String", "orderNum": 1, "searchFlag": 0}]

# 2. 创建联动配置（linkType=2，不是0！）
link_data = {
    "linkName": "性别联动",
    "linkType": "2",                      # 联动统一用 linkType=2！
    "reportId": report_id,                # 当前报表ID
    "linkChartId": target_chart_layer_id, # 目标图表的 layer_id
    "requirement": "",
    "parameter": json.dumps([{
        "paramName": "sex",
        "paramValue": "sex",              # 当前行的 sex 字段
        "tableIndex": 0,
        "dbCode": "dsA",
        "fieldName": "sex"
    }], ensure_ascii=False)
}
link_result = api_request('/jmreport/link/saveAndEdit', link_data)
link_id = link_result['result']

# 3. 在源单元格绑定 linkIds + display
"4": {
    "cells": {
        "1": {
            "text": "#{dsA.sex}", "style": 2,
            "linkIds": link_id,       # 字符串格式
            "display": "link"         # 必须有
        }
    }
}
```

### 图表联动图表示例

```python
# 图表A 联动图表B（点击图表A → 图表B 刷新）
link_data = {
    "linkName": "每月订单",
    "linkType": "2",                      # 图表联动专用
    "reportId": report_id,                # 当前报表ID
    "linkChartId": chart_b_layer_id,      # 目标图表B的 layer_id
    "requirement": "",
    "parameter": json.dumps([{
        "paramName": "type",              # 图表B数据集的参数名
        "paramValue": "name",             # 图表A的X轴分类值
        "index": 1
    }], ensure_ascii=False)
}
link_result = api_request('/jmreport/link/saveAndEdit', link_data)
link_id = link_result['result']

# linkIds 放在源图表A的 extData 内部
chart_a = {
    "extData": {
        "chartType": "bar.simple",
        "dataType": "sql",
        "dataId": ds_a_id,
        "dbCode": "dsA",
        "axisX": "name", "axisY": "value", "series": "type",
        "linkIds": link_id                # 联动配置ID
    },
    # ...
}
```

### 联动工作流程

```
用户点击表格单元格/图表 → 获取当前行/点击点的数据
    → 通过 linkIds 查询联动配置
    → 取出 parameter 中的参数映射
    → 用映射的值作为参数，重新请求目标图表的数据集
    → 目标图表用新数据重新渲染
    → 页面不跳转，仅图表刷新
```