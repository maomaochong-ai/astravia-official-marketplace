# 主子报表完整参考

积木报表主子表有两种实现模式，根据展示需求选择：

| | 套打式（单条翻页） | 循环块式（全量展开） |
|-|-----------------|------------------|
| 主表绑定 | `${MAIN.field}` | `#{MAIN.field}` |
| 主表 isList | `"0"` | `"1"` |
| loopBlockList | 留空 `[]` | 必须配置（db=主表） |
| 展示方式 | 一次一条主记录，URL 参数切换 | 一次显示所有主记录，每条下方展开子表 |
| 主表 SQL | `WHERE id='${param}'` | 无 WHERE 条件 |
| 适用场景 | 订单详情页、套打单据 | 批量打印、汇总报表 |

---

## 一、套打式主子报表（`${}` + 无循环块）

### 数据集配置

```python
# 主表：isList="0"，SQL 带参数，配合 ${} 单条绑定
SQL_MAIN = "SELECT id,merchant_no,merchant_name,contact,phone,address FROM demo_merchant WHERE id='${merchantId}'"
save_db(session, report_id, MAIN, "订货商家", sql=SQL_MAIN,
        field_list=fl_main, db_source=DS_ID,
        is_list="0", is_page="0",
        param_list=[{
            "paramName": "merchantId", "paramTxt": "商家ID",
            "paramValue": "M001",   # 默认值，预览时自动加载
            "searchFlag": "0", "widgetType": "String", "searchMode": "1",
        }])

# 子表：isList="1"，SQL 带同名参数，配合 #{} 列表绑定
SQL_SUB = "SELECT order_no,product_name,qty,unit_price,total_price FROM demo_order_detail WHERE merchant_id='${merchantId}'"
save_db(session, report_id, SUB, "订单详情", sql=SQL_SUB,
        field_list=fl_sub, db_source=DS_ID,
        is_list="1", is_page="0",
        param_list=[{
            "paramName": "merchantId", "paramTxt": "商家ID",
            "paramValue": "M001",
            "searchFlag": "0", "widgetType": "String", "searchMode": "1",
        }])
```

> **关键：主子两个数据集的参数名必须一致**，引擎会同时将 URL 参数注入两个数据集。

### 行布局

```python
rows = {
    "0": {"cells": {"1": {"text": "主子报表", "style": 0, "merge": [0,6]}, ...}, "height": 50},
    # 主表区域：用 ${}，无 loopBlock
    "1": {"cells": {
        "1": {"text": "商家编号：", "style": 1},
        "2": {"text": "${merchantInfo.merchant_no}", "style": 2, "merge": [0,1]},
        "4": {"text": "商家名称：", "style": 1},
        "5": {"text": "${merchantInfo.merchant_name}", "style": 2, "merge": [0,2]},
    }},
    # 子表列头：静态文字
    "3": {"cells": {
        "1": {"text": "订单号", "style": 3, "merge": [0,1]},
        "3": {"text": "商品名称", "style": 3},
        "4": {"text": "数量", "style": 3},
        "5": {"text": "小计", "style": 3},
    }},
    # 子表数据行：用 #{}，引擎自动向下展开
    "4": {"cells": {
        "1": {"text": "#{orderDetail.order_no}", "style": 4, "merge": [0,1]},
        "3": {"text": "#{orderDetail.product_name}", "style": 4},
        "4": {"text": "#{orderDetail.qty}", "style": 5},
        "5": {"text": "#{orderDetail.total_price}", "style": 5},
    }},
}
loopBlockList = []   # 套打式不需要循环块
```

### 主子表关联

```python
session.request("/link/saveAndEdit", {
    "reportId":  report_id,
    "parameter": json.dumps({
        "main": MAIN, "sub": SUB,
        "subReport": [{"mainField": "id", "subParam": "merchantId", "tableIndex": 1}]
    }),
    "linkName":   "主子表关联",
    "linkType":   "4",
    "mainReport": MAIN,
    "subReport":  SUB,
})
```

### URL 参数切换

```
# 默认加载（使用参数默认值 M001）
http://host/jmreport/view/{id}?token=xxx

# 切换到其他记录
http://host/jmreport/view/{id}?token=xxx&merchantId=M002
```

---

## 二、循环块式主子报表（`#{}` + loopBlockList）

### 核心规则

**只有一个 loopBlockList，db = 主表**；子表行嵌入同一循环块模板内，引擎靠 `/link/saveAndEdit` 关联自动展开。

错误做法：两个 loopBlockList（主表一条、子表一条）→ 无效，子表不展开。

### 数据集配置

```python
# 主表：isList="1"，SQL 无参数，展示全部记录
SQL_MAIN = "SELECT id,merchant_no,merchant_name,contact,phone FROM demo_merchant ORDER BY id"
save_db(session, report_id, MAIN, "订货商家", sql=SQL_MAIN,
        field_list=fl_main, db_source=DS_ID, is_list="1", is_page="0")

# 子表：isList="1"，SQL 带参数
SQL_SUB = "SELECT order_no,product_name,qty,unit_price FROM demo_order_detail WHERE merchant_id='${merchantId}'"
save_db(session, report_id, SUB, "订单详情", sql=SQL_SUB,
        field_list=fl_sub, db_source=DS_ID, is_list="1", is_page="0",
        param_list=[{
            "paramName": "merchantId", "paramTxt": "商家ID",
            "paramValue": "M001",
            "searchFlag": "0", "widgetType": "String", "searchMode": "1",
        }])
```

### 行结构（全部单元格加 loopBlock:1）

```
行0:    标题，loopBlock:1（必须在循环块内，所有列均需 loopBlock:1）
行1-2:  主表信息 #{MAIN.field}，loopBlock:1
行3:    子表列头（静态），loopBlock:1
行4:    子表数据行 #{SUB.field}，loopBlock:1  ← 引擎按子表记录数重复
行5:    间隔空行（height:8），loopBlock:1
行6-40: 缓冲空行，每列均需空单元格 + loopBlock:1（为子表展开留空间）
eri=40  ← 必须足够大；设小了子表无法展开
```

> ⚠️ **sri 必须为 0**（标题行也要在循环块内），**eri 必须 ≥ 40**（子表展开需要缓冲行）。
> 标题行的合并覆盖单元格（col 2 到 eci）也需要加 `loopBlock:1`，否则循环块识别不完整。
> 缓冲行（行5到行eri）每列均需写空单元格 + `loopBlock:1`，不可省略。

```python
loopBlockList = [{"sci": 1, "eci": 7, "sri": 0, "eri": 40, "index": 1, "db": MAIN}]

# 行0 标题写法（合并后的空单元格也要 loopBlock:1）
rows["0"] = {
    "height": 48,
    "cells": {
        "0": {"text": " ", "style": STYLE_COL0},
        "1": {"text": "报表标题", "style": STYLE_TITLE, "merge": [0, 6], "loopBlock": 1},
        "2": {"text": "", "loopBlock": 1},
        # ... 直到 eci 列，每列都要加 loopBlock:1
    }
}

# 缓冲行（内容行之后到 eri，num_cols 为数据列数）
for r in range(5, 41):
    rows[str(r)] = {
        "cells": {str(c): {"text": "", "loopBlock": 1} for c in range(1, num_cols + 1)}
    }
```

### 主子表关联（与套打式相同）

```python
session.request("/link/saveAndEdit", {
    "reportId":  report_id,
    "parameter": json.dumps({
        "main": MAIN, "sub": SUB,
        "subReport": [{"mainField": "id", "subParam": "merchantId", "tableIndex": 1}]
    }),
    "linkName":   "主子表关联",
    "linkType":   "4",
    "mainReport": MAIN,
    "subReport":  SUB,
})
```

---

## 三、/link/saveAndEdit 参数说明

两种模式均使用相同的关联配置：

| 字段 | 说明 |
|------|------|
| `reportId` | 当前报表 ID |
| `mainReport` | 主表 dbCode |
| `subReport` | 子表 dbCode |
| `linkType` | 固定 `"4"`（主子表关联） |
| `parameter` | JSON 字符串，含 `main`/`sub`/`subReport` 数组 |
| `subReport[].mainField` | 主表关联字段名 |
| `subReport[].subParam` | 子表 SQL 中的参数名 |
| `subReport[].tableIndex` | 固定 `1` |

> `parameter` 必须是 `json.dumps(...)` 后的字符串，不能直接传 dict。
