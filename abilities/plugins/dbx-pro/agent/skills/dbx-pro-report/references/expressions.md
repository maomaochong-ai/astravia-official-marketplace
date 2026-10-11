# 积木报表表达式函数索引

单元格公式以 `=` 开头；函数名大小写均可（Aviator 引擎）。

## 按类别查阅

| 文件 | 涵盖函数 | 对应脚本 |
|------|---------|---------|
| [expr-cell-aggregate.md](expr-cell-aggregate.md) | ROW / SUM / AVERAGE / MIN / MAX / COUNTNZ | `create_expr_cell_functions.py` |
| [expr-dbsum.md](expr-dbsum.md) | DBSUM / DBAVERAGE / DBMIN / DBMAX（⚠️ 必须SQL数据集）| `create_expr_dbsum_functions.py` |
| [expr-datetime.md](expr-datetime.md) | NOW / NOWSTR / DATE_STR / YEAR / MONTH / DAY / TIME 等 | `create_expr_datetime_functions.py` |
| [expr-math-string.md](expr-math-string.md) | ABS / CEIL / ROUND / CNMONEY / CONCAT / UPPER 等 | — |
| [expr-condition-style.md](expr-condition-style.md) | IF / CASE / IFERROR / COLOR / ROWCOLOR / INTVAL 等 | `create_expr2_condition_style.py` |
| [expr-dynamic-cell.md](expr-dynamic-cell.md) | 动态CELL表达式（`::D5` 双冒号，循环列表自动替换行号）| — |
| 内置函数（Aviator 通用） | assert / sysdate / now / rand / cmp / print / println / p / pst / 类型转换(long/double/boolean/str/bigint/decimal) / 类型工具(type/is_a/is_def/undef/identity) / 集合工具(range/tuple/comparator/max/min/constantly) | 见本文件「内置函数」节 |
| Sequence 函数（集合处理） | repeat / map / filter / reduce / count / sort / distinct / take_while / drop_while / group_by / seq.list/set/map/keys/vals / 谓词工厂(seq.eq/gt/lt/and/or 等) | 见本文件「Sequence 函数」节 |

## 快速示例

```
# 序号
=ROW()

# 金额列求和（D4 为数据模板行金额单元格）
=SUM(D4)

# 数据集求和（必须 SQL 数据集，点号语法）
=DBSUM(exprDemo.amount)

# 当前日期
=DATE_STR(NOWSTR(),'yyyy-MM-dd')

# 条件显示
=IF(#{db.score}>=60,'及格','不及格')

# 大写金额
=CNMONEY(#{db.amount})

# 空值保护
=INTVAL(#{db.salary})

# 字符串拼接（字符串字段必须加单引号，否则 Aviator 解析为变量名→null）
=CONCAT('#{db.province}','#{db.city}','#{db.area}')
```

---

# 表达式函数已知规则

## 数据集相关

| 规则 | 说明 |
|------|------|
| DBSUM 必须 SQL 数据集 | JSON 数据集（db_type=3）不支持 DBSUM/DBAVERAGE/DBMIN/DBMAX，改用 SQL 数据集 |
| 日期函数用 NOWSTR() | 不要用 `sysdate()`，统一用 `=NOWSTR()` 作为当前时间源 |
| 字段已知时跳过 parse_sql | 省一次 API 请求，直接手动定义 field_list |

## 调色函数 & 样式函数

文档：
- 调色：https://help.jimureport.com/function/colour
- 样式：https://help.jimureport.com/function/font
- 判断：https://help.jimureport.com/function/condition

| 规则 | 说明 |
|------|------|
| color/rowcolor 三参数 | `color(text, fontColor, bgColor)`，第一个参数是要显示的内容，不是颜色 |
| fontbold/rowfontbold 一参数 | `fontbold(text)`，传入要显示的内容 |
| 不支持函数 `+` 组合 | `color()+fontbold()` 不合法，用 case 分支分别调用 |
| case() 是三参数布尔判断 | `case(expression, trueValue, falseValue)`，不是 Excel 的 IF |
| 字符串比较加单引号 | `case('#{db.sex}'=='1','男','女')`，`#{}` 外面必须加单引号 |
| 多分支用 if/elsif/else | `=(let f=#{db.flag}; if(f==0){'停用'}elsif(f==1){'正常'}else{'未知'})`，注意是 `elsif` 不是 `elseif` |
| if 内可用 return + color | `=(let f='#{db.flag}'; if(f=='0'){return color('停用','red','yellow');}else{return '正常';})`  |
| intval() 空值保护 | 数值可能为空时用 `intval()` 先转0再比较 |

## 交叉报表（groupRight + dynamic）

| 规则 | 说明 |
|------|------|
| 必须读示例 | 交叉报表必须先读 `examples/multi-level-header.md`，严格照搬 JSON 结构 |
| 列标题行不加 direction:right | groupRight 下方的静态列标题（销售/赠送/比例/小计）**不能**加 `direction:"right"`，否则循环异常 |
| dynamic 必须加 aggregate:"dynamic" | `#{db.dynamic(field)}` 必须设 `"aggregate": "dynamic"`，缺失会导致数据不填充 |
| groupRight merge 列数 = 下方字段数 | 下方有4个 dynamic/compute → groupRight `merge: [0, 3]` |
| 斜线表头 merge 行数 = 列标题行数+1 | 有1行列标题 → 斜线 `merge: [1, 1]` 跨2行2列 |
| 必须加 isGroup + groupField | `base_save(..., isGroup=True, groupField="db.field")` |
| compute 小计 | `#{db.compute(field1+field2)}` 跟随 groupRight 循环，不需要额外属性 |

## 查询栏配置

| 规则 | 说明 |
|------|------|
| querySetting 用对象格式 | `base_save(..., querySetting={"izOpenQueryBar": True, "izDefaultQuery": True})`，不要用 json.dumps 字符串 |
| paramList 必须加 searchFlag | 参数要显示在查询栏必须设 `"searchFlag": 1`，否则不会勾选为查询条件 |
| 展开查询栏 | `izOpenQueryBar: True` 默认展开查询栏（有查询条件时建议开启） |
| 默认查询 | `izDefaultQuery: True` 页面加载后立即执行查询 |

## 单元格规则

| 规则 | 说明 |
|------|------|
| 表达式文本列加空格前缀 | 展示表达式字符串时，cell text 加空格前缀防止 `=` 开头被引擎求值 |
| 行高设置 | `rows['N']['height'] = 60`，必须在 get_report 后修改再 save，不能单独 save height |

## 条件隐藏行 / 列

**不要用 `rowcolor()` 或 `case()` 实现行隐藏**，那只是视觉遮盖，行仍占用布局空间。

正确方式：在 `base_save` 传 `hidden` 参数。

```python
base_save(report_id, designer,
    rows=rows, cols=cols, styles=styles, merges=merges, chartList=[],
    hidden={
        "rows": [],
        "cols": [],
        "conditions": {
            "rows": {
                "5:5": "empData.salary>5000"   # key="行索引:行索引"，value=条件表达式
            },
            "cols": {}
        }
    }
)
```

| 字段 | 说明 |
|------|------|
| `conditions.rows` key | `"rowIdx:rowIdx"`（0-indexed，单行写成 `"5:5"`，多行写成 `"5:7"`） |
| `conditions.rows` value | 条件表达式，**不加 `=` 前缀**，如 `"empData.salary>5000"` |
| `conditions.cols` | 同理，按列索引条件隐藏 |
| 单元格内容 | 保持正常绑定（`${db.field}` / `#{db.field}`），无需任何表达式 |

---

# 单元格聚合函数

报表级聚合，引用数据模板行的单元格坐标（如 `D4`），引擎展开后对所有实例求聚合。

**脚本**：`create_expr_cell_functions.py`

## 函数列表

| 函数 | 说明 | 示例 |
|------|------|------|
| `ROW()` | 自增序号（从1开始） | `=ROW()` |
| `SUM(range)` | 求和 | `=SUM(D4)` |
| `AVERAGE(range)` | 求平均值 | `=AVERAGE(D4)` |
| `MIN(range)` | 最小值 | `=MIN(D4)` |
| `MAX(range)` | 最大值 | `=MAX(D4)` |
| `COUNTNZ(range)` | 计算非零元素个数 | `=COUNTNZ(D4)` |

## 用法说明

- `range` 填数据模板行的单元格坐标，如 `D4` 表示第4行D列（Excel 1-indexed）
- 公式写在模板行**之后**的单独行，不写在数据行里
- `=ROW()` 写在数据行内，每条数据自动递增

## 示例布局（rows 0-indexed）

```
row 0: 标题
row 1: 列头（序号 / 姓名 / 金额 / 日期 / 备注）
row 2: 数据模板行  → #{db.name} #{db.amount} ...   ← 金额在 D 列（col index 3），Excel 第3行 → D3
row 3: =ROW()      =SUM(D3)    ...
row 4: =AVERAGE(D3) ...
...
```

---

# 数据集聚合函数（DBSUM 系列）

跨数据集直接汇总，不依赖单元格坐标范围。

**脚本**：`create_expr_dbsum_functions.py`

## ⚠️ 重要限制

**DBSUM 系列必须使用 SQL 数据集（db_type=0）。**  
JSON 数据集（db_type=3）无数据库连接，DBSUM 返回空，不报错但无数据。

## 函数列表

| 函数 | 说明 |
|------|------|
| `DBSUM(db.field)` | 数据集求和 |
| `DBAVERAGE(db.field)` | 数据集平均值 |
| `DBMIN(db.field)` | 数据集最小值 |
| `DBMAX(db.field)` | 数据集最大值 |

## 语法

```
=DBSUM(数据集编码.字段名)
```

- 用**点号**连接编码和字段，不是两个字符串参数
- 示例：`=DBSUM(exprDemo.amount)`
- 错误写法：`=DBSUM('exprDemo','amount')`  ← 不生效

## 与单元格聚合函数的区别

| 对比项 | 单元格聚合（SUM/AVERAGE）| 数据集聚合（DBSUM）|
|--------|------------------------|------------------|
| 数据来源 | 已渲染的单元格值 | 数据集原始数据 |
| 引用方式 | 单元格坐标 `D4` | `db编码.字段名` |
| 数据集要求 | 任意类型均可 | 必须 SQL 数据集 |
| 适用场景 | 同一报表内聚合 | 跨区域/无模板行时汇总 |

---

# 日期时间函数

不依赖数据集，直接在单元格公式中使用。

**脚本**：`create_expr_datetime_functions.py`

## ⚠️ 注意

- 统一使用 `NOWSTR()` 获取当前时间字符串，**不要用 `sysdate()`**
- `sysdate()` 是 Aviator 内置函数，返回 Java Date 对象，部分函数不兼容

## 函数列表

| 函数 | 说明 | 示例 |
|------|------|------|
| `NOW()` | 当前时间戳（毫秒数） | `=NOW()` |
| `NOWSTR()` | 当前时间字符串 | `=NOWSTR()` |
| `DATE_STR(val, fmt)` | 格式化日期 | `=DATE_STR(NOWSTR(),'yyyy-MM-dd')` |
| `DATE(val)` | 日期部分（yyyy-MM-dd） | `=DATE(NOWSTR())` |
| `TIME(val)` | 时间部分（HH:mm:ss） | `=TIME(NOWSTR())` |
| `YEAR(val)` | 年份 | `=YEAR(NOWSTR())` |
| `MONTH(val)` | 月份（去零，如 1） | `=MONTH(NOWSTR())` |
| `MONTH2(val)` | 月份（补零，如 01） | `=MONTH2(NOWSTR())` |
| `DAY(val)` | 日（去零，如 5） | `=DAY(NOWSTR())` |
| `DAY2(val)` | 日（补零，如 05） | `=DAY2(NOWSTR())` |
| `HOUR(val)` | 小时（去零） | `=HOUR(NOWSTR())` |
| `HOUR2(val)` | 小时（补零） | `=HOUR2(NOWSTR())` |
| `MINUTE(val)` | 分钟（去零） | `=MINUTE(NOWSTR())` |
| `MINUTE2(val)` | 分钟（补零） | `=MINUTE2(NOWSTR())` |

## 格式化示例

```
=DATE_STR(NOWSTR(),'yyyy-MM-dd')          → 2024-04-08
=DATE_STR(NOWSTR(),'yyyy-MM-dd HH:mm')   → 2024-04-08 14:30
=DATE_STR(NOWSTR(),'yyyy年MM月dd日')      → 2024年04月08日
```

## 字段值格式化（数据集日期字段）

```
=DATE_STR(#{db.create_time},'yyyy-MM-dd')
```

---

# 数学函数 & 字符串函数

## 数学函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `ABS(n)` | 绝对值 | `=ABS(-100)` |
| `CEIL(n)` | ❌ 不可用，仅 `math.ceil(n)` 有效 | — |
| `FLOOR(n)` | ❌ 不可用，仅 `math.floor(n)` 有效 | — |
| `ROUND(n, d)` | 四舍五入，d 为小数位数 | `=ROUND(3.456, 2)` → 3.46 |
| `TRUNC(n)` | 截断取整 | `=TRUNC(3.9)` → 3 |
| `RAND()` | 随机数 [0, 1) | `=RAND()` |
| `VAILD(n, d)` | 保留有效数据位数 | `=VAILD(3.456, 2)` |

### Aviator math 模块（高级，完整 14 个）

| 函数 | 说明 |
|------|------|
| `math.abs(d)` | 绝对值 |
| `math.round(d)` | 四舍五入 |
| `math.floor(d)` | 向下取整 |
| `math.ceil(d)` | 向上取整 |
| `math.sqrt(d)` | 平方根 |
| `math.pow(d1, d2)` | d1 的 d2 次方 |
| `math.log(d)` | 自然对数（以 e 为底） |
| `math.log10(d)` | 常用对数（以 10 为底） |
| `math.sin(d)` | 正弦 |
| `math.cos(d)` | 余弦 |
| `math.tan(d)` | 正切 |
| `math.asin(d)` | 反正弦 |
| `math.acos(d)` | 反余弦 |
| `math.atan(d)` | 反正切 |

---

## 字符串函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `CONCAT(s1, s2, ...)` | 字符串拼接 | `=CONCAT(#{db.province},#{db.city})` |
| `UPPER(s)` | 转大写（⚠️ 参数只能用字符串字面量，不能用 `#{field}`，否则展开后无引号报错）| `=UPPER('hello')` |
| `LOWER(s)` | 转小写（⚠️ 同上）| `=LOWER('HELLO')` |
| `CHAR(code)` | Unicode/ASCII 字符 | `=CHAR(65)` → A |
| `CNMONEY(n)` | 数字转大写金额（人民币） | `=CNMONEY(1234.56)` |

### Aviator string 模块（高级，完整 12 个）

| 函数 | 说明 |
|------|------|
| `date_to_string(date, format)` | 把 Date 对象转成指定格式字符串 |
| `string_to_date(source, format)` | 把指定格式字符串转成 Date 对象 |
| `string.contains(s1, s2)` | s1 是否包含 s2 |
| `string.length(s)` | 字符串长度 |
| `string.startsWith(s1, s2)` | s1 是否以 s2 开头 |
| `string.endsWith(s1, s2)` | s1 是否以 s2 结尾 |
| `string.substring(s, begin, [end])` | 截取 s 从 begin 到 end（不含 end），end 省略则截到末尾 |
| `string.indexOf(s1, s2)` | s2 在 s1 中起始索引，找不到返回 -1 |
| `string.split(target, regex, [limit])` | 按正则分割 |
| `string.join(seq, separator)` | 以 separator 连接集合元素 |
| `string.replace_first(s, regex, replacement)` | 替换首个匹配 |
| `string.replace_all(s, regex, replacement)` | 替换所有匹配 |

---

# 条件判断函数 & 调色函数 & 样式函数

## 一、调色函数

文档：https://help.jimureport.com/function/colour

### color() — 单元格字体色+背景色

**语法**：`=color(text, fontColor, backgroundColor)`

- text：要显示的内容（固定值/集合字段/对象字段/单元格引用）
- fontColor：字体色，不设传空字符串 `''`
- backgroundColor：背景色，不设传空字符串 `''`

```
# 固定值
=color('2','#ffffff','#171516')

# 集合字段
=color('#{jm.salse}','#ffffff','#171516')

# 对象字段
=color('${jm.salse}','#ffffff','#171516')

# 单元格引用
=color(A1,'#ffffff','#171516')

# 仅字体色
=color('#{jm.name}','red','')

# 仅背景色
=color('#{jm.name}','','#E8F5E9')
```

### rowcolor() — 整行字体色+背景色

**语法**：`=rowcolor(text, fontColor, backgroundColor)`

参数同 color()，作用范围为整行。

```
# 固定值
=rowcolor('1','red','yellow')

# 集合字段
=rowcolor('#{jm.salse}','red','yellow')

# 对象字段
=rowcolor('${jm.salse}','red','yellow')

# 单元格引用
=rowcolor(A1,'red','yellow')

# 不设颜色仅返回值
=rowcolor('#{jm.name}','','')
```

---

## 二、样式函数

文档：https://help.jimureport.com/function/font

### fontbold() — 单元格字体加粗

**语法**：`=fontbold(text)`

- text：要显示的内容

```
# 固定值
=FONTBOLD('2')

# 集合字段
=FONTBOLD('#{jm.name}')

# 对象字段
=FONTBOLD('${jm.name}')

# 单元格引用
=FONTBOLD(A1)
```

### rowfontbold() — 整行字体加粗

**语法**：`=rowfontbold(text)`

参数同 fontbold()，作用范围为整行。

```
# 固定值
=ROWFONTBOLD('2')

# 集合字段
=ROWFONTBOLD('#{jm.name}')

# 对象字段
=ROWFONTBOLD('${jm.name}')

# 单元格引用
=ROWFONTBOLD(A1)
```

---

## 三、判断函数

文档：https://help.jimureport.com/function/condition

### case() — 三参数布尔判断

**语法**：`case(expression, value, default)`

- expression：布尔条件
- value：条件为真时返回
- default：条件为假时返回
- 字符串字段比较必须加单引号：`'#{db.field}'=='value'`
- 数值字段比较不需要引号：`#{db.score}>=60`
- 空值数值先用 `intval()` 转换：`intval(#{db.amount})==0`

```
# 常量判断
=case(1==1,1,2)

# 字符串比较（#{} 外面要加单引号）
=case('#{test.sex}'=='1','男','女')

# 数值比较
=case(#{db.score}>=60,'及格','不及格')

# 空值保护
=case(intval(#{db.amount})==0,'空','有值')
```

### 嵌套 case() — 多值判断

```
=case(#{db.flag}==0,'停用',case(#{db.flag}==1,'正常',case(#{db.flag}==2,'优秀','未知')))
```

### case() + 调色/样式函数组合

```
# case + color
=case(#{db.score}>=90,color('#{db.score}','red','#FFFFCC'),color('#{db.score}','green',''))

# case + rowcolor
=case(#{db.score}<60,rowcolor('#{db.name}','#fff','#e74c3c'),rowcolor('#{db.name}','#333',''))

# case + fontbold
=case(#{db.score}>=90,FONTBOLD('#{db.score}'),'#{db.score}')
```

### if/elsif/else — 多分支条件

**语法**：`=(let 变量=值; if(条件){'结果'}elsif(条件){'结果'}else{'结果'})`

- 用 `elsif`，不是 `elseif`
- `return` 和分号可选

```
# 多分支
=(let f=#{db.flag}; if(f==0){'停用'}elsif(f==1){'正常'}elsif(f==2){'优秀'}else{'未知'})

# 字符串变量
=(let sex='#{db.sex}'; if(sex=='1'){'男'}elsif(sex=='2'){'女'}else{'未知'})

# if 内调用 color（带 return 写法）
=(let f='#{db.flag}'; if(f=='0'){return color('停用','red','yellow');}elsif(f=='1'){return '正常';}else{return '未知';})
```

---

## ⚠️ 常见错误

| 错误写法 | 正确写法 | 原因 |
|---------|---------|------|
| `=color('red','#fff')` | `=color('text','red','#fff')` | color 是三参数，第一个是内容 |
| `=fontbold()` | `=fontbold('text')` | fontbold 需要传入要显示的内容 |
| `=color()+fontbold()` | 不支持 `+` 组合两个函数 | 用 case 分支分别调用 |
| `=IF(#{db.score}>=60,'及格','不及格')` | `=case(#{db.score}>=60,'及格','不及格')` | JimuReport 用 `case()`，不是 `IF()` |
| `=case(#{db.sex}=='1','男','女')` | `=case('#{db.sex}'=='1','男','女')` | 字符串字段 `#{}` 外面必须加单引号 |

---

# 内置函数（Aviator 引擎，设计器「内置函数」分类完整列表）

**官方文档**：https://jimureport.com/docs/function/library

Aviator 引擎自带的底层工具函数，日常表达式很少全用，主要用于开发调试 / 类型转换 / 集合操作。

## A. 调试 / 打印

| 函数 | 说明 | 预览页效果 |
|------|------|----------|
| `assert(predicate, [msg])` | 断言，predicate 为 false 时抛 AssertFailed 异常，msg 为可选错误信息 | 通过返回空；不通过抛异常 |
| `print([out], obj)` | 打印对象到 out 流（默认 System.out） | 预览页**不显示**，JVM 控制台才看得到 |
| `println([out], obj)` | 同 print 但末尾自动换行 | 同上 |
| `p([out], obj)` | print 的简写别名 | 同上 |
| `pst([out], e)` | 打印异常堆栈，等价于 `e.printStackTrace()`，默认输出到 System.err | 同上 |

## B. 时间 / 随机数

| 函数 | 说明 |
|------|------|
| `now()` | 返回当前时间毫秒数（= `System.currentTimeMillis()`） |
| `sysdate()` | 返回当前 java.util.Date 对象；⚠️ 不推荐，部分日期函数不兼容，统一用 `NOWSTR()` |
| `rand()` | 返回 [0, 1) 之间的随机数（double） |
| `rand(n)` | 返回 [0, n) 之间的随机整数（long） |

## C. 类型转换

| 函数 | 说明 |
|------|------|
| `long(v)` | 转为 long |
| `double(v)` | 转为 double |
| `boolean(v)` | 转为 boolean（除 nil / false 外都是 true） |
| `str(v)` | 转为 string（nil/Java null 会变成字符串 `'null'`） |
| `bigint(x)` | 转为 bigint |
| `decimal(x)` | 转为 decimal（高精度） |

## D. 类型工具

| 函数 | 说明 | 示例 |
|------|------|------|
| `type(x)` | 返回 x 的类型名字符串，如 string / long / double / function | `=type(3)` → "long" |
| `is_a(x, class)` | x 是否是 class 的实例 | `=is_a("a", String)` |
| `is_def(x)` | 变量 x 是否已定义（包括定义为 nil） | — |
| `undef(x)` | "遗忘"变量 x，已定义则取消定义 | — |
| `identity(v)` | 原样返回参数 v，常用于配合 seq 高阶函数 | — |

## E. 集合 / 比较工具

| 函数 | 说明 |
|------|------|
| `range(start, end, [step])` | 创建 [start, end) 整数范围，step 指定步长 |
| `tuple(x1, x2, ...)` | 创建一个 Object[] 数组，元素即参数列表 |
| `comparator(pred)` | 将谓词转为 java.util.Comparator，常用于 sort |
| `max(x1, x2, ...)` | 多参数取最大值（注意不是单元格聚合的 MAX） |
| `min(x1, x2, ...)` | 多参数取最小值 |
| `constantly(x)` | 生成一个函数，无论参数怎么调用都返回 x |

> ⚠️ `eval(script, [bindings], [cached])` 在文档中划掉，**已被安全禁用**，不可用。

---

# Sequence 函数（集合处理，完整列表）

**官方文档**：https://jimureport.com/docs/function/library#sequence-函数集合处理

处理数组 / List / Map / Set 等集合的高阶函数库，全部以 `seq.` 前缀或全局函数形式提供。

## F1. 集合创建

| 函数 | 说明 |
|------|------|
| `repeat(n, x)` | 把元素 x 重复 n 次组成 List |
| `repeatedly(n, f)` | 调用函数 f 共 n 次，结果组成 List |
| `seq.array(clazz, e1, e2, ...)` | 创建 clazz 类型的数组并填入元素 |
| `seq.array_of(clazz, size1, size2, ...)` | 创建 clazz 类型的一维或多维数组，维度按 sizes 指定 |
| `seq.list(p1, p2, ...)` | 创建 ArrayList 并填入参数 |
| `seq.set(p1, p2, ...)` | 创建 HashSet |
| `seq.map(k1, v1, k2, v2, ...)` | 创建 HashMap，参数偶数个，成对作为 key/value |
| `seq.entry(key, value)` | 创建 Map.Entry，用于 map/filter 等 |

## F2. 元素访问 / 修改

| 函数 | 说明 |
|------|------|
| `seq.keys(m)` | 返回 map 的 key 集合 |
| `seq.vals(m)` | 返回 map 的 value 集合 |
| `seq.contains_key(m, key)` | map 是否含 key；数组/List 时检查 index 是否在范围内 |
| `seq.add(coll, element)` | 集合追加元素（也支持 `seq.add(m, key, value)` 三参数版） |
| `seq.put(coll, key, value)` | 类似 List.set，按位置/key 设置值 |
| `seq.remove(coll, element)` | 从集合/map 移除元素/key |
| `seq.get(coll, element)` | 从 list/数组/map 取值，list/数组用 index、map 用 key |
| `into(to_seq, from_seq)` | 把 from 的元素逐个 add 到 to，返回最终的 to_seq |

## F3. 高阶变换

| 函数 | 说明 |
|------|------|
| `map(seq, fun)` | 对每个元素调用 fun，组成新集合 |
| `filter(seq, predicate)` | 保留 predicate 为 true 的元素 |
| `reduce(seq, fun, init)` | 累积 fun 作用到 init 和每个元素上 |
| `take_while(seq, pred)` | 从头取 pred 为 true 的元素，收集成新集合 |
| `drop_while(seq, pred)` | 丢弃 pred 为 true 的元素，返回剩余的 |
| `group_by(seq, keyfn)` | 按 keyfn(x) 结果分类，返回 map |
| `zipmap(keys, values)` | 按顺序映射 keys 和 values 成 HashMap |
| `concat(seq1, seq2)` | 连接两个集合 |
| `sort(seq, [comparator])` | 排序（仅数组/List） |
| `reverse(seq)` | 逆序 |
| `distinct(seq)` | 去重 |

## F4. 集合判断

| 函数 | 说明 |
|------|------|
| `count(seq)` | 返回集合大小（支持数组/字符串/range/List） |
| `is_empty(seq)` | 等价 `count(seq)==0`；空或 nil 时返回 true |
| `is_distinct(seq)` | 无重复元素时返回 true |
| `include(seq, element)` | element 是否在 seq 中（Set 是 O(1)，其他 O(n)） |
| `seq.every(seq, fun)` | 所有元素 fun 调用为 true 时返回 true |
| `seq.not_any(seq, fun)` | 所有元素 fun 调用为 false 时返回 true |
| `seq.some(seq, fun)` | 任一元素为 true 时立即返回该元素 |

## F5. 预制谓词工厂

返回一个谓词函数，常配合 filter / take_while 使用：

| 函数 | 说明 |
|------|------|
| `seq.eq(value)` | 判断 == value |
| `seq.neq(value)` | 判断 != value |
| `seq.gt(value)` | 判断 > value |
| `seq.ge(value)` | 判断 >= value |
| `seq.lt(value)` | 判断 < value |
| `seq.le(value)` | 判断 <= value |
| `seq.nil()` | 判断 == nil |
| `seq.exists()` | 判断 != nil |
| `seq.and(p1, p2, ...)` | 多谓词全部 true 才 true |
| `seq.or(p1, p2, ...)` | 任一谓词 true 即 true |

## F6. 集合极值

| 函数 | 说明 |
|------|------|
| `seq.min(coll)` | 集合最小值（元素需实现 Comparable） |
| `seq.max(coll)` | 集合最大值（元素需实现 Comparable） |

---

> **实务建议**：
> - 单元格表达式日常只用 A/B 中的几个常用调试函数 + NOWSTR/now
> - 类型转换 C 在金额处理（decimal 高精度）中偶尔用
> - Sequence 函数 F 系列在常规报表表达式里**几乎用不到**，是 Aviator 通用脚本能力的一部分
> - 真正业务报表的主力依然是：单元格聚合 + 日期时间 + 字符串 + 条件判断 + 调色样式

---

# 动态 CELL 表达式

文档：https://help.jimureport.com/function/dynamiCell

## 语法

`::列号行号` — 双冒号前缀表示动态单元格位置，行号会在循环列表中自动替换为当前数据行的实际行号。

## 说明

- `::D5` 中的 `5` 没有实际意义，预览时会被替换成动态行的最后一行号
- 只有列号（如 `D`）是有效的，行号自动计算
- 计算规则：实际行号 = 设计行号 + 当前循环数据行数

## 用法1：函数表达式中引用动态单元格

在汇总行使用函数引用列表展开后的最终行：

```
=cnmoney(::D5)
```

示例：设计时 D5 是数据模板行的金额列，列表展开后数据到了 D24，则 `::D5` 自动解析为 `D24`。

## 用法2：计算表达式中使用动态坐标

> 版本要求：1.7.5+（20240424）

当单元格引用在设计时无法确定时，使用动态坐标实现跨行计算：

```
=::D7/::E7
```

适用于列表循环中的占比计算等场景，行号随数据展开自动调整。

## 典型场景

| 场景 | 表达式 | 说明 |
|------|--------|------|
| 大写金额 | `=cnmoney(::D5)` | 引用列表最后一行的金额 |
| 占比计算 | `=::D7/::E7` | 两列动态值相除 |
| 求和引用 | `=SUM(::D5)` | 对动态行求和 |
