# 单元格格式化与类型完整参考

积木报表单元格有**两套独立的配置**，来源：`format.js` + 右侧属性面板。

---

## 一、单元格类型（display 字段）

右侧面板"类型"下拉，控制单元格**渲染方式**，存储在 cell 的 `display` 字段。

| display 值 | 显示名 | 说明 |
|-----------|--------|------|
| `normal` | 文本 | 默认，原样显示文本（可省略不写） |
| `number` | 数值 | 数字展示，启用数值相关处理 |
| `img` | 图片 | 将单元格值渲染为图片（URL） |
| `base64Img` | Base64图片 | 渲染 base64 编码图片 |
| `barcode` | 条形码 | 将值渲染为条形码 |
| `qrcode` | 二维码 | 将值渲染为二维码 |
| `richText` | 富文本 | 渲染 HTML 富文本内容 |

**JSON 示例：**

```json
{"text": "#{product.img}",  "display": "img"}
{"text": "#{order.code}",   "display": "barcode"}
{"text": "#{goods.qrUrl}",  "display": "qrcode"}
{"text": "#{desc.html}",    "display": "richText"}
{"text": "#{order.amount}", "display": "number"}
{"text": "张三",             "display": "normal"}
```

> `display` 不写时默认为 `normal`（文本）。

---

## 二、数值/日期格式化（styles 数组 + style 索引）

右侧面板"格式"下拉，控制数值/日期的**显示格式**（货币符号、千位分隔符、日期格式等）。

### 机制

格式**不直接写在 cell 里**，而是：
1. 顶层 `styles` 数组中定义格式对象
2. 单元格通过 `style` 字段引用数组下标

```json
{
  "styles": [
    {"format": "number"},
    {"format": "rmb"},
    {"format": "percent"},
    {"format": "date"}
  ],
  "rows": {
    "1": {
      "cells": {
        "1": {"text": "10000.32", "style": 0},
        "2": {"text": "#{order.amount}", "style": 1},
        "3": {"text": "#{rate}", "style": 2},
        "4": {"text": "#{order.date}", "style": 3}
      }
    }
  }
}
```

### 所有可用 format key

**数值类：**

| format | UI中文名 | 示例显示 | 说明 |
|--------|---------|---------|------|
| `number` | 数值 | `1,000.12` | 千位分隔符，保留原始小数位 |
| `percent` | 百分比 | `10.12%` | 原始值 ×100，加 % |
| `rmb` | 人民币 | `￥1,000.00` | 加 ￥ 前缀 |
| `usd` | 美元 | `$1,000.00` | 加 $ 前缀 |
| `eur` | 欧元 | `€1,000.00` | 加 € 前缀 |

**日期时间类：**

| format | UI中文名 | 示例显示 | 格式模板 |
|--------|---------|---------|---------|
| `date` | 短日期 | `2020/10/10` | yyyy/MM/dd |
| `date2` | 长日期 | `2020年10月10日` | yyyy年MM月dd日 |
| `time` | 时间 | `10:10:10` | hh:mm:ss |
| `datetime` | 日期+时间 | `2020/10/10 10:10:10` | yyyy/MM/dd hh:mm:ss |
| `year` | 年 | `2020年` | yyyy年 |
| `month` | 月 | `10月` | MM月 |
| `yearMonth` | 年月 | `2020年10月` | yyyy年MM月 |

---

## 三、两套系统对比

| 属性 | display | styles + style |
|------|---------|----------------|
| 作用 | 渲染类型（图片/条码/富文本等） | 数值/日期显示格式 |
| 存储位置 | cell 内直接字段 | 顶层 styles 数组，cell 用 style 索引引用 |
| 是否可组合 | 可以，两者互不冲突 | — |
| 典型场景 | `display:"img"` 显示图片 | `style:0` → `{"format":"rmb"}` |

**两者可以同时使用：**

```json
{
  "styles": [{"format": "number"}],
  "rows": {
    "1": {
      "cells": {
        "1": {"text": "#{order.amount}", "display": "number", "style": 0}
      }
    }
  }
}
```

---

## 四、AI 生成报表时的选择规则

| 数据内容 | display | style (format) |
|---------|---------|---------------|
| 金额（人民币） | `number` | `rmb` |
| 金额（美元） | `number` | `usd` |
| 金额（欧元） | `number` | `eur` |
| 普通数字 | `number` | `number` |
| 百分比/比率 | `number` | `percent` |
| 日期 | 不填（normal） | `date` 或 `date2` |
| 日期时间 | 不填（normal） | `datetime` |
| 图片 URL | `img` | 不填 |
| Base64 图片 | `base64Img` | 不填 |
| 条形码 | `barcode` | 不填 | **只写 display，不加 config** |
| 二维码 | `qrcode` | 不填 | **只写 display，不加 config** |
| 富文本 HTML | `richText` | 不填 |
| 普通文本 | 不填（normal） | 不填 |

> **注意**：`percent` 格式会将原始值 ×100 再加 %，数据源字段值应为小数（0.15 显示为 15%）。

---

## 五、AI 构建 styles 数组的模式

> **⚠️ 关键规则（2026-04-07 浏览器实测）：对齐、字体、颜色等所有样式必须放入 `styles[]`，通过 `cell.style` 整数索引引用。禁止直接在 cell 对象上写 `align`/`font`/`valign`/`bold`，否则样式不生效。**

### 数字格式化样式

```python
styles = []
format_index = {}

def get_style_index(fmt):
    if fmt not in format_index:
        format_index[fmt] = len(styles)
        styles.append({"format": fmt})
    return format_index[fmt]

rmb_idx  = get_style_index("rmb")      # → 0
date_idx = get_style_index("date")     # → 1
pct_idx  = get_style_index("percent")  # → 2

cell_amount = {"text": "#{order.amount}", "display": "number", "style": rmb_idx}
cell_date   = {"text": "#{order.date}", "style": date_idx}
cell_img    = {"text": "#{product.img}", "display": "img"}  # 图片列不需要 style
```

### 对齐 + 字体样式（标题行标准模板）

浏览器实测的正确写法，直接照抄：

```python
styles = [
    {"align": "center"},                                        # 0 居中
    {"align": "center", "font": {"size": 14}},                 # 1 居中+14号
    {"font": {"size": 14}},                                     # 2 14号
    {"align": "center", "font": {"size": 14, "bold": True}},   # 3 居中+14号+加粗（标题主格）
    {"font": {"size": 14, "bold": True}},                      # 4 14号+加粗（标题合并格）
]

# 标题行（B1 主格 + C1:J1 合并格）
title_cells = {
    "1": {"merge": [0, 8], "text": "报表标题", "style": 3},  # 主格：居中+加粗
}
for c in range(2, 10):
    title_cells[str(c)] = {"style": 4}  # 合并格：保持字体一致

# ⚠️ merge 必须同时在顶层 merges 数组中声明
merges = ["B1:J1"]   # UI 行号 = code 行号+1，故 row=0 → B1:J1
```

### 错误写法（不生效）

```python
# ✗ 错误：直接在 cell 上写样式属性
cell = {
    "text": "标题",
    "align": "center",          # ✗ 无效
    "font": {"bold": True},     # ✗ 无效
    "valign": "middle",         # ✗ 无效
}
```

### styles 字段结构规律（来自真实接口抓包）

**顶层可用字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `border` | object | `{"bottom":["thin","#000"],...}` 四边独立配置，粗细可选 `thin`/`medium`/`thick` |
| `align` | string | `"center"` / `"right"` / `"left"` |
| `valign` | string | `"top"` / `"bottom"`（不设则默认居中） |
| `color` | string | 文字颜色，**与 `font` 平级，不放进 `font`** |
| `bgcolor` | string | 背景色 |
| `underline` | bool | 下划线 |
| `strike` | bool | 删除线（strikethrough） |
| `textwrap` | bool | 文本自动换行；**默认会撑开行高**。仅当 cell 同时设置 `autoHeight:false` 时才固定行高、不撑开 |
| `font` | object | 仅含 `bold`/`italic`/`size`/`name`，**不含 `color`** |

**`font` 支持的子字段：**`bold:true`、`italic:true`、`size:数字`、`name:"仿宋"/"Microsoft YaHei"/"宋体"` 等系统字体。

**组合规则：** 任意字段自由组合，未设的字段取默认值。border 需要四边都写才生效。

---

## 六、重要约束（来自 report-design.md）

1. **数据集编码 `db_code` 不能重复且只支持英文字符** — 同一个报表内的多个数据集，每个的 `db_code` 必须唯一。编码只能使用英文字母、数字和下划线。
2. **第一个数据集默认勾选分页（`isPage: "1"`）** — 创建报表时，第一个数据集应设置 `isPage: "1"`。一个报表**只能有一个数据集**启用分页，其余必须为 `isPage: "0"`。多个数据集同时分页会导致冲突。

---

## 七、数据绑定语法

| 语法 | 说明 | 场景 |
|------|------|------|
| `${db.field}` | 单值绑定 | 对象数据集（单条记录）、主表字段。数据集需设 `isList:"0"`, `isPage:"0"` |
| `#{db.field}` | 列表绑定 | 明细行、循环数据 |
| `#{db.group(field)}` | 纵向分组 | 按字段分组汇总 |
| `#{db.groupRight(field)}` | 横向分组 | 按字段横向展开 |
| `#{db.dynamic(field)}` | 动态聚合 | 交叉表数据 |
| `#{db.customGroup(field)}` | 自定义分组 | 横向自定义展开 |
| `=SUM(D7)` | Excel 公式 | 列汇总 |

---

> **以下内容已拆分为独立文件：**
> - `cell-properties.md` — 单元格属性完整列表 + displayConfig 组件（二维码/条码）
> - `cell-calc-blank.md` — 计算规则（filterNegative 等）+ 补全空白行（completeBlankRow）
> - `cell-custom-edit.md` — 自定义编辑单元格（customEditConf）


---

# 单元格属性 & displayConfig 组件

> 从 `cell-format.md` 拆出。需要设置二维码/条码/图片/隐藏单元格等特殊组件时读此文件。

## 单元格属性完整列表

| 属性 | 说明 | 值 |
|------|------|-----|
| `text` | 单元格内容 | 支持 `#{db.field}` 数据绑定 |
| `merge` | 合并 | `[行数,列数]`，如 `[0,2]` 向右合并2列。**必须同时在 `merges` 数组添加对应范围** |
| `style` | 样式索引 | 引用 `styles` 数组下标 |
| `loopBlock` | 循环块标记 | 1=属于循环块 |
| `zonedEdition` | 分版标记 | 1/2/... 分版编号 |
| `fixedHead` | 固定表头 | 1=固定 |
| `fixedTail` | 固定表尾 | 1=固定 |
| `aggregate` | 聚合类型 | `"select"` 普通列 / `"group"` 分组 |
| `subtotal` | 小计配置 | `"groupField"` 分组依据 / `"-1"` 聚合字段 |
| `funcname` | 聚合函数 | `"SUM"` / `"AVERAGE"` / `"COUNT"` / `"MAX"` / `"MIN"` / `"-1"` 无 |
| `subtotalText` | 小计行文本 | `"合计"` / `"小计"` |
| `decimalPlaces` | 小数位 | `"0"`/`"1"`/`"2"`/`"4"` |
| `direction` | 展开方向 | `"down"` 纵向 / `"right"` 横向 |
| `sort` | 排序 | `"default"` / `"asc"` / `"desc"` |
| `display` | 显示格式 | 见 `cell-format.md` display 值表 |
| `rendered` | 渲染标记 | `""` |
| `config` | 配置标记 | `""` |
| `fillForm` | 填报组件 | 组件配置对象 |
| `virtual` | 图层占位 | 对应组件的 `layer_id` |
| `hidden` | 隐藏单元格 | `1`=隐藏（v1.6.7+）。**需同时在根级 `hiddenCells[]` 添加范围 `{sri,sci,eri,eci}`** |
| `autoHeight` | 固定/自适应高度 | 不设置或 `true`=行高随内容撑开；`false`=**固定行高**，此时即使 `textwrap:true` 也不撑开 |
| `noHalfUp` | 不四舍五入 | `true`=小数截断而非四舍五入，**仅在设置了 `decimalPlaces` 时有效**，默认不设置 |
| `dynamicApi` | 动态接口数据 | `true`=启用，单元格 `text` 填写 API 地址，**必须同时设置 `dynamicDataType: "api"`** |
| `dynamicDataType` | 动态数据类型 | `"api"`=接口数据，配合 `dynamicApi: true` 使用 |
| `dynamicMerge` | 动态合并格 | `1`=启用，跟随相邻 group 列行数自动合并。完整用法见 `references/misc-config.md` §动态合并 |

---

## displayConfig 单元格组件

> **⚠️ 2026-05-22 实测：`displayConfig + config` 方式会创建 floating overlay 叠加层，覆盖表头和其他行，布局完全错乱。**
> **正确做法：只用 `"display":"barcode"` / `"display":"qrcode"` 直接内联渲染，不加 `"config"` 字段，payload 里不传 `displayConfig`。**
> 下方 displayConfig 配置仅供参考，实际生成报表时禁止使用。

用于在普通单元格中渲染条码、二维码、图片。

### 使用方式（⚠️ 禁止使用，见上方警告）

1. 在 `displayConfig` 中定义配置（key 为配置ID）
2. 在单元格中通过 `"display": "barcode"/"qrcode"` + `"config": "配置ID"` 引用

### 条形码配置

```json
{
    "displayConfig": {
        "bc1": {
            "barcodeContent": "#{order.order_no}",
            "format": "CODE128",
            "width": "2",
            "height": "50",
            "displayValue": false,
            "text": "",
            "textPosition": "bottom",
            "textAlign": "center",
            "fontSize": "20",
            "fontOptions": "",
            "lineColor": "#000",
            "background": "#fff"
        }
    }
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `barcodeContent` | 条码内容，支持 `#{db.field}` | 必填 |
| `format` | 条码格式 | `CODE128` |
| `width` | 条间距 | `"2"` |
| `height` | 高度 | `"50"` |
| `displayValue` | 是否显示文字，**默认 false** | `false` |
| `text` | 覆盖显示的文字 | `""` |
| `textPosition` | 文字位置 | `"bottom"` |
| `textAlign` | 文字对齐 | `"center"` |
| `fontSize` | 文字大小 | `"20"` |
| `fontOptions` | 文字样式 | `""` |
| `lineColor` | 条颜色 | `"#000"` |
| `background` | 背景色 | `"#fff"` |

**单元格引用：**
```json
{"text": "#{order.order_no}", "style": 2, "display": "barcode", "config": "bc1"}
```

### 二维码配置

```json
{
    "displayConfig": {
        "qr1": {
            "text": "#{order.product_name}",
            "width": 80,
            "height": 80,
            "colorDark": "#000000",
            "colorLight": "#ffffff"
        }
    }
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `text` | 二维码内容，支持 `#{db.field}` | 必填 |
| `width` | 宽度(px) | `80` |
| `height` | 高度(px) | `80` |
| `colorDark` | 前景色 | `"#000000"` |
| `colorLight` | 背景色 | `"#ffffff"` |

**单元格引用：**
```json
{"text": "#{order.product_name}", "style": 2, "display": "qrcode", "config": "qr1"}
```

---

# 单元格计算规则 & 补全空白行

> 从 `cell-format.md` 拆出。需要 filterNegative/filterEmptyValue/completeBlankRow 时读此文件。

## 单元格计算规则

控制单元格在聚合计算（SUM/AVERAGE 等）时是否排除特定值，属性直接设置在 **cell 对象** 上。

| 属性 | 类型 | 说明 |
|------|------|------|
| `filterNegative` | boolean | 负数不参与计算 |
| `filterEmptyValue` | boolean | 空值不参与计算 |
| `filterZeroValue` | boolean | 零不参与计算 |
| `noCalculate` | boolean | 完全不参与计算 |

> 仅在 `designerObj.submitForm !== 1`（非数据填报模式）时显示此配置。

```json
{
    "text": "#{db.amount}",
    "style": 5,
    "filterNegative": true,
    "filterEmptyValue": true,
    "filterZeroValue": false,
    "noCalculate": false
}
```

> 参考文档：https://help.jimureport.com/function/cellCalculation.html

---

## 补全空白行（completeBlankRow）

当数据行不足指定行数时，自动补全空白行至固定行数。需要在**两个位置**同时配置：

### 1. save 根级：completeBlankRowList

JSON 字符串，数组格式：

```json
{
    "completeBlankRowList": "[{\"db\":\"product\",\"field\":\"product_name\",\"rows\":\"2\"}]"
}
```

| 字段 | 说明 |
|------|------|
| `db` | 数据集编码（dbCode） |
| `field` | 触发补全的字段名 |
| `rows` | 补全到的目标行数（字符串） |

### 2. cell 对象：completeBlankStatus + completeBlankRow

> **只需在数据行第一个单元格（col1）上设置**，其余列不需要。

```json
{
    "text": "#{product.product_name}",
    "style": 0,
    "completeBlankStatus": true,
    "completeBlankRow": "2"
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `completeBlankStatus` | boolean | 是否启用补全空白行 |
| `completeBlankRow` | string | 补全到的目标行数 |

---

# 自定义编辑单元格（customEditConf）

> 从 `cell-format.md` 拆出。需要点击单元格触发自定义请求时读此文件。

点击单元格时触发自定义请求（如弹窗编辑、调用后端接口等）。配置在 **cell 对象** 上。

```json
{
    "text": "#{user.cname}",
    "style": 0,
    "customEditConf": {
        "apiUrl": "<api_base>/test/customCellEdit",
        "eventParams": "{}"
    }
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `customEditConf` | object | 自定义编辑配置，放在 cell 对象内 |
| `customEditConf.apiUrl` | string | 请求地址（点击单元格时调用） |
| `customEditConf.eventParams` | string | 请求参数（明文 JSON 字符串）。**默认 `"{}"`**。**系统在保存时自动做 Base64 编码**，AI **不要**自己用 `base64.b64encode(...)` 加密 |

### eventParams 写法规则（必读，避免重复踩坑）

> **AI 直传明文 JSON 字符串。** 系统在 `/save` 入库时自动 base64 编码，落库后即 `eyJ...` 形式。
> AI 自己 base64 编码会被**二次编码**，预览触发请求时解码出来是乱码。

| 场景 | 写法（AI 直接写这个值） |
|------|--------------------|
| 没有业务参数（默认） | `"eventParams": "{}"` |
| 有业务参数 | `"eventParams": '{"action":"updateEntryDate","field":"entry_date"}'`（直接 `json.dumps(params)`，**不要 base64**） |

```python
# ✅ 正确
import json
event_params = json.dumps({"action": "updateEntryDate"}, ensure_ascii=False)
# → '{"action": "updateEntryDate"}'   ← 直接传给 customEditConf.eventParams

# ❌ 禁止
import base64
event_params = base64.b64encode(json.dumps(...).encode("utf-8")).decode("utf-8")  # 系统会再编码一次，导致乱码
```
