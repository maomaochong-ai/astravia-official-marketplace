# 数据填报（fillForm）完整参考

积木报表数据填报模式：在 Excel 式报表单元格中嵌入表单控件，用户填写后提交到后端数据库。

---

## 一、启用填报模式

在 `designerObj` 中设置 `submitForm: 1`：

```python
designer = make_designer(report_name)
designer["submitForm"] = 1  # 0=普通报表，1=数据填报报表
```

> 启用后设计器会自动切换到填报设计视图，单元格可以放置填报控件。

---

## 二、支持的填报控件类型

| componentFlag | component | 控件名 | 类别 |
|--------------|-----------|--------|------|
| `input-text` | `Input` | 单行文本 | 基础 |
| `input-textarea` | `Input` | 多行文本 | 基础 |
| `InputNumber` | `InputNumber` | 数字 | 基础 |
| `JMoney` | `JMoney` | 金额 | 基础 |
| `JRadio` | `JRadio` | 单选框组 | 基础 |
| `JCheckbox` | `JCheckbox` | 多选框组 | 基础 |
| `JSelect` | `JSelect` | 下拉选择框 | 基础 |
| `DatePicker-date` | `DatePicker` | 日期 | 基础 |
| `DatePicker-time` | `DatePicker` | 日期时间 | 基础 |
| `TimePicker` | `TimePicker` | 时间 | 基础 |
| `JSwitch` | `JSwitch` | 开关 | 基础 |
| `ColorPicker` | `ColorPicker` | 颜色选择器 | 基础 |
| `JAreaLinkage` | `JAreaLinkage` | 省市区联动 | 高级 |
| `JUploadImage` | `JUploadImage` | 图片上传 | 高级 |
| `JUploadFile` | `JUploadFile` | 文件上传 | 高级 |
| `JRole` | `JRole` | 组织角色 | 高级 |
| `JDepartment` | `JDepartment` | 部门组件 | 高级 |
| `JUser` | `JUser` | 用户组件 | 高级 |
| `JSelectTree` | `JSelectTree` | 下拉树 | 高级 |

---

## 三、cell.fillForm 通用属性

所有控件共用的基础属性（存储在 `cell.fillForm` 对象中）：

```python
cell["fillForm"] = {
    "componentFlag": "input-text",  # 控件类型标识（必填）
    "component": "Input",           # Vue 组件 tag（必填）
    "field": "user_name",           # 数据绑定字段名（必填，用于提交后端）
    "value": None,                  # 当前值（运行时，初始 None）
    "defaultValue": None,           # 默认值
    "placeholder": "请输入",         # 占位文本
    "required": False,              # 是否必填
    "requiredTip": "不能为空~",       # 必填提示
    "pattern": "",                  # 自定义正则
    "patternErrorTip": "",          # 正则校验失败提示
    "disabled": False,              # 禁用
    "readonly": False,              # 只读
    "hidden": False,                # 隐藏
    "unique": False,                # 不允许重复
    "cnLabel": "",                  # 字段显示名称（中文，用于函数计算中标识）
    "label": "",                    # 关联 label 单元格坐标（如 "B5"）
    "labelText": "",                # label 文本（如 "姓名"）
    "requiredRelevanceCell": "",    # 必填关联单元格
    "dbFieldBind": [],              # 绑定数据库字段列表
    "defaultValFunc": "",           # 默认值函数表达式（Base64 编码）
    "nativeFunctionEnabled": False, # 是否使用自定义函数计算默认值
}
```

---

## 四、各控件专属配置

### 4.1 单行文本 / 多行文本

```python
cell["fillForm"] = {
    "componentFlag": "input-text",  # 多行文本用 "input-textarea"
    "component": "Input",
    "field": "remark",
    "placeholder": "请输入",
    "required": True,
    "pattern": "",           # 可选：自定义正则，如 "^\\d+$"
    "patternErrorTip": "",   # 正则校验失败提示
}
```

### 4.2 数字（InputNumber）

```python
cell["fillForm"] = {
    "componentFlag": "InputNumber",
    "component": "InputNumber",
    "field": "age",
    "precision": -1,          # -1=不限小数位，0=整数，1/2/4=保留N位
    "isLimitMinNum": True,    # 是否限制最小值
    "minNum": 0,
    "isLimitMaxNum": True,    # 是否限制最大值
    "maxNum": 100,
}
```

### 4.3 金额（JMoney）

```python
cell["fillForm"] = {
    "componentFlag": "JMoney",
    "component": "JMoney",
    "field": "amount",
    "precision": 2,           # 小数位，0=整数，2=保留2位
    "addon": "append",        # 单位位置：append=后缀，prepend=前缀
    "moenyUnit": "元",         # 单位文本
}
```

### 4.4 单选框组（JRadio）/ 多选框组（JCheckbox）

```python
cell["fillForm"] = {
    "componentFlag": "JRadio",  # 多选用 "JCheckbox"
    "component": "JRadio",
    "field": "gender",
    # 选项来源：static=静态，api=接口，dict=字典
    "dataSource": "static",
    "options": [
        {"label": "男", "value": "1"},
        {"label": "女", "value": "0"},
    ],
    # 使用字典时：
    # "dataSource": "dict",
    # "dictCode": "sex",     # 字典编码
    # "dictName": "性别",
    # 使用接口时：
    # "dataSource": "api",
    # "apiUrl": "http://...",
    "h_align": "left",       # 水平对齐：left/center/right
}
```

### 4.5 下拉选择框（JSelect）

```python
cell["fillForm"] = {
    "componentFlag": "JSelect",
    "component": "JSelect",
    "field": "department",
    "multiple": False,         # 是否多选
    "dataSource": "static",
    "options": [
        {"label": "研发部", "value": "dev"},
        {"label": "销售部", "value": "sales"},
    ],
    # 字典选项（可选）：
    # "dataSource": "dict",
    # "dictCode": "dept_type",
    "placeholder": "请选择",
}
```

### 4.6 日期（DatePicker-date）

```python
cell["fillForm"] = {
    "componentFlag": "DatePicker-date",
    "component": "DatePicker",
    "field": "birth_date",
    "dateFormat": "yyyy-MM-dd",    # 日期格式
    "dateShowType": "date",        # 显示类型：date/daterange/year/month
    "placeholder": "请选择日期",
}
```

### 4.7 日期时间（DatePicker-time）

```python
cell["fillForm"] = {
    "componentFlag": "DatePicker-time",
    "component": "DatePicker",
    "field": "create_time",
    "dateFormat": "yyyy-MM-dd HH:mm:ss",
    "dateShowType": "datetime",
}
```

### 4.8 时间（TimePicker）

```python
cell["fillForm"] = {
    "componentFlag": "TimePicker",
    "component": "TimePicker",
    "field": "work_time",
    "isRangTime": False,           # 是否为范围选择（时间段）
    "timeType": "time",            # time=时间选择器
}
```

### 4.9 开关（JSwitch）

```python
cell["fillForm"] = {
    "componentFlag": "JSwitch",
    "component": "JSwitch",
    "field": "is_active",
    "switchOpen": "Y",     # 开启时的值
    "switchClose": "N",    # 关闭时的值
    "h_align": "left",
}
```

### 4.10 省市区联动（JAreaLinkage）

```python
cell["fillForm"] = {
    "componentFlag": "JAreaLinkage",
    "component": "JAreaLinkage",
    "field": "address",
    "areaType": "region",  # region=省市区，city=省市，province=省
    "placeholder": "请选择地区",
}
```

### 4.11 图片上传（JUploadImage）/ 文件上传（JUploadFile）

```python
cell["fillForm"] = {
    "componentFlag": "JUploadImage",  # 文件用 "JUploadFile"
    "component": "JUploadImage",
    "field": "avatar",
    "multiple": False,         # 是否允许批量上传
    "maxUploadNum": 1,         # 最大上传数量
    "h_align": "left",
}
```

### 4.12 下拉树（JSelectTree）

```python
cell["fillForm"] = {
    "componentFlag": "JSelectTree",
    "component": "JSelectTree",
    "field": "org_code",
    "multiple": False,
    "apiUrl": "http://xxx/sys/category/queryListByCode",  # 树数据 API 地址
    "placeholder": "请选择",
}
```

### 4.13 组织角色 / 部门 / 用户

```python
# 组织角色
cell["fillForm"] = {
    "componentFlag": "JRole",
    "component": "JRole",
    "field": "role_code",
    "multiple": False,
    "apiUrl": "",        # 获取角色列表的 API 地址
    "placeholder": "请选择角色",
}

# 部门组件
cell["fillForm"] = {
    "componentFlag": "JDepartment",
    "component": "JDepartment",
    "field": "dept_code",
    "multiple": False,
    "apiUrl": "",        # 获取部门列表的 API 地址
}

# 用户组件
cell["fillForm"] = {
    "componentFlag": "JUser",
    "component": "JUser",
    "field": "user_id",
    "multiple": False,
    "apiUrl": "",        # 获取用户列表的 API 地址
}
```

---

## 五、save 根级填报配置字段

除了 `rows`/`cols`/`styles` 等通用字段外，填报报表还需传入：

```python
payload = base_save(report_id, designer,
    rows=rows, cols=cols, styles=styles, merges=merges,
)
# 填报布局配置
payload["fillFormInfo"] = {
    "layout": {
        "direction": "horizontal",  # horizontal=上窄下宽，vertical=左窄右宽
        "width": 200,               # 控件宽度（px）
        "height": 45,               # 控件行高（px）
    }
}
# 填报预览工具条按钮
payload["fillFormToolbar"] = {
    "show": True,
    "btnList": [
        "save",          # 保存/提交
        "verify",        # 校验
        "subTable_add",  # 子表新增行
        "subTable_del",  # 子表删除行
        "print",         # 打印
        "close",         # 关闭
        "exportExcel",   # 导出Excel
        "exportPDF",     # 导出PDF
        "exportWord",    # 导出Word
        # 分页相关（有查询功能时）：
        # "first", "prev", "next", "last", "paging", "total"
    ]
}
```

---

## 六、完整填报报表示例（单表）

```python
import sys
sys.path.insert(0, '<skill目录>/scripts')
from jimureport_utils import Session, gen_id, make_designer, base_save, make_styles

session = Session("http://BASE_URL/jmreport", token="TOKEN")

report_id = gen_id()
designer = make_designer("员工信息填报")
designer["submitForm"] = 1   # ← 关键：启用填报模式

styles = make_styles()  # 自带边框

# 构建行数据（A列留空作label列，B列放控件）
rows = {
    "0": {"cells": {
        "1": {"text": "姓名", "style": 1},
        "2": {"fillForm": {
            "componentFlag": "input-text", "component": "Input",
            "field": "user_name", "placeholder": "请输入姓名", "required": True,
            "cnLabel": "姓名"
        }, "style": 2},
    }, "height": 45},
    "1": {"cells": {
        "1": {"text": "性别", "style": 1},
        "2": {"fillForm": {
            "componentFlag": "JRadio", "component": "JRadio",
            "field": "gender", "dataSource": "static",
            "options": [{"label": "男", "value": "1"}, {"label": "女", "value": "0"}],
            "h_align": "left", "cnLabel": "性别"
        }, "style": 2},
    }, "height": 45},
    "2": {"cells": {
        "1": {"text": "入职日期", "style": 1},
        "2": {"fillForm": {
            "componentFlag": "DatePicker-date", "component": "DatePicker",
            "field": "hire_date", "dateFormat": "yyyy-MM-dd", "dateShowType": "date",
            "placeholder": "请选择日期", "cnLabel": "入职日期"
        }, "style": 2},
    }, "height": 45},
}

cols = {"0": {"width": 27}, "1": {"width": 100}, "2": {"width": 200}, "len": 26}

payload = base_save(report_id, designer, rows=rows, cols=cols, styles=styles, merges=[])
payload["fillFormInfo"] = {"layout": {"direction": "horizontal", "width": 200, "height": 45}}
payload["fillFormToolbar"] = {"show": True, "btnList": ["save", "verify", "close"]}

session.request("/save", payload)
print(f"填报报表: http://BASE_URL/jmreport/testFillReport/{report_id}")
```

---

## 七、与数据集绑定

填报控件通过 `dbFieldBind` 关联数据库字段，用于**查询编辑**（回显已有记录）：

```python
cell["fillForm"] = {
    "componentFlag": "input-text",
    "component": "Input",
    "field": "user_name",
    "dbFieldBind": [
        {
            "dbCode": "ds_user",   # 数据集编码
            "field": "name",       # 数据集字段名
        }
    ],
}
```

---

## 八、填报工具条按钮说明

| btnList 值 | 显示名 | 说明 |
|-----------|--------|------|
| `save` | 保存 | 提交填报数据 |
| `verify` | 校验 | 手动触发校验 |
| `subTable_add` | 新增 | 子表新增行（需先选中子表单元格） |
| `subTable_del` | 删除 | 子表删除行 |
| `print` | 打印 | 打印填报内容 |
| `close` | 关闭 | 关闭填报页面 |
| `exportExcel` | Excel | 导出为 Excel |
| `exportPDF` | PDF | 导出为 PDF |
| `exportWord` | Word | 导出为 Word |
| `first`/`prev`/`next`/`last` | 首/上/下/末页 | 分页导航（查询填报模式） |
| `paging` | 分页 | 显示分页选择器 |
| `total` | 合计 | 显示总条数 |

---

## 九、注意事项

1. **`componentFlag` 与 `component` 必须同时设置**，`componentFlag` 是引擎识别用，`component` 是 Vue 渲染用
2. **没有选择组件（componentFlag 为空）的 cell.fillForm 会被引擎自动删除**，保存时不必担心空控件
3. **填报布局方向** `horizontal`=所有行等高（上窄下宽）；`vertical`=奇偶行交替高度（左窄右宽）
4. **`designerObj.submitForm !== 1` 时**，单元格的 `filterNegative`、`filterEmptyValue` 等计算规则才会显示
5. **调试填报报表预览地址**：`/jmreport/testFillReport/{id}`（设计器内预览）或 `/jmreport/fillReport/{id}`（正式预览）
