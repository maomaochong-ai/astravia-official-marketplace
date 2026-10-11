# 分组合计与循环报表 (loopBlockList)

积木报表分组合计配置和循环块 loopBlockList 完整参考。

---

## 4. 分组合计配置

当报表需要按某字段分组并在每组末尾显示合计行时，需要配置分组字段和聚合字段。

### 分组字段配置

```json
{
    "text": "#{sales.group(customer_name)}",
    "style": 2,
    "aggregate": "group",
    "subtotal": "groupField",
    "funcname": "-1",
    "subtotalText": "合计"
}
```

### 聚合字段配置（数值字段）

```json
{
    "text": "#{sales.total_amount}",
    "style": 2,
    "subtotal": "-1",
    "funcname": "SUM",
    "decimalPlaces": "2"
}
```

### jsonStr 顶层需添加

```json
{
    "isGroup": true,
    "groupField": "数据集编码.分组字段名"
}
```

### 聚合函数对照表

| funcname 值 | 渲染时转换 | 说明 |
|-------------|-----------|------|
| `"SUM"` | `=SUM` | 求和 |
| `"AVERAGE"` | `=AVERAGE` | 平均值 |
| `"COUNT"` | `=COUNT` | 计数 |
| `"MAX"` | `=MAX` | 最大值 |
| `"MIN"` | `=MIN` | 最小值 |
| `"COUNTNZ"` | `=COUNTNZ` | 非零计数 |

> **注意：** cell 中的 `funcname` 存储不带 `=` 前缀（如 `"SUM"`），渲染引擎在 `initSubtotal()` 中自动加 `=` 前缀。

### 多级分组示例

**一级分组（地区，显示"合计"）：**
```json
{
    "text": "#{sales.group(region)}",
    "aggregate": "group",
    "subtotal": "groupField",
    "funcname": "-1",
    "subtotalText": "合计"
}
```

**二级分组（销售员，显示"小计"）：**
```json
{
    "text": "#{sales.group(salesman)}",
    "aggregate": "group",
    "subtotal": "groupField",
    "funcname": "-1",
    "subtotalText": "小计"
}
```

**数值字段（销售额，自动求和）：**
```json
{
    "text": "#{sales.amount}",
    "funcname": "SUM",
    "subtotal": "-1",
    "display": "number",
    "decimalPlaces": "2"
}
```

### 常见错误

1. **聚合字段的 subtotal 设为 "groupField"** — 聚合字段必须 `subtotal="-1"`，只有分组依据字段（text 含 `group()` 语法）才能用 `"groupField"`。否则渲染引擎的 `getTemplate()` 不会生成别名模板，合计行数值无法回填。
2. **数值字段未设置 funcname** — 导致 `subtotalFieldList` 为空，合计行只有文字标签没有数值。
3. **缺少 isGroup 和 groupField** — jsonStr 顶层需设置 `"isGroup": true` 和 `"groupField": "数据集编码.分组字段名"`。

### 渲染引擎流程

1. `beforeRenderRow()` 解析 `subtotal="groupField"` → 分组依据列表；解析 `funcname` → 聚合字段列表
2. `getData()` → `initResultList()` 按分组排序，在组边界插入合计行
3. `addResult()` 调用 `initSubtotal()` 计算聚合，结果存入 `keyMap[fieldName_funcName]`
4. `getTemplate()` 对 `subtotal="-1"` 的单元格生成 `${field!field_funcName}` 别名模板

## 5. 循环报表 (loopBlockList)

```json
{
    "loopBlockList": [
        {
            "sci": 1,        // 起始列
            "sri": 2,        // 起始行
            "eci": 5,        // 结束列
            "eri": 5,        // 结束行
            "index": 1,      // 块索引
            "db": "jm",      // 数据集别名
            "loopTime": 3    // 循环次数(可选，分栏打印用)；eri 只需覆盖卡片实际行数，无需大缓冲区
        }
    ]
}
```

循环块内的单元格需要设置 `"loopBlock": 1` 属性。

### 5.1 循环块两种布局

**列表式（简单明细表）：** 循环块只占1行，每条记录渲染1行。

**卡片式（信息明细表）：** 循环块占多行，每条记录渲染一张多行卡片。适用于员工信息表、证书打印等场景。

### 5.2 卡片式循环块示例

每条记录渲染3行标签-值对 + 1行间隔，右侧可放二维码：

```
┌──────────── 员工信息明细表 ────────────┐
│ 姓名：│ 张三   │所在部门：│ 研发部  │ QR │ ← 循环块
│ 年龄：│ 21     │ 学历：  │ 本科    │    │   每条记录
│ 性别：│ 男     │ 薪水：  │ 8000    │    │   渲染4行
│       │        │         │         │    │ ← 间隔行
├───────┼────────┼─────────┼─────────┼────┤
│ 姓名：│ 李四   │所在部门：│ 市场部  │ QR │ ← 下一条
│ ...
```

**jsonStr 配置：**

```json
{
    "rows": {
        "1": {
            "cells": {"1": {"text": "员工信息明细表", "style": 5, "merge": [0, 5]}},
            "height": 45
        },
        "2": {
            "cells": {
                "1": {"text": "姓名：", "style": 6, "loopBlock": 1},
                "2": {"text": "#{emp.name}", "style": 7, "loopBlock": 1},
                "3": {"text": "所在部门：", "style": 6, "loopBlock": 1},
                "4": {"text": "#{emp.department}", "style": 7, "loopBlock": 1},
                "5": {"text": "#{emp.tm}", "style": 2, "merge": [2, 1], "loopBlock": 1,
                      "display": "qrcode", "config": "qr1"}
            },
            "height": 30
        },
        "3": {
            "cells": {
                "1": {"text": "年龄：", "style": 6, "loopBlock": 1},
                "2": {"text": "#{emp.age}", "style": 7, "loopBlock": 1},
                "3": {"text": "学历：", "style": 6, "loopBlock": 1},
                "4": {"text": "#{emp.education}", "style": 7, "loopBlock": 1}
            },
            "height": 30
        },
        "4": {
            "cells": {
                "1": {"text": "性别：", "style": 6, "loopBlock": 1},
                "2": {"text": "#{emp.sex}", "style": 7, "loopBlock": 1},
                "3": {"text": "薪水：", "style": 6, "loopBlock": 1},
                "4": {"text": "#{emp.salary}", "style": 7, "loopBlock": 1}
            },
            "height": 30
        },
        "5": {
            "cells": {
                "1": {"text": "", "loopBlock": 1},
                "2": {"text": "", "loopBlock": 1},
                "3": {"text": "", "loopBlock": 1},
                "4": {"text": "", "loopBlock": 1}
            },
            "height": 10
        },
        "len": 200
    },
    "loopBlockList": [{"sci": 1, "eci": 6, "sri": 2, "eri": 5, "index": 1, "db": "emp"}],
    "displayConfig": {
        "qr1": {"text": "#{emp.tm}", "width": 90, "height": 90, "colorDark": "#000000", "colorLight": "#ffffff"}
    },
    "merges": ["B1:G1", "F2:G4"]
}
```

**关键点：**
- 标签列用 bold 样式（style 6），值列用普通样式（style 7）
- **必须在循环块末尾加一行空行（height: 10px）作为卡片间隔**，否则记录之间会粘在一起
- 空行的单元格也需要 `"loopBlock": 1`
- loopBlockList 的 `eri` 要包含间隔行
- 二维码通过 `display: "qrcode"` + `config` 引用 displayConfig，不是必须的，可省略
- 二维码单元格用 `merge: [2, 1]` 跨3行2列


## 5.4 主子报表（套打式 & 循环块式）

> 已拆分到独立文件，详见 **mastersub-report.md**。
> - 套打式（`${}` + 无循环块，URL 参数切换）→ mastersub-report.md 第一节
> - 循环块式（`#{}` + loopBlockList，全量展开）→ mastersub-report.md 第二节

## 5.5 分版（并列独立展开表格）

**场景：** 同一报表中，多个 `#{}` 集合表格并列显示，各自独立向下展开，互不干扰。

**核心规则：**
- `#{}` 绑定的单元格**本身就会自动向下展开**，不需要 loopBlock
- 右侧（非第一个）并列表格的单元格加 `zonedEdition: N`，告知引擎独立分版渲染
- 顶层加 `zonedEditionList`，结构与 loopBlockList 完全相同（含 sci/eci/sri/eri/index/db）
- `loopBlockList` **留空** `[]`（无需循环块）

**正确结构（三表并列）：**

```python
rows = {
    "2": {"cells": {
        # Table1（左，无标记，#{} 自然展开）
        "0": {"text": "#{sql_db.customer}", "style": 4},
        "1": {"text": "#{sql_db.amount}",   "style": 4},
        "2": {"text": ""},                          # 间距列，无标记
        # Table2（中，分版1）
        "3": {"text": "#{api_db.areaname}", "style": 4, "zonedEdition": 1},
        "4": {"text": "#{api_db.month}",    "style": 4, "zonedEdition": 1},
        "5": {"text": "#{api_db.amount}",   "style": 4, "zonedEdition": 1},
        "6": {"text": ""},                          # 间距列，无标记
        # Table3（右，分版2）
        "7": {"text": "#{json_db.customer}","style": 4, "zonedEdition": 2},
        "8": {"text": "#{json_db.amount}",  "style": 4, "zonedEdition": 2},
        "9": {"text": "#{json_db.date}",    "style": 4, "zonedEdition": 2},
    }, "height": 30},
}

loopBlockList    = []   # 不需要循环块

zonedEditionList = [
    {"sci": 3, "eci": 5, "sri": 2, "eri": 2, "index": 1, "db": "api_db"},
    {"sci": 7, "eci": 9, "sri": 2, "eri": 2, "index": 2, "db": "json_db"},
]
```

**base_save 传参：**
```python
session.request("/save", base_save(
    report_id=report_id, designer_obj=designer,
    rows=rows, cols=cols, styles=styles, merges=merges,
    chartList=[], loopBlockList=[],
    zonedEditionList=zonedEditionList,
))
```

**常见错误：**
| 错误 | 现象 | 解决 |
|------|------|------|
| 第一个表也加 loopBlock | 数据重复或乱序 | 第一个表不加任何标记，让 `#{}` 自然展开 |
| 右侧表用 loopBlockList | 两表联动循环，数据错乱 | 改用 `zonedEditionList` + `zonedEdition: N` |
| 间距列也加 zonedEdition | — | 间距列不加任何标记 |

## 5.3 横向分组

> 横向分组内容已拆分到单独文件，请查看 **horizontal-grouping.md**
