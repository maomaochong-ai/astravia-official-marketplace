# 常见表单模式示例

> **推荐方式**：使用 `desform_creator.py` + JSON 配置文件，或使用 `desform_utils.py` 的工厂函数。
> 以下示例均使用推荐的高级方式。

## 模式 A：简单信息录入表单

**场景：** 员工信息登记（姓名、手机、邮箱、部门、备注）

### 方式 1：desform_creator.py + JSON 配置（推荐）

```json
{
  "name": "员工信息登记",
  "code": "employee_info",
  "fields": [
    {"type": "input", "name": "姓名", "required": true},
    {"type": "phone", "name": "手机"},
    {"type": "email", "name": "邮箱"},
    {"type": "select-depart", "name": "部门"},
    {"type": "textarea", "name": "备注"}
  ]
}
```

执行：
```bash
python "<skill目录>/scripts/desform_creator.py" --api-base <api_base> --token <TOKEN> --config config.json
```

### 方式 2：desform_utils.py 工厂函数

```python
import sys
sys.path.insert(0, r'<skill目录>/scripts')
from desform_utils import *

init_api('<api_base>', '<token>')

create_form('员工信息登记', 'employee_info', [
    INPUT('姓名', required=True),
    PHONE('手机'),
    EMAIL('邮箱'),
    DEPART('部门'),
    TEXTAREA('备注'),
])
```

---

## 模式 B：带选项的审批表单

**场景：** 请假申请（请假类型单选、日期、天数、原因、附件）

### JSON 配置

```json
{
  "name": "请假申请",
  "code": "leave_apply",
  "fields": [
    {"type": "radio", "name": "请假类型", "required": true,
     "options": ["事假", "病假", "年假", "婚假"]},
    {"type": "date", "name": "开始日期", "required": true},
    {"type": "date", "name": "结束日期", "required": true},
    {"type": "number", "name": "请假天数", "required": true},
    {"type": "textarea", "name": "请假原因", "required": true},
    {"type": "file-upload", "name": "附件"}
  ]
}
```

### 工厂函数

```python
create_form('请假申请', 'leave_apply', [
    RADIO('请假类型', options=['事假', '病假', '年假', '婚假'], required=True),
    DATE('开始日期', required=True),
    DATE('结束日期', required=True),
    NUMBER('请假天数', required=True),
    TEXTAREA('请假原因', required=True),
    FILE('附件'),
])
```

---

## 模式 C：半行布局（一行两字段）

**场景：** 字段较多时使用半行布局节约空间

### 工厂函数（自动半行）

```python
# layout='half' 强制半行；layout='auto' 字段数>=6时自动半行
create_form('客户信息', 'customer_info', [
    INPUT('客户名称', required=True),
    PHONE('联系电话'),
    EMAIL('邮箱'),
    DEPART('负责部门'),
    SELECT('客户等级', options=['A级', 'B级', 'C级', 'D级']),
    AREA('所在地区'),
    TEXTAREA('备注'),  # textarea 自动保持整行
], layout='half')
```

### 手动半行（width=50）

```python
# 单个控件设 width=50 表示占半行
create_form('联系人', 'contact_info', [
    INPUT('姓名', required=True, width=50),
    PHONE('手机', width=50),
    EMAIL('邮箱', width=50),
    DEPART('部门', width=50),
    TEXTAREA('备注'),  # 默认 width=100 整行
])
```

---

## 模式 D：带子表的表单

**场景：** 采购单主表 + 采购明细子表

### JSON 配置

```json
{
  "name": "采购申请单",
  "code": "purchase_apply",
  "fields": [
    {"type": "input", "name": "采购标题", "required": true},
    {"type": "select-user", "name": "申请人", "required": true},
    {"type": "date", "name": "申请日期", "required": true},
    {"type": "textarea", "name": "采购说明"}
  ],
  "subTables": [
    {
      "name": "采购明细",
      "columnNumber": 2,
      "fields": [
        {"type": "input", "name": "物品名称", "required": true},
        {"type": "integer", "name": "数量", "required": true},
        {"type": "money", "name": "单价"},
        {"type": "textarea", "name": "备注", "col_width": "250px"}
      ]
    }
  ]
}
```

### 工厂函数

```python
create_form('采购申请单', 'purchase_apply', [
    INPUT('采购标题', required=True),
    USER('申请人', required=True),
    DATE('申请日期', required=True),
    TEXTAREA('采购说明'),
    make_sub_table('采购明细', [
        SUB_INPUT('物品名称', required=True),
        SUB_INTEGER('数量', required=True),
        SUB_MONEY('单价'),
        SUB_TEXTAREA('备注', col_width='250px'),
    ], column_number=2),
])
```

---

## 模式 E：带字典的表单

**场景：** 使用系统字典的选择控件

### 工厂函数

```python
create_form('人员信息', 'person_info', [
    INPUT('姓名', required=True),
    # 使用系统字典：sex（性别）
    RADIO('性别', dict_code='sex', required=True),
    # 使用系统字典：priority（优先级）
    SELECT('优先级', dict_code='priority'),
    # 静态选项
    CHECKBOX('技能', options=['Java', 'Python', 'JavaScript', 'Go']),
    TEXTAREA('备注'),
])
```

---

## 模式 F：带关联记录的表单

**场景：** 联系人表单关联客户表单

```python
# 先创建客户表单
create_form('客户信息', 'customer_info', [
    INPUT('客户名称', required=True),
    PHONE('电话'),
])

# 查询客户表单的字段信息
tf, fields = get_form_fields('customer_info')

# 创建联系人表单，关联客户
create_form('联系人', 'contact_info', [
    INPUT('姓名', required=True),
    PHONE('手机'),
    LINK_RECORD('所属客户', 'customer_info', tf, [fields['客户名称']['model']]),
])
```

---

## 模式 G：Word 风格表单

**场景：** 正式审批单，表格边框样式

```python
create_form('提成申请单', 'commission_apply', [
    USER('申请人', required=True),
    DEPART('部门', required=True),
    DATE('申请日期', required=True),
    INPUT('项目名称', required=True),
    MONEY('合同金额', required=True),
    MONEY('提成金额', required=True),
    TEXTAREA('提成说明'),
    FILE('附件'),
], layout='word')
```

---

## 模式 H：使用 GRID 和 CARD 容器

**场景：** 需要精确控制布局的复杂表单

```python
# 使用 GRID 栅格布局
left_w, _, _ = INPUT('左侧字段', wrap=False)
right_w, _, _ = PHONE('右侧字段', wrap=False)
grid_w, _, _ = GRID([
    (12, [left_w]),
    (12, [right_w]),
])

# 使用 CARD 容器
name_w, _, _ = INPUT('姓名', wrap=False)
phone_w, _, _ = PHONE('手机', wrap=False)
card_w, _, _ = CARD(name_w, phone_w, row_num=2)

# 使用 TABS 标签页
tabs_w, _, _ = TABS(['基本信息', '详细信息'])
basic_input, _, _ = INPUT('姓名', required=True, wrap=False)
tabs_w['panes'][0]['list'].append(basic_input)
detail_input, _, _ = TEXTAREA('详细描述', wrap=False)
tabs_w['panes'][1]['list'].append(detail_input)

create_form('复杂表单', 'complex_form', [grid_w, card_w, tabs_w])
```

---

## 模式 I：移动端表单视图

**场景：** 为已有表单创建移动端表单视图

```python
# 创建移动端表单视图（自动复制主表单视图设计）
create_view('customer_info', '客户信息(移动端)', 'customer_info_mobile', is_mobile=True)

# 或者使用 mobile_options 为移动端优化控件
create_form('移动端表单', 'mobile_form', [
    INPUT('标题', required=True),
    RADIO('类型', options=['A', 'B', 'C'],
          mobile_options={"inline": True, "matrixWidth": 120}),
    DATE('日期', mobile_options={"editable": False}),
    TEXTAREA('备注'),
], layout='full')
```
