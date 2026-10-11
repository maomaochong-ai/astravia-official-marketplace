# Online 报表 API 参考

## 报表管理 API

### 查询报表列表
```
GET /online/cgreport/head/list
GET /online/cgreport/head/list?code={报表编码}   # 按编码精确查找
```

### 查询报表详情
```
GET /online/cgreport/head/queryById?id={headId}
```

### 查询报表字段
```
GET /online/cgreport/item/listByHeadId?headId={headId}
```

### 按编码查询报表字段（推荐）
```
GET /online/cgreport/item/listByHeadCode?headCode={报表编码}
```
直接通过报表编码查询字段，无需先查 headId。

### 查询报表参数
```
GET /online/cgreport/param/listByHeadId?headId={headId}
```

### 解析 SQL 字段和参数
```
GET /online/cgreport/head/parseSql?sql={urlEncodedSql}&dbKey={dbKey}
```
- `sql`: URL 编码后的 SELECT 语句
- `dbKey`: 数据源编码，默认数据源可不传
- **返回值**：`fields[]`（字段列表）、`params[]`（参数列表）

### 创建报表
```
POST /online/cgreport/head/add
```

### 编辑报表
```
PUT /online/cgreport/head/editAll
```

---

## 请求体结构

### head（报表头）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 报表 ID（编辑时必填，新增时不填） |
| code | String | 报表编码（唯一） |
| name | String | 报表名称 |
| cgrSql | String | SELECT 查询语句 |
| dbSource | String | 数据源编码，空=默认 |

### items（字段列表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 雪花 ID（19位数字字符串），新增时生成 |
| headId | String | 报表 ID（关联 head） |
| fieldName | String | 字段名（数据库列名） |
| fieldTxt | String | 显示名称（中文） |
| fieldWidth | Integer | 列宽（像素），可 null |
| fieldType | String | 字段类型：String/Integer/Long/BigDecimal/Date/Datetime |
| searchMode | String | 查询模式：like/single/range，可 null |
| isOrder | Integer | 是否排序：1=是，null=否 |
| isSearch | Integer | 是否查询：1=是，null=否 |
| dictCode | String | 字典编码，可 null |
| fieldHref | String | 字段跳转链接，可 null |
| isShow | Integer | 是否显示：1=是，0=否 |
| orderNum | Integer | 排序序号（从 0 开始） |
| replaceVal | String | 值替换，如 `男_1,女_2` |
| isTotal | String | 是否合计："1"=是，null=否 |
| groupTitle | String | 分组表头名称 |

### params（参数列表）
| 字段 | 类型 | 说明 |
|------|------|------|
| paramName | String | 参数名（对应 SQL 中的 `${paramName}`） |
| paramTxt | String | 参数显示名称 |
| paramValue | String | 默认值 |
| orderNum | Integer | 排序序号 |

### editAll 专用字段
| 字段 | 说明 |
|------|------|
| deleteItemIds | 要删除的字段 ID，逗号分隔 |
| deleteParamIds | 要删除的参数 ID，逗号分隔 |

---

## 数据规则 API

### 查询菜单下所有数据规则（两个接口均可用，返回数据相同）
```
GET /sys/permission/queryPermissionRule?permissionId={menuId}
GET /sys/permission/getPermRuleListByPermId?permissionId={menuId}
```
返回 `result[]`，每条含 `id`、`ruleName`、`ruleColumn`、`ruleConditions`、`ruleValue`、`status`。

> ⚠️ `addPermissionRule` 返回的 `result` 为 **null**，创建后必须用上述接口查询获取真实规则 ID。按 `ruleName` 匹配且 `status == null` 的条目即为刚创建的规则。

### 创建数据规则
```
POST /sys/permission/addPermissionRule
{"permissionId":"{menuId}","ruleName":"规则名","ruleColumn":"字段名","ruleConditions":"=","ruleValue":"'值'"}
```

### 启用/修改数据规则
```
POST /sys/permission/editPermissionRule
{"id":"{ruleId}","permissionId":"{menuId}","ruleName":"规则名","ruleColumn":"字段名","ruleConditions":"=","ruleValue":"'值'","status":"1"}
```
- `status:"1"` 为启用，不传或 `null` 为禁用
- `ruleConditions` 来自系统字典 `rule_conditions`（`GET /sys/dict/getDictItems/rule_conditions`），常用值：`=`、`!=`、`>=`、`<=`、`like`、`in`、`USE_SQL_RULES`（不支持 `is not null` / `is null`）
- `USE_SQL_RULES` 时 `ruleColumn` 无需填写，`ruleValue` 直接写 WHERE 子句表达式（不含 WHERE 关键字）

### 删除数据规则
```
DELETE /sys/permission/deletePermissionRule?id={ruleId}
```

### 授权数据规则给角色
```
POST /sys/role/datarule
{"permissionId":"{menuId}","roleId":"{roleId}","dataRuleIds":"{ruleId1},{ruleId2}"}
```
> 前提：该角色必须已有菜单权限，否则报"请先保存角色菜单权限!"

### 查询角色数据规则授权情况
```
GET /sys/role/datarule/{menuId}/{roleId}
```
返回 `datarule[]`（全部规则）和 `drChecked`（已授权给该角色的规则 ID，逗号分隔）。

---

## 菜单 SQL

报表创建后，需要插入菜单才能在前台显示：

```sql
INSERT INTO sys_permission (
  id, parent_id, name, url, component, component_name,
  is_route, is_leaf, keep_alive, hidden, hide_tab, description,
  del_flag, rule_flag, status, internal_or_external,
  perms_type, sort_no, menu_type, route_redirect
) VALUES (
  '{headId}', NULL, '{报表名称}',
  '/online/cgreport/{headId}',
  'modules/online/cgreport/auto/OnlCgreportAutoMain',
  NULL,
  1, 1, 0, 0, 0, NULL,
  0, 0, '1', 0,
  '0', 1.0, 1, NULL
);
```

---

## 常用系统字典

| 字典编码 | 说明 |
|---------|------|
| `sex` | 性别 (1=男, 2=女) |
| `priority` | 优先级 |
| `valid_status` | 有效状态 |
| `urgent_level` | 紧急程度 |
| `yn` | 是否 |

---

## 字段 ID 生成规则

雪花 ID 格式（19位数字字符串）：

```python
import time, random
def gen_id():
    return str(int(time.time() * 1000) * 1000000 + random.randint(100000, 999999))
```

---

## parseSql 返回示例

```json
{
  "success": true,
  "result": {
    "fields": [
      {
        "id": "2032684046700560386",
        "fieldName": "id",
        "fieldTxt": "id",
        "fieldType": "String",
        "isShow": 1,
        "orderNum": 1
      }
    ],
    "params": []
  }
}
```

> **注意**：parseSql 返回的 fieldType 通常都是 String，需根据字段语义修正。fieldTxt 等于 fieldName，需翻译为中文。
