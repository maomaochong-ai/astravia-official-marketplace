# Online 表单控件类型完整清单

> 来源：`src/views/super/online/cgform/components/tables/PageAttributeTable.vue`

## 单表/主表控件类型（26种）

| # | value | title | 说明 |
|---|-------|-------|------|
| 1 | `text` | 文本框 | 单行文本输入 |
| 2 | `password` | 密码 | 密码输入框 |
| 3 | `list` | 下拉框 | 字典下拉单选 |
| 4 | `radio` | 单选框 | 字典单选 |
| 5 | `checkbox` | 多选框 | 字典多选 |
| 6 | `switch` | 开关 | Y/N 开关 |
| 7 | `date` | 日期(年月日) | 日期选择 yyyy-MM-dd |
| 8 | `datetime` | 日期(年月日时分秒) | 日期时间选择 yyyy-MM-dd HH:mm:ss |
| 9 | `time` | 时间(HH:mm:ss) | 时间选择 |
| 10 | `file` | 文件 | 文件上传 |
| 11 | `image` | 图片 | 图片上传 |
| 12 | `textarea` | 多行文本 | 多行文本域 |
| 13 | `umeditor` | 富文本 | 富文本编辑器 |
| 14 | `markdown` | MarkDown | Markdown 编辑器 |
| 15 | `sel_user` | 用户选择 | 选择系统用户 |
| 16 | `sel_depart` | 部门选择 | 选择组织部门 |
| 17 | `link_table` | 关联记录 | 关联其他 Online 表的记录 |
| 18 | `link_table_field` | 他表字段 | 引用他表字段值（不持久化） |
| 19 | `pca` | 省市区组件 | 省市区三级联动 |
| 20 | `popup` | Popup弹框 | 弹窗选择 |
| 21 | `popup_dict` | Popup字典 | Popup 字典选择 |
| 22 | `list_multi` | 下拉多选框 | 字典下拉多选 |
| 23 | `sel_search` | 下拉搜索框 | 字典表下拉搜索 |
| 24 | `cat_tree` | 分类字典树 | 分类字典树选择 |
| 25 | `sel_tree` | 自定义树控件 | 自定义树选择 |
| 26 | `link_down` | 联动组件 | 联动下拉/级联 |

## 子表控件类型（18种）

子表（不论一对一还是一对多）仅支持以下 18 种控件：

| # | value | title |
|---|-------|-------|
| 1 | `text` | 文本框 |
| 2 | `radio` | 单选框 |
| 3 | `switch` | 开关 |
| 4 | `date` | 日期(yyyy-MM-dd) |
| 5 | `datetime` | 日期(yyyy-MM-dd HH:mm:ss) |
| 6 | `time` | 时间(HH:mm:ss) |
| 7 | `file` | 文件 |
| 8 | `image` | 图片 |
| 9 | `list` | 下拉框 |
| 10 | `list_multi` | 下拉多选框 |
| 11 | `sel_search` | 下拉搜索框 |
| 12 | `popup` | popup弹出框 |
| 13 | `link_table` | 关联记录 |
| 14 | `link_table_field` | 他表字段 |
| 15 | `sel_depart` | 部门选择 |
| 16 | `sel_user` | 用户选择 |
| 17 | `pca` | 省市区组件 |
| 18 | `textarea` | 多行文本 |

## 子表不支持的控件（8种，仅主表/单表可用）

| value | title | 原因 |
|-------|-------|------|
| `password` | 密码 | 子表行内不适合密码输入 |
| `checkbox` | 多选框 | 子表行内空间不足，用 list_multi 替代 |
| `umeditor` | 富文本 | 行内无法展示富文本编辑器 |
| `markdown` | MarkDown | 行内无法展示 Markdown 编辑器 |
| `cat_tree` | 分类字典树 | 子表不支持 |
| `sel_tree` | 自定义树控件 | 子表不支持 |
| `link_down` | 联动组件 | 子表不支持 |
| `popup_dict` | Popup字典 | 子表已注释掉（代码中被注释） |

## 特殊控件配置要点（易错！）

> 来源：官方文档 `docs/java/online/form/component1.md`

### popup 弹框（依赖 Online 报表）
- **dictTable** = Online 报表编码（如 `report_user`），**不是数据库表名！**
- **dictField** = 报表中的字段名（多个逗号隔开），如 `username,realname`
- **dictText** = 本表接收回填的字段名（多个逗号隔开），如 `popup_field,popup_back`
- 第一个 dictField↔dictText 对应 popup 本身，后续的是回填到其他字段
```json
{"fieldShowType": "popup", "dictTable": "report_user", "dictField": "username,realname", "dictText": "popup_field,popup_back"}
```

### popup_dict 字典（依赖 Online 报表）
- **dictTable** = Online 报表编码（如 `report_user`），**不是数据库表名！**
- **dictField** = 表单真实获取的值字段（类似下拉框 value），如 `username`
- **dictText** = 显示框显示的字段（类似下拉框 label），如 `realname`
- popup_dict 只回填当前字段，不回填其他字段（与 popup 的区别）
```json
{"fieldShowType": "popup_dict", "dictTable": "report_user", "dictField": "username", "dictText": "realname"}
```

### link_down 联动组件
- **只有第一个字段**配 `link_down` 类型，后续级联字段配 **`text` 类型**即可
- 第一个字段的 dictTable 填 JSON 配置，`linkField` 指向后续字段名
- 后续字段不需要任何字典配置
```
第一个字段(province): fieldShowType=link_down, dictTable=JSON配置(含linkField:"city,area")
第二个字段(city):     fieldShowType=text
第三个字段(area):     fieldShowType=text
```
JSON 配置格式：
```json
{"table":"sys_test_link","txt":"name","key":"id","linkField":"city,area","idField":"id","pidField":"pid","condition":"pid = '1'"}
```

### 下拉框/多选框/单选框/下拉多选/下拉搜索 — 字典配置（重要！）
**这 5 种控件只支持「数据字典（系统字典）」和「表字典」两种模式，不支持 popup！**

| 控件 | 数据字典（系统字典） | 表字典 | popup |
|------|---------|--------|-------|
| `list` 下拉框 | ✅ | ✅ | ❌ |
| `checkbox` 多选框 | ✅ | ✅ | ❌ |
| `radio` 单选框 | ✅ | ✅ | ❌ |
| `list_multi` 下拉多选 | ✅ | ✅ | ❌ |
| `sel_search` 下拉搜索 | ✅ | ✅ | ❌ |

配置方式：
```json
// 数据字典（系统字典）（dictField 填字典编码，dictTable 留空）
{"fieldShowType": "checkbox", "dictField": "hobby", "dictTable": "", "dictText": ""}
// 表字典（dictTable 填数据库表名，dictField 填存储值字段，dictText 填显示文本字段）
{"fieldShowType": "list", "dictTable": "sys_role", "dictField": "role_code", "dictText": "role_name"}
```
- **不要用 fieldExtendJson 的 options**（那是前端内联选项，非标准字典配置）
- 需要先确认数据字典（系统字典）是否存在，不存在需先创建（用 jeecg-system skill）

### 字段名禁用列表（系统保留字段，不能作为业务字段名！）
以下 6 个字段名是系统自动生成的，业务字段不能使用，否则插入数据报 `Column specified twice`：
- `id`、`create_by`、`create_time`、`update_by`、`update_time`、`sys_org_code`

如需存储部门编码默认值 `#{sysOrgCode}`，字段名用 `cur_org_code` 等非冲突名称。

### switch 开关
- 默认值 Y/N，自定义通过扩展参数配置数组如 `[1,2]`（第一个=是，第二个=否）
- fieldExtendJson 格式：`"[\"Y\",\"N\"]"` 或 `"[1,0]"`

### cat_tree 分类字典树
- dictField 填分类字典的**类型编码**（如 `B02`），表示只加载该节点以下的数据
- 数据来源：【系统管理】→【分类字典】
- **存储值 = `sys_category.id`（节点主键）**，不是 code 也不是 name
- 多选时逗号分隔，如 `"id1,id2,id3"`
- 前端通过 `loadTreeData({ pid, pcode })` 加载树，通过 `loadDictItem({ ids })` 回显文本
- **插入数据时获取节点 ID 的两种方式：**
  1. 通过编码模糊查根节点：`GET /sys/category/rootList?code=*B02*` → 拿到 `id`
  2. 加载子节点：`GET /sys/category/loadTreeData?pid={父节点ID}&pcode=0&condition=` → 拿到子节点 `key`

### 默认值中使用填值规则
- 填值规则默认值格式：`${规则编码}`，如 `${shop_order_num}`
- **使用填值规则的字段必须设为只读**（`isReadOnly=1`），防止用户手动修改自动生成的值
- 可通过 `GET /sys/fillRule/list` 查询系统中可用的填值规则编码

### sel_tree 自定义树
- dictTable = 树数据表名（如 `sys_category`）
- dictField = 根节点父ID值（填 `0` 表示全部显示）
- dictText = `ID列,父ID列,显示列,是否有子节点列`（如 `id,pid,name,has_child`）
- **存储值 = dictText 中第1个字段（ID列）的值**
- **使用 `sys_category` 作为数据源时，必须通过 `componentProps` 配置（而非 dictTable/dictField），格式如下：**
```json
{
  "componentProps": {
    "dict": "sys_category,name,id",
    "pidField": "pid",
    "pidValue": "0",
    "multiple": false
  }
}
```
- `dict` 格式：`表名,显示列,值列`
- `pidField`：父ID字段名
- `pidValue: "0"`：必填，指定根节点父ID，缺少此项会导致树节点加载异常
- `multiple`：是否多选
