# 样式规范（必读）

**所有表格/图表报表 styles 必须带 border + 左侧留白，不需要用户提醒。**

---

## 1. border 格式（必须嵌套，不能顶层展开）

```python
# 方式1：直接用内置函数（推荐，自带边框）
from jimureport_utils import make_styles
styles = make_styles()  # 默认边框色 #d8d8d8
```

`make_styles()` 返回 5 种预置样式，通过 `cell["style"]` 索引引用：

| 索引 | 含义 |
|------|------|
| 0 | 基础边框 |
| 1 | 居中 + 垂直居中（数据行） |
| 2 | 蓝底白字（表头） |
| 3 | 淡蓝底深蓝加粗（标题） |
| 4 | 蓝色字体（链接/钻取列） |

自定义颜色时手写，`border` 必须用 `"border"` key 包裹，**不能 `**` 展开到顶层**：

```python
bd = {"bottom":["thin","#d8d8d8"],"top":["thin","#d8d8d8"],
      "left":["thin","#d8d8d8"],"right":["thin","#d8d8d8"]}
styles = [
    {"border":bd,"align":"center","valign":"middle","bgcolor":"#1F3864","color":"#ffffff","font":{"bold":True,"size":14}},  # 标题
    {"border":bd,"align":"center","valign":"middle","bgcolor":"#2F5496","color":"#ffffff"},  # 表头
    {"border":bd,"align":"center","valign":"middle"},   # 数据
    {"border":bd,"align":"right",  "valign":"middle"},  # 数字右对齐
]
```

> 参考报表有自己的 styles 时照搬，不要丢掉其中的 border 字段。

---

## 2. 左侧留白（所有报表强制）

col0（A 列）**始终**作为左边距空白列，宽度 30px，不放任何内容，**不加边框**：

```python
# 左边距 style：无 border 字段
margin_style_idx = len(styles)   # 追加到 styles 末尾
styles.append({"align": "center", "valign": "middle"})  # 不加 border

cols = {
    "0": {"width": 30},   # A 列：左边距，始终留白
    "1": {"width": ...},  # B 列：第一个数据列（序号/字段1）
    ...
    "len": 100,
}

# 标题行 / 分区标题：col0 放空白格，col1 开始合并
rows["0"] = {
    "cells": {
        "0": {"text": "", "style": margin_style_idx},          # 左边距留白
        "1": {"text": "报表标题", "style": 0, "merge": [0, 4]}, # col1~col5 合并
    },
    "height": 50,
}
merges.append("B1:F1")   # 从 B 列开始，不包含 A 列

# 数据行：col0 同样放空白格
rows["2"] = {
    "cells": {
        "0": {"text": "", "style": margin_style_idx},  # 左边距留白
        "1": {"text": "1",   "style": center_style},
        "2": {"text": "姓名", "style": left_style},
        ...
    }
}
```

---

## 3. 样式层级（cell > row > col）

JimuReport 样式从高到低优先级：`cell.style` > `row.style` > `col.style`。大多数场景只需 cell.style。

---

## 4. 常见属性参考

| 属性 | 可选值 | 说明 |
|------|--------|------|
| `align` | `left` / `center` / `right` | 水平对齐 |
| `valign` | `top` / `middle` / `bottom` | 垂直对齐 |
| `bgcolor` | `#RRGGBB` | 背景色 |
| `color` | `#RRGGBB` | 文字颜色（**必须放在 style 顶层，不能放 font 内**） |
| `font.bold` | `True` / `False` | 加粗 |
| `font.italic` | `True` / `False` | 斜体 |
| `font.size` | 整数 | 字号 |
| `font.name` | 字体名 | 字体族 |
| `border` | dict | 四向边框，必须嵌套 |
| `format` | 格式字符串 | 如 `"0.00"`, `"yyyy-MM-dd"` |
