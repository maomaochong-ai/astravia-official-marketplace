# Online 表单数据 CRUD 参考

> 从 SKILL.md 提取的数据操作相关内容。

---

## 表单数据 CRUD API

| 操作 | 方法 | URL |
|------|------|-----|
| 新增(单表) | POST | `/online/cgform/api/form/{headId}?tabletype=1` |
| 新增(主子表) | POST | `/online/cgform/api/form/{headId}?tabletype=2` |
| 查询 | GET | `/online/cgform/api/form/{headId}/{dataId}` |
| 修改 | PUT | `/online/cgform/api/form/{headId}?tabletype=1或2` |
| 删除 | DELETE | `/online/cgform/api/form/{headId}/{dataId}` |
| 列表 | GET | `/online/cgform/api/getData/{headId}` |
| 批量删除 | DELETE | `/online/cgform/api/form/{headId}/{id1,id2,id3}` |

> `{headId}` 是**主表**的配置 ID，`{dataId}` 是数据记录 ID（多条用逗号分隔）。

---

## 树表数据 API

树表不使用 `getData`，而是用专用的 `getTreeData` 懒加载：

| 操作 | 方法 | URL |
|------|------|-----|
| 加载根节点 | GET | `/online/cgform/api/getTreeData/{headId}?column=id&order=asc` |
| 展开子节点 | GET | `/online/cgform/api/getTreeData/{headId}?column=id&order=asc&pid={parentId}&has_child=1` |

- 根节点：不传 `pid` 参数
- 子节点：传 `pid={父节点id}&has_child=1`
- 树表新增/编辑/删除使用 `tabletype=1`（与单表相同）

---

## 列表查询带过滤条件

`getData` 支持通过 URL 参数按字段过滤：
```
GET /online/cgform/api/getData/{headId}?fieldName=value&pageNo=1&pageSize=10
```
- 精确匹配：`?customer_name=华为科技`
- 模糊匹配：`?customer_name=*华为*`（前后加 `*`）
- 多条件：`?customer_name=*华为*&status=1`

---

## 主子表数据提交格式

**所有主题风格（normal/tab/erp/innerTable）的新增/编辑 API 完全相同**：
- 新增：`POST /online/cgform/api/form/{主表headId}?tabletype=2`
- 编辑：`PUT /online/cgform/api/form/{主表headId}?tabletype=2`
- 删除：`DELETE /online/cgform/api/form/{主表headId}/{dataId}`

> 注意：themeTemplate 只影响前端展示方式，不影响 API 调用。

body 中子表数据以**子表名为 key、数组为 value** 嵌入主表字段中：

```json
{
  "customer_name": "华为科技",
  "phone": "13800001111",
  "register_date": "2024-01-10",
  "demo_customer_detail": [
    {"address": "深圳市龙岗区", "industry": "H"}
  ],
  "demo_customer_contact": [
    {"contact_name": "张伟", "contact_phone": "13900001111", "content": "初次拜访"},
    {"contact_name": "李娜", "contact_phone": "13900002222", "content": "跟进方案"}
  ]
}
```

**关键规则：**
- **一对一子表**：数组中只有 1 个对象（`[{...}]`）
- **一对多子表**：数组中可有多个对象（`[{...},{...}]`）
- **空子表**：传空字符串 `""` 而不是空数组 `[]`
- **外键字段**（如 `customer_id`）：通过主表提交时**不需要传**（后端自动注入）；单独操作子表时**需要手动传**外键值
- **一对一子表限制**：每条主表记录只能对应一条子表数据，已有则只能 PUT 更新，不能再 POST 新增
- 日期字段格式：`"YYYY-MM-DD"`，日期时间：`"YYYY-MM-DD HH:mm:ss"`
- **造测试数据前必须先查字典实际值**，不能凭猜测填值（如 `urgent_level` 的值是 `1/2/3` 不是 `L/M/H`）。查询步骤见下方「数据字典查询 API」
- **PUT 更新必须传完整数据**：Online 表单的 PUT 接口是全量覆盖，只传部分字段会导致其他字段被清空。正确做法：先用 `GET /online/cgform/api/form/{headId}/{dataId}` 查询单条完整记录，修改目标字段后将完整数据 PUT 回去
- **树表数据编辑严禁用 getData**：`getData` 不返回隐藏字段（`isShowList=0` 的 `pid`、`has_child`），用 getData 查出的数据 PUT 回去会丢失 pid/has_child，导致树结构扁平化。树表编辑必须用单条查询 `GET /form/{headId}/{dataId}` 或直接在新增时就传入正确的完整数据

---

## 数据存储格式规则

### sel_depart / sel_user
- **sel_depart/sel_user 造数据需查实际 ID**：`sel_depart` 存储部门 id（如 `f4d5979edc1d4785ba2322f0b8200a21`），`sel_user` 默认存储 username。造数据前必须通过 API 查询实际值，不能传空或随意值。查询 API：`GET /sys/sysDepart/queryDepartTreeSync?primaryKey=key`（部门树）、`GET /sys/user/list`（用户列表）

### pca（省市区）
- **pca（省市区）存储格式**：只存储**最终选中的区级编码**（如 `"110101"`），**不是**逗号分隔的完整路径（~~`"110000,110100,110101"`~~）。前端 JCascader 组件内部使用路径数组，但提交到后端时只保存最末级编码

### cat_tree / sel_tree
- **cat_tree/sel_tree 存储格式**（源码 JCategorySelect.vue/JTreeSelect.vue）：
  - **单选**：存储选中项的 ID 字符串，如 `"1001"`
  - **多选**：存储逗号分隔的 ID 字符串，如 `"1001,1002,1003"`
  - **空值**：空字符串 `""`

### link_table（关联记录）
- **link_table（关联记录）存储格式**：
  - 存储关联表**记录的 ID**，如 `"2031931054625869826"`，多选逗号分隔
  - 自动生成 `{字段名}_dictText` 附加字段存显示文本（如 `f_link_table_dictText="重庆"`）
  - **link_table_field（他表字段）** 存储的是关联记录中对应字段的**实际文本值**（如 name 的值 `"重庆"`）
  - 造数据流程：先通过 `GET /online/cgform/api/getData/{关联表的表名}` 查关联表数据，获取记录 ID 和显示字段值

### popup
- **popup 存储格式**（源码 JPopup.vue）：**存储的是报表字段的实际值，不是 ID**。dictField/dictText 成对映射：
  - 配置 `dictField="username,realname"`, `dictText="f_popup,f_popup_back"`
  - 选中后：`f_popup` 存 `"qinfeng"`（username值），`f_popup_back` 存 `"秦风"`（realname值）
  - 多选时逗号分隔：`"qinfeng,admin"`
  - 造数据需先查 Online 报表数据：`GET /online/cgreport/api/getColumnsAndData/{reportId}?pageNo=1&pageSize=10&onlRepUrlParamStr=`（返回 `result.data.records`）

### popup_dict
- **popup_dict 存储格式**：存储选中记录的 dictField 值（如 `id`），同时自动生成 `{字段名}_dictText` 附加字段存显示文本（如 `f_popup_dict_dictText="超级管理员"`）

### _dictText 自动附加字段规律
- **`_dictText` 自动附加字段规律**：link_table、popup_dict、list（表字典）、sel_search 等使用字典表的控件，后端会自动生成 `{字段名}_dictText` 字段存储翻译后的显示文本，造数据时也应传入此字段

### file / image（文件/图片）
- **file/image（文件/图片）存储格式**：存储服务器相对路径，如 `"temp/filename_1773315344656.png"`，多个文件用逗号分隔如 `"temp/a.png,temp/b.jpg"`。造测试数据时可复用系统中已有的上传文件路径（从其他表的图片字段查询获取）

### link_down（联动下拉）
- **link_down（联动下拉）存储格式**：
  - 每级字段分别存储选中项的 **key 值**（即 dictTable 配置中 `key` 字段对应的列值，通常是 `id`）
  - 如：一级 `f_link_down1="1232263009944047617"`（山东省ID），二级 `f_link_down2="1232263054223314946"`（济南市ID）
  - 无子级时二级为空字符串 `""`
  - 造数据查询 API：`GET /online/cgform/api/querySelectOptions?table={表名}&txt={显示列}&key={值列}&idField=id&pidField=pid&pidValue={父ID}`（一级用 `condition` 参数代替 `pidValue`）
  - 返回格式：`[{label, store, id, pid}]`

### checkbox
- **所有 checkbox 字段必须用字符串 `'1'`/`'0'`，不是整数 1/0**

---

## 数据字典查询 API

| 操作 | 方法 | URL |
|------|------|-----|
| 字典列表 | GET | `/sys/dict/list?column=createTime&order=desc&pageNo=1&pageSize=10` |
| 按编码搜索字典 | GET | `/sys/dict/list?dictCode=*urgent_level*` |
| 按名称搜索字典 | GET | `/sys/dict/list?dictName=*紧急*` |
| 查询字典项（通过dictId） | GET | `/sys/dictItem/list?pageNo=1&pageSize=10&dictId={dictId}` |
| **按 dictCode 直接拿字典项**（一次调用） | GET | `/sys/api/queryDictItemsByCode?code={dictCode}` |

**使用流程：** 先通过 `/sys/dict/list` 查到字典的 `id`，再通过 `/sys/dictItem/list?dictId={id}` 查 `itemValue`（存储值）和 `itemText`（显示文本）。

**`queryDictItemsByCode` 用法说明：**
- 已知 `dictCode` 且只需要字典项（不关心字典本身的元数据）时，用 `GET /sys/api/queryDictItemsByCode?code={dictCode}` **一次调用**即可拿到 `[{value, text, color}]` 数组，比上面的两步法快。
- 内置字典（`yn` / `sex` / `valid_status` / `priority` / `bpm_status` 等，见 `SKILL.md` 内置字典表）**不要调用此接口**，直接用固化值。
- ❌ **错误反例（后端不存在）**：`/sys/dict/queryDictItemsByCode/{code}` —— 路径前缀错（应为 `/sys/api`）、参数风格错（应为 query 串，不是 path variable）。误用会返回 `"路径不存在，请检查路径是否正确"`。

---

## 创建数据字典 API

| 操作 | 方法 | URL |
|------|------|-----|
| 新增字典 | POST | `/sys/dict/add` body: `{"dictName":"审核状态","dictCode":"audit_status","description":"说明"}` |
| 新增字典项 | POST | `/sys/dictItem/add` body: `{"dictId":"字典ID","itemText":"待审核","itemValue":"0","sortOrder":1,"status":1}` |

创建流程：先 `/sys/dict/add` 拿到字典 ID → 再逐个 `/sys/dictItem/add` 添加字典项。

---

## 分类字典/自定义树 数据查询 API

| 操作 | 方法 | URL | 说明 |
|------|------|-----|------|
| 分类字典根节点 | GET | `/sys/category/rootList?pageNo=1&pageSize=10` | 获取所有分类（含 id、code、name） |
| 分类字典子节点 | GET | `/sys/category/childList?pid=&code={code}` | 通过分类编码获取子节点列表 |
| 分类字典按ID查子节点 | GET | `/sys/category/childList?pid={parentId}` | 通过父节点ID获取子节点 |

- **cat_tree 造数据**：通过 `/sys/category/rootList` 查根分类，再通过 `/sys/category/childList?pid={parentId}` 查子节点，取节点 id 填入字段。注意 cat_tree 的 dictField 如果填了分类编码（如 `B01`），系统会查 `SYS_CATEGORY` 表过滤，**在 `lower_case_table_names=0` 的 MySQL 上会报表不存在错误**，此时应清空 dictField
- **sel_tree 造数据**：通过 `/sys/category/rootList` 查根节点 id，填入字段

---

## onlform_data.py 脚本 config 参数速查（易错）

> 调用 `scripts/onlform_data.py` 时，config JSON 的 key 名称与直觉不符，以下是经过验证的正确名称：

| action | 易错写法 | 正确写法 | 说明 |
|--------|---------|---------|------|
| `insert` | `rows` | **`records`** | 待插入的记录数组 |
| `delete` | `ids` | **`dataIds`** | 待删除的 ID 字符串数组 |
| `update` | `id` | **`dataId`** | 待更新的单条记录 ID |

**insert 示例：**
```json
{"action": "insert", "tableName": "sales_record", "records": [{"name": "华为Mate60", "value": 320}]}
```

**delete 示例：**
```json
{"action": "delete", "tableName": "sales_record", "dataIds": ["id1", "id2"]}
```

**update 示例：**
```json
{"action": "update", "tableName": "sales_record", "dataId": "id1", "data": {"name": "新名称"}}
```

> update 内部会先 GET 完整记录再合并 data 字段后 PUT，无需传全量字段。

---

## 数据导出（CLI 替代方案）

`exportXlsOld` 接口仅浏览器可用，CLI 环境使用以下方案导出数据：

```python
# 1. 获取列定义
cols = api_get(f'/online/cgform/api/getColumns/{HEAD_ID}')
columns = cols['result']['columns']
col_map = {c['dataIndex']: c['title'] for c in columns if c.get('dataIndex') and c['dataIndex'] != 'rowIndex'}

# 2. 获取数据
data = api_get(f'/online/cgform/api/getData/{HEAD_ID}?pageNo=1&pageSize=100&column=createTime&order=desc')
records = data['result']['records']

# 3. 写入 CSV（UTF-8-BOM 编码，Excel 直接打开不乱码）
import csv
with open('export.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    keys = list(col_map.keys())
    writer.writerow([col_map[k] for k in keys])
    for r in records:
        row = [r.get(f'{k}_dictText', r.get(k, '')) or '' for k in keys]
        writer.writerow(row)
```
