# desform_data_utils.py 数据操作工具参考

位于 `scripts/desform_data_utils.py`。提供表单数据的 CRUD、批量操作、复制、回收站等功能。

> **阅读建议**：需要某个函数的详细说明时，直接 grep 函数名定位行号，再用 offset+limit 读取对应章节，无需全量阅读本文件。

## 函数速查表

| 函数 | 适用场景 |
|------|---------|
| `add_data(code, data_dict)` | 新增一条数据 |
| `get_data(code, data_id)` | 查询单条数据 |
| `list_data(code, page, size, super_query, ...)` | 分页查询数据列表（支持高级查询） |
| `edit_data(code, data_id, data_dict)` | 编辑数据（⚠️ 全量覆盖，需先取原数据再合并） |
| `delete_data(code, data_id, hard=False)` | 删除单条（hard=True 物理删除） |
| `delete_data_batch(code, ids, hard=False)` | 批量删除 |
| `copy_record(code, data_id)` | 复制单条数据 |
| `copy_records(code, ids)` | 批量复制数据 |
| `batch_update(code, field, val, id_list)` | 将多条记录的同一字段批量设为相同值 |
| `restore_data(code, ids)` | 从回收站还原数据 |
| `clear_recycle(code)` | 清空回收站（不可恢复） |
| `check_unique(code, field_model, value, exclude_id)` | 检查字段值唯一性 |
| `get_statistical(code, operation_type, field, ...)` | 聚合统计（count/max/min/avg/sum） |

---

## 初始化

```python
from desform_utils import init_api
from desform_data_utils import *   # 或按需导入具体函数

init_api('<api_base>', '<token>')
```

`desform_data_utils` 内部自动导入 `desform_utils.api_request`，**不需要**也**不能**再次 `from desform_data_utils import init_api`（该模块没有 init_api）。

---

## add_data

```python
add_data(code, data_dict) -> dict
# 新增一条表单数据
#
# Args:
#   code:      表单编码
#   data_dict: {字段model: 值, ...}，key 必须是 model 而非字段名
#
# Returns:
#   新增的数据记录 dict（含 id）
#
# 示例：
from desform_utils import init_api, get_form_fields
from desform_data_utils import add_data

init_api(api_base, token)
title_field, fields = get_form_fields('my_form')
result = add_data('my_form', {
    fields['姓名']['model']:   '张三',
    fields['手机号']['model']: '13800138001',
    fields['部门']['model']:   'dept_001',
})
data_id = result['id']
```

### link-record 字段值格式（⚠️ 实测验证）

```python
# ✅ 正确：传 Python list，内部 json.dumps 序列化为 ["id"]
add_data('my_form', {fields['客户']['model']: ['2042226506569424897']})

# ❌ 错误：传字符串，服务端 fastjson 报 parse error（记录仍写库但格式异常）
add_data('my_form', {fields['客户']['model']: '2042226506569424897'})

# ❌ 错误：手动 json.dumps，导致二次序列化为 "[\"id\"]"，前端无法识别
add_data('my_form', {fields['客户']['model']: json.dumps(['2042226506569424897'])})
```

---

## get_data

```python
get_data(code, data_id) -> dict | None
# 查询单条数据
#
# Returns:
#   数据记录 dict，含 id 和各字段值；不存在时返回 None
#
# 示例：
record = get_data('my_form', '1234567890')
```

---

## list_data

```python
list_data(code, page=1, size=10, super_query=None,
          sort_column=None, sort_order=None) -> dict
# 分页查询数据列表
#
# Args:
#   code:        表单编码
#   page:        页码（从 1 开始）
#   size:        每页数量
#   super_query: 高级查询 JSON 字符串（见下方格式）
#   sort_column: 排序字段 model（如 'create_time'）
#   sort_order:  排序方向，'asc' 或 'desc'
#
# Returns:
#   {'records': [{'id': '...', 'desformData': {字段数据}}, ...], 'total': int}
#   ⚠️ 字段数据在 desformData 内，不在记录顶层

# 示例：查询全部（分批）
page = 1
all_records = []
while True:
    result = list_data('my_form', page=page, size=100)
    all_records.extend(result['records'])
    if len(all_records) >= result['total']:
        break
    page += 1
```

### super_query 格式

```python
import json, urllib.parse

# 单条件
sq = json.dumps({
    "matchType": "and",
    "conditionsGroup": [
        {
            "matchType": "and",
            "showPop": False,
            "queryItems": [
                {"field": "select_xxx", "rule": "eq", "val": "待审核",
                 "type": "select", "name": "状态", "valText": ""}
            ]
        }
    ]
})
result = list_data('my_form', super_query=sq)
```

> `rule` 值使用 **小写**（`eq`/`ne`/`like` 等），详见 `desform-filter-rules.md`。

---

## edit_data

```python
edit_data(code, data_id, data_dict) -> dict
# 编辑一条数据
#
# ⚠️ 全量覆盖：data_dict 替换整条记录，未传入的字段值将被清空
# ⚠️ 只更新部分字段时，必须先取出原数据再合并修改：
#
# 正确写法：
result = list_data('my_form', size=100)
for r in result['records']:
    data = dict(r['desformData'])      # ✅ 取 desformData，不是整个 r
    data[fields['状态']['model']] = '已完成'
    edit_data('my_form', r['id'], data)
```

---

## delete_data

```python
delete_data(code, data_id, hard=False)
# 删除单条数据
#
# hard=False: 逻辑删除（进回收站，可还原）
# hard=True:  物理删除（不可恢复）
```

---

## delete_data_batch

```python
delete_data_batch(code, ids, hard=False)
# 批量删除数据
#
# ids: ID 列表 ['id1', 'id2'] 或逗号分隔字符串 'id1,id2'
# hard: False=逻辑删除 True=物理删除
```

---

## copy_record

```python
copy_record(code, data_id) -> dict
# 复制单条数据（生成副本）
#
# Returns:
#   新记录 dict（含 id）
```

---

## copy_records

```python
copy_records(code, ids) -> dict
# 批量复制数据
#
# ids: ID 列表或逗号分隔字符串
```

---

## batch_update

```python
batch_update(code, field, val, id_list) -> dict
# 批量更新指定字段的值（将多条记录的同一字段设为相同值）
#
# Args:
#   code:    表单编码
#   field:   字段 model
#   val:     新值
#   id_list: 要更新的 ID 列表
#
# 示例：将多条记录的状态改为"已完成"
batch_update('my_form', fields['状态']['model'], '已完成',
             ['id1', 'id2', 'id3'])
```

---

## restore_data

```python
restore_data(code, ids)
# 从回收站还原数据
#
# ids: ID 列表或逗号分隔字符串
```

---

## clear_recycle

```python
clear_recycle(code)
# 清空表单回收站（物理删除所有已逻辑删除的记录，不可恢复）
```

---

## check_unique

```python
check_unique(code, field_model, field_value, exclude_id=None) -> bool
# 检查字段值唯一性
#
# Returns:
#   True = 唯一（无重复），False = 存在重复
#
# exclude_id: 编辑时排除自身 ID，避免与自身比较
#
# 示例：
is_unique = check_unique('my_form', fields['工号']['model'], 'EMP001',
                          exclude_id='current_record_id')
```

---

## get_statistical

```python
get_statistical(code, operation_type, field, super_query=None) -> any
# 聚合统计查询
#
# Args:
#   operation_type: 'count' | 'max' | 'min' | 'avg' | 'sum'
#   field:          统计字段 model
#   super_query:    筛选条件（JSON 字符串，格式同 list_data 的 super_query）
#
# 示例：统计全部记录数
total = get_statistical('my_form', 'count', fields['姓名']['model'])

# 示例：统计"已完成"状态下的金额总计
sq = json.dumps({
    "matchType": "and",
    "conditionsGroup": [{
        "matchType": "and", "showPop": False,
        "queryItems": [{"field": fields['状态']['model'], "rule": "eq",
                        "val": "已完成", "type": "select", "valText": ""}]
    }]
})
total_amount = get_statistical('my_form', 'sum', fields['金额']['model'], super_query=sq)
```
