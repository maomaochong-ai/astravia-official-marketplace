# 横向分组配置 (groupRight / customGroup)

积木报表横向分组两种方式：横向动态分组 (groupRight+dynamic) 和自定义横向分组 (customGroup)。

---

## 5.3 横向分组

积木报表有两种横向分组方式，根据场景选择：

### 选择决策

| 场景 | 推荐方式 | 说明 |
|------|---------|------|
| "依次显示 A、B、C"，每行一个字段，数据往右铺开（每条记录=一列） | **纯横向 groupRight 多级** | 所有分组字段都用 groupRight，最后一行用 dynamic；**无纵向 group，isGroup=False** |
| 行是一个维度（如月份），列是另一个维度（如团队），交叉格填值 | **纵横组合（group + groupRight）** | 行头用 group 纵向分组，列头用 groupRight 横向展开，交叉值用 dynamic；**isGroup=True** |
| 每条记录横向展开，每行一个字段（无 dynamic） | **自定义横向分组 (customGroup)** | 卡片横向展开，不需要 dynamic |

**关键区别：** 用户说"依次显示月份、团队、金额"≠交叉表。前者是**纯横向**（月份+团队都 groupRight，isGroup=False）；后者是**纵横组合**（月份做行，团队做列，isGroup=True）。判断依据：**有没有一个字段做行头（纵向）？有→纵横组合；没有→纯横向**。

---

### 5.3.1 横向动态分组 (groupRight + dynamic)

将某个字段的值横向展开为列头，配合 `dynamic()` 在交叉单元格中填充数据。适用于交叉表、月度统计等场景。

**参考文档：** https://help.jimureport.com/group/transverseDynamic

#### 核心语法

| 语法 | 用途 |
|------|------|
| `#{db.groupRight(field)}` | 横向展开列头（如月份、楼号） |
| `#{db.dynamic(field)}` | 交叉单元格动态值（如销售额、人数） |
| `#{db.group(field)}` | 纵向分组行头（如省份、社区） |

#### 布局模式

多级横向分组（月份 + 省份都横向展开，销售额为 dynamic 值）：

```
              省份月度销售统计
┌────────┬────────┬────────┬────────┬────────┬────────┬───
│ 月份   │  1月   │  1月   │  1月   │  2月   │  2月   │ ← groupRight(month)
│ 省份   │ 广东省 │ 江苏省 │ 浙江省 │ 广东省 │ 江苏省 │ ← groupRight(province)
│ 销售额 │ 85000  │ 72000  │ 65000  │ 92000  │ 68000  │ ← dynamic(sales)
└────────┴────────┴────────┴────────┴────────┴────────┴───
```

也支持纵向 + 横向混合（行头用 group，列头用 groupRight）：

```
┌────────┬────────┬────────┬────────┐
│ 省份   │  1月   │  2月   │  3月   │ ← groupRight(month)
│ 广东省 │ 85000  │ 92000  │ 78000  │ ← group(province) + dynamic(sales)
│ 江苏省 │ 72000  │ 68000  │ 81000  │
└────────┴────────┴────────┴────────┘
```

#### 单元格属性

**横向列头（groupRight）：** 蓝底白字表头样式
```json
{
    "text": "#{db.groupRight(field)}",
    "style": 4,
    "aggregate": "group",
    "direction": "right"
}
```

**动态值（dynamic）：** 普通数据行样式，与值字段保持一致
```json
{
    "text": "#{db.dynamic(field)}",
    "style": 2
}
```

**纵向行头（group，可选）：**
```json
{
    "text": "#{db.group(field)}",
    "style": 2,
    "aggregate": "group"
}
```

**完整 JSON 示例见** `examples/horizontal-group.md` 示例1 和 `examples/multi-level-header.md` 示例3。

#### 关键点

1. **最多支持3级动态表头** — groupRight 可嵌套最多3层
2. **必须有 dynamic 字段** — groupRight 列头下方必须有 `#{db.dynamic(field)}` 值字段，否则无法渲染
3. **groupRight 需要 merge 合并下方列数** — 横向分组单元格需要用 `merge: [0, N-1]` 合并 N 列（N = 下方 dynamic/compute 字段数）。例如下方有 sales、donation、compute 三个字段，则 groupRight 设置 `merge: [0, 2]` 合并3列
4. **第一条数据必须完整** — 如需显示1-12月列，数据集第一条记录必须包含所有月份
5. **groupRight 都是横向展开** — 多个 groupRight 字段各占一行，都向右展开
6. **dynamic 值行样式与数据一致** — 用普通数据样式，不要用表头样式
7. **merges 预留足够列** — 标题合并范围要预留横向展开的空间
8. **groupRight 和 dynamic/group 在相邻行** — groupRight 表头占一行，dynamic+group 数据在下一行，不要多加空行

#### 横向纵向组合分组（多级循环表头）

当报表同时需要**行头纵向分组** + **列头横向分组** + **动态数据填充**时，使用 group + groupRight + dynamic 组合。

**参考文档：** https://help.jimureport.com/group/directionDynamic
**完整 JSON 示例见** `examples/multi-level-header.md`（示例1：二级表头 + 示例2：纵横组合）。

| 部分 | 语法 | 说明 |
|------|------|------|
| 行头（纵向分组） | `#{db.group(field)}` | 纵向合并相同值 |
| 列头（横向分组） | `#{db.groupRight(field)}` | 横向展开为动态列 |
| 数据区域（动态值） | `#{db.dynamic(field)}` | 填充交叉单元格 |

**纵向分组小计（subtotalSubtotal）：**

在横向纵向组合动态列中，对某级纵向分组加小计行：

```python
# 省份（小计依据）：subtotal="groupField" → 每省下方自动插入小计行
"2": {"text": "#{test.group(province)}",
      "aggregate": "group",
      "subtotal":  "groupField",   # ← 触发小计行
      "funcname":  "-1",
      "subtotalText": "小计"}

# 动态值：subtotal="-1" + funcname="SUM" → 小计行自动求和
"4": {"text": "#{test.dynamic(sales)}",
      "subtotal": "-1", "funcname": "SUM"}
```

**规则：**
1. 纵向分组**至少两列**（如大区+省份+城市），小计依据设在中间层
2. `subtotal:"groupField"` 只能设在**非最底层**的 group 字段上
3. dynamic 值列同时加 `subtotal:"-1" + funcname:"SUM"` 才会在小计行求和
4. 城市（最底层 group）不设 subtotal，小计行城市格显示"小计"文字

**特殊规则：**
1. 动态列之前的列字段**必须**设置成纵向分组（group）
2. 横向分组下**必须**有动态列（dynamic）
3. 多个 dynamic 字段会在每个横向分组值下重复展开
4. 第一条数据必须完整
5. 最多3级动态表头

**⚠️ 静态列表头 merge 行数（极易踩坑）：**

静态列表头（纵向分组列，如年级/班级/姓名）的 `merge=[N, 0]` 中：

> **N = 横向表头行数 - 1**（只跨表头行，**不包含数据行**）

| 横向表头层数 | 布局行（表头） | 正确 merge | merges 写法 |
|------------|-------------|-----------|------------|
| 1级（如月份） + 静态子列 | row2=groupRight, row3=子表头 | `[1, 0]` | `B2:B3` |
| 2级（如年度+学期） + 静态子列 | row2=year, row3=semester, row4=子表头 | `[2, 0]` | `B2:B4` |
| 3级 + 静态子列 | row2,row3,row4=groupRight, row5=子表头 | `[3, 0]` | `B2:B5` |

**数据行（group/dynamic 绑定行）永远在最后，不计入 merge 范围。** 若多算1行，数据行被覆盖，所有数据列显示为空。

**完整4行布局模式（带二级子列表头）：**

```
code行 → UI行:
  row "1" → UI row 2: 标题（merge=[0,31] 跨所有列）
  row "2" → UI row 3: 大区(merge=[1,0]纵跨2行) | 省份(merge=[1,0]) | groupRight(月份,merge=[0,2]横跨3子列)
  row "3" → UI row 4: [merged]                  | [merged]           | 销售额 | 捐赠额 | 占比
  row "4" → UI row 5: group(region)              | group(province)    | dynamic(sales) | dynamic(gift) | dynamic(proportion)
```

**关键 JSON 属性：**
```python
# row "2": 静态表头纵跨2行
"1": {"text": "大区", "style": 1, "merge": [1, 0]}   # merge=[1,0] = 多占1行
"3": {  # groupRight 横向月份表头，横跨3个子列
    "text": "#{area.groupRight(month)}",
    "aggregate": "group", "direction": "right",
    "merge": [0, 2]   # 每个月份实例横跨3列
}

# row "3": 二级子列表头（不写col"1","2"，已被上行merge覆盖）
# 这3个静态单元格在 groupRight 作用域内，随月份自动重复

# row "4": 数据行
"1": {"text": "#{area.group(region)}", "aggregate": "group"}
"3": {"text": "#{area.dynamic(sales)}"}
```

**merges 数组：**
```python
merges = [
    "B2:AG2",  # 标题（2静态+30动态=32列，10月×3字段）
    "B3:B4",   # 大区 纵跨 UI row 3-4
    "C3:C4",   # 省份 纵跨 UI row 3-4
    "D3:F3",   # 月份模板横跨3子列（引擎按月数自动扩展）
]
```

**base_save 参数：** `isGroup=True, groupField="area.region"`（第一级纵向分组字段）

#### 横向分组小计/总计

**参考文档：** https://help.jimureport.com/group/horizontalSubtotal

两种方式：

**方式一：SUM 公式（表头固定，不循环）**

```
=SUM(D7,E7)     单元格逗号分隔
=SUM(M7:N7)     单元格范围（包含中间列）
```

适用于固定表头结构，放在数据行同行或总计行中。大小写均可。

**方式二：compute 表达式（表头动态循环）**

```
#{db.compute(field1+field2)}
```

示例：`#{area.compute(sales+gift)}` — 对每个横向分组内的 sales 和 gift 求和

- `compute` 为固定关键字，支持 `+` `-` `*` `/` 四则运算
- 适用于 groupRight 动态展开的场景，小计列会跟随横向分组自动循环
- 总计行也可使用同样方式

**选择依据：**

| 场景 | 推荐方式 |
|------|---------|
| 表头固定不变 | `=SUM(D7,E7)` 或 `=SUM(D7:F7)` |
| 表头由 groupRight 动态展开 | `#{db.compute(field1+field2)}` |

**compute 完整用法（动态列小计）：**

```python
# 在数据行中，与 dynamic 同层放置 compute 列
# 每月模板 3 列：销售额 | 捐赠额 | 小计
"3": {"text": "#{area.dynamic(sales)}",        "style": S_DATA},
"4": {"text": "#{area.dynamic(gift)}",         "style": S_DATA},
"5": {"text": "#{area.compute(sales+gift)}",   "style": S_SUBTOTAL},

# groupRight 表头 merge=[0,2]（横跨3子列）
# 子列表头 row 对应：销售额 | 捐赠额 | 小计
# merges: "D3:F3"（月份模板3列）
```

- `compute` 为固定关键字，支持 `+` `-` `*` `/` 四则运算
- 作用域：当前行、当前横向分组内的计算（非跨行汇总）
- 与 `dynamic` 并列放在数据行，随 groupRight 自动展开

---

#### 跟随分组扩展统计行（rightFollowExten）

> **⚠️ 常见误区**：不要在 dynamic 单元格上设 `funcname:"MAX/MIN/SUM"` 来实现底部统计——那不会生成跟随横向扩展的统计行。正确做法是在数据行下方添加**独立静态行**，使用 Excel 公式 + `rightFollowExten:"follow"`。

**适用场景：** 交叉表（groupRight+dynamic）底部需要跟随横向动态列展开的汇总行（最大值、最小值、合计、平均值等）。

**核心属性：**

| 属性 | 值 | 作用 |
|------|-----|------|
| `rightFollowExten` | `"follow"` | 让该单元格随 groupRight 横向扩展，公式引用自动复制到每个动态列 |

**统计行写法（在数据行下方追加独立行）：**

> **⚠️ rightFollowExten 设置规则：第一条统计行不设 `rightFollowExten`，从第二条统计行起才设 `rightFollowExten:"follow"`。**

```python
# 假设数据行在 row "5"（UI row 6），动态列起始于 col "6"（G列）
"6": {   # 统计行1（第一条）：不设 rightFollowExten
    "cells": {
        "0": {"text": "", "style": S_NO_BORDER},
        "1": {"text": "语文总合计：", "style": S_STAT, "merge": [0, 4]},
        "6": {"text": "=SUM(G6)", "style": S_STAT},   # ← 无 rightFollowExten
        "7": {"text": " ", "style": S_STAT},
        "8": {"text": " ", "style": S_STAT},
    }
},
"7": {   # 统计行2（第二条起）：设 rightFollowExten:"follow"
    "cells": {
        "0": {"text": "", "style": S_NO_BORDER},
        "1": {"text": "语文最高分：", "style": S_STAT, "merge": [0, 4]},
        "6": {"text": "=MAX(G6)", "style": S_STAT, "rightFollowExten": "follow"},
        "7": {"text": " ", "style": S_STAT},
        "8": {"text": " ", "style": S_STAT},
    }
},
"8": {   # 统计行3：设 rightFollowExten:"follow"
    "cells": {
        "0": {"text": "", "style": S_NO_BORDER},
        "1": {"text": "语文平均值：", "style": S_STAT, "merge": [0, 4]},
        "6": {"text": "=AVERAGE(G6)", "style": S_STAT, "rightFollowExten": "follow"},
        "7": {"text": " ", "style": S_STAT},
        "8": {"text": " ", "style": S_STAT},
    }
},
```

merges 需加标签列的合并范围（UI 行号）：
```python
merges += ["B7:F7", "B8:F8", "B9:F9"]  # 统计行标签合并（对应 row 6/7/8 → UI 7/8/9）
```

**公式列号对应规则：**

| dynamic 字段 | col 索引 | Excel 列 | 公式引用 |
|-------------|---------|---------|---------|
| 第1个（如 chinese） | "6" | G | `=MAX(G6)` |
| 第2个（如 math） | "7" | H | `=MIN(H6)` |
| 第3个（如 english） | "8" | I | `=SUM(I6)` |

> 公式行号（如 `G6`）= 数据行的 UI 行号（code row + 1）。

**数据行正确结构（配合统计行使用）：**

```python
# ✅ 正确：dynamic 字段不设 funcname，数据行保持干净
"5": {
    "cells": {
        "1": {"text": "#{db.group(grade)}", "aggregate": "group", "subtotal": "-1", "funcname": "-1"},
        "2": {"text": "#{db.group(className)}", "aggregate": "group"},
        # stuName/gender/age：非分组维度用 aggregate:"select"，不用 group()
        "3": {"text": "#{db.stuName}", "aggregate": "select", "subtotal": "-1"},
        "4": {"text": "#{db.gender}",  "aggregate": "select", "subtotal": "-1"},
        "5": {"text": "#{db.age}",     "aggregate": "select", "subtotal": "-1"},
        # dynamic 字段：funcname 必须设为 "-1"（不聚合），底部统计行另用 rightFollowExten 实现
        "6": {"text": "#{db.dynamic(chinese)}", "aggregate": "dynamic", "subtotal": "-1", "funcname": "-1"},
        "7": {"text": "#{db.dynamic(math)}",    "subtotal": "-1", "funcname": "-1"},
        "8": {"text": "#{db.dynamic(english)}", "subtotal": "-1", "funcname": "-1"},
    }
}
# ❌ 错误：funcname 设为 "MAX"/"MIN"/"SUM" 不会生成跟随横向扩展的统计行，必须设为 "-1"
```

**groupRight 外层 merge 规则：**

当数据行有 N 个 dynamic 字段时，外层 groupRight 单元格需设 `merge:[0, N-1]`，merges 数组也需补充对应合并项：

```python
# 3个动态字段（chinese/math/english），semester groupRight merge=[0,2]
"6": {  # row "2", col "6"：groupRight(year)
    "text": "#{db.groupRight(year)}", "merge": [0, 2],   # ← 必须设置
    "aggregate": "group", "direction": "right"
}
# merges 加：
merges += ["G3:I3"]   # year groupRight 模板列（row2→UI3，col6=G，merge3列）
merges += ["G4:I4"]   # semester groupRight 模板列
```

**isGroup / groupField：** 交叉表使用 rightFollowExten 统计行时，**不需要**设置 `isGroup=True` 或 `groupField`，直接省略即可。

---

### 5.3.2 自定义横向分组 (customGroup)

将数据集的每条记录横向展开为列，每行显示一个字段。适用于横向统计表、数据透视等场景。

#### 核心语法

```
#{数据集编码.customGroup(字段名)}
```

### 与其他分组方式的区别

| 语法 | 方向 | 效果 |
|------|------|------|
| `#{db.group(field)}` | **纵向** | 按字段值分组，相同值合并行 |
| `#{db.groupRight(field)}` | **横向** | 按字段值动态展开列（交叉表） |
| `#{db.customGroup(field)}` | **横向** | 每条记录展开为一列，每行一个字段 |

### 布局模式

```
              标题
┌──────────┬────────┬────────┬────────┬───
│ 字段A标签 │ 记录1值 │ 记录2值 │ 记录3值 │ ← customGroup(fieldA) →
│ 字段B标签 │ 记录1值 │ 记录2值 │ 记录3值 │ ← customGroup(fieldB) →
│ 字段C标签 │ 记录1值 │ 记录2值 │ 记录3值 │ ← customGroup(fieldC) →
└──────────┴────────┴────────┴────────┴───
```

- **每行** = 一个字段，col 1 是标签，col 2 用 `customGroup` + `direction:"right"` 向右展开
- **每列** = 一条记录的所有字段值纵向排列
- 记录数量决定列数（动态扩展）

### 单元格关键属性

| 属性 | 值 | 说明 |
|------|-----|------|
| `text` | `#{db.customGroup(field)}` | 横向展开语法 |
| `direction` | `"right"` | **必须设置**，标记横向展开方向 |
| `rendered` | `""` | 渲染标记（第一个展开行需要） |
| `isDrag` | `true` | 行级属性，标记可拖拽 |
| `style` | 数值索引 | 标签列用 style 7（蓝底），值列用 style 11（白底居中带边框） |

### 完整参考 JSON（员工信息横向统计表）

来源：`examples/horizontal-group.md`，数据集编码 `hex`，字段为员工信息。

```json
{
    "loopBlockList": [],
    "printConfig": {"paper": "A4", "width": 210, "height": 297, "definition": 1, "isBackend": false, "marginX": 10, "marginY": 10},
    "area": {"sri": 7, "sci": 5, "eri": 7, "eci": 5, "width": 100, "height": 36},
    "rows": {
        "1": {
            "cells": {"0": {"text": "员工信息横向统计表", "style": 9, "merge": [0, 11]}},
            "height": 97
        },
        "2": {
            "cells": {
                "1": {"text": "部门", "style": 7},
                "2": {"text": "#{hex.customGroup(department)}", "style": 11, "direction": "right", "rendered": ""}
            },
            "isDrag": true, "height": 40
        },
        "3": {
            "cells": {
                "1": {"text": "学历", "style": 7},
                "2": {"text": "#{hex.customGroup(education)}", "style": 11, "direction": "right"}
            },
            "isDrag": true, "height": 39
        },
        "4": {
            "cells": {
                "1": {"text": "性别", "style": 7},
                "2": {"text": "#{hex.customGroup(sex)}", "style": 11, "direction": "right"}
            },
            "isDrag": true, "height": 41
        },
        "5": {
            "cells": {
                "1": {"text": "年龄", "style": 7},
                "2": {"text": "#{hex.customGroup(age)}", "style": 11}
            },
            "isDrag": true, "height": 39
        },
        "6": {
            "cells": {
                "1": {"text": "姓名", "style": 7},
                "2": {"text": "#{hex.customGroup(name)}", "style": 11, "direction": "right"}
            },
            "isDrag": true, "height": 40
        },
        "7": {
            "cells": {
                "1": {"text": "薪水", "style": 7},
                "2": {"text": "#{hex.customGroup(salary)}", "style": 11, "direction": "right"}
            },
            "isDrag": true, "height": 36
        },
        "len": 100
    },
    "cols": {"0": {"width": 44}, "1": {"width": 79}, "2": {"width": 81}, "len": 50},
    "merges": ["A2:L2"],
    "styles": [
        {"bgcolor": "#9cc2e6"},
        {"bgcolor": "#9cc2e6", "align": "center"},
        {"bgcolor": "#9cc2e6", "align": "center", "border": {"bottom": ["thin","#5b9cd6"], "top": ["thin","#5b9cd6"], "left": ["thin","#5b9cd6"], "right": ["thin","#5b9cd6"]}},
        {"border": {"bottom": ["thin","#5b9cd6"], "top": ["thin","#5b9cd6"], "left": ["thin","#5b9cd6"], "right": ["thin","#5b9cd6"]}},
        {"align": "center"},
        {"align": "center", "font": {"bold": true}},
        {"align": "center", "font": {"bold": true, "size": 14}},
        {"bgcolor": "#9cc2e6", "align": "center", "border": {"bottom": ["thin","#5b9cd6"], "top": ["thin","#5b9cd6"], "left": ["thin","#5b9cd6"], "right": ["thin","#5b9cd6"]}, "font": {"name": "宋体"}},
        {"border": {"bottom": ["thin","#5b9cd6"], "top": ["thin","#5b9cd6"], "left": ["thin","#5b9cd6"], "right": ["thin","#5b9cd6"]}, "font": {"name": "宋体"}},
        {"align": "center", "font": {"bold": true, "size": 14, "name": "宋体"}},
        {"align": "center", "font": {"bold": false, "size": 14, "name": "宋体"}},
        {"border": {"bottom": ["thin","#5b9cd6"], "top": ["thin","#5b9cd6"], "left": ["thin","#5b9cd6"], "right": ["thin","#5b9cd6"]}, "font": {"name": "宋体"}, "align": "center"}
    ]
}
```

### 关键样式索引

| 索引 | 效果 | 用途 |
|------|------|------|
| 7 | 蓝底(`#9cc2e6`)+居中+蓝边框+宋体 | 标签列（部门、学历、性别...） |
| 9 | 居中+加粗14号宋体 | 标题行 |
| 11 | 白底+居中+蓝边框+宋体 | 值列（customGroup展开的数据） |

### 关键点

1. **`direction: "right"` 必须设置** — 每个 customGroup 单元格都需要，否则不会横向展开
2. **第一行加 `rendered: ""`** — 第一个展开字段（如"部门"行）需要加 `rendered` 属性
3. **某行不加 `direction`** — 如"年龄"行无 `direction: "right"`，则该行数据纵向排列（不横向展开），可灵活混用
4. **`isDrag: true`** — 每个数据行需要设置
5. **area** — `area.sri`/`area.eri` 设为最后一个数据行的下一行位置
6. **cols 索引从 0 开始** — col 0 是标签列前的空列（width: 44），col 1 标签列，col 2 值列
7. **merges 留足空间** — 标题合并如 `"A2:L2"` 需要预留足够列数容纳横向展开
8. **loopBlockList 为空** — 自定义横向分组不使用循环块
9. **不要添加多余的辅助行** — 参考示例 JSON 中数据行之后无需额外空行。如果添加了含 `direction: "right"` 或 `aggregate: "group"` 的空行，会在设计器中显示多余的横向分组标识

标签列用蓝底（`#9cc2e6`）+ 蓝边框（`#5b9cd6`），值列用白底 + 蓝边框居中。

