# 函数计算（Formula & Function）

表单设计器的公式控件（`formula`）支持多种计算模式，包括预定义函数和自定义 JavaScript 函数。

## 公式控件 options 结构

```json
{
  "type": "formula",
  "options": {
    "type": "number",
    "mode": "CUSTOM",
    "expression": "$price$*$quantity$",
    "decimal": 2,
    "thousand": true,
    "percent": false,
    "unitPosition": "suffix",
    "unitText": "元",
    "emptyAsZero": true,
    "dateBegin": "",
    "dateEnd": "",
    "dateFormatMethod": 1,
    "datePrintUnit": "d",
    "dateAddExp": "",
    "datePrintFormat": "YYYY-MM-DD"
  }
}
```

## 两大类型

> **mode 必须大写。** 前端通过 `mode === 'SUM'` 等严格匹配判断计算方式，传入小写（如 `'sum'`、`'product'`）会匹配失败，导致被当作 `CUSTOM` 自定义模式直接 eval 表达式，产生计算错误。`desform_utils.py` 已内置 `mode.upper()` 自动转换，但手动构建 JSON 时务必使用大写。

### type: "number" — 数值计算

计算结果为数字，支持以下 mode（必须大写）：

| mode | 说明 | 表达式示例 |
|------|------|----------|
| `SUM` | 求和 | 选择多个字段，自动求和 |
| `AVERAGE` | 平均值 | 选择多个字段，求平均 |
| `MAX` | 最大值 | 选择多个字段，取最大 |
| `MIN` | 最小值 | 选择多个字段，取最小 |
| `PRODUCT` | 乘积 | 选择多个字段，相乘 |
| `CUSTOM` | 自定义公式 | `$price$*$qty$+$tax$` |

### type: "date" — 日期计算

计算结果为日期或时长，支持以下 mode（必须大写）：

| mode | 说明 | 用途 |
|------|------|------|
| `DATEIF` | 时长 | 计算两个日期之间的差值 |
| `NOW_DATEIF` | 距今时长 | 计算某日期到当前时间的差值 |
| `DATEADD` | 日期加减 | 对某日期加减指定时间段 |

---

## 数值计算详解

### 字段引用语法

使用 `$model$` 引用其他字段的值：

```
$input_1234567_123456$     → 引用某个 input 字段的值
$money_1234567_123456$     → 引用某个 money 字段的值
```

### CUSTOM 自定义公式

支持英文输入 `+`、`-`、`*`、`/`、`()` 进行运算，以及调用以下 9 个内置函数：

| 函数 | 说明 |
|------|------|
| `SUM` | 求和 |
| `AVERAGE` | 平均值 |
| `MAX` | 最大值 |
| `MIN` | 最小值 |
| `PRODUCT` | 乘积 |
| `COUNTA` | 计数（非空） |
| `INT` | 求整 |
| `MOD` | 求余 |
| `ROUND` | 四舍五入 |

> **注意：** CUSTOM 模式仅支持上述 9 个函数和四则运算符，**不支持** IF、AND、OR、CONCAT 等其他函数（这些函数仅在默认值表达式中可用，不能用于公式控件的 CUSTOM 模式）。

**基础四则运算：**

```
$price$ * $quantity$                    → 单价 × 数量
($price$ * $quantity$) * 1.13           → 含税金额
$total$ - $discount$ + $delivery_fee$   → 合计
```

**使用内置函数（函数内字段用英文逗号分隔）：**

```
ROUND($price$ * $quantity$, 2)                                → 四舍五入保留2位
SUM($a$, $b$, $c$) / COUNTA($a$, $b$, $c$)                   → 非空平均值
SUM($field1$, $field2$) + MAX($field1$, $field2$)             → 函数与运算符混用
ROUND(SUM($a$, $b$, $c$) * 0.8, 2)                           → 函数嵌套
```

### 预定义 mode（SUM/AVERAGE/MAX/MIN/PRODUCT）

预定义 mode 不需要手写 expression，只需在设计器中选择参与计算的字段，系统自动生成：

```
mode: "SUM"
expression: "$field1$$field2$$field3$"
→ 内部转换为: SUM(val1, val2, val3)
```

### 数值格式化选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `decimal` | int | 2 | 小数位数（0-14） |
| `thousand` | bool | true | 显示千分位分隔符 |
| `percent` | bool | false | 显示为百分比 |
| `unitText` | string | `""` | 单位文本（如"元"、"天"） |
| `unitPosition` | string | `"suffix"` | 单位位置：`prefix`（前缀）或 `suffix`（后缀） |
| `emptyAsZero` | bool | true | 空值视为 0 参与计算 |

---

## 日期计算详解

> **重要：** 日期模式的公式控件 `options.type` 必须为 `"date"`（不是 `"number"`）。`desform_utils.py` 的 `FORMULA`/`SUB_FORMULA` 函数会根据 mode 自动设置正确的 type。

### 公共参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dateBegin` | string | `""` | 开始日期字段引用，格式: `$date_model$` |
| `dateEnd` | string | `""` | 结束日期字段引用，格式: `$date_model$` |
| `dateFormatMethod` | int | `1` | 日期格式化方式（见下方说明） |
| `datePrintUnit` | string | `"m"` | 输出单位：`Y`年/`M`月/`d`天/`h`小时/`m`分钟 |
| `dateAddExp` | string | `""` | DATEADD 专用：加减表达式 |
| `datePrintFormat` | string | `"YYYY-MM-DD"` | DATEADD 专用：输出日期格式 |

**dateFormatMethod（格式化方式）：**
- `1` — 开始日期 00:00，结束日期 00:00（仅计算完整天数差，不含结束日当天）
- `2` — 开始日期 00:00，结束日期 24:00（包含结束日当天，常用于请假天数计算）

**datePrintUnit（输出单位）：**

| 值 | 说明 | 示例输出 |
|----|------|---------|
| `Y` | 年 | `2年` |
| `M` | 月 | `6月` |
| `d` | 天 | `30天` |
| `h` | 小时 | `720小时` |
| `m` | 分钟 | `43200分钟` |

---

### DATEIF — 两个日期间的时长

计算 `dateEnd - dateBegin` 的时长差值，结果带单位文本（如"7天"、"3小时"）。

**使用的参数：** `dateBegin`（必填）、`dateEnd`（必填）、`dateFormatMethod`、`datePrintUnit`

**运行逻辑：**
1. 取 dateBegin 和 dateEnd 引用的字段值
2. 如果字段为空，用当前时间替代
3. 根据 dateFormatMethod 决定是否包含结束日当天
4. 计算 `moment(end).diff(begin, unit)` 得到时长数值
5. 拼接单位文本返回（如 `7天`）

**JSON 配置示例：**

```json
{"name": "请假天数", "type": "formula", "mode": "DATEIF",
 "dateBegin": "$leave_start_model$", "dateEnd": "$leave_end_model$",
 "dateFormatMethod": 2, "datePrintUnit": "d"}
```

**Python 示例：**

```python
FORMULA('请假天数', mode='DATEIF',
        date_begin='$leave_start$', date_end='$leave_end$',
        date_format_method=2, date_print_unit='d')
```

- 选择 3月8日 ~ 3月14日，dateFormatMethod=2 → 结果: `7天`
- 选择 3月8日 ~ 3月14日，dateFormatMethod=1 → 结果: `6天`

---

### NOW_DATEIF — 距此刻时长

计算 `当前时间 - dateBegin` 的时长差值。与 DATEIF 的区别是**结束日期固定为当前时间**，无需指定 dateEnd。

**使用的参数：** `dateBegin`（必填）、`dateFormatMethod`、`datePrintUnit`

**运行逻辑：**
1. 取 dateBegin 引用的字段值
2. 结束日期固定使用 `DATENOW()`（当前时间）
3. 计算 `moment(now).diff(begin, unit)` — 注意方向是 now - begin
4. 拼接单位文本返回

**JSON 配置示例：**

```json
{"name": "工龄", "type": "formula", "mode": "NOW_DATEIF",
 "dateBegin": "$entry_date_model$",
 "dateFormatMethod": 1, "datePrintUnit": "Y"}
```

**Python 示例：**

```python
FORMULA('工龄', mode='NOW_DATEIF',
        date_begin='$entry_date$', date_print_unit='Y')
```

- 入职日期 2022-01-01，当前 2026-03-25 → 结果: `4年`

> **注意：** NOW_DATEIF 的方向是 `now - begin`，如果 begin 在未来则结果为负数。

---

### PAST_NOW_DATEIF — 至今已过时长

计算过去某个日期到当前时间经过了多长时间（至今已过时长）。计算方向为 `begin → now`，当 begin 在过去时结果为正数。

**使用的参数：** `dateBegin`（必填）、`dateFormatMethod`、`datePrintUnit`

**与 NOW_DATEIF 的区别：** NOW_DATEIF 计算的是距此刻的时长（`now - begin`，begin 在过去时可能为负数），PAST_NOW_DATEIF 计算的是从过去到现在已经过了多久（始终为正数）。

**JSON 配置示例：**

```json
{"name": "工龄", "type": "formula", "mode": "PAST_NOW_DATEIF",
 "dateBegin": "$入职日期$", "dateFormatMethod": 1, "datePrintUnit": "Y"}
```

```json
{"name": "已过天数", "type": "formula", "mode": "PAST_NOW_DATEIF",
 "dateBegin": "$开始日期$", "dateFormatMethod": 1, "datePrintUnit": "d"}
```

- 入职日期 2022-01-01，当前 2026-04-01 → 结果: `4年`
- 开始日期 2026-03-01，当前 2026-04-01 → 结果: `31天`

---

### DATEADD — 为日期加减时间

对 dateBegin 引用的日期加减指定时间段，输出一个新的日期。

**使用的参数：** `dateBegin`（必填）、`dateAddExp`（必填）、`datePrintFormat`

**运行逻辑：**
1. 取 dateBegin 引用的字段值（如果为空，用当前时间替代）
2. 解析 dateAddExp 中的 `$model$` 字段引用，替换为实际值
3. 调用 `DATEADD(date, expression, 2)` 计算新日期
4. 用 datePrintFormat 格式化输出

**dateAddExp 表达式语法：**

```
+8h           → 加 8 小时
-2d           → 减 2 天
+1M           → 加 1 个月
+1Y-3d        → 加 1 年减 3 天
+$hours$h     → 加上某字段值的小时数（支持字段引用）
+$days$d+8h   → 加上字段值的天数再加 8 小时
```

**支持的时间单位：** `Y`（年）、`M`（月）、`d`（天）、`h`（小时）、`m`（分钟）、`s`（秒）

**datePrintFormat（输出格式，遵循 moment.js）：**
- `YYYY-MM-DD` — 仅日期（默认）
- `YYYY-MM-DD HH:mm:ss` — 日期时间
- `HH:mm` — 仅时间
- `YYYY年MM月DD日` — 中文格式

**JSON 配置示例：**

```json
{"name": "预计完成时间", "type": "formula", "mode": "DATEADD",
 "dateBegin": "$start_date_model$", "dateAddExp": "+$duration_days$d+8h",
 "datePrintFormat": "YYYY-MM-DD HH:mm:ss"}
```

**Python 示例：**

```python
FORMULA('预计完成时间', mode='DATEADD',
        date_begin='$start_date$', date_add_exp='+7d+8h',
        date_print_format='YYYY-MM-DD HH:mm:ss')
```

- 开始日期 2024-01-01，dateAddExp=`+8h` → 结果: `2024-01-01 08:00:00`
- 开始日期 2024-01-01，dateAddExp=`+1M-3d` → 结果: `2024-01-29`

---

## 内置函数库（可在 CUSTOM 模式和默认值表达式中使用）

### 数学函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `SUM(n1,n2,...)` | 求和 | `SUM(10,20,30)` → `60` |
| `AVERAGE(n1,n2,...)` | 平均值 | `AVERAGE(10,20,30)` → `20` |
| `MAX(n1,n2,...)` | 最大值 | `MAX(10,20,30)` → `30` |
| `MIN(n1,n2,...)` | 最小值 | `MIN(10,20,30)` → `10` |
| `PRODUCT(n1,n2,...)` | 乘积 | `PRODUCT(15,4)` → `60` |
| `ABS(n)` | 绝对值 | `ABS(-7)` → `7` |
| `INT(n)` | 向下取整 | `INT(3.7)` → `3` |
| `MOD(n,d)` | 求余 | `MOD(15,4)` → `3` |
| `ROUND(n,d)` | 四舍五入 | `ROUND(3.14159,2)` → `3.14` |
| `ROUNDUP(n,d)` | 向上舍入 | `ROUNDUP(3.141,2)` → `3.15` |
| `ROUNDDOWN(n,d)` | 向下舍入 | `ROUNDDOWN(3.149,2)` → `3.14` |
| `NUMBER(s)` | 文本转数值 | `NUMBER('123')` → `123` |
| `COUNTA(...)` | 计数（非空） | `COUNTA('a','','c')` → `2` |

### 日期函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `YEAR(date)` | 年份 | `YEAR('2024-03-15')` → `2024` |
| `MONTH(date)` | 月份 | `MONTH('2024-03-15')` → `3` |
| `DAY(date)` | 天数 | `DAY('2024-03-15')` → `15` |
| `DATENOW(fmt)` | 当前时间 | `DATENOW('YYYY-MM-DD')` → `2024-03-15` |
| `DATEFORMAT(date,fmt)` | 日期格式化 | `DATEFORMAT('2024-12-02','YYYY年MM月DD日')` → `2024年12月02日` |
| `DATEADD(date,exp,fmt)` | 日期加减 | `DATEADD('2024-01-01','+8h',2)` → `2024-01-01 08:00:00` |
| `DATEIF(begin,end,method,unit)` | 时长 | `DATEIF('2024-03-01','2024-03-08',2,'d')` → `7天` |
| `DATEEARLIEST(dates,fmt)` | 最早日期 | `DATEEARLIEST(['2024-01-01','2024-06-01'])` |
| `DATELATEST(dates,fmt)` | 最晚日期 | `DATELATEST(['2024-01-01','2024-06-01'])` |

### 字符串函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `CONCAT(s1,s2,...)` | 合并文本 | `CONCAT('hello',' ','world')` → `hello world` |
| `REPLACE(s,pos,len,new)` | 替换文本 | `REPLACE('+8613800138000',1,3,'')` → `13800138000` |
| `LEFT(s,n)` | 从左提取 | `LEFT('ABCDEF',3)` → `ABC` |
| `RIGHT(s,n)` | 从右提取 | `RIGHT('ABCDEF',3)` → `DEF` |
| `TRIM(s)` | 去首尾空格 | `TRIM(' hello ')` → `hello` |
| `CLEAN(s)` | 去所有空格 | `CLEAN('1 2 3')` → `123` |
| `FIND(s,begin,end)` | 查找文本 | `FIND('3天12小时','','天')` → `3` |
| `SPLIT(s,sep)` | 分割文本 | `SPLIT('a-b-c','-')` → `['a','b','c']` |
| `JOIN(arr,sep)` | 合并数组 | `JOIN(['a','b','c'],'-')` → `a-b-c` |
| `STRING(n)` | 转为文本 | `STRING(123)` → `'123'` |

### 逻辑函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `IF(cond,t,f)` | 条件判断 | `IF($score$>=60,'及格','不及格')` |
| `AND(c1,c2,...)` | 全部满足 | `AND($a$>0,$b$>0)` → `true/false` |
| `OR(c1,c2,...)` | 任一满足 | `OR($a$>60,$b$>60)` → `true/false` |
| `ISBLANK(v)` | 是否为空 | `ISBLANK($field$)` → `true/false` |
| `INCLUDE(s,sub)` | 是否包含 | `INCLUDE('hello','ell')` → `true` |

---

## 自定义函数模式

当设计器中开启"自定义函数"开关时，公式从表达式模式切换为 JavaScript 代码模式。

### 工作原理

1. 用户编写完整的 JavaScript 函数体
2. 代码中的 `$model$` 字段引用会被替换为实际值
3. 代码通过 AST 解析后异步执行，不阻塞 UI
4. 函数体必须通过 `return` 返回计算结果

### 代码编写规则

```javascript
// 1. 在函数头部定义变量接收字段动态值
var price = $price_model$
var quantity = $quantity_model$
var taxRate = $tax_rate_model$

// 2. 编写计算逻辑
var subtotal = price * quantity
var tax = subtotal * (taxRate / 100)
var total = subtotal + tax

// 3. 必须 return 返回值
return Math.round(total * 100) / 100
```

### 自定义函数 vs 标准公式

| 特性 | 标准公式（CUSTOM 模式） | 自定义函数（JS 模式） |
|------|----------------------|---------------------|
| 语法 | 数学表达式 + 内置函数 | 完整 JavaScript |
| 复杂度 | 简单计算 | 复杂逻辑、条件分支 |
| 执行 | 同步，使用 math.js | 异步，AST 解析执行 |
| 适用场景 | `$a$*$b$+$c$` | 多步计算、条件判断、字符串处理 |

### 自定义函数示例

#### 阶梯价格计算

```javascript
var qty = $quantity_model$
var basePrice = $base_price_model$

// 阶梯定价
if (qty >= 1000) {
  return basePrice * qty * 0.7   // 7折
} else if (qty >= 500) {
  return basePrice * qty * 0.85  // 85折
} else if (qty >= 100) {
  return basePrice * qty * 0.95  // 95折
} else {
  return basePrice * qty
}
```

#### 工龄计算

```javascript
var entryDate = $entry_date_model$
if (!entryDate) return ''

var now = new Date()
var entry = new Date(entryDate)
var years = now.getFullYear() - entry.getFullYear()
var months = now.getMonth() - entry.getMonth()

if (months < 0) {
  years--
  months += 12
}
return years + '年' + months + '个月'
```

---

## 公式在子表中的使用

子表内的公式控件与主表用法一致，但有以下区别：

1. **字段引用作用域**：子表公式只能引用同行的子表字段，使用 `$sub_field_model$`
2. **子表列宽**：通过 `col_width` 控制，默认 `150px`
3. **Python 快捷函数**：使用 `SUB_FORMULA` 和 `SUB_PRODUCT`

```python
# 子表乘积公式
sub_qty = SUB_INTEGER('数量', sub_key)
sub_price = SUB_MONEY('单价', sub_key)
sub_amount = SUB_PRODUCT('金额', sub_key, [sub_price[2], sub_qty[2]])
```

### 子表公式表达式

```
# PRODUCT 模式（乘积）
expression: "$money_xxx$$integer_xxx$"
→ 内部转换为: PRODUCT(money_value, integer_value)

# CUSTOM 模式
expression: "$money_xxx$*$integer_xxx$*1.13"
→ 字段值替换后直接计算
```

---

## 公式计算执行机制

1. 公式控件解析 expression 中的 `$model$` 引用，提取依赖字段列表
2. 通过 Vue `computed` 跟踪所有依赖字段的值
3. 依赖字段值变化时触发 `watch`，50ms 防抖后重新计算
4. 计算结果通过 `emit('input', value)` 更新到 models 中
5. 数值类型使用 math.js 的 `customEval` 精确计算（避免浮点误差）
6. 计算出错时在控制台输出 `[公式报错]`，不影响其他字段

## desform_creator.py JSON 配置

**数值公式：**
```json
{"name": "金额", "type": "formula", "mode": "CUSTOM",
 "expression": "$price_model$*$qty_model$", "decimal": 2, "unit": "元"}
```

**DATEIF — 时长：**
```json
{"name": "请假天数", "type": "formula", "mode": "DATEIF",
 "dateBegin": "$start_date_model$", "dateEnd": "$end_date_model$",
 "dateFormatMethod": 2, "datePrintUnit": "d"}
```

**NOW_DATEIF — 距今时长：**
```json
{"name": "工龄", "type": "formula", "mode": "NOW_DATEIF",
 "dateBegin": "$entry_date_model$", "dateFormatMethod": 1, "datePrintUnit": "Y"}
```

**PAST_NOW_DATEIF — 至今已过时长：**
```json
{"name": "工龄", "type": "formula", "mode": "PAST_NOW_DATEIF",
 "dateBegin": "$entry_date_model$", "dateFormatMethod": 1, "datePrintUnit": "Y"}
```

**DATEADD — 日期加减：**
```json
{"name": "预计完成时间", "type": "formula", "mode": "DATEADD",
 "dateBegin": "$start_date_model$", "dateAddExp": "+7d+8h",
 "datePrintFormat": "YYYY-MM-DD HH:mm:ss"}
```

> **注意：** 表达式中的 `$model$` 必须是实际的 model 名（如 `money_1234567_123456`），在 AI 创建流程中需要先获取字段的 model 再构建公式。desform_creator.py 会自动处理 `product` 类型的 `field_models` 映射。

## 注意事项

1. `emptyAsZero: true` 时空值视为 0 参与计算，`false` 时空值导致计算结果为空
2. 公式字段本身是只读的，用户不能手动修改计算结果
3. DATEIF 中 dateFormatMethod=1 和 =2 的区别：1 不含结束日，2 包含结束日
4. 自定义函数模式中不能使用 `api.getFormData` 等 JS 增强 API，只有字段引用可用
5. 数值计算使用 math.js 大数运算，精度高于原生 JavaScript 浮点运算
6. `$model$` 语法中不要加空格，如 `$ model $` 是无效的
